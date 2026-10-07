/* NOOR · the letterhead (api/_letterhead.js) and the emblem it carries.
   ------------------------------------------------------------------
   Every letter the house sends is dressed by renderLetter. What has to be
   true of it:
     every word is escaped, the subject and the preview line too;
     a link is a link only to https://noorcodex.com or a subdomain of it,
       and every other address, scheme or trick stays plain words;
     the plain twin carries the letter's words, all of them and no more;
     no script, no event handler, no form, no external sheet, no web font,
       no CSS picture and never a tracking pixel: the only pictures are the
       emblem and its still twin, 120 by 120, at fixed addresses, with words;
     one small style block, for dark mode, phones and less motion, and the
       two colour scheme metas; 600 wide at most; the body at 17 px;
     no dash anywhere in what it writes, whatever it was given;
     the slop check catches the dashes, the emoji and the machine's phrases
       (one example of each), and passes the house's own words: its fixed
       letters, its offers, its footer, "Assalamu alaykum", sadaqa, the
       library, 2:255, the Night Journey and the journey to Madinah;
     the GIF: under 120 KB, 240 px square (2x for 120), many frames that
       loop for ever, and a still PNG of the same size;
   and, in a real browser: no sideways scroll at 390, 17 px text on a
   phone, the card no wider than 600 at a desk, the layout holding with
   pictures off, dark mode in the paper, and the still emblem in place of
   the moving one for a reader who asks for less motion.

   Run:  node tests/letterhead.mjs        (no server and no network)
*/
/* the browser half needs playwright and a Chromium; where they are absent (CI installs
   no dev dependencies) it says so and the rest still runs, as tests/home2.mjs does */
let chromium = null;
try { ({ chromium } = await import('playwright')); } catch { chromium = null; }
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderLetter, slopCheck, isHouseLink, plainLetter, EMBLEM, WORDMARK, FOOTER_LINE, LETTER_KINDS } from '../api/_letterhead.js';
import { OFFERS, SIGN, DNC_LINE, followupLetter } from '../api/_outreach.js';
import { DNC_LINE as MAIL_DNC, DISTRESS_TEXT, NO_TEXT } from '../api/_mail.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const EM = String.fromCharCode(0x2014), EN = String.fromCharCode(0x2013);
const DASH = new RegExp('[' + String.fromCharCode(0x2012, 0x2013, 0x2014, 0x2015) + ']');
const SPARKLE = String.fromCodePoint(0x2728), HEART = String.fromCharCode(0x2764, 0xFE0F), PRAY = String.fromCodePoint(0x1F64F), ROCKET = String.fromCodePoint(0x1F680);

/* the letter's own part of the HTML, as words: tags that sit inside a line
   vanish, tags that end one become a space, entities are read back */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ', '#8226': '', '#183': String.fromCharCode(0xB7) };
