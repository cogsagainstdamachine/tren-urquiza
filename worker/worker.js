// Delay reports for trenurquizahorarios.ar: the store every rider shares.
//
//   GET    /api/reports                        -> {reports:[{train,st,ts,exp,k,loc,d}]}
//   POST   /api/reports {train,st,dev,k,loc}   -> {report:{train,st,ts,exp,k,loc,d}}
//   DELETE /api/reports {train,dev}            -> {ok:true}
//
// A train is '2026-10-10|LC|18:00': the day, the direction (LC to Lacroze,
// LM to Lemos) and its departure from the terminal. st is the station index
// the rider is at. A day's reports live in one KV entry, "day:YYYY-MM-DD".
//
// k is what the rider says: 'no' (it has not come) or 'yes' (it has just left).
// loc is true when the rider's phone placed them at the station. d numbers the
// riders behind one train's reports (1, 2, 3...) without saying who they are.

// Running minutes from each terminal, copied from index.html (TM_LM, TM_LC).
// If they change there, change them here.
const TM_LM = [0, 2, 4, 5, 7, 9, 12, 14, 18, 20, 22, 24, 27, 29, 31, 33, 35, 37, 38, 39, 42, 44, 49];
const TM_LC = [48, 45, 43, 41, 39, 37, 34, 33, 29, 28, 26, 24, 21, 19, 17, 15, 13, 11, 9, 7, 5, 3, 0];

const REPORT_AFTER = 3;   // minutes overdue before a train can be reported
const PAST_WINDOW  = 30;  // minutes after its time that a train can still be reported
const LATE_WINDOW  = 60;  // the same, for a train that already has reports
const MIN_LIFE     = 10;  // a report lives at least this long when the terminal is close
const PER_IP_HOUR  = 8;   // reports and answers one address can send in an hour
const PER_DAY      = 500; // reports the whole line can hold in a day

const ALLOWED = /^(https:\/\/(www\.)?trenurquizahorarios\.ar|http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?)$/;

const json = (data, status, headers) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });

