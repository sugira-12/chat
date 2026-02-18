<?php
namespace App\Models;

use App\Core\Database;

class AdminAlert
{
    public static function createForAllAdmins(string $title, string $body = '', array $data = []): void
    {
        $admins = Database::connection()->query('SELECT id FROM users WHERE role = "admin"')->fetchAll();
        if (!$admins) {
            return;
        }

        $stmt = Database::connection()->prepare(
            'INSERT INTO admin_alerts (admin_user_id, title, body, data, is_read, created_at)
             VALUES (:admin_user_id, :title, :body, :data, 0, NOW())'
        );

        foreach ($admins as $admin) {
            $stmt->execute([
                'admin_user_id' => $admin['id'],
                'title' => $title,
                'body' => $body,
                'data' => json_encode($data),
            ]);
        }
    }

    public static function listForAdmin(int $adminUserId, int $limit = 50, int $offset = 0): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT * FROM admin_alerts WHERE admin_user_id = :admin
             ORDER BY created_at DESC
             LIMIT :limit OFFSET :offset'
        );
        $stmt->bindValue(':admin', $adminUserId, \PDO::PARAM_INT);
        $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public static function markRead(int $adminUserId, int $id): bool
    {
        $stmt = Database::connection()->prepare(
            'UPDATE admin_alerts SET is_read = 1 WHERE id = :id AND admin_user_id = :admin'
        );
        return $stmt->execute(['id' => $id, 'admin' => $adminUserId]);
    }

    public static function markAllRead(int $adminUserId): bool
    {
        $stmt = Database::connection()->prepare(
            'UPDATE admin_alerts SET is_read = 1 WHERE admin_user_id = :admin AND is_read = 0'
        );
        return $stmt->execute(['admin' => $adminUserId]);
    }

    public static function deleteOne(int $adminUserId, int $id): bool
    {
        $stmt = Database::connection()->prepare(
            'DELETE FROM admin_alerts WHERE id = :id AND admin_user_id = :admin'
        );
        return $stmt->execute(['id' => $id, 'admin' => $adminUserId]);
    }
}
