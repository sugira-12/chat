const express = require('express');
const { z } = require('zod');

const { authRequired } = require('../middleware/auth');
const { query, queryOne } = require('../db');

const router = express.Router();

router.get('/suggestions', authRequired, async (req, res) => {
  const limit = Math.max(1, Math.min(100, Number(req.query.limit || 24)));

  const rows = await query(
    `
    SELECT u.id, u.name, u.username, u.avatar_url AS avatar_url, s.is_online, s.last_seen_at
    FROM users u
    LEFT JOIN user_status s ON s.user_id = u.id
    WHERE u.id <> ?
      AND u.id NOT IN (
        SELECT friend_id FROM friends WHERE user_id = ?
      )
      AND u.id NOT IN (
        SELECT receiver_id FROM friend_requests WHERE sender_id = ? AND status = 'pending'
      )
      AND u.id NOT IN (
        SELECT sender_id FROM friend_requests WHERE receiver_id = ? AND status = 'pending'
      )
    ORDER BY u.created_at DESC
    LIMIT ?
    `,
    [req.user.id, req.user.id, req.user.id, req.user.id, limit]
  );

  const items = rows.map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    avatar_url: u.avatar_url,
    is_online: Number(u.is_online) === 1,
    last_activity: u.last_seen_at,
  }));

  res.json({ items });
});

router.get('/search', authRequired, async (req, res) => {
  const schema = z.object({ q: z.string().min(1).max(80) });
  const parsed = schema.safeParse({ q: String(req.query.q || '').trim() });
  if (!parsed.success) return res.status(422).json({ error: 'q is required' });

  const q = `%${parsed.data.q}%`;
  const users = await query(
    'SELECT id, name, username, avatar_url AS avatar_url FROM users WHERE id <> ? AND (name LIKE ? OR username LIKE ?) ORDER BY created_at DESC LIMIT 20',
    [req.user.id, q, q]
  );

  res.json({
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      avatar_url: u.avatar_url,
    })),
  });
});

router.get('/:id', authRequired, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(422).json({ error: 'Invalid id' });

  const user = await queryOne(
    'SELECT id, uuid, name, username, bio, avatar_url AS avatarUrl, cover_photo_url AS coverUrl, created_at AS createdAt FROM users WHERE id = ? LIMIT 1',
    [id]
  );
  if (!user) return res.status(404).json({ error: 'User not found' });

  const stats = await queryOne(
    `
    SELECT
      (SELECT COUNT(*) FROM follows WHERE followed_id = ?) AS followers,
      (SELECT COUNT(*) FROM follows WHERE follower_id = ?) AS following,
      (SELECT COUNT(*) FROM posts WHERE user_id = ?) AS posts
    `,
    [id, id, id]
  );

  res.json({ user, stats });
});

// Compatibility helper (matches the older frontend): POST /api/users/:id/friend-request
router.post('/:id/friend-request', authRequired, async (req, res) => {
  const addresseeId = Number(req.params.id);
  if (!addresseeId) return res.status(422).json({ error: 'Invalid user id' });
  if (addresseeId === req.user.id) return res.status(422).json({ error: 'Invalid user' });

  const target = await queryOne('SELECT id FROM users WHERE id = ? LIMIT 1', [addresseeId]);
  if (!target) return res.status(404).json({ error: 'User not found' });

  const alreadyFriends = await queryOne(
    'SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ? LIMIT 1',
    [req.user.id, addresseeId]
  );
  if (alreadyFriends) return res.json({ status: 'already_friends' });

  const existing = await queryOne(
    'SELECT id, status FROM friend_requests WHERE requester_id = ? AND addressee_id = ? LIMIT 1',
    [req.user.id, addresseeId]
  );
  if (existing && existing.status === 'pending') return res.json({ status: 'pending' });

  await query(
    'INSERT INTO friend_requests (requester_id, addressee_id, status, created_at) VALUES (?, ?, "pending", NOW())',
    [req.user.id, addresseeId]
  );
  res.status(201).json({ status: 'sent' });
});

module.exports = router;
