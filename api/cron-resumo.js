const crypto=require('crypto');
const pool=require('./admin/_db');
const {sendPush}=require('./_push');
const {runWeeklySummary}=require('./_weekly-summary');
module.exports=async function(req,res){
 if(req.method!=='GET') return res.status(405).end();
 const secret=process.env.CRON_SECRET;
 const a=Buffer.from(`Bearer ${secret||''}`),b=Buffer.from(req.headers.authorization||'');
 if(!secret||a.length!==b.length||!crypto.timingSafeEqual(a,b)) return res.status(401).end();
 try {
  if(req.query?.run==='weekly') return res.status(200).json({weekly:await runWeeklySummary()});
  const today=new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'});
  const daily=await pool.query(`SELECT c.user_id,count(*)::int AS corridas,
    sum(CASE WHEN plataforma='InDriver' AND bruto>0 THEN bruto ELSE liquido END) AS receita
    FROM public.dashdriver_corridas c WHERE left(data::text,10)=$1 GROUP BY c.user_id`,[today]);
  const subs=await pool.query('SELECT user_id,endpoint,p256dh,auth FROM public.dashdriver_push_subscriptions WHERE user_id IS NOT NULL');
  let sent=0,failed=0;
  for(const s of subs.rows){
   const summary=daily.rows.find(r=>r.user_id===s.user_id);if(!summary)continue;
   try {await sendPush(s,{title:'Seu resumo do dia',body:`${summary.corridas} corrida(s) · Receita de R$ ${Number(summary.receita||0).toFixed(2).replace('.',',')}`,tag:'resumo-diario',url:'/'});sent++;}catch{failed++;}
  }
  const weekly=new Date(today+'T12:00:00Z').getUTCDay()===0?await runWeeklySummary():null;
  return res.status(200).json({daily:{sent,failed},weekly});
 }catch{return res.status(503).json({error:'Resumo não concluído. Verifique os serviços.'});}
};
