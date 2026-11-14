// xkelamkabut link opener (Cloudflare Worker: https://xkk-links.joliecodes.workers.dev/)
// ?u=<map link>  opens a short link and returns Google's address and exact coordinates
// ?a=<address>   returns exact coordinates for an address
// GOOGLE_KEY is a secret set in Cloudflare (Settings > Variables and Secrets), never in this file.
const ALLOWED_HOSTS = /(^|\.)(goo\.gl|maps\.app\.goo\.gl|g\.co|google\.[a-z.]+|waze\.com|maps\.apple\.com|apple\.co)$/i;
const ALLOWED_ORIGINS = ['https://joliecodes.github.io', 'http://localhost:8766'];

const coordsIn = u => {
  const m = u.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || u.match(/[?&](?:q|ll|query|center)=(-?\d+\.\d+)(?:,|%2C)\s*(-?\d+\.\d+)/) || u.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  return m ? { lat: +m[1], lon: +m[2] } : null;
};

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'GET',
      'Content-Type': 'application/json; charset=utf-8',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const params = new URL(request.url).searchParams;
    let url = params.get('u') || '', text = params.get('a') || '';
    try {
      for (let hop = 0; url && hop < 6; hop++) {
        if (!ALLOWED_HOSTS.test(new URL(url).hostname)) break;
        const res = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0' } });
        const next = res.headers.get('Location');
        if (!next) break;
        url = new URL(next, url).toString();
      }
      if (url) {
        const u = new URL(url);
        if (u.pathname.includes('/sorry/') && u.searchParams.get('continue')) url = u.searchParams.get('continue');
      }
      let at = url ? coordsIn(url) : null;
      if (url && !text) {
        const u = new URL(url);
        text = u.searchParams.get('q') || u.searchParams.get('query') || (decodeURIComponent(u.pathname).match(/\/maps\/place\/([^/]+)/) || [])[1] || '';
        text = text.replace(/\+/g, ' ');
      }
      let address = '', google = env.GOOGLE_KEY ? '' : 'no GOOGLE_KEY secret';
      if (!at && text && env.GOOGLE_KEY) {
        const tries = [text, text.split(',').slice(1).join(',').trim()].filter(Boolean);
        for (const t of tries) {
          const g = await (await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(t)}&key=${env.GOOGLE_KEY}`)).json();
          google = g.status + (g.error_message ? ': ' + g.error_message : '');
          const r = g.results && g.results[0];
          if (r) { at = { lat: r.geometry.location.lat, lon: r.geometry.location.lng }; address = r.formatted_address; break; }
        }
      }
      return new Response(JSON.stringify({ url, text, address, google, ...(at || {}) }), { headers: cors });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Could not open that link', detail: String(e) }), { status: 400, headers: cors });
    }
  },
};
