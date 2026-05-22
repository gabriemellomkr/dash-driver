const pool = require('./_db');
const { verifyAdmin } = require('./_auth');
const nodemailer = require('nodemailer');

const EVOLUTION_URL      = process.env.EVOLUTION_URL;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;
const EVOLUTION_KEY      = process.env.EVOLUTION_KEY;
const GMAIL_USER         = process.env.GMAIL_USER;
const GMAIL_PASS         = process.env.GMAIL_APP_PASS;
const APP_URL            = process.env.APP_URL || 'https://app.dashdriver.com.br';

function makeTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_PASS },
  });
}

function personalize(text, nome) {
  return text.replace(/\{\{nome\}\}/g, nome || 'Motorista');
}

// WhatsApp → Evolution API
async function sendWhatsApp(number, text) {
  const r = await fetch(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_KEY },
    body: JSON.stringify({ number, text }),
  });
  if (!r.ok) throw new Error(`Evolution ${r.status}`);
}

// E-mail via Gmail SMTP
async function sendEmail(to, nome, subject, plainText) {
  const transport = makeTransporter();
  const htmlBody = `
  <table width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;background:#0f172a">
    <tr><td align="center" style="padding:40px 16px">
      <table width="100%" style="max-width:520px;background:#1e293b;border-radius:16px;overflow:hidden">
        <tr><td style="background:#1d4ed8;padding:28px 32px;text-align:center">
          <span style="font-size:32px">🚗</span>
          <h1 style="color:#fff;font-size:20px;margin:8px 0 0">DashDriver</h1>
        </td></tr>
        <tr><td style="padding:32px;color:#e2e8f0;font-size:15px;line-height:1.7">
          ${plainText.replace(/\n/g, '<br>')}
          <hr style="border:none;border-top:1px solid rgba(255,255,255,.1);margin:28px 0">
          <div style="text-align:center">
            <a href="${APP_URL}" style="display:inline-block;padding:12px 28px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px">Acessar DashDriver</a>
          </div>
        </td></tr>
        <tr><td style="padding:16px 32px 28px;text-align:center;color:#64748b;font-size:11px">
          Você recebe esta mensagem por ser usuário do DashDriver.<br>
          <a href="${APP_URL}" style="color:#3b82f6;text-decoration:none">dashdriver.com.br</a>
        </td></tr>
      </table>
    </td></tr>
  </table>`;

  await transport.sendMail({
    from: `"DashDriver" <${GMAIL_USER}>`,
    to,
    subject,
    text: plainText,
    html: htmlBody,
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  if (!verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

  const { message, plano_filter, channel = 'whatsapp', subject = 'Mensagem do DashDriver' } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message required' });

  const client = await pool.connect();
  let recipients = [];
  try {
    const planFilter = plano_filter
      ? `AND p.plano = '${plano_filter.replace(/'/g, "''")}'`
      : '';

    if (channel === 'whatsapp' || channel === 'both') {
      // Busca telefone + nome para personalização
      const r = await client.query(`
        SELECT DISTINCT ON (c.telefone) c.telefone, c.nome
        FROM public.dashdriver_config c
        LEFT JOIN public.dashdriver_plans p ON p.user_id = c.user_id
        WHERE c.telefone IS NOT NULL AND length(c.telefone) >= 8
        ${plano_filter ? `AND (p.plano = $1 OR p.user_id IS NULL)` : ''}
      `, plano_filter ? [plano_filter] : []);
      recipients = r.rows.map(row => ({ ...row, _channels: ['whatsapp'] }));
    }

    if (channel === 'email' || channel === 'both') {
      // Busca e-mail dos usuários + nome do config
      const r = await client.query(`
        SELECT DISTINCT ON (au.email) au.email, c.nome
        FROM auth.users au
        LEFT JOIN public.dashdriver_config c ON c.user_id = au.id
        LEFT JOIN public.dashdriver_plans p  ON p.user_id = au.id
        WHERE au.email IS NOT NULL
        ${plano_filter ? 'AND p.plano = $1' : ''}
      `, plano_filter ? [plano_filter] : []);

      if (channel === 'email') {
        recipients = r.rows.map(row => ({ ...row, _channels: ['email'] }));
      } else {
        // 'both': merge pelo nome, adicionando canal email às entradas existentes por telefone
        // e adicionando registros de email-only
        const byNome = new Map(recipients.map(r2 => [r2.nome, r2]));
        r.rows.forEach(row => {
          const existing = byNome.get(row.nome);
          if (existing) {
            existing.email = row.email;
            existing._channels.push('email');
          } else {
            recipients.push({ ...row, _channels: ['email'] });
          }
        });
      }
    }
  } finally {
    client.release();
  }

  if (recipients.length === 0) return res.status(200).json({ sent: 0, failed: 0, total: 0 });

  let sent = 0, failed = 0;
  await Promise.allSettled(recipients.map(async (c) => {
    const nome = c.nome || 'Motorista';
    const personalizedMsg = personalize(message, nome);
    let ok = false;
    try {
      if (c._channels.includes('whatsapp') && c.telefone) {
        await sendWhatsApp(c.telefone, personalizedMsg);
        ok = true;
      }
      if (c._channels.includes('email') && c.email) {
        await sendEmail(c.email, nome, subject, personalizedMsg);
        ok = true;
      }
      if (ok) sent++; else failed++;
    } catch { failed++; }
  }));

  return res.status(200).json({ sent, failed, total: recipients.length });
};
