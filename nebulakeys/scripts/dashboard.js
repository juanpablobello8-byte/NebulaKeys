// /nebulakeys/scripts/dashboard.js
document.addEventListener('DOMContentLoaded', async () => {
  // 1) Supabase listo
  if (!window.NEBULA_PUBLIC?.SUPABASE_URL || !window.NEBULA_PUBLIC?.SUPABASE_ANON_KEY) {
    console.error('NEBULA_PUBLIC no está definido (config.js)');
    return;
  }
  const supa = window.supabase.createClient(
    window.NEBULA_PUBLIC.SUPABASE_URL,
    window.NEBULA_PUBLIC.SUPABASE_ANON_KEY
  );

  const $ = (id) => document.getElementById(id);
  const statusEl = $('sub-status');
  const btnPortal = $('btn-portal');

  // 2) Sesión
  const { data: { session } } = await supa.auth.getSession();
  if (!session) { window.location.href = '/login.html'; return; }
  const userId = session.user.id;

  // 3) Lee perfil y suscripción (si existen)
  const { data: profile } = await supa
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single();

  const { data: subRow } = await supa
    .from('subscriptions')
    .select('status, price_id, current_period_end')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // 4) Pinta estado y muestra/oculta botón Portal
  if (!subRow) {
    statusEl.textContent = 'Sin suscripción activa';
    btnPortal.classList.add('hidden');
  } else {
    const activo = ['active', 'trialing', 'past_due'].includes(subRow.status);
    statusEl.textContent = activo
      ? `Activa (${subRow.status})`
      : `Inactiva (${subRow.status})`;
    if (profile?.stripe_customer_id) btnPortal.classList.remove('hidden');
    else btnPortal.classList.add('hidden');
  }

  // 5) Abrir Portal del cliente (Stripe)
  btnPortal?.addEventListener('click', async () => {
    if (!profile?.stripe_customer_id) {
      alert('Aún no tienes una suscripción. Contrata un plan desde la página principal.');
      return;
    }
    const res = await fetch('/api/create-portal-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: profile.stripe_customer_id,
        returnUrl: window.location.origin + '/dashboard.html'
      })
    });
    if (!res.ok) { alert('No se pudo abrir el portal.'); return; }
    const { url } = await res.json();
    window.location.href = url;
  });
});
