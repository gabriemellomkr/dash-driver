/* DashDriver History Logic */

let histPeriod = 'all';
let filtroPlat = 'all';

window.setHistPeriod = function(p, el) {
  histPeriod = p;
  document.querySelectorAll('.hist-period-chip').forEach(c => {
    c.classList.remove('border-blue-500', 'bg-blue-500/10', 'text-blue-400');
    c.classList.add('border-outline-variant', 'text-outline');
  });
  el.classList.add('border-blue-500', 'bg-blue-500/10', 'text-blue-400');
  el.classList.remove('border-outline-variant', 'text-outline');
  renderHistorico();
};

window.renderHistorico = function() {
  const el = document.getElementById('hist-list');
  if (!el) return;

  const start = getStartDateForHistory();
  const list = APP_STATE.corridas.filter(c => {
    const d = c.data.split('T')[0];
    return d >= start;
  });

  if (list.length === 0) {
    el.innerHTML = `
      <div class="flex flex-col items-center justify-center py-12 opacity-40">
        <span class="material-symbols-outlined text-5xl mb-2">motorcycle</span>
        <p class="text-sm">Nenhuma corrida encontrada</p>
      </div>`;
    return;
  }

  el.innerHTML = list.map(c => `
    <div class="flex items-center gap-4 p-4 border-b border-white/5 last:border-0">
      <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style="background: ${getPlatColor(c.plat)}20">
        <span class="material-symbols-outlined" style="color: ${getPlatColor(c.plat)}">${getPlatIcon(c.plat)}</span>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex justify-between items-start">
          <h4 class="text-white font-bold text-sm truncate">${c.plat}</h4>
          <span class="text-green-400 font-black text-sm">${utils.formatBRL(c.liquido)}</span>
        </div>
        <div class="flex items-center gap-2 mt-1">
          <span class="text-outline text-[10px]">${utils.formatDate(c.data)} ${utils.formatTime(c.data)}</span>
          <span class="text-outline text-[10px]">•</span>
          <span class="text-outline text-[10px]">${c.km.toFixed(1)} km</span>
        </div>
      </div>
      <div class="flex gap-1">
        <button onclick="editarCorrida(${c.id})" class="text-outline hover:text-blue-400 transition-colors p-1">
          <span class="material-symbols-outlined text-lg">edit</span>
        </button>
        <button onclick="deletarCorrida(${c.id})" class="text-outline hover:text-red-400 transition-colors p-1">
          <span class="material-symbols-outlined text-lg">delete</span>
        </button>
      </div>
    </div>
  `).join('');
};

function getStartDateForHistory() {
  const today = new Date().toISOString().split('T')[0];
  if (histPeriod === 'today') return today;
  if (histPeriod === 'yesterday') {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }
  if (histPeriod === 'week') {
    const d = new Date(); d.setDate(d.getDate() - d.getDay());
    return d.toISOString().split('T')[0];
  }
  if (histPeriod === 'month') return today.slice(0, 8) + '01';
  return '2000-01-01'; // 'all'
}

function getPlatColor(plat) {
  const p = (plat || '').toLowerCase();
  if (p.includes('uber')) return '#ffffff';
  if (p.includes('99')) return '#facc15';
  if (p.includes('indrive')) return '#4ade80';
  return '#3b82f6';
}

function getPlatIcon(plat) {
  const p = (plat || '').toLowerCase();
  if (p.includes('moto')) return 'motorcycle';
  return 'directions_car';
}

window.deletarCorrida = async function(id) {
  if (!confirm("Excluir esta corrida?")) return;
  
  const { error } = await supabase.from('dashdriver_corridas').delete().eq('id', id);
  if (!error) {
    utils.toast("Corrida excluída", "success");
    await data.loadCorridas();
    renderHistorico();
    if (typeof renderDashboard === 'function') renderDashboard();
  } else {
    utils.toast("Erro ao excluir", "error");
  }
};

