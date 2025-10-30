// /scripts/catalogo.js
const grid   = document.getElementById('grid');
const q      = document.getElementById('q');
const count  = document.getElementById('count');
const empty  = document.getElementById('empty');

let GAMES = [];

function render(list) {
  grid.innerHTML = '';
  if (!list.length) {
    empty.classList.remove('hidden');
    count.textContent = '0';
    return;
  }
  empty.classList.add('hidden');
  count.textContent = String(list.length);

  const frag = document.createDocumentFragment();

  for (const g of list) {
    const card = document.createElement('article');
    card.className = 'card rounded-xl overflow-hidden hover:border-white/20 transition';

    const img = document.createElement('img');
    img.src = g.cover;
    img.alt = g.title;
    img.loading = 'lazy';
    img.className = 'w-full h-48 object-cover';
    img.onerror = () => { img.src = 'https://placehold.co/600x400?text=No+image'; };

    const box = document.createElement('div');
    box.className = 'p-4 space-y-2';

    const title = document.createElement('h3');
    title.className = 'font-semibold text-white';
    title.textContent = g.title;

    const descr = document.createElement('p');
    descr.className = 'text-slate-400 text-sm';
    descr.textContent = g.description || '';

    const meta = document.createElement('div');
    meta.className = 'text-slate-400 text-xs';
    const tags = (g.tags || []).slice(0, 3).join(' • ');
    const plats = (g.platforms || []).join(', ');
    meta.textContent = [tags, plats].filter(Boolean).join(' • ');

    const btn = document.createElement('a');
    btn.href = g.url;
    btn.target = '_blank';
    btn.rel = 'noopener';
    btn.className = 'inline-flex items-center gap-2 text-indigo-300 hover:text-indigo-200 text-sm';
    btn.innerHTML =
      'Ver en tienda <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M12.293 2.293a1 1 0 0 1 1.414 0l4 4a1 1 0 1 1-1.414 1.414L14 5.414V13a1 1 0 1 1-2 0V5.414L8.707 7.707A1 1 0 0 1 7.293 6.293l4-4Z"/><path d="M3 9a1 1 0 0 1 1 1v5h12v-5a1 1 0 1 1 2 0v6a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1Z"/></svg>';

    box.append(title, descr, meta, btn);
    card.append(img, box);
    frag.append(card);
  }

  grid.append(frag);
}

function normalize(t) { return (t || '').toLowerCase(); }

function filterGames(term) {
  const v = normalize(term);
  if (!v) return GAMES;

  return GAMES.filter(g => {
    const title = normalize(g.title);
    const descr = normalize(g.description);
    const tags  = (g.tags || []).map(normalize).join(' ');
    const plats = (g.platforms || []).map(normalize).join(' ');
    return title.includes(v) || descr.includes(v) || tags.includes(v) || plats.includes(v);
  });
}

function setupSearch() {
  let t;
  q.addEventListener('input', e => {
    clearTimeout(t);
    t = setTimeout(() => {
      render(filterGames(e.target.value));
    }, 150);
  });
}

(async function init() {
  try {
    const res = await fetch('/data/games.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('No se pudo cargar games.json');
    GAMES = await res.json();
    render(GAMES);
    setupSearch();
  } catch (err) {
    console.error(err);
    empty.textContent = 'Hubo un problema cargando el catálogo.';
    empty.classList.remove('hidden');
  }
})();
