/* DashDriver — Proxy seguro para Evolution API (WhatsApp Layer 3)
   Env vars necessárias no Vercel:
     EVOLUTION_URL      = http://api.nucleocriativo.com.br
     EVOLUTION_INSTANCE = Whats-Dashdriver
     EVOLUTION_KEY      = <instance apikey>
*/

const { verifyUser } = require('./_verify-user');

const EVOLUTION_URL      = process.env.EVOLUTION_URL;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;
const EVOLUTION_KEY      = process.env.EVOLUTION_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  // Exige usuário autenticado — evita uso da instância Evolution por terceiros (spam/ban)
  if (!(await verifyUser(req))) return res.status(401).json({ error: 'Não autenticado' });

  if (!EVOLUTION_URL || !EVOLUTION_INSTANCE || !EVOLUTION_KEY) {
    return res.status(500).json({ error: 'Evolution API não configurada (env vars ausentes)' });
  }

  const { number, text } = req.body || {};
  if (!number || !text) {
    return res.status(400).json({ error: 'number e text são obrigatórios' });
  }

  // Remove tudo que não é dígito, garante código do país
  const cleaned = number.replace(/\D/g, '');
  if (cleaned.length < 10) {
    return res.status(400).json({ error: 'Número inválido' });
  }

  try {
    const r = await fetch(
      `${EVOLUTION_URL}/message/sendText/${encodeURIComponent(EVOLUTION_INSTANCE)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_KEY,
        },
        body: JSON.stringify({ number: cleaned, text }),
      }
    );

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      console.error('Evolution API error:', r.status, data);
      return res.status(r.status).json({ error: 'Falha ao enviar WhatsApp', detail: data });
    }

    return res.status(200).json({ ok: true, messageId: data?.key?.id });
  } catch (err) {
    console.error('whatsapp proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
};
