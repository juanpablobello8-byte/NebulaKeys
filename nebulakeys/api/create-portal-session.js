// Runtime: Node.js 20 (Vercel Settings → Functions → Node.js 20.x)
import Stripe from 'stripe';

export const config = { runtime: 'edge' }; // si usas edge, quita node-specific libs
// Si prefieres Node, usa: export const config = { runtime: 'nodejs20.x' };

export default async function handler(req) {
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }
    const { customerId, returnUrl } = await req.json();
    if (!customerId) return new Response('Missing customerId', { status: 400 });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || (new URL('/dashboard.html', req.headers.get('origin'))).toString(),
    });

    return Response.json({ url: portal.url });
  } catch (e) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}
