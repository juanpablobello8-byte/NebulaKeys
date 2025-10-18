import { createClient } from '@supabase/supabase-js';

export default async function handler(req,res){
  const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
  const { error } = await supa
    .from('customers')
    .upsert({ id:'test_from_vercel', email:'ping@vercel.test' }, { onConflict:'id' });
  if (error) return res.status(500).json({ ok:false, error });
  res.status(200).json({ ok:true });
}
