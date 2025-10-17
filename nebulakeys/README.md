# NebulaKeys — Suscripciones + Portal Stripe + Webhooks + Supabase (Auth/DB) + Catálogo

Stack:
- **Vercel** (hosting + serverless): dominio gratis `*.vercel.app`.
- **Stripe**: Checkout (suscripción) + **Portal del cliente**.
- **Webhook** de Stripe → actualiza Supabase.
- **Supabase**: Auth (email+password) + Postgres + RLS + JS client.
- **Catálogo** simple + wishlist.

## 1) Crear cuentas y llaves
- Stripe: crea cuenta y productos (Starter/Pro/Ultimate). Copia tus **Price IDs**.
- Supabase: crea proyecto. Copia **URL**, **anon key** y **service role**.
- Vercel: inicia sesión.

## 2) Configurar base de datos
- En Supabase → **SQL Editor**: pega y ejecuta `db_schema.sql`.

## 3) Variables de entorno (Vercel → Project → Settings → Environment Variables)
- `STRIPE_SECRET_KEY` = tu clave secreta (test/live)
- `STRIPE_WEBHOOK_SECRET` = firma del endpoint (ver paso 6)
- `SUPABASE_URL` = URL del proyecto
- `SUPABASE_SERVICE_ROLE` = service role (server only)

> **No** pongas el anon key como env del servidor; se usa en el frontend (archivo `scripts/config.js`).

## 4) Configurar el Frontend (Supabase client)
Copia `scripts/config.example.js` a `scripts/config.js` y reemplaza:
```js
window.NEBULA_PUBLIC = {
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-ANON-KEY"
};
```

## 5) Checkout de Stripe desde el sitio
- Edita `index.html` y reemplaza los `data-price-id="price_..."` por tus Price IDs.
- Para pagar, el usuario debe estar logueado (así vinculamos con su cuenta).

## 6) Webhook de Stripe
- Deploy preliminar de Vercel para tener URL pública.
- En Stripe CLI o Dashboard, crea un endpoint: `https://TUAPP.vercel.app/api/webhook` con eventos:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- Copia el **Signing secret** y pégalo en `STRIPE_WEBHOOK_SECRET` (Vercel).

## 7) Portal del cliente
- En Stripe → Billing → Customer portal → habilitar y configurar.
- Desde la web, el usuario (logueado) abre **Mi suscripción** que llama `/api/create-portal-session`.
- El webhook vincula `profiles.stripe_customer_id` tras el primer pago.

## 8) Deploy
- Sube el repo/ZIP a Vercel.
- Agrega las env vars del punto (3).
- Redeploy.
- Prueba pagos con tarjeta de prueba `4242 4242 4242 4242`.

## 9) Tablas incluidas
- `profiles`: usuario ↔ Stripe customer.
- `subscriptions`: estado y fechas de la suscripción.
- `wishlists`: lista de juegos del usuario.
- `shipments`: para envíos físicos (placeholder).
- `rotations`: administración de la rotación mensual (placeholder).

## 10) Extensiones sugeridas
- Añadir webhook para `invoice.payment_failed` y enviar correos.
- Añadir verificación de plan para limitar número de juegos activos por mes.
- Añadir autenticación social en Supabase (Google, GitHub).
