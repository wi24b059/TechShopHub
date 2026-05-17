// ============================================================
// script.js
// ------------------------------------------------------------
// This file drives the entire frontend:
//   - User authentication (login, logout, session status)
//   - Product browsing by category
//   - Live product search
//   - Admin: create a new product with image upload
//
// All server communication is done via the fetch() API
// (AJAX), so the page never fully reloads.
// ============================================================


// ---- API URL -----------------------------------------------
// Points to our single PHP backend file.
// getApiUrl() works out the correct URL regardless of where
// the project is hosted.
const API_URL = getApiUrl();


// ---- DOM References ----------------------------------------
// We grab these elements once at the top so every function
// below can use them without calling getElementById() again.
const loginForm        = document.getElementById('loginForm');
const registerForm     = document.getElementById('registerForm');
const logoutBtn        = document.getElementById('logoutBtn');
const searchInput      = document.getElementById('search-input');
const categoryNav      = document.getElementById('category-nav');
const productGrid      = document.getElementById('product-grid');
const adminPanel       = document.getElementById('admin-panel');
const createProductForm = document.getElementById('createProductForm');


// ---- Shop State --------------------------------------------
// Remember which category is currently shown so we can
// refresh it after adding a new product.
let activeCategoryId = 1;  // Default: Laptops (matches id in the DB)

// Used by the debounce logic in the search handler (see below).
let searchTimer = null;


// ============================================================
// PAGE INITIALISATION
// ============================================================

// On the main page (index.html) initialise everything.
if (loginForm) {
    // Check who is logged in (updates the status bar + admin panel visibility).
    loadSessionStatus();

    // Load the default category (Laptops) right away so the shop
    // is populated before the user does anything.
    loadProducts(activeCategoryId);
}

// On the registration page we only need the form handler below.
if (registerForm) {
    // Nothing extra to initialise.
}


// ============================================================
// EVENT LISTENERS
// ============================================================

// ---- Login form --------------------------------------------
if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
        e.preventDefault();  // Prevent the default HTML form submit (page reload).

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
                // Refresh the status bar and show/hide the admin panel.
                loadSessionStatus();
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

        // Client-side password checks (the server validates again, but
        // giving feedback immediately is better UX).
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
                // Short delay so the user can read the success message,
                // then redirect to the login page.
                setTimeout(() => {
                    window.location.href = '../index.html';
                }, 900);
            }
        });
    });
}

// ---- Logout button -----------------------------------------
if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
        sendJsonRequest({ action: 'logout' }).then(result => {
            if (result.status === 'success') {
                loadSessionStatus();
            }
        });
    });
}

// ---- Category navigation -----------------------------------
// When the user clicks a category button, load that category's products.
if (categoryNav) {
    categoryNav.addEventListener('click', function (e) {
        // Make sure the click was on a button, not the <nav> itself.
        if (e.target.tagName !== 'BUTTON') return;

        const categoryId = parseInt(e.target.dataset.categoryId, 10);

        // Highlight the clicked button and remove highlight from others.
        categoryNav.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');

        // Clear the search box – we're now browsing by category instead.
        if (searchInput) searchInput.value = '';

        activeCategoryId = categoryId;
        loadProducts(categoryId);
    });
}

// ---- Live search -------------------------------------------
// As the user types, we wait 300 ms before sending a request.
// This "debounce" prevents sending a request for every single keystroke.
if (searchInput) {
    searchInput.addEventListener('input', function () {
        const term = searchInput.value.trim();

        // Cancel the previous timer so we only search after the user stops typing.
        clearTimeout(searchTimer);

        searchTimer = setTimeout(() => {
            if (term.length >= 2) {
                // Search across all categories.
                searchProducts(term);
            } else if (term.length === 0) {
                // The user cleared the search field → go back to the active category.
                loadProducts(activeCategoryId);
            }
            // If 1 character: too short to be useful, do nothing.
        }, 300);
    });
}

// ---- Admin: create product form ----------------------------
if (createProductForm) {
    createProductForm.addEventListener('submit', function (e) {
        e.preventDefault();
        submitCreateProductForm();
    });
}


