const express = require('express');
const multer = require('multer');
const { z } = require('zod');

const { authRequired } = require('../middleware/auth');
const { query, queryOne } = require('../db');
const { uploadBuffer } = require('../utils/cloudinary');
const { trigger } = require('../utils/realtime');
const { createNotification } = require('../services/notifications');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
});

const isFriends = async (a, b) => {
  const row = await queryOne('SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ? LIMIT 1', [a, b]);
  return !!row;
};

const ensureDirectConversation = async (meId, otherId) => {
  const existing = await queryOne(
    `
    SELECT c.id
    FROM conversations c
    JOIN conversation_participants a ON a.conversation_id = c.id AND a.user_id = ?
    JOIN conversation_participants b ON b.conversation_id = c.id AND b.user_id = ?
    WHERE c.type = 'direct'
    LIMIT 1
    `,
    [meId, otherId]
  );
  if (existing) return Number(existing.id);

  const convRes = await query(
    'INSERT INTO conversations (type, title, created_by, created_at) VALUES ("direct", NULL, ?, NOW())',
    [meId]
  );
  const conversationId = Number(convRes.insertId || 0);
  await query(
    'INSERT INTO conversation_participants (conversation_id, user_id, role, joined_at) VALUES (?, ?, "member", NOW()), (?, ?, "member", NOW())',
    [conversationId, meId, conversationId, otherId]
  );
  return conversationId;
};

router.get('/conversations', authRequired, async (req, res) => {
  const items = await query(
    `
    SELECT
      c.id, c.type, c.title, c.created_at,
      cp.pinned_at, cp.muted_until, cp.last_read_message_id,
      lm.id AS last_message_id, lm.body AS last_message_body, lm.type AS last_message_type, lm.created_at AS last_message_at,
      u2.id AS peer_id, u2.username AS peer_username, u2.name AS peer_name, u2.avatar_url AS peer_avatar,
      us.is_online AS peer_is_online, us.last_seen_at AS peer_last_seen
    FROM conversation_participants cp
    JOIN conversations c ON c.id = cp.conversation_id
    LEFT JOIN messages lm ON lm.id = (
      SELECT m.id FROM messages m
      WHERE m.conversation_id = c.id AND m.deleted_at IS NULL
      ORDER BY m.id DESC
      LIMIT 1
    )
    LEFT JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id <> ?
    LEFT JOIN users u2 ON u2.id = cp2.user_id
    LEFT JOIN user_status us ON us.user_id = u2.id
    WHERE cp.user_id = ?
    ORDER BY (cp.pinned_at IS NULL) ASC, COALESCE(lm.id, 0) DESC
    LIMIT 200
    `,
    [req.user.id, req.user.id]
  );

  // Compute unread count best-effort (can be optimized later).
  const out = [];
  for (const row of items) {
    const lastRead = Number(row.last_read_message_id || 0);
    const unread = await queryOne(
      `
      SELECT COUNT(*) AS c
      FROM messages m
      WHERE m.conversation_id = ?
        AND m.deleted_at IS NULL
        AND m.id > ?
        AND m.sender_id <> ?
      `,
      [row.id, lastRead, req.user.id]
    );
    out.push({
      id: row.id,
      type: row.type,
      title: row.title,
      pinned_at: row.pinned_at,
      muted_until: row.muted_until,
      last_message: row.last_message_id ? {
        id: row.last_message_id,
        body: row.last_message_body,
        type: row.last_message_type,
        created_at: row.last_message_at,
      } : null,
      peer: row.peer_id ? {
        id: row.peer_id,
        username: row.peer_username,
        name: row.peer_name,
        avatar_url: row.peer_avatar,
        is_online: Number(row.peer_is_online) === 1,
        last_seen_at: row.peer_last_seen,
      } : null,
      unread_count: unread ? Number(unread.c || 0) : 0,
    });
  }

  res.json({ items: out });
});

