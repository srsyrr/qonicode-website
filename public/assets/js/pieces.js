/* Paper cards, standard wireframes per page type, and the shuffle rules.
   All sizes are in "frame units": the page frame is FRAME.w (100) units wide. */

export const FRAME = { w: 100, h: 160, top: 6.5, gap: 2 };

const lines = (n) => '<span class="sk-line"></span>'.repeat(n);
const cross = '<svg class="sk-svg" viewBox="0 0 10 10" preserveAspectRatio="none"><path d="M0 0 10 10M10 0 0 10"/></svg>';
const star = '<svg class="sk-svg" viewBox="0 0 24 24"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.6Z"/></svg>';

/* size: default size on the page. mini: size while waiting on the desk.
   label: the caption printed on the desk under the card's spot (never on the card itself).
   ratio: width / height kept while resizing. */
export const TYPES = {
  img: {
    label: 'img box', color: 'var(--m-blue)', size: [40, 28], mini: [18, 13],
    art: () => cross,
  },
  table: {
    label: 'table', color: 'var(--m-brown)', size: [60, 22], mini: [24, 11],
    art: () => `<div class="sk-table">${'<span></span>'.repeat(12)}</div>`,
  },
  text: {
    label: 'description', color: 'var(--m-brown)', size: [48, 18], mini: [24, 11],
    art: () => `<div class="sk-col">${lines(4)}</div>`,
  },
  cta: {
    label: 'CTA', color: 'var(--m-cobalt)', size: [24, 7], mini: [18, 6],
    art: () => lines(1),
  },
  menu: {
    label: 'menu', color: 'var(--m-ink)', size: [98, 7], mini: [32, 5],
    art: () => `<div class="sk-row"><span class="sk-dot"></span><span class="sk-links">${lines(4)}</span><span class="sk-burger">${lines(3)}</span></div>`,
  },
  circle: {
    label: 'circle img', color: 'var(--m-orange)', size: [16, 16], mini: [11, 11], ratio: 1,
    art: () => '<svg class="sk-svg" viewBox="0 0 40 40"><circle cx="27" cy="14" r="4"/><path d="M6 31 16 20l7 7 5-4 8 8"/></svg>',
  },
  stars: {
    label: '5 stars', color: 'var(--m-orange)', size: [30, 6], mini: [22, 4.4], ratio: 5,
    art: () => `<div class="sk-stars">${star.repeat(5)}</div>`,
  },
  banner: {
    label: 'banner', color: 'var(--m-pink)', size: [98, 4], mini: [32, 4],
    art: () => lines(1),
  },
  section: {
    label: 'section / sidebar', color: 'var(--m-purple)', size: [92, 30], mini: [24, 15],
    art: () => '',
  },
  slider: {
    label: 'slider', color: 'var(--m-purple)', size: [92, 22], mini: [30, 11],
    art: () => '<div class="sk-row"><svg class="sk-svg sk-chev" viewBox="0 0 10 20"><path d="M8 2 2 10l6 8"/></svg><span class="sk-box"></span><svg class="sk-svg sk-chev" viewBox="0 0 10 20"><path d="M2 2l6 8-6 8"/></svg></div>',
  },
  label: {
    label: 'label (type it!)', color: 'var(--m-ink)', size: [30, 6], mini: [22, 6], editable: true,
    art: () => '<input class="piece__input" type="text" maxlength="20" placeholder="label" aria-label="Label text (max 20 characters)" spellcheck="false" autocomplete="off">',
  },
};

/* Desk slot order (one waiting card per type). */
export const SUPPLY = ['img', 'circle', 'text', 'table', 'cta', 'stars', 'menu', 'banner', 'section', 'slider', 'label'];

const p = (type, x, y, w, h) => ({ type, x, y, w, h });
const row = (h, items) => ({ h, items });

/* n product cards across `width` starting at x0, each an image with a short description under it. */
function productRow(n, x0, width, imgH, { text = true, gap = 2 } = {}) {
  const w = (width - gap * (n - 1)) / n;
  const items = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + i * (w + gap);
    items.push(p('img', x, 0, w, imgH));
    if (text) items.push(p('text', x, imgH + 1, w, 5));
  }
  return row(imgH + (text ? 6 : 0), items);
}

