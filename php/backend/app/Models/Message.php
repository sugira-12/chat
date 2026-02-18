<?php
namespace App\Models;

use App\Core\Database;
use App\Core\Auth;

class Message
{
    public static function findById(int $id): ?array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM messages WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function create(
        int $conversationId,
        int $senderId,
        ?string $body,
        string $type = 'text',
        array $options = []
    ): int
    {
        $replyTo = $options['reply_to_message_id'] ?? null;
        $status = $options['status'] ?? 'sent';
        $scheduledAt = $options['scheduled_at'] ?? null;
        $expiresAt = $options['expires_at'] ?? null;
        $stmt = Database::connection()->prepare(
            'INSERT INTO messages (conversation_id, sender_id, reply_to_message_id, body, type, status, created_at, scheduled_at, expires_at)
             VALUES (:cid, :sender, :reply_to, :body, :type, :status,
                     IF(:scheduled_at IS NULL, NOW(), :scheduled_at),
                     :scheduled_at, :expires_at)'
        );
        $stmt->execute([
            'cid' => $conversationId,
            'sender' => $senderId,
            'reply_to' => $replyTo,
            'body' => $body,
            'type' => $type,
            'status' => $status,
            'scheduled_at' => $scheduledAt,
            'expires_at' => $expiresAt,
        ]);
        return (int)Database::connection()->lastInsertId();
    }

    public static function releaseScheduled(int $conversationId): void
    {
        $stmt = Database::connection()->prepare(
            'UPDATE messages
             SET status = "sent", created_at = scheduled_at
             WHERE conversation_id = :cid
               AND status = "scheduled"
               AND scheduled_at IS NOT NULL
               AND scheduled_at <= NOW()'
        );
        $stmt->execute(['cid' => $conversationId]);
    }

