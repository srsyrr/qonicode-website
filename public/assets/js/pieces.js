/* Paper pieces, standard wireframes and the row builder used by presets + shuffle.
   All sizes are in "frame units": the page frame is FRAME.w (100) units wide. */

export const FRAME = { w: 100, h: 160, top: 6.5, gap: 2 };

const lines = (n) => '<span class="sk-line"></span>'.repeat(n);
const cross = '<svg class="sk-svg" viewBox="0 0 10 10" preserveAspectRatio="none"><path d="M0 0 10 10M10 0 0 10"/></svg>';

/* size: default size on the page. mini: size while lying loose on the desk. */
export const TYPES = {
  menu: {
    label: 'menu', color: 'var(--m-ink)', size: [98, 7], mini: [34, 5],
    art: () => `<div class="sk-row"><span class="sk-dot"></span><span class="sk-links">${lines(4)}</span><span class="sk-burger">${lines(3)}</span></div>`,
  },
  banner: {
    label: 'banner', color: 'var(--m-pink)', size: [98, 4], mini: [34, 4],
    art: () => lines(1),
  },
  hero: {
    label: 'hero', color: 'var(--m-green)', size: [92, 32], mini: [34, 15],
    art: () => '<svg class="sk-svg" viewBox="0 0 60 36"><circle cx="44" cy="10" r="4.5"/><path d="M2 34 19 16l11 11 8-7 20 14"/></svg>' + lines(1),
  },
  video: {
    label: 'video', color: 'var(--m-red)', size: [92, 32], mini: [30, 15],
    art: () => '<svg class="sk-svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="17"/><path d="M16 12 29 20 16 28Z"/></svg>',
  },
  product: {
    label: 'product', color: 'var(--m-blue)', size: [40, 28], mini: [18, 14],
    art: () => cross,
  },
  text: {
    label: 'description', color: 'var(--m-brown)', size: [48, 18], mini: [26, 11],
    art: () => `<div class="sk-col">${lines(4)}</div>`,
  },
  cta: {
    label: 'CTA', color: 'var(--m-green)', size: [24, 7], mini: [18, 6],
    art: () => lines(1),
  },
  review: {
    label: 'review', color: 'var(--m-orange)', size: [16, 16], mini: [11, 11], lockAspect: true,
    art: () => '<svg class="sk-svg" viewBox="0 0 24 24"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.6Z"/></svg>',
  },
  grid: {
    label: 'collection', color: 'var(--m-blue)', size: [92, 24], mini: [34, 10],
    art: () => `<div class="sk-row">${`<span class="sk-box">${cross}</span>`.repeat(4)}</div>`,
  },
  carousel: {
    label: 'slider', color: 'var(--m-purple)', size: [92, 22], mini: [34, 10],
    art: () => '<div class="sk-row"><svg class="sk-svg sk-chev" viewBox="0 0 10 20"><path d="M8 2 2 10l6 8"/></svg><span class="sk-box"></span><svg class="sk-svg sk-chev" viewBox="0 0 10 20"><path d="M2 2l6 8-6 8"/></svg></div>',
  },
  newsletter: {
    label: 'newsletter', color: 'var(--m-purple)', size: [70, 11], mini: [30, 7],
    art: () => `<div class="sk-row"><span class="sk-box">${lines(1)}</span><span class="sk-pill"></span></div>`,
  },
  footer: {
    label: 'footer', color: 'var(--m-ink)', size: [98, 12], mini: [34, 8],
    art: () => `<div class="sk-row">${`<span class="sk-col">${lines(3)}</span>`.repeat(3)}</div>`,
  },
};

/* The loose pieces always available on the desk, in slot order. */
export const SUPPLY = ['hero', 'video', 'product', 'text', 'cta', 'review', 'grid', 'carousel', 'newsletter', 'banner', 'menu', 'footer'];

const p = (type, x, y, w, h) => ({ type, x, y, w, h });