// ============================================================
// PRODUCT FUNCTIONS
// ============================================================

// ------------------------------------------------------------
// loadProducts(categoryId)
// Fetch all products for a given category from the backend
// and render them on the page.
// ------------------------------------------------------------
function loadProducts(categoryId) {
    // Show a loading message while we wait for the server.
    setProductGridContent('<p class="loading-text">Produkte werden geladen…</p>');

    sendJsonRequest({ action: 'getProducts', categoryId: categoryId }, false)
        .then(result => {
            if (result.status === 'success') {
                renderProducts(result.products);
            } else {
                setProductGridContent('<p class="error-text">Produkte konnten nicht geladen werden.</p>');
            }
        });
}

// ------------------------------------------------------------
// searchProducts(term)
// Search products by name or description and show results.
// ------------------------------------------------------------
function searchProducts(term) {
    setProductGridContent('<p class="loading-text">Suche läuft…</p>');

    sendJsonRequest({ action: 'getProducts', searchTerm: term }, false)
        .then(result => {
            if (result.status === 'success') {
                renderProducts(result.products);
            } else {
                setProductGridContent('<p class="error-text">Suche fehlgeschlagen.</p>');
            }
        });
}

// ------------------------------------------------------------
// renderProducts(products)
// Takes an array of product objects and builds the product
// cards in the #product-grid container.
// ------------------------------------------------------------
function renderProducts(products) {
    if (!productGrid) return;

    if (products.length === 0) {
        setProductGridContent('<p class="empty-text">Keine Produkte gefunden.</p>');
        return;
    }

    // Build one card per product, then join them into one HTML string.
    const cardsHtml = products.map(product => buildProductCard(product)).join('');
    productGrid.innerHTML = cardsHtml;
}

// ------------------------------------------------------------
// buildProductCard(product)
// Returns the HTML string for a single product card.
// The product object comes directly from the database row.
// ------------------------------------------------------------
function buildProductCard(product) {
    // Format the price with two decimal places and a € sign.
    const price = parseFloat(product.price).toFixed(2);

    // Build a star display, e.g. "4.5 ★"
    const rating = parseFloat(product.rating).toFixed(1);
    const stars  = buildStarRating(parseFloat(product.rating));

    // Use a placeholder if the image path is empty or the image fails to load.
    // The onerror attribute switches to the placeholder automatically.
    const imgSrc     = product.image_path || '';
    const placeholder = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'150\'%3E%3Crect width=\'200\' height=\'150\' fill=\'%23eee\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' dominant-baseline=\'middle\' text-anchor=\'middle\' fill=\'%23aaa\' font-size=\'14\'%3EKein Bild%3C/text%3E%3C/svg%3E';

    return `
        <article class="product-card">
            <img
                src="${escapeHtml(imgSrc)}"
                alt="${escapeHtml(product.name)}"
                class="product-image"
                onerror="this.src='${placeholder}'"
            >
            <div class="product-info">
                <h3 class="product-name">${escapeHtml(product.name)}</h3>
                <p class="product-category">${escapeHtml(product.category_name || '')}</p>
                <p class="product-price">€ ${escapeHtml(price)}</p>
                <p class="product-rating" title="Bewertung: ${rating} von 5">${stars} ${rating}</p>
            </div>
        </article>
    `;
}

// ------------------------------------------------------------
// buildStarRating(rating)
// Converts a numeric rating (0–5) into star characters.
// Example: 4.5 → "★★★★½"
// ------------------------------------------------------------
function buildStarRating(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        if (rating >= i) {
            stars += '★';         // Full star
        } else if (rating >= i - 0.5) {
            stars += '½';         // Half star
        } else {
            stars += '☆';         // Empty star
        }
    }
    return stars;
}

