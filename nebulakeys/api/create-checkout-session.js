// /nebulakeys/api/create-checkout-session.js
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

function getBaseUrl(req) {
  // 1) Si definiste NEXT_PUBLIC_SITE_URL, úsalo SIEMPRE
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;

  // 2) Fallback: detecta el host del request (Vercel)
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host =
    req.headers['x-forwarded-host'] ||
    req.headers.host ||
    process.env.VERCEL_URL; // p.ej. nebula-keys-ljx4.vercel.app
  const h = `${proto}://${host}`;
  return h.startsWith('http') ? h : `https://${h}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { priceId, userId, email } = req.body || {};
    if (!priceId || !userId || !email) {
      return res.status(400).json({ error: 'Missing params: priceId, userId, email' });
    }

    const base = getBaseUrl(req);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/cancel.html`,
      customer_email: email,
      metadata: { user_id: userId, email },
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('create-checkout-session error:', e);
    return res.status(500).json({ error: e.message });
  }
}