    public static function listByConversation(
        int $conversationId,
        int $limit = 50,
        int $offset = 0,
        ?int $afterId = null
    ): array
    {
        self::releaseScheduled($conversationId);
        if ($afterId !== null && $afterId > 0) {
            $stmt = Database::connection()->prepare(
                'SELECT m.*, u.username, u.avatar_url,
                        (SELECT COUNT(*) FROM message_reads mr WHERE mr.message_id = m.id) AS read_count,
                        (SELECT ma.url FROM message_attachments ma WHERE ma.message_id = m.id ORDER BY ma.id ASC LIMIT 1) AS media_url,
                        (SELECT ma.media_type FROM message_attachments ma WHERE ma.message_id = m.id ORDER BY ma.id ASC LIMIT 1) AS media_type,
                        r.body AS reply_body, ru.username AS reply_username
                 FROM messages m
                 JOIN users u ON u.id = m.sender_id
                 LEFT JOIN messages r ON r.id = m.reply_to_message_id
                 LEFT JOIN users ru ON ru.id = r.sender_id
                 LEFT JOIN message_hidden mh ON mh.message_id = m.id AND mh.user_id = :viewer
                 WHERE m.conversation_id = :cid
                   AND m.status = "sent"
                   AND (m.expires_at IS NULL OR m.expires_at > NOW())
                   AND mh.message_id IS NULL
                   AND m.id > :after_id
                 ORDER BY m.created_at ASC
                 LIMIT :limit'
            );
            $stmt->bindValue(':cid', $conversationId, \PDO::PARAM_INT);
            $stmt->bindValue(':after_id', $afterId, \PDO::PARAM_INT);
            $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
            $stmt->bindValue(':viewer', Auth::id(), \PDO::PARAM_INT);
            $stmt->execute();
            return $stmt->fetchAll();
        }

        $stmt = Database::connection()->prepare(
            'SELECT m.*, u.username, u.avatar_url,
                    (SELECT COUNT(*) FROM message_reads mr WHERE mr.message_id = m.id) AS read_count,
                    (SELECT ma.url FROM message_attachments ma WHERE ma.message_id = m.id ORDER BY ma.id ASC LIMIT 1) AS media_url,
                    (SELECT ma.media_type FROM message_attachments ma WHERE ma.message_id = m.id ORDER BY ma.id ASC LIMIT 1) AS media_type,
                    r.body AS reply_body, ru.username AS reply_username
             FROM messages m
             JOIN users u ON u.id = m.sender_id
             LEFT JOIN messages r ON r.id = m.reply_to_message_id
             LEFT JOIN users ru ON ru.id = r.sender_id
             LEFT JOIN message_hidden mh ON mh.message_id = m.id AND mh.user_id = :viewer
             WHERE m.conversation_id = :cid
               AND m.status = "sent"
               AND (m.expires_at IS NULL OR m.expires_at > NOW())
               AND mh.message_id IS NULL
             ORDER BY m.created_at ASC
             LIMIT :limit OFFSET :offset'
        );
        $stmt->bindValue(':cid', $conversationId, \PDO::PARAM_INT);
        $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, \PDO::PARAM_INT);
        $stmt->bindValue(':viewer', Auth::id(), \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public static function markRead(int $messageId, int $userId, bool $trackReceipts = true): bool
    {
        $ok = true;
        if ($trackReceipts) {
            $stmt = Database::connection()->prepare(
                'INSERT IGNORE INTO message_reads (message_id, user_id, read_at)
                 VALUES (:mid, :uid, NOW())'
            );
            $ok = $stmt->execute(['mid' => $messageId, 'uid' => $userId]);
        }

        $conversationId = Database::connection()->prepare(
            'SELECT conversation_id FROM messages WHERE id = :mid LIMIT 1'
        );
        $conversationId->execute(['mid' => $messageId]);
        $row = $conversationId->fetch();
        if ($row && isset($row['conversation_id'])) {
            $update = Database::connection()->prepare(
                'UPDATE conversation_participants
                 SET last_read_message_id = CASE
                       WHEN last_read_message_id IS NULL OR last_read_message_id < :mid THEN :mid
                       ELSE last_read_message_id
                 END
                 WHERE conversation_id = :cid AND user_id = :uid'
            );
            $update->execute([
                'mid' => $messageId,
                'cid' => (int)$row['conversation_id'],
                'uid' => $userId,
            ]);
        }

        return $ok;
    }

    public static function edit(int $messageId, int $userId, string $body): bool
    {
        $stmt = Database::connection()->prepare(
            'UPDATE messages SET body = :body, edited_at = NOW()
             WHERE id = :id AND sender_id = :sender AND deleted_at IS NULL'
        );
        $ok = $stmt->execute(['body' => $body, 'id' => $messageId, 'sender' => $userId]);
        if ($ok) {
            $edit = Database::connection()->prepare(
                'INSERT INTO message_edits (message_id, editor_id, body, created_at)
                 VALUES (:mid, :uid, :body, NOW())'
            );
            $edit->execute(['mid' => $messageId, 'uid' => $userId, 'body' => $body]);
        }
        return $ok;
    }

    public static function deleteForAll(int $messageId, int $userId): bool
    {
        $stmt = Database::connection()->prepare(
            'UPDATE messages SET body = NULL, deleted_at = NOW()
             WHERE id = :id AND sender_id = :sender'
        );
        return $stmt->execute(['id' => $messageId, 'sender' => $userId]);
    }

    public static function hideForUser(int $messageId, int $userId): bool
    {
        $stmt = Database::connection()->prepare(
            'INSERT IGNORE INTO message_hidden (message_id, user_id, created_at)
             VALUES (:mid, :uid, NOW())'
        );
        return $stmt->execute(['mid' => $messageId, 'uid' => $userId]);
    }

    public static function edits(int $messageId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT body, created_at FROM message_edits WHERE message_id = :mid ORDER BY created_at DESC'
        );
        $stmt->execute(['mid' => $messageId]);
        return $stmt->fetchAll();
    }

    public static function react(int $messageId, int $userId, string $emoji): bool
    {
        $stmt = Database::connection()->prepare(
            'INSERT IGNORE INTO message_reactions (message_id, user_id, emoji, created_at)
             VALUES (:mid, :uid, :emoji, NOW())'
        );
        return $stmt->execute(['mid' => $messageId, 'uid' => $userId, 'emoji' => $emoji]);
    }
}
