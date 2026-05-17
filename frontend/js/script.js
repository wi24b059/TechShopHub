// ============================================================
// script.js
// ------------------------------------------------------------
// Shared script used by all three pages:
//   index.html   → shop page
//   sites/login.html    → login page
//   sites/register.html → registration page
//
// The code checks which page it's on by looking for specific
// HTML elements (e.g. does #loginForm exist?).
// ============================================================


// ---- API URL -----------------------------------------------
const API_URL = getApiUrl();


// ---- DOM References ----------------------------------------
// These might be null if we're on a different page – that's fine,
// we check before using them.
const loginForm         = document.getElementById('loginForm');
const registerForm      = document.getElementById('registerForm');
const logoutBtn         = document.getElementById('logoutBtn');
const loginLink         = document.getElementById('loginLink');
const searchInput       = document.getElementById('search-input');
const categoryNav       = document.getElementById('category-nav');
const productGrid       = document.getElementById('product-grid');
const adminPanel        = document.getElementById('admin-panel');
const createProductForm = document.getElementById('createProductForm');


// ---- Shop State -------------------------------------------
let activeCategoryId = 1;   // Start with Laptops
let searchTimer      = null; // Used for debouncing the search input


// ============================================================
// PAGE-SPECIFIC INITIALISATION
// ============================================================

if (productGrid) {
    // ---- We are on the SHOP PAGE (index.html) ----
    loadSessionStatus();          // Update navbar (show username / login button)
    loadProducts(activeCategoryId); // Load default category straight away
}

if (loginForm) {
    // ---- We are on the LOGIN PAGE ----
    // If the user is already logged in, send them to the shop immediately.
    redirectIfLoggedIn();
}

if (registerForm) {
    // ---- We are on the REGISTER PAGE ----
    // Nothing special needed on load.
}


// ============================================================
// EVENT LISTENERS
// ============================================================

// ---- Login form (login.html) --------------------------------
if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const identifier = document.getElementById('login_identifier').value.trim();
        const password   = document.getElementById('login_password').value;

        if (!identifier || !password) {
            showMessage('Bitte Benutzername/E-Mail und Passwort eingeben.', 'error');
            return;
        }

        const data = {
            action: 'login',
            identifier,
            password,
            remember: document.getElementById('remember_me').checked
        };

        sendJsonRequest(data).then(result => {
            if (result.status === 'success') {
                // Login worked → go to the shop page.
                window.location.href = getShopUrl();
            }
        });
    });
}

// ---- Registration form (register.html) ----------------------
if (registerForm) {
    registerForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const pwd1 = document.getElementById('reg_pwd1').value;
        const pwd2 = document.getElementById('reg_pwd2').value;

        if (pwd1 !== pwd2) {
            showMessage('Die Passwörter stimmen nicht überein!', 'error');
            return;
        }

        if (!/(?=.*[A-Za-z])(?=.*\d).{8,}/.test(pwd1)) {
            showMessage('Passwort muss mindestens 8 Zeichen sowie Buchstaben und Zahlen enthalten.', 'error');
            return;
        }

        const data = {
            action:           'register',
            salutation:       document.getElementById('reg_salutation').value.trim(),
            firstname:        document.getElementById('reg_firstname').value.trim(),
            lastname:         document.getElementById('reg_lastname').value.trim(),
            address:          document.getElementById('reg_address').value.trim(),
            zip:              document.getElementById('reg_zip').value.trim(),
            city:             document.getElementById('reg_city').value.trim(),
            email:            document.getElementById('reg_email').value.trim(),
            username:         document.getElementById('reg_username').value.trim(),
            password:         pwd1,
            password_confirm: pwd2,
            payment:          document.getElementById('reg_payment').value.trim()
        };

        sendJsonRequest(data).then(result => {
            if (result.status === 'success') {
                // Registration done → redirect to login after a short delay.
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 900);
            }
        });
    });
}

// ---- Logout button (index.html) -----------------------------
if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
        sendJsonRequest({ action: 'logout' }).then(result => {
            if (result.status === 'success') {
                loadSessionStatus(); // Refresh navbar
            }
        });
    });
}

