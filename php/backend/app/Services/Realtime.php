<?php
namespace App\Services;

use App\Core\Config;

class Realtime
{
    public static function trigger($channels, string $event, array $data): bool
    {
        $config = Config::get('realtime.pusher');
        if (empty($config['app_id']) || empty($config['key']) || empty($config['secret'])) {
            return false;
        }
        $body = json_encode([
            'name' => $event,
            'channels' => (array)$channels,
            'data' => json_encode($data),
        ]);
        $bodyMd5 = md5($body);
        $timestamp = time();
        $query = http_build_query([
            'auth_key' => $config['key'],
            'auth_timestamp' => $timestamp,
            'auth_version' => '1.0',
            'body_md5' => $bodyMd5,
        ]);
        $path = '/apps/' . $config['app_id'] . '/events';
        $stringToSign = "POST\n{$path}\n{$query}";
        $signature = hash_hmac('sha256', $stringToSign, $config['secret']);
        $url = sprintf('https://api-%s.pusher.com%s?%s&auth_signature=%s', $config['cluster'], $path, $query, $signature);

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS => $body,
        ]);
        curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return $status >= 200 && $status < 300;
    }

    public static function authChannel(string $socketId, string $channelName, ?array $userData = null): array
    {
        $config = Config::get('realtime.pusher');
        $stringToSign = $socketId . ':' . $channelName;
        $response = [];

        if ($userData) {
            $channelData = json_encode($userData);
            $stringToSign .= ':' . $channelData;
            $response['channel_data'] = $channelData;
        }

        $signature = hash_hmac('sha256', $stringToSign, $config['secret']);
        $response['auth'] = $config['key'] . ':' . $signature;
        return $response;
    }
}
