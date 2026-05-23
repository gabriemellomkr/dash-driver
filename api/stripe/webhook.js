const Stripe     = require('stripe');
const pool       = require('../admin/_db');
const nodemailer = require('nodemailer');
const crypto     = require('crypto');

const stripe     = Stripe(process.env.STRIPE_SECRET_KEY);
const PRICE_ID   = process.env.STRIPE_PRICE_ID || 'price_1TYwuxA3GkEpPzeDfvOu3dMr';
const APP_URL    = process.env.APP_URL          || 'https://app.dashdriver.com.br';

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

// ─── Notificação de pagamento falhou ─────────────────────────────────────────
async function notifyPaymentFailed(client, subscriptionId, invoiceUrl) {
  // Busca contato pelo stripe_subscription_id
  const r = await client.query(
    `SELECT au.email, c.telefone, c.nome
     FROM public.dashdriver_plans dp
     JOIN auth.users au ON au.id = dp.user_id
     LEFT JOIN public.dashdriver_config c ON c.user_id = dp.user_id
     WHERE dp.stripe_subscription_id = $1 LIMIT 1`,
    [subscriptionId]
  );
  if (!r.rows.length) return;
  const { email, telefone, nome } = r.rows[0];
  const primeiroNome = (nome || 'Motorista').split(' ')[0];
  const payUrl = invoiceUrl || APP_URL;

  // WhatsApp
  await _whatsapp(telefone,
    `⚠️ *${primeiroNome}, seu pagamento não foi processado.*\n\nHouve um problema com a cobrança da sua assinatura DashDriver e seu acesso foi suspenso temporariamente.\n\n*O que fazer:*\n1️⃣ Verifique se o cartão está válido e com limite disponível\n2️⃣ Acesse o link abaixo para regularizar:\n👉 ${payUrl}\n\nAssim que o pagamento for confirmado, seu acesso é liberado automaticamente. Qualquer dúvida, responde aqui! 💬`
  );

  // E-mail
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px">
<tr><td align="center"><table width="480" cellpadding="0" cellspacing="0" style="background:#0e0e10;border-radius:16px;padding:36px 32px;max-width:480px">

  <!-- Logo -->
  <tr><td style="padding-bottom:24px">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="background:rgba(59,130,246,.15);padding:10px;border-radius:12px;font-size:22px;vertical-align:middle">🏍️</td>
      <td style="padding-left:12px;font-size:20px;font-weight:900;color:#fff;vertical-align:middle">DashDriver</td>
    </tr></table>
  </td></tr>

  <!-- Alerta -->
  <tr><td style="padding-bottom:8px;font-size:22px;font-weight:900;color:#f87171">⚠️ Problema com seu pagamento</td></tr>

  <tr><td style="padding-bottom:24px;font-size:14px;color:rgba(255,255,255,.65);line-height:1.7">
    Olá, <b style="color:#fff">${primeiroNome}</b>!<br><br>
    Identificamos que a cobrança da sua assinatura DashDriver <b style="color:#f87171">não foi processada</b> e seu acesso foi suspenso temporariamente.<br><br>
    Isso pode acontecer por cartão expirado, limite insuficiente ou dados desatualizados. A boa notícia: é fácil de resolver!
  </td></tr>

  <!-- CTA -->
  <tr><td style="padding-bottom:24px">
    <a href="${payUrl}" style="display:inline-block;background:#f87171;color:#fff;font-weight:700;font-size:15px;padding:15px 32px;border-radius:12px;text-decoration:none">
      Regularizar pagamento →
    </a>
  </td></tr>

  <!-- Passos -->
  <tr><td style="padding-bottom:6px;font-size:14px;font-weight:800;color:#fff">O que fazer agora:</td></tr>
  <tr><td style="padding-bottom:24px">
    <table cellpadding="0" cellspacing="0" width="100%">
      <tr><td style="padding:8px 0;font-size:13px;color:rgba(255,255,255,.65);line-height:1.5;border-bottom:1px solid rgba(255,255,255,.06)">
        <b style="color:#fff">1.</b> Verifique se o cartão está válido e com limite disponível
      </td></tr>
      <tr><td style="padding:8px 0;font-size:13px;color:rgba(255,255,255,.65);line-height:1.5;border-bottom:1px solid rgba(255,255,255,.06)">
        <b style="color:#fff">2.</b> Clique no botão acima para acessar a fatura e atualizar o pagamento
      </td></tr>
      <tr><td style="padding:8px 0;font-size:13px;color:rgba(255,255,255,.65);line-height:1.5">
        <b style="color:#fff">3.</b> Assim que confirmado, seu acesso é <b style="color:#4ade80">liberado automaticamente</b>
      </td></tr>
    </table>
  </td></tr>

  <!-- Suporte -->
  <tr><td style="padding-bottom:4px;font-size:13px;color:rgba(255,255,255,.4);line-height:1.6">
    Precisa de ajuda? Responda este e-mail ou fale pelo suporte dentro do app. Estamos aqui para resolver rápido.
  </td></tr>
  <tr><td style="font-size:11px;color:rgba(255,255,255,.2)">© DashDriver</td></tr>

</table></td></tr></table>
</body></html>`;

  await _email(
    email,
    '⚠️ DashDriver — problema com seu pagamento',
    html,
    `${primeiroNome}, houve um problema com a cobrança da sua assinatura DashDriver.\n\nSeu acesso foi suspenso temporariamente.\n\nPara regularizar, acesse:\n${payUrl}\n\nAssim que o pagamento for confirmado, seu acesso é liberado automaticamente.`
  );
}

// ─── Ativa plano no banco ─────────────────────────────────────────────────────
async function activatePlan(client, user_id, customerId, subscriptionId) {
  await client.query(
    `INSERT INTO public.dashdriver_plans
       (user_id, plano, stripe_customer_id, stripe_subscription_id, updated_at)
     VALUES ($1, 'active', $2, $3, NOW())
     ON CONFLICT (user_id) DO UPDATE
       SET plano                  = 'active',
           stripe_customer_id     = EXCLUDED.stripe_customer_id,
           stripe_subscription_id = EXCLUDED.stripe_subscription_id,
           updated_at             = NOW()`,
    [user_id, customerId, subscriptionId]
  );
}

// ─── Notificação de assinatura ativada (usuário existente) ───────────────────
async function notifySubscriptionActive(client, user_id, isTrial) {
  const { email, telefone, nome } = await _getUserContact(client, user_id);
  const primeiroNome = (nome || 'Motorista').split(' ')[0];
  const trialMsg = isTrial
    ? `Seu período de teste gratuito de ${TRIAL_DAYS} dias está ativo. Após o período, a cobrança mensal é feita automaticamente.`
    : `Sua assinatura está ativa. Obrigado por assinar o DashDriver!`;

  await _whatsapp(telefone, `🎉 *Assinatura DashDriver ativada, ${primeiroNome}!*\n\n${trialMsg}\n\n👉 Acesse: ${APP_URL}`);

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px">
<tr><td align="center"><table width="480" cellpadding="0" cellspacing="0" style="background:#0e0e10;border-radius:16px;padding:32px;max-width:480px">
  <tr><td style="padding-bottom:20px;font-size:24px;font-weight:900;color:#fff">🎉 Assinatura ativada!</td></tr>
  <tr><td style="padding-bottom:16px;font-size:15px;color:rgba(255,255,255,.7);line-height:1.7">
    Olá, <b style="color:#fff">${primeiroNome}</b>!<br><br>
    ${isTrial
      ? `Seu período de teste gratuito de <b style="color:#60a5fa">${TRIAL_DAYS} dias</b> está ativo. Após o período, a cobrança mensal é feita automaticamente.`
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

  await _email(email, '🎉 Sua assinatura DashDriver está ativa!', html,
    `Assinatura DashDriver ativada!\n\n${trialMsg}\n\nAcesse: ${APP_URL}`);
}

// ─── Cria usuário novo + envia boas-vindas (fluxo self-service) ───────────────
async function createUserFromCheckout(client, email, customerId, subscriptionId, phone) {
  const emailClean = email.toLowerCase().trim();

  // Verifica se já existe
  const exists = await client.query(
    'SELECT id FROM auth.users WHERE lower(email) = lower($1::text) LIMIT 1',
    [emailClean]
  );

  let user_id;

  if (exists.rows.length) {
    // Usuário já existe — apenas ativa o plano
    user_id = exists.rows[0].id;
    console.log(`[stripe/webhook] usuário existente encontrado email=${emailClean} id=${user_id}`);
  } else {
    // Cria novo usuário no Supabase via SQL direto (mesmo padrão do admin/users.js)
    const randomPass = crypto.randomBytes(16).toString('hex');

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
      RETURNING id, email
    `, [emailClean, randomPass]);

    user_id = rUser.rows[0].id;

    // Cria identity (obrigatório para login email/senha no GoTrue)
    await client.query(`
      INSERT INTO auth.identities (
        id, provider_id, user_id, identity_data,
        provider, last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1::text, $2::uuid,
        jsonb_build_object('sub', $2::text, 'email', $1::text),
        'email', now(), now(), now()
      )
    `, [emailClean, user_id]);

    // Salva telefone se veio do Stripe
    if (phone) {
      const phoneClean = phone.replace(/\D/g, '');
      if (phoneClean.length >= 10) {
        await client.query(
          `INSERT INTO public.dashdriver_config (user_id, telefone, updated_at)
           VALUES ($1::uuid, $2, NOW())
           ON CONFLICT (user_id) DO UPDATE SET telefone = EXCLUDED.telefone, updated_at = NOW()`,
          [user_id, phoneClean]
        );
      }
    }

    console.log(`[stripe/webhook] novo usuário criado email=${emailClean} id=${user_id}`);
  }

  // Cria plano como trial (vira 'active' quando invoice.payment_succeeded disparar)
  const trial_ends_at = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await client.query(
    `INSERT INTO public.dashdriver_plans
       (user_id, plano, stripe_customer_id, stripe_subscription_id, trial_ends_at, updated_at)
     VALUES ($1, 'trial', $2, $3, $4, NOW())
     ON CONFLICT (user_id) DO UPDATE
       SET plano                  = 'trial',
           stripe_customer_id     = EXCLUDED.stripe_customer_id,
           stripe_subscription_id = EXCLUDED.stripe_subscription_id,
           trial_ends_at          = EXCLUDED.trial_ends_at,
           updated_at             = NOW()`,
    [user_id, customerId, subscriptionId, trial_ends_at]
  );

  // Gera link para definir senha (7 dias)
  const token   = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await client.query(
    `INSERT INTO public.dashdriver_password_resets (user_id, token, expires_at)
     VALUES ($1::uuid, $2, $3::timestamptz)`,
    [user_id, token, expires.toISOString()]
  );
  const resetUrl = `${APP_URL}?dd_reset=${token}`;

  // E-mail de boas-vindas com dicas de uso
  const trialEndFmt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px">
