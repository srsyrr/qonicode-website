/* API handler (see src/worker.js): POST /api/request
   Emails a form to the studio through the Resend API: the fix list (with its screenshots), Let's Talk, or a newsletter signup.
   Environment variables (Worker → Settings → Variables and Secrets):
     RESEND_API_KEY  (secret)  — API key from resend.com
     MAIL_FROM       — verified sender, e.g. "Qonicode Desk <desk@qonicode.tech>"
     MAIL_TO         — optional, defaults to qonita@qonicode.tech
     TURNSTILE_SECRET (secret) — optional; when set, every submission must carry a valid Turnstile token
     ALLOWED_ORIGINS — optional, comma-separated (e.g. "https://qonicode.tech,https://www.qonicode.tech");
                       when unset, only requests from the site's own origin are accepted */

const DEFAULT_TO = 'qonita@qonicode.tech';
const MAX_BODY = 8 * 1024 * 1024; // 8 MB of JSON
const MAX_SHOTS = 6;
const MAX_ITEMS = 40;
const SHOT = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/;

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = (v, max) => String(v ?? '').trim().slice(0, max);

function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

/* Only accept form posts made from our own pages (stops other sites from using this endpoint). */
function originAllowed(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (allowed.length) return allowed.includes(origin);
  return origin === new URL(request.url).origin;
}

/* Cloudflare Turnstile: required only once TURNSTILE_SECRET is configured. */
async function turnstileOk(token, request, env) {
  if (!env.TURNSTILE_SECRET) return true;
  if (!token) return false;
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', String(token).slice(0, 2048));
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) form.append('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    const out = await res.json();
    return out.success === true;
  } catch (err) {
    console.error('Turnstile verification failed', err);
    return false;
  }
}

