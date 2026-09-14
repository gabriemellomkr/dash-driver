/* DashDriver — Aba Finanças */

let finPeriod    = 'month';
let finCatFilter = 'all';
let pendingDeleteGastoId   = null;
let pendingDeleteGastoTipo = null; // 'despesa' | 'abastecimento'

const GASTO_CFG = {
  gasolina:         { emoji: '⛽', label: 'Gasolina',        cor: '#f59e0b' },
  alimentacao:      { emoji: '🍔', label: 'Alimentação',      cor: '#ec4899' },
  recarga_indriver: { emoji: '💚', label: 'Recarga InDriver', cor: '#34d399' },
  manutencao:       { emoji: '🔧', label: 'Manutenção',       cor: '#8b5cf6' },
  outros:           { emoji: '💸', label: 'Outros',           cor: '#8b90a0' },
};

function gastoCfg(cat) {
  return GASTO_CFG[cat] || GASTO_CFG['outros'];
}

// ─── Período ──────────────────────────────────────────
function getFinDateRange() {
  const today = new Date().toLocaleDateString('sv-SE');
  switch (finPeriod) {
    case 'today': return { start: today, end: today };
    case 'week': {
      const d = new Date(); d.setDate(d.getDate() - d.getDay());
      return { start: d.toLocaleDateString('sv-SE'), end: today };
    }
    case 'month': return { start: today.slice(0, 8) + '01', end: today };
    default:      return { start: '2000-01-01', end: '9999-12-31' };
  }
}

// ─── Receita correta por plataforma ───────────────────
// InDriver: motorista recebe bruto em mãos (taxa sai do saldo pré-carregado)
function calcReceita(corridas) {
  return corridas.reduce((s, c) => {
    if (c.plat === 'InDriver' && c.bruto > 0) return s + c.bruto;
    return s + (c.liquido || 0);
  }, 0);
}

// ─── Saldo InDriver ───────────────────────────────────
function calcSaldoInDriver() {
  const recargas = APP_STATE.despesas
    .filter(d => d.categoria === 'recarga_indriver')
    .reduce((s, d) => s + (d.valor || 0), 0);
  const taxas = APP_STATE.corridas
    .filter(c => c.plat === 'InDriver' && c.bruto > c.liquido)
    .reduce((s, c) => s + (c.bruto - c.liquido), 0);
  return { saldo: recargas - taxas, recargas, taxas };
}

