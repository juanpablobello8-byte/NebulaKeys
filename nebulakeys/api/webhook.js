// Webhook de Stripe: procesa checkout.session.completed y subscripciones
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Lee raw body para verificar firma
async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }
  let event;
  try {
    const rawBody = await readRawBody(req);
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (err) {
    console.error('⚠️  Error verificando firma del webhook:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.client_reference_id || (session.metadata && session.metadata.supabase_user_id) || null;
      const customerId = session.customer;
      const email = session.customer_details && session.customer_details.email;

      if (userId && customerId) {
        await supa.from('profiles').upsert({ user_id: userId, stripe_customer_id: customerId, email }, { onConflict: 'user_id' });
      }

      if (session.subscription && userId) {
        const sub = await stripe.subscriptions.retrieve(session.subscription);
        await supa.from('subscriptions').upsert({
          user_id: userId,
          subscription_id: sub.id,
          status: sub.status,
          price_id: sub.items.data[0].price.id,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          cancel_at: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null
        }, { onConflict: 'subscription_id' });
      }
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      const { data: prof } = await supa.from('profiles').select('user_id').eq('stripe_customer_id', sub.customer).maybeSingle();
      if (prof && prof.user_id) {
        await supa.from('subscriptions').upsert({
          user_id: prof.user_id,
          subscription_id: sub.id,
          status: sub.status,
          price_id: sub.items.data[0]?.price?.id || null,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          cancel_at: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null
        }, { onConflict: 'subscription_id' });
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).send('Internal error');
  }
};
