const pool = require('./admin/_db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { titulo, mensagem, user_id } = req.body || {};
  if (!titulo || !mensagem) {
    return res.status(400).json({ error: 'titulo e mensagem são obrigatórios' });
  }

  let client;
  try {
    client = await pool.connect();
    const r = await client.query(
      `INSERT INTO public.dashdriver_support (titulo, mensagem, user_id, status)
       VALUES ($1, $2, $3, 'open')
       RETURNING id, created_at`,
      [titulo.substring(0, 200), mensagem.substring(0, 2000), user_id || null]
    );
    return res.status(200).json({ ok: true, id: r.rows[0].id });
  } catch (err) {
    console.error('[support] error:', err.message);
    return res.status(500).json({ error: 'Erro ao enviar ticket', detail: err.message });
  } finally {
    if (client) client.release();
  }
};
