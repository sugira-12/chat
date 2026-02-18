<?php
namespace App\Controllers\Api;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;
use App\Core\Uploader;
use App\Models\Album;
use App\Models\Event;
use App\Models\Group;
use App\Models\Page;
use App\Models\PinnedPost;
use App\Models\Post;
use App\Models\PostTag;
use App\Models\ProfileDetail;
use App\Models\Story;
use App\Models\StoryHighlight;
use App\Models\User;

class ProfileController
{
    private function canViewProfile(int $viewerId, array $user): bool
    {
        if ($viewerId && (int)$user['id'] === $viewerId) {
            return true;
        }
        if ((int)($user['is_private'] ?? 0) === 0) {
            return true;
        }
        if ($viewerId && User::areFriends($viewerId, (int)$user['id'])) {
            return true;
        }
        if ($viewerId && User::isFollowing($viewerId, (int)$user['id'])) {
            return true;
        }
        return false;
    }

    public function overview(Request $request, array $params): void
    {
        $userId = (int)$params['id'];
        $viewerId = Auth::id();
        $user = User::findById($userId);
        if (!$user) {
            Response::error('User not found', 404);
        }

        $intro = ProfileDetail::getForUser($userId);
        $stats = User::stats($userId);
        $friends = User::friendsList($userId, 6);
        $friendsCount = User::friendsCount($userId);
        $mutual = $viewerId && $viewerId !== $userId
            ? User::mutualFriendsCount($viewerId, $userId)
            : 0;
        $canView = $this->canViewProfile($viewerId, $user);

        $highlights = $canView ? StoryHighlight::listByUser($userId, 6) : [];
        $albums = $canView ? Album::listByUser($userId, 6) : [];
        $pins = $canView ? PinnedPost::listByUser($userId, 3) : [];
        $media = $canView && (int)($intro['show_photos'] ?? 1) === 1 ? User::mediaByUser($userId, null, 9) : [];
        $tagged = $canView ? PostTag::listTagged($userId, 9) : [];
        $activity = $canView && (int)($intro['show_activity'] ?? 1) === 1 ? User::activityByUser($userId, 10) : [];
        $groups = $canView ? Group::listByUser($userId, 6) : [];
        $pages = $canView ? Page::listByUser($userId, 6) : [];
        $events = $canView ? Event::listByUser($userId, 6) : [];

        if (!$canView) {
            $friends = [];
        } else if ((int)($intro['show_friends'] ?? 1) === 0 && $viewerId !== $userId) {
            $friends = [];
        }

        Response::json([
            'user' => User::sanitize($user),
            'stats' => $stats,
            'intro' => $intro,
            'friends' => $friends,
            'friends_count' => $friendsCount,
            'mutual_friends' => $mutual,
            'highlights' => $highlights,
            'albums' => $albums,
            'pinned_posts' => $pins,
            'media' => $media,
            'tagged' => $tagged,
            'activity' => $activity,
            'groups' => $groups,
            'pages' => $pages,
            'events' => $events,
            'locked' => !$canView,
        ]);
    }

    public function updateIntro(Request $request): void
    {
        $userId = Auth::id();
        $allowed = [
            'workplace', 'education', 'hometown', 'location', 'relationship_status',
            'pronouns', 'birthday', 'show_friends', 'show_followers', 'show_photos', 'show_activity'
        ];
        $data = array_intersect_key($request->body, array_flip($allowed));
        ProfileDetail::upsert($userId, $data);
        Response::json(['intro' => ProfileDetail::getForUser($userId)]);
    }

    public function friends(Request $request, array $params): void
    {
        $userId = (int)$params['id'];
        $limit = (int)$request->input('limit', 50);
        $offset = (int)$request->input('offset', 0);
        $user = User::findById($userId);
        if (!$user) {
            Response::error('User not found', 404);
        }
        if (!$this->canViewProfile(Auth::id(), $user)) {
            Response::error('Profile is private', 403);
        }
        $items = User::friendsList($userId, $limit, $offset);
        Response::json(['items' => $items]);
    }

    public function media(Request $request, array $params): void
    {
        $userId = (int)$params['id'];
        $type = $request->input('type');
        $limit = (int)$request->input('limit', 30);
        $user = User::findById($userId);
        if (!$user) {
            Response::error('User not found', 404);
        }
        if (!$this->canViewProfile(Auth::id(), $user)) {
            Response::error('Profile is private', 403);
        }
        $items = User::mediaByUser($userId, $type, $limit);
        Response::json(['items' => $items]);
    }

    public function tagged(Request $request, array $params): void
    {
        $userId = (int)$params['id'];
        $limit = (int)$request->input('limit', 30);
        $user = User::findById($userId);
        if (!$user) {
            Response::error('User not found', 404);
        }
        if (!$this->canViewProfile(Auth::id(), $user)) {
            Response::error('Profile is private', 403);
        }
        $items = PostTag::listTagged($userId, $limit);
        Response::json(['items' => $items]);
    }

