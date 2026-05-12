/* DashDriver Main Initialization */

async function initApp() {
  // O carregamento de dados agora é feito pelo checkSession em auth.js
  // para garantir que o usuário esteja autenticado antes de buscar no Supabase.
  
  // Register Service Worker if available
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.log('SW failed', err));
  }
}

function updateHeader() {
  const profileName = document.getElementById('nav-date'); // Ajustado para o ID correto se necessário
  if (profileName) {
    profileName.textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  }
}

// Global Event Listeners or initialization
window.addEventListener('load', initApp);

