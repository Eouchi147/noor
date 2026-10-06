/* NOOR · the Lantern's two levers on the posting machine (api/_levers.js).
   ---------------------------------------------------------------------------
   rota-lean: one reel slot, for 1 to 7 days, carries a named kind instead of
   the rota's. fix-posting: repair what today's schedule already owes, through
   exactly the functions the Steward's own buttons call. Proven here with the
   store and every network stood in for (tests/_soul-harness.mjs):

     1. PARITY. With no lean set, the picker and every view of a day choose
        exactly what they chose before leans existed. Two ways, both run:
        a. a fingerprint of 52,800 picks over 400 days and every half
           (chooseReel 43,200 with three duplicate windows, both arms of the
           verse-length test and a Hijri day; chooseReelWithOverride and
           otherPicksFor 4,800 each over a store holding every kind of
           override and some slot records), on a fixed synthetic shelf,
           COMPUTED WITH THE CODE AS IT STOOD AT e218091 (the parent of this
           change) and written below as constants;
        b. when the original modules can be had (a copy under
           /tmp/levers-parity, or `git show e218091:api/...`), a direct side
           by side against them, on the real shelf as well.
        Then every view (runDue's dry run, the plan and today previews, the
        Lantern's line-up tool, the planner's lineupPreview, the line-up
        door, the insights reconstruction) is held to the original picker
        for 400 days, every reel half.
     2. the lean store, read fail open (a fault, a malformed list, more leans
        on a date than the rules allow, two on one slot: no lean);
     3. every rule a lean is set under, one at a time;
     4. the picker under a lean: the kind changes on covered dates only, the
        experiment's arm still applies inside the lean's kind, an override
        still wins on its own slot, a leaned card never lands on a card
        another slot of the day shows;
     5. with a lean, every view of the day agrees, the record of a real send
        carries lean {id, kind} exactly when the lean decided it, and the
        daily stats snapshot stores the kind that record says, never the
        rota's once the card has left the shelf (review of 6 October 2026);
     6. the rota-lean hand through runHand: R2 under the council, cap rota
        1 a day plus the R2 total, a compare and set write, an undo that
        removes exactly that lean only while it is unchanged, fail closed;
     7. fix-posting through runHand: retries only a network that failed,
        finishes only a slot still processing, and never sends a slot (review
        of 6 October 2026: what send is refused in plain words, nothing is
        claimed or uploaded, the owner's Post now still sends one once, and
        after an outage the hourly run sends one owed slot a run); one retry
        of one network at a time (the hourly healer and the lever the same
        minute ask Facebook once, and the second is told why); refuses
        everything else, never posts twice (the real duplicate guard decides
        underneath), spends its own cap and never the R2 total, and its undo
        is a refusal;
     8. the red lines pass both levers' names, arguments, descriptions and
        ordinary reasons, and still refuse what they are for.

   Run:  node tests/levers.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import {
  S, H, FAULT, NET, onNet, resp, resetStore, SOUL, HANDS, LINEUP, DEPS, APPROVED, fakeRes, addDays, setDay, today
} from './_soul-harness.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_COMMIT = 'e218091f88652e6be3ef2b7eb7154c0eaaa3cf15';

const SC = await import('../api/_schedule.js');
const LV = await import('../api/_levers.js');
const EXP = await import('../api/_experiments.js');
const SOC = await import('../api/social.js');
const INS = await import('../api/_insights.js');
const REELS = await import('../api/_reels.js');
const LINEUP_DOOR = await import('../api/lineup.js');

const HALVES = ['morning', 'noon', 'afternoon', 'evening', 'late', 'night'];
const REEL = ['reelA', 'reelC', 'reelD', 'reelB', 'reelF', 'reelE'];
const slotOfHalf = h => REEL[HALVES.indexOf(h)];
const dateOf = d => new Date(Date.UTC(2026, 8, 1) + d * 86400000).toISOString().slice(0, 10);
const dowOf = d => new Date(d + 'T12:00:00Z').getUTCDay();
const nextDow = (from, dow) => { let d = from; for (let i = 0; i < 7 && dowOf(d) !== dow; i++) d = addDays(d, 1); return d; };
const sha = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 32);

/* ===========================================================================
   THE SHELVES
=========================================================================== */
/* the fixed synthetic shelf the parity fingerprint was computed on: every
   kind the rota walks, the day's cards on their two halves, a verse shelf
   with both arms of the verse-length test, and six This day cards. NOT to
   be edited: the constants in part 1 were computed from exactly this. */
function synthShelf() {
  const cards = [];
  const add = (kind, n, f) => { for (let i = 0; i < n; i++) cards.push({ id: kind + '-' + i, kind, hook: kind + ' ' + i, caption: kind + ' ' + i, ...f(i) }); };
  add('verse', 120, i => ({ slot: i % 2 ? 'evening' : 'morning', secs: [12, 35, 25][i % 3], reciter: i % 4 < 2 ? 'Alafasy' : 'Husary' }));
  add('word', 90, i => ({ slot: i % 2 ? 'evening' : 'morning' }));
  add('know', 60, i => ({ slot: i % 2 ? 'evening' : 'morning' }));
  add('name', 45, i => ({ slot: i % 2 ? 'evening' : 'morning' }));
  add('light', 36, i => ({ slot: i % 2 ? 'evening' : 'morning' }));
  add('dua', 18, i => ({ slot: i % 2 ? 'evening' : 'morning' }));
  add('short', 40, () => ({}));
  add('day', 6, i => ({ slot: 'morning', hm: 1 + i, hd: 10 }));
  return cards;
}
const SYNTH = synthShelf();
/* the shelf the lean tests use: the same, with enough day's cards of each
   half (35) that a lean toward light can pass the 30 card floor */
const LEANSHELF = SYNTH.concat(Array.from({ length: 34 }, (_, i) => ({ id: 'light-x-' + i, kind: 'light', slot: i % 2 ? 'evening' : 'morning', hook: 'light x ' + i, caption: 'light x ' + i })));
const REAL = JSON.parse(fs.readFileSync(path.join(ROOT, 'reels/index.json'), 'utf8')).cards;

const ARM_A = { id: 'verse-length', arm: 'A', kind: 'verse', match: c => typeof c.secs === 'number' && c.secs < 20 };
const ARM_B = { id: 'verse-length', arm: 'B', kind: 'verse', match: c => typeof c.secs === 'number' && c.secs > 30 };

/* the reel shelf, served where api/_reels.js and slotExtras fetch it */
let SHELF_NOW = SYNTH;
const setShelf = cards => { SHELF_NOW = cards; REELS.forgetManifest(); };
onNet('https://noorcodex.com/reels/index.json', async () => resp(200, { n: SHELF_NOW.length, written: '2026-09-15', cards: SHELF_NOW }));
/* Facebook, the only network configured in this file: a reel goes up in
   three phases and is then asked how it is; FB.calls counts every upload
   so a second post of anything shows */
process.env.FB_PAGE_ID = '123'; process.env.FB_PAGE_TOKEN = 'tok';
for (const k of ['IG_USER_ID', 'IG_TOKEN', 'IG_ACCESS_TOKEN', 'TH_TOKEN', 'PIN_TOKEN', 'PIN_BOARD_ID', 'PIN_BOARD_NAME', 'LI_TOKEN', 'X_API_KEY']) delete process.env[k];
const FB = { status: 'ready', calls: [], n: 0, delay: 0 };
onNet('https://graph.facebook.com/', async (u, init) => {
  if (u.includes('?fields=access_token')) return resp(200, { access_token: 'page' });
  if (u.includes('/video_reels')) {
    const body = JSON.parse(init.body);
    /* FB.delay: an upload that takes a while to start, so two callers can meet on it */
    if (body.upload_phase === 'start') { FB.n++; FB.calls.push('start'); if (FB.delay) await new Promise(r => setTimeout(r, FB.delay)); return resp(200, { video_id: 'VID' + FB.n, upload_url: 'https://rupload.test/x' }); }
    FB.calls.push('finish'); return resp(200, { post_id: 'P' + FB.n });
  }
  if (/\/VID\d+\?fields=status/.test(u)) return resp(200, { status: { video_status: FB.status }, permalink_url: '/reel/' + FB.n, published: FB.status === 'ready' });
  return resp(404, { error: { message: 'not stubbed: ' + u } });
});
onNet('https://rupload.test/', async () => { FB.calls.push('upload'); return resp(200, { success: true }); });
const fbStarts = () => FB.calls.filter(c => c === 'start').length;
const setDials = d => S.set('nb:settings', JSON.stringify({ 'social.mode': 'auto', 'social.stories': false, ...d }));
const putLeans = list => S.set(LV.K_LEANS, JSON.stringify(list));
const slotRec = (d, s) => { const v = S.get('nsoc:slot:' + d + '#' + s); return v ? JSON.parse(v) : null; };
const putSlot = (d, s, rec) => S.set('nsoc:slot:' + d + '#' + s, JSON.stringify(rec));
const expRunning = start => S.set('nexp:state', JSON.stringify({ current: { id: 'verse-length', start, args: {} }, history: [] }));
/* the console's own signed cookie, minted fresh for each request: the
   400 day walks below outlast the harness's own hundred second cookie */
const AUTHH = () => {
  const exp = Date.now() + 3600000;
  return { cookie: 'noor_admin=' + exp + '.' + crypto.createHmac('sha256', process.env.ADMIN_SECRET).update(String(exp)).digest('hex'), host: 'noorcodex.com' };
};
const IDX = { words: [], path: [] };

/* the Lantern's own line-up tool, the real code: api/lantern-agent.js keeps
   it inside buildTools, so its text is lifted out and run against the real
   modules it names, the way tests/home2.mjs lifts the page's own walk */
const LA_SRC = fs.readFileSync(path.join(ROOT, 'api/lantern-agent.js'), 'utf8');
const toolStart = LA_SRC.indexOf('tools.lineup = async (args) => {');
const toolEnd = LA_SRC.indexOf('\n  };\n', toolStart) + 5;
const lineupTool = new Function('PAGE', 'expReadState', 'expBiasFromAny', 'EXPERIMENTS', 'buildDayContext', 'HOST', 'recentlyPosted', 'SLOTS', 'readSlot', 'chooseReelWithOverride',
  'const tools = {};\n' + LA_SRC.slice(toolStart, toolEnd) + '\nreturn tools.lineup;')(
  { manifest: async () => SHELF_NOW }, EXP.readState, EXP.biasFromAny, EXP.EXPERIMENTS, LINEUP.buildDayContext,
  () => 'https://noorcodex.com', SOC.recentlyPosted, SC.SLOTS, SOC.readSlot, LINEUP.chooseReelWithOverride);
SOUL.setSeams({ deps: { ...DEPS, manifest: async () => SHELF_NOW } });

