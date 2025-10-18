// /api/webhook.js
import Stripe from 'stripe';
import getRawBody from 'raw-body';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const raw = (await getRawBody(req)).toString('utf8');
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('❌ Firma inválida:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const supa = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE
  );

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object; // Checkout Session
        const customerId = s.customer;             // "cus_..."
        const email = s.customer_details?.email || s.customer_email || null;

        if (customerId) {
          const { error } = await supa
            .from('customers')
            .upsert({ id: customerId, email }, { onConflict: 'id' });
          if (error) throw error;
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object;

        const row = {
          id: sub.id,
          customer_id: sub.customer,
          status: sub.status, // active | trialing | past_due | canceled | etc
          price_id: sub.items?.data?.[0]?.price?.id || null,
          current_period_end: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
          // opcional si tienes las columnas:
          // current_period_start: sub.current_period_start
          //   ? new Date(sub.current_period_start * 1000).toISOString()
          //   : null,
          // start_date: sub.start_date
          //   ? new Date(sub.start_date * 1000).toISOString()
          //   : null,
        };

        const { error } = await supa
          .from('subscriptions')
          .upsert(row, { onConflict: 'id' });

        if (error) throw error;
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        // Puedes borrar o marcar status = 'canceled'
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
    console.error('❌ Error en webhook:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
