/* NOOR · a shared stand in for the world the Soul lives in.
   ---------------------------------------------------------------------------
   tests/soul-tools.mjs and tests/soul-door.mjs both drive the real soul
   modules (api/_soul.js, _hands.js, _council.js, _mind.js, _evolve.js,
   _instruments.js and the door api/soul.js) against:
     an in-memory Redis behind a stubbed fetch, reached through the ordinary
       api/_kv.js REST door, so every store command runs for real;
     a router stub that answers by role (strategist, guardian, skeptic,
       reflector);
     the house's readers (the Observatory, the insights, the slot records)
       handed in through seams.deps;
     a network table: a test registers a handler for a URL prefix (the live
       site, PageSpeed, YouTube, IndexNow, the AI Gateway's Jev) and any URL
       with no handler throws "no network in this test", so nothing real is
       ever reached.
   Import this file BEFORE any api module: it sets the environment first.
*/
import crypto from 'node:crypto';

process.env.ADMIN_SECRET = 'test-admin-secret-soul-000000';
process.env.CRON_SECRET = 'test-cron-secret-soul-1111';
process.env.KV_REST_API_URL = 'https://kv.soul.test';
process.env.KV_REST_API_TOKEN = 'kv-token';
for (const k of ['REDIS_URL', 'KV_URL', 'SOUL_MONTHLY_USD', 'AI_GATEWAY_API_KEY', 'VERCEL_OIDC_TOKEN', 'PSI_API_KEY',
  'YT_CLIENT_ID', 'YT_CLIENT_SECRET', 'YT_REFRESH_TOKEN', 'TG_BOT_TOKEN', 'TG_CHAT_ID', 'SITE_HOST']) delete process.env[k];

