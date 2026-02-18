<?php
namespace App\Core;

class Jwt
{
    public static function encode(array $payload, string $secret): string
    {
        $header = ['alg' => 'HS256', 'typ' => 'JWT'];
        $segments = [
            self::base64UrlEncode(json_encode($header)),
            self::base64UrlEncode(json_encode($payload)),
        ];
        $signature = hash_hmac('sha256', implode('.', $segments), $secret, true);
        $segments[] = self::base64UrlEncode($signature);
        return implode('.', $segments);
    }

    public static function decode(string $token): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }
        [$header64, $payload64, $sig64] = $parts;
        $payload = json_decode(self::base64UrlDecode($payload64), true);
        if (!$payload) {
            return null;
        }
        $secret = Config::get('app.jwt_secret');
        $expected = self::base64UrlEncode(hash_hmac('sha256', $header64 . '.' . $payload64, $secret, true));
        if (!hash_equals($expected, $sig64)) {
            return null;
        }
        if (isset($payload['exp']) && time() > $payload['exp']) {
            return null;
        }
        return $payload;
    }

    private static function base64UrlEncode(string $input): string
    {
        return rtrim(strtr(base64_encode($input), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $input): string
    {
        $remainder = strlen($input) % 4;
        if ($remainder) {
            $input .= str_repeat('=', 4 - $remainder);
        }
        return base64_decode(strtr($input, '-_', '+/'));
    }
}
