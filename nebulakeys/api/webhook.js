// /api/webhook.js
import Stripe from 'stripe';
import getRawBody from 'raw-body';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// Importante para poder leer el raw body y verificar la firma
export const config = { api: { bodyParser: false } };

// Conversor seguro de timestamp UNIX (segundos) → ISO
const unixToISO = (v) =>
  typeof v === 'number' && Number.isFinite(v) ? new Date(v * 1000).toISOString() : null;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  // 1) Verificar firma
  let event;
  const sig = req.headers['stripe-signature'];

  try {
    const raw = (await getRawBody(req)).toString('utf8');
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('❌ Firma inválida:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 2) Cliente Supabase con service role
  const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

  try {
    switch (event.type) {
      // ===============================================
      // CUANDO EL CHECKOUT TERMINA, GUARDAMOS EL CLIENTE
      // ===============================================
      case 'checkout.session.completed': {
        const s = event.data.object;
        const customerId =
          typeof s.customer === 'string' ? s.customer : s.customer?.id || null;

        const email =
          s.customer_details?.email || s.customer_email || null;
        const name =
          s.customer_details?.name || null;

        if (customerId) {
          const { error } = await supa
            .from('customers')
            .upsert(
              {
                id: customerId,
                email,
                name,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'id' }
            );
          if (error) throw error;
        }
        break;
      }

      // ===============================================
      // SUSCRIPCIONES (create/update/delete)
      // ===============================================
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object;

        // customer puede venir como string u objeto
        const customerId =
          typeof sub.customer === 'string' ? sub.customer : sub.customer?.id || null;

        const row = {
          id: sub.id,                               // "sub_..."
          customer_id: customerId,                  // "cus_..."
          status: sub.status,                       // active, past_due, canceled...
          price_id: sub.items?.data?.[0]?.price?.id ?? null,

          // TODOS los timestamps convertidos de forma segura
          current_period_start: unixToISO(sub.current_period_start),
          current_period_end: unixToISO(sub.current_period_end),
          start_date: unixToISO(sub.start_date),
          trial_end: unixToISO(sub.trial_end),
          cancel_at: unixToISO(sub.cancel_at),
          canceled_at: unixToISO(sub.canceled_at),
          ended_at: unixToISO(sub.ended_at),

          updated_at: new Date().toISOString(),
        };

        const { error } = await supa
          .from('subscriptions')
          .upsert(row, { onConflict: 'id' });
        if (error) throw error;

        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const { error } = await supa
          .from('subscriptions')
          .delete()
          .eq('id', sub.id);
        if (error) throw error;
        break;
      }

      default:
        // Otros eventos no los necesitamos
        break;
    }

    return res.json({ ok: true, received: true });
  } catch (e) {
    console.error('❌ Error en webhook:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
