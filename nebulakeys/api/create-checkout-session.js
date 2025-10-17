import Stripe from 'stripe';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  try {
    const { priceId, userId, email } = req.body || {};
    if (!priceId || !userId || !email) {
      return res.status(400).send('Missing params: priceId, userId, email');
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${req.headers.origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/cancel.html`,
      customer_email: email,
      metadata: { user_id: userId, email }
      // allow_promotion_codes: true, // si quieres cupones
    });

    res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('create-checkout-session error:', e);
    res.status(500).send(e.message);
  }
}
