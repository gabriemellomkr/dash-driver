const pool = require('./admin/_db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET ?user_id=xxx → ticket ativo + mensagens ──────────────────────────
  if (req.method === 'GET') {
    const user_id = req.query?.user_id;
    if (!user_id) return res.status(400).json({ error: 'user_id obrigatório' });

    let client;
    try {
      client = await pool.connect();

      // Ticket mais recente não-resolvido
      const rTicket = await client.query(
        `SELECT id, titulo, status, ticket_number, created_at
         FROM public.dashdriver_support
         WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 1`,
        [user_id]
      );

      const ticket = rTicket.rows[0] || null;
      if (!ticket) return res.status(200).json({ ticket: null, messages: [] });

      // Mensagens do ticket
      const rMsgs = await client.query(
        `SELECT id, sender_role, conteudo, tipo, created_at
         FROM public.dashdriver_support_messages
         WHERE ticket_id = $1
         ORDER BY created_at ASC`,
        [ticket.id]
      );

      return res.status(200).json({ ticket, messages: rMsgs.rows });
    } catch (err) {
      console.error('[support/GET]', err.message);
      return res.status(500).json({ error: err.message });
    } finally {
      if (client) client.release();
    }
  }

  // ── POST → criar ticket OU enviar mensagem ────────────────────────────────
  if (req.method !== 'POST') return res.status(405).end();

  const { titulo, mensagem, conteudo, tipo = 'text', user_id, ticket_id } = req.body || {};

  let client;
  try {
    client = await pool.connect();

    // ── Adicionar mensagem em ticket existente ──────────────────────────────
    if (ticket_id) {
      const msg = (conteudo || mensagem || '').trim();
      if (!msg) return res.status(400).json({ error: 'conteudo obrigatório' });
      if (!user_id) return res.status(400).json({ error: 'user_id obrigatório' });

      // Verifica que ticket pertence ao usuário e não está resolvido
      const rCheck = await client.query(
        `SELECT id, status FROM public.dashdriver_support WHERE id = $1 AND user_id = $2`,
        [ticket_id, user_id]
      );
      if (!rCheck.rows.length) return res.status(404).json({ error: 'Ticket não encontrado' });
      if (rCheck.rows[0].status === 'resolved') return res.status(403).json({ error: 'Ticket já resolvido. Abra um novo chamado.' });

      // Atualiza status para in_progress ao receber nova mensagem do usuário
      await client.query(
        `UPDATE public.dashdriver_support SET status = 'in_progress', updated_at = now() WHERE id = $1 AND status = 'open'`,
        [ticket_id]
      );

      const r = await client.query(
        `INSERT INTO public.dashdriver_support_messages (ticket_id, sender_role, conteudo, tipo)
         VALUES ($1, 'user', $2, $3)
         RETURNING id, created_at`,
        [ticket_id, msg.substring(0, 2000), tipo]
      );

      return res.status(200).json({ ok: true, message_id: r.rows[0].id, created_at: r.rows[0].created_at });
    }

    // ── Criar novo ticket ───────────────────────────────────────────────────
    if (!titulo || !mensagem) return res.status(400).json({ error: 'titulo e mensagem são obrigatórios' });
    if (!user_id) return res.status(400).json({ error: 'user_id obrigatório' });

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

    return res.status(200).json({ ok: true, ticket_id: ticket.id, ticket_number: ticket.ticket_number });
  } catch (err) {
    console.error('[support/POST]', err.message);
    return res.status(500).json({ error: err.message });
  } finally {
    if (client) client.release();
  }
};
