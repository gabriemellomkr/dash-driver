/**
 * DashDriver — Reset de Senha (flow próprio via Gmail SMTP)
 *
 * POST /api/reset-password          { email }           → gera token, envia e-mail
 * POST /api/reset-password/confirm  { token, password } → valida token, atualiza senha
 */

const pool   = require('./admin/_db');
const crypto = require('crypto');
const { sendMail } = require('./_mailer');

const APP_URL = process.env.APP_URL || 'https://app.dashdriver.com.br';
const MAIL_CONFIGURED = !!(process.env.RESEND_API_KEY || (process.env.GMAIL_USER && process.env.GMAIL_APP_PASS));

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
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) || typeof password !== 'string')
      return res.status(400).json({ error: 'token e password obrigatórios' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Busca token válido (não expirado, não usado)
      const rToken = await client.query(
        `SELECT user_id FROM public.dashdriver_password_resets
         WHERE token IN ($1, $2) AND expires_at > now() AND used_at IS NULL FOR UPDATE`,
        [crypto.createHash('sha256').update(token).digest('hex'), token]
      );
      if (!rToken.rows.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Link inválido ou expirado. Solicite um novo.' });
      }

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
        `UPDATE public.dashdriver_password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL`,
        [user_id]
      );

      await client.query('COMMIT');
      return res.status(200).json({ ok: true });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[reset-password/confirm]', err.code || 'failed');
      return res.status(500).json({ error: 'Não foi possível concluir a solicitação.' });
    } finally {
      client.release();
    }
  }

  // ── Solicitar reset: gera token e envia e-mail ─────────────────────────────
  const { email } = req.body || {};
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'email obrigatório' });

  if (!MAIL_CONFIGURED) {
    console.error('[reset-password] nenhum provedor de e-mail configurado');
    return res.status(500).json({ error: 'Serviço de e-mail não configurado. Contate o suporte.' });
  }

  const client = await pool.connect();
  try {
    // Verifica se o e-mail existe
    const rUser = await client.query(
      `SELECT id FROM auth.users WHERE lower(email) = lower($1::text) LIMIT 1`,
      [email.trim()]
    );

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
      [user_id, crypto.createHash('sha256').update(token).digest('hex'), expires.toISOString()]
    );

    // Monta e-mail
    const resetUrl = `${APP_URL}?dd_reset=${token}`;

    // Versão HTML (design escuro)
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#0e0e10;border-radius:16px;padding:32px;max-width:480px">
        <tr>
          <td style="padding-bottom:24px">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:rgba(59,130,246,0.15);padding:10px;border-radius:12px;font-size:24px;vertical-align:middle">🏍️</td>
                <td style="padding-left:12px;font-size:20px;font-weight:900;color:#ffffff;vertical-align:middle">DashDriver</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:8px;font-size:16px;font-weight:700;color:#ffffff">
            Redefinição de senha
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:24px;font-size:14px;line-height:1.6;color:rgba(255,255,255,0.6)">
            Recebemos uma solicitação para redefinir a senha da sua conta DashDriver.<br><br>
            Clique no botão abaixo para criar uma nova senha. O link expira em <strong style="color:#fff">1 hora</strong>.
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:24px">
            <a href="${resetUrl}"
               style="display:inline-block;background:#3b82f6;color:#ffffff;font-weight:700;font-size:15px;padding:14px 28px;border-radius:12px;text-decoration:none">
              Redefinir minha senha
            </a>
          </td>
        </tr>
        <tr>
          <td style="font-size:12px;color:rgba(255,255,255,0.35);line-height:1.5">
            Se você não solicitou a redefinição, ignore este e-mail. Sua senha não será alterada.<br><br>
            <span style="word-break:break-all;font-size:11px;color:rgba(255,255,255,0.2)">
              Ou acesse: ${resetUrl}
            </span>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    // Versão texto puro (obrigatória para evitar spam)
    const text = `DashDriver — Redefinição de senha

Recebemos uma solicitação para redefinir a senha da sua conta DashDriver.

Para criar uma nova senha, acesse o link abaixo (válido por 1 hora):

${resetUrl}

Se você não solicitou a redefinição, ignore este e-mail. Sua senha não será alterada.

— Equipe DashDriver`;

    await sendMail({
      to:      email.trim(),
      subject: 'Redefinição de senha — DashDriver',
      text,
      html,
    });


    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('[reset-password]', err.message);
    return res.status(500).json({ error: 'Não foi possível enviar o e-mail. Tente novamente.' });
  } finally {
    client.release();
  }
};
