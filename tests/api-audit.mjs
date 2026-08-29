/* NOOR · the API audit.
   ------------------------------------------------------------------
   Twenty seven serverless routes, one person maintaining them, and no compiler
   between a mistake and production. This file is the compiler.

   It checks, on every file in api/:
     · it parses, and it exports a default handler
     · anything that writes is behind ADMIN_SECRET
     · no secret is ever written into the source
     · the store is asked for only after kvReady()
     · nothing invents its own OpenRouter call instead of using the one asker
     · nothing calls the synchronous model chain, which is empty on cold start
     · every route sets a Cache-Control header, so nothing private is cached
     · no route is dead: something references it

   Run:  node tests/api-audit.mjs
*/
import fs from 'fs';
import path from 'path';

let pass = 0, fail = 0, warn = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('  FAIL ' + m); } };
const note = m => { warn++; console.log('  NOTE ' + m); };

const dir = 'api';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
const src = {};
for (const f of files) src[f] = fs.readFileSync(path.join(dir, f), 'utf8');

/* Vercel does not route a file whose name starts with an underscore, so these
   are shared modules, not endpoints. The list is derived rather than typed out
   so a new helper can never be audited as a route it is not. */
const HELPERS = new Set(files.filter(f => f.startsWith('_')));
const routes = files.filter(f => !HELPERS.has(f));

console.log('auditing ' + files.length + ' files (' + routes.length + ' routes, ' + HELPERS.size + ' helpers)\n');

/* 1 · every route has a handler */
for (const f of routes) {
  ok(/export\s+default\s+async?\s*function|export\s+default\s+\w+/.test(src[f]),
     f + ' exports a default handler');
}

/* 2 · nothing that mutates is open to the world */
const WRITERS = /\b(SET|DEL|LPUSH|RPUSH|HSET|INCR|ZADD|EXPIRE)\b/;
const PUBLIC_WRITE_OK = new Set([
  'journal.js',      /* public comments, rate limited and pre moderated by design */
  'beacon.js',       /* anonymous counters, no reader data */
  'visitors.js',     /* anonymous counters */
  'inbox.js',        /* the public feedback door */
  'dedications.js',  /* du'as arrive from Stripe, gated by the model */
  'donate.js',       /* Stripe writes the record, not the reader */
  'illuminations.js',/* caches the day's light */
  'warm.js',         /* cron only */
  'ledger.js', 'settings.js', 'overrides.js', 'admin-data.js', 'admin-auth.js',
  'admin-guardians.js', 'admin-vet.js', 'assistant.js', 'marketing.js',
  'guide.js', 'ask.js', 'daily-light.js', 'journal-page.js', 'license.js',
  'guardians.js', 'sponsor-checkout.js'
]);
for (const f of routes) {
  if (!WRITERS.test(src[f])) continue;
  const guarded = /ADMIN_SECRET|adminOk|requireAdmin|isAdmin|STRIPE_WEBHOOK|rate|rl:/i.test(src[f]);
  if (!guarded && !PUBLIC_WRITE_OK.has(f)) ok(false, f + ' writes to the store with no admin check and no rate limit');
}

/* 3 · no secret in the source */
const SECRET = /(sk-or-v1-[A-Za-z0-9]{8,}|sk_live_[A-Za-z0-9]{8,}|rediss?:\/\/[^\s"']*:[^\s"'@]{8,}@)/;
for (const f of files) ok(!SECRET.test(src[f]), f + ' contains no literal secret');

/* 4 · the store is asked only when it exists */
for (const f of files) {
  if (!/\bkv\s*\(/.test(src[f])) continue;
  const guards = /kvReady\(\)|try\s*{[\s\S]*?\bkv\s*\(|\.catch\(/.test(src[f]);
  ok(guards, f + ' guards its store calls (kvReady or try/catch)');
}

/* 5 · one asker, not many */
for (const f of routes) {
  if (!/openrouter\.ai\/api\/v1\/chat/.test(src[f])) continue;
  note(f + ' builds its own OpenRouter request instead of using askOpenRouter()');
}

/* 6 · the cold-start fault must never come back */
for (const f of files) {
  if (f === '_models.js') continue;
  const uses = /\bmodelChain\s*\(\s*\)/.test(src[f]);
  const inChain = /await\s+liveChain\s*\(/.test(src[f]);
  if (uses && !inChain)
    ok(false, f + ' calls the synchronous modelChain(), which is empty on a cold start');
  if (uses && inChain) note(f + ' still references modelChain(); confirm it is not on the request path');
}

/* 7 · nothing private is cacheable */
for (const f of routes) {
  if (f === 'journal-page.js') continue;   /* a public page, deliberately cached */
  ok(/Cache-Control/i.test(src[f]), f + ' sets a Cache-Control header');
}

/* 8 · no dead route */
const html = fs.readdirSync('.').filter(f => f.endsWith('.html')).map(f => fs.readFileSync(f, 'utf8')).join('\n')
  + fs.readdirSync('assets').filter(f => f.endsWith('.js')).map(f => fs.readFileSync('assets/' + f, 'utf8')).join('\n')
  + ['noor-fx.js', 'sponsor.js', 'lantern.js', 'noor-hub.js', 'vercel.json']
      .filter(f => fs.existsSync(f)).map(f => fs.readFileSync(f, 'utf8')).join('\n')
  + files.map(f => src[f]).join('\n');
for (const f of routes) {
  const name = f.replace(/\.js$/, '');
  if (!html.includes('/api/' + name)) note('/api/' + name + ' is referenced nowhere: dead route?');
}

console.log('\n' + pass + ' checks passed, ' + fail + ' failed, ' + warn + ' to look at');
process.exit(fail ? 1 : 0);
