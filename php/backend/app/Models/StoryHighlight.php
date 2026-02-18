<?php
namespace App\Models;

use App\Core\Database;

class StoryHighlight
{
    public static function findById(int $highlightId): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT * FROM story_highlights WHERE id = :id LIMIT 1'
        );
        $stmt->execute(['id' => $highlightId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function belongsTo(int $highlightId, int $userId): bool
    {
        $stmt = Database::connection()->prepare(
            'SELECT id FROM story_highlights WHERE id = :id AND user_id = :user LIMIT 1'
        );
        $stmt->execute(['id' => $highlightId, 'user' => $userId]);
        return (bool)$stmt->fetch();
    }

    public static function listByUser(int $userId, int $limit = 8): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT h.*,
                    (SELECT COUNT(*) FROM story_highlight_items i WHERE i.highlight_id = h.id) AS items_count
             FROM story_highlights h
             WHERE h.user_id = :user
             ORDER BY h.created_at DESC
             LIMIT :limit'
        );
        $stmt->bindValue(':user', $userId, \PDO::PARAM_INT);
        $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public static function listItems(int $highlightId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT * FROM story_highlight_items
             WHERE highlight_id = :id
             ORDER BY sort_order ASC, created_at DESC'
        );
        $stmt->execute(['id' => $highlightId]);
        return $stmt->fetchAll();
    }

    public static function create(int $userId, string $title, ?string $coverUrl = null): int
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO story_highlights (user_id, title, cover_url, created_at)
             VALUES (:user, :title, :cover, NOW())'
        );
        $stmt->execute([
            'user' => $userId,
            'title' => $title,
            'cover' => $coverUrl,
        ]);
        return (int)Database::connection()->lastInsertId();
    }

    public static function delete(int $highlightId, int $userId): bool
    {
        $stmt = Database::connection()->prepare(
            'DELETE FROM story_highlights WHERE id = :id AND user_id = :user'
        );
        return $stmt->execute(['id' => $highlightId, 'user' => $userId]);
    }

    public static function addItem(int $highlightId, array $data): int
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO story_highlight_items
                (highlight_id, story_id, media_type, media_url, caption, sort_order, created_at)
             VALUES
                (:highlight, :story_id, :media_type, :media_url, :caption, :sort_order, NOW())'
        );
        $stmt->execute([
            'highlight' => $highlightId,
            'story_id' => $data['story_id'] ?? null,
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
            'DELETE i FROM story_highlight_items i
             JOIN story_highlights h ON h.id = i.highlight_id
             WHERE i.id = :id AND h.user_id = :user'
        );
        return $stmt->execute(['id' => $itemId, 'user' => $userId]);
    }
}
