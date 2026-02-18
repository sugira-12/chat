<?php
namespace App\Controllers\Api;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;
use App\Models\Notification;

class NotificationController
{
    public function index(Request $request): void
    {
        $limit = (int)$request->input('limit', 20);
        $offset = (int)$request->input('offset', 0);
        $items = Notification::listForUser(Auth::id(), $limit, $offset);
        foreach ($items as &$item) {
            if (!empty($item['data'])) {
                $decoded = json_decode($item['data'], true);
                $item['data'] = $decoded ?: $item['data'];
            }
        }
        Response::json([
            'items' => $items,
            'unread_count' => Notification::unreadCount(Auth::id()),
        ]);
    }

    public function markRead(Request $request, array $params): void
    {
        Notification::markRead(Auth::id(), (int)$params['id']);
        Response::json([
            'status' => 'read',
            'unread_count' => Notification::unreadCount(Auth::id()),
        ]);
    }

    public function markAllRead(Request $request): void
    {
        Notification::markAllRead(Auth::id());
        Response::json([
            'status' => 'all_read',
            'unread_count' => Notification::unreadCount(Auth::id()),
        ]);
    }

    public function delete(Request $request, array $params): void
    {
        Notification::deleteOne(Auth::id(), (int)$params['id']);
        Response::json([
            'status' => 'deleted',
            'unread_count' => Notification::unreadCount(Auth::id()),
        ]);
    }

    public function clear(Request $request): void
    {
        Notification::deleteAll(Auth::id());
        Response::json([
            'status' => 'cleared',
            'unread_count' => 0,
        ]);
    }
}
