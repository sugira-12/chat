<?php
namespace App\Models;

use App\Core\Database;

class Post
{
    public static function findById(int $id): ?array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM posts WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $post = $stmt->fetch();
        return $post ?: null;
    }

    public static function create(array $data): int
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO posts (user_id, body, visibility, created_at, updated_at)
             VALUES (:user_id, :body, :visibility, NOW(), NOW())'
        );
        $stmt->execute($data);
        return (int)Database::connection()->lastInsertId();
    }

    public static function addMedia(int $postId, string $mediaType, string $url, ?string $thumbUrl = null): bool
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO post_media (post_id, media_type, url, thumb_url, sort_order)
             VALUES (:post_id, :media_type, :url, :thumb_url, 0)'
        );
        return $stmt->execute([
            'post_id' => $postId,
            'media_type' => $mediaType,
            'url' => $url,
            'thumb_url' => $thumbUrl,
        ]);
    }

    public static function feed(int $userId, int $limit = 20, int $offset = 0): array
    {
        $sql = 'SELECT p.*, u.username, u.avatar_url,
                       (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS likes_count,
                       (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) AS comments_count,
                       (SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = :user LIMIT 1) AS liked_by_me,
                       (SELECT pm.url FROM post_media pm WHERE pm.post_id = p.id ORDER BY pm.sort_order ASC LIMIT 1) AS media_url,
                       (SELECT pm.media_type FROM post_media pm WHERE pm.post_id = p.id ORDER BY pm.sort_order ASC LIMIT 1) AS media_type
                FROM posts p
                JOIN users u ON u.id = p.user_id
                LEFT JOIN follows f ON f.followed_id = p.user_id AND f.follower_id = :user
                WHERE p.user_id = :user
                   OR f.follower_id = :user
                   OR p.visibility = "public"
                ORDER BY (CASE WHEN p.user_id = :user OR f.follower_id = :user THEN 0 ELSE 1 END), p.created_at DESC
                LIMIT :limit OFFSET :offset';
        $stmt = Database::connection()->prepare($sql);
        $stmt->bindValue(':user', $userId, \PDO::PARAM_INT);
        $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public static function byUser(int $userId, int $limit = 20, int $offset = 0): array
    {
        $sql = 'SELECT p.*, u.username, u.avatar_url,
                       (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS likes_count,
                       (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) AS comments_count,
                       (SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = :viewer LIMIT 1) AS liked_by_me,
                       (SELECT pm.url FROM post_media pm WHERE pm.post_id = p.id ORDER BY pm.sort_order ASC LIMIT 1) AS media_url,
                       (SELECT pm.media_type FROM post_media pm WHERE pm.post_id = p.id ORDER BY pm.sort_order ASC LIMIT 1) AS media_type
                FROM posts p
                JOIN users u ON u.id = p.user_id
                WHERE p.user_id = :user
                ORDER BY p.created_at DESC
                LIMIT :limit OFFSET :offset';
        $stmt = Database::connection()->prepare($sql);
        $stmt->bindValue(':viewer', $userId, \PDO::PARAM_INT);
        $stmt->bindValue(':user', $userId, \PDO::PARAM_INT);
        $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public static function byUserFiltered(int $userId, ?string $mediaType, int $limit = 20, int $offset = 0): array
    {
        if ($mediaType !== 'image' && $mediaType !== 'video') {
            return self::byUser($userId, $limit, $offset);
        }
        $sql = 'SELECT p.*, u.username, u.avatar_url,
                       (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS likes_count,
                       (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) AS comments_count,
                       (SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = :viewer LIMIT 1) AS liked_by_me,
                       (SELECT pm.url FROM post_media pm WHERE pm.post_id = p.id AND pm.media_type = :media_type ORDER BY pm.sort_order ASC LIMIT 1) AS media_url,
                       (SELECT pm.media_type FROM post_media pm WHERE pm.post_id = p.id AND pm.media_type = :media_type ORDER BY pm.sort_order ASC LIMIT 1) AS media_type
                FROM posts p
                JOIN users u ON u.id = p.user_id
                WHERE p.user_id = :user
                  AND EXISTS (
                    SELECT 1 FROM post_media pm
                    WHERE pm.post_id = p.id AND pm.media_type = :media_type
                  )
                ORDER BY p.created_at DESC
                LIMIT :limit OFFSET :offset';
        $stmt = Database::connection()->prepare($sql);
        $stmt->bindValue(':viewer', $userId, \PDO::PARAM_INT);
        $stmt->bindValue(':user', $userId, \PDO::PARAM_INT);
        $stmt->bindValue(':media_type', $mediaType);
        $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public static function search(string $term, int $limit = 10): array
    {
        $term = '%' . $term . '%';
        $stmt = Database::connection()->prepare(
            'SELECT p.*, u.username, u.avatar_url,
                    (SELECT pm.url FROM post_media pm WHERE pm.post_id = p.id ORDER BY pm.sort_order ASC LIMIT 1) AS media_url
             FROM posts p
             JOIN users u ON u.id = p.user_id
             WHERE p.body LIKE :term
             ORDER BY p.created_at DESC
             LIMIT :limit'
        );
        $stmt->bindValue(':term', $term);
        $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public static function like(int $userId, int $postId): bool
    {
        $stmt = Database::connection()->prepare(
            'INSERT IGNORE INTO post_likes (user_id, post_id, created_at) VALUES (:user, :post, NOW())'
        );
        return $stmt->execute(['user' => $userId, 'post' => $postId]);
    }

    public static function unlike(int $userId, int $postId): bool
    {
        $stmt = Database::connection()->prepare(
            'DELETE FROM post_likes WHERE user_id = :user AND post_id = :post'
        );
        return $stmt->execute(['user' => $userId, 'post' => $postId]);
    }

    public static function comment(int $userId, int $postId, string $body, ?int $parentId = null): bool
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO post_comments (post_id, user_id, parent_id, body, created_at, updated_at)
             VALUES (:post, :user, :parent, :body, NOW(), NOW())'
        );
        return $stmt->execute([
            'post' => $postId,
            'user' => $userId,
            'parent' => $parentId,
            'body' => $body,
        ]);
    }

    public static function comments(int $postId, int $limit = 30): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT pc.*, u.username, u.avatar_url
             FROM post_comments pc
             JOIN users u ON u.id = pc.user_id
             WHERE pc.post_id = :post_id AND pc.deleted_at IS NULL
             ORDER BY pc.created_at ASC
             LIMIT :limit'
        );
        $stmt->bindValue(':post_id', $postId, \PDO::PARAM_INT);
        $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public static function share(int $userId, int $postId, ?string $text): bool
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO post_shares (user_id, post_id, share_text, created_at)
             VALUES (:user, :post, :text, NOW())'
        );
        return $stmt->execute(['user' => $userId, 'post' => $postId, 'text' => $text]);
    }

    public static function bookmark(int $userId, int $postId): bool
    {
        $stmt = Database::connection()->prepare(
            'INSERT IGNORE INTO post_bookmarks (user_id, post_id, created_at) VALUES (:user, :post, NOW())'
        );
        return $stmt->execute(['user' => $userId, 'post' => $postId]);
    }
}
