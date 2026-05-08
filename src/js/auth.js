/**
 * DashDriver - Authentication Module
 * Real Supabase Auth integration for SaaS transition.
 */

window.checkSession = async function() {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (session) {
    APP_STATE.user = session.user;
    document.getElementById('login-screen').style.display = 'none';
    await data.loadAll();
    showTab('dash');
  } else {
    document.getElementById('login-screen').style.display = 'flex';
  }
};

window.doLogin = async function() {
  const email = document.getElementById('l-email').value;
  const password = document.getElementById('l-pass').value;
  const errEl = document.getElementById('l-err');

  if (!email || !password) {
    errEl.textContent = "Preencha e-mail e senha";
    errEl.classList.remove('hidden');
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    errEl.textContent = "E-mail ou senha inválidos";
    errEl.classList.remove('hidden');
  } else {
    APP_STATE.user = data.user;
    document.getElementById('login-screen').style.display = 'none';
    await data.loadAll();
    showTab('dash');
    utils.toast("Bem-vindo ao DashDriver!", "success");
  }
};

window.doLogout = async function() {
  await supabase.auth.signOut();
  window.location.reload();
};

// Initial check
document.addEventListener('DOMContentLoaded', checkSession);
