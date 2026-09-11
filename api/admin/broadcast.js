const pool = require('./_db');
const {verifyAdmin} = require('./_auth');
const {sendMail} = require('../_mailer');
const {sendPush} = require('../_push');
const escapeHTML = s => s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
module.exports = async function(req,res) {
  if(req.method!=='POST') return res.status(405).end();
  if(!await verifyAdmin(req)) return res.status(403).json({error:'Acesso restrito ao administrador.'});
  const {message,plano_filter,channel='email',subject='Mensagem do DashDriver',dry_run=false}=req.body||{};
  if(!['email','push','both'].includes(channel) || typeof message!=='string' || !message.trim() || message.length>4000 || typeof subject!=='string' || subject.length>150)
    return res.status(400).json({error:'Informe canal, assunto e mensagem válidos.'});
  if(plano_filter && !['trial','active','convidado','expired'].includes(plano_filter)) return res.status(400).json({error:'Plano inválido.'});
  try {
    const users=await pool.query(`SELECT u.id AS user_id,u.email,c.nome FROM auth.users u
      LEFT JOIN public.dashdriver_config c ON c.user_id=u.id
      LEFT JOIN public.dashdriver_plans p ON p.user_id=u.id
      WHERE ($1::text IS NULL OR p.plano=$1) ORDER BY u.id`,[plano_filter||null]);
    const subscriptions=channel==='email'?{rows:[]}:await pool.query('SELECT user_id,endpoint,p256dh,auth FROM public.dashdriver_push_subscriptions WHERE user_id IS NOT NULL');
    const recipients=users.rows.filter(u=>(channel!=='push'&&u.email) || subscriptions.rows.some(s=>s.user_id===u.user_id));
    if(dry_run===true) return res.status(200).json({total:recipients.length,channel});
    // Bounded work prevents unbounded fanout and serverless timeouts.
    if(recipients.length>20) return res.status(422).json({error:'Este envio ultrapassa 20 destinatários. Segmente por plano ou configure uma fila de envio.'});
    let sent=0,failed=0;
    const delivery={email:{sent:0,failed:0},push:{sent:0,failed:0}};
    for(let offset=0;offset<recipients.length;offset+=4) {
      await Promise.all(recipients.slice(offset,offset+4).map(async u => {
      const text=message.replace(/\{\{nome\}\}/g,()=>u.nome||'Motorista');
      let ok=true;
      if(channel!=='push'&&u.email) {
        try { await sendMail({to:u.email,subject,text,html:`<div style="font-family:sans-serif;line-height:1.7">${escapeHTML(text).replace(/\n/g,'<br>')}</div>`}); delivery.email.sent++; }
        catch { delivery.email.failed++; ok=false; }
      }
      if(channel!=='email') {
        for(const s of subscriptions.rows.filter(s=>s.user_id===u.user_id)) {
          try { await sendPush(s,{title:subject,body:text.slice(0,250),url:'/',tag:'admin-message'});delivery.push.sent++; }
          catch {delivery.push.failed++;ok=false;}
        }
      }
      if(ok) sent++; else failed++;
      }));
    }
    return res.status(200).json({sent,failed,total:recipients.length,delivery});
  } catch { return res.status(503).json({error:'Não foi possível concluir o envio. Verifique a configuração dos canais.'}); }
};
