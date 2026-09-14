const {verifyUser}=require('./_verify-user');
const {validSubscription}=require('./_push');
const pool=require('./admin/_db');
module.exports=async function(req,res){
 if(req.method==='GET') {
  if(!process.env.VAPID_PUBLIC_KEY) return res.status(503).json({error:'Notificações ainda não configuradas.'});
  res.setHeader('Cache-Control','no-store');
  return res.status(200).json({publicKey:process.env.VAPID_PUBLIC_KEY});
 }
 if(req.method!=='POST') return res.status(405).end();
 const claims=await verifyUser(req);
 if(!claims) return res.status(401).json({error:'Não autenticado'});
 const {subscription,action}=req.body||{};
 if(!validSubscription(subscription)) return res.status(400).json({error:'Inscrição inválida'});
 try {
  if(action==='unsubscribe') {
   await pool.query('DELETE FROM public.dashdriver_push_subscriptions WHERE endpoint=$1 AND user_id=$2',[subscription.endpoint,claims.sub]);
  } else {
   const result=await pool.query(`INSERT INTO public.dashdriver_push_subscriptions (endpoint,p256dh,auth,user_id)
    VALUES ($1,$2,$3,$4) ON CONFLICT (endpoint) DO UPDATE SET p256dh=EXCLUDED.p256dh,auth=EXCLUDED.auth,user_id=EXCLUDED.user_id
    WHERE dashdriver_push_subscriptions.user_id=EXCLUDED.user_id OR dashdriver_push_subscriptions.user_id IS NULL RETURNING endpoint`,
    [subscription.endpoint,subscription.keys.p256dh,subscription.keys.auth,claims.sub]);
   if(!result.rows.length) return res.status(409).json({error:'Renove a permissão de notificações neste dispositivo.'});
  }
  return res.status(200).json({ok:true});
 } catch {return res.status(503).json({error:'Não foi possível salvar a preferência.'});}
};
