/* Cloudflare Turnstile (spam check) for the site's forms.
   The site key comes from /api/config (set TURNSTILE_SITE_KEY in Cloudflare). Without it — e.g. when
   previewing locally — nothing loads and forms send without a token. */

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let ready;

function setup() {
  if (ready) return ready;
  ready = fetch('/api/config', { headers: { Accept: 'application/json' } })
    .then((res) => (res.ok ? res.json() : {}))
    .catch(() => ({}))
    .then(({ turnstileSiteKey }) => {
      if (!turnstileSiteKey) return null;
      return new Promise((resolve) => {
        if (window.turnstile) return resolve({ api: window.turnstile, siteKey: turnstileSiteKey });
        const s = document.createElement('script');
        s.src = SCRIPT;
        s.async = true;
        s.onload = () => resolve({ api: window.turnstile, siteKey: turnstileSiteKey });
        s.onerror = () => { console.error('Turnstile failed to load'); resolve(null); };
        document.head.appendChild(s);
      });
    });
  return ready;
}

/* Renders a widget into `container` (shown only if Cloudflare needs the visitor to interact).
   Returns { enabled, token(), reset() }; when Turnstile isn't configured, enabled is false. */
export async function mountTurnstile(container) {
  const off = { enabled: false, token: () => '', waitToken: async () => '', reset: () => {} };
  if (!container) return off;
  const ts = await setup();
  if (!ts || !ts.api) return off;
  const id = ts.api.render(container, { sitekey: ts.siteKey, appearance: 'interaction-only', theme: 'light' });
  const token = () => ts.api.getResponse(id) || '';
  return {
    enabled: true,
    token,
    // The check usually finishes in a second or two; give a fast submitter a moment before giving up.
    async waitToken(timeout = 6000) {
      const end = Date.now() + timeout;
      while (!token() && Date.now() < end) await new Promise((r) => setTimeout(r, 200));
      return token();
    },
    reset: () => ts.api.reset(id),
  };
}
