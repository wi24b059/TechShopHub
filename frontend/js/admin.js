// ============================================================
// admin.js  –  Logic for sites/admin.html
// ------------------------------------------------------------
// Features:
//   - Verify admin access on load (redirect if not admin)
//   - Load and display all products in a table
//   - Create new product (multipart/form-data with image)
//   - Edit existing product (Bootstrap modal, optional new image)
//   - Delete product (with confirmation dialog)
//   - Load all users, toggle active status, inspect user orders
//   - Remove single order items from customer orders
//
// Requires navbar.js (loaded first → provides getApiUrl, escapeHtml).
// Requires Bootstrap JS bundle (for modal and collapse).
// ============================================================

// ---- State --------------------------------------------------
// Cache the loaded products so the edit modal can look up data
// without a second server request.
let allProducts = [];
let allUsers = [];
let activeUserId = 0;
let activeOrderId = 0;

// ============================================================
// ON PAGE LOAD
// ============================================================
// admin.js is loaded with `defer`, which means it runs after the
// HTML is fully parsed. We can call our init functions directly
// here – no need to wrap them in a DOMContentLoaded listener.
checkAdminAccess();   // Redirect non-admins
loadAllProducts();    // Fill the product table
loadAllUsers();       // Fill the users table
setupCreateForm();    // Wire up create form
setupEditForm();      // Wire up edit modal

// ============================================================
// ACCESS CONTROL
// ============================================================
function checkAdminAccess() {
    fetch(getApiUrl(), {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'sessionStatus' })
    })
    .then(r => r.json())
    .then(result => {
        if (!result.logged_in || !result.is_admin) {
            window.location.href = '../sites/login.html';
        }
    })
    .catch(() => { window.location.href = '../sites/login.html'; });
}

// ============================================================
// PRODUCT TABLE
// ============================================================
function loadAllProducts() {
    setTableContent('<tr><td colspan="6" class="text-center text-muted py-3">Wird geladen…</td></tr>');

    fetch(getApiUrl(), {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'getAllProducts' })
    })
    .then(r => r.json())
    .then(result => {
        if (result.status === 'success') {
            allProducts = result.products;
            renderProductTable(allProducts);
        } else {
            setTableContent(`<tr><td colspan="6" class="text-center text-danger py-3">${escapeHtml(result.message)}</td></tr>`);
        }
    })
    .catch(() => setTableContent('<tr><td colspan="6" class="text-center text-danger py-3">Laden fehlgeschlagen.</td></tr>'));
}

function renderProductTable(products) {
    if (products.length === 0) {
        setTableContent('<tr><td colspan="6" class="text-center text-muted py-3">Keine Produkte vorhanden.</td></tr>');
        return;
    }
    document.getElementById('product-table-body').innerHTML = products.map(buildProductRow).join('');
}

function buildProductRow(p) {
    const price = parseFloat(p.price).toFixed(2);
    const grey  = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='45'%3E%3Crect width='60' height='45' fill='%23e9ecef'/%3E%3C/svg%3E";
    const name  = escapeHtml(p.name).replace(/'/g, "\\'");  // safe for onclick string

    return `
        <tr>
            <td><img src="${escapeHtml(getImageUrl(p.image_path || ''))}" alt="${escapeHtml(p.name)}"
                     style="width:60px;height:45px;object-fit:cover;border-radius:4px;"
                     onerror="this.src='${grey}'"></td>
            <td class="fw-semibold">${escapeHtml(p.name)}</td>
            <td>${escapeHtml(p.category_name || '')}</td>
            <td>€ ${escapeHtml(price)}</td>
            <td>${parseFloat(p.rating).toFixed(1)} ★</td>
            <td>
                <button class="btn btn-sm btn-outline-primary me-1"
                        onclick="openEditModal(${p.id})">✏️ Bearbeiten</button>
                <button class="btn btn-sm btn-outline-danger"
                        onclick="confirmDelete(${p.id}, '${name}')">🗑️ Löschen</button>
            </td>
        </tr>`;
}

function setTableContent(html) {
    const tbody = document.getElementById('product-table-body');
    if (tbody) tbody.innerHTML = html;
}

// ============================================================
// USER TABLE
// ============================================================
function loadAllUsers() {
    setUsersTableContent('<tr><td colspan="7" class="text-center text-muted py-3">Wird geladen…</td></tr>');

    fetch(getApiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getAllUsers' })
    })
    .then(r => r.json())
    .then(result => {
        if (result.status === 'success') {
            allUsers = result.users || [];
            renderUsersTable(allUsers);
        } else {
            setUsersTableContent(`<tr><td colspan="7" class="text-center text-danger py-3">${escapeHtml(result.message || 'Kunden konnten nicht geladen werden.')}</td></tr>`);
        }
    })
    .catch(() => {
        setUsersTableContent('<tr><td colspan="7" class="text-center text-danger py-3">Laden fehlgeschlagen.</td></tr>');
    });
}

