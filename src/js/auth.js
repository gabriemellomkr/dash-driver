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
      return;
    }
    // Também re-verifica o plano (captura bloqueio em tempo real)
    window._checkPlanOnFocus?.();
  }, 5 * 60 * 1000); // 5 minutos
}

// ─── Verifica se o plano bloqueia o acesso ────────────────────────────────────
function _isPlanBlocked() {
  const plan  = APP_STATE.plan || {};
  const plano = plan.plano || 'trial';

  if (plano === 'convidado') return false;      // acesso total concedido pelo admin
  if (plano === 'expired')   return true;       // bloqueado explicitamente

  if (plano === 'active') {
    // Ativo via Stripe — só bloqueia se expires_at ultrapassado (segurança)
    if (plan.expires_at && new Date(plan.expires_at) < new Date()) return true;
    return false;
  }

  if (plano === 'trial') {
    // Trial manual do admin: sem data = acesso liberado
    if (!plan.trial_ends_at) return false;
    return new Date(plan.trial_ends_at) < new Date();
  }

  return false; // desconhecido → libera (fail-open)
}

async function handleAuthSuccess(user) {
  APP_STATE.user = user;
  document.getElementById('login-screen').style.display = 'none';

  // Carregar dados e atualizar interface
  const success = await data.loadAll();
  if (!success) {
    utils.toast("Erro ao sincronizar dados", "error");
    return;
  }

  // ── Verifica acesso pelo plano ───────────────────────────────────────────
  if (_isPlanBlocked()) {
    _showPaywall();
    return;
  }

  if (typeof renderDashboard === 'function') renderDashboard();
  showTab('dash');
  if (typeof checkFirstAccess === 'function') checkFirstAccess();
}

// ─── Tela de paywall ──────────────────────────────────────────────────────────
function _showPaywall() {
  const el = document.getElementById('paywall-screen');
  if (!el) return;

  const plan  = APP_STATE.plan || {};
  const plano = plan.plano || 'trial';

  // Mensagem contextual
  let titulo = 'Seu acesso expirou';
  let desc   = 'Para continuar usando o DashDriver, assine o plano mensal.';

  if (plano === 'trial' && plan.trial_ends_at) {
    titulo = 'Período de teste encerrado';
    desc   = 'Seu trial gratuito de 7 dias terminou. Assine para continuar com acesso completo.';
  }
  if (plano === 'expired') {
    titulo = 'Assinatura encerrada';
    desc   = 'Sua assinatura foi cancelada ou o pagamento não foi processado. Renove para voltar a usar o app.';
  }

  const tituloEl = document.getElementById('paywall-titulo');
  const descEl   = document.getElementById('paywall-desc');
  if (tituloEl) tituloEl.textContent = titulo;
  if (descEl)   descEl.textContent   = desc;

  el.style.display = 'flex';
}

window._hidePaywall = function() {
  const el = document.getElementById('paywall-screen');
  if (el) el.style.display = 'none';
};

// Gera checkout Stripe e redireciona
window.doSubscribe = async function() {
  const btn = document.getElementById('paywall-subscribe-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Aguarde...'; }

  try {
    const r = await fetch('/api/stripe/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: APP_STATE.user.id, email: APP_STATE.user.email }),
    });
    const d = await r.json();
    if (d.url) {
      window.location.href = d.url;
    } else {
      alert('Erro ao gerar link de assinatura. Tente novamente.');
    }
  } catch(e) {
    alert('Erro de conexão: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔓 Assinar agora'; }
  }
};

// Verifica a cada 5min se a sessão e o plano ainda são válidos
window._checkPlanOnFocus = async function() {
  if (!APP_STATE.user) return;
  await data.loadPlan();
  const paywallVisible = document.getElementById('paywall-screen')?.style.display !== 'none';
  if (_isPlanBlocked() && !paywallVisible) {
    _showPaywall();
  } else if (!_isPlanBlocked() && paywallVisible) {
    _hidePaywall(); // pagamento foi processado enquanto o usuário estava na tela
    if (typeof renderDashboard === 'function') renderDashboard();
    showTab('dash');
  }
};

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') window._checkPlanOnFocus();
});

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

