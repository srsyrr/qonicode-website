/* The "Let's Talk" dialog (neobrutalist), sent to /api/request as kind "talk". */

import { mountTurnstile } from './turnstile.js';

const MAIL_TO = 'qonita@qonicode.tech';
const ENDPOINT = '/api/request';

const ui = {};

function init() {
  ui.dialog = document.querySelector('[data-dialog]');
  if (!ui.dialog) return false;
  ui.form = ui.dialog.querySelector('form');
  ui.status = ui.dialog.querySelector('[data-dialog-status]');
  ui.submit = ui.dialog.querySelector('[data-dialog-submit]');
  ui.dialog.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => ui.dialog.close()));
  ui.dialog.addEventListener('click', (e) => { if (e.target === ui.dialog) ui.dialog.close(); });
  ui.form.addEventListener('submit', (e) => { e.preventDefault(); send(); });
  return true;
}

function setStatus(text, kind = '') {
  ui.status.textContent = text;
  ui.status.dataset.state = kind;
}

export function openDialog(opts = {}) {
  if (!ui.dialog && !init()) return;
  ui.submit.disabled = false;
  ui.form.querySelectorAll('input, textarea').forEach((el) => { el.disabled = false; });
  // Service cards pass their name, so the message starts with what the visitor asked about.
  const notes = ui.form.elements.notes;
  const untouched = !notes.value || notes.dataset.auto === notes.value;
  if (untouched) {
    notes.value = opts.topic ? `I'm interested in: ${opts.topic}\n` : '';
    notes.dataset.auto = notes.value;
  }
  setStatus('');
  ui.dialog.showModal();
  // Spam check loads the first time the dialog is open (it needs to be visible to run).
  if (!ui.captcha) ui.captcha = mountTurnstile(ui.dialog.querySelector('[data-turnstile]'));
}

// Optional field: empty stays empty, a bare domain like "shop.com" becomes https://shop.com.
function storeUrl(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`;
}

async function send() {
  if (!ui.form.reportValidity()) return;
  const fd = new FormData(ui.form);
  const payload = {
    kind: 'talk',
    name: String(fd.get('name')).trim(),
    email: String(fd.get('email')).trim(),
    store: storeUrl(fd.get('store')),
    notes: String(fd.get('notes')).trim(),
    company: fd.get('company'),
  };
  const captcha = await (ui.captcha || mountTurnstile(null));
  if (captcha.enabled && !captcha.token()) {
    setStatus('Checking…');
    if (!(await captcha.waitToken())) {
      setStatus('Please complete the security check above.', 'error');
      return;
    }
  }
  payload.turnstile = captcha.token();
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
    const mailto = `mailto:${MAIL_TO}?subject=${encodeURIComponent('Hello qonicode')}`;
    ui.status.innerHTML = `Couldn’t send automatically. Please email <a href="${mailto}">${MAIL_TO}</a>.`;
  } finally {
    captcha.reset(); // tokens are single-use
  }
}
