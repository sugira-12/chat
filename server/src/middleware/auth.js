const { verifyJwt } = require('../utils/jwt');
const { queryOne } = require('../db');

const authRequired = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const payload = verifyJwt(token);
    const userId = Number(payload && payload.sub);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await queryOne(
      'SELECT id, uuid, name, username, email, role, avatar_url AS avatarUrl, cover_photo_url AS coverUrl, bio, email_verified_at AS emailVerifiedAt, created_at AS createdAt FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    req.user = user;
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

module.exports = { authRequired };
