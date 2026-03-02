const jwt = require('jsonwebtoken');

const signJwt = (payload, opts = {}) => {
  const secret = process.env.JWT_SECRET || 'change_me';
  const expiresIn = opts.expiresIn || process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(payload, secret, { expiresIn });
};

const verifyJwt = (token) => {
  const secret = process.env.JWT_SECRET || 'change_me';
  return jwt.verify(token, secret);
};

module.exports = { signJwt, verifyJwt };

