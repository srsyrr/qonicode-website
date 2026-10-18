/* Cloudflare Pages Function: POST /api/request
   Emails the visitor's layout PNG to the studio through the Resend API.
   Environment variables (Pages → Settings → Variables and Secrets):
     RESEND_API_KEY  (secret)  — API key from resend.com
     MAIL_FROM       — verified sender, e.g. "Qonicode Desk <desk@qonicode.tech>"
     MAIL_TO         — optional, defaults to qonita@qonicode.tech */

const DEFAULT_TO = 'qonita@qonicode.tech';
const MAX_BODY = 8 * 1024 * 1024; // 8 MB of JSON
const PNG_PREFIX = 'data:image/png;base64,';

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

export async function onRequestPost({ request, env }) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > MAX_BODY) return json({ ok: false, error: 'Layout image is too large.' }, 413);

  let data;
  try { data = await request.json(); } catch { return json({ ok: false, error: 'Invalid request.' }, 400); }

  // Honeypot: bots fill the hidden "company" field. Pretend it worked.
  if (clean(data.company, 200)) return json({ ok: true });

  // request: layout from the playground (PNG attached) · talk: Let's Talk form · newsletter: footer signup
  const kind = ['request', 'talk', 'newsletter'].includes(data.kind) ? data.kind : 'request';
  const name = clean(data.name, 120);
  const email = clean(data.email, 200);
  const store = clean(data.store, 300);
  const notes = clean(data.notes, 4000);
  const image = String(data.image || '');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, error: 'Please add a valid email.' }, 400);
  if (kind !== 'newsletter' && !name) return json({ ok: false, error: 'Please add your name.' }, 400);
  if (kind === 'request' && !image.startsWith(PNG_PREFIX)) return json({ ok: false, error: 'Missing layout image.' }, 400);
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) return json({ ok: false, error: 'Email is not configured yet.' }, 500);

  const layout = data.layout && typeof data.layout === 'object' ? data.layout : {};
  const layoutName = clean(layout.name, 80) || 'Custom';
  const pageType = clean(layout.page, 40) || '—';
  const pieceCount = Array.isArray(layout.pieces) ? layout.pieces.length : 0;

  const heading = { request: 'New layout request', talk: "New message (Let's Talk)", newsletter: 'New newsletter subscriber' }[kind];
  const subject = { request: `Layout request — ${name}`, talk: `Let's talk — ${name}`, newsletter: `Newsletter signup — ${email}` }[kind];
  const rows = kind === 'newsletter' ? [['Email', email]] : [['Name', name], ['Email', email], ['Store', store || '—']];
  if (kind === 'request') {
    rows.push(['Page', pageType], ['Layout', `${layoutName}${layout.edited ? ' (edited)' : ''} · ${pieceCount} cards on the page`]);
  }
  const message = kind === 'newsletter' ? '' : notes || '(no message)';
  const html = `
    <h2 style="font-family:Arial,sans-serif">${heading}</h2>
    <table style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse">
      ${rows.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666">${k}</td><td style="padding:4px 0"><strong>${escapeHtml(v)}</strong></td></tr>`).join('')}
    </table>
    ${message ? `<p style="font-family:Arial,sans-serif;font-size:14px;white-space:pre-wrap">${escapeHtml(message)}</p>` : ''}
    <p style="font-family:Arial,sans-serif;font-size:12px;color:#666">${kind === 'request' ? 'The layout image and its JSON are attached. ' : ''}Reply to this email to answer ${escapeHtml(name || email)}.</p>`;
  const text = `${heading}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}${message ? `\n\nMessage:\n${message}` : ''}`;
  const attachments = kind !== 'request' ? null : [
    { filename: 'layout.png', content: image.slice(PNG_PREFIX.length) },
    { filename: 'layout.json', content: toBase64(JSON.stringify(layout, null, 2)) },
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
