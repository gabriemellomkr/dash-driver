/**
 * DashDriver - Admin Module
 * Super Admin functionality for global overview.
 */

window.renderAdmin = async function() {
  if (!APP_STATE.user || APP_STATE.user.id !== '3f85827d-119d-404d-be08-630a0d487f6c') {
    utils.toast("Acesso negado", "error");
    showTab('dash');
    return;
  }

  // Fetch global stats (this might require special RLS permissions or a service role, 
  // but for now we try to fetch what's visible or total count)
  try {
    // Exemplo: Contagem total de corridas no sistema
    const { count: ridesCount, error: errRides } = await supabase
      .from('dashdriver_corridas')
      .select('*', { count: 'exact', head: true });

    if (!errRides) {
      document.getElementById('adm-total-rides').textContent = ridesCount;
    }

    // Nota: Buscar total de usuários geralmente requer API externa ou tabela de perfis
    document.getElementById('adm-total-users').textContent = "1 (Beta)";

  } catch (e) {
    console.error("Erro no admin:", e);
  }
};
