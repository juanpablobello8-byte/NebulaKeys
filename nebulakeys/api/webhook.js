// pages/api/webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import getRawBody from 'raw-body';
import { createClient } from '@supabase/supabase-js';

export const config = {
  api: { bodyParser: false }, // ¡imprescindible para Stripe!
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2025-09-30.clover',
});

// Supabase ADMIN (service-role)
const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE as string,
);

// Convierte segundos UNIX (Stripe) a ISO; si no es número, devuelve null.
const toIso = (v: any) => (typeof v === 'number' ? new Date(v * 1000).toISOString() : null);

// --- Helpers de persistencia -----------------------------------------------
async function upsertSubscription(sub: Stripe.Subscription) {
  const item = sub.items?.data?.[0];
  const priceId = item?.price?.id ?? null;

  const payload = {
    id: sub.id,
    customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null,
    status: sub.status,
    price_id: priceId,
    current_period_start: toIso(sub.current_period_start),
    current_period_end: toIso(sub.current_period_end),
    start_date: toIso(sub.start_date),
    trial_end: toIso(sub.trial_end),
    cancel_at: toIso(sub.cancel_at),
    canceled_at: toIso(sub.canceled_at),
    ended_at: toIso(sub.ended_at),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('subscriptions').upsert(payload, { onConflict: 'id' });
  if (error) throw error;
}

async function upsertCustomerFromSession(session: Stripe.Checkout.Session) {
  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;

  if (!customerId) return;

  // Recupera datos del cliente si los necesitas
  const customer = await stripe.customers.retrieve(customerId);

  const payload = {
    id: customerId,
    email:
      typeof customer?.email === 'string'
        ? customer.email
        : (session.customer_details?.email ?? null),
    name:
      typeof (customer as any)?.name === 'string'
        ? (customer as any).name
        : session.customer_details?.name ?? null,
    // created: toIso((customer as any)?.created), // solo si quieres guardarlo
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('customers').upsert(payload, { onConflict: 'id' });
  if (error) throw error;
}

// --- Handler ---------------------------------------------------------------
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  let event: Stripe.Event;

  try {
    const raw = await getRawBody(req);
    const sig = req.headers['stripe-signature'] as string;
    event = stripe.webhooks.constructEvent(
      raw,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET as string,
    );
  } catch (err: any) {
    console.error('Signature error:', err?.message);
    return res.status(400).json({ ok: false, error: `Webhook signature verification failed` });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        // Guarda/actualiza el cliente
        await upsertCustomerFromSession(session);

        // Si se generó suscripción via Checkout, recupérala y persístela
        if (session.subscription) {
          const subId =
            typeof session.subscription === 'string'
              ? session.subscription
              : (session.subscription as any).id;

          const subscription = await stripe.subscriptions.retrieve(subId);
          await upsertSubscription(subscription);
        }

        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await upsertSubscription(subscription);
        break;
      }

      // Puedes añadir invoice.*, payment_intent.*, etc.
      default:
        // No hacemos nada para otros eventos
        break;
    }

    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('Handler error:', err?.message, err);
    // Si la causa es de fechas, suéltala explícita en logs:
    return res.status(500).json({ ok: false, error: err?.message ?? 'server_error' });
  }
}
