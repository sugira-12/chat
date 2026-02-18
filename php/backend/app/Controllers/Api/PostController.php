<?php
namespace App\Controllers\Api;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;
use App\Core\Uploader;
use App\Models\Notification;
use App\Models\Post;
use App\Models\PostTag;
use App\Models\User;

class PostController
{
    public function create(Request $request): void
    {
        $postId = Post::create([
            'user_id' => Auth::id(),
            'body' => $request->input('body'),
            'visibility' => $request->input('visibility', 'public'),
        ]);
        $mediaInput = $request->file('media');
        $mediaFiles = Uploader::normalizeFiles($mediaInput);
        foreach ($mediaFiles as $file) {
            $stored = Uploader::store($file, 'posts', [
                'image/jpeg', 'image/png', 'image/gif', 'image/webp',
                'video/mp4', 'video/quicktime', 'video/webm',
            ]);
            if (!$stored) {
                continue;
            }
            $mediaType = strpos($stored['mime'], 'video/') === 0 ? 'video' : 'image';
            Post::addMedia($postId, $mediaType, $stored['url']);
        }
        $post = Post::findById($postId);
        Response::json(['post' => $post], 201);
    }

    public function feed(Request $request): void
    {
        $limit = (int)$request->input('limit', 20);
        $offset = (int)$request->input('offset', 0);
        $feed = Post::feed(Auth::id(), $limit, $offset);
        Response::json(['items' => $feed]);
    }

    public function like(Request $request, array $params): void
    {
        $postId = (int)$params['id'];
        Post::like(Auth::id(), $postId);
        $post = Post::findById($postId);
        if ($post && (int)$post['user_id'] !== Auth::id()) {
            Notification::create((int)$post['user_id'], Auth::id(), 'like', ['post_id' => $postId]);
        }
        Response::json(['status' => 'liked']);
    }

    public function unlike(Request $request, array $params): void
    {
        Post::unlike(Auth::id(), (int)$params['id']);
        Response::json(['status' => 'unliked']);
    }

    public function comment(Request $request, array $params): void
    {
        $body = $request->input('body');
        if (!$body) {
            Response::error('Comment body required', 422);
        }
        $postId = (int)$params['id'];
        Post::comment(Auth::id(), $postId, $body, $request->input('parent_id'));
        $post = Post::findById($postId);
        if ($post && (int)$post['user_id'] !== Auth::id()) {
            Notification::create((int)$post['user_id'], Auth::id(), 'comment', ['post_id' => $postId]);
        }
        Response::json(['status' => 'commented']);
    }

    public function comments(Request $request, array $params): void
    {
        $postId = (int)$params['id'];
        $limit = (int)$request->input('limit', 30);
        $items = Post::comments($postId, $limit);
        Response::json(['items' => $items]);
    }

    public function share(Request $request, array $params): void
    {
        $postId = (int)$params['id'];
        Post::share(Auth::id(), $postId, $request->input('text'));
        $post = Post::findById($postId);
        if ($post && (int)$post['user_id'] !== Auth::id()) {
            Notification::create((int)$post['user_id'], Auth::id(), 'message', ['post_id' => $postId, 'action' => 'share']);
        }
        Response::json(['status' => 'shared']);
    }

    public function bookmark(Request $request, array $params): void
    {
        Post::bookmark(Auth::id(), (int)$params['id']);
        Response::json(['status' => 'bookmarked']);
    }

    public function tag(Request $request, array $params): void
    {
        $postId = (int)$params['id'];
        $post = Post::findById($postId);
        if (!$post) {
            Response::error('Post not found', 404);
        }
        $ids = $request->input('user_ids', []);
        $single = $request->input('user_id');
        if ($single) {
            $ids[] = $single;
        }
        $ids = array_values(array_filter(array_map('intval', (array)$ids)));
        if (!$ids) {
            Response::error('user_id required', 422);
        }
        foreach ($ids as $taggedId) {
            $user = User::findById($taggedId);
            if (!$user) {
                continue;
            }
            PostTag::tag($postId, $taggedId, Auth::id());
            if ($taggedId !== Auth::id()) {
                Notification::create($taggedId, Auth::id(), 'tag', ['post_id' => $postId]);
            }
        }
        Response::json(['status' => 'tagged']);
    }
}