export async function onRequestPost({ request, env }) {
  if (!originAllowed(request, env)) return json({ ok: false, error: 'Forbidden.' }, 403);
  if (!String(request.headers.get('Content-Type') || '').includes('application/json')) {
    return json({ ok: false, error: 'Invalid request.' }, 415);
  }
  const length = Number(request.headers.get('content-length') || 0);
  if (length > MAX_BODY) return json({ ok: false, error: 'The screenshots are too large. Try fewer of them.' }, 413);

  let data;
  try { data = await request.json(); } catch { return json({ ok: false, error: 'Invalid request.' }, 400); }
  if (!data || typeof data !== 'object') return json({ ok: false, error: 'Invalid request.' }, 400);

  // Honeypot: bots fill the hidden "company" field. Pretend it worked.
  if (clean(data.company, 200)) return json({ ok: true });

  if (!(await turnstileOk(data.turnstile, request, env))) {
    return json({ ok: false, error: 'Security check failed. Please try again.' }, 403);
  }

  // fixlist: the fix picker's list (screenshots attached) · talk: Let's Talk form · newsletter: footer signup
  const kind = ['fixlist', 'talk', 'newsletter'].includes(data.kind) ? data.kind : 'talk';
  const name = clean(data.name, 120);
  const email = clean(data.email, 200);
  const store = clean(data.store, 300);
  const notes = clean(data.notes, 4000);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, error: 'Please add a valid email.' }, 400);
  if (kind === 'talk' && !name) return json({ ok: false, error: 'Please add your name.' }, 400);

  // The fix list as the visitor saw it. Prices come from the page: they are what the visitor was shown, not a quote.
  const list = data.fixlist && typeof data.fixlist === 'object' ? data.fixlist : {};
  const items = (Array.isArray(list.items) ? list.items : []).slice(0, MAX_ITEMS).map((it, i) => ({
    n: i + 1,
    where: clean(it && it.where, 160),
    problem: clean(it && it.problem, 60),
    note: clean(it && it.note, 300),
    price: clean(it && it.price, 40),
  }));
  const shots = (Array.isArray(data.shots) ? data.shots : []).slice(0, MAX_SHOTS).map((s) => SHOT.exec(String(s))).filter(Boolean);
  if (kind === 'fixlist') {
    if (!store) return json({ ok: false, error: 'Please add your store address.' }, 400);
    if (!items.length || items.some((it) => !it.where || !it.problem)) return json({ ok: false, error: 'The fix list is empty.' }, 400);
  }
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) return json({ ok: false, error: 'Email is not configured yet.' }, 500);

  const estimate = clean(list.estimate, 40) || '—';
  const after = Math.max(0, Math.min(MAX_ITEMS, Number(list.after) || 0));
  const days = Math.max(0, Math.min(99, Number(list.days) || 0));
  const host = (() => { try { return new URL(store).host; } catch { return store; } })();

  const heading = { fixlist: 'New fix list', talk: "New message (Let's Talk)", newsletter: 'New newsletter subscriber' }[kind];
  const subject = {
    fixlist: `Fix list — ${host} — ${items.length} item${items.length === 1 ? '' : 's'}, ${estimate}${after ? '+' : ''}`,
    talk: `Let's talk — ${name}`,
    newsletter: `Newsletter signup — ${email}`,
  }[kind];
  const rows = kind === 'newsletter' ? [['Email', email]]
    : kind === 'fixlist' ? [['Email', email], ['Store', store], ['Estimate', `${estimate}${after ? ` + ${after} after a look` : ''}`], ['Time', days ? `about ${days} working day${days === 1 ? '' : 's'}` : '—']]
    : [['Name', name], ['Email', email], ['Store', store || '—']];
  const message = kind === 'newsletter' ? '' : notes || (kind === 'fixlist' ? '' : '(no message)');
  const cell = 'padding:6px 10px;border-bottom:1px solid #ddd;vertical-align:top;text-align:left';
  const itemsHtml = kind !== 'fixlist' ? '' : `
    <table style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse;margin-top:16px">
      <tr>${['#', 'Where', 'Problem', 'Note', 'Shown price'].map((h) => `<th style="${cell}">${h}</th>`).join('')}</tr>
      ${items.map((it) => `<tr>${[it.n, it.where, it.problem, it.note || '—', it.price].map((v) => `<td style="${cell}">${escapeHtml(v)}</td>`).join('')}</tr>`).join('')}
    </table>`;
  const html = `
    <h2 style="font-family:Arial,sans-serif">${heading}</h2>
    <table style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse">
      ${rows.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666">${k}</td><td style="padding:4px 0"><strong>${escapeHtml(v)}</strong></td></tr>`).join('')}
    </table>
    ${itemsHtml}
    ${message ? `<p style="font-family:Arial,sans-serif;font-size:14px;white-space:pre-wrap">${escapeHtml(message)}</p>` : ''}
    <p style="font-family:Arial,sans-serif;font-size:12px;color:#666">${shots.length ? `${shots.length} screenshot${shots.length === 1 ? ' is' : 's are'} attached. ` : ''}Reply to this email to answer ${escapeHtml(name || email)}.</p>`;
  const itemsText = items.map((it) => `${it.n}. ${it.where}: ${it.problem}${it.note ? ` ("${it.note}")` : ''} (${it.price})`).join('\n');
  const text = `${heading}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}${kind === 'fixlist' ? `\n\n${itemsText}` : ''}${message ? `\n\nMessage:\n${message}` : ''}`;
  const attachments = kind !== 'fixlist' ? null : [
    ...shots.map(([, type, content], i) => ({ filename: `screenshot-${i + 1}.${type === 'jpeg' ? 'jpg' : type}`, content })),
    { filename: 'fixlist.json', content: toBase64(JSON.stringify({ store, email, estimate, after, days, items }, null, 2)) },
  ];

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [env.MAIL_TO || DEFAULT_TO],
      reply_to: email,
      subject,
      html,
      text,
      ...(attachments ? { attachments } : {}),
    }),
  });

  if (!res.ok) {
    console.error('Resend error', res.status, await res.text());
    return json({ ok: false, error: 'The email could not be sent.' }, 502);
  }
  return json({ ok: true });
}
