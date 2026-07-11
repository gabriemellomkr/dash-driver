/**
 * DashDriver — Resumo Semanal por WhatsApp (módulo)
 *
 * Chamado pelo cron diário (api/cron-resumo.js) aos domingos. Para cada usuário
 * com WhatsApp cadastrado, envia o fechamento da semana (seg→dom) com ganhos,
 * gastos, lucro, km, horas e melhor dia — e comparação com a semana anterior.
 * Quem não rodou recebe uma mensagem de incentivo.
 *
 * Arquivo prefixado com "_" → não vira função serverless (apenas um módulo),
 * por isso não conta no limite de 12 funções do plano Hobby.
 *
 * Lucro segue a MESMA fórmula do app (dashboard.js):
 *   receita = Σ (plataforma='InDriver' E bruto>0 ? bruto : liquido)
 *   lucro   = receita − abastecimentos − outras_despesas
 */
const pool = require('./admin/_db');

const EVOLUTION_URL      = process.env.EVOLUTION_URL;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;
const EVOLUTION_KEY      = process.env.EVOLUTION_KEY;

const BRL = v => 'R$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const onlyDate = s => (s || '').slice(0, 10);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Envio via Evolution API (nome da instância pode ter espaço → encode) ─────
async function sendWhatsApp(number, text) {
  if (!EVOLUTION_URL || !EVOLUTION_INSTANCE || !EVOLUTION_KEY) return false;
  const n = (number || '').replace(/\D/g, '');
  if (n.length < 10) return false;
  try {
    const r = await fetch(
      `${EVOLUTION_URL}/message/sendText/${encodeURIComponent(EVOLUTION_INSTANCE)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_KEY },
        body: JSON.stringify({ number: n, text }),
      }
    );
    return r.ok;
  } catch (e) {
    console.warn('[cron-semanal] whatsapp falhou:', e.message);
    return false;
  }
}

// ─── Agrega as métricas de um conjunto de linhas dentro de um período ─────────
function aggregate(corridas, abast, desp, jornadas, ini, fim) {
  const inPeriod = d => { const x = onlyDate(d); return x >= ini && x <= fim; };

  let receita = 0, km = 0, n = 0;
  const porDia = {};
  for (const c of corridas) {
    if (!inPeriod(c.data)) continue;
    const r = (c.plataforma === 'InDriver' && Number(c.bruto) > 0) ? Number(c.bruto) : Number(c.liquido || 0);
    receita += r;
    km      += Number(c.km || 0);
    n       += 1;
    const dia = onlyDate(c.data);
    porDia[dia] = (porDia[dia] || 0) + r;
  }

  const gastos = abast.filter(a => inPeriod(a.data)).reduce((s, a) => s + Number(a.valor || 0), 0)
               + desp.filter(d => inPeriod(d.data)).reduce((s, d) => s + Number(d.valor || 0), 0);

  let minutos = 0;
  for (const j of jornadas) {
    if (!inPeriod(j.data) || !j.inicio || !j.fim) continue;
    const [hi, mi] = j.inicio.split(':').map(Number);
    const [hf, mf] = j.fim.split(':').map(Number);
    const diff = (hf * 60 + mf) - (hi * 60 + mi);
    if (diff > 0) minutos += diff;
  }

  // Melhor dia (maior receita)
  let bestDay = null;
  for (const [dia, val] of Object.entries(porDia)) {
    if (!bestDay || val > bestDay.receita) bestDay = { dia, receita: val };
  }
  if (bestDay) {
    bestDay.label = new Date(bestDay.dia + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' });
  }

  return { receita, km, n, gastos, lucro: receita - gastos, minutos, bestDay };
}

function fmtDM(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function buildFull(nome, thisW, prevW, ini, fim) {
  const first = (nome || '').trim().split(' ')[0] || 'motorista';

  let comp = '';
  if (prevW.n > 0 && prevW.lucro !== 0) {
    const delta = (thisW.lucro - prevW.lucro) / Math.abs(prevW.lucro) * 100;
    const arrow = delta >= 0 ? '📈' : '📉';
    const sign  = delta >= 0 ? '+' : '';
    comp = `  ${arrow} ${sign}${delta.toFixed(0)}% vs semana passada`;
  }

  let horas = '';
  if (thisW.minutos > 0) {
    const h = Math.floor(thisW.minutos / 60);
    const m = thisW.minutos % 60;
    horas = `⏱️ ${h}h${m > 0 ? m + 'min' : ''} na rua\n`;
  }

  const best = thisW.bestDay
    ? `🏆 Melhor dia: ${thisW.bestDay.label} (${BRL(thisW.bestDay.receita)})\n`
    : '';

  return `🏍️ *Resumo da sua semana — DashDriver*\n\n` +
    `Fala, ${first}! Fechamento de ${fmtDM(ini)} a ${fmtDM(fim)}:\n\n` +
    `📊 *${thisW.n} corrida${thisW.n !== 1 ? 's' : ''}* · ${Math.round(thisW.km)} km rodados\n` +
    `💰 Ganhos: *${BRL(thisW.receita)}*\n` +
    `⛽ Gastos: ${BRL(thisW.gastos)}\n` +
    `✅ Lucro: *${BRL(thisW.lucro)}*${comp}\n` +
    horas + best +
    `\nBora pra cima essa semana! 🚀`;
}

function buildNudge(nome) {
  const first = (nome || '').trim().split(' ')[0] || 'motorista';
  return `🏍️ *DashDriver*\n\n` +
    `Fala, ${first}! Essa semana não registrei nenhuma corrida sua por aqui.\n\n` +
    `Bora voltar a registrar e acompanhar seu lucro de perto? Cada corrida conta! 🚀`;
}

// Roda o resumo semanal. Retorna um objeto-resumo do que foi enviado.
// A autenticação (CRON_SECRET) é responsabilidade de quem chama (cron-resumo.js).
async function runWeeklySummary() {
  // Janela: semana que fecha (seg→dom) e a anterior. Base = hoje em BRT.
  const tz       = 'America/Sao_Paulo';
  const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: tz });
  const dayMs    = 86_400_000;
  const base     = new Date(todayStr + 'T12:00:00Z');
  const fmt      = dt => dt.toISOString().slice(0, 10);
  const thisStart = fmt(new Date(base - 6 * dayMs));
  const thisEnd   = todayStr;
  const prevStart = fmt(new Date(base - 13 * dayMs));
  const prevEnd   = fmt(new Date(base - 7 * dayMs));

  const client = await pool.connect();
  try {
    // Usuários com telefone válido
    const rUsers = await client.query(`
      SELECT user_id, telefone, nome
      FROM public.dashdriver_config
      WHERE telefone IS NOT NULL
        AND length(regexp_replace(telefone, '\\D', '', 'g')) >= 10
    `);
    if (!rUsers.rows.length) {
      return { sent: 0, reason: 'no phones' };
    }

    // Carrega as 2 semanas de dados de uma vez (volume pequeno)
    const [rCorr, rAbast, rDesp, rJorn] = await Promise.all([
      client.query(`SELECT user_id, data, plataforma, bruto, liquido, km
                    FROM public.dashdriver_corridas
                    WHERE substring(data from 1 for 10) BETWEEN $1 AND $2`, [prevStart, thisEnd]),
      client.query(`SELECT user_id, data, valor FROM public.dashdriver_abastecimentos
                    WHERE substring(data from 1 for 10) BETWEEN $1 AND $2`, [prevStart, thisEnd]),
      client.query(`SELECT user_id, data, valor FROM public.dashdriver_outras_despesas
                    WHERE substring(data from 1 for 10) BETWEEN $1 AND $2`, [prevStart, thisEnd]),
      client.query(`SELECT user_id, data, inicio, fim FROM public.dashdriver_jornadas
                    WHERE substring(data from 1 for 10) BETWEEN $1 AND $2`, [prevStart, thisEnd]),
    ]);

    // Indexa por usuário
    const byUser = {};
    const bucket = (uid) => (byUser[uid] ||= { corridas: [], abast: [], desp: [], jornadas: [] });
    rCorr.rows.forEach(r  => bucket(r.user_id).corridas.push(r));
    rAbast.rows.forEach(r => bucket(r.user_id).abast.push(r));
    rDesp.rows.forEach(r  => bucket(r.user_id).desp.push(r));
    rJorn.rows.forEach(r  => bucket(r.user_id).jornadas.push(r));

    // Envia em lotes pequenos: rápido o bastante pra caber no limite de 60s da
    // função mesmo com ~50 usuários, e gentil o bastante pra não tomar ban.
    // (50 usuários ≈ 13 lotes × ~1s ≈ ~15s.)
    const LOTE   = 4;
    const GAP_MS = 500;
    let sent = 0, nudges = 0, failed = 0;

    for (let i = 0; i < rUsers.rows.length; i += LOTE) {
      const slice = rUsers.rows.slice(i, i + LOTE);
      const results = await Promise.all(slice.map(async u => {
        const data  = byUser[u.user_id] || { corridas: [], abast: [], desp: [], jornadas: [] };
        const thisW = aggregate(data.corridas, data.abast, data.desp, data.jornadas, thisStart, thisEnd);
        const prevW = aggregate(data.corridas, data.abast, data.desp, data.jornadas, prevStart, prevEnd);
        const text  = thisW.n > 0
          ? buildFull(u.nome, thisW, prevW, thisStart, thisEnd)
          : buildNudge(u.nome);
        const ok = await sendWhatsApp(u.telefone, text);
        return { ok, isNudge: thisW.n === 0 };
      }));

      for (const r of results) {
        if (r.ok) { sent += 1; if (r.isNudge) nudges += 1; }
        else      { failed += 1; }
      }

      if (i + LOTE < rUsers.rows.length) await sleep(GAP_MS);
    }

    return { ok: true, sent, nudges, failed, total: rUsers.rows.length };
  } catch (err) {
    console.error('[cron-semanal] erro:', err.message);
    return { error: err.message };
  } finally {
    client.release();
  }
}

module.exports = { runWeeklySummary };
