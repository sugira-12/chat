<?php
namespace App\Controllers\Api;

use App\Core\Config;
use App\Core\Response;

class HealthController
{
    public function status(): void
    {
        Response::json([
            'status' => 'ok',
            'time' => date('c'),
            'env' => Config::get('app.env'),
            'version' => Config::get('app.version'),
        ]);
    }
}