// ─── Render principal ─────────────────────────────────
window.renderFinanceiro = function() {
  const { start, end } = getFinDateRange();

  const corridas = APP_STATE.corridas.filter(c => {
    const d = (c.data || '').split('T')[0];
    return d >= start && d <= end;
  });

  const gastos = [
    ...APP_STATE.abastecimentos
      .filter(a => { const d = (a.data || '').split('T')[0]; return d >= start && d <= end; })
      .map(a => ({ ...a, categoria: 'gasolina', tipo: 'abastecimento' })),
    ...APP_STATE.despesas
      .filter(d => { const dt = (d.data || '').split('T')[0]; return dt >= start && dt <= end; })
      .map(d => ({ ...d, tipo: 'despesa' }))
  ];

  const receita     = calcReceita(corridas);
  const totalGastos = gastos.reduce((s, g) => s + (g.valor || 0), 0);
  const resultado   = receita - totalGastos;

  // Cards de resumo
  const elReceita   = document.getElementById('fin-receita');
  const elDespesas  = document.getElementById('fin-despesas');
  const elResultado = document.getElementById('fin-resultado');
  if (elReceita)   elReceita.textContent   = utils.formatBRL(receita);
  if (elDespesas)  elDespesas.textContent  = utils.formatBRL(totalGastos);
  if (elResultado) {
    elResultado.textContent = utils.formatBRL(resultado);
    elResultado.style.color = resultado >= 0 ? '#4ade80' : '#f87171';
  }

  // Card saldo InDriver
  const saldoCard = document.getElementById('fin-saldo-indriver');
  if (saldoCard) {
    const temInDriver = APP_STATE.corridas.some(c => c.plat === 'InDriver') ||
                        APP_STATE.despesas.some(d => d.categoria === 'recarga_indriver');
    if (temInDriver) {
      saldoCard.classList.remove('hidden');
      const { saldo, recargas, taxas } = calcSaldoInDriver();
      const baixo = saldo < 10;

      const elSaldo   = document.getElementById('fin-indriver-saldo');
      const elStatus  = document.getElementById('fin-indriver-status');
      const elDetalhe = document.getElementById('fin-indriver-detalhe');

      if (elSaldo)   { elSaldo.textContent = utils.formatBRL(saldo); elSaldo.style.color = baixo ? '#f87171' : '#34d399'; }
      if (elStatus)  { elStatus.textContent = baixo ? '⚠ Saldo baixo — recarregue!' : '✓ disponível'; elStatus.style.color = baixo ? '#f87171' : '#34d399'; }
      if (elDetalhe) elDetalhe.textContent = `${utils.formatBRL(recargas)} em recargas · ${utils.formatBRL(taxas)} em taxas descontadas`;

      // Sincroniza com o dashboard
      APP_STATE.indriverSaldo    = saldo;
      APP_STATE.indriverSaldoMax = Math.max(recargas, APP_STATE.indriverSaldoMax || 50);
    } else {
      saldoCard.classList.add('hidden');
    }
  }

  renderFinBreakdown(gastos);

  // Aplica filtro de categoria na timeline
  let corridasFiltradas, gastosFiltrados;
  if (finCatFilter === 'all') {
    corridasFiltradas = corridas;
    gastosFiltrados   = gastos;
  } else if (finCatFilter === 'corrida') {
    corridasFiltradas = corridas;
    gastosFiltrados   = [];
  } else {
    corridasFiltradas = [];
    gastosFiltrados   = gastos.filter(g => g.categoria === finCatFilter);
  }
  renderFinTimeline(corridasFiltradas, gastosFiltrados);
};

