<?php
namespace App\Core;

class RateLimiter
{
    public static function hit(string $key, int $maxAttempts, int $windowSeconds): bool
    {
        $path = __DIR__ . '/../../storage/ratelimit/' . md5($key) . '.json';
        $now = time();
        $data = ['count' => 0, 'reset_at' => $now + $windowSeconds];
        if (file_exists($path)) {
            $stored = json_decode(file_get_contents($path), true);
            if (is_array($stored)) {
                $data = $stored;
            }
        }
        if ($now > $data['reset_at']) {
            $data = ['count' => 0, 'reset_at' => $now + $windowSeconds];
        }
        $data['count']++;
        file_put_contents($path, json_encode($data));
        return $data['count'] <= $maxAttempts;
    }
}
