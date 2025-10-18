// /api/db-test.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    const supa = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE
    );

    // fila "dummy" para probar
    const payload = { id: 'test_from_vercel', email: 'ping@vercel.test' };

    const { error } = await supa
      .from('customers')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.error('❌ Supabase upsert error:', error);
      return res.status(500).json({ ok: false, error });
    }

    return res.status(200).json({ ok: true, inserted: payload });
  } catch (e) {
    console.error('❌ Function error:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
