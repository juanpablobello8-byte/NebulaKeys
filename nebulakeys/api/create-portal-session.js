// Abre el Portal del Cliente de Stripe para gestionar/cancelar/cambiar plan
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE); // server key

function getOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }
  try {
    const { userId } = req.body || {};
    if (!userId) { res.status(400).send('Falta userId'); return; }

    // Buscar stripe_customer_id en perfiles
    const { data: profile, error } = await supa
      .from('profiles')
      .select('stripe_customer_id, email')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!profile || !profile.stripe_customer_id) {
      res.status(400).send('No existe cliente de Stripe vinculado aún.');
      return;
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: getOrigin(req) + '/dashboard.html',
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Portal error:', err);
    res.status(500).send(err.message || 'Error creando portal de cliente');
  }
};
