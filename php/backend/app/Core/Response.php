<?php
namespace App\Core;

class Response
{
    public static function json($data, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json');
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        header('Pragma: no-cache');
        echo json_encode($data);
        exit;
    }

    public static function error(string $message, int $status = 400, array $details = []): void
    {
        $payload = ['error' => $message];
        if ($details) {
            $payload['details'] = $details;
        }
        self::json($payload, $status);
    }

    public static function noContent(): void
    {
        http_response_code(204);
        exit;
    }
}
