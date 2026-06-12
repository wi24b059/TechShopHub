<?php

// ============================================================
// requestHandler.php
// ------------------------------------------------------------
// This is the single entry point for all AJAX calls from the
// frontend. The JavaScript sends a POST request with a JSON
// body (or multipart/form-data for file uploads) and this
// file figures out what to do based on the "action" field.
//
// How it works:
//   1. Read the incoming request
//   2. Determine which "action" was requested
//   3. Run the matching code block
//   4. Always echo a JSON response back to the browser
//
// Actions available:
//   register        – create a new user account
//   login           – check credentials and start a session
//   logout          – destroy the session
//   sessionStatus   – tell the frontend who is logged in
//   getAllProducts   – admin: list every product for the product table
//   getProducts     – fetch products by category or search term
//   createProduct   – admin: add a new product (with image upload)
//   updateProduct   – admin: edit a product   (with optional image)
//   deleteProduct   – admin: remove a product
//   placeOrder      – create a new order from cart items (requires login)
//   getUserOrders   – get all orders for the current user (requires login)
//   getOrderDetails – get detailed info for a specific order (requires login)
// ============================================================

session_start();

// Load the model classes so we can use their methods below.
require_once __DIR__ . '/../models/user.class.php';
require_once __DIR__ . '/../models/product.class.php';
require_once __DIR__ . '/../models/order.class.php';

$userModel    = new User();
$productModel = new Product();
$orderModel   = new Order();

// When TECHSHOP_DEBUG is true, real error messages are shown in responses.
// Keep this false/unset in production so users never see PHP internals!
$debugMode = (bool) (getenv('TECHSHOP_DEBUG') ?: false);

// Every response from this file is JSON.
header('Content-Type: application/json');

// ---------------------------------------------------------------
// Read the incoming request body.
//
// Normal requests  → JSON string in the raw request body
// File uploads     → PHP fills $_POST and $_FILES automatically
//                    (multipart/form-data), so php://input is empty.
// ---------------------------------------------------------------
$rawBody = file_get_contents('php://input');
$data    = json_decode($rawBody, true);  // $data is an array or null

// Determine the action from whichever source has it.
if (is_array($data) && isset($data['action'])) {
    // Normal JSON request.
    $action = (string) $data['action'];
} elseif (isset($_POST['action'])) {
    // File-upload request (multipart/form-data).
    $action = (string) $_POST['action'];
} else {
    // No recognisable input at all – bail out early.
    echo json_encode(['status' => 'error', 'message' => 'Invalid request format.']);
    exit;
}

// This will be overwritten in every branch below.
$response = ['status' => 'error', 'message' => 'Unknown action.'];


