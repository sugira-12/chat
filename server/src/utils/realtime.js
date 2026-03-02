const Pusher = require('pusher');

let client = null;

const getPusher = () => {
  const key = process.env.PUSHER_KEY || '';
  const appId = process.env.PUSHER_APP_ID || '';
  const secret = process.env.PUSHER_SECRET || '';
  const cluster = process.env.PUSHER_CLUSTER || 'mt1';

  if (!key || !appId || !secret) return null;
  if (client) return client;

  client = new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });
  return client;
};

const trigger = async (channel, event, payload) => {
  const pusher = getPusher();
  if (!pusher) return false;
  try {
    await pusher.trigger(channel, event, payload);
    return true;
  } catch (e) {
    return false;
  }
};

module.exports = { getPusher, trigger };

