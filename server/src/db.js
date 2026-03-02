const mysql = require('mysql2/promise');

let pool = null;

const getPool = () => {
  if (pool) return pool;

  const url = process.env.DATABASE_URL || process.env.DB_URL || '';
  const baseConfig = {
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
    queueLimit: 0,
    charset: 'utf8mb4',
  };

  if (url) {
    const u = new URL(url);
    const cfg = {
      ...baseConfig,
      host: u.hostname,
      port: Number(u.port || 3306),
      user: decodeURIComponent(u.username || ''),
      password: decodeURIComponent(u.password || ''),
      database: (u.pathname || '').replace(/^\//, '') || 'cyber',
    };
    if (String(process.env.DB_SSL || '') === '1' || u.searchParams.get('ssl') === 'true') {
      cfg.ssl = { rejectUnauthorized: String(process.env.DB_SSL_REJECT_UNAUTHORIZED || '1') === '1' };
    }
    pool = mysql.createPool(cfg);
    return pool;
  }

  pool = mysql.createPool({
    ...baseConfig,
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'cyber',
  });
  return pool;
};

const query = async (sql, params = []) => {
  const [rows] = await getPool().execute(sql, params);
  return rows;
};

const queryOne = async (sql, params = []) => {
  const rows = await query(sql, params);
  return rows && rows[0] ? rows[0] : null;
};

module.exports = { getPool, query, queryOne };

