/**
 * DashDriver - Career
 * Gamification, levels, and achievements.
 */

window.renderCarreira = function() {
  const totalRec = APP_STATE.corridas.reduce((s, c) => s + c.liquido, 0);
  
  const levels = [
    { name: 'Iniciante', min: 0, icon: '🆕' },
    { name: 'Bronze', min: 1000, icon: '🥉' },
    { name: 'Prata', min: 5000, icon: '🥈' },
    { name: 'Ouro', min: 15000, icon: '🥇' },
    { name: 'Diamante', min: 50000, icon: '💎' }
  ];
  
  let currentLevel = levels[0];
  let nextLevel = levels[1];
  
  for (let i = levels.length - 1; i >= 0; i--) {
    if (totalRec >= levels[i].min) {
      currentLevel = levels[i];
      nextLevel = levels[i+1];
      break;
    }
  }
  
  document.getElementById('carreira-level-icon').textContent = currentLevel.icon;
  document.getElementById('carreira-level-name').textContent = currentLevel.name;
  
  if (nextLevel) {
    const progress = ((totalRec - currentLevel.min) / (nextLevel.min - currentLevel.min)) * 100;
    document.getElementById('carreira-progress-bar').style.width = Math.min(100, progress) + '%';
  } else {
    document.getElementById('carreira-progress-bar').style.width = '100%';
  }
};
