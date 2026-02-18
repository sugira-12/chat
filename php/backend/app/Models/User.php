<?php
namespace App\Models;

use App\Core\Database;

class User
{
    public static function sanitize(array $user): array
    {
        unset($user['password_hash']);
        return $user;
    }
    public static function findById(int $id): ?array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM users WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $user = $stmt->fetch();
        return $user ?: null;
    }

    public static function findByEmail(string $email): ?array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM users WHERE email = :email LIMIT 1');
        $stmt->execute(['email' => $email]);
        $user = $stmt->fetch();
        return $user ?: null;
    }

    public static function findByUsername(string $username): ?array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM users WHERE username = :username LIMIT 1');
        $stmt->execute(['username' => $username]);
        $user = $stmt->fetch();
        return $user ?: null;
    }

    public static function create(array $data): int
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO users (uuid, name, username, email, password_hash, role, created_at, updated_at)
             VALUES (:uuid, :name, :username, :email, :password_hash, :role, NOW(), NOW())'
        );
        $stmt->execute($data);
        return (int)Database::connection()->lastInsertId();
    }

    public static function createVerificationToken(int $userId): string
    {
        $token = bin2hex(random_bytes(32));
        $stmt = Database::connection()->prepare(
            'INSERT INTO email_verifications (user_id, token, expires_at, created_at)
             VALUES (:user_id, :token, DATE_ADD(NOW(), INTERVAL 24 HOUR), NOW())'
        );
        $stmt->execute(['user_id' => $userId, 'token' => $token]);
        return $token;
    }

    public static function verifyEmail(string $token): bool
    {
        $stmt = Database::connection()->prepare(
            'SELECT user_id FROM email_verifications WHERE token = :token AND expires_at > NOW() LIMIT 1'
        );
        $stmt->execute(['token' => $token]);
        $row = $stmt->fetch();
        if (!$row) {
            return false;
        }
        Database::connection()->prepare('UPDATE users SET email_verified_at = NOW() WHERE id = :id')
            ->execute(['id' => $row['user_id']]);
        Database::connection()->prepare('DELETE FROM email_verifications WHERE token = :token')
            ->execute(['token' => $token]);
        return true;
    }

    public static function update(int $id, array $data): bool
    {
        $fields = [];
        foreach ($data as $key => $value) {
            $fields[] = $key . ' = :' . $key;
        }
        $sql = 'UPDATE users SET ' . implode(', ', $fields) . ', updated_at = NOW() WHERE id = :id';
        $data['id'] = $id;
        $stmt = Database::connection()->prepare($sql);
        return $stmt->execute($data);
    }

    public static function follow(int $followerId, int $followedId): bool
    {
        $stmt = Database::connection()->prepare(
            'INSERT IGNORE INTO follows (follower_id, followed_id, created_at) VALUES (:follower, :followed, NOW())'
        );
        return $stmt->execute(['follower' => $followerId, 'followed' => $followedId]);
    }

    public static function isFollowing(int $followerId, int $followedId): bool
    {
        $stmt = Database::connection()->prepare(
            'SELECT 1 FROM follows WHERE follower_id = :follower AND followed_id = :followed LIMIT 1'
        );
        $stmt->execute(['follower' => $followerId, 'followed' => $followedId]);
        return (bool)$stmt->fetch();
    }

    public static function requestFollow(int $requesterId, int $requestedId): bool
    {
        $stmt = Database::connection()->prepare(
            'INSERT IGNORE INTO follow_requests (requester_id, requested_id, status, created_at)
             VALUES (:requester, :requested, "pending", NOW())'
        );
        return $stmt->execute(['requester' => $requesterId, 'requested' => $requestedId]);
    }

    public static function acceptFollowRequest(int $requestId, int $userId): bool
    {
        $stmt = Database::connection()->prepare(
            'SELECT * FROM follow_requests WHERE id = :id AND requested_id = :user AND status = "pending"'
        );
        $stmt->execute(['id' => $requestId, 'user' => $userId]);
        $request = $stmt->fetch();
        if (!$request) {
            return false;
        }
        Database::connection()->prepare(
            'UPDATE follow_requests SET status = "accepted", responded_at = NOW() WHERE id = :id'
        )->execute(['id' => $requestId]);
        return self::follow((int)$request['requester_id'], (int)$request['requested_id']);
    }

    public static function unfollow(int $followerId, int $followedId): bool
    {
        $stmt = Database::connection()->prepare(
            'DELETE FROM follows WHERE follower_id = :follower AND followed_id = :followed'
        );
        return $stmt->execute(['follower' => $followerId, 'followed' => $followedId]);
    }

    public static function sendFriendRequest(int $requesterId, int $addresseeId): bool
    {
        $existing = self::findFriendRequest($requesterId, $addresseeId);
        if ($existing) {
            if (($existing['status'] ?? '') === 'rejected') {
                $stmt = Database::connection()->prepare(
                    'UPDATE friend_requests
                     SET status = "pending", responded_at = NULL, created_at = NOW()
                     WHERE id = :id'
                );
                return $stmt->execute(['id' => $existing['id']]);
            }
            return false;
        }

        $stmt = Database::connection()->prepare(
            'INSERT IGNORE INTO friend_requests (requester_id, addressee_id, status, created_at)
             VALUES (:requester, :addressee, "pending", NOW())'
        );
        return $stmt->execute(['requester' => $requesterId, 'addressee' => $addresseeId]);
    }

    public static function findFriendRequest(int $requesterId, int $addresseeId): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT * FROM friend_requests WHERE requester_id = :requester AND addressee_id = :addressee LIMIT 1'
        );
        $stmt->execute([
            'requester' => $requesterId,
            'addressee' => $addresseeId,
        ]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function findPendingFriendRequestBetween(int $requesterId, int $addresseeId): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT * FROM friend_requests
             WHERE requester_id = :requester AND addressee_id = :addressee AND status = "pending"
             LIMIT 1'
        );
        $stmt->execute([
            'requester' => $requesterId,
            'addressee' => $addresseeId,
        ]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function acceptFriendRequest(int $requestId, int $userId): bool
    {
        $stmt = Database::connection()->prepare(
            'SELECT * FROM friend_requests WHERE id = :id AND addressee_id = :user AND status = "pending"'
        );
        $stmt->execute(['id' => $requestId, 'user' => $userId]);
        $request = $stmt->fetch();
        if (!$request) {
            return false;
        }
        Database::connection()->prepare(
            'UPDATE friend_requests SET status = "accepted", responded_at = NOW() WHERE id = :id'
        )->execute(['id' => $requestId]);
        Database::connection()->prepare(
            'INSERT IGNORE INTO friends (user_id, friend_id, created_at) VALUES (:u1, :u2, NOW()), (:u2, :u1, NOW())'
        )->execute(['u1' => $request['requester_id'], 'u2' => $request['addressee_id']]);
        return true;
    }

    public static function setOnlineStatus(int $userId, bool $online): void
    {
        $stmt = Database::connection()->prepare('SELECT show_online FROM user_settings WHERE user_id = :id');
        $stmt->execute(['id' => $userId]);
        $row = $stmt->fetch();
        if (!$row) {
            UserSettings::createDefaults($userId);
            $row = ['show_online' => 1];
        }
        if ($row && (int)$row['show_online'] === 0) {
            $online = false;
        }
        $stmt = Database::connection()->prepare(
            'INSERT INTO user_status (user_id, is_online, last_seen_at)
             VALUES (:user_id, :online, NOW())
             ON DUPLICATE KEY UPDATE is_online = :online, last_seen_at = NOW()'
        );
        $stmt->execute(['user_id' => $userId, 'online' => $online ? 1 : 0]);
    }

    public static function stats(int $userId): array
    {
        $pdo = Database::connection();
        $followers = $pdo->prepare('SELECT COUNT(*) AS count FROM follows WHERE followed_id = :id');
        $followers->execute(['id' => $userId]);
        $following = $pdo->prepare('SELECT COUNT(*) AS count FROM follows WHERE follower_id = :id');
        $following->execute(['id' => $userId]);
        $posts = $pdo->prepare('SELECT COUNT(*) AS count FROM posts WHERE user_id = :id');
        $posts->execute(['id' => $userId]);
        return [
            'followers' => (int)$followers->fetch()['count'],
            'following' => (int)$following->fetch()['count'],
            'posts' => (int)$posts->fetch()['count'],
        ];
    }

    public static function friendsList(int $userId, int $limit = 12, int $offset = 0): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT u.id, u.username, u.name, u.avatar_url
             FROM friends f
             JOIN users u ON u.id = f.friend_id
             WHERE f.user_id = :user
             ORDER BY u.name ASC
             LIMIT :limit OFFSET :offset'
        );
        $stmt->bindValue(':user', $userId, \PDO::PARAM_INT);
        $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public static function friendsCount(int $userId): int
    {
        $stmt = Database::connection()->prepare(
            'SELECT COUNT(*) AS count FROM friends WHERE user_id = :user'
        );
        $stmt->execute(['user' => $userId]);
        $row = $stmt->fetch();
        return (int)($row['count'] ?? 0);
    }

    public static function mutualFriendsCount(int $userA, int $userB): int
    {
        $stmt = Database::connection()->prepare(
            'SELECT COUNT(*) AS count
             FROM friends f1
             JOIN friends f2 ON f1.friend_id = f2.friend_id
             WHERE f1.user_id = :a AND f2.user_id = :b'
        );
        $stmt->execute(['a' => $userA, 'b' => $userB]);
        $row = $stmt->fetch();
        return (int)($row['count'] ?? 0);
    }

    public static function mediaByUser(int $userId, ?string $type = null, int $limit = 30): array
    {
        $filter = '';
        if ($type === 'image' || $type === 'video') {
            $filter = ' AND pm.media_type = :type';
        }
        $stmt = Database::connection()->prepare(
            'SELECT pm.*, p.user_id
             FROM post_media pm
             JOIN posts p ON p.id = pm.post_id
             WHERE p.user_id = :user' . $filter . '
             ORDER BY pm.id DESC
             LIMIT :limit'
        );
        $stmt->bindValue(':user', $userId, \PDO::PARAM_INT);
        if ($filter !== '') {
            $stmt->bindValue(':type', $type);
        }
        $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public static function activityByUser(int $userId, int $limit = 20): array
    {
        $sql = '
            (SELECT "like" AS type, pl.created_at, p.id AS post_id, p.body AS post_body, u.username AS target_username
             FROM post_likes pl
             JOIN posts p ON p.id = pl.post_id
             JOIN users u ON u.id = p.user_id
             WHERE pl.user_id = :user)
            UNION ALL
            (SELECT "comment" AS type, pc.created_at, p.id AS post_id, pc.body AS post_body, u.username AS target_username
             FROM post_comments pc
             JOIN posts p ON p.id = pc.post_id
             JOIN users u ON u.id = p.user_id
             WHERE pc.user_id = :user)
            ORDER BY created_at DESC
            LIMIT :limit';
        $stmt = Database::connection()->prepare($sql);
        $stmt->bindValue(':user', $userId, \PDO::PARAM_INT);
        $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public static function search(string $term, int $limit = 10): array
    {
        $normalized = trim($term);
        $contains = '%' . $normalized . '%';
        $starts = $normalized . '%';
        $stmt = Database::connection()->prepare(
            'SELECT id, username, name, avatar_url, cover_photo_url
             FROM users
             WHERE username LIKE :contains OR name LIKE :contains OR CAST(id AS CHAR) LIKE :starts
             ORDER BY
               CASE WHEN username = :exact THEN 0
                    WHEN username LIKE :starts THEN 1
                    WHEN name LIKE :starts THEN 2
                    ELSE 3 END,
               name ASC
             LIMIT :limit'
        );
        $stmt->bindValue(':contains', $contains);
        $stmt->bindValue(':starts', $starts);
        $stmt->bindValue(':exact', $normalized);
        $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public static function searchFriends(int $userId, string $term, int $limit = 20): array
    {
        $normalized = trim($term);
        $contains = '%' . $normalized . '%';
        $starts = $normalized . '%';
        $stmt = Database::connection()->prepare(
            'SELECT u.id, u.username, u.name, u.avatar_url, u.cover_photo_url
             FROM friends f
             JOIN users u ON u.id = f.friend_id
             LEFT JOIN user_blocks b1 ON b1.blocker_id = :user AND b1.blocked_id = u.id
             LEFT JOIN user_blocks b2 ON b2.blocker_id = u.id AND b2.blocked_id = :user
             WHERE f.user_id = :user
               AND (u.username LIKE :contains OR u.name LIKE :contains OR CAST(u.id AS CHAR) LIKE :starts)
               AND b1.blocker_id IS NULL
               AND b2.blocker_id IS NULL
             ORDER BY
               CASE WHEN u.username = :exact THEN 0
                    WHEN u.username LIKE :starts THEN 1
                    WHEN u.name LIKE :starts THEN 2
                    ELSE 3 END,
               u.name ASC
             LIMIT :limit'
        );
        $stmt->bindValue(':user', $userId, \PDO::PARAM_INT);
        $stmt->bindValue(':contains', $contains);
        $stmt->bindValue(':starts', $starts);
        $stmt->bindValue(':exact', $normalized);
        $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public static function pendingFriendRequests(int $userId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT fr.id, fr.requester_id, fr.created_at, u.username, u.name, u.avatar_url
             FROM friend_requests fr
             JOIN users u ON u.id = fr.requester_id
             WHERE fr.addressee_id = :user AND fr.status = "pending"
             ORDER BY fr.created_at DESC'
        );
        $stmt->execute(['user' => $userId]);
        return $stmt->fetchAll();
    }

    public static function sentFriendRequests(int $userId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT fr.id, fr.addressee_id, fr.created_at, u.username, u.name, u.avatar_url
             FROM friend_requests fr
             JOIN users u ON u.id = fr.addressee_id
             WHERE fr.requester_id = :user AND fr.status = "pending"
             ORDER BY fr.created_at DESC'
        );
        $stmt->execute(['user' => $userId]);
        return $stmt->fetchAll();
    }

    public static function pendingFollowRequests(int $userId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT fr.id, fr.requester_id, fr.created_at, u.username, u.name, u.avatar_url
             FROM follow_requests fr
             JOIN users u ON u.id = fr.requester_id
             WHERE fr.requested_id = :user AND fr.status = "pending"
             ORDER BY fr.created_at DESC'
        );
        $stmt->execute(['user' => $userId]);
        return $stmt->fetchAll();
    }

    public static function areFriends(int $userA, int $userB): bool
    {
        $stmt = Database::connection()->prepare(
            'SELECT 1 FROM friends WHERE user_id = :u1 AND friend_id = :u2 LIMIT 1'
        );
        $stmt->execute(['u1' => $userA, 'u2' => $userB]);
        return (bool)$stmt->fetch();
    }

    public static function canMessage(int $senderId, int $recipientId): bool
    {
        if ($senderId === $recipientId) {
            return true;
        }

        if (UserBlock::isBlocked($senderId, $recipientId) || UserBlock::isBlocked($recipientId, $senderId)) {
            return false;
        }

        $settings = UserSettings::getForUser($recipientId);
        $dmPrivacy = $settings['dm_privacy'] ?? null;
        if ($dmPrivacy === null) {
            $dmPrivacy = ((int)($settings['allow_message_requests'] ?? 1) === 1) ? 'everyone' : 'friends';
        }

        if ($dmPrivacy === 'everyone') {
            return true;
        }
        if ($dmPrivacy === 'nobody') {
            return false;
        }

        return self::areFriends($senderId, $recipientId);
    }

    public static function activeUsers(int $viewerId, int $limit = 12): array
    {
        $sql = 'SELECT u.id, u.username, u.name, u.avatar_url,
                       us.is_online, us.last_seen_at
                FROM users u
                JOIN user_status us ON us.user_id = u.id
                JOIN user_settings sett ON sett.user_id = u.id AND sett.show_online = 1
                LEFT JOIN user_blocks b1 ON b1.blocker_id = :viewer AND b1.blocked_id = u.id
                LEFT JOIN user_blocks b2 ON b2.blocker_id = u.id AND b2.blocked_id = :viewer
                WHERE u.id <> :viewer
                  AND u.status = "active"
                  AND us.is_online = 1
                  AND us.last_seen_at >= DATE_SUB(NOW(), INTERVAL 2 MINUTE)
                  AND b1.blocker_id IS NULL
                  AND b2.blocker_id IS NULL
                ORDER BY us.last_seen_at DESC
                LIMIT :limit';
        $stmt = Database::connection()->prepare($sql);
        $stmt->bindValue(':viewer', $viewerId, \PDO::PARAM_INT);
        $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public static function suggestions(int $userId, int $limit = 100): array
    {
        $sql = 'SELECT u.id, u.username, u.name, u.avatar_url
                FROM users u
                LEFT JOIN user_blocks b1 ON b1.blocker_id = :user AND b1.blocked_id = u.id
                LEFT JOIN user_blocks b2 ON b2.blocker_id = u.id AND b2.blocked_id = :user
                WHERE u.id <> :user
                  AND u.status = "active"
                  AND b1.blocker_id IS NULL
                  AND b2.blocker_id IS NULL
                ORDER BY u.created_at DESC
                LIMIT :limit';
        $stmt = Database::connection()->prepare($sql);
        $stmt->bindValue(':user', $userId, \PDO::PARAM_INT);
        $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }
}
