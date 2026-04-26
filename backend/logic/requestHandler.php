<?php
session_start();

require_once __DIR__ . '/../models/user.class.php';
$userModel = new User();
define('TECHSHOP_DEBUG', (bool)(getenv('TECHSHOP_DEBUG') ?: false));

header('Content-Type: application/json');

$inputJSON = file_get_contents('php://input');
$data = json_decode($inputJSON, true);

if (!is_array($data)) {
    echo json_encode(['status' => 'error', 'message' => 'Ungültiges JSON-Format.']);
    exit;
}

$action = $data['action'] ?? '';
$response = ['status' => 'error', 'message' => 'Unbekannte Aktion.'];

if ($action === 'register') {
    $errors = validateRegistrationData($data);

    if (!empty($errors)) {
        $response = ['status' => 'error', 'message' => implode(' ', $errors)];
        echo json_encode($response);
        exit;
    }

    $hashedPassword = password_hash($data['password'], PASSWORD_BCRYPT);

    try {
        $success = $userModel->register(
            trim($data['salutation']),
            trim($data['firstname']),
            trim($data['lastname']),
            trim($data['address']),
            trim($data['zip']),
            trim($data['city']),
            trim(strtolower($data['email'])),
            trim($data['username']),
            $hashedPassword,
            trim($data['payment'])
        );

        if ($success) {
            $response = [
                'status' => 'success',
                'message' => 'Registrierung erfolgreich! Du kannst dich jetzt einloggen.'
            ];
        } else {
            $response = [
                'status' => 'error',
                'message' => 'Registrierung fehlgeschlagen. Benutzername oder E-Mail existiert bereits.'
            ];
        }
    } catch (Throwable $e) {
        $response = [
            'status' => 'error',
            'message' => 'Registrierung fehlgeschlagen. Bitte versuche es später erneut.'
        ];
    }
} elseif ($action === 'login') {
    $identifier = trim((string)($data['identifier'] ?? ''));
    $password = (string)($data['password'] ?? '');
    $remember = !empty($data['remember']);

    if ($identifier === '' || $password === '') {
        $response = ['status' => 'error', 'message' => 'Benutzername/E-Mail und Passwort sind erforderlich.'];
        echo json_encode($response);
        exit;
    }

    try {
        $user = $userModel->getUserByUsernameOrEmail($identifier);

        if ($user && password_verify($password, $user['password_hash'])) {
            $_SESSION['user_id'] = (int)$user['id'];
            $_SESSION['username'] = $user['username'];
            $_SESSION['is_admin'] = (int)$user['is_admin'] === 1;

            if ($remember) {
                setPersistentSessionCookie(86400 * 30);
            }

            $response = [
                'status' => 'success',
                'message' => 'Erfolgreich eingeloggt!',
                'is_admin' => (int)$user['is_admin'] === 1
            ];
        } else {
            $response = ['status' => 'error', 'message' => 'Falscher Benutzername oder Passwort.'];
        }
    } catch (Throwable $e) {
        error_log('TechShopHub login error: ' . $e->getMessage());
        $response = [
            'status' => 'error',
            'message' => TECHSHOP_DEBUG
                ? 'Login Exception: ' . $e->getMessage()
                : 'Login fehlgeschlagen. Bitte versuche es später erneut.'
        ];
    }
} elseif ($action === 'logout') {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();

    $response = ['status' => 'success', 'message' => 'Du wurdest ausgeloggt.'];
} elseif ($action === 'sessionStatus') {
    if (!empty($_SESSION['user_id'])) {
        $response = [
            'status' => 'success',
            'logged_in' => true,
            'username' => $_SESSION['username'] ?? '',
            'is_admin' => !empty($_SESSION['is_admin'])
        ];
    } else {
        $response = ['status' => 'success', 'logged_in' => false];
    }
}

echo json_encode($response);

function validateRegistrationData(array $data): array
{
    $errors = [];

    $required = [
        'salutation', 'firstname', 'lastname', 'address', 'zip', 'city',
        'email', 'username', 'password', 'password_confirm', 'payment'
    ];

    foreach ($required as $field) {
        if (!isset($data[$field]) || trim((string)$data[$field]) === '') {
            $errors[] = 'Bitte alle Pflichtfelder vollständig ausfüllen.';
            return $errors;
        }
    }

    $salutations = ['Herr', 'Frau', 'Divers'];
    if (!in_array($data['salutation'], $salutations, true)) {
        $errors[] = 'Ungültige Anrede.';
    }

    if (!preg_match('/^[\p{L}\s-]{2,60}$/u', (string)$data['firstname'])) {
        $errors[] = 'Vorname ist ungültig.';
    }

    if (!preg_match('/^[\p{L}\s-]{2,60}$/u', (string)$data['lastname'])) {
        $errors[] = 'Nachname ist ungültig.';
    }

    if (mb_strlen((string)$data['address']) < 5) {
        $errors[] = 'Adresse ist zu kurz.';
    }

    if (!preg_match('/^[0-9]{4,10}$/', (string)$data['zip'])) {
        $errors[] = 'PLZ ist ungültig.';
    }

    if (!preg_match('/^[\p{L}\s.-]{2,80}$/u', (string)$data['city'])) {
        $errors[] = 'Ort ist ungültig.';
    }

    if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
        $errors[] = 'E-Mail-Adresse ist ungültig.';
    }

    if (!preg_match('/^[A-Za-z0-9_.-]{3,30}$/', (string)$data['username'])) {
        $errors[] = 'Benutzername muss 3-30 Zeichen enthalten und darf nur Buchstaben, Zahlen, Punkt, Minus und Unterstrich enthalten.';
    }

    $password = (string)$data['password'];
    if (strlen($password) < 8 || !preg_match('/[A-Za-z]/', $password) || !preg_match('/[0-9]/', $password)) {
        $errors[] = 'Passwort muss mindestens 8 Zeichen, einen Buchstaben und eine Zahl enthalten.';
    }

    if ((string)$data['password'] !== (string)$data['password_confirm']) {
        $errors[] = 'Die Passwörter stimmen nicht überein.';
    }

    if (mb_strlen((string)$data['payment']) < 3) {
        $errors[] = 'Zahlungsinformation ist ungültig.';
    }

    return $errors;
}

function setPersistentSessionCookie(int $seconds): void
{
    $isSecure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';

    // PHP >= 7.3 supports the options array for SameSite.
    if (PHP_VERSION_ID >= 70300) {
        setcookie(
            session_name(),
            session_id(),
            [
                'expires' => time() + $seconds,
                'path' => '/',
                'secure' => $isSecure,
                'httponly' => true,
                'samesite' => 'Lax',
            ]
        );
        return;
    }

    // Fallback for older PHP versions.
    setcookie(session_name(), session_id(), time() + $seconds, '/; samesite=Lax', '', $isSecure, true);
}

