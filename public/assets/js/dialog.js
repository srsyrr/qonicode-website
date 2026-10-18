/* "Let's Talk" and "Request" share one neobrutalist dialog.
   request: also renders the playground to a PNG and attaches it. */

const MAIL_TO = 'qonita@qonicode.tech';
const ENDPOINT = '/api/request';

const COPY = {
  talk: {
    title: "Let's talk",
    desc: 'Tell us about your store — we reply within one business day.',
    notes: 'Message',
    submit: 'Send message',
  },
  request: {
    title: 'Request this layout',
    desc: 'We’ll get your layout as an image, plus anything you add below.',
    notes: 'Notes',
    submit: 'Send request',
  },
};

export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const ui = {};

function init() {
  ui.dialog = document.querySelector('[data-dialog]');
  if (!ui.dialog) return false;
  ui.form = ui.dialog.querySelector('form');
  ui.title = ui.dialog.querySelector('[data-dialog-title]');
  ui.desc = ui.dialog.querySelector('[data-dialog-desc]');
  ui.notesLabel = ui.dialog.querySelector('[data-notes-label]');
  ui.attach = ui.dialog.querySelector('[data-attachment]');
  ui.preview = ui.dialog.querySelector('[data-attachment-img]');
  ui.attachText = ui.dialog.querySelector('[data-attachment-text]');
  ui.status = ui.dialog.querySelector('[data-dialog-status]');
  ui.submit = ui.dialog.querySelector('[data-dialog-submit]');
  ui.dialog.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => ui.dialog.close()));
  ui.dialog.addEventListener('click', (e) => { if (e.target === ui.dialog) ui.dialog.close(); });
  ui.form.addEventListener('submit', (e) => { e.preventDefault(); send(); });
  return true;
}

let state = {};

function setStatus(text, kind = '') {
  ui.status.textContent = text;
  ui.status.dataset.state = kind;
}

export async function openDialog(mode, opts = {}) {
  if (!ui.dialog && !init()) return;
  const copy = COPY[mode];
  state = { mode, ...opts, dataUrl: null, canvas: null };
  ui.title.textContent = copy.title;
  ui.desc.textContent = copy.desc;
  ui.notesLabel.textContent = copy.notes;
  ui.submit.textContent = copy.submit;
  ui.form.querySelectorAll('input, textarea').forEach((el) => { el.disabled = false; });
  // Service cards pass their name, so the message starts with what the visitor asked about.
  const notes = ui.form.elements.notes;
  const untouched = !notes.value || notes.dataset.auto === notes.value;
  if (untouched) {
    notes.value = opts.topic ? `I'm interested in: ${opts.topic}\n` : '';
    notes.dataset.auto = notes.value;
  }
  setStatus('');
  ui.attach.hidden = mode !== 'request';
  ui.submit.disabled = mode === 'request';
  ui.preview.removeAttribute('src');
  ui.dialog.showModal();

  if (mode === 'request') {
    ui.attachText.textContent = 'Rendering your layout…';
    try {
      state.canvas = await opts.render();
      state.dataUrl = state.canvas.toDataURL('image/png');
      ui.preview.src = state.dataUrl;
      ui.attachText.textContent = `${opts.filename} will be attached`;
      ui.submit.disabled = false;
    } catch (err) {
      console.error(err);
      ui.attachText.textContent = 'The layout image could not be created.';
    }
  }
}

async function send() {
  if (!ui.form.reportValidity()) return;
  if (state.mode === 'request' && !state.dataUrl) return;
  const fd = new FormData(ui.form);
  const payload = {
    kind: state.mode,
    name: String(fd.get('name')).trim(),
    email: String(fd.get('email')).trim(),
    store: String(fd.get('store')).trim(),
    notes: String(fd.get('notes')).trim(),
    company: fd.get('company'),
  };
  if (state.mode === 'request') {
    payload.image = state.dataUrl;
    payload.layout = state.layout();
  }
  ui.submit.disabled = true;
  setStatus('Sending…');
  try {
    const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) throw new Error(body.error || `HTTP ${res.status}`);
    ui.form.querySelectorAll('input, textarea').forEach((el) => { el.disabled = true; });
    setStatus(`Sent! We’ll reply to ${payload.email} soon.`, 'ok');
  } catch (err) {
    console.error(err);
    ui.submit.disabled = false;
    ui.status.dataset.state = 'error';
    const mailto = `mailto:${MAIL_TO}?subject=${encodeURIComponent(state.mode === 'request' ? 'Layout request' : 'Hello qonicode')}`;
    if (state.mode === 'request') {
      ui.status.innerHTML = `Couldn’t send automatically. <a href="#" data-dl>Download the PNG</a> and email it to <a href="${mailto}">${MAIL_TO}</a>.`;
      ui.status.querySelector('[data-dl]').addEventListener('click', (e) => {
        e.preventDefault();
        state.canvas.toBlob((blob) => triggerDownload(blob, state.filename), 'image/png');
      });
    } else {
      ui.status.innerHTML = `Couldn’t send automatically. Please email <a href="${mailto}">${MAIL_TO}</a>.`;
    }
  }
}
