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
  const plano = plan.plano;

  if (plano === 'active') {
    // Pagante (Lastlink) — só bloqueia se houver expires_at ultrapassado (segurança)
    if (plan.expires_at && new Date(plan.expires_at) < new Date()) return true;
    return false;
  }

  // Convidado: sem data = vitalício (você/equipe); com data = trial de X dias que trava
  if (plano === 'convidado') {
    if (!plan.trial_ends_at) return false;
    return new Date(plan.trial_ends_at) < new Date();
  }

  // Trial legado (mesma regra do convidado com data)
  if (plano === 'trial') {
    if (!plan.trial_ends_at) return false;
    return new Date(plan.trial_ends_at) < new Date();
  }

  if (plano === 'expired') return true;

  // Sem plano / desconhecido → trava (fail-closed: acesso exige pagar ou ser convidado)
  return true;
}

async function handleAuthSuccess(user) {
  const previousOwner = localStorage.getItem('dd_cache_owner');
  if (previousOwner !== user.id) {
    Object.keys(localStorage).filter(k => k.startsWith('dd_') || k.startsWith('dash_')).forEach(k => localStorage.removeItem(k));
    Object.assign(CONFIG_DATA, DEFAULT_CONFIG);
  } else {
    try {Object.assign(CONFIG_DATA, JSON.parse(localStorage.getItem('dash_config') || '{}'));} catch {}
  }
  localStorage.setItem('dd_cache_owner', user.id);
  APP_STATE.user = user;
  document.getElementById('login-screen').style.display = 'none';

  // Carregar dados e atualizar interface.
  // Se alguma tabela não-crítica falhar, seguimos com os dados parciais em vez de
  // travar o app inteiro (e bloquear dashboard + tutorial) por causa de uma falha.
  const success = await data.loadAll();
  if (!success) {
    utils.toast("Alguns dados não sincronizaram — tentando continuar", "error");
  }

  // ── Verifica acesso pelo plano ───────────────────────────────────────────
  if (_isPlanBlocked()) {
    _showPaywall();
    return;
  }

  _renderPlanBanner();

  if (typeof renderDashboard === 'function') renderDashboard();
  showTab('dash');
  if (typeof checkFirstAccess === 'function') checkFirstAccess();
}

// ─── Banner de trial (contador de dias restantes) ────────────────────────────
function _renderPlanBanner() {
  const banner = document.getElementById('plan-banner');
  if (!banner) return;

  const plan  = APP_STATE.plan || {};
  const plano = plan.plano;

  // Só mostra o contador quando é convidado/trial COM data (período grátis rolando)
  const isTemp = (plano === 'convidado' || plano === 'trial') && plan.trial_ends_at;
  if (!isTemp) { banner.style.display = 'none'; return; }

  const msLeft   = new Date(plan.trial_ends_at) - new Date();
  const daysLeft = Math.ceil(msLeft / 86_400_000);

  // Expirado — o paywall já cuida, não precisa do banner
  if (daysLeft <= 0) { banner.style.display = 'none'; return; }

  const isUrgent = daysLeft <= 2;
  banner.style.display      = 'flex';
  banner.style.background   = isUrgent ? 'rgba(239,68,68,.12)' : 'rgba(251,191,36,.08)';
  banner.style.borderBottom = isUrgent
    ? '1px solid rgba(239,68,68,.2)'
    : '1px solid rgba(251,191,36,.15)';

  const textEl = document.getElementById('plan-banner-text');
  if (textEl) {
    textEl.textContent = `⏳ Teste grátis — ${daysLeft} dia${daysLeft !== 1 ? 's' : ''} restante${daysLeft !== 1 ? 's' : ''}`;
    textEl.style.color = isUrgent ? '#fca5a5' : '#fde68a';
  }
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

// Link do checkout do Lastlink (oferta de R$ 29,90 — em teste).
const LASTLINK_CHECKOUT_URL = 'https://lastlink.com/p/CB420A0A6/checkout-payment/';

// Redireciona pro checkout do Lastlink
window.doSubscribe = function() {
  window.location.href = LASTLINK_CHECKOUT_URL;
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
    _renderPlanBanner();
    if (typeof renderDashboard === 'function') renderDashboard();
    showTab('dash');
  } else {
    _renderPlanBanner(); // atualiza contador mesmo sem mudança de estado
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
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      await fetch('/api/subscribe',{method:'POST',headers:await ddAuthHeaders(),body:JSON.stringify({action:'unsubscribe',subscription:subscription.toJSON()})});
      await subscription.unsubscribe();
    }
  } catch {}
  Object.keys(localStorage).filter(k => k.startsWith('dd_') || k.startsWith('dash_')).forEach(k => localStorage.removeItem(k));
  await supabase.auth.signOut();
  window.location.reload();
};

// Initial check
document.addEventListener('DOMContentLoaded', checkSession);

