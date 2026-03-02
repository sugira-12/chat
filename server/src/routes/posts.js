const express = require('express');
const multer = require('multer');
const { z } = require('zod');

const { authRequired } = require('../middleware/auth');
const { query, queryOne } = require('../db');
const { uploadBuffer } = require('../utils/cloudinary');
const { createNotification } = require('../services/notifications');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
  },
});

const pickPost = async (postId, viewerId) => {
  return queryOne(
    `
    SELECT p.*, u.username, u.name, u.avatar_url,
      (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS likes_count,
      (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) AS comments_count,
      (SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = ? LIMIT 1) AS liked_by_me,
      (SELECT pm.url FROM post_media pm WHERE pm.post_id = p.id ORDER BY pm.sort_order ASC LIMIT 1) AS media_url,
      (SELECT pm.media_type FROM post_media pm WHERE pm.post_id = p.id ORDER BY pm.sort_order ASC LIMIT 1) AS media_type
    FROM posts p
    JOIN users u ON u.id = p.user_id
    WHERE p.id = ?
    LIMIT 1
    `,
    [viewerId, postId]
  );
};

router.get('/feed', authRequired, async (req, res) => {
  const limit = Math.max(1, Math.min(50, Number(req.query.limit || 20)));
  const cursor = Number(req.query.cursor || 0) || null;
  const sinceId = Number(req.query.since_id || 0) || null;

  const rows = await query(
    `
    SELECT p.*, u.username, u.name, u.avatar_url,
      (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS likes_count,
      (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) AS comments_count,
      (SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = ? LIMIT 1) AS liked_by_me,
      (SELECT pm.url FROM post_media pm WHERE pm.post_id = p.id ORDER BY pm.sort_order ASC LIMIT 1) AS media_url,
      (SELECT pm.media_type FROM post_media pm WHERE pm.post_id = p.id ORDER BY pm.sort_order ASC LIMIT 1) AS media_type
    FROM posts p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN follows f ON f.followed_id = p.user_id AND f.follower_id = ?
    WHERE (p.user_id = ? OR f.follower_id = ? OR p.visibility = "public")
      AND (? IS NULL OR p.id < ?)
      AND (? IS NULL OR p.id > ?)
    ORDER BY (CASE WHEN p.user_id = ? OR f.follower_id = ? THEN 0 ELSE 1 END), p.id DESC
    LIMIT ?
    `,
    [
      req.user.id,
      req.user.id,
      req.user.id,
      req.user.id,
      cursor,
      cursor,
      sinceId,
      sinceId,
      req.user.id,
      req.user.id,
      limit,
    ]
  );

  const nextCursor = rows.length === limit ? Math.min(...rows.map((r) => Number(r.id))) : null;
  res.json({ items: rows, next_cursor: nextCursor });
});

router.post('/', authRequired, upload.array('media', 6), async (req, res) => {
  const schema = z.object({
    body: z.string().max(5000).optional().nullable(),
    visibility: z.enum(['public', 'followers', 'friends', 'private']).optional(),
  });
  const parsed = schema.safeParse({
    body: req.body && typeof req.body.body === 'string' ? req.body.body : null,
    visibility: req.body && req.body.visibility ? req.body.visibility : undefined,
  });
  if (!parsed.success) {
    return res.status(422).json({ error: 'Validation failed', details: parsed.error.flatten() });
  }

  const body = (parsed.data.body || '').trim();
  const visibility = parsed.data.visibility || 'public';
  const files = Array.isArray(req.files) ? req.files : [];

  if (!body && files.length === 0) {
    return res.status(422).json({ error: 'Post body or media is required' });
  }

  const result = await query(
    'INSERT INTO posts (user_id, body, visibility, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
    [req.user.id, body || null, visibility]
  );
  const postId = Number(result.insertId || 0);

  for (let i = 0; i < files.length; i += 1) {
    const f = files[i];
    const uploaded = await uploadBuffer(f.buffer, { resource_type: 'auto' });
    const type = uploaded.resource_type === 'video' ? 'video' : 'image';
    await query(
      'INSERT INTO post_media (post_id, media_type, url, thumb_url, sort_order) VALUES (?, ?, ?, ?, ?)',
      [postId, type, uploaded.secure_url, uploaded.secure_url, i]
    );
  }

  const post = await pickPost(postId, req.user.id);
  return res.status(201).json({ post });
});

