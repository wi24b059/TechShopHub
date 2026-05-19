-- ============================================================
-- NOTE: If you uploaded a product image BEFORE this fix,
-- its path is stored as  "backend/productpictures/file.png"
-- (relative, broken).  Run the query below once to repair it:
--
--   UPDATE products
--   SET    image_path = CONCAT('/TechShopHub/', image_path)
--   WHERE  image_path LIKE 'backend/%';
--
-- Adjust "/TechShopHub" to match your server's project sub-path.
-- ============================================================

CREATE DATABASE IF NOT EXISTS techshophub;
USE techshophub;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    salutation VARCHAR(20) NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    address VARCHAR(100) NOT NULL,
    zip VARCHAR(20) NOT NULL,
    city VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    payment_info VARCHAR(255) NOT NULL,
    is_admin TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Kategorien
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
    id   INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

INSERT INTO categories (name) VALUES
    ('Laptops'),
    ('Headsets'),
    ('PCs')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ============================================================
-- Produkte
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    category_id  INT            NOT NULL,
    name         VARCHAR(150)   NOT NULL,
    description  TEXT           NOT NULL,
    price        DECIMAL(10, 2) NOT NULL,
    rating       DECIMAL(3, 1)  NOT NULL DEFAULT 0.0,
    image_path   VARCHAR(255)   NOT NULL DEFAULT '',
    created_at   TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_products_category
        FOREIGN KEY (category_id) REFERENCES categories (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

INSERT INTO products (category_id, name, description, price, rating, image_path) VALUES
    (1, 'TechBook Pro 15',   'Leistungsstarkes 15-Zoll-Laptop mit Intel Core i7, 16 GB RAM und 512 GB SSD.',          1299.99, 4.5, 'res/img/product-placeholder.svg'),
    (1, 'UltraSlim 13',      'Ultraleichtes 13-Zoll-Notebook mit OLED-Display und 20 Stunden Akkulaufzeit.',           999.00, 4.7, 'res/img/product-placeholder.svg'),
    (1, 'BudgetBook 14',     'Solides Einsteiger-Laptop für Schule und Büro, 8 GB RAM, 256 GB SSD.',                   499.00, 3.9, 'res/img/product-placeholder.svg'),
    (2, 'SoundMax Pro',      'Over-Ear Gaming-Headset mit 7.1-Surround-Sound und abnehmbarem Mikrofon.',               149.95, 4.6, 'res/img/product-placeholder.svg'),
    (2, 'ClearVoice USB',    'USB-Headset für Home-Office und Videokonferenzen, komfortables Leichtbau-Design.',         59.90, 4.2, 'res/img/product-placeholder.svg'),
    (2, 'BassBoost 360',     'Wireless-Headset mit ANC, 30 h Akku und 360°-Spatial-Audio.',                           199.00, 4.8, 'res/img/product-placeholder.svg'),
    (3, 'PowerDesk i9',      'High-End-Gaming-PC mit Intel Core i9, RTX 4080, 32 GB DDR5-RAM und 2 TB NVMe-SSD.',    2499.00, 4.9, 'res/img/product-placeholder.svg'),
    (3, 'HomeOffice Tower',  'Zuverlässiger Office-PC mit AMD Ryzen 5, 16 GB RAM und 512 GB SSD.',                     749.00, 4.3, 'res/img/product-placeholder.svg'),
    (3, 'MiniPC Compact',    'Kompakter Mini-PC für den Schreibtisch, Intel Core i5, 8 GB RAM, 256 GB SSD.',           399.00, 4.1, 'res/img/product-placeholder.svg');

UPDATE products
SET image_path = 'res/img/product-placeholder.svg'
WHERE image_path IN (
    'res/img/techbook-pro-15.jpg',
    'res/img/ultraslim-13.jpg',
    'res/img/budgetbook-14.jpg',
    'res/img/soundmax-pro.jpg',
    'res/img/clearvoice-usb.jpg',
    'res/img/bassboost-360.jpg',
    'res/img/powerdesk-i9.jpg',
    'res/img/homeoffice-tower.jpg',
    'res/img/minipc-compact.jpg'
);

-- ============================================================
-- Bestellungen (Orders)
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_orders_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS coupons (
    code VARCHAR(50) PRIMARY KEY,
    balance DECIMAL(10, 2) NOT NULL
);

INSERT INTO coupons (code, balance) VALUES ('GUTSCHEIN10', 10.00)
ON DUPLICATE KEY UPDATE code = code;

CREATE TABLE IF NOT EXISTS order_payments (
    order_id INT PRIMARY KEY,
    payment_method VARCHAR(100) NOT NULL,
    coupon_code VARCHAR(50) NOT NULL DEFAULT '',
    discount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    CONSTRAINT fk_order_payments_order
        FOREIGN KEY (order_id) REFERENCES orders (id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

-- ============================================================
-- Bestellpositionen (Order Items)
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    price_at_purchase DECIMAL(10, 2) NOT NULL,
    CONSTRAINT fk_order_items_order
        FOREIGN KEY (order_id) REFERENCES orders (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_order_items_product
        FOREIGN KEY (product_id) REFERENCES products (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- ============================================================
-- Manueller Insert eines Administrators laut Anforderung.
-- password_hash durch einen echten bcrypt-Hash ersetzen.
-- ============================================================
INSERT INTO users (
    salutation,
    first_name,
    last_name,
    address,
    zip,
    city,
    email,
    username,
    password_hash,
    payment_info,
    is_admin
) VALUES (
    'Herr',
    'Admin',
    'Adminsson',
    'Adminstrasse 1',
    '1010',
    'Wien',
    'admin@techshophub.local',
    'admin',
    '$2y$10$5mDWoOY3byIBt7MBVgPdR.TNCrZqwOCfE1Fnbs3y7l05prLpmjoJS',
    'Invoice',
    1
)
ON DUPLICATE KEY UPDATE is_admin = VALUES(is_admin);
