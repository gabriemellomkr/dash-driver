/**
 * DashDriver - Authentication Module
 * Real Supabase Auth integration for SaaS transition.
 */

window.checkSession = async function() {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (session) {
    await handleAuthSuccess(session.user);
  } else {
    document.getElementById('login-screen').style.display = 'flex';
  }
};

async function handleAuthSuccess(user) {
  APP_STATE.user = user;
  document.getElementById('login-screen').style.display = 'none';

  // Carregar dados e atualizar interface
  const success = await data.loadAll();
  if (success) {
    if (typeof renderDashboard === 'function') renderDashboard();
    showTab('dash');
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
    utils.toast("Bem-vindo ao DashDriver!", "success");
  }
};

window.doLogout = async function() {
  await supabase.auth.signOut();
  window.location.reload();
};

// Initial check
document.addEventListener('DOMContentLoaded', checkSession);

