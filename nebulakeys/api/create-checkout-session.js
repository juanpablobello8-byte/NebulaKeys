import Stripe from 'stripe';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('method not allowed');
  }

  try {
    // sacamos los datos que nos envía el front
    const { priceId, userId, email } = req.body || {};

    if (!priceId || !userId || !email) {
      return res
        .status(400)
        .send('Missing params: priceId, userId, email');
    }

    // instancia de Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });

    // armamos las URLs de redirección en base al dominio de donde vino la request
    const origin = req.headers.origin || 'https://nebula-keys.vercel.app';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      // redirección después del pago exitoso
      success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      // redirección si el usuario cancela el pago
      cancel_url: `${origin}/cancel.html`,
      // para que Stripe ya muestre el email del usuario en checkout
      customer_email: email,
      // metadata opcional que luego puedes leer en webhooks
      metadata: {
        user_id: userId,
        email,
      },
      // si quieres permitir cupones/promos en Checkout:
      allow_promotion_codes: true,
    });

    // devolvemos la URL para redirigir al usuario desde el front
    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('create-checkout-session error:', e);
    return res
      .status(500)
      .send(e.message || 'Stripe session creation failed');
  }
}
