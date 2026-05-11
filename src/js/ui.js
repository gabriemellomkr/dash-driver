/**
 * DashDriver - UI Management
 * Tabs, modal visibility, and layout updates.
 */

window.showTab = function(tabId) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  // Show target
  const target = document.getElementById(`page-${tabId}`);
  if (target) target.classList.add('active');

  // Update nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const icon = btn.querySelector('.nav-icon');
    const label = btn.querySelector('span:last-child');
    if (btn.dataset.tab === tabId) {
      btn.classList.add('nav-active');
      if (icon) icon.classList.replace('text-outline', 'text-blue-400');
      if (label) label.classList.replace('text-outline', 'text-blue-400');
    } else {
      btn.classList.remove('nav-active');
      if (icon) icon.classList.replace('text-blue-400', 'text-outline');
      if (label) label.classList.replace('text-blue-400', 'text-outline');
    }
  });

  // FAB visibility
  const fab = document.getElementById('fab-add');
  if (fab) {
    if (tabId === 'dash' || tabId === 'corridas') {
      fab.classList.remove('hidden');
    } else {
      fab.classList.add('hidden');
    }
  }

  // Reload specific data if needed
  if (tabId === 'corridas') renderHistorico();
  if (tabId === 'analise') renderAnalise();
  if (tabId === 'financeiro') renderFinanceiro();
  if (tabId === 'veiculo') loadVeiculoUI();
  if (tabId === 'carreira') renderCarreira();
  if (tabId === 'admin') admin.init();
};

window.openModal = function() {
  const m = document.getElementById('insert-modal');
  if (m) {
    m.classList.remove('hidden');
    m.classList.add('flex');
    // Set default date/time
    document.getElementById('f-data').value = utils.getTodayISO();
    document.getElementById('f-hora').value = utils.getNowTime();
  }
};

window.closeModal = function() {
  const m = document.getElementById('insert-modal');
  if (m) {
    m.classList.add('hidden');
    m.classList.remove('flex');
  }
};

window.openSettings = function() {
  const m = document.getElementById('settings-modal');
  if (m) {
    m.classList.remove('hidden');
    m.classList.add('flex');
    loadSettingsUI();
  }
};

window.closeSettings = function() {
  const m = document.getElementById('settings-modal');
  if (m) {
    m.classList.add('hidden');
    m.classList.remove('flex');
  }
};
