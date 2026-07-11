/**
 * DashDriver — Envio de e-mail centralizado
 *
 * Prioriza Resend (entrega muito melhor, sai do spam) quando RESEND_API_KEY
 * estiver configurada; cai para Gmail SMTP como fallback.
 *
 * Para tirar os e-mails do spam de vez, configure no Vercel:
 *   RESEND_API_KEY = re_xxx           (painel do Resend)
 *   MAIL_FROM      = DashDriver <nao-responda@dashdriver.com.br>
 * e valide o domínio dashdriver.com.br no Resend (registros SPF, DKIM e DMARC).
 *
 * Uso:
 *   const { sendMail } = require('./_mailer');
 *   await sendMail({ to, subject, html, text });
 */
const nodemailer = require('nodemailer');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const MAIL_FROM      = process.env.MAIL_FROM || 'DashDriver <onboarding@resend.dev>';
const GMAIL_USER     = process.env.GMAIL_USER;
const GMAIL_PASS     = process.env.GMAIL_APP_PASS;

async function sendMail({ to, subject, html, text, replyTo }) {
  if (!to) return;

  // ── Caminho preferido: Resend ──────────────────────────────────────────
  if (RESEND_API_KEY) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: MAIL_FROM,
        to: [to],
        subject,
        html,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      throw new Error('Resend falhou: ' + detail.slice(0, 200));
    }
    return;
  }

  // ── Fallback: Gmail SMTP (sujeito a cair no spam) ──────────────────────
  if (GMAIL_USER && GMAIL_PASS) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER, pass: GMAIL_PASS },
    });
    await transporter.sendMail({
      from:    `"DashDriver" <${GMAIL_USER}>`,
      replyTo: replyTo || GMAIL_USER,
      to,
      subject,
      text,
      html,
      headers: { 'X-Priority': '3', 'X-Mailer': 'DashDriver Mailer' },
    });
    return;
  }

  throw new Error('Nenhum provedor de e-mail configurado (defina RESEND_API_KEY ou GMAIL_USER/GMAIL_APP_PASS)');
}

module.exports = { sendMail };
