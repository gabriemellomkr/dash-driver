/**
 * DashDriver — Verificação de token de usuário.
 * Delega pro _verify-jwt (Supabase Cloud usa ES256 via JWKS pública).
 * Retorna os claims (com sub = user_id) ou null.
 */
const { verifyToken } = require('./_verify-jwt');

async function verifyUser(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  const claims = await verifyToken(auth.slice(7));
  if (!claims || !claims.sub) return null;
  return claims; // { sub: user_id, email, role, ... }
}

module.exports = { verifyUser };
