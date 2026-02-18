<?php
namespace App\Controllers\Api;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;
use App\Core\Uploader;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\MessageRequest;
use App\Models\Notification;
use App\Models\User;
use App\Models\UserSettings;
use App\Services\Realtime;

class ChatController
{
    private function typingFilePath(int $conversationId): string
    {
        return __DIR__ . '/../../../storage/app/typing_' . $conversationId . '.json';
    }

    private function writeTypingState(int $conversationId, int $userId): void
    {
        $path = $this->typingFilePath($conversationId);
        $state = [];
        if (file_exists($path)) {
            $decoded = json_decode((string)file_get_contents($path), true);
            if (is_array($decoded)) {
                $state = $decoded;
            }
        }
        $state[(string)$userId] = time();
        @file_put_contents($path, json_encode($state));
    }

    private function clearTypingState(int $conversationId, int $userId): void
    {
        $path = $this->typingFilePath($conversationId);
        if (!file_exists($path)) {
            return;
        }
        $decoded = json_decode((string)file_get_contents($path), true);
        if (!is_array($decoded)) {
            return;
        }
        unset($decoded[(string)$userId]);
        @file_put_contents($path, json_encode($decoded));
    }

    private function getActiveTypers(int $conversationId, int $viewerId): array
    {
        $path = $this->typingFilePath($conversationId);
        if (!file_exists($path)) {
            return [];
        }
        $decoded = json_decode((string)file_get_contents($path), true);
        if (!is_array($decoded)) {
            return [];
        }

        $now = time();
        $active = [];
        foreach ($decoded as $userId => $timestamp) {
            $uid = (int)$userId;
            $ts = (int)$timestamp;
            if ($uid === $viewerId) {
                continue;
            }
            if (($now - $ts) > 6) {
                continue;
            }
            $user = User::findById($uid);
            if (!$user) {
                continue;
            }
            $active[] = [
                'id' => $uid,
                'username' => $user['username'],
                'name' => $user['name'],
            ];
        }
        return $active;
    }

    public function createConversation(Request $request): void
    {
        $type = $request->input('type', 'direct');
        if ($type === 'group') {
            $title = $request->input('title', 'Group Chat');
            $participants = $request->input('participants', []);
            $conversationId = Conversation::createGroup($title, Auth::id(), $participants);
        } else {
            $otherId = (int)$request->input('user_id');
            if (!$otherId) {
                Response::error('User id required', 422);
            }
            if ($otherId === Auth::id()) {
                Response::error('Cannot create a chat with yourself', 422);
            }
            $otherUser = User::findById($otherId);
            if (!$otherUser) {
                Response::error('User not found', 404);
            }
            if (!User::canMessage(Auth::id(), $otherId)) {
                Response::error('User does not accept message requests', 403);
            }
            $conversationId = Conversation::createDirect(Auth::id(), $otherId);
            if (!User::areFriends(Auth::id(), $otherId)) {
                $existing = MessageRequest::findBetween(Auth::id(), $otherId);
                if (!$existing) {
                    $requestId = MessageRequest::create($conversationId, Auth::id(), $otherId);
                    Notification::create($otherId, Auth::id(), 'message', [
                        'kind' => 'message_request',
                        'request_id' => $requestId,
                        'conversation_id' => $conversationId,
                    ]);
                }
            }
        }
        Response::json(['conversation_id' => $conversationId], 201);
    }

    public function listConversations(Request $request): void
    {
        $items = Conversation::listForUser(Auth::id());
        Response::json(['items' => $items]);
    }

    public function listMessageRequests(Request $request): void
    {
        Response::json([
            'incoming' => MessageRequest::listIncoming(Auth::id()),
            'sent' => MessageRequest::listSent(Auth::id()),
        ]);
    }

    public function messages(Request $request, array $params): void
    {
        $limit = (int)$request->input('limit', 50);
        $offset = (int)$request->input('offset', 0);
        $afterId = (int)$request->input('after_id', 0);
        $conversationId = (int)$params['id'];
        if (!Conversation::isParticipant($conversationId, Auth::id())) {
            Response::error('Forbidden', 403);
        }
        $messages = Message::listByConversation(
            $conversationId,
            $limit,
            $offset,
            $afterId > 0 ? $afterId : null
        );
        Response::json(['items' => $messages]);
    }

