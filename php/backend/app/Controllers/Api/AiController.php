<?php
namespace App\Controllers\Api;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;
use App\Services\AiService;

class AiController
{
    public function suggestReplies(Request $request): void
    {
        $message = (string)$request->input('message', '');
        Response::json(['suggestions' => AiService::suggestReplies($message)]);
    }

    public function toneCheck(Request $request): void
    {
        $message = (string)$request->input('message', '');
        Response::json(AiService::toneCheck($message));
    }

    public function phishingCheck(Request $request): void
    {
        $message = (string)$request->input('message', '');
        Response::json(AiService::phishingCheck($message));
    }

    public function summarize(Request $request): void
    {
        $text = (string)$request->input('text', '');
        Response::json(['summary' => AiService::summarize($text)]);
    }

    public function translate(Request $request): void
    {
        $text = (string)$request->input('text', '');
        $target = (string)$request->input('target', 'en');
        Response::json(['translation' => AiService::translate($text, $target)]);
    }

    public function reminder(Request $request): void
    {
        $message = (string)$request->input('message', '');
        Response::json(['reminder' => AiService::detectReminder($message)]);
    }
}
