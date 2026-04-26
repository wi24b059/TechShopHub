const API_URL = getApiUrl();

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const logoutBtn = document.getElementById('logoutBtn');

if (loginForm) {
    loadSessionStatus();

    loginForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const identifier = document.getElementById('login_identifier').value.trim();
        const password = document.getElementById('login_password').value;

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

        sendAjaxRequest(data).then(result => {
            if (result.status === 'success') {
                loadSessionStatus();
            }
        });
    });
}

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
            action: 'register',
            salutation: document.getElementById('reg_salutation').value.trim(),
            firstname: document.getElementById('reg_firstname').value.trim(),
            lastname: document.getElementById('reg_lastname').value.trim(),
            address: document.getElementById('reg_address').value.trim(),
            zip: document.getElementById('reg_zip').value.trim(),
            city: document.getElementById('reg_city').value.trim(),
            email: document.getElementById('reg_email').value.trim(),
            username: document.getElementById('reg_username').value.trim(),
            password: pwd1,
            password_confirm: pwd2,
            payment: document.getElementById('reg_payment').value.trim()
        };

        sendAjaxRequest(data).then(result => {
            if (result.status === 'success') {
                setTimeout(() => {
                    window.location.href = '../index.html';
                }, 900);
            }
        });
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
        sendAjaxRequest({ action: 'logout' }).then(result => {
            if (result.status === 'success') {
                loadSessionStatus();
            }
        });
    });
}

function getApiUrl() {
    const origin = window.location.origin;
    const path = window.location.pathname;
    const frontendIndex = path.indexOf('/frontend/');

    if (frontendIndex !== -1) {
        const basePath = path.substring(0, frontendIndex);
        return `${origin}${basePath}/backend/logic/requestHandler.php`;
    }

    return `${origin}/backend/logic/requestHandler.php`;
}

function loadSessionStatus() {
    return sendAjaxRequest({ action: 'sessionStatus' }, false).then(result => {
        const statusText = document.getElementById('status-text');
        if (!statusText || result.status !== 'success') {
            return;
        }

        if (result.logged_in) {
            const role = result.is_admin ? 'Administrator' : 'User';
            statusText.textContent = `Eingeloggt als ${result.username} (${role})`;
            if (logoutBtn) {
                logoutBtn.hidden = false;
            }
        } else {
            statusText.textContent = 'Nicht eingeloggt';
            if (logoutBtn) {
                logoutBtn.hidden = true;
            }
        }
    });
}

function sendAjaxRequest(data, renderMessage = true) {
    return fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
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
            showMessage(`Serverfehler: ${error.message}`, 'error');
            return { status: 'error', message: 'Serverfehler' };
        });
}

function showMessage(message, type) {
    const msgBox = document.getElementById('message-box');
    if (!msgBox) {
        return;
    }

    const color = type === 'success' ? 'green' : 'red';
    msgBox.innerHTML = `<p style="color: ${color};">${message}</p>`;
}

