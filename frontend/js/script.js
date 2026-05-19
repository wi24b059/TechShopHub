// ============================================================
// script.js
// ------------------------------------------------------------
// Handles the shop page (index.html), login page (login.html)
// and registration page (register.html).
//
// navbar.js is loaded BEFORE this file and provides:
//   getApiUrl()   – backend URL
//   escapeHtml()  – XSS-safe HTML
//   updateNavbar() – update shared navbar state
// ============================================================

const API_URL = getApiUrl();  // getApiUrl() comes from navbar.js

// ---- DOM references ----------------------------------------
const loginForm    = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const searchInput  = document.getElementById('search-input');
const categoryNav  = document.getElementById('category-nav');
const productGrid  = document.getElementById('product-grid');

// ---- Shop state --------------------------------------------
let activeCategoryId = 1;    // Laptops by default
let searchTimer      = null;  // For debouncing the search input

// ============================================================
// PAGE INITIALISATION
// ============================================================

if (productGrid) {
    // Shop page: load the default category immediately.
    loadProducts(activeCategoryId);
}

if (loginForm) {
    // Login page: redirect to shop if already logged in.
    redirectIfLoggedIn();
}

// ============================================================
// EVENT LISTENERS
// ============================================================

// ---- Login form --------------------------------------------
if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const identifier = document.getElementById('login_identifier').value.trim();
        const password   = document.getElementById('login_password').value;

        if (!identifier || !password) {
            showMessage('Bitte Benutzername/E-Mail und Passwort eingeben.', 'error');
            return;
        }

        sendJsonRequest({
            action: 'login',
            identifier,
            password,
            remember: document.getElementById('remember_me').checked
        })
        .then(result => {
            if (result.status === 'success') {
                // Successful login → go to the shop.
                window.location.href = getShopUrl();
            }
        });
    });
}

// ---- Registration form -------------------------------------
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

        sendJsonRequest({
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
        })
        .then(result => {
            if (result.status === 'success') {
                setTimeout(() => { window.location.href = 'login.html'; }, 900);
            }
        });
    });
}

// ---- Category navigation -----------------------------------
if (categoryNav) {
    categoryNav.addEventListener('click', function (e) {
        if (e.target.tagName !== 'BUTTON') return;

        const categoryId = parseInt(e.target.dataset.categoryId, 10);

        // Swap Bootstrap button style: filled = active, outline = inactive.
        categoryNav.querySelectorAll('.category-btn').forEach(btn => {
            btn.classList.remove('btn-dark');
            btn.classList.add('btn-outline-dark');
        });
        e.target.classList.remove('btn-outline-dark');
        e.target.classList.add('btn-dark');

        if (searchInput) searchInput.value = '';
        activeCategoryId = categoryId;
        loadProducts(categoryId);
    });
}

// ---- Live search  (debounced: wait 300 ms after last keystroke) ----
if (searchInput) {
    searchInput.addEventListener('input', function () {
        const term = searchInput.value.trim();
        clearTimeout(searchTimer);

        searchTimer = setTimeout(() => {
            if (term.length >= 2)   searchProducts(term);
            else if (term.length === 0) loadProducts(activeCategoryId);
        }, 300);
    });
}

// ============================================================
// PRODUCT FUNCTIONS
// ============================================================

function loadProducts(categoryId) {
    setProductGridContent('<div class="col-12 text-muted fst-italic">Produkte werden geladen…</div>');

    sendJsonRequest({ action: 'getProducts', categoryId }, false)
        .then(result => {
            if (result.status === 'success') renderProducts(result.products);
            else setProductGridContent('<div class="col-12 text-danger">Produkte konnten nicht geladen werden.</div>');
        });
}

function searchProducts(term) {
    setProductGridContent('<div class="col-12 text-muted fst-italic">Suche läuft…</div>');

    sendJsonRequest({ action: 'getProducts', searchTerm: term }, false)
        .then(result => {
            if (result.status === 'success') renderProducts(result.products);
            else setProductGridContent('<div class="col-12 text-danger">Suche fehlgeschlagen.</div>');
        });
}

function renderProducts(products) {
    if (!productGrid) return;

    if (products.length === 0) {
        setProductGridContent('<div class="col-12 text-muted fst-italic">Keine Produkte gefunden.</div>');
        return;
    }
    productGrid.innerHTML = products.map(buildProductCard).join('');
}

function buildProductCard(p) {
    const price  = parseFloat(p.price).toFixed(2);
    const rating = parseFloat(p.rating).toFixed(1);
    const grey   = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='150'%3E%3Crect width='200' height='150' fill='%23e9ecef'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%236c757d' font-size='13'%3EKein Bild%3C/text%3E%3C/svg%3E";

    return `
        <div class="col" draggable="true" ondragstart="event.dataTransfer.setData('text/plain', '${p.id}')">
            <div class="card h-100 shadow-sm d-flex flex-column">
                <img src="${escapeHtml(getImageUrl(p.image_path || ''))}" alt="${escapeHtml(p.name)}"
                     class="card-img-top product-img"
                     onerror="this.src='${grey}'">
                <div class="card-body d-flex flex-column">
                    <h6 class="card-title mb-1">${escapeHtml(p.name)}</h6>
                    <p class="text-muted small mb-1">${escapeHtml(p.category_name || '')}</p>
                    <p class="text-warning mb-1">${buildStarRating(parseFloat(p.rating))} ${rating}</p>
                    <p class="fw-bold mb-2">€ ${escapeHtml(price)}</p>
                    <a href="#" class="btn btn-sm btn-primary mt-auto"
                       onclick="event.preventDefault(); addToCart({id: ${p.id}})">
                        In den Warenkorb legen
                    </a>
                </div>
            </div>
        </div>`;
}

function buildStarRating(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        if (rating >= i)             stars += '★';
        else if (rating >= i - 0.5)  stars += '½';
        else                         stars += '☆';
    }
    return stars;
}

function setProductGridContent(html) {
    if (productGrid) productGrid.innerHTML = html;
}

// ============================================================
// AUTH HELPERS
// ============================================================

// On the login page: if already logged in, skip the form and go to shop.
function redirectIfLoggedIn() {
    sendJsonRequest({ action: 'sessionStatus' }, false)
        .then(result => {
            if (result.status === 'success' && result.logged_in) {
                window.location.href = getShopUrl();
            }
        });
}

// Returns the URL of the shop page relative to the current location.
function getShopUrl() {
    return window.location.pathname.includes('/sites/') ? '../index.html' : 'index.html';
}

// ============================================================
// UTILITY
// ============================================================

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
    .catch(err => {
        showMessage('Serverfehler: ' + err.message, 'error');
        return { status: 'error', message: 'Serverfehler' };
    });
}

function showMessage(message, type) {
    const box = document.getElementById('message-box');
    if (!box) return;
    const cls = type === 'success' ? 'alert-success' : 'alert-danger';
    box.innerHTML = `<div class="alert ${cls} mb-0">${message}</div>`;
}