/* Page rows: a height plus the cards inside it (y relative to the row). */
export const ROWS = {
  menu: row(7, [p('menu', 1, 0, 98, 7)]),
  banner: row(4, [p('banner', 1, 0, 98, 4)]),
  hero: row(32, [p('img', 4, 0, 92, 32)]),
  heroText: row(36, [p('img', 4, 0, 92, 36), p('text', 10, 8, 44, 14), p('cta', 10, 25, 22, 6)]),
  imgText: row(28, [p('img', 4, 0, 40, 28), p('text', 48, 2, 48, 16), p('cta', 48, 21, 22, 6)]),
  textImg: row(28, [p('text', 4, 2, 48, 16), p('cta', 4, 21, 22, 6), p('img', 56, 0, 40, 28)]),
  split: row(40, [p('img', 4, 0, 45, 40), p('img', 51, 0, 45, 40)]),
  slider: row(22, [p('slider', 4, 0, 92, 22)]),
  reviews: row(18, [
    p('circle', 15, 0, 12, 12), p('stars', 11, 14, 20, 4),
    p('circle', 44, 0, 12, 12), p('stars', 40, 14, 20, 4),
    p('circle', 73, 0, 12, 12), p('stars', 69, 14, 20, 4),
  ]),
  cta: row(7, [p('cta', 38, 0, 24, 7)]),
  text: row(16, [p('text', 4, 0, 92, 16)]),
  sidebar: row(48, [p('section', 4, 0, 26, 48), p('img', 34, 0, 62, 22), p('text', 34, 26, 62, 22)]),
  magazine: row(34, [p('img', 4, 0, 58, 34), p('text', 66, 0, 30, 16), p('text', 66, 18, 30, 16)]),
  table: row(22, [p('table', 4, 0, 92, 22)]),
  newsletter: row(7, [p('label', 18, 0, 42, 7), p('cta', 62, 0, 20, 7)]),

  // product page
  pdpMain: row(56, [
    p('img', 4, 0, 52, 44),
    p('img', 4, 46, 12, 10), p('img', 17.3, 46, 12, 10), p('img', 30.7, 46, 12, 10), p('img', 44, 46, 12, 10),
    p('text', 60, 0, 36, 8), p('stars', 60, 10, 20, 4), p('text', 60, 17, 36, 14),
    p('label', 60, 34, 36, 6), p('cta', 60, 43, 36, 7),
  ]),
  pdpGallery: row(64, [
    p('img', 4, 0, 56, 31), p('img', 4, 33, 27, 31), p('img', 33, 33, 27, 31),
    p('section', 63, 0, 33, 64),
    p('text', 66, 3, 27, 10), p('stars', 66, 15, 20, 4), p('label', 66, 22, 27, 6), p('cta', 66, 31, 27, 7), p('table', 66, 42, 27, 18),
  ]),
  pdpHero: row(40, [p('img', 4, 0, 92, 40)]),
  pdpCenter: row(26, [p('text', 20, 0, 60, 8), p('stars', 40, 10, 20, 4), p('label', 25, 16, 24, 7), p('cta', 51, 16, 24, 7)]),
  specs: row(26, [p('text', 4, 0, 30, 26), p('table', 38, 0, 58, 26)]),

  // collection page
  plpHead: row(14, [p('text', 4, 0, 50, 7), p('label', 4, 9, 20, 5), p('label', 76, 9, 20, 5)]),
  collectionBanner: row(20, [p('img', 4, 0, 92, 20), p('text', 10, 6, 40, 8)]),
  plpSidebarGrid: (() => {
    const grid = [0, 1, 2].flatMap((r) => productRow(3, 30, 66, 18).items.map((it) => ({ ...it, y: it.y + r * 26 })));
    return row(76, [p('section', 4, 0, 22, 76), p('label', 6, 3, 18, 5), p('label', 6, 10, 18, 5), p('label', 6, 17, 18, 5), ...grid]);
  })(),
  grid4: productRow(4, 4, 92, 22),
  grid3: productRow(3, 4, 92, 28),
  loadMore: row(7, [p('cta', 36, 0, 28, 7)]),
};
const FOOTER_ROW = row(12, [p('section', 1, 0, 98, 12)]);

