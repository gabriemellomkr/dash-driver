const https = require('https');
const http  = require('http');

// Kong key-auth: raw base64 key that identifies the service_role consumer
const SB_URL             = process.env.SB_URL || 'https://db-dash.nucleocriativo.com.br';
const SB_SERVICE_ROLE_KEY = process.env.SB_SERVICE_ROLE_KEY || 'K3RHlT5OjBCAhtb3J0TtOkhgkexf3hcnN4eb7H05Yrs=';

function httpGet(urlStr, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const lib    = parsed.protocol === 'https:' ? https : http;
    const opts   = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   'GET',
      headers,
    };
    const req = lib.request(opts, (res) => {
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

  const { user_id, email, access_token } = req.body || {};
  if (!user_id || !email) return res.status(400).json({ admin: false, error: 'Missing user_id or email' });
  if (!access_token) return res.status(400).json({ admin: false, error: 'Missing access_token' });

  try {
    const url = `${SB_URL}/rest/v1/dashdriver_admins?email=eq.${encodeURIComponent(email)}&select=id`;
    const { status, body } = await httpGet(url, {
      apikey:        SB_SERVICE_ROLE_KEY,      // Kong consumer key (key-auth plugin)
      Authorization: `Bearer ${access_token}`, // User JWT → PostgREST applies RLS (auth.email()=email)
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
