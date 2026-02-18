<?php
namespace App\Controllers\Api;

use App\Core\Auth;
use App\Core\Config;
use App\Core\Jwt;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\AccountChange;
use App\Models\User;
use App\Models\UserSession;
use App\Models\UserSettings;
use App\Services\Mailer;

class AuthController
{
    public function register(Request $request): void
    {
        $errors = Validator::validate($request->body, [
            'name' => 'required|min:2|max:100',
            'username' => 'required|min:3|max:50',
            'email' => 'required|email',
            'password' => 'required|min:8',
        ]);
        if ($errors) {
            Response::error('Validation failed', 422, $errors);
        }

        if (User::findByEmail($request->input('email'))) {
            Response::error('Email already in use', 409);
        }
        if (User::findByUsername($request->input('username'))) {
            Response::error('Username already in use', 409);
        }

        $userId = User::create([
            'uuid' => bin2hex(random_bytes(16)),
            'name' => $request->input('name'),
            'username' => $request->input('username'),
            'email' => strtolower((string)$request->input('email')),
            'password_hash' => password_hash($request->input('password'), PASSWORD_BCRYPT),
            'role' => 'user',
        ]);
        UserSettings::createDefaults($userId);
        User::update($userId, ['email_verified_at' => date('Y-m-d H:i:s')]);

        $_SESSION['user_id'] = $userId;
        $jwt = Jwt::encode([
            'sub' => $userId,
            'exp' => time() + Config::get('app.jwt_ttl'),
        ], Config::get('app.jwt_secret'));

        Response::json([
            'user' => User::sanitize(User::findById($userId)),
            'token' => $jwt,
            'verification_required' => false,
        ], 201);
    }

    public function login(Request $request): void
    {
        $errors = Validator::validate($request->body, [
            'email' => 'required|email',
            'password' => 'required',
        ]);
        if ($errors) {
            Response::error('Validation failed', 422, $errors);
        }

        $user = User::findByEmail((string)$request->input('email'));
        if (!$user || !password_verify((string)$request->input('password'), (string)$user['password_hash'])) {
            Response::error('Invalid credentials', 401);
        }
        if (($user['status'] ?? 'active') !== 'active') {
            Response::error('Account suspended', 403);
        }

        $_SESSION['user_id'] = $user['id'];
        User::setOnlineStatus((int)$user['id'], true);
        UserSettings::getForUser((int)$user['id']);
        UserSession::recordLogin((int)$user['id'], session_id(), $request->ip, $request->headers['User-Agent'] ?? null);
        $jwt = Jwt::encode([
            'sub' => $user['id'],
            'exp' => time() + Config::get('app.jwt_ttl'),
        ], Config::get('app.jwt_secret'));

        Response::json(['user' => User::sanitize($user), 'token' => $jwt]);
    }

    public function logout(Request $request): void
    {
        $userId = Auth::id();
        if ($userId) {
            User::setOnlineStatus((int)$userId, false);
            UserSession::recordLogout((int)$userId, session_id());
        }
        session_destroy();
        Response::noContent();
    }

    public function me(Request $request): void
    {
        $user = Auth::user();
        if (!$user) {
            Response::error('Unauthorized', 401);
        }
        Response::json(['user' => User::sanitize($user)]);
    }

    public function verifyEmail(Request $request): void
    {
        Response::json([
            'status' => 'disabled',
            'message' => 'Email verification is disabled.',
        ]);
    }

    public function resendVerification(Request $request): void
    {
        Response::json([
            'status' => 'disabled',
            'message' => 'Email verification is disabled.',
        ]);
    }

    public function requestAccountChange(Request $request): void
    {
        $user = Auth::user();
        if (!$user) {
            Response::error('Unauthorized', 401);
        }

        $newEmail = trim((string)$request->input('email', ''));
        $newUsername = trim((string)$request->input('username', ''));
        $newEmail = $newEmail !== '' ? strtolower($newEmail) : null;
        $newUsername = $newUsername !== '' ? $newUsername : null;

        if (!$newEmail && !$newUsername) {
            Response::error('No changes requested', 422);
        }
        if ($newEmail && !filter_var($newEmail, FILTER_VALIDATE_EMAIL)) {
            Response::error('Invalid email format', 422);
        }
        if ($newUsername && strlen($newUsername) < 3) {
            Response::error('Username must be at least 3 characters', 422);
        }

        if ($newEmail === ($user['email'] ?? null) && $newUsername === ($user['username'] ?? null)) {
            Response::error('New values are the same as current account details', 422);
        }

        if ($newEmail && $newEmail !== ($user['email'] ?? null)) {
            $existing = User::findByEmail($newEmail);
            if ($existing) {
                Response::error('Email already in use', 409);
            }
        }

        if ($newUsername && $newUsername !== ($user['username'] ?? null)) {
            $existing = User::findByUsername($newUsername);
            if ($existing) {
                Response::error('Username already in use', 409);
            }
        }

        $token = AccountChange::create((int)$user['id'], $newEmail, $newUsername);
        $recipientEmail = $newEmail ?: (string)$user['email'];
        $recipientName = (string)($user['name'] ?? $user['username']);
        $sent = Mailer::sendAccountChange($recipientEmail, $recipientName, $token);

        if (!$sent) {
            Response::error('Confirmation email failed', 500);
        }

        Response::json([
            'status' => 'sent',
            'message' => 'Confirmation link has been sent to your email.',
        ]);
    }

    public function confirmAccountChange(Request $request): void
    {
        $token = (string)$request->input('token', '');
        if ($token === '') {
            Response::error('Token is required', 422);
        }

        $changes = AccountChange::apply($token);
        if (!$changes) {
            Response::error('Invalid or expired token', 400);
        }

        Response::json([
            'status' => 'updated',
            'changes' => $changes,
        ]);
    }
}
