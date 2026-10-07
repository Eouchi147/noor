/* NOOR · the letterhead, looked at.
   ------------------------------------------------------------------
   Writes three letters exactly as the house would send them (api/_letterhead.js
   renderLetter over the mailbox's own plain text): a first letter to a mosque,
   the follow-up a week on (api/_outreach.js followupLetter, the real one), and
   a reply to a reader. For each it keeps the HTML as sent and its plain twin,
   a copy whose pictures point at assets/mail/ so it opens from the disk, and a
   preview page with all three side by side at a phone's width and a desk's.

   Then it photographs each one at 390 and 700 wide, light and dark, with the
   pictures on and off, and once more as Gmail's apps may show it when they
   force their own dark mode (the whole page inverted, pictures left alone).

   Nothing real is reached: the emblem's address is answered from assets/mail/
   and every other request is refused.

   Run:  node tests/letterhead-preview.mjs
         (LETTER_SHOTS overrides /tmp/qa/letters; CHROMIUM_PATH the browser)
*/
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderLetter, slopCheck, EMBLEM } from '../api/_letterhead.js';
import { OFFERS, SIGN, DNC_LINE, followupLetter } from '../api/_outreach.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.LETTER_SHOTS || '/tmp/qa/letters';
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOTS = path.join(OUT, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(path.join(OUT, 'assets', 'mail'), { recursive: true });
const ASSET = f => path.join(ROOT, 'assets', 'mail', f);
for (const f of fs.readdirSync(path.join(ROOT, 'assets', 'mail'))) fs.copyFileSync(ASSET(f), path.join(OUT, 'assets', 'mail', f));

/* ---- the three letters, as the mailbox builds them ---- */
const mosqueBody = [
  'Assalamu alaykum,',
  'We are NOOR Codex of Light, a free library of Islam with no ads and no account. Your pages say the masjid holds a Saturday school for children and shows its notices on a screen in the prayer hall.',
  'The Masjid Toolbox at https://noorcodex.com/masjid may help with both: boards, timetables and printables, with a prayer board, a khutba builder, a printable timetable and a qibla tool, and the short reels the house makes, free to show on its screens.',
  'If it would help, a one line reply is enough, and we will send the links that fit.'
].join('\n\n');
const follow = followupLetter({ name: 'Al Noor Masjid', kind: 'mosque', firstAt: '2026-09-30T10:00:00Z', subject: OFFERS.masjid.subject });
const readerBody = [
  'Assalamu alaykum Amina,',
  'Thank you for writing, and for the care in your question about Ayat al-Kursi (2:255).',
  'Three of the library\'s rooms may help:\n- The verse with its meaning, word by word: https://noorcodex.com/quran\n- The Names of Allah it speaks of: https://noorcodex.com/allah\n- A short reel to watch with your family: https://noorcodex.com/reels',
  'On how it should be recited at a particular time, a scholar you trust is the right person to ask; the library\'s pages give what the sources say.',
  'May Allah make it a light for you.'
].join('\n\n');

export const LETTERS = [
  { name: 'outreach-mosque', kind: 'outreach', subject: OFFERS.masjid.subject, text: mosqueBody + '\n\n' + SIGN + '\n\n' + DNC_LINE },
  { name: 'followup', kind: 'followup', subject: follow.subject, text: follow.text },
  { name: 'reply-reader', kind: 'reply', subject: 'Re: A question about Ayat al-Kursi', text: readerBody + '\n\n' + SIGN }
];

const local = html => html.split(EMBLEM.src).join('assets/mail/' + path.basename(EMBLEM.src))
  .split(EMBLEM.still).join('assets/mail/' + path.basename(EMBLEM.still));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const built = LETTERS.map(l => ({ ...l, out: renderLetter({ subject: l.subject, text: l.text, kind: l.kind }) }));
for (const b of built) {
  fs.writeFileSync(path.join(OUT, b.name + '.html'), b.out.html);
  fs.writeFileSync(path.join(OUT, b.name + '.txt'), b.out.text + '\n');
  fs.writeFileSync(path.join(OUT, b.name + '.local.html'), local(b.out.html));
  const sc = slopCheck(b.out.text);
  console.log('  ' + b.name + ': ' + b.out.html.length + ' bytes of HTML, ' + b.out.text.split(/\s+/).length + ' words, slop check ' + (sc.ok ? 'clean' : sc.hits.join('; ')));
}
fs.writeFileSync(path.join(OUT, 'index.html'), '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Letterhead preview</title>'
  + '<style>body{margin:0;padding:24px;background:#1b1e27;color:#e9e3d3;font:15px/1.5 system-ui,sans-serif}h2{font-weight:500;margin:28px 0 10px}'
  + '.row{display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap}iframe{border:1px solid #333a4d;border-radius:8px;background:#fff}'
  + 'p{color:#a9afc2;margin:4px 0 0}</style></head><body><h1 style="font-weight:500">The letterhead, three letters</h1>'
  + '<p>Each letter at a phone\'s width and a desk\'s. Your device\'s light or dark setting decides which the letters show.</p>'
  + built.map(b => '<h2>' + esc(b.name.replace(/-/g, ' ')) + '</h2><p>Subject: ' + esc(b.subject) + '</p><div class="row">'
    + '<iframe src="' + b.name + '.local.html" width="390" height="1100" title="' + esc(b.name) + ' at 390"></iframe>'
    + '<iframe src="' + b.name + '.local.html" width="700" height="1100" title="' + esc(b.name) + ' at 700"></iframe></div>').join('')
  + '</body></html>');

/* ---- the photographs ---- */
const gif = fs.readFileSync(ASSET(path.basename(EMBLEM.src)));
const png = fs.readFileSync(ASSET(path.basename(EMBLEM.still)));
const br = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const FORCED = 'html{filter:invert(1) hue-rotate(180deg)}img{filter:invert(1) hue-rotate(180deg)}';
let n = 0;
async function shot(b, width, scheme, images, forced) {
  const ctx = await br.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, deviceScaleFactor: 1 });
  await ctx.route('**/*', r => {
    const u = r.request().url();
    if (images && u === EMBLEM.src) return r.fulfill({ status: 200, contentType: 'image/gif', body: gif });
    if (images && u === EMBLEM.still) return r.fulfill({ status: 200, contentType: 'image/png', body: png });
    return r.abort();
  });
  const pg = await ctx.newPage();
  await pg.setContent(b.out.html, { waitUntil: 'load' });
  if (forced) await pg.addStyleTag({ content: FORCED });
  await pg.waitForTimeout(150);
  const file = path.join(SHOTS, [b.name, width, forced ? 'gmail-forced-dark' : scheme, images ? 'images' : 'no-images'].join('-') + '.png');
  await pg.screenshot({ path: file, fullPage: true });
  await ctx.close();
  n++;
  return file;
}
for (const b of built)
  for (const width of [390, 700])
    for (const scheme of ['light', 'dark'])
      for (const images of [true, false]) await shot(b, width, scheme, images, false);
for (const b of built) await shot(b, 390, 'light', true, true);
await br.close();
console.log('  ' + n + ' screenshots in ' + SHOTS + '; the letters and their preview page in ' + OUT);
