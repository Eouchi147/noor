/* NOOR · the silent shorts: the row, the merge, the post, and each network's shape.
   ------------------------------------------------------------------
   Five things are proved here.

   THE ROW: shortmanifest.py is run for real (a stub brief, a stub compiled
   film, a stub rendered file, a stub site page) rather than reimplemented in
   JS, so this checks the actual script that ships, not a description of it.
   Included: a hero card that matches a brief by shared words, and one that
   matches neither of two cards sharing a field, which must fall back to the
   brief's own text rather than guess the first card in the list.

   THE MERGE: publish-shorts.sh's own merge step (the python it hands to
   itself in its heredoc) is extracted and run against a stub reels/index.json,
   so the test and the shipped script can never drift apart. Included: a
   shelf that already carries the same id twice, which the merge must
   collapse to one row, not leave a stale second copy standing.

   THE POST: api/_schedule.js's buildSlot is run for real against a short row,
   because the post it hands to every channel is where the row's story,
   title, hook, payoff, tags, wide file, source and room actually have to
   land; an ordinary reel through the same function must carry none of them.

   THE SHAPE: api/_channels.js's shape() for kind "short" on each network the
   masterplan named, called on the REAL post buildSlot produced, not a hand
   built stand-in, so a field this file forgets to carry is caught here too.

   THE SEND: api/social.js's sendOne, reached through the real sendSlot, with
   only YouTube configured and its sender swapped for a capturing stub: the
   wide file for a short that has one, the tall file for one that does not.

   Run:  node tests/shorts.mjs
*/
import { execFileSync, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import * as CH from '../api/_channels.js';
import * as S from '../api/_schedule.js';
import * as SOC from '../api/social.js';
import * as YT from '../api/_youtube.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };
//  built from code points, not typed literally, so this file itself never
//  carries the two characters it exists to catch
const DASH = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');

function tmpdir(name) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'noor-' + name + '-'));
  return d;
}

/* =========================================================================
   THE ROW: run shortmanifest.py for real against stub briefs
   ========================================================================= */
