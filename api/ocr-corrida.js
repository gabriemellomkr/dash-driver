/**
 * DashDriver — OCR de Corrida
 * Recebe imagem base64 e extrai dados da corrida via GPT-4o-mini Vision.
 *
 * POST /api/ocr-corrida
 * Body: { image_base64: string, mime_type: string, user_id?: string }
 * Response: { plataforma, data, km, bruto, liquido, pagamento, tipo, confianca }
 */

const pool = require('./admin/_db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { image_base64, mime_type = 'image/jpeg', user_id } = req.body || {};
  if (!image_base64) return res.status(400).json({ error: 'image_base64 required' });

  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });

  const prompt = `Print de app de corrida brasileiro. Retorne APENAS JSON válido, sem markdown.

{"plataforma":"Uber"|"99"|"InDriver"|null,"data":"YYYY-MM-DD"|null,"km":number|null,"bruto":number|null,"liquido":number|null,"pagamento":"App"|"Pix"|"Dinheiro"|null,"tipo":"normal"|"cancel","confianca":"alta"|"media"|"baixa"}

IDENTIFICAÇÃO (olhe o design e textos):
- InDriver: seções "Meus ganhos", "Eu recebi", "Paguei", ícone coração verde ♥, "Total recebido", "Total pago"
- 99: texto "Recebido pela 99", seções "Seus ganhos"/"Você ganhou" e "Pago pelo passageiro"
- Uber: texto "Uber", seções "Detalhes do ganho", design minimalista preto/branco

VALORES POR PLATAFORMA:

InDriver ("Meus ganhos" + "Eu recebi" + "Paguei"):
- bruto = valor em "Total recebido" (seção "Eu recebi") — o que o passageiro pagou
- liquido = valor em "Meus ganhos" (o que o motorista efetivamente recebeu, já descontada a taxa do saldo)
- "Pagamento on-line" ou "Online" → pagamento: "App"
- "Pix" → "Pix", "Dinheiro" → "Dinheiro"

99 ("Recebido pela 99"):
- bruto = Total da seção "Pago pelo passageiro"
- liquido = Total da seção "Seus ganhos" ou valor de "Você ganhou" no topo
- NÃO use "Você ganhou" como bruto — é o líquido
- "Online"/"Cartão" → "App", "Pix" → "Pix", "Dinheiro" → "Dinheiro"

Uber:
- liquido = valor principal mostrado (Uber já desconta antes)
- bruto = null
- "Cartão" → "App", "Pix" → "Pix"

Cancelamento: "Cancelamento"/"Taxa de deslocamento" → tipo:"cancel", liquido=taxa, bruto=taxa
Distância: número decimal em km ("3,2 km" → 3.2)
Data: formato BR → YYYY-MM-DD. Só hora sem data → null

Retorne APENAS o JSON.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mime_type};base64,${image_base64}`,
                detail: 'low',
              }
            },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI API error:', errText);
      return res.status(502).json({ error: 'Vision API error', detail: errText.slice(0, 300) });
    }

    const apiData = await response.json();
    const text = apiData.choices?.[0]?.message?.content || '';

    // Registra uso de tokens no banco (não bloqueia a resposta em caso de erro)
    const tokensIn  = apiData.usage?.prompt_tokens     || 0;
    const tokensOut = apiData.usage?.completion_tokens || 0;
    if (user_id && (tokensIn + tokensOut) > 0) {
      pool.connect().then(client => {
        client.query(
          `INSERT INTO public.dashdriver_token_usage (user_id, feature, tokens_in, tokens_out)
           VALUES ($1::uuid, 'ocr', $2, $3)`,
          [user_id, tokensIn, tokensOut]
        ).catch(err => console.error('[ocr] token_usage insert:', err.message))
         .finally(() => client.release());
      }).catch(() => {});
    }

    // Extrai o JSON da resposta
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(422).json({ error: 'Resposta inesperada da API', raw: text.slice(0, 200) });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json(parsed);

  } catch (e) {
    console.error('OCR handler error:', e);
    return res.status(500).json({ error: e.message });
  }
};
