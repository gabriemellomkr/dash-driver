const pool = require('./_db');
const { verifyAdmin } = require('./_auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();
  if (!verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

  let client;
  try {
    client = await pool.connect();
  } catch (connErr) {
    console.error('[stats] DB connect error:', connErr.message);
    return res.status(500).json({ error: 'DB connection failed', detail: connErr.message });
  }

  try {
    const [rUsers, rCorridas, rTokens, rSupport, rPlans] = await Promise.all([
      client.query('SELECT count(*)::int AS total FROM auth.users'),
      client.query('SELECT count(*)::int AS total FROM public.dashdriver_corridas'),
      client.query('SELECT coalesce(sum(tokens_in),0)::int AS total_in, coalesce(sum(tokens_out),0)::int AS total_out FROM public.dashdriver_token_usage'),
      client.query("SELECT count(*)::int AS total FROM public.dashdriver_support WHERE status='open'"),
      client.query('SELECT plano, count(*)::int AS cnt FROM public.dashdriver_plans GROUP BY plano'),
    ]);

    const planCounts = { trial: 0, basic: 0, premium: 0, expired: 0 };
    rPlans.rows.forEach(r => { if (planCounts[r.plano] !== undefined) planCounts[r.plano] = r.cnt; });

    return res.status(200).json({
      total_users:     rUsers.rows[0].total,
      total_corridas:  rCorridas.rows[0].total,
      total_tokens_in: rTokens.rows[0].total_in,
      total_tokens_out: rTokens.rows[0].total_out,
      open_tickets:    rSupport.rows[0].total,
      plans:           planCounts,
    });
  } catch (queryErr) {
    console.error('[stats] Query error:', queryErr.message);
    return res.status(500).json({ error: 'Query failed', detail: queryErr.message });
  } finally {
    client.release();
  }
};
