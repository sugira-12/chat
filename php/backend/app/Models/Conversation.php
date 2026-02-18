<?php
namespace App\Models;

use App\Core\Database;

class Conversation
{
    public static function findById(int $id): ?array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM conversations WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }
    public static function createDirect(int $userA, int $userB): int
    {
        $stmt = Database::connection()->prepare(
            'SELECT c.id FROM conversations c
             JOIN conversation_participants p1 ON p1.conversation_id = c.id AND p1.user_id = :u1
             JOIN conversation_participants p2 ON p2.conversation_id = c.id AND p2.user_id = :u2
             WHERE c.type = "direct" LIMIT 1'
        );
        $stmt->execute(['u1' => $userA, 'u2' => $userB]);
        $row = $stmt->fetch();
        if ($row) {
            return (int)$row['id'];
        }

        $insert = Database::connection()->prepare(
            'INSERT INTO conversations (type, created_by, created_at) VALUES ("direct", :user, NOW())'
        );
        $insert->execute(['user' => $userA]);
        $conversationId = (int)Database::connection()->lastInsertId();

        $participants = Database::connection()->prepare(
            'INSERT INTO conversation_participants (conversation_id, user_id, role, joined_at)
             VALUES (:cid, :u1, "member", NOW()), (:cid, :u2, "member", NOW())'
        );
        $participants->execute(['cid' => $conversationId, 'u1' => $userA, 'u2' => $userB]);

        return $conversationId;
    }

    public static function createGroup(string $title, int $creatorId, array $participantIds): int
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO conversations (type, title, created_by, created_at) VALUES ("group", :title, :user, NOW())'
        );
        $stmt->execute(['title' => $title, 'user' => $creatorId]);
        $conversationId = (int)Database::connection()->lastInsertId();

        $participantIds = array_unique(array_merge($participantIds, [$creatorId]));
        $values = [];
        $params = ['cid' => $conversationId];
        $i = 0;
        foreach ($participantIds as $id) {
            $key = 'u' . $i++;
            $values[] = '(:cid, :' . $key . ', "member", NOW())';
            $params[$key] = $id;
        }
        $sql = 'INSERT INTO conversation_participants (conversation_id, user_id, role, joined_at) VALUES ' . implode(', ', $values);
        Database::connection()->prepare($sql)->execute($params);

        return $conversationId;
    }

    public static function listForUser(int $userId): array
    {
        $sql = 'SELECT c.*, cp.last_read_message_id, cp.pinned_at, cp.muted_until,
                       u.username AS direct_username,
                       u.avatar_url AS direct_avatar,
                       u.created_at AS direct_created_at,
                       (SELECT m.id FROM messages m WHERE m.conversation_id = c.id AND m.status = "sent" ORDER BY m.created_at DESC LIMIT 1) AS last_message_id,
                       (SELECT m.body FROM messages m WHERE m.conversation_id = c.id AND m.status = "sent" ORDER BY m.created_at DESC LIMIT 1) AS last_message,
                       (SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id AND m.status = "sent" ORDER BY m.created_at DESC LIMIT 1) AS last_message_at,
                       (SELECT COUNT(*) FROM messages m
                         WHERE m.conversation_id = c.id
                           AND m.status = "sent"
                           AND m.id > IFNULL(cp.last_read_message_id, 0)
                           AND m.sender_id <> :user) AS unread_count
                FROM conversations c
                JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = :user
                LEFT JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id <> :user AND c.type = "direct"
                LEFT JOIN users u ON u.id = cp2.user_id
                ORDER BY (CASE WHEN cp.pinned_at IS NULL THEN 1 ELSE 0 END), cp.pinned_at DESC,
                         (CASE WHEN unread_count > 0 THEN 0 ELSE 1 END),
                         COALESCE(last_message_at, c.created_at) DESC';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute(['user' => $userId]);
        return $stmt->fetchAll();
    }

    public static function pin(int $conversationId, int $userId): bool
    {
        $stmt = Database::connection()->prepare(
            'UPDATE conversation_participants SET pinned_at = NOW()
             WHERE conversation_id = :cid AND user_id = :uid'
        );
        return $stmt->execute(['cid' => $conversationId, 'uid' => $userId]);
    }

    public static function unpin(int $conversationId, int $userId): bool
    {
        $stmt = Database::connection()->prepare(
            'UPDATE conversation_participants SET pinned_at = NULL
             WHERE conversation_id = :cid AND user_id = :uid'
        );
        return $stmt->execute(['cid' => $conversationId, 'uid' => $userId]);
    }

    public static function mute(int $conversationId, int $userId, int $minutes): bool
    {
        $stmt = Database::connection()->prepare(
            'UPDATE conversation_participants
             SET muted_until = DATE_ADD(NOW(), INTERVAL :mins MINUTE)
             WHERE conversation_id = :cid AND user_id = :uid'
        );
        $stmt->bindValue(':mins', $minutes, \PDO::PARAM_INT);
        $stmt->bindValue(':cid', $conversationId, \PDO::PARAM_INT);
        $stmt->bindValue(':uid', $userId, \PDO::PARAM_INT);
        return $stmt->execute();
    }

    public static function unmute(int $conversationId, int $userId): bool
    {
        $stmt = Database::connection()->prepare(
            'UPDATE conversation_participants SET muted_until = NULL
             WHERE conversation_id = :cid AND user_id = :uid'
        );
        return $stmt->execute(['cid' => $conversationId, 'uid' => $userId]);
    }

    public static function isParticipant(int $conversationId, int $userId): bool
    {
        $stmt = Database::connection()->prepare(
            'SELECT 1 FROM conversation_participants WHERE conversation_id = :cid AND user_id = :uid LIMIT 1'
        );
        $stmt->execute(['cid' => $conversationId, 'uid' => $userId]);
        return (bool)$stmt->fetch();
    }

    public static function participants(int $conversationId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT u.id, u.username, u.avatar_url
             FROM conversation_participants cp
             JOIN users u ON u.id = cp.user_id
             WHERE cp.conversation_id = :cid'
        );
        $stmt->execute(['cid' => $conversationId]);
        return $stmt->fetchAll();
    }

    public static function otherParticipantId(int $conversationId, int $currentUserId): ?int
    {
        $stmt = Database::connection()->prepare(
            'SELECT user_id FROM conversation_participants
             WHERE conversation_id = :cid AND user_id <> :uid LIMIT 1'
        );
        $stmt->execute(['cid' => $conversationId, 'uid' => $currentUserId]);
        $row = $stmt->fetch();
        return $row ? (int)$row['user_id'] : null;
    }
}
