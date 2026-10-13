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

## Draft site v2 (branch `site-v2`)

Full one-page site (hero, steps, principles, FAQ, free Journey request form). Not merged to `main` yet.

Before merging to `main` (auto-deploys to qonicode.tech):

1. Replace `WEB3FORMS_KEY` in `index.html` with the real Web3Forms access key. Forms do not work until then.
2. Add the logo (still missing).
3. Check the copy: v1 positioning was "email automation"; v2 is the free Ad-to-Checkout Journey.
