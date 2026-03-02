const app = require('../src/app');

module.exports = (req, res) => {
  // Express apps are compatible with Vercel's (req, res) handler signature.
  return app(req, res);
};

