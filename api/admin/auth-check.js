const https = require('https');
const http  = require('http');

const SB_URL = process.env.SB_URL || 'https://db-dash.nucleocriativo.com.br';
const SB_KEY = process.env.SB_KEY || 'uSLPst+6To2N5BXF3VipCYxUYkzL133Oy0bscyopivY=';

function request(url, opts, body) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
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
    const bodyStr = JSON.stringify({ check_email: email });
    const url = `${SB_URL}/rest/v1/rpc/check_is_admin`;
    const parsed = new URL(url);
    const { status, body } = await request(url, {
      hostname: parsed.hostname,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`,
      },
    }, bodyStr);

    let result;
    try { result = JSON.parse(body); } catch(e) { result = body; }
    // debug temporário
    return res.status(200).json({ admin: result === true, _sb_status: status, _result: result });
  } catch (e) {
    return res.status(500).json({ admin: false, error: e.message });
  }
};