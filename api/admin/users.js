const SB_URL = process.env.SB_URL;
const SB_SERVICE_ROLE_KEY = process.env.SB_SERVICE_ROLE_KEY;

const adminCheck = async (req) => {
  if (!req.headers.authorization) return false;
  const token = req.headers.authorization.replace('Bearer ', '');
  // Verify by checking the user exists in admins table via service role
  // Simple: trust the token came from a valid Supabase session, validate email
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

  // Get all auth users
  const rUsers = await fetch(`${SB_URL}/auth/v1/admin/users?page=1&per_page=200`, {
    headers: { apikey: SB_SERVICE_ROLE_KEY, Authorization: `Bearer ${SB_SERVICE_ROLE_KEY}` }
  });
  const { users = [] } = await rUsers.json();

  // Get plans for all users
  const rPlans = await fetch(`${SB_URL}/rest/v1/dashdriver_plans?select=*`, {
    headers: { apikey: SB_SERVICE_ROLE_KEY, Authorization: `Bearer ${SB_SERVICE_ROLE_KEY}` }
  });
  const plans = await rPlans.json();

  // Get corridas count per user
  const rCorridas = await fetch(`${SB_URL}/rest/v1/dashdriver_corridas?select=user_id`, {
    headers: { apikey: SB_SERVICE_ROLE_KEY, Authorization: `Bearer ${SB_SERVICE_ROLE_KEY}` }
  });
  const corridas = await rCorridas.json();

  // Get token usage per user
  const rTokens = await fetch(`${SB_URL}/rest/v1/dashdriver_token_usage?select=user_id,tokens_in,tokens_out`, {
    headers: { apikey: SB_SERVICE_ROLE_KEY, Authorization: `Bearer ${SB_SERVICE_ROLE_KEY}` }
  });
  const tokens = await rTokens.json();

  // Aggregate
  const corridaCount = {};
  if (Array.isArray(corridas)) corridas.forEach(c => { corridaCount[c.user_id] = (corridaCount[c.user_id] || 0) + 1; });

  const tokenCount = {};
  if (Array.isArray(tokens)) tokens.forEach(t => {
    if (!tokenCount[t.user_id]) tokenCount[t.user_id] = { in: 0, out: 0 };
    tokenCount[t.user_id].in  += t.tokens_in  || 0;
    tokenCount[t.user_id].out += t.tokens_out || 0;
  });

  const plansMap = {};
  if (Array.isArray(plans)) plans.forEach(p => { plansMap[p.user_id] = p; });

  const result = users.map(u => ({
    id:           u.id,
    email:        u.email,
    created_at:   u.created_at,
    last_sign_in: u.last_sign_in_at,
    corridas:     corridaCount[u.id] || 0,
    tokens_in:    tokenCount[u.id]?.in  || 0,
    tokens_out:   tokenCount[u.id]?.out || 0,
    plano:        plansMap[u.id]?.plano || 'trial',
    trial_ends_at: plansMap[u.id]?.trial_ends_at || null,
    stripe_status: plansMap[u.id]?.stripe_status || null,
    plan_id:      plansMap[u.id]?.id || null,
  }));

  res.status(200).json({ users: result, total: result.length });
};
