/* DashDriver History Logic */

function setFiltro(v, el) {
  filtroPlat = v;
  document.querySelectorAll('.plat-chip').forEach(c => {
    c.classList.remove('border-blue-500', 'bg-blue-500/10', 'text-blue-400');
    c.classList.add('border-outline-variant', 'text-outline');
  });
  el.classList.add('border-blue-500', 'bg-blue-500/10', 'text-blue-400');
  el.classList.remove('border-outline-variant', 'text-outline');
  renderHistorico();
}

function setHistPeriod(p, el) {
  histPeriod = p;
  setPeriodChips('.hist-period-chip', el);
  const rangeEl = document.getElementById('hist-custom-range');
  if (p === 'custom') {
    rangeEl.classList.remove('hidden');
    if (!document.getElementById('hist-custom-start').value) {
      const today = todayStr();
      document.getElementById('hist-custom-start').value = today.slice(0, 8) + '01';
      document.getElementById('hist-custom-end').value   = today;
    }
  } else {
    rangeEl.classList.add('hidden');
  }
  renderHistorico();
}

function renderHistorico() {
  const { start, end } = calcPeriodDates(histPeriod, 'hist-custom-start', 'hist-custom-end');
  const list = corridas.filter(c => {
    if (filtroPlat !== 'all' && c.plat !== filtroPlat) return false;
    const d = (c.data || '').slice(0, 10);
    return d >= start && d <= end;
  });
  const el   = document.getElementById('hist-list');
  if (!list.length) {
    el.innerHTML = `
      <div style="text-align:center;padding:40px 0">
        <span class="material-symbols-outlined" style="font-size:40px;color:#414755;display:block;margin-bottom:12px">motorcycle</span>
        <p style="color:#8b90a0;font-size:13px">Nenhuma corrida.<br>Toque em <span style="color:#60a5fa;font-weight:700">+</span> para começar.</p>
      </div>`;
    return;
  }
  el.innerHTML = list.map(c => {
    const rpkm  = c.km > 0 ? c.liquido / c.km : 0;
    const st    = getStatus(rpkm);
    const custo = (c.km * CONFIG.custoKm).toFixed(2).replace('.', ',');
    const outrasBadge = c.outras > 0
      ? `<span style="display:inline-flex;align-items:center;padding:2px 8px;border-radius:20px;font-size:9px;font-weight:700;background:rgba(251,146,60,.15);color:#fb923c">${brl(c.outras)} cobr.extra</span>`
      : '';
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.05)">
        <div style="width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;background:${colorPlat(c.plat)}">
          ${iconPlat(c.plat)}
        </div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="color:white;font-size:14px;font-weight:600">${c.plat}</span>
            <span style="color:#4ade80;font-size:14px;font-weight:700">${brl(c.liquido)}</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap">
            <span style="color:#8b90a0;font-size:10px">${fmtDate(c.data)}${fmtTime(c.data) ? ' ' + fmtTime(c.data) : ''} · ${c.km.toFixed(1)}km${c.tempo > 0 ? ` · ${c.tempo}h` : ''} · R$${custo} op.</span>
            ${badgePag(c.pag)}
            ${outrasBadge}
            <span class="${st.cls}" style="padding:2px 8px;border-radius:20px;font-size:9px;font-weight:700">${st.label}</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px">
          <button onclick="editarCorrida(${c.id})" style="background:none;border:none;color:#414755;cursor:pointer;padding:4px;transition:color .2s" onmouseover="this.style.color='#60a5fa'" onmouseout="this.style.color='#414755'">
            <span class="material-symbols-outlined" style="font-size:18px">edit</span>
          </button>
          <button onclick="deletar(${c.id})" style="background:none;border:none;color:#414755;cursor:pointer;padding:4px;transition:color .2s" onmouseover="this.style.color='#f87171'" onmouseout="this.style.color='#414755'">
            <span class="material-symbols-outlined" style="font-size:18px">delete</span>
          </button>
        </div>
      </div>`;
  }).join('');
}

async function deletar(id) {
  if (!confirm('Remover esta corrida?')) return;
  const { error } = await sb.from('dashdriver_corridas').delete().eq('id', id);
  if (error) { showToast('Erro ao remover'); return; }
  await loadCorridas();
  renderHistorico();
  updateDash();
}
