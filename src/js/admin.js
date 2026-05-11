/**
 * DashDriver - Admin Module
 * SaaS management for Super Admins.
 */

window.admin = {
  async init() {
    if (APP_STATE.profile?.role !== 'super_admin') return;
    await this.loadUsers();
  },

  async loadUsers() {
    const { data: users, error } = await supabase
      .from('dashdriver_usuarios')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Erro ao carregar usuários:", error);
      return;
    }

    this.renderUsers(users);
  },

  renderUsers(users) {
    const listEl = document.getElementById('adm-users-list');
    const totalEl = document.getElementById('adm-total-users');
    const activeEl = document.getElementById('adm-active-users');

    if (!listEl) return;

    totalEl.textContent = users.length;
    activeEl.textContent = users.filter(u => u.subscription_status === 'ativo').length;

    if (users.length === 0) {
      listEl.innerHTML = '<div class="p-4 text-center text-outline text-xs italic">Nenhum motorista cadastrado ainda.</div>';
      return;
    }

    listEl.innerHTML = users.map(u => `
      <div class="p-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center border border-white/5">
            <span class="text-lg">${u.role === 'super_admin' ? '👑' : '👤'}</span>
          </div>
          <div>
            <p class="text-white text-sm font-bold">${u.full_name || 'Motorista'}</p>
            <p class="text-[10px] text-outline">${new Date(u.created_at).toLocaleDateString()}</p>
          </div>
        </div>
        <div class="text-right">
          <span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${this.getStatusClass(u.subscription_status)}">
            ${u.subscription_status}
          </span>
          <p class="text-[9px] text-outline mt-1">${u.role}</p>
        </div>
      </div>
    `).join('');
  },

  getStatusClass(status) {
    switch (status) {
      case 'ativo': return 'bg-green-400/10 text-green-400 border border-green-400/20';
      case 'trial': return 'bg-blue-400/10 text-blue-400 border border-blue-400/20';
      case 'bloqueado': return 'bg-red-400/10 text-red-400 border border-red-400/20';
      default: return 'bg-white/10 text-outline border border-white/20';
    }
  }
};