/* every view of one day, as each one shows each reel slot: {slot: {id, lean}} */
async function views(date) {
  const out = {};
  const put = (name, slot, id, lean) => { (out[name] = out[name] || {})[slot] = { id: id || null, lean: lean ? lean.kind : null }; };
  const due = await SOC.runDue('noorcodex.com', date, new Date(date + 'T23:30:00Z'), { force: true, dry: true, index: IDX });
  for (const r of due.ran) if (REEL.includes(r.slot)) put('runDue', r.slot, r.post ? r.post.key : null, r.post && r.post.lean);
  const td = fakeRes();
  await SOC.default({ method: 'GET', query: { action: 'today', date }, headers: AUTHH() }, td);
  for (const row of (td.body && td.body.slots) || []) if (REEL.includes(row.id)) put('today', row.id, row.reel && row.reel.id, row.appliedLean);
  const tool = await lineupTool({ fromDate: date, days: 1 });
  for (const row of tool.data) put('tool', row.slot, row.card && row.card.id, row.lean);
  for (const row of await HANDS.lineupPreview(date, 1)) put('preview', row.slot, row.card && row.card.id, row.lean);
  const lg = fakeRes();
  await LINEUP_DOOR.default({ method: 'GET', query: { date }, headers: AUTHH() }, lg);
  for (const row of (lg.body && lg.body.slots) || []) put('door', row.slot, row.card && row.card.id, null);
  return out;
}

/* ===========================================================================
   PART 1 · PARITY WITH THE CODE AS IT STOOD (e218091)
=========================================================================== */
console.log('\n--- 1. parity: no lean set, exactly the picks of the code before leans ---');
/* the fingerprint generator: NOT to be edited, the constants below were
   computed from exactly this with the original api/_schedule.js and
   api/_lineup.js (e218091), and the same function now runs the new code */
function makeKv() {
  const strings = new Map();
  const run = async cmds => cmds.map(c => { const [op, ...a] = c;
    if (op === 'GET') return strings.has(a[0]) ? strings.get(a[0]) : null;
    if (op === 'SET') { strings.set(a[0], a[1]); return 'OK'; }
    if (op === 'HGETALL') return [];
    return null; });
  return { strings, kv: run, kvReady: () => true };
}
async function goldenPicks(SCm, LNm, cards, days = 400) {
  const parts = { choose: [], override: [], others: [] };
  for (let d = 0; d < days; d++) {
    const date = dateOf(d);
    const hijri = { m: 1 + (d % 12), d: (d % 30) + 1 };
    const seens = [null, new Map(cards.filter((c, i) => (i + d) % 4 === 0).map((c, i) => [c.id, dateOf(Math.max(0, d - (i % 50)))])),
      new Set(cards.filter((c, i) => (i * 7 + d) % 9 === 0).map(c => c.id))];
    for (const h of HALVES) for (const seen of seens) for (const bias of [null, ARM_A, ARM_B]) for (const hj of [null, hijri]) {
      const rep = {};
      const c = SCm.chooseReel(cards, date, h, hj, seen, bias, rep);
      parts.choose.push((c ? c.id : '-') + (rep.usedArm ? '*' : ''));
    }
  }
  const store = makeKv();
  for (let d = 0; d < days; d++) {
    const date = dateOf(d), day = {};
    const at = date + 'T01:00:00.000Z';
    if (d % 7 === 0) day.reelB = { action: 'skip', at, by: 'owner', note: '' };
    if (d % 7 === 1) day.reelD = { action: 'swap', id: 'verse-' + (d % 120), at, by: 'soul', note: 'n' };
    if (d % 7 === 2) day.reelA = { action: 'swap', id: 'gone-from-shelf', at, by: 'owner', note: '' };
    if (d % 7 === 3) day.reelF = { action: 'swap', id: 'word-' + (d % 90), at, by: 'lantern-approved', note: '' };
    if (d % 7 === 4) day.reelE = { action: 'swap', id: 'light-1', at, by: 'owner', note: '' };
    if (Object.keys(day).length) store.strings.set('nsoc:override:' + date, JSON.stringify(day));
  }
  const ctxBase = { kv: store.kv, kvReady: store.kvReady };
  for (let d = 0; d < days; d++) {
    const date = dateOf(d);
    const seen = new Map(cards.filter((c, i) => (i + d) % 6 === 0).map(c => [c.id, date]));
    const records = d % 5 === 0 ? { reelC: { state: 'sent', reel: 'word-' + (d % 90), kind: 'word' }, reelF: null } : {};
    for (const bias of [null, ARM_A]) {
      for (let i = 0; i < REEL.length; i++) {
        const slot = REEL[i];
        const rec = records[slot] || undefined;
        const otherPicks = await LNm.otherPicksFor(cards, date, slot, null, seen, bias, { ...ctxBase, records });
        const r = await LNm.chooseReelWithOverride(cards, date, slot, null, seen, bias, null, { ...ctxBase, otherPicks, rec });
        parts.override.push((r.card ? r.card.id : '-') + '|' + JSON.stringify(r.override));
        parts.others.push(JSON.stringify(otherPicks));
      }
    }
  }
  return { choose: sha(parts.choose.join(',')), override: sha(parts.override.join(',')), others: sha(parts.others.join(',')), n: [parts.choose.length, parts.override.length, parts.others.length] };
}
/* computed on 3 October 2026 by running goldenPicks above against
   api/_schedule.js and api/_lineup.js exactly as they stood at e218091 */
const GOLDEN = { choose: '91a6a19bfb795a10b6b39a07950912f7', override: '1cc85f301b8fd7c680fc3f516700f5ef', others: 'af5075caa3152d407c4c8f4b9ec3c1ac' };
{
  const g = await goldenPicks(SC, LINEUP, SYNTH);
  ok(g.n.join() === '43200,4800,4800', '52,800 picks fingerprinted over 400 days and every half: ' + g.n.join(' + '));
  ok(g.choose === GOLDEN.choose, 'chooseReel with no lean: the same 43,200 picks as the code before leans (' + g.choose + ')');
  ok(g.override === GOLDEN.override, 'chooseReelWithOverride with no lean: the same 4,800 answers, overrides and all (' + g.override + ')');
  ok(g.others === GOLDEN.others, 'otherPicksFor with no lean: the same 4,800 maps (' + g.others + ')');
}

/* the original modules themselves, when they can be had: a copy saved
   before the change, or git; their relative imports are pointed at this
   tree's own unchanged neighbours, and at each other */
async function loadOriginal() {
  let sched = null, line = null, from = '';
  const local = process.env.LEVERS_PARITY_DIR || '/tmp/levers-parity';
  try {
    sched = fs.readFileSync(path.join(local, '_schedule.js'), 'utf8');
    line = fs.readFileSync(path.join(local, '_lineup.js'), 'utf8');
    from = local;
    if (/LEAN_KINDS|leanFor/.test(sched + line)) sched = line = null;     /* not the original */
  } catch { sched = line = null; }
  if (!sched) {
    try {
      const git = f => execFileSync('git', ['show', BASE_COMMIT + ':' + f], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      sched = git('api/_schedule.js'); line = git('api/_lineup.js'); from = 'git ' + BASE_COMMIT.slice(0, 7);
    } catch { return null; }
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'levers-orig-'));
  const here = f => pathToFileURL(path.join(ROOT, 'api', f)).href;
  const sPath = path.join(dir, '_schedule.orig.mjs'), lPath = path.join(dir, '_lineup.orig.mjs');
  fs.writeFileSync(sPath, sched.replace(/from "\.\/([^"]+)"/g, (m, f) => 'from "' + here(f) + '"'));
  fs.writeFileSync(lPath, line.replace(/from "\.\/([^"]+)"/g, (m, f) => 'from "' + (f === '_schedule.js' ? pathToFileURL(sPath).href : here(f)) + '"'));
  const mods = { SC: await import(pathToFileURL(sPath).href), LN: await import(pathToFileURL(lPath).href), from };
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { }
  return mods;
}
const ORIG = await loadOriginal();
if (!ORIG) console.log('  NOTE the original modules could not be had (no /tmp/levers-parity copy, no git history): the side by side below is skipped, the fingerprint above still holds');
else {
  console.log('  (the original modules, from ' + ORIG.from + ')');
  const g = await goldenPicks(ORIG.SC, ORIG.LN, SYNTH);
  ok(g.choose === GOLDEN.choose && g.override === GOLDEN.override && g.others === GOLDEN.others, 'the fingerprint constants are what the original code itself computes: ' + JSON.stringify(g));
  const gr = await goldenPicks(SC, LINEUP, REAL, 400);
  const go = await goldenPicks(ORIG.SC, ORIG.LN, REAL, 400);
  ok(gr.choose === go.choose && gr.override === go.override && gr.others === go.others, 'and on the real shelf (' + REAL.length + ' cards) the new code and the original agree on all 52,800 picks: ' + gr.choose);
  /* an explicit empty map and an explicit null are both "no lean" */
  let same = 0, n = 0;
  for (let d = 0; d < 400; d++) for (const h of HALVES) for (const leans of [undefined, null, {}]) {
    const a = ORIG.SC.chooseReel(REAL, dateOf(d), h, null, new Map(), null);
    const b = SC.chooseReel(REAL, dateOf(d), h, null, new Map(), null, {}, leans);
    n++; if (a && b && a.id === b.id) same++;
  }
  ok(same === n, 'an absent, a null and an empty lean map all pick what the original picks: ' + same + '/' + n);
}
const REF = ORIG ? ORIG.SC : SC;

console.log('\nevery view of a day, no lean, 400 days: what the original picker picks');
{
  resetStore(); setShelf(SYNTH); setDials({});
  expRunning('2026-10-20');          /* the verse-length test runs inside the window, so the bias is exercised too */
  const state = await EXP.readState({});
  let checked = 0, bad = [];
  const t0 = Date.now();
  for (let d = 0; d < 400; d++) {
    const date = dateOf(d);
    const bias = EXP.biasFromAny(state, date, EXP.EXPERIMENTS);
    const v = await views(date);
    for (const h of HALVES) {
      const slot = slotOfHalf(h);
      const want = REF.chooseReel(SYNTH, date, h, null, new Map(), bias);
      for (const name of ['runDue', 'today', 'tool', 'preview', 'door']) {
        checked++;
        const got = v[name] && v[name][slot];
        if (!got || got.id !== (want && want.id) || got.lean) bad.push(name + ' ' + date + ' ' + slot + ' ' + JSON.stringify(got) + ' vs ' + (want && want.id));
      }
      /* the insights reconstruction: a record whose hook no longer matches
         any card is rebuilt by re-running the picker for its own day */
      const rec = { date, slot, title: 'a hook the shelf no longer has', results: { instagram: { ok: true, id: 'm' } } };
      const c = INS.matchedCard(rec, { cards: SYNTH }, bias, LV.leansOnRecord([], rec));
      checked++;
      if (!c || c.id !== (want && want.id)) bad.push('insights ' + date + ' ' + slot);
    }
  }
  ok(checked === 400 * 6 * 6 && !bad.length, 'runDue dry run, today, the line-up tool, lineupPreview, the line-up door and the insights reconstruction, ' + checked + ' picks in ' + Math.round((Date.now() - t0) / 1000) + ' s, all the original\'s' + (bad.length ? ': ' + bad.slice(0, 3).join(' | ') : ''));
  const plan = fakeRes();
  await SOC.default({ method: 'GET', query: { action: 'plan', date: dateOf(3) }, headers: AUTHH() }, plan);
  ok(plan.body.ok && plan.body.slots.every(r => !('lean' in r) && !('appliedLean' in r)), 'the plan carries no lean field at all when no lean is set, so its shape is unchanged');
}

