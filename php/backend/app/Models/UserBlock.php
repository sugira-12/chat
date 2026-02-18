<?php
namespace App\Models;

use App\Core\Database;

class UserBlock
{
    public static function block(int $blockerId, int $blockedId): bool
    {
        $stmt = Database::connection()->prepare(
            'INSERT IGNORE INTO user_blocks (blocker_id, blocked_id, created_at)
             VALUES (:blocker, :blocked, NOW())'
        );
        return $stmt->execute(['blocker' => $blockerId, 'blocked' => $blockedId]);
    }

    public static function unblock(int $blockerId, int $blockedId): bool
    {
        $stmt = Database::connection()->prepare(
            'DELETE FROM user_blocks WHERE blocker_id = :blocker AND blocked_id = :blocked'
        );
        return $stmt->execute(['blocker' => $blockerId, 'blocked' => $blockedId]);
    }

    public static function isBlocked(int $blockerId, int $blockedId): bool
    {
        $stmt = Database::connection()->prepare(
            'SELECT 1 FROM user_blocks WHERE blocker_id = :blocker AND blocked_id = :blocked LIMIT 1'
        );
        $stmt->execute(['blocker' => $blockerId, 'blocked' => $blockedId]);
        return (bool)$stmt->fetch();
    }

    public static function listBlocked(int $blockerId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT u.id, u.username, u.name, u.avatar_url
             FROM user_blocks ub
             JOIN users u ON u.id = ub.blocked_id
             WHERE ub.blocker_id = :blocker
             ORDER BY u.name ASC'
        );
        $stmt->execute(['blocker' => $blockerId]);
        return $stmt->fetchAll();
    }
}
