const SB_URL = process.env.SB_URL;
const SB_SERVICE_ROLE_KEY = process.env.SB_SERVICE_ROLE_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { user_id, email } = req.body || {};
  if (!user_id || !email) return res.status(400).json({ admin: false });

  if (!SB_SERVICE_ROLE_KEY) return res.status(500).json({ error: 'Service role not configured' });

  const r = await fetch(`${SB_URL}/rest/v1/dashdriver_admins?email=eq.${encodeURIComponent(email)}&select=id`, {
    headers: { apikey: SB_SERVICE_ROLE_KEY, Authorization: `Bearer ${SB_SERVICE_ROLE_KEY}` }
  });
  const rows = await r.json();
  res.status(200).json({ admin: Array.isArray(rows) && rows.length > 0 });
};
