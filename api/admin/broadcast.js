const pool = require('./_db');
const { verifyAdmin } = require('./_auth');

const EVOLUTION_URL      = process.env.EVOLUTION_URL;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;
const EVOLUTION_KEY      = process.env.EVOLUTION_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  if (!verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

  const { message, plano_filter } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message required' });

  const client = await pool.connect();
  let recipients = [];
  try {
    if (plano_filter) {
      const r = await client.query(
        `SELECT c.telefone
         FROM public.dashdriver_config c
         JOIN public.dashdriver_plans p ON p.user_id = c.user_id
         WHERE p.plano = $1
           AND c.telefone IS NOT NULL AND length(c.telefone) >= 8
         UNION
         -- fallback: config com telefone mas sem user_id vinculado (registro legado)
         SELECT c.telefone
         FROM public.dashdriver_config c
         WHERE c.user_id IS NULL
           AND c.telefone IS NOT NULL AND length(c.telefone) >= 8`,
        [plano_filter]
      );
      recipients = r.rows;
    } else {
      const r = await client.query(
        `SELECT DISTINCT telefone
         FROM public.dashdriver_config
         WHERE telefone IS NOT NULL AND length(telefone) >= 8`
      );
      recipients = r.rows;
    }
  } finally {
    client.release();
  }

  if (recipients.length === 0) return res.status(200).json({ sent: 0, failed: 0, total: 0 });

  let sent = 0, failed = 0;
  await Promise.allSettled(recipients.map(async (c) => {
    try {
      const r = await fetch(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_KEY },
        body: JSON.stringify({ number: c.telefone, text: message }),
      });
      if (r.ok) sent++; else failed++;
    } catch { failed++; }
  }));

  return res.status(200).json({ sent, failed, total: recipients.length });
};
