const { query } = require('../db');
const { trigger } = require('../utils/realtime');

const createNotification = async (userId, actorId, type, data = {}) => {
  await query(
    'INSERT INTO notifications (user_id, actor_id, type, data, is_read, created_at) VALUES (?, ?, ?, ?, 0, NOW())',
    [userId, actorId || null, type, JSON.stringify(data || {})]
  );

  // Best-effort realtime push.
  await trigger(`private-user.${userId}`, 'notification:new', { type, actorId, data });
};

module.exports = { createNotification };
