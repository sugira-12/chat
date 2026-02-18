<?php
namespace App\Models;

use App\Core\Database;

class AccountChange
{
    public static function create(int $userId, ?string $newEmail, ?string $newUsername): string
    {
        $token = bin2hex(random_bytes(32));
        $stmt = Database::connection()->prepare(
            'INSERT INTO account_changes (user_id, new_email, new_username, token, expires_at, created_at)
             VALUES (:user_id, :new_email, :new_username, :token, DATE_ADD(NOW(), INTERVAL 1 DAY), NOW())'
        );
        $stmt->execute([
            'user_id' => $userId,
            'new_email' => $newEmail,
            'new_username' => $newUsername,
            'token' => $token,
        ]);
        return $token;
    }

    public static function apply(string $token): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT * FROM account_changes WHERE token = :token AND expires_at > NOW() LIMIT 1'
        );
        $stmt->execute(['token' => $token]);
        $row = $stmt->fetch();
        if (!$row) {
            return null;
        }

        $newEmail = $row['new_email'] ?: null;
        $newUsername = $row['new_username'] ?: null;

        if ($newEmail) {
            $emailCheck = Database::connection()->prepare(
                'SELECT id FROM users WHERE email = :email AND id <> :id LIMIT 1'
            );
            $emailCheck->execute([
                'email' => $newEmail,
                'id' => $row['user_id'],
            ]);
            if ($emailCheck->fetch()) {
                return null;
            }
        }
        if ($newUsername) {
            $usernameCheck = Database::connection()->prepare(
                'SELECT id FROM users WHERE username = :username AND id <> :id LIMIT 1'
            );
            $usernameCheck->execute([
                'username' => $newUsername,
                'id' => $row['user_id'],
            ]);
            if ($usernameCheck->fetch()) {
                return null;
            }
        }

        $updates = [];
        $params = ['id' => $row['user_id']];
        if ($newEmail) {
            $updates[] = 'email = :email';
            $updates[] = 'email_verified_at = NOW()';
            $params['email'] = $newEmail;
        }
        if ($newUsername) {
            $updates[] = 'username = :username';
            $params['username'] = $newUsername;
        }
        if (!$updates) {
            return null;
        }
        $sql = 'UPDATE users SET ' . implode(', ', $updates) . ' WHERE id = :id';
        Database::connection()->prepare($sql)->execute($params);
        Database::connection()->prepare('DELETE FROM account_changes WHERE token = :token')
            ->execute(['token' => $token]);
        return [
            'email' => $newEmail,
            'username' => $newUsername,
        ];
    }
}
