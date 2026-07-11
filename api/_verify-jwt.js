/**
 * DashDriver — Verificação de token do Supabase (Cloud usa ES256 assimétrico)
 *
 * O Supabase Cloud assina os access_tokens de usuário com ES256 (chave EC P-256).
 * Verificamos contra a JWKS pública do projeto (sem secret). A JWKS passa pelo
 * Kong, então o fetch precisa mandar o header `apikey` (a anon key).
 *
 * Mantém fallback HS256 (JWT_SECRET) caso um dia se use secret simétrico.
 *
 * Uso:
 *   const { verifyToken } = require('./_verify-jwt');
 *   const claims = await verifyToken(token); // { sub, email, role, ... } ou null
 */
const crypto = require('crypto');

const SB_URL   = process.env.SB_URL || '';
const SB_ANON  = process.env.SB_KEY || '';
const JWKS_URL = `${SB_URL}/auth/v1/.well-known/jwks.json`;
const JWKS_TTL = 10 * 60 * 1000; // 10 min

let _keys = null;
let _keysAt = 0;

async function getKeys() {
  if (_keys && (Date.now() - _keysAt) < JWKS_TTL) return _keys;
  const r = await fetch(JWKS_URL, { headers: SB_ANON ? { apikey: SB_ANON } : {} });
  if (!r.ok) throw new Error('JWKS fetch failed: ' + r.status);
  const data = await r.json();
  _keys = data.keys || [];
  _keysAt = Date.now();
  return _keys;
}

function b64urlToBuf(s) {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

async function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts;

  let header, payload;
  try {
    header  = JSON.parse(b64urlToBuf(h).toString('utf8'));
    payload = JSON.parse(b64urlToBuf(p).toString('utf8'));
  } catch { return null; }

  // Expiração
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

  try {
    if (header.alg === 'ES256') {
      const keys = await getKeys();
      const jwk  = keys.find(k => k.kid === header.kid) || keys[0];
      if (!jwk) return null;
      const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
      const ok = crypto.verify(
        'sha256',
        Buffer.from(`${h}.${p}`),
        { key, dsaEncoding: 'ieee-p1363' }, // JWT usa R||S cru, não DER
        b64urlToBuf(sig),
      );
      return ok ? payload : null;
    }

    if (header.alg === 'HS256') {
      const secret = process.env.JWT_SECRET;
      if (!secret) return null;
      const expected = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest();
      const got = b64urlToBuf(sig);
      if (expected.length !== got.length || !crypto.timingSafeEqual(expected, got)) return null;
      return payload;
    }

    return null; // algoritmo não suportado
  } catch {
    return null;
  }
}

module.exports = { verifyToken };
