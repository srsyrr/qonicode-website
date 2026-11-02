/* Fix picker: an example store built from named Shopify sections. A visitor taps a section, rolls two wheels
   (which part, what's wrong), sees the price, and adds it to a fix list that opens like a store's cart.
   The list is sent to /api/request as kind "fixlist", with optional screenshots made smaller in the browser.
   All prices here are what the visitor sees before I look at the store; I confirm a fixed price before any contract. */

import { mountTurnstile } from './turnstile.js';

const root = document.querySelector('[data-fix]');
const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '$' + Math.round(n);
const MAIL_TO = 'qonita@qonicode.tech';
const ROW = 40;                     // wheel row height, same as --fx-row
const MAX_SHOTS = 6;
const wide = matchMedia('(min-width: 760px)');
const smooth = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

const ui = {};

/* ---------- the example store ---------- */
const L = (w, cls = '', h) => `<span class="l ${cls}" style="width:${w}%${h ? `;height:${h}px` : ''}"></span>`;
const B = (h) => `<span class="blk" style="height:${h}px"></span>`;
const BT = (t, cls = '', style = '') => `<span class="bt ${cls}"${style ? ` style="${style}"` : ''}>${t}</span>`;
const card = (h) => `<span class="card">${B(h)}${L(80)}${L(40)}</span>`;
const cards = (d, h = 64) => `<span class="cards">${card(h).repeat(d ? 4 : 2)}</span>`;
const circ = (size, lines) => `<span class="card"><span class="circle" style="width:${size}px;height:${size}px"></span>${lines}</span>`;
const sq = (size) => `<span class="blk" style="flex:none;width:${size}px;height:${size}px"></span>`;