// ─── Breakdown por categoria ──────────────────────────
function renderFinBreakdown(gastos) {
  const el = document.getElementById('fin-breakdown');
  if (!el) return;

  if (gastos.length === 0) { el.innerHTML = ''; return; }

  // Agrupa por categoria
  const totais = {};
  gastos.forEach(g => {
    const cat = g.categoria || 'outros';
    totais[cat] = (totais[cat] || 0) + (g.valor || 0);
  });

  const totalGeral = Object.values(totais).reduce((s, v) => s + v, 0);
  if (totalGeral === 0) { el.innerHTML = ''; return; }

  const sorted = Object.entries(totais).sort((a, b) => b[1] - a[1]);

  el.innerHTML = `
    <div class="glass rounded-2xl p-4">
      <div class="flex items-center gap-1.5 mb-3">
        <span class="material-symbols-outlined text-outline" style="font-size:14px">pie_chart</span>
        <span class="text-white text-[11px] font-semibold">Gastos por categoria</span>
      </div>
      <div class="space-y-2.5">
        ${sorted.map(([cat, total]) => {
          const cfg = gastoCfg(cat);
          const pct = (total / totalGeral) * 100;
          return `
            <div>
              <div class="flex items-center justify-between mb-1">
                <div class="flex items-center gap-1.5">
                  <span class="text-[13px]">${cfg.emoji}</span>
                  <span class="text-on-surface-variant text-[11px]">${cfg.label}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-outline text-[10px]">${pct.toFixed(0)}%</span>
                  <span class="text-white text-[11px] font-bold">${utils.formatBRL(total)}</span>
                </div>
              </div>
              <div class="w-full h-1.5 bg-white/10 rounded-full">
                <div class="h-1.5 rounded-full transition-all" style="width:${pct}%;background:${cfg.cor}"></div>
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

// ─── Timeline unificada ───────────────────────────────
function renderFinTimeline(corridas, gastos) {
  const el = document.getElementById('fin-list');
  if (!el) return;

  const todos = [
    ...corridas.map(c => {
      const liquido = (c.plat === 'InDriver' && c.bruto > 0) ? c.bruto : (c.liquido || 0);
      const meta = CONFIG_DATA.precoKm || 0;
      let qualidade = null;
      if (meta > 0 && c.km > 0) {
        const rKm = liquido / c.km;
        if (rKm >= meta * 1.2)      qualidade = { label: 'Ótima',   cor: '#4ade80' };
        else if (rKm >= meta)        qualidade = { label: 'Boa',     cor: '#60a5fa' };
        else if (rKm >= meta * 0.8)  qualidade = { label: 'Regular', cor: '#fbbf24' };
        else                         qualidade = { label: 'Ruim',    cor: '#f87171' };
      }
      return {
        id: c.id, tipo: 'corrida',
        data: (c.data || '').split('T')[0],
        label: c.plat,
        sub: `${c.km > 0 ? c.km.toFixed(1) + ' km' : 'km —'} · ${c.pag || ''}`,
        valor: liquido,
        positivo: true, emoji: '🏍️', qualidade,
      };
    }),
    ...gastos.map(g => ({
      id: g.id, tipo: g.tipo,
      data: (g.data || '').split('T')[0],
      label: gastoCfg(g.categoria).label,
      sub: g.descricao || '',
      valor: g.valor || 0,
      positivo: false, emoji: gastoCfg(g.categoria).emoji,
      categoria: g.categoria
    }))
  ].sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id);

  if (todos.length === 0) {
    el.innerHTML = `
      <div class="flex flex-col items-center justify-center py-14 opacity-40">
        <span class="material-symbols-outlined mb-2" style="font-size:48px">account_balance_wallet</span>
        <p class="text-sm font-medium">Nenhum lançamento</p>
        <p class="text-[11px] mt-1 text-outline">Use o botão + Lançar para registrar gastos</p>
      </div>`;
    return;
  }

  const grupos = {};
  todos.forEach(item => {
    if (!grupos[item.data]) grupos[item.data] = [];
    grupos[item.data].push(item);
  });

  const today = new Date().toLocaleDateString('sv-SE');
  const yest  = (() => { const d = new Date(); d.setDate(d.getDate()-1); return d.toLocaleDateString('sv-SE'); })();
  const dias  = Object.keys(grupos).sort((a, b) => b.localeCompare(a));

  el.innerHTML = dias.map(day => {
    const items    = grupos[day];
    const totalDia = items.reduce((s, i) => i.positivo ? s + i.valor : s - i.valor, 0);
    const dayLabel = day === today ? 'Hoje' : day === yest ? 'Ontem' :
      new Date(day + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });

    const itemsHTML = items.map(item => {
      const isPendingDel = pendingDeleteGastoId === item.id && pendingDeleteGastoTipo === item.tipo;
      return `
        <div class="flex items-center gap-3 px-4 py-3.5 border-b border-white/5 last:border-0">
          <div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/5 text-base">${item.emoji}</div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="text-white text-[13px] font-bold">${item.label}</span>
              ${item.qualidade ? `<span class="text-[9px] font-black px-1.5 py-0.5 rounded-full" style="background:${item.qualidade.cor}22;color:${item.qualidade.cor}">${item.qualidade.label}</span>` : ''}
            </div>
            ${item.sub ? `<div class="text-outline text-[10px]">${item.sub}</div>` : ''}
          </div>
          ${isPendingDel ? `
            <div class="flex items-center gap-1.5 flex-shrink-0">
              <span class="text-red-400 text-[10px] font-semibold">Excluir?</span>
              <button data-id="${item.id}" onclick="confirmarDeleteGasto(this.dataset.id,'${item.tipo}')" class="bg-red-500/20 text-red-400 text-[10px] font-bold px-2.5 py-1.5 rounded-lg active:scale-95">Sim</button>
              <button onclick="cancelarDeleteGasto()" class="bg-white/10 text-outline text-[10px] font-bold px-2.5 py-1.5 rounded-lg active:scale-95">Não</button>
            </div>
          ` : `
            <div class="flex items-center gap-2 flex-shrink-0">
              <span class="${item.positivo ? 'text-green-400' : 'text-red-400'} font-black text-[13px]">
                ${item.positivo ? '+' : '-'} ${utils.formatBRL(item.valor)}
              </span>
              ${item.tipo !== 'corrida' ? `
                <button data-id="${item.id}" onclick="pedirDeleteGasto(this.dataset.id,'${item.tipo}')" class="w-8 h-8 flex items-center justify-center text-outline hover:text-red-400 active:scale-90 transition-all rounded-lg">
                  <span class="material-symbols-outlined" style="font-size:16px">delete</span>
                </button>
              ` : ''}
            </div>
          `}
        </div>`;
    }).join('');

    return `
      <div class="glass rounded-2xl overflow-hidden">
        <div class="flex items-center justify-between px-4 py-2 border-b border-white/5" style="background:rgba(255,255,255,0.02)">
          <span class="text-white text-[11px] font-bold capitalize">${dayLabel}</span>
          <span class="${totalDia >= 0 ? 'text-green-400' : 'text-red-400'} text-[11px] font-bold">${totalDia >= 0 ? '+' : ''}${utils.formatBRL(totalDia)}</span>
        </div>
        ${itemsHTML}
      </div>`;
  }).join('');
}

