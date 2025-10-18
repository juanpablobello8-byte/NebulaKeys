// /public/scripts/dashboard.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// 1) Lee la config pública inyectada por /scripts/config.js
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.NEBULA_PUBLIC;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2) Elementos de UI
const subStatus    = document.getElementById('subStatus');
const subInfoBox   = document.getElementById('subInfo');
const planEl       = document.getElementById('plan');
const untilEl      = document.getElementById('until');
const subscribeBtn = document.getElementById('subscribeBtn');

// 3) Price a vender (ajústalo al que quieras)
const DEFAULT_PRICE_ID = 'price_1SJH1zKwqs0TzO3l23W3RIfE';

// helper fecha
const fmtDate = iso =>
  new Date(iso).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'2-digit' });

// 4) Refresca UI con el estado de suscripción
async function refreshSubscriptionUI() {
  subStatus.textContent = 'Comprobando…';
  subInfoBox.classList.add('hidden');
  subscribeBtn.disabled = true;

  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) {
    subStatus.textContent = 'Inicia sesión para ver tu suscripción';
    subscribeBtn.disabled = false;
    return;
  }

  // Consulta customers por email y trae su(s) suscripción(es)
  const { data, error } = await supabase
    .from('customers')
    .select(`
      id,
      email,
      subscriptions (
        status,
        price_id,
        current_period_start,
        current_period_end
      )
    `)
    .eq('email', user.email)
    .maybeSingle();

  if (error) {
    console.error(error);
    subStatus.textContent = 'Error al consultar el estado';
    subscribeBtn.disabled = false;
    return;
  }

  const sub = data?.subscriptions?.[0];

  // Sin sub activa (o aún no creada)
  if (!sub || !['active','trialing','past_due','unpaid'].includes(sub.status)) {
    subStatus.textContent = 'Sin suscripción activa';
    subscribeBtn.classList.remove('hidden');
    subscribeBtn.disabled = false;
    return;
  }

  // Con suscripción
  subStatus.textContent = 'Suscripción activa';
  planEl.textContent  = sub.price_id ?? '—';
  untilEl.textContent = sub.current_period_end ? fmtDate(sub.current_period_end) : '—';
  subInfoBox.classList.remove('hidden');

  // Oculta CTA si ya está suscrito
  subscribeBtn.classList.add('hidden');
  subscribeBtn.disabled = false;
}

// 5) Click en “Suscribirme”: crea checkout y redirige
subscribeBtn.addEventListener('click', async () => {
  subscribeBtn.disabled = true;
  const original = subscribeBtn.textContent;
  subscribeBtn.textContent = 'Redirigiendo…';

  try {
    // Si tu endpoint se llama distinto, cambia esta ruta
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

// 6) Carga inicial
await refreshSubscriptionUI();

// 7) Polling cortito para reflejar activación tras pagar
let tries = 0;
const iv = setInterval(async () => {
  tries += 1;
  await refreshSubscriptionUI();
  if (tries >= 8) clearInterval(iv); // ~1 minuto
}, 8000);
