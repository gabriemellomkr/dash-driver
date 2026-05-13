/**
 * DashDriver — OCR de Corrida
 * Recebe imagem base64 e extrai dados da corrida via GPT-4o-mini Vision.
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

  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });

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

99 (app amarelo, texto "Recebido pela 99" ou "99" visível):
- A tela tem DUAS seções separadas de valor — leia com atenção:
  * Seção "Pago pelo passageiro" ou "Pago por esta corrida" → esse Total é o BRUTO
  * Seção "Seus ganhos" ou "Você ganhou" → esse Total é o LÍQUIDO
- NÃO use o valor destacado no topo ("Você ganhou R$X") como bruto — ele é o líquido
- "Online" ou "Cartão" ou "Pagamento online" → pagamento: "App"
- "Pix" → pagamento: "Pix"
- "Dinheiro" → pagamento: "Dinheiro"

Uber:
- O valor principal mostrado JÁ É o líquido (a Uber desconta antes de exibir)
- bruto: null (não é mostrado — exceto se houver campo "Valor da viagem" separado)
- "Cartão" → pagamento: "App"
- "Pix" → pagamento: "Pix"

InDriver:
- Valor único mostrado = liquido (bruto = liquido, sem intermediação pelo app)
- A taxa InDriver é descontada do saldo pré-carregado
- "InDriver Pay", "pagamento online" → pagamento: "App"
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
                detail: 'high',
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
