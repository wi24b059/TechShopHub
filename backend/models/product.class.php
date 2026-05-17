<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

class Product
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    /**
     * Gibt alle Produkte einer bestimmten Kategorie zurück.
     *
     * @param int $categoryId Die ID der Kategorie.
     * @return array<int, array<string, mixed>> Liste der Produkte.
     * @throws RuntimeException Bei einem Datenbankfehler.
     */
    public function getProductsByCategory(int $categoryId): array
    {
        try {
            $stmt = $this->db->prepare(
                'SELECT p.*, c.name AS category_name
                 FROM products p
                 JOIN categories c ON c.id = p.category_id
                 WHERE p.category_id = :category_id
                 ORDER BY p.created_at DESC'
            );
            $stmt->execute([':category_id' => $categoryId]);

            return $stmt->fetchAll();
        } catch (\PDOException $e) {
            throw new \RuntimeException(
                'Fehler beim Laden der Produkte nach Kategorie: ' . $e->getMessage(),
                (int)$e->getCode(),
                $e
            );
        }
    }

    /**
     * Durchsucht Produkte nach Name oder Beschreibung.
     *
     * @param string $searchTerm Der Suchbegriff.
     * @return array<int, array<string, mixed>> Gefundene Produkte.
     * @throws RuntimeException Bei einem Datenbankfehler.
     */
    public function searchProducts(string $searchTerm): array
    {
        try {
            $like = '%' . $searchTerm . '%';

            $stmt = $this->db->prepare(
                'SELECT p.*, c.name AS category_name
                 FROM products p
                 JOIN categories c ON c.id = p.category_id
                 WHERE p.name LIKE :name_term
                    OR p.description LIKE :desc_term
                 ORDER BY p.name ASC'
            );
            $stmt->execute([
                ':name_term' => $like,
                ':desc_term' => $like,
            ]);

            return $stmt->fetchAll();
        } catch (\PDOException $e) {
            throw new \RuntimeException(
                'Fehler bei der Produktsuche: ' . $e->getMessage(),
                (int)$e->getCode(),
                $e
            );
        }
    }

    /**
     * Legt ein neues Produkt an.
     *
     * Erwartete Schlüssel in $data:
     *   category_id (int), name (string), description (string),
     *   price (float), rating (float, optional)
     *
     * @param array<string, mixed> $data      Produktdaten.
     * @param string               $imagePath Relativer Pfad zum Produktbild.
     * @return int Die ID des neu erstellten Produkts.
     * @throws InvalidArgumentException Wenn Pflichtfelder fehlen.
     * @throws RuntimeException         Bei einem Datenbankfehler.
     */
    public function createProduct(array $data, string $imagePath): int
    {
        $this->assertRequiredFields($data, ['category_id', 'name', 'description', 'price']);

        try {
            $stmt = $this->db->prepare(
                'INSERT INTO products (category_id, name, description, price, rating, image_path)
                 VALUES (:category_id, :name, :description, :price, :rating, :image_path)'
            );

            $stmt->execute([
                ':category_id' => (int)$data['category_id'],
                ':name'        => trim((string)$data['name']),
                ':description' => trim((string)$data['description']),
                ':price'       => (float)$data['price'],
                ':rating'      => isset($data['rating']) ? (float)$data['rating'] : 0.0,
                ':image_path'  => $imagePath,
            ]);

            return (int)$this->db->lastInsertId();
        } catch (\PDOException $e) {
            throw new \RuntimeException(
                'Fehler beim Erstellen des Produkts: ' . $e->getMessage(),
                (int)$e->getCode(),
                $e
            );
        }
    }

    /**
     * Aktualisiert ein bestehendes Produkt.
     *
     * Erlaubte Schlüssel in $data:
     *   category_id, name, description, price, rating
     * Der $imagePath-Parameter ist optional; wird er übergeben, wird auch
     * das Bild aktualisiert.
     *
     * @param int                  $id        Produkt-ID.
     * @param array<string, mixed> $data      Felder, die aktualisiert werden sollen.
     * @param string|null          $imagePath Neuer Bildpfad (optional).
     * @return bool true bei Erfolg.
     * @throws InvalidArgumentException Wenn $data leer ist.
     * @throws RuntimeException         Bei einem Datenbankfehler.
     */
    public function updateProduct(int $id, array $data, ?string $imagePath = null): bool
    {
        if (empty($data) && $imagePath === null) {
            throw new \InvalidArgumentException('Es müssen Felder zum Aktualisieren übergeben werden.');
        }

        $allowed = ['category_id', 'name', 'description', 'price', 'rating'];
        $setClauses = [];
        $params = [':id' => $id];

        foreach ($allowed as $field) {
            if (array_key_exists($field, $data)) {
                $setClauses[] = "{$field} = :{$field}";
                $params[":{$field}"] = $data[$field];
            }
        }

        if ($imagePath !== null) {
            $setClauses[] = 'image_path = :image_path';
            $params[':image_path'] = $imagePath;
        }

        if (empty($setClauses)) {
            return false;
        }

        try {
            $sql  = 'UPDATE products SET ' . implode(', ', $setClauses) . ' WHERE id = :id';
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);

            return $stmt->rowCount() > 0;
        } catch (\PDOException $e) {
            throw new \RuntimeException(
                'Fehler beim Aktualisieren des Produkts: ' . $e->getMessage(),
                (int)$e->getCode(),
                $e
            );
        }
    }

    /**
     * Löscht ein Produkt anhand seiner ID.
     *
     * @param int $id Produkt-ID.
     * @return bool true wenn ein Datensatz gelöscht wurde.
     * @throws RuntimeException Bei einem Datenbankfehler.
     */
    public function deleteProduct(int $id): bool
    {
        try {
            $stmt = $this->db->prepare('DELETE FROM products WHERE id = :id');
            $stmt->execute([':id' => $id]);

            return $stmt->rowCount() > 0;
        } catch (\PDOException $e) {
            throw new \RuntimeException(
                'Fehler beim Löschen des Produkts: ' . $e->getMessage(),
                (int)$e->getCode(),
                $e
            );
        }
    }

    // -------------------------------------------------------------------------
    // Hilfsmethoden
    // -------------------------------------------------------------------------

    /**
     * Prüft, ob alle erforderlichen Felder in $data vorhanden und nicht leer sind.
     *
     * @param array<string, mixed> $data
     * @param string[]             $fields
     * @throws InvalidArgumentException
     */
    private function assertRequiredFields(array $data, array $fields): void
    {
        foreach ($fields as $field) {
            if (!isset($data[$field]) || (string)$data[$field] === '') {
                throw new \InvalidArgumentException(
                    "Pflichtfeld fehlt oder ist leer: \"{$field}\"."
                );
            }
        }
    }
}

