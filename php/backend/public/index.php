<?php
require __DIR__ . '/../bootstrap/autoload.php';

use App\Core\Config;
use App\Core\Logger;
use App\Core\Request;
use App\Core\Response;
use App\Core\Router;

session_name(Config::get('app.session_name'));
session_start();

$debug = Config::get('app.debug');
if ($debug) {
    error_reporting(E_ALL);
    ini_set('display_errors', '1');
} else {
    ini_set('display_errors', '0');
}
ini_set('log_errors', '1');

set_error_handler(function ($severity, $message, $file, $line) {
    if (!(error_reporting() & $severity)) {
        return false;
    }
    Logger::error('php_error', [
        'severity' => $severity,
        'message' => $message,
        'file' => $file,
        'line' => $line,
    ]);
    return false;
});

set_exception_handler(function ($exception) use ($debug) {
    Logger::error('unhandled_exception', [
        'message' => $exception->getMessage(),
        'file' => $exception->getFile(),
        'line' => $exception->getLine(),
    ]);
    if (strpos($_SERVER['REQUEST_URI'] ?? '', '/api/') === 0) {
        Response::error($debug ? $exception->getMessage() : 'Server error', 500);
    }
    http_response_code(500);
    echo $debug ? $exception->getMessage() : 'Server error';
    exit;
});

// Basic CORS for local development.
if (strpos($_SERVER['REQUEST_URI'], '/api/') === 0) {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

$router = new Router();
require __DIR__ . '/../routes/api.php';
require __DIR__ . '/../routes/web.php';
$router->dispatch(Request::capture());
