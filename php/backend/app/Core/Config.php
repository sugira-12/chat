<?php
namespace App\Core;

class Config
{
    private static $cache = [];

    public static function get(string $key, $default = null)
    {
        $parts = explode('.', $key);
        $file = array_shift($parts);
        if (!isset(self::$cache[$file])) {
            $path = __DIR__ . '/../../config/' . $file . '.php';
            self::$cache[$file] = file_exists($path) ? require $path : [];
        }
        $value = self::$cache[$file];
        foreach ($parts as $part) {
            if (!is_array($value) || !array_key_exists($part, $value)) {
                return $default;
            }
            $value = $value[$part];
        }
        return $value;
    }
}
