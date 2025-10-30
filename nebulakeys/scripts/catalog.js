// CATALOGO PÚBLICO (sin login)
// Carga /data/games.json, renderiza tarjetas, búsqueda y chips de etiquetas.

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const grid   = $('#grid');
const empty  = $('#empty');
const qInput = $('#q');
const tagsBar = $('#tagsBar');

const modal  = $('#detailsModal');
const mCover = $('#mCover');
const mTitle = $('#mTitle');
const mDesc  = $('#mDesc');
const mTags  = $('#mTags');
const mPlatforms = $('#mPlatforms');
const mClose = $('#mClose');

let GAMES = [];
let ACTIVE_TAG = null;

// ---- Utils ----
function tagChip(text, classes = '') {
  const span = document.createElement('span');
  span.className = `chip px-2.5 py-1 rounded-lg text-sm ${classes}`;
  span.textContent = text;
  return span;
}

function imgFallback(ev) {
  ev.target.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="480" height="640">
      <rect width="100%" height="100%" fill="#111827"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
            fill="#6b7280" font-family="sans-serif" font-size="20">Sin portada</text>
    </svg>
  `);
}

// ---- Render ----
function renderGrid(games) {
  grid.innerHTML = '';
  if (!games.length) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  for (const g of games) {
    const card = document.createElement('article');
    card.className = 'card rounded-2xl overflow-hidden flex flex-col';

    const img = document.createElement('img');
    img.src = g.cover;
    img.alt = g.title;
    img.loading = 'lazy';
    img.className = 'w-full h-48 object-cover bg-slate-800';
    img.onerror = imgFallback;

    const body = document.createElement('div');
    body.className = 'p-4 flex flex-col gap-2 flex-1';

    const h3 = document.createElement('h3');
    h3.className = 'text-lg font-semibold';
    h3.textContent = g.title;

    const p = document.createElement('p');
    p.className = 'text-slate-300 clamp-3';
    p.textContent = g.description;

    const tagWrap = document.createElement('div');
    tagWrap.className = 'flex flex-wrap gap-2 mt-auto';
    g.tags.forEach(t => tagWrap.appendChild(tagChip('#' + t)));

    const btn = document.createElement('button');
    btn.className = 'mt-3 px-3 py-2 rounded-lg bg-indigo-500/90 hover:bg-indigo-500 text-white focus-ring';
    btn.textContent = 'Ver detalles';
    btn.addEventListener('click', () => openModal(g));

    body.append(h3, p, tagWrap, btn);
    card.append(img, body);
    grid.appendChild(card);
  }
}

function openModal(game) {
  mTitle.textContent = game.title;
  mDesc.textContent = game.description;
  mCover.src = game.cover;
  mCover.onerror = imgFallback;

  mTags.innerHTML = '';
  mPlatforms.innerHTML = '';
  game.tags.forEach(t => mTags.appendChild(tagChip('#' + t)));
  game.platforms.forEach(p => mPlatforms.appendChild(tagChip(p)));

  modal.showModal();
}

mClose.addEventListener('click', () => modal.close());
modal.addEventListener('click', (e) => {
  if (e.target === modal) modal.close();
});

// ---- Búsqueda + filtro de tag ----
function filterGames() {
  const q = (qInput.value || '').trim().toLowerCase();

  const out = GAMES.filter(g => {
    const qOk =
      !q ||
      g.title.toLowerCase().includes(q) ||
      g.tags.some(t => t.toLowerCase().includes(q));
    const tagOk =
      !ACTIVE_TAG || g.tags.includes(ACTIVE_TAG);
    return qOk && tagOk;
  });

  renderGrid(out);
}

qInput.addEventListener('input', filterGames);

// ---- Chips de etiquetas globales ----
function buildTagChips(games) {
  const all = new Set();
  games.forEach(g => g.tags.forEach(t => all.add(t)));
  const tags = [...all].sort();

  tagsBar.innerHTML = '';
  // chip "Todos"
  const cAll = tagChip('Todos', ACTIVE_TAG ? 'opacity-60 cursor-pointer' : 'bg-indigo-500/80 text-white');
  cAll.addEventListener('click', () => {
    ACTIVE_TAG = null;
    buildTagChips(GAMES);
    filterGames();
  });
  tagsBar.appendChild(cAll);

  tags.forEach(t => {
    const isActive = ACTIVE_TAG === t;
    const chip = tagChip('#' + t, isActive ? 'bg-indigo-500/80 text-white' : 'opacity-60 cursor-pointer');
    chip.addEventListener('click', () => {
      ACTIVE_TAG = isActive ? null : t;
      buildTagChips(GAMES);
      filterGames();
    });
    tagsBar.appendChild(chip);
  });
}

// ---- Carga inicial ----
(async function init() {
  try {
    const res = await fetch('/data/games.json', { cache: 'no-store' });
    GAMES = await res.json();
    buildTagChips(GAMES);
    renderGrid(GAMES);
  } catch (err) {
    console.error('Error cargando catálogo:', err);
    empty.textContent = 'No se pudo cargar el catálogo.';
    empty.classList.remove('hidden');
  }
})();
