<?php
namespace App\Controllers\Api;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;
use App\Models\Report;
use App\Models\Post;
use App\Models\User;

class ReportController
{
    public function create(Request $request): void
    {
        $type = $request->input('type');
        $targetId = (int)$request->input('target_id');
        $reason = trim((string)$request->input('reason', ''));

        if (!in_array($type, ['user', 'post'], true) || !$targetId || strlen($reason) < 3) {
            Response::error('Invalid report', 422);
        }

        if ($type === 'user' && !User::findById($targetId)) {
            Response::error('User not found', 404);
        }
        if ($type === 'post' && !Post::findById($targetId)) {
            Response::error('Post not found', 404);
        }

        Report::create(Auth::id(), $type, $targetId, $reason);
        Response::json(['status' => 'reported']);
    }
}
