/* DashDriver — Promoções dos apps de corrida */

let editingPromoId = null;

window.setPromoPlat = function(plat, btn) {
  document.getElementById('f-promo-plat').value = plat;
  document.querySelectorAll('.plat-promo-btn').forEach(b => {
    b.classList.remove('border-blue-500', 'bg-blue-500/10', 'text-blue-400');
    b.classList.add('border-outline-variant', 'bg-surface-container-high', 'text-outline');
  });
  btn.classList.remove('border-outline-variant', 'bg-surface-container-high', 'text-outline');
  btn.classList.add('border-blue-500', 'bg-blue-500/10', 'text-blue-400');
};

window.openPromoModal = function(id = null) {
  editingPromoId = id;
  const modal = document.getElementById('promo-modal');
  if (!modal) return;
  document.getElementById('form-promo')?.reset();
  document.getElementById('promo-modal-title').textContent = id ? 'Editar Promoção' : 'Nova Promoção';

  // Reset plat buttons to default (Uber)
  document.querySelectorAll('.plat-promo-btn').forEach(b => {
    b.classList.remove('border-blue-500', 'bg-blue-500/10', 'text-blue-400');
    b.classList.add('border-outline-variant', 'bg-surface-container-high', 'text-outline');
  });
  const defaultBtn = document.querySelector('.plat-promo-btn');
  if (defaultBtn) {
    defaultBtn.classList.remove('border-outline-variant', 'bg-surface-container-high', 'text-outline');
    defaultBtn.classList.add('border-blue-500', 'bg-blue-500/10', 'text-blue-400');
  }
  document.getElementById('f-promo-plat').value = 'Uber';

  if (id) {
    const p = APP_STATE.promos.find(x => x.id === id);
    if (p) {
      document.getElementById('f-promo-plat').value     = p.plat || 'Uber';
      document.getElementById('f-promo-desc').value     = p.desc || '';
      document.getElementById('f-promo-inicio').value   = p.inicio || '';
      document.getElementById('f-promo-fim').value      = p.fim || '';
      document.getElementById('f-promo-corridas').value = p.metaCorridas || '';
      document.getElementById('f-promo-bonus').value    = p.bonus || '';

      // Set the correct plat button active
      document.querySelectorAll('.plat-promo-btn').forEach(b => {
        b.classList.remove('border-blue-500', 'bg-blue-500/10', 'text-blue-400');
        b.classList.add('border-outline-variant', 'bg-surface-container-high', 'text-outline');
        if (b.textContent.trim() === p.plat) {
          b.classList.remove('border-outline-variant', 'bg-surface-container-high', 'text-outline');
          b.classList.add('border-blue-500', 'bg-blue-500/10', 'text-blue-400');
        }
      });
    }
  }
  modal.style.display = 'flex';
};

window.closePromoModal = function() {
  const modal = document.getElementById('promo-modal');
  if (modal) modal.style.display = 'none';
  editingPromoId = null;
};

window.salvarPromo = async function() {
  const plat   = document.getElementById('f-promo-plat').value;
  const desc   = document.getElementById('f-promo-desc').value.trim();
  const inicio = document.getElementById('f-promo-inicio').value;
  const fim    = document.getElementById('f-promo-fim').value;
  const metaCorridas = parseInt(document.getElementById('f-promo-corridas').value) || null;
  const bonus  = parseFloat((document.getElementById('f-promo-bonus').value || '').replace(',','.')) || null;

  if (!desc || !inicio || !fim) { utils.toast('Preencha descrição, início e fim', 'error'); return; }

  const payload = {
    user_id:      APP_STATE.user?.id,
    plataforma:   plat,
    descricao:    desc,
    data_inicio:  inicio,
    data_fim:     fim,
    meta_corridas: metaCorridas,
    bonus_valor:  bonus,
    ativa:        true,
  };

  const btn = document.getElementById('btn-salvar-promo');
  if (btn) { btn.disabled = true; }

  let error;
  if (editingPromoId) {
    ({ error } = await supabase.from('dashdriver_promos').update(payload).eq('id', editingPromoId));
  } else {
    ({ error } = await supabase.from('dashdriver_promos').insert([payload]));
  }

  if (btn) btn.disabled = false;
  if (error) { utils.toast('Erro ao salvar: ' + error.message, 'error'); return; }

  closePromoModal();
  await data.loadPromos();
  renderPromosDashboard();
  checkPromos();
  utils.toast(editingPromoId ? '✓ Promoção atualizada!' : '✓ Promoção cadastrada!', 'success');
};

window.concluirPromo = async function(id) {
  const { error } = await supabase.from('dashdriver_promos').update({ ativa: false }).eq('id', id);
  if (!error) {
    await data.loadPromos();
    renderPromosDashboard();
    utils.toast('Promoção concluída! ✅', 'success');
  }
};

