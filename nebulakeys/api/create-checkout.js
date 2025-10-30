import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { priceId, quantity = 1, mode = 'subscription', email, userId } = req.body || {};
    if (!priceId) return res.status(400).json({ error: 'Missing priceId' });

    const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://nebula-keys-ljx4.vercel.app';

    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [{ price: priceId, quantity }],
      success_url: `${base}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/cancel.html`,
      customer_email: email ?? undefined,
      metadata: { user_id: userId ?? '' }
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('create-checkout error:', e);
    return res.status(500).json({ error: e.message });
  }
}
