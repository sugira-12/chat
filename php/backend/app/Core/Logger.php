<?php
namespace App\Core;

class Logger
{
    private static function write(string $level, string $message, array $context = []): void
    {
        $dir = __DIR__ . '/../../storage/app';
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        $path = $dir . '/app.log';
        $entry = [
            'time' => date('c'),
            'level' => $level,
            'message' => $message,
            'context' => $context,
        ];
        @file_put_contents($path, json_encode($entry) . PHP_EOL, FILE_APPEND);
    }

    public static function info(string $message, array $context = []): void
    {
        self::write('info', $message, $context);
    }

    public static function warning(string $message, array $context = []): void
    {
        self::write('warning', $message, $context);
    }

    public static function error(string $message, array $context = []): void
    {
        self::write('error', $message, $context);
    }
}
