# Qonicode — agency site with a layout playground

Static site (plain HTML/CSS/JS, no build step) on **Cloudflare Workers** (static assets + a tiny Worker for the form API),
deployed from GitHub.
The centerpiece is the **Playground**: visitors drag paper wireframe cards onto a page, then save it as a PNG
or send it to `qonita@qonicode.tech`.

```
public/                     ← static files Cloudflare serves
  index.html
  assets/css/style.css
  assets/js/main.js         ← floating nav, Let's Talk buttons, work carousel, newsletter
  assets/js/pieces.js       ← card types, standard wireframes per page type, shuffle rules
  assets/js/desk.js         ← playground: drag / resize / presets / PNG export
  assets/js/dialog.js       ← Let's Talk + Request dialog
  assets/js/turnstile.js    ← Cloudflare Turnstile spam check for the forms
  _headers                  ← security headers (CSP, etc.) applied by Cloudflare
  assets/vendor/html-to-image.js (MIT) ← renders the playground to PNG
src/worker.js               ← Worker entry: routes /api/* to the handlers below, everything else → public/
functions/api/request.js    ← POST /api/request → email (request / talk / newsletter)
functions/api/config.js     ← GET /api/config → public settings (Turnstile site key)
wrangler.toml               ← Worker name, entry point and assets folder
```

## Playground

| Control | What it does |
| --- | --- |
| Home page / PDP / PLP | Switches page type. Each type keeps its own layout. |
| ⬇ (save) | Downloads the page as a PNG. |
| Shuffle | Builds a random but sensible layout for the current page type. |
| Request | Opens the dialog and emails the PNG + layout JSON with the visitor's details. |
| ← → | Steps through the standard wireframes of the current page type. |

Cards wait on the desk with their name written under them: img box, circle img, description, table, CTA, 5 stars,
menu, banner, section / sidebar, slider and label. Drag one onto the page and a fresh copy appears in its spot.
Cards can overlap; the yellow corner resizes, the pink × (or dragging the card off the page) removes it.
**Label** cards are typed by the visitor (click to edit, max 20 characters). Keyboard: arrows move, Enter puts a desk card
on the page or edits a label, Delete removes. Layouts are kept in the visitor's browser (localStorage).

To add or change standard wireframes, edit `PAGES` (lists of rows) and `ROWS` in `public/assets/js/pieces.js`.

## Deploy (GitHub → Cloudflare Workers)

The repo is connected as a **Worker** with Workers Builds: every push to `main` runs `npx wrangler deploy`, which uploads
`public/` as static assets and `src/worker.js` as the Worker (all set in `wrangler.toml`).

1. **Build settings** (Worker → Settings → Build): build command **None**, deploy command **`npx wrangler deploy`**,
   root directory **`/`**, branch **`main`**. The `name` in `wrangler.toml` (`qonicode-website`) must match the
   Worker's name in the dashboard — if yours is different, change it in `wrangler.toml`.
2. **Variables and secrets** (Worker → Settings → Variables and Secrets — runtime, not "Build variables"):

   | Name | Type | Value |
   | --- | --- | --- |
   | `RESEND_API_KEY` | **Secret** | Resend API key with *Sending access* limited to `qonicode.tech` |
   | `MAIL_FROM` | Text | e.g. `Qonicode <hello@qonicode.tech>` |
   | `MAIL_TO` | Text | optional, defaults to `qonita@qonicode.tech` |
   | `TURNSTILE_SITE_KEY` | Text | site key of your Turnstile widget (public by design) |
   | `TURNSTILE_SECRET` | **Secret** | secret key of the same widget |
   | `ALLOWED_ORIGINS` | Text | optional, e.g. `https://qonicode.tech,https://www.qonicode.tech` |

   Add them in the dashboard. `keep_vars = true` in `wrangler.toml` makes deploys keep the Text variables;
   Secrets are always kept.
3. **Resend:** add and verify `qonicode.tech` (SPF/DKIM records go into Cloudflare DNS).
4. **Turnstile:** dashboard → *Turnstile* → *Add widget* → hostnames `qonicode.tech` (+ `www`, + your
   `*.workers.dev` URL if you test there), mode *Managed*. Put its keys in the variables above.
   Set both keys or neither — with only the secret, every form submission is rejected.
5. **Rate limit the form endpoint:** *Security → WAF → Rate limiting rules* → URI Path *equals* `/api/request` →
   5 requests per 10 seconds per IP → *Block*.
6. **Domain & HTTPS:** Worker → Settings → *Domains & Routes* → add custom domain `qonicode.tech` (and `www`).
   SSL/TLS *Full (strict)*, *Always Use HTTPS* on. Optionally turn off the `*.workers.dev` URL once the domain works.
7. Trigger a new build (push or *Retry build*), then send yourself a Let's Talk, a Request and a newsletter signup.
   If something fails, check Worker → *Observability / Logs*.

### What protects the forms

- **Origin check:** `/api/request` only accepts posts from the site's own origin (or `ALLOWED_ORIGINS`).
- **Turnstile:** once `TURNSTILE_SECRET` is set, every submission needs a valid token (verified server-side).
- **Honeypot** field, size limit (8 MB), JSON-only, input length limits, HTML-escaped emails.
- **Rate limiting** (step 7) caps how fast one IP can submit.
- **Headers** (`public/_headers`): Content-Security-Policy (scripts only from this site, Turnstile and Cloudflare
  Web Analytics; fonts from Google), no framing by other sites, nosniff, strict referrer, Permissions-Policy.
  If you add a new third-party script, font or embed, add its domain to the CSP or the browser will block it.

## Local preview

```bash
python -m http.server 5179 --directory public
```

Open http://localhost:5179 — the forms show their fallback message there.

To run it exactly like Cloudflare (Worker, `/api/*`, `_headers`), create a `.dev.vars` file (gitignored) with the
variables above — Turnstile has test keys `1x00000000000000000000AA` / `1x0000000000000000000000000000000AA` — and run:

```bash
npx wrangler dev
```

## Placeholders to replace

- **Testimonials** (`#testimonials`): all six cards are placeholders (“Client name”, sample store type and project).
  Replace them with real quotes before going live, or remove the cards you don't have yet.
- Latest work: the four projects and their mock screens are examples.
- About: the striped box is a photo placeholder.

Service prices live in the `#services` cards in `index.html`. Each card's bag button opens Let's Talk with the
service name already in the message.
