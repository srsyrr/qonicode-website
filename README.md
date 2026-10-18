# Qonicode — agency site with a layout playground

Static site (plain HTML/CSS/JS, no build step) for **Cloudflare Pages**, deployed from GitHub.
The centerpiece is the **Playground**: visitors drag paper wireframe cards onto a page, then save it as a PNG
or send it to `qonita@qonicode.tech`.

```
public/                     ← what Cloudflare serves
  index.html
  assets/css/style.css
  assets/js/main.js         ← floating nav, Let's Talk buttons, work carousel, newsletter
  assets/js/pieces.js       ← card types, standard wireframes per page type, shuffle rules
  assets/js/desk.js         ← playground: drag / resize / presets / PNG export
  assets/js/dialog.js       ← Let's Talk + Request dialog
  assets/js/turnstile.js    ← Cloudflare Turnstile spam check for the forms
  _headers                  ← security headers (CSP, etc.) applied by Cloudflare
  assets/vendor/html-to-image.js (MIT) ← renders the playground to PNG
functions/api/request.js    ← Pages Function: POST /api/request → email (request / talk / newsletter)
functions/api/config.js     ← Pages Function: GET /api/config → public settings (Turnstile site key)
wrangler.toml
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

## Deploy (GitHub → Cloudflare Pages)

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick the repo.
2. **Build settings:** framework **None**, build command **empty**, build output directory **`public`**,
   production branch **`main`** (every push to `main` goes live). The `functions/` folder is picked up automatically.
3. **Preview deployments:** set to *None* unless you need them — previews get public `*.pages.dev` URLs.
4. **Settings → Variables and Secrets** (Production only):

   | Name | Type | Value |
   | --- | --- | --- |
   | `RESEND_API_KEY` | **Secret** | Resend API key with *Sending access* limited to `qonicode.tech` |
   | `MAIL_FROM` | Text | e.g. `Qonicode <hello@qonicode.tech>` |
   | `MAIL_TO` | Text | optional, defaults to `qonita@qonicode.tech` |
   | `TURNSTILE_SITE_KEY` | Text | site key of your Turnstile widget (public by design) |
   | `TURNSTILE_SECRET` | **Secret** | secret key of the same widget |
   | `ALLOWED_ORIGINS` | Text | optional, e.g. `https://qonicode.tech,https://www.qonicode.tech` |

5. **Resend:** add and verify `qonicode.tech` (SPF/DKIM records go into Cloudflare DNS).
6. **Turnstile:** dashboard → *Turnstile* → *Add widget* → hostnames `qonicode.tech` (+ `www`, + your `*.pages.dev`
   if you test there), mode *Managed*. Put its site key and secret key in the variables above.
   Set both keys or neither — with only the secret, every form submission is rejected.
7. **Rate limit the form endpoint:** *Security → WAF → Rate limiting rules* → create rule:
   URI Path *equals* `/api/request` → 5 requests per 10 seconds per IP → *Block*.
8. **Domain & HTTPS:** *Custom domains* → add `qonicode.tech`; SSL/TLS *Full (strict)*, *Always Use HTTPS* on.
9. Redeploy after changing variables, then send yourself a Let's Talk, a Request and a newsletter signup.
   If something fails, check the deployment's *Functions → Real-time logs*.

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

Open http://localhost:5179. The email endpoint, Turnstile and the `_headers` rules only run on Cloudflare
(or with `npx wrangler pages dev public`); locally the forms show their fallback message.

## Placeholders to replace

- **Testimonials** (`#testimonials`): all six cards are placeholders (“Client name”, sample store type and project).
  Replace them with real quotes before going live, or remove the cards you don't have yet.
- Latest work: the four projects and their mock screens are examples.
- About: the striped box is a photo placeholder.

Service prices live in the `#services` cards in `index.html`. Each card's bag button opens Let's Talk with the
service name already in the message.
