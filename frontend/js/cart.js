// ============================================================
// cart.js - Shopping Cart (simplified)
// ============================================================

const CART_KEY = 'techshop_cart';

// Get cart
function getCart() { 
    return JSON.parse(localStorage.getItem(CART_KEY)) || []; 
}

// Save cart
function saveCart(items) { 
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    updateBadge();
}

// Add to cart
function addToCart(p) {
    let cart = getCart();
    let found = cart.find(x => x.pid === p.id);
    
    if (found) {
        found.qty++;
    } else {
        cart.push({
            pid: p.id,           // product id
            name: p.name,
            price: parseFloat(p.price),
            qty: 1,
            img: p.image_path || '',
            cat: p.category_name || ''
        });
    }
    
    saveCart(cart);
    showMessage(`✓ ${p.name}`, 'success');
}

// Remove item
function removeCart(pid) { 
    saveCart(getCart().filter(x => x.pid !== pid)); 
}

// Update quantity
function updateQty(pid, qty) { 
    let cart = getCart();
    let item = cart.find(x => x.pid === pid);
    if (item) {
        if (qty <= 0) removeCart(pid);
        else { item.qty = qty; saveCart(cart); }
    }
}

// Get badge count
function updateBadge() {
    let b = document.getElementById('cart-badge');
    if (!b) return;
    let cnt = getCart().reduce((s, x) => s + x.qty, 0);
    b.textContent = cnt;
    b.hidden = cnt === 0;
}

// Get total
function getTotal() { 
    return getCart().reduce((s, x) => s + (x.price * x.qty), 0).toFixed(2);
}

// Render cart table
function renderCart() {
    let tbody = document.getElementById('cart-items-tbody');
    if (!tbody) return;
    
    let cart = getCart();
    if (!cart.length) {
        tbody.innerHTML = '';
        let empty = document.getElementById('cart-empty-message');
        if (empty) empty.hidden = false;
        return;
    }
    
    document.getElementById('cart-empty-message').hidden = true;
    
    tbody.innerHTML = cart.map(item => `
        <tr>
            <td>${item.img ? `<img src="${getImageUrl(item.img)}" style="max-width:60px;height:auto;">` : '(kein Bild)'}</td>
            <td>
                <strong>${escapeHtml(item.name)}</strong><br>
                <small class="text-muted">${escapeHtml(item.cat)}</small>
            </td>
            <td>€ ${item.price.toFixed(2)}</td>
            <td>
                <input type="number" min="1" value="${item.qty}" class="form-control" style="width:70px"
                       onchange="updateQty(${item.pid}, parseInt(this.value)); renderCart(); updateSummary();">
            </td>
            <td>€ ${(item.price * item.qty).toFixed(2)}</td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="removeCart(${item.pid}); renderCart(); updateSummary();">🗑️</button>
            </td>
        </tr>
    `).join('');
}

// Update summary
function updateSummary() {
    let el = document.getElementById('cart-total');
    if (el) el.textContent = getTotal();
}

// Initialize cart page
function initCart() { 
    renderCart();
    updateSummary();
    updateBadge();
}

// Place order
function placeOrder() {
    let cart = getCart();
    if (!cart.length) {
        showMessage('Warenkorb ist leer!', 'error');
        return;
    }
    
    fetch(getApiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sessionStatus' })
    })
    .then(r => r.json())
    .then(res => {
        if (!res.logged_in) {
            showMessage('Bitte anmelden!', 'error');
            setTimeout(() => location.href = '../sites/login.html', 1500);
            return;
        }
        
        // Convert cart format for backend
        let items = cart.map(x => ({
            productId: x.pid,
            quantity: x.qty,
            price: x.price
        }));
        
        fetch(getApiUrl(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'placeOrder', items })
        })
        .then(r => r.json())
        .then(r => {
            if (r.status === 'success') {
                showMessage('✓ Bestellt! ID: ' + r.order_id, 'success');
                localStorage.removeItem(CART_KEY);
                updateBadge();
                setTimeout(() => location.href = '../index.html', 2000);
            } else {
                showMessage(r.message || 'Fehler!', 'error');
            }
        });
    })
    .catch(e => showMessage('Fehler!', 'error'));
}

