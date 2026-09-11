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
  metaSemanal: 0,
  metaMensal:  0,
  precoKm: 0,
  timezone: "America/Sao_Paulo",
  telefone: "",
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

// Cache is loaded only after its owner has been authenticated.
window.DEFAULT_CONFIG = {...window.CONFIG_DATA};
