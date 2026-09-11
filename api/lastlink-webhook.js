/**
 * DashDriver — Webhook do Lastlink (pagamento)
 *
 * O Lastlink NÃO assina o webhook, então protegemos com um token secreto na URL:
 *   https://app.dashdriver.com.br/api/lastlink-webhook?token=<LASTLINK_WEBHOOK_TOKEN>
 *
 * Eventos que LIBERAM acesso  → plano 'active'  (cria a conta se não existir)
 * Eventos que TRAVAM o acesso → plano 'expired'
 *
 * Casamos o comprador com o usuário do app por e-mail (Data.Buyer.Email).
 * Obrigatório: LASTLINK_PRODUCT_IDS (csv) restringe a quais produtos respondemos.
 */
const pool   = require('./admin/_db');
const crypto = require('crypto');
const { sendMail } = require('./_mailer');

const WEBHOOK_TOKEN = process.env.LASTLINK_WEBHOOK_TOKEN || '';
const APP_URL       = process.env.APP_URL || 'https://app.dashdriver.com.br';
const PRODUCT_IDS   = (process.env.LASTLINK_PRODUCT_IDS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

// Access-ended is authoritative: cancelling renewal does not erase paid time.
const GRANT_EVENTS = new Set(['Product_Access_Started', 'Product_access_started', 'Purchase_Order_Confirmed', 'Recurrent_Payment']);
const REVOKE_EVENTS = new Set(['Product_Access_Ended', 'Product_access_ended', 'Subscription_Expired', 'Payment_Refund', 'Payment_Chargeback']);
function tokenOk(req) {
  const valid = [WEBHOOK_TOKEN, process.env.LASTLINK_TOKEN || ''].filter(Boolean);
  const h = req.headers || {}, b = req.body || {};
  const candidates = [req.query?.token, h['x-lastlink-token'], h['x-webhook-token'], h.token,
    (h.authorization || '').replace(/^Bearer\s+/i, ''), b.Token, b.token].filter(v => typeof v === 'string');
  return candidates.some(c => valid.some(v => {
    const a = Buffer.from(c), z = Buffer.from(v);
    return a.length === z.length && crypto.timingSafeEqual(a, z);
  }));
}

async function sendWelcomeEmail(email, resetUrl) {
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px"><tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0" style="background:#0e0e10;border-radius:16px;padding:36px 32px;max-width:480px">
  <tr><td style="padding-bottom:24px">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="background:rgba(59,130,246,.15);padding:10px;border-radius:12px;font-size:22px;vertical-align:middle">🏍️</td>
      <td style="padding-left:12px;font-size:20px;font-weight:900;color:#fff;vertical-align:middle">DashDriver</td>
    </tr></table>
  </td></tr>
  <tr><td style="padding-bottom:8px;font-size:22px;font-weight:900;color:#fff">Assinatura ativada! 🎉</td></tr>
  <tr><td style="padding-bottom:24px;font-size:14px;color:rgba(255,255,255,.6);line-height:1.7">
    Sua conta foi criada e sua assinatura já está <b style="color:#4ade80">ativa</b>. Clique no botão abaixo para definir sua senha e entrar.
  </td></tr>
  <tr><td style="padding-bottom:28px">
    <a href="${resetUrl}" style="display:inline-block;background:#3b82f6;color:#fff;font-weight:700;font-size:15px;padding:14px 28px;border-radius:12px;text-decoration:none">Definir minha senha e entrar →</a>
    <div style="margin-top:10px;font-size:12px;color:rgba(255,255,255,.3)">Login: ${email} · link válido por 7 dias</div>
  </td></tr>
  <tr><td style="font-size:11px;color:rgba(255,255,255,.25);line-height:1.6">Dúvidas? Fale com a gente pelo suporte dentro do app.</td></tr>
</table></td></tr></table></body></html>`;

  const text = `Bem-vindo ao DashDriver!\n\nSua conta foi criada e sua assinatura está ativa. Defina sua senha (link válido por 7 dias):\n${resetUrl}\n\nLogin: ${email}`;

  await sendMail({ to: email, subject: '🏍️ DashDriver — sua assinatura está ativa', html, text });
}

// Cria usuário no Supabase (mesmo padrão à prova de GoTrue: tokens vazios, não NULL)
async function createUser(client, email, phone, name) {
  const randomPass = crypto.randomBytes(16).toString('hex');
  const rUser = await client.query(`
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change, email_change_token_new,
      phone_change, phone_change_token, created_at, updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
      $1::text, crypt($2::text, gen_salt('bf', 10)), now(),
      '{"provider":"email","providers":["email"]}', '{}',
      '', '', '', '', '', '', now(), now()
    ) RETURNING id
  `, [email, randomPass]);
  const userId = rUser.rows[0].id;

  await client.query(`
    INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), $1::text, $2::uuid, jsonb_build_object('sub', $2::text, 'email', $1::text), 'email', now(), now(), now())
  `, [email, userId]);

  const telClean = (phone || '').replace(/\D/g, '');
  if (telClean.length >= 10 || name) {
    await client.query(`
      INSERT INTO public.dashdriver_config (user_id, telefone, nome, updated_at)
      VALUES ($1::uuid, $2, $3, now())
      ON CONFLICT (user_id) DO UPDATE SET
        telefone = COALESCE(NULLIF(EXCLUDED.telefone,''), public.dashdriver_config.telefone),
        nome     = COALESCE(NULLIF(EXCLUDED.nome,''), public.dashdriver_config.nome),
        updated_at = now()
    `, [userId, telClean, name || '']);
  }
  return userId;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!tokenOk(req)) return res.status(401).json({ error: 'unauthorized' });
  const body = req.body || {}, data = body.Data || {}, event = body.Event;
  if (body.IsTest === true) return res.status(200).json({ ignored: 'test event' });
  const isGrant = GRANT_EVENTS.has(event), isRevoke = REVOKE_EVENTS.has(event);
  if (!isGrant && !isRevoke) return res.status(200).json({ ignored: event || 'unknown' });
  if (!PRODUCT_IDS.length) return res.status(503).json({ error: 'Webhook product configuration required' });
  const products = [data.Product?.Id, ...(Array.isArray(data.Products) ? data.Products.map(p => p.Id) : []),
    ...(Array.isArray(data.Subscriptions) ? data.Subscriptions.map(s => s.ProductId) : []), data.Subscription?.ProductId].filter(Boolean).map(String);
  if (!products.some(id => PRODUCT_IDS.includes(id))) return res.status(200).json({ ignored: 'product not whitelisted' });
  const email = String(data.Buyer?.Email || data.Member?.Email || '').toLowerCase().trim();
  const subId = data.SubscriptionId || data.Subscription?.Id || data.Subscriptions?.[0]?.Id || null;
  const eventAt = new Date(body.CreatedAt);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof body.Id !== 'string' || !body.Id || !Number.isFinite(eventAt.getTime())) {
    return res.status(400).json({ error: 'Invalid event identity, date or member' });
  }
  let client;
  try {
    client = await pool.connectWithRetry();
    await client.query('BEGIN');
    // Serializes events for the same buyer, including concurrent account creation.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [email]);
    const duplicate = await client.query('SELECT event_id FROM public.dashdriver_webhook_events WHERE event_id=$1', [body.Id]);
    if (duplicate.rows.length) {
      await client.query('COMMIT');
      return res.status(200).json({ ok: true, duplicate: true });
    }
    const users = await client.query('SELECT id FROM auth.users WHERE lower(email)=lower($1) LIMIT 1', [email]);
    let userId = users.rows[0]?.id, isNew = false;
    if (isGrant && !userId) { userId = await createUser(client, email, '', String(data.Buyer?.Name || '')); isNew = true; }
    if (userId) {
      const plans = await client.query('SELECT lastlink_event_at, lastlink_subscription_id FROM public.dashdriver_plans WHERE user_id=$1 FOR UPDATE', [userId]);
      const plan = plans.rows[0];
      if (plan?.lastlink_event_at && new Date(plan.lastlink_event_at) > eventAt) {
        await client.query('COMMIT');
        return res.status(200).json({ ignored: 'stale event' });
      }
      if (isRevoke && subId && plan?.lastlink_subscription_id && subId !== plan.lastlink_subscription_id) {
        await client.query('COMMIT');
        return res.status(200).json({ ignored: 'different subscription' });
      }
      if (isGrant) {
        await client.query(`INSERT INTO public.dashdriver_plans
          (user_id, plano, lastlink_subscription_id, trial_ends_at, expires_at, lastlink_event_at, updated_at)
          VALUES ($1, 'active', $2, NULL, NULL, $3, now())
          ON CONFLICT (user_id) DO UPDATE SET plano='active',
          lastlink_subscription_id=COALESCE(EXCLUDED.lastlink_subscription_id, dashdriver_plans.lastlink_subscription_id),
          trial_ends_at=NULL, expires_at=NULL, lastlink_event_at=EXCLUDED.lastlink_event_at, updated_at=now()`, [userId, subId, eventAt.toISOString()]);
      } else {
        await client.query("UPDATE public.dashdriver_plans SET plano='expired', lastlink_event_at=$2, updated_at=now() WHERE user_id=$1", [userId, eventAt.toISOString()]);
      }
    }
    if (isNew) {
      const token = crypto.randomBytes(32).toString('hex');
      const digest = crypto.createHash('sha256').update(token).digest('hex');
      await client.query(`INSERT INTO public.dashdriver_password_resets (user_id, token, expires_at)
        VALUES ($1, $2, now() + interval '7 days')`, [userId, digest]);
      // Await delivery before commit: a mail failure rolls back creation and lets Lastlink retry.
      await sendWelcomeEmail(email, `${APP_URL}?dd_reset=${token}`);
    }
    await client.query(`INSERT INTO public.dashdriver_webhook_events (event_id, event_type, event_at, user_id)
      VALUES ($1,$2,$3,$4)`, [body.Id, event, eventAt.toISOString(), userId || null]);
    await client.query('COMMIT');
    return res.status(200).json({ ok: true, action: isGrant ? 'granted' : 'revoked', isNew });
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('[lastlink] processing failed', err.code || 'integration_error');
    return res.status(503).json({ error: 'Event processing failed; retry required' });
  } finally { client?.release(); }
};
