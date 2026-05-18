/* DashDriver — Notificações (Camada 1: in-app + Camada 2: browser push + Camada 3: WhatsApp) */

const NOTIF_KEY = 'dd_notifs';
const NOTIF_MAX = 50;

// ─── Storage ──────────────────────────────────────────
function _getNotifs() {
  try { return JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]'); }
  catch { return []; }
}
function _saveNotifs(list) {
  localStorage.setItem(NOTIF_KEY, JSON.stringify(list.slice(0, NOTIF_MAX)));
}

// ─── Camada 3: WhatsApp via Evolution API ─────────────
async function _sendWhatsApp(text) {
  const tel = CONFIG_DATA.telefone;
  if (!tel) {
    console.info('[DashDriver] WhatsApp não enviado: número não configurado em Configurações.');
    return;
  }
  try {
    const r = await fetch('/api/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: tel, text }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      console.warn('[DashDriver] WhatsApp falhou:', err);
    }
  } catch(e) { console.warn('[DashDriver] WhatsApp erro de rede:', e); }
}

// ─── Tipos que disparam WhatsApp (metas + docs críticos) ─
const WHATSAPP_TIPOS = [
  'META_DIA_OK', 'META_SEM_OK', 'META_MES_OK', 'META_DIA_QUASE',
  'DOC_VENCIDO_CNH', 'DOC_VENCIDO_IPVA', 'DOC_VENCIDO_Seguro', 'DOC_VENCIDO_Licenciamento',
  'DOC_7D_CNH', 'DOC_7D_IPVA', 'DOC_7D_Seguro', 'DOC_7D_Licenciamento',
];

// ─── Adicionar (dedup por tipo nas últimas 6h) ────────
function addNotif({ tipo, titulo, desc, icon }) {
  const list  = _getNotifs();
  const seisH = 6 * 60 * 60 * 1000;
  if (list.find(n => n.tipo === tipo && (Date.now() - n.ts) < seisH)) return;

  list.unshift({ id: Date.now(), tipo, titulo, desc, icon, ts: Date.now(), lida: false });
  _saveNotifs(list);
  updateNotifBadge();

  // Camada 2: browser push nativo
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification(titulo, { body: desc, icon: '/icon-192.png', badge: '/icon-192.png', tag: tipo });
    } catch(e) { /* SW pode não estar ativo */ }
  }

  // Camada 3: WhatsApp — apenas eventos importantes
  if (WHATSAPP_TIPOS.includes(tipo)) {
    _sendWhatsApp(`${icon} *${titulo}*\n${desc}`);
  }
}

// ─── Badge com contador ───────────────────────────────
window.updateNotifBadge = function() {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  const count = _getNotifs().filter(n => !n.lida).length;
  if (count > 0) {
    badge.classList.remove('hidden');
    badge.textContent = count > 9 ? '9+' : String(count);
  } else {
    badge.classList.add('hidden');
    badge.textContent = '';
  }
};

// ─── Verificar metas ──────────────────────────────────
window.checkGoals = function() {
  const mD = CONFIG_DATA.metaDiaria  || 0;
  const mS = CONFIG_DATA.metaSemanal || 0;
  const mM = CONFIG_DATA.metaMensal  || 0;
  if (!mD && !mS && !mM) return;

  const tz   = CONFIG_DATA.timezone || 'America/Sao_Paulo';
  const now  = new Date();
  const hoje = now.toLocaleDateString('sv-SE', { timeZone: tz });

  const dow    = new Date(now.toLocaleString('en-US', { timeZone: tz })).getDay();
  const iniSem = new Date(now); iniSem.setDate(iniSem.getDate() - dow);
  const startSem = iniSem.toLocaleDateString('sv-SE', { timeZone: tz });
  const startMes = hoje.slice(0, 7);

  // Lucro do período = receita − abastecimentos − despesas
  function lucroPeriodo(startDate, endDate) {
    const end = endDate || '9999-12-31';
    const receita = (APP_STATE.corridas || [])
      .filter(c => { const d = (c.data||'').slice(0,10); return d >= startDate && d <= end; })
      .reduce((s,c) => s + ((c.plat === 'InDriver' && c.bruto > 0) ? c.bruto : (c.liquido||0)), 0);
    const gas  = (APP_STATE.abastecimentos||[])
      .filter(a => { const d = (a.data||'').slice(0,10); return d >= startDate && d <= end; })
      .reduce((s,a) => s+(a.valor||0), 0);
    const desp = (APP_STATE.despesas||[])
      .filter(d => { const dd = (d.data||'').slice(0,10); return dd >= startDate && dd <= end; })
      .reduce((s,d) => s+(d.valor||0), 0);
    return receita - gas - desp;
  }

  const lucroHoje   = lucroPeriodo(hoje, hoje);
  const lucroSemana = lucroPeriodo(startSem);
  const lucroMes    = lucroPeriodo(startMes);

  if (mD > 0) {
    if (lucroHoje >= mD)
      addNotif({ tipo: 'META_DIA_OK', icon: '🎯', titulo: 'Meta diária ativa!',
        desc: 'Sua meta diária está ativa. Continue assim, bora mais! 🚀' });
    else if (lucroHoje >= mD * 0.8)
      addNotif({ tipo: 'META_DIA_QUASE', icon: '⚡', titulo: 'Quase lá!',
        desc: 'Você está a menos de 20% de bater sua meta diária. Não para agora!' });
  }
  if (mS > 0 && lucroSemana >= mS)
    addNotif({ tipo: 'META_SEM_OK', icon: '🏆', titulo: 'Meta semanal ativa!',
      desc: 'Sua meta semanal está ativa. Semana incrível! 🎉' });
  if (mM > 0 && lucroMes >= mM)
    addNotif({ tipo: 'META_MES_OK', icon: '👑', titulo: 'Meta mensal ativa!',
      desc: 'Sua meta mensal está ativa. Mês arrasado! 🔥' });
};