console.log('\nthe row shortmanifest.py builds');
let row = null, rowFielda = null, rowFieldno = null, stderrOut = '';
{
  const scratch = tmpdir('shorts-row');
  const films = path.join(scratch, 'tools', 'films');
  fs.mkdirSync(path.join(films, 'briefs'), { recursive: true });
  fs.mkdirSync(path.join(films, 'films'), { recursive: true });
  fs.mkdirSync(path.join(films, 'out'), { recursive: true });
  fs.mkdirSync(path.join(scratch, 'tools', 'reels'), { recursive: true });

  fs.copyFileSync(path.join(ROOT, 'tools', 'films', 'shortmanifest.py'), path.join(films, 'shortmanifest.py'));
  fs.writeFileSync(path.join(scratch, 'tools', 'reels', 'know.json'), JSON.stringify({ cards: {} }));

  const brief = {
    slug: 'short-stub',
    title: 'A Stub Of Light',
    theme: 'nutvoid',
    plate: 'stub',
    note: 'A note for the test brief, nothing more.',
    room: 'stub.html#stub-anchor',
    lines: [
      { text: 'A hook the test can check', steps: 1 },
      { text: 'A middle line', sub: 'a sub line', steps: 1 },
      { text: 'The payoff sentence itself', steps: 1 },
      { eyebrow: 'A Stub Person', text: 'The term explained', src: 'A Stub Source, about the year 1000' },
    ],
  };
  fs.writeFileSync(path.join(films, 'briefs', 'plate-stub.json'), JSON.stringify(brief, null, 2));

  const film = { slug: 'short-stub', title: 'A Stub Of Light', chapters: [{ beats: [{ hold: 5 }, { hold: 5 }, { hold: 5 }, { hold: 5 }] }] };
  fs.writeFileSync(path.join(films, 'films', 'short-stub.json'), JSON.stringify(film));

  fs.writeFileSync(path.join(films, 'short-stub-tall-30fps.mp4'), 'not really a video, just needs to exist');
  fs.writeFileSync(path.join(films, 'short-stub-wide-30fps.mp4'), 'not really a video either');

  fs.writeFileSync(path.join(scratch, 'stub.html'),
    '<section><article class="card pcard mo" id="stub-anchor">' +
    '<div class="pc-h"><h4 class="pc-n">Stub Person</h4></div>' +
    '<details class="pc-d"><div class="pc-body">' +
    '<p>The first paragraph of the stub account, written for this test, ' +
    'about a hook the test can check and the payoff sentence itself.</p>' +
    '<p>A second paragraph, so the story carries more than one.</p>' +
    '</div></details></article></section>');

  /* THE AMBIGUOUS FIELD: two gcards behind one anchor, the way heroes.html
     groups several people or things under a shared topic. One brief shares
     real words with the first card and must pick it; a second brief shares
     a word with neither and must fall back to its own lines, with a
     warning printed rather than a silent, wrong guess. */
  fs.writeFileSync(path.join(scratch, 'field.html'),
    '<section class="fieldsec" id="fieldsec-x">' +
    '<article class="gcard"><h4 class="gc-t">Card Alpha One</h4>' +
    '<p class="gc-m">alpha meta</p>' +
    '<p>The alpha card explains the toledo bridge and the alpha device in detail.</p>' +
    '</article>' +
    '<article class="gcard"><h4 class="gc-t">Card Beta Two</h4>' +
    '<p class="gc-m">beta meta</p>' +
    '<p>The beta card explains something else entirely, unrelated words only.</p>' +
    '</article>' +
    '</section>');

  const briefFielda = {
    slug: 'short-fielda', title: 'Fielda Title',
    note: 'A story about the toledo bridge and its alpha device.',
    room: 'field.html#fieldsec-x',
    lines: [
      { text: 'A fielda hook line', steps: 1 },
      { text: 'A fielda payoff line', steps: 1 },
      { eyebrow: 'Fielda', text: 'Fielda term', src: 'Fielda Source, 1200' },
    ],
  };
  fs.writeFileSync(path.join(films, 'briefs', 'plate-fielda.json'), JSON.stringify(briefFielda));
  fs.writeFileSync(path.join(films, 'films', 'short-fielda.json'),
    JSON.stringify({ slug: 'short-fielda', title: 'Fielda Title', chapters: [{ beats: [{ hold: 4 }, { hold: 4 }] }] }));
  fs.writeFileSync(path.join(films, 'short-fielda-tall-30fps.mp4'), 'not really a video');

  const briefFieldno = {
    slug: 'short-fieldno', title: 'Fieldno Title',
    note: 'A story about a lighthouse and a compass rose in the harbor.',
    room: 'field.html#fieldsec-x',
    lines: [
      { text: 'A fieldno hook line', steps: 1 },
      { text: 'A fieldno payoff line', steps: 1 },
      { eyebrow: 'Fieldno', text: 'Fieldno term', src: 'Fieldno Source, 1300' },
    ],
  };
  fs.writeFileSync(path.join(films, 'briefs', 'plate-fieldno.json'), JSON.stringify(briefFieldno));
  fs.writeFileSync(path.join(films, 'films', 'short-fieldno.json'),
    JSON.stringify({ slug: 'short-fieldno', title: 'Fieldno Title', chapters: [{ beats: [{ hold: 4 }, { hold: 4 }] }] }));
  fs.writeFileSync(path.join(films, 'short-fieldno-tall-30fps.mp4'), 'not really a video');

  const res = spawnSync('python3', ['shortmanifest.py'], { cwd: films, encoding: 'utf8' });
  stderrOut = res.stderr || '';
  if (res.status !== 0) console.log((res.stdout || '') + stderrOut);

  const rowsPath = path.join(films, 'out', 'shorts-rows.json');
  const rows = fs.existsSync(rowsPath) ? JSON.parse(fs.readFileSync(rowsPath, 'utf8')).cards : [];
  row = rows.find(r => r.id === 'short-stub');
  rowFielda = rows.find(r => r.id === 'short-fielda');
  rowFieldno = rows.find(r => r.id === 'short-fieldno');

  ok(!!row, 'the row was built at all');
  if (row) {
    const fields = ['id', 'kind', 'title', 'hook', 'payoff', 'caption', 'story', 'src', 'room', 'tags', 'secs', 'cover', 'video', 'made'];
    ok(fields.every(f => f in row), 'every field is present: ' + fields.filter(f => !(f in row)).join(', '));
    ok(row.id === 'short-stub' && row.kind === 'short', 'id and kind: ' + row.id + ' / ' + row.kind);
    ok(row.title === 'A Stub Of Light', 'title is the brief\'s own title');
    ok(row.hook === 'A hook the test can check', 'hook is the first line');
    ok(row.payoff === 'The payoff sentence itself', 'payoff is the second to last line, not the source beat');
    ok(row.src === 'A Stub Source, about the year 1000', 'src is the last line\'s own src');
    ok(row.room === 'stub.html#stub-anchor', 'room is carried from the brief');
    ok(row.secs === 21, 'secs is the compiled film\'s hold plus the closing fade: ' + row.secs);
    ok(row.video === 'https://noorcodex.com/reels/short-stub.mp4', 'video: ' + row.video);
    /* a rendered wide file exists on disk for this stub, and the row still
       carries no "wide" key: a bare filename is not a url, and the only
       place "wide" may be written is publish-shorts.sh's merge, once an
       upload of that file has actually succeeded (see THE MERGE, below). */
    ok(!('wide' in row), 'wide is never a bare filename: only a successful upload ever writes it, elsewhere');
    ok(/^\d{4}-\d{2}-\d{2}$/.test(row.made || ''), 'made is a plain date: ' + row.made);
    ok(Array.isArray(row.tags) && row.tags.length > 0, 'tags is a real list');

    const roomLink = 'https://noorcodex.com/' + row.room;
    ok(row.caption.trimEnd().endsWith(row.tags.join(' ')), 'the caption ends with the tags');
    ok(row.caption.includes(roomLink), 'the caption carries the room link');
    ok(row.caption.length <= 500, 'the caption is under the shortest live network limit: ' + row.caption.length);
    ok(!DASH.test(row.caption), 'the caption carries no dash');

    ok(row.story.includes('stub account'), 'the story is read off the hero card\'s own paragraphs, not invented: ' + row.story.slice(0, 60));
    ok(row.story.includes('A second paragraph'), 'a second paragraph survives, blank line kept');
    ok(row.story.includes('Source: A Stub Source'), 'the story names the source');
    ok(row.story.trimEnd().endsWith(roomLink), 'the story ends with the room link');
    ok(row.story.length <= 4500, 'the story is under 4,500 characters: ' + row.story.length);
    ok(!DASH.test(row.story), 'the story carries no dash');
  }

  ok(!!rowFielda, 'the field-card row was built');
  if (rowFielda) {
    ok(rowFielda.story.includes('toledo bridge'), 'a brief that shares words with one of two cards gets that card\'s own paragraph: ' + rowFielda.story.slice(0, 70));
    ok(!rowFielda.story.includes('beta card'), 'and not the other card sharing the same anchor');
  }

  ok(!!rowFieldno, 'the no-match row was still built, off its own lines');
  if (rowFieldno) {
    ok(!rowFieldno.story.includes('alpha card') && !rowFieldno.story.includes('beta card'),
      'a brief that shares no word with either card never borrows either one\'s paragraph: ' + rowFieldno.story.slice(0, 70));
    ok(rowFieldno.story.includes('A fieldno hook line'), 'its story falls back to the brief\'s own lines instead');
  }
  ok(/WARNING/.test(stderrOut) && stderrOut.includes('Fieldno Title'), 'the no-match case prints a warning naming the brief, not a silent wrong pick');
  ok(!stderrOut.includes('Fielda Title'), 'the matched case prints no warning at all');
}

/* =========================================================================
   THE PUT: blobput.py, the Mac's uploader, against a local stand in shelf
   ========================================================================= */
