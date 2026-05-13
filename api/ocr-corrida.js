/**
 * DashDriver — OCR de Corrida
 * Recebe imagem base64 e extrai dados da corrida via Claude Vision.
 *
 * POST /api/ocr-corrida
 * Body: { image_base64: string, mime_type: string }
 * Response: { plataforma, data, km, bruto, liquido, pagamento, tipo, confianca }
 */

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { image_base64, mime_type = 'image/jpeg' } = req.body || {};
  if (!image_base64) return res.status(400).json({ error: 'image_base64 required' });

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const prompt = `Você está analisando um print de tela de um app de corrida brasileiro (Uber, 99 ou InDriver).
Extraia as informações e retorne APENAS um JSON válido, sem markdown, sem texto extra.

Formato esperado:
{
  "plataforma": "Uber" | "99" | "InDriver" | null,
  "data": "YYYY-MM-DD" | null,
  "km": number | null,
  "bruto": number | null,
  "liquido": number | null,
  "pagamento": "App" | "Pix" | "Dinheiro" | null,
  "tipo": "normal" | "cancel",
  "confianca": "alta" | "media" | "baixa"
}

Regras por plataforma:

99 (app amarelo):
- Campo "Valor bruto" ou "Corrida" → bruto
- Campo "Sua parte" ou "Ganhos" → liquido
- "Cartão" ou "Pagamento online" → pagamento: "App"
- "Pix" → pagamento: "Pix"
- "Dinheiro" → pagamento: "Dinheiro"

Uber:
- O valor principal mostrado JÁ É o líquido (a uber desconta antes de mostrar)
- bruto: null (não é mostrado — exceto se houver campo "Valor da viagem" separado)
- "Cartão" → pagamento: "App"
- "Pix" → pagamento: "Pix"

InDriver:
- Valor único mostrado = liquido (bruto = liquido, sem intermediação pelo app)
- A taxa InDriver é descontada do saldo pré-carregado
- "InDriver Pay", "pagamento online" → pagamento: "App" (mesmo assim é direto)
- "Pix" ou "Dinheiro" → conforme mostrado

Cancelamento:
- Se aparecer "Cancelamento", "Viagem cancelada", "Taxa de deslocamento" → tipo: "cancel"
- liquido = taxa cobrada ao passageiro, bruto = mesmo valor
- Caso contrário → tipo: "normal"

Distância:
- Extrair valor numérico em km (ex: "3,2 km" → 3.2, "5.1km" → 5.1)

Data:
- Converter formato brasileiro (ex: "12/05/2025" → "2025-05-12")
- Se mostrar só hora sem data, usar null

Confiança:
- "alta": todos os campos principais identificados com certeza
- "media": plataforma identificada mas algum valor pode estar incerto
- "baixa": imagem não é de corrida ou dados muito incompletos

Retorne APENAS o JSON, nada mais.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mime_type, data: image_base64 }
            },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', errText);
      return res.status(502).json({ error: 'Vision API error', detail: errText.slice(0, 300) });
    }

    const apiData = await response.json();
    const text = apiData.content?.[0]?.text || '';

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