/* ===========================================================================
   PART 2 · THE LEAN STORE, READ FAIL OPEN
=========================================================================== */
console.log('\n--- 2. the lean store: read fail open ---');
{
  const L1 = { id: 'lean-a', slot: 'reelD', kind: 'verse', from: '2026-10-05', to: '2026-10-07', by: 'soul', at: 'x', note: '' };
  ok(JSON.stringify(LV.leansOn([L1], '2026-10-04')) === '{}' && LV.leansOn([L1], '2026-10-05').reelD.kind === 'verse'
    && LV.leansOn([L1], '2026-10-07').reelD.id === 'lean-a' && JSON.stringify(LV.leansOn([L1], '2026-10-08')) === '{}',
    'a lean covers exactly from..to, both days included, and ends on its own date');
  const bad = [{ ...L1, id: '' }, { ...L1, slot: 'dawn' }, { ...L1, kind: 'day' }, { ...L1, from: '2026-02-31' }, { ...L1, to: '2026-10-04' },
    { ...L1, to: '2026-10-12' }, 'text', null, [1]];
  ok(LV.sanitizeLeans(bad).length === 0, 'an entry with no id, a card slot, the day kind, an impossible date, an end before its start, more than 7 days, or no shape at all is dropped');
  const three = [L1, { ...L1, id: 'b', slot: 'reelA', kind: 'word' }, { ...L1, id: 'c', slot: 'reelC', kind: 'name' }];
  ok(JSON.stringify(LV.leansOn(three, '2026-10-06')) === '{}', 'three leans on one date (more than the rules allow) read as no lean that day');
  const twoOnSlot = [L1, { ...L1, id: 'b', kind: 'word' }, { ...L1, id: 'c', slot: 'reelA', kind: 'name', from: '2026-10-20', to: '2026-10-20' }];
  ok(JSON.stringify(LV.leansOn(twoOnSlot, '2026-10-06')) === '{}', 'two leans on one slot read as no lean on that slot');

  resetStore();
  ok(JSON.stringify(await LV.leanFor('2026-10-06')) === '{}', 'nothing stored: an empty map');
  putLeans([L1]);
  ok((await LV.leanFor('2026-10-06')).reelD.kind === 'verse', 'stored: the day\'s map');
  S.set(LV.K_LEANS, '{not json');
  ok(JSON.stringify(await LV.leanFor('2026-10-06')) === '{}', 'a value that will not parse: no lean');
  S.set(LV.K_LEANS, JSON.stringify({ leans: 'nope' }));
  ok(JSON.stringify(await LV.leanFor('2026-10-06')) === '{}', 'a value of the wrong shape: no lean');
  putLeans([L1]);
  FAULT.key = /^nsoc:rota:leans/;
  ok(JSON.stringify(await LV.leanFor('2026-10-06')) === '{}', 'a store fault: no lean, never a throw');
  const dc = await LINEUP.buildDayContext('noorcodex.com', '2026-10-06', { cards: SYNTH, hijri: null, bias: null, seen: new Map() });
  ok(dc && JSON.stringify(dc.leans) === '{}', 'and the day context every view builds carries an empty map through the same fault');
  FAULT.key = null;
  const dc2 = await LINEUP.buildDayContext('noorcodex.com', '2026-10-06', { cards: SYNTH, hijri: null, bias: null, seen: new Map() });
  ok(dc2.leans.reelD && dc2.leans.reelD.id === 'lean-a', 'with the store back, the day context carries the lean');
  ok(JSON.stringify(await LV.leanFor('not a date')) === '{}', 'a date that is not a date: no lean');
}

/* ===========================================================================
   PART 3 · EVERY RULE A LEAN IS SET UNDER (checkLean, pure)
=========================================================================== */
console.log('\n--- 3. the rules, one at a time ---');
{
  const TUE = nextDow('2026-10-04', 2);            /* a Tuesday: morning know, noon verse, afternoon short, evening know, late verse, night verse */
  const base = { today: TUE, list: [], cards: LEANSHELF, seen: new Map() };
  const chk = (args, extra) => LV.checkLean(args, { ...base, ...(extra || {}) });
  const good = chk({ slot: 'reelB', kind: 'word', days: 3, from: TUE });
  ok(good.ok && good.lean.from === TUE && good.lean.to === addDays(TUE, 2), 'a plain lean is allowed: reelB toward word for three days from today');
  ok(chk({ slot: 'reelB', kind: 'word', days: 2 }).ok && chk({ slot: 'reelB', kind: 'word', days: 2 }).lean.from === TUE, 'no from: it starts today');
  let r = chk({ slot: 'dawn', kind: 'word', days: 1 });
  ok(!r.ok && /one reel slot/.test(r.error), 'a slot that is not a reel is refused: ' + r.error);
  r = chk({ slot: 'reelB', kind: 'day', days: 1 });
  ok(!r.ok && /names one kind/.test(r.error), 'the This day kind is refused: ' + r.error);
  r = chk({ slot: 'reelB', kind: 'codex', days: 1 });
  ok(!r.ok && /names one kind/.test(r.error), 'a kind the shelf does not walk is refused: ' + r.error);
  for (const days of [0, 8, 2.5, 'x', undefined]) {
    r = chk({ slot: 'reelB', kind: 'word', days });
    ok(!r.ok && /1 to 7 days/.test(r.error), 'days ' + JSON.stringify(days) + ' is refused: ' + r.error);
  }
  ok(chk({ slot: 'reelB', kind: 'word', days: 7 }).ok && chk({ slot: 'reelB', kind: 'word', days: '1' }).ok, 'seven days, and a count given as text, are allowed');
  r = chk({ slot: 'reelB', kind: 'word', days: 1, from: addDays(TUE, 2) });
  ok(!r.ok && /today or tomorrow/.test(r.error), 'a start the day after tomorrow is refused: ' + r.error);
  r = chk({ slot: 'reelB', kind: 'word', days: 1, from: addDays(TUE, -1) });
  ok(!r.ok && /today or tomorrow/.test(r.error), 'a start yesterday is refused: ' + r.error);
  ok(chk({ slot: 'reelB', kind: 'name', days: 1, from: addDays(TUE, 1) }).ok, 'a start tomorrow is allowed');
  r = chk({ slot: 'reelB', kind: 'word', days: 1, from: '2026-13-01' });
  ok(!r.ok && /real date/.test(r.error), 'a start that is not a real date is refused: ' + r.error);

  const lean = (id, slot, kind, from, to) => ({ id, slot, kind, from, to, by: 'soul', at: 'x', note: '' });
  r = chk({ slot: 'reelB', kind: 'word', days: 2, from: addDays(TUE, 1) }, { list: [lean('l1', 'reelB', 'name', addDays(TUE, -3), TUE)] });
  ok(r.ok, 'a lean on the same slot that has ended before this one starts is no overlap');
  r = chk({ slot: 'reelB', kind: 'word', days: 2 }, { list: [lean('l1', 'reelB', 'name', addDays(TUE, -3), TUE)] });
  ok(!r.ok && /one lean at a time/.test(r.error), 'two leans on the same slot that share a day are refused: ' + r.error);
  r = chk({ slot: 'reelB', kind: 'word', days: 3 }, { list: [lean('l1', 'reelA', 'word', addDays(TUE, 2), addDays(TUE, 4)), lean('l2', 'reelC', 'name', addDays(TUE, 1), addDays(TUE, 3))] });
  ok(!r.ok && /at most 2 at once/.test(r.error) && r.error.includes(addDays(TUE, 2)), 'a third lean active on any one date is refused, naming the date: ' + r.error);
  r = chk({ slot: 'reelB', kind: 'word', days: 2 }, { list: [lean('l1', 'reelA', 'word', addDays(TUE, 2), addDays(TUE, 4)), lean('l2', 'reelC', 'name', addDays(TUE, 1), addDays(TUE, 3))] });
  ok(r.ok, 'the same third lean, over days no more than one other lean covers, is allowed');


  /* Tuesday carries three verses; one verse lean makes four, a second five */
  r = chk({ slot: 'reelA', kind: 'verse', days: 1 });
  ok(r.ok, 'a fourth verse on a Tuesday is allowed (4 of 6)');
  r = chk({ slot: 'reelB', kind: 'verse', days: 1 }, { list: [lean('l1', 'reelA', 'verse', TUE, TUE)] });
  ok(!r.ok && /5 of the six reel slots verse/.test(r.error), 'a fifth is refused, counted with the real rota for that date: ' + r.error);
  r = chk({ slot: 'reelB', kind: 'verse', days: 2, from: addDays(TUE, 1) }, { list: [lean('l1', 'reelA', 'verse', TUE, TUE)] });
  ok(r.ok, 'the same lean on the next two days, where the rota has fewer verses and the other lean has ended, is allowed');
  /* the rota as it really stands that day: on a shelf with no film the
     afternoon is its stand in row, and on a Thursday that is a verse */
  const noShort = LEANSHELF.filter(c => c.kind !== 'short');
  const THU = addDays(TUE, 2);
  const thu = SC.REEL_SLOTS.map(s => SC.rotaKindFor(SC.reelHalf(s), THU, true));
  ok(thu.join() === 'name,know,verse,verse,verse,dua', 'with no film on the shelf a Thursday reads name, know, verse, verse, verse, du\'a: ' + thu.join());
  const withC = [lean('l1', 'reelC', 'verse', THU, THU)];
  ok(chk({ slot: 'reelA', kind: 'verse', days: 1 }, { today: THU, list: withC }).ok, 'with films on the shelf a Thursday plus two verse leans is four verses: allowed');
  r = chk({ slot: 'reelA', kind: 'verse', days: 1 }, { today: THU, list: withC, cards: noShort });
  ok(!r.ok && /5 of the six/.test(r.error), 'with none, the same two leans make five, counted with the stand in row, and the second is refused: ' + r.error);

  r = chk({ slot: 'reelB', kind: 'dua', days: 1 });
  ok(!r.ok && /only 18 dua cards/.test(r.error), 'a kind with fewer than 30 cards is refused: ' + r.error);
  const seenNames = new Map(LEANSHELF.filter(c => c.kind === 'name').slice(0, 16).map(c => [c.id, TUE]));
  r = chk({ slot: 'reelB', kind: 'name', days: 1 }, { seen: seenNames });
  ok(!r.ok && /only 29 name cards/.test(r.error) && /duplicate window/.test(r.error), 'cards inside the duplicate window do not count: 45 names, 16 just sent: ' + r.error);
  ok(chk({ slot: 'reelB', kind: 'name', days: 1 }, { seen: new Map([...seenNames].slice(0, 15)) }).ok, 'and 30 fresh is enough');
  r = chk({ slot: 'reelC', kind: 'light', days: 1 });
  ok(!r.ok && /only 0 light cards that fit reelC/.test(r.error), 'a day\'s card filed under the morning and evening does not fit the noon slot: ' + r.error);
  ok(chk({ slot: 'reelA', kind: 'light', days: 1 }).ok, 'and does fit the morning one (35 cards)');

  r = chk({ slot: 'reelF', kind: 'verse', days: 7 });
  ok(!r.ok && /would change nothing/.test(r.error), 'a lean toward what the rota already gives on every one of its days is refused: ' + r.error);
  ok(chk({ slot: 'reelC', kind: 'verse', days: 2 }).ok, 'one that changes at least one of its days is not');
}

