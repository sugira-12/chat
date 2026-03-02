const express = require('express');
const { z } = require('zod');

const { authRequired } = require('../middleware/auth');
const { query, queryOne } = require('../db');
const { createNotification } = require('../services/notifications');

const router = express.Router();

router.get('/', authRequired, async (req, res) => {
  const incoming = await query(
    `
    SELECT fr.id, fr.requester_id AS user_id, u.name, u.username, u.avatar_url AS avatar_url, fr.created_at
    FROM friend_requests fr
    JOIN users u ON u.id = fr.requester_id
    WHERE fr.addressee_id = ? AND fr.status = 'pending'
    ORDER BY fr.created_at DESC
    `,
    [req.user.id]
  );
  const sent = await query(
    `
    SELECT fr.id, fr.addressee_id AS user_id, u.name, u.username, u.avatar_url AS avatar_url, fr.created_at
    FROM friend_requests fr
    JOIN users u ON u.id = fr.addressee_id
    WHERE fr.requester_id = ? AND fr.status = 'pending'
    ORDER BY fr.created_at DESC
    `,
    [req.user.id]
  );
  res.json({
    items: incoming.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      name: r.name,
      username: r.username,
      avatar_url: r.avatar_url,
      created_at: r.created_at,
    })),
    sent: sent.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      name: r.name,
      username: r.username,
      avatar_url: r.avatar_url,
      created_at: r.created_at,
    })),
  });
});

router.post('/', authRequired, async (req, res) => {
  const schema = z.object({ userId: z.number().int().positive() });
  const parsed = schema.safeParse({ userId: Number(req.body && req.body.userId) });
  if (!parsed.success) return res.status(422).json({ error: 'userId is required' });

  const addresseeId = parsed.data.userId;
  if (addresseeId === req.user.id) return res.status(422).json({ error: 'Invalid user' });

  const target = await queryOne('SELECT id FROM users WHERE id = ? LIMIT 1', [addresseeId]);
  if (!target) return res.status(404).json({ error: 'User not found' });

  const alreadyFriends = await queryOne(
    'SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ? LIMIT 1',
    [req.user.id, addresseeId]
  );
  if (alreadyFriends) return res.json({ status: 'already_friends' });

  const existing = await queryOne(
    `
    SELECT id, status FROM friend_requests
    WHERE (requester_id = ? AND addressee_id = ?)
       OR (requester_id = ? AND addressee_id = ?)
    ORDER BY id DESC
    LIMIT 1
    `,
    [req.user.id, addresseeId, addresseeId, req.user.id]
  );
  if (existing && existing.status === 'pending') {
    return res.json({ status: 'pending' });
  }

  const result = await query(
    'INSERT INTO friend_requests (requester_id, addressee_id, status, created_at) VALUES (?, ?, "pending", NOW())',
    [req.user.id, addresseeId]
  );

  await createNotification(addresseeId, req.user.id, 'friend_request', { request_id: result.insertId });
  res.status(201).json({ status: 'sent' });
});

router.post('/:id/accept', authRequired, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(422).json({ error: 'Invalid id' });

  const fr = await queryOne(
    'SELECT * FROM friend_requests WHERE id = ? AND addressee_id = ? AND status = "pending" LIMIT 1',
    [id, req.user.id]
  );
  if (!fr) return res.status(404).json({ error: 'Request not found' });

  await query('UPDATE friend_requests SET status = "accepted", responded_at = NOW() WHERE id = ?', [id]);
  await query(
    'INSERT IGNORE INTO friends (user_id, friend_id, created_at) VALUES (?, ?, NOW()), (?, ?, NOW())',
    [fr.requester_id, fr.addressee_id, fr.addressee_id, fr.requester_id]
  );

  await createNotification(fr.requester_id, req.user.id, 'friend_request', { action: 'accepted', user_id: req.user.id });
  res.json({ status: 'accepted' });
});

router.post('/:id/reject', authRequired, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(422).json({ error: 'Invalid id' });

  const fr = await queryOne(
    'SELECT * FROM friend_requests WHERE id = ? AND addressee_id = ? AND status = "pending" LIMIT 1',
    [id, req.user.id]
  );
  if (!fr) return res.status(404).json({ error: 'Request not found' });

  await query('UPDATE friend_requests SET status = "rejected", responded_at = NOW() WHERE id = ?', [id]);
  res.json({ status: 'rejected' });
});

module.exports = router;
