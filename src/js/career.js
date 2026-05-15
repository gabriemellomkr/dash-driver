/* DashDriver — Aba Carreira (gamificação) */

// ─── Níveis ───────────────────────────────────────────
// XP = corridas × 5 + km × 0.5
const LEVELS = [
  { name: 'Novato',   min:      0, icon: '🆕', cor: '#8b90a0' },
  { name: 'Bronze',   min:    500, icon: '🥉', cor: '#cd7f32' },
  { name: 'Prata',    min:  2_000, icon: '🥈', cor: '#94a3b8' },
  { name: 'Ouro',     min:  6_000, icon: '🥇', cor: '#fbbf24' },
  { name: 'Diamante', min: 15_000, icon: '💎', cor: '#60a5fa' },
  { name: 'Lendário', min: 30_000, icon: '👑', cor: '#a78bfa' },
];

// ─── Badges ───────────────────────────────────────────
const BADGES = [
  // Corridas
  { id: 'c1',   emoji: '🏁', nome: 'Primeiro Arranque', desc: 'Registrou a 1ª corrida',       check: s => s.corridas >= 1    },
  { id: 'c10',  emoji: '🏍️', nome: 'Dez Corridas',      desc: '10 corridas registradas',      check: s => s.corridas >= 10   },
  { id: 'c50',  emoji: '💨', nome: 'Cinquentão',         desc: '50 corridas no total',         check: s => s.corridas >= 50   },
  { id: 'c100', emoji: '💯', nome: 'Clube dos 100',      desc: '100 corridas registradas',     check: s => s.corridas >= 100  },
  { id: 'c500', emoji: '🔥', nome: 'Veterano',           desc: '500 corridas no total',        check: s => s.corridas >= 500  },
  { id: 'c1k',  emoji: '🏆', nome: 'Mil Corridas',       desc: '1.000 corridas — lendário!',   check: s => s.corridas >= 1000 },

  // Quilometragem
  { id: 'km100', emoji: '📍', nome: 'Primeiros 100 km', desc: '100 km rodados',                check: s => s.km >= 100   },
  { id: 'km500', emoji: '🗺️', nome: 'Explorador',       desc: '500 km rodados',                check: s => s.km >= 500   },
  { id: 'km1k',  emoji: '🛣️', nome: 'Mil Quilômetros',  desc: '1.000 km no total',             check: s => s.km >= 1000  },
  { id: 'km5k',  emoji: '🚀', nome: 'Longa Distância',  desc: '5.000 km rodados',              check: s => s.km >= 5000  },
  { id: 'km10k', emoji: '🌍', nome: 'Maratonista',      desc: '10.000 km no total',            check: s => s.km >= 10000 },
  { id: 'km50k', emoji: '🌟', nome: 'Volta ao Mundo',   desc: '50.000 km — quase uma volta!',  check: s => s.km >= 50000 },

  // Faturamento
  { id: 'f1k',   emoji: '💵', nome: 'Primeiro Mil',    desc: 'Faturou R$ 1.000',              check: s => s.fat >= 1000   },
  { id: 'f5k',   emoji: '💸', nome: 'Cinco Mil',       desc: 'Faturou R$ 5.000',              check: s => s.fat >= 5000   },
  { id: 'f10k',  emoji: '💰', nome: 'Dez Mil',         desc: 'Faturou R$ 10.000',             check: s => s.fat >= 10000  },
  { id: 'f25k',  emoji: '🤑', nome: 'Vinte e Cinco',   desc: 'Faturou R$ 25.000',             check: s => s.fat >= 25000  },
  { id: 'f50k',  emoji: '🏦', nome: 'Cinquenta Mil',   desc: 'Faturou R$ 50.000',             check: s => s.fat >= 50000  },
  { id: 'f100k', emoji: '👑', nome: 'Clube dos 100k',  desc: 'Faturou R$ 100.000!',           check: s => s.fat >= 100000 },
];

