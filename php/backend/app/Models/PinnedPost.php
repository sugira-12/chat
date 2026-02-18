<?php
namespace App\Models;

use App\Core\Database;

class PinnedPost
{
    public static function listByUser(int $userId, int $limit = 3): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT p.*, u.username, u.avatar_url,
                    (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS likes_count,
                    (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) AS comments_count,
                    (SELECT pm.url FROM post_media pm WHERE pm.post_id = p.id ORDER BY pm.sort_order ASC LIMIT 1) AS media_url,
                    (SELECT pm.media_type FROM post_media pm WHERE pm.post_id = p.id ORDER BY pm.sort_order ASC LIMIT 1) AS media_type
             FROM pinned_posts pp
             JOIN posts p ON p.id = pp.post_id
             JOIN users u ON u.id = p.user_id
             WHERE pp.user_id = :user
             ORDER BY pp.created_at DESC
             LIMIT :limit'
        );
        $stmt->bindValue(':user', $userId, \PDO::PARAM_INT);
        $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public static function pin(int $userId, int $postId): bool
    {
        $stmt = Database::connection()->prepare(
            'INSERT IGNORE INTO pinned_posts (user_id, post_id, created_at) VALUES (:user, :post, NOW())'
        );
        return $stmt->execute(['user' => $userId, 'post' => $postId]);
    }

    public static function unpin(int $userId, int $postId): bool
    {
        $stmt = Database::connection()->prepare(
            'DELETE FROM pinned_posts WHERE user_id = :user AND post_id = :post'
        );
        return $stmt->execute(['user' => $userId, 'post' => $postId]);
    }
}