// ─── Filtro de período ────────────────────────────────
window.setFinPeriod = function(p, el) {
  finPeriod = p;
  pendingDeleteGastoId = null;
  document.querySelectorAll('.fin-period-chip').forEach(c => {
    c.classList.remove('border-blue-500', 'bg-blue-500/10', 'text-blue-400');
    c.classList.add('border-outline-variant', 'text-outline');
  });
  el.classList.add('border-blue-500', 'bg-blue-500/10', 'text-blue-400');
  el.classList.remove('border-outline-variant', 'text-outline');
  renderFinanceiro();
};

// ─── Filtro de categoria ──────────────────────────────
window.setFinCat = function(cat, el) {
  finCatFilter = cat;
  pendingDeleteGastoId = null;
  document.querySelectorAll('.fin-cat-chip').forEach(c => {
    c.classList.remove('border-blue-500', 'bg-blue-500/10', 'text-blue-400');
    c.classList.add('border-outline-variant', 'text-outline');
  });
  el.classList.add('border-blue-500', 'bg-blue-500/10', 'text-blue-400');
  el.classList.remove('border-outline-variant', 'text-outline');
  renderFinanceiro();
};

// ─── Modal de gasto ───────────────────────────────────
window.openGastoModal = function(catPreset) {
  const modal = document.getElementById('gasto-modal');
  if (!modal) return;
  modal.style.display = 'flex';

  document.getElementById('g-valor').value = '';
  document.getElementById('g-data').value  = new Date().toLocaleDateString('sv-SE');
  document.getElementById('gasto-error').classList.add('hidden');
  const lEl = document.getElementById('g-litros'); if (lEl) lEl.value = '';
  const dEl = document.getElementById('g-descricao'); if (dEl) dEl.value = '';

  const cat = catPreset || 'gasolina';
  document.getElementById('g-categoria').value = cat;
  document.querySelectorAll('.gasto-cat-btn').forEach(b => {
    const sel = b.dataset.cat === cat;
    b.classList.toggle('border-blue-500',           sel);
    b.classList.toggle('bg-blue-500/10',            sel);
    b.classList.toggle('text-blue-400',             sel);
    b.classList.toggle('border-outline-variant',    !sel);
    b.classList.toggle('bg-surface-container-high', !sel);
    b.classList.toggle('text-outline',              !sel);
  });
  _toggleGastoFields(cat);
};

window.closeGastoModal = function() {
  const modal = document.getElementById('gasto-modal');
  if (modal) modal.style.display = 'none';
};