router.post('/:id/like', authRequired, async (req, res) => {
  const postId = Number(req.params.id);
  if (!postId) return res.status(422).json({ error: 'Invalid post id' });

  await query('INSERT IGNORE INTO post_likes (user_id, post_id, created_at) VALUES (?, ?, NOW())', [req.user.id, postId]);
  const post = await queryOne('SELECT user_id FROM posts WHERE id = ? LIMIT 1', [postId]);
  if (post && Number(post.user_id) !== req.user.id) {
    await createNotification(Number(post.user_id), req.user.id, 'like', { post_id: postId });
  }
  res.json({ status: 'liked' });
});

router.delete('/:id/like', authRequired, async (req, res) => {
  const postId = Number(req.params.id);
  if (!postId) return res.status(422).json({ error: 'Invalid post id' });
  await query('DELETE FROM post_likes WHERE user_id = ? AND post_id = ?', [req.user.id, postId]);
  res.json({ status: 'unliked' });
});

router.post('/:id/comment', authRequired, async (req, res) => {
  const postId = Number(req.params.id);
  if (!postId) return res.status(422).json({ error: 'Invalid post id' });

  const schema = z.object({
    body: z.string().min(1).max(2000),
    parent_id: z.number().int().positive().optional().nullable(),
  });
  const parsed = schema.safeParse({
    body: req.body && req.body.body,
    parent_id: req.body && req.body.parent_id ? Number(req.body.parent_id) : null,
  });
  if (!parsed.success) return res.status(422).json({ error: 'Validation failed', details: parsed.error.flatten() });

  await query(
    'INSERT INTO post_comments (post_id, user_id, parent_id, body, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
    [postId, req.user.id, parsed.data.parent_id || null, parsed.data.body]
  );

  const post = await queryOne('SELECT user_id FROM posts WHERE id = ? LIMIT 1', [postId]);
  if (post && Number(post.user_id) !== req.user.id) {
    await createNotification(Number(post.user_id), req.user.id, 'comment', { post_id: postId });
  }
  res.json({ status: 'commented' });
});

router.get('/:id/comments', authRequired, async (req, res) => {
  const postId = Number(req.params.id);
  if (!postId) return res.status(422).json({ error: 'Invalid post id' });

  const limit = Math.max(1, Math.min(100, Number(req.query.limit || 30)));
  const order = String(req.query.order || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  const items = await query(
    `
    SELECT pc.*, u.username, u.avatar_url
    FROM post_comments pc
    JOIN users u ON u.id = pc.user_id
    WHERE pc.post_id = ? AND pc.deleted_at IS NULL
    ORDER BY pc.created_at ${order}
    LIMIT ?
    `,
    [postId, limit]
  );
  res.json({ items });
});

router.post('/:id/share', authRequired, async (req, res) => {
  const postId = Number(req.params.id);
  if (!postId) return res.status(422).json({ error: 'Invalid post id' });
  const text = typeof req.body?.text === 'string' ? req.body.text.slice(0, 2000) : null;
  await query(
    'INSERT INTO post_shares (user_id, post_id, share_text, created_at) VALUES (?, ?, ?, NOW())',
    [req.user.id, postId, text]
  );
  res.json({ status: 'shared' });
});

router.post('/:id/bookmark', authRequired, async (req, res) => {
  const postId = Number(req.params.id);
  if (!postId) return res.status(422).json({ error: 'Invalid post id' });
  await query('INSERT IGNORE INTO post_bookmarks (user_id, post_id, created_at) VALUES (?, ?, NOW())', [req.user.id, postId]);
  res.json({ status: 'bookmarked' });
});

module.exports = router;

