<?php
namespace App\Controllers\Api;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;
use App\Core\Uploader;
use App\Models\Notification;
use App\Models\Post;
use App\Models\User;
use App\Models\UserBlock;
use App\Models\UserSession;

class UserController
{
    public function show(Request $request, array $params): void
    {
        $user = User::findById((int)$params['id']);
        if (!$user) {
            Response::error('User not found', 404);
        }
        Response::json([
            'user' => User::sanitize($user),
            'stats' => User::stats((int)$params['id']),
        ]);
    }

    public function update(Request $request): void
    {
        $userId = Auth::id();
        $allowed = ['name', 'username', 'bio', 'avatar_url', 'cover_photo_url', 'website', 'is_private'];
        $data = array_intersect_key($request->body, array_flip($allowed));
        if (isset($data['is_private'])) {
            $data['is_private'] = $data['is_private'] ? 1 : 0;
        }
        if (!$data) {
            Response::error('No fields to update', 422);
        }
        User::update($userId, $data);
        Response::json(['user' => User::sanitize(User::findById($userId))]);
    }

    public function uploadMedia(Request $request): void
    {
        $userId = Auth::id();
        $updates = [];

        $avatarFile = $request->file('avatar');
        if (is_array($avatarFile)) {
            $normalized = Uploader::normalizeFiles($avatarFile);
            if (!empty($normalized[0])) {
                $stored = Uploader::store($normalized[0], 'profiles', ['image/*']);
                if ($stored) {
                    $updates['avatar_url'] = $stored['url'];
                }
            }
        }

        $coverFile = $request->file('cover');
        if (is_array($coverFile)) {
            $normalized = Uploader::normalizeFiles($coverFile);
            if (!empty($normalized[0])) {
                $stored = Uploader::store($normalized[0], 'covers', ['image/*']);
                if ($stored) {
                    $updates['cover_photo_url'] = $stored['url'];
                }
            }
        }

        if (!$updates) {
            Response::error('No valid media uploaded', 422);
        }

        User::update($userId, $updates);
        Response::json(['user' => User::sanitize(User::findById($userId))]);
    }

    public function follow(Request $request, array $params): void
    {
        $me = Auth::id();
        $targetId = (int)$params['id'];
        $target = User::findById($targetId);
        if (!$target) {
            Response::error('User not found', 404);
        }
        if ((int)$target['is_private'] === 1) {
            User::requestFollow($me, $targetId);
            if ($me !== $targetId) {
                Notification::create($targetId, $me, 'follow', ['status' => 'requested']);
            }
            Response::json(['status' => 'requested']);
        }
        User::follow($me, $targetId);
        if ($me !== $targetId) {
            Notification::create($targetId, $me, 'follow');
        }
        Response::json(['status' => 'following']);
    }

    public function acceptFollowRequest(Request $request, array $params): void
    {
        $ok = User::acceptFollowRequest((int)$params['id'], Auth::id());
        if (!$ok) {
            Response::error('Request not found', 404);
        }
        Response::json(['status' => 'accepted']);
    }

    public function unfollow(Request $request, array $params): void
    {
        User::unfollow(Auth::id(), (int)$params['id']);
        Response::json(['status' => 'unfollowed']);
    }

    public function sendFriendRequest(Request $request, array $params): void
    {
        $me = Auth::id();
        $targetId = (int)$params['id'];
        if ($targetId === $me) {
            Response::error('You cannot send a friend request to yourself', 422);
        }
        $target = User::findById($targetId);
        if (!$target) {
            Response::error('User not found', 404);
        }
        if (UserBlock::isBlocked($targetId, $me) || UserBlock::isBlocked($me, $targetId)) {
            Response::error('Friend request not allowed', 403);
        }
        if (User::areFriends($me, $targetId)) {
            Response::json(['status' => 'already_friends']);
        }

        $incoming = User::findPendingFriendRequestBetween($targetId, $me);
        if ($incoming) {
            User::acceptFriendRequest((int)$incoming['id'], $me);
            Notification::create($targetId, $me, 'friend_request', ['status' => 'accepted']);
            Response::json(['status' => 'accepted']);
        }

        $existing = User::findPendingFriendRequestBetween($me, $targetId);
        if ($existing) {
            Response::json(['status' => 'pending']);
        }

        $created = User::sendFriendRequest($me, $targetId);
        if (!$created) {
            Response::json(['status' => 'pending']);
        }
        Notification::create($targetId, $me, 'friend_request');
        Response::json(['status' => 'pending']);
    }

