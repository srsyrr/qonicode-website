# Qonicode — agency site with a layout desk

Static site (plain HTML/CSS/JS, no build step) for **Cloudflare Pages**, deployed from GitHub.
The centerpiece is the **layout desk**: visitors drag paper wireframe pieces onto a page, then save it as a PNG
or send it to `qonita@qonicode.tech`.

```
public/                     ← what Cloudflare serves
  index.html
  assets/css/style.css
  assets/js/pieces.js       ← paper pieces, 8 standard wireframes, shuffle rules
  assets/js/desk.js         ← drag / resize / presets / PNG export / request dialog
  assets/vendor/html-to-image.js (MIT) ← renders the desk to PNG
functions/api/request.js    ← Pages Function: POST /api/request → email with the PNG attached
wrangler.toml
```

## Layout desk

| Control | What it does |
| --- | --- |
| ⬇ (save) | Downloads the page as `qonicode-layout.png`. |
| Shuffle | Builds a random but sensible layout (menu on top, footer at the bottom). |
| Request | Opens a form (name, email, store URL, notes) and emails the PNG + layout JSON to the studio. |
| ← → | Steps through the 8 standard wireframes in `pieces.js` (`PRESETS`). |
| add a piece | Drops a new paper piece on the desk. |

Pieces can overlap. Dropping a piece on the page straightens it and grows it to full size; dragging it back to the
desk shrinks it again. The yellow corner resizes, the pink × removes. Keyboard: arrows move, Enter puts a piece on the
page (or back), Delete removes. The arrangement is kept in the visitor's browser (localStorage).

To add or change a standard wireframe, edit `PRESETS` (list of rows) or `ROWS` in `public/assets/js/pieces.js`.

## Deploy (GitHub → Cloudflare Pages)

1. Push this folder to a GitHub repository.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick the repo.
3. Build settings: framework **None**, build command **empty**, build output directory **`public`**.
   The `functions/` folder is picked up automatically.
4. **Settings → Variables and Secrets** (Production):
   - `RESEND_API_KEY` — secret, from [resend.com](https://resend.com) → API keys
   - `MAIL_FROM` — e.g. `Qonicode Desk <desk@qonicode.tech>`
   - `MAIL_TO` — optional, defaults to `qonita@qonicode.tech`
5. In Resend, add and verify the domain `qonicode.tech` (it gives you DNS records to add in Cloudflare), so `MAIL_FROM` is allowed to send.
6. Redeploy after adding variables.

Until the variables are set, **Request** shows a fallback: download the PNG and email it manually.

## Local preview

```bash
python -m http.server 5179 --directory public
```

Open http://localhost:5179. The email endpoint only runs on Cloudflare (or with `npx wrangler pages dev public`).
