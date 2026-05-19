const pool = require('./_db');
const { verifyAdmin } = require('./_auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  if (!verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

  const { user_id, plano, trial_ends_at, obs } = req.body || {};
  if (!user_id || !plano) return res.status(400).json({ error: 'user_id and plano required' });

  const client = await pool.connect();
  try {
    // Upsert: update if exists, insert if not
    const r = await client.query(
      `INSERT INTO public.dashdriver_plans (user_id, plano, trial_ends_at, obs, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (user_id) DO UPDATE
         SET plano         = EXCLUDED.plano,
             trial_ends_at = EXCLUDED.trial_ends_at,
             obs           = EXCLUDED.obs,
             updated_at    = now()
       RETURNING *`,
      [user_id, plano, trial_ends_at || null, obs || null]
    );
    return res.status(200).json({ ok: true, plan: r.rows[0] });
  } finally {
    client.release();
  }
};
