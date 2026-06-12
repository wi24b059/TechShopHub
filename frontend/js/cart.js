// Simple AJAX cart. The cart itself lives in the PHP session.

function api(data) {
    return fetch(getApiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }).then(r => r.json());
}

function cartMessage(message, type) {
    const box = document.getElementById('message-box');
    if (!box) return;
    const cls = type === 'success' ? 'alert-success' : 'alert-danger';
    box.innerHTML = `<div class="alert ${cls} mb-0">${escapeHtml(message)}</div>`;
}

function addToCart(product) {
    api({ action: 'cartAdd', productId: product.id }).then(r => {
        updateBadge(r.count);
        cartMessage(r.message || 'Produkt im Warenkorb.', r.status === 'success' ? 'success' : 'error');
    });
}

function removeCart(pid) {
    return api({ action: 'cartUpdate', productId: pid, qty: 0 }).then(() => initCart());
}

function updateQty(pid, qty) {
    return api({ action: 'cartUpdate', productId: pid, qty: qty }).then(() => initCart());
}

function updateBadge(count) {
    const badge = document.getElementById('cart-badge');
    if (!badge) return;

    const done = c => {
        badge.textContent = c;
        badge.hidden = c === 0;
    };

    if (typeof count === 'number') done(count);
    else api({ action: 'cartGet' }).then(r => done(r.count || 0));
}

function initCart() {
    const tbody = document.getElementById('cart-items-tbody');
    if (!tbody) {
        updateBadge();
        return;
    }

    api({ action: 'cartGet' }).then(r => renderCart(r.items || []));
}

function renderCart(items) {
    const tbody = document.getElementById('cart-items-tbody');
    const empty = document.getElementById('cart-empty-message');
    const table = document.getElementById('cart-table-container');
    if (!tbody) return;

    let total = 0;
    items.forEach(item => total += Number(item.price) * Number(item.qty));

    if (empty) empty.hidden = items.length > 0;
    if (table) table.hidden = items.length === 0;

    tbody.innerHTML = items.map(item => `
        <tr>
            <td><img src="${escapeHtml(getImageUrl(item.image_path || ''))}" style="max-width:60px;height:auto;" alt=""></td>
            <td><strong>${escapeHtml(item.name)}</strong><br><small>${escapeHtml(item.category_name || '')}</small></td>
            <td>EUR ${Number(item.price).toFixed(2)}</td>
            <td><input class="form-control" style="width:70px" type="number" min="1" value="${item.qty}"
                onchange="updateQty(${item.id}, parseInt(this.value || '1', 10))"></td>
            <td>EUR ${(Number(item.price) * Number(item.qty)).toFixed(2)}</td>
            <td><button class="btn btn-sm btn-danger" onclick="removeCart(${item.id})">Entfernen</button></td>
        </tr>
    `).join('');

    const totalEl = document.getElementById('cart-total');
    if (totalEl) totalEl.textContent = total.toFixed(2);
    updateBadge(items.reduce((sum, item) => sum + Number(item.qty), 0));
}

function clearCart() {
    api({ action: 'cartClear' }).then(() => initCart());
}

function placeOrder() {
    const payment = document.getElementById('payment-method');
    const coupon = document.getElementById('coupon-code');
    const paymentMethod = payment ? payment.value : '';
    const couponCode = coupon ? coupon.value.trim() : '';

    if (!paymentMethod) {
        cartMessage('Bitte Zahlungsart auswaehlen.', 'error');
        return;
    }
    if (paymentMethod === 'Gutschein' && !couponCode) {
        cartMessage('Bitte Gutscheincode eingeben.', 'error');
        return;
    }

    api({ action: 'placeOrder', paymentMethod, couponCode }).then(r => {
        if (r.status === 'success') {
            cartMessage('Bestellung gespeichert. ID: ' + r.order_id, 'success');
            initCart();
        } else if ((r.message || '').includes('melden')) {
            cartMessage(r.message, 'error');
            setTimeout(() => location.href = 'login.html', 1200);
        } else {
            cartMessage(r.message || 'Bestellung fehlgeschlagen.', 'error');
        }
    });
}

