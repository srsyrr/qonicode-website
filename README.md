# Qonicode — Shopify theme fixes, with a fix picker

Static site (plain HTML/CSS/JS, no build step) on **Cloudflare Workers** (static assets + a tiny Worker for the form API),
deployed from GitHub.
Visitors list what's wrong with their store on the **fix picker** and see a price before they ask,
then send the list to `qonita@qonicode.tech`.

```
public/                     ← static files Cloudflare serves
  index.html
  assets/css/style.css
  assets/js/main.js         ← floating nav, Let's Talk buttons, work carousel, newsletter
  assets/js/fix.js          ← fix picker: example store, wheels, prices, fix list, sending
  assets/js/dialog.js       ← Let's Talk dialog
  assets/js/turnstile.js    ← Cloudflare Turnstile spam check for the forms
  _headers                  ← security headers (CSP, etc.) applied by Cloudflare
src/worker.js               ← Worker entry: routes /api/* to the handlers below, everything else → public/
functions/api/request.js    ← POST /api/request → email (fixlist / talk / newsletter)
functions/api/config.js     ← GET /api/config → public settings (Turnstile site key)
wrangler.toml               ← Worker name, entry point and assets folder
```

## Fix picker

An example store built from named Shopify sections (Announcement bar, Header, Product information, Footer…), on five
page tabs: Home, Product, Collection, Cart, Other pages.

| Step | What happens |
| --- | --- |
| Tap a section (or a part inside it) | A picker docks at the bottom of the screen with two wheels: **which part** and **what's wrong**. |
| Roll the wheels | The part lights up yellow on the store and the price under the wheels follows live. |
| Note | One optional field, "what you see, and how it should be". Needed only for *Something else*. |
| Add to list | The item gets a number on the store, coloured by its problem, and goes into the fix list. |
| Fix list button | Opens the list like a store's cart: items, editable notes, estimate, time, the price promise and the send form. |

Problems and their colours (the same in the wheel, on the store and in the list): Looks wrong on phone (orange),
Looks wrong on desktop (teal), Doesn't work (pink), Change it (purple), Add something here (green), Something else (yellow).

Prices are set in `priceAll()` in `public/assets/js/fix.js`. The bands come from Upwork job budgets in the acquisition research
(2026-11); every item is still confirmed with the client before any contract:

| Problem | Price |
| --- | --- |
| Looks wrong on phone | $40 for the first template, +$20 per extra template; more parts on a listed template are included |
| Looks wrong on desktop | $40–$100 |
| Change it | $25, +$10 per extra change |
| Doesn't work | $40–$100 |
| Variant picker (looks wrong on phone / doesn't work) | $50–$100 |
| Reviews, Cart upsell (app sections) | $35–$70 |
| Add something here | $60–$150 |
| Something else, Checkout | after a look |

Sending posts `kind: "fixlist"` to `/api/request`: store address and email are required, screenshots are optional
(up to 6, made smaller in the browser to JPEG). Links elsewhere on the page can preselect a problem
(`data-fix-prob="phone"`, used by the Starter offers) or open a page tab (`data-fix-page="product"`, used by the footer).
To add or rename sections, edit `GLOBAL_TOP`, `GLOBAL_BOTTOM` and `PAGES` in `fix.js`.

The earlier prototypes of this tool are kept on the `claude/prototypes` branch, outside the site.

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