    public function activity(Request $request, array $params): void
    {
        $userId = (int)$params['id'];
        $limit = (int)$request->input('limit', 20);
        $user = User::findById($userId);
        if (!$user) {
            Response::error('User not found', 404);
        }
        if (!$this->canViewProfile(Auth::id(), $user)) {
            Response::error('Profile is private', 403);
        }
        $items = User::activityByUser($userId, $limit);
        Response::json(['items' => $items]);
    }

    public function highlights(Request $request, array $params): void
    {
        $userId = (int)$params['id'];
        $user = User::findById($userId);
        if (!$user) {
            Response::error('User not found', 404);
        }
        if (!$this->canViewProfile(Auth::id(), $user)) {
            Response::error('Profile is private', 403);
        }
        $items = StoryHighlight::listByUser($userId, 20);
        Response::json(['items' => $items]);
    }

    public function highlightItems(Request $request, array $params): void
    {
        $highlightId = (int)$params['id'];
        $highlight = StoryHighlight::findById($highlightId);
        if (!$highlight) {
            Response::error('Highlight not found', 404);
        }
        $user = User::findById((int)$highlight['user_id']);
        if (!$user) {
            Response::error('User not found', 404);
        }
        if (!$this->canViewProfile(Auth::id(), $user)) {
            Response::error('Profile is private', 403);
        }
        $items = StoryHighlight::listItems($highlightId);
        Response::json(['items' => $items]);
    }

    public function createHighlight(Request $request): void
    {
        $title = trim((string)$request->input('title', ''));
        if ($title === '') {
            Response::error('Title required', 422);
        }
        $coverUrl = $request->input('cover_url');
        $id = StoryHighlight::create(Auth::id(), $title, $coverUrl);
        Response::json(['id' => $id], 201);
    }

    public function addHighlightItem(Request $request, array $params): void
    {
        $highlightId = (int)$params['id'];
        if (!StoryHighlight::belongsTo($highlightId, Auth::id())) {
            Response::error('Not allowed', 403);
        }
        $storyId = (int)$request->input('story_id', 0);
        $mediaUrl = $request->input('media_url');
        $mediaType = $request->input('media_type');

        if ($storyId) {
            $story = Story::findById($storyId);
            if ($story && (int)$story['user_id'] === Auth::id()) {
                $mediaUrl = $story['media_url'];
                $mediaType = $story['media_type'];
            } else {
                Response::error('Story not found', 404);
            }
        }

        if (!$mediaUrl || !$mediaType) {
            Response::error('media_url and media_type required', 422);
        }

        $itemId = StoryHighlight::addItem($highlightId, [
            'story_id' => $storyId ?: null,
            'media_url' => $mediaUrl,
            'media_type' => $mediaType,
            'caption' => $request->input('caption'),
            'sort_order' => (int)$request->input('sort_order', 0),
        ]);
        Response::json(['id' => $itemId], 201);
    }

    public function deleteHighlight(Request $request, array $params): void
    {
        $ok = StoryHighlight::delete((int)$params['id'], Auth::id());
        if (!$ok) {
            Response::error('Unable to delete', 422);
        }
        Response::json(['status' => 'deleted']);
    }

    public function deleteHighlightItem(Request $request, array $params): void
    {
        $ok = StoryHighlight::deleteItem((int)$params['itemId'], Auth::id());
        if (!$ok) {
            Response::error('Unable to delete', 422);
        }
        Response::json(['status' => 'deleted']);
    }

    public function albums(Request $request, array $params): void
    {
        $userId = (int)$params['id'];
        $user = User::findById($userId);
        if (!$user) {
            Response::error('User not found', 404);
        }
        if (!$this->canViewProfile(Auth::id(), $user)) {
            Response::error('Profile is private', 403);
        }
        $items = Album::listByUser($userId, 20);
        Response::json(['items' => $items]);
    }

    public function albumItems(Request $request, array $params): void
    {
        $albumId = (int)$params['id'];
        $album = Album::findById($albumId);
        if (!$album) {
            Response::error('Album not found', 404);
        }
        $user = User::findById((int)$album['user_id']);
        if (!$user) {
            Response::error('User not found', 404);
        }
        if (!$this->canViewProfile(Auth::id(), $user)) {
            Response::error('Profile is private', 403);
        }
        $items = Album::listItems($albumId);
        Response::json(['items' => $items]);
    }

    public function createAlbum(Request $request): void
    {
        $title = trim((string)$request->input('title', ''));
        if ($title === '') {
            Response::error('Title required', 422);
        }
        $id = Album::create(Auth::id(), $title, $request->input('description'), $request->input('cover_url'));
        Response::json(['id' => $id], 201);
    }

