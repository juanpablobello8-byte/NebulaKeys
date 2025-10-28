// /scripts/dashboard.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.NEBULA_PUBLIC;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// UI
const subStatus   = document.getElementById('subStatus');
const subInfoBox  = document.getElementById('subInfo');
const planEl      = document.getElementById('plan');
const untilEl     = document.getElementById('until');
const subscribeBtn = document.getElementById('subscribeBtn');

const fmtDate = iso =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'2-digit' }) : '—';

async function getActiveSubscription(email) {
  // 1) customers.id (cus_...) por email
  const { data: cust, error: e1 } = await supabase
    .from('customers')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (e1) throw e1;
  if (!cust) return null;

  // 2) suscripción activa más reciente
  const { data: subs, error: e2 } = await supabase
    .from('subscriptions')
    .select('id,status,price_id,current_period_end')
    .eq('customer_id', cust.id)
    .in('status', ['active', 'trialing', 'past_due', 'unpaid'])
    .order('current_period_end', { ascending: false, nullsLast: true })
    .limit(1);
  if (e2) throw e2;

  return subs?.[0] || null;
}

async function refreshSubscriptionUI() {
  // Quién está logueado
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    subStatus.textContent = 'Inicia sesión para ver tu suscripción';
    subscribeBtn.classList.remove('hidden');
    return;
  }

  subStatus.textContent = 'Comprobando...';
  subInfoBox.classList.add('hidden');
  subscribeBtn.classList.add('hidden'); // oculto por defecto mientras consulta

  try {
    const sub = await getActiveSubscription(user.email);

    if (!sub) {
      subStatus.textContent = 'Sin suscripción activa';
      subInfoBox.classList.add('hidden');
      subscribeBtn.classList.remove('hidden'); // mostrar CTA
      return;
    }

    // Tiene suscripción
    subStatus.textContent = 'Suscripción activa';
    planEl.textContent  = sub.price_id || '—';
    untilEl.textContent = fmtDate(sub.current_period_end);
    subInfoBox.classList.remove('hidden');
    // CTA oculto si ya hay suscripción
  } catch (err) {
    console.error(err);
    subStatus.textContent = 'Error al consultar el estado';
    subscribeBtn.classList.remove('hidden');
  }
}

// El CTA te lleva al catálogo de planes
subscribeBtn?.addEventListener('click', () => {
  window.location.href = '/pricing.html';
});

// Carga inicial + pequeño polling por si vienes de success.html
await refreshSubscriptionUI();
let tries = 0;
const iv = setInterval(async () => {
  tries += 1;
  await refreshSubscriptionUI();
  if (tries >= 8) clearInterval(iv); // ~1 min
}, 8000);
