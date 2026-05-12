/**
 * DashDriver - State Management
 * Centralized application state and configuration.
 */

window.CONFIG_DATA = {
  nome: "Motorista",
  avatar: "🏍️",
  precoLitro: 0,
  consumo: 0,
  custoRevisao: 0,
  kmRevisao: 0,
  metaDiaria:  0,
  metaSemanal: 0,  // alias: metaSemana
  metaMensal:  0,  // alias: metaMes
  timezone: "America/Sao_Paulo",
  pushEnabled: false,
  pushSubscription: null
};

window.APP_STATE = {
  user: null,
  corridas: [],
  abastecimentos: [],
  despesas: [],
  entradas: [],
  jornadas: [],
  promos: [],
  metas: [],
  currentPeriod: 'today',
  filterPlat: 'all',
  lastUpdate: null,
  indriverSaldo: 0,      // saldo atual em créditos InDriver
  indriverSaldoMax: 100  // referência para a barra de progresso
};

// Initialize from localStorage if available
try {
  const savedCfg = localStorage.getItem('dash_config');
  if (savedCfg) {
    Object.assign(window.CONFIG_DATA, JSON.parse(savedCfg));
  }
} catch (e) {
  console.error("Erro ao carregar configuração:", e);
}