// ---- Category navigation (index.html) -----------------------
if (categoryNav) {
    categoryNav.addEventListener('click', function (e) {
        if (e.target.tagName !== 'BUTTON') return;

        const categoryId = parseInt(e.target.dataset.categoryId, 10);

        // Toggle Bootstrap button styles: filled = active, outline = inactive.
        categoryNav.querySelectorAll('.category-btn').forEach(btn => {
            btn.classList.remove('btn-dark');
            btn.classList.add('btn-outline-dark');
        });
        e.target.classList.remove('btn-outline-dark');
        e.target.classList.add('btn-dark');

        // Clear search so we show the full category.
        if (searchInput) searchInput.value = '';

        activeCategoryId = categoryId;
        loadProducts(categoryId);
    });
}

// ---- Live search with debounce (index.html) -----------------
// Debounce = wait 300ms after the user stops typing before searching.
// Without debounce we would fire a request for every single keystroke.
if (searchInput) {
    searchInput.addEventListener('input', function () {
        const term = searchInput.value.trim();

        clearTimeout(searchTimer);

        searchTimer = setTimeout(() => {
            if (term.length >= 2) {
                searchProducts(term);
            } else if (term.length === 0) {
                loadProducts(activeCategoryId);
            }
        }, 300);
    });
}

// ---- Admin create-product form (index.html) -----------------
if (createProductForm) {
    createProductForm.addEventListener('submit', function (e) {
        e.preventDefault();
        submitCreateProductForm();
    });
}


// ============================================================
// PRODUCT FUNCTIONS
// ============================================================

function loadProducts(categoryId) {
    setProductGridContent('<div class="col-12 text-muted fst-italic">Produkte werden geladen…</div>');

    sendJsonRequest({ action: 'getProducts', categoryId }, false).then(result => {
        if (result.status === 'success') {
            renderProducts(result.products);
        } else {
            setProductGridContent('<div class="col-12 text-danger">Produkte konnten nicht geladen werden.</div>');
        }
    });
}

function searchProducts(term) {
    setProductGridContent('<div class="col-12 text-muted fst-italic">Suche läuft…</div>');

    sendJsonRequest({ action: 'getProducts', searchTerm: term }, false).then(result => {
        if (result.status === 'success') {
            renderProducts(result.products);
        } else {
            setProductGridContent('<div class="col-12 text-danger">Suche fehlgeschlagen.</div>');
        }
    });
}

function renderProducts(products) {
    if (!productGrid) return;

    if (products.length === 0) {
        setProductGridContent('<div class="col-12 text-muted fst-italic">Keine Produkte gefunden.</div>');
        return;
    }

    // Build all cards and put them directly into the grid container.
    productGrid.innerHTML = products.map(p => buildProductCard(p)).join('');
}

// Builds a Bootstrap card inside a grid column.
// Each card shows: image, name, category, price, rating.
function buildProductCard(product) {
    const price  = parseFloat(product.price).toFixed(2);
    const rating = parseFloat(product.rating).toFixed(1);
    const stars  = buildStarRating(parseFloat(product.rating));

    // Inline SVG placeholder shown when the real image is missing or fails to load.
    const placeholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='150'%3E%3Crect width='200' height='150' fill='%23e9ecef'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%236c757d' font-size='13'%3EKein Bild%3C/text%3E%3C/svg%3E";

    return `
        <div class="col">
            <div class="card h-100 shadow-sm">
                <img src="${escapeHtml(product.image_path || '')}"
                     alt="${escapeHtml(product.name)}"
                     class="card-img-top product-img"
                     onerror="this.src='${placeholder}'">
                <div class="card-body d-flex flex-column">
                    <h6 class="card-title mb-1">${escapeHtml(product.name)}</h6>
                    <p class="text-muted small mb-1">${escapeHtml(product.category_name || '')}</p>
                    <p class="text-warning mb-1" title="${rating} von 5">${stars} ${rating}</p>
                    <p class="fw-bold mt-auto mb-0">€ ${escapeHtml(price)}</p>
                </div>
            </div>
        </div>
    `;
}

// Turns a number like 4.5 into "★★★★½☆".
function buildStarRating(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        if (rating >= i)        stars += '★';
        else if (rating >= i - 0.5) stars += '½';
        else                    stars += '☆';
    }
    return stars;
}