    public function sendMessage(Request $request, array $params): void
    {
        $conversationId = (int)$params['id'];
        if (!Conversation::isParticipant($conversationId, Auth::id())) {
            Response::error('Forbidden', 403);
        }
        $conversation = Conversation::findById($conversationId);
        if ($conversation && $conversation['type'] === 'direct') {
            $otherId = Conversation::otherParticipantId($conversationId, Auth::id());
            if ($otherId && !User::canMessage(Auth::id(), $otherId)) {
                Response::error('User does not accept message requests', 403);
            }
            if ($otherId && !User::areFriends(Auth::id(), $otherId)) {
                $messageRequest = MessageRequest::findBetween(Auth::id(), $otherId);
                if (!$messageRequest) {
                    $requestId = MessageRequest::create($conversationId, Auth::id(), $otherId);
                    Notification::create($otherId, Auth::id(), 'message', [
                        'kind' => 'message_request',
                        'request_id' => $requestId,
                        'conversation_id' => $conversationId,
                    ]);
                } elseif (($messageRequest['status'] ?? '') === 'denied') {
                    Response::error('Message request denied by recipient', 403);
                } elseif (($messageRequest['status'] ?? '') === 'pending'
                    && (int)$messageRequest['requester_id'] !== Auth::id()) {
                    Response::error('Message request pending. Accept or deny it first.', 403);
                }
            }
        }
        $body = $request->input('body');
        $type = $request->input('type', 'text');
        $replyTo = $request->input('reply_to');
        $scheduledAt = $request->input('scheduled_at');
        $expiresIn = (int)$request->input('expires_in', 0);
        $expiresAt = null;
        if ($expiresIn > 0) {
            $expiresAt = date('Y-m-d H:i:s', time() + $expiresIn);
        }

        $status = 'sent';
        if ($scheduledAt) {
            $ts = strtotime((string)$scheduledAt);
            if ($ts && $ts > time()) {
                $status = 'scheduled';
                $scheduledAt = date('Y-m-d H:i:s', $ts);
            } else {
                $scheduledAt = null;
            }
        } else {
            $scheduledAt = null;
        }

        $messageId = Message::create(
            $conversationId,
            Auth::id(),
            $body,
            $type,
            [
                'reply_to_message_id' => $replyTo ? (int)$replyTo : null,
                'status' => $status,
                'scheduled_at' => $scheduledAt,
                'expires_at' => $expiresAt,
            ]
        );

        $payload = [
            'id' => $messageId,
            'message_id' => $messageId,
            'conversation_id' => $conversationId,
            'sender_id' => Auth::id(),
            'body' => $body,
            'type' => $type,
            'created_at' => date('c'),
            'read_count' => 0,
        ];
        if ($replyTo) {
            $reply = Message::findById((int)$replyTo);
            if ($reply) {
                $payload['reply_body'] = $reply['body'];
                $replyUser = User::findById((int)$reply['sender_id']);
                $payload['reply_username'] = $replyUser['username'] ?? null;
            }
        }
        $sender = Auth::user();
        if ($sender) {
            $payload['username'] = $sender['username'] ?? null;
            $payload['avatar_url'] = $sender['avatar_url'] ?? null;
        }

        if ($status === 'scheduled') {
            Response::json(['message' => $payload, 'status' => 'scheduled'], 201);
        }

        $this->clearTypingState($conversationId, Auth::id());
        Realtime::trigger(['private-conversation.' . $conversationId], 'message.sent', $payload);
        foreach (Conversation::participants($conversationId) as $participant) {
            if ((int)$participant['id'] === Auth::id()) {
                continue;
            }
            Notification::create((int)$participant['id'], Auth::id(), 'message', [
                'conversation_id' => $conversationId,
                'message_id' => $messageId,
            ]);
        }

        Response::json(['message' => $payload], 201);
    }

    public function sendMedia(Request $request, array $params): void
    {
        $conversationId = (int)$params['id'];
        if (!Conversation::isParticipant($conversationId, Auth::id())) {
            Response::error('Forbidden', 403);
        }

        $fileInput = $request->file('file');
        $files = Uploader::normalizeFiles($fileInput);
        if (!$files) {
            Response::error('Media file required', 422);
        }

        $stored = Uploader::store($files[0], 'messages', ['image/*', 'video/*', 'audio/*', 'application/pdf']);
        if (!$stored) {
            Response::error('Invalid media type', 422);
        }

        $mime = $stored['mime'] ?? '';
        $mediaType = 'file';
        if (strpos($mime, 'image/') === 0) {
            $mediaType = 'image';
        } elseif (strpos($mime, 'video/') === 0) {
            $mediaType = 'video';
        } elseif (strpos($mime, 'audio/') === 0) {
            $mediaType = 'audio';
        }

        $messageId = Message::create(
            $conversationId,
            Auth::id(),
            null,
            $mediaType
        );
        MessageAttachment::create($messageId, $mediaType, $stored['url'], null, null, $stored['size'] ?? null);

        $payload = [
            'id' => $messageId,
            'message_id' => $messageId,
            'conversation_id' => $conversationId,
            'sender_id' => Auth::id(),
            'body' => null,
            'type' => $mediaType,
            'created_at' => date('c'),
            'read_count' => 0,
            'media_url' => $stored['url'],
            'media_type' => $mediaType,
        ];
        $sender = Auth::user();
        if ($sender) {
            $payload['username'] = $sender['username'] ?? null;
            $payload['avatar_url'] = $sender['avatar_url'] ?? null;
        }

        Realtime::trigger(['private-conversation.' . $conversationId], 'message.sent', $payload);
        foreach (Conversation::participants($conversationId) as $participant) {
            if ((int)$participant['id'] === Auth::id()) {
                continue;
            }
            Notification::create((int)$participant['id'], Auth::id(), 'message', [
                'conversation_id' => $conversationId,
                'message_id' => $messageId,
            ]);
        }

        Response::json(['message' => $payload], 201);
    }

