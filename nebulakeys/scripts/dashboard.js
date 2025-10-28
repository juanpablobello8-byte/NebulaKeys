// /scripts/dashboard.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.NEBULA_PUBLIC;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Referencias a elementos del DOM
const subStatus    = document.getElementById('subStatus');
const subInfoBox   = document.getElementById('subInfo');
const planEl       = document.getElementById('plan');
const untilEl      = document.getElementById('until');
const subscribeBtn = document.getElementById('subscribeBtn');

const fmtDate = iso =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        year:'numeric', month:'short', day:'2-digit'
      })
    : '—';

async function getActiveSubscription(email){
  // 1) Buscar el customer_id (cus_...) de este email
  const { data: cust, error: e1 } = await supabase
    .from('customers')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (e1) throw e1;
  if (!cust) return null;

  // 2) Buscar su suscripción activa / trial / etc
  const { data: subs, error: e2 } = await supabase
    .from('subscriptions')
    .select('id,status,price_id,current_period_end')
    .eq('customer_id', cust.id)
    .in('status', ['active','trialing','past_due','unpaid'])
    .order('current_period_end', { ascending:false, nullsLast:true })
    .limit(1);

  if (e2) throw e2;
  return subs?.[0] || null;
}

async function refreshSubscriptionUI(){
  // ¿Quién está logueado?
  const { data: { user } } = await supabase.auth.getUser();

  if (!user){
    subStatus.textContent = 'Inicia sesión para ver tu suscripción';
    subInfoBox.classList.add('hidden');
    subscribeBtn.classList.remove('hidden'); // puede suscribirse una vez haga login
    return;
  }

  subStatus.textContent = 'Comprobando...';
  subInfoBox.classList.add('hidden');
  subscribeBtn.classList.add('hidden'); // lo mostramos sólo si NO hay plan activo

  try {
    const sub = await getActiveSubscription(user.email);

    if (!sub){
      // No hay suscripción activa
      subStatus.textContent = 'Sin suscripción activa';
      subInfoBox.classList.add('hidden');
      subscribeBtn.classList.remove('hidden'); // deja que compre
      return;
    }

    // Sí hay suscripción activa/valida
    subStatus.textContent = 'Suscripción activa';
    planEl.textContent    = sub.price_id || '—';
    untilEl.textContent   = fmtDate(sub.current_period_end);
    subInfoBox.classList.remove('hidden');
    // OJO: aquí NO mostramos subscribeBtn
  } catch(err){
    console.error(err);
    subStatus.textContent = 'Error al consultar el estado';
    subInfoBox.classList.add('hidden');
    subscribeBtn.classList.remove('hidden'); // fallback
  }
}

// Cuando hace clic en "Suscribirme" lo mandamos a tu catálogo de planes
subscribeBtn?.addEventListener('click', () => {
  window.location.href = '/pricing.html';
});

// Primera carga
await refreshSubscriptionUI();

// Polling suave ~1 minuto total, para cuando vuelve directo de /success.html
let tries = 0;
const iv = setInterval(async () => {
  tries += 1;
  await refreshSubscriptionUI();
  if (tries >= 8) clearInterval(iv); // para a los ~60s
}, 8000);
