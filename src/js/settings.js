/* DashDriver Settings Logic */

window.atualizaCustoKm = function() {
  const preco   = parseFloat(document.getElementById('cfg-preco')?.value) || 0;
  const consumo = parseFloat(document.getElementById('cfg-consumo')?.value) || 0;
  const revCusto = parseFloat(document.getElementById('cfg-rev-custo')?.value) || 0;
  const revKm    = parseFloat(document.getElementById('cfg-rev-km')?.value) || 0;
  const el = document.getElementById('cfg-custo-km-display');
  if (!el) return;
  if (consumo <= 0) { el.textContent = 'R$ —'; return; }
  const custoGas = preco / consumo;
  const custoRev = revKm > 0 ? revCusto / revKm : 0;
  const total = custoGas + custoRev;
  el.textContent = 'R$ ' + total.toFixed(2).replace('.', ',') + '/km';
};

window.loadSettingsUI = function() {
  document.getElementById('cfg-nome').value      = CONFIG_DATA.nome || "Motorista";
  document.getElementById('cfg-preco').value     = CONFIG_DATA.precoLitro || 0;
  document.getElementById('cfg-consumo').value   = CONFIG_DATA.consumo || 0;
  document.getElementById('cfg-meta-d').value    = CONFIG_DATA.metaDiaria || 0;
  document.getElementById('cfg-rev-custo').value = CONFIG_DATA.custoRevisao || 0;
  document.getElementById('cfg-rev-km').value    = CONFIG_DATA.kmRevisao || 0;
  const pkEl = document.getElementById('cfg-preco-km');
  if (pkEl) pkEl.value = CONFIG_DATA.precoKm || '';
  setTimeout(atualizaCustoKm, 0);

  // Vehicle data
  const _v = JSON.parse(localStorage.getItem('dd_veiculo') || '{}');
  const cfgV = (id, val) => { const e = document.getElementById(id); if(e) e.value = val || ''; };
  cfgV('cfg-v-modelo',   _v.modelo);
  cfgV('cfg-v-placa',    _v.placa);
  cfgV('cfg-v-renavan',  _v.renavan);
  cfgV('cfg-v-cnh-num',  _v.cnhNum);
  cfgV('cfg-v-cnh-cat',  _v.cnhCat);
  cfgV('cfg-v-cnh-venc', _v.cnhVenc);
  cfgV('cfg-v-ipva',     _v.ipva);
  cfgV('cfg-v-seguro',   _v.seguro);
  cfgV('cfg-v-licenc',   _v.licenc);
};

window.saveSettings = function() {
  const nome     = document.getElementById('cfg-nome').value;
  const preco    = parseFloat(document.getElementById('cfg-preco').value)     || 0;
  const consumo  = parseFloat(document.getElementById('cfg-consumo').value)   || 0;
  const metaD    = parseFloat(document.getElementById('cfg-meta-d').value)    || 0;
  const revCusto = parseFloat(document.getElementById('cfg-rev-custo').value) || 0;
  const revKm    = parseFloat(document.getElementById('cfg-rev-km').value)    || 0;
  const precoKm  = parseFloat(document.getElementById('cfg-preco-km')?.value) || 0;

  // 1. Salva local imediatamente
  Object.assign(CONFIG_DATA, { nome, precoLitro: preco, consumo, metaDiaria: metaD,
    custoRevisao: revCusto, kmRevisao: revKm, precoKm });
  localStorage.setItem('dash_config', JSON.stringify(CONFIG_DATA));

  const gV = (id) => { const e = document.getElementById(id); return e ? e.value : ''; };
  const vData = {
    modelo:  gV('cfg-v-modelo'),
    placa:   gV('cfg-v-placa').toUpperCase(),
    renavan: gV('cfg-v-renavan'),
    cnhNum:  gV('cfg-v-cnh-num'),
    cnhCat:  gV('cfg-v-cnh-cat'),
    cnhVenc: gV('cfg-v-cnh-venc'),
    ipva:    gV('cfg-v-ipva'),
    seguro:  gV('cfg-v-seguro'),
    licenc:  gV('cfg-v-licenc'),
  };
  localStorage.setItem('dd_veiculo', JSON.stringify(vData));

  // 2. Fecha modal e dá feedback imediato
  if (typeof closeSettings === 'function') closeSettings();
  utils.toast('Configurações salvas!', 'success');
  if (typeof renderCarteira   === 'function') renderCarteira();
  if (typeof renderDashboard  === 'function') renderDashboard();

  // 3. Sincroniza com Supabase em background (fire-and-forget)
  if (APP_STATE.user) {
    supabase.from('dashdriver_config').upsert({
      user_id:      APP_STATE.user.id,
      nome,
      preco_litro:  preco,
      consumo,
      meta_diaria:  metaD,
      custo_revisao: revCusto,
      km_revisao:   revKm,
      preco_km:     precoKm,
      updated_at:   new Date().toISOString()
    }, { onConflict: 'user_id' })
    .then(({ error }) => {
      if (error) console.error('Supabase config:', error);
    });
  }
};

// Alias para compatibilidade com ui.js
window.loadSettings = window.loadSettingsUI;

