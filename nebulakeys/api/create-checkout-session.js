// /nebula keys/api/create-checkout-session.js
import Stripe from 'stripe';

export default async function handler(req, res) {
  // Debe ser POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { priceId, email, userId } = req.body || {};
    if (!priceId) {
      return res.status(400).json({ error: 'Missing priceId' });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });

    // Verifica que el price exista en ESTA cuenta/mode (test/live)
    const price = await stripe.prices.retrieve(priceId);

    // Dominio base (usa la env si la tienes; si no, el host de la request)
    const base =
      process.env.SITE_BASE_URL || `https://${req.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: `${base}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/cancel.html`,
      customer_email: email || undefined,
      metadata: {
        user_id: userId || '',
        price_id: price.id,
      },
      allow_promotion_codes: true,
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('create-checkout-session error:', e);
    return res.status(400).json({ error: e.message });
  }
}
