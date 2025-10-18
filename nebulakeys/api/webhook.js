// /api/webhook.js
import Stripe from 'stripe';
import { buffer } from 'micro';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  // ayuda extra por si faltara alguna ENV
  ['STRIPE_WEBHOOK_SECRET','STRIPE_SECRET_KEY','SUPABASE_URL','SUPABASE_SERVICE_ROLE']
    .forEach(k => { if (!process.env[k]) console.error(`ENV missing: ${k}`); });

  let event;
  try {
    const sig = req.headers['stripe-signature'];
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('❌ Firma inválida:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('✅ Evento recibido:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const customerId = session.customer;
        const email = session.customer_details?.email || session.customer_email || null;
        const subId = session.subscription;

        if (customerId) {
          const { error } = await supabase
            .from('customers')
            .upsert({ id: customerId, email }, { onConflict: 'id' });
          if (error) console.error('❌ upsert customers', error);
          else console.log('✅ customers ok');
        }

        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          const priceId = sub.items?.data?.[0]?.price?.id || null;

          const payload = {
            id: sub.id,
            customer_id: sub.customer,
            status: sub.status,
            price_id: priceId,
            current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          };

          const { error } = await supabase
            .from('subscriptions')
            .upsert(payload, { onConflict: 'id' });
          if (error) console.error('❌ upsert subscriptions', error, payload);
          else console.log('✅ subscriptions ok', payload);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const priceId = sub.items?.data?.[0]?.price?.id || null;

        const payload = {
          id: sub.id,
          customer_id: sub.customer,
          status: sub.status,
          price_id: priceId,
          current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        };

        const { error } = await supabase
          .from('subscriptions')
          .upsert(payload, { onConflict: 'id' });
        if (error) console.error('❌ upsert subscriptions', error, payload);
        else console.log('✅ subscriptions ok', payload);
        break;
      }

      default:
        console.log('ℹ️ Ignorado:', event.type);
    }
  } catch (e) {
    console.error('❌ Handler error', e);
    return res.status(500).send('Webhook handler error');
  }

  return res.status(200).json({ received: true });
}
