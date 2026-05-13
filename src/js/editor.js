/* DashDriver Editor/Forms Logic */

let editingId = null;

function todayStr() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: CONFIG_DATA.timezone || 'America/Sao_Paulo' });
}

window.openModal = function() {
  editingId = null;
  document.getElementById('modal-title').textContent = 'Lançar Corrida';
  const modal = document.getElementById('insert-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');

  const form = document.getElementById('form-corrida');
  if (form) form.reset();

  // Data padrão = hoje
  const fData = document.getElementById('f-data');
  if (fData) fData.value = todayStr();

  // Reset UI
  const firstPlatBtn = document.querySelector('.plat-btn');
  if (firstPlatBtn) setPlat('Uber', firstPlatBtn);
  const firstPagBtn = document.querySelector('.pag-btn');
  if (firstPagBtn) setPag('App', firstPagBtn);
  setTipoReg('normal');

  document.getElementById('f-stats-badge').classList.add('hidden');
  document.getElementById('form-error').classList.add('hidden');
};

window.setPlat = function(plat, btn) {
  document.getElementById('f-plataforma').value = plat;
  document.querySelectorAll('.plat-btn').forEach(b => {
    b.classList.remove('border-blue-500', 'bg-blue-500/10', 'text-blue-400');
    b.classList.add('border-outline-variant', 'bg-surface-container-high', 'text-outline');
  });
  btn.classList.remove('border-outline-variant', 'bg-surface-container-high', 'text-outline');
  btn.classList.add('border-blue-500', 'bg-blue-500/10', 'text-blue-400');
  calcQuickStats();
};

window.setPag = function(pag, btn) {
  document.getElementById('f-pagamento').value = pag;
  document.querySelectorAll('.pag-btn').forEach(b => {
    b.classList.remove('border-blue-500', 'bg-blue-500/10', 'text-blue-400');
    b.classList.add('border-outline-variant', 'bg-surface-container-high', 'text-outline');
  });
  btn.classList.remove('border-outline-variant', 'bg-surface-container-high', 'text-outline');
  btn.classList.add('border-blue-500', 'bg-blue-500/10', 'text-blue-400');
};

window.setTipoReg = function(tipo) {
  document.getElementById('f-tipo-reg').value = tipo;
  const bNormal = document.getElementById('btn-tipo-normal');
  const bCancel = document.getElementById('btn-tipo-cancel');
  const fKm     = document.getElementById('field-km');
  const inputKm = document.getElementById('f-km');

  if (tipo === 'cancel') {
    bCancel.classList.add('bg-blue-500', 'text-white');
    bCancel.classList.remove('text-outline');
    bNormal.classList.remove('bg-blue-500', 'text-white');
    bNormal.classList.add('text-outline');
    fKm.style.opacity = '0.3';
    inputKm.disabled = true;
    inputKm.value = '0';
  } else {
    bNormal.classList.add('bg-blue-500', 'text-white');
    bNormal.classList.remove('text-outline');
    bCancel.classList.remove('bg-blue-500', 'text-white');
    bCancel.classList.add('text-outline');
    fKm.style.opacity = '1';
    inputKm.disabled = false;
    if (inputKm.value === '0') inputKm.value = '';
  }
  calcQuickStats();
};

window.calcQuickStats = function() {
  const km  = parseFloat(document.getElementById('f-km').value) || 0;
  const liq = parseFloat(document.getElementById('f-liquido').value) || 0;
  const badge    = document.getElementById('f-stats-badge');
  const label    = document.getElementById('f-stats-label');
  const rpkmVal  = document.getElementById('f-stats-rpkm');

  if (km > 0 && liq > 0) {
    badge.classList.remove('hidden');
    const rpkm = liq / km;
    rpkmVal.textContent = `R$ ${rpkm.toFixed(2).replace('.', ',')}`;

    if (rpkm >= 2.5) {
      label.textContent = '💎 EXCELENTE';
      label.className = 'text-xs font-bold text-blue-400';
    } else if (rpkm >= 2.0) {
      label.textContent = '✅ BOA';
      label.className = 'text-xs font-bold text-green-400';
    } else if (rpkm >= 1.5) {
      label.textContent = '⚠️ REGULAR';
      label.className = 'text-xs font-bold text-yellow-500';
    } else {
      label.textContent = '❌ RUIM';
      label.className = 'text-xs font-bold text-red-400';
    }
  } else {
    badge.classList.add('hidden');
  }
};

