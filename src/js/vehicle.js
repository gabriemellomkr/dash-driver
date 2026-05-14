/* DashDriver — Aba Carteira (visualização de documentos) */

function _diasParaVencer(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T12:00:00');
  return Math.ceil((d - today) / (1000 * 60 * 60 * 24));
}

function _statusDias(dias) {
  if (dias === null) return { txt: '—', cor: '#8b90a0', bg: 'rgba(139,144,160,.15)' };
  if (dias <= 0)     return { txt: 'Vencido!',   cor: '#f87171', bg: 'rgba(248,113,113,.15)' };
  if (dias <= 15)    return { txt: `${dias}d ⚠️`, cor: '#f87171', bg: 'rgba(248,113,113,.15)' };
  if (dias <= 30)    return { txt: `${dias}d ⚠️`, cor: '#fb923c', bg: 'rgba(251,146,60,.15)' };
  if (dias <= 60)    return { txt: `${dias} dias`, cor: '#fbbf24', bg: 'rgba(251,191,36,.15)' };
  return { txt: `${dias} dias`, cor: '#4ade80', bg: 'rgba(74,222,128,.15)' };
}

window.renderCarteira = function() {
  const v    = JSON.parse(localStorage.getItem('dd_veiculo') || '{}');
  const nome = (typeof CONFIG_DATA !== 'undefined' && CONFIG_DATA?.nome) ? CONFIG_DATA.nome : '';
  const el   = (id) => document.getElementById(id);

  const temDados = nome || v.modelo || v.placa || v.cnhNum;
  const emptyEl  = el('carteira-empty');
  if (emptyEl) emptyEl.style.display = temDados ? 'none' : 'flex';

  // ── CNH ──────────────────────────────────────────────
  if (el('carteira-cnh-nome')) el('carteira-cnh-nome').textContent = nome || '—';
  if (el('carteira-cnh-cat'))  el('carteira-cnh-cat').textContent  = v.cnhCat || '—';
  if (el('carteira-cnh-num'))  el('carteira-cnh-num').textContent  = v.cnhNum ? `Nº ${v.cnhNum}` : 'Nº —';

  const cnhDias = _diasParaVencer(v.cnhVenc);
  const cnhSt   = _statusDias(cnhDias);

  if (el('carteira-cnh-venc-fmt')) {
    el('carteira-cnh-venc-fmt').textContent = v.cnhVenc
      ? new Date(v.cnhVenc + 'T12:00:00').toLocaleDateString('pt-BR')
      : '—';
  }
  if (el('carteira-cnh-badge')) {
    el('carteira-cnh-badge').textContent      = cnhSt.txt;
    el('carteira-cnh-badge').style.color      = cnhSt.cor;
    el('carteira-cnh-badge').style.background = cnhSt.bg;
  }
  if (el('carteira-cnh-bar')) {
    const pct = cnhDias === null ? 0 : Math.min(100, Math.max(0, (cnhDias / 365) * 100));
    el('carteira-cnh-bar').style.width      = pct + '%';
    el('carteira-cnh-bar').style.background = cnhSt.cor;
  }

  // ── Veículo ───────────────────────────────────────────
  if (el('carteira-veiculo-modelo'))  el('carteira-veiculo-modelo').textContent  = v.modelo  || '—';
  if (el('carteira-veiculo-placa'))   el('carteira-veiculo-placa').textContent   = v.placa   || '—';
  if (el('carteira-veiculo-renavan')) el('carteira-veiculo-renavan').textContent = v.renavan || '—';

  // ── Documentos ────────────────────────────────────────
  [
    { id: 'carteira-ipva-dias',   date: v.ipva   },
    { id: 'carteira-seguro-dias', date: v.seguro },
    { id: 'carteira-licenc-dias', date: v.licenc },
  ].forEach(({ id, date }) => {
    const dias  = _diasParaVencer(date);
    const st    = _statusDias(dias);
    const docEl = el(id);
    if (!docEl) return;
    docEl.textContent  = st.txt;
    docEl.style.color  = st.cor;
  });
};

// Backward-compat (ui.js still calls loadVeiculoUI in some paths)
window.loadVeiculoUI = window.renderCarteira;
