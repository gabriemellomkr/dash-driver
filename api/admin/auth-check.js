const crypto = require('crypto');

// JWT_SECRET: mesma chave usada pelo Supabase GoTrue para assinar os tokens
// ADMIN_EMAILS: lista de emails admin separados por vírgula
const JWT_SECRET   = process.env.JWT_SECRET   || 'DashDriver_Ultra_Secret_Key_2026_SquadHQ';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'gabriel18mello@gmail.com')
  .split(',').map(e => e.trim().toLowerCase());

function verifyJWT(token) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Formato JWT inválido');

  const [header, payload, signature] = parts;

  // Verifica assinatura HMAC-SHA256
  const expected = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''); // base64url

  if (expected !== signature) throw new Error('Assinatura JWT inválida');

  // Decodifica payload
  const decoded = JSON.parse(
    Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
  );

  // Verifica expiração
  if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expirado');
  }

  return decoded;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { user_id, email, access_token } = req.body || {};
  if (!user_id || !email) return res.status(400).json({ admin: false, error: 'Missing user_id or email' });
  if (!access_token)      return res.status(400).json({ admin: false, error: 'Missing access_token' });

  try {
    const claims = verifyJWT(access_token);

    // O email deve bater com o claim do JWT (garante que o token é desse usuário)
    const tokenEmail = (claims.email || '').toLowerCase();
    if (tokenEmail !== email.toLowerCase()) {
      return res.status(200).json({ admin: false });
    }

    const isAdmin = ADMIN_EMAILS.includes(tokenEmail);
    return res.status(200).json({ admin: isAdmin });

  } catch (e) {
    return res.status(200).json({ admin: false, error: e.message });
  }
};
