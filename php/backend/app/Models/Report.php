<?php
namespace App\Models;

use App\Core\Database;

class Report
{
    public static function create(int $reporterId, string $type, int $targetId, string $reason): bool
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO reports (reporter_id, target_type, target_id, reason, status, created_at)
             VALUES (:reporter, :type, :target, :reason, "open", NOW())'
        );
        return $stmt->execute([
            'reporter' => $reporterId,
            'type' => $type,
            'target' => $targetId,
            'reason' => $reason,
        ]);
    }

    public static function list(array $filters, int $limit = 50, int $offset = 0): array
    {
        $sql = 'SELECT r.*, u.username AS reporter_username,
                       tu.username AS target_user,
                       p.body AS target_post_body,
                       up.username AS target_post_owner
                FROM reports r
                LEFT JOIN users u ON u.id = r.reporter_id
                LEFT JOIN users tu ON (r.target_type = "user" AND tu.id = r.target_id)
                LEFT JOIN posts p ON (r.target_type = "post" AND p.id = r.target_id)
                LEFT JOIN users up ON up.id = p.user_id
                WHERE 1=1';
        $params = [];
        if (!empty($filters['status']) && $filters['status'] !== 'all') {
            $sql .= ' AND r.status = :status';
            $params['status'] = $filters['status'];
        }
        if (!empty($filters['type']) && $filters['type'] !== 'all') {
            $sql .= ' AND r.target_type = :type';
            $params['type'] = $filters['type'];
        }
        if (!empty($filters['search'])) {
            $sql .= ' AND (u.username LIKE :search OR tu.username LIKE :search OR up.username LIKE :search OR r.reason LIKE :search OR CAST(r.target_id AS CHAR) LIKE :search)';
            $params['search'] = '%' . $filters['search'] . '%';
        }
        $sql .= ' ORDER BY r.created_at DESC LIMIT :limit OFFSET :offset';
        $stmt = Database::connection()->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue(':' . $key, $value);
        }
        $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public static function resolve(int $reportId): bool
    {
        $stmt = Database::connection()->prepare(
            'UPDATE reports SET status = "resolved", resolved_at = NOW() WHERE id = :id'
        );
        return $stmt->execute(['id' => $reportId]);
    }
}
