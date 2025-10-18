// /api/webhook.js
import Stripe from 'stripe';
import getRawBody from 'raw-body';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

const supa = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false } }
);

// Asegura que exista el customer en Supabase; si no, lo crea.
async function ensureCustomerExists(customerId) {
  if (!customerId) return null;

  const { data: existing, error: selErr } = await supa
    .from('customers')
    .select('id')
    .eq('id', customerId)
    .maybeSingle();
  if (selErr) throw selErr;

  if (existing) return existing.id;

  // Si no existe, pedimos el email al API de Stripe (sub.* no lo trae)
  const cust = await stripe.customers.retrieve(customerId);
  const email = cust.email ?? null;

  const { error: upErr } = await supa
    .from('customers')
    .upsert({ id: customerId, email }, { onConflict: 'id' });

  if (upErr) throw upErr;
  return customerId;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  let event;
  try {
    const raw = await getRawBody(req);
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(
      raw,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (e) {
    console.error('❌ Firma inválida:', e);
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object;
        const customer_id = s.customer;
        const email =
          s.customer_details?.email ?? s.customer_email ?? null;

        if (customer_id) {
          const { error } = await supa
            .from('customers')
            .upsert({ id: customer_id, email }, { onConflict: 'id' });
          if (error) throw error;
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object;

        const customer_id = sub.customer;
        // 🔒 Asegura que exista el customer para que no falle el FK
        await ensureCustomerExists(customer_id);

        const price_id = sub.items?.data?.[0]?.price?.id ?? null;
        const endSec = sub.current_period_end;
        const current_period_end = endSec
          ? new Date(endSec * 1000).toISOString()
          : null;

        const row = {
          id: sub.id,
          customer_id,
          status: sub.status,
          price_id,
          current_period_end,
        };

        const { error } = await supa
          .from('subscriptions')
          .upsert(row, { onConflict: 'id' });
        if (error) throw error;
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const { error } = await supa
          .from('subscriptions')
          .delete()
          .eq('id', sub.id);
        if (error) throw error;
        break;
      }

      default:
        // Ignorar otros eventos
        break;
    }

    return res.json({ received: true });
  } catch (e) {
    console.error('❌ Error DB/Webhook:', {
      message: e.message,
      code: e.code,
      details: e.details,
      hint: e.hint,
    });
    return res.status(500).json({ ok: false, error: e.message });
  }
}
