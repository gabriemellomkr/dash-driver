const {validOCRImage} = require('./_validation');
/**
 * DashDriver — OCR de Corrida
 * Recebe imagem base64 e extrai dados da corrida via GPT-4o-mini Vision.
 *
 * POST /api/ocr-corrida
 * Body: { image_base64: string, mime_type: string, user_id?: string }
 * Response: { plataforma, data, km, bruto, liquido, pagamento, tipo, confianca }
 */

const pool = require('./admin/_db');
const { verifyUser } = require('./_verify-user');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  // Exige usuário autenticado — evita abuso de custo na OpenAI por terceiros
  const claims = await verifyUser(req);
  if (!claims) return res.status(401).json({ error: 'Não autenticado' });
  const user_id = claims.sub;

  const { image_base64, mime_type = 'image/jpeg' } = req.body || {};
  if (!validOCRImage(image_base64,mime_type)) return res.status(400).json({ error: 'Envie um print PNG, JPEG ou WebP de até 2 MB.' });
  let quota;
  try {
    quota = await require('./_ocr-quota').reserveOCR(user_id);
    if (quota.status===403) return res.status(403).json({error:'É necessário ter acesso ativo para importar prints.'});
    if (quota.status===429) return res.status(429).json({error:'Limite de 60 prints por hora. Tente mais tarde.'});
  } catch {return res.status(503).json({error:'Não foi possível verificar seu acesso. Tente novamente.'});}

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
      signal: AbortSignal.timeout(20000),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        store: false,
        response_format: {type:'json_object'},
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
      console.error('OpenAI API error:', response.status);
      return res.status(502).json({ error: 'Não foi possível ler o print. Tente novamente em instantes.' });
    }

    const apiData = await response.json();
    const text = apiData.choices?.[0]?.message?.content || '';

    // Registra uso de tokens no banco — deve ser awaited antes de responder.
    // Em Vercel serverless, Promises não-awaited são canceladas quando a função retorna.
    const tokensIn  = apiData.usage?.prompt_tokens     || 0;
    const tokensOut = apiData.usage?.completion_tokens || 0;
    await pool.query('UPDATE public.dashdriver_token_usage SET tokens_in=$2,tokens_out=$3 WHERE id=$1', [quota.id,tokensIn,tokensOut]);

    // Extrai o JSON da resposta
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(422).json({ error: 'Não foi possível identificar os dados. Tente outro print.' });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const result = {};
    for (const key of ['km','bruto','liquido']) result[key] = typeof parsed[key]==='number' && Number.isFinite(parsed[key]) && parsed[key]>=0 ? parsed[key] : null;
    result.plataforma = ['Uber','99','InDriver'].includes(parsed.plataforma) ? parsed.plataforma : null;
    result.pagamento = ['App','Pix','Dinheiro'].includes(parsed.pagamento) ? parsed.pagamento : null;
    result.data = typeof parsed.data==='string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.data) ? parsed.data : null;
    result.tipo = parsed.tipo==='cancel' ? 'cancel' : 'normal';
    result.confianca = ['alta','media'].includes(parsed.confianca) && result.plataforma && result.liquido!==null ? parsed.confianca : 'baixa';
    return res.status(200).json(result);

  } catch (e) {
    console.error('OCR handler error:', e.name);
    return res.status(500).json({ error: 'Falha na leitura do print. Tente novamente.' });
  }
};