/* ===========================================================================
   PART 4 · THE PICKER UNDER A LEAN
=========================================================================== */
console.log('\n--- 4. the picker under a lean ---');
{
  /* 5 to 7 October 2026 are a Monday, a Tuesday and a Wednesday: the
     afternoon is a word, a short and a verse, never a Name */
  const L = { id: 'lean-t', slot: 'reelD', kind: 'name', from: '2026-10-05', to: '2026-10-07' };
  let covered = 0, outside = 0, untouched = 0, n = 0;
  for (let d = 0; d < 14; d++) {
    const date = addDays('2026-10-01', d);
    const leans = LV.leansOn([L], date);
    for (const h of HALVES) {
      const rep = {};
      const c = SC.chooseReel(LEANSHELF, date, h, null, new Map(), null, rep, leans);
      const plain = SC.chooseReel(LEANSHELF, date, h, null, new Map(), null);
      n++;
      if (h === 'afternoon' && date >= L.from && date <= L.to) {
        if (c.kind === 'name' && rep.lean && rep.lean.id === 'lean-t' && rep.lean.kind === 'name') covered++;
      } else if (c.id === plain.id && !rep.lean) { if (h === 'afternoon') outside++; else untouched++; }
    }
  }
  ok(covered === 3, 'on each of the three covered days the afternoon is a Name, and the pick says the lean decided it: ' + covered);
  const noop = SC.chooseReel(LEANSHELF, '2026-10-05', 'afternoon', null, new Map(), null, {}, { reelD: { id: 'x', kind: 'word' } });
  const rep0 = {};
  SC.chooseReel(LEANSHELF, '2026-10-05', 'afternoon', null, new Map(), null, rep0, { reelD: { id: 'x', kind: 'word' } });
  ok(noop.id === SC.chooseReel(LEANSHELF, '2026-10-05', 'afternoon', null, new Map(), null).id && !rep0.lean,
    'a lean toward the kind the rota already gives that day changes nothing and claims nothing (a Monday afternoon is a word)');
  ok(outside === 11 && untouched === 70, 'outside them the afternoon is the rota\'s own pick, and the other five slots never move: ' + outside + ' + ' + untouched);

  /* the arm of a running test still applies inside the lean's own kind */
  const LV2 = { reelB: { id: 'lean-v', kind: 'verse' } };
  const MON = nextDow('2026-10-04', 1);          /* evening on a Monday is a day's card */
  let armed = 0, tries = 0;
  for (let w = 0; w < 6; w++) {
    const date = addDays(MON, 7 * w);
    for (const bias of [ARM_A, ARM_B]) {
      const rep = {};
      const c = SC.chooseReel(LEANSHELF, date, 'evening', null, new Map(), bias, rep, LV2);
      tries++;
      if (c.kind === 'verse' && bias.match(c) && rep.usedArm && rep.lean && rep.lean.kind === 'verse') armed++;
    }
  }
  ok(armed === tries, 'a verse lean on a test day walks the arm\'s own pool, and says both: ' + armed + '/' + tries);

  /* a lean never lands on what another slot of the same day shows */
  let leaned = 0, clash = 0;
  for (let d = 0; d < 120; d++) {
    const date = addDays('2026-10-01', d);
    const seen = new Map(LEANSHELF.filter((c, i) => (i + d) % 5 === 0).map(c => [c.id, date]));
    for (const h of HALVES) for (const kind of SC.LEAN_KINDS) {
      const leans = { [slotOfHalf(h)]: { id: 'x', kind } };
      const rep = {};
      const c = SC.chooseReel(LEANSHELF, date, h, null, seen, null, rep, leans);
      if (!rep.lean) continue;
      leaned++;
      const others = HALVES.filter(x => x !== h).map(x => SC.chooseReel(LEANSHELF, date, x, null, seen, null).id);
      if (others.includes(c.id) || seen.has(c.id)) clash++;
    }
  }
  ok(leaned > 3000 && clash === 0, 'over 120 days, every half and every kind, a leaned pick is never another slot\'s card that day and never one the window holds: ' + leaned + ' leans, ' + clash + ' clashes');
  let pairs = 0, pairClash = 0;
  for (let d = 0; d < 60; d++) {
    const date = addDays('2026-10-01', d);
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) for (const kind of ['verse', 'word', 'know', 'name', 'short']) {
      const leans = { [REEL[i]]: { id: 'a', kind }, [REEL[j]]: { id: 'b', kind } };
      const ids = HALVES.map(h => SC.chooseReel(LEANSHELF, date, h, null, new Map(), null, {}, leans).id);
      pairs++; if (new Set(ids).size !== 6) pairClash++;
    }
  }
  ok(pairClash === 0, 'two slots leaned toward the same kind on one day never share a card: ' + pairs + ' days and pairs');
  /* a day's card filed under no half fits both: a morning leaned toward the
     day's card on a Monday (whose evening is the day's card) never meets it */
  const FREE = LEANSHELF.concat(Array.from({ length: 12 }, (_, i) => ({ id: 'light-free-' + i, kind: 'light', hook: 'free ' + i, caption: 'free ' + i })));
  let mondays = 0, lightClash = 0;
  for (let w = 0; w < 40; w++) {
    const mon = addDays(nextDow('2026-10-04', 1), 7 * w);
    const m = SC.chooseReel(FREE, mon, 'morning', null, new Map(), null, {}, { reelA: { id: 'x', kind: 'light' } });
    const e = SC.chooseReel(FREE, mon, 'evening', null, new Map(), null, {}, { reelA: { id: 'x', kind: 'light' } });
    mondays++; if (m.kind !== 'light' || e.kind !== 'light' || m.id === e.id) lightClash++;
  }
  ok(lightClash === 0, 'a day\'s card leaned onto the morning never meets the evening\'s own day\'s card, even one filed under no half: ' + mondays + ' Mondays');
  const a = SC.chooseReel(LEANSHELF, '2026-10-06', 'noon', null, new Map(), null, {}, { reelC: { id: 'x', kind: 'name' } });
  const b = SC.chooseReel(LEANSHELF, '2026-10-06', 'noon', null, new Map(), null, {}, { reelC: { id: 'x', kind: 'name' } });
  ok(a.id === b.id && a.kind === 'name', 'the same lean on the same day always picks the same card');
  /* the lean's pick for a day steps on: seven days of one lean, seven different cards */
  const week = Array.from({ length: 7 }, (_, i) => SC.chooseReel(LEANSHELF, addDays('2026-10-04', i), 'afternoon', null, new Map(), null, {}, { reelD: { id: 'x', kind: 'name' } }).id);
  ok(new Set(week).size === 7, 'seven days of a Name lean on one slot show seven different Names: ' + week.join(' '));
  /* malformed entries in the map itself are no lean */
  for (const m of [{ reelD: { kind: 'word' } }, { reelD: { id: 'x', kind: 'day' } }, { reelD: 'word' }, { afternoon: { id: 'x', kind: 'word' } }, 'reelD', [1]]) {
    const c = SC.chooseReel(LEANSHELF, '2026-10-05', 'afternoon', null, new Map(), null, {}, m);
    ok(c.id === SC.chooseReel(LEANSHELF, '2026-10-05', 'afternoon', null, new Map(), null).id, 'a malformed map ' + JSON.stringify(m) + ' is no lean');
  }
  /* a kind with nothing on the shelf: the rota stands */
  const noWords = LEANSHELF.filter(c => c.kind !== 'word');
  const c1 = SC.chooseReel(noWords, '2026-10-05', 'afternoon', null, new Map(), null, {}, { reelD: { id: 'x', kind: 'word' } });
  ok(c1.id === SC.chooseReel(noWords, '2026-10-05', 'afternoon', null, new Map(), null).id, 'a lean toward a kind the shelf no longer has leaves the rota\'s own pick');
  /* the Hijri day card still takes its own morning */
  const dayDate = '2026-10-05';
  const dayCard = SC.chooseReel(LEANSHELF, dayDate, 'morning', { m: 2, d: 10 }, new Map(), null, {}, { reelA: { id: 'x', kind: 'word' } });
  ok(dayCard.kind === 'day' && dayCard.hm === 2, 'a This day reel still takes the morning of its own date over a lean');

  /* overrides beat the lean on their own slot (api/_lineup.js) */
  resetStore();
  const D = '2026-10-06';
  putLeans([{ id: 'lean-o', slot: 'reelD', kind: 'word', from: D, to: D, by: 'soul', at: 'x', note: '' }]);
  const plain = await LINEUP.chooseReelWithOverride(LEANSHELF, D, 'reelD', null, new Map(), null, null, {});
  ok(plain.card.kind === 'word' && plain.lean && plain.lean.id === 'lean-o', 'no override: the leaned card, and the lean it went out under');
  S.set('nsoc:override:' + D, JSON.stringify({ reelD: { action: 'swap', id: 'know-3', at: 'x', by: 'owner', note: '' } }));
  const sw = await LINEUP.chooseReelWithOverride(LEANSHELF, D, 'reelD', null, new Map(), null, null, {});
  ok(sw.card.id === 'know-3' && sw.override.action === 'swap' && !sw.lean, 'an owner\'s swap on the leaned slot wins, and no lean is claimed');
  S.set('nsoc:override:' + D, JSON.stringify({ reelD: { action: 'skip', at: 'x', by: 'soul', note: '' } }));
  const sk = await LINEUP.chooseReelWithOverride(LEANSHELF, D, 'reelD', null, new Map(), null, null, {});
  ok(sk.card === null && sk.override.action === 'skip' && !sk.lean, 'the Lantern\'s own skip on the leaned slot wins too');
  S.set('nsoc:override:' + D, JSON.stringify({ reelD: { action: 'swap', id: 'know-3', at: 'x', by: 'owner', note: '' } }));
  const fb = await LINEUP.chooseReelWithOverride(LEANSHELF, D, 'reelD', null, new Map([['know-3', D]]), null, null, {});
  ok(fb.override.fellBack && fb.card.kind === 'word' && fb.lean, 'a swap that has fallen back gives the slot back to the schedule, which is the lean');
}

