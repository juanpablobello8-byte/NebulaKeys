// /scripts/dashboard.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.NEBULA_PUBLIC;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const subStatus   = document.getElementById('subStatus');
const subInfoBox  = document.getElementById('subInfo');
const planEl      = document.getElementById('plan');
const untilEl     = document.getElementById('until');
const subscribeBtn = document.getElementById('subscribeBtn');

const ACTIVE_STATES = ['active','trialing','past_due','unpaid'];

const fmtDate = iso =>
  new Date(iso).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'2-digit' });

async function refreshSubscriptionUI() {
  subStatus.textContent = 'Comprobando…';
  subInfoBox?.classList.add('hidden');
  if (subscribeBtn) subscribeBtn.disabled = true;

  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) {
    subStatus.textContent = 'Inicia sesión para ver tu suscripción';
    if (subscribeBtn) { subscribeBtn.disabled = false; subscribeBtn.classList.remove('hidden'); }
    return;
  }

  // 1) Customer por email
  const { data: customer } = await supabase
    .from('customers')
    .select('id, email')
    .eq('email', user.email)
    .maybeSingle();

  if (!customer) {
    subStatus.textContent = 'Sin suscripción activa';
    if (subscribeBtn) { subscribeBtn.disabled = false; subscribeBtn.classList.remove('hidden'); }
    return;
  }

  // 2) Última suscripción activa de ese customer
  const { data: subs, error } = await supabase
    .from('subscriptions')
    .select('id,status,price_id,current_period_end')
    .eq('customer_id', customer.id)
    .in('status', ACTIVE_STATES)
    .order('current_period_end', { ascending: false })
    .limit(1);

  if (error) {
    console.error(error);
    subStatus.textContent = 'Error al consultar el estado';
    if (subscribeBtn) subscribeBtn.disabled = false;
    return;
  }

  const sub = subs?.[0];
  if (!sub) {
    subStatus.textContent = 'Sin suscripción activa';
    if (subscribeBtn) { subscribeBtn.disabled = false; subscribeBtn.classList.remove('hidden'); }
    return;
  }

  subStatus.textContent = 'Suscripción activa';
  if (planEl)  planEl.textContent  = sub.price_id ?? '—';
  if (untilEl) untilEl.textContent = sub.current_period_end ? fmtDate(sub.current_period_end) : '—';
  if (subInfoBox) subInfoBox.classList.remove('hidden');

  // con suscripción activa, ocultamos CTA
  if (subscribeBtn) subscribeBtn.classList.add('hidden');
}

// CTA → catálogo de planes
if (subscribeBtn) {
  subscribeBtn.addEventListener('click', () => {
    location.href = '/pricing.html';
  });
}

// Carga + pequeño polling por si el webhook venía atrás
await refreshSubscriptionUI();
let tries = 0;
const iv = setInterval(async () => {
  tries += 1;
  await refreshSubscriptionUI();
  if (tries >= 8) clearInterval(iv); // ~1 minuto
}, 8000);
