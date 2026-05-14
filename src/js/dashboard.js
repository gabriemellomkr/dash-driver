/**
 * DashDriver - Dashboard
 * KPIs, metas (diária/semanal/mensal), saldo InDriver, radar de taxas, últimas corridas e gráficos.
 */

let platChartInstance = null;
let pagChartInstance  = null;

window.renderDashboard = function() {
  const list = getPeriodData();
  updateKPIs(list);
  updateMetas(list);
  updateIndriverSaldo();
  updateTaxaRadar(list);
  updateJornada();
  updateUltimasCorridas(list);
  updateCharts(list);
};

/* ─── PERÍODO ─────────────────────────────────────── */
function getPeriodData() {
  const start = getStartDate();
  const end   = getEndDate();
  return APP_STATE.corridas.filter(c => {
    const d = (c.data || '').split('T')[0];
    return d >= start && d <= end;
  });
}

function getStartDate() {
  const today = new Date().toLocaleDateString('sv-SE');
  const p = APP_STATE.currentPeriod;
  if (p === 'today')     return today;
  if (p === 'yesterday') { const d = new Date(); d.setDate(d.getDate()-1); return d.toLocaleDateString('sv-SE'); }
  if (p === 'week')      { const d = new Date(); d.setDate(d.getDate()-d.getDay()); return d.toLocaleDateString('sv-SE'); }
  if (p === 'month')     return today.slice(0,8)+'01';
  if (p === 'custom')    return document.getElementById('custom-start')?.value || '2000-01-01';
  return '2000-01-01';
}

function getEndDate() {
  const p = APP_STATE.currentPeriod;
  if (p === 'yesterday') { const d = new Date(); d.setDate(d.getDate()-1); return d.toLocaleDateString('sv-SE'); }
  if (p === 'custom')    return document.getElementById('custom-end')?.value   || '9999-12-31';
  return '9999-12-31';
}

/* ─── HELPER: receita real por corrida ───────────────
   InDriver: passageiro paga bruto direto ao motorista.
   A taxa sai do saldo pré-carregado — não é desconto da receita.
   Uber/99: motorista recebe só o líquido após fee da plataforma. */
function receitaCorrida(c) {
  if (c.plat === 'InDriver' && c.bruto > 0) return c.bruto;
  return c.liquido || 0;
}

function somaReceita(corridas) {
  return corridas.reduce((s, c) => s + receitaCorrida(c), 0);
}

/* ─── KPIs ────────────────────────────────────────── */
function updateKPIs(list) {
  const n       = list.length;
  const km      = list.reduce((s,c) => s + (c.km||0), 0);
  const receita = somaReceita(list);
  // Taxas de plataforma pagas (apenas Uber/99 — InDriver é saldo separado)
  const taxasPlat = list.reduce((s,c) => {
    if (c.plat === 'InDriver') return s;
    return s + Math.max(0, (c.bruto||0) - (c.liquido||0));
  }, 0);

  const start = getStartDate(), end = getEndDate();
  const gas  = APP_STATE.abastecimentos.filter(a => (a.data||'') >= start && (a.data||'') <= end).reduce((s,a) => s+(a.valor||0), 0);
  const desp = APP_STATE.despesas.filter(d => (d.data||'') >= start && (d.data||'') <= end).reduce((s,d) => s+(d.valor||0), 0);

  const lucro = receita - gas - desp;
  const rpkm  = km > 0 ? receita/km : 0;

  document.getElementById('d-corridas').textContent = n;
  document.getElementById('d-km').textContent       = km.toFixed(1);
  document.getElementById('d-receita').textContent  = utils.formatBRL(receita);
  // Sub-linha: mostra taxas Uber/99 somente se existirem; InDriver não tem taxa aqui
  const elSub = document.getElementById('d-receita-sub');
  if (elSub) elSub.textContent = taxasPlat > 0 ? `Taxas Uber/99: -${utils.formatBRL(taxasPlat)}` : '';
  document.getElementById('d-lucro').textContent    = utils.formatBRL(lucro);
  document.getElementById('d-lucro').style.color    = lucro >= 0 ? '#4ade80' : '#f87171';
  document.getElementById('d-rpkm').textContent     = rpkm.toFixed(2).replace('.', ',');
  document.getElementById('d-gas').textContent      = utils.formatBRL(gas);
  const elDesp = document.getElementById('d-outros-gastos');
  if (elDesp) elDesp.textContent = utils.formatBRL(desp);
}