/* ---------------------------------------------------------------- the store */
export const S = new Map(), L = new Map(), H = new Map();
/* round six: sorted sets (the mailbox's letters set for later), member to score */
export const Z = new Map();
export const EVAL = { calls: 0 };
export const LOG = [];
export const FAULT = { all: false, cmds: null, key: null };
const lrange = (arr, a, b) => { const n = arr.length; let s = +a, e = +b; if (s < 0) s = Math.max(0, n + s); if (e < 0) e = n + e; return arr.slice(s, e + 1); };
function run(c) {
  const [op0, ...a] = c; const op = String(op0).toUpperCase();
  switch (op) {
    case 'GET': return S.has(a[0]) ? S.get(a[0]) : null;
    case 'SET': {
      let nx = false; for (let i = 2; i < a.length; i++) { const f = String(a[i]).toUpperCase(); if (f === 'NX') nx = true; if (f === 'EX' || f === 'PX') i++; }
      if (nx && S.has(a[0])) return null;
      S.set(a[0], String(a[1])); return 'OK';
    }
    case 'DEL': { let n = 0; for (const k of a) { if (S.delete(k)) n++; if (L.delete(k)) n++; if (H.delete(k)) n++; if (Z.delete(k)) n++; } return n; }
    case 'MGET': return a.map(k => S.has(k) ? S.get(k) : null);
    case 'INCR': case 'INCRBY': case 'DECR': case 'DECRBY': {
      const by = op === 'INCR' ? 1 : op === 'DECR' ? -1 : op === 'INCRBY' ? +a[1] : -a[1];
      const v = (parseInt(S.get(a[0]) || '0', 10) || 0) + by; S.set(a[0], String(v)); return v;
    }
    case 'EXPIRE': return 1;
    case 'LPUSH': { const l = L.get(a[0]) || []; for (const v of a.slice(1)) l.unshift(String(v)); L.set(a[0], l); return l.length; }
    case 'RPUSH': { const l = L.get(a[0]) || []; for (const v of a.slice(1)) l.push(String(v)); L.set(a[0], l); return l.length; }
    case 'LRANGE': return lrange(L.get(a[0]) || [], a[1], a[2]);
    case 'LTRIM': { const l = L.get(a[0]) || []; L.set(a[0], lrange(l, a[1], a[2])); return 'OK'; }
    case 'LINDEX': { const l = L.get(a[0]) || []; let i = +a[1]; if (i < 0) i = l.length + i; return l[i] === undefined ? null : l[i]; }
    case 'LSET': { const l = L.get(a[0]) || []; l[+a[1]] = String(a[2]); return 'OK'; }
    case 'LPOP': { const l = L.get(a[0]) || []; return l.length ? l.shift() : null; }
    case 'LLEN': return (L.get(a[0]) || []).length;
    /* mail: a thread moved to the head of its list (api/_mail.js) */
    case 'LREM': { const l = L.get(a[0]) || [], cnt = Math.abs(+a[1]), v = String(a[2]); let n = 0; const out = [];
      for (const x of l) { if (x === v && (!cnt || n < cnt)) { n++; continue; } out.push(x); } L.set(a[0], out); return n; }
    case 'HGETALL': { const h = H.get(a[0]); const out = []; if (h) for (const [k, v] of h) out.push(k, v); return out; }
    case 'HGET': { const h = H.get(a[0]); return h && h.has(a[1]) ? h.get(a[1]) : null; }
    case 'HSET': { const h = H.get(a[0]) || new Map(); for (let i = 1; i + 1 < a.length; i += 2) h.set(a[i], String(a[i + 1])); H.set(a[0], h); return 1; }
    case 'HDEL': { const h = H.get(a[0]); return h && h.delete(a[1]) ? 1 : 0; }
    case 'HINCRBY': { const h = H.get(a[0]) || new Map(); const v = (parseInt(h.get(a[1]) || '0', 10) || 0) + +a[2]; h.set(a[1], String(v)); H.set(a[0], h); return v; }
    case 'KEYS': { const rx = new RegExp('^' + String(a[0]).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'); return [...S.keys(), ...L.keys(), ...H.keys(), ...Z.keys()].filter(k => rx.test(k)); }
    case 'EXISTS': return a.filter(k => S.has(k) || L.has(k) || H.has(k) || Z.has(k)).length;
    case 'ZADD': { const z = Z.get(a[0]) || new Map(); let n = 0; for (let i = 1; i + 1 < a.length; i += 2) { if (!z.has(String(a[i + 1]))) n++; z.set(String(a[i + 1]), +a[i]); } Z.set(a[0], z); return n; }
    case 'ZREM': { const z = Z.get(a[0]); if (!z) return 0; let n = 0; for (const m of a.slice(1)) if (z.delete(String(m))) n++; return n; }
    case 'ZCARD': return (Z.get(a[0]) || new Map()).size;
    case 'ZSCORE': { const z = Z.get(a[0]); return z && z.has(String(a[1])) ? String(z.get(String(a[1]))) : null; }
    case 'ZRANGEBYSCORE': {
      const z = Z.get(a[0]) || new Map(); const lo = a[1] === '-inf' ? -Infinity : +a[1], hi = a[2] === '+inf' ? Infinity : +a[2];
      let out = [...z].filter(([, sc]) => sc >= lo && sc <= hi).sort((x, y) => x[1] - y[1] || (x[0] < y[0] ? -1 : 1)).map(([m]) => m);
      const li = a.findIndex(x => String(x).toUpperCase() === 'LIMIT'); if (li > 0) out = out.slice(+a[li + 1], +a[li + 1] + +a[li + 2]);
      return out;
    }
    /* the two scripts api/_soul.js runs, by their tag line: compare and
       delete (a lock released only by its holder) and compare and set (a
       goals write only on the version it read). EVAL.calls counts them. */
    case 'EVAL': {
      EVAL.calls++;
      const script = String(a[0]), nk = +a[1], keys = a.slice(2, 2 + nk), argv = a.slice(2 + nk);
      if (/noor:cad/.test(script)) { if (S.get(keys[0]) === argv[0]) { S.delete(keys[0]); return 1; } return 0; }
      if (/noor:cas/.test(script)) {
        if ((S.has(keys[1]) ? S.get(keys[1]) : '') !== String(argv[0])) return -1;
        S.set(keys[0], String(argv[1]));
        const v = (parseInt(S.get(keys[1]) || '0', 10) || 0) + 1; S.set(keys[1], String(v)); return v;
      }
      throw new Error('the stub store does not know this script');
    }
    default: throw new Error('the stub store does not know ' + op);
  }
}
export function resetStore() { S.clear(); L.clear(); H.clear(); Z.clear(); LOG.length = 0; FAULT.all = false; FAULT.cmds = null; FAULT.key = null; }

/* ---------------------------------------------------------------- the network */
export const NET = { handlers: [], calls: [] };
export function onNet(prefix, fn) { NET.handlers.unshift({ prefix, fn }); }
export function clearNet() { NET.handlers.length = 0; NET.calls.length = 0; }
export const netCalls = prefix => NET.calls.filter(c => c.url.startsWith(prefix));
/* a response the way fetch gives one */
export function resp(status, body, headers) {
  const h = Object.fromEntries(Object.entries(headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return { ok: status >= 200 && status < 300, status, headers: { get: k => h[String(k).toLowerCase()] ?? null },
    json: async () => JSON.parse(text), text: async () => text };
}
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.startsWith(process.env.KV_REST_API_URL) && u.endsWith('/pipeline')) {
    const cmds = JSON.parse(init.body);
    LOG.push(cmds.map(c => String(c[0]).toUpperCase()));
    if (FAULT.all || (FAULT.cmds && cmds.some(c => FAULT.cmds.has(String(c[0]).toUpperCase()))) || (FAULT.key && cmds.some(c => FAULT.key.test(String(c[1] || '')))))
      return { ok: false, status: 500, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => cmds.map(c => ({ result: run(c) })) };
  }
  const h = NET.handlers.find(x => u.startsWith(x.prefix));
  NET.calls.push({ url: u, method: init.method || 'GET', body: init.body || null, headers: init.headers || {} });
  if (!h) throw new Error('no network in this test: ' + u);
  return h.fn(u, init);
};

/* ---------------------------------------------------------------- the modules */
export const SOUL = await import('../api/_soul.js');
export const HANDS = await import('../api/_hands.js');
export const COUNCIL = await import('../api/_council.js');
export const MIND = await import('../api/_mind.js');
export const EVOLVE = await import('../api/_evolve.js');
export const INST = await import('../api/_instruments.js');
export const LINEUP = await import('../api/_lineup.js');
export const DOOR = await import('../api/soul.js');

export const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
export const realToday = new Date().toISOString().slice(0, 10);
export const CLOCK = { t: Date.parse(realToday + 'T05:30:00Z') };
export const NOTIFY = [];
SOUL.setSeams({ now: () => CLOCK.t, notify: async text => { NOTIFY.push(text); return { ok: true }; } });
export const today = () => new Date(CLOCK.t).toISOString().slice(0, 10);
export const setDay = (date, hhmm) => { CLOCK.t = Date.parse(date + 'T' + (hhmm || '05:30') + ':00Z'); };

export const MANIFEST = [
  { id: 'light-dawn', kind: 'light', slot: 'morning', hook: 'At dawn' },
  { id: 'light-noon', kind: 'light', slot: 'noon', hook: 'At noon' },
  { id: 'light-eve', kind: 'light', slot: 'evening', hook: 'At dusk' },
  { id: 'verse-fatiha', kind: 'verse', secs: 18, hook: 'The Opening' },
  { id: 'verse-kursi', kind: 'verse', secs: 35, hook: 'The Throne' },
  { id: 'verse-nur', kind: 'verse', secs: 25, hook: 'Light upon light' },
  { id: 'verse-ikhlas', kind: 'verse', secs: 12, hook: 'Sincerity' },
  { id: 'verse-asr', kind: 'verse', secs: 14, hook: 'By time' },
  { id: 'verse-duha', kind: 'verse', secs: 22, hook: 'The morning light' },
  { id: 'word-sabr', kind: 'word', hook: 'Patience' },
  { id: 'word-shukr', kind: 'word', hook: 'Gratitude' },
  { id: 'word-rahma', kind: 'word', hook: 'Mercy' }
];
export const OBS = () => ({
  ok: true, at: new Date(CLOCK.t).toISOString(),
  summary: {
    networks: [
      { net: 'instagram', posts: 30, reach: 12000, views: null, engagement: 0.05 },
      { net: 'facebook', posts: 30, reach: 3000, views: null },
      { net: 'youtube', posts: 12, reach: null, views: 4000 },
      { net: 'threads', posts: 0, reach: null, views: null }
    ],
    visitors: { value: 420 }, posts: { value: 60 }
  },
  missingToken: { threads: true },
  byKind: [{ kind: 'reel:verse', label: 'verse reels', thisWeek: { posts: 12, reach: 1204 } }, { kind: 'reel:word', label: 'word reels', thisWeek: { posts: 9, reach: 640 } }],
  notes: ['Verse reels reach most this week.'],
  learn: { sentences: [] },
  experiment: null,
  postingHealth: { days: Array.from({ length: 9 }, (_, i) => ({ date: addDays(today(), i - 8), sent: 9, partial: 0, failed: i === 3 ? 1 : 0, pending: 0, none: 1 })) }
});
export const DEPS = {
  hijri: null,
  observatory: async () => OBS(),
  observatoryInvalidate: async () => {},
  insightsRead: async () => ({ ok: true,
    igRows: [{ watched: 0.4, watch: 8000, reach: 1500, title: 'The Throne verse', kind: 'reel:verse', date: addDays(today(), -2) },
      { watched: 0.5, watch: 10000, reach: 900, title: 'Patience', kind: 'reel:word', date: addDays(today(), -3) },
      { watched: 0.3, watch: 6000, reach: 400, title: 'At dawn', kind: 'reel:light', date: addDays(today(), -4) }],
    sentences: ['Verse reels hold attention.'],
    learn: { sentences: [], watchByKind: [{ kind: 'reel:verse', label: 'verse reels', n: 12, watched: 0.45, watchSecs: 9 }], verseByLength: [] } }),
  insightsNumbers: async () => ({ ok: true, byNetwork: [], byKind: [] }),
  insightsRefresh: async () => ({ ok: true, fetched: 3 }),
  computeVisitors: async () => ({ totals: { people30: 900 } }),
  manifest: async () => MANIFEST,
  readSlot: async (d, s) => { const v = S.get('nsoc:slot:' + d + '#' + s); return v ? JSON.parse(v) : null; },
  recentlyPostedRaw: async () => new Map(),
  recentlyPosted: async () => new Map(),
  dayContext: async (date, seen) => ({ cards: MANIFEST, hijri: null, bias: null, seen }),
  teachGuard: async () => ({ ok: true, taught: [] }),
  revertTaught: async () => ({ ok: true })
};
SOUL.setSeams({ deps: DEPS, files: { manifest: { cards: MANIFEST } } });

/* the router: one answer per role, by the ROLE line every prompt opens with */
export const ROUTER = { calls: [], plan: '{"intents":[]}', reflect: '{"lessons":[],"goals":[],"upgrades":[]}', guardian: 'approve', skeptic: 'approve', failRoles: new Set() };
const roleOf = task => { const m = /ROLE: (\w+)/.exec(String(task.messages[0] && task.messages[0].content)); return m ? m[1] : '?'; };
SOUL.setSeams({ route: async task => {
  const role = roleOf(task);
  ROUTER.calls.push({ role, tier: task.tier, messages: task.messages });
  const tier = task.tier === 'deep' ? 'fast' : task.tier;
  if (ROUTER.failRoles.has(role)) return { ok: false, error: 'no free model answered', tier };
  const say = content => ({ ok: true, content, tier, model: 'stub-' + role, usage: {} });
  if (role === 'strategist') return say(typeof ROUTER.plan === 'function' ? ROUTER.plan(task) : ROUTER.plan);
  if (role === 'reflector') return say(ROUTER.reflect);
  if (role === 'skeptic') return say(JSON.stringify({ vote: ROUTER.skeptic, reasons: ['the stub skeptic'] }));
  if (role === 'guardian') {
    if (ROUTER.guardian !== 'smart') return say(JSON.stringify({ vote: ROUTER.guardian, reasons: ['the stub guardian'] }));
    /* the canaries' own bad cases are rejected, everything else approved */
    const user = String(task.messages[1].content);
    const intentText = user.slice(user.indexOf('INTENT:'), user.indexOf('EVIDENCE'));
    /* 3 October 2026: and Article 11's four (a pop up, ads, Paradise for an amount, a paywall) */
    /* mail: 6 October 2026, and Article 12's five (money promised, a mosque
       pressured, a ruling, an address taken from a reader, an injected order) */
    const bad = [/post-now/, /delete-post/, /dm-campaign/, /Bukhari/, /face/i, /Raise the monthly model budget/,
      /pop up asking/, /display advertisements/, /guarantees them Paradise/, /behind a monthly payment/,
      /will donate 500 dollars/, /Mosques that do not share them/, /NOOR Codex of Light rules that/, /a reader mentioned in a question/, /the list of the givers you asked for/].some(rx => rx.test(intentText));
    return say(JSON.stringify({ vote: bad ? 'reject' : 'approve', reasons: [bad ? 'crosses the constitution' : 'within the constitution'] }));
  }
  return { ok: false, error: 'unknown role ' + role, tier };
} });
export const rolesAsked = () => ROUTER.calls.map(c => c.role);

/* Jev through the AI Gateway's Decision API (round four, 7 October 2026:
   POST /v1/evaluate, the docs' own shapes): score(k, body) gives a boolean
   its probability; choose(k, body) gives a choice {choice, probabilities};
   rate(k, body) gives a score its number. A question with no answer is left
   out, which the house reads as an incomplete verdict. */
export const JEV_URL = 'https://ai-gateway.vercel.sh/v1/evaluate';
export const JEV = { mode: 'off', score: () => 0.05, choose: () => null, rate: () => null, bodies: [] };
onNet(JEV_URL, async (u, init) => {
  const body = JSON.parse(init.body);
  JEV.bodies.push(body);
  if (JEV.mode === 'down') throw new Error('ECONNREFUSED');
  const answers = {};
  for (const [k, q] of Object.entries(body.questions || {})) {
    if (q.type === 'choice') { const c = JEV.choose(k, body); if (c) answers[k] = { type: 'choice', choice: c.choice, probabilities: c.probabilities || { [c.choice]: 1 } }; continue; }
    if (q.type === 'score') { const v = JEV.rate(k, body); if (v != null) answers[k] = { type: 'score', score: v, probabilities: {} }; continue; }
    const v = JEV.score(k, body); if (v != null) answers[k] = { type: 'boolean', probability: v };
  }
  return resp(200, { model: 'typesafe-ai/jev', answers, usage: { inputTokens: 300, outputTokens: 20 }, providerMetadata: { gateway: { cost: '0.000012' } } });
});
export function jevOn(score, more) { process.env.AI_GATEWAY_API_KEY = 'gw-test-key'; JEV.mode = 'on'; JEV.score = score || (() => 0.05);
  JEV.choose = (more && more.choose) || (() => null); JEV.rate = (more && more.rate) || (() => null); }
export function jevOff() { delete process.env.AI_GATEWAY_API_KEY; JEV.mode = 'off'; JEV.choose = () => null; JEV.rate = () => null; }

export const APPROVED = { verdicts: { guardian: { vote: 'approve' }, auditor: { vote: 'approve' }, skeptic: { vote: 'approve' } } };
export function fakeRes() {
  return { statusCode: 0, body: null, sent: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; }, send(b) { this.sent = b; return this; }, end(b) { this.sent = b; return this; } };
}
function cookieFor(secret) {
  const exp = Date.now() + 100000;
  const sig = crypto.createHmac('sha256', secret).update(String(exp)).digest('hex');
  return 'noor_admin=' + exp + '.' + sig;
}
export const AUTH = { cookie: cookieFor(process.env.ADMIN_SECRET) };
export async function door(req) { const r = fakeRes(); await DOOR.default({ method: 'GET', query: {}, headers: {}, ...req }, r); return r; }

/* a whole snapshot for a day, as buildSnapshot would have saved it */
export function snapFor(date, over = {}) {
  const base = {
    date, at: date + 'T05:30:00.000Z', northStar: 19000,
    reach: { instagram: 12000, youtube: 4000, facebook: 3000, threads: null, telegram: null, total: 19000 },
    site: { visitors7: 420, arrivals: { search: 30, social: 50, direct: 15, other: 5, total: 100 }, searchShare: 0.3, returningShare: null },
    attention: { watchedMedian: 0.4, watchSecsMedian: 8, n: 3 },
    output: { posts7: 60, health: 0.98, sent: 60, due: 61 },
    learning: { experiment: null, lastTest: null, lessons: 0 },
    spend: { usd: 1, capUsd: 10 },
    missing: { 'reach.threads': 'no token for threads on this deployment', 'reach.telegram': 'Telegram does not report reach to the house' }
  };
  const out = JSON.parse(JSON.stringify(base));
  for (const [k, v] of Object.entries(over)) {
    const parts = k.split('.'); let o = out;
    for (let i = 0; i < parts.length - 1; i++) { o[parts[i]] = o[parts[i]] || {}; o = o[parts[i]]; }
    o[parts[parts.length - 1]] = v;
  }
  return out;
}
export function putSnap(snap) { S.set(SOUL.K.metrics(snap.date), JSON.stringify(snap)); }

/* the live site, PageSpeed, YouTube and IndexNow, all answering well */
export const PAGE = (url, over = {}) => {
  const o = { title: 'A page of the house', description: 'A page of NOOR, the library that brings Islam, accurately and beautifully, to everyone.', canonical: url, jsonld: true, words: 220, noindex: false, ...over };
  const body = Array.from({ length: o.words }, (_, i) => 'word' + i).join(' ');
  return '<!doctype html><html><head>' + (o.title ? '<title>' + o.title + '</title>' : '')
    + (o.description ? '<meta name="description" content="' + o.description + '">' : '')
    + (o.canonical ? '<link rel="canonical" href="' + o.canonical + '">' : '')
    + (o.noindex ? '<meta name="robots" content="noindex,follow">' : '')
    + (o.jsonld ? '<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage"}</script>' : '')
    + '</head><body><main>' + body + '</main><script>var hidden = "these words are not counted";</script></body></html>';
};
export function sitemapOf(urls, lastmod) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls.map(u => '  <url>\n    <loc>' + u + '</loc>\n    <lastmod>' + (lastmod || '2026-09-09') + '</lastmod>\n  </url>').join('\n') + '\n</urlset>\n';
}
export const PSI_BODY = (score, lcp, cls, inp) => ({
  lighthouseResult: { categories: { performance: { score } }, audits: { 'largest-contentful-paint': { numericValue: lcp }, 'cumulative-layout-shift': { numericValue: cls } } },
  loadingExperience: inp == null ? { metrics: {} } : { metrics: { INTERACTION_TO_NEXT_PAINT: { percentile: inp, category: 'FAST' } } }
});
export const YT = { searches: 0, channelCalls: 0, videosCalls: 0 };
export function worldOn() {
  process.env.YT_CLIENT_ID = 'yt-client'; process.env.YT_CLIENT_SECRET = 'yt-secret'; process.env.YT_REFRESH_TOKEN = 'yt-refresh';
  onNet('https://noorcodex.com/', async u => {
    const key = (S.get(SOUL.K.indexnowKey) && JSON.parse(S.get(SOUL.K.indexnowKey)).key) || 'x';
    if (u === 'https://noorcodex.com/' + key + '.txt') return resp(200, key);
    return resp(200, PAGE(u), { 'content-type': 'text/html' });
  });
  onNet(INST.PSI_URL, async u => resp(200, PSI_BODY(/quran/.test(decodeURIComponent(u)) ? 0.62 : 0.91, 2400, 0.04, 170)));
  onNet('https://oauth2.googleapis.com/token', async () => resp(200, { access_token: 'yt-access', expires_in: 3600 }));
  onNet(INST.YT_API + '/channels', async u => {
    YT.channelCalls++;
    if (/mine=true/.test(u)) return resp(200, { items: [{ id: 'UChouse000000000000000000', statistics: { subscriberCount: '1520', viewCount: '284000', videoCount: '412', hiddenSubscriberCount: false } }] });
    const ids = decodeURIComponent(/id=([^&]+)/.exec(u)[1]).split(',');
    return resp(200, { items: ids.map((id, i) => ({ id, snippet: { title: 'Benchmark ' + (i + 1) }, statistics: { subscriberCount: String(10000 * (i + 1)), viewCount: String(900000 * (i + 1)), videoCount: String(300 + i) } })) });
  });
  onNet(INST.YT_API + '/search', async u => {
    YT.searches++;
    const q = decodeURIComponent(/[?&]q=([^&]+)/.exec(u)[1]);
    return resp(200, { items: [1, 2, 3, 4, 5].map(i => ({ id: { videoId: q.replace(/\W+/g, '') + i }, snippet: { title: q + ' part ' + i + ' &#39;explained&#39;' } })) });
  });
  onNet(INST.YT_API + '/videos', async u => {
    YT.videosCalls++;
    const ids = decodeURIComponent(/id=([^&]+)/.exec(u)[1]).split(',');
    return resp(200, { items: ids.map((id, i) => ({ id, statistics: { viewCount: String((id.length * 1000) + (5 - i) * 100) } })) });
  });
  onNet(INST.INDEXNOW_ENDPOINT, async () => resp(200, ''));
}
export function worldOff() {
  for (const k of ['YT_CLIENT_ID', 'YT_CLIENT_SECRET', 'YT_REFRESH_TOKEN']) delete process.env[k];
  NET.handlers = NET.handlers.filter(h => h.prefix === JEV_URL);
  NET.calls.length = 0;
}
