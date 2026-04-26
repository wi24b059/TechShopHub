<?php

class Database
{
    private static ?PDO $connection = null;

    public static function getConnection(): PDO
    {
        if (self::$connection instanceof PDO) {
            return self::$connection;
        }

        $host = getenv('TECHSHOP_DB_HOST') ?: '127.0.0.1';
        $port = getenv('TECHSHOP_DB_PORT') ?: '3306';
        $dbName = getenv('TECHSHOP_DB_NAME') ?: 'techshophub';
        $user = getenv('TECHSHOP_DB_USER') ?: 'root';
        $password = getenv('TECHSHOP_DB_PASS') ?: '';

        $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $host, $port, $dbName);

        self::$connection = new PDO($dsn, $user, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);

        return self::$connection;
    }
}