    public function acceptMessageRequest(Request $request, array $params): void
    {
        $requestId = (int)$params['id'];
        $messageRequest = MessageRequest::findById($requestId);
        $ok = MessageRequest::updateStatus($requestId, Auth::id(), 'accepted');
        if (!$ok) {
            Response::error('Request not found', 404);
        }
        if ($messageRequest) {
            Notification::create((int)$messageRequest['requester_id'], Auth::id(), 'message', [
                'kind' => 'message_request_accepted',
                'request_id' => $requestId,
                'conversation_id' => (int)$messageRequest['conversation_id'],
            ]);
        }
        Response::json(['status' => 'accepted']);
    }

    public function denyMessageRequest(Request $request, array $params): void
    {
        $requestId = (int)$params['id'];
        $messageRequest = MessageRequest::findById($requestId);
        $ok = MessageRequest::updateStatus($requestId, Auth::id(), 'denied');
        if (!$ok) {
            Response::error('Request not found', 404);
        }
        if ($messageRequest) {
            Notification::create((int)$messageRequest['requester_id'], Auth::id(), 'message', [
                'kind' => 'message_request_denied',
                'request_id' => $requestId,
                'conversation_id' => (int)$messageRequest['conversation_id'],
            ]);
        }
        Response::json(['status' => 'denied']);
    }

    public function typing(Request $request, array $params): void
    {
        $conversationId = (int)$params['id'];
        if (!Conversation::isParticipant($conversationId, Auth::id())) {
            Response::error('Forbidden', 403);
        }

        $settings = UserSettings::getForUser(Auth::id());
        if (!empty($settings['hide_typing'])) {
            Response::noContent();
        }

        $this->writeTypingState($conversationId, Auth::id());
        Realtime::trigger(['private-conversation.' . $conversationId], 'typing', [
            'conversation_id' => $conversationId,
            'user_id' => Auth::id(),
            'username' => Auth::user()['username'] ?? null,
        ]);
        Response::noContent();
    }

    public function typingState(Request $request, array $params): void
    {
        $conversationId = (int)$params['id'];
        if (!Conversation::isParticipant($conversationId, Auth::id())) {
            Response::error('Forbidden', 403);
        }
        $users = $this->getActiveTypers($conversationId, Auth::id());
        Response::json(['users' => $users]);
    }

    public function read(Request $request, array $params): void
    {
        $messageId = (int)$params['id'];
        $message = Message::findById($messageId);
        if (!$message || !Conversation::isParticipant((int)$message['conversation_id'], Auth::id())) {
            Response::error('Forbidden', 403);
        }
        $settings = UserSettings::getForUser(Auth::id());
        $trackReceipts = empty($settings['hide_read_receipts']);
        Message::markRead($messageId, Auth::id(), $trackReceipts);
        $senderId = (int)($message['sender_id'] ?? 0);
        if ($senderId && $trackReceipts) {
            Realtime::trigger(['private-user.' . $senderId], 'message.read', [
                'message_id' => $messageId,
                'user_id' => Auth::id(),
            ]);
        }
        Response::noContent();
    }

    public function edit(Request $request, array $params): void
    {
        $messageId = (int)$params['id'];
        $message = Message::findById($messageId);
        if (!$message || !Conversation::isParticipant((int)$message['conversation_id'], Auth::id())) {
            Response::error('Forbidden', 403);
        }
        if ((int)$message['sender_id'] !== Auth::id()) {
            Response::error('Only the sender can edit this message', 403);
        }
        $body = trim((string)$request->input('body', ''));
        if ($body === '') {
            Response::error('Message body required', 422);
        }
        Message::edit($messageId, Auth::id(), $body);
        Response::json(['status' => 'edited']);
    }

