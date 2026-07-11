const pool = require('./admin/_db');
const { verifyUser } = require('./_verify-user');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Usuário sempre vem do token — nunca do cliente (evita ler/escrever tickets alheios)
  const claims = await verifyUser(req);
  if (!claims) return res.status(401).json({ error: 'Não autenticado' });
  const user_id = claims.sub;

  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    return res.status(500).json({ error: 'DB connection failed' });
  }

  // ── GET: todos os tickets do usuário OU mensagens de um ticket ──────────
  if (req.method === 'GET') {
    const { ticket_id } = req.query || {};

    try {
      // Mensagens de um ticket específico (pertencente ao usuário)
      if (ticket_id) {
        const rCheck = await client.query(
          `SELECT id FROM public.dashdriver_support WHERE id = $1 AND user_id = $2`,
          [ticket_id, user_id]
        );
        if (!rCheck.rows.length)
          return res.status(404).json({ error: 'Ticket não encontrado' });

        const rMsgs = await client.query(
          `SELECT id, sender_role, conteudo, tipo, created_at
           FROM public.dashdriver_support_messages
           WHERE ticket_id = $1
           ORDER BY created_at ASC`,
          [ticket_id]
        );
        return res.status(200).json({ messages: rMsgs.rows });
      }

      // Lista todos os tickets do usuário
      const rTickets = await client.query(
        `SELECT id, titulo, status, ticket_number, assigned_to, created_at, updated_at
         FROM public.dashdriver_support
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [user_id]
      );
      return res.status(200).json({ tickets: rTickets.rows });
    } catch (err) {
      console.error('[support/GET]', err.message);
      return res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  }

  // ── POST: criar ticket OU enviar mensagem ─────────────────────────────
  if (req.method !== 'POST') return res.status(405).end();

  const { titulo, mensagem, conteudo, tipo = 'text', ticket_id } = req.body || {};

  try {
    // ── Adicionar mensagem em ticket existente ────────────────────────────
    if (ticket_id) {
      const msg = (conteudo || mensagem || '').trim();
      if (!msg) return res.status(400).json({ error: 'conteudo obrigatório' });

      // Verifica que ticket pertence ao usuário e não está resolvido
      const rCheck = await client.query(
        `SELECT id, status FROM public.dashdriver_support WHERE id = $1 AND user_id = $2`,
        [ticket_id, user_id]
      );
      if (!rCheck.rows.length)
        return res.status(404).json({ error: 'Ticket não encontrado' });
      if (rCheck.rows[0].status === 'resolved')
        return res.status(403).json({ error: 'Ticket já resolvido. Abra um novo chamado.' });

      // Insere mensagem (sem mudar status — só admin muda status)
      // Imagens base64 podem ter 100k+ chars — sem limite para tipo=image
      const conteudoSalvo = tipo === 'image' ? msg : msg.substring(0, 4000);
      const r = await client.query(
        `INSERT INTO public.dashdriver_support_messages (ticket_id, sender_role, conteudo, tipo)
         VALUES ($1, 'user', $2, $3)
         RETURNING id, created_at`,
        [ticket_id, conteudoSalvo, tipo]
      );

      // Atualiza updated_at do ticket
      await client.query(
        `UPDATE public.dashdriver_support SET updated_at = now() WHERE id = $1`,
        [ticket_id]
      );

      return res.status(200).json({
        ok: true,
        message_id: r.rows[0].id,
        created_at: r.rows[0].created_at,
      });
    }

    // ── Criar novo ticket ─────────────────────────────────────────────────
    if (!titulo || !mensagem)
      return res.status(400).json({ error: 'titulo e mensagem são obrigatórios' });

    const rTicket = await client.query(
      `INSERT INTO public.dashdriver_support (titulo, mensagem, user_id, status)
       VALUES ($1, $2, $3, 'open')
       RETURNING id, ticket_number, created_at`,
      [titulo.substring(0, 200), mensagem.substring(0, 2000), user_id]
    );

    const ticket = rTicket.rows[0];

    // Primeira mensagem
    await client.query(
      `INSERT INTO public.dashdriver_support_messages (ticket_id, sender_role, conteudo, tipo)
       VALUES ($1, 'user', $2, 'text')`,
      [ticket.id, mensagem.substring(0, 2000)]
    );

    return res.status(200).json({
      ok: true,
      ticket_id: ticket.id,
      ticket_number: ticket.ticket_number,
    });
  } catch (err) {
    console.error('[support/POST]', err.message);
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};
