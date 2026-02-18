<?php
namespace App\Models;

use App\Core\Database;

class Page
{
    public static function listByUser(int $userId, int $limit = 6): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT p.*
             FROM page_followers pf
             JOIN pages p ON p.id = pf.page_id
             WHERE pf.user_id = :user
             ORDER BY p.created_at DESC
             LIMIT :limit'
        );
        $stmt->bindValue(':user', $userId, \PDO::PARAM_INT);
        $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public static function create(int $ownerId, string $name, ?string $category = null, ?string $description = null, ?string $coverUrl = null): int
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO pages (owner_id, name, category, description, cover_url, created_at)
             VALUES (:owner, :name, :category, :description, :cover, NOW())'
        );
        $stmt->execute([
            'owner' => $ownerId,
            'name' => $name,
            'category' => $category,
            'description' => $description,
            'cover' => $coverUrl,
        ]);
        $pageId = (int)Database::connection()->lastInsertId();
        Database::connection()->prepare(
            'INSERT IGNORE INTO page_followers (page_id, user_id, followed_at)
             VALUES (:page_id, :user_id, NOW())'
        )->execute(['page_id' => $pageId, 'user_id' => $ownerId]);
        return $pageId;
    }
}
