import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const { priceId, userId, email } = req.body || {};
  if (!priceId || !userId || !email) return res.status(400).json({ error: 'Missing params' });

  try {
    // 1) ¿Tiene cliente en customers?
    const { data: cust } = await supa
      .from('customers')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    // 2) ¿Ya tiene suscripción activa?
    if (cust) {
      const { data: active } = await supa
        .from('subscriptions')
        .select('id')
        .eq('customer_id', cust.id)
        .in('status', ['active', 'trialing', 'past_due', 'unpaid'])
        .limit(1);
      if (active && active.length) {
        return res.status(409).json({ error: 'Ya tienes una suscripción activa.' });
      }
    }

    // 3) Crear Checkout
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${req.headers.origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/cancel.html`,
      customer_email: email,
      metadata: { user_id: userId, email }
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('create-checkout-session error:', e);
    return res.status(500).json({ error: e.message });
  }
}
