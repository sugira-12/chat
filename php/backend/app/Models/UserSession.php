<?php
namespace App\Models;

use App\Core\Database;

class UserSession
{
    public static function recordLogin(int $userId, string $sessionId, ?string $ip, ?string $agent): void
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO user_sessions (user_id, session_id, ip_address, user_agent, last_seen_at, created_at, is_active)
             VALUES (:user_id, :session_id, :ip, :agent, NOW(), NOW(), 1)
             ON DUPLICATE KEY UPDATE last_seen_at = NOW(), is_active = 1'
        );
        $stmt->execute([
            'user_id' => $userId,
            'session_id' => $sessionId,
            'ip' => $ip,
            'agent' => $agent,
        ]);
    }

    public static function touch(int $userId, string $sessionId): void
    {
        $stmt = Database::connection()->prepare(
            'UPDATE user_sessions SET last_seen_at = NOW() WHERE user_id = :user_id AND session_id = :session_id'
        );
        $stmt->execute([
            'user_id' => $userId,
            'session_id' => $sessionId,
        ]);
    }

    public static function recordLogout(int $userId, string $sessionId): void
    {
        $stmt = Database::connection()->prepare(
            'UPDATE user_sessions SET is_active = 0, last_seen_at = NOW()
             WHERE user_id = :user_id AND session_id = :session_id'
        );
        $stmt->execute([
            'user_id' => $userId,
            'session_id' => $sessionId,
        ]);
    }

    public static function listForUser(int $userId, int $limit = 20): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT id, session_id, ip_address, user_agent, last_seen_at, created_at, is_active
             FROM user_sessions
             WHERE user_id = :user
             ORDER BY last_seen_at DESC
             LIMIT :limit'
        );
        $stmt->bindValue(':user', $userId, \PDO::PARAM_INT);
        $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public static function revoke(int $userId, int $sessionRecordId): bool
    {
        $stmt = Database::connection()->prepare(
            'UPDATE user_sessions SET is_active = 0 WHERE id = :id AND user_id = :user'
        );
        return $stmt->execute(['id' => $sessionRecordId, 'user' => $userId]);
    }
}
