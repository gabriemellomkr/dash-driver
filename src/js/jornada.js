/* DashDriver — Jornada de Trabalho */

let editingJornadaId = null;

window.openJornadaModal = function() {
  const modal = document.getElementById('jornada-modal');
  if (!modal) return;
  modal.style.display = 'flex';

  editingJornadaId = null;
  document.getElementById('j-data').value   = new Date().toLocaleDateString('sv-SE');
  document.getElementById('j-inicio').value = '';
  document.getElementById('j-fim').value    = '';
  document.getElementById('j-error').classList.add('hidden');
  document.getElementById('j-form-title').textContent = 'Nova sessão';
  document.getElementById('j-cancel-btn').classList.add('hidden');
  renderJornadaList();
};

window.closeJornadaModal = function() {
  const modal = document.getElementById('jornada-modal');
  if (modal) modal.style.display = 'none';
  editingJornadaId = null;
};

window.cancelEditSessao = function() {
  editingJornadaId = null;
  document.getElementById('j-data').value   = new Date().toLocaleDateString('sv-SE');
  document.getElementById('j-inicio').value = '';
  document.getElementById('j-fim').value    = '';
  document.getElementById('j-form-title').textContent = 'Nova sessão';
  document.getElementById('j-cancel-btn').classList.add('hidden');
};

window.salvarSessao = async function() {
  const data   = document.getElementById('j-data').value;
  const inicio = document.getElementById('j-inicio').value;
  const fim    = document.getElementById('j-fim').value;
  const errEl  = document.getElementById('j-error');

  if (!data || !inicio || !fim) { errEl.classList.remove('hidden'); return; }
  if (fim <= inicio) { errEl.classList.remove('hidden'); errEl.textContent = 'Fim deve ser após o início.'; return; }
  errEl.classList.add('hidden');

  const btn = document.getElementById('j-save-btn');
  btn.disabled = true;

  const payload = { data, inicio, fim, user_id: APP_STATE.user?.id };

  let error;
  if (editingJornadaId) {
    ({ error } = await supabase.from('dashdriver_jornadas').update(payload).eq('id', editingJornadaId));
  } else {
    ({ error } = await supabase.from('dashdriver_jornadas').insert([payload]));
  }

  btn.disabled = false;
  if (error) { utils.toast('Erro ao salvar sessão', 'error'); return; }

  await data.loadJornadas();
  renderJornadaList();
  renderDashboard();
  cancelEditSessao();
  utils.toast('✓ Sessão registrada!', 'success');
};

window.deleteSessao = async function(id) {
  const { error } = await supabase.from('dashdriver_jornadas').delete().eq('id', id);
  if (error) { utils.toast('Erro ao excluir', 'error'); return; }
  await data.loadJornadas();
  renderJornadaList();
  renderDashboard();
};

function calcSessaoHoras(sessao) {
  if (!sessao.inicio || !sessao.fim) return 0;
  const [h1, m1] = sessao.inicio.split(':').map(Number);
  const [h2, m2] = sessao.fim.split(':').map(Number);
  return Math.max(0, (h2 + m2 / 60) - (h1 + m1 / 60));
}

function formatHoras(h) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}h${mm > 0 ? mm + 'm' : ''}`;
}

function renderJornadaList() {
  const el = document.getElementById('jornada-list');
  if (!el) return;

  const jornadas = APP_STATE.jornadas || [];
  if (!jornadas.length) {
    el.innerHTML = '<div class="text-outline text-xs text-center py-6">Nenhuma sessão registrada</div>';
    return;
  }

  const byDate = {};
  jornadas.forEach(j => {
    if (!byDate[j.data]) byDate[j.data] = [];
    byDate[j.data].push(j);
  });

  const today = new Date().toLocaleDateString('sv-SE');
  const yest  = (() => { const d = new Date(); d.setDate(d.getDate()-1); return d.toLocaleDateString('sv-SE'); })();

  el.innerHTML = Object.entries(byDate)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 7) // últimos 7 dias
    .map(([dayKey, sessoes]) => {
      const totalH = sessoes.reduce((s, j) => s + calcSessaoHoras(j), 0);
      const dayLabel = dayKey === today ? 'Hoje' : dayKey === yest ? 'Ontem' :
        new Date(dayKey + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });

      return `
        <div class="glass rounded-2xl overflow-hidden">
          <div class="flex items-center justify-between px-4 py-2 border-b border-white/5" style="background:rgba(255,255,255,0.02)">
            <span class="text-white text-[11px] font-bold capitalize">${dayLabel}</span>
            <span class="text-blue-400 text-[11px] font-bold">${formatHoras(totalH)} total</span>
          </div>
          ${sessoes.map(s => {
            const h = calcSessaoHoras(s);
            return `
              <div class="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0">
                <span class="material-symbols-outlined text-outline" style="font-size:16px">schedule</span>
                <span class="text-on-surface-variant text-[12px] flex-1">${s.inicio} → ${s.fim}</span>
                <span class="text-outline text-[11px]">${formatHoras(h)}</span>
                <button onclick="deleteSessao(${s.id})" class="w-7 h-7 flex items-center justify-center text-outline hover:text-red-400 active:scale-90 transition-all rounded-lg">
                  <span class="material-symbols-outlined" style="font-size:15px">delete</span>
                </button>
              </div>`;
          }).join('')}
        </div>`;
    }).join('');
}
