# TechShopHub

TechShopHub is an online electronics webshop project developed for our "Webentwicklungsprojekt" course.
It allows users to browse, purchase, and manage electronic products such as:

laptops, headsets, and PCs

while providing admins with tools to manage the store.


## Features

### User System
•⁠  ⁠User registration and login
•⁠  ⁠Secure authentication (password encryption)
•⁠  ⁠Profile management

### Product Catalog
•⁠  ⁠Browse products (laptops, PCs, headsets)
•⁠  ⁠Product search and filtering (AJAX)
•⁠  ⁠Detailed product pages

### Shopping Cart
•⁠  ⁠Add and remove products
•⁠  ⁠Update product quantities
•⁠  ⁠Persistent cart (session-based)

### Orders
•⁠  ⁠Place orders
•⁠  ⁠Store orders in database
•⁠  ⁠Order history tracking

### Admin Panel
•⁠  ⁠Add, edit, and delete products
•⁠  ⁠Manage users and orders
•⁠  ⁠Upload product images
•⁠  ⁠Manage coupons

## Auth Setup (MySQL)

1. Import `backend/config/schema.sql` into your MySQL instance (`localhost:3306`).
2. Set these environment variables for PHP runtime if needed:
   - `TECHSHOP_DB_HOST`
   - `TECHSHOP_DB_PORT`
   - `TECHSHOP_DB_NAME`
   - `TECHSHOP_DB_USER`
   - `TECHSHOP_DB_PASS`
3. Open `frontend/index.html` for login and `frontend/sites/register.html` for registration flow.

## Manual Admin User

- Add one user manually in MySQL with `is_admin = 1` (template is inside `backend/config/schema.sql`).
- Login status shows role information (`Administrator` vs `User`) on `frontend/index.html`.
