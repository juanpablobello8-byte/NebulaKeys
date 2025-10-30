// /scripts/dashboard.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// lee config del script /scripts/config.js
const PUB = window.NEBULA_PUBLIC || {};
const SUPABASE_URL = PUB.SUPABASE_URL;
const SUPABASE_ANON_KEY = PUB.SUPABASE_ANON_KEY;

// opcional: endpoint para Stripe
const CHECKOUT_ENDPOINT = PUB.CHECKOUT_ENDPOINT || '/api/create-checkout';
const DEFAULT_PRICE_ID  = PUB.DEFAULT_PRICE_ID  || 'price_xxx_REEMPLAZA';

const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// UI
const subStatus    = document.getElementById('subStatus');
const subInfoBox   = document.getElementById('subInfo');
const planEl       = document.getElementById('plan');
const untilEl      = document.getElementById('until');
const subscribeBtn = document.getElementById('subscribeBtn');

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'2-digit' });
  } catch {
    return '—';
  }
}

function showError(text) {
  subStatus.textContent = text;
  subscribeBtn.disabled = false;
}

async function getLoggedUser() {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data?.user || null;
  } catch (e) {
    console.error('auth.getUser error', e);
    return null;
  }
}

async function fetchCustomerByEmail(email) {
  const { data, error } = await supabase
    .from('customers')
    .select('id,email,created_at')
    .eq('email', email)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function fetchLatestSubscription(customerId) {
  // Trae la más reciente y válida
  const { data, error } = await supabase
    .from('subscriptions')
    .select('id, status, price_id, current_period_start, current_period_end, created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  return data?.[0] || null;
}

async function refreshSubscriptionUI() {
  subStatus.textContent = 'Comprobando...';
  subInfoBox.classList.add('hidden');
  subscribeBtn.disabled = true;

  if (!supabase) {
    showError('Falta configuración de Supabase (URL o ANON KEY).');
    console.error('NEBULA_PUBLIC.SUPABASE_URL/ANON_KEY no definidos');
    return;
  }

  try {
    const user = await getLoggedUser();
    if (!user) {
      subStatus.textContent = 'Inicia sesión para ver tu suscripción';
      subscribeBtn.disabled = false;
      return;
    }

    const customer = await fetchCustomerByEmail(user.email);
    if (!customer) {
      subStatus.textContent = 'Sin suscripción activa';
      subscribeBtn.disabled = false;
      return;
    }

    const sub = await fetchLatestSubscription(customer.id);
    if (!sub || !['active','trialing','past_due','unpaid'].includes(sub.status)) {
      subStatus.textContent = 'Sin suscripción activa';
      subscribeBtn.disabled = false;
      return;
    }

    // tiene suscripción
    subStatus.textContent = 'Suscripción activa';
    planEl.textContent  = sub.price_id || '—';
    untilEl.textContent = fmtDate(sub.current_period_end);
    subInfoBox.classList.remove('hidden');
    subscribeBtn.classList.add('hidden');   // oculta el CTA cuando ya hay suscripción
    subscribeBtn.disabled = false;

  } catch (err) {
    console.error('refreshSubscriptionUI error', err);
    showError('Error al consultar el estado.');
  }
}

// crear checkout en Stripe
async function startCheckout(priceId) {
  const url = `${CHECKOUT_ENDPOINT}?price=${encodeURIComponent(priceId)}`;
  try {
    subscribeBtn.disabled = true;
    const original = subscribeBtn.textContent;
    subscribeBtn.textContent = 'Redirigiendo...';

    const res = await fetch(url, { method: 'GET' }); // GET para tu endpoint
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || res.statusText);
    }
    const { url: checkoutUrl } = await res.json();
    if (!checkoutUrl) throw new Error('Sin URL de checkout');
    location.href = checkoutUrl;
  } catch (e) {
    console.error('startCheckout error', e);
    alert('No se pudo iniciar el checkout: ' + e.message);
    subscribeBtn.textContent = 'Suscribirme';
    subscribeBtn.disabled = false;
  }
}

// eventos
subscribeBtn.addEventListener('click', () => startCheckout(DEFAULT_PRICE_ID));

// inicio
(async () => {
  try {
    await refreshSubscriptionUI();
    // polling breve por si vuelves del success y el webhook aún no terminó
    let tries = 0;
    const iv = setInterval(async () => {
      tries += 1;
      await refreshSubscriptionUI();
      if (tries >= 8) clearInterval(iv);
    }, 8000);
  } catch (e) {
    console.error(e);
  } finally {
    // asegúrate de no dejar el botón bloqueado por un error inesperado
    subscribeBtn.disabled = false;
  }
})();
