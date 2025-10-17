// Crea sesión de Stripe Checkout (suscripción) y vincula con el usuario de Supabase
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/** Obtener origin detrás de Vercel */
function getOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }
  try {
    const { priceId, userId, email } = req.body || {};
    if (!priceId || !userId) { res.status(400).send('Falta priceId o userId'); return; }
    const origin = getOrigin(req);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email || undefined,
      client_reference_id: userId, // para mapear en webhook
      metadata: { supabase_user_id: userId },
      success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cancel.html`,
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      customer_update: { address: 'auto' },
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    res.status(500).send(err.message || 'Error creando sesión de pago');
  }
};
