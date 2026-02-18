<?php
namespace App\Controllers\Api;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;
use App\Core\Uploader;
use App\Models\Notification;
use App\Models\Story;

class StoryController
{
    public function index(Request $request): void
    {
        $items = Story::activeForUser(Auth::id());
        Response::json(['items' => $items]);
    }

    public function create(Request $request): void
    {
        $fileInput = $request->file('media');
        $files = Uploader::normalizeFiles($fileInput);
        if (!$files) {
            Response::error('Story media required', 422);
        }
        $stored = Uploader::store($files[0], 'stories', [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'video/mp4', 'video/quicktime', 'video/webm',
        ]);
        if (!$stored) {
            Response::error('Invalid media type', 422);
        }
        $mediaType = strpos($stored['mime'], 'video/') === 0 ? 'video' : 'image';
        $expiresAt = date('Y-m-d H:i:s', time() + 60 * 60 * 24);
        $storyId = Story::create(
            Auth::id(),
            $mediaType,
            $stored['url'],
            $expiresAt,
            trim((string)$request->input('caption', '')) ?: null
        );
        Response::json(['story_id' => $storyId, 'media_url' => $stored['url']], 201);
    }

    public function view(Request $request, array $params): void
    {
        Story::addView((int)$params['id'], Auth::id());
        Response::json(['status' => 'viewed']);
    }

    public function viewers(Request $request, array $params): void
    {
        $items = Story::viewers((int)$params['id']);
        Response::json(['items' => $items]);
    }

    public function reply(Request $request, array $params): void
    {
        $storyId = (int)$params['id'];
        $body = trim((string)$request->input('body', ''));
        if ($body === '') {
            Response::error('Reply body required', 422);
        }
        $ok = Story::addReply($storyId, Auth::id(), $body);
        if (!$ok) {
            Response::error('Unable to add reply', 422);
        }
        $story = Story::findById($storyId);
        if ($story && (int)$story['user_id'] !== Auth::id()) {
            Notification::create((int)$story['user_id'], Auth::id(), 'comment', [
                'story_id' => $storyId,
                'action' => 'story_reply',
            ]);
        }
        Response::json(['status' => 'replied'], 201);
    }

    public function replies(Request $request, array $params): void
    {
        $limit = (int)$request->input('limit', 30);
        $items = Story::replies((int)$params['id'], $limit);
        Response::json(['items' => $items]);
    }
}