/* Page rows: a height plus the pieces inside it (y relative to the row). */
export const ROWS = {
  menu: { h: 7, items: [p('menu', 1, 0, 98, 7)] },
  banner: { h: 4, items: [p('banner', 1, 0, 98, 4)] },
  hero: { h: 32, items: [p('hero', 4, 0, 92, 32)] },
  heroTall: { h: 46, items: [p('hero', 4, 0, 92, 46)] },
  video: { h: 32, items: [p('video', 4, 0, 92, 32)] },
  productText: { h: 28, items: [p('product', 4, 0, 40, 28), p('text', 48, 2, 48, 18), p('cta', 48, 22, 22, 6)] },
  textProduct: { h: 28, items: [p('text', 4, 2, 48, 18), p('cta', 4, 22, 22, 6), p('product', 56, 0, 40, 28)] },
  split: { h: 40, items: [p('hero', 4, 0, 45, 40), p('product', 51, 0, 45, 40)] },
  grid: { h: 24, items: [p('grid', 4, 0, 92, 24)] },
  carousel: { h: 22, items: [p('carousel', 4, 0, 92, 22)] },
  reviews: { h: 16, items: [p('review', 14, 0, 16, 16), p('review', 42, 0, 16, 16), p('review', 70, 0, 16, 16)] },
  cta: { h: 7, items: [p('cta', 38, 0, 24, 7)] },
  newsletter: { h: 11, items: [p('newsletter', 15, 0, 70, 11)] },
  text: { h: 16, items: [p('text', 4, 0, 92, 16)] },
  sidebar: { h: 48, items: [p('text', 4, 0, 26, 48), p('grid', 34, 0, 62, 22), p('product', 34, 26, 62, 22)] },
  magazine: { h: 34, items: [p('hero', 4, 0, 58, 34), p('text', 66, 0, 30, 16), p('text', 66, 18, 30, 16)] },
};
const FOOTER_ROW = { h: 12, items: [p('footer', 1, 0, 98, 12)] };

/* Standard wireframes for the ← → buttons. */
export const PRESETS = [
  { name: 'Classic store', rows: ['menu', 'banner', 'hero', 'productText', 'textProduct', 'cta', 'reviews'] },
  { name: 'Split screen', rows: ['menu', 'split', 'text', 'cta', 'reviews'] },
  { name: 'Z-shape', rows: ['menu', 'hero', 'productText', 'textProduct', 'productText'] },
  { name: 'Card grid', rows: ['menu', 'banner', 'carousel', 'grid', 'grid', 'newsletter'] },
  { name: 'Featured video', rows: ['menu', 'video', 'text', 'reviews', 'cta', 'newsletter'] },
  { name: 'Two-column', rows: ['menu', 'banner', 'sidebar', 'grid', 'newsletter'] },
  { name: 'Magazine', rows: ['menu', 'magazine', 'grid', 'text', 'reviews'] },
  { name: 'Minimal', rows: ['menu', 'heroTall', 'text', 'cta'] },
];

const SHUFFLE_POOL = ['hero', 'video', 'productText', 'textProduct', 'split', 'grid', 'carousel', 'reviews', 'cta', 'newsletter', 'text', 'sidebar', 'magazine'];
const footerTop = () => FRAME.h - FOOTER_ROW.h - 1;

/* Stack rows from the top of the page; the footer always sits at the bottom. */
export function buildLayout(rowNames) {
  const out = [];
  let y = FRAME.top + 0.5;
  for (const name of rowNames) {
    const row = ROWS[name];
    row.items.forEach((it) => out.push({ ...it, y: it.y + y }));
    y += row.h + FRAME.gap;
  }
  FOOTER_ROW.items.forEach((it) => out.push({ ...it, y: it.y + footerTop() }));
  return out;
}

/* A random but sensible page: menu on top, then sections until the page is full. */
export function randomRows() {
  const rows = ['menu'];
  if (Math.random() < 0.5) rows.push('banner');
  let y = FRAME.top + 0.5 + rows.reduce((sum, r) => sum + ROWS[r].h + FRAME.gap, 0);
  let misses = 0;
  while (misses < 8) {
    const name = SHUFFLE_POOL[Math.floor(Math.random() * SHUFFLE_POOL.length)];
    const fits = y + ROWS[name].h <= footerTop() - 2;
    if (!fits || name === rows[rows.length - 1]) { misses++; continue; }
    rows.push(name);
    y += ROWS[name].h + FRAME.gap;
  }
  return rows;
}