// ------------------------------------------------------------
// submitCreateProductForm()
// Collects the admin form data (including the image file) and
// sends it to the backend using FormData instead of JSON.
//
// Why FormData and not JSON.stringify?
// Because JSON cannot carry binary file data. FormData is the
// standard way to send files over HTTP.
// ------------------------------------------------------------
async function submitCreateProductForm() {
    const form = createProductForm;

    // FormData automatically collects ALL input fields in the form,
    // including the selected file from <input type="file">.
    const formData = new FormData(form);

    // Tell the backend which action to run.
    formData.append('action', 'createProduct');

    // Show a loading state on the button.
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Wird gespeichert…';

    try {
        // IMPORTANT: Do NOT set the Content-Type header manually!
        // When using FormData the browser sets it automatically to
        // "multipart/form-data" with the correct boundary string.
        const response = await fetch(API_URL, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        const adminMsgBox = document.getElementById('admin-message-box');

        if (result.status === 'success') {
            showAdminMessage('Produkt erfolgreich erstellt!', 'success');
            form.reset();
            loadProducts(activeCategoryId);  // Refresh the product list.
        } else {
            showAdminMessage(result.message || 'Fehler beim Erstellen.', 'error');
        }

    } catch (error) {
        showAdminMessage('Serverfehler: ' + error.message, 'error');
    } finally {
        // Re-enable the button no matter what happened.
        submitBtn.disabled = false;
        submitBtn.textContent = 'Produkt speichern';
    }
}


// ============================================================
// AUTH / SESSION FUNCTIONS
// ============================================================

// ------------------------------------------------------------
// loadSessionStatus()
// Ask the backend who is currently logged in and update the UI:
//   - Status bar text
//   - Logout button visibility
//   - Admin panel visibility
// ------------------------------------------------------------
function loadSessionStatus() {
    return sendJsonRequest({ action: 'sessionStatus' }, false).then(result => {
        const statusText = document.getElementById('status-text');
        if (!statusText || result.status !== 'success') return;

        if (result.logged_in) {
            const role = result.is_admin ? 'Administrator' : 'User';
            statusText.textContent = `Eingeloggt als ${result.username} (${role})`;

            if (logoutBtn) logoutBtn.hidden = false;
        } else {
            statusText.textContent = 'Nicht eingeloggt';

            if (logoutBtn) logoutBtn.hidden = true;
        }

        // Show or hide the admin panel based on the is_admin flag.
        if (adminPanel) {
            adminPanel.hidden = !result.is_admin;
        }
    });
}


// ============================================================
// UTILITY / HELPER FUNCTIONS
// ============================================================

// ------------------------------------------------------------
// getApiUrl()
// Works out the URL of the PHP backend regardless of where
// the project lives on the server.
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// sendJsonRequest(data, showMessage)
// Send a JSON POST request to the backend and return the result.
// Pass showMessage = false if you don't want a toast notification.
// ------------------------------------------------------------
function sendJsonRequest(data, renderMessage = true) {
    return fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
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

// ------------------------------------------------------------
// setProductGridContent(html)
// Replace everything in the product grid with the given HTML.
// Used to show loading / error / empty state messages.
// ------------------------------------------------------------
function setProductGridContent(html) {
    if (productGrid) productGrid.innerHTML = html;
}

// ------------------------------------------------------------
// showMessage(message, type)
// Display a success or error message in the global message box.
// ------------------------------------------------------------
function showMessage(message, type) {
    const msgBox = document.getElementById('message-box');
    if (!msgBox) return;

    const color = type === 'success' ? 'green' : 'red';
    msgBox.innerHTML = `<p style="color: ${color};">${message}</p>`;
}

// ------------------------------------------------------------
// showAdminMessage(message, type)
// Same as showMessage but for the admin panel's own message box.
// ------------------------------------------------------------
function showAdminMessage(message, type) {
    const msgBox = document.getElementById('admin-message-box');
    if (!msgBox) return;

    const color = type === 'success' ? 'green' : 'red';
    msgBox.innerHTML = `<p style="color: ${color};">${message}</p>`;
}

// ------------------------------------------------------------
// escapeHtml(text)
// Prevent XSS: converts characters like < > & into safe HTML
// entities before inserting any user-supplied text into the DOM.
// ALWAYS use this when putting database values into innerHTML.
// ------------------------------------------------------------
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}
