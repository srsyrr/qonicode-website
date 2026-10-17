/* Layout desk — paper pieces you drag onto a page frame.
   Positions are stored in frame units (see pieces.js) and drawn in px. */
import { FRAME, TYPES, SUPPLY, PRESETS, buildLayout, randomRows } from './pieces.js';

const STORE_KEY = 'qonicode-desk-v1';
const MAIL_TO = 'qonita@qonicode.tech';
const REQUEST_URL = '/api/request';
const DRAG_THRESHOLD = 4;
const DESK_BG = '#EFE7D8';

/* Desk sizes (in frame units) for wide and narrow screens, with the slots loose pieces rest in. */
const DESKS = {
  wide: {
    w: 200, h: 176, ox: 50, oy: 8, miniScale: 1,
    // left column, then right column
    slots: [-25, 125].flatMap((x) => [12, 38, 64, 90, 116, 142].map((y) => ({ x, y }))),
  },
  narrow: {
    w: 110, h: 244, ox: 5, oy: 4, miniScale: 0.86,
    slots: [172, 190, 208, 226].flatMap((y) => [16, 50, 84].map((x) => ({ x, y }))),
  },
};

const mq = window.matchMedia('(max-width: 749px)');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const half = (v) => Math.round(v * 2) / 2;
const tilt = () => Math.round((Math.random() * 14 - 7) * 10) / 10;
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

class LayoutDesk {
  constructor(root) {
    this.root = root;
    this.desk = root.querySelector('[data-desk]');
    this.frame = root.querySelector('[data-frame]');
    this.label = root.querySelector('[data-preset-label]');
    this.live = root.querySelector('[data-live]');
    this.pieces = [];
    this.uid = 0;
    this.topZ = 1;
    this.selected = null;
    this.drag = null;
    this.presetIndex = 0;
    this.layoutName = PRESETS[0].name;
    this.edited = false;

    this.buildTray();
    this.measure();
    if (!this.restore()) this.applyPreset(0, { animate: false });
    this.bind();
  }

  /* ---------- geometry ---------- */

