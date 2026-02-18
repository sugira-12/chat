<?php
namespace App\Services;

use App\Core\Auth;
use App\Core\Database;
use App\Core\Request;
use App\Models\AdminAlert;

class ActivityLogger
{
    public static function capture(Request $request, string $routePath): void
    {
        $method = strtoupper($request->method);
        if (!in_array($method, ['POST', 'PUT', 'DELETE'], true)) {
            return;
        }
        if (strpos($routePath, '/api/admin/alerts') === 0) {
            return;
        }

        $actorId = Auth::id();
        $action = $method . ' ' . $routePath;
        $metadata = [
            'ip' => $request->ip,
            'query' => $request->query,
        ];

        try {
            $stmt = Database::connection()->prepare(
                'INSERT INTO system_events (actor_id, action, metadata, created_at)
                 VALUES (:actor_id, :action, :metadata, NOW())'
            );
            $stmt->execute([
                'actor_id' => $actorId,
                'action' => $action,
                'metadata' => json_encode($metadata),
            ]);
        } catch (\Throwable $e) {
            return;
        }

        $summary = $action;
        if ($actorId) {
            $summary .= ' by user #' . $actorId;
        }
        AdminAlert::createForAllAdmins('System action', $summary, [
            'actor_id' => $actorId,
            'action' => $action,
        ]);
    }
}
