// Next.js / Vercel style (Edge desactivado para usar body)
export const config = { api: { bodyParser: true } };

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // service role para leer stripe_customers sin RLS
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    // Recuperar al usuario autenticado vía Supabase Auth-Helpers no es trivial en serverless
    // Lo más sencillo: enviar el email en el header desde el cliente si ya lo tienes.
    // Para mantenerlo simple este ejemplo toma el email del JWT en el client (no incluido).
    // Alternativa: en client, haz un RPC que devuelva el email; aquí voy a pedirlo del body.
    const email = (req.query.email || req.body?.email || "").toLowerCase();
    const returnUrl = req.query.return_url || req.body?.return_url || `${req.headers.origin}/dashboard.html`;
    if (!email) return res.status(400).json({ error: "Falta email" });

    const { data: cust, error } = await supabase
      .from("stripe_customers")
      .select("customer_id")
      .eq("email", email)
      .single();

    if (error || !cust?.customer_id) {
      return res.status(404).json({ error: "Cliente de Stripe no encontrado para ese email" });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: cust.customer_id,
      return_url: returnUrl
    });

    return res.json({ url: session.url });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "No se pudo crear portal session" });
  }
}
