<?php
$resolveMailConfig = static function (string $key, string $default): string {
    $env = getenv($key);
    if ($env !== false && $env !== '') {
        return (string)$env;
    }

    if (isset($_ENV[$key]) && $_ENV[$key] !== '') {
        return (string)$_ENV[$key];
    }

    // Accept legacy values users placed directly in php.ini.
    static $iniValues = null;
    if ($iniValues === null) {
        $iniValues = [];
        $iniPath = php_ini_loaded_file();
        if ($iniPath && file_exists($iniPath)) {
            $parsed = parse_ini_file($iniPath, false, INI_SCANNER_RAW);
            if (is_array($parsed)) {
                $iniValues = $parsed;
            }
        }
    }

    if (isset($iniValues[$key]) && (string)$iniValues[$key] !== '') {
        return (string)$iniValues[$key];
    }

    return $default;
};

return [
    'from_address' => $resolveMailConfig('MAIL_FROM_ADDRESS', 'no-reply@cyber.local'),
    'from_name' => $resolveMailConfig('MAIL_FROM_NAME', 'Cyber'),
    'host' => $resolveMailConfig('MAIL_HOST', 'smtp.example.com'),
    'port' => $resolveMailConfig('MAIL_PORT', '587'),
    'username' => $resolveMailConfig('MAIL_USERNAME', ''),
    'password' => $resolveMailConfig('MAIL_PASSWORD', ''),
    'encryption' => $resolveMailConfig('MAIL_ENCRYPTION', 'tls'),
];