/* global = on every page; kind = which price rule its problems use; phoneOnly = not drawn on the desktop layout */
const GLOBAL_TOP = [
  { id: 'announcement', name: 'Announcement bar', global: true, art: () => `<span class="ann">${L(60)}</span>` },
  { id: 'header', name: 'Header', global: true, parts: ['Logo', 'Menu', 'Search', 'Cart icon'],
    art: (d, p) => `<span class="row">${d
      ? p('Logo', '<span class="logo"></span>') + `<span class="grow">${p('Menu', `<span class="nav">${'<span class="l"></span>'.repeat(4)}</span>`)}</span>`
      : p('Menu', '<span class="burger"><i></i><i></i><i></i></span>') + `<span class="grow center">${p('Logo', '<span class="logo"></span>')}</span>`}
      ${p('Search', '<span class="ico"></span>')}${p('Cart icon', '<span class="ico bag"></span>')}</span>` },
];
const GLOBAL_BOTTOM = [
  { id: 'newsletter', name: 'Newsletter signup', global: true, art: () => `${L(50, 'c', 12)}<span class="row"><span class="grow input"></span>${BT('Subscribe', '', 'width:110px')}</span>` },
  { id: 'footer', name: 'Footer', global: true, parts: ['Footer menus', 'Social icons', 'Payment icons'],
    art: (d, p) => `${p('Footer menus', `<span class="g3">${[0, 1, 2].map(() => `<span class="stack">${L(70)}${L(55)}${L(60)}</span>`).join('')}</span>`)}<span class="row between">${p('Social icons', '<span class="dots"><i></i><i></i><i></i></span>')}${p('Payment icons', '<span class="pay"><i></i><i></i><i></i><i></i></span>')}</span>` },
];
const PAGES = {
  home: { name: 'Home', tmpl: 'Home page', sections: [
    { id: 'hero', name: 'Image banner', parts: ['Image', 'Heading', 'Button'], art: (d, p) => `${p('Image', B(d ? 170 : 140))}${p('Heading', L(70, 'dark', 14) + L(50))}${p('Button', BT('Shop now'))}` },
    { id: 'featured', name: 'Featured collection', parts: ['Product cards', 'View all button'], art: (d, p) => `${L(40, '', 12)}${p('Product cards', cards(d))}${p('View all button', BT('View all'))}` },
    { id: 'collist', name: 'Collection list', art: () => `${L(35, '', 12)}<span class="g3">${circ(56, L(60, 'c')).repeat(3)}</span>` },
    { id: 'imgtext', name: 'Image with text', parts: ['Image', 'Text', 'Button'], art: (d, p) => `<span class="${d ? 'g2' : 'stack'}">${p('Image', B(110))}<span class="stack">${p('Text', L(80, 'dark', 12) + L(90) + L(70))}${p('Button', BT('Learn more'))}</span></span>` },
    { id: 'multicol', name: 'Multicolumn', art: () => `<span class="g3">${circ(36, L(70, 'c') + L(50, 'c')).repeat(3)}</span>` },
    { id: 'testimonials', name: 'Testimonials', art: (d) => `<span class="${d ? 'g3' : 'g2'}">${('<span class="card blk pad"><span class="stars">★★★★★</span>' + L(90) + L(70) + '</span>').repeat(d ? 3 : 2)}</span>` },
    { id: 'video', name: 'Video', art: (d) => `<span class="blk play" style="height:${d ? 180 : 130}px"></span>` },
  ] },
  product: { name: 'Product', tmpl: 'Product page', sections: [
    { id: 'info', name: 'Product information', parts: ['Media gallery', 'Title', 'Price', 'Variant picker', 'Quantity', 'Buy buttons', 'Description', 'Collapsible tabs'], partKinds: { 'Variant picker': 'data' },
      art: (d, p) => `<span class="pinfo">${p('Media gallery', B(d ? 260 : 200) + `<span class="row">${'<span class="blk" style="flex:1;height:34px"></span>'.repeat(4)}</span>`)}
        <span class="stack">${p('Title', L(85, 'dark', 16))}${p('Price', L(30, 'dark', 11))}${p('Variant picker', L(25) + '<span class="chipsw"><i></i><i></i><i></i><i></i></span>')}${p('Quantity', '<span class="stepper"><i></i><i></i><i></i></span>')}${p('Buy buttons', BT('Add to cart') + BT('Buy it now', 'dark'))}${p('Description', L(95) + L(85) + L(60))}${p('Collapsible tabs', '<span class="acc"></span><span class="acc"></span><span class="acc"></span>')}</span></span>` },
    { id: 'reviews', name: 'Reviews', kind: 'app', parts: ['Star rating', 'Review list', 'Write a review'], art: (d, p) => `${p('Star rating', '<span class="stars">★★★★☆</span>' + L(30))}${p('Review list', L(80) + L(60) + L(75) + L(50))}${p('Write a review', BT('Write a review', '', 'width:160px'))}` },
    { id: 'related', name: 'Related products', art: (d) => `${L(40, '', 12)}${cards(d, 56)}` },
    { id: 'sticky', name: 'Sticky add to cart', phoneOnly: true, art: () => `<span class="row framed"><span class="grow stack">${L(70)}${L(30, 'dark')}</span>${BT('Add', '', 'width:90px')}</span>` },
  ] },
  collection: { name: 'Collection', tmpl: 'Collection page', sections: [
    { id: 'cbanner', name: 'Collection banner', art: () => `${L(50, 'dark', 16)}${L(75)}` },
    { id: 'filters', name: 'Filters and sort', parts: ['Filters', 'Sort'], art: (d, p) => `<span class="row between">${p('Filters', '<span class="chipsw"><i style="width:60px"></i><i style="width:50px;background:var(--c-paper)"></i><i style="width:56px"></i></span>')}${p('Sort', '<span class="input" style="width:90px"></span>')}</span>` },
    { id: 'grid', name: 'Product grid', parts: ['Product cards', 'Quick add', 'Sale badges'], art: (d, p) => `${p('Product cards', `<span class="cards">${card(70).repeat(d ? 4 : 2)}</span>`)}<span class="row">${p('Sale badges', '<span class="chipsw"><i style="width:44px;background:var(--c-orange)"></i></span>')}${p('Quick add', BT('Quick add', '', 'width:120px'))}</span>` },
    { id: 'pagination', name: 'Pagination', art: () => `<span class="row center">${'<span class="blk" style="width:26px;height:26px"></span>'.repeat(4)}</span>` },
  ] },
  cart: { name: 'Cart', tmpl: 'Cart page', sections: [
    { id: 'cartdrawer', name: 'Cart drawer', parts: ['Free shipping bar', 'Cart items', 'Upsell', 'Checkout button'],
      art: (d, p) => `<span class="drawer">${p('Free shipping bar', '<span class="progress"></span>')}${p('Cart items', `<span class="row">${sq(40)}<span class="grow stack">${L(80)}${L(40)}</span></span>`)}${p('Upsell', `<span class="row">${L(30)}${L(20)}</span>`)}${p('Checkout button', BT('Check out', 'dark'))}</span>` },
    { id: 'items', name: 'Cart items', parts: ['Product rows', 'Quantity', 'Remove'], art: (d, p) => `${p('Product rows', [0, 1].map(() => `<span class="row">${sq(56)}<span class="grow stack">${L(70)}${L(30)}</span></span>`).join(''))}<span class="row between">${p('Quantity', '<span class="stepper"><i></i><i></i><i></i></span>')}${p('Remove', '<span class="l" style="width:60px"></span>')}</span>` },
    { id: 'summary', name: 'Subtotal and checkout', parts: ['Discount code', 'Order note', 'Checkout button'], art: (d, p) => `${p('Discount code', '<span class="input"></span>')}${p('Order note', '<span class="input" style="height:44px"></span>')}<span class="row between">${L(25)}${L(20, 'dark')}</span>${p('Checkout button', BT('Check out', 'dark'))}` },
    { id: 'upsell', name: 'Cart upsell', kind: 'app', art: (d) => `${L(40, '', 12)}<span class="${d ? 'g3' : 'g2'}">${(`<span class="row blk pad">${sq(36)}<span class="grow">${L(70)}</span></span>`).repeat(d ? 3 : 2)}</span>` },
  ] },
  other: { name: 'Other pages', sections: [
    { id: 'search', name: 'Search results', tmpl: 'Search page', art: () => `<span class="input"></span>${L(80)}${L(70)}${L(75)}` },
    { id: 'blog', name: 'Blog and articles', tmpl: 'Blog pages', art: (d) => `<span class="${d ? 'g3' : 'g2'}">${('<span class="card">' + B(60) + L(80) + L(60) + '</span>').repeat(d ? 3 : 2)}</span>` },
    { id: 'contact', name: 'Contact form', tmpl: 'Contact page', parts: ['Form fields', 'Send button'], art: (d, p) => `${p('Form fields', '<span class="input"></span><span class="input"></span><span class="input" style="height:60px"></span>')}${p('Send button', BT('Send'))}` },
    { id: 'page', name: 'About or custom page', tmpl: 'Custom pages', art: () => `${L(45, 'dark', 16)}${L(95)}${L(90)}${L(70)}` },
    { id: 'notfound', name: '404 page', tmpl: '404 page', art: () => `<span class="f404">404</span>${L(50, 'c')}` },
    { id: 'checkout', name: 'Checkout', tmpl: 'Checkout', limited: 'Limited by Shopify without Plus. Tell me what you need and I check what is possible.',
      art: () => `<span class="lock">Limited by Shopify</span><span class="input"></span><span class="input"></span>${BT('Pay now', 'dark')}` },
  ] },
};
const ELSEWHERE = { id: 'elsewhere', name: 'Somewhere else', tmpl: 'Your store', limited: 'Not in the example store', art: () => '' };