// Sends the admin create-product form using FormData so the image file is included.
async function submitCreateProductForm() {
    const form      = createProductForm;
    const submitBtn = form.querySelector('button[type="submit"]');

    // Collect all form fields (including the file) into a FormData object.
    const formData = new FormData(form);
    formData.append('action', 'createProduct');

    submitBtn.disabled    = true;
    submitBtn.textContent = 'Wird gespeichert…';

    try {
        // Do NOT set Content-Type manually – the browser sets it for FormData.
        const response = await fetch(API_URL, { method: 'POST', body: formData });
        const result   = await response.json();

        if (result.status === 'success') {
            showAdminMessage('Produkt erfolgreich erstellt!', 'success');
            form.reset();
            loadProducts(activeCategoryId);
        } else {
            showAdminMessage(result.message || 'Fehler beim Erstellen.', 'error');
        }
    } catch (error) {
        showAdminMessage('Serverfehler: ' + error.message, 'error');
    } finally {
        submitBtn.disabled    = false;
        submitBtn.textContent = 'Produkt speichern';
    }
}


// ============================================================
// SESSION / AUTH FUNCTIONS
// ============================================================

// Updates the navbar on the shop page and shows/hides the admin panel.
function loadSessionStatus() {
    return sendJsonRequest({ action: 'sessionStatus' }, false).then(result => {
        const statusText = document.getElementById('status-text');
        if (!statusText || result.status !== 'success') return;

        if (result.logged_in) {
            const role = result.is_admin ? 'Administrator' : 'User';
            statusText.textContent = `${result.username} (${role})`;

            if (logoutBtn)  logoutBtn.hidden  = false;
            if (loginLink)  loginLink.hidden  = true;   // Don't show "Login" when already logged in
        } else {
            statusText.textContent = '';

            if (logoutBtn)  logoutBtn.hidden  = true;
            if (loginLink)  loginLink.hidden  = false;
        }

        // Admin panel: visible only for admins.
        if (adminPanel) adminPanel.hidden = !result.is_admin;
    });
}

// Called on the login page: if the user is already logged in,
// skip the login page and send them straight to the shop.
function redirectIfLoggedIn() {
    sendJsonRequest({ action: 'sessionStatus' }, false).then(result => {
        if (result.status === 'success' && result.logged_in) {
            window.location.href = getShopUrl();
        }
    });
}


// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function getApiUrl() {
    const origin = window.location.origin;
    const path   = window.location.pathname;
    const frontendIndex = path.indexOf('/frontend/');

    if (frontendIndex !== -1) {
        const basePath = path.substring(0, frontendIndex);
        return `${origin}${basePath}/backend/logic/requestHandler.php`;
    }

    return `${origin}/backend/logic/requestHandler.php`;
}

// Returns the URL of index.html relative to the current page.
function getShopUrl() {
    // login.html and register.html are inside sites/ so we go one level up.
    if (window.location.pathname.includes('/sites/')) {
        return '../index.html';
    }
    return 'index.html';
}

function sendJsonRequest(data, renderMessage = true) {
    return fetch(API_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data)
    })
    .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    })
    .then(result => {
        if (renderMessage && result.message) {
            showMessage(result.message, result.status === 'success' ? 'success' : 'error');
        }
        return result;
    })
    .catch(error => {
        showMessage('Serverfehler: ' + error.message, 'error');
        return { status: 'error', message: 'Serverfehler' };
    });
}

function setProductGridContent(html) {
    if (productGrid) productGrid.innerHTML = html;
}

// Shows a Bootstrap alert in the global message box.
function showMessage(message, type) {
    const msgBox = document.getElementById('message-box');
    if (!msgBox) return;

    const alertClass = type === 'success' ? 'alert-success' : 'alert-danger';
    msgBox.innerHTML = `<div class="alert ${alertClass} mb-0">${message}</div>`;
}

// Shows a message inside the admin panel's own message area.
function showAdminMessage(message, type) {
    const msgBox = document.getElementById('admin-message-box');
    if (!msgBox) return;

    const alertClass = type === 'success' ? 'alert-success' : 'alert-danger';
    msgBox.innerHTML = `<div class="alert ${alertClass} mb-0">${message}</div>`;
}

// Prevents XSS by escaping HTML special characters before inserting
// any server data into innerHTML.
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}