<tr><td align="center"><table width="480" cellpadding="0" cellspacing="0" style="background:#0e0e10;border-radius:16px;padding:36px 32px;max-width:480px">

  <!-- Logo -->
  <tr><td style="padding-bottom:28px">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="background:rgba(59,130,246,.15);padding:10px;border-radius:12px;font-size:22px;vertical-align:middle">🏍️</td>
      <td style="padding-left:12px;font-size:20px;font-weight:900;color:#fff;vertical-align:middle">DashDriver</td>
    </tr></table>
  </td></tr>

  <!-- Título -->
  <tr><td style="padding-bottom:8px;font-size:24px;font-weight:900;color:#fff;line-height:1.3">
    Bem-vindo ao DashDriver! 🎉
  </td></tr>

  <!-- Subtítulo trial -->
  <tr><td style="padding-bottom:28px;font-size:14px;color:rgba(255,255,255,.5);line-height:1.6">
    Sua conta foi criada e seu teste gratuito de <b style="color:#60a5fa">${TRIAL_DAYS} dias</b> está ativo até <b style="color:#fff">${trialEndFmt}</b>.<br>
    Após esse período, a cobrança de R$&nbsp;29,90/mês é feita automaticamente no cartão cadastrado.
  </td></tr>

  <!-- CTA principal -->
  <tr><td style="padding-bottom:32px">
    <a href="${resetUrl}" style="display:inline-block;background:#3b82f6;color:#fff;font-weight:700;font-size:15px;padding:15px 32px;border-radius:12px;text-decoration:none">
      Definir minha senha e entrar →
    </a>
    <div style="margin-top:10px;font-size:12px;color:rgba(255,255,255,.3)">(Link válido por 7 dias · login: ${emailClean})</div>
  </td></tr>

  <!-- Divisor -->
  <tr><td style="padding-bottom:24px;border-top:1px solid rgba(255,255,255,.08)"></td></tr>

  <!-- Dicas de uso -->
  <tr><td style="padding-bottom:16px;font-size:15px;font-weight:800;color:#fff">Como aproveitar ao máximo o DashDriver</td></tr>

  <tr><td style="padding-bottom:14px">
    <table cellpadding="0" cellspacing="0" width="100%"><tr>
      <td width="32" style="vertical-align:top;padding-top:2px;font-size:18px">📋</td>
      <td style="font-size:13px;color:rgba(255,255,255,.7);line-height:1.6;padding-left:10px">
        <b style="color:#fff">Registre suas corridas diariamente</b><br>
        Quanto mais você registrar, mais preciso fica o cálculo do seu lucro real. Você pode lançar pelo app ou usar o OCR para ler o comprovante automaticamente.
      </td>
    </tr></table>
  </td></tr>

  <tr><td style="padding-bottom:14px">
    <table cellpadding="0" cellspacing="0" width="100%"><tr>
      <td width="32" style="vertical-align:top;padding-top:2px;font-size:18px">⛽</td>
      <td style="font-size:13px;color:rgba(255,255,255,.7);line-height:1.6;padding-left:10px">
        <b style="color:#fff">Lance os abastecimentos</b><br>
        Gasolina é um dos maiores custos do motorista. Registre cada abastecimento para ver o custo por km rodado e descobrir se sua operação é realmente lucrativa.
      </td>
    </tr></table>
  </td></tr>

  <tr><td style="padding-bottom:14px">
    <table cellpadding="0" cellspacing="0" width="100%"><tr>
      <td width="32" style="vertical-align:top;padding-top:2px;font-size:18px">🎯</td>
      <td style="font-size:13px;color:rgba(255,255,255,.7);line-height:1.6;padding-left:10px">
        <b style="color:#fff">Configure suas metas</b><br>
        Defina meta diária, semanal e mensal nas configurações. O dashboard mostra em tempo real quanto falta para bater a meta do dia.
      </td>
    </tr></table>
  </td></tr>

  <tr><td style="padding-bottom:28px">
    <table cellpadding="0" cellspacing="0" width="100%"><tr>
      <td width="32" style="vertical-align:top;padding-top:2px;font-size:18px">📊</td>
      <td style="font-size:13px;color:rgba(255,255,255,.7);line-height:1.6;padding-left:10px">
        <b style="color:#fff">Acompanhe o resumo semanal</b><br>
        Todo domingo você recebe um resumo automático no WhatsApp com seus ganhos, gastos e lucro da semana. Fique de olho!
      </td>
    </tr></table>
  </td></tr>

  <!-- Divisor -->
  <tr><td style="padding-bottom:24px;border-top:1px solid rgba(255,255,255,.08)"></td></tr>

  <!-- Suporte -->
  <tr><td style="padding-bottom:4px;font-size:13px;color:rgba(255,255,255,.5);line-height:1.6">
    Ficou com alguma dúvida? Fale com a gente direto pelo suporte dentro do app ou responda este e-mail. Estamos aqui para ajudar.
  </td></tr>
  <tr><td style="font-size:11px;color:rgba(255,255,255,.2)">© DashDriver · Você está recebendo este e-mail porque criou uma conta.</td></tr>

