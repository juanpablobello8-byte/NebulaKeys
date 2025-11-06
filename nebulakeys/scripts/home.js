// scripts/home.js
// Portada para "Próximos juegos"
document.addEventListener('DOMContentLoaded', () => {
  const COVER_URL = 'https://cdn.cloudflare.steamstatic.com/steam/apps/553850/header.jpg';
  const img   = document.getElementById('upcoming-cover');
  const title = document.getElementById('upcoming-title');

  if (img) {
    img.src = COVER_URL;
    img.onload = () => {
      img.classList.remove('hidden');
      // Ocultamos el rótulo sobre la imagen para evitar duplicado (ya existe arriba como badge)
      if (title) title.classList.add('hidden');
    };
  }

  // Mostrar "Ver planes" sólo si hay sesión.
  const plansBtn = document.getElementById('btn-plans');

  async function isLoggedIn() {
    // Si usas Supabase y ya cargaste el cliente en otro script, lo intentamos:
    try {
      if (window.supabase && window.supabase.auth) {
        const { data: { session } } = await window.supabase.auth.getSession();
        if (session) return true;
      }
    } catch (_) {}

    // Fallback por si guardas un flag local después del login
    // (ajústalo según tu flujo real)
    return localStorage.getItem('nk_is_logged_in') === '1';
  }

  isLoggedIn().then(ok => {
    if (plansBtn) plansBtn.classList.toggle('hidden', !ok);
  });
});