window.excluirPromo = async function(id) {
  const { error } = await supabase.from('dashdriver_promos').delete().eq('id', id);
  if (!error) {
    await data.loadPromos();
    renderPromosDashboard();
    utils.toast('Promoção removida', 'success');
  }
};

// ─── Render cards no dashboard ─────────────────────────
window.renderPromosDashboard = function() {
  const el = document.getElementById('promos-dashboard');
  if (!el) return;
  const hoje = new Date().toLocaleDateString('sv-SE');
  const ativas = (APP_STATE.promos || []).filter(p => p.ativa && p.fim >= hoje);
  // also show promos that start in the future
  const futuras = (APP_STATE.promos || []).filter(p => p.ativa && p.inicio > hoje);

  el.style.display = 'block';

  if (ativas.length === 0 && futuras.length === 0) {
    el.innerHTML = `<div class="glass rounded-2xl p-3 sm:p-4">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-1.5">
          <span class="material-symbols-outlined text-orange-400" style="font-size:13px;font-variation-settings:'FILL' 1">local_offer</span>
          <span class="text-white text-xs font-semibold">Promoções</span>
        </div>
      </div>
      <button onclick="openPromoModal()" class="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-white/20 text-outline hover:text-orange-400 hover:border-orange-400/40 transition-all active:scale-95">
        <span class="material-symbols-outlined" style="font-size:16px">add</span>
        <span class="text-xs font-semibold">Cadastrar promoção do app</span>
      </button>
    </div>`;
    return;
  }

  const PLAT_COLOR = { Uber:'#000', '99':'#f97316', InDriver:'#0ea5e9', Particular:'#a855f7' };

  const renderCard = (p) => {
    const diasFim   = Math.ceil((new Date(p.fim)   - new Date(hoje)) / 86400000);
    const diasInicio = Math.ceil((new Date(p.inicio) - new Date(hoje)) / 86400000);
    const cor       = PLAT_COLOR[p.plat] || '#374151';
    const urgente   = diasFim <= 1 && p.inicio <= hoje;

    let progressoHtml = '';
    if (p.metaCorridas && p.inicio <= hoje) {
      const n = (APP_STATE.corridas||[]).filter(c => {
        const d = (c.data||'').slice(0,10); return d >= p.inicio && d <= p.fim;
      }).length;
      const pct = Math.min(100, (n / p.metaCorridas) * 100);
      progressoHtml = `<div class="mt-1.5">
        <div class="flex justify-between text-[9px] text-outline mb-0.5"><span>${n}/${p.metaCorridas} corridas</span><span>${pct.toFixed(0)}%</span></div>
        <div class="w-full h-1 bg-white/10 rounded-full"><div class="h-1 rounded-full" style="width:${pct}%;background:#f97316"></div></div>
      </div>`;
    }

    const statusTxt = p.inicio > hoje
      ? `Começa em ${diasInicio} dia(s)`
      : diasFim <= 0 ? 'Último dia!'
      : diasFim === 1 ? '⚠️ Amanhã é o último dia!'
      : `${diasFim} dias restantes`;

    return `<div class="flex items-start gap-2 py-2 border-b border-white/5 last:border-0">
      <span class="flex-shrink-0 px-1.5 py-0.5 rounded-md text-white text-[9px] font-black mt-0.5" style="background:${cor}">${p.plat||'—'}</span>
      <div class="flex-1 min-w-0">
        <p class="text-white text-[11px] font-semibold leading-snug">${p.desc}</p>
        <div class="flex items-center gap-2 mt-0.5">
          ${p.bonus ? `<span class="text-green-400 text-[10px] font-bold">+${utils.formatBRL(p.bonus)}</span>` : ''}
          <span class="${urgente ? 'text-red-400 font-bold' : 'text-outline'} text-[9px]">${statusTxt}</span>
        </div>
        ${progressoHtml}
      </div>
      <div class="flex gap-1 flex-shrink-0">
        <button onclick="openPromoModal('${p.id}')" class="text-outline hover:text-blue-400 transition-colors" title="Editar">
          <span class="material-symbols-outlined" style="font-size:15px">edit</span>
        </button>
        <button onclick="concluirPromo('${p.id}')" class="text-outline hover:text-green-400 transition-colors" title="Concluir">
          <span class="material-symbols-outlined" style="font-size:15px">check_circle</span>
        </button>
      </div>
    </div>`;
  };

  el.innerHTML = `<div class="glass rounded-2xl p-3 sm:p-4">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-1.5">
        <span class="material-symbols-outlined text-orange-400" style="font-size:13px;font-variation-settings:'FILL' 1">local_offer</span>
        <span class="text-white text-xs font-semibold">Promoções</span>
      </div>
      <button onclick="openPromoModal()" class="text-orange-400 text-[9px] font-bold hover:text-orange-300 transition-colors active:scale-95">+ Nova</button>
    </div>
    <div class="space-y-0">${[...ativas, ...futuras.filter(p => !ativas.includes(p))].map(renderCard).join('')}</div>
  </div>`;
};