</table></td></tr></table>
</body></html>`;

  const emailText = `Bem-vindo ao DashDriver!

Sua conta foi criada e seu teste gratuito de ${TRIAL_DAYS} dias está ativo até ${trialEndFmt}.

Acesse o link abaixo para definir sua senha:
${resetUrl}
(Link válido por 7 dias)

Como aproveitar ao máximo:
• Registre suas corridas diariamente
• Lance os abastecimentos para ver o custo por km
• Configure suas metas diária, semanal e mensal
• Acompanhe o resumo semanal no WhatsApp todo domingo

Dúvidas? Fale pelo suporte dentro do app ou responda este e-mail.`;

  await _email(emailClean, '🏍️ Bem-vindo ao DashDriver — defina sua senha', html, emailText);

  // WhatsApp se tiver telefone
  if (phone) {
    await _whatsapp(phone,
      `🏍️ *Bem-vindo ao DashDriver!*\n\nSua conta foi criada e seu teste grátis de *${TRIAL_DAYS} dias* está ativo!\n\n*1º passo:* clique no link abaixo para definir sua senha e acessar o app:\n👉 ${resetUrl}\n\n📋 *Dicas rápidas:*\n• Registre suas corridas todo dia\n• Lance os abastecimentos\n• Configure suas metas no app\n• Todo domingo você recebe um resumo aqui no WhatsApp\n\n💬 *Suporte:* salva este número! Sempre que precisar de ajuda, é só mandar mensagem aqui.\n\n_(Link válido por 7 dias)_`
    );
  }

  return user_id;
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
        phone_number_collection: { enabled: true },
      });
      return res.status(200).json({ url: session.url });
    } catch (err) {
      console.error('[stripe/checkout]', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── Com stripe-signature → webhook da Stripe ────────────────────────────
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

    // ── Checkout concluído ───────────────────────────────────────────────────
    if (type === 'checkout.session.completed') {
      const session   = data.object;
      const user_id   = session.metadata?.user_id;
      const email     = session.customer_details?.email;
      const phone     = session.customer_details?.phone || '';

      if (user_id) {
        // Usuário logado no app → apenas ativa plano + notifica
        await activatePlan(client, user_id, session.customer, session.subscription);
        console.log(`[stripe/webhook] ativado user_id=${user_id}`);
        notifySubscriptionActive(client, user_id, true).catch(e =>
          console.warn('[stripe/webhook] notify:', e.message)
        );
      } else if (email) {
        // Self-service (Payment Link ou checkout externo) → cria conta + ativa
        console.log(`[stripe/webhook] self-service checkout email=${email}`);
        const uid = await createUserFromCheckout(client, email, session.customer, session.subscription, phone);
        console.log(`[stripe/webhook] conta criada/ativada uid=${uid}`);
      } else {
        console.warn('[stripe/webhook] checkout.session.completed sem user_id nem email');
      }
    }

    // ── Renovação mensal ─────────────────────────────────────────────────────
    if (type === 'invoice.payment_succeeded') {
      const inv = data.object;
      if (inv.subscription) {
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
             SET plano = 'active', updated_at = NOW()
             WHERE stripe_subscription_id = $1`,
            [inv.subscription]
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

        // Notifica o usuário via WhatsApp + e-mail
        notifyPaymentFailed(client, inv.subscription, inv.hosted_invoice_url).catch(e =>
          console.warn('[stripe/webhook] notifyPaymentFailed:', e.message)
        );
      }
    }

    // ── Assinatura cancelada ─────────────────────────────────────────────────
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
