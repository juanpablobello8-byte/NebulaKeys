// scripts/home.js
// 1) Coloca la portada de HELLDIVERS 2 en “Próximos juegos”
// 2) Muestra el botón “Ver planes” sólo si el usuario está logueado (Supabase)

/* =======================
   1) Portada próximos juegos
   ======================= */
document.addEventListener('DOMContentLoaded', async () => {
  const COVER_URL = 'https://cdn.cloudflare.steamstatic.com/steam/apps/553850/header.jpg'; // HELLDIVERS 2
  const img = document.getElementById('upcoming-cover');

  if (img) {
    img.src = COVER_URL;
    img.onload = () => img.classList.remove('hidden');
    img.onerror = () => console.warn('No se pudo cargar la portada de HELLDIVERS 2.');
  }
});

/* =======================
   2) Mostrar “Ver planes” si hay sesión
   ======================= */
(async () => {
  const btnPlanes = document.getElementById('btnPlanes');
  if (!btnPlanes) return;

  // Por defecto, el botón está oculto (class="hidden")
  // Si existe Supabase y hay usuario autenticado, lo mostramos.
  try {
    // Si tienes /scripts/config.js con window.NEBULA_PUBLIC, lo usamos.
    const cfg = window.NEBULA_PUBLIC || {};
    const url = cfg.SUPABASE_URL;
    const key = cfg.SUPABASE_ANON_KEY;

    // Si supabase-js está cargado (via CDN del <head>)
    if (window.supabase && url && key) {
      const supa = window.supabase.createClient(url, key);
      const { data } = await supa.auth.getUser();
      if (data && data.user) {
        btnPlanes.classList.remove('hidden');
      } else {
        btnPlanes.classList.add('hidden');
      }

      // Opcional: reaccionar a cambios de sesión (login/logout)
      supa.auth.onAuthStateChange((_event, session) => {
        if (session?.user) btnPlanes.classList.remove('hidden');
        else btnPlanes.classList.add('hidden');
      });
    } else {
      // Si no hay supabase, mantenemos oculto.
      btnPlanes.classList.add('hidden');
    }
  } catch (err) {
    console.warn('No se pudo verificar sesión de Supabase:', err);
    btnPlanes.classList.add('hidden');
  }
})();
