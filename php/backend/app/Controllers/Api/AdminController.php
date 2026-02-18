<?php
namespace App\Controllers\Api;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;
use App\Core\Database;
use App\Models\Ad;
use App\Models\AdminAlert;
use App\Models\User;
use App\Models\Report;

class AdminController
{
    public function metrics(Request $request): void
    {
        $pdo = Database::connection();
        $users = (int)$pdo->query('SELECT COUNT(*) AS c FROM users')->fetch()['c'];
        $posts = (int)$pdo->query('SELECT COUNT(*) AS c FROM posts')->fetch()['c'];
        $messages = (int)$pdo->query('SELECT COUNT(*) AS c FROM messages')->fetch()['c'];
        $conversations = (int)$pdo->query('SELECT COUNT(*) AS c FROM conversations')->fetch()['c'];
        $openReports = (int)$pdo->query('SELECT COUNT(*) AS c FROM reports WHERE status = "open"')->fetch()['c'];
        $pendingFriendRequests = (int)$pdo->query('SELECT COUNT(*) AS c FROM friend_requests WHERE status = "pending"')->fetch()['c'];
        $pendingFollowRequests = (int)$pdo->query('SELECT COUNT(*) AS c FROM follow_requests WHERE status = "pending"')->fetch()['c'];
        Response::json([
            'users' => $users,
            'posts' => $posts,
            'messages' => $messages,
            'conversations' => $conversations,
            'open_reports' => $openReports,
            'pending_friend_requests' => $pendingFriendRequests,
            'pending_follow_requests' => $pendingFollowRequests,
        ]);
    }

    public function users(Request $request): void
    {
        $limit = (int)$request->input('limit', 100);
        $offset = (int)$request->input('offset', 0);
        $role = (string)$request->input('role', 'all');
        $status = (string)$request->input('status', 'all');
        $search = trim((string)$request->input('search', ''));

        $sql = 'SELECT id, name, username, email, role, status, created_at FROM users WHERE 1=1';
        $params = [];
        if ($role !== 'all') {
            $sql .= ' AND role = :role';
            $params['role'] = $role;
        }
        if ($status !== 'all') {
            $sql .= ' AND status = :status';
            $params['status'] = $status;
        }
        if ($search !== '') {
            $sql .= ' AND (name LIKE :search OR username LIKE :search OR email LIKE :search OR CAST(id AS CHAR) LIKE :search)';
            $params['search'] = '%' . $search . '%';
        }
        $sql .= ' ORDER BY created_at DESC LIMIT :limit OFFSET :offset';

        $stmt = Database::connection()->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue(':' . $key, $value);
        }
        $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, \PDO::PARAM_INT);
        $stmt->execute();
        Response::json(['items' => $stmt->fetchAll()]);
    }

    public function setStatus(Request $request, array $params): void
    {
        $status = $request->input('status', 'active');
        if (!in_array($status, ['active', 'suspended'], true)) {
            Response::error('Invalid status', 422);
        }
        $stmt = Database::connection()->prepare('UPDATE users SET status = :status WHERE id = :id');
        $stmt->execute(['status' => $status, 'id' => (int)$params['id']]);
        Response::json(['status' => 'updated']);
    }

    public function setRole(Request $request, array $params): void
    {
        $role = $request->input('role', 'user');
        if (!in_array($role, ['user', 'admin'], true)) {
            Response::error('Invalid role', 422);
        }
        $stmt = Database::connection()->prepare('UPDATE users SET role = :role WHERE id = :id');
        $stmt->execute(['role' => $role, 'id' => (int)$params['id']]);
        Response::json(['status' => 'updated']);
    }

    public function reports(Request $request): void
    {
        $limit = (int)$request->input('limit', 50);
        $offset = (int)$request->input('offset', 0);
        $filters = [
            'status' => $request->input('status', 'all'),
            'type' => $request->input('type', 'all'),
            'search' => $request->input('search', ''),
        ];
        $items = Report::list($filters, $limit, $offset);
        Response::json(['items' => $items]);
    }

    public function resolveReport(Request $request, array $params): void
    {
        Report::resolve((int)$params['id']);
        Response::json(['status' => 'resolved']);
    }

    public function ads(Request $request): void
    {
        $limit = (int)$request->input('limit', 100);
        $offset = (int)$request->input('offset', 0);
        $items = Ad::listForAdmin($limit, $offset);
        Response::json(['items' => $items]);
    }

    public function createAd(Request $request): void
    {
        $title = trim((string)$request->input('title', ''));
        $startsAt = trim((string)$request->input('starts_at', ''));
        $endsAt = trim((string)$request->input('ends_at', ''));
        if ($title === '' || $startsAt === '' || $endsAt === '') {
            Response::error('Title, starts_at and ends_at are required', 422);
        }
        if (strtotime($endsAt) <= strtotime($startsAt)) {
            Response::error('ends_at must be later than starts_at', 422);
        }

        $id = Ad::create([
            'created_by' => Auth::id(),
            'title' => $title,
            'body' => $request->input('body'),
            'image_url' => $request->input('image_url'),
            'link_url' => $request->input('link_url'),
            'starts_at' => date('Y-m-d H:i:s', strtotime($startsAt)),
            'ends_at' => date('Y-m-d H:i:s', strtotime($endsAt)),
            'is_active' => $request->input('is_active', 1),
        ]);

        Response::json(['id' => $id, 'status' => 'created'], 201);
    }

    public function deactivateAd(Request $request, array $params): void
    {
        $ok = Ad::deactivate((int)$params['id']);
        if (!$ok) {
            Response::error('Unable to update ad', 422);
        }
        Response::json(['status' => 'deactivated']);
    }

    public function alerts(Request $request): void
    {
        $limit = (int)$request->input('limit', 50);
        $offset = (int)$request->input('offset', 0);
        $items = AdminAlert::listForAdmin(Auth::id(), $limit, $offset);
        Response::json(['items' => $items]);
    }

    public function markAlertRead(Request $request, array $params): void
    {
        AdminAlert::markRead(Auth::id(), (int)$params['id']);
        Response::json(['status' => 'read']);
    }

    public function markAllAlertsRead(Request $request): void
    {
        AdminAlert::markAllRead(Auth::id());
        Response::json(['status' => 'all_read']);
    }

    public function deleteAlert(Request $request, array $params): void
    {
        AdminAlert::deleteOne(Auth::id(), (int)$params['id']);
        Response::json(['status' => 'deleted']);
    }
}