/* The second wheel. "Looks wrong" carries the screen, so there is no phone/desktop switch.
   Each problem keeps its colour everywhere: wheel dot, numbers on the store, thumbnails in the list. */
const PROBS = [
  { id: 'phone', why: 'looks', device: 'phone', t: 'Looks wrong on phone', short: 'Looks wrong · phone', c: 'var(--c-orange)' },
  { id: 'desktop', why: 'looks', device: 'desktop', t: 'Looks wrong on desktop', short: 'Looks wrong · desktop', c: 'var(--c-teal)' },
  { id: 'broken', why: 'broken', t: "Doesn't work", c: 'var(--c-pink)' },
  { id: 'change', why: 'change', t: 'Change it', c: 'var(--c-purple)' },
  { id: 'add', why: 'add', t: 'Add something here', c: 'var(--c-green)' },
  { id: 'other', why: 'other', t: 'Something else', c: 'var(--c-yellow)' },
];
const PROB = Object.fromEntries(PROBS.map((p) => [p.id, p]));

const S = { page: 'product', sel: null, items: [], nextProb: null, inView: false, sent: false, copied: false, shots: [] };

const D = () => wide.matches;
const sectionsFor = (pid) => {
  const own = PAGES[pid].sections.filter((s) => !(s.phoneOnly && D()));
  return pid === 'other' ? own : [...GLOBAL_TOP, ...own, ...GLOBAL_BOTTOM];
};
const ALL = [...GLOBAL_TOP, ...GLOBAL_BOTTOM, ...Object.values(PAGES).flatMap((p) => p.sections)];
const findSection = (id) => (id === 'elsewhere' ? ELSEWHERE : ALL.find((s) => s.id === id));
const tmplOf = (s) => (s.id === 'elsewhere' ? 'Your store' : s.global ? 'Every page' : (s.tmpl || PAGES[S.page].tmpl));
const partsOf = (s) => ['Whole section', ...(s.parts || [])];
const probsOf = (s) => (s.limited ? [PROB.other] : PROBS);
const crumbOf = (tmpl, name, part) => `${tmpl} › ${name}${part !== 'Whole section' ? ' › ' + part : ''}`;

/* ---------- prices ---------- */
/* Price every item in list order (bands from the Upwork job data in Demo/40_acquisition, 2026-11).
   Phone layout: first template $40, each further template $20,
   more parts on an already-listed template are included. Change: $25, then $10 each. */
