const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');

const { query, queryOne } = require('../db');
const { signJwt } = require('../utils/jwt');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  const schema = z.object({
    name: z.string().min(2).max(100),
    username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/, 'Invalid username'),
    email: z.string().email().max(190),
    password: z.string().min(8).max(200),
  });

  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(422).json({ error: 'Validation failed', details: parsed.error.flatten() });
  }

  const { name, username, email, password } = parsed.data;
  const emailLower = email.toLowerCase();

  const existingEmail = await queryOne('SELECT id FROM users WHERE email = ? LIMIT 1', [emailLower]);
  if (existingEmail) return res.status(409).json({ error: 'Email already in use' });
  const existingUsername = await queryOne('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
  if (existingUsername) return res.status(409).json({ error: 'Username already in use' });

  const passwordHash = await bcrypt.hash(password, 12);
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

  const result = await query(
    'INSERT INTO users (uuid, name, username, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, "user", NOW(), NOW())',
    [uuid, name, username, emailLower, passwordHash]
  );

  const userId = Number(result.insertId || 0);
  const user = await queryOne(
    'SELECT id, uuid, name, username, email, role, avatar_url AS avatarUrl, cover_photo_url AS coverUrl, bio, email_verified_at AS emailVerifiedAt, created_at AS createdAt FROM users WHERE id = ? LIMIT 1',
    [userId]
  );

  await query(
    'INSERT INTO user_status (user_id, is_online, last_seen_at) VALUES (?, 1, NOW()) ON DUPLICATE KEY UPDATE is_online = 1, last_seen_at = NOW()',
    [userId]
  );

  const token = signJwt({ sub: userId });
  return res.status(201).json({ user, token });
});

router.post('/login', async (req, res) => {
  const schema = z.object({
    email: z.string().email().max(190),
    password: z.string().min(1).max(200),
  });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(422).json({ error: 'Validation failed', details: parsed.error.flatten() });
  }

  const { email, password } = parsed.data;
  const userRow = await queryOne('SELECT * FROM users WHERE email = ? LIMIT 1', [email.toLowerCase()]);
  if (!userRow) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, String(userRow.password_hash || ''));
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  await query(
    'INSERT INTO user_status (user_id, is_online, last_seen_at) VALUES (?, 1, NOW()) ON DUPLICATE KEY UPDATE is_online = 1, last_seen_at = NOW()',
    [userRow.id]
  );

  const user = {
    id: userRow.id,
    uuid: userRow.uuid,
    name: userRow.name,
    username: userRow.username,
    email: userRow.email,
    role: userRow.role,
    avatarUrl: userRow.avatar_url,
    coverUrl: userRow.cover_photo_url,
    bio: userRow.bio,
    emailVerifiedAt: userRow.email_verified_at,
    createdAt: userRow.created_at,
  };

  const token = signJwt({ sub: user.id });
  return res.json({ user, token });
});

router.get('/me', authRequired, async (req, res) => {
  return res.json({ user: req.user });
});

router.post('/logout', authRequired, async (req, res) => {
  await query('UPDATE user_status SET is_online = 0, last_seen_at = NOW() WHERE user_id = ?', [req.user.id]);
  return res.status(204).send();
});

module.exports = router;
