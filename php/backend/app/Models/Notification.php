<?php
namespace App\Models;

use App\Core\Database;

class Notification
{
    public static function create(int $userId, ?int $actorId, string $type, array $data = []): bool
    {
        $prefs = Database::connection()->prepare(
            'SELECT notify_like, notify_comment, notify_follow, notify_message, notify_friend_request
             FROM user_settings WHERE user_id = :id'
        );
        $prefs->execute(['id' => $userId]);
        $settings = $prefs->fetch();
        if ($settings) {
            $map = [
                'like' => 'notify_like',
                'comment' => 'notify_comment',
                'follow' => 'notify_follow',
                'message' => 'notify_message',
                'friend_request' => 'notify_friend_request',
            ];
            if (isset($map[$type]) && isset($settings[$map[$type]]) && (int)$settings[$map[$type]] === 0) {
                return false;
            }
        }
        $stmt = Database::connection()->prepare(
            'INSERT INTO notifications (user_id, actor_id, type, data, is_read, created_at)
             VALUES (:user_id, :actor_id, :type, :data, 0, NOW())'
        );
        return $stmt->execute([
            'user_id' => $userId,
            'actor_id' => $actorId,
            'type' => $type,
            'data' => json_encode($data),
        ]);
    }

    public static function listForUser(int $userId, int $limit = 20, int $offset = 0): array
    {
        $sql = 'SELECT n.*, u.username AS actor_username, u.avatar_url AS actor_avatar
                FROM notifications n
                LEFT JOIN users u ON u.id = n.actor_id
                WHERE n.user_id = :user
                ORDER BY n.created_at DESC
                LIMIT :limit OFFSET :offset';
        $stmt = Database::connection()->prepare($sql);
        $stmt->bindValue(':user', $userId, \PDO::PARAM_INT);
        $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public static function unreadCount(int $userId): int
    {
        $stmt = Database::connection()->prepare(
            'SELECT COUNT(*) AS c FROM notifications WHERE user_id = :user AND is_read = 0'
        );
        $stmt->execute(['user' => $userId]);
        return (int)($stmt->fetch()['c'] ?? 0);
    }

    public static function markRead(int $userId, int $notificationId): bool
    {
        $stmt = Database::connection()->prepare(
            'UPDATE notifications SET is_read = 1 WHERE id = :id AND user_id = :user'
        );
        return $stmt->execute(['id' => $notificationId, 'user' => $userId]);
    }

    public static function markAllRead(int $userId): bool
    {
        $stmt = Database::connection()->prepare(
            'UPDATE notifications SET is_read = 1 WHERE user_id = :user AND is_read = 0'
        );
        return $stmt->execute(['user' => $userId]);
    }

    public static function deleteOne(int $userId, int $notificationId): bool
    {
        $stmt = Database::connection()->prepare(
            'DELETE FROM notifications WHERE id = :id AND user_id = :user'
        );
        return $stmt->execute(['id' => $notificationId, 'user' => $userId]);
    }

    public static function deleteAll(int $userId): bool
    {
        $stmt = Database::connection()->prepare(
            'DELETE FROM notifications WHERE user_id = :user'
        );
        return $stmt->execute(['user' => $userId]);
    }
}