  get cfg() { return DESKS[this.mode]; }

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
    if (prevMode && prevMode !== this.mode) this.reslotLoose();
  }

  draw(piece) {
    const { el } = piece;
    const { ox, oy } = this.cfg;
    el.style.left = `${(ox + piece.x) * this.u}px`;
    el.style.top = `${(oy + piece.y) * this.u}px`;
    el.style.width = `${piece.w * this.u}px`;
    el.style.height = `${piece.h * this.u}px`;
    el.style.zIndex = piece.z;
    el.style.setProperty('--r', piece.r);
    el.classList.toggle('piece--loose', piece.loose);
    el.setAttribute('aria-label', `${TYPES[piece.type].label} piece, ${piece.loose ? 'on the desk' : 'on the page'}`);
  }

  miniSize(type) {
    const [w, h] = TYPES[type].mini;
    const s = this.cfg.miniScale;
    return [w * s, h * s];
  }

  /* A desk slot for a loose piece: the one for its type if free, otherwise the emptiest. */
  pickSlot(type, taken = new Set()) {
    const slots = this.cfg.slots;
    const own = SUPPLY.indexOf(type);
    const occupied = (slot) => this.pieces.some((pc) => pc.loose && !pc.leaving
      && Math.abs(pc.x + pc.w / 2 - slot.x) < 8 && Math.abs(pc.y + pc.h / 2 - slot.y) < 6);
    if (own >= 0 && slots[own] && !taken.has(own) && !occupied(slots[own])) { taken.add(own); return slots[own]; }
    const free = slots.findIndex((s, i) => !taken.has(i) && !occupied(s));
    const i = free >= 0 ? free : Math.floor(Math.random() * slots.length);
    taken.add(i);
    return slots[i];
  }

  placeLoose(piece, slot) {
    const [w, h] = this.miniSize(piece.type);
    const jitter = () => Math.random() * 3 - 1.5;
    Object.assign(piece, { w, h, x: slot.x - w / 2 + jitter(), y: slot.y - h / 2 + jitter(), r: tilt(), loose: true });
    this.clampToDesk(piece);
  }

  clampToDesk(piece) {
    const { w: dw, h: dh, ox, oy } = this.cfg;
    piece.x = clamp(piece.x, -ox, dw - ox - piece.w);
    piece.y = clamp(piece.y, -oy, dh - oy - piece.h);
  }

  reslotLoose() {
    const taken = new Set();
    this.pieces.filter((pc) => pc.loose).forEach((pc) => { this.placeLoose(pc, this.pickSlot(pc.type, taken)); this.draw(pc); });
  }

  /* ---------- pieces ---------- */

  createPiece(spec) {
    const type = TYPES[spec.type];
    const el = document.createElement('div');
    el.className = `piece piece--${spec.type}`;
    el.tabIndex = 0;
    el.style.setProperty('--pc', type.color);
    el.innerHTML = `<div class="piece__paper">${type.art()}</div>`
      + `<span class="piece__tag" aria-hidden="true">${type.label}</span>`
      + '<button type="button" class="piece__del" aria-label="Remove piece" tabindex="-1">×</button>'
      + '<span class="piece__resize" aria-hidden="true"></span>';
    const piece = { id: `p${++this.uid}`, type: spec.type, x: 0, y: 0, w: type.size[0], h: type.size[1], r: 0, loose: false, z: ++this.topZ, ...spec, el };
    el.dataset.id = piece.id;
    this.pieces.push(piece);
    this.desk.appendChild(el);
    return piece;
  }

  async addFromTray(type) {
    const piece = this.createPiece({ type });
    this.placeLoose(piece, this.pickSlot(type));
    piece.el.classList.add('is-entering');
    this.draw(piece);
    await nextFrame();
    piece.el.classList.remove('is-entering');
    this.select(piece);
    piece.el.focus({ preventScroll: true });
    this.markEdited();
    this.announce(`${TYPES[type].label} piece added to the desk`);
  }

  removePiece(piece) {
    piece.leaving = true;
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

  /* Dropped somewhere: on the page it straightens up (and grows to full size), on the desk it shrinks back. */
  settle(piece) {
    const cx = piece.x + piece.w / 2;
    const cy = piece.y + piece.h / 2;
    const onPage = cx >= 0 && cx <= FRAME.w && cy >= 0 && cy <= FRAME.h;
    if (onPage) {
      if (piece.loose) {
        [piece.w, piece.h] = TYPES[piece.type].size;
        piece.x = cx - piece.w / 2;
        piece.y = cy - piece.h / 2;
      }
      piece.loose = false;
      piece.r = 0;
      piece.x = clamp(half(piece.x), 0, FRAME.w - piece.w);
      piece.y = clamp(half(piece.y), FRAME.top, FRAME.h - piece.h);
    } else if (!piece.loose) {
      [piece.w, piece.h] = this.miniSize(piece.type);
      piece.x = cx - piece.w / 2;
      piece.y = cy - piece.h / 2;
      piece.loose = true;
      piece.r = tilt();
      this.clampToDesk(piece);
    }
    this.draw(piece);
  }

  /* ---------- layouts ---------- */

  applyPreset(index, opts) {
    this.presetIndex = (index + PRESETS.length) % PRESETS.length;
    const preset = PRESETS[this.presetIndex];
    this.applyLayout(buildLayout(preset.rows), preset.name, opts);
  }

  shuffle() {
    this.applyLayout(buildLayout(randomRows()), 'Shuffled', {});
    this.announce('Shuffled a new layout');
  }

  /* Re-use pieces of the same type so they glide into place; keep one loose piece of every type on the desk. */
  async applyLayout(specs, name, { animate = true } = {}) {
    if (!animate) this.desk.classList.add('no-anim');
    this.select(null);
    const pool = new Map();
    [...this.pieces].sort((a, b) => a.loose - b.loose).forEach((pc) => {
      if (!pool.has(pc.type)) pool.set(pc.type, []);
      pool.get(pc.type).push(pc);
    });

    const entering = [];
    let z = 1;
    specs.forEach((spec) => {
      let piece = pool.get(spec.type)?.shift();
      if (!piece) { piece = this.createPiece(spec); entering.push(piece); }
      Object.assign(piece, { x: spec.x, y: spec.y, w: spec.w, h: spec.h, r: 0, loose: false, z: z++ });
    });

    const taken = new Set();
    const covered = new Set();
    for (const leftovers of pool.values()) {
      leftovers.forEach((pc) => {
        if (covered.has(pc.type)) { this.removePiece(pc); return; }
        covered.add(pc.type);
        this.placeLoose(pc, this.pickSlot(pc.type, taken));
        pc.z = 100 + z++;
      });
    }
    SUPPLY.filter((t) => !covered.has(t)).forEach((type) => {
      const pc = this.createPiece({ type });
      this.placeLoose(pc, this.pickSlot(type, taken));
      pc.z = 100 + z++;
      entering.push(pc);
    });
    this.topZ = 100 + z;

    entering.forEach((pc) => animate && pc.el.classList.add('is-entering'));
    this.pieces.forEach((pc) => this.draw(pc));
    this.layoutName = name;
    this.edited = false;
    this.updateLabel();
    this.save();

    await nextFrame();
    entering.forEach((pc) => pc.el.classList.remove('is-entering'));
    this.desk.classList.remove('no-anim');
  }

  updateLabel() {
    const shuffled = this.layoutName === 'Shuffled';
    const num = shuffled ? '??' : String(this.presetIndex + 1).padStart(2, '0');
    const total = String(PRESETS.length).padStart(2, '0');
    const title = shuffled ? 'shuffled layout' : this.layoutName;
    this.label.innerHTML = `${num} / ${total}<small>${title}${this.edited ? ' · edited' : ''}</small>`;
  }

  markEdited() {
    if (!this.edited) { this.edited = true; this.updateLabel(); }
    this.save();
  }

  /* ---------- persistence ---------- */

  save() {
    const data = {
      v: 1, mode: this.mode, preset: this.presetIndex, name: this.layoutName, edited: this.edited,
      pieces: this.pieces.map(({ type, x, y, w, h, r, loose, z }) => ({ type, x, y, w, h, r, loose, z })),
    };
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) { /* private mode — ignore */ }
  }

  restore() {
    let data;
    try { data = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { return false; }
    if (!data || data.v !== 1 || !Array.isArray(data.pieces) || !data.pieces.length) return false;
    this.desk.classList.add('no-anim');
    data.pieces.filter((s) => TYPES[s.type]).forEach((s) => {
      const pc = this.createPiece({ type: s.type, x: +s.x || 0, y: +s.y || 0, w: +s.w || 10, h: +s.h || 10, r: +s.r || 0, loose: !!s.loose, z: +s.z || 1 });
      this.topZ = Math.max(this.topZ, pc.z + 1);
    });
    if (data.mode !== this.mode) this.reslotLoose();
    this.pieces.forEach((pc) => { this.clampToDesk(pc); this.draw(pc); });
    this.presetIndex = clamp(+data.preset || 0, 0, PRESETS.length - 1);
    this.layoutName = data.name || PRESETS[this.presetIndex].name;
    this.edited = !!data.edited;
    this.updateLabel();
    requestAnimationFrame(() => this.desk.classList.remove('no-anim'));
    return true;
  }

  /* ---------- events ---------- */

  bind() {
    this.onMove = this.onMove.bind(this);
    this.onUp = this.onUp.bind(this);
    this.desk.addEventListener('pointerdown', (e) => this.onDown(e));
    this.desk.addEventListener('keydown', (e) => this.onKey(e));
    this.desk.addEventListener('click', (e) => {
      const del = e.target.closest('.piece__del');
      if (del) {
        const pc = this.find(del.closest('.piece'));
        if (pc) { this.removePiece(pc); this.markEdited(); this.announce('Piece removed'); }
      }
    });
    this.desk.addEventListener('focusin', (e) => {
      const pc = this.find(e.target.closest('.piece'));
      if (pc) this.select(pc);
    });

    this.root.querySelector('[data-action="prev"]').addEventListener('click', () => this.applyPreset(this.presetIndex - 1));
    this.root.querySelector('[data-action="next"]').addEventListener('click', () => this.applyPreset(this.presetIndex + 1));
    this.root.querySelector('[data-action="shuffle"]').addEventListener('click', () => this.shuffle());
    this.root.querySelector('[data-action="save"]').addEventListener('click', (e) => this.downloadPNG(e.currentTarget));
    this.root.querySelector('[data-action="request"]').addEventListener('click', () => requestDialog.open(this));

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
    const el = e.target.closest('.piece');
    const piece = this.find(el);
    if (!piece) { this.select(null); return; }
    if (e.target.closest('.piece__del')) return;
    e.preventDefault();
    this.select(piece);
    const resizing = !!e.target.closest('.piece__resize');
    this.drag = {
      piece, resizing, moved: false, pointerId: e.pointerId,
      sx: e.clientX, sy: e.clientY, x: piece.x, y: piece.y, w: piece.w, h: piece.h,
    };
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
  }

  onMove(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    const dx = (e.clientX - d.sx) / this.u;
    const dy = (e.clientY - d.sy) / this.u;
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < DRAG_THRESHOLD) return;
      d.moved = true;
      d.piece.z = ++this.topZ;
      d.piece.el.classList.add(d.resizing ? 'is-resizing' : 'is-dragging');
    }
    e.preventDefault();
    const pc = d.piece;
    if (d.resizing) {
      pc.w = clamp(d.w + dx, 4, FRAME.w - pc.x);
      pc.h = TYPES[pc.type].lockAspect ? clamp(pc.w, 3, FRAME.h - pc.y) : clamp(d.h + dy, 3, FRAME.h - pc.y);
      if (TYPES[pc.type].lockAspect) pc.w = pc.h;
    } else {
      pc.x = d.x + dx;
      pc.y = d.y + dy;
      this.clampToDesk(pc);
    }
    this.draw(pc);
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
    if (!d.moved) return;
    if (d.resizing) {
      pc.w = half(pc.w);
      pc.h = half(pc.h);
      this.draw(pc);
    } else {
      this.settle(pc);
    }
    this.markEdited();
  }

  onKey(e) {
    const pc = this.find(e.target.closest('.piece'));
    if (!pc || e.target !== pc.el) return;
    const step = e.shiftKey ? 5 : 1;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      pc.x += moves[e.key][0];
      pc.y += moves[e.key][1];
      this.clampToDesk(pc);
      this.draw(pc);
      this.markEdited();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      this.removePiece(pc);
      this.markEdited();
      this.announce('Piece removed');
    } else if (e.key === 'Enter') {
      // Enter moves a loose piece onto the page (and back again).
      e.preventDefault();
      if (pc.loose) {
        pc.x = FRAME.w / 2 - pc.w / 2;
        pc.y = FRAME.h / 2 - pc.h / 2;
      } else {
        const slot = this.pickSlot(pc.type);
        pc.x = slot.x - pc.w / 2;
        pc.y = slot.y - pc.h / 2;
      }
      pc.z = ++this.topZ;
      this.settle(pc);
      this.markEdited();
      this.announce(pc.loose ? 'Moved back to the desk' : 'Placed on the page');
    }
  }

  buildTray() {
    const tray = this.root.querySelector('[data-tray]');
    SUPPLY.forEach((type) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tray__btn';
      btn.style.setProperty('--pc', TYPES[type].color);
      btn.textContent = TYPES[type].label;
      btn.setAttribute('aria-label', `Add a ${TYPES[type].label} piece`);
      btn.addEventListener('click', () => this.addFromTray(type));
      tray.appendChild(btn);
    });
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

  /* Only the handwritten face (latin) is used on the desk. Embedding every Google Fonts
     subset makes the export ~20x slower, so keep just that one @font-face. */
  async fontCSS(htmlToImage) {
    if (this._fontCSS != null) return this._fontCSS;
    try {
      const all = await htmlToImage.getFontEmbedCSS(this.desk);
      const faces = (all.match(/@font-face\s*{[^}]*}/g) || [])
        .filter((f) => /font-family:\s*["']?Caveat/i.test(f) && /U\+0-FF,/i.test(f));
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
        fontEmbedCSS: await this.fontCSS(htmlToImage),
        backgroundColor: DESK_BG,
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
      ctx.fillStyle = '#FFD233';
      ctx.font = `700 ${Math.round(cap * 0.5)}px Caveat, cursive`;
      const title = this.layoutName === 'Shuffled' ? 'shuffled layout' : this.layoutName.toLowerCase();
      ctx.fillText(`my layout — ${title}${this.edited ? ' (edited)' : ''}`, cap * 0.4, sh + cap / 2);
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
      triggerDownload(blob, 'qonicode-layout.png');
      this.announce('Layout saved as PNG');
    } catch (err) {
      console.error(err);
      alert('Sorry, the image could not be created in this browser.');
    } finally {
      if (button) button.disabled = false;
    }
  }

  layoutData() {
    return {
      name: this.layoutName, edited: this.edited,
      pieces: this.pieces.filter((pc) => !pc.loose).map(({ type, x, y, w, h }) => ({ type, x, y, w, h })),
    };
  }
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ---------- Request dialog ---------- */

const requestDialog = {
  init() {
    this.dialog = document.querySelector('[data-request-dialog]');
    if (!this.dialog) return;
    this.form = this.dialog.querySelector('[data-request-form]');
    this.img = this.dialog.querySelector('[data-request-preview]');
    this.caption = this.dialog.querySelector('[data-request-caption]');
    this.status = this.dialog.querySelector('[data-request-status]');
    this.submit = this.dialog.querySelector('[data-request-submit]');
    this.dialog.querySelector('[data-close]').addEventListener('click', () => this.dialog.close());
    this.dialog.addEventListener('click', (e) => { if (e.target === this.dialog) this.dialog.close(); });
    this.form.addEventListener('submit', (e) => { e.preventDefault(); this.send(); });
  },

  async open(desk) {
    this.desk = desk;
    this.dataUrl = null;
    this.setStatus('');
    this.form.querySelectorAll('input, textarea, button').forEach((el) => { el.disabled = false; });
    this.submit.disabled = true;
    this.img.removeAttribute('src');
    this.caption.textContent = 'rendering your layout…';
    this.dialog.showModal();
    try {
      const canvas = await desk.renderCanvas();
      this.canvas = canvas;
      this.dataUrl = canvas.toDataURL('image/png');
      this.img.src = this.dataUrl;
      this.caption.textContent = 'this image will be attached';
      this.submit.disabled = false;
    } catch (err) {
      console.error(err);
      this.caption.textContent = 'could not render the image';
      this.setStatus('The image could not be created in this browser.', 'error');
    }
  },

  async send() {
    if (!this.form.reportValidity() || !this.dataUrl) return;
    const fd = new FormData(this.form);
    const payload = {
      name: fd.get('name').trim(), email: fd.get('email').trim(), store: fd.get('store').trim(),
      notes: fd.get('notes').trim(), company: fd.get('company'),
      image: this.dataUrl, layout: this.desk.layoutData(),
    };
    this.submit.disabled = true;
    this.setStatus('Sending…');
    try {
      const res = await fetch(REQUEST_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || `HTTP ${res.status}`);
      this.form.querySelectorAll('input, textarea').forEach((el) => { el.disabled = true; });
      this.setStatus(`Sent! We'll reply to ${payload.email} soon.`, 'ok');
    } catch (err) {
      console.error(err);
      this.submit.disabled = false;
      this.status.dataset.state = 'error';
      this.status.innerHTML = 'Couldn\'t send automatically. <a href="#" data-dl>Download the PNG</a> and email it to '
        + `<a href="mailto:${MAIL_TO}?subject=${encodeURIComponent('Layout request')}">${MAIL_TO}</a>.`;
      this.status.querySelector('[data-dl]').addEventListener('click', (e) => {
        e.preventDefault();
        this.canvas.toBlob((blob) => triggerDownload(blob, 'qonicode-layout.png'), 'image/png');
      });
    }
  },

  setStatus(text, state = '') {
    this.status.textContent = text;
    this.status.dataset.state = state;
  },
};

/* ---------- boot ---------- */

const root = document.getElementById('layout-desk');
if (root) {
  requestDialog.init();
  window.layoutDesk = new LayoutDesk(root);
}
document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
document.querySelectorAll('.menu-drawer a').forEach((a) => a.addEventListener('click', () => a.closest('details').removeAttribute('open')));
