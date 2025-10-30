// /api/create-checkout.js
// Vercel serverless function (Node 18/22)
import Stripe from 'stripe';

export default async function handler(req, res) {
  // Exigir POST (evita "Method Not Allowed")
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

    const { priceId, userId, email } = req.body || {};
    if (!priceId) return res.status(400).send('Missing priceId');

    // URLs de retorno
    const origin = req.headers.origin || `https://${req.headers.host}`;
    const success_url = `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`;
    const cancel_url  = `${origin}/cancel.html`;

    // Crear sesión de checkout en modo suscripción
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url,
      cancel_url,
      customer_email: email || undefined,
      metadata: {
        user_id: userId || '',
        email:   email  || '',
      },
      // allow_promotion_codes: true, // opcional
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('create-checkout error:', e);
    return res.status(500).send(e.message || 'Internal Server Error');
  }
}
