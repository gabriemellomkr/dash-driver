const SB_URL = process.env.SB_URL;
const SB_KEY = process.env.SB_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { subscription } = req.body || {};
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ error: 'invalid subscription' });
  }

  const r = await fetch(`${SB_URL}/rest/v1/dashdriver_push_subscriptions`, {
    method: 'POST',
    headers: {
      apikey: SB_KEY,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      p256dh:   subscription.keys.p256dh,
      auth:     subscription.keys.auth,
    }),
  });

  if (!r.ok) {
    const err = await r.text();
    return res.status(500).json({ error: err });
  }

  res.status(200).json({ ok: true });
};
