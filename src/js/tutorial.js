/* DashDriver — Tutorial de Primeiro Acesso */

const TUTORIAL_STEPS = [
  {
    icon: '🚀',
    color: 'rgba(59,130,246,0.15)',
    title: 'Bem-vindo ao DashDriver!',
    desc:  'Seu copiloto financeiro para motoristas de aplicativo. Vou te mostrar as principais funcionalidades em menos de 1 minuto.',
  },
  {
    icon: '📊',
    color: 'rgba(59,130,246,0.15)',
    title: 'Dashboard',
    desc:  'Aqui você vê seus ganhos do dia, da semana e do mês. Acompanhe KPIs como km rodados, receita, lucro e progresso das suas metas.',
  },
  {
    icon: '🏍️',
    color: 'rgba(168,85,247,0.15)',
    title: 'Lançar Corridas',
    desc:  'Toque no botão + para registrar uma corrida manualmente. Ou use o botão "Suba o print aqui" para importar direto do print da Uber, 99 ou InDriver — o app lê automaticamente!',
  },
  {
    icon: '💰',
    color: 'rgba(34,197,94,0.15)',
    title: 'Finanças',
    desc:  'Registre abastecimentos, manutenções e outras despesas. O lucro real é calculado automaticamente: receita das corridas menos todos os seus custos.',
  },
  {
    icon: '⚙️',
    color: 'rgba(251,191,36,0.15)',
    title: 'Configure suas Metas',
    desc:  'Vá em Perfil → Configurações e defina seus custos (preço do combustível, km/litro) e metas diária, semanal e mensal. Isso ativa o progresso no Dashboard.',
  },
];

let _tutorialStep = 0;

window.startTutorial = function() {
  _tutorialStep = 0;
  renderTutorialStep();
  document.getElementById('tutorial-overlay').classList.remove('hidden');
};

window.tutorialNext = function() {
  _tutorialStep++;
  if (_tutorialStep >= TUTORIAL_STEPS.length) {
    tutorialFinish();
  } else {
    renderTutorialStep();
  }
};

window.tutorialSkip = function() {
  tutorialFinish();
};

function tutorialFinish() {
  document.getElementById('tutorial-overlay').classList.add('hidden');
  localStorage.setItem('dd_tutorial_done', '1');
}

function renderTutorialStep() {
  const step  = TUTORIAL_STEPS[_tutorialStep];
  const total = TUTORIAL_STEPS.length;

  document.getElementById('tutorial-icon').textContent  = step.icon;
  document.getElementById('tutorial-icon').style.background = step.color;
  document.getElementById('tutorial-title').textContent = step.title;
  document.getElementById('tutorial-desc').textContent  = step.desc;

  // Botão do último passo
  const btn = document.getElementById('tutorial-next');
  btn.textContent = _tutorialStep === total - 1 ? 'Começar agora! 🚀' : 'Próximo →';

  // Indicadores de passo
  const dots = document.querySelectorAll('.tutorial-dot');
  dots.forEach((d, i) => {
    d.style.background = i === _tutorialStep ? '#3b82f6' : 'rgba(255,255,255,0.2)';
    d.style.width      = i === _tutorialStep ? '20px' : '8px';
    d.style.transition = 'all 0.3s ease';
  });
}

/* ─── Verifica se é primeiro acesso após login ─────────── */
// Chamado por auth.js após login bem-sucedido
window.checkFirstAccess = function() {
  const done = localStorage.getItem('dd_tutorial_done');
  if (!done) {
    // Pequeno delay para o dashboard carregar antes do tutorial aparecer
    setTimeout(startTutorial, 800);
  }
};