/* ─── METAS (Diária / Semanal / Mensal) ───────────── */
function updateMetas(list) {
  const today = new Date().toLocaleDateString('sv-SE');

  // Receita total do dia de hoje
  const recDia  = somaReceita(APP_STATE.corridas
    .filter(c => (c.data||'').split('T')[0] === today));

  // Receita da semana
  const inicioSemana = (() => { const d=new Date(); d.setDate(d.getDate()-d.getDay()); return d.toLocaleDateString('sv-SE'); })();
  const recSemana = somaReceita(APP_STATE.corridas
    .filter(c => (c.data||'').split('T')[0] >= inicioSemana));

  // Receita do mês
  const inicioMes = today.slice(0,8)+'01';
  const recMes = somaReceita(APP_STATE.corridas
    .filter(c => (c.data||'').split('T')[0] >= inicioMes));

  const mD = CONFIG_DATA.metaDiaria  || 0;
  const mS = CONFIG_DATA.metaSemanal || 0;
  const mM = CONFIG_DATA.metaMensal  || 0;

  renderMeta('meta-d', recDia,   mD, '#3b82f6');
  renderMeta('meta-s', recSemana, mS, '#a855f7');
  renderMeta('meta-m', recMes,   mM, '#f59e0b');
}

function renderMeta(prefix, atual, meta, cor) {
  const pct = meta > 0 ? Math.min(100, (atual/meta)*100) : 0;
  const el_pct  = document.getElementById(prefix+'-pct');
  const el_bar  = document.getElementById(prefix+'-bar');
  const el_at   = document.getElementById(prefix+'-atual');
  const el_val  = document.getElementById(prefix+'-valor');
  if (!el_pct) return;
  el_pct.textContent  = pct.toFixed(0)+'%';
  el_bar.style.width  = pct+'%';
  el_bar.style.background = pct >= 100 ? '#4ade80' : cor;
  el_at.textContent   = utils.formatBRL(atual);
  el_val.textContent  = meta > 0 ? `Meta: ${utils.formatBRL(meta)}` : 'Meta: não configurada';
}

/* ─── SALDO INDRIVER ──────────────────────────────── */
function updateIndriverSaldo() {
  // Calcula saldo real: soma das recargas menos taxas das corridas InDriver
  const recargas = APP_STATE.despesas
    .filter(d => d.categoria === 'recarga_indriver')
    .reduce((s, d) => s + (d.valor || 0), 0);
  const taxas = APP_STATE.corridas
    .filter(c => c.plat === 'InDriver' && c.bruto > c.liquido)
    .reduce((s, c) => s + (c.bruto - c.liquido), 0);
  const saldo = recargas - taxas;

  // Sincroniza com APP_STATE para outros usos
  APP_STATE.indriverSaldo    = saldo;
  APP_STATE.indriverSaldoMax = Math.max(recargas, APP_STATE.indriverSaldoMax || 50);

  const maxSaldo = APP_STATE.indriverSaldoMax;
  const pct      = maxSaldo > 0 ? Math.min(100, (saldo / maxSaldo) * 100) : 100;
  const baixo    = saldo < 10;

  const el = document.getElementById('d-indriver-saldo');
  if (!el) return;
  el.textContent = utils.formatBRL(saldo);
  el.style.color = baixo ? '#f87171' : '#34d399';

  const elStatus = document.getElementById('d-indriver-status');
  if (elStatus) { elStatus.textContent = baixo ? '⚠ Saldo baixo!' : 'disponível'; }
  const elBar = document.getElementById('d-indriver-bar');
  if (elBar) { elBar.style.width = pct+'%'; elBar.style.background = baixo ? '#f87171' : '#34d399'; }
}

