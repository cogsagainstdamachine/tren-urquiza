// Runs worker.js on this computer for testing, with reports kept in memory.
//   node worker/dev.mjs     -> http://localhost:8787/api/reports
// The page uses this address whenever it is not on the real domain.
import http from 'node:http';
import worker from './worker.js';

const store = new Map();
const env = {
  ENABLED: 'true',
  REPORTS: {
    async get(key, type) {
      const v = store.get(key);
      if (!v || (v.until && v.until < Date.now())) return null;
      return type === 'json' ? JSON.parse(v.value) : v.value;
    },
    async put(key, value, opts = {}) {
      store.set(key, { value, until: opts.expirationTtl ? Date.now() + opts.expirationTtl * 1000 : 0 });
    },
  },
};

http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS';
  const request = new Request('http://' + req.headers.host + req.url, {
    method: req.method,
    headers: req.headers,
    body: hasBody ? Buffer.concat(chunks) : undefined,
  });
  const out = await worker.fetch(request, env, { waitUntil() {} });
  res.writeHead(out.status, Object.fromEntries(out.headers));
  res.end(Buffer.from(await out.arrayBuffer()));
}).listen(8787, '0.0.0.0', () => console.log('reports API on http://localhost:8787/api/reports'));
