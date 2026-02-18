<?php
namespace App\Models;

use App\Core\Database;

class MessageRequest
{
    public static function findById(int $id): ?array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM message_requests WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function findByConversation(int $conversationId): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT * FROM message_requests WHERE conversation_id = :conversation_id LIMIT 1'
        );
        $stmt->execute(['conversation_id' => $conversationId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function findBetween(int $userA, int $userB): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT * FROM message_requests
             WHERE (requester_id = :a AND recipient_id = :b)
                OR (requester_id = :b AND recipient_id = :a)
             ORDER BY id DESC
             LIMIT 1'
        );
        $stmt->execute(['a' => $userA, 'b' => $userB]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function create(int $conversationId, int $requesterId, int $recipientId): int
    {
        $existing = self::findBetween($requesterId, $recipientId);
        if ($existing) {
            return (int)$existing['id'];
        }

        $stmt = Database::connection()->prepare(
            'INSERT INTO message_requests (conversation_id, requester_id, recipient_id, status, created_at)
             VALUES (:conversation_id, :requester_id, :recipient_id, "pending", NOW())'
        );
        $stmt->execute([
            'conversation_id' => $conversationId,
            'requester_id' => $requesterId,
            'recipient_id' => $recipientId,
        ]);
        return (int)Database::connection()->lastInsertId();
    }

    public static function updateStatus(int $requestId, int $recipientId, string $status): bool
    {
        $stmt = Database::connection()->prepare(
            'UPDATE message_requests
             SET status = :status, responded_at = NOW()
             WHERE id = :id AND recipient_id = :recipient'
        );
        return $stmt->execute([
            'status' => $status,
            'id' => $requestId,
            'recipient' => $recipientId,
        ]);
    }

    public static function listIncoming(int $userId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT mr.*, u.username, u.name, u.avatar_url,
                    c.id AS conversation_id,
                    (SELECT m.body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
                    (SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_at
             FROM message_requests mr
             JOIN users u ON u.id = mr.requester_id
             JOIN conversations c ON c.id = mr.conversation_id
             WHERE mr.recipient_id = :user AND mr.status = "pending"
             ORDER BY mr.created_at DESC'
        );
        $stmt->execute(['user' => $userId]);
        return $stmt->fetchAll();
    }

    public static function listSent(int $userId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT mr.*, u.username, u.name, u.avatar_url, c.id AS conversation_id
             FROM message_requests mr
             JOIN users u ON u.id = mr.recipient_id
             JOIN conversations c ON c.id = mr.conversation_id
             WHERE mr.requester_id = :user AND mr.status = "pending"
             ORDER BY mr.created_at DESC'
        );
        $stmt->execute(['user' => $userId]);
        return $stmt->fetchAll();
    }

    public static function isAcceptedForPair(int $userA, int $userB): bool
    {
        $request = self::findBetween($userA, $userB);
        return $request && ($request['status'] ?? '') === 'accepted';
    }
}