console.log('\nthe put blobput.py makes');
{
  const r = spawnSync('python3', [path.join(ROOT, 'tools', 'films', 'test_blobput.py')], { encoding: 'utf8' });
  ok(r.status === 0, 'blobput.py sends the request @vercel/blob sends, retries a 5xx, stops on a 4xx, never shows the token: ' + String(r.stdout || '').trim().split('\n').pop() + (r.status === 0 ? '' : ' ' + String(r.stderr || '').slice(-300)));
  const sh = fs.readFileSync(path.join(ROOT, 'tools', 'films', 'publish-shorts.sh'), 'utf8');
  ok(/python3 blobput\.py put /.test(sh) && !/\bnode /.test(sh.replace(/#.*$/gm, '')), 'publish-shorts.sh uploads with blobput.py and needs no node');
  ok(/shelf\/index\.json/.test(sh) && /shelf\/know\.json/.test(fs.readFileSync(path.join(ROOT, 'tools', 'films', 'shortmanifest.py'), 'utf8')), 'both fall back to the shelf/ folder that travels to the Mac');
  ok(/out\/main\/reels/.test(sh), 'the merged shelf is also written under out/main/reels with its real name');
  ok(!/BLOB_READ_WRITE_TOKEN=/.test(sh.replace(/#.*$/gm, '')), 'the token is never assigned in the script');
}

/* =========================================================================
   THE MERGE: publish-shorts.sh's own python, extracted and run for real
   ========================================================================= */
console.log('\nthe merge into reels/index.json');
{
  const shPath = path.join(ROOT, 'tools', 'films', 'publish-shorts.sh');
  const src = fs.readFileSync(shPath, 'utf8');
  const m = src.match(/<<'PY'\n([\s\S]*?)\nPY\n/);
  ok(!!m, 'publish-shorts.sh still carries exactly one python heredoc to extract');
  ok(!/\bHOME=/.test(src), 'the shell\'s own HOME is never reassigned by this script');

  if (m) {
    const scratch = tmpdir('shorts-merge');
    fs.mkdirSync(path.join(scratch, 'out'));
    fs.writeFileSync(path.join(scratch, 'merge.py'), m[1]);

    const up = [{ id: 'short-stub', video: 'https://blob.example/reels/short-stub.mp4', wide: 'https://blob.example/reels/short-stub-wide.mp4', cover: 'https://blob.example/reels/short-stub-cover.jpg' }];
    fs.writeFileSync(path.join(scratch, 'up.json'), JSON.stringify(up));
    fs.writeFileSync(path.join(scratch, 'rows.json'), JSON.stringify({ n: 1, kind: 'short', cards: [row || { id: 'short-stub', kind: 'short' }] }));
    const existingIndex = {
      n: 3, written: '2026-09-01T00:00:00Z',
      cards: [
        { id: 'know-foo', kind: 'know', hook: 'x' },
        { id: 'short-stub', kind: 'short', hook: 'old, before the merge' },
        { id: 'verse-bar', kind: 'verse', hook: 'y' },
      ],
    };
    fs.writeFileSync(path.join(scratch, 'index.json'), JSON.stringify(existingIndex));
    fs.writeFileSync(path.join(scratch, 'home.json'), JSON.stringify({ n: 1, written: '2026-09-01T00:00:00Z', shorts: 0, cards: [{ id: 'verse-bar', kind: 'verse' }] }));

    execFileSync('python3', ['merge.py', 'up.json', 'rows.json', 'index.json', 'home.json'], { cwd: scratch });

    const merged = JSON.parse(fs.readFileSync(path.join(scratch, 'out', 'index.merged.json'), 'utf8'));
    ok(merged.cards.length === 3, 'no row of another kind was dropped: ' + merged.cards.length + ' of 3');
    ok(merged.cards.some(c => c.id === 'know-foo'), 'the know row survives untouched');
    ok(merged.cards.some(c => c.id === 'verse-bar'), 'the verse row survives untouched');
    const merged_short = merged.cards.find(c => c.id === 'short-stub');
    ok(merged.cards.filter(c => c.id === 'short-stub').length === 1, 'the short is replaced in place, not appended a second time');
    ok(!!merged_short && merged_short.video === 'https://blob.example/reels/short-stub.mp4', 'the merged row carries the uploaded video url');
    ok(!!merged_short && merged_short.wide === 'https://blob.example/reels/short-stub-wide.mp4', 'and the uploaded wide url');
    ok(!!merged_short && merged_short.cover === 'https://blob.example/reels/short-stub-cover.jpg', 'and the uploaded cover url, not the bare true shortmanifest wrote');
    ok(!!merged_short && merged_short.hook !== 'old, before the merge', 'the old row content is replaced, not kept beside the new one');

    const appendIndex = { n: 1, written: '', cards: [{ id: 'know-foo', kind: 'know' }] };
    fs.writeFileSync(path.join(scratch, 'index.json'), JSON.stringify(appendIndex));
    execFileSync('python3', ['merge.py', 'up.json', 'rows.json', 'index.json', 'home.json'], { cwd: scratch });
    const merged2 = JSON.parse(fs.readFileSync(path.join(scratch, 'out', 'index.merged.json'), 'utf8'));
    ok(merged2.cards.length === 2 && merged2.cards.some(c => c.id === 'short-stub'), 'a row with no existing id is appended, not dropped');

    /* THE STALE DUPLICATE: a shelf that already carries the same id twice
       (an old merge bug, now fixed elsewhere, could still have left one
       behind) must come out of a fresh merge holding exactly one row for
       that id, not two. */
    const dupedIndex = {
      n: 4, written: '2026-09-01T00:00:00Z',
      cards: [
        { id: 'know-foo', kind: 'know', hook: 'x' },
        { id: 'short-stub', kind: 'short', hook: 'old copy one' },
        { id: 'short-stub', kind: 'short', hook: 'old copy two, left behind by the bug this fixes' },
        { id: 'verse-bar', kind: 'verse', hook: 'y' },
      ],
    };
    fs.writeFileSync(path.join(scratch, 'index.json'), JSON.stringify(dupedIndex));
    execFileSync('python3', ['merge.py', 'up.json', 'rows.json', 'index.json', 'home.json'], { cwd: scratch });
    const merged3 = JSON.parse(fs.readFileSync(path.join(scratch, 'out', 'index.merged.json'), 'utf8'));
    const shorts3 = merged3.cards.filter(c => c.id === 'short-stub');
    ok(shorts3.length === 1, 'a shelf that already carried the id twice holds exactly one row after the merge: ' + shorts3.length);
    ok(shorts3[0] && shorts3[0].video === 'https://blob.example/reels/short-stub.mp4', 'and it is the freshly uploaded row, not either stale copy');
    ok(merged3.cards.length === 3, 'the shelf itself lost the duplicate rather than gaining a third row: ' + merged3.cards.length);

    /* =====================================================================
       A ROW MAY NOT PROMISE A COVER THAT IS NOT THERE

       This is the 17 September fault, in the only place that can prevent it.
       The row shortmanifest writes carries cover: true, which sends the
       poster to reels/<id>-cover.jpg on the site; nothing made that file, and
       Instagram is the one network that refuses a reel without a cover. Every
       other network took the film, so the shelf looked healthy and the
       failure appeared once an afternoon, in public, reading "could not
       process the video" when the video was fine.

       Two things are proved. A film whose cover did not reach the shelf is
       held back rather than listed. And when the shelf ALREADY carries that
       film, holding it back would take it off the live site, so the whole run
       refuses and writes nothing instead: broken is better than missing, and
       neither is allowed to happen quietly.
       ===================================================================== */
    const noCover = [{ id: 'short-stub', video: 'https://blob.example/reels/short-stub.mp4' }];
    fs.writeFileSync(path.join(scratch, 'up.json'), JSON.stringify(noCover));

    /* a shelf with no film on it yet: the run may proceed, and must simply
       not list the one whose cover is missing */
    fs.writeFileSync(path.join(scratch, 'index.json'), JSON.stringify({ n: 1, written: '', cards: [{ id: 'know-foo', kind: 'know' }] }));
    fs.rmSync(path.join(scratch, 'out', 'index.merged.json'), { force: true });
    const r5 = spawnSync('python3', ['merge.py', 'up.json', 'rows.json', 'index.json', 'home.json'], { cwd: scratch, encoding: 'utf8' });
    const merged5 = fs.existsSync(path.join(scratch, 'out', 'index.merged.json'))
      ? JSON.parse(fs.readFileSync(path.join(scratch, 'out', 'index.merged.json'), 'utf8')) : { cards: [] };
    ok(!merged5.cards.some(c => c.id === 'short-stub'),
       'a film whose cover never reached the shelf is not listed on the shelf');
    ok(/no cover uploaded/.test(String(r5.stdout || '')),
       'and the run says so by name rather than dropping it in silence');

    /* the same missing cover, but the film is already live: taking it off
       would be worse, so nothing at all is written */
    fs.writeFileSync(path.join(scratch, 'index.json'), JSON.stringify({
      n: 2, written: '', cards: [{ id: 'know-foo', kind: 'know' }, { id: 'short-stub', kind: 'short', video: 'https://blob.example/reels/short-stub.mp4' }],
    }));
    fs.rmSync(path.join(scratch, 'out', 'index.merged.json'), { force: true });
    const r6 = spawnSync('python3', ['merge.py', 'up.json', 'rows.json', 'index.json', 'home.json'], { cwd: scratch, encoding: 'utf8' });
    ok(r6.status !== 0, 'a missing cover on a film the shelf already carries stops the run: exit ' + r6.status);
    ok(!fs.existsSync(path.join(scratch, 'out', 'index.merged.json')),
       'and nothing is written, so the live shelf cannot lose the film either');

    /* put the good upload back for anything after this */
    fs.writeFileSync(path.join(scratch, 'up.json'), JSON.stringify(up));

    ok(fs.existsSync(path.join(scratch, 'out', 'home.merged.json')), 'home.merged.json is written when reels/home.json exists');
    const home = JSON.parse(fs.readFileSync(path.join(scratch, 'out', 'home.merged.json'), 'utf8'));
    ok(home.shorts === 1, 'home.merged.json\'s shorts count reflects the merged shelf: ' + home.shorts);
    ok(home.cards.length === 1 && home.cards[0].id === 'verse-bar', 'home.json\'s verse rows are untouched, since a short carries no verse');
  }
}

/* =========================================================================
   THE POST: buildSlot carries a short's own fields (api/_schedule.js)
   ========================================================================= */
console.log('\nreelRoom sends a short to its own room, not home');
{
  const r = { id: 'short-darkroom', kind: 'short', room: 'heroes.html#f-seeing' };
  ok(S.reelRoom(r) === '/heroes.html#f-seeing', 'reelRoom: ' + S.reelRoom(r));
  const noRoom = { id: 'short-x', kind: 'short' };
  ok(S.reelRoom(noRoom) === '/', 'a short with no room falls back to the shelf, not a crash');
}

console.log('\nbuildSlot carries the row\'s story, title, hook, payoff, tags, wide, src and room onto the post');
let post = null;
const publishedRow = row ? {
  ...row,
  wide: 'https://noorcodex.com/reels/short-stub-wide.mp4',
  cover: 'https://noorcodex.com/reels/short-stub-cover.jpg',
} : null;
{
  if (publishedRow) {
    post = S.buildSlot('reelD', {
      date: '2026-09-20', base: 'https://noorcodex.com',
      hijri: null, day: null, leads: [], words: [], path: [],
      reel: publishedRow,
    });
  }
  ok(!!post, 'a post was built from the real, published row');
  if (post) {
    /* this is the exact gap the refuter found: shapeRaw's short branch
       (api/_channels.js) reads p.story, p.title, p.hook, p.payoff, p.tags,
       p.wide, p.src and p.room, and none of them existed on the post this
       function used to build -- so the branch below never actually ran in
       production, on any network, ever. */
    ok(post.kind === 'short', 'kind carries through: ' + post.kind);
    ok(post.title === publishedRow.title, 'title is the film\'s own title: ' + post.title);
    ok(post.title !== publishedRow.hook, 'and not the hook, which is a different sentence');
    ok(post.hook === publishedRow.hook, 'hook carries through');
    ok(post.payoff === publishedRow.payoff, 'payoff carries through');
    ok(post.story === publishedRow.story, 'story carries through');
    ok(post.src === publishedRow.src, 'src carries through');
    ok(post.room === publishedRow.room, 'room carries through');
    ok(Array.isArray(post.tags) && post.tags.join(' ') === publishedRow.tags.join(' '), 'tags carry through');
    ok(post.wide === publishedRow.wide, 'wide carries through');
    ok(post.link === 'https://noorcodex.com' + S.reelRoom(publishedRow), 'link is built from the row\'s own room');
  }
}

console.log('\nan ordinary reel through buildSlot carries none of the short-only fields');
{
  const verseRow = {
    id: 'verse-1', kind: 'verse', hook: 'Ayat one',
    caption: 'The verse caption.\n\nhttps://noorcodex.com/verse/1',
    video: 'https://noorcodex.com/reels/verse-1.mp4', cover: 'https://noorcodex.com/reels/verse-1-cover.jpg',
  };
  const vpost = S.buildSlot('reelD', {
    date: '2026-09-20', base: 'https://noorcodex.com',
    hijri: null, day: null, leads: [], words: [], path: [],
    reel: verseRow,
  });
  ok(!!vpost, 'an ordinary reel still composes');
  if (vpost) {
    ok(vpost.title === verseRow.hook, 'title stays the hook for an ordinary reel, exactly as before');
    ok(!('story' in vpost), 'no story field leaks onto an ordinary reel');
    ok(!('wide' in vpost), 'no wide field leaks onto an ordinary reel');
    ok(Array.isArray(vpost.tags) && vpost.tags.length === 0, 'tags stay empty for an ordinary reel, exactly as before');
  }
}

/* =========================================================================
   THE SHAPE: api/_channels.js for kind "short", on the REAL post
   ========================================================================= */
console.log('\nhow each network shapes a short');
{
  ok(!!post, 'a post was built to shape (see above)');

  if (post) {
    const yt = CH.shape(post, 'youtube');
    ok(!!yt, 'youtube shapes a short');
    if (yt) {
      /* the Short itself: always the tall file, titled the hook with
         #Shorts, same as any other reel's -- never the wide file, which is
         a second, separate upload (sendYouTubeBoth, api/social.js), never
         built by shape()/shapeRaw() at all */
      ok(yt.video === post.video, 'youtube\'s Short is the tall file, never the wide one');
      ok(yt.title === post.hook + ' #Shorts', 'youtube\'s Short is titled the hook, not the film\'s own title: ' + yt.title);
      ok(yt.text.length <= CH.SPEC.youtube.chars, 'youtube description under its limit: ' + yt.text.length);
      ok(yt.text.includes(post.story.slice(0, 40)), 'youtube description carries the story');
      ok(yt.text.includes('Source: ' + post.src), 'youtube description carries the source');
      ok(yt.text.trimEnd().endsWith(post.link) || yt.text.includes(post.link), 'youtube description carries the room link');
      ok(!DASH.test(yt.text), 'youtube description carries no dash');
    }

    const ytWide = CH.shapeYouTubeWide(post);
    ok(!!ytWide, 'shapeYouTubeWide builds the second, ordinary video');
    if (ytWide) {
      ok(ytWide.video === post.wide, 'the wide video is the wide file');
      ok(ytWide.title === post.title, 'titled the film\'s own title, not the hook: ' + ytWide.title);
      ok(!/#Shorts/.test(ytWide.title), 'never #Shorts: this upload is not filed as one');
      ok(ytWide.description.includes(post.story.slice(0, 40)), 'the same story as the Short\'s description');
      ok(!DASH.test(ytWide.description), 'carries no dash');
    }
    const noWidePost = { ...post, wide: '' };
    ok(CH.shapeYouTubeWide(noWidePost) === null, 'shapeYouTubeWide builds nothing for a short with no wide file');
    ok(CH.shapeYouTubeWide({ ...post, kind: 'verse' }) === null, 'and nothing for anything that is not a short');

    /* the refuter's second gap: a short row with a wide file but no story
       (an older brief, or one clipped to nothing more to say) still has to
       hold the hook title and the wide upload, falling back to the row's
       own caption rather than dropping to the generic path */
    const noStoryPost = { ...post, story: undefined };
    const ytNoStory = CH.shape(noStoryPost, 'youtube');
    ok(!!ytNoStory, 'a short with no story still shapes for youtube');
    ok(ytNoStory.title === noStoryPost.hook + ' #Shorts', 'and keeps the hook title, not the film\'s plain title: ' + ytNoStory.title);
    ok(ytNoStory.text.includes(noStoryPost.caption.slice(0, 20)), 'its description falls back to the caption');
    const ytWideNoStory = CH.shapeYouTubeWide(noStoryPost);
    ok(!!ytWideNoStory, 'shapeYouTubeWide still builds the wide upload without a story: ' + JSON.stringify(ytWideNoStory));
    if (ytWideNoStory) {
      ok(ytWideNoStory.video === noStoryPost.wide, 'carrying the same wide file');
      ok(ytWideNoStory.title === noStoryPost.title && !/#Shorts/.test(ytWideNoStory.title), 'titled the film\'s own title, still never #Shorts');
      ok(ytWideNoStory.description.includes(noStoryPost.caption.slice(0, 20)), 'its description also falls back to the caption');
    }

    for (const ch of ['facebook', 'instagram']) {
      const s = CH.shape(post, ch);
      ok(!!s, ch + ' shapes a short');
      if (s) {
        ok(s.text.length <= CH.SPEC[ch].chars, ch + ' text under its limit: ' + s.text.length);
        ok(s.text.includes('Source: ' + post.src), ch + ' keeps the source (the tail survives a cut)');
        /* the tags close every caption on this network, same as a reel's;
           the link is the paragraph just before them, not the last line */
        ok(s.text.includes(post.link), ch + ' keeps the room link (the tail survives a cut): ' + s.text.slice(-90));
        ok(s.text.trimEnd().endsWith(post.tags.join(' ')), ch + ' ends with the tags: ' + s.text.slice(-60));
        ok(!DASH.test(s.text), ch + ' carries no dash');
        ok(s.video === undefined || s.video === null, ch + ' is not offered the video the tall reel path would send');
      }
    }

    const th = CH.shape(post, 'threads');
    ok(!!th, 'threads shapes a short');
    if (th) {
      ok(th.text.length <= CH.SPEC.threads.chars, 'threads text under 500: ' + th.text.length);
      ok(th.text.includes(post.hook), 'threads carries the hook');
      ok(th.text.includes(post.payoff), 'threads carries the payoff sentence');
      ok(th.text.trimEnd().endsWith(post.link), 'threads ends with the room link: ' + th.text.slice(-60));
      ok(!DASH.test(th.text), 'threads carries no dash');
    }

    const pin = CH.shape(post, 'pinterest');
    ok(!!pin, 'pinterest shapes a short');
    if (pin) {
      ok(pin.title === post.title, 'pinterest title is the film\'s own title');
      ok(pin.title.length <= 100, 'pinterest title under 100');
      ok(pin.text.length <= 500, 'pinterest description under 500: ' + pin.text.length);
      ok(pin.text.includes(post.hook) && pin.text.includes(post.payoff), 'pinterest description carries the hook and the payoff');
      ok(pin.text.includes(post.link), 'pinterest description carries the room link');
      ok(!DASH.test(pin.text), 'pinterest carries no dash');
    }

    const tg = CH.shape(post, 'telegram');
    ok(!!tg, 'telegram shapes a short');
    if (tg) {
      ok(tg.text.length <= CH.SPEC.telegram.chars, 'telegram under 1,024: ' + tg.text.length);
      ok(tg.text.includes(post.link.replace(/&/g, '&amp;')), 'telegram carries the link (the row\'s own caption already ends with it)');
    }
  }
}

console.log('\na reel (not a short) is untouched by any of this');
{
  const reel = {
    kind: 'verse', title: 'A verse', hook: 'A verse', caption: 'The verse caption, ending in the link.\n\nhttps://noorcodex.com/verse/1',
    link: 'https://noorcodex.com/verse/1', image: 'https://noorcodex.com/reels/verse-1-cover.jpg', video: 'https://noorcodex.com/reels/verse-1.mp4',
  };
  const fb = CH.shape(reel, 'facebook');
  ok(fb.text === reel.caption, 'a reel still goes out as its own caption, whole, unshaped by the short path');
}

/* =========================================================================
   THE SEND: sendOne, through the real sendSlot (api/social.js)
   ========================================================================= */
console.log('\nYouTube: a short with a wide file goes twice, in one slot (api/social.js, api/_youtube.js)');
{
  process.env.YT_CLIENT_ID = 'test-client'; process.env.YT_CLIENT_SECRET = 'test-secret'; process.env.YT_REFRESH_TOKEN = 'test-refresh';
  /* KV is needed here, for real: the daily cap this section tests is read
     and written through it (usedToday, status's own token cache), so an
     in memory store stands in for it, the same way tests/dup.mjs stubs it
     for Facebook's duplicate guard. Every other channel stays unconfigured,
     so youtube is the only live channel and nothing else needs a stub. */
  process.env.KV_REST_API_URL = 'https://kv.test'; process.env.KV_REST_API_TOKEN = 't';
  delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.REDIS_URL; delete process.env.KV_URL; delete process.env.REDIS_TLS_URL;
  delete process.env.FB_PAGE_ID; delete process.env.FB_PAGE_TOKEN;
  delete process.env.IG_USER_ID; delete process.env.IG_TOKEN; delete process.env.IG_ACCESS_TOKEN;
  delete process.env.PIN_BOARD_ID; delete process.env.PIN_BOARD_NAME; delete process.env.PIN_TOKEN;
  delete process.env.PIN_APP_ID; delete process.env.PIN_APP_SECRET;
  delete process.env.TH_TOKEN; delete process.env.TG_BOT_TOKEN; delete process.env.TG_CHAT_ID;
  delete process.env.LI_ORG_URN; delete process.env.LI_TOKEN;
  delete process.env.X_ENABLE; delete process.env.X_TOKEN;

  /* mirrors _youtube.js's own private K_DAY key, unexported */
  const K_DAY = d => 'nsoc:yt:day:' + d;
  let STORE = new Map(), LISTS = new Map(), HASHES = new Map();
  const kvHandle = cmd => {
    const [v, k, ...r] = cmd;
    if (v === 'GET') return { result: STORE.has(k) ? STORE.get(k) : null };
    if (v === 'SET') { STORE.set(k, r[0]); return { result: 'OK' }; }
    if (v === 'INCR') { const n = (parseInt(STORE.get(k), 10) || 0) + 1; STORE.set(k, String(n)); return { result: n }; }
    if (v === 'EXPIRE') return { result: 1 };
    if (v === 'LPUSH') { const l = LISTS.get(k) || []; l.unshift(r[0]); LISTS.set(k, l); return { result: l.length }; }
    if (v === 'LTRIM') { const l = LISTS.get(k) || []; LISTS.set(k, l.slice(parseInt(r[0], 10), (parseInt(r[1], 10) + 1) || undefined)); return { result: 'OK' }; }
    if (v === 'LRANGE') { const l = LISTS.get(k) || []; return { result: l.slice(parseInt(r[0], 10), (parseInt(r[1], 10) + 1) || undefined) }; }
    if (v === 'HSET') { const h = HASHES.get(k) || new Map(); h.set(r[0], r[1]); HASHES.set(k, h); return { result: 1 }; }
    if (v === 'HDEL') { const h = HASHES.get(k) || new Map(); const had = h.delete(r[0]) ? 1 : 0; return { result: had }; }
    if (v === 'HGETALL') { const h = HASHES.get(k) || new Map(); return { result: [...h.entries()].flat() }; }
    return { result: null };
  };
  let statusReply = { items: [{ status: { uploadStatus: 'processed' } }] };
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url, opt) => {
    const u = String(url);
    if (u.startsWith('https://kv.test')) {
      const cmds = JSON.parse(opt.body);
      return { ok: true, status: 200, json: async () => cmds.map(kvHandle) };
    }
    if (u.includes('oauth2.googleapis.com/token'))
      return { ok: true, status: 200, json: async () => ({ access_token: 'ya29.stub', expires_in: 3599 }) };
    if (u.includes('/youtube/v3/videos') && u.includes('part=status'))
      return { ok: true, status: 200, json: async () => statusReply };
    throw new Error('unexpected fetch in the youtube dual upload test: ' + u);
  };

  const CTX = {
    plan: { hijri: null, day: null, leads: [] },
    index: { words: [], path: [] },
    dials: { polish: false, mode: 'auto', storeOk: true, stories: false, cardsFeed: true },
  };
  const withWide = {
    id: 'short-send', kind: 'short',
    title: 'A Stub Of Light', hook: 'A hook the test can check', payoff: 'The payoff sentence itself',
    caption: 'A caption ending in a link.\n\nhttps://noorcodex.com/stub.html#stub-anchor\n\n#Islam #NoorCodexOfLight',
    story: 'A long story, ' + 'told at length. '.repeat(20), src: 'A Stub Source, about the year 1000',
    room: 'stub.html#stub-anchor', tags: ['#Islam', '#NoorCodexOfLight'], secs: 21, cover: true,
    video: 'https://noorcodex.com/reels/short-send.mp4', wide: 'https://noorcodex.com/reels/short-send-wide.mp4',
    made: '2026-09-16',
  };

  const origYT = CH.SENDERS.youtube;
  let calls = [];
  /* stands in for YT.upload (and so for CH.SENDERS.youtube, its one caller):
     no real network upload, but it still counts the Short against the same
     day counter YT.usedToday reads, exactly as upload()'s own countOne()
     would, so the cap scenario below is a real cap, not a pretended one. */
  CH.SENDERS.youtube = async (shaped, opts) => {
    const isWide = !!(opts && opts.short === false);
    calls.push({ video: shaped.video, title: shaped.title, wide: isWide });
    if (!isWide) {
      const key = K_DAY(opts.date);
      STORE.set(key, String((parseInt(STORE.get(key), 10) || 0) + 1));
      return { ok: true, id: 'short-' + calls.length, url: 'https://youtube.com/shorts/short-' + calls.length };
    }
    return { ok: true, id: 'wide-' + calls.length, url: 'https://www.youtube.com/watch?v=wide-' + calls.length };
  };

  try {
    console.log('  the two uploads, in order');
    STORE.clear(); LISTS.clear(); HASHES.clear(); calls = [];
    statusReply = { items: [{ status: { uploadStatus: 'processed' } }] };
    const r1 = await SOC.sendSlot('noorcodex.com', '2026-09-20', 'reelD', { ...CTX, extras: { reel: withWide } });
    ok(calls.length === 2, 'two uploads were made: ' + calls.length);
    ok(!calls[0].wide && calls[0].video === withWide.video, 'the first is the tall file, not marked wide: ' + JSON.stringify(calls[0]));
    ok(calls[0].title === withWide.hook + ' #Shorts', 'the first is titled the hook, filed as a Short: ' + calls[0].title);
    ok(calls[1].wide && calls[1].video === withWide.wide, 'the second is the wide file, marked wide: ' + JSON.stringify(calls[1]));
    ok(calls[1].title === withWide.title, 'the second is titled the film\'s own title: ' + calls[1].title);
    const yt1 = r1.results && r1.results.youtube;
    ok(!!yt1 && yt1.ok && yt1.id === 'short-1', 'the slot\'s own id is the Short\'s: ' + JSON.stringify(yt1));
    ok(!!yt1 && yt1.wide && yt1.wide.id === 'wide-2' && yt1.wide.url, 'wide carries the second upload\'s id and url: ' + JSON.stringify(yt1 && yt1.wide));

    console.log('  the cap with room for exactly one');
    STORE.clear(); LISTS.clear(); HASHES.clear(); calls = [];
    STORE.set(K_DAY('2026-09-21'), String(YT.DAILY_CAP - 1));
    const r2 = await SOC.sendSlot('noorcodex.com', '2026-09-21', 'reelD', { ...CTX, extras: { reel: withWide } });
    ok(calls.length === 1, 'only the Short was attempted once the cap had room for one: ' + calls.length);
    const yt2 = r2.results && r2.results.youtube;
    ok(!!yt2 && yt2.ok && yt2.wide && yt2.wide.skipped === 'cap', 'the Short still went, and wide was recorded as skipped for the cap, not attempted: ' + JSON.stringify(yt2));

    console.log('  a duplicate refusal on the wide upload');
    STORE.clear(); LISTS.clear(); HASHES.clear(); calls = [];
    statusReply = { items: [{ status: { uploadStatus: 'rejected', rejectionReason: 'duplicate' } }] };
    const r3 = await SOC.sendSlot('noorcodex.com', '2026-09-22', 'reelD', { ...CTX, extras: { reel: withWide } });
    ok(calls.length === 2, 'both were still attempted: ' + calls.length);
    const yt3 = r3.results && r3.results.youtube;
    ok(!!yt3 && yt3.ok, 'the Short\'s own ok stands, untouched by the wide refusal');
    ok(!!yt3 && yt3.wide && yt3.wide.refused === 'duplicate', 'wide is refused for duplicate, not silently dropped: ' + JSON.stringify(yt3 && yt3.wide));

    console.log('  the finisher settles a wide left pending, never uploading again');
    STORE.clear(); LISTS.clear(); HASHES.clear(); calls = [];
    const FDATE = '2026-09-24';
    const slotKey = 'nsoc:slot:' + FDATE + '#reelD';
    const withPendingWide = () => STORE.set(slotKey, JSON.stringify({ at: FDATE + 'T08:00:00Z', slot: 'reelD', state: 'sent', title: 'A Stub Of Light',
      results: { youtube: { ok: true, id: 'short-9', url: 'https://youtube.com/shorts/short-9', wide: { pending: 'wide-9' } } } }));

    withPendingWide();
    statusReply = { items: [{ status: { uploadStatus: 'processed' } }] };
    let ran = await SOC.finishPendingReels(FDATE, { ran: [] });
    let rec = JSON.parse(STORE.get(slotKey));
    ok(calls.length === 0, 'settling a pending wide never uploads again: ' + calls.length);
    ok(rec.results.youtube.ok === true, 'the Short\'s own ok is visited and left standing');
    ok(rec.results.youtube.wide.id === 'wide-9' && rec.results.youtube.wide.url === 'https://www.youtube.com/watch?v=wide-9',
       'a processed wide settles into id and url: ' + JSON.stringify(rec.results.youtube.wide));
    ok(ran.some(x => x.where === 'youtube wide' && x.ok === true), 'and the run says it was finished');

    withPendingWide();
    statusReply = { items: [{ status: { uploadStatus: 'rejected', rejectionReason: 'duplicate' } }] };
    ran = await SOC.finishPendingReels(FDATE, { ran: [] });
    rec = JSON.parse(STORE.get(slotKey));
    ok(calls.length === 0, 'a duplicate discovered on settling still never uploads again');
    ok(rec.results.youtube.ok === true && rec.results.youtube.wide.refused === 'duplicate',
       'a rejected wide settles into refused, the Short\'s own ok untouched: ' + JSON.stringify(rec.results.youtube.wide));

    withPendingWide();
    statusReply = { items: [{ status: { uploadStatus: 'uploaded' } }] };
    ran = await SOC.finishPendingReels(FDATE, { ran: [] });
    rec = JSON.parse(STORE.get(slotKey));
    ok(rec.results.youtube.wide.pending === 'wide-9', 'still processing: the pending id is left exactly as it was');
    ok(!ran.some(x => x.where === 'youtube wide'), 'and nothing is reported finished while it still processes');

    console.log('  a reel, not a short, is unchanged');
    STORE.clear(); LISTS.clear(); HASHES.clear(); calls = [];
    const reel = {
      id: 'verse-send', kind: 'verse', hook: 'A verse', caption: 'The verse caption.\n\nhttps://noorcodex.com/verse/1',
      video: 'https://noorcodex.com/reels/verse-send.mp4', cover: 'https://noorcodex.com/reels/verse-send-cover.jpg',
    };
    const r4 = await SOC.sendSlot('noorcodex.com', '2026-09-23', 'reelD', { ...CTX, extras: { reel } });
    ok(calls.length === 1, 'one upload only, exactly as before this existed: ' + calls.length);
    const yt4 = r4.results && r4.results.youtube;
    ok(!!yt4 && yt4.ok && !('wide' in yt4), 'no wide key at all on an ordinary reel\'s result');
  } finally {
    CH.SENDERS.youtube = origYT;
    globalThis.fetch = origFetch;
  }
}

/* ---------------------------------------------------------------------------
   THE COVER

   On 17 September the first film went to YouTube, Facebook, Threads and
   Telegram and was refused by Instagram. The message read "could not process
   the video: ERROR", so two hours went into the encode, which was correct.
   The real answer came from the house's own retry: "the card URL answered
   404". Instagram is the one network whose spec marks the image required, and
   shortmanifest writes cover: true into every film's row, which makes the
   poster look for reels/<id>-cover.jpg on the site. Nothing in the film
   pipeline ever made that file. Every one of the twenty two films carried the
   same hole and every one of them would have been refused in turn.

   The shape of the bug is what matters: a row PROMISED a picture that was
   never made, and nothing anywhere compared the promise against the folder.
   So that comparison is the test. It runs against the real shelf and the real
   reels folder, so a film added later without a cover fails here rather than
   at two o'clock on a Tuesday in front of an audience.
--------------------------------------------------------------------------- */
{
  console.log('\n  the cover every row promises');
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const ixPath = path.join(root, 'reels', 'index.json');
  if (!fs.existsSync(ixPath)) {
    console.log('  (no reels/index.json in this tree, skipped)');
  } else {
    const ix = JSON.parse(fs.readFileSync(ixPath, 'utf8'));
    const cards = ix.cards || [];
    /* api/_reels.js and api/_schedule.js both build the same url: a cover
       that is not already a url becomes reels/<id>-cover.jpg on the site. */
    const promised = cards.filter(c => c && c.cover && !/^https?:\/\//.test(String(c.cover)));
    const missing = promised.filter(c => !fs.existsSync(path.join(root, 'reels', c.id + '-cover.jpg')));
    /* A WORKING TREE WITHOUT THE BINARIES IS NOT THE BUG. The covers are
       fifteen hundred jpegs and several trees here carry the json sidecars
       without them. None present at all means a partial checkout; SOME
       present and some not is the fault this test exists for, and that is the
       shape the twenty two films had: 1,479 covers on disk and 22 rows
       promising one that nobody made. */
    const onDisk = promised.length - missing.length;
    if (onDisk === 0 && promised.length > 0) {
      console.log('  (this tree carries no cover files at all, so it is a partial'
                  + ' checkout rather than a shelf with holes in it: skipped)');
    } else {
    ok(promised.length > 0, 'the shelf has rows promising a cover file: ' + promised.length);
    ok(missing.length === 0,
       missing.length === 0
         ? 'every row promising a cover has one on disk'
         : missing.length + ' rows promise a cover that is not there, the first being '
           + missing.slice(0, 3).map(c => c.id).join(', '));

    /* and the films specifically, because they are the ones that were wrong
       and the ones still being added */
    const films = promised.filter(c => c.kind === 'short');
    const filmsMissing = films.filter(c => !fs.existsSync(path.join(root, 'reels', c.id + '-cover.jpg')));
    ok(filmsMissing.length === 0,
       filmsMissing.length === 0
         ? 'every film on the shelf has its cover: ' + films.length + ' of ' + films.length
         : filmsMissing.length + ' films have no cover: ' + filmsMissing.map(c => c.id).join(', '));

    /* a cover Instagram will not take is as bad as one that is not there */
    const tooBig = promised
      .map(c => path.join(root, 'reels', c.id + '-cover.jpg'))
      .filter(f => fs.existsSync(f) && fs.statSync(f).size > 8 * 1024 * 1024);
    ok(tooBig.length === 0,
       tooBig.length === 0
         ? 'no cover is over the 8MB Meta refuses'
         : tooBig.length + ' covers are over 8MB');
    }
  }
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
