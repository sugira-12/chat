<?php
namespace App\Models;

use App\Core\Database;

class Album
{
    public static function findById(int $albumId): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT * FROM albums WHERE id = :id LIMIT 1'
        );
        $stmt->execute(['id' => $albumId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function belongsTo(int $albumId, int $userId): bool
    {
        $stmt = Database::connection()->prepare(
            'SELECT id FROM albums WHERE id = :id AND user_id = :user LIMIT 1'
        );
        $stmt->execute(['id' => $albumId, 'user' => $userId]);
        return (bool)$stmt->fetch();
    }

    public static function listByUser(int $userId, int $limit = 8): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT a.*,
                    (SELECT COUNT(*) FROM album_items i WHERE i.album_id = a.id) AS items_count
             FROM albums a
             WHERE a.user_id = :user
             ORDER BY a.created_at DESC
             LIMIT :limit'
        );
        $stmt->bindValue(':user', $userId, \PDO::PARAM_INT);
        $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public static function listItems(int $albumId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT * FROM album_items WHERE album_id = :id ORDER BY sort_order ASC, created_at DESC'
        );
        $stmt->execute(['id' => $albumId]);
        return $stmt->fetchAll();
    }

    public static function create(int $userId, string $title, ?string $description = null, ?string $coverUrl = null): int
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO albums (user_id, title, description, cover_url, created_at, updated_at)
             VALUES (:user, :title, :description, :cover, NOW(), NOW())'
        );
        $stmt->execute([
            'user' => $userId,
            'title' => $title,
            'description' => $description,
            'cover' => $coverUrl,
        ]);
        return (int)Database::connection()->lastInsertId();
    }

    public static function delete(int $albumId, int $userId): bool
    {
        $stmt = Database::connection()->prepare(
            'DELETE FROM albums WHERE id = :id AND user_id = :user'
        );
        return $stmt->execute(['id' => $albumId, 'user' => $userId]);
    }

    public static function addItem(int $albumId, array $data): int
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO album_items
                (album_id, post_media_id, media_type, media_url, caption, sort_order, created_at)
             VALUES
                (:album, :post_media_id, :media_type, :media_url, :caption, :sort_order, NOW())'
        );
        $stmt->execute([
            'album' => $albumId,
            'post_media_id' => $data['post_media_id'] ?? null,
            'media_type' => $data['media_type'],
            'media_url' => $data['media_url'],
            'caption' => $data['caption'] ?? null,
            'sort_order' => $data['sort_order'] ?? 0,
        ]);
        return (int)Database::connection()->lastInsertId();
    }

    public static function deleteItem(int $itemId, int $userId): bool
    {
        $stmt = Database::connection()->prepare(
            'DELETE i FROM album_items i
             JOIN albums a ON a.id = i.album_id
             WHERE i.id = :id AND a.user_id = :user'
        );
        return $stmt->execute(['id' => $itemId, 'user' => $userId]);
    }
}