function priceAll(items) {
  const layout = new Set();
  let changes = 0;
  return items.map((it) => {
    if (it.why === 'other' || it.limited) return { after: true, rule: 'I look at your store first' };
    if (it.why === 'looks' && it.device === 'desktop') return { low: 40, high: 100, rule: 'Desktop layout fix', days: 2 };
    if ((it.why === 'looks' || it.why === 'broken') && it.kind === 'data') return { low: 50, high: 100, rule: 'Product options and data', days: 2 };
    if ((it.why === 'looks' || it.why === 'broken') && it.kind === 'app') return { low: 35, high: 70, rule: 'Make the app fit your theme', days: 1 };
    if (it.why === 'looks') {
      if (layout.has(it.tmpl)) return { low: 0, high: 0, rule: `Part of the ${it.tmpl.toLowerCase()} phone fix`, days: 0 };
      const extra = layout.size > 0;
      const price = extra ? 20 : 40;
      layout.add(it.tmpl);
      return { low: price, high: price, rule: `Phone layout · ${it.tmpl}${extra ? ', extra page' : ''}`, days: extra ? 1 : 2 };
    }
    if (it.why === 'broken') return { low: 40, high: 100, rule: 'Repair', days: 2 };
    if (it.why === 'change') { const price = changes++ ? 10 : 25; return { low: price, high: price, rule: price === 25 ? 'Text, label or setting change' : 'Extra change', days: 0.5 }; }
    if (it.why === 'add') return { low: 60, high: 150, rule: 'New section, simple to advanced', days: 3 };
    return { after: true, rule: 'I look at your store first' };
  });
}
function totals() {
  const ps = priceAll(S.items);
  const low = ps.reduce((a, p) => a + (p.low || 0), 0);
  const high = ps.reduce((a, p) => a + (p.high || 0), 0);
  const after = ps.filter((p) => p.after).length;
  const days = Math.max(1, Math.ceil(ps.reduce((a, p) => a + (p.days ?? 0), 0)));
  return { ps, low, high, after, days };
}
const priceText = (p) => (p.after ? 'After a look' : p.high === 0 ? 'Included' : p.high > p.low ? `${money(p.low)}–${money(p.high)}` : money(p.low));
const rangeText = (t) => (t.low === t.high ? money(t.low) : `${money(t.low)}–${money(t.high)}`);

/* the item the wheels point at right now */
function candidate() {
  const { s, part, prob } = S.sel;
  const pr = PROB[prob];
  const tmpl = tmplOf(s);
  return { secId: s.id, part, tmpl, crumb: crumbOf(tmpl, s.name, part), why: pr.why, prob: pr.id, device: pr.device, kind: (s.partKinds && s.partKinds[part]) || s.kind || null, limited: !!s.limited };
}

/* ---------- render the store ---------- */
function renderTabs() {
  ui.tabs.innerHTML = Object.entries(PAGES).map(([k, p]) => `<button type="button" class="seg__item${S.page === k ? ' is-active' : ''}" data-fx-tab="${k}" aria-pressed="${S.page === k}">${p.name}</button>`).join('');
}
function renderFrame() {
  const d = D();
  ui.frame.classList.toggle('is-desk', d);
  /* each number takes the colour of its problem, same as in the wheel and the fix list */
  const num = (x) => `<b class="fx-num" style="--c:${PROB[x.it.prob].c}" aria-label="item ${x.n}, ${PROB[x.it.prob].t}">${x.n}</b>`;
  ui.frame.innerHTML = '<div class="fx-frame__bar" aria-hidden="true"><i></i><i></i><i></i></div>' + sectionsFor(S.page).map((s) => {
    const mine = S.items.map((it, i) => ({ it, n: i + 1 })).filter((x) => x.it.secId === s.id);
    const p = (name, inner) => `<button type="button" class="fx-part" tabindex="-1" data-fx-part="${esc(name)}" aria-label="${esc(s.name)}: ${esc(name)}">${inner}${mine.filter((x) => x.it.part === name).map(num).join('')}</button>`;
    return `<section class="fx-sec${s.limited ? ' is-limited' : ''}" data-fx-sec="${s.id}" aria-label="${esc(s.name)}">
      <button type="button" class="fx-tag" data-fx-pick="${s.id}">${esc(s.name)}${mine.filter((x) => x.it.part === 'Whole section').map(num).join('')}</button>
      <div class="fx-art">${s.art(d, p)}</div></section>`;
  }).join('');
  highlight();
}
/* light up the section, and the part the first wheel is on */
function highlight(reveal) {
  ui.frame.querySelectorAll('.is-sel, .is-whole').forEach((el) => el.classList.remove('is-sel', 'is-whole'));
  if (!S.sel) return;
  const sec = ui.frame.querySelector(`[data-fx-sec="${S.sel.s.id}"]`);
  if (!sec) return;
  sec.classList.add('is-sel');
  let target = sec;
  if (S.sel.part === 'Whole section') sec.classList.add('is-whole');
  else {
    const part = [...sec.querySelectorAll('.fx-part')].find((el) => el.dataset.fxPart === S.sel.part);
    if (part) { part.classList.add('is-sel'); target = part; }
  }
  if (reveal) keepVisible(target);
}
/* scroll just enough that the lit part sits between the floating nav and the picker */
function keepVisible(el) {
  const r = el.getBoundingClientRect();
  const top = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-space')) || 82) + 12;
  const bottom = (ui.dock.hidden ? innerHeight : ui.dock.offsetTop) - 16;   // offsetTop ignores the slide-in animation
  if (r.top < top) scrollBy({ top: r.top - top, behavior: smooth });
  else if (r.bottom > bottom) scrollBy({ top: Math.min(r.bottom - bottom, r.top - top), behavior: smooth });
}

