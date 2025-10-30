<script type="module">
  import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

  // === Tu config pública (ya la cargas con /scripts/config.js) ===
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.NEBULA_PUBLIC;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // === Mapeo de price_id -> etiqueta visible y duración ===
  // EDITA los price_... por los tuyos. La duración se usa sólo como
  // fallback si current_period_end aún no está en la DB cuando cargas la página.
  const PRICE_META = {
    // semanal (7 días)
    'price_1SJH1zKwqs0TzO3l23W3RIfE': { label: 'Plan semanal', duration: { days: 7 } },

    // quincenal (15 días)  <-- pon aquí tu price real
    'price_1SJH4eKwqs0TzO3l1ODa7pRx': { label: 'Plan quincenal', duration: { days: 15 } },

    // mensual (1 mes)  <-- pon aquí tu price real
    'price_1SJH9FKwqs0TzO3lxTTonf6H': { label: 'Plan mensual', duration: { months: 1 } },
  };

  // === Elementos de UI ===
  const subStatus    = document.getElementById('subStatus');
  const subInfoBox   = document.getElementById('subInfo');
  const planEl       = document.getElementById('plan');
  const untilEl      = document.getElementById('until');
  const subscribeBtn = document.getElementById('subscribeBtn');

  // === Helpers ===
  const fmtDate = iso =>
    new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });

  function addDuration(dateISO, dur) {
    const d = new Date(dateISO);
    if (dur?.days)   d.setDate(d.getDate() + dur.days);
    if (dur?.months) d.setMonth(d.getMonth() + dur.months);
    return d;
  }

  // === Carga/recarga UI con el estado de suscripción ===
  async function refreshSubscriptionUI() {
    subStatus.textContent = 'Comprobando…';
    subInfoBox.classList.add('hidden');
    subscribeBtn?.classList?.add('hidden'); // lo ocultamos si hay sub activa

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) {
      subStatus.textContent = 'Inicia sesión para ver tu suscripción';
      subscribeBtn?.classList?.remove('hidden');
      return;
    }

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
      subscribeBtn?.classList?.remove('hidden');
      return;
    }

    const sub = data?.subscriptions?.[0];

    if (!sub || !['active','trialing','past_due','unpaid'].includes(sub.status)) {
      subStatus.textContent = 'Sin suscripción activa';
      subscribeBtn?.classList?.remove('hidden');
      return;
    }

    // Suscripción activa
    subStatus.textContent = 'Suscripción activa';

    // 1) Nombre de plan a partir del price_id
    const meta = PRICE_META[sub.price_id];
    planEl.textContent = meta?.label ?? sub.price_id;

    // 2) Vencimiento (preferimos el current_period_end que envía el webhook)
    let venceTxt = '—';
    if (sub.current_period_end) {
      venceTxt = fmtDate(sub.current_period_end);
    } else if (sub.current_period_start && meta?.duration) {
      // Fallback: calculamos localmente por si el webhook aún no llegó
      const end = addDuration(sub.current_period_start, meta.duration);
      venceTxt = fmtDate(end.toISOString());
    }
    untilEl.textContent = venceTxt;

    subInfoBox.classList.remove('hidden');
    subscribeBtn?.classList?.add('hidden');
  }

  // === Carga inicial + pequeño polling por si el webhook tarda unos segundos ===
  await refreshSubscriptionUI();
  let tries = 0;
  const iv = setInterval(async () => {
    tries += 1;
    await refreshSubscriptionUI();
    if (tries >= 6) clearInterval(iv); // ~48s
  }, 8000);
</script>