    public function acceptFriendRequest(Request $request, array $params): void
    {
        $ok = User::acceptFriendRequest((int)$params['id'], Auth::id());
        if (!$ok) {
            Response::error('Request not found', 404);
        }
        Response::json(['status' => 'accepted']);
    }

    public function rejectFriendRequest(Request $request, array $params): void
    {
        $stmt = \App\Core\Database::connection()->prepare(
            'UPDATE friend_requests SET status = "rejected", responded_at = NOW() WHERE id = :id AND addressee_id = :user'
        );
        $stmt->execute(['id' => (int)$params['id'], 'user' => Auth::id()]);
        Response::json(['status' => 'rejected']);
    }

    public function listFriendRequests(Request $request): void
    {
        $incoming = User::pendingFriendRequests(Auth::id());
        $sent = User::sentFriendRequests(Auth::id());
        Response::json([
            'items' => $incoming,
            'sent' => $sent,
        ]);
    }

    public function listFollowRequests(Request $request): void
    {
        $items = User::pendingFollowRequests(Auth::id());
        Response::json(['items' => $items]);
    }

    public function rejectFollowRequest(Request $request, array $params): void
    {
        $stmt = \App\Core\Database::connection()->prepare(
            'UPDATE follow_requests SET status = "rejected", responded_at = NOW() WHERE id = :id AND requested_id = :user'
        );
        $stmt->execute(['id' => (int)$params['id'], 'user' => Auth::id()]);
        Response::json(['status' => 'rejected']);
    }

    public function suggestions(Request $request): void
    {
        $limit = (int)$request->input('limit', 100);
        $items = User::suggestions(Auth::id(), $limit);
        Response::json(['items' => $items]);
    }

    public function status(Request $request): void
    {
        $online = (bool)$request->input('online', true);
        User::setOnlineStatus(Auth::id(), $online);
        Response::json(['status' => $online ? 'online' : 'offline']);
    }

    public function activeUsers(Request $request): void
    {
        $limit = (int)$request->input('limit', 12);
        $items = User::activeUsers(Auth::id(), $limit);
        Response::json(['items' => $items]);
    }

    public function block(Request $request, array $params): void
    {
        $me = Auth::id();
        $targetId = (int)$params['id'];
        if ($targetId === $me) {
            Response::error('You cannot block yourself', 422);
        }
        $target = User::findById($targetId);
        if (!$target) {
            Response::error('User not found', 404);
        }
        UserBlock::block($me, $targetId);
        Response::json(['status' => 'blocked']);
    }

    public function unblock(Request $request, array $params): void
    {
        $me = Auth::id();
        $targetId = (int)$params['id'];
        UserBlock::unblock($me, $targetId);
        Response::json(['status' => 'unblocked']);
    }

    public function blockedList(Request $request): void
    {
        $items = UserBlock::listBlocked(Auth::id());
        Response::json(['items' => $items]);
    }

    public function sessions(Request $request): void
    {
        $items = UserSession::listForUser(Auth::id(), (int)$request->input('limit', 20));
        Response::json(['items' => $items]);
    }

    public function revokeSession(Request $request, array $params): void
    {
        $ok = UserSession::revoke(Auth::id(), (int)$params['id']);
        if (!$ok) {
            Response::error('Session not found', 404);
        }
        Response::json(['status' => 'revoked']);
    }

    public function changePassword(Request $request): void
    {
        $current = (string)$request->input('current_password', '');
        $password = (string)$request->input('password', '');
        $confirm = (string)$request->input('password_confirm', '');
        if (strlen($password) < 8 || $password !== $confirm) {
            Response::error('Invalid password', 422);
        }
        $user = User::findById(Auth::id());
        if (!$user || !password_verify($current, $user['password_hash'])) {
            Response::error('Current password incorrect', 403);
        }
        $hash = password_hash($password, PASSWORD_BCRYPT);
        User::update(Auth::id(), ['password_hash' => $hash]);
        Response::json(['status' => 'updated']);
    }

    public function posts(Request $request, array $params): void
    {
        $limit = (int)$request->input('limit', 20);
        $offset = (int)$request->input('offset', 0);
        $items = Post::byUser((int)$params['id'], $limit, $offset);
        Response::json(['items' => $items]);
    }
}