// ==============================================================
// ACTION: register
// Create a new user account.
// ==============================================================
if ($action === 'register') {

    // First check if all required fields are present and valid.
    $errors = validateRegistrationData($data);

    if (!empty($errors)) {
        // Return all validation errors as one message.
        echo json_encode(['status' => 'error', 'message' => implode(' ', $errors)]);
        exit;
    }

    // NEVER store a plain-text password. password_hash() runs bcrypt,
    // a slow hashing algorithm designed to make brute-force very hard.
    $hashedPassword = password_hash($data['password'], PASSWORD_BCRYPT);

    try {
        $success = $userModel->register(
            trim($data['salutation']),
            trim($data['firstname']),
            trim($data['lastname']),
            trim($data['address']),
            trim($data['zip']),
            trim($data['city']),
            strtolower(trim($data['email'])),  // store email in lowercase for consistent lookups
            trim($data['username']),
            $hashedPassword,
            trim($data['payment'])
        );

        if ($success) {
            $response = ['status' => 'success', 'message' => 'Registrierung erfolgreich! Du kannst dich jetzt einloggen.'];
        } else {
            $response = ['status' => 'error', 'message' => 'Registrierung fehlgeschlagen. Benutzername oder E-Mail existiert bereits.'];
        }

    } catch (Throwable $e) {
        // Something unexpected went wrong (e.g. database is down).
        $response = ['status' => 'error', 'message' => 'Registrierung fehlgeschlagen. Bitte versuche es später erneut.'];
    }


// ==============================================================
// ACTION: login
// Check credentials and start a session.
// ==============================================================
} elseif ($action === 'login') {

    $identifier = trim((string) ($data['identifier'] ?? ''));  // username or email
    $password   = (string) ($data['password'] ?? '');
    $remember   = !empty($data['remember']);  // "keep me logged in" checkbox

    if ($identifier === '' || $password === '') {
        echo json_encode(['status' => 'error', 'message' => 'Benutzername/E-Mail und Passwort sind erforderlich.']);
        exit;
    }

    try {
        // Look up the user in the database.
        $user = $userModel->getUserByUsernameOrEmail($identifier);

        // password_verify() compares the plain-text input against the stored hash.
        // We must NEVER compare passwords with === directly.
        if ($user !== null && password_verify($password, $user['password_hash'])) {

            // Store key info in the session so we know who is logged in
            // on future requests without hitting the database again.
            $_SESSION['user_id']  = (int) $user['id'];
            $_SESSION['username'] = $user['username'];
            $_SESSION['is_admin'] = (int) $user['is_admin'] === 1;

            // If the user ticked "remember me", extend the session cookie lifetime.
            if ($remember) {
                setPersistentSessionCookie(86400 * 30);  // 30 days in seconds
            }

            $response = [
                'status'   => 'success',
                'message'  => 'Erfolgreich eingeloggt!',
                'is_admin' => $_SESSION['is_admin'],
            ];

        } else {
            // Either the user does not exist or the password was wrong.
            // We give the same message for both cases on purpose –
            // telling attackers which one is wrong would help them.
            $response = ['status' => 'error', 'message' => 'Falscher Benutzername oder Passwort.'];
        }

    } catch (Throwable $e) {
        error_log('TechShopHub login error: ' . $e->getMessage());
        $message  = $debugMode ? 'Login Exception: ' . $e->getMessage() : 'Login fehlgeschlagen. Bitte versuche es später erneut.';
        $response = ['status' => 'error', 'message' => $message];
    }


// ==============================================================
// ACTION: logout
// Destroy the current session so the user is logged out.
// ==============================================================
} elseif ($action === 'logout') {

    // Clear the session data array.
    $_SESSION = [];

    // Also delete the session cookie in the browser.
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 3600, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }

    // Finally, destroy the session on the server.
    session_destroy();

    $response = ['status' => 'success', 'message' => 'Du wurdest ausgeloggt.'];


