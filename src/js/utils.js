/**
 * DashDriver - Utilities
 * Date formatting, currency conversion, and common helpers.
 */

window.utils = {
  formatBRL(val) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  },

  formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR');
  },

  formatTime(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  },

  getTodayISO() {
    return new Date().toISOString().split('T')[0];
  },

  getNowTime() {
    return new Date().toLocaleTimeString('pt-BR', { hour12: false, hour: '2-digit', minute: '2-digit' });
  },

  toast(msg, type = 'info') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = `toast show ${type === 'error' ? 'bg-red-500' : type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'}`;
    setTimeout(() => t.classList.remove('show'), 3000);
  }
};

// Global shortcuts
window.fmtMoney = window.utils.formatBRL;
window.showToast = window.utils.toast;
