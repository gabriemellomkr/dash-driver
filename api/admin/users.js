const pool = require('./_db');
const { verifyAdmin } = require('./_auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();
  if (!verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

  const client = await pool.connect();
  try {
    const [rUsers, rPlans, rCorridas, rTokens] = await Promise.all([
      client.query(`
        SELECT id, email, created_at, last_sign_in_at
        FROM auth.users
        ORDER BY created_at DESC
      `),
      client.query('SELECT user_id, plano, trial_ends_at, stripe_status, id FROM public.dashdriver_plans'),
      client.query('SELECT user_id, count(*)::int AS cnt FROM public.dashdriver_corridas GROUP BY user_id'),
      client.query(`
        SELECT user_id,
               coalesce(sum(tokens_in),0)::int  AS tokens_in,
               coalesce(sum(tokens_out),0)::int AS tokens_out
        FROM public.dashdriver_token_usage
        GROUP BY user_id
      `),
    ]);

    const plansMap = {};
    rPlans.rows.forEach(p => { plansMap[p.user_id] = p; });

    const corridaMap = {};
    rCorridas.rows.forEach(r => { corridaMap[r.user_id] = r.cnt; });

    const tokenMap = {};
    rTokens.rows.forEach(r => { tokenMap[r.user_id] = { in: r.tokens_in, out: r.tokens_out }; });

    const users = rUsers.rows.map(u => ({
      id:            u.id,
      email:         u.email,
      created_at:    u.created_at,
      last_sign_in:  u.last_sign_in_at,
      corridas:      corridaMap[u.id] || 0,
      tokens_in:     tokenMap[u.id]?.in  || 0,
      tokens_out:    tokenMap[u.id]?.out || 0,
      plano:         plansMap[u.id]?.plano || 'trial',
      trial_ends_at: plansMap[u.id]?.trial_ends_at || null,
      stripe_status: plansMap[u.id]?.stripe_status || null,
      plan_id:       plansMap[u.id]?.id || null,
    }));

    return res.status(200).json({ users, total: users.length });
  } finally {
    client.release();
  }
};
