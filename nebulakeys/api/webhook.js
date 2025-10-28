// /api/webhook.js
import Stripe from 'stripe';
import getRawBody from 'raw-body';
import { createClient } from '@supabase/supabase-js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method not allowed');
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
  });

  let event;
  try {
    const raw = await getRawBody(req);
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(
      raw,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('❌ Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const supaAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE
  );

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        // cuando se termina el checkout
        const s = event.data.object;
        // s.customer_email, s.customer (id stripe), etc.

        // upsert en customers
        if (s.customer && s.customer_email) {
          await supaAdmin
            .from('customers')
            .upsert(
              {
                id: s.customer,
                email: s.customer_email,
              },
              { onConflict: 'id' }
            );
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        // Campos relevantes
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
            : null,
        };

        if (event.type === 'customer.subscription.deleted') {
          // borra sub si se cancela
          await supaAdmin.from('subscriptions').delete().eq('id', sub.id);
        } else {
          // upsert sub
          await supaAdmin
            .from('subscriptions')
            .upsert(row, { onConflict: 'id' });
        }

        // Asegurar que exista el customer
        if (sub.customer && sub.customer_details?.email) {
          await supaAdmin
            .from('customers')
            .upsert(
              {
                id: sub.customer,
                email: sub.customer_details.email,
              },
              { onConflict: 'id' }
            );
        }

        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('❌ Error guardando en DB:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
