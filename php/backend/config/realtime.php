<?php
return [
    'driver' => getenv('REALTIME_DRIVER') ?: 'pusher',
    'pusher' => [
        'app_id' => getenv('PUSHER_APP_ID') ?: '',
        'key' => getenv('PUSHER_KEY') ?: '',
        'secret' => getenv('PUSHER_SECRET') ?: '',
        'cluster' => getenv('PUSHER_CLUSTER') ?: 'mt1',
        'use_tls' => true,
    ],
];
