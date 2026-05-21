/**
 * DashDriver — Reset de Senha (flow próprio via Gmail SMTP)
 *
 * POST /api/reset-password          { email }           → gera token, envia e-mail
 * POST /api/reset-password/confirm  { token, password } → valida token, atualiza senha
 */

const pool       = require('./admin/_db');
const nodemailer = require('nodemailer');
const crypto     = require('crypto');

const APP_URL      = process.env.APP_URL      || 'https://app.dashdriver.com.br';
const GMAIL_USER   = process.env.GMAIL_USER;   // ex: dashdriver.notif@gmail.com
const GMAIL_PASS   = process.env.GMAIL_APP_PASS; // App Password de 16 chars

function makeTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_PASS },
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).end();

  const path = req.url?.split('?')[0] || '';
  const body = req.body || {};

  // ── Confirmação: valida token e atualiza senha ─────────────────────────────
  // Detecta tanto por URL (/confirm) quanto por corpo (action='confirm' ou token presente sem email)
  if (path.endsWith('/confirm') || body.action === 'confirm' || (body.token && !body.email)) {
    const { token, password } = req.body || {};
    if (!token || !password)
      return res.status(400).json({ error: 'token e password obrigatórios' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });

    const client = await pool.connect();
    try {
      // Busca token válido (não expirado, não usado)
      const rToken = await client.query(
        `SELECT user_id FROM public.dashdriver_password_resets
         WHERE token = $1 AND expires_at > now() AND used_at IS NULL`,
        [token]
      );
      if (!rToken.rows.length)
        return res.status(400).json({ error: 'Link inválido ou expirado. Solicite um novo.' });

      const { user_id } = rToken.rows[0];

      // Atualiza senha no auth.users com bcrypt cost 10 (mesmo padrão do GoTrue)
      await client.query(
        `UPDATE auth.users
         SET encrypted_password = crypt($1::text, gen_salt('bf', 10)),
             updated_at = now()
         WHERE id = $2::uuid`,
        [password, user_id]
      );

      // Marca token como usado
      await client.query(
        `UPDATE public.dashdriver_password_resets SET used_at = now() WHERE token = $1`,
        [token]
      );

      console.log(`[reset-password] senha atualizada user_id=${user_id}`);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('[reset-password/confirm]', err.message);
      return res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  }

  // ── Solicitar reset: gera token e envia e-mail ─────────────────────────────
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email obrigatório' });

  if (!GMAIL_USER || !GMAIL_PASS) {
    console.error('[reset-password] GMAIL_USER ou GMAIL_APP_PASS não configurado');
    return res.status(500).json({ error: 'Serviço de e-mail não configurado. Contate o suporte.' });
  }

  const client = await pool.connect();
  try {
    // Verifica se o e-mail existe
    const rUser = await client.query(
      `SELECT id FROM auth.users WHERE lower(email) = lower($1::text) LIMIT 1`,
      [email.trim()]
    );

    // Responde ok mesmo se não encontrou (evita enumeração de e-mails)
    if (!rUser.rows.length) {
      return res.status(200).json({ ok: true });
    }

    const user_id = rUser.rows[0].id;
    const token   = crypto.randomBytes(32).toString('hex'); // 64 chars hex
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    // Invalida tokens antigos do mesmo usuário
    await client.query(
      `UPDATE public.dashdriver_password_resets SET used_at = now()
       WHERE user_id = $1 AND used_at IS NULL`,
      [user_id]
    );

    // Salva novo token
    await client.query(
      `INSERT INTO public.dashdriver_password_resets (user_id, token, expires_at)
       VALUES ($1::uuid, $2, $3::timestamptz)`,
      [user_id, token, expires.toISOString()]
    );

    // Monta e-mail
    const resetUrl = `${APP_URL}?dd_reset=${token}`;
    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0e0e10;color:#fff;padding:32px;border-radius:16px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
          <div style="background:rgba(59,130,246,0.15);padding:10px;border-radius:12px;font-size:24px">🏍️</div>
          <h1 style="margin:0;font-size:20px;font-weight:900;color:#fff">DashDriver</h1>
        </div>
        <h2 style="color:#fff;font-size:16px;margin-bottom:8px">Redefinição de senha</h2>
        <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;margin-bottom:24px">
          Recebemos uma solicitação para redefinir a senha da sua conta DashDriver.<br>
          Clique no botão abaixo para criar uma nova senha. O link expira em <strong>1 hora</strong>.
        </p>
        <a href="${resetUrl}"
           style="display:inline-block;background:#3b82f6;color:#fff;font-weight:700;font-size:15px;padding:14px 28px;border-radius:12px;text-decoration:none;margin-bottom:24px">
          Redefinir minha senha
        </a>
        <p style="color:rgba(255,255,255,0.3);font-size:12px;margin-top:16px">
          Se você não solicitou a redefinição, ignore este e-mail. Sua senha não será alterada.
        </p>
        <p style="color:rgba(255,255,255,0.2);font-size:11px;margin-top:8px;word-break:break-all">
          Link: ${resetUrl}
        </p>
      </div>
    `;

    await makeTransporter().sendMail({
      from:    `"DashDriver" <${GMAIL_USER}>`,
      to:      email.trim(),
      subject: 'Redefinição de senha — DashDriver',
      html,
    });

    console.log(`[reset-password] e-mail enviado para ${email}`);
    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('[reset-password]', err.message);
    return res.status(500).json({ error: 'Erro ao enviar e-mail: ' + err.message });
  } finally {
    client.release();
  }
};
