// /api/create-checkout.js
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');

  const price = req.query.price;
  if (!price) return res.status(400).send('Missing price');

  try {
    const origin = req.headers.origin ?? `https://${req.headers.host}`;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard.html`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto'
    });
    return res.json({ url: session.url });
  } catch (e) {
    console.error(e);
    return res.status(500).send(e.message);
  }
}
