import Stripe from 'stripe';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  try {
    // datos que envías desde el front
    const { priceId, userId, email } = req.body || {};
    if (!priceId || !userId || !email) {
      return res.status(400).send('Missing params: priceId, userId, email');
    }

    // 1. Inicializar Stripe con tu secret key
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });

    // 2. URL BASE FIJA (IMPORTANTE)
    // usa SIEMPRE tu dominio público/productivo.
    // O mejor: ponlo en una env var PUBLIC_BASE_URL en Vercel y léelo así:
    const BASE_URL =
      process.env.PUBLIC_BASE_URL || 'https://nebula-keys.vercel.app';

    // 3. Crear la sesión de checkout recurrente
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      // Stripe mandará al usuario aquí cuando pague con éxito:
      success_url: `${BASE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      // Y aquí si cancela:
      cancel_url: `${BASE_URL}/cancel.html`,

      // email que vamos a usar para crear el customer de Stripe:
      customer_email: email,

      // metadata: útil si luego quieres enlazar con Supabase/webhook
      metadata: {
        user_id: userId,
        email,
      },
      allow_promotion_codes: false, // ponlo true si quieres cupones
    });

    // 4. Devolver la URL de checkout a tu front
    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('create-checkout-session error:', e);
    return res.status(500).send(e.message);
  }
}