// ─── Helpers ──────────────────────────────────────────
function _calcStats() {
  const corridas = APP_STATE.corridas.length;
  const km  = APP_STATE.corridas.reduce((s, c) => s + (c.km || 0), 0);
  const fat = APP_STATE.corridas.reduce((s, c) => {
    if (c.plat === 'InDriver' && c.bruto > 0) return s + c.bruto;
    return s + (c.liquido || 0);
  }, 0);
  return { corridas, km, fat };
}

function _calcXP(stats) {
  return Math.round(stats.corridas * 5 + stats.km * 0.5);
}

function _getLevel(xp) {
  let current = LEVELS[0], next = LEVELS[1];
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].min) {
      current = LEVELS[i];
      next    = LEVELS[i + 1] || null;
      break;
    }
  }
  return { current, next };
}

function _fmtKm(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.', ',') + 'k';
  return Math.round(n).toString();
}

// ─── Render principal ─────────────────────────────────
window.renderCarreira = function() {
  const stats = _calcStats();
  const xp    = _calcXP(stats);
  const { current, next } = _getLevel(xp);
  const el = id => document.getElementById(id);

  // ── Level card ──
  if (el('carreira-level-icon'))    el('carreira-level-icon').textContent    = current.icon;
  if (el('carreira-level-bg-icon')) el('carreira-level-bg-icon').textContent = current.icon;
  if (el('carreira-level-name'))    el('carreira-level-name').textContent    = current.name;
  if (el('carreira-xp-label'))      el('carreira-xp-label').textContent      = `${xp.toLocaleString('pt-BR')} XP`;

  // Borda do card com a cor do nível
  const card = el('carreira-level-card');
  if (card) card.style.borderColor = current.cor + '55';

  // Progress bar
  const bar = el('carreira-progress-bar');
  if (next) {
    const pct = ((xp - current.min) / (next.min - current.min)) * 100;
    if (bar) {
      bar.style.width      = Math.min(100, pct) + '%';
      bar.style.background = `linear-gradient(90deg, ${current.cor}, ${next.cor})`;
    }
    if (el('carreira-xp-next'))
      el('carreira-xp-next').textContent =
        `próximo (${next.name}): ${next.min.toLocaleString('pt-BR')} XP`;
  } else {
    if (bar) { bar.style.width = '100%'; bar.style.background = current.cor; }
    if (el('carreira-xp-next')) el('carreira-xp-next').textContent = 'Nível máximo! 👑';
  }

  // ── Stats rápidos ──
  if (el('carreira-stat-corridas'))
    el('carreira-stat-corridas').textContent = stats.corridas.toLocaleString('pt-BR');
  if (el('carreira-stat-km'))
    el('carreira-stat-km').textContent = _fmtKm(stats.km);
  if (el('carreira-stat-fat'))
    el('carreira-stat-fat').textContent =
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(stats.fat);

  // ── Badges ──
  const container = el('carreira-badges');
  if (!container) return;

  const unlocked = BADGES.filter(b =>  b.check(stats));
  const locked   = BADGES.filter(b => !b.check(stats));

  // Desbloqueadas primeiro, depois bloqueadas
  const ordered = [...unlocked, ...locked];

  container.innerHTML = ordered.map(badge => {
    const on = badge.check(stats);
    return `
      <div class="glass rounded-2xl p-3 flex items-center gap-3 ${on ? '' : 'opacity-35'}">
        <div class="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
             style="background:${on ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.03)'}">
          ${on ? badge.emoji : '🔒'}
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-${on ? 'white' : 'outline'} text-[12px] font-bold leading-tight truncate">${badge.nome}</div>
          <div class="text-outline text-[10px] mt-0.5 leading-tight">${badge.desc}</div>
        </div>
        ${on ? `<span class="material-symbols-outlined text-green-400 flex-shrink-0" style="font-size:14px">check_circle</span>` : ''}
      </div>`;
  }).join('');
};
