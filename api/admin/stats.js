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

  // POST → verificação de admin (login check)
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

  // GET → métricas completas
  if (req.method !== 'GET') return res.status(405).end();
  if (!verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

  let client;
  try {
    client = await pool.connect();
  } catch (connErr) {
    return res.status(500).json({ error: 'DB connection failed', detail: connErr.message });
  }

  try {
    const [
      rUsers, rCorridas, rTokens,
      rTicketStats, rOpenTickets, rInProgressTickets,
      rPlans,
    ] = await Promise.all([
      // Total de usuários
      client.query('SELECT count(*)::int AS total FROM auth.users'),
      // Total de corridas
      client.query('SELECT count(*)::int AS total FROM public.dashdriver_corridas'),
      // Tokens OCR
      client.query(`
        SELECT
          coalesce(sum(tokens_in),0)::int  AS total_in,
          coalesce(sum(tokens_out),0)::int AS total_out
        FROM public.dashdriver_token_usage
      `),
      // Contagem de tickets por status
      client.query(`
        SELECT status, count(*)::int AS cnt
        FROM public.dashdriver_support
        GROUP BY status
      `),
      // Tickets abertos (detalhes)
      client.query(`
        SELECT s.id, s.titulo, s.ticket_number, s.created_at,
               u.email AS user_email, du.full_name AS user_nome
        FROM public.dashdriver_support s
        LEFT JOIN auth.users u ON u.id = s.user_id
        LEFT JOIN public.dashdriver_usuarios du ON du.id = s.user_id
        WHERE s.status = 'open'
        ORDER BY s.created_at ASC
        LIMIT 20
      `),
      // Tickets em andamento (detalhes)
      client.query(`
        SELECT s.id, s.titulo, s.ticket_number, s.created_at, s.assigned_to,
               u.email AS user_email, du.full_name AS user_nome
        FROM public.dashdriver_support s
        LEFT JOIN auth.users u ON u.id = s.user_id
        LEFT JOIN public.dashdriver_usuarios du ON du.id = s.user_id
        WHERE s.status = 'in_progress'
        ORDER BY s.updated_at DESC
        LIMIT 20
      `),
      // Planos
      client.query(`
        SELECT plano, count(*)::int AS cnt
        FROM public.dashdriver_plans
        GROUP BY plano
      `),
    ]);

    // Tickets por status
    const ticketStats = { open: 0, in_progress: 0, resolved: 0 };
    rTicketStats.rows.forEach(r => {
      if (ticketStats[r.status] !== undefined) ticketStats[r.status] = r.cnt;
    });

    // Planos
    const planCounts = { trial: 0, active: 0, expired: 0, convidado: 0 };
    rPlans.rows.forEach(r => {
      if (planCounts[r.plano] !== undefined) planCounts[r.plano] = r.cnt;
      else planCounts[r.plano] = r.cnt; // planos inesperados também conta
    });

    return res.status(200).json({
      total_users:       rUsers.rows[0].total,
      total_corridas:    rCorridas.rows[0].total,
      total_tokens_in:   rTokens.rows[0].total_in,
      total_tokens_out:  rTokens.rows[0].total_out,
      // Tickets
      open_tickets:      ticketStats.open,
      in_progress_tickets: ticketStats.in_progress,
      resolved_tickets:  ticketStats.resolved,
      tickets_open_list:        rOpenTickets.rows,
      tickets_in_progress_list: rInProgressTickets.rows,
      // Planos
      plans: planCounts,
    });
  } catch (queryErr) {
    console.error('[stats] Query error:', queryErr.message);
    return res.status(500).json({ error: 'Query failed', detail: queryErr.message });
  } finally {
    client.release();
  }
};
