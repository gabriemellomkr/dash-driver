const pool       = require('./_db');
const { verifyAdmin } = require('./_auth');
const crypto     = require('crypto');
const { sendMail } = require('../_mailer');

const APP_URL            = process.env.APP_URL      || 'https://app.dashdriver.com.br';
const MAIL_CONFIGURED    = !!(process.env.RESEND_API_KEY || (process.env.GMAIL_USER && process.env.GMAIL_APP_PASS));
async function sendWelcomeEmail(client, userId, email) {
  // Gera token de boas-vindas (7 dias — tempo suficiente para o usuário acessar)
  const token   = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await client.query(
    `INSERT INTO public.dashdriver_password_resets (user_id, token, expires_at)
     VALUES ($1::uuid, $2, $3::timestamptz)`,
    [userId, crypto.createHash('sha256').update(token).digest('hex'), expires.toISOString()]
  );

  const resetUrl = `${APP_URL}?dd_reset=${token}`;

  if (!MAIL_CONFIGURED) return resetUrl; // sem e-mail configurado, retorna só a URL

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#0e0e10;border-radius:16px;padding:32px;max-width:480px">
        <!-- Header -->
        <tr><td style="padding-bottom:24px">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background:rgba(59,130,246,0.15);padding:10px;border-radius:12px;font-size:24px;vertical-align:middle">◒</td>
            <td style="padding-left:12px;font-size:20px;font-weight:900;color:#ffffff;vertical-align:middle">DashDriver</td>
          </tr></table>
        </td></tr>
        <!-- Título -->
        <tr><td style="padding-bottom:6px;font-size:18px;font-weight:800;color:#ffffff">
          Bem-vindo ao DashDriver! 🎉
        </td></tr>
        <!-- Subtítulo -->
        <tr><td style="padding-bottom:20px;font-size:14px;line-height:1.6;color:rgba(255,255,255,0.6)">
          Sua conta foi criada. Clique no botão abaixo para definir sua senha e acessar a plataforma.
        </td></tr>
        <!-- Botão principal -->
        <tr><td style="padding-bottom:28px">
          <a href="${resetUrl}"
             style="display:inline-block;background:#3b82f6;color:#ffffff;font-weight:700;font-size:15px;padding:14px 28px;border-radius:12px;text-decoration:none">
            Definir minha senha e entrar →
          </a>
        </td></tr>
        <!-- Instruções -->
        <tr><td style="padding-bottom:20px">
          <table cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.04);border-radius:12px;padding:16px;width:100%">
            <tr><td style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:.05em;padding-bottom:12px">
              Como começar
            </td></tr>
            <tr><td style="font-size:13px;color:rgba(255,255,255,0.7);line-height:1.8">
              <b style="color:#fff">1.</b> Clique no botão acima para definir sua senha<br>
              <b style="color:#fff">2.</b> Faça login com o e-mail <b style="color:#60a5fa">${email}</b><br>
              <b style="color:#fff">3.</b> Registre suas corridas diariamente<br>
              <b style="color:#fff">4.</b> Acompanhe seus ganhos, KPIs e metas no Dashboard<br>
              <b style="color:#fff">5.</b> Lance gastos para calcular seu resultado real<br>
              <b style="color:#fff">6.</b> Para instalar no celular, abra o menu do navegador e escolha “Adicionar à tela inicial” ou “Instalar aplicativo”
            </td></tr>
          </table>
        </td></tr>
        <!-- Rodapé -->
        <tr><td style="font-size:11px;color:rgba(255,255,255,0.25);line-height:1.6">
          O link de acesso expira em <b style="color:rgba(255,255,255,0.4)">7 dias</b>. Após isso, use "Esqueceu a senha?" na tela de login.<br><br>
          <span style="word-break:break-all">Ou acesse: ${resetUrl}</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `Bem-vindo ao DashDriver!

Sua conta foi criada. Acesse o link abaixo para definir sua senha (válido por 7 dias):

${resetUrl}

Como começar:
1. Clique no link acima para definir sua senha
2. Faça login com o e-mail: ${email}
3. Registre suas corridas diariamente
4. Acompanhe ganhos, KPIs e metas no Dashboard
5. Lance gastos (gasolina, manutenção) para ver seu lucro real

Equipe DashDriver`;

  await sendMail({
    to:      email,
    subject: 'DashDriver: acesse sua conta',
    text,
    html,
  });

  console.log(`[users] e-mail de boas-vindas enviado para ${email}`);
  return resetUrl;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!(await verifyAdmin(req))) return res.status(403).json({ error: 'Forbidden' });

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

    const { email, password, plano = 'trial', trial_days = 7, obs = '', telefone = '' } = req.body || {};
    if (!email)
      return res.status(400).json({ error: 'email é obrigatório' });

    const emailClean = email.toLowerCase().trim();
    const client = await pool.connect();
    try {
      // Verifica se email já existe
      const exists = await client.query(
        'SELECT id FROM auth.users WHERE email = $1 LIMIT 1',
        [emailClean]
      );

      if (exists.rows.length) {
        // Usuário já existe (veio do Stripe ou foi criado antes)
        // Atualiza o plano dele em vez de tentar criar um duplicado
        const existingId = exists.rows[0].id;
        const trial_ends_at = ((plano === 'convidado' || plano === 'trial') && trial_days > 0)
          ? new Date(Date.now() + trial_days * 86_400_000).toISOString()
          : null;

        await client.query(`
          INSERT INTO public.dashdriver_plans (user_id, plano, trial_ends_at, obs, updated_at)
          VALUES ($1::uuid, $2::text, $3::timestamptz, $4::text, now())
          ON CONFLICT (user_id) DO UPDATE
            SET plano         = EXCLUDED.plano,
                trial_ends_at = EXCLUDED.trial_ends_at,
                obs           = EXCLUDED.obs,
                updated_at    = now()
        `, [existingId, plano, trial_ends_at, obs]);

        // Salva telefone se fornecido
        const telClean = (telefone || '').replace(/\D/g, '');
        if (telClean.length >= 10) {
          await client.query(
            `INSERT INTO public.dashdriver_config (user_id, telefone, updated_at)
             VALUES ($1::uuid, $2, NOW())
             ON CONFLICT (user_id) DO UPDATE SET telefone = EXCLUDED.telefone, updated_at = NOW()`,
            [existingId, telClean]
          );
        }

        console.log(`[users/POST] plano atualizado para usuário existente id=${existingId} plano=${plano}`);
        return res.status(200).json({
          ok: true,
          updated: true,
          user: { id: existingId, email: emailClean, plano, trial_ends_at },
        });
      }

      // Usuário não existe — valida senha antes de criar
      if (!password || password.length < 6)
        return res.status(400).json({ error: 'password deve ter pelo menos 6 caracteres' });

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
      `, [emailClean, password]);

      const newUser = rUser.rows[0];
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
      const trial_ends_at = ((plano === 'convidado' || plano === 'trial') && trial_days > 0)
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

      // Salva telefone em dashdriver_config se fornecido pelo admin
      const telClean = telefone.replace(/\D/g, '');
      if (telClean.length >= 10) {
        await client.query(
          `INSERT INTO public.dashdriver_config (user_id, telefone, updated_at)
           VALUES ($1::uuid, $2, NOW())
           ON CONFLICT (user_id) DO UPDATE SET telefone = EXCLUDED.telefone, updated_at = NOW()`,
          [newUser.id, telClean]
        );
      }

      // Envia e-mail de boas-vindas com link para definir senha
      try {
        await sendWelcomeEmail(client, newUser.id, emailClean);
      } catch (mailErr) {
        console.error('[users] falha ao enviar e-mail de boas-vindas:', mailErr.message);
      }

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