/* ---------- the picker: two wheels and a price ---------- */
function wheelHTML(id, label, options, on) {
  return `<div><div class="fx-cap" id="${id}-cap">${label}</div>
    <div class="fx-wheel${options.length === 1 ? ' fx-wheel--one' : ''}"><span class="fx-wheel__band" aria-hidden="true"></span>
      <ul id="${id}" role="listbox" tabindex="0" data-on="${on}" aria-labelledby="${id}-cap" aria-activedescendant="${id}-${on}">
        ${options.map((o, i) => `<li role="option" id="${id}-${i}" data-i="${i}" class="${i === on ? 'is-on' : ''}" aria-selected="${i === on}"${o.c ? ` style="--c:${o.c}" title="${esc(o.t)}"` : ''}>${o.c ? '<i aria-hidden="true"></i>' : ''}<span>${esc(o.short && innerWidth < 420 ? o.short : o.t)}</span></li>`).join('')}
      </ul></div></div>`;
}
function openPicker(s, part = 'Whole section') {
  if (S.sel && S.sel.s.id === s.id) { spinTo('fxPart', partsOf(s).indexOf(part)); return; }
  const probs = probsOf(s);
  const want = S.nextProb || (S.sel && S.sel.prob);
  const prob = probs.some((p) => p.id === want) ? want : probs[0].id;
  S.nextProb = null;
  S.sel = { s, part, prob };
  ui.dock.innerHTML = `
    <div class="fx-dock__head">
      <span class="fx-num fx-num--lg" id="fxDockNum" aria-hidden="true">${S.items.length + 1}</span>
      <div class="fx-dock__name">${esc(s.name)}<small>${esc(tmplOf(s))}${s.limited && s.id !== 'elsewhere' ? ' · ' + esc(s.limited) : ''}</small></div>
      <button type="button" class="fx-x" data-fx-act="closepick" aria-label="Close">×</button>
    </div>
    <div class="fx-wheels">
      ${wheelHTML('fxPart', s.id === 'elsewhere' ? 'Where' : 'Which part', partsOf(s).map((t) => ({ t })), partsOf(s).indexOf(part))}
      ${wheelHTML('fxProb', "What's wrong", probs, probs.findIndex((p) => p.id === prob))}
    </div>
    <div class="fx-field">
      <label for="fxNote">Note: what you see, and how it should be</label>
      <textarea class="fx-in fx-note" id="fxNote" rows="2" maxlength="300" placeholder="The title wraps to three lines. It should fit on one."></textarea>
      <div class="fx-err" id="fxNoteErr"></div>
    </div>
    <div class="fx-dock__foot">
      <div class="fx-quote" id="fxQuote" aria-live="polite"><b></b><small></small></div>
      <button type="button" class="btn fx-go" data-fx-act="add">Add to list</button>
    </div>`;
  ui.dock.setAttribute('aria-label', `What's wrong with ${s.name}`);
  ui.dock.hidden = false;
  document.body.classList.add('fx-dock-open');
  for (const id of ['fxPart', 'fxProb']) bindWheel(id);
  $('#fxPart').scrollTop = partsOf(s).indexOf(part) * ROW;
  $('#fxProb').scrollTop = probs.findIndex((p) => p.id === prob) * ROW;
  update(true);
  highlight(true);
}
function closePicker() {
  if (!S.sel && ui.dock.hidden) return;
  S.sel = null;
  ui.dock.hidden = true;
  document.body.classList.remove('fx-dock-open');
  document.body.style.paddingBottom = '';
  highlight();
}
function bindWheel(id) {
  const ul = $('#' + id);
  const count = ul.children.length;
  ul.addEventListener('scroll', () => {
    const i = Math.max(0, Math.min(count - 1, Math.round(ul.scrollTop / ROW)));
    if (+ul.dataset.on !== i) setWheel(id, i);
  }, { passive: true });
  ul.addEventListener('keydown', (e) => {
    if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); spinTo(id, e.key === 'Home' ? 0 : count - 1); return; }
    const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    spinTo(id, Math.max(0, Math.min(count - 1, (+ul.dataset.on || 0) + step)));
  });
}
const spinTo = (id, i) => $('#' + id).scrollTo({ top: i * ROW, behavior: smooth });
/* runs while the wheel is still rolling, so the store and the price follow it live */
function setWheel(id, i) {
  const ul = $('#' + id);
  ul.dataset.on = i;
  [...ul.children].forEach((li, n) => { li.classList.toggle('is-on', n === i); li.setAttribute('aria-selected', n === i); });
  ul.setAttribute('aria-activedescendant', `${id}-${i}`);
  if (id === 'fxPart') { S.sel.part = partsOf(S.sel.s)[i]; highlight(true); } else S.sel.prob = probsOf(S.sel.s)[i].id;
  update();
}
function update(first) {
  const c = candidate();
  const p = priceAll([...S.items, c]).at(-1);
  $('#fxDockNum').style.setProperty('--c', PROB[c.prob].c);
  const q = $('#fxQuote');
  const big = p.after ? 'After a look' : p.high === 0 ? 'Included' : (S.items.length ? '+' : '') + priceText(p);
  if (!first && q.firstElementChild.textContent !== big) { q.classList.remove('is-pop'); void q.offsetWidth; q.classList.add('is-pop'); }
  q.firstElementChild.textContent = big;
  q.lastElementChild.textContent = p.rule;
  $('#fxNoteErr').textContent = '';
  document.body.style.paddingBottom = ui.dock.offsetHeight + 24 + 'px';
}
function addItem() {
  const c = candidate();
  const note = $('#fxNote').value.trim();
  if (c.why === 'other' && !note) {
    $('#fxNoteErr').textContent = 'For "Something else", write a few words so I know what to look for';
    $('#fxNote').focus();
    return;
  }
  S.items.push({ ...c, note });
  S.sent = false;
  const n = S.items.length;
  const p = totals().ps[n - 1];
  closePicker();
  renderFrame();
  renderPill(true);
  toast(`Added ${n}: ${c.part === 'Whole section' ? c.crumb.split(' › ').at(-1) : c.part} · ${priceText(p)}`);
  if (!ui.list.hidden) renderList();
}