function renderUsersTable(users) {
    if (!users.length) {
        setUsersTableContent('<tr><td colspan="7" class="text-center text-muted py-3">Keine Kunden gefunden.</td></tr>');
        return;
    }

    document.getElementById('users-table-body').innerHTML = users.map(u => {
        const fullName = `${escapeHtml(u.first_name || '')} ${escapeHtml(u.last_name || '')}`.trim();
        const isActive = Number(u.is_active) === 1;
        const statusBadge = isActive
            ? '<span class="badge bg-success">Aktiv</span>'
            : '<span class="badge bg-danger">Deaktiviert</span>';

        return `
            <tr>
                <td>${Number(u.id)}</td>
                <td>${fullName || '-'}</td>
                <td>${escapeHtml(u.email || '')}</td>
                <td>${escapeHtml(u.username || '')}</td>
                <td>${escapeHtml(u.city || '')}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn btn-sm btn-outline-${isActive ? 'danger' : 'success'} me-1"
                            onclick="toggleUserStatus(${Number(u.id)})">
                        ${isActive ? 'Deaktivieren' : 'Aktivieren'}
                    </button>
                    <button class="btn btn-sm btn-outline-primary"
                            onclick="openUserOrdersModal(${Number(u.id)})">
                        Bestellungen ansehen
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function setUsersTableContent(html) {
    const tbody = document.getElementById('users-table-body');
    if (tbody) tbody.innerHTML = html;
}

function toggleUserStatus(userId) {
    fetch(getApiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggleUserStatus', userId: Number(userId) })
    })
    .then(r => r.json())
    .then(result => {
        const type = result.status === 'success' ? 'success' : 'danger';
        showInBox('users-message', result.message || 'Status konnte nicht geaendert werden.', type);
        if (result.status === 'success') loadAllUsers();
    })
    .catch(err => showInBox('users-message', 'Serverfehler: ' + err.message, 'danger'));
}

// ============================================================
// USER ORDERS (ADMIN)
// ============================================================
function openUserOrdersModal(userId) {
    activeUserId = Number(userId);
    activeOrderId = 0;

    showInBox('user-orders-message', '', 'success');
    const details = document.getElementById('user-order-details');
    if (details) details.innerHTML = '';

    const modalEl = document.getElementById('userOrdersModal');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();

    loadOrdersForActiveUser();
}

function loadOrdersForActiveUser() {
    const list = document.getElementById('user-orders-list');
    if (!list) return;

    list.innerHTML = '<div class="text-muted">Bestellungen werden geladen…</div>';

    fetch(getApiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getUserOrdersAdmin', userId: activeUserId })
    })
    .then(r => r.json())
    .then(result => {
        if (result.status !== 'success') {
            list.innerHTML = `<div class="alert alert-danger mb-0">${escapeHtml(result.message || 'Bestellungen konnten nicht geladen werden.')}</div>`;
            return;
        }

        const orders = result.orders || [];
        if (!orders.length) {
            list.innerHTML = '<div class="text-muted">Keine Bestellungen vorhanden.</div>';
            return;
        }

        list.innerHTML = orders.map(order => `
            <button class="list-group-item list-group-item-action" onclick="loadOrderDetailsAdmin(${Number(order.id)})">
                Bestellung #${Number(order.id)} - EUR ${Number(order.total_price).toFixed(2)} - ${escapeHtml(order.created_at || '')}
            </button>
        `).join('');
    })
    .catch(err => {
        list.innerHTML = `<div class="alert alert-danger mb-0">Serverfehler: ${escapeHtml(err.message)}</div>`;
    });
}

function loadOrderDetailsAdmin(orderId) {
    activeOrderId = Number(orderId);
    const details = document.getElementById('user-order-details');
    if (!details) return;

    details.innerHTML = '<div class="text-muted">Details werden geladen…</div>';

    fetch(getApiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getOrderDetailsAdmin', orderId: activeOrderId })
    })
    .then(r => r.json())
    .then(result => {
        if (result.status !== 'success') {
            details.innerHTML = `<div class="alert alert-danger">${escapeHtml(result.message || 'Details konnten nicht geladen werden.')}</div>`;
            return;
        }

        const order = result.data.order || {};
        const items = result.data.items || [];

        details.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <h3 class="h6 mb-3">Bestellung #${Number(order.id || activeOrderId)}</h3>
                    <p class="mb-3 small text-muted">
                        Zahlung: ${escapeHtml(order.payment_method || '-')}<br>
                        Gutschein: ${escapeHtml(order.coupon_code || '-')}<br>
                        Rabatt: EUR ${Number(order.discount || 0).toFixed(2)}<br>
                        Gesamt: EUR ${Number(order.total_price || 0).toFixed(2)}
                    </p>

                    <div class="table-responsive">
                        <table class="table table-sm align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>Produkt</th>
                                    <th>Menge</th>
                                    <th>Preis</th>
                                    <th>Aktion</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${items.length ? items.map(item => `
                                    <tr>
                                        <td>${escapeHtml(item.name || '')}</td>
                                        <td>${Number(item.quantity)}</td>
                                        <td>EUR ${Number(item.price_at_purchase).toFixed(2)}</td>
                                        <td>
                                            <button class="btn btn-sm btn-outline-danger"
                                                    onclick="removeOrderItem(${Number(order.id)}, ${Number(item.id)})">
                                                Position loeschen
                                            </button>
                                        </td>
                                    </tr>
                                `).join('') : '<tr><td colspan="4" class="text-muted">Keine Positionen vorhanden.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    })
    .catch(err => {
        details.innerHTML = `<div class="alert alert-danger">Serverfehler: ${escapeHtml(err.message)}</div>`;
    });
}

function removeOrderItem(orderId, orderItemId) {
    if (!window.confirm('Diese Position wirklich aus der Bestellung entfernen?')) return;

    fetch(getApiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'removeOrderItem', orderId: Number(orderId), orderItemId: Number(orderItemId) })
    })
    .then(r => r.json())
    .then(result => {
        const type = result.status === 'success' ? 'success' : 'danger';
        showInBox('user-orders-message', result.message || 'Aktion fehlgeschlagen.', type);

        if (result.status === 'success') {
            loadOrderDetailsAdmin(Number(orderId));
            loadOrdersForActiveUser();
        }
    })
    .catch(err => showInBox('user-orders-message', 'Serverfehler: ' + err.message, 'danger'));
}

// ============================================================
// CREATE PRODUCT
// ============================================================
function setupCreateForm() {
    const form = document.getElementById('createProductForm');
    if (!form) return;

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        submitProductForm(form, 'createProduct', 'create-message', function () {
            form.reset();
            // Hide the collapsible create panel after saving.
            const collapse = document.getElementById('createProductCollapse');
            if (collapse) bootstrap.Collapse.getOrCreateInstance(collapse).hide();
            loadAllProducts();
        });
    });
}

// ============================================================
// EDIT PRODUCT  (Bootstrap modal)
// ============================================================
function openEditModal(productId) {
    const numericId = Number(productId);
    const p = allProducts.find(x => Number(x.id) === numericId);
    if (!p) return;

    // Pre-fill all text/number fields with the existing data.
    document.getElementById('edit_id').value          = p.id;
    document.getElementById('edit_category').value    = p.category_id;
    document.getElementById('edit_name').value        = p.name;
    document.getElementById('edit_description').value = p.description;
    document.getElementById('edit_price').value       = p.price;
    document.getElementById('edit_rating').value      = p.rating;

    // Show the current image as a small preview.
    const preview = document.getElementById('edit_current_image');
    if (preview) {
        const resolvedSrc = getImageUrl(p.image_path || '');
        preview.src     = resolvedSrc;
        preview.onerror = function () { this.hidden = true; };
        preview.hidden  = !resolvedSrc;
    }

    // Clear old messages and open the modal.
    showInBox('edit-message', '', 'success');
    bootstrap.Modal.getOrCreateInstance(document.getElementById('editModal')).show();
}

function setupEditForm() {
    const btn = document.getElementById('editSubmitBtn');
    if (!btn) return;

    btn.addEventListener('click', function () {
        const form = document.getElementById('editProductForm');
        submitProductForm(form, 'updateProduct', 'edit-message', function () {
            bootstrap.Modal.getInstance(document.getElementById('editModal')).hide();
            loadAllProducts();
        });
    });
}

// ============================================================
// DELETE PRODUCT
// ============================================================
function confirmDelete(productId, productName) {
    if (!window.confirm(`Produkt "${productName}" wirklich löschen?`)) return;

    fetch(getApiUrl(), {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'deleteProduct', id: productId })
    })
    .then(r => r.json())
    .then(result => {
        const type = result.status === 'success' ? 'success' : 'danger';
        showInBox('admin-message', result.message, type);
        if (result.status === 'success') loadAllProducts();
    })
    .catch(err => showInBox('admin-message', 'Serverfehler: ' + err.message, 'danger'));
}

// ============================================================
// SHARED FORM SUBMIT  (create + edit both use multipart/form-data)
// ============================================================
function submitProductForm(form, action, msgBoxId, onSuccess) {
    // FormData collects every <input>, <select>, <textarea> AND the file.
    const formData = new FormData(form);
    formData.append('action', action);

    const btn = form.querySelector('button[type="submit"]') ||
                document.getElementById('editSubmitBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Speichert…'; }

    // Do NOT set Content-Type – the browser adds the boundary for multipart.
    fetch(getApiUrl(), { method: 'POST', body: formData })
        .then(r => r.json())
        .then(result => {
            const type = result.status === 'success' ? 'success' : 'danger';
            showInBox(msgBoxId, result.message || 'Unbekannter Fehler.', type);
            if (result.status === 'success' && onSuccess) onSuccess();
        })
        .catch(err => showInBox(msgBoxId, 'Serverfehler: ' + err.message, 'danger'))
        .finally(() => {
            if (btn) {
                btn.disabled    = false;
                btn.textContent = action === 'createProduct' ? 'Produkt anlegen' : 'Änderungen speichern';
            }
        });
}

// ============================================================
// HELPER
// ============================================================
function showInBox(boxId, message, type) {
    const box = document.getElementById(boxId);
    if (!box) return;
    box.innerHTML = message ? `<div class="alert alert-${type} py-2 mb-0">${escapeHtml(message)}</div>` : '';
}

// Expose customer helpers for inline button handlers.
window.toggleUserStatus = toggleUserStatus;
window.openUserOrdersModal = openUserOrdersModal;
window.loadOrderDetailsAdmin = loadOrderDetailsAdmin;
window.removeOrderItem = removeOrderItem;

