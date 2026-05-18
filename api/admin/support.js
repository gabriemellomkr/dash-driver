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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!SB_SERVICE_ROLE_KEY) return res.status(500).json({ error: 'Service role not configured' });
  if (!await adminCheck(req)) return res.status(403).json({ error: 'Forbidden' });

  if (req.method === 'GET') {
    const r = await fetch(`${SB_URL}/rest/v1/dashdriver_support?select=*&order=created_at.desc`, {
      headers: { apikey: SB_SERVICE_ROLE_KEY, Authorization: `Bearer ${SB_SERVICE_ROLE_KEY}` }
    });
    const tickets = await r.json();
    return res.status(200).json({ tickets: Array.isArray(tickets) ? tickets : [] });
  }

  if (req.method === 'POST') {
    const { id, status, resposta } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const r = await fetch(`${SB_URL}/rest/v1/dashdriver_support?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        apikey: SB_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SB_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ status: status || 'resolved', resposta: resposta || '', updated_at: new Date().toISOString() }),
    });
    const updated = await r.json();
    return res.status(200).json({ ok: true, ticket: Array.isArray(updated) ? updated[0] : updated });
  }

  res.status(405).end();
};
