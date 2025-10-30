import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { customerId } = req.body || {};
    if (!customerId) return res.status(400).json({ error: 'Missing customerId' });

    const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://nebula-keys-ljx4.vercel.app';

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
