/**
 * DashDriver — Verificação de admin.
 * Valida o token do Supabase (ES256 via JWKS) e confere contra a allowlist.
 */
const { verifyToken } = require('../_verify-jwt');

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'gabriel18mello@gmail.com')
  .split(',').map(e => e.trim().toLowerCase());

async function verifyAdmin(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  const claims = await verifyToken(auth.slice(7));
  if (!claims) return null;
  if (!ADMIN_EMAILS.includes((claims.email || '').toLowerCase())) return null;
  return claims;
}

module.exports = { verifyAdmin };
