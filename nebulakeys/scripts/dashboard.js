// /scripts/dashboard.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.NEBULA_PUBLIC || {};
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// UI refs
const subStatus    = document.getElementById('subStatus');
const subInfoBox   = document.getElementById('subInfo');
const planEl       = document.getElementById('plan');
const untilEl      = document.getElementById('until');
const subscribeBtn = document.getElementById('subscribeBtn');

// Mapea price_id → nombre humano
const PRICE_NAMES = {
  'price_1SJH1zKwqs0TzO3l23W3RIfE': 'Plan Semanal MXN $150',
  // agrega más si tienes más prices
};

const ACTIVE_STATUSES = ['active','trialing','past_due','unpaid'];

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, {
    year:'numeric',
    month:'short',
    day:'2-digit'
  });

async function refreshSubscriptionUI() {
  subStatus.textContent = 'Comprobando…';
  subInfoBox.classList.add('hidden');
  subscribeBtn.classList.remove('hidden');
  subscribeBtn.setAttribute('href', '/pricing.html');

  // Usuario actual
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) {
    subStatus.textContent = 'Inicia sesión para ver tu suscripción';
    subscribeBtn.setAttribute('href', '/auth.html');
    return;
  }

  // Busca customer + subscriptions por email
  const { data, error } = await supabase
    .from('customers')
    .select(`
      id,
      email,
      subscriptions (
        status,
        price_id,
        current_period_end
      )
    `)
    .eq('email', user.email)
    .maybeSingle();

  if (error) {
    console.error('Error buscando suscripción:', error);
    subStatus.textContent = 'Error al consultar el estado';
    return;
  }

  const sub = data?.subscriptions?.[0];
  if (!sub || !ACTIVE_STATUSES.includes(sub.status)) {
    subStatus.textContent = 'Sin suscripción activa';
    subscribeBtn.setAttribute('href', '/pricing.html');
    return;
  }

  subStatus.textContent = 'Suscripción activa';
  planEl.textContent    = PRICE_NAMES[sub.price_id] || sub.price_id || '—';
  untilEl.textContent   = sub.current_period_end
    ? fmtDate(sub.current_period_end)
    : '—';

  subInfoBox.classList.remove('hidden');
  subscribeBtn.classList.add('hidden');
}

// Polling al volver de Stripe
function startPolling() {
  let tries = 0;
  const iv = setInterval(async () => {
    tries++;
    await refreshSubscriptionUI();
    if (tries >= 8) clearInterval(iv);
  }, 8000);
}

// Enlazar botón (por si quieres que haga algo especial)
subscribeBtn.addEventListener('click', (e) => {
  // por defecto /pricing.html ya está en href
  // dejamos que navegue
});

supabase.auth.onAuthStateChange(async () => {
  await refreshSubscriptionUI();
});

await refreshSubscriptionUI();
startPolling();
