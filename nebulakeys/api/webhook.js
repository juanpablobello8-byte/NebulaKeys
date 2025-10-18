// /api/webhook.js
import Stripe from 'stripe';
import getRawBody from 'raw-body';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  // usa la versión que tengas en tu Dashboard; esta funciona bien
  apiVersion: '2023-10-16',
});

// Supabase (service role)
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

// Helper seguro: convierte segundos UNIX -> ISO o devuelve null
const toIso = (v) => (typeof v === 'number' ? new Date(v * 1000).toISOString() : null);

// --- Persistencia -----------------------------------------------------------
async function upsertCustomer({ id, email, name = null }) {
  const { error } = await supa
    .from('customers')
    .upsert({ id, email, name, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) throw error;
}

async function upsertSubscription(sub) {
  const priceId = sub?.items?.data?.[0]?.price?.id ?? null;

  const row = {
    id: sub.id,                                              // "sub_..."
    customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null,
    status: sub.status,                                      // active, past_due, canceled...
    price_id: priceId,

    // Fechas SIEMPRE con helper seguro:
    current_period_start: toIso(sub.current_period_start),
    current_period_end:   toIso(sub.current_period_end),
    start_date:           toIso(sub.start_date),
    trial_end:            toIso(sub.trial_end),
    cancel_at:            toIso(sub.cancel_at),
    canceled_at:          toIso(sub.canceled_at),
    ended_at:             toIso(sub.ended_at),

    updated_at: new Date().toISOString(),
  };

  const { error } = await supa.from('subscriptions').upsert(row, { onConflict: 'id' });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  let event;
  try {
    const raw = await getRawBody(req); // Buffer (no lo parses)
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('❌ Firma inválida:', err?.message);
    return res.status(400).send(`Webhook Error: ${err?.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object; // Stripe.Checkout.Session

        // 1) Cliente
        const customerId =
          typeof s.customer === 'string' ? s.customer : s.customer?.id ?? null;
        const email = s.customer_details?.email || s.customer_email || null;
        if (customerId) await upsertCustomer({ id: customerId, email });

        // 2) Si la sesión creó suscripción, recuperarla y persistir
        if (s.subscription) {
          const subId = typeof s.subscription === 'string'
            ? s.subscription
            : s.subscription?.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          await upsertSubscription(sub);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        await upsertSubscription(sub);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const { error } = await supa.from('subscriptions').delete().eq('id', sub.id);
        if (error) throw error;
        break;
      }

      default:
        // Otros eventos no los persistimos por ahora
        break;
    }

    return res.status(200).json({ received: true });
  } catch (e) {
    console.error('❌ Error en handler:', e?.message, e);
    return res.status(500).json({ ok: false, error: e?.message ?? 'server_error' });
  }
}
