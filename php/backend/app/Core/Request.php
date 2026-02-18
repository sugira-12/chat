<?php
namespace App\Core;

class Request
{
    public $method;
    public $path;
    public $query;
    public $body;
    public $headers;
    public $ip;
    public $files;

    public static function capture(): self
    {
        return new self();
    }

    public function __construct()
    {
        $this->method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
        $scriptName = $_SERVER['SCRIPT_NAME'] ?? '';
        $baseDir = rtrim(str_replace('\\', '/', dirname($scriptName)), '/');
        if ($baseDir !== '' && strpos($path, $baseDir) === 0) {
            $path = substr($path, strlen($baseDir));
        }
        if (strpos($path, '/index.php') === 0) {
            $path = substr($path, strlen('/index.php'));
        }
        if ($path === '') {
            $path = '/';
        }
        if ($path[0] !== '/') {
            $path = '/' . $path;
        }
        $this->path = $path;
        $this->query = $_GET;
        $this->headers = function_exists('getallheaders') ? (getallheaders() ?: []) : [];
        $raw = file_get_contents('php://input');
        $json = json_decode($raw, true);
        $this->body = is_array($json) ? $json : $_POST;
        $this->files = $_FILES ?? [];
        $this->ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    }

    public function input(string $key, $default = null)
    {
        if (array_key_exists($key, $this->body)) {
            return $this->body[$key];
        }
        if (array_key_exists($key, $this->query)) {
            return $this->query[$key];
        }
        return $default;
    }

    public function bearerToken(): ?string
    {
        $header = $this->headers['Authorization'] ?? $this->headers['authorization'] ?? '';
        if (preg_match('/Bearer\s+(.*)$/i', $header, $matches)) {
            return trim($matches[1]);
        }
        return null;
    }

    public function file(string $key)
    {
        return $this->files[$key] ?? null;
    }
}
