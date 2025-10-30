// /scripts/catalog.js
(() => {
  const GRID   = document.querySelector('#grid');
  const Q      = document.querySelector('#q');
  const STATUS = document.querySelector('#status');

  // Tu JSON ya está como /data/games.json en Vercel
  const DATA_URL = '/data/games.json';

  // Fallback de imagen sin subir archivos (cambia si lo deseas)
  const FALLBACK = 'https://placehold.co/480x200/101522/94a3b8?text=Sin+imagen';

  let ALL = [];

  const esc = (s='') =>
    s.toString().replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  const pill = (label, cls='bg-white/10') =>
    `<span class="inline-block text-xs ${cls} px-2 py-1 rounded-md mr-1 mb-1">${esc(label)}</span>`;

  const cover = (src, alt) => {
    const safeSrc = src && src.trim() ? src : FALLBACK;
    return `<img src="${safeSrc}" alt="${esc(alt)}" loading="lazy"
                onerror="this.onerror=null;this.src='${FALLBACK}'">`;
  };

  function card(g) {
    // Soporta url | steamUrl | website
    const link  = g.url || g.steamUrl || g.website || '#';
    const tags  = Array.isArray(g.tags) ? g.tags : [];
    const plats = Array.isArray(g.platforms) ? g.platforms : [];

    return `
      <article class="game card rounded-xl p-3">
        <a href="${link}" target="_blank" rel="noopener">
          ${cover(g.cover, g.title)}
        </a>
        <div class="meta">
          <h3>${esc(g.title || '')}</h3>
          <p class="text-slate-400 mt-1">${esc(g.description || '')}</p>

          ${(plats.length || tags.length) ? `
            <div class="mt-3">
              ${plats.map(p => pill(p, 'bg-indigo-600/30')).join('')}
              ${tags.map(t => pill(t)).join('')}
            </div>` : ''}
        </div>
      </article>`;
  }

  function render(list) {
    const total = ALL.length;
    const shown = list.length;
    STATUS.innerHTML = shown
      ? `Mostrando <strong>${shown}</strong> de <strong>${total}</strong> juegos`
      : `No hay juegos para mostrar.`;
    GRID.innerHTML = shown ? list.map(card).join('') : '';
  }

  function applySearch() {
    const q = (Q.value || '').trim().toLowerCase();
    if (!q) return render(ALL);

    const filtered = ALL.filter(g => {
      const hay = [
        g.title, g.description,
        ...(g.tags || []),
        ...(g.platforms || [])
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });

    render(filtered);
  }

  async function load() {
    try {
      STATUS.textContent = 'Cargando catálogo…';
      const res = await fetch(DATA_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status} al cargar ${DATA_URL}`);
      const json = await res.json();
      if (!Array.isArray(json)) throw new Error('El JSON no es un array');

      ALL = json;
      render(ALL);
    } catch (err) {
      console.error('Error cargando catálogo:', err);
      STATUS.innerHTML = `<span class="text-red-400">No se pudo cargar el catálogo:</span> ${esc(err.message)}`;
      GRID.innerHTML = '';
    }
  }

  Q.addEventListener('input', applySearch);
  load();
})();
