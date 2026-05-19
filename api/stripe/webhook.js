const Stripe = require('stripe');
const pool   = require('../admin/_db');

const stripe        = Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const PRICE_ID      = process.env.STRIPE_PRICE_ID || 'price_1TYwuxA3GkEpPzeDfvOu3dMr';
const APP_URL       = process.env.APP_URL          || 'https://dashdriver.com.br';

// Coleta body raw (necessário para verificar assinatura Stripe)
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const handler = async function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, stripe-signature');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  // ── Se NÃO tem stripe-signature → é pedido de checkout do app ──────────
  if (!req.headers['stripe-signature']) {
    const body = req.body || {};
    const { user_id, email } = body;
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
        subscription_data: { metadata: { user_id } },
      });
      return res.status(200).json({ url: session.url });
    } catch (err) {
      console.error('[stripe/checkout] error:', err.message);
      return res.status(500).json({ error: 'Erro ao criar sessão de pagamento', detail: err.message });
    }
  }

  // ── Com stripe-signature → é webhook da Stripe ──────────────────────────
  let rawBody;
  let event;

  try {
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      rawBody = JSON.stringify(req.body);
    } else {
      rawBody = await getRawBody(req);
    }
    event = stripe.webhooks.constructEvent(rawBody, req.headers['stripe-signature'], webhookSecret);
  } catch (err) {
    console.error('[stripe/webhook] assinatura inválida:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  const { type, data } = event;
  let client;

  try {
    client = await pool.connect();

    if (type === 'checkout.session.completed') {
      const session = data.object;
      const user_id = session.metadata?.user_id;
      if (!user_id) return res.status(200).json({ received: true });

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
        [user_id, session.customer, session.subscription, expires_at.toISOString()]
      );
      console.log(`[stripe/webhook] plano ativado user_id=${user_id}`);
    }

    if (type === 'invoice.payment_succeeded') {
      const inv = data.object;
      if (inv.subscription) {
        const expires_at = new Date();
        expires_at.setDate(expires_at.getDate() + 35);
        await client.query(
          `UPDATE public.dashdriver_plans
           SET plano = 'active', expires_at = $1, updated_at = NOW()
           WHERE stripe_subscription_id = $2`,
          [expires_at.toISOString(), inv.subscription]
        );
      }
    }

    if (type === 'invoice.payment_failed') {
      const inv = data.object;
      if (inv.subscription) {
        await client.query(
          `UPDATE public.dashdriver_plans
           SET plano = 'expired', updated_at = NOW()
           WHERE stripe_subscription_id = $1`,
          [inv.subscription]
        );
      }
    }

    if (type === 'customer.subscription.deleted') {
      const sub = data.object;
      await client.query(
        `UPDATE public.dashdriver_plans
         SET plano = 'expired', updated_at = NOW()
         WHERE stripe_subscription_id = $1`,
        [sub.id]
      );
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[stripe/webhook] erro interno:', err.message);
    return res.status(500).json({ error: err.message });
  } finally {
    if (client) client.release();
  }
};

handler.config = { api: { bodyParser: false } };
module.exports = handler;
