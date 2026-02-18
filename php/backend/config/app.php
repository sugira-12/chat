<?php
return [
    'env' => getenv('APP_ENV') ?: 'local',
    'debug' => (getenv('APP_DEBUG') ?: '1') === '1',
    'version' => getenv('APP_VERSION') ?: '0.2.0',
    'base_url' => getenv('APP_URL') ?: 'http://localhost/cyber/php/backend/public',
    'frontend_url' => getenv('FRONTEND_URL') ?: 'http://localhost/cyber/php/frontend/src/pages',
    'jwt_secret' => getenv('JWT_SECRET') ?: 'change_me',
    'jwt_ttl' => 60 * 60 * 24 * 7,
    'session_name' => getenv('SESSION_NAME') ?: 'cyber_session',
];