/* Standard wireframes for the ← → buttons, per page type. */
export const PAGES = {
  home: {
    label: 'Home page',
    presets: [
      { name: 'Classic store', rows: ['menu', 'banner', 'hero', 'imgText', 'textImg', 'reviews', 'cta'] },
      { name: 'Split screen', rows: ['menu', 'split', 'text', 'cta', 'reviews'] },
      { name: 'Z-shape', rows: ['menu', 'heroText', 'imgText', 'textImg', 'imgText'] },
      { name: 'Sidebar', rows: ['menu', 'banner', 'sidebar', 'slider', 'newsletter'] },
      { name: 'Magazine', rows: ['menu', 'magazine', 'slider', 'text', 'reviews'] },
    ],
    shuffle: () => [
      'menu', ...maybe('banner'),
      ...pickMany(['hero', 'heroText', 'imgText', 'textImg', 'split', 'slider', 'reviews', 'cta', 'text', 'sidebar', 'magazine', 'table', 'newsletter'], 3),
    ],
  },
  pdp: {
    label: 'PDP',
    presets: [
      { name: 'Classic PDP', rows: ['menu', 'banner', 'pdpMain', 'specs', 'reviews'] },
      { name: 'Gallery PDP', rows: ['menu', 'pdpGallery', 'text', 'reviews', 'slider'] },
      { name: 'Stacked PDP', rows: ['menu', 'pdpHero', 'pdpCenter', 'table', 'reviews'] },
    ],
    shuffle: () => [
      'menu', ...maybe('banner'),
      ...pickOne([['pdpMain'], ['pdpGallery'], ['pdpHero', 'pdpCenter']]),
      ...pickMany(['specs', 'reviews', 'slider', 'text', 'table', 'imgText', 'newsletter'], 1),
    ],
  },
  plp: {
    label: 'PLP',
    presets: [
      { name: 'Sidebar filters', rows: ['menu', 'banner', 'plpHead', 'plpSidebarGrid', 'loadMore'] },
      { name: 'Four-up grid', rows: ['menu', 'collectionBanner', 'plpHead', 'grid4', 'grid4', 'loadMore'] },
      { name: 'Big tiles', rows: ['menu', 'plpHead', 'grid3', 'grid3', 'loadMore'] },
    ],
    shuffle: () => [
      'menu', ...maybe('banner'), ...maybe('collectionBanner'), 'plpHead',
      ...pickOne([['plpSidebarGrid'], ['grid4', 'grid4'], ['grid3', 'grid4'], ['grid3', 'grid3']]),
      ...pickMany(['loadMore', 'slider', 'text', 'newsletter'], 0),
    ],
  },
};

const footerTop = () => FRAME.h - FOOTER_ROW.h - 1;
const maybe = (name) => (Math.random() < 0.5 ? [name] : []);
const pickOne = (list) => list[Math.floor(Math.random() * list.length)];
function pickMany(pool, min) {
  const out = [];
  const n = min + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) out.push(pickOne(pool.filter((r) => r !== out[out.length - 1])));
  return out;
}

/* Stack rows from the top of the page (dropping any that would not fit); the footer sits at the bottom. */
export function buildLayout(rowNames) {
  const out = [];
  let y = FRAME.top + 0.5;
  for (const name of rowNames) {
    const r = ROWS[name];
    if (y + r.h > footerTop() - 1) continue;
    r.items.forEach((it) => out.push({ ...it, y: it.y + y }));
    y += r.h + FRAME.gap;
  }
  FOOTER_ROW.items.forEach((it) => out.push({ ...it, y: it.y + footerTop() }));
  return out;
}
