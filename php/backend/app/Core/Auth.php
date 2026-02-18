<?php
namespace App\Core;

use App\Models\User;

class Auth
{
    private static $user;

    public static function user(): ?array
    {
        if (self::$user !== null) {
            return self::$user;
        }
        $token = Request::capture()->bearerToken();
        if ($token) {
            $payload = Jwt::decode($token);
            if ($payload && isset($payload['sub'])) {
                $found = User::findById((int)$payload['sub']);
                self::$user = $found ? User::sanitize($found) : null;
                return self::$user;
            }
        }
        if (isset($_SESSION['user_id'])) {
            $found = User::findById((int)$_SESSION['user_id']);
            self::$user = $found ? User::sanitize($found) : null;
            return self::$user;
        }
        return null;
    }

    public static function id(): ?int
    {
        $user = self::user();
        return $user ? (int)$user['id'] : null;
    }

    public static function check(): bool
    {
        return self::user() !== null;
    }
}
