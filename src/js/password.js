/* DashDriver — Gerenciamento de Senha e Recuperação de Conta */

/* ─── Alternância de painéis no login ─────────────────── */

window.showForgotPanel = function() {
  document.getElementById('login-panel').classList.add('hidden');
  document.getElementById('forgot-panel').classList.remove('hidden');
  document.getElementById('reset-panel').classList.add('hidden');
  document.getElementById('login-subtitle').textContent = 'Recuperar senha';
  document.getElementById('forgot-email').value = document.getElementById('l-email')?.value || '';
  document.getElementById('forgot-success').classList.add('hidden');
  document.getElementById('forgot-err').classList.add('hidden');
};

window.showLoginPanel = function() {
  document.getElementById('login-panel').classList.remove('hidden');
  document.getElementById('forgot-panel').classList.add('hidden');
  document.getElementById('reset-panel').classList.add('hidden');
  document.getElementById('login-subtitle').textContent = 'Acesso restrito';
};

function showResetPanel() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-panel').classList.add('hidden');
  document.getElementById('forgot-panel').classList.add('hidden');
  document.getElementById('reset-panel').classList.remove('hidden');
  document.getElementById('login-subtitle').textContent = 'Criar nova senha';
}

/* ─── Esqueceu a senha ─────────────────────────────────── */

window.doForgotPassword = async function() {
  const email = (document.getElementById('forgot-email')?.value || '').trim();
  const errEl = document.getElementById('forgot-err');
  const sucEl = document.getElementById('forgot-success');
  errEl.classList.add('hidden');
  sucEl.classList.add('hidden');

  if (!email) {
    errEl.textContent = 'Digite seu e-mail.';
    errEl.classList.remove('hidden');
    return;
  }

  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    errEl.textContent = error.message;
    errEl.classList.remove('hidden');
  } else {
    sucEl.classList.remove('hidden');
  }
};

/* ─── Salvar nova senha (via link de recuperação) ─────── */

window.doResetPassword = async function() {
  const p1  = document.getElementById('reset-pass1')?.value || '';
  const p2  = document.getElementById('reset-pass2')?.value || '';
  const err = document.getElementById('reset-err');
  err.classList.add('hidden');

  if (p1.length < 6) {
    err.textContent = 'A senha deve ter pelo menos 6 caracteres.';
    err.classList.remove('hidden');
    return;
  }
  if (p1 !== p2) {
    err.textContent = 'As senhas não coincidem.';
    err.classList.remove('hidden');
    return;
  }

  const { error } = await supabase.auth.updateUser({ password: p1 });
  if (error) {
    err.textContent = error.message;
    err.classList.remove('hidden');
  } else {
    utils.toast('✅ Senha atualizada! Fazendo login...', 'success');
    // Sessão já está ativa após o updateUser — redireciona para o app
    setTimeout(() => window.location.replace(window.location.origin + window.location.pathname), 1500);
  }
};

/* ─── Alterar senha (usuário logado) ──────────────────── */

window.openChangePassModal = function() {
  document.getElementById('modal-change-pass').classList.remove('hidden');
  document.getElementById('chpass-new').value = '';
  document.getElementById('chpass-confirm').value = '';
  document.getElementById('chpass-err').classList.add('hidden');
  setTimeout(() => document.getElementById('chpass-new').focus(), 200);
};

window.closeChangePassModal = function() {
  document.getElementById('modal-change-pass').classList.add('hidden');
};

window.doChangePassword = async function() {
  const p1  = document.getElementById('chpass-new')?.value     || '';
  const p2  = document.getElementById('chpass-confirm')?.value || '';
  const err = document.getElementById('chpass-err');
  err.classList.add('hidden');

  if (p1.length < 6) {
    err.textContent = 'A senha deve ter pelo menos 6 caracteres.';
    err.classList.remove('hidden');
    return;
  }
  if (p1 !== p2) {
    err.textContent = 'As senhas não coincidem.';
    err.classList.remove('hidden');
    return;
  }

  const { error } = await supabase.auth.updateUser({ password: p1 });
  if (error) {
    err.textContent = error.message;
    err.classList.remove('hidden');
  } else {
    closeChangePassModal();
    utils.toast('✅ Senha alterada com sucesso!', 'success');
  }
};

/* ─── Detecção de recovery link (onAuthStateChange) ────── */
// Supabase v2 dispara PASSWORD_RECOVERY quando o usuário clica no link do e-mail.
// Registramos aqui para garantir que o painel certo apareça.

supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') {
    showResetPanel();
  }
});