const decode = s => s.replace(/&(amp|lt|gt|quot|#39|nbsp|#8226|#183);/g, (m, k) => ENT[k]);
const part = (html, a, b) => { const i = html.indexOf('<!-- ' + a + ' -->'), j = html.indexOf('<!-- /' + a + ' -->'); return i < 0 || j < 0 ? '' : html.slice(i, j); };
const visible = h => decode(h.replace(/<\/?(a|span|em|b|strong)\b[^>]*>/gi, '').replace(/<[^>]+>/g, ' '));
const words = s => String(s).replace(/https:\/\//gi, '').split(/\s+/).map(w => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')).filter(Boolean);
const letterWords = html => words(visible(part(html, 'letter') + ' ' + part(html, 'small')));
const same = (a, b) => a.length === b.length && a.every((w, i) => w === b[i]);
const tags = (html, name) => html.match(new RegExp('<' + name + '\\b[^>]*>', 'gi')) || [];

/* ---------------------------------------------------------------------------
   1. ESCAPING
--------------------------------------------------------------------------- */
console.log('=== escaping ===');
{
  const r = renderLetter({
    kind: 'reply',
    subject: 'Re: <script>alert(1)</script> "Tom & Jerry" <b>bold</b>',
    preheader: 'A <i>preview</i> & "quotes"',
    text: 'Assalamu alaykum <img src=x onerror=alert(1)>,\n\nA line with <b>bold</b>, an <a href="https://evil.com">anchor</a>, 5 < 6 & 7 > 3, and \'quotes\'.\n\n- a list item with <script>alert(2)</script>\n\nWith salaam,\nNOOR Codex of Light\nhttps://noorcodex.com'
  });
  const h = r.html;
  ok(h.includes('<title>Re: &lt;script&gt;alert(1)&lt;/script&gt; &quot;Tom &amp; Jerry&quot; &lt;b&gt;bold&lt;/b&gt;</title>'), 'the subject is escaped in the title');
  ok(h.includes('A &lt;i&gt;preview&lt;/i&gt; &amp; &quot;quotes&quot;'), 'the preview line is escaped');
  ok(!/<script/i.test(h) && !/<img src=x/i.test(h) && !/<b>bold/i.test(h) && !/<i>preview/i.test(h), 'no markup from the subject, the preview or the text reaches the HTML as markup');
  ok(h.includes('&lt;img src=x onerror=alert(1)&gt;') && h.includes('&lt;b&gt;bold&lt;/b&gt;') && h.includes('&lt;script&gt;alert(2)&lt;/script&gt;'), 'markup in the text is shown as words, in a paragraph and in a list');
  ok(h.includes('5 &lt; 6 &amp; 7 &gt; 3') && h.includes('&#39;quotes&#39;'), 'the five characters are escaped (& < > " \')');
  ok(!tags(h, 'a').some(t => /evil\.com/.test(t)), 'an anchor written in the text never becomes a link');
  ok(r.text.includes('<img src=x onerror=alert(1)>') && r.text.includes('<b>bold</b>'), 'the plain twin keeps the words as written (it is plain text, never parsed)');
  ok(!/\son[a-z]+\s*=/i.test(h.replace(/&lt;[^&]*&gt;/g, '')), 'no event handler attribute anywhere');
  ok(!/javascript:/i.test(h), 'no javascript: address anywhere');
}

/* ---------------------------------------------------------------------------
   2. LINKS
--------------------------------------------------------------------------- */
console.log('=== links: only the house\'s own ===');
{
  const t = [
    'Assalamu alaykum,',
    'House: https://noorcodex.com/masjid. Subdomain: https://reels.noorcodex.com/watch?id=7&t=2 and (see https://noorcodex.com/quran).',
    'Plain: http://noorcodex.com/insecure https://evil.com/x https://noorcodex.com.evil.com/y https://evilnoorcodex.com/z https://noorcodex.com@evil.com/w https://user:pw@noorcodex.com/v https://noorcodex.com:8443/u javascript:alert(1) noorcodex.com/bare',
    'With salaam,\nNOOR Codex of Light\nhttps://noorcodex.com'
  ].join('\n\n');
  const r = renderLetter({ kind: 'reply', subject: 'Links', text: t });
  const as = tags(r.html, 'a');
  const hrefs = as.map(a => (a.match(/href="([^"]*)"/) || [])[1]);
  ok(hrefs.includes('https://noorcodex.com/masjid'), 'https://noorcodex.com/masjid is a link, its full stop left outside');
  ok(hrefs.includes('https://reels.noorcodex.com/watch?id=7&amp;t=2'), 'a subdomain is a link, its query escaped in the attribute');
  ok(hrefs.includes('https://noorcodex.com/quran'), 'a closing bracket the address did not open stays outside it');
  ok(hrefs.filter(h => h === 'https://noorcodex.com/').length === 2, 'the signature\'s address and the footer\'s are links');
  ok(hrefs.length === 5 && hrefs.every(h => /^https:\/\/([a-z0-9-]+\.)*noorcodex\.com(\/|$)/.test(h.replace(/&amp;/g, '&'))), 'every link goes to the house, and there are no others (' + hrefs.length + ')');
  for (const plain of ['http://noorcodex.com/insecure', 'https://evil.com/x', 'https://noorcodex.com.evil.com/y', 'https://evilnoorcodex.com/z', 'https://noorcodex.com@evil.com/w', 'https://user:pw@noorcodex.com/v', 'https://noorcodex.com:8443/u'])
    ok(r.html.includes(plain) && !hrefs.some(h => h.replace(/&amp;/g, '&').startsWith(plain)), 'stays plain words: ' + plain);
  ok(r.html.includes('javascript:alert(1)') && !as.some(a => /javascript/i.test(a)), 'javascript: in the text stays words, never an address');
  ok(r.html.includes('>noorcodex.com/masjid</a>.'), 'a house link reads as noorcodex.com/masjid, without the scheme');
  ok(as.filter(a => /class="nb-link"/.test(a)).every(a => /^<a href="[^"<>]*" class="nb-link" style="[^"<>]*">$/.test(a)), 'a letter\'s link carries only href, class and style');
  ok(isHouseLink('https://noorcodex.com') && isHouseLink('https://www.noorcodex.com/x') && isHouseLink('HTTPS://NOORCODEX.COM/School'), 'isHouseLink: the house, a subdomain, any case');
  ok(!isHouseLink('http://noorcodex.com') && !isHouseLink('https://noorcodex.co') && !isHouseLink('https://xnoorcodex.com') && !isHouseLink('ftp://noorcodex.com') && !isHouseLink('not a url') && !isHouseLink(null), 'isHouseLink: not http, not a look alike, not another scheme, not junk');
}

/* ---------------------------------------------------------------------------
   3. THE PLAIN TWIN
--------------------------------------------------------------------------- */
console.log('=== the plain twin carries the same words ===');
const mosque = 'Assalamu alaykum,\n\nWe are NOOR Codex of Light, a free library of Islam with no ads and no account. Your pages say the masjid holds a Saturday school.\n\nThe Masjid Toolbox at https://noorcodex.com/masjid may help: boards, timetables and printables, all free.\n\nIf it would help, a one line reply is enough.\n\n' + SIGN + '\n\n' + DNC_LINE;
const follow = followupLetter({ name: 'Al Noor Masjid', kind: 'mosque', firstAt: '2026-09-30T10:00:00Z', subject: OFFERS.masjid.subject });
const reader = 'Assalamu alaykum Amina,\n\nThank you for your question about Ayat al-Kursi (2:255).\n\nThree rooms may help:\n- The verse: https://noorcodex.com/quran\n- The Names: https://noorcodex.com/allah\n1. First step\n2. Second step\n\nMay Allah make it a light for you.\n\n' + SIGN;
const LETTERS = [['outreach', 'Free tools for your masjid', mosque], ['followup', follow.subject, follow.text], ['reply', 'Re: Ayat al-Kursi', reader],
  ['reply', 'Re: help', DISTRESS_TEXT], ['reply', 'Re: no thanks', NO_TEXT]];
for (const [kind, subject, text] of LETTERS) {
  const r = renderLetter({ kind, subject, text });
  const a = words(r.text), b = letterWords(r.html);
  ok(r.text === plainLetter(text) && same(a, b), kind + ' "' + subject + '": the HTML letter and its plain twin carry the same ' + a.length + ' words, in order');
  ok(!DASH.test(r.html) && !DASH.test(r.text), kind + ' "' + subject + '": no dash in the HTML or the text');
}
{
  const r = renderLetter({ kind: 'reply', subject: 'x', text: 'Assalamu alaykum,\n\nThe library ' + EM + ' free ' + EN + ' opens pages 3' + EN + '5. ' + SPARKLE + ' Thank you ' + HEART + '\n\n' + EM + ' a line that began with a dash' });
  ok(!DASH.test(r.html) && !DASH.test(r.text), 'dashes given in the text are never written: replaced in the HTML and the twin alike');
  ok(r.text.includes('The library, free, opens pages 3 to 5.') && r.text.includes('\n\na line that began with a dash'), 'a dash becomes a comma, a range of numbers "to", and a dash at a line\'s start goes');
  ok(!r.text.includes(SPARKLE) && !r.text.includes(HEART) && !r.html.includes(SPARKLE) && !r.html.includes(String.fromCharCode(0x2764)), 'emoji given in the text are never written');
}

/* ---------------------------------------------------------------------------
   4. WHAT THE HTML IS, AND IS NOT
--------------------------------------------------------------------------- */
console.log('=== an email, not a web page ===');
for (const kind of LETTER_KINDS) {
  const r = renderLetter({ kind, subject: 'A letter', text: kind === 'reply' ? reader : mosque });
  const h = r.html;
  ok(!/<\s*script/i.test(h) && !/<\s*(iframe|object|embed|form|input|button|video|audio|canvas|svg|base)\b/i.test(h), kind + ': no script, frame, form, media or base element');
  ok(!/<link\b/i.test(h) && !/@import/i.test(h) && !/url\(/i.test(h) && !/@font-face/i.test(h) && !/fonts\.(googleapis|gstatic)/i.test(h), kind + ': no external sheet, no web font, no CSS picture');
  const imgs = tags(h, 'img');
  ok(imgs.length === 2 && imgs.every(t => [EMBLEM.src, EMBLEM.still].includes((t.match(/src="([^"]*)"/) || [])[1])), kind + ': the only pictures are the emblem and its still (' + imgs.length + ')');
  ok(imgs.every(t => /width="120"/.test(t) && /height="120"/.test(t) && /alt="[^"]{8,}"/.test(t) && /width:120px/.test(t) && /height:120px/.test(t)), kind + ': each picture has its width, height and words, so the head holds with pictures off');
  ok(!imgs.some(t => /\?|width="[01]"|height="[01]"|display:none[^"]*width:1px/.test(t)) && !/\sbackground=/i.test(h), kind + ': no tracking pixel: no query on a picture, no 1 by 1, no background picture');
  ok(EMBLEM.src === 'https://noorcodex.com/assets/mail/lantern-v1.gif' && fs.existsSync(path.join(ROOT, 'assets/mail/lantern-v1.gif')) && fs.existsSync(path.join(ROOT, 'assets/mail/lantern-v1-still.png')), kind + ': the emblem lives at https://noorcodex.com/assets/mail/, and both files are in the repo');
  ok((h.match(/<style>/g) || []).length === 1 && /@media \(prefers-color-scheme:dark\)/.test(h) && /@media screen and \(min-width:621px\)/.test(h) && /@media \(prefers-reduced-motion:reduce\)/.test(h), kind + ': one style block, for dark mode, phones and less motion');
  ok(/<meta name="color-scheme" content="light dark">/.test(h) && /<meta name="supported-color-schemes" content="light dark">/.test(h) && /color-scheme:light dark/.test(h), kind + ': both colour scheme metas, and the scheme in the sheet');
  ok(/max-width:600px/.test(h) && /<table role="presentation" width="600"/.test(h), kind + ': 600 wide at most, Outlook held to it too');
  const ps = (part(h, 'letter').match(/<p class="nb-ink"[^>]*>/g) || []).concat(part(h, 'letter').match(/<td valign="top" class="nb-ink"[^>]*>/g) || []);
  ok(ps.length >= 2 && ps.every(t => /font-size:17px/.test(t) && /line-height:28px/.test(t)), kind + ': every body paragraph and list line is 17 px on a 28 px line');
  ok(h.includes('>' + WORDMARK.ar + '<') && /lang="ar" dir="rtl"/.test(h) && h.includes(WORDMARK.en), kind + ': the wordmark, ' + WORDMARK.ar + ' ' + WORDMARK.en + ', in Arabic and English');
  ok(visible(h).replace(/\s+/g, ' ').includes(FOOTER_LINE), kind + ': the quiet footer: "' + FOOTER_LINE + '"');
  ok(h.includes('nb-kind-' + kind), kind + ': the kind is carried');
  ok(!DASH.test(h), kind + ': no dash anywhere in the HTML');
}
{
  const withDnc = renderLetter({ kind: 'outreach', subject: 'x', text: mosque }).html;
  const without = renderLetter({ kind: 'reply', subject: 'x', text: reader }).html;
  ok(part(withDnc, 'small').includes('no thanks') && /class="nb-soft" style="[^"]*font-size:14px/.test(withDnc) && !part(withDnc, 'letter').includes('no thanks'), 'the do not contact line sits apart, small (14 px) and clear');
  ok(!without.includes('<!-- small -->'), 'a reply with no such line has no small print');
  const pre = renderLetter({ kind: 'reply', subject: 'x', text: reader }).html;
  ok(/<div style="display:none;[^"]*">Thank you for your question about Ayat al-Kursi \(2:255\)\./.test(pre), 'with no preview line given, the inbox shows the first sentence after the greeting');
  const odd = renderLetter({ kind: 'newsletter', subject: 'x', text: 'Hello' });
  ok(odd.html.includes('nb-kind-reply') && odd.text === 'Hello', 'a kind it does not know is drawn as a reply, never refused');
  let threw = false;
  try { renderLetter(); renderLetter(null); renderLetter({ text: null, subject: null }); renderLetter({ text: '' }); } catch { threw = true; }
  ok(!threw, 'it never throws: no options, null, nothing to say');
}

/* ---------------------------------------------------------------------------
   5. THE SLOP CHECK
--------------------------------------------------------------------------- */
console.log('=== the slop check ===');
const CATCH = [
  ['an em dash', 'We read your page ' + EM + ' it was lovely.'],
  ['an en dash', 'Pages 3' + EN + '5 of the book.'],
  ['an emoji', 'Thank you ' + SPARKLE],
  ['an emoji', 'With love ' + HEART],
  ['an emoji', 'May Allah reward you ' + PRAY],
  ['an emoji', 'Launching soon ' + ROCKET],
  ['"I hope this email finds you well"', 'I hope this email finds you well.'],
  ['"I hope this email finds you well"', 'We hope this message finds you in good health.'],
  ['"delve"', 'We delve into the Seerah.'],
  ['"elevate"', 'It will elevate your classes.'],
  ['"unlock"', 'Unlock the treasures of the Qur\'an.'],
  ['"seamless"', 'A seamless way to learn.'],
  ['"leverage"', 'You can leverage these pages.'],
  ['"game changer"', 'This is a game changer for schools.'],
  ['"game changer"', 'A real game-changer.'],
  ['"in today\'s fast paced world"', 'In today\'s fast paced world, children need calm.'],
  ['"in today\'s fast paced world"', 'In today\'s fast-paced world it helps.'],
  ['"I wanted to reach out"', 'I wanted to reach out about the library.'],
  ['"I wanted to reach out"', 'We are reaching out to share a free library.'],
  ['"rest assured"', 'Rest assured, it is free.'],
  ['"don\'t hesitate to"', 'Don\'t hesitate to write back.'],
  ['"don\'t hesitate to"', 'Please do not hesitate to ask.'],
  ['"tapestry"', 'The rich tapestry of Islamic history.'],
  ['"embark"', 'Embark on a path of learning.'],
  ['"journey" as a metaphor', 'Your learning journey starts here.'],
  ['"journey" as a metaphor', 'Join us on this journey.'],
  ['"journey" as a metaphor', 'A journey of faith and discovery.'],
  ['"journey" as a metaphor', 'Every step of your journey.'],
  ['"navigate the complexities"', 'It helps you navigate the complexities of fiqh.'],
  ['"foster"', 'Pages that foster a love of the Qur\'an.'],
  ['"empower"', 'We empower parents.'],
  ['"empower"', 'An empowering resource.'],
  ['"synergy"', 'A synergy between us.'],
  ['"I trust this"', 'I trust this finds you well.'],
  ['"not just this but that" turn', 'It is not just a library but a home.'],
  ['"not just this but that" turn', 'Not only in English, but also in Arabic.'],
  ['"not just this but that" turn', 'It isn\'t just a website, it\'s a community.'],
  ['"not just this but that" turn', 'More than just a library.'],
  ['three adjectives in a row', 'A warm, welcoming and inclusive space.'],
  ['three adjectives in a row', 'Free, open, beautiful pages.'],
  ['three adjectives in a row', 'Calm and clear and kind.']
];
for (const [rule, text] of CATCH) {
  const r = slopCheck(text);
  ok(!r.ok && r.hits.some(h => h.includes(rule)), 'catches ' + rule + ': "' + text.replace(DASH, '(dash)') + '" (' + r.hits.join('; ') + ')');
}
ok(CATCH.every(([, t]) => slopCheck(t).hits.every(h => !DASH.test(h))), 'no hit ever carries a dash itself');
const multi = slopCheck('I hope this email finds you well ' + EM + ' we wanted to reach out ' + SPARKLE);
ok(!multi.ok && multi.hits.length >= 4, 'several faults in one draft are each named (' + multi.hits.length + ')');

const HOUSE = [
  'Assalamu alaykum,', 'Assalamu alaykum Amina,', 'Wa alaykum assalam, and thank you.', 'A gift of sadaqa keeps the library free.',
  'The library has the verse at 2:255, Ayat al-Kursi.', 'On the Night Journey the Prophet was taken to Jerusalem.',
  'The journey to Madinah took eight days.', 'The Hajj journey begins at the miqat.', 'Our journey to Makkah was long.',
  'In English, Arabic and Turkish.', 'Boards, timetables and printables, all free.', 'A child in foster care is welcome.',
  'It is free, with no ads and no account.', 'May Allah reward you.', 'The library\'s pages give what the sources say.',
  'Jazakum Allahu khayran.', 'Insha\'Allah it helps.', 'It was free, and it is still free.', 'Not one page carries an ad.',
  FOOTER_LINE, SIGN, DNC_LINE, MAIL_DNC, DISTRESS_TEXT, NO_TEXT, follow.text, mosque, reader
];
for (const [k, o] of Object.entries(OFFERS)) HOUSE.push(o.give, o.step, o.subject, o.label);
for (const t of HOUSE) {
  const r = slopCheck(t);
  ok(r.ok, 'passes the house\'s own words: "' + t.replace(/\s+/g, ' ').slice(0, 70) + '"' + (r.ok ? '' : ' (' + r.hits.join('; ') + ')'));
}
ok(slopCheck('').ok && slopCheck(null).ok && slopCheck(undefined).ok, 'nothing to check is clean, never a throw');

/* ---------------------------------------------------------------------------
   6. THE EMBLEM ITSELF
--------------------------------------------------------------------------- */
console.log('=== the emblem ===');
function gifInfo(buf) {
  const info = { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8), frames: 0, loop: null, delays: [], trailer: false };
  let i = 13;
  if (buf[10] & 0x80) i += 3 * (1 << ((buf[10] & 7) + 1));
  const skipBlocks = () => { while (buf[i] !== 0) i += buf[i] + 1; i++; };
  while (i < buf.length) {
    const b = buf[i];
    if (b === 0x3B) { info.trailer = true; break; }
    if (b === 0x21) {
      const label = buf[i + 1];
      if (label === 0xF9) info.delays.push(buf.readUInt16LE(i + 4) * 10);
      if (label === 0xFF && buf.toString('latin1', i + 3, i + 14) === 'NETSCAPE2.0') info.loop = buf.readUInt16LE(i + 16);
      i += 2; skipBlocks(); continue;
    }
    if (b === 0x2C) {
      info.frames++;
      const packed = buf[i + 9];
      i += 10;
      if (packed & 0x80) i += 3 * (1 << ((packed & 7) + 1));
      i++; skipBlocks(); continue;
    }
    break;
  }
  return info;
}
{
  const gif = fs.readFileSync(path.join(ROOT, 'assets/mail/lantern-v1.gif'));
  const g = gifInfo(gif);
  ok(gif.toString('latin1', 0, 6) === 'GIF89a' && g.trailer, 'a whole GIF89a, read to its end');
  ok(gif.length < 120 * 1024, 'under 120 KB (' + (gif.length / 1024).toFixed(1) + ' KB)');
  ok(g.w === 240 && g.h === 240, '240 by 240: twice the 120 it is shown at');
  ok(g.frames >= 12, 'it moves: ' + g.frames + ' frames');
  ok(g.loop === 0, 'it loops for ever (NETSCAPE loop count 0)');
  const total = g.delays.reduce((a, b) => a + b, 0);
  ok(g.delays.length === g.frames && g.delays.every(d => d >= 100) && total >= 4000 && total <= 10000, 'a slow breath: ' + g.delays[0] + ' ms a frame, ' + (total / 1000) + ' seconds a loop');
  const png = fs.readFileSync(path.join(ROOT, 'assets/mail/lantern-v1-still.png'));
  ok(png.toString('latin1', 1, 4) === 'PNG' && png.readUInt32BE(16) === 240 && png.readUInt32BE(20) === 240, 'the still is a PNG of the same 240 by 240');
  ok(fs.existsSync(path.join(ROOT, 'scripts/gen-mail-emblem.py')), 'the script that draws them is in scripts/');
}

/* ---------------------------------------------------------------------------
   7. IN A BROWSER
--------------------------------------------------------------------------- */
console.log('=== in a browser ===');
if (!chromium || !fs.existsSync(EXE)) console.log('  skipped: no playwright or no Chromium here');
else {
const gifBytes = fs.readFileSync(path.join(ROOT, 'assets/mail/lantern-v1.gif'));
const pngBytes = fs.readFileSync(path.join(ROOT, 'assets/mail/lantern-v1-still.png'));
const br = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
async function open(html, o = {}) {
  const ctx = await br.newContext({ viewport: { width: o.width || 390, height: 900 }, colorScheme: o.scheme || 'light', reducedMotion: o.reduced ? 'reduce' : 'no-preference' });
  const asked = [];
  await ctx.route('**/*', r => {
    const u = r.request().url();
    asked.push(u);
    if (o.images !== false && u === EMBLEM.src) return r.fulfill({ status: 200, contentType: 'image/gif', body: gifBytes });
    if (o.images !== false && u === EMBLEM.still) return r.fulfill({ status: 200, contentType: 'image/png', body: pngBytes });
    return r.abort();
  });
  const pg = await ctx.newPage();
  const errors = [];
  pg.on('pageerror', e => errors.push(String(e)));
  await pg.setContent(html, { waitUntil: 'load' });
  return { ctx, pg, asked, errors };
}
{
  const html = renderLetter({ kind: 'outreach', subject: 'Free tools for your masjid', text: mosque + '\n\nA very long address that must wrap: https://noorcodex.com/' + 'a'.repeat(120) }).html;
  let v = await open(html, { width: 390 });
  const m = await v.pg.evaluate(() => ({
    sw: document.documentElement.scrollWidth, iw: innerWidth,
    sizes: [...document.querySelectorAll('.nb-ink')].map(e => getComputedStyle(e).fontSize),
    move: getComputedStyle(document.querySelector('.nb-move')).display, still: getComputedStyle(document.querySelector('.nb-still')).display,
    img: (() => { const r = document.querySelector('.nb-move').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })(),
    paper: getComputedStyle(document.querySelector('td.nb-paper')).backgroundColor
  }));
  ok(m.sw <= m.iw, 'no sideways scroll at 390, a long address and all (' + m.sw + ' of ' + m.iw + ')');
  ok(m.sizes.length >= 4 && m.sizes.every(s => s === '17px'), 'the letter reads at 17 px on a phone (' + [...new Set(m.sizes)].join(', ') + ')');
  ok(m.move === 'block' && m.still === 'none' && m.img[0] === 120 && m.img[1] === 120, 'the moving emblem shows at 120 by 120, its still twin hidden');
  ok(m.paper === 'rgb(255, 253, 248)', 'light: the house\'s paper');
  ok(v.asked.filter(u => !u.startsWith('about:') && !u.startsWith('data:')).every(u => u === EMBLEM.src || u === EMBLEM.still), 'the page asks the network for the emblem and nothing else');
  ok(!v.errors.length, 'no page errors');
  await v.ctx.close();

  v = await open(html, { width: 700 });
  const d = await v.pg.evaluate(() => ({ card: Math.round(document.querySelector('td.nb-head').getBoundingClientRect().width), sw: document.documentElement.scrollWidth, pad: getComputedStyle(document.querySelector('td.nb-paper')).paddingLeft }));
  ok(d.card <= 600 && d.card >= 560 && d.sw <= 700, 'at a desk the letter is 600 wide at most (' + d.card + ')');
  ok(d.pad === '44px', 'and a wider screen gives the words more air (' + d.pad + ' each side)');
  await v.ctx.close();

  v = await open(html, { width: 390, images: false });
  const off = await v.pg.evaluate(() => { const r = document.querySelector('.nb-move').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), alt: document.querySelector('.nb-move').alt, sw: document.documentElement.scrollWidth }; });
  ok(off.w === 120 && off.h === 120 && off.alt === EMBLEM.alt && off.sw <= 390, 'pictures off: the head keeps its 120 by 120 and shows the words "' + off.alt + '"');
  await v.ctx.close();

  v = await open(html, { width: 390, scheme: 'dark' });
  const dk = await v.pg.evaluate(() => ({ paper: getComputedStyle(document.querySelector('td.nb-paper')).backgroundColor, ink: getComputedStyle(document.querySelector('p.nb-ink')).color, page: getComputedStyle(document.body).backgroundColor }));
  ok(dk.paper === 'rgb(13, 20, 48)' && dk.ink === 'rgb(233, 227, 211)' && dk.page === 'rgb(4, 6, 15)', 'dark: night paper, cream words, the night around it');
  await v.ctx.close();

  v = await open(html, { width: 390, reduced: true });
  const rm = await v.pg.evaluate(() => ({ move: getComputedStyle(document.querySelector('.nb-move')).display, still: getComputedStyle(document.querySelector('.nb-still')).display, h: Math.round(document.querySelector('.nb-still img').getBoundingClientRect().height) }));
  ok(rm.move === 'none' && rm.still === 'block' && rm.h === 120, 'less motion asked for: the still emblem instead of the moving one');
  await v.ctx.close();
  /* a client that drops the style block (Gmail can) still gets the phone's
     layout, because the inline styles are the phone's */
  v = await open(html.replace(/<style>[\s\S]*?<\/style>/, ''), { width: 390 });
  const bare = await v.pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, pad: getComputedStyle(document.querySelector('td.nb-paper')).paddingLeft,
    size: getComputedStyle(document.querySelector('p.nb-ink')).fontSize, still: getComputedStyle(document.querySelector('.nb-still')).display }));
  ok(bare.sw <= 390 && bare.pad === '26px' && bare.size === '17px' && bare.still === 'none', 'its style block dropped (as Gmail may), the phone layout still holds: no sideways scroll, 26 px margins, 17 px words, one emblem');
  await v.ctx.close();
}
await br.close();
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
