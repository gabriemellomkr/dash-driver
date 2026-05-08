/* DashDriver Settings Logic */

const AVATARS = ['🏍️','🚗','🛵','🚐','🚕','🤑','😎','🚀','⚡','🔥','💰','🏆','💎','👑','🎯','💪'];

function loadPerfil() {
  try { return JSON.parse(localStorage.getItem('dd_perfil') || '{"nome":"Motorista","avatar":"🏍️"}'); }
  catch { return { nome: 'Motorista', avatar: '🏍️' }; }
}

function openSettings() {
  const modal = document.getElementById('settings-modal');
  modal.style.display = 'flex';
  document.getElementById('cfg-preco-litro').value   = CONFIG_DATA.precoLitro;
  document.getElementById('cfg-consumo').value       = CONFIG_DATA.consumo;
  document.getElementById('cfg-custo-revisao').value = CONFIG_DATA.custoRevisao;
  document.getElementById('cfg-km-revisao').value    = CONFIG_DATA.kmRevisao;
  document.getElementById('cfg-meta').value          = CONFIG_DATA.metaDia;
  document.getElementById('cfg-meta-semana').value   = CONFIG_DATA.metaSemana;
  document.getElementById('cfg-meta-mes').value      = CONFIG_DATA.metaMes;
  document.getElementById('cfg-timezone').value      = CONFIG_DATA.timezone || 'America/Sao_Paulo';
  const perfil = loadPerfil();
  document.getElementById('cfg-nome').value  = perfil.nome;
  document.getElementById('avatar-btn').textContent = perfil.avatar;
  updateCustoPreview();
}

function closeSettings() {
  document.getElementById('settings-modal').style.display = 'none';
}

function updateCustoPreview() {
  const preco    = parseFloat(document.getElementById('cfg-preco-litro').value)   || 0;
  const consumo  = parseFloat(document.getElementById('cfg-consumo').value)       || 1;
  const revisao  = parseFloat(document.getElementById('cfg-custo-revisao').value) || 0;
  const kmRev    = parseFloat(document.getElementById('cfg-km-revisao').value)    || 1;
  const gasKm    = preco / consumo;
  const revKm    = revisao / kmRev;
  const totalKm  = gasKm + revKm;
  document.getElementById('cfg-custo-preview').textContent  = 'R$ ' + gasKm.toFixed(3).replace('.', ',') + '/km';
  document.getElementById('cfg-rev-preview').textContent    = 'R$ ' + revKm.toFixed(3).replace('.', ',') + '/km';
  document.getElementById('cfg-total-preview').textContent  = 'R$ ' + totalKm.toFixed(3).replace('.', ',') + '/km';
  document.getElementById('cfg-total-breakdown').textContent= `R$${gasKm.toFixed(3).replace('.',',')} gas + R$${revKm.toFixed(3).replace('.',',')} rev`;
}

function saveSettings() {
  const parseVal = (id) => {
    const val = document.getElementById(id).value.replace(',', '.');
    return parseFloat(val);
  };

  const precoLitro   = parseVal('cfg-preco-litro');
  const consumo      = parseVal('cfg-consumo');
  const custoRevisao = parseVal('cfg-custo-revisao');
  const kmRevisao    = parseVal('cfg-km-revisao');
  const metaDia      = parseVal('cfg-meta');
  const metaSemana   = parseVal('cfg-meta-semana');
  const metaMes      = parseVal('cfg-meta-mes');

  if (isNaN(precoLitro) || isNaN(consumo) || consumo <= 0) {
    showToast('Verifique os campos de combustível');
    return;
  }

  const nomePerfil = document.getElementById('cfg-nome').value || 'Motorista';
  const avatarPerfil = document.getElementById('avatar-btn').textContent || '🏍️';
  const perfil = { nome: nomePerfil, avatar: avatarPerfil };
  localStorage.setItem('dd_perfil', JSON.stringify(perfil));
  updateHeader();

  const timezone = document.getElementById('cfg-timezone').value || CONFIG_DEFAULTS.timezone;
  const newConfig = {
    precoLitro,
    consumo,
    custoRevisao: isNaN(custoRevisao) ? CONFIG_DEFAULTS.custoRevisao : custoRevisao,
    kmRevisao:    isNaN(kmRevisao)    ? CONFIG_DEFAULTS.kmRevisao    : kmRevisao,
    metaDia:      isNaN(metaDia)      ? CONFIG_DEFAULTS.metaDia      : metaDia,
    metaSemana:   isNaN(metaSemana)   ? CONFIG_DEFAULTS.metaSemana   : metaSemana,
    metaMes:      isNaN(metaMes)      ? CONFIG_DEFAULTS.metaMes      : metaMes,
    timezone,
  };

  Object.assign(CONFIG_DATA, newConfig);
  localStorage.setItem('dd_config', JSON.stringify(newConfig));
  
  sbUpsert('dashdriver_config', [{
    id: 1,
    preco_litro: newConfig.precoLitro,
    consumo: newConfig.consumo,
    custo_revisao: newConfig.custoRevisao,
    km_revisao: newConfig.kmRevisao,
    meta_dia: newConfig.metaDia,
    meta_semana: newConfig.metaSemana,
    meta_mes: newConfig.metaMes,
    timezone: newConfig.timezone,
    nome_perfil: perfil.nome,
    avatar_perfil: perfil.avatar,
    updated_at: new Date().toISOString()
  }]);

  closeSettings();
  updateDash();
  showToast('✓ Configurações salvas!');
}

function toggleAvatarPicker() {
  const picker = document.getElementById('avatar-picker');
  if (picker.classList.contains('hidden')) {
    picker.innerHTML = AVATARS.map(a => `<button onclick="setAvatar('${a}')" class="text-2xl p-2 hover:bg-white/10 rounded-lg active:scale-90 transition-all">${a}</button>`).join('');
    picker.classList.remove('hidden');
  } else {
    picker.classList.add('hidden');
  }
}

function setAvatar(a) {
  document.getElementById('avatar-btn').textContent = a;
  document.getElementById('avatar-picker').classList.add('hidden');
}
