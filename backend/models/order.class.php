<?php

class Order {
    private PDO $db;
    public function __construct() { $this->db = Database::getConnection(); }

    public function placeOrder(int $userId, array $items): int {
        if (empty($items)) throw new Exception('Cart empty');

        $total = 0;
        foreach ($items as $item) {
            // Handle both old (productId) and new (id) field names
            $pId = $item['id'] ?? $item['productId'] ?? 0;
            $qty = $item['q'] ?? $item['quantity'] ?? 1;
            $price = $item['pr'] ?? $item['price'] ?? 0;
            $total += $price * $qty;
        }

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare('INSERT INTO orders (user_id, total_price, status) VALUES (:uid, :price, :status)');
            $stmt->execute([':uid' => $userId, ':price' => $total, ':status' => 'pending']);
            $oid = (int)$this->db->lastInsertId();

            $istmt = $this->db->prepare('INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES (:oid, :pid, :qty, :price)');
            foreach ($items as $item) {
                $pId = $item['id'] ?? $item['productId'] ?? 0;
                $qty = $item['q'] ?? $item['quantity'] ?? 1;
                $price = $item['pr'] ?? $item['price'] ?? 0;
                $istmt->execute([':oid' => $oid, ':pid' => $pId, ':qty' => $qty, ':price' => $price]);
            }

            $this->db->commit();
            return $oid;
        } catch (Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function getUserOrders(int $userId): array {
        $stmt = $this->db->prepare('SELECT * FROM orders WHERE user_id = :uid ORDER BY created_at DESC');
        $stmt->execute([':uid' => $userId]);
        return $stmt->fetchAll();
    }

    public function getOrderDetails(int $oid, int $uid): array {
        $o = $this->db->prepare('SELECT * FROM orders WHERE id = :id AND user_id = :uid');
        $o->execute([':id' => $oid, ':uid' => $uid]);
        $order = $o->fetch();
        if (!$order) throw new Exception('Order not found');

        $i = $this->db->prepare('SELECT oi.*, p.name FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = :oid');
        $i->execute([':oid' => $oid]);
        $items = $i->fetchAll();

        return ['order' => $order, 'items' => $items];
    }
}

