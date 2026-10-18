/* Cloudflare Pages Function: GET /api/config
   Public settings the front end needs at runtime, so they live in the Cloudflare dashboard
   instead of the repo. Only public values belong here (the Turnstile site key is public by design).
     TURNSTILE_SITE_KEY — optional; when set, the forms show a Turnstile check */

export function onRequestGet({ env }) {
  return new Response(JSON.stringify({ turnstileSiteKey: env.TURNSTILE_SITE_KEY || '' }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
  });
}
