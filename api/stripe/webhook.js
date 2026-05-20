const Stripe = require('stripe');
const pool   = require('../admin/_db');

const stripe   = Stripe(process.env.STRIPE_SECRET_KEY);
const PRICE_ID = process.env.STRIPE_PRICE_ID || 'price_1TYwuxA3GkEpPzeDfvOu3dMr';
const APP_URL  = process.env.APP_URL          || 'https://dashdriver.com.br';

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
        subscription_data: { metadata: { user_id } },
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

    // ── Checkout concluído → ativa plano ────────────────────────────────────
    if (type === 'checkout.session.completed') {
      const session = data.object;
      const user_id = session.metadata?.user_id;
      if (user_id) {
        await activatePlan(client, user_id, session.customer, session.subscription);
        console.log(`[stripe/webhook] ativado user_id=${user_id}`);
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
