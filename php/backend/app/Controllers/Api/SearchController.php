<?php
namespace App\Controllers\Api;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;
use App\Models\Post;
use App\Models\User;

class SearchController
{
    public function index(Request $request): void
    {
        $query = preg_replace('/\s+/', ' ', trim((string)$request->input('q', '')));
        if ($query === '' || mb_strlen($query) < 2) {
            Response::json(['users' => [], 'posts' => []]);
        }
        $limit = (int)$request->input('limit', 8);
        $users = User::search($query, $limit);
        $posts = Post::search($query, $limit);
        Response::json(['users' => $users, 'posts' => $posts]);
    }

    public function friends(Request $request): void
    {
        $query = preg_replace('/\s+/', ' ', trim((string)$request->input('q', '')));
        if ($query === '' || mb_strlen($query) < 1) {
            Response::json(['items' => []]);
        }
        $limit = (int)$request->input('limit', 20);
        $items = User::searchFriends(Auth::id(), $query, $limit);
        Response::json(['items' => $items]);
    }
}
