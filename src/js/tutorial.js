/* DashDriver — Tutorial Interativo (Driver.js) */

// Variável no escopo do módulo — acessível nos callbacks onHighlightStarted
let _driverObj = null;

window.startTutorial = function () {
  if (typeof showTab === 'function') showTab('dash');

  const { driver } = window.driver.js;

  _driverObj = driver({
    showProgress:  true,
    progressText:  '{{current}} de {{total}}',
    nextBtnText:   'Próximo',
    prevBtnText:   'Voltar',
    doneBtnText:   'Começar! 🚀',
    allowClose:    true,
    overlayOpacity: 0.4,          // era 0.75 — muito escuro
    smoothScroll:  true,
    stagePadding:  6,

    onDestroyed: () => {
      localStorage.setItem('dd_tutorial_done', '1');
    },

    steps: [

      /* ── 1. Hero: receita ─────────────────────────────────── */
      {
        element: '#d-receita',
        popover: {
          title: '👋 Bem-vindo ao DashDriver!',
          description: 'Aqui está sua <strong>Receita Líquida</strong> — o que entrou das corridas. Vou te mostrar o app em menos de 1 minuto.',
          side: 'bottom', align: 'start',
        },
      },

      /* ── 2. KPIs ──────────────────────────────────────────── */
      {
        element: '#d-corridas',
        popover: {
          title: '📊 Seus KPIs do dia',
          description: 'Corridas, Km rodados, R$/km e R$/hora — tudo atualizado automaticamente conforme você lança corridas.',
          side: 'top', align: 'center',
        },
      },

      /* ── 3. Metas ─────────────────────────────────────────── */
      {
        element: '#meta-card',
        popover: {
          title: '🎯 Progresso das Metas',
          description: 'Barra de progresso das suas metas diária, semanal e mensal. Configure os valores em <strong>Perfil → Configurações</strong>.',
          side: 'top', align: 'start',
        },
      },

      /* ── 4. Botão nav Corridas ────────────────────────────── */
      {
        element: '#nav-corridas',
        popover: {
          title: '🏍️ Aba Corridas',
          description: 'Aqui você lança e consulta todas as suas corridas. Clique em Próximo para ver.',
          side: 'top', align: 'center',
        },
      },

      /* ── 5. Mini-stats da aba Corridas ───────────────────── */
      // onHighlightStarted troca a aba ANTES de Driver.js tentar destacar o elemento
      {
        element: '#hist-stat-count',
        onHighlightStarted: () => showTab('corridas'),
        popover: {
          title: '📋 Resumo das corridas',
          description: 'Total de corridas, receita acumulada e km rodados no período selecionado.',
          side: 'bottom', align: 'start',
        },
      },

      /* ── 6. FAB — lançar corrida ─────────────────────────── */
      {
        element: '#fab-add',
        popover: {
          title: '➕ Lançar nova corrida',
          description: 'Toque no botão azul para registrar uma corrida. Escolha a plataforma, informe distância e valor — ou suba um print e a IA preenche tudo!',
          side: 'top', align: 'center',
        },
      },

      /* ── 7. Botão nav Finanças ───────────────────────────── */
      {
        element: '#nav-financeiro',
        popover: {
          title: '💰 Aba Finanças',
          description: 'Registre gasolina, manutenção e outros gastos. O lucro real é calculado descontando tudo automaticamente.',
          side: 'top', align: 'center',
        },
      },

      /* ── 8. Botão Lançar gasto (aba Finanças) ────────────── */
      {
        element: '#btn-lancor-gasto',
        onHighlightStarted: () => showTab('financeiro'),
        popover: {
          title: '⛽ Lançar um gasto',
          description: 'Toque aqui para registrar gasolina, alimentação, manutenção ou qualquer outro custo do dia.',
          side: 'bottom', align: 'end',
        },
      },

      /* ── 9. Botão nav Perfil ─────────────────────────────── */
      {
        element: '#nav-perfil',
        popover: {
          title: '⚙️ Perfil e Configurações',
          description: 'Em <strong>Perfil → Configurações</strong> você define metas, preço do combustível e km/litro. Configure agora para ativar os KPIs!',
          side: 'top', align: 'center',
        },
      },

      /* ── 10. Fim ─────────────────────────────────────────── */
      {
        element: '#nav-perfil',
        onHighlightStarted: () => showTab('perfil'),
        popover: {
          title: '🚀 Tudo pronto!',
          description: 'Você já conhece o DashDriver. Comece lançando sua primeira corrida. Qualquer dúvida, use o <strong>Suporte</strong> no seu perfil. Boas corridas! 🏍️',
          side: 'top', align: 'center',
        },
      },
    ],
  });

  _driverObj.drive();
};

/* ─── Pular / Encerrar ──────────────────────────────────────────── */
window.tutorialSkip = function () {
  if (_driverObj) _driverObj.destroy();
  localStorage.setItem('dd_tutorial_done', '1');
};

/* ─── Verifica primeiro acesso ──────────────────────────────────── */
window.checkFirstAccess = function () {
  if (!localStorage.getItem('dd_tutorial_done')) {
    setTimeout(startTutorial, 900);
  }
};

/* ─── Relançar pelo Perfil ──────────────────────────────────────── */
window.resetTutorial = function () {
  localStorage.removeItem('dd_tutorial_done');
  startTutorial();
};