    public function delete(Request $request, array $params): void
    {
        $messageId = (int)$params['id'];
        $message = Message::findById($messageId);
        if (!$message || !Conversation::isParticipant((int)$message['conversation_id'], Auth::id())) {
            Response::error('Forbidden', 403);
        }
        $scope = $request->input('scope', 'self');
        if ($scope === 'all') {
            $createdAt = strtotime((string)$message['created_at']);
            if ($createdAt && (time() - $createdAt) > 600) {
                Response::error('Time limit exceeded for delete-for-all', 403);
            }
            Message::deleteForAll($messageId, Auth::id());
            Response::json(['status' => 'deleted_for_all']);
        }

        Message::hideForUser($messageId, Auth::id());
        Response::json(['status' => 'deleted_for_self']);
    }

    public function pin(Request $request, array $params): void
    {
        $conversationId = (int)$params['id'];
        if (!Conversation::isParticipant($conversationId, Auth::id())) {
            Response::error('Forbidden', 403);
        }
        Conversation::pin($conversationId, Auth::id());
        Response::json(['status' => 'pinned']);
    }

    public function unpin(Request $request, array $params): void
    {
        $conversationId = (int)$params['id'];
        if (!Conversation::isParticipant($conversationId, Auth::id())) {
            Response::error('Forbidden', 403);
        }
        Conversation::unpin($conversationId, Auth::id());
        Response::json(['status' => 'unpinned']);
    }

    public function mute(Request $request, array $params): void
    {
        $conversationId = (int)$params['id'];
        if (!Conversation::isParticipant($conversationId, Auth::id())) {
            Response::error('Forbidden', 403);
        }
        $minutes = (int)$request->input('minutes', 60);
        if ($minutes <= 0) {
            Response::error('Invalid duration', 422);
        }
        Conversation::mute($conversationId, Auth::id(), $minutes);
        Response::json(['status' => 'muted']);
    }

    public function unmute(Request $request, array $params): void
    {
        $conversationId = (int)$params['id'];
        if (!Conversation::isParticipant($conversationId, Auth::id())) {
            Response::error('Forbidden', 403);
        }
        Conversation::unmute($conversationId, Auth::id());
        Response::json(['status' => 'unmuted']);
    }

    public function react(Request $request, array $params): void
    {
        $messageId = (int)$params['id'];
        $emoji = $request->input('emoji');
        if (!$emoji) {
            Response::error('Emoji required', 422);
        }
        $message = Message::findById($messageId);
        if (!$message || !Conversation::isParticipant((int)$message['conversation_id'], Auth::id())) {
            Response::error('Forbidden', 403);
        }
        Message::react($messageId, Auth::id(), $emoji);
        Realtime::trigger(['private-message.' . $messageId], 'message.reacted', [
            'message_id' => $messageId,
            'user_id' => Auth::id(),
            'emoji' => $emoji,
        ]);
        Response::json(['status' => 'reacted']);
    }

    public function edits(Request $request, array $params): void
    {
        $messageId = (int)$params['id'];
        $message = Message::findById($messageId);
        if (!$message || !Conversation::isParticipant((int)$message['conversation_id'], Auth::id())) {
            Response::error('Forbidden', 403);
        }
        $items = Message::edits($messageId);
        Response::json(['items' => $items]);
    }

    public function realtimeAuth(Request $request): void
    {
        $socketId = $request->input('socket_id');
        $channelName = $request->input('channel_name');
        if (!$socketId || !$channelName) {
            Response::error('Invalid realtime request', 422);
        }
        if (strpos($channelName, 'private-conversation.') === 0) {
            $conversationId = (int)str_replace('private-conversation.', '', $channelName);
            if (!Conversation::isParticipant($conversationId, Auth::id())) {
                Response::error('Forbidden', 403);
            }
        }
        if (strpos($channelName, 'private-user.') === 0) {
            $userId = (int)str_replace('private-user.', '', $channelName);
            if ($userId !== Auth::id()) {
                Response::error('Forbidden', 403);
            }
        }
        $user = Auth::user();
        $userData = null;
        if (strpos($channelName, 'presence-') === 0) {
            $userData = [
                'user_id' => $user['id'],
                'user_info' => [
                    'name' => $user['name'],
                    'avatar' => $user['avatar_url'] ?? null,
                ],
            ];
        }
        $auth = Realtime::authChannel($socketId, $channelName, $userData);
        Response::json($auth);
    }
}
