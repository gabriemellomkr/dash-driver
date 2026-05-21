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

  try {
    const res = await fetch('/api/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const d = await res.json();
    if (!res.ok) {
      errEl.textContent = d.error || 'Erro ao enviar e-mail.';
      errEl.classList.remove('hidden');
    } else {
      sucEl.classList.remove('hidden');
    }
  } catch (e) {
    errEl.textContent = 'Erro de conexão. Tente novamente.';
    errEl.classList.remove('hidden');
  }
};

/* ─── Salvar nova senha (via link de recuperação) ─────── */

// Token lido da URL (?dd_reset=TOKEN)
let _resetToken = null;

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
  if (!_resetToken) {
    err.textContent = 'Link inválido. Solicite um novo e-mail de recuperação.';
    err.classList.remove('hidden');
    return;
  }

  try {
    const res = await fetch('/api/reset-password-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: _resetToken, password: p1 }),
    });
    const d = await res.json();
    if (!res.ok) {
      err.textContent = d.error || 'Erro ao atualizar senha.';
      err.classList.remove('hidden');
    } else {
      utils.toast('✅ Senha atualizada! Faça login com a nova senha.', 'success');
      _resetToken = null;
      // Limpa o token da URL e mostra a tela de login
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(showLoginPanel, 1500);
    }
  } catch (e) {
    err.textContent = 'Erro de conexão. Tente novamente.';
    err.classList.remove('hidden');
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

/* ─── Detecção do link de recuperação na URL ───────────── */
// Quando o usuário clica no link do e-mail (?dd_reset=TOKEN), detectamos
// o token na URL e exibimos o painel de nova senha.

(function checkResetToken() {
  const params = new URLSearchParams(window.location.search);
  const token  = params.get('dd_reset');
  if (token) {
    _resetToken = token;
    // Mostra a tela de login com o painel de nova senha
    document.addEventListener('DOMContentLoaded', () => {
      const loginScreen = document.getElementById('login-screen');
      if (loginScreen) loginScreen.style.display = 'flex';
      showResetPanel();
    });
    // Caso o DOM já esteja pronto
    if (document.readyState !== 'loading') {
      const loginScreen = document.getElementById('login-screen');
      if (loginScreen) loginScreen.style.display = 'flex';
      showResetPanel();
    }
  }
})();
