/* Worker entry: routes the form API, everything else is a static file from public/. */
import { onRequestPost as postRequest } from '../functions/api/request.js';
import { onRequestGet as getConfig } from '../functions/api/config.js';

const notAllowed = (allow) => new Response('Method not allowed', { status: 405, headers: { Allow: allow } });

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === '/api/request') {
      return request.method === 'POST' ? postRequest({ request, env }) : notAllowed('POST');
    }
    if (pathname === '/api/config') {
      return request.method === 'GET' ? getConfig({ env }) : notAllowed('GET');
    }
    if (pathname.startsWith('/api/')) return new Response('Not found', { status: 404 });

    return env.ASSETS.fetch(request);
  },
};
