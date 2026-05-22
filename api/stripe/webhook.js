const Stripe     = require('stripe');
const pool       = require('../admin/_db');
const nodemailer = require('nodemailer');

const stripe   = Stripe(process.env.STRIPE_SECRET_KEY);
const PRICE_ID = process.env.STRIPE_PRICE_ID || 'price_1TYwuxA3GkEpPzeDfvOu3dMr';
const APP_URL  = process.env.APP_URL          || 'https://dashdriver.com.br';

const EVOLUTION_URL      = process.env.EVOLUTION_URL;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;
const EVOLUTION_KEY      = process.env.EVOLUTION_KEY;
const GMAIL_USER         = process.env.GMAIL_USER;
const GMAIL_PASS         = process.env.GMAIL_APP_PASS;
const TRIAL_DAYS         = parseInt(process.env.STRIPE_TRIAL_DAYS || '7');

// ─── WhatsApp helper ──────────────────────────────────────────────────────────
async function _whatsapp(number, text) {
  if (!EVOLUTION_URL || !number) return;
  const n = number.replace(/\D/g, '');
  if (n.length < 10) return;
  try {
    await fetch(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_KEY },
      body: JSON.stringify({ number: n, text }),
    });
  } catch (e) { console.warn('[stripe/webhook] whatsapp:', e.message); }
}

// ─── E-mail helper ────────────────────────────────────────────────────────────
async function _email(to, subject, html, text) {
  if (!GMAIL_USER || !GMAIL_PASS || !to) return;
  try {
    const t = nodemailer.createTransport({ service: 'gmail', auth: { user: GMAIL_USER, pass: GMAIL_PASS } });
    await t.sendMail({ from: `"DashDriver" <${GMAIL_USER}>`, to, subject, text, html });
  } catch (e) { console.warn('[stripe/webhook] email:', e.message); }
}

// ─── Busca email + telefone do usuário ────────────────────────────────────────
async function _getUserContact(client, user_id) {
  const r = await client.query(
    `SELECT au.email, c.telefone, c.nome
     FROM auth.users au
     LEFT JOIN public.dashdriver_config c ON c.user_id = au.id
     WHERE au.id = $1::uuid LIMIT 1`,
    [user_id]
  );
  return r.rows[0] || {};
}

