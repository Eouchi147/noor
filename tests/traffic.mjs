/* NOOR · what counts as a reader.
   ------------------------------------------------------------------
   The counter used to count every ping that arrived, which meant it counted
   the owner -- who is on this site more than anyone alive -- and every crawler
   willing to run a line of JavaScript.

   The risk in fixing that is worse than the fault. A filter that quietly eats
   real readers tells a more convincing lie than one that counts too many, and
   it is invisible. So the first half of this file is a list of REAL browsers
   that must all still be counted, including the awkward ones: a Cubot phone,
   whose brand name ends in "bot"; the in-app browsers of Facebook, Instagram
   and Pinterest, which carry the app's name and are a person holding a phone.

   Run:  node tests/traffic.mjs
*/
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };

process.env.KV_REST_API_URL = 'https://kv.test';
process.env.KV_REST_API_TOKEN = 't';
process.env.PUBLIC_HOST = 'noorcodex.com';

const beacon = (await import('../api/beacon.js')).default;

const SEEN = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opt) => {
  if (String(url).startsWith('https://kv.test')) {
    const cmds = JSON.parse(opt.body);
    cmds.forEach(c => SEEN.push(c));
    return { ok: true, json: async () => cmds.map(() => ({ result: null })) };
  }
  return { ok: false, status: 404, json: async () => ({}) };
};

async function ping(ua, host = 'noorcodex.com') {
  SEEN.length = 0;
  let code = 0;
  const req = { method: 'POST', headers: { 'user-agent': ua, host }, body: { p: '/quran', n: 1, s: 'direct', h: 12 } };
  const res = { setHeader() {}, status(c) { code = c; return this; }, end() { return this; }, json() { return this; } };
  await beacon(req, res);
  const keys = SEEN.map(c => String(c[1] || ''));
  return { code, counted: keys.some(k => /:views$/.test(k)),
           filtered: keys.some(k => /:filtered$/.test(k)),
           why: (SEEN.find(c => c[0] === 'HINCRBY' && /:filt$/.test(String(c[1]))) || [])[2] || '' };
}

/* ------------------------------------------------- these are real people */
console.log('\nreal readers, all still counted');
const REAL = [
  ['iPhone Safari', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'],
  ['Android Chrome', 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'],
  ['Windows Chrome', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'],
  ['macOS Firefox', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:127.0) Gecko/20100101 Firefox/127.0'],
  ['Edge', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0'],
  ['Samsung Internet', 'Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36'],
  ['Opera Mini', 'Opera/9.80 (Android; Opera Mini/58.0.2254/191.303; U; en) Presto/2.12.423 Version/12.16'],
  /* the brand name that ends in "bot": a bare /bot\b/ would have binned it */
  ['a Cubot phone', 'Mozilla/5.0 (Linux; Android 12; CUBOT NOTE 20) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Mobile Safari/537.36'],
  ['a Cubot, spaced', 'Mozilla/5.0 (Linux; Android 11; Cubot X30 Build/RP1A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0 Mobile Safari/537.36'],
  /* in-app browsers: the app's name, but a person holding the phone */
  ['Facebook in-app', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/468.0.0]'],
  ['Instagram in-app', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 336.0.0.32.90'],
  ['Pinterest in-app', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [Pinterest/iOS]'],
  ['Firefox Focus', 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36 Focus/125.0'],
  ['an old iPad', 'Mozilla/5.0 (iPad; CPU OS 12_5_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1.2 Mobile/15E148 Safari/604.1']
];
for (const [name, ua] of REAL) {
  const r = await ping(ua);
  ok(r.counted && !r.filtered, name + ' is counted');
}

/* -------------------------------------------------- and these are not */
console.log('\nmachines, all turned away');
const BOTS = [
  ['Googlebot', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
  ['Bingbot', 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'],
  ['GPTBot', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.1; +https://openai.com/gptbot'],
  ['ClaudeBot', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ClaudeBot/1.0; +claudebot@anthropic.com'],
  ['PerplexityBot', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot'],
  ['ChatGPT-User', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot'],
  ['Google-Extended', 'Mozilla/5.0 (compatible; Google-Extended/1.0)'],
  ['CCBot', 'CCBot/2.0 (https://commoncrawl.org/faq/)'],
  ['Bytespider', 'Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)'],
  ['Amazonbot', 'Mozilla/5.0 (compatible; Amazonbot/0.1; +https://developer.amazon.com/amazonbot)'],
  ['Applebot', 'Mozilla/5.0 (compatible; Applebot/0.1; +http://www.apple.com/go/applebot)'],
  ['Meta collector', 'meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)'],
  ['AhrefsBot', 'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)'],
  ['SemrushBot', 'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)'],
  ['facebookexternalhit', 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'],
  ['Twitterbot', 'Twitterbot/1.0'],
  ['WhatsApp preview', 'WhatsApp/2.23.20.0 A'],
  ['Slackbot', 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)'],
  ['Discordbot', 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)'],
  ['Pinterestbot', 'Mozilla/5.0 (compatible; Pinterestbot/1.0; +http://www.pinterest.com/bot.html)'],
  ['UptimeRobot', 'Mozilla/5.0+(compatible; UptimeRobot/2.0; http://www.uptimerobot.com/)'],
  ['headless Chrome', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/126.0.0.0 Safari/537.36'],
  ['curl', 'curl/8.4.0'],
  ['python-requests', 'python-requests/2.31.0'],
  ['Go client', 'Go-http-client/2.0'],
  ['Lighthouse', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36 Chrome-Lighthouse']
];
for (const [name, ua] of BOTS) {
  const r = await ping(ua);
  ok(!r.counted && r.filtered && r.why === 'bot', name + ' is turned away');
}

console.log('\nthe other two ways in');
{
  const none = await ping('');
  ok(!none.counted && none.why === 'noua', 'a ping with no browser name at all is not a reader');
  const prev = await ping('Mozilla/5.0 (Macintosh) Chrome/126.0 Safari/537.36', 'noor-git-main.vercel.app');
  ok(!prev.counted && prev.why === 'preview', 'a preview deployment is the owner in a different coat');
  const local = await ping('Mozilla/5.0 (Macintosh) Chrome/126.0 Safari/537.36', 'localhost:3000');
  ok(!local.counted && local.why === 'preview', 'and localhost is a laptop');
  const live = await ping('Mozilla/5.0 (Macintosh) Chrome/126.0 Safari/537.36', 'www.noorcodex.com');
  ok(live.counted, 'but www still counts');
}

console.log('\nwhat it records');
{
  SEEN.length = 0;
  await ping('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36');
  const keys = SEEN.map(c => String(c[1] || ''));
  ok(keys.some(k => k === 'nv:cleanfrom'), 'the first clean day is stamped, so the tab can mark the line');
  ok(SEEN.some(c => c[0] === 'SETNX'), 'and stamped with SETNX, so it is never moved again');
  ok(!keys.some(k => /:filtered$/.test(k)), 'a real reader adds nothing to the turned-away count');
}

globalThis.fetch = realFetch;
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