window.editarCorrida = function(id) {
  const c = APP_STATE.corridas.find(x => x.id === id);
  if (!c) return;
  editingId = id;
  document.getElementById('modal-title').textContent = 'Editar Corrida';
  const modal = document.getElementById('insert-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');

  const form = document.getElementById('form-corrida');
  if (form) form.reset();

  // Data da corrida (extrai só YYYY-MM-DD do ISO)
  const fData = document.getElementById('f-data');
  if (fData) fData.value = (c.data || '').split('T')[0] || todayStr();

  // Plataforma
  const platBtn = Array.from(document.querySelectorAll('.plat-btn')).find(b => b.innerText.includes(c.plat));
  if (platBtn) setPlat(c.plat, platBtn);

  // Pagamento
  const pagBtn = Array.from(document.querySelectorAll('.pag-btn')).find(b => b.innerText.includes(c.pag));
  if (pagBtn) setPag(c.pag, pagBtn);

  document.getElementById('f-km').value      = c.km || '';
  document.getElementById('f-bruto').value   = c.bruto || '';
  document.getElementById('f-liquido').value = c.liquido || '';
  document.getElementById('f-gorjeta').value = c.outras || '';

  setTipoReg(c.km === 0 ? 'cancel' : 'normal');
  calcQuickStats();
  document.getElementById('form-error').classList.add('hidden');
};

window.closeModal = function() {
  const modal = document.getElementById('insert-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  editingId = null;
};

window.salvarCorrida = async function() {
  const errEl = document.getElementById('form-error');
  errEl.classList.add('hidden');

  const plataforma = document.getElementById('f-plataforma').value;
  const pagamento  = document.getElementById('f-pagamento').value;
  const tipoReg    = document.getElementById('f-tipo-reg').value;
  const km         = parseFloat(document.getElementById('f-km').value) || 0;
  const liquido    = parseFloat(document.getElementById('f-liquido').value);
  const bruto      = parseFloat(document.getElementById('f-bruto').value) || liquido;
  const outras     = parseFloat(document.getElementById('f-gorjeta').value) || 0;

  // Data selecionada ou hoje como fallback
  const dataInput  = document.getElementById('f-data')?.value || todayStr();
  const dataISO    = `${dataInput}T00:00:00`;

  // Validação: apenas valor líquido é obrigatório
  if (isNaN(liquido) || liquido <= 0) {
    errEl.classList.remove('hidden');
    errEl.textContent = 'Informe o valor líquido da corrida.';
    return;
  }

  const btn = document.getElementById('btn-salvar');
  btn.disabled = true;
  const originalText = btn.innerHTML;
  btn.innerHTML = '<span class="material-symbols-outlined animate-spin" style="font-size:20px">sync</span> PROCESSANDO...';

  const payload = {
    plataforma,
    pagamento,
    km,
    bruto,
    liquido,
    outras,
    data: dataISO,
    user_id: APP_STATE.user?.id
  };

  let error;
  if (editingId) {
    ({ error } = await supabase.from('dashdriver_corridas').update(payload).eq('id', editingId));
  } else {
    ({ error } = await supabase.from('dashdriver_corridas').insert([payload]));
  }

  btn.disabled = false;
  btn.innerHTML = originalText;

  if (error) {
    utils.toast('Erro ao salvar: ' + (error.message || ''), 'error');
    return;
  }

  closeModal();
  await data.loadCorridas();
  renderDashboard();
  renderHistorico();
  utils.toast(editingId ? '✓ Alterado com sucesso!' : '✓ Corrida registrada!', 'success');
};
