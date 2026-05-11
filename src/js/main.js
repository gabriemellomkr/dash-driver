/* DashDriver Main Initialization */

async function initApp() {
  // O checkSession no auth.js cuidará do carregamento se houver usuário
  console.log("DashDriver initialized");
  
  // Register Service Worker if available
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.log('SW failed', err));
  }
}

function updateHeader() {
  document.getElementById('profile-name').textContent = CONFIG_DATA.nome;
  if (CONFIG_DATA.avatar) {
    document.getElementById('profile-avatar').src = CONFIG_DATA.avatar;
  }
}

// Global Event Listeners or initialization
window.addEventListener('load', initApp);