let toastTimer;
function toast(text) {
  ui.toast.textContent = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { ui.toast.textContent = ''; }, 2600);
}

/* ---------- the fix list, like a store's cart ---------- */
/* the cart button shows while the store is on screen, and everywhere once something is on the list */
function renderPill(bump) {
  const t = totals();
  ui.pill.hidden = !(S.inView || S.items.length);
  ui.pill.innerHTML = `<span class="fx-num">${S.items.length}</span>${S.items.length ? `Fix list · <b>${rangeText(t)}${t.after ? '+' : ''}</b>` : 'Your fix list'}`;
  ui.pill.setAttribute('aria-label', `Open your fix list, ${S.items.length} item${S.items.length === 1 ? '' : 's'}`);
  if (bump) { ui.pill.classList.remove('is-bump'); void ui.pill.offsetWidth; ui.pill.classList.add('is-bump'); }
}
function renderList() {
  const t = totals();
  ui.list.classList.toggle('is-empty', !S.items.length);
  ui.items.innerHTML = S.items.length ? `<ul class="fx-items">${S.items.map((it, i) => {
    const p = t.ps[i];
    const pr = PROB[it.prob];
    const whole = it.part === 'Whole section';
    const where = it.crumb.split(' › ');
    return `<li class="fx-item">
      <span class="fx-thumb" style="--c:${pr.c}" aria-hidden="true"><b>${i + 1}</b></span>
      <div>
        <b class="fx-item__name">${esc(whole ? where[1] || where[0] : it.part)}</b>
        <span class="fx-item__meta">${esc(whole ? where[0] : where.slice(0, 2).join(' › '))}</span>
        <span class="fx-item__meta">${pr.t}</span>
      </div>
      <div class="fx-item__end">
        <span class="fx-price${p.after || p.high === 0 ? ' is-soft' : ''}">${priceText(p)}</span>
        <button type="button" class="fx-remove" data-fx-del="${i}" aria-label="Remove item ${i + 1}">Remove</button>
      </div>
      <label class="fx-notefield"><span>Note</span><textarea class="fx-itemnote" data-fx-note="${i}" rows="1" maxlength="300" aria-label="Note for item ${i + 1}" placeholder="${it.prob === 'other' ? 'Needed: what you see, and how it should be' : 'What you see, and how it should be'}">${esc(it.note)}</textarea></label></li>`;
  }).join('')}</ul>` : '<p class="fx-empty">Nothing here yet. Tap a section of the example store to start.</p>';
  ui.sum.innerHTML = S.items.length ? `
    <dl class="fx-sum">
      <div><dt>Fixes</dt><dd>${S.items.length}</dd></div>
      ${t.after ? `<div><dt>Priced after I look</dt><dd>${t.after} item${t.after > 1 ? 's' : ''}</dd></div>` : ''}
      <div><dt>Time</dt><dd>About ${t.days} working day${t.days > 1 ? 's' : ''}</dd></div>
      <div class="fx-sum__total"><dt>Estimate</dt><dd><small>USD</small>${rangeText(t)}${t.after ? '+' : ''}</dd></div>
    </dl>
    <div class="fx-promise">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m7.5 12.5 3 3 6-6.5"/></svg>
      <b>Fixed price, confirmed first</b>
      <p>I check every item on your store and confirm the price before any contract.${t.high > t.low ? ` It won't go above ${money(t.high)} unless you agree.` : ''}</p>
    </div>` : '';
  ui.form.classList.toggle('is-sent', S.sent);
  ui.copy.textContent = S.copied ? 'Copied. Paste it into an Upwork message.' : 'Prefer Upwork? Copy this list for a message';
}
let captcha;
function openList() {
  closePicker();
  renderList();
  ui.list.hidden = false;
  ui.scrim.hidden = false;
  document.documentElement.classList.add('fx-locked');
  $('[data-fix-title]', ui.list).focus();
  // the spam check needs to be visible to run, so it loads the first time the list opens
  if (!captcha) captcha = mountTurnstile($('[data-turnstile]', ui.list));
}
function closeList() {
  ui.list.hidden = true;
  ui.scrim.hidden = true;
  document.documentElement.classList.remove('fx-locked');
  ui.pill.focus();
}

function listText() {
  const t = totals();
  return S.items.map((it, i) => `${i + 1}. ${it.crumb}: ${PROB[it.prob].t}${it.note ? ` ("${it.note}")` : ''} (${priceText(t.ps[i]).toLowerCase()})`).join('\n')
    + `\nEstimate: ${rangeText(t)}${t.after ? ` + ${t.after} after a look` : ''}, about ${t.days} working day${t.days > 1 ? 's' : ''}`;
}

/* screenshots: made smaller in the browser so a few of them fit in one request */
async function shrink(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1400 / bmp.width, 4200 / bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  return canvas.toDataURL('image/jpeg', 0.8);
}

const validUrl = (v) => /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(v.trim());
const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const setErr = (name, text) => { $(`[data-fix-err="${name}"]`, ui.form).textContent = text || ''; };
const setStatus = (text, state = '') => { ui.status.textContent = text; ui.status.dataset.state = state; };

async function send() {
  const f = ui.form.elements;
  const store = f.store.value.trim();
  const email = f.email.value.trim();
  setErr('store', validUrl(store) ? '' : 'Enter your store address, like yourstore.com');
  setErr('email', validEmail(email) ? '' : 'Enter an email like you@yourstore.com');
  const blank = S.items.findIndex((it) => it.prob === 'other' && !it.note.trim());
  setErr('notes', blank > -1 ? `Item ${blank + 1} needs a few words so I know what to look for` : '');
  if (blank > -1) return $(`[data-fx-note="${blank}"]`, ui.list).focus();
  if (!validUrl(store)) return f.store.focus();
  if (!validEmail(email)) return f.email.focus();

  const check = await (captcha || (captcha = mountTurnstile($('[data-turnstile]', ui.list))));
  if (check.enabled && !check.token()) {
    setStatus('Checking…');
    if (!(await check.waitToken())) { setStatus('Please complete the security check above.', 'error'); return; }
  }
  const t = totals();
  const payload = {
    kind: 'fixlist',
    email,
    store: /^[a-z][a-z0-9+.-]*:\/\//i.test(store) ? store : `https://${store}`,
    notes: f.notes.value.trim(),
    company: f.company.value,
    turnstile: check.token(),
    fixlist: {
      items: S.items.map((it, i) => ({ n: i + 1, where: it.crumb, problem: PROB[it.prob].t, note: it.note, price: priceText(t.ps[i]), rule: t.ps[i].rule })),
      estimate: rangeText(t), after: t.after, days: t.days,
    },
    shots: S.shots,
  };
  const btn = $('[data-fix-send]', ui.form);
  btn.disabled = true;
  setStatus('Sending…');
  try {
    const res = await fetch('/api/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) throw new Error(body.error || `HTTP ${res.status}`);
    S.sent = true;
    setStatus('');
    $('[data-fix-done]', ui.form).textContent = `Sent. I'll look at your store and reply to ${email} with every item confirmed and a fixed price, usually within one working day.`;
    renderList();
  } catch (err) {
    console.error(err);
    const mailto = `mailto:${MAIL_TO}?subject=${encodeURIComponent('Fix list')}&body=${encodeURIComponent(`Store: ${store}\n\n${listText()}`)}`;
    ui.status.dataset.state = 'error';
    ui.status.innerHTML = `Couldn't send automatically. <a href="${mailto}">Email the list to ${MAIL_TO}</a> instead.`;
  } finally {
    btn.disabled = false;
    check.reset(); // tokens are single-use
  }
}

