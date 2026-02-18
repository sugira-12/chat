<?php
namespace App\Middleware;

use App\Core\Auth;
use App\Core\Response;
use App\Models\User;
use App\Models\UserSession;

class AuthMiddleware
{
    public function handle($request): bool
    {
        if (!Auth::check()) {
            Response::error('Unauthorized', 401);
            return false;
        }
        $user = Auth::user();
        if ($user && ($user['status'] ?? 'active') !== 'active') {
            Response::error('Account suspended', 403);
            return false;
        }
        if ($user) {
            User::setOnlineStatus((int)$user['id'], true);
            UserSession::touch((int)$user['id'], session_id());
        }
        return true;
    }
}
