<?php
namespace App\Models;

use App\Core\Database;

class Ad
{
    public static function create(array $data): int
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO ads (created_by, title, body, image_url, link_url, starts_at, ends_at, is_active, created_at)
             VALUES (:created_by, :title, :body, :image_url, :link_url, :starts_at, :ends_at, :is_active, NOW())'
        );
        $stmt->execute([
            'created_by' => $data['created_by'],
            'title' => $data['title'],
            'body' => $data['body'] ?? null,
            'image_url' => $data['image_url'] ?? null,
            'link_url' => $data['link_url'] ?? null,
            'starts_at' => $data['starts_at'],
            'ends_at' => $data['ends_at'],
            'is_active' => !empty($data['is_active']) ? 1 : 0,
        ]);

        return (int)Database::connection()->lastInsertId();
    }

    public static function listForAdmin(int $limit = 100, int $offset = 0): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT a.*, u.username AS creator_username
             FROM ads a
             JOIN users u ON u.id = a.created_by
             ORDER BY a.created_at DESC
             LIMIT :limit OFFSET :offset'
        );
        $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public static function activeForUser(?int $userId = null): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT * FROM ads
             WHERE is_active = 1
               AND starts_at <= NOW()
               AND ends_at >= NOW()
             ORDER BY created_at DESC
             LIMIT 10'
        );
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public static function deactivate(int $id): bool
    {
        $stmt = Database::connection()->prepare('UPDATE ads SET is_active = 0 WHERE id = :id');
        return $stmt->execute(['id' => $id]);
    }
}
