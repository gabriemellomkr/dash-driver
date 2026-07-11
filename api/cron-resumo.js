const crypto  = require('crypto');
const webpush = require('web-push');
const { runWeeklySummary } = require('./_weekly-summary');

webpush.setVapidDetails(
  'mailto:gabriel18mello@gmail.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

const SB_URL = process.env.SB_URL;
const SB_KEY = process.env.SB_KEY;

module.exports = async function handler(req, res) {
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET || ''}`);
  const received = Buffer.from(req.headers.authorization || '');
  const isValid  = expected.length === received.length &&
    crypto.timingSafeEqual(expected, received);
  if (!isValid) return res.status(401).end();

  // Gatilho manual do resumo semanal (operacional/teste), independente do dia.
  // Ex.: GET /api/cron-resumo?run=weekly com o Bearer do CRON_SECRET.
  if ((req.query?.run || '') === 'weekly') {
    const weekly = await runWeeklySummary();
    return res.status(200).json({ manual: true, weekly });
  }

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

  // ── Resumo SEMANAL por WhatsApp — apenas aos domingos (BRT) ──────────────
  // Rodamos aqui dentro do cron diário para não criar uma 2ª função serverless
  // (plano Hobby limita a 12). Independe das push subscriptions abaixo.
  let weekly = null;
  if (new Date(today + 'T12:00:00Z').getUTCDay() === 0) {
    try { weekly = await runWeeklySummary(); }
    catch (e) { console.error('[cron] resumo semanal falhou:', e.message); weekly = { error: e.message }; }
  }

  // Corridas e jornadas de hoje — COM user_id para segmentar por motorista
  const [rC, rJ, rS] = await Promise.all([
    fetch(`${SB_URL}/rest/v1/dashdriver_corridas?select=user_id,liquido&data=eq.${today}`, { headers: { apikey: SB_KEY } }),
    fetch(`${SB_URL}/rest/v1/dashdriver_jornadas?select=user_id,inicio,fim&data=eq.${today}`, { headers: { apikey: SB_KEY } }),
    fetch(`${SB_URL}/rest/v1/dashdriver_push_subscriptions?select=endpoint,p256dh,auth,user_id`, { headers: { apikey: SB_KEY } }),
  ]);
  const corridas = await rC.json();
  const jornadas = await rJ.json();
  const subs     = await rS.json();

  if (!Array.isArray(subs) || !subs.length) {
    return res.status(200).json({ daily: { sent: 0, reason: 'no subscriptions' }, weekly });
  }

  // Agrega por usuário: total líquido, nº de corridas e minutos trabalhados
  const byUser = {};
  for (const c of (Array.isArray(corridas) ? corridas : [])) {
    if (!c.user_id) continue;
    (byUser[c.user_id] ||= { total: 0, n: 0, minutos: 0 });
    byUser[c.user_id].total += c.liquido || 0;
    byUser[c.user_id].n     += 1;
  }
  for (const j of (Array.isArray(jornadas) ? jornadas : [])) {
    if (!j.user_id || !j.inicio || !j.fim) continue;
    const [hi, mi] = j.inicio.split(':').map(Number);
    const [hf, mf] = j.fim.split(':').map(Number);
    const diff = (hf * 60 + mf) - (hi * 60 + mi);
    if (diff > 0) { (byUser[j.user_id] ||= { total: 0, n: 0, minutos: 0 }); byUser[j.user_id].minutos += diff; }
  }

  // Cada inscrição recebe SOMENTE o resumo do seu próprio dono
  const results = await Promise.allSettled(subs.map(s => {
    const u = s.user_id ? byUser[s.user_id] : null;
    if (!u || u.n === 0) return Promise.resolve(null); // sem corridas hoje → não notifica

    const totalFmt = u.total.toFixed(2).replace('.', ',');
    let horasStr = '';
    if (u.minutos > 0) {
      const h = Math.floor(u.minutos / 60);
      const m = u.minutos % 60;
      horasStr = ` · ${h}h${m > 0 ? m + 'min' : ''} trabalhadas`;
    }
    const payload = JSON.stringify({
      title: '📊 Resumo do dia',
      body:  `${u.n} corrida${u.n !== 1 ? 's' : ''} · R$ ${totalFmt}${horasStr}`,
      icon:  '/icon-192.png',
      tag:   'resumo-diario',
      url:   '/',
    });
    return webpush.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      payload,
    );
  }));

  const sent = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
  res.status(200).json({ daily: { sent, users: Object.keys(byUser).length }, weekly });
};
