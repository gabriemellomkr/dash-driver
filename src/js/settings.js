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
  atualizaCustoKm();

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

window.saveSettings = async function() {
  const nome = document.getElementById('cfg-nome').value;
  const preco = parseFloat(document.getElementById('cfg-preco').value) || 0;
  const consumo = parseFloat(document.getElementById('cfg-consumo').value) || 0;
  const metaD = parseFloat(document.getElementById('cfg-meta-d').value) || 0;
  const revCusto = parseFloat(document.getElementById('cfg-rev-custo').value) || 0;
  const revKm = parseFloat(document.getElementById('cfg-rev-km').value) || 0;

  const precoKm = parseFloat(document.getElementById('cfg-preco-km')?.value) || 0;

  const newConfig = {
    nome,
    precoLitro: preco,
    consumo,
    metaDiaria: metaD,
    custoRevisao: revCusto,
    kmRevisao: revKm,
    precoKm,
  };

  // Atualiza estado local
  Object.assign(CONFIG_DATA, newConfig);
  localStorage.setItem('dash_config', JSON.stringify(CONFIG_DATA));

  // Salva no Supabase se houver usuário
  if (APP_STATE.user) {
    try {
      const { error } = await supabase
        .from('dashdriver_config')
        .upsert({
          user_id: APP_STATE.user.id,
          nome: nome,
          preco_litro: preco,
          consumo: consumo,
          meta_diaria: metaD,
          custo_revisao: revCusto,
          km_revisao: revKm,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) throw error;
      utils.toast("Configurações salvas!", "success");
    } catch (e) {
      console.error("Erro ao salvar config no Supabase:", e);
      utils.toast("Salvo localmente (erro no servidor)", "warning");
    }
  } else {
    utils.toast("Configurações salvas localmente", "success");
  }

  // Save vehicle data
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
  if (typeof renderCarteira === 'function') renderCarteira();

  if (typeof closeSettings === 'function') closeSettings();
  if (typeof renderDashboard === 'function') renderDashboard();
};

// Alias para compatibilidade com ui.js
window.loadSettings = window.loadSettingsUI;

