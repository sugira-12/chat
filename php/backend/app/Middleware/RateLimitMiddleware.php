<?php
namespace App\Middleware;

use App\Core\RateLimiter;
use App\Core\Response;

class RateLimitMiddleware
{
    private $maxAttempts;
    private $windowSeconds;

    public function __construct(int $maxAttempts = 60, int $windowSeconds = 60)
    {
        $this->maxAttempts = $maxAttempts;
        $this->windowSeconds = $windowSeconds;
    }

    public function handle($request): bool
    {
        $key = sprintf('%s:%s:%s', $request->ip, $request->method, $request->path);
        if (!RateLimiter::hit($key, $this->maxAttempts, $this->windowSeconds)) {
            Response::error('Too Many Requests', 429);
            return false;
        }
        return true;
    }
}
