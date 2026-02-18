<?php
namespace App\Models;

use App\Core\Database;

class UserSettings
{
    private static $schemaChecked = false;
    private static $columnsCache = null;

    private static function columns(): array
    {
        if (self::$columnsCache !== null) {
            return self::$columnsCache;
        }

        $stmt = Database::connection()->query('SHOW COLUMNS FROM user_settings');
        $fields = [];
        foreach ($stmt->fetchAll() as $column) {
            $fields[$column['Field']] = true;
        }

        self::$columnsCache = $fields;
        return self::$columnsCache;
    }

    private static function hasColumn(string $name): bool
    {
        $columns = self::columns();
        return isset($columns[$name]);
    }

    private static function ensureSchema(): void
    {
        if (self::$schemaChecked) {
            return;
        }
        self::$schemaChecked = true;

        $columns = self::columns();

        if (!isset($columns['hide_read_receipts'])) {
            if (self::safeExec('ALTER TABLE user_settings ADD COLUMN hide_read_receipts TINYINT(1) NOT NULL DEFAULT 0 AFTER show_online')) {
                self::$columnsCache = null;
            }
        }

        $columns = self::columns();
        if (!isset($columns['hide_typing'])) {
            if (self::safeExec('ALTER TABLE user_settings ADD COLUMN hide_typing TINYINT(1) NOT NULL DEFAULT 0 AFTER hide_read_receipts')) {
                self::$columnsCache = null;
            }
        }

        $columns = self::columns();
        if (!isset($columns['private_mode'])) {
            if (self::safeExec('ALTER TABLE user_settings ADD COLUMN private_mode TINYINT(1) NOT NULL DEFAULT 0 AFTER hide_typing')) {
                self::$columnsCache = null;
            }
        }

        $columns = self::columns();
        if (!isset($columns['focus_mode'])) {
            if (self::safeExec('ALTER TABLE user_settings ADD COLUMN focus_mode TINYINT(1) NOT NULL DEFAULT 0 AFTER private_mode')) {
                self::$columnsCache = null;
            }
        }

        $columns = self::columns();
        if (!isset($columns['dm_privacy'])) {
            if (self::safeExec("ALTER TABLE user_settings ADD COLUMN dm_privacy ENUM('everyone','friends','nobody') NOT NULL DEFAULT 'everyone' AFTER show_online")) {
                self::$columnsCache = null;
                if (isset($columns['allow_message_requests'])) {
                    self::safeExec("UPDATE user_settings SET dm_privacy = CASE WHEN allow_message_requests = 1 THEN 'everyone' ELSE 'friends' END");
                }
            }
        }

        $columns = self::columns();
        if (!isset($columns['theme_mode'])) {
            if (self::safeExec("ALTER TABLE user_settings ADD COLUMN theme_mode ENUM('light','dark','sunset','midnight') NOT NULL DEFAULT 'light' AFTER dm_privacy")) {
                self::$columnsCache = null;
                if (isset($columns['dark_mode'])) {
                    self::safeExec("UPDATE user_settings SET theme_mode = CASE WHEN dark_mode = 1 THEN 'dark' ELSE 'light' END");
                }
            }
        }
    }

    private static function safeExec(string $sql): bool
    {
        try {
            Database::connection()->exec($sql);
            return true;
        } catch (\Throwable $e) {
            return false;
        }
    }

    private static function hydrateComputed(array $row): array
    {
        if (!isset($row['dm_privacy'])) {
            $row['dm_privacy'] = ((int)($row['allow_message_requests'] ?? 1) === 1) ? 'everyone' : 'friends';
        }
        if (!isset($row['theme_mode'])) {
            $row['theme_mode'] = ((int)($row['dark_mode'] ?? 0) === 1) ? 'dark' : 'light';
        }
        return $row;
    }

    public static function getForUser(int $userId): array
    {
        self::ensureSchema();

        $stmt = Database::connection()->prepare('SELECT * FROM user_settings WHERE user_id = :id LIMIT 1');
        $stmt->execute(['id' => $userId]);
        $row = $stmt->fetch();
        if ($row) {
            return self::hydrateComputed($row);
        }

        self::createDefaults($userId);
        $stmt = Database::connection()->prepare('SELECT * FROM user_settings WHERE user_id = :id LIMIT 1');
        $stmt->execute(['id' => $userId]);
        $row = $stmt->fetch() ?: [];
        return self::hydrateComputed($row);
    }

