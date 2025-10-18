// /public/scripts/dashboard.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Config pública inyectada por /scripts/config.js
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.NEBULA_PUBLIC;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Elementos UI
const subStatus    = document.getElementById('subStatus');
const subInfoBox   = document.getElementById('subInfo');
const planEl       = document.getElementById('plan');
const untilEl      = document.getElementById('until');
const subscribeBtn = document.getElementById('subscribeBtn');

// Cambia por tu price ID por defecto
const DEFAULT_PRICE_ID = 'price_1SJH1zKwqs0TzO3l23W3RIfE';

const fmtDate = iso =>
  new Date(iso).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'2-digit' });

async function refreshSubscriptionUI() {
  try {
    subStatus.textContent = 'Comprobando…';
    subInfoBox.classList.add('hidden');
    subscribeBtn.disabled = true;

    // 1) Usuario autenticado?
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr) {
      console.error('[auth.getUser] ->', authErr);
      subStatus.textContent = 'Inicia sesión para ver tu suscripción';
      subscribeBtn.disabled = false;
      return;
    }
    const user = auth?.user;
    if (!user) {
      subStatus.textContent = 'Inicia sesión para ver tu suscripción';
      subscribeBtn.disabled = false;
      return;
    }

    // 2) Busca el customer por email
    const { data: customer, error: cErr } = await supabase
      .from('customers')
      .select('id, email')
      .eq('email', user.email)
      .maybeSingle();

    if (cErr) {
      console.error('[customers select] ->', cErr);
      subStatus.textContent = 'Error al consultar el estado';
      subscribeBtn.disabled = false;
      return;
    }

    if (!customer) {
      // No existe customer aún (nunca pagó)
      subStatus.textContent = 'Sin suscripción activa';
      subscribeBtn.classList.remove('hidden');
      subscribeBtn.disabled = false;
      return;
    }

    // 3) Busca su suscripción más reciente por customer_id
    const { data: subs, error: sErr } = await supabase
      .from('subscriptions')
      .select('status, price_id, current_period_start, current_period_end')
      .eq('customer_id', customer.id)
      .order('current_period_end', { ascending: false })
      .limit(1);

    if (sErr) {
      console.error('[subscriptions select] ->', sErr);
      subStatus.textContent = 'Error al consultar el estado';
      subscribeBtn.disabled = false;
      return;
    }

    const sub = subs?.[0];

    if (!sub || !['active','trialing','past_due','unpaid'].includes(sub.status)) {
      subStatus.textContent = 'Sin suscripción activa';
      subscribeBtn.classList.remove('hidden');
      subscribeBtn.disabled = false;
      return;
    }

    // Hay suscripción
    subStatus.textContent = 'Suscripción activa';
    planEl.textContent  = sub.price_id ?? '—';
    untilEl.textContent = sub.current_period_end ? fmtDate(sub.current_period_end) : '—';
    subInfoBox.classList.remove('hidden');
    subscribeBtn.classList.add('hidden');
    subscribeBtn.disabled = false;
  } catch (err) {
    console.error('refreshSubscriptionUI error:', err);
    subStatus.textContent = 'Error al consultar el estado';
    subscribeBtn.disabled = false;
  }
}

// Click en “Suscribirme” -> crea checkout
subscribeBtn.addEventListener('click', async () => {
  subscribeBtn.disabled = true;
  const original = subscribeBtn.textContent;
  subscribeBtn.textContent = 'Redirigiendo…';

  try {
    const res = await fetch(`/api/create-checkout?price=${encodeURIComponent(DEFAULT_PRICE_ID)}`);
    if (!res.ok) throw new Error(await res.text());
    const { url } = await res.json();
    location.href = url;
  } catch (err) {
    console.error(err);
    alert('No se pudo iniciar el checkout: ' + err.message);
    subscribeBtn.textContent = original;
    subscribeBtn.disabled = false;
  }
});

// Carga inicial + pequeño polling tras volver de Stripe
await refreshSubscriptionUI();
let tries = 0;
const iv = setInterval(async () => {
  tries += 1;
  await refreshSubscriptionUI();
  if (tries >= 8) clearInterval(iv);
}, 8000);
