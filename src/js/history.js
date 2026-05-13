/* DashDriver — Aba Corridas (History) */

let histPeriod  = 'all';
let histPlat    = 'all';
let pendingDeleteId = null;

// ─── Configs visuais de plataforma ───────────────────
const PLAT_CFG = {
  'Uber':       { color: '#e4e2e4', bg: 'rgba(228,226,228,0.08)' },
  '99':         { color: '#facc15', bg: 'rgba(250,204,21,0.10)' },
  'InDriver':   { color: '#4ade80', bg: 'rgba(74,222,128,0.10)' },
  'Particular': { color: '#a78bfa', bg: 'rgba(167,139,250,0.10)' },
};

function platCfg(plat) {
  return PLAT_CFG[plat] || { color: '#8b90a0', bg: 'rgba(139,144,160,0.08)' };
}

// ─── Range de datas por período ───────────────────────
function getHistDateRange() {
  const today = new Date().toLocaleDateString('sv-SE');
  switch (histPeriod) {
    case 'today':
      return { start: today, end: today };
    case 'yesterday': {
      const d = new Date(); d.setDate(d.getDate() - 1);
      const yest = d.toLocaleDateString('sv-SE');
      return { start: yest, end: yest };
    }
    case 'week': {
      const d = new Date(); d.setDate(d.getDate() - d.getDay());
      return { start: d.toLocaleDateString('sv-SE'), end: today };
    }
    case 'month':
      return { start: today.slice(0, 8) + '01', end: today };
    default:
      return { start: '2000-01-01', end: '9999-12-31' };
  }
}

// ─── Filtro principal ─────────────────────────────────
function getFilteredCorridas() {
  const { start, end } = getHistDateRange();
  return APP_STATE.corridas.filter(c => {
    const d = (c.data || '').split('T')[0];
    const inPeriod = d >= start && d <= end;
    const inPlat   = histPlat === 'all' || c.plat === histPlat;
    return inPeriod && inPlat;
  });
}

// ─── Mini stats ───────────────────────────────────────
function updateHistStats(list) {
  const count   = list.length;
  const receita = list.reduce((s, c) => s + (c.liquido || 0), 0);
  const km      = list.reduce((s, c) => s + (c.km || 0), 0);

  const elCount   = document.getElementById('hist-stat-count');
  const elReceita = document.getElementById('hist-stat-receita');
  const elKm      = document.getElementById('hist-stat-km');

  if (elCount)   elCount.textContent   = count;
  if (elReceita) elReceita.textContent = utils.formatBRL(receita);
  if (elKm)      elKm.textContent      = km.toFixed(1) + ' km';
}

// ─── Header de dia ────────────────────────────────────
function formatDayHeader(dateStr) {
  const today = new Date().toLocaleDateString('sv-SE');
  const d     = new Date(); d.setDate(d.getDate() - 1);
  const yest  = d.toLocaleDateString('sv-SE');

  if (dateStr === today) return 'Hoje';
  if (dateStr === yest)  return 'Ontem';

  return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'short', day: '2-digit', month: 'short'
  });
}