/* ===========================================================================
   PART 5 · WITH A LEAN, EVERY VIEW AGREES, AND THE RECORD SAYS SO
=========================================================================== */
console.log('\n--- 5. with a lean set, every view of the day agrees ---');
{
  resetStore(); setShelf(LEANSHELF); setDials({});
  const D0 = '2026-10-12', from = addDays(D0, 1), to = addDays(D0, 3);
  const LEANS = [{ id: 'lean-v1', slot: 'reelD', kind: 'name', from, to, by: 'soul', at: 'x', note: '' },
    { id: 'lean-v2', slot: 'reelB', kind: 'verse', from: addDays(D0, 2), to: addDays(D0, 4), by: 'soul', at: 'x', note: '' }];
  putLeans(LEANS);
  expRunning(D0);
  const state = await EXP.readState({});
  let agree = 0, total = 0, kindsOk = 0, kindsN = 0;
  const bad = [];
  for (let i = 0; i < 6; i++) {
    const date = addDays(D0, i);
    const leans = LV.leansOn(LEANS, date);
    const bias = EXP.biasFromAny(state, date, EXP.EXPERIMENTS);
    const v = await views(date);
    for (const h of HALVES) {
      const slot = slotOfHalf(h);
      const rep = {};
      const want = SC.chooseReel(LEANSHELF, date, h, null, new Map(), bias, rep, leans);
      for (const name of ['runDue', 'today', 'tool', 'preview', 'door']) {
        total++;
        const got = v[name] && v[name][slot];
        const leanOk = name === 'door' || (got && got.lean === (rep.lean ? rep.lean.kind : null));
        if (got && got.id === want.id && leanOk) agree++; else bad.push(name + ' ' + date + ' ' + slot + ' ' + JSON.stringify(got) + ' vs ' + want.id);
      }
      const rec = { date, slot, title: 'a hook the shelf no longer has', results: { instagram: { ok: true, id: 'm' } }, ...(rep.lean ? { lean: rep.lean } : {}) };
      const c = INS.matchedCard(rec, { cards: LEANSHELF }, bias, LV.leansOnRecord(LEANS, rec));
      total++; if (c && c.id === want.id) agree++; else bad.push('insights ' + date + ' ' + slot);
      const lean = leans[slot];
      if (lean && SC.rotaKindFor(h, date, false) !== lean.kind) { kindsN++; if (want.kind === lean.kind) kindsOk++; }
      else if (!lean) { kindsN++; if (want.id === SC.chooseReel(LEANSHELF, date, h, null, new Map(), bias).id) kindsOk++; }
    }
  }
  ok(agree === total, 'runDue dry run, today, the line-up tool, lineupPreview, the line-up door and the insights reconstruction pick the same card on every reel slot of six days, leans and all: ' + agree + '/' + total + (bad.length ? ' ' + bad.slice(0, 3).join(' | ') : ''));
  ok(kindsOk === kindsN && kindsN > 30, 'a leaned slot carries the lean\'s kind on its covered dates, and every slot outside a lean is the rota\'s own pick: ' + kindsOk + '/' + kindsN);
  const plan = fakeRes();
  await SOC.default({ method: 'GET', query: { action: 'plan', date: addDays(D0, 2) }, headers: AUTHH() }, plan);
  const pr = s => plan.body.slots.find(r => r.id === s);
  ok(pr('reelD').lean && pr('reelD').lean.id === 'lean-v1' && pr('reelB').lean.id === 'lean-v2' && !pr('reelA').lean, 'the plan shows which slot leans, as it shows an override');
  /* the insights collect itself: a record rebuilt by the picker is counted under the lean's kind */
  const recDate = addDays(D0, 1);
  const leanedRec = { at: recDate + 'T14:00:00Z', slot: 'reelD', state: 'sent', title: 'no longer on the shelf', lean: { id: 'lean-v1', kind: 'name' },
    results: { instagram: { ok: true, id: 'ig-1' } } };
  const posts = await INS.collect(1, { now: recDate + 'T23:00:00Z', manifest: { cards: LEANSHELF }, expState: { current: null, history: [] },
    readSlot: async (d, s) => (d === recDate && s === 'reelD' ? leanedRec : null) });
  ok(posts.length === 1 && posts[0].kind === 'reel:name', 'collect() counts a rebuilt leaned record under the lean\'s own kind: ' + JSON.stringify(posts.map(p => p.kind)));
  const posts2 = await INS.collect(1, { now: recDate + 'T23:00:00Z', manifest: { cards: LEANSHELF }, expState: { current: null, history: [] }, leans: [],
    readSlot: async (d, s) => (d === recDate && s === 'reelD' ? leanedRec : null) });
  ok(posts2[0].kind === 'reel:name', 'and the record\'s own mark still says so after the lean itself was undone');
  /* the daily stats snapshot stores the same kind (review of 6 October 2026):
     the record's own kind first, then its lean mark's, and only then the
     picker re-run with the day's leans; never the rota's kind for a leaned
     reel whose card has left the shelf */
  const rotaD = SC.rotaKindFor('afternoon', recDate, false);
  const igFetch = async () => ({ ok: true, status: 200, json: async () => ({ data: [{ name: 'reach', values: [{ value: 120 }] }] }) });
  const snapOf = async r => {
    S.delete(INS.K_STATS(recDate, 'reelD'));
    await INS.snapshot({ now: recDate + 'T23:00:00Z', days: 1, force: true, manifest: { cards: LEANSHELF },
      readSlot: async (d, s) => (d === recDate && s === 'reelD' ? r : null), igToken: 'tok', fbToken: '', thToken: '', ytToken: '', fetch: igFetch });
    const v = S.get(INS.K_STATS(recDate, 'reelD'));
    return v ? JSON.parse(v) : null;
  };
  const sk1 = await snapOf({ ...leanedRec, reel: 'name-retired', kind: 'name' });
  ok(rotaD !== 'name' && sk1 && sk1.kind === 'reel:name' && sk1.lean && sk1.lean.id === 'lean-v1',
    'snapshot() stores a leaned reel whose card retired under the kind its own record says, with its lean mark, never the rota\'s (' + rotaD + '): ' + JSON.stringify(sk1 && { kind: sk1.kind, lean: sk1.lean }));
  const sk2 = await snapOf(leanedRec);
  ok(sk2 && sk2.kind === 'reel:name', 'a record carrying only its lean mark is stored under the lean\'s kind: ' + (sk2 && sk2.kind));
  ok(INS.reclassifyKind(sk1, { cards: LEANSHELF }) === 'reel:name', 'and the numbers read it back as that kind');
  const sk3 = await snapOf({ ...leanedRec, lean: undefined, title: 'name 3' });
  ok(sk3 && sk3.kind === 'reel:name' && !sk3.lean, 'a record whose title the shelf still names is stored as that card, with no lean claimed');

  /* the store failing: every view falls back to the rota, nothing throws */
  FAULT.key = /^nsoc:rota:leans/;
  const vf = await views(addDays(D0, 2));
  const date2 = addDays(D0, 2);
  const bias2 = EXP.biasFromAny(state, date2, EXP.EXPERIMENTS);
  const plainD = SC.chooseReel(LEANSHELF, date2, 'afternoon', null, new Map(), bias2).id;
  ok(['runDue', 'today', 'tool', 'preview', 'door'].every(n => vf[n] && vf[n].reelD && vf[n].reelD.id === plainD && !vf[n].reelD.lean),
    'with the lean store failing, every view shows the rota\'s own pick and nothing fails: ' + plainD);
  FAULT.key = null;

  /* a real send: the record carries lean {id, kind} exactly when it decided the kind */
  resetStore(); setShelf(LEANSHELF); setDials({}); FB.calls.length = 0;
  putLeans(LEANS);
  const sDay = addDays(D0, 1);
  const r1 = await SOC.sendSlot('noorcodex.com', sDay, 'reelD', { index: IDX });
  const rec1 = slotRec(sDay, 'reelD');
  const want1 = SC.chooseReel(LEANSHELF, sDay, 'afternoon', null, new Map(), null, {}, LV.leansOn(LEANS, sDay));
  ok(r1.ok && rec1.state === 'sent' && rec1.reel === want1.id && rec1.lean && rec1.lean.id === 'lean-v1' && rec1.lean.kind === 'name',
    'sendSlot posts the leaned card and its record says lean {id, kind}: ' + JSON.stringify({ reel: rec1.reel, lean: rec1.lean }));
  ok(Object.keys(rec1.lean).sort().join() === 'id,kind', 'and the mark is {id, kind}, nothing more');
  const r2 = await SOC.sendSlot('noorcodex.com', sDay, 'reelA', { index: IDX });
  ok(r2.ok && !slotRec(sDay, 'reelA').lean, 'a slot with no lean that day carries no mark');
  S.set('nsoc:override:' + addDays(D0, 2), JSON.stringify({ reelD: { action: 'swap', id: 'know-5', at: 'x', by: 'owner', note: '' } }));
  const r3 = await SOC.sendSlot('noorcodex.com', addDays(D0, 2), 'reelD', { index: IDX });
  const rec3 = slotRec(addDays(D0, 2), 'reelD');
  ok(r3.ok && rec3.reel === 'know-5' && rec3.override && !rec3.lean, 'the owner\'s swap on a leaned day goes out, marked as his, with no lean claimed');
  /* a retry keeps the mark: the same reel, the same fact */
  putSlot(sDay, 'reelC', { at: 'x', slot: 'reelC', state: 'failed', title: 'name 1', reel: 'name-1', kind: 'name', lean: { id: 'lean-zz', kind: 'name' },
    results: { facebook: { ok: false, error: 'a bad minute', tries: 1 } } });
  const rt = await SOC.retryChannel('noorcodex.com', sDay, 'reelC', 'facebook', { byHand: true });
  ok(rt.ok && slotRec(sDay, 'reelC').lean && slotRec(sDay, 'reelC').lean.id === 'lean-zz', 'retryChannel rewrites the record and keeps its lean mark');
  /* runDue itself, live */
  resetStore(); setShelf(LEANSHELF); setDials({}); putLeans(LEANS);
  const live = await SOC.runDue('noorcodex.com', from, new Date(from + 'T14:30:00Z'), { index: IDX });
  const recLive = slotRec(from, 'reelD');
  ok(live.ran.some(r => r.slot === 'reelD' && r.state === 'sent') && recLive.lean && recLive.lean.id === 'lean-v1' && recLive.kind === 'name',
    'the hourly run sends the 14:00 leaned reel itself, and its record says so: ' + JSON.stringify({ kind: recLive.kind, lean: recLive.lean }));
}