function _toggleGastoFields(cat) {
  const litrosField = document.getElementById('g-litros-field');
  const descField   = document.getElementById('g-descricao-field');
  if (litrosField) litrosField.classList.toggle('hidden', cat !== 'gasolina');
  if (descField)   descField.classList.toggle('hidden',   cat === 'gasolina');
}

window.setGastoCat = function(cat, btn) {
  document.getElementById('g-categoria').value = cat;
  document.querySelectorAll('.gasto-cat-btn').forEach(b => {
    b.classList.remove('border-blue-500', 'bg-blue-500/10', 'text-blue-400');
    b.classList.add('border-outline-variant', 'bg-surface-container-high', 'text-outline');
  });
  btn.classList.add('border-blue-500', 'bg-blue-500/10', 'text-blue-400');
  btn.classList.remove('border-outline-variant', 'bg-surface-container-high', 'text-outline');
  _toggleGastoFields(cat);
};

window.salvarGasto = async function() {
  const errEl     = document.getElementById('gasto-error');
  const categoria = document.getElementById('g-categoria').value;
  const valor     = parseFloat(document.getElementById('g-valor').value);
  const dataVal   = document.getElementById('g-data').value || new Date().toLocaleDateString('sv-SE');
  errEl.classList.add('hidden');

  if (isNaN(valor) || valor <= 0) { errEl.classList.remove('hidden'); return; }

  const btn = document.getElementById('btn-salvar-gasto');
  btn.disabled = true;
  btn.innerHTML = '<span class="material-symbols-outlined animate-spin" style="font-size:20px">sync</span> SALVANDO...';

  let error;
  if (categoria === 'gasolina') {
    // Gasolina → tabela de abastecimentos (lida pelo card Gasolina do dashboard)
    const litros = parseFloat(document.getElementById('g-litros')?.value) || 0;
    ({ error } = await supabase.from('dashdriver_abastecimentos').insert([{
      valor, litros, data: dataVal, user_id: APP_STATE.user?.id
    }]));
  } else {
    const descricao = document.getElementById('g-descricao')?.value || '';
    ({ error } = await supabase.from('dashdriver_outras_despesas').insert([{
      categoria, valor, descricao, data: dataVal, user_id: APP_STATE.user?.id
    }]));
  }

  btn.disabled = false;
  btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px">check_circle</span> SALVAR GASTO';

  if (error) { utils.toast('Erro ao salvar: ' + (error.message || ''), 'error'); return; }

  closeGastoModal();
  // Recarrega a tabela certa
  await (categoria === 'gasolina' ? data.loadAbastecimentos() : data.loadOutrasDespesas());
  renderFinanceiro();
  if (typeof renderDashboard === 'function') renderDashboard();
  utils.toast('✓ ' + gastoCfg(categoria).label + ' registrado!', 'success');
};

// ─── Delete de gasto ──────────────────────────────────
window.pedirDeleteGasto = function(id, tipo) {
  pendingDeleteGastoId   = id;
  pendingDeleteGastoTipo = tipo;
  renderFinanceiro();
};

window.cancelarDeleteGasto = function() {
  pendingDeleteGastoId   = null;
  pendingDeleteGastoTipo = null;
  renderFinanceiro();
};

window.confirmarDeleteGasto = async function(id, tipo) {
  const tabela  = tipo === 'abastecimento' ? 'dashdriver_abastecimentos' : 'dashdriver_outras_despesas';
  const { error } = await supabase.from(tabela).delete().eq('id', id);
  pendingDeleteGastoId   = null;
  pendingDeleteGastoTipo = null;
  if (!error) {
    utils.toast('Gasto excluído', 'success');
    await Promise.all([data.loadOutrasDespesas(), data.loadAbastecimentos()]);
    renderFinanceiro();
    if (typeof renderDashboard === 'function') renderDashboard();
  } else {
    utils.toast('Erro ao excluir', 'error');
  }
};

// Alias para o dashboard (botão + Saldo no card InDriver)
window.openIndriverRecarga = function() {
  openGastoModal('recarga_indriver');
  if (typeof showTab === 'function') showTab('financeiro');
};