/* ─── RADAR DE TAXAS ──────────────────────────────── */
function updateTaxaRadar(list) {
  const el = document.getElementById('d-taxa-list');
  if (!el) return;

  // Agrupa por plataforma e calcula taxa média
  const grupos = {};
  list.forEach(c => {
    if (!c.bruto || !c.liquido || c.bruto <= 0) return;
    const taxa = ((c.bruto - c.liquido) / c.bruto) * 100;
    if (!grupos[c.plat]) grupos[c.plat] = { total: 0, count: 0 };
    grupos[c.plat].total += taxa;
    grupos[c.plat].count++;
  });

  const plats = Object.entries(grupos)
    .map(([nome, v]) => ({ nome, taxa: v.total / v.count }))
    .sort((a, b) => a.taxa - b.taxa); // menor taxa primeiro

  if (plats.length === 0) {
    el.innerHTML = '<div class="text-outline text-xs text-center py-2">Sem dados no período</div>';
    return;
  }

  const cores = { Uber: '#2563eb', '99': '#f59e0b', InDriver: '#10b981', Outros: '#8b5cf6' };

  el.innerHTML = plats.map((p, i) => `
    <div class="flex items-center gap-3">
      <div class="w-2 h-2 rounded-full flex-shrink-0" style="background:${cores[p.nome]||'#8b90a0'}"></div>
      <div class="flex-1">
        <div class="flex justify-between items-center mb-0.5">
          <span class="text-white text-[11px] font-semibold">${p.nome}</span>
          <span class="text-[11px] font-bold" style="color:${i===0?'#4ade80':'#f87171'}">${p.taxa.toFixed(1)}%${i===0?' ✓ Menor taxa':''}</span>
        </div>
        <div class="w-full h-1 bg-white/10 rounded-full">
          <div class="h-1 rounded-full" style="width:${Math.min(100,p.taxa)}%;background:${cores[p.nome]||'#8b90a0'}"></div>
        </div>
      </div>
    </div>
  `).join('');
}

/* ─── JORNADA ─────────────────────────────────────── */
function updateJornada() {
  const start    = getStartDate(), end = getEndDate();
  const sessions = APP_STATE.jornadas.filter(j => (j.data||'') >= start && (j.data||'') <= end);
  const today    = new Date().toLocaleDateString('sv-SE');
  const sessHoje = APP_STATE.jornadas.filter(j => j.data === today);

  const sumH = arr => arr.reduce((s,j) => {
    if (!j.inicio || !j.fim) return s;
    const [h1,m1] = j.inicio.split(':').map(Number);
    const [h2,m2] = j.fim.split(':').map(Number);
    return s + (h2+m2/60) - (h1+m1/60);
  }, 0);

  const hHoje   = sumH(sessHoje);
  const hPeriod = sumH(sessions);

  // R$/hora com dados do período (usa bruto pra InDriver)
  const receitaPeriod = somaReceita(getPeriodData());
  const rph = hPeriod > 0 ? receitaPeriod / hPeriod : 0;

  document.getElementById('d-jornada-hoje').textContent   = hHoje.toFixed(1)+'h';
  document.getElementById('d-jornada-periodo').textContent= hPeriod.toFixed(1)+'h';
  const rphEl = document.getElementById('d-rph-jornada') || document.getElementById('d-rph');
  if (rphEl) rphEl.textContent = rph > 0 ? utils.formatBRL(rph) : '—';
  const rphEl2 = document.getElementById('d-rph');
  if (rphEl2) rphEl2.textContent = rph > 0 ? utils.formatBRL(rph) : '—';
}

/* ─── ÚLTIMAS CORRIDAS ────────────────────────────── */
function updateUltimasCorridas(list) {
  const el = document.getElementById('d-ultimas-list');
  if (!el) return;

  const ultimas = [...list].sort((a,b) => new Date(b.data) - new Date(a.data)).slice(0,3);
  if (ultimas.length === 0) {
    el.innerHTML = '<div class="text-outline text-xs text-center py-3">Nenhuma corrida no período</div>';
    return;
  }

  const cores = { Uber:'#2563eb', '99':'#f59e0b', InDriver:'#10b981', Outros:'#8b5cf6' };
  el.innerHTML = ultimas.map(c => `
    <div class="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
      <div class="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center" style="background:${cores[c.plat]||'#414755'}20">
        <span class="material-symbols-outlined" style="font-size:14px;color:${cores[c.plat]||'#8b90a0'}">motorcycle</span>
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-white text-xs font-semibold">${c.plat}</div>
        <div class="text-outline text-[10px]">${utils.formatDate(c.data)} · ${c.km.toFixed(1)}km</div>
      </div>
      <div class="text-green-400 text-xs font-bold">${utils.formatBRL(receitaCorrida(c))}</div>
    </div>
  `).join('');
}

