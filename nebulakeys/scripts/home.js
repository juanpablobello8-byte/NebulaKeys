// scripts/home.js
// Carga la portada de HELLDIVERS 2 en la tarjeta "Próximos juegos"
// y deja el texto del rótulo un poco más arriba (ya lo hace el HTML con top-4/top-5).

document.addEventListener('DOMContentLoaded', () => {
  // HELLDIVERS 2 (Steam app 553850)
  const COVER_URL = 'https://cdn.cloudflare.steamstatic.com/steam/apps/553850/header.jpg';

  const img   = document.getElementById('upcoming-cover');
  const title = document.getElementById('upcoming-title');

  if (!img || !title) return;

  // Colocamos la portada del juego
  img.src = COVER_URL;

  // Cuando cargue, mostramos la imagen (dejando el texto arriba como rótulo)
  img.onload = () => {
    img.classList.remove('hidden');

    // Si prefieres ocultar el texto al haber imagen, descomenta:
    // title.classList.add('hidden');
  };

  // Si falla la imagen, mantenemos sólo el placeholder
  img.onerror = () => {
    console.warn('No se pudo cargar la portada de HELLDIVERS 2.');
  };
});