    public function addAlbumItem(Request $request, array $params): void
    {
        $albumId = (int)$params['id'];
        if (!Album::belongsTo($albumId, Auth::id())) {
            Response::error('Not allowed', 403);
        }
        $mediaUrl = $request->input('media_url');
        $mediaType = $request->input('media_type');
        if (!$mediaUrl || !$mediaType) {
            Response::error('media_url and media_type required', 422);
        }
        $itemId = Album::addItem($albumId, [
            'post_media_id' => $request->input('post_media_id'),
            'media_url' => $mediaUrl,
            'media_type' => $mediaType,
            'caption' => $request->input('caption'),
            'sort_order' => (int)$request->input('sort_order', 0),
        ]);
        Response::json(['id' => $itemId], 201);
    }

    public function deleteAlbum(Request $request, array $params): void
    {
        $ok = Album::delete((int)$params['id'], Auth::id());
        if (!$ok) {
            Response::error('Unable to delete', 422);
        }
        Response::json(['status' => 'deleted']);
    }

    public function deleteAlbumItem(Request $request, array $params): void
    {
        $ok = Album::deleteItem((int)$params['itemId'], Auth::id());
        if (!$ok) {
            Response::error('Unable to delete', 422);
        }
        Response::json(['status' => 'deleted']);
    }

    public function pins(Request $request, array $params): void
    {
        $userId = (int)$params['id'];
        $user = User::findById($userId);
        if (!$user) {
            Response::error('User not found', 404);
        }
        if (!$this->canViewProfile(Auth::id(), $user)) {
            Response::error('Profile is private', 403);
        }
        $items = PinnedPost::listByUser($userId, 3);
        Response::json(['items' => $items]);
    }

    public function pinPost(Request $request): void
    {
        $postId = (int)$request->input('post_id');
        if (!$postId) {
            Response::error('post_id required', 422);
        }
        $post = Post::findById($postId);
        if (!$post || (int)$post['user_id'] !== Auth::id()) {
            Response::error('You can only pin your own posts', 403);
        }
        PinnedPost::pin(Auth::id(), $postId);
        Response::json(['status' => 'pinned']);
    }

    public function unpinPost(Request $request, array $params): void
    {
        $ok = PinnedPost::unpin(Auth::id(), (int)$params['id']);
        if (!$ok) {
            Response::error('Unable to unpin', 422);
        }
        Response::json(['status' => 'unpinned']);
    }

    public function groups(Request $request, array $params): void
    {
        $userId = (int)$params['id'];
        $user = User::findById($userId);
        if (!$user) {
            Response::error('User not found', 404);
        }
        if (!$this->canViewProfile(Auth::id(), $user)) {
            Response::error('Profile is private', 403);
        }
        $items = Group::listByUser($userId, 10);
        Response::json(['items' => $items]);
    }

    public function createGroup(Request $request): void
    {
        $name = trim((string)$request->input('name', ''));
        if ($name === '') {
            Response::error('Group name required', 422);
        }
        $id = Group::create(Auth::id(), $name, $request->input('description'), $request->input('cover_url'));
        Response::json(['id' => $id], 201);
    }

    public function pages(Request $request, array $params): void
    {
        $userId = (int)$params['id'];
        $user = User::findById($userId);
        if (!$user) {
            Response::error('User not found', 404);
        }
        if (!$this->canViewProfile(Auth::id(), $user)) {
            Response::error('Profile is private', 403);
        }
        $items = Page::listByUser($userId, 10);
        Response::json(['items' => $items]);
    }

    public function createPage(Request $request): void
    {
        $name = trim((string)$request->input('name', ''));
        if ($name === '') {
            Response::error('Page name required', 422);
        }
        $id = Page::create(Auth::id(), $name, $request->input('category'), $request->input('description'), $request->input('cover_url'));
        Response::json(['id' => $id], 201);
    }

    public function events(Request $request, array $params): void
    {
        $userId = (int)$params['id'];
        $user = User::findById($userId);
        if (!$user) {
            Response::error('User not found', 404);
        }
        if (!$this->canViewProfile(Auth::id(), $user)) {
            Response::error('Profile is private', 403);
        }
        $items = Event::listByUser($userId, 10);
        Response::json(['items' => $items]);
    }

    public function createEvent(Request $request): void
    {
        $title = trim((string)$request->input('title', ''));
        $startsAt = trim((string)$request->input('starts_at', ''));
        if ($title === '' || $startsAt === '') {
            Response::error('Title and starts_at required', 422);
        }
        $id = Event::create(
            Auth::id(),
            $title,
            $request->input('description'),
            $request->input('location'),
            $startsAt,
            $request->input('ends_at'),
            $request->input('cover_url')
        );
        Response::json(['id' => $id], 201);
    }

    public function posts(Request $request, array $params): void
    {
        $userId = (int)$params['id'];
        $type = $request->input('type');
        $limit = (int)$request->input('limit', 20);
        $offset = (int)$request->input('offset', 0);
        $user = User::findById($userId);
        if (!$user) {
            Response::error('User not found', 404);
        }
        if (!$this->canViewProfile(Auth::id(), $user)) {
            Response::error('Profile is private', 403);
        }
        $items = Post::byUserFiltered($userId, $type, $limit, $offset);
        Response::json(['items' => $items]);
    }
}
