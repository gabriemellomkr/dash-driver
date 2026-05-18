const https = require('https');
const http  = require('http');

const SB_URL             = process.env.SB_URL || '';
const SB_SERVICE_ROLE_KEY = process.env.SB_SERVICE_ROLE_KEY || '';

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
  if (!SB_SERVICE_ROLE_KEY) return res.status(500).json({ admin: false, error: 'SB_SERVICE_ROLE_KEY not configured' });
  if (!SB_URL) return res.status(500).json({ admin: false, error: 'SB_URL not configured' });

  try {
    const url = `${SB_URL}/rest/v1/dashdriver_admins?email=eq.${encodeURIComponent(email)}&select=id`;
    const parsed = new URL(url);
    const { body } = await request(url, {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        apikey: SB_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SB_SERVICE_ROLE_KEY}`,
      },
    });
    const rows = JSON.parse(body);
    return res.status(200).json({ admin: Array.isArray(rows) && rows.length > 0 });
  } catch (e) {
    return res.status(500).json({ admin: false, error: e.message });
  }
};
