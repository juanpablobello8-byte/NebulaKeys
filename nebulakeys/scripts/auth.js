// Inicializa Supabase y gestiona UI básica de auth + portal link
(function () {
  if (!window.NEBULA_PUBLIC) {
    console.error('Falta /scripts/config.js con SUPABASE_URL y ANON_KEY');
    return;
  }
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.NEBULA_PUBLIC;
  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.supabaseClient = supabaseClient;

  // Toggle header links si existen
  (async () => {
    const loginLink = document.getElementById('loginLink');
    const logoutBtn = document.getElementById('logoutBtn');
    const dashboardLink = document.getElementById('dashboardLink');
    const portalLink = document.getElementById('portalLink');

    const { data: { user } } = await supabaseClient.auth.getUser();

    if (user) {
      loginLink && (loginLink.style.display = 'none');
      logoutBtn && (logoutBtn.style.display = 'inline-flex');
      dashboardLink && (dashboardLink.style.display = 'inline-flex');
      portalLink && (portalLink.style.display = 'inline');
      portalLink && portalLink.addEventListener('click', async (e) => {
        e.preventDefault();
        // Abrir portal del cliente
        const res = await fetch('/api/create-portal-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id })
        });
        if (!res.ok) return alert('No se pudo abrir el portal');
        const data = await res.json();
        if (data.url) window.location = data.url;
      });

      logoutBtn && (logoutBtn.onclick = async () => {
        await supabaseClient.auth.signOut();
        window.location = '/';
      });
    } else {
      loginLink && (loginLink.style.display = 'inline-flex');
      logoutBtn && (logoutBtn.style.display = 'none');
      dashboardLink && (dashboardLink.style.display = 'none');
      portalLink && (portalLink.style.display = 'none');
    }
  })();
})();