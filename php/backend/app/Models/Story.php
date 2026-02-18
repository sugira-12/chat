<?php
namespace App\Models;

use App\Core\Database;

class Story
{
    public static function findById(int $storyId): ?array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM stories WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $storyId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function create(
        int $userId,
        string $mediaType,
        string $mediaUrl,
        string $expiresAt,
        ?string $caption = null
    ): int
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO stories (user_id, media_type, media_url, caption, created_at, expires_at)
             VALUES (:user_id, :media_type, :media_url, :caption, NOW(), :expires_at)'
        );
        $stmt->execute([
            'user_id' => $userId,
            'media_type' => $mediaType,
            'media_url' => $mediaUrl,
            'caption' => $caption,
            'expires_at' => $expiresAt,
        ]);
        return (int)Database::connection()->lastInsertId();
    }

    public static function activeForUser(int $userId): array
    {
        $sql = 'SELECT s.*, u.username, u.avatar_url,
                       CASE WHEN sv.viewer_id IS NULL THEN 0 ELSE 1 END AS viewed_by_me,
                       (SELECT COUNT(*) FROM story_views sv2 WHERE sv2.story_id = s.id) AS views_count,
                       (SELECT COUNT(*) FROM story_replies sr WHERE sr.story_id = s.id) AS replies_count
                FROM stories s
                JOIN users u ON u.id = s.user_id
                LEFT JOIN follows f ON f.followed_id = s.user_id AND f.follower_id = :user
                LEFT JOIN story_views sv ON sv.story_id = s.id AND sv.viewer_id = :user
                WHERE (s.user_id = :user OR f.follower_id = :user)
                  AND s.expires_at > NOW()
                ORDER BY s.created_at DESC';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute(['user' => $userId]);
        return $stmt->fetchAll();
    }

    public static function addView(int $storyId, int $viewerId): bool
    {
        $stmt = Database::connection()->prepare(
            'INSERT IGNORE INTO story_views (story_id, viewer_id, viewed_at) VALUES (:story, :viewer, NOW())'
        );
        return $stmt->execute(['story' => $storyId, 'viewer' => $viewerId]);
    }

    public static function viewers(int $storyId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT u.id, u.username, u.avatar_url, sv.viewed_at
             FROM story_views sv
             JOIN users u ON u.id = sv.viewer_id
             WHERE sv.story_id = :story
             ORDER BY sv.viewed_at DESC'
        );
        $stmt->execute(['story' => $storyId]);
        return $stmt->fetchAll();
    }

    public static function addReply(int $storyId, int $userId, string $body): bool
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO story_replies (story_id, user_id, body, created_at)
             VALUES (:story_id, :user_id, :body, NOW())'
        );
        return $stmt->execute([
            'story_id' => $storyId,
            'user_id' => $userId,
            'body' => $body,
        ]);
    }

    public static function replies(int $storyId, int $limit = 30): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT sr.*, u.username, u.avatar_url
             FROM story_replies sr
             JOIN users u ON u.id = sr.user_id
             WHERE sr.story_id = :story
             ORDER BY sr.created_at DESC
             LIMIT :limit'
        );
        $stmt->bindValue(':story', $storyId, \PDO::PARAM_INT);
        $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }
}
