import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  try {
    const { customerId } = req.body || {};
    if (!customerId) return res.status(400).json({ error: 'Missing customerId' });

    const host =
      req.headers['x-forwarded-host'] ||
      req.headers.host ||
      process.env.VERCEL_URL;
    const base = `https://${host}`;

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${base}/dashboard.html`,
    });

    res.status(200).json({ url: portal.url });
  } catch (e) {
    console.error('create-portal-session error:', e);
    res.status(500).json({ error: e.message });
  }
}
