<?php
namespace App\Controllers\Api;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;
use App\Models\User;
use App\Models\UserSettings;

class SettingsController
{
    public function show(Request $request): void
    {
        $user = Auth::user();
        if (!$user) {
            Response::error('Unauthorized', 401);
        }
        $settings = UserSettings::getForUser((int)$user['id']);
        Response::json([
            'user' => User::sanitize($user),
            'settings' => $settings,
        ]);
    }

    public function update(Request $request): void
    {
        $user = Auth::user();
        if (!$user) {
            Response::error('Unauthorized', 401);
        }
        $payload = $request->body;
        if (array_key_exists('dm_privacy', $payload)) {
            $valid = ['everyone', 'friends', 'nobody'];
            if (!in_array($payload['dm_privacy'], $valid, true)) {
                Response::error('Invalid dm_privacy value', 422);
            }
        }
        if (array_key_exists('theme_mode', $payload)) {
            $valid = ['light', 'dark', 'sunset', 'midnight'];
            if (!in_array($payload['theme_mode'], $valid, true)) {
                Response::error('Invalid theme_mode value', 422);
            }
        }

        $ok = UserSettings::update((int)$user['id'], $payload);
        if (!$ok) {
            Response::error('No settings updated', 422);
        }
        Response::json([
            'status' => 'updated',
            'settings' => UserSettings::getForUser((int)$user['id']),
        ]);
    }
}
