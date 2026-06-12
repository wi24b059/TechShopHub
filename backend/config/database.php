<?php

// ============================================================
// database.php
// ------------------------------------------------------------
// This file provides a single shared database connection.
//
// Instead of opening a new connection every time we need the
// database, we open it ONCE and reuse it everywhere.
// This pattern is called a "Singleton".
// ============================================================

class Database
{
    // We store the connection here after the first use.
    // "static" means the value belongs to the class itself,
    // not to any single object instance.
    // "?PDO" means it can be null (no connection yet) or a PDO object.
    private static ?PDO $connection = null;

    // Call Database::getConnection() anywhere in the project
    // to get the database connection.
    public static function getConnection(): PDO
    {
        // If we already have a connection, just return it – no need to open a new one.
        if (self::$connection instanceof PDO) {
            return self::$connection;
        }

        // Read config from environment variables.
        // If a variable is not set, we fall back to a sensible local default.
        $host     = getenv('TECHSHOP_DB_HOST') ?: 'localhost';
        $port     = getenv('TECHSHOP_DB_PORT') ?: '3306';
        $dbName   = getenv('TECHSHOP_DB_NAME') ?: 'techshophub';
        $user     = getenv('TECHSHOP_DB_USER') ?: 'root';
        $password = getenv('TECHSHOP_DB_PASS') ?: 'root';

        // The DSN (Data Source Name) tells PDO how to reach the database.
        $dsn = "mysql:host=$host;port=$port;dbname=$dbName;charset=utf8mb4";

        // Open the connection with these three options:
        //   ERRMODE_EXCEPTION  → throw an exception on any SQL error (easy to catch)
        //   FETCH_ASSOC        → return rows as ["column" => "value"] arrays
        //   EMULATE_PREPARES   → use real prepared statements for security
        self::$connection = new PDO($dsn, $user, $password, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);

        return self::$connection;
    }
}

