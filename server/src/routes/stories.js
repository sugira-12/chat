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
    fileSize: 30 * 1024 * 1024,
  },
});

router.get('/', authRequired, async (req, res) => {
  const limit = Math.max(1, Math.min(50, Number(req.query.limit || 30)));
  const items = await query(
    `
    SELECT s.*, u.username, u.name, u.avatar_url,
      (SELECT 1 FROM story_views sv WHERE sv.story_id = s.id AND sv.viewer_id = ? LIMIT 1) AS viewed_by_me
    FROM stories s
    JOIN users u ON u.id = s.user_id
    WHERE s.expires_at > NOW()
    ORDER BY s.created_at DESC
    LIMIT ?
    `,
    [req.user.id, limit]
  );
  res.json({ items });
});

router.post('/', authRequired, upload.single('media'), async (req, res) => {
  if (!req.file || !req.file.buffer) return res.status(422).json({ error: 'media is required' });

  const caption = typeof req.body?.caption === 'string' ? req.body.caption.slice(0, 2000) : null;
  const uploaded = await uploadBuffer(req.file.buffer, { resource_type: 'auto' });
  const mediaType = uploaded.resource_type === 'video' ? 'video' : 'image';

  // Expires in 24 hours.
  await query(
    'INSERT INTO stories (user_id, media_type, media_url, caption, created_at, expires_at) VALUES (?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 24 HOUR))',
    [req.user.id, mediaType, uploaded.secure_url, caption]
  );

  res.status(201).json({ status: 'created' });
});

router.post('/:id/view', authRequired, async (req, res) => {
  const storyId = Number(req.params.id);
  if (!storyId) return res.status(422).json({ error: 'Invalid story id' });

  const story = await queryOne('SELECT user_id FROM stories WHERE id = ? LIMIT 1', [storyId]);
  if (!story) return res.status(404).json({ error: 'Story not found' });

  await query('INSERT IGNORE INTO story_views (story_id, viewer_id, viewed_at) VALUES (?, ?, NOW())', [storyId, req.user.id]);
  res.json({ status: 'viewed' });
});

router.post('/:id/reply', authRequired, async (req, res) => {
  const storyId = Number(req.params.id);
  if (!storyId) return res.status(422).json({ error: 'Invalid story id' });

  const schema = z.object({ body: z.string().min(1).max(2000) });
  const parsed = schema.safeParse({ body: req.body && req.body.body });
  if (!parsed.success) return res.status(422).json({ error: 'Validation failed', details: parsed.error.flatten() });

  const story = await queryOne('SELECT user_id FROM stories WHERE id = ? LIMIT 1', [storyId]);
  if (!story) return res.status(404).json({ error: 'Story not found' });

  await query('INSERT INTO story_replies (story_id, user_id, body, created_at) VALUES (?, ?, ?, NOW())', [storyId, req.user.id, parsed.data.body]);
  if (Number(story.user_id) !== req.user.id) {
    await createNotification(Number(story.user_id), req.user.id, 'comment', { story_id: storyId });
  }
  res.json({ status: 'sent' });
});

router.get('/:id/replies', authRequired, async (req, res) => {
  const storyId = Number(req.params.id);
  if (!storyId) return res.status(422).json({ error: 'Invalid story id' });
  const limit = Math.max(1, Math.min(50, Number(req.query.limit || 30)));

  const items = await query(
    `
    SELECT sr.*, u.username, u.avatar_url
    FROM story_replies sr
    JOIN users u ON u.id = sr.user_id
    WHERE sr.story_id = ?
    ORDER BY sr.created_at ASC
    LIMIT ?
    `,
    [storyId, limit]
  );
  res.json({ items });
});

module.exports = router;

