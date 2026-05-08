/**
 * DashDriver - Financial
 * Income and expense management.
 */

window.renderFinanceiro = function() {
  const receitas = APP_STATE.corridas.reduce((s, c) => s + c.liquido, 0);
  const despesas = APP_STATE.despesas.reduce((s, d) => s + d.valor, 0);
  const gas = APP_STATE.abastecimentos.reduce((s, a) => s + a.valor, 0);
  
  document.getElementById('fin-receita').textContent = utils.formatBRL(receitas);
  document.getElementById('fin-despesas').textContent = utils.formatBRL(despesas + gas);
  document.getElementById('fin-resultado').textContent = utils.formatBRL(receitas - despesas - gas);
  
  renderFinList();
};

function renderFinList() {
  const list = document.getElementById('fin-entradas-list');
  if (!list) return;
  
  list.innerHTML = '<h3 class="text-white text-xs font-semibold mb-2">Últimos Lançamentos</h3>';
  
  APP_STATE.corridas.slice(0, 5).forEach(c => {
    const div = document.createElement('div');
    div.className = 'glass rounded-xl p-3 flex justify-between items-center';
    div.innerHTML = `
      <div>
        <div class="text-white text-xs font-medium">${c.plat}</div>
        <div class="text-outline text-[10px]">${utils.formatDate(c.data)}</div>
      </div>
      <div class="text-green-400 text-sm font-bold">+ ${utils.formatBRL(c.liquido)}</div>
    `;
    list.appendChild(div);
  });
}

window.openFuelModal = function() {
  const m = document.getElementById('fuel-modal');
  if (m) {
    m.classList.remove('hidden');
    m.classList.add('flex');
  }
};

window.closeFuelModal = function() {
  const m = document.getElementById('fuel-modal');
  if (m) {
    m.classList.add('hidden');
    m.classList.remove('flex');
  }
};
