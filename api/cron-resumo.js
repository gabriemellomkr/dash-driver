const webpush = require('web-push');

webpush.setVapidDetails(
  'mailto:gabriel18mello@gmail.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

const SB_URL = process.env.SB_URL;
const SB_KEY = process.env.SB_KEY;

module.exports = async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end();
  }

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

  // Busca corridas de hoje
  const rC = await fetch(
    `${SB_URL}/rest/v1/moto_corridas?select=liquido&data=eq.${today}`,
    { headers: { apikey: SB_KEY } },
  );
  const corridas = await rC.json();

  if (!Array.isArray(corridas) || !corridas.length) {
    return res.status(200).json({ skipped: 'no rides today' });
  }

  // Busca jornadas de hoje para calcular horas trabalhadas
  const rJ = await fetch(
    `${SB_URL}/rest/v1/moto_jornadas?select=inicio,fim&data=eq.${today}`,
    { headers: { apikey: SB_KEY } },
  );
  const jornadas = await rJ.json();

  const total = corridas.reduce((s, c) => s + (c.liquido || 0), 0);
  const n     = corridas.length;
  const totalFmt = total.toFixed(2).replace('.', ',');

  let horasStr = '';
  if (Array.isArray(jornadas) && jornadas.length) {
    const minutos = jornadas.reduce((s, j) => {
      if (!j.inicio || !j.fim) return s;
      const [hi, mi] = j.inicio.split(':').map(Number);
      const [hf, mf] = j.fim.split(':').map(Number);
      const diff = (hf * 60 + mf) - (hi * 60 + mi);
      return s + (diff > 0 ? diff : 0);
    }, 0);
    if (minutos > 0) {
      const h = Math.floor(minutos / 60);
      const m = minutos % 60;
      horasStr = ` · ${h}h${m > 0 ? m + 'min' : ''} trabalhadas`;
    }
  }

  const payload = JSON.stringify({
    title: '📊 Resumo do dia',
    body:  `${n} corrida${n !== 1 ? 's' : ''} · R$ ${totalFmt}${horasStr}`,
    icon:  '/icon-192.png',
    tag:   'resumo-diario',
    url:   '/',
  });

  // Busca subscriptions
  const rS = await fetch(`${SB_URL}/rest/v1/moto_push_subscriptions?select=*`, {
    headers: { apikey: SB_KEY },
  });
  const subs = await rS.json();

  if (!Array.isArray(subs) || !subs.length) {
    return res.status(200).json({ sent: 0, reason: 'no subscriptions' });
  }

  await Promise.allSettled(
    subs.map(s =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
      ),
    ),
  );

  res.status(200).json({ ok: true, n, total });
};
