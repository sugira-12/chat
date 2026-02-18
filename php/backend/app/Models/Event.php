<?php
namespace App\Models;

use App\Core\Database;

class Event
{
    public static function listByUser(int $userId, int $limit = 6): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT e.*
             FROM event_attendees ea
             JOIN events e ON e.id = ea.event_id
             WHERE ea.user_id = :user
             ORDER BY e.starts_at DESC
             LIMIT :limit'
        );
        $stmt->bindValue(':user', $userId, \PDO::PARAM_INT);
        $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public static function create(
        int $ownerId,
        string $title,
        ?string $description,
        ?string $location,
        string $startsAt,
        ?string $endsAt,
        ?string $coverUrl
    ): int {
        $stmt = Database::connection()->prepare(
            'INSERT INTO events (owner_id, title, description, location, starts_at, ends_at, cover_url, created_at)
             VALUES (:owner, :title, :description, :location, :starts_at, :ends_at, :cover, NOW())'
        );
        $stmt->execute([
            'owner' => $ownerId,
            'title' => $title,
            'description' => $description,
            'location' => $location,
            'starts_at' => $startsAt,
            'ends_at' => $endsAt,
            'cover' => $coverUrl,
        ]);
        $eventId = (int)Database::connection()->lastInsertId();
        Database::connection()->prepare(
            'INSERT IGNORE INTO event_attendees (event_id, user_id, status, responded_at)
             VALUES (:event_id, :user_id, "going", NOW())'
        )->execute(['event_id' => $eventId, 'user_id' => $ownerId]);
        return $eventId;
    }
}
