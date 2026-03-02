const express = require('express');

const { authRequired } = require('../middleware/auth');
const { query } = require('../db');

const router = express.Router();

const safeParseJson = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch (e) {
    return null;
  }
};

router.get('/', authRequired, async (req, res) => {
  const limit = Math.max(1, Math.min(50, Number(req.query.limit || 20)));
  const items = await query(
    `
    SELECT n.*, a.username AS actor_username, a.avatar_url AS actor_avatar
    FROM notifications n
    LEFT JOIN users a ON a.id = n.actor_id
    WHERE n.user_id = ?
    ORDER BY n.created_at DESC
    LIMIT ?
    `,
    [req.user.id, limit]
  );
  const unread = await query(
    'SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0',
    [req.user.id]
  );
  const unreadCount = unread && unread[0] ? Number(unread[0].c || 0) : 0;

  res.json({
    unread_count: unreadCount,
    items: items.map((n) => ({
      id: n.id,
      user_id: n.user_id,
      actor_id: n.actor_id,
      actor_username: n.actor_username,
      actor_avatar: n.actor_avatar,
      type: n.type,
      data: safeParseJson(n.data),
      is_read: Number(n.is_read) === 1 ? 1 : 0,
      created_at: n.created_at,
    })),
  });
});

router.post('/:id/read', authRequired, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(422).json({ error: 'Invalid id' });
  await query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, req.user.id]);
  res.json({ status: 'ok' });
});

router.post('/read-all', authRequired, async (req, res) => {
  await query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
  res.json({ status: 'ok' });
});

router.delete('/:id', authRequired, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(422).json({ error: 'Invalid id' });
  await query('DELETE FROM notifications WHERE id = ? AND user_id = ?', [id, req.user.id]);
  res.status(204).send();
});

router.delete('/', authRequired, async (req, res) => {
  await query('DELETE FROM notifications WHERE user_id = ?', [req.user.id]);
  res.status(204).send();
});

module.exports = router;

