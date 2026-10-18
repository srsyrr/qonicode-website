/* Playground — paper cards you drag onto a page frame.
   Every card type waits in its own spot on the desk; take one onto the page and a fresh one appears.
   Positions are stored in frame units (see pieces.js) and drawn in px. */
import { FRAME, TYPES, SUPPLY, PAGES, buildLayout } from './pieces.js';
import { openDialog, triggerDownload } from './dialog.js';

const STORE_KEY = 'qonicode-desk-v2';
const DRAG_THRESHOLD = 4;
const DESK_BG = '#EFE7D8';
const SLOT_TILT = [-5, 4, -3, 6, -4, 3, -6, 5, -2, 4, -5];

/* Desk sizes (in frame units) for wide and narrow screens, with one slot per card type. */
const DESKS = {
  wide: {
    w: 200, h: 176, ox: 50, oy: 8, miniScale: 1,
    slots: [
      ...[10, 36, 62, 88, 114, 140].map((y) => ({ x: -25, y })),
      ...[10, 36, 62, 88, 114].map((y) => ({ x: 125, y })),
    ],
  },
  narrow: {
    w: 110, h: 244, ox: 5, oy: 4, miniScale: 0.9,
    slots: [171, 190, 209, 228].flatMap((y) => [17, 50, 83].map((x) => ({ x, y }))).slice(0, SUPPLY.length),
  },
};

const mq = window.matchMedia('(max-width: 749px)');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const half = (v) => Math.round(v * 2) / 2;
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

class Playground {
  constructor(root) {
    this.root = root;
    this.desk = root.querySelector('[data-desk]');
    this.frame = root.querySelector('[data-frame]');
    this.label = root.querySelector('[data-preset-label]');
    this.live = root.querySelector('[data-live]');
    this.pageButtons = [...root.querySelectorAll('[data-page]')];
    this.pieces = [];
    this.uid = 0;
    this.topZ = 20;
    this.selected = null;
    this.drag = null;
    this.store = this.load();
    this.page = PAGES[this.store.page] ? this.store.page : 'home';

    this.measure();
    this.fillSupply();
    this.loadPage(this.page, { animate: false });
    this.bind();
  }

  /* ---------- geometry ---------- */

  get cfg() { return DESKS[this.mode]; }
  get pagePieces() { return this.pieces.filter((pc) => !pc.supply); }

  measure() {
    const prevMode = this.mode;
    this.mode = mq.matches ? 'narrow' : 'wide';
    const border = this.desk.offsetWidth - this.desk.clientWidth;
    this.u = this.desk.clientWidth / this.cfg.w;
    this.desk.style.setProperty('--u', `${this.u}px`);
    this.desk.style.height = `${this.cfg.h * this.u + border}px`;
    Object.assign(this.frame.style, {
      left: `${this.cfg.ox * this.u}px`, top: `${this.cfg.oy * this.u}px`,
      width: `${FRAME.w * this.u}px`, height: `${FRAME.h * this.u}px`,
    });
    this.drawCaptions();
    if (prevMode && prevMode !== this.mode) this.pieces.filter((pc) => pc.supply).forEach((pc) => this.toSlot(pc));
  }

  /* Card names are written on the desk, under each card's spot. */
  drawCaptions() {
    this.desk.querySelectorAll('.desk__caption').forEach((el) => el.remove());
    SUPPLY.forEach((type, i) => {
      const slot = this.cfg.slots[i];
      const [, h] = this.miniSize(type);
      const el = document.createElement('span');
      el.className = 'desk__caption';
      el.textContent = TYPES[type].label;
      el.style.left = `${(this.cfg.ox + slot.x) * this.u}px`;
      el.style.top = `${(this.cfg.oy + slot.y + h / 2 + 1.4) * this.u}px`;
      this.desk.insertBefore(el, this.frame);
    });
  }

  draw(piece) {
    const { el } = piece;
    const { ox, oy } = this.cfg;
    el.style.left = `${(ox + piece.x) * this.u}px`;
    el.style.top = `${(oy + piece.y) * this.u}px`;
    el.style.width = `${piece.w * this.u}px`;
    el.style.height = `${piece.h * this.u}px`;
    el.style.setProperty('--h', `${piece.h * this.u}px`);
    // Sections are containers: they stay underneath the other cards unless being dragged.
    el.style.zIndex = piece.type === 'section' && !piece.supply ? 2 : piece.z;
    el.style.setProperty('--r', piece.r);
    el.classList.toggle('piece--supply', piece.supply);
    el.setAttribute('aria-label', `${TYPES[piece.type].label} card${piece.supply ? ' (on the desk — drag it onto the page)' : ''}`);
  }

