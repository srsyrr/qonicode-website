# QoniCode website

Static one-page "coming soon" site. No build step: `index.html` is the whole site.

## How to edit

- **Text:** change the `<h1>` (tagline) and the `<p>` under it (method line) in `index.html`.
- **Colors:** edit the five values at the top of the `<style>` block (`:root`).
- **Font:** Viga (Google Fonts), loaded in `<head>`. Viga has one weight, so keep `font-weight: 400`.

## Brand rules

| Name | Hex | Use |
|---|---|---|
| Ivory | `#fbfcee` | Page background |
| Drab Dark Brown | `#343b1b` | Text |
| Vanilla | `#f6e6a5` | Badge |
| Tea Green | `#c8d69b` | Accent bar (fills only, not text) |
| Celtic Blue | `#3971b8` | The letter **Q** only |

## Current copy

- Tagline: Email automation that finds your customers well.
- Method line: Rule-based email flows for online stores, tested before they go live.

## Deploy

Hosted on Cloudflare. Domain: `qonicode.tech`.
Best setup: connect this repo to Cloudflare so every push to `main` redeploys automatically.
