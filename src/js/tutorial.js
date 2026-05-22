/* DashDriver — Tutorial Interativo de Primeiro Acesso (Driver.js) */

/* ─── Inicializa o tour ─────────────────────────────────────────── */
window.startTutorial = function () {
  // Garante que começa no Dashboard
  if (typeof showTab === 'function') showTab('dash');

  const { driver } = window.driver.js;

  const driverObj = driver({
    showProgress: true,
    progressText: '{{current}} de {{total}}',
    nextBtnText: 'Próximo →',
    prevBtnText: '← Voltar',
    doneBtnText: 'Começar! 🚀',
    allowClose: true,
    overlayColor: '#000',
    overlayOpacity: 0.75,
    smoothScroll: true,
    onDestroyed: () => {
      localStorage.setItem('dd_tutorial_done', '1');
    },

    steps: [
      /* ── 1. Boas-vindas ── */
      {
        element: '#d-receita',
        popover: {
          title: '👋 Bem-vindo ao DashDriver!',
          description: 'Aqui está sua <strong>Receita Líquida</strong> — o que entrou das corridas. Vou te mostrar o app em menos de 1 minuto.',
          side: 'bottom',
          align: 'start',
        },
      },

      /* ── 2. KPIs ── */
      {
        element: '#d-corridas',
        popover: {
          title: '📊 Seus KPIs do dia',
          description: 'Corridas, Km rodados, ganho por km e ganho por hora — tudo atualizado automaticamente conforme você lança corridas.',
          side: 'top',
          align: 'center',
        },
      },

      /* ── 3. Metas ── */
      {
        element: '#meta-card',
        popover: {
          title: '🎯 Progresso das Metas',
          description: 'Barra de progresso das suas metas diária, semanal e mensal. Configure os valores em <strong>Perfil → Configurações</strong>.',
          side: 'top',
          align: 'start',
        },
      },

      /* ── 4. Navegar para Corridas ── */
      {
        element: '#nav-corridas',
        popover: {
          title: '🏍️ Aba Corridas',
          description: 'Toque aqui para ver e lançar suas corridas. Vamos dar uma olhada!',
          side: 'top',
          align: 'center',
          onNextClick: () => {
            showTab('corridas');
            setTimeout(() => driverObj.moveNext(), 300);
          },
        },
      },

      /* ── 5. Botão + (FAB) ── */
      {
        element: '#fab-add',
        popover: {
          title: '➕ Lançar nova corrida',
          description: 'Toque no botão azul para registrar uma corrida manualmente. Preencha plataforma, distância e valor.',
          side: 'top',
          align: 'center',
        },
      },

      /* ── 6. OCR ── */
      {
        element: '#btn-ocr',
        popover: {
          title: '📸 Import por print',
          description: 'Tirou print da corrida na Uber ou 99? Suba aqui e a IA lê os dados automaticamente — sem digitar nada!',
          side: 'bottom',
          align: 'start',
        },
      },

      /* ── 7. Navegar para Finanças ── */
      {
        element: '#nav-financeiro',
        popover: {
          title: '💰 Aba Finanças',
          description: 'Registre gasolina, manutenção e outros gastos. O app desconta tudo para calcular seu lucro real.',
          side: 'top',
          align: 'center',
          onNextClick: () => {
            showTab('financeiro');
            setTimeout(() => driverObj.moveNext(), 300);
          },
        },
      },

      /* ── 8. Botão lançar gasto (financeiro) ── */
      {
        element: '#nav-financeiro',
        popover: {
          title: '⛽ Gastos e despesas',
          description: 'Abastecimento, manutenção, seguro... Tudo que você registrar aqui é subtraído da sua receita para mostrar o lucro real no Dashboard.',
          side: 'top',
          align: 'center',
        },
      },

      /* ── 9. Perfil / Configurações ── */
      {
        element: '#nav-perfil',
        popover: {
          title: '⚙️ Perfil e Configurações',
          description: 'Em <strong>Perfil → Configurações</strong> você define metas, preço do combustível, km/litro e plataformas. Configure agora para ativar os KPIs!',
          side: 'top',
          align: 'center',
          onNextClick: () => {
            showTab('perfil');
            setTimeout(() => driverObj.moveNext(), 300);
          },
        },
      },

      /* ── 10. Fim ── */
      {
        element: '#nav-perfil',
        popover: {
          title: '🚀 Tudo pronto!',
          description: 'Você já conhece o DashDriver. Comece lançando sua primeira corrida. Qualquer dúvida, use o Suporte no seu perfil. Boas corridas! 🏍️',
          side: 'top',
          align: 'center',
        },
      },
    ],
  });

  driverObj.drive();
};

/* ─── Pular / Encerrar (compatibilidade) ───────────────────────── */
window.tutorialSkip = function () {
  localStorage.setItem('dd_tutorial_done', '1');
};

/* ─── Verifica primeiro acesso após login ───────────────────────── */
window.checkFirstAccess = function () {
  if (!localStorage.getItem('dd_tutorial_done')) {
    setTimeout(startTutorial, 900);
  }
};

/* ─── Permite relançar o tutorial pelo perfil ──────────────────── */
window.resetTutorial = function () {
  localStorage.removeItem('dd_tutorial_done');
  startTutorial();
};