function initCartDrop() {
    const link = document.getElementById('nav-cart-link');
    if (!link) return;

    link.addEventListener('dragover', e => e.preventDefault());
    link.addEventListener('drop', e => {
        e.preventDefault();
        const productId = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (productId > 0) addToCart({ id: productId });
    });
}

function initOrders() {
    const box = document.getElementById('orders-list');
    if (!box) return;

    api({ action: 'getUserOrders' }).then(r => {
        if (r.status !== 'success') {
            box.innerHTML = '<div class="alert alert-danger">Bitte zuerst einloggen.</div>';
            return;
        }

        box.innerHTML = (r.orders || []).map(o => `
            <button class="list-group-item list-group-item-action" onclick="loadOrderDetails(${o.id})">
                Bestellung #${o.id} - EUR ${Number(o.total_price).toFixed(2)} - ${escapeHtml(o.created_at)}
            </button>
        `).join('') || '<div class="text-muted">Keine Bestellungen vorhanden.</div>';
    });
}

function loadOrderDetails(id) {
    api({ action: 'getOrderDetails', orderId: id }).then(r => {
        const box = document.getElementById('order-details');
        if (!box || r.status !== 'success') return;

        const items = r.data.items || [];
        const order = r.data.order || {};
        box.innerHTML = `
    <h2 class="h5">Bestellung #${id}</h2>

    <p>
        Zahlung: ${escapeHtml(order.payment_method || '-')}<br>
        Gutschein: ${escapeHtml(order.coupon_code || '-')}<br>
        Rabatt: EUR ${Number(order.discount || 0).toFixed(2)}
    </p>

    <ul class="list-group mb-3">
        ${items.map(i => `
            <li class="list-group-item">
                ${escapeHtml(i.name)}
                x ${i.quantity}
                - EUR ${Number(i.price_at_purchase).toFixed(2)}
            </li>
        `).join('')}
    </ul>

    <button
        class="btn btn-primary"
        onclick='printInvoice(${JSON.stringify(JSON.stringify({
            id: id
        }))})'>
        Rechnung drucken
    </button>
`;
    });
}
function printInvoice(orderId)
{
    api({
        action: 'getOrderDetails',
        orderId: orderId
    }).then(r => {

        if (r.status !== 'success') return;

        const items = r.data.items || [];
        const order = r.data.order || {};

        const total =
            items.reduce(
                (sum, item) =>
                    sum +
                    Number(item.price_at_purchase) *
                    Number(item.quantity),
                0
            );

        const popup = window.open('', '_blank');

        popup.document.write(`
            <html>
            <head>
                <title>Rechnung ${orderId}</title>

                <style>
                    body{
                        font-family: Arial;
                        padding:20px;
                    }

                    table{
                        width:100%;
                        border-collapse:collapse;
                    }

                    th,td{
                        border:1px solid #ccc;
                        padding:8px;
                    }
                </style>
            </head>

            <body>

                <h1>TechShopHub Rechnung</h1>

                <p>
                    <strong>Rechnungsnummer:</strong>
                    R-${orderId}
                </p>

                <p>
                    <strong>Datum:</strong>
                    ${order.created_at || ''}
                </p>

                <p>
                    <strong>Zahlung:</strong>
                    ${order.payment_method || '-'}
                </p>

                <table>

                    <tr>
                        <th>Produkt</th>
                        <th>Menge</th>
                        <th>Preis</th>
                    </tr>

                    ${items.map(item => `
                        <tr>
                            <td>${item.name}</td>
                            <td>${item.quantity}</td>
                            <td>
                                EUR ${Number(item.price_at_purchase).toFixed(2)}
                            </td>
                        </tr>
                    `).join('')}

                </table>

                <br>

                <h3>
                    Gesamtbetrag:
                    EUR ${total.toFixed(2)}
                </h3>

            </body>
            </html>
        `);

        popup.document.close();

        setTimeout(() => popup.print(), 300);
    });
}
document.addEventListener('DOMContentLoaded', () => {
    initCart();
    initCartDrop();
    initOrders();
});
window.printInvoice = printInvoice;
