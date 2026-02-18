<?php
namespace App\Middleware;

use App\Core\Auth;
use App\Core\Response;

class AdminMiddleware
{
    public function handle($request): bool
    {
        $user = Auth::user();
        if (!$user || ($user['role'] ?? 'user') !== 'admin') {
            Response::error('Forbidden', 403);
            return false;
        }
        return true;
    }
}
