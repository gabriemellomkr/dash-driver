/**
 * DashDriver - Analysis
 * Heatmaps and detailed stats.
 */

window.renderAnalise = function() {
  const container = document.getElementById('an-heatmap');
  if (!container) return;
  
  if (APP_STATE.corridas.length === 0) {
    container.innerHTML = '<div class="text-outline text-center py-10">Sem dados para análise</div>';
    return;
  }
  
  // Basic heatmap placeholder
  container.innerHTML = '<div class="text-white text-sm font-semibold mb-3">Atividade por horário</div>';
  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-6 gap-1';
  for(let i=0; i<24; i++) {
    const box = document.createElement('div');
    box.className = 'h-8 bg-blue-500/10 rounded-md flex items-center justify-center text-[10px] text-outline';
    box.textContent = i + 'h';
    grid.appendChild(box);
  }
  container.appendChild(grid);
};