// ==============================================================
// ACTION: sessionStatus
// Tell the frontend who is currently logged in (or not).
// Called on page load to update the UI.
// ==============================================================
} elseif ($action === 'sessionStatus') {

    if (!empty($_SESSION['user_id'])) {
        // A user is logged in – send back their info.
        $response = [
            'status'    => 'success',
            'logged_in' => true,
            'username'  => $_SESSION['username'] ?? '',
            'is_admin'  => !empty($_SESSION['is_admin']),
        ];
    } else {
        $response = ['status' => 'success', 'logged_in' => false];
    }


// ==============================================================
// ACTION: getProducts  (public – no login required)
// Return a list of products filtered by category or search term.
// ==============================================================
} elseif ($action === 'getAllProducts') {
    // ---------------------------------------------------------------
    // ADMIN ONLY – Return every product for the admin product table.
    // ---------------------------------------------------------------
    if (empty($_SESSION['is_admin'])) {
        echo json_encode(['status' => 'error', 'message' => 'Keine Berechtigung.']);
        exit;
    }

    try {
        $products = $productModel->getAllProducts();
        $response = ['status' => 'success', 'products' => $products];
    } catch (Throwable $e) {
        error_log('TechShopHub getAllProducts error: ' . $e->getMessage());
        $message  = $debugMode ? 'getAllProducts Exception: ' . $e->getMessage() : 'Produkte konnten nicht geladen werden.';
        $response = ['status' => 'error', 'message' => $message];
    }
} elseif ($action === 'getProducts') {

    $searchTerm = trim((string) ($data['searchTerm'] ?? ''));
    $categoryId = (int) ($data['categoryId'] ?? 0);

    try {
        if ($searchTerm !== '') {
            // User typed something in the search box.
            $products = $productModel->searchProducts($searchTerm);

        } elseif ($categoryId > 0) {
            // User clicked on a category.
            $products = $productModel->getProductsByCategory($categoryId);

        } else {
            echo json_encode(['status' => 'error', 'message' => 'Bitte categoryId oder searchTerm angeben.']);
            exit;
        }

        $response = ['status' => 'success', 'products' => $products];

    } catch (Throwable $e) {
        error_log('TechShopHub getProducts error: ' . $e->getMessage());
        $message  = $debugMode ? 'getProducts Exception: ' . $e->getMessage() : 'Produkte konnten nicht geladen werden.';
        $response = ['status' => 'error', 'message' => $message];
    }

} elseif ($action === 'cartGet') {

    $cart = $_SESSION['cart'] ?? [];
    $products = $productModel->getProductsByIds(array_keys($cart));
    $items = [];

    foreach ($products as $p) {
        $qty = (int)($cart[$p['id']] ?? 0);
        if ($qty > 0) {
            $p['qty'] = $qty;
            $items[] = $p;
        }
    }

    $response = ['status' => 'success', 'items' => $items, 'count' => array_sum($cart)];

} elseif ($action === 'cartAdd') {

    $productId = (int)($data['productId'] ?? 0);
    if ($productId <= 0) {
        echo json_encode(['status' => 'error', 'message' => 'Ungueltiges Produkt.']);
        exit;
    }
    if (empty($productModel->getProductsByIds([$productId]))) {
        echo json_encode(['status' => 'error', 'message' => 'Produkt nicht gefunden.']);
        exit;
    }

    if (!isset($_SESSION['cart'])) $_SESSION['cart'] = [];
    $_SESSION['cart'][$productId] = (int)($_SESSION['cart'][$productId] ?? 0) + 1;

    $response = ['status' => 'success', 'message' => 'Produkt wurde in den Warenkorb gelegt.', 'count' => array_sum($_SESSION['cart'])];

} elseif ($action === 'cartUpdate') {

    $productId = (int)($data['productId'] ?? 0);
    $qty = max(0, (int)($data['qty'] ?? 0));
    if (!isset($_SESSION['cart'])) $_SESSION['cart'] = [];

    if ($productId > 0) {
        if ($qty === 0) unset($_SESSION['cart'][$productId]);
        else $_SESSION['cart'][$productId] = $qty;
    }

    $response = ['status' => 'success', 'count' => array_sum($_SESSION['cart'])];

} elseif ($action === 'cartClear') {

    $_SESSION['cart'] = [];
    $response = ['status' => 'success', 'count' => 0];


// ==============================================================
// ACTION: createProduct  (admin only)
// Add a new product. Sent as multipart/form-data because it
// includes a file upload (the product image).
// ==============================================================
} elseif ($action === 'createProduct') {

    // Only admins are allowed to manage products.
    if (empty($_SESSION['is_admin'])) {
        echo json_encode(['status' => 'error', 'message' => 'Keine Berechtigung.']);
        exit;
    }

    // Save the uploaded image and get back the file path.
    $upload = handleProductImageUpload('product_image');

    if ($upload['error'] !== null) {
        echo json_encode(['status' => 'error', 'message' => $upload['error']]);
        exit;
    }

    try {
        // $_POST contains all the text fields from the multipart form.
        $newId    = $productModel->createProduct($_POST, $upload['path']);
        $response = ['status' => 'success', 'message' => 'Produkt erfolgreich erstellt.', 'id' => $newId];

    } catch (InvalidArgumentException $e) {
        // A required field was missing – this is the user's fault.
        $response = ['status' => 'error', 'message' => $e->getMessage()];

    } catch (Throwable $e) {
        error_log('TechShopHub createProduct error: ' . $e->getMessage());
        $message  = $debugMode ? 'createProduct Exception: ' . $e->getMessage() : 'Produkt konnte nicht erstellt werden.';
        $response = ['status' => 'error', 'message' => $message];
    }


// ==============================================================
// ACTION: updateProduct  (admin only)
// Edit an existing product. Also multipart/form-data so a new
// image can optionally be uploaded at the same time.
// ==============================================================
} elseif ($action === 'updateProduct') {

    if (empty($_SESSION['is_admin'])) {
        echo json_encode(['status' => 'error', 'message' => 'Keine Berechtigung.']);
        exit;
    }

    $productId = (int) ($_POST['id'] ?? 0);

    if ($productId <= 0) {
        echo json_encode(['status' => 'error', 'message' => 'Ungültige Produkt-ID.']);
        exit;
    }

    // Image replacement is optional – only process if a file was sent.
    $newImagePath = null;
    if (!empty($_FILES['product_image']['name'])) {
        $upload = handleProductImageUpload('product_image');

        if ($upload['error'] !== null) {
            echo json_encode(['status' => 'error', 'message' => $upload['error']]);
            exit;
        }

        $newImagePath = $upload['path'];
    }

    try {
        $updated  = $productModel->updateProduct($productId, $_POST, $newImagePath);
        $response = $updated
            ? ['status' => 'success', 'message' => 'Produkt erfolgreich aktualisiert.']
            : ['status' => 'error',   'message' => 'Produkt nicht gefunden oder keine Änderung.'];

    } catch (InvalidArgumentException $e) {
        $response = ['status' => 'error', 'message' => $e->getMessage()];

    } catch (Throwable $e) {
        error_log('TechShopHub updateProduct error: ' . $e->getMessage());
        $message  = $debugMode ? 'updateProduct Exception: ' . $e->getMessage() : 'Produkt konnte nicht aktualisiert werden.';
        $response = ['status' => 'error', 'message' => $message];
    }


// ==============================================================
// ACTION: deleteProduct  (admin only)
// Remove a product by its ID. Sent as regular JSON.
// ==============================================================
} elseif ($action === 'deleteProduct') {

    if (empty($_SESSION['is_admin'])) {
        echo json_encode(['status' => 'error', 'message' => 'Keine Berechtigung.']);
        exit;
    }

    $productId = (int) ($data['id'] ?? 0);

    if ($productId <= 0) {
        echo json_encode(['status' => 'error', 'message' => 'Ungültige Produkt-ID.']);
        exit;
    }

    try {
        $deleted  = $productModel->deleteProduct($productId);
        $response = $deleted
            ? ['status' => 'success', 'message' => 'Produkt erfolgreich gelöscht.']
            : ['status' => 'error',   'message' => 'Produkt nicht gefunden.'];

    } catch (Throwable $e) {
        error_log('TechShopHub deleteProduct error: ' . $e->getMessage());
        $message  = $debugMode ? 'deleteProduct Exception: ' . $e->getMessage() : 'Produkt konnte nicht gelöscht werden.';
        $response = ['status' => 'error', 'message' => $message];
    }


// ==============================================================
// ACTION: placeOrder
// Create a new order from cart items (requires login).
// ==============================================================
} elseif ($action === 'placeOrder') {

    if (empty($_SESSION['user_id'])) {
        echo json_encode(['status' => 'error', 'message' => 'Bitte melden Sie sich an.']);
        exit;
    }

    $cart = $_SESSION['cart'] ?? [];
    $products = $productModel->getProductsByIds(array_keys($cart));
    $items = [];

    foreach ($products as $p) {
        $qty = (int)($cart[$p['id']] ?? 0);
        if ($qty > 0) {
            $items[] = ['productId' => (int)$p['id'], 'quantity' => $qty, 'price' => (float)$p['price']];
        }
    }

    if (empty($items) || !is_array($items)) {
        echo json_encode(['status' => 'error', 'message' => 'Warenkorb ist leer.']);
        exit;
    }

    try {
        $paymentMethod = trim((string)($data['paymentMethod'] ?? ''));
        $couponCode = trim((string)($data['couponCode'] ?? ''));
        $orderId = $orderModel->placeOrder($_SESSION['user_id'], $items, $paymentMethod, $couponCode);
        $_SESSION['cart'] = [];
        $response = [
            'status'   => 'success',
            'message'  => 'Bestellung erfolgreich!',
            'order_id' => $orderId
        ];

    } catch (Throwable $e) {
        error_log('TechShopHub placeOrder error: ' . $e->getMessage());
        $message  = $debugMode ? 'placeOrder Exception: ' . $e->getMessage() : 'Bestellung fehlgeschlagen.';
        $response = ['status' => 'error', 'message' => $message];
    }


// ==============================================================
// ACTION: getUserOrders
// ==============================================================
} elseif ($action === 'getUserOrders') {

    if (empty($_SESSION['user_id'])) {
        echo json_encode(['status' => 'error', 'message' => 'Bitte melden Sie sich an.']);
        exit;
    }

    try {
        $orders = $orderModel->getUserOrders($_SESSION['user_id']);
        $response = ['status' => 'success', 'orders' => $orders];

    } catch (Throwable $e) {
        error_log('TechShopHub getUserOrders error: ' . $e->getMessage());
        $message  = $debugMode ? 'getUserOrders Exception: ' . $e->getMessage() : 'Bestellungen konnten nicht geladen werden.';
        $response = ['status' => 'error', 'message' => $message];
    }


// ==============================================================
// ACTION: getOrderDetails
// ==============================================================
} elseif ($action === 'getOrderDetails') {

    if (empty($_SESSION['user_id'])) {
        echo json_encode(['status' => 'error', 'message' => 'Bitte melden Sie sich an.']);
        exit;
    }

    $orderId = (int) ($data['orderId'] ?? 0);

    if ($orderId <= 0) {
        echo json_encode(['status' => 'error', 'message' => 'Ungültige Bestellungs-ID.']);
        exit;
    }

    try {
        $orderData = $orderModel->getOrderDetails($orderId, $_SESSION['user_id']);
        $response = ['status' => 'success', 'data' => $orderData];

    } catch (Throwable $e) {
        error_log('TechShopHub getOrderDetails error: ' . $e->getMessage());
        $message  = $debugMode ? 'getOrderDetails Exception: ' . $e->getMessage() : 'Bestellung konnte nicht geladen werden.';
        $response = ['status' => 'error', 'message' => $message];
    }
}
// ==============================================================
// ACTION: getProfile
// ==============================================================
elseif ($action === 'getProfile') {

    if (empty($_SESSION['user_id'])) {
        echo json_encode([
            'status' => 'error',
            'message' => 'Bitte anmelden.'
        ]);
        exit;
    }

    try {

        $user = $userModel->getUserById(
            (int) $_SESSION['user_id']
        );

        $response = [
            'status' => 'success',
            'user'   => $user
        ];

    } catch (Throwable $e) {

        error_log('TechShopHub getProfile error: ' . $e->getMessage());

        $response = [
            'status'  => 'error',
            'message' => 'Profil konnte nicht geladen werden.'
        ];
    }
}


