const pool = require('./admin/_db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET /api/support?email=xxx → plano + tickets do usuário ─────────────
  if (req.method === 'GET') {
    const email = (req.query?.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ error: 'email obrigatório' });

    let client;
    try {
      client = await pool.connect();

      const [rPlan, rTickets] = await Promise.all([
        client.query(
          `SELECT p.plano, p.trial_ends_at, p.expires_at, p.stripe_subscription_id
           FROM auth.users u
           LEFT JOIN public.dashdriver_plans p ON p.user_id = u.id
           WHERE lower(u.email) = $1 LIMIT 1`,
          [email]
        ),
        client.query(
          `SELECT s.id, s.titulo, s.mensagem, s.status, s.resposta, s.created_at
           FROM public.dashdriver_support s
           WHERE s.user_id = (SELECT id FROM auth.users WHERE lower(email) = $1 LIMIT 1)
           ORDER BY s.created_at DESC LIMIT 10`,
          [email]
        ),
      ]);

      const row = rPlan.rows[0] || {};
      return res.status(200).json({
        plano:         row.plano || null,
        trial_ends_at: row.trial_ends_at || null,
        expires_at:    row.expires_at || null,
        has_stripe:    !!row.stripe_subscription_id,
        tickets:       rTickets.rows,
      });
    } catch (err) {
      console.error('[support/GET]', err.message);
      return res.status(500).json({ error: err.message });
    } finally {
      if (client) client.release();
    }
  }

  // ── POST /api/support → cria ticket ─────────────────────────────────────
  if (req.method !== 'POST') return res.status(405).end();

  const { titulo, mensagem, user_id, email } = req.body || {};
  if (!titulo || !mensagem)
    return res.status(400).json({ error: 'titulo e mensagem são obrigatórios' });

  let client;
  try {
    client = await pool.connect();

    // Resolve user_id pelo email se não foi passado diretamente
    let resolvedUserId = user_id || null;
    if (!resolvedUserId && email) {
      const r = await client.query(
        'SELECT id FROM auth.users WHERE lower(email) = lower($1) LIMIT 1',
        [email]
      );
      if (r.rows.length) resolvedUserId = r.rows[0].id;
    }

    const r = await client.query(
      `INSERT INTO public.dashdriver_support (titulo, mensagem, user_id, status)
       VALUES ($1, $2, $3, 'open')
       RETURNING id, created_at`,
      [titulo.substring(0, 200), mensagem.substring(0, 2000), resolvedUserId]
    );
    return res.status(200).json({ ok: true, id: r.rows[0].id });
  } catch (err) {
    console.error('[support/POST]', err.message);
    return res.status(500).json({ error: 'Erro ao enviar ticket', detail: err.message });
  } finally {
    if (client) client.release();
  }
};
