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

-- Manueller Insert eines Administrators laut Anforderung.
-- password_hash durch einen echten bcrypt-Hash ersetzen.
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
);
