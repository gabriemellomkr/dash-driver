/**
 * DashDriver - Authentication Module
 * Real Supabase Auth integration for SaaS transition.
 */

window.checkSession = async function() {
  // getUser() valida o token no servidor — detecta usuário deletado pelo admin.
  // getSession() só lê o localStorage e não percebe a exclusão.
  const { data: { user }, error } = await supabase.auth.getUser();

  if (user && !error) {
    await handleAuthSuccess(user);
    _startSessionWatchdog();
  } else {
    // Token inválido ou usuário deletado — limpa sessão local
    await supabase.auth.signOut();
    document.getElementById('login-screen').style.display = 'flex';
  }
};

// Verifica a cada 5 min se o usuário ainda existe no servidor.
// Faz logout automático caso o admin tenha deletado a conta.
let _sessionWatchdogTimer = null;
function _startSessionWatchdog() {
  if (_sessionWatchdogTimer) return; // já rodando
  _sessionWatchdogTimer = setInterval(async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!user || error) {
      clearInterval(_sessionWatchdogTimer);
      await supabase.auth.signOut();
      window.location.reload();
    }
  }, 5 * 60 * 1000); // 5 minutos
}

async function handleAuthSuccess(user) {
  APP_STATE.user = user;
  document.getElementById('login-screen').style.display = 'none';

  // Carregar dados e atualizar interface
  const success = await data.loadAll();
  if (success) {
    if (typeof renderDashboard === 'function') renderDashboard();
    showTab('dash');
    // Verifica se é primeiro acesso (exibe tutorial)
    if (typeof checkFirstAccess === 'function') checkFirstAccess();
  } else {
    utils.toast("Erro ao sincronizar dados", "error");
  }
}

window.doLogin = async function() {
  const email = document.getElementById('l-email').value;
  const password = document.getElementById('l-pass').value;
  const errEl = document.getElementById('l-err');

  if (!email || !password) {
    errEl.textContent = "Preencha e-mail e senha";
    errEl.classList.remove('hidden');
    return;
  }

  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    errEl.textContent = "E-mail ou senha inválidos";
    errEl.classList.remove('hidden');
  } else {
    await handleAuthSuccess(authData.user);
    _startSessionWatchdog();
    utils.toast("Bem-vindo ao DashDriver!", "success");
  }
};

window.doLogout = async function() {
  await supabase.auth.signOut();
  window.location.reload();
};

// Initial check
document.addEventListener('DOMContentLoaded', checkSession);