// ==============================================================
// ACTION: updateProfile
// ==============================================================
elseif ($action === 'updateProfile') {

    if (empty($_SESSION['user_id'])) {
        echo json_encode([
            'status' => 'error',
            'message' => 'Bitte anmelden.'
        ]);
        exit;
    }

    try {

        $success = $userModel->updateUser(
            (int) $_SESSION['user_id'],
            trim((string)($data['firstname'] ?? '')),
            trim((string)($data['lastname'] ?? '')),
            trim((string)($data['address'] ?? '')),
            trim((string)($data['zip'] ?? '')),
            trim((string)($data['city'] ?? '')),
            trim((string)($data['payment'] ?? ''))
        );

        $response = [
            'status'  => $success ? 'success' : 'error',
            'message' => $success
                ? 'Profil erfolgreich gespeichert.'
                : 'Profil konnte nicht gespeichert werden.'
        ];

    } catch (Throwable $e) {

        error_log('TechShopHub updateProfile error: ' . $e->getMessage());

        $response = [
            'status'  => 'error',
            'message' => 'Profil konnte nicht gespeichert werden.'
        ];
    }
}
echo json_encode($response);


// ==============================================================
// HELPER FUNCTIONS
// Defined below the main logic so the routing above is easier
// to read without scrolling past utility code.
// ==============================================================

