const {supportContent,validStatus} = require('../_validation');
const pool = require('./_db');
const { verifyAdmin } = require('./_auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const claims = await verifyAdmin(req);
  if (!claims) return res.status(403).json({ error: 'Forbidden' });
  const adminEmail = claims.email || 'admin';

  const client = await pool.connect();
  try {
    // ── GET: lista tickets OU mensagens de um ticket ─────────────────────
    if (req.method === 'GET') {
      const { ticket_id } = req.query || {};

      // Mensagens de um ticket específico
      if (ticket_id) {
        const r = await client.query(
          `SELECT id, sender_role, conteudo, tipo, created_at
           FROM public.dashdriver_support_messages
           WHERE ticket_id = $1
           ORDER BY created_at ASC`,
          [ticket_id]
        );
        return res.status(200).json({ messages: r.rows });
      }

      // Lista todos os tickets
      const r = await client.query(`
        SELECT
          s.id, s.titulo, s.status, s.ticket_number,
          s.assigned_to, s.created_at, s.updated_at,
          u.email  AS user_email,
          c.nome AS user_nome,
          c.telefone   AS user_telefone,
          (SELECT CASE WHEN tipo = 'image' THEN '[imagem]'
                       ELSE left(conteudo, 120) END
           FROM public.dashdriver_support_messages
           WHERE ticket_id = s.id ORDER BY created_at DESC LIMIT 1) AS last_message,
          (SELECT tipo FROM public.dashdriver_support_messages
           WHERE ticket_id = s.id ORDER BY created_at DESC LIMIT 1) AS last_tipo,
          (SELECT sender_role FROM public.dashdriver_support_messages
           WHERE ticket_id = s.id ORDER BY created_at DESC LIMIT 1) AS last_sender,
          (SELECT count(*)::int FROM public.dashdriver_support_messages
           WHERE ticket_id = s.id) AS msg_count
        FROM public.dashdriver_support s
        LEFT JOIN auth.users u  ON u.id  = s.user_id
        LEFT JOIN public.dashdriver_config   c  ON c.user_id = s.user_id
        ORDER BY
          CASE s.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
          s.updated_at DESC
      `);
      return res.status(200).json({ tickets: r.rows });
    }

    // ── POST: aceitar ticket | enviar mensagem | mudar status ────────────
    if (req.method === 'POST') {
      const { ticket_id, conteudo, tipo = 'text', status, action } = req.body || {};

      if (status && !validStatus(status)) return res.status(400).json({error:'Status inválido'});
      if (conteudo !== undefined && !supportContent(conteudo,tipo)) return res.status(400).json({error:'Mensagem inválida ou muito grande'});
      if (!ticket_id) return res.status(400).json({ error: 'ticket_id obrigatório' });

      // Aceitar ticket (open → in_progress + assigned_to)
      if (action === 'accept') {
        const r = await client.query(
          `UPDATE public.dashdriver_support
           SET status = 'in_progress', assigned_to = $1, updated_at = now()
           WHERE id = $2
           RETURNING id, status, ticket_number, assigned_to`,
          [adminEmail, ticket_id]
        );
        return res.status(200).json({ ok: true, ticket: r.rows[0] });
      }

      // Apenas mudar status (sem mensagem)
      if (status && !conteudo) {
        const r = await client.query(
          `UPDATE public.dashdriver_support
           SET status = $1, updated_at = now()
           WHERE id = $2
           RETURNING id, status, ticket_number`,
          [status, ticket_id]
        );
        return res.status(200).json({ ok: true, ticket: r.rows[0] });
      }

      // Enviar mensagem + opcionalmente atualizar status
      if (!conteudo) return res.status(400).json({ error: 'conteudo obrigatório' });

      // Imagens base64 podem ter 100k+ chars — sem limite para tipo=image
      const conteudoSalvo = tipo === 'image' ? conteudo : conteudo.substring(0, 4000);
      const rMsg = await client.query(
        `INSERT INTO public.dashdriver_support_messages (ticket_id, sender_role, conteudo, tipo)
         VALUES ($1, 'admin', $2, $3)
         RETURNING id, created_at`,
        [ticket_id, conteudoSalvo, tipo]
      );

      // Atualiza ticket: assigned_to (se ainda não tem) + status
      const newStatus = status || 'in_progress';
      await client.query(
        `UPDATE public.dashdriver_support
         SET status      = $1,
             assigned_to = COALESCE(assigned_to, $2),
             updated_at  = now()
         WHERE id = $3`,
        [newStatus, adminEmail, ticket_id]
      );

      return res.status(200).json({ ok: true, message: rMsg.rows[0] });
    }

    return res.status(405).end();
  } catch (err) {
    console.error('[admin/support]', err.message);
    return res.status(500).json({ error: 'Não foi possível acessar o suporte. Tente novamente.' });
  } finally {
    client.release();
  }
};
