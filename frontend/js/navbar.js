// ============================================================
// navbar.js
// ------------------------------------------------------------
// Shared Bootstrap navbar for every TechShopHub page.
//
// This script must be loaded BEFORE script.js and admin.js
// because it defines three global helpers those scripts use:
//
//   getApiUrl()     → URL of the PHP backend
//   escapeHtml()    → XSS-safe HTML insertion
//   updateNavbar()  → update navbar after a session change
//
// The navbar shows:
//   🛒 TechShopHub    [username]  [⚙️ Admin*]  [Login | Logout]
//
// * Admin link is visible only when is_admin === true.
// ============================================================


// Converts a stored image path to a usable <img src=""> URL.
//
// The backend now stores absolute paths like /TechShopHub/backend/productpictures/file.png
// This function handles both old relative paths and new absolute paths gracefully.
window.getImageUrl = function (path) {
    if (!path) return '';

    // Already absolute (starts with / or http) → use directly.
    if (path.startsWith('/') || path.startsWith('http')) return path;

    if (path.startsWith('res/')) {
        const currentPath = window.location.pathname;
        const frontendIndex = currentPath.indexOf('/frontend/');
        const frontendRoot = frontendIndex !== -1
            ? currentPath.substring(0, frontendIndex + '/frontend'.length)
            : '';
        return frontendRoot + '/' + path;
    }

    // Old relative path like "backend/productpictures/..." – resolve against project root.
    // getApiUrl() = https://localhost/TechShopHub/backend/logic/requestHandler.php
    // Project root  = https://localhost/TechShopHub
    if (path.startsWith('backend/')) {
        const projectRoot = getApiUrl().replace('/backend/logic/requestHandler.php', '');
        return projectRoot + '/' + path;
    }

    // Anything else (e.g. sample-data "res/img/...") – return as-is.
    return path;
};


// ---- Global helper: API URL ---------------------------------
// Exposed on window so script.js / admin.js can use it too.
window.getApiUrl = function () {
    const origin = window.location.origin;
    const path   = window.location.pathname;
    const idx    = path.indexOf('/frontend/');

    if (idx !== -1) {
        return `${origin}${path.substring(0, idx)}/backend/logic/requestHandler.php`;
    }
    return `${origin}/backend/logic/requestHandler.php`;
};


// ---- Global helper: XSS-safe HTML --------------------------
// Always use this when inserting database values into innerHTML.
window.escapeHtml = function (text) {
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
};


// ---- Navbar -------------------------------------------------
(function () {

    // Pages inside frontend/sites/ need to go one level up to reach
    // the shop (index.html) and the admin page.
    const inSites = window.location.pathname.includes('/sites/');
    const base    = inSites ? '../' : '';  // e.g. '' or '../'

    // Insert the navbar as the very first child of <body>.
    document.body.insertAdjacentHTML('afterbegin', `
        <nav class="navbar navbar-expand navbar-dark bg-dark px-3 mb-4">
            <a class="navbar-brand fw-bold" href="${base}index.html">🛒 TechShopHub</a>
            <div class="d-flex align-items-center gap-2 ms-auto">
                <span id="nav-username" class="text-white-50 small"></span>
                <a id="nav-account-link" href="${base}sites/kundenkonto.html"
                    class="btn btn-sm btn-outline-success">👤 Mein Konto</a>  
                <a id="nav-cart-link" href="${base}sites/cart.html" class="btn btn-sm btn-outline-info position-relative">
                    🛍️ Warenkorb
                    <span id="cart-badge" class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger ps-2 pe-2" hidden>0</span>
                </a>
                <a id="nav-orders-link" href="${base}sites/orders.html"
                   class="btn btn-sm btn-outline-info" hidden>Bestellungen</a> 
                <a id="nav-admin-link" href="${base}sites/admin.html"
                   class="btn btn-sm btn-outline-warning" hidden>⚙️ Admin</a>
                <a id="nav-login-link" href="${base}sites/login.html"
                   class="btn btn-sm btn-outline-light">Login</a>
                <button id="nav-logout-btn" class="btn btn-sm btn-danger" hidden>
                    Logout
                </button>
            </div>
        </nav>
    `);

    // ---- updateNavbar(session) ----------------------------------
    // Update all navbar elements to match the current session.
    // Called by the session fetch below and after logout.
    window.updateNavbar = function (session) {
        const usernameEl = document.getElementById('nav-username');
        const adminLink  = document.getElementById('nav-admin-link');
        const ordersLink = document.getElementById('nav-orders-link');
        const accountLink = document.getElementById('nav-account-link');
        const loginLink  = document.getElementById('nav-login-link');
        const logoutBtn  = document.getElementById('nav-logout-btn');

        if (session && session.logged_in) {
            const role = session.is_admin ? 'Administrator' : 'User';
            usernameEl.textContent = `Hi ${session.username} (${role})`;

            if (adminLink) adminLink.hidden = !session.is_admin;
            if (ordersLink) ordersLink.hidden = false;
            if (loginLink) loginLink.hidden = true;
            if (logoutBtn) logoutBtn.hidden = false;
            if (accountLink) accountLink.hidden = false;
        } else {
            usernameEl.textContent = '';

            if (adminLink) adminLink.hidden = true;
            if (ordersLink) ordersLink.hidden = true;
            if (loginLink) loginLink.hidden = false;
            if (logoutBtn) logoutBtn.hidden = true;
            if (accountLink) accountLink.hidden = true;
        }
    };

    // ---- Logout button -----------------------------------------
    document.getElementById('nav-logout-btn').addEventListener('click', function () {
        fetch(window.getApiUrl(), {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ action: 'logout' })
        })
        .then(r => r.json())
        .then(result => {
            if (result.status === 'success') {
                window.updateNavbar({ logged_in: false });

                // Redirect to login if we're on a page that requires login.
                if (document.getElementById('admin-page')) {
                    window.location.href = base + 'sites/login.html';
                }
            }
        })
        .catch(err => console.error('Logout error:', err));
    });

    // ---- Fetch session on page load ----------------------------
    // This updates the navbar as soon as the page opens.
    fetch(window.getApiUrl(), {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'sessionStatus' })
    })
    .then(r => r.json())
    .then(result => {
        if (result.status === 'success') {
            window.updateNavbar(result);
        }
    })
    .catch(err => console.error('Navbar session check failed:', err));
    
    // ---- Update cart badge on page load ----
    setTimeout(() => {
        if (typeof updateBadge === 'function') {
            updateBadge();
        }
    }, 100);

})();

