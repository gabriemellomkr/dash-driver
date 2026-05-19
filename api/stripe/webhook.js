const Stripe = require('stripe');
const pool   = require('../admin/_db');

const stripe        = Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Coleta body raw antes que o framework parse (necessário para verificar assinatura Stripe)
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Desabilita o body parser automático do Vercel para esta rota
const handler = async function (req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];

  let rawBody;
  let event;

  try {
    // Se o body já foi parseado (objeto), reconstrói para string
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      rawBody = JSON.stringify(req.body);
    } else {
      rawBody = await getRawBody(req);
    }
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('[stripe/webhook] assinatura inválida:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  const { type, data } = event;
  let client;

  try {
    client = await pool.connect();

    // ── Pagamento confirmado → ativa plano ──────────────────────────────
    if (type === 'checkout.session.completed') {
      const session = data.object;
      const user_id = session.metadata?.user_id;
      if (!user_id) {
        console.warn('[stripe/webhook] checkout.session.completed sem user_id');
        return res.status(200).json({ received: true });
      }

      const expires_at = new Date();
      expires_at.setDate(expires_at.getDate() + 35); // margem inicial (renovado via invoice)

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

    // ── Pagamento mensal renovado ────────────────────────────────────────
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
        console.log(`[stripe/webhook] renovação sub=${inv.subscription}`);
      }
    }

    // ── Pagamento falhou ─────────────────────────────────────────────────
    if (type === 'invoice.payment_failed') {
      const inv = data.object;
      if (inv.subscription) {
        await client.query(
          `UPDATE public.dashdriver_plans
           SET plano = 'expired', updated_at = NOW()
           WHERE stripe_subscription_id = $1`,
          [inv.subscription]
        );
        console.log(`[stripe/webhook] pagamento falhou sub=${inv.subscription}`);
      }
    }

    // ── Assinatura cancelada ─────────────────────────────────────────────
    if (type === 'customer.subscription.deleted') {
      const sub = data.object;
      await client.query(
        `UPDATE public.dashdriver_plans
         SET plano = 'expired', updated_at = NOW()
         WHERE stripe_subscription_id = $1`,
        [sub.id]
      );
      console.log(`[stripe/webhook] assinatura cancelada sub=${sub.id}`);
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
