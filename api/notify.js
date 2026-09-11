// Compatibility endpoint for older admin clients; uses the same protected sender.
const broadcast=require('./admin/broadcast');
module.exports=async function(req,res){
 if(req.query?.retired==='whatsapp') return res.status(410).json({error:'Canal desativado. Use e-mail ou notificações.'});
 const {title,body}=req.body||{};
 req.body={channel:'push',subject:title,message:body};
 return broadcast(req,res);
};