// Argentina is UTC-3 all year
function nowAR() {
  const d = new Date(Date.now() - 3 * 3600 * 1000);
  return { day: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

async function hash(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function readDay(env, day) {
  const list = (await env.REPORTS.get('day:' + day, 'json')) || [];
  const now = Date.now();
  return list.filter(r => r.exp > now);
}

const writeDay = (env, day, list) =>
  env.REPORTS.put('day:' + day, JSON.stringify(list), { expirationTtl: 36 * 3600 });

// What goes out: everything but the device, which becomes a number per train
function publish(list) {
  const seen = {};
  return list.map(r => {
    const devs = seen[r.train] || (seen[r.train] = []);
    if (!devs.includes(r.dev)) devs.push(r.dev);
    return { train: r.train, st: r.st, ts: r.ts, exp: r.exp, k: r.k || 'no', loc: !!r.loc, d: devs.indexOf(r.dev) + 1 };
  });
}

const edge = typeof caches !== 'undefined' && caches.default;
const cacheKey = (url, day) => new Request(url.origin + '/api/reports?day=' + day);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/reports') return json({ error: 'not found' }, 404);

    const origin = request.headers.get('Origin') || '';
    const cors = ALLOWED.test(origin) ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' } : {};
    const method = request.method;

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: {
        ...cors,
        'Access-Control-Allow-Methods': 'GET, POST, DELETE',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      } });
    }

    // One switch to turn the feature off without touching the page
    if (env.ENABLED === 'false') {
      return method === 'GET' ? json({ reports: [] }, 200, cors) : json({ error: 'off' }, 503, cors);
    }

    const { day, min } = nowAR();

    if (method === 'GET') {
      // The same answer for every rider, so the edge can hold it for a few seconds
      const key = cacheKey(url, day);
      if (edge && !origin) {
        const hit = await edge.match(key);
        if (hit) return hit;
      }
      const list = await readDay(env, day);
      const res = json(
        { reports: publish(list) },
        200,
        { ...cors, 'Cache-Control': 'public, max-age=0, s-maxage=15' },
      );
      if (edge && !origin) ctx.waitUntil(edge.put(key, res.clone()));
      return res;
    }

    if (method !== 'POST' && method !== 'DELETE') return json({ error: 'method' }, 405, cors);
    if (!ALLOWED.test(origin)) return json({ error: 'origin' }, 403);

    let body;
    try { body = JSON.parse((await request.text()).slice(0, 400)); } catch (e) { return json({ error: 'json' }, 400, cors); }

    const train = String(body.train || '');
    const dev = String(body.dev || '');
    const m = /^(\d{4}-\d{2}-\d{2})\|(LC|LM)\|(\d{2}):(\d{2})$/.exec(train);
    if (!m || m[1] !== day || !/^[a-z0-9-]{6,40}$/.test(dev)) return json({ error: 'request' }, 400, cors);

    if (method === 'DELETE') {
      const list = await readDay(env, day);
      const kept = list.filter(r => !(r.train === train && r.dev === dev));
      if (kept.length !== list.length) {
        await writeDay(env, day, kept);
        if (edge) ctx.waitUntil(edge.delete(cacheKey(url, day)));
      }
      return json({ ok: true }, 200, cors);
    }

    // The train has to be due at that station, and overdue, right now
    const st = body.st;
    if (!Number.isInteger(st) || st < 0 || st > 22) return json({ error: 'station' }, 400, cors);
    const toLacroze = m[2] === 'LC';
    const off   = toLacroze ? TM_LM[st] : TM_LC[st];
    const total = toLacroze ? TM_LM[22] : TM_LC[0];
    if (off >= total) return json({ error: 'station' }, 400, cors);
    const late = min - (Number(m[3]) * 60 + Number(m[4]) + off);
    const k = body.k === 'yes' ? 'yes' : 'no';

    // A ceiling per address. Only a short hash is kept, and for an hour.
    const ip = request.headers.get('CF-Connecting-IP') || 'local';
    const ipKey = 'ip:' + await hash(ip + '|' + day + '|' + Math.floor(min / 60));
    const used = parseInt(await env.REPORTS.get(ipKey), 10) || 0;
    if (used >= PER_IP_HOUR) return json({ error: 'too many' }, 429, cors);

    const list = await readDay(env, day);
    const forTrain = list.filter(r => r.train === train);
    const mine = forTrain.filter(r => r.dev === dev);

    // A first report has 30 minutes after the train's time. Once a train has
    // reports, riders can keep answering for an hour.
    const open = forTrain.length ? LATE_WINDOW : PAST_WINDOW;
    if (late < REPORT_AFTER || late > open + 2) return json({ error: 'not overdue' }, 422, cors);

    // "It has left" only answers a report someone made. One of each per rider,
    // and no going back to "not yet" after saying it left.
    if (k === 'yes' && !forTrain.length) return json({ error: 'nothing to answer' }, 422, cors);
    if (mine.some(r => (r.k || 'no') === k || r.k === 'yes')) return json({ error: 'already reported' }, 409, cors);
    if (list.length >= PER_DAY) return json({ error: 'full' }, 429, cors);

    // Until the train would reach the terminal from here: it has not come ('no')
    // or it left just now ('yes'), so it cannot get there sooner.
    const ts = Date.now();
    const stored = { train, st, ts, exp: ts + Math.max(total - off, MIN_LIFE) * 60000, k, loc: body.loc === true, dev };
    list.push(stored);
    await writeDay(env, day, list);
    await env.REPORTS.put(ipKey, String(used + 1), { expirationTtl: 3600 });
    if (edge) ctx.waitUntil(edge.delete(cacheKey(url, day)));

    const report = publish(list.filter(r => r.train === train)).find(r => r.ts === ts && r.k === k);
    return json({ report }, 201, cors);
  },
};
