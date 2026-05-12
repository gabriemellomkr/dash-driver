/* DashDriver Settings Logic */

window.loadSettingsUI = function() {
  document.getElementById('cfg-nome').value      = CONFIG_DATA.nome || "Motorista";
  document.getElementById('cfg-preco').value     = CONFIG_DATA.precoLitro || 0;
  document.getElementById('cfg-consumo').value   = CONFIG_DATA.consumo || 0;
  document.getElementById('cfg-meta-d').value    = CONFIG_DATA.metaDiaria || 0;
  document.getElementById('cfg-rev-custo').value = CONFIG_DATA.custoRevisao || 0;
  document.getElementById('cfg-rev-km').value    = CONFIG_DATA.kmRevisao || 0;
};

window.saveSettings = async function() {
  const nome = document.getElementById('cfg-nome').value;
  const preco = parseFloat(document.getElementById('cfg-preco').value) || 0;
  const consumo = parseFloat(document.getElementById('cfg-consumo').value) || 0;
  const metaD = parseFloat(document.getElementById('cfg-meta-d').value) || 0;
  const revCusto = parseFloat(document.getElementById('cfg-rev-custo').value) || 0;
  const revKm = parseFloat(document.getElementById('cfg-rev-km').value) || 0;

  const newConfig = {
    nome,
    precoLitro: preco,
    consumo,
    metaDiaria: metaD,
    custoRevisao: revCusto,
    kmRevisao: revKm
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

  if (typeof closeSettings === 'function') closeSettings();
  if (typeof renderDashboard === 'function') renderDashboard();
};

// Alias para compatibilidade com ui.js
window.loadSettings = window.loadSettingsUI;

