const pool=require('./admin/_db');
const {verifyUser}=require('./_verify-user');
module.exports=async function(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).end();
 const user=await verifyUser(req);if(!user)return res.status(401).json({error:'Não autenticado'});
 const tables=['dashdriver_config','dashdriver_corridas','dashdriver_abastecimentos','dashdriver_outras_despesas','dashdriver_outras_entradas','dashdriver_jornadas','dashdriver_promos','dashdriver_metas','dashdriver_support'];
 try{
  const result={exported_at:new Date().toISOString(),account:{id:user.sub,email:user.email},data:{}};
  for(const table of tables){
   const r=await pool.query(`SELECT * FROM public.${table} WHERE user_id=$1`,[user.sub]);
   result.data[table]=r.rows;
  }
  const messages=await pool.query(`SELECT m.id,m.ticket_id,m.sender_role,m.conteudo,m.tipo,m.created_at FROM public.dashdriver_support_messages m
   JOIN public.dashdriver_support s ON s.id=m.ticket_id WHERE s.user_id=$1 ORDER BY m.created_at`,[user.sub]);
  result.data.dashdriver_support_messages=messages.rows;
  return res.status(200).json(result);
 }catch{return res.status(503).json({error:'Exportação indisponível. Solicite uma cópia pelo suporte.'});}
};
