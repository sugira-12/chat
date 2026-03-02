const express = require('express');
const multer = require('multer');

const { authRequired } = require('../middleware/auth');
const { query } = require('../db');
const { uploadBuffer } = require('../utils/cloudinary');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});

router.post('/avatar', authRequired, upload.single('file'), async (req, res) => {
  if (!req.file || !req.file.buffer) return res.status(422).json({ error: 'file is required' });
  const uploaded = await uploadBuffer(req.file.buffer, { resource_type: 'image' });
  await query('UPDATE users SET avatar_url = ?, updated_at = NOW() WHERE id = ?', [uploaded.secure_url, req.user.id]);
  res.json({ avatar_url: uploaded.secure_url });
});

router.post('/cover', authRequired, upload.single('file'), async (req, res) => {
  if (!req.file || !req.file.buffer) return res.status(422).json({ error: 'file is required' });
  const uploaded = await uploadBuffer(req.file.buffer, { resource_type: 'image' });
  await query('UPDATE users SET cover_photo_url = ?, updated_at = NOW() WHERE id = ?', [uploaded.secure_url, req.user.id]);
  res.json({ cover_photo_url: uploaded.secure_url });
});

module.exports = router;

