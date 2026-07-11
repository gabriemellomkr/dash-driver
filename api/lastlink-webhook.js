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
 * Opcional: LASTLINK_PRODUCT_IDS (csv) restringe a quais produtos respondemos.
 */
const pool   = require('./admin/_db');
const crypto = require('crypto');
const { sendMail } = require('./_mailer');

const WEBHOOK_TOKEN = process.env.LASTLINK_WEBHOOK_TOKEN || '';
const APP_URL       = process.env.APP_URL || 'https://app.dashdriver.com.br';
const PRODUCT_IDS   = (process.env.LASTLINK_PRODUCT_IDS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

const EVOLUTION_URL      = process.env.EVOLUTION_URL;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;
const EVOLUTION_KEY      = process.env.EVOLUTION_KEY;

// Eventos do Lastlink que concedem/retiram acesso
const GRANT_EVENTS = new Set([
  'Product_Access_Started', 'Purchase_Order_Confirmed',
  'Purchase_Request_Confirmed', 'Recurrent_Payment',
]);
const REVOKE_EVENTS = new Set([
  'Product_Access_Ended', 'Subscription_Canceled', 'Subscription_Expired',
  'Payment_Refund', 'Payment_Chargeback',
]);

// Aceita nosso token na URL (?token=) OU o token do próprio Lastlink (em header/body).
// Assim funciona independente de como o Lastlink entrega a verificação.
function tokenOk(req) {
  const valid = [WEBHOOK_TOKEN, process.env.LASTLINK_TOKEN || ''].filter(Boolean);
  if (!valid.length) return false;
  const h = req.headers || {};
  const b = req.body || {};
  const candidates = [
    req.query && req.query.token,
    h['x-lastlink-token'], h['x-webhook-token'], h['token'],
    (h['authorization'] || '').replace(/^Bearer\s+/i, ''),
    b.Token, b.token,
  ].filter(Boolean).map(String);
  return candidates.some(c => valid.includes(c));
}

async function sendWelcomeWhatsApp(phone, resetUrl) {
  if (!EVOLUTION_URL || !EVOLUTION_INSTANCE || !EVOLUTION_KEY) return;
  const n = (phone || '').replace(/\D/g, '');
  if (n.length < 10) return;
  const text = `🏍️ *Bem-vindo ao DashDriver!*\n\nSua assinatura está ativa! Acesse o link abaixo para definir sua senha e começar a usar:\n\n👉 ${resetUrl}\n\n_(O link expira em 7 dias)_`;
  try {
    await fetch(`${EVOLUTION_URL}/message/sendText/${encodeURIComponent(EVOLUTION_INSTANCE)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_KEY },
      body: JSON.stringify({ number: n, text }),
    });
  } catch (e) { console.warn('[lastlink] whatsapp welcome falhou:', e.message); }
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

  const body  = req.body || {};
  const event = body.Event;
  const data  = body.Data || {};
  const email = (data.Buyer?.Email || '').toLowerCase().trim();
  const name  = data.Buyer?.Name || '';
  const phone = data.Buyer?.PhoneNumber || '';
  const subId = data.Subscriptions?.[0]?.Id || null;

  const isGrant  = GRANT_EVENTS.has(event);
  const isRevoke = REVOKE_EVENTS.has(event);
  if (!isGrant && !isRevoke) return res.status(200).json({ ignored: event || 'unknown' });

  // Whitelist opcional de produtos
  if (PRODUCT_IDS.length) {
    const prodIds = [
      ...(data.Products || []).map(p => p.Id),
      ...(data.Subscriptions || []).map(s => s.ProductId),
    ].filter(Boolean);
    if (!prodIds.some(id => PRODUCT_IDS.includes(id))) {
      return res.status(200).json({ ignored: 'product not whitelisted' });
    }
  }

  if (!email) return res.status(200).json({ ignored: 'no buyer email' });

  const client = await pool.connectWithRetry();
  try {
    const rUser = await client.query(
      'SELECT id FROM auth.users WHERE lower(email) = lower($1) LIMIT 1', [email]
    );

    // ── TRAVAR acesso ────────────────────────────────────────────────────
    if (isRevoke) {
      if (rUser.rows.length) {
        await client.query(
          `UPDATE public.dashdriver_plans SET plano='expired', updated_at=now() WHERE user_id=$1`,
          [rUser.rows[0].id]
        );
      }
      console.log(`[lastlink] revoke ${event} email=${email}`);
      return res.status(200).json({ ok: true, action: 'revoked', email });
    }

    // ── LIBERAR acesso ───────────────────────────────────────────────────
    let userId, isNew = false;
    if (rUser.rows.length) {
      userId = rUser.rows[0].id;
    } else {
      userId = await createUser(client, email, phone, name);
      isNew = true;
    }

    // Ativa o plano (limpa trial_ends_at — pagante não tem trial)
    await client.query(`
      INSERT INTO public.dashdriver_plans (user_id, plano, lastlink_subscription_id, trial_ends_at, updated_at)
      VALUES ($1::uuid, 'active', $2, NULL, now())
      ON CONFLICT (user_id) DO UPDATE SET
        plano = 'active',
        lastlink_subscription_id = COALESCE(EXCLUDED.lastlink_subscription_id, public.dashdriver_plans.lastlink_subscription_id),
        trial_ends_at = NULL,
        updated_at = now()
    `, [userId, subId]);

    if (isNew) {
      const token   = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await client.query(
        `INSERT INTO public.dashdriver_password_resets (user_id, token, expires_at) VALUES ($1::uuid, $2, $3::timestamptz)`,
        [userId, token, expires.toISOString()]
      );
      const resetUrl = `${APP_URL}?dd_reset=${token}`;
      try { await sendWelcomeEmail(email, resetUrl); }
      catch (e) { console.error('[lastlink] welcome email falhou:', e.message); }
      sendWelcomeWhatsApp(phone, resetUrl).catch(() => {});
    }

    console.log(`[lastlink] grant ${event} email=${email} new=${isNew}`);
    return res.status(200).json({ ok: true, action: 'granted', email, isNew });
  } catch (err) {
    console.error('[lastlink] erro:', err.message);
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};
