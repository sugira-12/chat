export const config = {
  // In production on Vercel we deploy client + server under the same domain.
  // Default to same-origin `/api` unless explicitly overridden.
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api'),
  pusherKey: import.meta.env.VITE_PUSHER_KEY || '',
  pusherCluster: import.meta.env.VITE_PUSHER_CLUSTER || 'mt1',
};

