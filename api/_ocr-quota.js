const pool=require('./admin/_db');
async function reserveOCR(userId){
 const client=await pool.connect();
 try {
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('ocr:' || $1,0))",[userId]);
  const plan=await client.query(`SELECT 1 FROM public.dashdriver_plans WHERE user_id=$1 AND
   (plano='active' OR (plano IN ('trial','convidado') AND (trial_ends_at IS NULL OR trial_ends_at>now())))
   AND (expires_at IS NULL OR expires_at>now())`,[userId]);
  if(!plan.rows.length){await client.query('ROLLBACK');return {status:403};}
  const usage=await client.query("SELECT count(*)::int AS total FROM public.dashdriver_token_usage WHERE user_id=$1 AND feature='ocr' AND created_at>now()-interval '1 hour'",[userId]);
  if(usage.rows[0].total>=60){await client.query('ROLLBACK');return {status:429};}
  const row=await client.query("INSERT INTO public.dashdriver_token_usage (user_id,feature,tokens_in,tokens_out) VALUES ($1,'ocr',0,0) RETURNING id",[userId]);
  await client.query('COMMIT');
  return {status:200,id:row.rows[0].id};
 }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}
 finally{client.release();}
}
module.exports={reserveOCR};
