<?php
namespace App\Services;

class AiService
{
    public static function suggestReplies(string $message): array
    {
        $text = trim($message);
        if ($text === '') {
            return ['Sounds good.', 'Got it!', 'Let me check.'];
        }
        if (preg_match('/\b(thanks|thank you)\b/i', $text)) {
            return ['You’re welcome!', 'Anytime!', 'Glad to help.'];
        }
        if (preg_match('/\b(when|time)\b/i', $text)) {
            return ['I can do 3pm.', 'Tomorrow works.', 'Let me confirm.'];
        }
        return ['Okay!', 'Sounds good.', 'Let me get back to you.'];
    }

    public static function toneCheck(string $message): array
    {
        $aggressiveWords = ['hate', 'idiot', 'stupid', 'shut up', 'dumb', 'kill', 'angry'];
        $score = 0;
        foreach ($aggressiveWords as $word) {
            if (stripos($message, $word) !== false) {
                $score += 1;
            }
        }
        return [
            'score' => $score,
            'is_aggressive' => $score > 0,
            'warning' => $score > 0 ? 'This message may sound aggressive.' : null,
        ];
    }

    public static function phishingCheck(string $message): array
    {
        $hasLink = preg_match('/https?:\\/\\//i', $message) === 1;
        $keywords = ['password', 'verify', 'bank', 'crypto', 'gift', 'urgent', 'login'];
        $hits = 0;
        foreach ($keywords as $word) {
            if (stripos($message, $word) !== false) {
                $hits++;
            }
        }
        return [
            'has_link' => $hasLink,
            'risk' => ($hasLink && $hits > 0) ? 'high' : ($hasLink ? 'medium' : 'low'),
            'warning' => ($hasLink && $hits > 0) ? 'Potential phishing or scam link.' : null,
        ];
    }

    public static function summarize(string $text): string
    {
        $text = trim($text);
        if ($text === '') {
            return '';
        }
        if (strlen($text) <= 200) {
            return $text;
        }
        return substr($text, 0, 180) . '...';
    }

    public static function translate(string $text, string $target = 'en'): string
    {
        return $text;
    }

    public static function detectReminder(string $message): ?array
    {
        if (preg_match('/\\b(tomorrow|today|next week)\\b/i', $message)) {
            return ['hint' => 'Looks like a time reference. Add to calendar?'];
        }
        if (preg_match('/\\b\\d{1,2}:\\d{2}\\b/', $message)) {
            return ['hint' => 'Time detected. Add a reminder?'];
        }
        return null;
    }
}
