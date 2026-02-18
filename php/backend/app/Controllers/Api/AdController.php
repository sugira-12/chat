<?php
namespace App\Controllers\Api;

use App\Core\Request;
use App\Core\Response;
use App\Models\Ad;

class AdController
{
    public function active(Request $request): void
    {
        $items = Ad::activeForUser();
        Response::json(['items' => $items]);
    }
}