/* ---------- start (only on the page that has the store) ---------- */
if (root) start();

function start() {
  Object.assign(ui, {
    tabs: $('[data-fix-tabs]', root), frame: $('[data-fix-frame]', root), legend: $('[data-fix-legend]', root),
    dock: $('[data-fix-dock]'), toast: $('[data-fix-toast]'), pill: $('[data-fix-pill]'),
    scrim: $('[data-fix-scrim]'), list: $('[data-fix-list]'),
  });
  Object.assign(ui, {
    items: $('[data-fix-items]', ui.list), sum: $('[data-fix-sum]', ui.list), form: $('[data-fix-form]', ui.list),
    status: $('[data-fix-status]', ui.list), shots: $('[data-fix-shots]', ui.list), shotsText: $('[data-fix-shots-text]', ui.list),
    copy: $('[data-fix-copy]', ui.list), copybox: $('[data-fix-copybox]', ui.list),
  });
  document.addEventListener('click', (e) => {
    const li = e.target.closest('.fx-wheel li');
    if (li) { spinTo(li.parentElement.id, +li.dataset.i); return; }
    /* links elsewhere on the page: open a page of the store, or start with a problem picked (Starter offers) */
    const link = e.target.closest('[data-fix-page], [data-fix-prob]');
    if (link) {
      if (link.dataset.fixPage && PAGES[link.dataset.fixPage]) { closePicker(); S.page = link.dataset.fixPage; renderTabs(); renderFrame(); }
      if (link.dataset.fixProb) { S.nextProb = link.dataset.fixProb; toast(`Now tap the part that needs it: "${PROB[S.nextProb].t}" is picked`); }
      return;
    }
    const t = e.target.closest('[data-fx-tab], [data-fx-pick], [data-fx-part], [data-fx-del], [data-fx-act]');
    if (t) {
      const d = t.dataset;
      if (d.fxTab) { closePicker(); S.page = d.fxTab; renderTabs(); renderFrame(); return; }
      if (d.fxPick) { openPicker(findSection(d.fxPick)); return; }
      if (d.fxPart) { openPicker(findSection(t.closest('[data-fx-sec]').dataset.fxSec), d.fxPart); return; }
      if (d.fxDel) { S.items.splice(+d.fxDel, 1); S.sent = false; renderList(); renderFrame(); renderPill(); return; }
      const a = d.fxAct;
      if (a === 'closepick') closePicker();
      else if (a === 'add') addItem();
      else if (a === 'elsewhere') openPicker(ELSEWHERE);
      else if (a === 'openlist') openList();
      else if (a === 'closelist') closeList();
      else if (a === 'send') send();
      else if (a === 'copy') {
        const text = listText();
        const fallback = () => { ui.copybox.hidden = false; ui.copybox.value = text; ui.copybox.select(); };
        try { navigator.clipboard.writeText(text).then(() => { S.copied = true; renderList(); }, fallback); } catch { fallback(); }
      }
      return;
    }
    /* a tap anywhere else on a section opens it with the whole section picked */
    const sec = e.target.closest('[data-fx-sec]');
    if (sec) openPicker(findSection(sec.dataset.fxSec));
  });
  document.addEventListener('input', (e) => {
    if (e.target.dataset.fxNote) { S.items[+e.target.dataset.fxNote].note = e.target.value; S.copied = false; }
  });
  ui.shots.addEventListener('change', async () => {
    const files = [...ui.shots.files].slice(0, MAX_SHOTS);
    ui.shotsText.textContent = 'Preparing screenshots…';
    S.shots = (await Promise.all(files.map((f) => shrink(f).catch(() => null)))).filter(Boolean);
    ui.shotsText.textContent = S.shots.length ? `${S.shots.length} screenshot${S.shots.length > 1 ? 's' : ''} attached · change` : 'Attach screenshots (optional)';
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!ui.list.hidden) closeList();
    else if (S.sel) closePicker();
  });
  wide.addEventListener('change', () => { renderFrame(); if (S.sel) highlight(true); });

  /* the picker belongs to the store: it closes when the store scrolls away */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => {
      S.inView = en.isIntersecting;
      if (!S.inView) closePicker();
      renderPill();
    }).observe(root);
  } else S.inView = true;

  ui.legend.innerHTML = '<li class="fx-legend__cap">Colours show the problem:</li>' + PROBS.map((p) => `<li style="--c:${p.c}"><i aria-hidden="true"></i>${p.t}</li>`).join('');
  renderTabs();
  renderFrame();
  renderPill();
}
