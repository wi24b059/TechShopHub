<?php

// ============================================================
// user.class.php
// ------------------------------------------------------------
// This class handles everything related to users:
//   - Registering a new account
//   - Looking up a user for login
//
// We use PDO prepared statements for ALL database queries so
// that user input can never break our SQL (SQL injection).
// ============================================================

// Load the Database class so we can call Database::getConnection().
require_once __DIR__ . '/../config/database.php';

class User
{
    // Every method in this class needs the database.
    // We store the connection once in the constructor so we
    // don't have to fetch it inside every single method.
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    // ----------------------------------------------------------
    // Register a new user.
    //
    // Returns true  → registration successful.
    // Returns false → email or username already exists.
    // ----------------------------------------------------------
    public function register(
        string $salutation,
        string $firstname,
        string $lastname,
        string $address,
        string $zip,
        string $city,
        string $email,
        string $username,
        string $passwordHash,  // Always pass an already-hashed password!
        string $payment
    ): bool {
        // Before inserting, check if the email or username is already taken.
        if ($this->emailOrUsernameExists($email, $username)) {
            return false;
        }

        // Build the INSERT query.
        // The ":name" placeholders will be replaced safely by PDO – never concatenate
        // user input directly into a SQL string.
        $sql = '
            INSERT INTO users
                (salutation, first_name, last_name, address, zip, city, email, username, password_hash, payment_info)
            VALUES
                (:salutation, :first_name, :last_name, :address, :zip, :city, :email, :username, :password_hash, :payment_info)
        ';

        $stmt = $this->db->prepare($sql);

        // execute() sends the real values to the database driver,
        // which inserts them safely for us.
        return $stmt->execute([
            ':salutation'    => $salutation,
            ':first_name'    => $firstname,
            ':last_name'     => $lastname,
            ':address'       => $address,
            ':zip'           => $zip,
            ':city'          => $city,
            ':email'         => $email,
            ':username'      => $username,
            ':password_hash' => $passwordHash,
            ':payment_info'  => $payment,
        ]);
    }

    // ----------------------------------------------------------
    // Find a user by their username OR email address.
    // Used during login – the user can type either one.
    //
    // Returns the user row as an array, or null if not found.
    // ----------------------------------------------------------
    public function getUserByUsernameOrEmail(string $identifier): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT * FROM users WHERE username = :username OR email = :email LIMIT 1'
        );

        // We pass the same $identifier for both placeholders because
        // the user might have typed their username OR their email.
        $stmt->execute([
            ':username' => $identifier,
            ':email'    => $identifier,
        ]);

        $user = $stmt->fetch();

        // fetch() returns false if no row was found – we convert that to null
        // so callers can do a clean "if ($user !== null)" check.
        if ($user === false) {
            return null;
        }

        return $user;
    }


    //------------------------------------------------------
    // Kundenkonto
    //------------------------------------------------------

   public function getUserById(int $id): ?array
       {
         $stmt = $this->db->prepare(
               'SELECT
                   id,
                   salutation,
                   first_name,
                   last_name,
                   address,
                   zip,
                   city,
                   email,
                   username,
                   payment_info,
                   is_admin
                FROM users
                WHERE id = :id
                LIMIT 1'
           );
           $stmt->execute([
               ':id' => $id
           ]);

           $user = $stmt->fetch(PDO::FETCH_ASSOC);
           if ($user === false) {
               return null;
           }
           return $user;
       }

       public function updateUser(
           int $id,
           string $firstname,
           string $lastname,
           string $address,
           string $zip,
           string $city,
           string $payment

       ): bool {
           $stmt = $this->db->prepare(

               'UPDATE users

                SET

                   first_name = :firstname,
                   last_name = :lastname,
                   address = :address,
                   zip = :zip,
                   city = :city,
                   payment_info = :payment
                WHERE id = :id'

           );
           return $stmt->execute([

               ':firstname' => $firstname,
               ':lastname'  => $lastname,
               ':address'   => $address,
               ':zip'       => $zip,
               ':city'      => $city,
               ':payment'   => $payment,
               ':id'        => $id
           ]);
       }

       // ==========================================================
       // Admin Customer Management
       // ==========================================================
       public function getAllUsers(): array
       {
          $stmt = $this->db->query(

               'SELECT
                   id,
                   first_name,
                   last_name,
                   email,
                   username,
                   city,
                   is_admin
                FROM users
                ORDER BY last_name ASC'
           );
           return $stmt->fetchAll(PDO::FETCH_ASSOC);
     }

    // ----------------------------------------------------------
    // (Private helper) Check if an email or username is already
    // in the database.
    //
    // Returns true  → already taken.
    // Returns false → free to use.
    // ----------------------------------------------------------
    private function emailOrUsernameExists(string $email, string $username): bool
    {
        $stmt = $this->db->prepare(
            'SELECT id FROM users WHERE email = :email OR username = :username LIMIT 1'
        );

        $stmt->execute([
            ':email'    => $email,
            ':username' => $username,
        ]);

        // fetchColumn() returns the first column of the first row, or false.
        // Casting to bool turns a found ID into true and false into false.
        $found = $stmt->fetchColumn();

        return $found !== false;
    }
}

