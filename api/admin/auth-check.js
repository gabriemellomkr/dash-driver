const https = require('https');
const http  = require('http');

// SB_URL: Supabase Dash Driver base URL
// SB_SERVICE_ROLE_KEY: raw base64 key used by Kong's key-auth (apikey header)
// SB_SERVICE_JWT: HS256 JWT signed with DashDriver JWT_SECRET — used by PostgREST (Bearer header)
const SB_URL             = process.env.SB_URL || 'https://db-dash.nucleocriativo.com.br';
const SB_SERVICE_ROLE_KEY = process.env.SB_SERVICE_ROLE_KEY || 'K3RHlT5OjBCAhtb3J0TtOkhgkexf3hcnN4eb7H05Yrs=';
const SB_SERVICE_JWT      = process.env.SB_SERVICE_JWT ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MTUwOTAwMDAsImV4cCI6MzI1MDM2ODAwMDB9' +
  '.SamepRuf8DmbrsrvBryafyXhYp9GFyntb_-yBMHkH3A';

function request(url, options) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { user_id, email } = req.body || {};
  if (!user_id || !email) return res.status(400).json({ admin: false, error: 'Missing user_id or email' });

  try {
    const url = `${SB_URL}/rest/v1/dashdriver_admins?email=eq.${encodeURIComponent(email)}&select=id`;
    const parsed = new URL(url);
    const { status, body } = await request(url, {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        apikey: SB_SERVICE_ROLE_KEY,      // Kong key-auth validation
        Authorization: `Bearer ${SB_SERVICE_JWT}`, // PostgREST JWT validation
      },
    });
    if (status !== 200) {
      return res.status(500).json({ admin: false, error: `Supabase error ${status}: ${body}` });
    }
    const rows = JSON.parse(body);
    return res.status(200).json({ admin: Array.isArray(rows) && rows.length > 0 });
  } catch (e) {
    return res.status(500).json({ admin: false, error: e.message });
  }
};
