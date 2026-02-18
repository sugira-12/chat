<?php
namespace App\Models;

use App\Core\Database;

class PostTag
{
    public static function tag(int $postId, int $taggedUserId, int $taggerId): bool
    {
        $stmt = Database::connection()->prepare(
            'INSERT IGNORE INTO post_tags (post_id, tagged_user_id, tagger_id, created_at)
             VALUES (:post, :tagged, :tagger, NOW())'
        );
        return $stmt->execute([
            'post' => $postId,
            'tagged' => $taggedUserId,
            'tagger' => $taggerId,
        ]);
    }

    public static function listTagged(int $userId, int $limit = 30): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT p.*, u.username, u.avatar_url,
                    (SELECT pm.url FROM post_media pm WHERE pm.post_id = p.id ORDER BY pm.sort_order ASC LIMIT 1) AS media_url,
                    (SELECT pm.media_type FROM post_media pm WHERE pm.post_id = p.id ORDER BY pm.sort_order ASC LIMIT 1) AS media_type
             FROM post_tags pt
             JOIN posts p ON p.id = pt.post_id
             JOIN users u ON u.id = p.user_id
             WHERE pt.tagged_user_id = :user
             ORDER BY pt.created_at DESC
             LIMIT :limit'
        );
        $stmt->bindValue(':user', $userId, \PDO::PARAM_INT);
        $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }
}
