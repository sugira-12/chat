<?php
namespace App\Services;

use App\Core\Config;
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

class Mailer
{
    private static function logFailure(string $context, string $message): void
    {
        $dir = __DIR__ . '/../../storage/app';
        if (!is_dir($dir)) {
            @mkdir($dir, 0777, true);
        }
        $line = '[' . date('Y-m-d H:i:s') . '] ' . $context . ': ' . $message . PHP_EOL;
        @file_put_contents($dir . '/mail.log', $line, FILE_APPEND);
    }

    private static function hasValidSmtpConfig(array $config): bool
    {
        $host = strtolower(trim((string)($config['host'] ?? '')));
        $username = trim((string)($config['username'] ?? ''));
        $password = trim((string)($config['password'] ?? ''));
        $fromAddress = trim((string)($config['from_address'] ?? ''));

        $invalidHosts = ['smtp.example.com', 'smtp.yourhost.com', ''];
        if (in_array($host, $invalidHosts, true)) {
            return false;
        }
        if ($username === '' || $password === '' || $fromAddress === '') {
            return false;
        }
        return true;
    }

    private static function buildMailer(array $config): PHPMailer
    {
        $mail = new PHPMailer(true);
        $mail->isSMTP();
        $mail->Host = (string)$config['host'];
        $mail->Port = (int)$config['port'];
        $mail->SMTPAuth = true;
        $mail->Username = (string)$config['username'];
        $mail->Password = (string)$config['password'];
        $mail->SMTPSecure = (string)$config['encryption'];
        $mail->setFrom((string)$config['from_address'], (string)$config['from_name']);
        return $mail;
    }

    private static function frontendPagesUrl(): string
    {
        $configured = (string)Config::get('app.frontend_url', '');
        if ($configured !== '') {
            return rtrim($configured, '/');
        }

        $appUrl = rtrim((string)Config::get('app.base_url', ''), '/');
        if ($appUrl === '') {
            return 'http://localhost/cyber/php/frontend/src/pages';
        }

        return str_replace('/php/backend/public', '/php/frontend/src/pages', $appUrl);
    }

    public static function sendVerification(string $toEmail, string $toName, string $token): bool
    {
        if (!class_exists(PHPMailer::class)) {
            self::logFailure('verification', 'PHPMailer class not found. Run composer install in php/backend.');
            return false;
        }

        $config = Config::get('mail');
        if (!self::hasValidSmtpConfig($config)) {
            self::logFailure('verification', 'SMTP config is missing or still using placeholder values.');
            return false;
        }

        $appUrl = rtrim(Config::get('app.base_url'), '/');
        $verifyUrl = $appUrl . '/index.php/api/auth/verify-email?token=' . urlencode($token);

        $mail = self::buildMailer($config);
        $mail->addAddress($toEmail, $toName);
        $mail->Subject = 'Verify your Cyber account';
        $mail->isHTML(true);
        $mail->Body = '<p>Welcome to Cyber!</p><p>Click to verify: <a href="' . $verifyUrl . '">' . $verifyUrl . '</a></p>';
        $mail->AltBody = 'Verify your account: ' . $verifyUrl;

        try {
            return $mail->send();
        } catch (Exception $e) {
            self::logFailure('verification', $e->getMessage());
            return false;
        }
    }

    public static function sendAccountChange(string $toEmail, string $toName, string $token): bool
    {
        if (!class_exists(PHPMailer::class)) {
            self::logFailure('account_change', 'PHPMailer class not found. Run composer install in php/backend.');
            return false;
        }

        $config = Config::get('mail');
        if (!self::hasValidSmtpConfig($config)) {
            self::logFailure('account_change', 'SMTP config is missing or still using placeholder values.');
            return false;
        }
        $frontendUrl = self::frontendPagesUrl();
        $verifyUrl = $frontendUrl . '/ConfirmAccountChange.html?token=' . urlencode($token);

        $mail = self::buildMailer($config);
        $mail->addAddress($toEmail, $toName);
        $mail->Subject = 'Confirm your account changes';
        $mail->isHTML(true);
        $mail->Body = '<p>Confirm your account changes:</p><p><a href="' . $verifyUrl . '">' . $verifyUrl . '</a></p>';
        $mail->AltBody = 'Confirm your account changes: ' . $verifyUrl;

        try {
            return $mail->send();
        } catch (Exception $e) {
            self::logFailure('account_change', $e->getMessage());
            return false;
        }
    }
}
