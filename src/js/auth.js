/**
 * DashDriver - Authentication Module
 * Real Supabase Auth integration for SaaS transition.
 */

window.checkSession = async function() {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (session) {
    APP_STATE.user = session.user;
    
    // Busca o perfil (SaaS) sem travar o carregamento principal
    supabase.from('dashdriver_usuarios').select('*').eq('id', session.user.id).single()
      .then(({ data: profile }) => {
        APP_STATE.profile = profile;
        // Se for admin, mostra a aba secreta
        if (profile?.role === 'super_admin') {
          const adminNav = document.getElementById('nav-admin');
          if (adminNav) adminNav.classList.remove('hidden');
        }
      });
    
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('signup-screen').style.display = 'none';
    
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
    
    // Busca o perfil (SaaS)
    supabase.from('dashdriver_usuarios').select('*').eq('id', data.user.id).single()
      .then(({ data: profile }) => {
        APP_STATE.profile = profile;
        if (profile?.role === 'super_admin') {
          const nav = document.getElementById('nav-admin');
          if (nav) nav.classList.remove('hidden');
        }
      });

    document.getElementById('login-screen').style.display = 'none';
    await data.loadAll();
    showTab('dash');
    utils.toast("Bem-vindo ao DashDriver!", "success");
  }
};

window.doSignUp = async function() {
  const name = document.getElementById('s-name').value;
  const email = document.getElementById('s-email').value;
  const password = document.getElementById('s-pass').value;
  const errEl = document.getElementById('s-err');

  if (!name || !email || !password) {
    errEl.textContent = "Preencha todos os campos";
    errEl.classList.remove('hidden');
    return;
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name }
    }
  });

  if (error) {
    errEl.textContent = error.message || "Erro ao criar conta";
    errEl.classList.remove('hidden');
  } else {
    utils.toast("Conta criada! Verifique seu e-mail.", "success");
    toggleAuth('login');
  }
};

window.toggleAuth = function(to) {
  const login = document.getElementById('login-screen');
  const signup = document.getElementById('signup-screen');
  
  if (to === 'signup') {
    login.style.display = 'none';
    signup.style.display = 'flex';
  } else {
    signup.style.display = 'none';
    login.style.display = 'flex';
  }
};

window.doLogout = async function() {
  await supabase.auth.signOut();
  window.location.reload();
};

// Initial check
document.addEventListener('DOMContentLoaded', checkSession);
