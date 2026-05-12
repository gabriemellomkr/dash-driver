/**
 * DashDriver - Financial
 * Income and expense management.
 */

window.renderFinanceiro = function() {
  const receitas = APP_STATE.corridas.reduce((s, c) => s + c.liquido, 0);
  const despesas = APP_STATE.despesas.reduce((s, d) => s + d.valor, 0);
  const gas = APP_STATE.abastecimentos.reduce((s, a) => s + a.valor, 0);
  const totalDespesas = despesas + gas;
  
  document.getElementById('fin-receita').textContent = utils.formatBRL(receitas);
  document.getElementById('fin-despesas').textContent = utils.formatBRL(totalDespesas);
  document.getElementById('fin-resultado').textContent = utils.formatBRL(receitas - totalDespesas);
  
  renderFinList();
};

function renderFinList() {
  const listEntradas = document.getElementById('fin-entradas-list');
  const listSaidas = document.getElementById('fin-saidas-list');
  if (!listEntradas || !listSaidas) return;
  
  // Limpa e adiciona cabeçalhos
  listEntradas.innerHTML = '<h3 class="text-white text-xs font-semibold mb-2">Entradas (Corridas)</h3>';
  listSaidas.innerHTML = '<h3 class="text-white text-xs font-semibold mb-2">Saídas (Despesas e Gasolina)</h3>';
  
  // Renderiza Entradas
  if (APP_STATE.corridas.length === 0) {
    listEntradas.innerHTML += '<div class="text-outline text-xs py-4 text-center">Nenhuma entrada</div>';
  } else {
    APP_STATE.corridas.slice(0, 15).forEach(c => {
      const div = document.createElement('div');
      div.className = 'glass rounded-xl p-3 flex justify-between items-center mb-2';
      div.innerHTML = `
        <div>
          <div class="text-white text-xs font-medium">${c.plat}</div>
          <div class="text-outline text-[10px]">${utils.formatDate(c.data)}</div>
        </div>
        <div class="text-green-400 text-sm font-bold">+ ${utils.formatBRL(c.liquido)}</div>
      `;
      listEntradas.appendChild(div);
    });
  }

  // Combina e renderiza Saídas
  const todasSaidas = [
    ...APP_STATE.abastecimentos.map(a => ({ ...a, tipo: 'Abastecimento', cat: '⛽' })),
    ...APP_STATE.despesas.map(d => ({ ...d, tipo: d.categoria, cat: '💸' }))
  ].sort((a, b) => new Date(b.data) - new Date(a.data));

  if (todasSaidas.length === 0) {
    listSaidas.innerHTML += '<div class="text-outline text-xs py-4 text-center">Nenhuma saída</div>';
  } else {
    todasSaidas.slice(0, 15).forEach(s => {
      const div = document.createElement('div');
      div.className = 'glass rounded-xl p-3 flex justify-between items-center mb-2';
      div.innerHTML = `
        <div>
          <div class="text-white text-xs font-medium">${s.cat} ${s.tipo}</div>
          <div class="text-outline text-[10px]">${utils.formatDate(s.data)}</div>
        </div>
        <div class="text-red-400 text-sm font-bold">- ${utils.formatBRL(s.valor)}</div>
      `;
      listSaidas.appendChild(div);
    });
  }
}

