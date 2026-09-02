/* NOOR · the daily light speaks the reader's language.
   Run: node tests/lightlang.mjs   (no server needed; fetch is stubbed)
   Cards come from the audited files first, the Lantern second, English last. */
const real = globalThis.fetch;
let served = {};
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.includes('/lights/i18n/')) {
    const lang = u.split('/lights/i18n/')[1].replace('.json','');
    if (served[lang]) return { ok: true, json: async () => served[lang] };
    return { ok: false, status: 404, json: async () => ({}) };
  }
  if (u.includes('/lights/all.json')) {
    const fs = await import('node:fs');
    return { ok: true, json: async () => JSON.parse(fs.readFileSync('/root/repo/noor-main/lights/all.json','utf8')) };
  }
  if (u.includes('openrouter')) return { ok: false, status: 401, json: async () => ({}) };
  return { ok: false, status: 404, json: async () => ({}) };
};
const fs = await import('node:fs');
for (const L of ['ar','de','es','fr','prs','ru'])
  served[L] = JSON.parse(fs.readFileSync('/root/repo/noor-main/lights/i18n/' + L + '.json','utf8'));

const mod = await import('/root/repo/noor-main/api/illuminations.js');
const handler = mod.default;
function res() { const o = { code: 0, body: null, headers: {} };
  return { setHeader:(k,v)=>{o.headers[k]=v}, status(c){o.code=c;return this}, json(b){o.body=b;return o}, out:o }; }
let pass = 0, fail = 0;
const ok = (c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); c?pass++:fail++; };

const en = await handler({ query:{kind:'light'}, headers:{host:'noorcodex.com'} }, res());
ok(en.body && en.body.title, 'English light renders: ' + String(en.body && en.body.title).slice(0,54));
ok(en.body.tr === 'en', 'English card is marked tr="en"');

const de = await handler({ query:{kind:'light', lang:'de'}, headers:{host:'noorcodex.com'} }, res());
ok(de.body.tr === 'file', 'German light comes from the audited file (tr=' + de.body.tr + ')');
ok(de.body.lang === 'de', 'the card says which language it is in');
ok(de.body.title !== en.body.title, 'and it is not the English title');
ok(de.body.id === en.body.id, 'the same card of the day, in both languages');
console.log('    de title:', de.body.title);

for (const L of ['ar','es','fr','prs','ru']) {
  const r = await handler({ query:{kind:'light', lang:L}, headers:{host:'noorcodex.com'} }, res());
  ok(r.body.tr === 'file' && r.body.id === en.body.id && r.body.title !== en.body.title,
     L + ': the same card of the day, from its audited file');
}
const tr = await handler({ query:{kind:'light', lang:'tr'}, headers:{host:'noorcodex.com'} }, res());
ok(tr.body.tr === 'en', 'a language with no file and no Lantern falls back to English text, not a blank tile');
ok(tr.body.title === en.body.title, 'and the fallback is the true English card');

const xx = await handler({ query:{kind:'light', lang:'zz'}, headers:{host:'noorcodex.com'} }, res());
ok(xx.body && xx.body.title, 'an unknown language code is treated as English');
console.log(`\n${pass} passed, ${fail} failed`);
globalThis.fetch = real;
process.exit(fail ? 1 : 0);