    public static function createDefaults(int $userId): void
    {
        self::ensureSchema();

        $columns = self::columns();
        $defaults = [
            'user_id' => $userId,
            'notify_like' => 1,
            'notify_comment' => 1,
            'notify_follow' => 1,
            'notify_message' => 1,
            'notify_friend_request' => 1,
            'show_online' => 1,
            'hide_read_receipts' => 0,
            'hide_typing' => 0,
            'private_mode' => 0,
            'focus_mode' => 0,
            'allow_message_requests' => 1,
            'dark_mode' => 0,
            'dm_privacy' => 'everyone',
            'theme_mode' => 'light',
        ];

        $insertColumns = [];
        $placeholders = [];
        $params = [];
        foreach ($defaults as $key => $value) {
            if (!isset($columns[$key])) {
                continue;
            }
            $insertColumns[] = $key;
            $placeholders[] = ':' . $key;
            $params[$key] = $value;
        }

        if (isset($columns['created_at'])) {
            $insertColumns[] = 'created_at';
            $placeholders[] = 'NOW()';
        }
        if (isset($columns['updated_at'])) {
            $insertColumns[] = 'updated_at';
            $placeholders[] = 'NOW()';
        }

        $sql = 'INSERT INTO user_settings (' . implode(', ', $insertColumns) . ') VALUES (' . implode(', ', $placeholders) . ')';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
    }

    public static function update(int $userId, array $data): bool
    {
        self::ensureSchema();

        $columns = self::columns();
        $fields = [];
        $params = ['user_id' => $userId];

        $booleanFields = [
            'notify_like',
            'notify_comment',
            'notify_follow',
            'notify_message',
            'notify_friend_request',
            'show_online',
            'hide_read_receipts',
            'hide_typing',
            'private_mode',
            'focus_mode',
            'allow_message_requests',
            'dark_mode',
        ];

        foreach ($booleanFields as $key) {
            if (!array_key_exists($key, $data) || !isset($columns[$key])) {
                continue;
            }
            $fields[] = $key . ' = :' . $key;
            $params[$key] = $data[$key] ? 1 : 0;
        }

        if (array_key_exists('dm_privacy', $data) && isset($columns['dm_privacy'])) {
            $dmPrivacy = (string)$data['dm_privacy'];
            $validDm = ['everyone', 'friends', 'nobody'];
            if (!in_array($dmPrivacy, $validDm, true)) {
                return false;
            }
            $fields[] = 'dm_privacy = :dm_privacy';
            $params['dm_privacy'] = $dmPrivacy;
            if (isset($columns['allow_message_requests']) && !array_key_exists('allow_message_requests', $data)) {
                $fields[] = 'allow_message_requests = :allow_message_requests_auto';
                $params['allow_message_requests_auto'] = $dmPrivacy === 'everyone' ? 1 : 0;
            }
        }

        if (array_key_exists('theme_mode', $data) && isset($columns['theme_mode'])) {
            $themeMode = (string)$data['theme_mode'];
            $validThemes = ['light', 'dark', 'sunset', 'midnight'];
            if (!in_array($themeMode, $validThemes, true)) {
                return false;
            }
            $fields[] = 'theme_mode = :theme_mode';
            $params['theme_mode'] = $themeMode;
            if (isset($columns['dark_mode']) && !array_key_exists('dark_mode', $data)) {
                $fields[] = 'dark_mode = :dark_mode_auto';
                $params['dark_mode_auto'] = in_array($themeMode, ['dark', 'midnight'], true) ? 1 : 0;
            }
        }

        if (array_key_exists('allow_message_requests', $data) && !array_key_exists('dm_privacy', $data) && isset($columns['dm_privacy'])) {
            $fields[] = 'dm_privacy = :dm_privacy_from_legacy';
            $params['dm_privacy_from_legacy'] = $data['allow_message_requests'] ? 'everyone' : 'friends';
        }

        if (array_key_exists('dark_mode', $data) && !array_key_exists('theme_mode', $data) && isset($columns['theme_mode'])) {
            $fields[] = 'theme_mode = :theme_mode_from_legacy';
            $params['theme_mode_from_legacy'] = $data['dark_mode'] ? 'dark' : 'light';
        }

        if (!$fields) {
            return false;
        }

        $sql = 'UPDATE user_settings SET ' . implode(', ', $fields) . ', updated_at = NOW() WHERE user_id = :user_id';
        $stmt = Database::connection()->prepare($sql);
        return $stmt->execute($params);
    }
}