/* ===========================================================================
   PART 6 · THE rota-lean HAND
=========================================================================== */
console.log('\n--- 6. rota-lean through runHand ---');
{
  const lev = HANDS.HANDS['rota-lean'];
  ok(lev && lev.tier === 'R2' && lev.caps.join() === 'rota' && !lev.ownCapOnly && typeof lev.undo === 'function', 'rota-lean is in the registry: R2, cap rota, and it spends the R2 total too');
  ok(SOUL.CAP_LIMITS.rota === 1 && SOUL.CAP_LIMITS.fix === 6, 'the caps are code: rota 1 a day, fix 6 a day');
  ok(/rota-lean \(R2\) \{slot, kind, days, from\}/.test(HANDS.registryText()), 'the planner reads it with its arguments');

  resetStore(); setShelf(LEANSHELF); setDials({});
  const T = nextDow(addDays(today(), 1), 2); setDay(T, '06:00');        /* a Tuesday, by the soul's own clock */
  const day = today();
  const run = (args, why) => HANDS.runHand({ action: 'rota-lean', args, why: why || 'Name reels held people longest this week.' }, { approval: APPROVED });
  const noCouncil = await HANDS.runHand({ action: 'rota-lean', args: { slot: 'reelB', kind: 'word', days: 2 }, why: 'x' }, {});
  ok(!noCouncil.ok && noCouncil.refused === 'council', 'without the council it never runs');
  const a = await run({ slot: 'reelD', kind: 'name', days: 3 });
  ok(a.ok && a.entry.result.lean && a.entry.result.lean.slot === 'reelD', 'a lean is set: ' + (a.entry && a.entry.result.note));
  const stored = JSON.parse(S.get(LV.K_LEANS));
  ok(stored.length === 1 && stored[0].from === day && stored[0].to === addDays(day, 2) && stored[0].kind === 'name' && stored[0].by === 'soul' && /^lean-/.test(stored[0].id),
    'stored as {id, slot, kind, from, to, by, at, note}: ' + JSON.stringify(stored[0]));
  ok(S.get(LV.K_LEANS_VER) === '1', 'through the compare and set: the version moved to 1');
  ok(a.entry.undo && a.entry.undo.kind === 'rota-lean-remove' && a.entry.undo.lean.id === stored[0].id, 'its undo names exactly that lean');
  ok(S.get('nsoul:count:rota:' + day) === '1' && S.get('nsoul:count:r2:' + day) === '1', 'it spent the rota cap and the R2 total');
  const b = await run({ slot: 'reelB', kind: 'word', days: 1 });
  ok(!b.ok && b.refused === 'cap' && /1 rota lean/.test(b.error), 'a second lean the same day is refused by the cap, in words: ' + b.error);
  ok(S.get('nsoul:count:rota:' + day) === '1' && S.get('nsoul:count:r2:' + day) === '1', 'and the refusal gave its count back');

  /* refusals give the cap back, and are plain */
  resetStore(); setDay(T, '06:00');
  const v = await run({ slot: 'reelB', kind: 'dua', days: 1 });
  ok(!v.ok && /only 18 dua cards/.test(v.error), 'the rules run inside the hand: ' + v.error);
  ok(S.get('nsoul:count:rota:' + day) === '0', 'a refused lean spends nothing');
  const past = await run({ slot: 'reelB', kind: 'word', days: 1, from: addDays(day, -1) });
  ok(!past.ok && /today or tomorrow/.test(past.error), 'yesterday is refused: ' + past.error);

  /* fail closed: the store, the window, the shelf, the day's own overrides */
  FAULT.key = /^nsoc:rota:leans/;
  const f1 = await run({ slot: 'reelB', kind: 'word', days: 1 });
  ok(!f1.ok && /leans could not be read/.test(f1.error), 'the lean store failing refuses: ' + f1.error);
  FAULT.key = null;
  const realDeps = { ...DEPS, manifest: async () => SHELF_NOW };
  SOUL.setSeams({ deps: { ...realDeps, recentlyPostedRaw: async () => { throw new Error('kv down'); } } });
  const f2 = await run({ slot: 'reelB', kind: 'word', days: 1 });
  ok(!f2.ok && /duplicate guard could not be read/.test(f2.error), 'the duplicate window failing refuses, never read as empty: ' + f2.error);
  SOUL.setSeams({ deps: { ...realDeps, manifest: async () => [] } });
  const f3 = await run({ slot: 'reelB', kind: 'word', days: 1 });
  ok(!f3.ok && /shelf could not be read/.test(f3.error), 'no shelf refuses: ' + f3.error);
  SOUL.setSeams({ deps: realDeps });
  FAULT.key = /^nsoc:override:/;
  const f4 = await run({ slot: 'reelB', kind: 'word', days: 1 });
  ok(!f4.ok && /line-up of .* could not be read/.test(f4.error), 'the day\'s own line-up failing refuses: ' + f4.error);
  FAULT.key = null;

  /* an owner's swap set first is never made to fall back by a lean set after it */
  resetStore(); setDay(T, '06:00');
  const cand = { id: 'candidate', slot: 'reelB', kind: 'word', from: day, to: day };
  const wouldBe = SC.chooseReel(SHELF_NOW, day, 'evening', null, new Map(), null, {}, LV.leansOn([cand], day));
  S.set('nsoc:override:' + day, JSON.stringify({ reelC: { action: 'swap', id: wouldBe.id, at: 'x', by: 'owner', note: '' } }));
  const clash = await run({ slot: 'reelB', kind: 'word', days: 1 });
  ok(!clash.ok && clash.error.includes(wouldBe.id) && /set by hand for reelC/.test(clash.error), 'a lean whose pick is the card an owner swapped onto another slot that day is refused: ' + clash.error);
  S.set('nsoc:override:' + day, JSON.stringify({ reelB: { action: 'skip', at: 'x', by: 'owner', note: '' } }));
  ok((await run({ slot: 'reelB', kind: 'word', days: 1 })).ok, 'and a skip on the leaned slot itself is no clash: the skip simply wins that day');

  /* a writer that read an older list writes nothing: another write lands
     while the lever is still checking its rules (here, the moment it reads
     the duplicate window), and the lever's own write is refused */
  resetStore(); setDay(T, '06:00');
  const other = [{ id: 'other-writer', slot: 'reelE', kind: 'word', from: day, to: day, by: 'owner', at: 'y', note: '' }];
  SOUL.setSeams({ deps: { ...realDeps, recentlyPostedRaw: async () => { S.set(LV.K_LEANS, JSON.stringify(other)); S.set(LV.K_LEANS_VER, '41'); return new Map(); } } });
  const cw = await run({ slot: 'reelB', kind: 'word', days: 1 });
  ok(!cw.ok && /changed by something else/.test(cw.error) && JSON.parse(S.get(LV.K_LEANS))[0].id === 'other-writer' && S.get(LV.K_LEANS_VER) === '41',
    'a write that lands while the lever checks its rules wins, and the lever writes nothing: ' + cw.error);
  SOUL.setSeams({ deps: realDeps });
  const cw2 = await run({ slot: 'reelB', kind: 'word', days: 1 });
  ok(cw2.ok && S.get(LV.K_LEANS_VER) === '42' && JSON.parse(S.get(LV.K_LEANS)).length === 2, 'and asked again it writes on the version it read, keeping the other lean');

  /* the undo */
  resetStore(); setDay(T, '06:00');
  const u1 = await run({ slot: 'reelD', kind: 'name', days: 2 });
  const und = await HANDS.undoAction(u1.id, 'owner');
  ok(und.ok && JSON.parse(S.get(LV.K_LEANS)).length === 0, 'undo removes exactly that lean: ' + und.note);
  const again = await HANDS.undoAction(u1.id, 'owner');
  ok(!again.ok && /already undone/.test(again.error), 'and cannot be done twice');
  setDay(addDays(T, 1), '06:00');
  const u2 = await run({ slot: 'reelD', kind: 'name', days: 2 });
  const list2 = JSON.parse(S.get(LV.K_LEANS));
  list2[0].at = 'changed by hand';
  S.set(LV.K_LEANS, JSON.stringify(list2));
  const und2 = await HANDS.undoAction(u2.id, 'owner');
  ok(!und2.ok && /changed since/.test(und2.error) && JSON.parse(S.get(LV.K_LEANS)).length === 1, 'a lean changed since it was set is not undone, in plain words: ' + und2.error);
  S.set(LV.K_LEANS, JSON.stringify([]));
  const und3 = await HANDS.undoAction(u2.id, 'owner');
  ok(und3.ok && /already gone/.test(und3.note), 'a lean already gone: nothing left to do, said so');
  setDay(addDays(T, 2), '06:00');
  const u4 = await run({ slot: 'reelD', kind: 'name', days: 1 });
  setDay(addDays(T, 4), '06:00');
  const und4 = await HANDS.undoAction(u4.id, 'owner');
  ok(und4.ok && /already ended/.test(und4.note) && JSON.parse(S.get(LV.K_LEANS)).length === 1, 'a lean that has ended is kept as the record of its days: ' + und4.note);
  setDay(addDays(T, 5), '06:00');
  const u5 = await run({ slot: 'reelC', kind: 'name', days: 1 });
  FAULT.key = /^nsoc:rota:leans/;
  const und5 = await HANDS.undoAction(u5.id, 'owner');
  ok(!und5.ok && /could not be read/.test(und5.error), 'an undo that cannot read the store refuses');
  FAULT.key = null;

  /* pruning: an ended lean older than the insights window leaves on the next write */
  resetStore(); setDay(T, '06:00');
  putLeans([{ id: 'old', slot: 'reelA', kind: 'word', from: addDays(day, -90), to: addDays(day, -88), by: 'soul', at: 'x', note: '' },
    { id: 'recent', slot: 'reelA', kind: 'word', from: addDays(day, -20), to: addDays(day, -18), by: 'soul', at: 'x', note: '' }]);
  await run({ slot: 'reelD', kind: 'name', days: 1 });
  const ids = JSON.parse(S.get(LV.K_LEANS)).map(l => l.id);
  ok(!ids.includes('old') && ids.includes('recent') && ids.length === 2, 'a write keeps the last ' + LV.LEAN_KEEP_DAYS + ' days of leans for the reconstruction and lets older ones go: ' + ids.join());
}

