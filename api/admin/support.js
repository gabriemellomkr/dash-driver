const pool = require('./_db');
const { verifyAdmin } = require('./_auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

  const client = await pool.connect();
  try {
    if (req.method === 'GET') {
      const r = await client.query(`
        SELECT s.*, u.email AS user_email, du.full_name AS user_nome, c.telefone AS user_telefone
        FROM public.dashdriver_support s
        LEFT JOIN auth.users u ON u.id = s.user_id
        LEFT JOIN public.dashdriver_usuarios du ON du.id = s.user_id
        LEFT JOIN public.dashdriver_config c ON c.user_id = s.user_id
        ORDER BY s.created_at DESC
      `);
      return res.status(200).json({ tickets: r.rows });
    }

    if (req.method === 'POST') {
      const { id, status, resposta } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id required' });

      const r = await client.query(
        `UPDATE public.dashdriver_support
         SET status = $1, resposta = $2, updated_at = now()
         WHERE id = $3
         RETURNING *`,
        [status || 'resolved', resposta || '', id]
      );
      const ticket = r.rows[0] || null;
      return res.status(200).json({ ok: true, ticket });
    }

    return res.status(405).end();
  } finally {
    client.release();
  }
};