// --------------------------------------------------------------
// validateRegistrationData()
// Check the registration form data and return an array of error
// messages. An empty array means everything is valid.
// --------------------------------------------------------------
function validateRegistrationData(array $data): array
{
    $errors = [];

    // 1. Check that no required field is missing or empty.
    $required = ['salutation', 'firstname', 'lastname', 'address', 'zip', 'city',
                 'email', 'username', 'password', 'password_confirm', 'payment'];

    foreach ($required as $field) {
        if (!isset($data[$field]) || trim((string) $data[$field]) === '') {
            $errors[] = 'Bitte alle Pflichtfelder vollständig ausfüllen.';
            return $errors;  // No point checking further if something is already missing.
        }
    }

    // 2. Salutation must be one of the three known options.
    if (!in_array($data['salutation'], ['Herr', 'Frau', 'Divers'], true)) {
        $errors[] = 'Ungültige Anrede.';
    }

    // 3. Name fields: only letters, hyphens, and spaces, 2–60 chars.
    if (!preg_match('/^[\p{L}\s-]{2,60}$/u', (string) $data['firstname'])) {
        $errors[] = 'Vorname ist ungültig.';
    }
    if (!preg_match('/^[\p{L}\s-]{2,60}$/u', (string) $data['lastname'])) {
        $errors[] = 'Nachname ist ungültig.';
    }

    // 4. Address must be at least 5 characters.
    if (mb_strlen((string) $data['address']) < 5) {
        $errors[] = 'Adresse ist zu kurz.';
    }

    // 5. ZIP code: 4–10 digits only.
    if (!preg_match('/^[0-9]{4,10}$/', (string) $data['zip'])) {
        $errors[] = 'PLZ ist ungültig.';
    }

    // 6. City: letters, spaces, dots, hyphens.
    if (!preg_match('/^[\p{L}\s.-]{2,80}$/u', (string) $data['city'])) {
        $errors[] = 'Ort ist ungültig.';
    }

    // 7. Email: PHP's built-in filter is good enough here.
    if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
        $errors[] = 'E-Mail-Adresse ist ungültig.';
    }

    // 8. Username: 3–30 chars, letters/numbers/dots/hyphens/underscores.
    if (!preg_match('/^[A-Za-z0-9_.-]{3,30}$/', (string) $data['username'])) {
        $errors[] = 'Benutzername muss 3-30 Zeichen enthalten und darf nur Buchstaben, Zahlen, Punkt, Minus und Unterstrich enthalten.';
    }

    // 9. Password: at least 8 chars, one letter, one number.
    $password = (string) $data['password'];
    $passwordTooShort  = strlen($password) < 8;
    $passwordNoLetter  = !preg_match('/[A-Za-z]/', $password);
    $passwordNoNumber  = !preg_match('/[0-9]/', $password);

    if ($passwordTooShort || $passwordNoLetter || $passwordNoNumber) {
        $errors[] = 'Passwort muss mindestens 8 Zeichen, einen Buchstaben und eine Zahl enthalten.';
    }

    // 10. Both password fields must match.
    if ($data['password'] !== $data['password_confirm']) {
        $errors[] = 'Die Passwörter stimmen nicht überein.';
    }

    // 11. Payment info must have at least 3 characters.
    if (mb_strlen((string) $data['payment']) < 3) {
        $errors[] = 'Zahlungsinformation ist ungültig.';
    }

    return $errors;
}