/* ===========================================================================
   PART 7 · fix-posting
=========================================================================== */
console.log('\n--- 7. fix-posting through runHand ---');
{
  const lev = HANDS.HANDS['fix-posting'];
  ok(lev && lev.tier === 'R2' && lev.caps.join() === 'fix' && lev.ownCapOnly === true, 'fix-posting is in the registry: R2, cap fix, its own cap only');
  ok(lev.args === '{date, slot, what: retry|finish, channel}' && /never sends a slot/.test(lev.describe) && !/what send/.test(lev.describe),
    'its arguments name retry and finish only, and its description tells the planner it never sends a slot');
  resetStore(); setShelf(LEANSHELF); setDials({}); FB.calls.length = 0; FB.status = 'ready';
  setDay(nextDow(addDays(today(), 1), 3), '15:30');
  const day = today();
  const fix = (args, why) => HANDS.runHand({ action: 'fix-posting', args, why: why || 'The record shows the slot failed on Facebook with a bad minute.' }, { approval: APPROVED });
  const recOf = s => slotRec(day, s);
  const unspent = k => [undefined, null, '0'].includes(S.get(k));

  /* send: never (review of 6 October 2026). A slot owed and not yet sent is
     the hourly run's, one a run and the newest first, and the owner's Post
     now; a lever that sent as well raced them both and could empty a backlog
     the catch-up rule paces. Stood-in sendSlot and claimSlot count any ask. */
  let asked = 0;
  SOUL.setSeams({ deps: { ...DEPS, manifest: async () => SHELF_NOW,
    sendSlot: async () => { asked++; return { ok: true, state: 'sent', results: {} }; }, claimSlot: async () => { asked++; return true; } } });
  for (const [slot, w] of [['reelA', 'send'], ['reelC', 'send-slot'], ['reelD', 'Send']]) {
    const s = await fix({ date: day, slot, what: w }, 'The ' + slot + ' slot has no record and its hour has passed; send it once, through the duplicate guard.');
    ok(!s.ok && /never sends a slot/.test(s.error) && /hourly run/.test(s.error) && /Post now/.test(s.error), 'what: "' + w + '" is refused, in plain words: ' + s.error);
  }
  ok(asked === 0 && fbStarts() === 0 && ['reelA', 'reelC', 'reelD'].every(s => !recOf(s) && !S.get('nsoc:claim:' + day + '#' + s)),
    'nothing was sent, claimed or written, and no sendSlot or slot claim was ever asked for');
  ok(unspent('nsoul:count:fix:' + day) && unspent('nsoul:count:r2:' + day), 'and a refused send spends no cap');
  ok(!/sendSlot|claimSlot|planDay/.test(String(lev.run)), 'the lever holds no way to send a slot: no sendSlot, no slot claim, no plan of the day');
  SOUL.setSeams({ deps: { ...DEPS, manifest: async () => SHELF_NOW } });

  /* what was owed goes out with the hourly run: after an outage (nothing
     recorded since 08:00), one slot a run, the newest first */
  const run1 = await SOC.runDue('noorcodex.com', day, new Date(day + 'T15:30:10Z'), { index: IDX });
  const went = run1.ran.filter(x => x.state === 'sent').map(x => x.slot);
  ok(went.join() === 'reelD' && fbStarts() === 1 && recOf('reelD').state === 'sent' && !recOf('reelA') && !recOf('reelC'),
    'the hourly run after an outage sends one owed slot, the newest (14:00), and leaves 08:00 and 11:00 to the runs after it: ' + went.join());
  /* the owner's Post now and the lever on the same owed slot, the same moment */
  FB.delay = 200;
  const [lv, own] = await Promise.all([
    fix({ date: day, slot: 'reelC', what: 'send' }, 'The 11:00 slot has no record and its hour has passed; send it once, through the duplicate guard.'),
    SOC.sendSlot('noorcodex.com', day, 'reelC', { force: false, index: IDX })
  ]);
  FB.delay = 0;
  ok(!lv.ok && /never sends a slot/.test(lv.error) && own.ok && fbStarts() === 2 && recOf('reelC').state === 'sent',
    'the owner\'s Post now and the lever on the same owed slot: the lever stands aside and the slot goes out once (' + (fbStarts() - 1) + ' upload)');

  /* what every repair is refused on, whatever it asks */
  const reel = SC.chooseReel(LEANSHELF, day, 'morning', null, new Map(), null);
  const halfA = () => putSlot(day, 'reelA', { at: day + 'T08:00:00Z', slot: 'reelA', state: 'partial', title: reel.hook, reel: reel.id, kind: reel.kind,
    results: { facebook: { ok: false, error: 'a bad minute at Facebook', tries: 1 }, threads: { ok: true, id: 'T1' } } });
  halfA();
  const startsG = fbStarts();
  setDials({ 'social.mode': 'off' });
  const off = await fix({ date: day, slot: 'reelA', what: 'retry', channel: 'facebook' });
  ok(!off.ok && /schedule is off/.test(off.error), 'with the schedule off it owes nothing: ' + off.error);
  FAULT.key = /^nb:settings/;
  const nod = await fix({ date: day, slot: 'reelA', what: 'retry', channel: 'facebook' });
  ok(!nod.ok && /settings could not be read/.test(nod.error), 'settings that cannot be read stop it: ' + nod.error);
  setDials({});
  FAULT.key = /^nsoc:slot:/;
  const nor = await fix({ date: day, slot: 'reelA', what: 'retry', channel: 'facebook' });
  ok(!nor.ok && /record could not be read/.test(nor.error), 'a slot record that cannot be read is never taken for an empty one: ' + nor.error);
  FAULT.key = null;
  const yday = await fix({ date: addDays(day, -1), slot: 'reelA', what: 'retry', channel: 'facebook' });
  ok(!yday.ok && /today .* only/.test(yday.error), 'only today: ' + yday.error);
  const card = await fix({ date: day, slot: 'nope', what: 'retry', channel: 'facebook' });
  ok(!card.ok && /no such slot/.test(card.error), 'an unknown slot is refused');
  const what = await fix({ date: day, slot: 'reelA', what: 'post' });
  ok(!what.ok && /what must be retry or finish/.test(what.error), 'an unknown what is refused: ' + what.error);
  ok(fbStarts() === startsG, 'and not one of them asked Facebook anything');

  /* a retry through exactly retryChannel, never forced, a hand's press, on the lever's clock */
  let calledR = null;
  putSlot(day, 'reelF', { at: 'x', slot: 'reelF', state: 'failed', title: 'verse 77', reel: 'verse-77', kind: 'verse', results: { facebook: { ok: false, error: 'a bad minute', tries: 1 } } });
  SOUL.setSeams({ deps: { ...DEPS, manifest: async () => SHELF_NOW, retryChannel: async (h, d, s, ch, o) => { calledR = { h, d, s, ch, o }; return { ok: false, error: 'refused again, stubbed', result: { ok: false, error: 'refused again, stubbed' } }; } } });
  const sr = await fix({ date: day, slot: 'reelF', what: 'retry', channel: 'facebook' });
  ok(!sr.ok && calledR && calledR.h === 'noorcodex.com' && calledR.d === day && calledR.s === 'reelF' && calledR.ch === 'facebook'
    && calledR.o.force === false && calledR.o.byHand === true && typeof calledR.o.left === 'function' && Object.keys(calledR.o).sort().join() === 'byHand,force,left',
    'a retry goes through retryChannel(host, date, slot, channel, {force:false, byHand:true}), the retry-channel button\'s own call, on the lever\'s clock: ' + sr.error);
  ok(calledR.o.left() > 0 && calledR.o.left() <= LV.FIX_RUN_MS && LV.FIX_RUN_MS < 60000,
    'the clock it hands down ends inside the minute the cycle holds a hand to (' + LV.FIX_RUN_MS + ' ms)');
  SOUL.setSeams({ deps: { ...DEPS, manifest: async () => SHELF_NOW } });
  /* the clock itself, in the poster: a network with no room left is recorded late, never sent, and the record is written */
  putSlot(day, 'reelF', { at: 'x', slot: 'reelF', state: 'failed', title: 'verse 77', reel: 'verse-77', kind: 'verse', results: { facebook: { ok: false, error: 'a bad minute', tries: 1 } } });
  const startsC = fbStarts();
  const clocked = await SOC.retryChannel('noorcodex.com', day, 'reelF', 'facebook', { byHand: true, left: () => 7000 });
  ok(!clocked.ok && clocked.result.late && fbStarts() === startsC && recOf('reelF').results.facebook.late === true,
    'retryChannel handed a clock with no room left records the network late, uploads nothing, and writes the record: ' + JSON.stringify(clocked.result));
  const unclocked = await SOC.retryChannel('noorcodex.com', day, 'reelF', 'facebook', { byHand: true });
  ok(unclocked.ok && fbStarts() === startsC + 1, 'and with no clock handed down it behaves exactly as before');

  /* one retry of one network at a time: the poster's own claim on it, held
     by the hourly healer or the owner's Retry this minute */
  halfA();
  const startsH = fbStarts();
  const RETRY_KEY = 'nsoc:retry:' + day + '#reelA|facebook';
  S.set(RETRY_KEY, 'x');
  const held = await fix({ date: day, slot: 'reelA', what: 'retry', channel: 'facebook' });
  ok(!held.ok && /Facebook is being retried for the 08:00 slot right now/.test(held.error) && fbStarts() === startsH && recOf('reelA').state === 'partial',
    'a network being retried by another this minute is not asked twice, and the refusal says why: ' + held.error);
  S.delete(RETRY_KEY);

  /* retry: only a network that failed */
  const startsBefore = fbStarts();
  const tThreads = await fix({ date: day, slot: 'reelA', what: 'retry', channel: 'threads' });
  ok(!tThreads.ok && /already has the 08:00 post/.test(tThreads.error), 'a network that already has the post is refused in the lever: ' + tThreads.error);
  const asSteward = await fix({ date: day, slot: 'reelA', what: 'retry-channel', where: 'threads' });
  ok(!asSteward.ok && /Threads already has the 08:00 post/.test(asSteward.error), 'the Steward\'s own spelling of the repair ({what: "retry-channel", where}) is read the same way: ' + asSteward.error);
  const noCh = await fix({ date: day, slot: 'reelA', what: 'retry' });
  ok(!noCh.ok && /names the network/.test(noCh.error), 'a retry must name its network');
  const never = await fix({ date: day, slot: 'reelA', what: 'retry', channel: 'youtube' });
  ok(!never.ok && /never asked/.test(never.error), 'a network that was never asked is refused: ' + never.error);
  const rFb = await fix({ date: day, slot: 'reelA', what: 'retry', channel: 'facebook' });
  ok(rFb.ok && fbStarts() === startsBefore + 1 && recOf('reelA').state === 'sent' && recOf('reelA').results.threads.id === 'T1',
    'the one network that failed is retried, once, and the one that had it is untouched: ' + rFb.entry.result.note);
  ok(rFb.entry.result.channels.length === 1 && rFb.entry.result.channels[0].channel === 'facebook' && rFb.entry.result.channels[0].ok && !S.get(RETRY_KEY),
    'the result says what happened, network by network, and the retry\'s claim was let go');
  const rFb2 = await fix({ date: day, slot: 'reelA', what: 'retry', channel: 'facebook' });
  ok(!rFb2.ok && fbStarts() === startsBefore + 1, 'asked again it is refused: the slot is whole now: ' + rFb2.error);
  /* the duplicate guard: the same reel already on Facebook under ANOTHER record */
  putSlot(day, 'reelB', { at: 'x', slot: 'reelB', state: 'failed', title: reel.hook, reel: reel.id, kind: reel.kind,
    results: { facebook: { ok: false, error: 'a bad minute', tries: 1 } } });
  const dup = await fix({ date: day, slot: 'reelB', what: 'retry', channel: 'facebook' });
  ok(!dup.ok && /duplicate guard never sends it there twice/.test(dup.error) && fbStarts() === startsBefore + 1, 'a reel the duplicate guard already sees on that network is refused in the lever: ' + dup.error);
  const direct = await SOC.retryChannel('noorcodex.com', day, 'reelB', 'facebook', { byHand: true });
  ok(direct.ok && direct.result.already && fbStarts() === startsBefore + 1, 'and under it the poster\'s own guard decides the same way, with no upload: ' + JSON.stringify(direct.result));
  FAULT.key = /^nsoc:reels:postedch/;
  putSlot(day, 'reelE', { at: 'x', slot: 'reelE', state: 'failed', title: 'x', reel: 'name-9', kind: 'name', results: { facebook: { ok: false, error: 'wobble', tries: 1 } } });
  const gf = await fix({ date: day, slot: 'reelE', what: 'retry', channel: 'facebook' });
  ok(!gf.ok && /duplicate guard could not be read/.test(gf.error), 'a duplicate guard that cannot be read refuses: ' + gf.error);
  FAULT.key = null;
  putSlot(day, 'reelF', { at: 'x', slot: 'reelF', state: 'failed', title: 'x', reel: 'verse-1', kind: 'verse', results: { facebook: { ok: false, code: 190, error: 'token expired', tries: 1 } } });
  const tok = await fix({ date: day, slot: 'reelF', what: 'retry', channel: 'facebook' });
  ok(!tok.ok && /needs the owner/.test(tok.error), 'a refusal a retry cannot mend (an expired token) is left for the owner: ' + tok.error);
  putSlot(day, 'reelF', { at: 'x', slot: 'reelF', state: 'failed', title: 'x', reel: 'verse-1', kind: 'verse', results: { pinterest: { ok: false, trial: true, error: 'trial' } } });
  const tr = await fix({ date: day, slot: 'reelF', what: 'retry', channel: 'pinterest' });
  ok(!tr.ok && /did not fail/.test(tr.error), 'a network waiting on its review did not fail anything: ' + tr.error);
  const rd = await fix({ date: day, slot: 'reelF', what: 'retry', channel: 'reddit' });
  ok(!rd.ok && /draft for the owner/.test(rd.error), 'Reddit is a draft and is never sent by the machine: ' + rd.error);
  const noRec = await fix({ date: day, slot: 'dusk', what: 'retry', channel: 'facebook' });
  ok(!noRec.ok && /nothing was recorded/.test(noRec.error) && /hourly run/.test(noRec.error), 'a slot with nothing recorded has nothing to retry, and is left to the hourly run: ' + noRec.error);

  /* finish: only a slot still processing */
  FB.status = 'processing';
  putSlot(day, 'reelE', { at: new Date().toISOString(), slot: 'reelE', state: 'pending', title: 'x', reel: 'name-9', kind: 'name',
    results: { facebook: { ok: false, pending: { fb: 'VID77' } } } });
  const notPend = await fix({ date: day, slot: 'reelA', what: 'finish' });
  ok(!notPend.ok && /nothing on the 08:00 slot is still processing/.test(notPend.error), 'a slot that is not processing is refused: ' + notPend.error);
  const cardFin = await fix({ date: day, slot: 'word', what: 'finish' });
  ok(!cardFin.ok && /only a reel/.test(cardFin.error), 'a card is never left processing');
  const startsF = fbStarts();
  const f1 = await fix({ date: day, slot: 'reelE', what: 'finish' });
  ok(f1.ok && f1.entry.result.channels[0].pending && recOf('reelE').state === 'pending' && fbStarts() === startsF,
    'still processing: asked, said so, nothing uploaded: ' + f1.entry.result.note);
  FB.status = 'ready';
  const f2 = await fix({ date: day, slot: 'reelE', what: 'finish' });
  ok(f2.ok && f2.entry.result.channels[0].ok && recOf('reelE').state === 'sent' && fbStarts() === startsF, 'ready: published, and the record says sent: ' + f2.entry.result.note);
  const pendRetry = await fix({ date: day, slot: 'reelE', what: 'retry', channel: 'facebook' });
  ok(!pendRetry.ok, 'and a finished slot is retried by nobody');

  /* the cap: six a day, its own, never the R2 total */
  const fixCount = Number(S.get('nsoul:count:fix:' + day) || 0);
  ok(fixCount === 3 && unspent('nsoul:count:r2:' + day), 'every repair that ran spent the fix cap (' + fixCount + ': one retry, two finishes) and none touched the R2 total');
  FB.status = 'processing';
  putSlot(day, 'reelE', { at: new Date().toISOString(), slot: 'reelE', state: 'pending', title: 'x', reel: 'name-9', kind: 'name',
    results: { facebook: { ok: false, pending: { fb: 'VID78' } } } });
  const upTo6 = [];
  for (let i = fixCount; i < 6; i++) upTo6.push(await fix({ date: day, slot: 'reelE', what: 'finish' }));
  const seventh = await fix({ date: day, slot: 'reelE', what: 'finish' });
  ok(upTo6.length === 3 && upTo6.every(x => x.ok) && !seventh.ok && seventh.refused === 'cap' && /6 posting repairs/.test(seventh.error), 'the sixth runs, the seventh is refused by the cap, in words: ' + seventh.error);
  ok(unspent('nsoul:count:r2:' + day), 'and the R2 total is still untouched');
  FB.status = 'ready';

  /* the undo is a refusal */
  const u = await HANDS.undoAction(rFb.id, 'owner');
  ok(!u.ok && /a post is never deleted/.test(u.error), 'its undo refuses, and says why: ' + u.error);

  /* THE RACE THE REVIEW FOUND (6 October 2026, CRITICAL): the hourly run's
     healer and the Lantern's act stage retrying the same failed network of
     the same slot in the same minute. Both used to read the record before
     either wrote it, and Facebook took the reel twice. */
  resetStore(); setShelf(LEANSHELF); setDials({}); FB.calls.length = 0; FB.status = 'ready';
  const reelC = SC.chooseReel(LEANSHELF, day, 'noon', null, new Map(), null);
  putSlot(day, 'reelC', { at: day + 'T11:00:05Z', slot: 'reelC', state: 'partial', title: reelC.hook, reel: reelC.id, kind: reelC.kind,
    results: { facebook: { ok: false, error: 'a bad minute at Facebook', tries: 1 }, threads: { ok: true, id: 'T1' } } });
  FB.delay = 300;
  const [healed, raced] = await Promise.all([
    SOC.healFailures('noorcodex.com', day, { ran: [] }, new Date(day + 'T15:31:00Z'), () => true),
    fix({ date: day, slot: 'reelC', what: 'retry', channel: 'facebook' }, 'The record shows the 11:00 reel reached Threads but Facebook refused it with a bad minute; retry Facebook.')
  ]);
  FB.delay = 0;
  const hr = healed.find(x => x.slot === 'reelC' && x.where === 'facebook');
  const leverBusy = !raced.ok && /being retried for the 11:00 slot right now/.test(String(raced.error));
  const healerBusy = !!hr && !hr.ok && /being retried/.test(String(hr.error));
  ok(fbStarts() === 1, 'the hourly healer and the lever retrying Facebook for the same slot the same minute: Facebook is asked once (' + fbStarts() + ')');
  ok(leverBusy !== healerBusy && (leverBusy ? !!hr && hr.ok : raced.ok),
    'the one that came second was told the network is being retried right now, and asked nothing: ' + (leverBusy ? raced.error : hr && hr.error));
  ok(recOf('reelC').results.facebook.ok === true && recOf('reelC').results.threads.id === 'T1' && !S.get('nsoc:retry:' + day + '#reelC|facebook'),
    'the record says Facebook has it, Threads is untouched, and the claim was let go');
}

