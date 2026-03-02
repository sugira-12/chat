export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api',
  pusherKey: import.meta.env.VITE_PUSHER_KEY || '',
  pusherCluster: import.meta.env.VITE_PUSHER_CLUSTER || 'mt1',
};

