const webpush = require('web-push');
const pool = require('./admin/_db');
function validSubscription(s) {
  try {
    const u = new URL(s.endpoint);
    const hosts = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'];
    const allowed = hosts.includes(u.hostname) || u.hostname.endsWith('.push.apple.com') || u.hostname.endsWith('.notify.windows.com');
    return allowed && u.protocol === 'https:' && !u.username && !u.password && (!u.port || u.port === '443') &&
      /^[A-Za-z0-9_-]+={0,2}$/.test(s.keys?.p256dh || '') && /^[A-Za-z0-9_-]+={0,2}$/.test(s.keys?.auth || '') &&
      Buffer.from(s.keys.p256dh,'base64url').length === 65 && Buffer.from(s.keys.auth,'base64url').length === 16;
  } catch { return false; }
}
async function sendPush(subscription, payload) {
  const s = {endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}};
  if (!validSubscription(s)) throw new Error('Invalid push subscription');
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) throw new Error('Push not configured');
  webpush.setVapidDetails('mailto:suporte@dashdriver.com.br',process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
  try { await webpush.sendNotification(s, JSON.stringify(payload),{timeout:8000,TTL:3600}); }
  catch(error) {
    if ([404,410].includes(error.statusCode)) await pool.query('DELETE FROM public.dashdriver_push_subscriptions WHERE endpoint=$1',[s.endpoint]);
    throw error;
  }
}
module.exports = {validSubscription,sendPush};
