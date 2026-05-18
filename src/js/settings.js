/* DashDriver Settings Logic */

// Aceita vírgula ou ponto como separador decimal (pt-BR e en)
function parseNum(id) {
  const raw = (document.getElementById(id)?.value || '').replace(',', '.');
  return parseFloat(raw) || 0;
}

window.atualizaCustoKm = function() {
  const el = document.getElementById('cfg-custo-km-display');
  if (!el) return;
  const preco    = parseNum('cfg-preco');
  const consumo  = parseNum('cfg-consumo');
  const revCusto = parseNum('cfg-rev-custo');
  const revKm    = parseNum('cfg-rev-km');
  if (consumo <= 0) { el.textContent = 'R$ —'; return; }
  const total = (preco / consumo) + (revKm > 0 ? revCusto / revKm : 0);
  el.textContent = 'R$ ' + total.toFixed(2).replace('.', ',') + '/km';
};

window.loadSettingsUI = function() {
  const set = (id, val) => { const e = document.getElementById(id); if (e) e.value = val ?? ''; };

  set('cfg-nome',     CONFIG_DATA.nome || 'Motorista');
  set('cfg-preco',    CONFIG_DATA.precoLitro  || '');
  set('cfg-consumo',  CONFIG_DATA.consumo     || '');
  set('cfg-meta-d',   CONFIG_DATA.metaDiaria  || '');
  set('cfg-meta-s',   CONFIG_DATA.metaSemanal || '');
  set('cfg-meta-m',   CONFIG_DATA.metaMensal  || '');
  set('cfg-rev-custo',CONFIG_DATA.custoRevisao|| '');
  set('cfg-rev-km',   CONFIG_DATA.kmRevisao   || '');
  set('cfg-preco-km', CONFIG_DATA.precoKm     || '');

  // Fuso horário
  const tzEl = document.getElementById('cfg-timezone');
  if (tzEl) tzEl.value = CONFIG_DATA.timezone || 'America/Sao_Paulo';

  // WhatsApp
  set('cfg-telefone', CONFIG_DATA.telefone || '');

  // Veículo — lê do cache local (populado pelo loadConfig do Supabase)
  const _v = JSON.parse(localStorage.getItem('dd_veiculo') || '{}');
  set('cfg-v-modelo',   _v.modelo);
  set('cfg-v-placa',    _v.placa);
  set('cfg-v-renavan',  _v.renavan);
  set('cfg-v-cnh-num',  _v.cnhNum);
  set('cfg-v-cnh-venc', _v.cnhVenc);
  set('cfg-v-ipva',     _v.ipva);
  set('cfg-v-seguro',   _v.seguro);
  set('cfg-v-licenc',   _v.licenc);
  const catEl = document.getElementById('cfg-v-cnh-cat');
  if (catEl) catEl.value = _v.cnhCat || '';

  setTimeout(atualizaCustoKm, 0);
};

window.saveSettings = function() {
  try {
    const nome     = document.getElementById('cfg-nome')?.value || '';
    const preco    = parseNum('cfg-preco');
    const consumo  = parseNum('cfg-consumo');
    const metaD    = parseNum('cfg-meta-d');
    const metaS    = parseNum('cfg-meta-s');
    const metaM    = parseNum('cfg-meta-m');
    const revCusto = parseNum('cfg-rev-custo');
    const revKm    = parseNum('cfg-rev-km');
    const precoKm  = parseNum('cfg-preco-km');
    const timezone = document.getElementById('cfg-timezone')?.value || 'America/Sao_Paulo';
    const telefone = (document.getElementById('cfg-telefone')?.value || '').replace(/\D/g, '');

    // 1. Atualiza estado local imediatamente
    Object.assign(CONFIG_DATA, { nome, precoLitro: preco, consumo,
      metaDiaria: metaD, metaSemanal: metaS, metaMensal: metaM,
      custoRevisao: revCusto, kmRevisao: revKm, precoKm, timezone, telefone });
    localStorage.setItem('dash_config', JSON.stringify(CONFIG_DATA));

    const gV = id => document.getElementById(id)?.value || '';
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

    // 2. Fecha e dá feedback imediato
    if (typeof closeSettings  === 'function') closeSettings();
    utils.toast('Configurações salvas!', 'success');
    if (typeof renderCarteira  === 'function') renderCarteira();
    if (typeof renderDashboard === 'function') renderDashboard();

    // 3. Supabase em background
    if (APP_STATE.user) {
      supabase.from('dashdriver_config').upsert({
        user_id:       APP_STATE.user.id,
        nome,
        preco_litro:   preco,
        consumo,
        meta_diaria:   metaD,
        meta_semanal:  metaS,
        meta_mensal:   metaM,
        custo_revisao: revCusto,
        km_revisao:    revKm,
        preco_km:      precoKm,
        timezone,
        telefone,
        veiculo:       vData,
        updated_at:    new Date().toISOString()
      }, { onConflict: 'user_id' })
      .then(({ error }) => {
        if (error) console.error('Supabase config:', error.message);
      });
    }
  } catch (err) {
    console.error('saveSettings:', err);
    utils.toast('Erro ao salvar: ' + err.message, 'error');
  }
};

window.loadSettings = window.loadSettingsUI;
