const SB_URL = process.env.SB_URL;
const SB_SERVICE_ROLE_KEY = process.env.SB_SERVICE_ROLE_KEY;

const adminCheck = async (req) => {
  if (!req.headers.authorization) return false;
  const token = req.headers.authorization.replace('Bearer ', '');
  const r = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: SB_SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` }
  });
  if (!r.ok) return false;
  const user = await r.json();
  const ra = await fetch(`${SB_URL}/rest/v1/dashdriver_admins?email=eq.${encodeURIComponent(user.email)}&select=id`, {
    headers: { apikey: SB_SERVICE_ROLE_KEY, Authorization: `Bearer ${SB_SERVICE_ROLE_KEY}` }
  });
  const admins = await ra.json();
  return Array.isArray(admins) && admins.length > 0;
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  if (!SB_SERVICE_ROLE_KEY) return res.status(500).json({ error: 'Service role not configured' });
  if (!await adminCheck(req)) return res.status(403).json({ error: 'Forbidden' });

  const { user_id, plano, trial_ends_at, obs } = req.body || {};
  if (!user_id || !plano) return res.status(400).json({ error: 'user_id and plano required' });

  const payload = { user_id, plano, obs: obs || null, updated_at: new Date().toISOString() };
  if (trial_ends_at) payload.trial_ends_at = trial_ends_at;

  const r = await fetch(`${SB_URL}/rest/v1/dashdriver_plans?user_id=eq.${user_id}`, {
    method: 'PATCH',
    headers: {
      apikey: SB_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SB_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(payload),
  });
  const existing = await r.json();

  if (!Array.isArray(existing) || existing.length === 0) {
    // Insert
    const ri = await fetch(`${SB_URL}/rest/v1/dashdriver_plans`, {
      method: 'POST',
      headers: {
        apikey: SB_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SB_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(payload),
    });
    const inserted = await ri.json();
    return res.status(200).json({ ok: true, plan: Array.isArray(inserted) ? inserted[0] : inserted });
  }

  res.status(200).json({ ok: true, plan: existing[0] });
};