// ─── Verificar documentos ─────────────────────────────
window.checkDocuments = function() {
  const v = JSON.parse(localStorage.getItem('dd_veiculo') || '{}');
  if (!v || !Object.keys(v).length) return;

  const hoje = new Date();
  [
    { campo: v.cnhVenc, label: 'CNH',          icon: '🪪'  },
    { campo: v.ipva,    label: 'IPVA',          icon: '🏛️' },
    { campo: v.seguro,  label: 'Seguro',        icon: '🔒'  },
    { campo: v.licenc,  label: 'Licenciamento', icon: '📋'  },
  ].forEach(({ campo, label, icon }) => {
    if (!campo) return;
    const dias = Math.round((new Date(campo + 'T12:00:00') - hoje) / 86400000);
    if      (dias <= 0)  addNotif({ tipo: `DOC_VENCIDO_${label}`, icon: '🚨',
      titulo: `${label} vencido!`, desc: `Seu ${label} venceu há ${Math.abs(dias)} dia(s). Regularize agora.` });
    else if (dias <= 7)  addNotif({ tipo: `DOC_7D_${label}`, icon,
      titulo: `${label} vence em ${dias} dia(s)`, desc: `Providencie a renovação do seu ${label} o quanto antes.` });
    else if (dias <= 15) addNotif({ tipo: `DOC_15D_${label}`, icon,
      titulo: `${label} vence em ${dias} dias`, desc: `Seu ${label} vence em ${dias} dias.` });
    else if (dias <= 30) addNotif({ tipo: `DOC_30D_${label}`, icon,
      titulo: `${label} vence em ${dias} dias`, desc: `Lembrete: menos de 30 dias para vencer.` });
  });
};

// ─── Verificar badges da Carreira ─────────────────────
window.checkBadges = function() {
  if (typeof BADGES === 'undefined' || typeof window._calcStats !== 'function') return;
  const stats  = window._calcStats();
  const earned = JSON.parse(localStorage.getItem('dd_badges_earned') || '[]');
  let changed  = false;
  BADGES.forEach(badge => {
    if (badge.check(stats) && !earned.includes(badge.id)) {
      earned.push(badge.id);
      changed = true;
      addNotif({ tipo: `BADGE_${badge.id}`, icon: badge.emoji,
        titulo: `Badge desbloqueado: ${badge.nome}!`, desc: badge.desc });
    }
  });
  if (changed) localStorage.setItem('dd_badges_earned', JSON.stringify(earned));
};

// ─── Teste manual de WhatsApp ─────────────────────────
window.testarWhatsApp = async function() {
  const tel = CONFIG_DATA.telefone;
  if (!tel) {
    utils.toast('Configure seu número WhatsApp nas configurações primeiro', 'error');
    return;
  }
  utils.toast('Enviando teste...', 'success');
  try {
    const r = await fetch('/api/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: tel, text: '✅ *DashDriver*\nTeste de notificação — funcionando!' }),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok) {
      utils.toast('✅ WhatsApp enviado com sucesso!', 'success');
    } else {
      utils.toast('Erro: ' + (data.error || r.status), 'error');
      console.error('[DashDriver] Teste WhatsApp falhou:', data);
    }
  } catch(e) {
    utils.toast('Erro de rede: ' + e.message, 'error');
  }
};

// ─── Pedir permissão browser push ─────────────────────
window.requestNotifPermission = async function() {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'default') {
    const r = await Notification.requestPermission();
    if (r === 'granted') utils.toast('Notificações ativadas! 🔔', 'success');
  }
};

// ─── UI: painel de notificações ───────────────────────
window.openNotifications = function() {
  requestNotifPermission();
  const modal = document.getElementById('notif-modal');
  if (modal) modal.style.display = 'flex';
  _renderNotifList();
};

window.closeNotifications = function() {
  const modal = document.getElementById('notif-modal');
  if (modal) modal.style.display = 'none';
};

window.marcarTodasLidas = function() {
  _saveNotifs([]);
  updateNotifBadge();
  _renderNotifList();
  utils.toast('Notificações apagadas', 'success');
};

function _timeAgo(ts) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1)  return 'agora';
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

function _renderNotifList() {
  const el = document.getElementById('notif-list');
  if (!el) return;
  const list = _getNotifs();
  _saveNotifs(list.map(n => ({ ...n, lida: true })));
  updateNotifBadge();

  if (list.length === 0) {
    el.innerHTML = `
      <div class="flex flex-col items-center justify-center py-14 opacity-40">
        <span class="material-symbols-outlined mb-2" style="font-size:48px">notifications_none</span>
        <p class="text-sm font-medium">Nenhuma notificação</p>
        <p class="text-[11px] mt-1">Registre corridas para receber alertas</p>
      </div>`;
    return;
  }

  el.innerHTML = list.map(n => `
    <div class="flex items-start gap-3 py-3.5 border-b border-white/5 last:border-0">
      <div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-xl" style="background:rgba(255,255,255,.06)">${n.icon}</div>
      <div class="flex-1 min-w-0">
        <div class="text-white text-[13px] font-bold leading-snug">${n.titulo}</div>
        <div class="text-outline text-[11px] mt-0.5 leading-snug">${n.desc}</div>
        <div class="text-outline/50 text-[10px] mt-1">${_timeAgo(n.ts)}</div>
      </div>
    </div>`).join('');
}

// ─── Init ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateNotifBadge();
  setTimeout(() => {
    if (APP_STATE?.user) { checkDocuments(); checkGoals(); }
  }, 2500);
});
