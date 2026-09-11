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
  // Check current account status as well as the signed token (deleted/banned users).
  try {
    const response = await fetch(`${process.env.SB_URL}/auth/v1/user`, {
      headers:{apikey:process.env.SB_KEY || '',Authorization:auth}, signal:AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const user = await response.json();
    if (user.id !== claims.sub) return null;
    return {...claims,email:user.email};
  } catch {return null;}
}

module.exports = { verifyUser };
