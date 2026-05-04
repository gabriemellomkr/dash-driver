const webpush = require('web-push');

webpush.setVapidDetails(
  'mailto:gabriel18mello@gmail.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

const SB_URL = process.env.SB_URL;
const SB_KEY = process.env.SB_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { title, body, icon = '/icon-192.png', tag = '', url = '/' } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title required' });

  const r = await fetch(`${SB_URL}/rest/v1/dashdriver_push_subscriptions?select=*`, {
    headers: { apikey: SB_KEY },
  });
  const subs = await r.json();
  if (!Array.isArray(subs) || !subs.length) {
    return res.status(200).json({ sent: 0, reason: 'no subscriptions' });
  }

  const payload = JSON.stringify({ title, body, icon, tag, url });

  const results = await Promise.allSettled(
    subs.map(s =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
      ),
    ),
  );

  // Remove expired subscriptions (410 Gone)
  const expired = results
    .map((r, i) => ({ r, s: subs[i] }))
    .filter(({ r }) => r.status === 'rejected' && r.reason?.statusCode === 410);

  if (expired.length) {
    await Promise.allSettled(
      expired.map(({ s }) =>
        fetch(`${SB_URL}/rest/v1/dashdriver_push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`, {
          method: 'DELETE',
          headers: { apikey: SB_KEY },
        }),
      ),
    );
  }

  const sent = results.filter(r => r.status === 'fulfilled').length;
  res.status(200).json({ sent });
};
