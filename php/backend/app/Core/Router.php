<?php
namespace App\Core;

class Router
{
    private $routes = [];
    private $groupPrefix = '';
    private $groupMiddleware = [];

    public function get(string $path, $handler, array $middleware = []): void
    {
        $this->add('GET', $path, $handler, $middleware);
    }

    public function post(string $path, $handler, array $middleware = []): void
    {
        $this->add('POST', $path, $handler, $middleware);
    }

    public function put(string $path, $handler, array $middleware = []): void
    {
        $this->add('PUT', $path, $handler, $middleware);
    }

    public function delete(string $path, $handler, array $middleware = []): void
    {
        $this->add('DELETE', $path, $handler, $middleware);
    }

    public function group(array $options, callable $callback): void
    {
        $previousPrefix = $this->groupPrefix;
        $previousMiddleware = $this->groupMiddleware;

        $this->groupPrefix = $previousPrefix . ($options['prefix'] ?? '');
        $this->groupMiddleware = array_merge($previousMiddleware, $options['middleware'] ?? []);

        $callback($this);

        $this->groupPrefix = $previousPrefix;
        $this->groupMiddleware = $previousMiddleware;
    }

    private function add(string $method, string $path, $handler, array $middleware): void
    {
        $this->routes[] = [
            'method' => $method,
            'path' => $this->groupPrefix . $path,
            'handler' => $handler,
            'middleware' => array_merge($this->groupMiddleware, $middleware),
        ];
    }

    public function dispatch(Request $request): void
    {
        $method = $request->method;
        $uri = rtrim($request->path, '/') ?: '/';

        foreach ($this->routes as $route) {
            if ($route['method'] !== $method) {
                continue;
            }
            $pattern = $this->compilePattern($route['path']);
            if (preg_match($pattern, $uri, $matches)) {
                $params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);
                foreach ($route['middleware'] as $middleware) {
                    $instance = is_string($middleware) ? new $middleware() : $middleware;
                    $result = $instance->handle($request);
                    if ($result === false) {
                        return;
                    }
                }

                if (strpos($route['path'], '/api/') === 0) {
                    try {
                        \App\Services\ActivityLogger::capture($request, $route['path']);
                    } catch (\Throwable $e) {
                        // Never block API requests because logging failed.
                    }
                }
                $handler = $route['handler'];
                if (is_array($handler) && is_string($handler[0])) {
                    $controller = new $handler[0]();
                    call_user_func([$controller, $handler[1]], $request, $params);
                    return;
                }
                call_user_func($handler, $request, $params);
                return;
            }
        }

        Response::error('Not Found', 404);
    }

    private function compilePattern(string $path): string
    {
        $path = rtrim($path, '/') ?: '/';
        $pattern = preg_replace('#\{([a-zA-Z_][a-zA-Z0-9_]*)\}#', '(?P<$1>[^/]+)', $path);
        return '#^' . $pattern . '$#';
    }
}
