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

  // FAB — só na aba de corridas
  const fab = document.getElementById('fab-add');
  if (fab) {
    if (tabId === 'corridas') {
      fab.classList.remove('hidden');
    } else {
      fab.classList.add('hidden');
    }
  }

  // Reload specific data if needed
  if (tabId === 'dash') renderDashboard();
  if (tabId === 'corridas') renderHistorico();
  if (tabId === 'analise') renderAnalise();
  if (tabId === 'financeiro') renderFinanceiro();
  if (tabId === 'veiculo') loadVeiculoUI();
  if (tabId === 'carreira') renderCarreira();
  if (tabId === 'admin') renderAdmin();
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