// ─── Render principal ─────────────────────────────────
window.renderHistorico = function() {
  const el = document.getElementById('hist-list');
  if (!el) return;

  const list = getFilteredCorridas();
  updateHistStats(list);

  if (list.length === 0) {
    el.innerHTML = `
      <div class="flex flex-col items-center justify-center py-14 opacity-40">
        <span class="material-symbols-outlined mb-2" style="font-size:48px">motorcycle</span>
        <p class="text-sm font-medium">Nenhuma corrida encontrada</p>
        <p class="text-[11px] mt-1 text-outline">Tente outro filtro ou registre uma corrida</p>
      </div>`;
    return;
  }

  // Agrupa por data (YYYY-MM-DD)
  const grupos = {};
  list.forEach(c => {
    const day = (c.data || '').split('T')[0];
    if (!grupos[day]) grupos[day] = [];
    grupos[day].push(c);
  });

  // Renderiza do mais recente pro mais antigo
  const dias = Object.keys(grupos).sort((a, b) => b.localeCompare(a));

  el.innerHTML = dias.map(day => {
    const corridas  = grupos[day];
    const totalDia  = corridas.reduce((s, c) => s + (c.liquido || 0), 0);
    const kmDia     = corridas.reduce((s, c) => s + (c.km || 0), 0);
    const countDia  = corridas.length;

    const corridasHTML = corridas.map(c => {
      const cfg     = platCfg(c.plat);
      const isPendingDel = pendingDeleteId === c.id;
      const hora    = c.data && c.data.includes('T')
        ? new Date(c.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : '';
      const kmStr   = c.km > 0 ? `${c.km.toFixed(1)} km` : 'km não informado';
      const pagIcon = c.pag === 'Dinheiro' ? 'payments' : c.pag === 'Pix' ? 'pix' : 'credit_card';

      return `
        <div class="flex items-center gap-3 px-4 py-3.5 border-b border-white/5 last:border-0 active:bg-white/5 transition-colors" data-id="${c.id}">

          <!-- Ícone plataforma -->
          <div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style="background:${cfg.bg}">
            <span class="material-symbols-outlined" style="font-size:18px;color:${cfg.color};font-variation-settings:'FILL' 1">motorcycle</span>
          </div>

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5 mb-0.5">
              <span class="text-white text-[13px] font-bold">${c.plat}</span>
              <span class="material-symbols-outlined text-outline" style="font-size:11px">${pagIcon}</span>
              ${hora ? `<span class="text-outline text-[10px]">${hora}</span>` : ''}
            </div>
            <div class="text-outline text-[10px]">${kmStr}${c.outras > 0 ? ` · gorjeta ${utils.formatBRL(c.outras)}` : ''}</div>
          </div>

          <!-- Valor + ações -->
          ${isPendingDel ? `
            <div class="flex items-center gap-1.5 flex-shrink-0">
              <span class="text-red-400 text-[10px] font-semibold">Excluir?</span>
              <button onclick="confirmarDelete(${c.id})" class="bg-red-500/20 text-red-400 text-[10px] font-bold px-2.5 py-1.5 rounded-lg active:scale-95 transition-all">Sim</button>
              <button onclick="cancelarDelete()" class="bg-white/10 text-outline text-[10px] font-bold px-2.5 py-1.5 rounded-lg active:scale-95 transition-all">Não</button>
            </div>
          ` : `
            <div class="flex items-center gap-2 flex-shrink-0">
              <span class="text-green-400 font-black text-[13px]">${utils.formatBRL(c.liquido)}</span>
              <div class="flex gap-0.5">
                <button onclick="editarCorrida(${c.id})" class="w-8 h-8 flex items-center justify-center text-outline hover:text-blue-400 active:scale-90 transition-all rounded-lg">
                  <span class="material-symbols-outlined" style="font-size:16px">edit</span>
                </button>
                <button onclick="pedirConfirmDelete(${c.id})" class="w-8 h-8 flex items-center justify-center text-outline hover:text-red-400 active:scale-90 transition-all rounded-lg">
                  <span class="material-symbols-outlined" style="font-size:16px">delete</span>
                </button>
              </div>
            </div>
          `}
        </div>`;
    }).join('');

    return `
      <!-- Dia: ${day} -->
      <div>
        <div class="flex items-center justify-between px-4 py-2 border-b border-white/5" style="background:rgba(255,255,255,0.02)">
          <span class="text-white text-[11px] font-bold capitalize">${formatDayHeader(day)}</span>
          <div class="flex items-center gap-3">
            <span class="text-outline text-[10px]">${countDia} corrida${countDia !== 1 ? 's' : ''} · ${kmDia.toFixed(1)}km</span>
            <span class="text-green-400 text-[11px] font-bold">${utils.formatBRL(totalDia)}</span>
          </div>
        </div>
        ${corridasHTML}
      </div>`;
  }).join('');
};

// ─── Filtros ──────────────────────────────────────────
window.setHistPeriod = function(p, el) {
  histPeriod = p;
  pendingDeleteId = null;
  document.querySelectorAll('.hist-period-chip').forEach(c => {
    c.classList.remove('border-blue-500', 'bg-blue-500/10', 'text-blue-400');
    c.classList.add('border-outline-variant', 'text-outline');
  });
  el.classList.add('border-blue-500', 'bg-blue-500/10', 'text-blue-400');
  el.classList.remove('border-outline-variant', 'text-outline');
  renderHistorico();
};

window.setHistPlat = function(p, el) {
  histPlat = p;
  pendingDeleteId = null;
  document.querySelectorAll('.hist-plat-chip').forEach(c => {
    c.classList.remove('border-blue-500', 'bg-blue-500/10', 'text-blue-400');
    c.classList.add('border-outline-variant', 'text-outline');
  });
  el.classList.add('border-blue-500', 'bg-blue-500/10', 'text-blue-400');
  el.classList.remove('border-outline-variant', 'text-outline');
  renderHistorico();
};

// ─── Delete com confirmação inline ────────────────────
window.pedirConfirmDelete = function(id) {
  pendingDeleteId = id;
  renderHistorico();
};

window.cancelarDelete = function() {
  pendingDeleteId = null;
  renderHistorico();
};

window.confirmarDelete = async function(id) {
  const { error } = await supabase.from('dashdriver_corridas').delete().eq('id', id);
  pendingDeleteId = null;
  if (!error) {
    utils.toast('Corrida excluída', 'success');
    await data.loadCorridas();
    renderHistorico();
    if (typeof renderDashboard === 'function') renderDashboard();
  } else {
    utils.toast('Erro ao excluir', 'error');
  }
};

// Alias legado (usado em outros lugares)
window.deletarCorrida = window.pedirConfirmDelete;
