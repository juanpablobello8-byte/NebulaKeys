import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supa = createClient(
  window.NEBULA_PUBLIC.SUPABASE_URL,
  window.NEBULA_PUBLIC.SUPABASE_ANON_KEY
);

// Consideramos “activa” también ‘trialing’
const ACTIVE_STATUSES = ['active', 'trialing'];

// Reintentos: 10 veces cada 3s (~30s)
const RETRIES = 10;
const DELAY_MS = 3000;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getActiveSubscriptionByEmail(email) {
  // Busca el customer por email
  const { data: customer, error: cerr } = await supa
    .from('customers')
    .select('id,email')
    .eq('email', email)
    .single();

  if (cerr || !customer) return { sub: null };

  // Busca la última suscripción con estado active/trialing
  const { data: subs, error: serr } = await supa
    .from('subscriptions')
    .select('status,price_id,current_period_end')
    .eq('customer_id', customer.id)
    .in('status', ACTIVE_STATUSES)
    .order('created_at', { ascending: false })
    .limit(1);

  if (serr || !subs?.length) return { sub: null };
  return { sub: subs[0] };
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

async function renderDashboard() {
  // Debe haber sesión de Supabase
  const { data: { user } } = await supa.auth.getUser();
  if (!user) {
    location.href = '/login.html';
    return;
  }

  const statusEl = document.getElementById('subStatus');
  const infoEl = document.getElementById('subInfo');
  const planEl = document.getElementById('plan');
  const untilEl = document.getElementById('until');
  const subscribeBtn = document.getElementById('subscribeBtn');

  // Botón “Suscribirme”: llama a tu checkout o manda al pricing
  subscribeBtn.addEventListener('click', async () => {
    // Si ya tienes startCheckout(priceId) en /scripts/checkout.js, llama aquí:
    if (window.startCheckout) {
      // Sustituye por tu price por defecto si quieres
      await window.startCheckout('price_XXXXXXXXXXXXXX');
      return;
    }
    // fallback a página de precios
    location.href = '/pricing.html';
  });

  // Reintenta mientras el webhook termina
  for (let i = 0; i < RETRIES; i++) {
    const { sub } = await getActiveSubscriptionByEmail(user.email);

    if (sub) {
      // Suscripción encontrada
      statusEl.textContent = 'Suscripción activa';
      infoEl.classList.remove('hidden');
      planEl.textContent = sub.price_id || '(plan no disponible)';
      untilEl.textContent = sub.current_period_end
        ? new Date(sub.current_period_end).toLocaleString()
        : '—';

      // Oculta el botón de suscribirse
      subscribeBtn.style.display = 'none';
      return;
    }

    statusEl.textContent = 'Sin suscripción activa (comprobando…)';
    await sleep(DELAY_MS);
  }

  // Si tras reintentos no encontramos nada:
  statusEl.textContent = 'Sin suscripción activa';
}

renderDashboard();
