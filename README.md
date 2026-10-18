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
  assets/vendor/html-to-image.js (MIT) ← renders the playground to PNG
functions/api/request.js    ← Pages Function: POST /api/request → email (request / talk / newsletter)
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

1. Push this folder to a GitHub repository.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick the repo.
3. Build settings: framework **None**, build command **empty**, build output directory **`public`**.
   The `functions/` folder is picked up automatically.
4. **Settings → Variables and Secrets** (Production):
   - `RESEND_API_KEY` — secret, from [resend.com](https://resend.com) → API keys
   - `MAIL_FROM` — e.g. `Qonicode <hello@qonicode.tech>`
   - `MAIL_TO` — optional, defaults to `qonita@qonicode.tech`
5. In Resend, add and verify the domain `qonicode.tech` (it gives you DNS records to add in Cloudflare), so `MAIL_FROM` is allowed to send.
6. Redeploy after adding variables.

Until the variables are set, the dialogs show a fallback (download the PNG / email us directly).

## Local preview

```bash
python -m http.server 5179 --directory public
```

Open http://localhost:5179. The email endpoint only runs on Cloudflare (or with `npx wrangler pages dev public`).

## Placeholders to replace

- Latest work: the four projects and their mock screens are examples.
- About: the striped box is a photo placeholder.