  miniSize(type) {
    const [w, h] = TYPES[type].mini;
    const s = this.cfg.miniScale;
    return [w * s, h * s];
  }

  /* Put a supply card back on its spot. */
  toSlot(piece) {
    const i = SUPPLY.indexOf(piece.type);
    const slot = this.cfg.slots[i];
    const [w, h] = this.miniSize(piece.type);
    Object.assign(piece, { w, h, x: slot.x - w / 2, y: slot.y - h / 2, r: SLOT_TILT[i % SLOT_TILT.length], supply: true });
    this.draw(piece);
  }

  clampToDesk(piece) {
    const { w: dw, h: dh, ox, oy } = this.cfg;
    piece.x = clamp(piece.x, -ox, dw - ox - piece.w);
    piece.y = clamp(piece.y, -oy, dh - oy - piece.h);
  }

  /* ---------- pieces ---------- */

  createPiece(spec) {
    const type = TYPES[spec.type];
    const el = document.createElement('div');
    el.className = `piece piece--${spec.type}`;
    el.tabIndex = 0;
    el.style.setProperty('--pc', type.color);
    el.innerHTML = `<div class="piece__paper">${type.art()}</div>`
      + '<button type="button" class="piece__del" aria-label="Remove card" tabindex="-1">×</button>'
      + '<span class="piece__resize" aria-hidden="true"></span>';
    const piece = { id: `p${++this.uid}`, type: spec.type, x: 0, y: 0, w: type.size[0], h: type.size[1], r: 0, supply: false, z: ++this.topZ, text: '', ...spec, el };
    const input = el.querySelector('.piece__input');
    if (input) {
      input.value = piece.text || '';
      input.tabIndex = -1;
      input.addEventListener('input', () => { piece.text = input.value.slice(0, 20); this.markEdited(); });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); input.blur(); el.focus(); } e.stopPropagation(); });
      input.addEventListener('blur', () => el.classList.remove('is-editing'));
    }
    this.pieces.push(piece);
    this.desk.appendChild(el);
    return piece;
  }

  fillSupply() {
    SUPPLY.forEach((type) => {
      if (this.pieces.some((pc) => pc.supply && pc.type === type)) return;
      this.toSlot(this.createPiece({ type, supply: true }));
    });
  }

  async respawn(type) {
    const pc = this.createPiece({ type, supply: true });
    pc.el.classList.add('is-entering');
    this.toSlot(pc);
    await nextFrame();
    pc.el.classList.remove('is-entering');
  }

  removePiece(piece) {
    this.pieces = this.pieces.filter((pc) => pc !== piece);
    if (this.selected === piece) this.selected = null;
    piece.el.classList.add('is-leaving');
    setTimeout(() => piece.el.remove(), reduceMotion.matches ? 0 : 260);
  }

  select(piece) {
    if (this.selected && this.selected !== piece) this.selected.el.classList.remove('is-selected');
    this.selected = piece;
    if (piece) piece.el.classList.add('is-selected');
  }

  startEditing(piece) {
    const input = piece.el.querySelector('.piece__input');
    if (!input || piece.supply) return;
    piece.el.classList.add('is-editing');
    input.focus();
    input.select();
  }

  /* A card was dropped. On the page it straightens up (supply cards grow to full size and get replaced);
     anywhere else on the desk it goes away (page cards) or back to its spot (supply cards). */
  settle(piece) {
    const cx = piece.x + piece.w / 2;
    const cy = piece.y + piece.h / 2;
    const onPage = cx >= 0 && cx <= FRAME.w && cy >= FRAME.top && cy <= FRAME.h;
    if (!onPage) {
      if (piece.supply) { this.toSlot(piece); return 'back'; }
      this.removePiece(piece);
      return 'removed';
    }
    const wasSupply = piece.supply;
    if (wasSupply) {
      [piece.w, piece.h] = TYPES[piece.type].size;
      piece.x = cx - piece.w / 2;
      piece.y = cy - piece.h / 2;
      piece.supply = false;
      this.respawn(piece.type);
    }
    piece.r = 0;
    piece.x = clamp(half(piece.x), 0, FRAME.w - piece.w);
    piece.y = clamp(half(piece.y), FRAME.top, FRAME.h - piece.h);
    this.draw(piece);
    return wasSupply ? 'added' : 'moved';
  }

  /* ---------- pages, presets, shuffle ---------- */

  get pageState() {
    if (!this.store.layouts[this.page]) this.store.layouts[this.page] = { preset: 0, name: PAGES[this.page].presets[0].name, edited: false, pieces: null };
    return this.store.layouts[this.page];
  }

  loadPage(page, { animate = true } = {}) {
    this.page = page;
    this.store.page = page;
    this.pageButtons.forEach((b) => {
      const on = b.dataset.page === page;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-checked', String(on));
    });
    const st = this.pageState;
    const valid = Array.isArray(st.pieces) && st.pieces.length && st.pieces.every((s) => TYPES[s.type]);
    if (valid) this.applyLayout(st.pieces, st.name, { animate, keepEdited: true });
    else this.applyPreset(st.preset || 0, { animate });
  }

  applyPreset(index, opts = {}) {
    const presets = PAGES[this.page].presets;
    const st = this.pageState;
    st.preset = (index + presets.length) % presets.length;
    const preset = presets[st.preset];
    this.applyLayout(buildLayout(preset.rows), preset.name, opts);
  }

  shuffle() {
    this.applyLayout(buildLayout(PAGES[this.page].shuffle()), 'Shuffled');
    this.announce('Shuffled a new layout');
  }

  /* Re-use page cards of the same type so they glide into place; new ones fly in from their desk spot. */
  async applyLayout(specs, name, { animate = true, keepEdited = false } = {}) {
    if (!animate) this.desk.classList.add('no-anim');
    this.select(null);
    const pool = new Map();
    this.pagePieces.forEach((pc) => {
      if (!pool.has(pc.type)) pool.set(pc.type, []);
      pool.get(pc.type).push(pc);
    });

    const entering = [];
    let z = 20;
    specs.forEach((spec) => {
      let piece = pool.get(spec.type)?.shift();
      if (!piece) {
        piece = this.createPiece({ type: spec.type });
        // start on its desk spot, then fly to the page
        const slot = this.cfg.slots[SUPPLY.indexOf(spec.type)];
        const [mw, mh] = this.miniSize(spec.type);
        Object.assign(piece, { x: slot.x - mw / 2, y: slot.y - mh / 2, w: mw, h: mh, r: 0 });
        this.draw(piece);
        entering.push(piece);
      }
      const text = String(spec.text || '').slice(0, 20);
      Object.assign(piece, { x: +spec.x, y: +spec.y, w: +spec.w, h: +spec.h, r: 0, supply: false, z: z++, text });
      const input = piece.el.querySelector('.piece__input');
      if (input) input.value = text;
    });
    for (const rest of pool.values()) rest.forEach((pc) => this.removePiece(pc));
    this.topZ = z + 20;
    this.pieces.filter((pc) => pc.supply).forEach((pc) => { pc.z = ++this.topZ; this.draw(pc); });

    if (animate && entering.length) await nextFrame();
    this.pagePieces.forEach((pc) => this.draw(pc));

    const st = this.pageState;
    st.name = name;
    st.edited = keepEdited ? !!st.edited : false;
    this.updateLabel();
    this.save();
    await nextFrame();
    this.desk.classList.remove('no-anim');
  }

  updateLabel() {
    const st = this.pageState;
    const presets = PAGES[this.page].presets;
    const shuffled = st.name === 'Shuffled';
    const num = shuffled ? '??' : String(st.preset + 1).padStart(2, '0');
    const total = String(presets.length).padStart(2, '0');
    const title = shuffled ? 'Shuffled layout' : st.name;
    this.label.innerHTML = `<b>${num} / ${total}</b><span>${title}${st.edited ? ' · edited' : ''}</span>`;
  }

  markEdited() {
    const st = this.pageState;
    if (!st.edited) { st.edited = true; this.updateLabel(); }
    this.save();
  }

  /* ---------- persistence ---------- */

  load() {
    const empty = { v: 2, page: 'home', layouts: {} };
    try {
      const data = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      return data && data.v === 2 && data.layouts ? data : empty;
    } catch (e) {
      return empty;
    }
  }

  save() {
    this.pageState.pieces = this.pagePieces.map(({ type, x, y, w, h, text }) => ({ type, x, y, w, h, ...(text ? { text } : {}) }));
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(this.store)); } catch (e) { /* private mode — ignore */ }
    }, 150);
  }

  /* ---------- events ---------- */

  bind() {
    this.onMove = this.onMove.bind(this);
    this.onUp = this.onUp.bind(this);
    this.desk.addEventListener('pointerdown', (e) => this.onDown(e));
    this.desk.addEventListener('keydown', (e) => this.onKey(e));
    this.desk.addEventListener('click', (e) => {
      const del = e.target.closest('.piece__del');
      if (!del) return;
      const pc = this.find(del.closest('.piece'));
      if (pc) { this.removePiece(pc); this.markEdited(); this.announce('Card removed'); }
    });
    this.desk.addEventListener('focusin', (e) => {
      const pc = this.find(e.target.closest('.piece'));
      if (pc) this.select(pc);
    });

    const on = (sel, fn) => this.root.querySelector(sel)?.addEventListener('click', fn);
    on('[data-action="prev"]', () => this.applyPreset(this.pageState.preset - 1));
    on('[data-action="next"]', () => this.applyPreset(this.pageState.preset + 1));
    on('[data-action="shuffle"]', () => this.shuffle());
    on('[data-action="save"]', (e) => this.downloadPNG(e.currentTarget));
    on('[data-action="request"]', () => this.openRequest());
    this.pageButtons.forEach((b) => b.addEventListener('click', () => { if (b.dataset.page !== this.page) this.loadPage(b.dataset.page); }));

    let t;
    window.addEventListener('resize', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        this.desk.classList.add('no-anim');
        this.measure();
        this.pieces.forEach((pc) => this.draw(pc));
        requestAnimationFrame(() => this.desk.classList.remove('no-anim'));
      }, 120);
    });
  }

  find(el) { return el ? this.pieces.find((pc) => pc.el === el) : null; }

  onDown(e) {
    if (e.button !== 0 || this.drag) return;
    const piece = this.find(e.target.closest('.piece'));
    if (!piece) { this.select(null); return; }
    if (e.target.closest('.piece__del')) return;
    if (piece.el.classList.contains('is-editing') && e.target.closest('.piece__input')) return;
    e.preventDefault();
    this.select(piece);
    const resizing = !piece.supply && !!e.target.closest('.piece__resize');
    this.drag = { piece, resizing, moved: false, pointerId: e.pointerId, sx: e.clientX, sy: e.clientY, x: piece.x, y: piece.y, w: piece.w, h: piece.h };
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
  }

  onMove(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    const dx = (e.clientX - d.sx) / this.u;
    const dy = (e.clientY - d.sy) / this.u;
    const pc = d.piece;
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < DRAG_THRESHOLD) return;
      d.moved = true;
      pc.z = ++this.topZ;
      pc.el.style.zIndex = 9999;
      pc.el.classList.add(d.resizing ? 'is-resizing' : 'is-dragging');
    }
    e.preventDefault();
    if (d.resizing) {
      const ratio = TYPES[pc.type].ratio;
      pc.w = clamp(d.w + dx, 4, FRAME.w - pc.x);
      pc.h = ratio ? pc.w / ratio : clamp(d.h + dy, 3, FRAME.h - pc.y);
    } else {
      pc.x = d.x + dx;
      pc.y = d.y + dy;
      this.clampToDesk(pc);
    }
    this.draw(pc);
    pc.el.style.zIndex = 9999;
  }

  onUp(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    this.drag = null;
    const pc = d.piece;
    pc.el.classList.remove('is-dragging', 'is-resizing');
    if (!d.moved) {
      this.draw(pc);
      if (TYPES[pc.type].editable) this.startEditing(pc);
      return;
    }
    if (d.resizing) {
      pc.w = half(pc.w);
      pc.h = TYPES[pc.type].ratio ? pc.w / TYPES[pc.type].ratio : half(pc.h);
      this.draw(pc);
      this.markEdited();
      return;
    }
    const result = this.settle(pc);
    if (result !== 'back') this.markEdited();
    if (result === 'added') this.announce(`${TYPES[pc.type].label} added to the page`);
    if (result === 'removed') this.announce('Card removed');
  }

  onKey(e) {
    const pc = this.find(e.target.closest('.piece'));
    if (!pc || e.target !== pc.el) return;
    const step = e.shiftKey ? 5 : 1;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key] && !pc.supply) {
      e.preventDefault();
      pc.x = clamp(pc.x + moves[e.key][0], 0, FRAME.w - pc.w);
      pc.y = clamp(pc.y + moves[e.key][1], FRAME.top, FRAME.h - pc.h);
      this.draw(pc);
      this.markEdited();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && !pc.supply) {
      e.preventDefault();
      this.removePiece(pc);
      this.markEdited();
      this.announce('Card removed');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (pc.supply) {
        // Enter on a desk card puts it in the middle of the page.
        pc.x = FRAME.w / 2 - pc.w / 2;
        pc.y = FRAME.h / 2 - pc.h / 2;
        pc.z = ++this.topZ;
        this.settle(pc);
        this.markEdited();
        this.announce(`${TYPES[pc.type].label} added to the page`);
      } else if (TYPES[pc.type].editable) {
        this.startEditing(pc);
      }
    }
  }

  announce(msg) { if (this.live) this.live.textContent = msg; }

  /* ---------- PNG export ---------- */

  async loadExporter() {
    if (window.htmlToImage) return window.htmlToImage;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = new URL('../vendor/html-to-image.js', import.meta.url).href;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Could not load the image exporter'));
      document.head.appendChild(s);
    });
    return window.htmlToImage;
  }

  /* Only the regular latin Archivo face is used on the page cards. Embedding every Google Fonts
     subset makes the export ~20x slower, so keep just that one @font-face. */
  async fontCSS(htmlToImage) {
    if (this._fontCSS != null) return this._fontCSS;
    try {
      const all = await htmlToImage.getFontEmbedCSS(this.desk);
      const faces = (all.match(/@font-face\s*{[^}]*}/g) || [])
        .filter((f) => /font-family:\s*["']?Archivo/i.test(f) && /font-style:\s*normal/i.test(f) && /U\+0-FF,/i.test(f));
      this._fontCSS = [...new Set(faces)].join('\n');
    } catch (e) {
      this._fontCSS = '';
    }
    return this._fontCSS;
  }

  /* Renders the page frame (plus a little desk around it) to a canvas with a caption strip. */
  async renderCanvas() {
    const htmlToImage = await this.loadExporter();
    if (document.fonts) await document.fonts.ready;
    const prevSelected = this.selected;
    this.select(null);
    this.desk.classList.add('is-exporting', 'no-anim');
    try {
      const frameW = FRAME.w * this.u;
      const scale = clamp(1200 / frameW, 1.5, 4);
      const full = await htmlToImage.toCanvas(this.desk, {
        pixelRatio: scale,
        backgroundColor: DESK_BG,
        fontEmbedCSS: await this.fontCSS(htmlToImage),
        filter: (node) => !(node.classList && (node.classList.contains('piece__del') || node.classList.contains('piece__resize'))),
      });
      const border = this.desk.clientLeft;
      const pad = 3 * this.u;
      const sx = Math.max(0, (border + this.cfg.ox * this.u - pad) * scale);
      const sy = Math.max(0, (border + this.cfg.oy * this.u - pad) * scale);
      const sw = Math.min(full.width - sx, (frameW + pad * 2) * scale);
      const sh = Math.min(full.height - sy, (FRAME.h * this.u + pad * 2) * scale);

      const cap = Math.round(sw * 0.08);
      const out = document.createElement('canvas');
      out.width = Math.round(sw);
      out.height = Math.round(sh + cap);
      const ctx = out.getContext('2d');
      ctx.fillStyle = DESK_BG;
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(full, sx, sy, sw, sh, 0, 0, sw, sh);
      ctx.fillStyle = '#111111';
      ctx.fillRect(0, sh, out.width, cap);
      ctx.textBaseline = 'middle';
      const st = this.pageState;
      ctx.fillStyle = '#2FD67B';
      ctx.font = `800 ${Math.round(cap * 0.3)}px Archivo, sans-serif`;
      const title = st.name === 'Shuffled' ? 'shuffled layout' : st.name;
      ctx.fillText(`${PAGES[this.page].label} — ${title}${st.edited ? ' (edited)' : ''}`.toUpperCase(), cap * 0.4, sh + cap / 2);
      ctx.fillStyle = '#F5EFE3';
      ctx.font = `900 ${Math.round(cap * 0.3)}px Archivo, sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText('QONICODE.TECH', out.width - cap * 0.4, sh + cap / 2);
      return out;
    } finally {
      this.desk.classList.remove('is-exporting');
      requestAnimationFrame(() => this.desk.classList.remove('no-anim'));
      if (prevSelected && this.pieces.includes(prevSelected)) this.select(prevSelected);
    }
  }

  async downloadPNG(button) {
    if (button) button.disabled = true;
    try {
      const canvas = await this.renderCanvas();
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
      triggerDownload(blob, `qonicode-${this.page}-layout.png`);
      this.announce('Layout saved as PNG');
    } catch (err) {
      console.error(err);
      alert('Sorry, the image could not be created in this browser.');
    } finally {
      if (button) button.disabled = false;
    }
  }

  openRequest() {
    openDialog('request', {
      render: () => this.renderCanvas(),
      layout: () => ({
        page: PAGES[this.page].label,
        name: this.pageState.name,
        edited: this.pageState.edited,
        pieces: this.pagePieces.map(({ type, x, y, w, h, text }) => ({ type, x, y, w, h, ...(text ? { text } : {}) })),
      }),
      filename: `qonicode-${this.page}-layout.png`,
    });
  }
}

const root = document.getElementById('playground');
if (root) window.playground = new Playground(root);
