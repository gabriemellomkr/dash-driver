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
      const r = await client.query('SELECT * FROM public.dashdriver_support ORDER BY created_at DESC');
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
