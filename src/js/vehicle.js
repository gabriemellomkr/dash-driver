/* DashDriver Vehicle Logic */

function renderVeiculo() {
  const v = JSON.parse(localStorage.getItem('dd_veiculo') || '{}');
  document.getElementById('v-modelo').value  = v.modelo  || '';
  document.getElementById('v-placa').value   = v.placa   || '';
  document.getElementById('v-renavan').value = v.renavan || '';
  document.getElementById('v-cnh-num').value = v.cnhNum  || '';
  document.getElementById('v-cnh-venc').value= v.cnhVenc || '';
  document.getElementById('v-ipva').value    = v.ipva    || '';
  document.getElementById('v-seguro').value  = v.seguro  || '';
  document.getElementById('v-licenc').value  = v.licenc  || '';
  updateVeiculoStatus();
}

function updateVeiculoStatus() {
  const v = JSON.parse(localStorage.getItem('dd_veiculo') || '{}');
  const today = new Date(todayStr());
  
  const checkVenc = (dateStr, label) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const diff = Math.ceil((d - today) / (1000 * 60 * 60 * 24));
    let col = '#4ade80';
    let msg = `Vence em ${diff} dias`;
    if (diff <= 0)  { col = '#f87171'; msg = 'Vencido!'; }
    else if (diff <= 30) { col = '#fb923c'; msg = `Vence em ${diff} dias`; }
    return `<div style="display:flex;justify-content:space-between;font-size:10px"><span style="color:#8b90a0">${label}</span><span style="color:${col};font-weight:700">${msg}</span></div>`;
  };

  document.getElementById('cnh-status').innerHTML = checkVenc(v.cnhVenc, 'Status CNH');
  document.getElementById('docs-status').innerHTML = 
    checkVenc(v.ipva, 'IPVA') +
    checkVenc(v.seguro, 'Seguro') +
    checkVenc(v.licenc, 'Licenciamento');
}

function salvarVeiculo() {
  const v = {
    modelo:  document.getElementById('v-modelo').value,
    placa:   document.getElementById('v-placa').value.toUpperCase(),
    renavan: document.getElementById('v-renavan').value,
    cnhNum:  document.getElementById('v-cnh-num').value,
    cnhVenc: document.getElementById('v-cnh-venc').value,
    ipva:    document.getElementById('v-ipva').value,
    seguro:  document.getElementById('v-seguro').value,
    licenc:  document.getElementById('v-licenc').value,
  };
  localStorage.setItem('dd_veiculo', JSON.stringify(v));
  sbUpsert('dashdriver_veiculo', [{ id: 1, ...v, updated_at: new Date().toISOString() }]);
  showToast('✓ Dados do veículo salvos!');
  updateVeiculoStatus();
}
