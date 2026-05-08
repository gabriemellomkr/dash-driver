/**
 * DashDriver - Dashboard
 * KPIs, period selection, and charts.
 */

window.renderDashboard = function() {
  const list = getPeriodData();
  updateKPIs(list);
  updateMeta(list);
  updateJornada();
  updateCharts(list);
};

function getPeriodData() {
  const start = getStartDate();
  const end = getEndDate();
  return APP_STATE.corridas.filter(c => {
    const d = c.data.split('T')[0];
    return d >= start && d <= end;
  });
}

function getStartDate() {
  const today = new Date().toISOString().split('T')[0];
  if (APP_STATE.currentPeriod === 'today') return today;
  if (APP_STATE.currentPeriod === 'yesterday') {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }
  if (APP_STATE.currentPeriod === 'week') {
    const d = new Date(); d.setDate(d.getDate() - d.getDay());
    return d.toISOString().split('T')[0];
  }
  if (APP_STATE.currentPeriod === 'month') return today.slice(0, 8) + '01';
  if (APP_STATE.currentPeriod === 'custom') return document.getElementById('custom-start').value || '2000-01-01';
  return '2000-01-01';
}

function getEndDate() {
  if (APP_STATE.currentPeriod === 'custom') return document.getElementById('custom-end').value || '9999-12-31';
  if (APP_STATE.currentPeriod === 'yesterday') {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }
  return '9999-12-31';
}

function updateKPIs(list) {
  const n = list.length;
  const km = list.reduce((s, c) => s + c.km, 0);
  const receita = list.reduce((s, c) => s + c.liquido, 0);
  const bruto = list.reduce((s, c) => s + c.bruto, 0);
  
  // Expenses (fuel + other)
  const start = getStartDate();
  const end = getEndDate();
  const gas = APP_STATE.abastecimentos
    .filter(a => a.data >= start && a.data <= end)
    .reduce((s, a) => s + a.valor, 0);
  const desp = APP_STATE.despesas
    .filter(d => d.data >= start && d.data <= end)
    .reduce((s, d) => s + d.valor, 0);
  
  const lucro = receita - gas - desp;
  const rpkm = km > 0 ? receita / km : 0;

  document.getElementById('d-corridas').textContent = n;
  document.getElementById('d-km').textContent = km.toFixed(1);
  document.getElementById('d-receita').textContent = utils.formatBRL(receita);
  document.getElementById('d-receita-sub').textContent = `Bruto: ${utils.formatBRL(bruto)}`;
  document.getElementById('d-lucro').textContent = utils.formatBRL(lucro);
  document.getElementById('d-lucro').style.color = lucro >= 0 ? '#4ade80' : '#f87171';
  document.getElementById('d-rpkm').textContent = rpkm.toFixed(2).replace('.', ',');
  document.getElementById('d-gas').textContent = utils.formatBRL(gas);
}

function updateMeta(list) {
  const metaAlvo = CONFIG_DATA.metaDiaria;
  if (!metaAlvo) return;
  
  const receita = list.reduce((s, c) => s + c.liquido, 0);
  const pct = Math.min(100, (receita / metaAlvo) * 100);
  
  const metaCard = document.getElementById('meta-card');
  if (metaCard) {
    metaCard.classList.remove('hidden');
    document.getElementById('meta-bar').style.width = pct + '%';
    document.getElementById('meta-pct').textContent = pct.toFixed(0) + '%';
    document.getElementById('meta-atual').textContent = utils.formatBRL(receita);
  }
}

function updateJornada() {
  const start = getStartDate();
  const end = getEndDate();
  const sessions = APP_STATE.jornadas.filter(j => j.data >= start && j.data <= end);
  
  let totalHours = 0;
  sessions.forEach(s => {
    const [h1, m1] = s.inicio.split(':').map(Number);
    const [h2, m2] = s.fim.split(':').map(Number);
    totalHours += (h2 + m2/60) - (h1 + m1/60);
  });

  const hoje = new Date().toISOString().split('T')[0];
  const sessionsHoje = APP_STATE.jornadas.filter(j => j.data === hoje);
  let hoursHoje = 0;
  sessionsHoje.forEach(s => {
    const [h1, m1] = s.inicio.split(':').map(Number);
    const [h2, m2] = s.fim.split(':').map(Number);
    hoursHoje += (h2 + m2/60) - (h1 + m1/60);
  });

  document.getElementById('d-jornada-hoje').textContent = hoursHoje.toFixed(1) + 'h';
  document.getElementById('d-jornada-periodo').textContent = totalHours.toFixed(1) + 'h';
}

function updateCharts(list) {
  // Chart.js implementation here...
  // (Simplified for now, will add full logic if requested)
}

window.selectPeriod = function(p, el) {
  APP_STATE.currentPeriod = p;
  document.querySelectorAll('.period-chip').forEach(c => {
    c.classList.remove('border-blue-500', 'bg-blue-500/10', 'text-blue-400');
    c.classList.add('border-outline-variant', 'text-outline');
  });
  el.classList.add('border-blue-500', 'bg-blue-500/10', 'text-blue-400');
  el.classList.remove('border-outline-variant', 'text-outline');
  
  const customRange = document.getElementById('custom-range');
  if (p === 'custom') customRange.classList.remove('hidden');
  else customRange.classList.add('hidden');
  
  renderDashboard();
};
