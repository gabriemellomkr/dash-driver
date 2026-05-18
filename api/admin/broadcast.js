const SB_URL = process.env.SB_URL;
const SB_SERVICE_ROLE_KEY = process.env.SB_SERVICE_ROLE_KEY;
const EVOLUTION_URL = process.env.EVOLUTION_URL;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;
const EVOLUTION_KEY = process.env.EVOLUTION_KEY;

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

  const { message, plano_filter } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message required' });

  // Get all users with phone numbers
  let url = `${SB_URL}/rest/v1/dashdriver_config?select=user_id,telefone&telefone=neq.`;
  if (plano_filter) {
    // filter by plan — get user_ids first
    const rP = await fetch(`${SB_URL}/rest/v1/dashdriver_plans?plano=eq.${plano_filter}&select=user_id`, {
      headers: { apikey: SB_SERVICE_ROLE_KEY, Authorization: `Bearer ${SB_SERVICE_ROLE_KEY}` }
    });
    const planUsers = await rP.json();
    const ids = (Array.isArray(planUsers) ? planUsers : []).map(p => p.user_id);
    if (ids.length === 0) return res.status(200).json({ sent: 0, failed: 0, total: 0 });
    url += `&user_id=in.(${ids.join(',')})`;
  }

  const rConfig = await fetch(url, {
    headers: { apikey: SB_SERVICE_ROLE_KEY, Authorization: `Bearer ${SB_SERVICE_ROLE_KEY}` }
  });
  const configs = await rConfig.json();
  const recipients = (Array.isArray(configs) ? configs : []).filter(c => c.telefone && c.telefone.length >= 10);

  let sent = 0, failed = 0;
  await Promise.allSettled(recipients.map(async (c) => {
    try {
      const r = await fetch(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_KEY },
        body: JSON.stringify({ number: c.telefone, text: message }),
      });
      if (r.ok) sent++; else failed++;
    } catch { failed++; }
  }));

  res.status(200).json({ sent, failed, total: recipients.length });
};