/* ─── GRÁFICOS ────────────────────────────────────── */
function updateCharts(list) {
  // Plataforma
  const platMap = {};
  list.forEach(c => { platMap[c.plat] = (platMap[c.plat]||0) + receitaCorrida(c); });
  const platLabels = Object.keys(platMap);
  const platVals   = Object.values(platMap);
  const platCores  = platLabels.map(p => ({Uber:'#3b82f6','99':'#f59e0b',InDriver:'#10b981',Outros:'#8b5cf6'}[p]||'#8b90a0'));

  renderDonut('chart-plat', platLabels, platVals, platCores, 'platChartInstance');

  // Pagamento
  const pagMap = {};
  list.forEach(c => { const k = c.pag||'Outro'; pagMap[k] = (pagMap[k]||0) + receitaCorrida(c); });
  const pagLabels = Object.keys(pagMap);
  const pagVals   = Object.values(pagMap);
  const pagCores  = ['#3b82f6','#4ade80','#f59e0b','#a855f7','#f87171'];

  renderDonut('chart-pag', pagLabels, pagVals, pagCores.slice(0,pagLabels.length), 'pagChartInstance');
}

function renderDonut(canvasId, labels, data, colors, instanceKey) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  if (window[instanceKey]) { window[instanceKey].destroy(); window[instanceKey] = null; }

  if (!labels.length) return;

  window[instanceKey] = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#8b90a0', font: { size: 9 }, boxWidth: 8, padding: 8 }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${utils.formatBRL(ctx.parsed)}`
          }
        }
      }
    }
  });
}

/* ─── SELEÇÃO DE PERÍODO ──────────────────────────── */
window.selectPeriod = function(p, el) {
  APP_STATE.currentPeriod = p;

  // Atualiza chips
  document.querySelectorAll('.period-chip').forEach(c => {
    c.classList.remove('border-blue-500','bg-blue-500/10','text-blue-400');
    c.classList.add('border-outline-variant','text-outline');
  });
  el.classList.add('border-blue-500','bg-blue-500/10','text-blue-400');
  el.classList.remove('border-outline-variant','text-outline');

  // Painel de data personalizada
  const panel = document.getElementById('custom-date-panel');
  if (panel) {
    if (p === 'custom') {
      panel.style.maxHeight = '200px';
      panel.style.opacity  = '1';
    } else {
      panel.style.maxHeight = '0';
      panel.style.opacity   = '0';
    }
  }

  // Renderiza só se não for custom (custom renderiza ao aplicar)
  if (p !== 'custom') renderDashboard();
};

/* ─── APLICAR PERÍODO PERSONALIZADO ──────────────── */
window.applyCustomPeriod = function(force) {
  const start = document.getElementById('custom-start')?.value;
  const end   = document.getElementById('custom-end')?.value;
  const label = document.getElementById('custom-date-label');

  if (start && end) {
    if (end < start) {
      if (label) label.textContent = '⚠ Data final antes da inicial';
      return;
    }
    const fmt = d => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'short' });
    if (label) label.textContent = `${fmt(start)} → ${fmt(end)}`;
    if (force || true) renderDashboard(); // renderiza automaticamente ao mudar qualquer data
  } else {
    if (label) label.textContent = start ? 'Selecione a data final' : 'Selecione as datas acima';
  }
};


/* ─── MODAL DE DESPESA RÁPIDA ─────────────────── */
window.openDespesaModal = function() {
  if (typeof showTab === 'function') showTab('financeiro');
  setTimeout(() => {
    if (typeof openGastoModal === 'function') openGastoModal();
  }, 150);
};

/* ─── RECARGA INDRIVER ────────────────────────────── */
// Redireciona para o modal de gasto com categoria pré-selecionada
window.openIndriverRecarga = function() {
  if (typeof openGastoModal === 'function') openGastoModal('recarga_indriver');
  if (typeof showTab === 'function') showTab('financeiro');
};
