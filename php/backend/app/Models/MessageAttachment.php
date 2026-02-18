<?php
namespace App\Models;

use App\Core\Database;

class MessageAttachment
{
    public static function create(int $messageId, string $mediaType, string $url, ?string $thumbUrl = null, ?int $duration = null, ?int $size = null): bool
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO message_attachments (message_id, media_type, url, thumb_url, duration, size_bytes)
             VALUES (:message_id, :media_type, :url, :thumb_url, :duration, :size)'
        );
        return $stmt->execute([
            'message_id' => $messageId,
            'media_type' => $mediaType,
            'url' => $url,
            'thumb_url' => $thumbUrl,
            'duration' => $duration,
            'size' => $size,
        ]);
    }
}
