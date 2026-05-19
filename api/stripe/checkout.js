const Stripe = require('stripe');
const pool   = require('../admin/_db');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const PRICE_ID      = process.env.STRIPE_PRICE_ID  || 'price_1TYwuxA3GkEpPzeDfvOu3dMr';
const SUCCESS_URL   = process.env.APP_URL           || 'https://dashdriver.com.br';
const CANCEL_URL    = process.env.APP_URL           || 'https://dashdriver.com.br';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { user_id, email } = req.body || {};
  if (!user_id || !email) {
    return res.status(400).json({ error: 'user_id e email são obrigatórios' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      success_url: `${SUCCESS_URL}?subscribed=1`,
      cancel_url:  `${CANCEL_URL}?subscribed=0`,
      metadata: { user_id },
      subscription_data: { metadata: { user_id } },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('[stripe/checkout] error:', err.message);
    return res.status(500).json({ error: 'Erro ao criar sessão de pagamento', detail: err.message });
  }
};
