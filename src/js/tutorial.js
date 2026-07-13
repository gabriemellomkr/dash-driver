/* DashDriver — Tutorial Interativo (Driver.js) */

// Escopo de módulo — acessível em todos os callbacks
let _driverObj = null;

window.startTutorial = function () {
  // Sempre começa no Dashboard com modal e gasto fechados
  if (typeof showTab     === 'function') showTab('dash');
  if (typeof closeModal  === 'function') closeModal();
  if (typeof closeGastoModal === 'function') closeGastoModal();
  if (typeof closeSettings   === 'function') closeSettings();

  const { driver } = window.driver.js;

  _driverObj = driver({
    showProgress:   true,
    progressText:   '{{current}} de {{total}}',
    nextBtnText:    'Próximo',
    prevBtnText:    'Voltar',
    doneBtnText:    'Começar! 🚀',
    allowClose:     true,
    overlayOpacity: 0.45,
    smoothScroll:   true,
    stagePadding:   8,

    onDestroyed: () => {
      // Garante que modais ficam fechados ao encerrar
      if (typeof closeModal       === 'function') closeModal();
      if (typeof closeGastoModal  === 'function') closeGastoModal();
      if (typeof closeSettings    === 'function') closeSettings();
      localStorage.setItem('dd_tutorial_done', '1');
    },

    onPopoverRender: (popover, { config, index }) => {
      const total = config.steps.length;
      const current = (index ?? 0) + 1;
      const bar = document.createElement('div');
      bar.className = 'dd-tutorial-progress-bar';
      bar.style.width = Math.round((current / total) * 100) + '%';
      popover.wrapper.prepend(bar);
    },

    steps: [

      /* ═══ DASHBOARD ════════════════════════════════════════════════════ */

      /* 1. Hero — Receita */
      {
        element: '#d-receita',
        popover: {
          title: '👋 Bem-vindo ao DashDriver!',
          description: 'Aqui está sua <strong>Receita Líquida</strong> do período — o que entrou das corridas descontando as taxas das plataformas.',
          side: 'bottom', align: 'start',
        },
      },

      /* 2. KPIs */
      {
        element: '#d-corridas',
        popover: {
          title: '📊 KPIs em tempo real',
          description: 'Corridas feitas, km rodados, R$/km e R$/hora — calculados automaticamente conforme você lança corridas.',
          side: 'top', align: 'center',
        },
      },

      /* 3. Metas */
      {
        element: '#meta-card',
        popover: {
          title: '🎯 Progresso das Metas',
          description: 'Acompanhe a evolução da sua meta diária, semanal e mensal. Configure os valores em <strong>Configurações</strong> (vamos chegar lá!).',
          side: 'top', align: 'start',
        },
      },

      /* ═══ CORRIDAS ══════════════════════════════════════════════════════ */

      /* 4. Mini-stats da aba Corridas */
      {
        element: '#corridas-stats-grid',
        onHighlightStarted: () => {
          if (typeof closeModal === 'function') closeModal();
          showTab('corridas');
        },
        popover: {
          title: '🏍️ Aba Corridas',
          description: 'Resumo de corridas, receita acumulada e km do período. Use os filtros acima para ver Hoje, Semana ou Mês.',
          side: 'bottom', align: 'start',
        },
      },

      /* 5. Botão OCR (dentro do modal de lançar corrida) */
      {
        element: '#btn-ocr',
        onHighlightStarted: () => {
          if (typeof openModal === 'function') openModal();
        },
        popover: {
          title: '📸 Suba o print da corrida',
          description: 'Tirou print na Uber ou 99? Suba aqui — a IA lê os dados (valor, km, plataforma) e preenche tudo automaticamente. Sem digitar nada!',
          side: 'bottom', align: 'start',
        },
      },

      /* 6. Campos do formulário de corrida */
      {
        element: '#f-bruto',
        popover: {
          title: '✍️ Ou preencha manualmente',
          description: 'Selecione a plataforma, informe o valor bruto da corrida e o que você recebeu. O app calcula a taxa automaticamente.',
          side: 'top', align: 'start',
        },
      },

      /* ═══ FINANÇAS ══════════════════════════════════════════════════════ */

      /* 7. Botão Lançar gasto (fecha modal de corrida e muda aba) */
      {
        element: '#btn-lancor-gasto',
        onHighlightStarted: () => {
          if (typeof closeModal === 'function') closeModal();
          showTab('financeiro');
        },
        popover: {
          title: '💰 Aba Finanças',
          description: 'Registre todos os seus gastos — gasolina, alimentação, manutenção e mais. O lucro real no Dashboard é calculado descontando tudo isso.',
          side: 'bottom', align: 'end',
        },
      },

      /* 8. Campo valor dentro do modal de gasto */
      {
        element: '#g-valor',
        onHighlightStarted: () => {
          if (typeof openGastoModal === 'function') openGastoModal();
        },
        onDeselected: () => {
          if (typeof closeGastoModal === 'function') closeGastoModal();
        },
        popover: {
          title: '⛽ Lançar um gasto',
          description: 'Escolha a categoria (gasolina, alimentação, manutenção…), informe o valor e a data. Simples assim!',
          side: 'top', align: 'start',
        },
      },

      /* ═══ CARTEIRA ══════════════════════════════════════════════════════ */

      /* 9. Carteira — badge da CNH */
      {
        element: '#carteira-cnh-badge',
        onHighlightStarted: () => {
          if (typeof closeGastoModal === 'function') closeGastoModal();
          showTab('carteira');
        },
        popover: {
          title: '🪪 Aba Carteira',
          description: 'Guarde os dados do veículo, CNH, IPVA, seguro e licenciamento. O app avisa quando algum documento está próximo do vencimento.',
          side: 'bottom', align: 'start',
        },
      },

      /* ═══ CARREIRA ══════════════════════════════════════════════════════ */

      /* 10. Carreira — card de nível */
      {
        element: '#carreira-level-card',
        onHighlightStarted: () => showTab('carreira'),
        popover: {
          title: '🏆 Aba Carreira — Gamificação',
          description: 'Conforme você usa o app, sobe de nível e desbloqueia conquistas. Cada marco (corridas, km, dias de uso) dá um badge exclusivo!',
          side: 'bottom', align: 'start',
        },
      },

      /* ═══ CONFIGURAÇÕES ══════════════════════════════════════════════════ */

      /* 11. Campo Nome (abre modal de config) */
      {
        element: '#cfg-nome',
        onHighlightStarted: () => {
          showTab('perfil');
          if (typeof openSettings === 'function') openSettings();
        },
        popover: {
          title: '⚙️ Configurações — Dados pessoais',
          description: 'Comece preenchendo seu <strong>nome</strong> e <strong>WhatsApp</strong> (com DDI, ex: 5511912345678). O WhatsApp é usado para receber os relatórios automáticos.',
          side: 'bottom', align: 'start',
        },
      },

      /* 12. Campo Preço do litro + Consumo */
      {
        element: '#cfg-preco',
        popover: {
          title: '⛽ Combustível e custo/km',
          description: 'Informe o <strong>preço do litro</strong> e o <strong>km/litro</strong> do seu veículo. O app calcula automaticamente o custo por km rodado.',
          side: 'bottom', align: 'start',
        },
      },

      /* 13. Metas */
      {
        element: '#cfg-meta-d',
        onDeselected: () => {
          if (typeof closeSettings === 'function') closeSettings();
        },
        popover: {
          title: '🎯 Suas Metas',
          description: 'Defina uma meta <strong>diária</strong>, <strong>semanal</strong> e <strong>mensal</strong> em reais. As barras de progresso no Dashboard vão aparecer assim que salvar!',
          side: 'top', align: 'start',
        },
      },

      /* ═══ SUPORTE ═══════════════════════════════════════════════════════ */

      /* 14. Botão de suporte no header */
      {
        element: '#btn-suporte',
        onHighlightStarted: () => {
          if (typeof closeSettings === 'function') closeSettings();
          showTab('dash');
        },
        popover: {
          title: '🆘 Aba Suporte',
          description: 'Teve algum problema ou dúvida? Toque aqui a qualquer momento para abrir o canal de suporte e falar com a gente. Respondemos rápido!',
          side: 'bottom', align: 'end',
        },
      },

      /* ═══ FIM ════════════════════════════════════════════════════════════ */

      /* 15. Fim */
      {
        element: '#nav-perfil',
        popover: {
          title: '🚀 Tudo pronto!',
          description: 'Você já conhece o DashDriver. Comece lançando sua primeira corrida e configure suas metas agora. Boas corridas! 🏍️',
          side: 'top', align: 'center',
        },
      },

    ],
  });

  _driverObj.drive();
};

/* ─── Encerrar ───────────────────────────────────────────────────── */
window.tutorialSkip = function () {
  if (_driverObj) _driverObj.destroy();
};

/* ─── Primeiro acesso ────────────────────────────────────────────── */
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
