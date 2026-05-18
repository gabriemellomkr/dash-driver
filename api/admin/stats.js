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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();
  if (!SB_SERVICE_ROLE_KEY) return res.status(500).json({ error: 'Service role not configured' });
  if (!await adminCheck(req)) return res.status(403).json({ error: 'Forbidden' });

  const [rUsers, rCorridas, rPlans, rTokens, rSupport] = await Promise.all([
    fetch(`${SB_URL}/auth/v1/admin/users?page=1&per_page=1`, {
      headers: { apikey: SB_SERVICE_ROLE_KEY, Authorization: `Bearer ${SB_SERVICE_ROLE_KEY}` }
    }),
    fetch(`${SB_URL}/rest/v1/dashdriver_corridas?select=id`, {
      headers: { apikey: SB_SERVICE_ROLE_KEY, Authorization: `Bearer ${SB_SERVICE_ROLE_KEY}`, Prefer: 'count=exact', Range: '0-0' }
    }),
    fetch(`${SB_URL}/rest/v1/dashdriver_plans?select=plano`, {
      headers: { apikey: SB_SERVICE_ROLE_KEY, Authorization: `Bearer ${SB_SERVICE_ROLE_KEY}` }
    }),
    fetch(`${SB_URL}/rest/v1/dashdriver_token_usage?select=tokens_in,tokens_out`, {
      headers: { apikey: SB_SERVICE_ROLE_KEY, Authorization: `Bearer ${SB_SERVICE_ROLE_KEY}` }
    }),
    fetch(`${SB_URL}/rest/v1/dashdriver_support?status=eq.open&select=id`, {
      headers: { apikey: SB_SERVICE_ROLE_KEY, Authorization: `Bearer ${SB_SERVICE_ROLE_KEY}` }
    }),
  ]);

  const usersData  = await rUsers.json();
  const plans      = await rPlans.json();
  const tokens     = await rTokens.json();
  const support    = await rSupport.json();
  const corridasCount = parseInt(rCorridas.headers.get('content-range')?.split('/')?.[1] || '0');

  const totalTokensIn  = Array.isArray(tokens) ? tokens.reduce((s,t) => s+(t.tokens_in||0), 0) : 0;
  const totalTokensOut = Array.isArray(tokens) ? tokens.reduce((s,t) => s+(t.tokens_out||0), 0) : 0;

  const planCounts = { trial: 0, basic: 0, premium: 0, expired: 0 };
  if (Array.isArray(plans)) plans.forEach(p => { if (planCounts[p.plano] !== undefined) planCounts[p.plano]++; });

  res.status(200).json({
    total_users:    usersData.total || 0,
    total_corridas: corridasCount,
    total_tokens_in:  totalTokensIn,
    total_tokens_out: totalTokensOut,
    open_tickets:   Array.isArray(support) ? support.length : 0,
    plans:          planCounts,
  });
};