// --------------------------------------------------------------
// handleProductImageUpload()
// Save the uploaded product image to backend/productpictures/.
//
// Returns an array with two keys:
//   'path'  → relative file path to store in the database (string)
//   'error' → null on success, or an error message string
// --------------------------------------------------------------
function handleProductImageUpload(string $fieldName): array
{
    // No file was sent at all.
    if (empty($_FILES[$fieldName]['name'])) {
        return ['path' => '', 'error' => 'Keine Bilddatei übermittelt.'];
    }

    $file = $_FILES[$fieldName];

    // PHP sets an error code if something went wrong during the upload itself
    // (e.g. the file was too large according to php.ini).
    if ($file['error'] !== UPLOAD_ERR_OK) {
        return ['path' => '', 'error' => 'Upload-Fehler (Code ' . $file['error'] . ').'];
    }

    // Enforce our own 5 MB limit.
    $maxBytes = 5 * 1024 * 1024;  // 5 MB in bytes
    if ($file['size'] > $maxBytes) {
        return ['path' => '', 'error' => 'Bild darf maximal 5 MB groß sein.'];
    }

    // Check the real MIME type by reading the file's bytes – not just the
    // file extension – because an attacker could rename a PHP file to "photo.jpg".
    $finfo        = new finfo(FILEINFO_MIME_TYPE);
    $mimeType     = $finfo->file($file['tmp_name']);
    $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    if (!in_array($mimeType, $allowedTypes, true)) {
        return ['path' => '', 'error' => 'Nur JPEG, PNG, GIF und WebP sind erlaubt.'];
    }

    // Map each allowed MIME type to a clean file extension.
    $extensionMap = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/gif'  => 'gif',
        'image/webp' => 'webp',
    ];
    $extension = $extensionMap[$mimeType];

    // Create the upload folder if it does not exist yet.
    $uploadDir = __DIR__ . '/../productpictures/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    // Generate a random, unique filename so:
    //   - two uploads of the same file don't overwrite each other
    //   - attackers cannot guess the URL of any uploaded file
    $filename     = bin2hex(random_bytes(16)) . '.' . $extension;
    $destination  = $uploadDir . $filename;

    // move_uploaded_file() is the ONLY safe way to move an uploaded file.
    // It verifies that the file actually came via HTTP upload.
    if (!move_uploaded_file($file['tmp_name'], $destination)) {
        return ['path' => '', 'error' => 'Bild konnte nicht gespeichert werden.'];
    }

    // Return a path relative to the server root so the frontend can use it in <img src="...">.
    // $_SERVER['SCRIPT_NAME'] = e.g. /TechShopHub/backend/logic/requestHandler.php
    // We remove the known suffix to get the project root: /TechShopHub
    $projectBase = str_replace('/backend/logic/requestHandler.php', '', $_SERVER['SCRIPT_NAME']);

    return ['path' => $projectBase . '/backend/productpictures/' . $filename, 'error' => null];
}


// --------------------------------------------------------------
// setPersistentSessionCookie()
// Override the default session cookie so it survives a browser
// restart (used for the "remember me" feature).
// --------------------------------------------------------------
function setPersistentSessionCookie(int $seconds): void
{
    // Only mark the cookie as "secure" when the site runs over HTTPS.
    $isSecure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';

    // PHP 7.3+ supports the SameSite option via an options array.
    if (PHP_VERSION_ID >= 70300) {
        setcookie(session_name(), session_id(), [
            'expires'  => time() + $seconds,
            'path'     => '/',
            'secure'   => $isSecure,
            'httponly' => true,    // JS cannot read this cookie – prevents XSS token theft
            'samesite' => 'Lax',  // Sent on normal navigation, not on cross-site requests
        ]);
        return;
    }

    // Older PHP: smuggle SameSite into the path string (a common workaround).
    setcookie(session_name(), session_id(), time() + $seconds, '/; samesite=Lax', '', $isSecure, true);
}

