<!-- dashboard.html ya lo llama así -->
<script type="module">
// --- Dependencia: supabase-js (ESM CDN)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// -------- Config pública (inyectada por scripts/config.js) --------
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.NEBULA_PUBLIC || {};
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Falta SUPABASE_URL o SUPABASE_ANON_KEY en window.NEBULA_PUBLIC');
}

// -------- Instancia de Supabase --------
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// -------- UI elements --------
const subStatus    = document.getElementById('subStatus');
const subInfoBox   = document.getElementById('subInfo');
const planEl       = document.getElementById('plan');
const untilEl      = document.getElementById('until');
const subscribeBtn = document.getElementById('subscribeBtn');

// Mapea tus IDs de precio a nombres amigables (ajústalo a tus planes)
const PRICE_NAMES = {
  'price_1SJH1zKwqs0TzO3l23W3RIfE': 'Starter (MXN 150 / semana)',
  'price_1SJH4eKwqs0TzO3l1ODa7pRx': 'Pro (MXN … / …)',
  'price_1SJH9FKwqs0TzO3lxTTonf6H': 'Ultimate (MXN … / …)'
};

// Status que tratamos como “tiene suscripción”
const ACTIVE_STATUSES = ['active', 'trialing', 'past_due', 'unpaid'];

// Helpers
const fmtDate = iso =>
  new Date(iso).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'2-digit' });

// ----- Carga/recarga del estado de suscripción -----
async function refreshSubscriptionUI() {
  subStatus.textContent = 'Comprobando…';
  subInfoBox.classList.add('hidden');
  if (subscribeBtn) {
    subscribeBtn.removeAttribute('href');      // limpiamos por si acaso
    subscribeBtn.classList.remove('hidden');   // visible por defecto
    subscribeBtn.textContent = 'Suscribirme';
  }

  // Usuario logueado
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  const user = auth?.user || null;
  if (authErr) console.warn('auth error:', authErr);

  if (!user) {
    subStatus.textContent = 'Inicia sesión para ver tu suscripción';
    if (subscribeBtn) subscribeBtn.setAttribute('href', '/auth.html'); // o tu página de login
    return;
  }

  // Traemos el customer por email + suscripciones relacionadas
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
    console.error('❌ Error consultando customers:', error);
    subStatus.textContent = 'Error al consultar el estado';
    if (subscribeBtn) subscribeBtn.setAttribute('href', '/pricing.html');
    return;
  }

  // Puede no existir el customer (aún no pasó por checkout)
  const sub = data?.subscriptions?.[0] || null;

  // Si no hay suscripción “activa”
  if (!sub || !ACTIVE_STATUSES.includes(sub.status)) {
    subStatus.textContent = 'Sin suscripción activa';
    // 👉 Como pediste: el CTA lleva al catálogo de planes
    if (subscribeBtn) subscribeBtn.setAttribute('href', '/pricing.html');
    return;
  }

  // Hay suscripción
  subStatus.textContent = 'Suscripción activa';
  planEl.textContent    = PRICE_NAMES[sub.price_id] || sub.price_id || '—';
  untilEl.textContent   = sub.current_period_end ? fmtDate(sub.current_period_end) : '—';
  subInfoBox.classList.remove('hidden');

  // Si hay suscripción, no tiene sentido ofrecer “Suscribirme”
  if (subscribeBtn) subscribeBtn.classList.add('hidden');
}

// ----- Polling suave tras volver de Stripe (para esperar webhook) -----
async function startPolling() {
  let tries = 0;
  const iv = setInterval(async () => {
    tries += 1;
    await refreshSubscriptionUI();
    if (tries >= 8) clearInterval(iv); // ~ 1 minuto (8 * 7.5s aprox si ajustas)
  }, 7500);
}

// ----- Reacciona al cambio de sesión (login/logout) -----
supabase.auth.onAuthStateChange(async () => {
  await refreshSubscriptionUI();
});

// ----- Carga inicial -----
await refreshSubscriptionUI();
startPolling();

</script>