router.post('/conversations', authRequired, async (req, res) => {
  const schema = z.object({ userId: z.number().int().positive() });
  const parsed = schema.safeParse({ userId: Number(req.body && req.body.userId) });
  if (!parsed.success) return res.status(422).json({ error: 'userId is required' });

  const otherId = parsed.data.userId;
  if (otherId === req.user.id) return res.status(422).json({ error: 'Invalid user' });
  const other = await queryOne('SELECT id FROM users WHERE id = ? LIMIT 1', [otherId]);
  if (!other) return res.status(404).json({ error: 'User not found' });

  const conversationId = await ensureDirectConversation(req.user.id, otherId);

  const friends = await isFriends(req.user.id, otherId);
  if (!friends) {
    await query(
      `
      INSERT INTO message_requests (conversation_id, requester_id, recipient_id, status, created_at)
      VALUES (?, ?, ?, 'pending', NOW())
      ON DUPLICATE KEY UPDATE conversation_id = VALUES(conversation_id)
      `,
      [conversationId, req.user.id, otherId]
    );
  }

  res.status(201).json({ conversation_id: conversationId, message_request: friends ? null : 'pending' });
});

router.get('/message-requests', authRequired, async (req, res) => {
  const items = await query(
    `
    SELECT mr.*, u.username, u.name, u.avatar_url
    FROM message_requests mr
    JOIN users u ON u.id = mr.requester_id
    WHERE mr.recipient_id = ? AND mr.status = 'pending'
    ORDER BY mr.created_at DESC
    LIMIT 200
    `,
    [req.user.id]
  );
  res.json({ items });
});

router.post('/message-requests/:id/accept', authRequired, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(422).json({ error: 'Invalid id' });
  await query('UPDATE message_requests SET status = "accepted", responded_at = NOW() WHERE id = ? AND recipient_id = ?', [id, req.user.id]);
  res.json({ status: 'accepted' });
});

router.post('/message-requests/:id/deny', authRequired, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(422).json({ error: 'Invalid id' });
  await query('UPDATE message_requests SET status = "denied", responded_at = NOW() WHERE id = ? AND recipient_id = ?', [id, req.user.id]);
  res.json({ status: 'denied' });
});

router.get('/conversations/:id/messages', authRequired, async (req, res) => {
  const conversationId = Number(req.params.id);
  if (!conversationId) return res.status(422).json({ error: 'Invalid conversation id' });

  const member = await queryOne(
    'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ? LIMIT 1',
    [conversationId, req.user.id]
  );
  if (!member) return res.status(403).json({ error: 'Forbidden' });

  const limit = Math.max(1, Math.min(80, Number(req.query.limit || 30)));
  const cursor = Number(req.query.cursor || 0) || null;

  const rows = await query(
    `
    SELECT m.*, u.username, u.avatar_url
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.conversation_id = ?
      AND m.deleted_at IS NULL
      AND (? IS NULL OR m.id < ?)
    ORDER BY m.id DESC
    LIMIT ?
    `,
    [conversationId, cursor, cursor, limit]
  );

  const ids = rows.map((r) => Number(r.id)).filter((n) => Number.isFinite(n) && n > 0);
  let attachmentsByMessage = {};
  if (ids.length) {
    const placeholders = ids.map(() => '?').join(',');
    const att = await query(
      `SELECT message_id, media_type, url, thumb_url FROM message_attachments WHERE message_id IN (${placeholders})`,
      ids
    );
    attachmentsByMessage = att.reduce((acc, a) => {
      const mid = Number(a.message_id);
      if (!acc[mid]) acc[mid] = [];
      acc[mid].push({ url: a.url, media_type: a.media_type, thumb_url: a.thumb_url });
      return acc;
    }, {});
  }

  const items = rows.map((m) => ({
    ...m,
    attachments: attachmentsByMessage[Number(m.id)] || [],
  }));

  const nextCursor = rows.length === limit ? Math.min(...rows.map((r) => Number(r.id))) : null;
  res.json({ items, next_cursor: nextCursor });
});