/* ===========================================================================
   PART 8 · THE RED LINES
=========================================================================== */
console.log('\n--- 8. the red lines pass the levers, and still do their work ---');
{
  const pass1 = (action, args, why) => HANDS.redLineCheck({ action, args, why });
  const leanArgs = { slot: 'reelD', kind: 'verse', days: 3, from: '2026-10-05' };
  /* retry and finish, in the lever's words and the Steward's (send is no
     longer a repair: the lever refuses it, 6 October 2026) */
  const fixArgs = [{ date: '2026-10-05', slot: 'reelA', what: 'retry', channel: 'instagram' }, { date: '2026-10-05', slot: 'reelE', what: 'finish' },
    { date: '2026-10-05', slot: 'reelA', what: 'retry-channel', where: 'instagram' }, { date: '2026-10-05', slot: 'reelE', what: 'finish-reels' }];
  ok(pass1('rota-lean', leanArgs, '').ok, 'rota-lean, by name and arguments');
  ok(fixArgs.every(a => pass1('fix-posting', a, '').ok), 'fix-posting, by name and every shape of its arguments');
  ok(pass1('rota-lean', leanArgs, HANDS.HANDS['rota-lean'].describe).ok && pass1('fix-posting', fixArgs[0], HANDS.HANDS['fix-posting'].describe).ok,
    'each lever\'s own description, echoed back as a why, passes');
  const leanWhys = [
    'Name reels held people for a median 61 percent this week against 38 percent for word reels, so lean the 14:00 slot toward names for three days.',
    'The afternoon reel reached 1204 people as a verse and 640 as a word; lean reelD toward verse until Sunday.',
    'Lean the evening slot toward the day\'s card for two days, then the rota takes it back.',
    'A short reel in the morning slot for a week to measure whether the films hold people longer.'
  ];
  const fixWhys = [
    'The record shows the 11:00 reel reached Facebook but Instagram refused it with a timeout; retry Instagram so the slot the schedule owes is whole.',
    'Facebook refused the 17:00 reel with a timeout while Threads took it; retry Facebook once, through the duplicate guard.',
    'Instagram is still processing the 14:00 reel; finish it so the slot reads sent.',
    'The 12:00 card failed on every network with a bad minute at Meta; retry Facebook first.'
  ];
  ok(leanWhys.every(w => pass1('rota-lean', leanArgs, w).ok), 'ordinary reasons for a lean pass: ' + leanWhys.filter(w => !pass1('rota-lean', leanArgs, w).ok).join(' | '));
  ok(fixWhys.every(w => pass1('fix-posting', fixArgs[0], w).ok), 'ordinary reasons for a repair pass: ' + fixWhys.filter(w => !pass1('fix-posting', fixArgs[0], w).ok).join(' | '));
  const stillRefused = [
    ['fix-posting', fixArgs[1], 'post extra reels today to catch up'],
    ['fix-posting', fixArgs[1], 'publish another reel outside the schedule'],
    ['fix-posting', fixArgs[0], 'delete the post on Instagram and send it again'],
    ['rota-lean', leanArgs, 'raise the daily caps so more leans fit']
  ];
  ok(stillRefused.every(([a, args, w]) => !pass1(a, args, w).ok), 'and a reason that crosses a red line is still refused through either lever');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
