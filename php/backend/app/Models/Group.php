<?php
namespace App\Models;

use App\Core\Database;

class Group
{
    public static function listByUser(int $userId, int $limit = 6): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT g.*
             FROM group_members gm
             JOIN groups g ON g.id = gm.group_id
             WHERE gm.user_id = :user
             ORDER BY g.created_at DESC
             LIMIT :limit'
        );
        $stmt->bindValue(':user', $userId, \PDO::PARAM_INT);
        $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public static function create(int $ownerId, string $name, ?string $description = null, ?string $coverUrl = null): int
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO groups (owner_id, name, description, cover_url, created_at)
             VALUES (:owner, :name, :description, :cover, NOW())'
        );
        $stmt->execute([
            'owner' => $ownerId,
            'name' => $name,
            'description' => $description,
            'cover' => $coverUrl,
        ]);
        $groupId = (int)Database::connection()->lastInsertId();
        Database::connection()->prepare(
            'INSERT IGNORE INTO group_members (group_id, user_id, role, joined_at)
             VALUES (:group_id, :user_id, "owner", NOW())'
        )->execute(['group_id' => $groupId, 'user_id' => $ownerId]);
        return $groupId;
    }
}
