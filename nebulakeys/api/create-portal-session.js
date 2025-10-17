import Stripe from 'stripe';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  try {
    const { customerId, returnUrl } = req.body || {};
    if (!customerId) return res.status(400).send('Missing customerId');

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || `${req.headers.origin}/dashboard.html`,
    });

    res.status(200).json({ url: portal.url });
  } catch (e) {
    console.error('create-portal-session error:', e);
    res.status(500).send(e.message);
  }
}
