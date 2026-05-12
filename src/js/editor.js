/* DashDriver Editor/Forms Logic */

let editingId = null;

function nowTimeStr() {
  const n = new Date();
  return String(n.getHours()).padStart(2,'0') + ':' + String(n.getMinutes()).padStart(2,'0');
}

function todayStr() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: CONFIG_DATA.timezone || 'America/Sao_Paulo' });
}

window.openModal = function() {
  editingId = null;
  document.getElementById('modal-title').textContent = 'Lançar Corrida';
  document.getElementById('btn-salvar').innerHTML = '<span class="material-symbols-outlined" style="font-size:18px">save</span> Registrar Corrida';
  const modal = document.getElementById('insert-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.getElementById('add-ride-form').reset();
  document.getElementById('f-data').value = todayStr();
  document.getElementById('f-hora').value = nowTimeStr();
  highlightDateBtn();
  document.getElementById('preview-card').classList.add('hidden');
  document.getElementById('form-error').classList.add('hidden');
  document.getElementById('taxa-preview').style.display = 'none';
};

window.editarCorrida = function(id) {
  const c = APP_STATE.corridas.find(x => x.id === id);
  if (!c) return;
  editingId = id;
  document.getElementById('modal-title').textContent = 'Editar Corrida';
  document.getElementById('btn-salvar').innerHTML = '<span class="material-symbols-outlined" style="font-size:18px">edit</span> Salvar alterações';
  const modal = document.getElementById('insert-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.getElementById('add-ride-form').reset();
  document.getElementById('f-plat').value    = c.plat;
  document.getElementById('f-pag').value     = c.pag;
  document.getElementById('f-km').value      = c.km;
  document.getElementById('f-bruto').value   = c.bruto;
  document.getElementById('f-outras').value  = c.outras || '';
  document.getElementById('f-liquido').value = c.liquido;
  const rawData = c.data || '';
  document.getElementById('f-data').value = rawData.split('T')[0];
  const timePart = rawData.includes('T') ? rawData.split('T')[1].slice(0,5) : '';
  document.getElementById('f-hora').value = timePart;
  highlightDateBtn();
  calcTaxa();
  document.getElementById('form-error').classList.add('hidden');
};

window.closeModal = function() {
  const modal = document.getElementById('insert-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  editingId = null;
};

window.calcTaxa = function() {
  const bruto = parseFloat(document.getElementById('f-bruto').value) || 0;
  const liq   = parseFloat(document.getElementById('f-liquido').value) || 0;
  const el    = document.getElementById('taxa-preview');
  if (bruto > 0 && liq > 0 && bruto > liq) {
    const diff = bruto - liq;
    const pct  = (diff / bruto * 100).toFixed(1);
    el.style.display = 'flex';
    document.getElementById('taxa-pct-display').textContent = `${pct}%  (−${utils.formatBRL(diff)})`;
  } else {
    el.style.display = 'none';
  }
  calcPreview();
};

function calcPreview() {
  const km   = parseFloat(document.getElementById('f-km').value)     || 0;
  const liq  = parseFloat(document.getElementById('f-liquido').value) || 0;
  const prev = document.getElementById('preview-card');
  if (!km || !liq) { prev.classList.add('hidden'); return; }

  const custoKm = CONFIG_DATA.precoLitro > 0 && CONFIG_DATA.consumo > 0
    ? (CONFIG_DATA.precoLitro / CONFIG_DATA.consumo)
    : 0;
  const custoOp = km * custoKm;
  const lucro   = liq - custoOp;
  const rpkm    = liq / km;

  prev.classList.remove('hidden');
  document.getElementById('preview-body').innerHTML = `
    <div style="text-align:center">
      <div style="color:#8b90a0;font-size:8px;font-weight:700;text-transform:uppercase;margin-bottom:4px">Custo op.</div>
      <div style="color:#f87171;font-size:14px;font-weight:800">${utils.formatBRL(custoOp)}</div>
    </div>
    <div style="text-align:center">
      <div style="color:#8b90a0;font-size:8px;font-weight:700;text-transform:uppercase;margin-bottom:4px">Lucro</div>
      <div style="color:${lucro >= 0 ? '#4ade80' : '#f87171'};font-size:14px;font-weight:800">${utils.formatBRL(lucro)}</div>
    </div>
    <div style="text-align:center">
      <div style="color:#8b90a0;font-size:8px;font-weight:700;text-transform:uppercase;margin-bottom:4px">R$/km</div>
      <div style="color:white;font-size:14px;font-weight:800">${rpkm.toFixed(2).replace('.', ',')}</div>
    </div>`;
}

window.salvarCorrida = async function() {
  const errEl = document.getElementById('form-error');
  errEl.classList.add('hidden');

  const plataforma = document.getElementById('f-plat').value;
  const pagamento  = document.getElementById('f-pag').value;
  const km      = parseFloat(document.getElementById('f-km').value);
  const bruto   = parseFloat(document.getElementById('f-bruto').value);
  const liquido = parseFloat(document.getElementById('f-liquido').value);
  const outras  = parseFloat(document.getElementById('f-outras').value) || 0;
  const dataVal = document.getElementById('f-data').value;
  const horaVal = document.getElementById('f-hora').value;
  const dataISO = dataVal ? (horaVal ? `${dataVal}T${horaVal}:00` : dataVal) : '';

  if (!km || !bruto || !liquido || !dataVal || isNaN(km) || isNaN(bruto) || isNaN(liquido)) {
    errEl.classList.remove('hidden');
    return;
  }

  const btn = document.getElementById('btn-salvar');
  btn.disabled = true;
  btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px">sync</span> Salvando...';

  const payload = { plataforma, pagamento, km, bruto, liquido, outras, data: dataISO, user_id: APP_STATE.user?.id };
  let error;

  if (editingId) {
    ({ error } = await supabase.from('dashdriver_corridas').update(payload).eq('id', editingId));
  } else {
    ({ error } = await supabase.from('dashdriver_corridas').insert([payload]));
  }

  btn.disabled = false;
  btn.innerHTML = editingId
    ? '<span class="material-symbols-outlined" style="font-size:18px">edit</span> Salvar alterações'
    : '<span class="material-symbols-outlined" style="font-size:18px">save</span> Registrar Corrida';

  if (error) {
    utils.toast('Erro ao salvar: ' + (error.message || ''), 'error');
    errEl.classList.remove('hidden');
    return;
  }

  closeModal();
  await data.loadCorridas();
  renderDashboard();
  renderHistorico();
  utils.toast(editingId ? '✓ Corrida atualizada!' : '✓ Corrida registrada!', 'success');
};

window.setFormData = function(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const str = d.toLocaleDateString('sv-SE', { timeZone: CONFIG_DATA.timezone || 'America/Sao_Paulo' });
  document.getElementById('f-data').value = str;
  highlightDateBtn();
};

window.highlightDateBtn = function() {
  const val   = document.getElementById('f-data').value;
  const today = todayStr();
  const ontem = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toLocaleDateString('sv-SE'); })();
  const ante  = (() => { const d = new Date(); d.setDate(d.getDate() - 2); return d.toLocaleDateString('sv-SE'); })();

  const active   = 'background:rgba(59,130,246,.2);border-color:rgba(59,130,246,.5);color:#93c5fd';
  const inactive = 'background:transparent;border-color:#414755;color:#8b90a0';

  document.getElementById('btn-hoje').style.cssText       = val === today ? active : inactive;
  document.getElementById('btn-ontem').style.cssText      = val === ontem ? active : inactive;
  document.getElementById('btn-anteontem').style.cssText  = val === ante  ? active : inactive;
};
