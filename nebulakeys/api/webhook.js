import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Desactiva el parser: Stripe valida con el RAW body
export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

  let event;
  try {
    const raw = await readRawBody(req);
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('❌ Signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.user_id || session.metadata?.userId || null;
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;

        if (userId && customerId) {
          await supa.from('profiles')
            .update({ stripe_customer_id: customerId })
            .eq('id', userId);
        }

        if (session.subscription && userId) {
          const sub = await stripe.subscriptions.retrieve(session.subscription);
          await supa.from('subscriptions').upsert({
            user_id: userId,
            status: sub.status,
            price_id: sub.items?.data?.[0]?.price?.id ?? null,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString()
          }, { onConflict: 'user_id' });
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const customerId = sub.customer;

        const { data: prof } = await supa
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (prof?.id) {
          await supa.from('subscriptions').upsert({
            user_id: prof.id,
            status: sub.status,
            price_id: sub.items?.data?.[0]?.price?.id ?? null,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString()
          }, { onConflict: 'user_id' });
        }
        break;
      }

      default:
        // otros eventos: ignorar o loguear
        break;
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('❌ Webhook handler error:', err);
    return res.status(500).send(`Server error: ${err.message}`);
  }
}
