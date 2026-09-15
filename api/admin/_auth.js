/**
 * DashDriver — Verificação de admin.
 * Valida o token do Supabase (ES256 via JWKS) e confere contra a allowlist.
 */
const { verifyToken } = require('../_verify-jwt');

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'gabriel18mello@gmail.com')
  .split(',').map(e => e.trim().toLowerCase());

function isAdminEmail(email) {
  return ADMIN_EMAILS.includes(String(email || '').toLowerCase());
}

async function verifyAdmin(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  const claims = await verifyToken(auth.slice(7));
  if (!claims || !claims.sub) return null;
  if (!isAdminEmail(claims.email)) return null;
  return claims;
}

module.exports = { verifyAdmin, isAdminEmail, ADMIN_EMAILS };