// ─── Notificação de assinatura ativada ───────────────────────────────────────
async function notifySubscriptionActive(client, user_id, isTrial) {
  const { email, telefone, nome } = await _getUserContact(client, user_id);
  const primeiroNome = (nome || 'Motorista').split(' ')[0];
  const trialMsg = isTrial
    ? `Seu período de teste gratuito de *${TRIAL_DAYS} dias* está ativo. Após o período, a cobrança mensal é feita automaticamente — você não precisa fazer nada.`
    : `Sua assinatura está ativa. Obrigado por assinar o DashDriver!`;

  // WhatsApp
  const waMsg = `🎉 *Assinatura DashDriver ativada, ${primeiroNome}!*\n\n${trialMsg.replace(/\*/g, '')}\n\n👉 Acesse: ${APP_URL}`;
  await _whatsapp(telefone, waMsg);

  // E-mail
  const emailHtml = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px">
<tr><td align="center"><table width="480" cellpadding="0" cellspacing="0" style="background:#0e0e10;border-radius:16px;padding:32px;max-width:480px">
  <tr><td style="padding-bottom:20px;font-size:24px;font-weight:900;color:#fff">🎉 Assinatura ativada!</td></tr>
  <tr><td style="padding-bottom:16px;font-size:15px;color:rgba(255,255,255,.7);line-height:1.7">
    Olá, <b style="color:#fff">${primeiroNome}</b>!<br><br>
    ${isTrial
      ? `Seu período de teste gratuito de <b style="color:#60a5fa">${TRIAL_DAYS} dias</b> está ativo. Após o período, a cobrança mensal é feita automaticamente — você não precisa fazer nada.`
      : 'Sua assinatura está ativa. Obrigado por assinar o DashDriver!'}
  </td></tr>
  <tr><td style="padding-bottom:28px">
    <a href="${APP_URL}" style="display:inline-block;background:#3b82f6;color:#fff;font-weight:700;font-size:15px;padding:14px 28px;border-radius:12px;text-decoration:none">
      Acessar DashDriver →
    </a>
  </td></tr>
  <tr><td style="font-size:11px;color:rgba(255,255,255,.25)">Dúvidas? Fale com a gente pelo suporte dentro do app.</td></tr>
</table></td></tr></table>
</body></html>`;

  const emailText = `Assinatura DashDriver ativada!\n\n${trialMsg.replace(/\*/g, '')}\n\nAcesse: ${APP_URL}`;
  await _email(email, '🎉 Sua assinatura DashDriver está ativa!', emailHtml, emailText);
}

async function activatePlan(client, user_id, customerId, subscriptionId) {
  const expires_at = new Date();
  expires_at.setDate(expires_at.getDate() + 35);
  await client.query(
    `INSERT INTO public.dashdriver_plans
       (user_id, plano, stripe_customer_id, stripe_subscription_id, expires_at, updated_at)
     VALUES ($1, 'active', $2, $3, $4, NOW())
     ON CONFLICT (user_id) DO UPDATE
       SET plano                  = 'active',
           stripe_customer_id     = EXCLUDED.stripe_customer_id,
           stripe_subscription_id = EXCLUDED.stripe_subscription_id,
           expires_at             = EXCLUDED.expires_at,
           updated_at             = NOW()`,
    [user_id, customerId, subscriptionId, expires_at.toISOString()]
  );
}

const handler = async function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, stripe-signature');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  // ── Sem stripe-signature → criação de sessão de checkout (chamada do app) ─
  if (!req.headers['stripe-signature']) {
    const { user_id, email } = req.body || {};
    if (!user_id || !email)
      return res.status(400).json({ error: 'user_id e email são obrigatórios' });
    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        customer_email: email,
        line_items: [{ price: PRICE_ID, quantity: 1 }],
        success_url: `${APP_URL}?subscribed=1`,
        cancel_url:  `${APP_URL}?subscribed=0`,
        metadata: { user_id },
        subscription_data: {
          trial_period_days: TRIAL_DAYS,
          metadata: { user_id },
        },
      });
      return res.status(200).json({ url: session.url });
    } catch (err) {
      console.error('[stripe/checkout]', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── Com stripe-signature → webhook da Stripe ────────────────────────────
  // Usa stripe.events.retrieve() em vez de constructEvent para evitar problema
  // de body já parseado pelo Vercel (raw body não disponível fora do Next.js)
  const eventId = req.body?.id;
  if (!eventId) return res.status(400).json({ error: 'Missing event ID' });

  let event;
  try {
    event = await stripe.events.retrieve(eventId);
  } catch (err) {
    console.error('[stripe/webhook] retrieve falhou:', err.message);
    return res.status(400).json({ error: err.message });
  }

  const { type, data } = event;
  let client;

  try {
    client = await pool.connect();

    // ── Checkout concluído → ativa plano + notifica usuário ─────────────────
    if (type === 'checkout.session.completed') {
      const session = data.object;
      const user_id = session.metadata?.user_id;
      if (user_id) {
        await activatePlan(client, user_id, session.customer, session.subscription);
        console.log(`[stripe/webhook] ativado user_id=${user_id}`);
        // Notifica via e-mail + WhatsApp (trial ativo)
        notifySubscriptionActive(client, user_id, true).catch(e =>
          console.warn('[stripe/webhook] notifySubscriptionActive:', e.message)
        );
      }
    }

    // ── Renovação mensal ─────────────────────────────────────────────────────
    if (type === 'invoice.payment_succeeded') {
      const inv = data.object;
      if (inv.subscription) {
        const expires_at = new Date();
        expires_at.setDate(expires_at.getDate() + 35);

        // Tenta pegar user_id dos metadados da subscription
        let user_id = null;
        try {
          const sub = await stripe.subscriptions.retrieve(inv.subscription);
          user_id = sub.metadata?.user_id;
        } catch (_) {}

        if (user_id) {
          await activatePlan(client, user_id, inv.customer, inv.subscription);
        } else {
          await client.query(
            `UPDATE public.dashdriver_plans
             SET plano = 'active', expires_at = $1, updated_at = NOW()
             WHERE stripe_subscription_id = $2`,
            [expires_at.toISOString(), inv.subscription]
          );
        }
        console.log(`[stripe/webhook] renovado sub=${inv.subscription}`);
      }
    }

    // ── Pagamento falhou ─────────────────────────────────────────────────────
    if (type === 'invoice.payment_failed') {
      const inv = data.object;
      if (inv.subscription) {
        await client.query(
          `UPDATE public.dashdriver_plans SET plano='expired', updated_at=NOW()
           WHERE stripe_subscription_id=$1`,
          [inv.subscription]
        );
        console.log(`[stripe/webhook] falha sub=${inv.subscription}`);
      }
    }

    // ── Assinatura cancelada ou cliente excluído ──────────────────────────────
    if (type === 'customer.subscription.deleted') {
      const sub = data.object;
      await client.query(
        `UPDATE public.dashdriver_plans SET plano='expired', updated_at=NOW()
         WHERE stripe_subscription_id=$1`,
        [sub.id]
      );
      console.log(`[stripe/webhook] cancelado sub=${sub.id}`);
    }

    if (type === 'customer.deleted') {
      const customer = data.object;
      await client.query(
        `UPDATE public.dashdriver_plans SET plano='expired', updated_at=NOW()
         WHERE stripe_customer_id=$1`,
        [customer.id]
      );
      console.log(`[stripe/webhook] cliente excluído cus=${customer.id}`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[stripe/webhook] erro:', err.message);
    return res.status(500).json({ error: err.message });
  } finally {
    if (client) client.release();
  }
};

module.exports = handler;
