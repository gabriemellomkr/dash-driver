/**
 * DashDriver — Verificação de admin.
 * Valida o token do Supabase (ES256 via JWKS) e confere contra a allowlist.
 */
const { verifyUser } = require('../_verify-user');

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'gabriel18mello@gmail.com')
  .split(',').map(e => e.trim().toLowerCase());

async function verifyAdmin(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  const claims = await verifyUser(req);
  if (!claims) return null;
  if (!ADMIN_EMAILS.includes((claims.email || '').toLowerCase())) return null;
  return claims;
}

module.exports = { verifyAdmin };
