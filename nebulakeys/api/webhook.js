// /api/webhook.js
import Stripe from 'stripe';
import getRawBody from 'raw-body';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const sig = req.headers['stripe-signature'];
  let event;
  try {
    const raw = (await getRawBody(req)).toString('utf8');
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return res.status(400).send(`Webhook error: ${e.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object;
        const customer = s.customer; // cus_...
        const email = s.customer_details?.email || s.customer_email || null;
        if (customer && email) {
          await supa.from('customers').upsert({ id: customer, email }, { onConflict: 'id' });
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const row = {
          id: sub.id,
          customer_id: sub.customer,
          status: sub.status,
          price_id: sub.items?.data?.[0]?.price?.id || null,
          current_period_start: sub.current_period_start
            ? new Date(sub.current_period_start * 1000).toISOString()
            : null,
          current_period_end: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null
        };
        await supa.from('subscriptions').upsert(row, { onConflict: 'id' });
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await supa.from('subscriptions').update({ status: 'canceled' }).eq('id', sub.id);
        break;
      }
    }

    return res.json({ received: true });
  } catch (e) {
    console.error('webhook handler error:', e);
    return res.status(500).json({ error: e.message });
  }
}
