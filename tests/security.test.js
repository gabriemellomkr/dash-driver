const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
process.env.SB_URL = 'https://project.supabase.co';
process.env.JWT_SECRET = 'test-secret-not-production';
const { verifyToken } = require('../api/_verify-jwt');
function jwt(overrides = {}) {
  const h = Buffer.from(JSON.stringify({alg:'HS256'})).toString('base64url');
  const p = Buffer.from(JSON.stringify({sub:'user-1',role:'authenticated',aud:'authenticated',iss:process.env.SB_URL+'/auth/v1',exp:Math.floor(Date.now()/1000)+600,...overrides})).toString('base64url');
  return `${h}.${p}.${crypto.createHmac('sha256',process.env.JWT_SECRET).update(`${h}.${p}`).digest('base64url')}`;
}
test('accepts a signed, unexpired user token for this project', async()=>assert.equal((await verifyToken(jwt())).sub,'user-1'));
for (const [name,claims] of Object.entries({expired:{exp:1},missing_exp:{exp:undefined},wrong_issuer:{iss:'https://other.example/auth/v1'},wrong_audience:{aud:'anon'},service_role:{role:'service_role'},future:{nbf:9999999999}})) {
 test(`rejects ${name} token`,async()=>assert.equal(await verifyToken(jwt(claims)),null));
}
test('rejects a tampered signature',async()=>assert.equal(await verifyToken(jwt().slice(0,-4)+'AAAA'),null));
