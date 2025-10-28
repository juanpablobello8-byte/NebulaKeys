// /api/create-checkout.js
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge', // puedes quitar esto si Vercel se queja y usar default functions runtime
};

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const priceId = url.searchParams.get('price'); // price_xxx de Stripe

    if (!priceId) {
      return new Response(JSON.stringify({ error: 'Missing price' }), { status: 400 });
    }

    // Supabase cliente ADMIN para leer usuario? no.
    // Aquí NO tenemos sesión del user aún en serverless "edge" sin cookies.
    // Plan sencillo: FRONTEND debe pasar el email autenticado.
    // (en producción se hace con supabase auth via cookies; aquí vamos con "email" explícito)

    const email = url.searchParams.get('email');
    if (!email) {
      return new Response(JSON.stringify({ error: 'Missing email' }), { status: 400 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });

    // Creamos la sesión de checkout
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      success_url: `https://nebula-keys.vercel.app/success.html`,
      cancel_url: `https://nebula-keys.vercel.app/cancel.html`,
      allow_promotion_codes: true,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    console.error('❌ Error create-checkout:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
