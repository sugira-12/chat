<?php
namespace App\Core;

class Uploader
{
    public static function normalizeFiles($fileInput): array
    {
        if (!is_array($fileInput) || !isset($fileInput['name'])) {
            return [];
        }
        if (is_array($fileInput['name'])) {
            $files = [];
            foreach ($fileInput['name'] as $i => $name) {
                $files[] = [
                    'name' => $name,
                    'type' => $fileInput['type'][$i] ?? null,
                    'tmp_name' => $fileInput['tmp_name'][$i] ?? null,
                    'error' => $fileInput['error'][$i] ?? null,
                    'size' => $fileInput['size'][$i] ?? null,
                ];
            }
            return $files;
        }
        return [$fileInput];
    }

    public static function store(array $file, string $subdir, array $allowedMimes): ?array
    {
        if (!isset($file['tmp_name']) || (int)$file['error'] !== 0) {
            return null;
        }
        $mime = mime_content_type($file['tmp_name']) ?: ($file['type'] ?? '');
        if ($allowedMimes) {
            $allowed = false;
            foreach ($allowedMimes as $allowedMime) {
                if ($allowedMime === $mime) {
                    $allowed = true;
                    break;
                }
                if (str_ends_with($allowedMime, '/*')) {
                    $prefix = substr($allowedMime, 0, -1);
                    if (strpos($mime, $prefix) === 0) {
                        $allowed = true;
                        break;
                    }
                }
            }
            if (!$allowed) {
                return null;
            }
        }
        $extension = pathinfo($file['name'] ?? '', PATHINFO_EXTENSION);
        $filename = bin2hex(random_bytes(16)) . ($extension ? '.' . $extension : '');
        $root = __DIR__ . '/../../public/uploads';
        $targetDir = $root . '/' . trim($subdir, '/');
        if (!is_dir($targetDir)) {
            mkdir($targetDir, 0775, true);
        }
        $target = $targetDir . '/' . $filename;
        if (!move_uploaded_file($file['tmp_name'], $target)) {
            return null;
        }

        $baseUrl = Config::get('app.base_url');
        $relative = '/uploads/' . trim($subdir, '/') . '/' . $filename;

        return [
            'path' => $relative,
            'url' => rtrim($baseUrl, '/') . $relative,
            'mime' => $mime,
            'size' => (int)($file['size'] ?? 0),
        ];
    }
}
