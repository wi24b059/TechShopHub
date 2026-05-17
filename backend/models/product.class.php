<?php

// ============================================================
// product.class.php
// ------------------------------------------------------------
// This class handles all database operations for products.
//
// Available methods:
//   getProductsByCategory($categoryId) → list products by category
//   searchProducts($searchTerm)        → search by name or description
//   createProduct($data, $imagePath)   → add a new product
//   updateProduct($id, $data, $img)    → edit an existing product
//   deleteProduct($id)                 → remove a product
//
// All queries use prepared statements to prevent SQL injection.
// ============================================================

require_once __DIR__ . '/../config/database.php';

class Product
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    // ----------------------------------------------------------
    // Get all products that belong to a specific category.
    // Also fetches the category name via a JOIN so the caller
    // doesn't need a second query.
    //
    // Returns an array of product rows (can be empty).
    // ----------------------------------------------------------
    public function getProductsByCategory(int $categoryId): array
    {
        $sql = '
            SELECT p.*, c.name AS category_name
            FROM   products p
            JOIN   categories c ON c.id = p.category_id
            WHERE  p.category_id = :category_id
            ORDER  BY p.created_at DESC
        ';

        $stmt = $this->db->prepare($sql);
        $stmt->execute([':category_id' => $categoryId]);

        return $stmt->fetchAll();
    }

    // ----------------------------------------------------------
    // Search products by name or description.
    // The "%" around the term is a SQL wildcard meaning
    // "anything before / after the search term".
    //
    // Returns an array of matching product rows (can be empty).
    // ----------------------------------------------------------
    public function searchProducts(string $searchTerm): array
    {
        // Wrap the term in wildcards for a LIKE search.
        $like = '%' . $searchTerm . '%';

        $sql = '
            SELECT p.*, c.name AS category_name
            FROM   products p
            JOIN   categories c ON c.id = p.category_id
            WHERE  p.name        LIKE :name_term
               OR  p.description LIKE :desc_term
            ORDER  BY p.name ASC
        ';

        $stmt = $this->db->prepare($sql);

        // We need two separate placeholders even though the value is the same,
        // because each placeholder can only be used once in PDO.
        $stmt->execute([
            ':name_term' => $like,
            ':desc_term' => $like,
        ]);

        return $stmt->fetchAll();
    }

    // ----------------------------------------------------------
    // Insert a new product into the database.
    //
    // $data must contain: category_id, name, description, price
    // $data can optionally contain: rating
    // $imagePath is the relative path to the uploaded image file.
    //
    // Returns the ID of the newly created product.
    // ----------------------------------------------------------
    public function createProduct(array $data, string $imagePath): int
    {
        // Make sure the required fields are actually present.
        $this->requireFields($data, ['category_id', 'name', 'description', 'price']);

        $sql = '
            INSERT INTO products (category_id, name, description, price, rating, image_path)
            VALUES               (:category_id, :name, :description, :price, :rating, :image_path)
        ';

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':category_id' => (int)   $data['category_id'],
            ':name'        =>          trim($data['name']),
            ':description' =>          trim($data['description']),
            ':price'       => (float)  $data['price'],
            ':rating'      => (float) ($data['rating'] ?? 0.0),  // default to 0 if not provided
            ':image_path'  =>          $imagePath,
        ]);

        // lastInsertId() returns the auto-incremented ID of the row we just created.
        return (int) $this->db->lastInsertId();
    }

    // ----------------------------------------------------------
    // Update an existing product.
    //
    // Only the fields present in $data will be changed.
    // Passing a new $imagePath is optional – leave it null to
    // keep the existing image.
    //
    // Returns true if a row was actually changed, false if not.
    // ----------------------------------------------------------
    public function updateProduct(int $id, array $data, ?string $imagePath = null): bool
    {
        // We build the SET clause dynamically so only sent fields get updated.
        // Allowed field names – we whitelist them to prevent anyone from
        // accidentally (or maliciously) updating other columns.
        $allowedFields = ['category_id', 'name', 'description', 'price', 'rating'];

        $setParts = [];  // Will hold strings like "name = :name"
        $params   = [':id' => $id];

        foreach ($allowedFields as $field) {
            if (array_key_exists($field, $data)) {
                $setParts[]        = "$field = :$field";
                $params[":$field"] = $data[$field];
            }
        }

        // If a new image was uploaded, update that column too.
        if ($imagePath !== null) {
            $setParts[]          = 'image_path = :image_path';
            $params[':image_path'] = $imagePath;
        }

        // Nothing to update?
        if (empty($setParts)) {
            return false;
        }

        // Glue the parts together: "name = :name, price = :price, ..."
        $setClause = implode(', ', $setParts);
        $sql       = "UPDATE products SET $setClause WHERE id = :id";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        // rowCount() tells us how many rows were actually changed.
        return $stmt->rowCount() > 0;
    }

    // ----------------------------------------------------------
    // Get ALL products (all categories combined).
    // Used by the admin panel to show a full product list.
    //
    // Returns an array of all product rows ordered by category → name.
    // ----------------------------------------------------------
    public function getAllProducts(): array
    {
        $sql = '
            SELECT p.*, c.name AS category_name
            FROM   products p
            JOIN   categories c ON c.id = p.category_id
            ORDER  BY c.name ASC, p.name ASC
        ';

        $stmt = $this->db->prepare($sql);
        $stmt->execute();

        return $stmt->fetchAll();
    }

    // ----------------------------------------------------------
    // Delete a product by its ID.
    //
    // Returns true if the product was found and deleted.
    // Returns false if no product with that ID existed.
    // ----------------------------------------------------------
    public function deleteProduct(int $id): bool
    {
        $stmt = $this->db->prepare('DELETE FROM products WHERE id = :id');
        $stmt->execute([':id' => $id]);

        return $stmt->rowCount() > 0;
    }

    // ==========================================================
    // Private helper methods
    // ==========================================================

    // ----------------------------------------------------------
    // Check that all required keys exist in $data and are
    // not empty. Throws an exception with a clear message if
    // something is missing – easier to debug than a silent fail.
    // ----------------------------------------------------------
    private function requireFields(array $data, array $fields): void
    {
        foreach ($fields as $field) {
            $isEmpty = !isset($data[$field]) || trim((string) $data[$field]) === '';

            if ($isEmpty) {
                throw new InvalidArgumentException("Missing required field: \"$field\"");
            }
        }
    }
}

