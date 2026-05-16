/* DashDriver — Aba Perfil */

window.renderPerfil = function() {
  const user = APP_STATE.user;
  if (!user) return;

  // Avatar: primeiras letras do e-mail ou display_name
  const name = user.user_metadata?.full_name || user.user_metadata?.name || '';
  const email = user.email || '';

  const initials = name
    ? name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : email.slice(0, 2).toUpperCase();

  const avatarEl = document.getElementById('perfil-avatar');
  const nomeEl   = document.getElementById('perfil-nome');
  const emailEl  = document.getElementById('perfil-email');

  if (avatarEl) avatarEl.textContent = initials || '?';
  if (nomeEl)   nomeEl.textContent   = name || email.split('@')[0];
  if (emailEl)  emailEl.textContent  = email;
};
