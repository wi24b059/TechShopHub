<?php

class Order {
    private PDO $db;
    public function __construct() { $this->db = Database::getConnection(); }

    public function placeOrder(int $userId, array $items, string $paymentMethod = '', string $couponCode = ''): int {
        if (empty($items)) throw new Exception('Cart empty');
        if ($paymentMethod === '') throw new Exception('Payment missing');
        if ($paymentMethod === 'Gutschein' && trim($couponCode) === '') throw new Exception('Coupon missing');

        $total = 0;
        foreach ($items as $item) {
            $qty = $item['q'] ?? $item['quantity'] ?? 1;
            $price = $item['pr'] ?? $item['price'] ?? 0;
            $total += $price * $qty;
        }

        $discount = 0;
        $couponCode = strtoupper(trim($couponCode));

        $this->db->beginTransaction();
        try {
            if ($couponCode !== '') {
                $c = $this->db->prepare('SELECT * FROM coupons WHERE code = :code FOR UPDATE');
                $c->execute([':code' => $couponCode]);
                $coupon = $c->fetch();
                if (!$coupon || (float)$coupon['balance'] <= 0) throw new Exception('Invalid coupon');
                $discount = min((float)$coupon['balance'], $total);
                $newBalance = (float)$coupon['balance'] - $discount;
                $u = $this->db->prepare('UPDATE coupons SET balance = :balance WHERE code = :code');
                $u->execute([':balance' => $newBalance, ':code' => $couponCode]);
            }

            $stmt = $this->db->prepare('INSERT INTO orders (user_id, total_price, status) VALUES (:uid, :price, :status)');
            $stmt->execute([
                ':uid' => $userId,
                ':price' => max(0, $total - $discount),
                ':status' => 'pending'
            ]);
            $oid = (int)$this->db->lastInsertId();

            $pay = $this->db->prepare('
                INSERT INTO order_payments (order_id, payment_method, coupon_code, discount)
                VALUES (:oid, :payment, :coupon, :discount)
            ');
            $pay->execute([
                ':oid' => $oid,
                ':payment' => $paymentMethod,
                ':coupon' => $couponCode,
                ':discount' => $discount
            ]);

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
        $stmt = $this->db->prepare('
            SELECT o.*, op.payment_method, op.coupon_code, op.discount
            FROM orders o
            LEFT JOIN order_payments op ON op.order_id = o.id
            WHERE o.user_id = :uid
            ORDER BY o.created_at DESC
        ');
        $stmt->execute([':uid' => $userId]);
        return $stmt->fetchAll();
    }

    public function getOrderDetails(int $oid, int $uid): array {
        $o = $this->db->prepare('
            SELECT o.*, op.payment_method, op.coupon_code, op.discount
            FROM orders o
            LEFT JOIN order_payments op ON op.order_id = o.id
            WHERE o.id = :id AND o.user_id = :uid
        ');
        $o->execute([':id' => $oid, ':uid' => $uid]);
        $order = $o->fetch();
        if (!$order) throw new Exception('Order not found');

        $i = $this->db->prepare('SELECT oi.*, p.name FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = :oid');
        $i->execute([':oid' => $oid]);
        $items = $i->fetchAll();

        return ['order' => $order, 'items' => $items];
    }

    public function getOrdersByUserAdmin(int $userId): array {
        $stmt = $this->db->prepare('
            SELECT o.*, op.payment_method, op.coupon_code, op.discount
            FROM orders o
            LEFT JOIN order_payments op ON op.order_id = o.id
            WHERE o.user_id = :uid
            ORDER BY o.created_at DESC
        ');
        $stmt->execute([':uid' => $userId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getOrderDetailsAdmin(int $orderId): array {
        $o = $this->db->prepare('
            SELECT o.*, op.payment_method, op.coupon_code, op.discount
            FROM orders o
            LEFT JOIN order_payments op ON op.order_id = o.id
            WHERE o.id = :id
            LIMIT 1
        ');
        $o->execute([':id' => $orderId]);
        $order = $o->fetch(PDO::FETCH_ASSOC);
        if (!$order) throw new Exception('Order not found');

        $i = $this->db->prepare('
            SELECT oi.*, p.name
            FROM order_items oi
            JOIN products p ON p.id = oi.product_id
            WHERE oi.order_id = :oid
            ORDER BY oi.id ASC
        ');
        $i->execute([':oid' => $orderId]);
        $items = $i->fetchAll(PDO::FETCH_ASSOC);

        return ['order' => $order, 'items' => $items];
    }

    public function removeOrderItemAdmin(int $orderId, int $orderItemId): array {
        $this->db->beginTransaction();

        try {
            $itemStmt = $this->db->prepare('
                SELECT id
                FROM order_items
                WHERE id = :item_id AND order_id = :order_id
                LIMIT 1
            ');
            $itemStmt->execute([
                ':item_id' => $orderItemId,
                ':order_id' => $orderId,
            ]);

            if (!$itemStmt->fetch(PDO::FETCH_ASSOC)) {
                throw new Exception('Order item not found');
            }

            $deleteStmt = $this->db->prepare(
                'DELETE FROM order_items WHERE id = :item_id AND order_id = :order_id'
            );
            $deleteStmt->execute([
                ':item_id' => $orderItemId,
                ':order_id' => $orderId,
            ]);

            $sumStmt = $this->db->prepare('
                SELECT COALESCE(SUM(quantity * price_at_purchase), 0) AS subtotal
                FROM order_items
                WHERE order_id = :order_id
            ');
            $sumStmt->execute([':order_id' => $orderId]);
            $subtotal = (float) ($sumStmt->fetchColumn() ?: 0);

            $discountStmt = $this->db->prepare(
                'SELECT discount FROM order_payments WHERE order_id = :order_id LIMIT 1'
            );
            $discountStmt->execute([':order_id' => $orderId]);
            $discount = (float) ($discountStmt->fetchColumn() ?: 0);
            $appliedDiscount = min($discount, $subtotal);

            $updateDiscount = $this->db->prepare(
                'UPDATE order_payments SET discount = :discount WHERE order_id = :order_id'
            );
            $updateDiscount->execute([
                ':discount' => $appliedDiscount,
                ':order_id' => $orderId,
            ]);

            $newTotal = max(0, $subtotal - $appliedDiscount);
            $updateOrder = $this->db->prepare(
                'UPDATE orders SET total_price = :total WHERE id = :order_id'
            );
            $updateOrder->execute([
                ':total' => $newTotal,
                ':order_id' => $orderId,
            ]);

            $this->db->commit();

            return [
                'order_id' => $orderId,
                'total_price' => $newTotal,
            ];
        } catch (Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }
}

