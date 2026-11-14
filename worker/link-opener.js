// xkelamkabut link opener (Cloudflare Worker, deployed as https://xkk-links.joliecodes.workers.dev/)
// Turns a short map link (maps.app.goo.gl/…) into the full link with coordinates.
// Only map links, only for the app. Nothing is stored.
const ALLOWED_HOSTS = /(^|\.)(goo\.gl|maps\.app\.goo\.gl|g\.co|google\.[a-z.]+|waze\.com|maps\.apple\.com|apple\.co)$/i;
const ALLOWED_ORIGINS = ['https://joliecodes.github.io', 'http://localhost:8766'];

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'GET',
      'Content-Type': 'application/json',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    let url = new URL(request.url).searchParams.get('u') || '';
    try {
      for (let hop = 0; hop < 6; hop++) {
        const host = new URL(url).hostname;
        if (!ALLOWED_HOSTS.test(host)) break;
        const res = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0' } });
        const next = res.headers.get('Location');
        if (!next) break;
        url = new URL(next, url).toString();
      }
      return new Response(JSON.stringify({ url }), { headers: cors });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Could not open that link' }), { status: 400, headers: cors });
    }
  },
};
