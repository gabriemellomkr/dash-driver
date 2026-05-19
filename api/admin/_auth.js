const crypto = require('crypto');

const JWT_SECRET   = process.env.JWT_SECRET   || 'DashDriver_Ultra_Secret_Key_2026_SquadHQ';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'gabriel18mello@gmail.com')
  .split(',').map(e => e.trim().toLowerCase());

/**
 * Verifica o Bearer token da requisição.
 * Retorna os claims JWT se for admin válido, ou null.
 */
function verifyAdmin(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts;
  const expected = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${h}.${p}`)
    .digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  if (expected !== sig) return null;
  try {
    const claims = JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) return null;
    if (!ADMIN_EMAILS.includes((claims.email || '').toLowerCase())) return null;
    return claims;
  } catch { return null; }
}

module.exports = { verifyAdmin };
