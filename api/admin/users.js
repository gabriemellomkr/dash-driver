const pool = require('./_db');
const { verifyAdmin } = require('./_auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

  // ── POST → cria usuário OU atualiza plano (action='update-plan') ─────────
  if (req.method === 'POST') {
    // Delegado: atualiza plano de um usuário existente
    if ((req.body || {}).action === 'update-plan') {
      const { user_id, plano, trial_ends_at, obs } = req.body;
      if (!user_id || !plano) return res.status(400).json({ error: 'user_id and plano required' });
      const client = await pool.connect();
      try {
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
    }

    const { email, password, plano = 'trial', trial_days = 7, obs = '' } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ error: 'email e password são obrigatórios' });
    if (password.length < 6)
      return res.status(400).json({ error: 'password deve ter pelo menos 6 caracteres' });

    const client = await pool.connect();
    try {
      // Verifica se email já existe
      const exists = await client.query(
        'SELECT id FROM auth.users WHERE lower(email) = lower($1::text) LIMIT 1',
        [email]
      );
      if (exists.rows.length)
        return res.status(409).json({ error: 'E-mail já cadastrado' });

      // Cria usuário com senha bcrypt (pgcrypto)
      // Campos de token devem ser string vazia (não null) para GoTrue não quebrar com 500
      const rUser = await client.query(`
        INSERT INTO auth.users (
          instance_id, id, aud, role,
          email, encrypted_password,
          email_confirmed_at,
          raw_app_meta_data, raw_user_meta_data,
          confirmation_token, recovery_token,
          email_change, email_change_token_new,
          phone_change, phone_change_token,
          created_at, updated_at
        ) VALUES (
          '00000000-0000-0000-0000-000000000000',
          gen_random_uuid(),
          'authenticated', 'authenticated',
          $1::text,
          crypt($2::text, gen_salt('bf', 10)),
          now(),
          '{"provider":"email","providers":["email"]}',
          '{}',
          '', '',
          '', '',
          '', '',
          now(), now()
        )
        RETURNING id, email, created_at
      `, [email.toLowerCase().trim(), password]);

      const newUser = rUser.rows[0];

      // Cria identity (obrigatório para GoTrue aceitar login email/senha)
      // Casts explícitos em todos os parâmetros para evitar
      // "could not determine data type of parameter $N" em contextos polimórficos
      const emailClean = email.toLowerCase().trim();
      await client.query(`
        INSERT INTO auth.identities (
          id, provider_id, user_id, identity_data,
          provider, last_sign_in_at, created_at, updated_at
        ) VALUES (
          gen_random_uuid(),
          $1::text,
          $2::uuid,
          jsonb_build_object('sub', $2::text, 'email', $1::text),
          'email',
          now(), now(), now()
        )
      `, [emailClean, newUser.id]);

      // Cria plano inicial
      const trial_ends_at = plano === 'trial'
        ? new Date(Date.now() + trial_days * 86_400_000).toISOString()
        : null;

      await client.query(`
        INSERT INTO public.dashdriver_plans
          (user_id, plano, trial_ends_at, obs, created_at, updated_at)
        VALUES ($1::uuid, $2::text, $3::timestamptz, $4::text, now(), now())
        ON CONFLICT (user_id) DO UPDATE
          SET plano = EXCLUDED.plano,
              trial_ends_at = EXCLUDED.trial_ends_at,
              obs = EXCLUDED.obs,
              updated_at = now()
      `, [newUser.id, plano, trial_ends_at, obs]);

      return res.status(201).json({
        ok: true,
        user: { id: newUser.id, email: newUser.email, created_at: newUser.created_at, plano, trial_ends_at },
      });
    } catch (err) {
      console.error('[users/POST] error:', err.message);
      return res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  }

  // ── DELETE → remove usuário ──────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const { user_id } = req.body || {};
    if (!user_id) return res.status(400).json({ error: 'user_id obrigatório' });

    const client = await pool.connect();
    try {
      // Apaga dados relacionados antes de apagar o usuário
      await client.query('DELETE FROM public.dashdriver_plans WHERE user_id = $1', [user_id]);
      await client.query('DELETE FROM public.dashdriver_corridas WHERE user_id = $1', [user_id]);
      await client.query('DELETE FROM public.dashdriver_config WHERE user_id = $1', [user_id]);
      await client.query('DELETE FROM public.dashdriver_support WHERE user_id = $1', [user_id]);
      await client.query('DELETE FROM public.dashdriver_token_usage WHERE user_id = $1', [user_id]);
      // dashdriver_usuarios referencia auth.users por FK (id)
      await client.query('DELETE FROM public.dashdriver_usuarios WHERE id = $1', [user_id]);
      await client.query('DELETE FROM auth.identities WHERE user_id = $1', [user_id]);
      await client.query('DELETE FROM auth.users WHERE id = $1', [user_id]);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('[users/DELETE] error:', err.message);
      return res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  }

  // ── GET → lista usuários ─────────────────────────────────────────────────
  if (req.method !== 'GET') return res.status(405).end();

  const client = await pool.connect();
  try {
    const [rUsers, rPlans, rCorridas, rTokens, rConfigs, rUsuarios] = await Promise.all([
      client.query(`
        SELECT id, email, created_at, last_sign_in_at
        FROM auth.users
        ORDER BY created_at DESC
      `),
      client.query('SELECT user_id, plano, trial_ends_at, stripe_status, id FROM public.dashdriver_plans'),
      client.query('SELECT user_id, count(*)::int AS cnt FROM public.dashdriver_corridas GROUP BY user_id'),
      client.query('SELECT user_id, telefone FROM public.dashdriver_config'),
      client.query(`
        SELECT user_id,
               coalesce(sum(tokens_in),0)::int  AS tokens_in,
               coalesce(sum(tokens_out),0)::int AS tokens_out
        FROM public.dashdriver_token_usage
        GROUP BY user_id
      `),
      client.query('SELECT id, full_name FROM public.dashdriver_usuarios'),
    ]);

    const plansMap = {};
    rPlans.rows.forEach(p => { plansMap[p.user_id] = p; });

    const corridaMap = {};
    rCorridas.rows.forEach(r => { corridaMap[r.user_id] = r.cnt; });

    const configMap = {};
    rConfigs.rows.forEach(r => { configMap[r.user_id] = r; });

    const usuariosMap = {};
    rUsuarios.rows.forEach(r => { usuariosMap[r.id] = r; });

    const tokenMap = {};
    rTokens.rows.forEach(r => { tokenMap[r.user_id] = { in: r.tokens_in, out: r.tokens_out }; });

    const users = rUsers.rows.map(u => ({
      id:            u.id,
      email:         u.email,
      nome:          usuariosMap[u.id]?.full_name || null,
      telefone:      configMap[u.id]?.telefone || null,
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
