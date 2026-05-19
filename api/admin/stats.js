const crypto = require('crypto');
const pool = require('./_db');
const { verifyAdmin } = require('./_auth');

const JWT_SECRET   = process.env.JWT_SECRET   || 'DashDriver_Ultra_Secret_Key_2026_SquadHQ';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'gabriel18mello@gmail.com')
  .split(',').map(e => e.trim().toLowerCase());

function verifyJWT(token) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Formato JWT inválido');
  const [h, p, sig] = parts;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${p}`)
    .digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  if (expected !== sig) throw new Error('Assinatura JWT inválida');
  const decoded = JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expirado');
  return decoded;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // POST /api/admin/stats → substitui /api/admin/auth-check
  if (req.method === 'POST') {
    const { user_id, email, access_token } = req.body || {};
    if (!user_id || !email || !access_token)
      return res.status(400).json({ admin: false, error: 'Missing fields' });
    try {
      const claims = verifyJWT(access_token);
      const tokenEmail = (claims.email || '').toLowerCase();
      if (tokenEmail !== email.toLowerCase()) return res.status(200).json({ admin: false });
      return res.status(200).json({ admin: ADMIN_EMAILS.includes(tokenEmail) });
    } catch (e) {
      return res.status(200).json({ admin: false, error: e.message });
    }
  }

  // GET /api/admin/stats → retorna métricas
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

    const planCounts = { trial: 0, active: 0, expired: 0 };
    rPlans.rows.forEach(r => { if (planCounts[r.plano] !== undefined) planCounts[r.plano] = r.cnt; });

    return res.status(200).json({
      total_users:      rUsers.rows[0].total,
      total_corridas:   rCorridas.rows[0].total,
      total_tokens_in:  rTokens.rows[0].total_in,
      total_tokens_out: rTokens.rows[0].total_out,
      open_tickets:     rSupport.rows[0].total,
      plans:            planCounts,
    });
  } catch (queryErr) {
    console.error('[stats] Query error:', queryErr.message);
    return res.status(500).json({ error: 'Query failed', detail: queryErr.message });
  } finally {
    client.release();
  }
};
