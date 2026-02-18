<?php
namespace App\Models;

use App\Core\Database;

class ProfileDetail
{
    public static function getForUser(int $userId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT * FROM profile_details WHERE user_id = :user LIMIT 1'
        );
        $stmt->execute(['user' => $userId]);
        $row = $stmt->fetch();
        if ($row) {
            return $row;
        }
        return [
            'user_id' => $userId,
            'workplace' => null,
            'education' => null,
            'hometown' => null,
            'location' => null,
            'relationship_status' => null,
            'pronouns' => null,
            'birthday' => null,
            'show_friends' => 1,
            'show_followers' => 1,
            'show_photos' => 1,
            'show_activity' => 1,
        ];
    }

    public static function upsert(int $userId, array $data): bool
    {
        $payload = [
            'user_id' => $userId,
            'workplace' => $data['workplace'] ?? null,
            'education' => $data['education'] ?? null,
            'hometown' => $data['hometown'] ?? null,
            'location' => $data['location'] ?? null,
            'relationship_status' => $data['relationship_status'] ?? null,
            'pronouns' => $data['pronouns'] ?? null,
            'birthday' => $data['birthday'] ?? null,
            'show_friends' => !empty($data['show_friends']) ? 1 : 0,
            'show_followers' => !empty($data['show_followers']) ? 1 : 0,
            'show_photos' => !empty($data['show_photos']) ? 1 : 0,
            'show_activity' => !empty($data['show_activity']) ? 1 : 0,
        ];

        $stmt = Database::connection()->prepare(
            'INSERT INTO profile_details
                (user_id, workplace, education, hometown, location, relationship_status, pronouns, birthday,
                 show_friends, show_followers, show_photos, show_activity, updated_at)
             VALUES
                (:user_id, :workplace, :education, :hometown, :location, :relationship_status, :pronouns, :birthday,
                 :show_friends, :show_followers, :show_photos, :show_activity, NOW())
             ON DUPLICATE KEY UPDATE
                workplace = VALUES(workplace),
                education = VALUES(education),
                hometown = VALUES(hometown),
                location = VALUES(location),
                relationship_status = VALUES(relationship_status),
                pronouns = VALUES(pronouns),
                birthday = VALUES(birthday),
                show_friends = VALUES(show_friends),
                show_followers = VALUES(show_followers),
                show_photos = VALUES(show_photos),
                show_activity = VALUES(show_activity),
                updated_at = NOW()'
        );
        return $stmt->execute($payload);
    }
}
