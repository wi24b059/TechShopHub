<?php

require_once __DIR__ . '/../config/database.php';

class User
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function register(
        string $salutation,
        string $firstname,
        string $lastname,
        string $address,
        string $zip,
        string $city,
        string $email,
        string $username,
        string $passwordHash,
        string $payment
    ): bool {
        if ($this->emailOrUsernameExists($email, $username)) {
            return false;
        }

        $sql = 'INSERT INTO users
            (salutation, first_name, last_name, address, zip, city, email, username, password_hash, payment_info)
            VALUES (:salutation, :first_name, :last_name, :address, :zip, :city, :email, :username, :password_hash, :payment_info)';

        $stmt = $this->db->prepare($sql);

        return $stmt->execute([
            ':salutation' => $salutation,
            ':first_name' => $firstname,
            ':last_name' => $lastname,
            ':address' => $address,
            ':zip' => $zip,
            ':city' => $city,
            ':email' => $email,
            ':username' => $username,
            ':password_hash' => $passwordHash,
            ':payment_info' => $payment,
        ]);
    }

    public function getUserByUsernameOrEmail(string $identifier): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT * FROM users WHERE username = :username OR email = :email LIMIT 1'
        );
        $stmt->execute([
            ':username' => $identifier,
            ':email' => $identifier,
        ]);

        $user = $stmt->fetch();
        return $user ?: null;
    }


    private function emailOrUsernameExists(string $email, string $username): bool
    {
        $stmt = $this->db->prepare('SELECT id FROM users WHERE email = :email OR username = :username LIMIT 1');
        $stmt->execute([
            ':email' => $email,
            ':username' => $username,
        ]);

        return (bool)$stmt->fetchColumn();
    }
}

