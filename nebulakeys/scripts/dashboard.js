// /scripts/dashboard.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  CHECKOUT_ENDPOINT,
  PLANS,
} = window.NEBULA_PUBLIC;

// Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// UI
const subStatus   = document.getElementById('subStatus');
const subInfoBox  = document.getElementById('subInfo');
const planEl      = document.getElementById('plan');
const untilEl     = document.getElementById('until');
const subscribeBtn = document.getElementById('subscribeBtn');

// Modal
const plansModal = document.getElementById('plansModal');
const closePlans = document.getElementById('closePlans');

function openPlans()  { plansModal.classList.remove('hidden'); }
function hidePlans()  { plansModal.classList.add('hidden'); }

function fmtDate(isoOrSec) {
  try {
    const dt = typeof isoOrSec === 'number'
      ? new Date(isoOrSec * 1000)
      : new Date(isoOrSec);
    return dt.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'2-digit' });
  } catch {
    return '—';
  }
}

function priceIdToLabel(priceId) {
  const entry = Object.values(PLANS).find(p => p.id === priceId);
  return entry ? entry.label : priceId || '—';
}

async function refreshSubscriptionUI() {
  subStatus.textContent = 'Comprobando…';
  subInfoBox.classList.add('hidden');
  subscribeBtn.classList.remove('hidden');
  subscribeBtn.disabled = true;

  // Usuario autenticado?
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  const user = auth?.user;
  if (authErr) console.error(authErr);

  if (!user) {
    subStatus.textContent = 'Inicia sesión para ver tu suscripción';
    subscribeBtn.disabled = false;
    return;
  }

  // Buscar cliente por email y suscripciones
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

  if (!sub || !['active', 'trialing', 'past_due', 'unpaid'].includes(sub.status)) {
    subStatus.textContent = 'Sin suscripción activa';
    subscribeBtn.disabled = false;
    return;
  }

  // Suscripción encontrada
  subStatus.textContent = 'Suscripción activa';
  planEl.textContent  = priceIdToLabel(sub.price_id);
  untilEl.textContent = sub.current_period_end ? fmtDate(sub.current_period_end) : '—';
  subInfoBox.classList.remove('hidden');

  // Con suscripción activa, ocultamos el CTA
  subscribeBtn.classList.add('hidden');
  subscribeBtn.disabled = false;
}

// Iniciar checkout con POST al endpoint
async function startCheckout(priceId) {
  try {
    subscribeBtn.disabled = true;

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;

    const res = await fetch(CHECKOUT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        priceId,
        userId: user?.id || '',
        email:  user?.email || '',
      }),
    });

    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg || 'Fallo creando sesión de checkout');
    }

    const { url } = await res.json();
    location.href = url;
  } catch (err) {
    console.error(err);
    alert('No se pudo iniciar el checkout: ' + err.message);
  } finally {
    subscribeBtn.disabled = false;
  }
}

// Abrir modal al pulsar "Suscribirme"
subscribeBtn.addEventListener('click', (e) => {
  e.preventDefault();
  openPlans();
});

// Cerrar modal (botón o click en overlay)
closePlans.addEventListener('click', hidePlans);
plansModal.addEventListener('click', (ev) => {
  if (ev.target === plansModal) hidePlans();
});

// Opción de plan → checkout
plansModal.querySelectorAll('[data-plan]').forEach(btn => {
  btn.addEventListener('click', async () => {
    const key  = btn.dataset.plan;          // weekly | biweekly | monthly
    const plan = PLANS[key];
    if (!plan?.id) return alert('Plan no disponible.');
    hidePlans();
    await startCheckout(plan.id);
  });
});

// Carga inicial + pequeño polling por si vuelven desde success.html
await refreshSubscriptionUI();
let tries = 0;
const iv = setInterval(async () => {
  tries += 1;
  await refreshSubscriptionUI();
  if (tries >= 8) clearInterval(iv);
}, 8000);