router.post('/conversations/:id/messages', authRequired, async (req, res) => {
  const conversationId = Number(req.params.id);
  if (!conversationId) return res.status(422).json({ error: 'Invalid conversation id' });

  const schema = z.object({ body: z.string().min(1).max(6000) });
  const parsed = schema.safeParse({ body: req.body && req.body.body });
  if (!parsed.success) return res.status(422).json({ error: 'Validation failed', details: parsed.error.flatten() });

  const member = await queryOne(
    'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ? LIMIT 1',
    [conversationId, req.user.id]
  );
  if (!member) return res.status(403).json({ error: 'Forbidden' });

  const ins = await query(
    'INSERT INTO messages (conversation_id, sender_id, body, type, status, created_at) VALUES (?, ?, ?, "text", "sent", NOW())',
    [conversationId, req.user.id, parsed.data.body]
  );
  const messageId = Number(ins.insertId || 0);

  await trigger(`private-conversation.${conversationId}`, 'message:new', {
    id: messageId,
    conversation_id: conversationId,
    sender_id: req.user.id,
    body: parsed.data.body,
    type: 'text',
    created_at: new Date().toISOString(),
  });

  // Notify other participants (direct/group)
  const recipients = await query(
    'SELECT user_id FROM conversation_participants WHERE conversation_id = ? AND user_id <> ?',
    [conversationId, req.user.id]
  );
  for (const r of recipients) {
    await createNotification(Number(r.user_id), req.user.id, 'message', { conversation_id: conversationId, message_id: messageId });
  }

  res.status(201).json({ id: messageId });
});

router.post('/conversations/:id/messages/media', authRequired, upload.single('media'), async (req, res) => {
  const conversationId = Number(req.params.id);
  if (!conversationId) return res.status(422).json({ error: 'Invalid conversation id' });
  if (!req.file || !req.file.buffer) return res.status(422).json({ error: 'media is required' });

  const member = await queryOne(
    'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ? LIMIT 1',
    [conversationId, req.user.id]
  );
  if (!member) return res.status(403).json({ error: 'Forbidden' });

  const uploaded = await uploadBuffer(req.file.buffer, { resource_type: 'auto' });
  const mediaType = uploaded.resource_type === 'video' ? 'video' : 'image';

  const ins = await query(
    'INSERT INTO messages (conversation_id, sender_id, body, type, status, created_at) VALUES (?, ?, NULL, ?, "sent", NOW())',
    [conversationId, req.user.id, mediaType]
  );
  const messageId = Number(ins.insertId || 0);

  await query(
    'INSERT INTO message_attachments (message_id, media_type, url, thumb_url, size_bytes) VALUES (?, ?, ?, ?, ?)',
    [messageId, mediaType, uploaded.secure_url, uploaded.secure_url, req.file.size || null]
  );

  await trigger(`private-conversation.${conversationId}`, 'message:new', {
    id: messageId,
    conversation_id: conversationId,
    sender_id: req.user.id,
    body: null,
    type: mediaType,
    attachments: [{ url: uploaded.secure_url, media_type: mediaType, thumb_url: uploaded.secure_url }],
    created_at: new Date().toISOString(),
  });

  res.status(201).json({ id: messageId });
});

router.post('/conversations/:id/typing', authRequired, async (req, res) => {
  const conversationId = Number(req.params.id);
  if (!conversationId) return res.status(422).json({ error: 'Invalid conversation id' });

  const member = await queryOne(
    'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ? LIMIT 1',
    [conversationId, req.user.id]
  );
  if (!member) return res.status(403).json({ error: 'Forbidden' });

  await trigger(`private-conversation.${conversationId}`, 'typing', { user_id: req.user.id, at: Date.now() });
  res.json({ status: 'ok' });
});

router.post('/messages/:id/read', authRequired, async (req, res) => {
  const messageId = Number(req.params.id);
  if (!messageId) return res.status(422).json({ error: 'Invalid message id' });

  const msg = await queryOne('SELECT conversation_id FROM messages WHERE id = ? LIMIT 1', [messageId]);
  if (!msg) return res.status(404).json({ error: 'Message not found' });

  const member = await queryOne(
    'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ? LIMIT 1',
    [msg.conversation_id, req.user.id]
  );
  if (!member) return res.status(403).json({ error: 'Forbidden' });

  await query('INSERT IGNORE INTO message_reads (message_id, user_id, read_at) VALUES (?, ?, NOW())', [messageId, req.user.id]);
  await query(
    'UPDATE conversation_participants SET last_read_message_id = GREATEST(COALESCE(last_read_message_id, 0), ?) WHERE conversation_id = ? AND user_id = ?',
    [messageId, msg.conversation_id, req.user.id]
  );

  await trigger(`private-conversation.${msg.conversation_id}`, 'message:read', { message_id: messageId, user_id: req.user.id });
  res.json({ status: 'ok' });
});

module.exports = router;

