/* NOOR · the Lantern's mission powers, and the day across the horizon.
   ---------------------------------------------------------------------------
   LANTERN.md sections 8 and 10 (3 October 2026, second round), against the
   real modules (api/_mission.js, api/_door.js, api/_dayline.js, api/_home.js,
   api/_hands.js, api/_decisions.js, api/_mind.js, api/lineup.js, api/page.js,
   assets/noor-dials.js) over the in-memory store, the router stub and the
   stood-in network of tests/_soul-harness.mjs. Proves:
     today.slots: every slot of the day in time order, each {slot, time,
       label, kind, state, networks, lean}, the states the horizon draws,
       the networks a record shows were asked, the kind every other view
       shows, the lean that shaped a slot; a store fault is null with its
       reason in missing.slots, and the rest of the day still stands;
     the lean on Posts: api/lineup.js rows carry lean and appliedLean;
     draft: kept in nsoul:drafts and raised as a "you" card carrying
       draft {title, text} and its steps; Sent, Later and No; 3 a day,
       counted by the hand itself; 3 waiting at most; the red-line guard
       reads kind, to, purpose and why, never the letter; the letter is read
       for personal data, links out (a bare host such as bit.ly/x as well,
       never "2.5 percent", "Dr. Ali", "e.g." or "a.m."), invented numbers
       (the critic), an endorsement or a promise, and for any private person
       in the house's own records (the full name in an inbox sender's bare
       address too, written through api/inbox.js itself); the hand sends
       nothing; Sent is the owner's own, from
       that letter's own card, and seven days on the outreach is measured
       into the effects ledger; undo withdraws an unsent letter;
     decisions[].draft on the Home, null on every other card;
     feature-door: R2, the council or the owner, cap door 1 a day, only a
       room of the library's map in the map's own words, never /donate or
       the console, 7 days, undo puts back the door before (or none); shown
       on /today and on the arrival alike, each page holding an empty box
       that assets/noor-dials.js fills from the settings answer's
       lantern.door (review of 6 October 2026: /today's own HTML, kept at
       the edge until midnight, is the same before a door, under it and
       after its Undo), the map held equal to noor-fx.js;
     search fixes: the audit's failing pages as ONE build card, raised again
       only when the list changes, closed when the list empties;
     the planner sees the whole field, every intent names its goal, the
       caps are unchanged, and only totals reach the model.

   Run:  node tests/mission.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  S, L, FAULT, NET, resetStore, SOUL, HANDS, MIND, INST, LINEUP, ROUTER, DEPS, APPROVED, door, fakeRes, addDays, setDay, today,
  MANIFEST, putSnap, snapFor, onNet, resp
} from './_soul-harness.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOME = await import('../api/_home.js');
const DEC = await import('../api/_decisions.js');
const MP = await import('../api/_mission.js');
const DOORM = await import('../api/_door.js');
const DL = await import('../api/_dayline.js');
const EVOLVE = await import('../api/_evolve.js');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };
/* a fresh owner cookie for every request: the harness's own lives 100 seconds */
const auth = () => {
  const exp = Date.now() + 3600000;
  return { cookie: 'noor_admin=' + exp + '.' + crypto.createHmac('sha256', process.env.ADMIN_SECRET).update(String(exp)).digest('hex') };
};
const home = async () => (await door({ query: { view: 'home' }, headers: auth() })).body;
const post = async body => (await door({ method: 'POST', headers: auth(), body })).body;
const keys = o => Object.keys(o || {}).sort().join();
const same = (o, list) => keys(o) === list.slice().sort().join();
const DASH = new RegExp('[' + String.fromCharCode(0x2014, 0x2013) + ']');
const D0 = '2026-10-07';          /* a Wednesday, so no cycle is the weekly one */
const rec = (d, s, r) => S.set('nsoc:slot:' + d + '#' + s, JSON.stringify(r));
const drafts = () => JSON.parse(S.get('nsoul:drafts') || '[]');
const openCards = () => JSON.parse(S.get('nsoul:decisions') || '[]');
const draftCards = () => openCards().filter(d => d.source === 'draft');
const archive = () => (L.get('nsoul:decisions:archive') || []).map(s => JSON.parse(s));

/* the Steward, stood in, for the cycles below: nothing to report */
DEPS.stewardFold = async () => ({ at: new Date(Date.parse(today() + 'T05:20:00Z')).toISOString(), inbox: 0, journal: 0, trouble: [], findings: [] });

/* ===========================================================================
   1. TODAY.SLOTS: THE DAY ACROSS THE HORIZON (LANTERN.md section 10)
=========================================================================== */
console.log('\n1. today.slots: every posting slot of the day, in time order');
{
  resetStore(); setDay(D0, '17:30');
  const d = today();
  putSnap(snapFor(d));
  rec(d, 'dawn', { state: 'sent', results: { facebook: { ok: true }, instagram: { ok: true } } });
  /* five networks asked, four have it; Pinterest on trial, Reddit a draft and
     the owner's phone are no network the slot was sent to */
  rec(d, 'reelA', { state: 'partial', reel: 'verse-kursi', kind: 'verse', results: { facebook: { ok: true }, instagram: { ok: true }, youtube: { ok: true },
    threads: { ok: false, err: 'refused' }, telegram: { ok: true }, pinterest: { ok: false, trial: true }, reddit: { ok: false, links: [] }, phone: { ok: true } } });
  rec(d, 'reelC', { state: 'failed', reel: 'word-sabr', kind: 'word', lean: { id: 'lean-old', kind: 'word' }, results: { facebook: { ok: false, err: 'x' }, instagram: { ok: false, err: 'y' } } });
  rec(d, 'light', { state: 'pending', results: { facebook: { ok: true }, instagram: { ok: false, pending: 'container-1' } } });
  rec(d, 'reelD', { state: 'skipped', title: '', why: 'owner override', override: { action: 'skip', by: 'owner' } });
  /* a lean on the late reel (always a verse by the rota) toward words, and a
     skip the owner set on the night reel, which has not run yet */
  S.set('nsoc:rota:leans', JSON.stringify([{ id: 'lean-t', slot: 'reelF', kind: 'word', from: d, to: d, by: 'soul', at: d + 'T05:00:00Z' }]));
  S.set('nsoc:override:' + d, JSON.stringify({ reelE: { action: 'skip', at: d, by: 'owner', note: '' } }));
  const t0 = Date.now();
  const h = await home();
  const sl = h.today && h.today.slots;
  ok(Array.isArray(sl) && !('slots' in h.missing), 'today.slots is a list and nothing is missing (' + (Date.now() - t0) + ' ms, no model asked)');
  const FIELDS = ['slot', 'time', 'label', 'kind', 'state', 'networks', 'lean'];
  ok(sl.every(s => same(s, FIELDS) && same(s.networks, ['sent', 'total'])), 'each slot is exactly {' + FIELDS.join(', ') + '}, networks {sent, total}');
  ok(sl.every(s => /^\d\d:\d\d$/.test(s.time)) && sl.every((s, i) => i === 0 || sl[i - 1].time <= s.time), 'in time order, each at "HH:MM" UTC: ' + sl.map(s => s.time).join(' '));
  ok(sl.map(s => s.slot).join() === 'dawn,reelA,reelC,light,reelD,word,reelB,reelF,dusk,reelE',
    'the day\'s slots: no coming-up card on a day whose date the store never verified, and the dawn card because it went: ' + sl.map(s => s.slot).join(','));
  const by = Object.fromEntries(sl.map(s => [s.slot, s]));
  ok(sl.every(s => DL.STATES.includes(s.state)), 'every state is one the horizon draws: ' + DL.STATES.join(', '));
  ok(by.dawn.state === 'sent' && by.dawn.kind === 'card' && by.dawn.label === 'the dawn card' && by.dawn.time === '05:00' && by.dawn.networks.sent === 2 && by.dawn.networks.total === 2,
    'dawn: sent, the dawn card, 2 of 2 networks');
  ok(by.reelA.state === 'partial' && by.reelA.kind === 'verse' && by.reelA.label === 'a verse reel' && by.reelA.networks.sent === 4 && by.reelA.networks.total === 5 && by.reelA.lean === null,
    'the morning reel: partly sent, a verse reel, 4 of 5 networks (trial, a draft and the phone not counted): ' + JSON.stringify(by.reelA));
  ok(by.reelC.state === 'failed' && by.reelC.networks.sent === 0 && by.reelC.networks.total === 2 && by.reelC.lean === 'word', 'the noon reel: failed, 0 of 2, and the lean its own record says it went under');
  ok(by.light.state === 'partial' && by.light.label === 'the day\'s card' && by.light.networks.sent === 1 && by.light.networks.total === 2, 'a card still processing at one network, sent to another: partly sent');
  ok(by.reelD.state === 'skipped', 'a slot the owner skipped: skipped');
  ok(by.word.state === 'due' && by.reelB.state === 'due' && by.word.networks.total === 0, 'with no record and its hour come: due (16:00, and 17:00 at 17:30)');
  ok(by.reelF.state === 'later' && by.dusk.state === 'later' && by.dusk.label === 'the chapter card', 'before its hour: later');
  ok(by.reelF.lean === 'word' && by.reelF.kind === 'word' && by.reelF.label === 'a word reel', 'the late reel leans toward words today, and is said as a word reel');
  ok(by.reelE.state === 'skipped' && by.reelE.kind === null && by.reelE.label === 'the night reel', 'a skip already set on a slot not yet run: skipped, said by its half');
  /* the kind of an open reel slot is the card every other view of the day shows */
  const ctx = await LINEUP.buildDayContext('noorcodex.com', d, { cards: MANIFEST, hijri: null, seen: new Map() });
  const pickB = await LINEUP.chooseReelWithOverride(ctx.cards, d, 'reelB', null, ctx.seen, ctx.bias, null, { leans: ctx.leans });
  ok(pickB.card && by.reelB.kind === (pickB.card.kind || 'light'), 'the evening reel\'s kind is the card the poster and every view would show: ' + by.reelB.kind);
  ok(sl.every(s => !/soul/i.test(s.label) && !DASH.test(s.label)), 'every label in the house\'s words, the Lantern\'s, no dash');
  /* a label for every kind the house names (api/_insights.js KIND_LABEL) */
  const INS = await import('../api/_insights.js');
  ok(Object.keys(INS.KIND_LABEL).every(k => DL.SAY[k]), 'a phrase for every kind of reel and card the insights name');
  const CH = await import('../api/_channels.js');
  ok([...CH.draftOnly].sort().join() === DL.DRAFT_ONLY.slice().sort().join(), 'the drafts-only channels are the channels file\'s own: ' + DL.DRAFT_ONLY.join(','));

  /* a store fault reading the records: null, with its reason; the rest stands */
  FAULT.key = /^nsoc:slot:/;
  const h2 = await home();
  FAULT.key = null;
  ok(h2.today && h2.today.slots === null && typeof h2.missing.slots === 'string' && h2.missing.slots.length > 0 && h2.today.posts && h2.today.reach7,
    'a fault: today.slots is null and missing.slots says why ("' + h2.missing.slots + '"), today\'s other fields stand');
  ok(!('today' in h2.missing), 'and the today part itself is not missing');
  /* the conversation's lantern tool carries the same day */
  const st = await HOME.lanternState({});
  ok(Array.isArray(st.today.slots) && st.today.slots.length === sl.length, 'the Lantern\'s own state (its conversation tool) reads the same slots');
}

/* ===========================================================================
   2. THE LEAN ON POSTS: api/lineup.js rows carry lean
=========================================================================== */
console.log('\n2. the lean on Posts: /api/lineup rows carry lean and appliedLean');
{
  onNet('https://noorcodex.com/reels/index.json', async () => resp(200, { n: MANIFEST.length, written: D0, cards: MANIFEST }));
  const LU = await import('../api/lineup.js');
  const d = today();
  const r = fakeRes();
  await LU.default({ method: 'GET', query: { date: d }, headers: { ...auth(), host: 'noorcodex.com' } }, r);
  const rows = (r.body && r.body.slots) || [];
  const row = s => rows.find(x => x.slot === s) || {};
  ok(r.statusCode === 200 && rows.length === 6 && rows.every(x => 'lean' in x && 'appliedLean' in x), 'GET answers six rows, each with lean and appliedLean');
  ok(row('reelF').lean && row('reelF').lean.kind === 'word' && row('reelF').appliedLean && row('reelF').appliedLean.kind === 'word' && row('reelF').card && row('reelF').card.kind === 'word',
    'the late reel: the lean stored for it, the lean that decided its card, and a word card: ' + JSON.stringify(row('reelF').appliedLean));
  ok(row('reelC').lean === null && row('reelC').appliedLean && row('reelC').appliedLean.id === 'lean-old', 'a slot already recorded shows the lean its own record says it went under');
  ok(row('reelA').lean === null && row('reelA').appliedLean === null, 'a slot no lean touched carries none');
}

/* ===========================================================================
   3. DRAFT: A LETTER FOR THE OWNER TO SEND HIMSELF
=========================================================================== */
console.log('\n3. draft: a letter for the owner to send himself');
const LETTER = (over = {}) => ({ kind: 'mosque', to: 'the imam of a local mosque', purpose: 'Invite the mosque to share the Ramadan room with its community',
  title: 'The Ramadan room, for your community',
  text: 'Assalamu alaykum,\n\nNOOR is a free library of Islam, with no ads and no account. Its Ramadan room holds the month and the tools for it, and its Mushaf carries all 114 surahs, with recitation for every ayah.\n\nIf it would serve your community, the room is at https://noorcodex.com/ramadan, and the team would be glad to hear from you.\n\nWith salaam,\nNOOR', ...over });
const draftIntent = (over, why) => ({ action: 'draft', args: LETTER(over), why: why || 'A mosque before Ramadan is an audience the reels do not reach yet.', metric: 'northStar' });
let CARD1 = null, ACT1 = null;
{
  resetStore(); setDay(D0, '09:00');
  putSnap(snapFor(D0));
  await SOUL.ensureGoals(snapFor(D0));
  ROUTER.calls.length = 0;
  const net0 = NET.calls.length;
  const r = await HANDS.runHand(draftIntent(), { actor: 'soul', cycle: 'c-test' });
  ok(r.ok && r.tier === 'R1' && ROUTER.calls.length === 0, 'a valid letter is written, R1, with no council and no model asked: ' + (r.error || r.entry.result.note));
  ACT1 = r.id;
  const list = drafts();
  ok(list.length === 1 && list[0].status === 'open' && list[0].to === 'the imam of a local mosque' && list[0].decision && list[0].goal === 'g-reach', 'kept in nsoul:drafts, open, with its card and the goal it serves (g-reach)');
  ok(NET.calls.length === net0, 'and nothing left the house: not one network call');
  const cards = draftCards();
  ok(cards.length === 1 && cards[0].kind === 'you' && cards[0].key === 'draft:' + list[0].id && cards[0].ref === list[0].id && cards[0].draft && cards[0].draft.title === 'The Ramadan room, for your community',
    'raised as a "you" decision carrying the letter');
  CARD1 = cards[0].id;
  const h = await home();
  const c = h.decisions.find(x => x.id === CARD1);
  ok(c && same(c.draft, ['title', 'text']) && c.draft.text === LETTER().text && /\n\n/.test(c.draft.text), 'the Home\'s card carries draft {title, text}, its paragraphs kept, word for word');
  ok(c.options.map(o => o.id).join() === 'sent,later,no' && c.options[0].label === 'Sent' && c.steps.length === 3 && /Copy it/.test(c.steps[1]) && /own account/.test(c.steps[1]) && /Sent/.test(c.steps[2]),
    'its options are Sent, Later and No, and its steps say copy it, send it from your own account, press Sent');
  ok(c.title === 'A letter to the imam of a local mosque' && c.goal === 'g-reach', 'its title says who it is for, its goal the reach');
  ok(h.decisions.filter(x => x.id !== CARD1).every(x => x.draft === null), 'every other card carries draft: null');
  const done = h.done.find(x => x.actionId === ACT1);
  ok(done && done.title === 'Wrote a letter for you to send: to the imam of a local mosque' && done.undo === true, 'Done says what it did, with an Undo: ' + (done && done.title));

  /* the red-line guard reads the hand's own fields and the why, never the letter */
  const body = await HANDS.runHand(draftIntent({ text: LETTER().text + '\n\nPlease contact the team, or write to the house through the site.' }), { actor: 'soul' });
  ok(body.ok, 'a letter whose own words would trip the guard ("contact the team") is still a letter: ' + (body.error || 'written'));
  const purpose = await HANDS.runHand(draftIntent({ purpose: 'Email the imam and contact the community about Ramadan' }), { actor: 'soul' });
  ok(!purpose.ok && purpose.refused === 'R3', 'the same words in its purpose are a red line: ' + purpose.error);
  const why = await HANDS.runHand(draftIntent({}, 'Send emails to every reader on the list.'), { actor: 'soul' });
  ok(!why.ok && why.refused === 'R3', 'and so are they in its why');

  /* what the hand itself reads in the letter */
  const refuse = async (over, rx, what) => {
    const x = await HANDS.runHand(draftIntent(over), { actor: 'soul' });
    ok(!x.ok && rx.test(String(x.error)), what + ': ' + x.error);
  };
  await refuse({ to: 'Mr Ahmed' }, /role or a public institution/, 'to naming a person is refused');
  /* an address in `to` never even reaches the hand: the red-line guard reads `to` */
  await refuse({ to: 'imam@mosque.org' }, /per-person data|role or a public institution/, 'to as an address is refused');
  await refuse({ to: 'Sheikh Yusuf of the mosque' }, /role or a public institution/, 'to as a title before a name is refused');
  ok(MP.namesAPerson('Dr Amina, head of the school') && !MP.namesAPerson('the trustees of the Imam Ali Centre') && !MP.namesAPerson('the imam of East London Mosque'),
    'a title before a name is a person; an institution named after one, or a role, is not');
  await refuse({ kind: 'reader' }, /kind must be one of/, 'a kind outside the six is refused');
  await refuse({ text: LETTER().text + '\nWrite back to imam.office@example.org.' }, /personal data/, 'an email address in the letter is refused');
  await refuse({ text: LETTER().text + '\nOr call +44 20 7946 0958.' }, /personal data/, 'a phone number in the letter is refused');
  await refuse({ text: LETTER().text + '\nThe server is at 10.1.2.3.' }, /personal data/, 'an IP address in the letter is refused');
  await refuse({ text: LETTER().text + '\nOur journal_id is 77.' }, /Journal/, 'a Journal marker in the letter is refused');
  await refuse({ text: LETTER().text + '\nRead more at https://example.com/islam.' }, /links outside the house/, 'a link out of the house is refused');
  /* a bare host is a link out as well (review of 6 October 2026) */
  await refuse({ text: LETTER().text + '\nOur verse reels are gathered for you at bit.ly/noor-verses.' }, /links outside the house/, 'a shortened link with no scheme is refused');
  await refuse({ text: LETTER().text + '\nThe channel we admire most is instagram.com/brother.yusuf.official.' }, /links outside the house/, 'a profile address with no scheme is refused');
  await refuse({ to: 'the team of muslimcreators.org' }, /links outside the house|role or a public institution/, 'and so is a bare host in who it is for');
  ok(MP.linksIn('Only 2.5 percent of readers stay, Dr. Ali said, e.g. at 9 a.m. or after 5 p.m.').length === 0, '"2.5 percent", "Dr. Ali", "e.g." and "a.m." are never taken for links');
  const bareOwn = { to: 'the imam of a local mosque', purpose: LETTER().purpose, title: LETTER().title, text: LETTER().text.replace('https://noorcodex.com/ramadan', 'noorcodex.com/ramadan') };
  ok(MP.linksIn(bareOwn.text).join() === 'noorcodex.com/ramadan,' && MP.checkLetter(bareOwn).ok, 'the house\'s own address with no scheme is the house\'s, and kept');
  await refuse({ text: LETTER().text + '\nLast month the library reached 48,213 people.' }, /number the evidence does not/, 'a number the evidence does not carry is refused (the critic)');
  await refuse({ text: LETTER().text + '\nThe library is endorsed by the national council of imams.' }, /endorsement/, 'an endorsement the house does not have is refused');
  await refuse({ text: LETTER().text + '\nIn return we will share your events with our followers.' }, /promises/, 'a promise the house has not made is refused');
  await refuse({ text: 'Too short.' }, /too short/, 'a letter too short to send is refused');
  const ev = await HANDS.runHand(draftIntent({ text: LETTER().text.replace('all 114 surahs', 'all 114 surahs, the 99 Names, 25 prophets and 350 Lights') }), { actor: 'soul' });
  ok(ev.ok, 'numbers the library\'s own map carries (114, 99, 25, 350) are kept: ' + (ev.error || 'written'));

  /* three waiting at most; three a day, counted by the hand itself */
  ok(draftCards().length === 3, 'three letters wait now');
  const fourth = await HANDS.runHand(draftIntent(), { actor: 'soul' });
  ok(!fourth.ok && /3 letters already wait/.test(fourth.error), 'a fourth is refused while three wait: ' + fourth.error);
  const others = draftCards().filter(c => c.id !== CARD1);
  const no = await post({ action: 'decide', id: others[0].id, option: 'no' });
  ok(no.ok && draftCards().length === 2 && archive().some(a => a.id === others[0].id && a.status === 'no'), 'No closes one: ' + no.message);
  const capped = await HANDS.runHand(draftIntent(), { actor: 'soul' });
  ok(!capped.ok && /daily cap of 3 drafts/.test(capped.error), 'with two waiting, a fourth letter the same day is the cap: ' + capped.error);
  ok(S.get(SOUL.K.count('drafts', D0)) === '3' && !S.get(SOUL.K.count('r2', D0)), 'counted as 3 drafts, never as a public action');
  const later = await post({ action: 'decide', id: others[1].id, option: 'later' });
  ok(later.ok && draftCards().length === 2 && draftCards().find(c => c.id === others[1].id).snoozedUntil === addDays(D0, 3), 'Later hides one for three days, and it still waits: ' + later.message);

  /* the hand sends nothing, whatever it is given */
  const src = String(MP.MISSION_HANDS.draft.run);
  ok(!/fetch\(|social|telegram|notify|sendSlot|sendMessage/i.test(src), 'the hand holds no way to send: no fetch, no poster, no Telegram');

  /* private people in the house's own records are never named. The reader
     writes through api/inbox.js itself, which keeps `from` as the bare
     address and refuses "Name <address>" (review of 6 October 2026) */
  const INBOX = await import('../api/inbox.js');
  const inb = fakeRes();
  await INBOX.default({ method: 'POST', headers: { host: 'noorcodex.com' }, body: { kind: 'other', body: 'salaam, a reader wrote', from: 'yusuf.rahman@example.com' } }, inb);
  const mid = (L.get('nb:list') || [])[0];
  const msg = mid ? JSON.parse(S.get('nb:msg:' + mid)) : null;
  ok(inb.statusCode === 200 && inb.body && inb.body.ok && msg && msg.from === 'yusuf.rahman@example.com', 'a reader writes to the inbox the way the site does, and it keeps the bare address');
  L.set('nj:list', ['e1']);
  L.set('nj:c:e1', [JSON.stringify({ cid: 'c1', name: 'Maryam Haddad', mail: '', body: 'a comment', state: 'pending' })]);
  const names = await MP.privateNames();
  ok(names.includes('yusuf rahman') && names.includes('maryam haddad'), 'the house\'s records are read for full names, inside the hand only: the inbox address\'s own name, and the commenter\'s');
  ok(['info@mosque.org', 'contact.us@example.org', 'imam.office@example.org', 'y.rahman@example.com'].every(e => MP.namesFromEmail(e).length === 0) && MP.namesFromEmail('yusuf_rahman92@example.com').join() === 'yusuf rahman',
    'an address that names a mailbox or a role, or carries only an initial, is no one\'s full name; a name with marks and digits around it still is');
  ok(MP.namesInText('The story of Yusuf, peace be upon him, and of Maryam', names).length === 0, 'a prophet\'s or a companion\'s own name alone is never mistaken for a reader');
  setDay(addDays(D0, 1), '09:00');
  const named = await HANDS.runHand(draftIntent({ text: LETTER().text + '\nOur reader Yusuf Rahman suggested we write.' }), { actor: 'soul' });
  ok(!named.ok && /names someone from the house's own records/.test(named.error) && !/Yusuf|Rahman/.test(named.error), 'a letter naming a reader from the inbox is refused, and the refusal does not repeat the name');
  const named2 = await HANDS.runHand(draftIntent({ to: 'the study circle committee of Maryam Haddad' }), { actor: 'soul' });
  ok(!named2.ok && /names someone/.test(named2.error), 'and so is one addressed to a commenter from the Journal');
  FAULT.key = /^nj:/;
  const blind = await HANDS.runHand(draftIntent(), { actor: 'soul' });
  FAULT.key = null;
  ok(!blind.ok && /records could not be read/.test(blind.error), 'records that cannot be read refuse the letter (a name is never guessed absent)');
  const nextDay = await HANDS.runHand(draftIntent(), { actor: 'soul' });
  ok(nextDay.ok && draftCards().length === 3, 'a new day: the cap is fresh, and the third waiting letter is written');
  L.delete('nb:list'); L.delete('nj:list'); L.delete('nj:c:e1'); if (mid) S.delete('nb:msg:' + mid);
}

console.log('\n3b. Sent: the owner\'s own, and what follows is measured');
{
  /* the Lantern can never say a letter went */
  const id = drafts().find(x => x.decision === CARD1).id;
  const self = await HANDS.runHand({ action: 'draft-sent', args: { id }, why: 'the plan says it went' }, { actor: 'soul' });
  ok(!self.ok && /only the owner/.test(self.error), 'run by the Lantern alone, Sent is refused: ' + self.error);
  const viaNext = await HANDS.runHand({ action: 'draft-sent', args: { id }, why: 'x' }, { actor: 'owner', approval: { owner: true, source: 'next', id: 'q-1' } });
  ok(!viaNext.ok && /only the owner/.test(viaNext.error), 'and so it is through Next: only the letter\'s own card says it');
  const other = await HANDS.runHand({ action: 'draft-sent', args: { id }, why: 'x' }, { actor: 'owner', approval: { owner: true, source: 'decision', id: 'd-someone-else' } });
  ok(!other.ok && /letter's own card/.test(other.error), 'and from another card it is refused');
  /* a letter that never kept its card's id is matched to its card by its key */
  const lone = drafts().find(x => x.status === 'open' && x.id !== id);
  S.set('nsoul:drafts', JSON.stringify(drafts().map(x => (x.id === lone.id ? { ...x, decision: null } : x))));
  const loneTry = await HANDS.runHand({ action: 'draft-sent', args: { id: lone.id }, why: 'x' }, { actor: 'owner', approval: { owner: true, source: 'decision', id: 'd-someone-else' } });
  ok(!loneTry.ok && /letter's own card/.test(loneTry.error) && drafts().find(x => x.id === lone.id).status === 'open', 'a letter that lost its card\'s id is matched by its key: another card still cannot mark it');
  const sent = await post({ action: 'decide', id: CARD1, option: 'sent' });
  const dd = drafts().find(x => x.id === id);
  ok(sent.ok && sent.executed === true && /Done: A letter to the imam of a local mosque/.test(sent.message), 'the owner\'s Sent runs it: ' + sent.message);
  const D1 = addDays(D0, 1);
  ok(dd.status === 'sent' && dd.before && dd.before.metric === 'northStar' && dd.before.value === 19000 && dd.before.date === D1,
    'the letter is marked sent, with the reach of the latest morning before it went: ' + JSON.stringify(dd.before));
  ok(archive().some(a => a.id === CARD1 && a.status === 'yes'), 'its card is closed as answered');
  const again = await post({ action: 'decide', id: CARD1, option: 'sent' });
  ok(!again.ok && /already answered/.test(again.message), 'a second Sent: already answered');
  const undoSentLetter = await HANDS.undoAction(ACT1, 'owner');
  ok(!undoSentLetter.ok && /already sent/.test(undoSentLetter.error), 'a letter that went cannot be withdrawn: ' + undoSentLetter.error);
  const h = await home();
  const sentDone = h.done.find(x => x.actionId === sent.actionId);
  ok(sentDone && sentDone.by === 'owner' && /Marked a letter as sent/.test(sentDone.title), 'Done says the owner marked it: ' + (sentDone && sentDone.title));

  /* seven days on, the reach that followed, into the effects ledger */
  setDay(addDays(D1, 3), '06:00');
  const early = await MP.measureOutreach(today());
  ok(early.measured.length === 0 && early.waiting === 1, 'three days on, it waits');
  setDay(addDays(D1, 7), '06:00');
  putSnap(snapFor(addDays(D1, 7), { northStar: 21000 }));
  const m = await MP.measureOutreach(today());
  const e = (await INST.readEffects(5)).find(x => x.action === 'draft');
  ok(m.measured.length === 1 && e && e.metric === 'northStar' && e.before === 19000 && e.after === 21000 && e.delta === 2000 && ['helped', 'hurt', 'unclear'].includes(e.verdict) && e.outreach && e.outreach.kind === 'mosque',
    'seven days on, the outreach is measured into the effects ledger: ' + JSON.stringify(e && { before: e.before, after: e.after, delta: e.delta, verdict: e.verdict }));
  ok((await MP.measureOutreach(today())).measured.length === 0 && drafts().find(x => x.id === id).effect, 'and only once; the letter keeps its verdict');
  ok(INST.effectsForPrompt(await INST.readEffects(20)).some(x => x.action === 'draft'), 'what worked, as the planner reads it, now includes the outreach');
}

console.log('\n3c. undo withdraws a letter not yet sent');
{
  const open = draftCards()[0];
  const actId = (await SOUL.actionsList(50)).find(a => a.hand === 'draft' && a.ok && a.result && a.result.decision === open.id).id;
  const u = await HANDS.undoAction(actId, 'owner');
  ok(u.ok && !draftCards().some(c => c.id === open.id) && archive().some(a => a.id === open.id && a.status === 'withdrawn') && drafts().find(x => x.id === open.ref).status === 'withdrawn',
    'undo closes its card and marks it withdrawn: ' + (u.note || u.error));
}

/* ===========================================================================
   4. THE DOOR OF THE WEEK
=========================================================================== */
console.log('\n4. feature-door: the door of the week');
{
  resetStore(); setDay(D0, '09:00');
  const intent = p => ({ action: 'feature-door', args: { path: p }, why: 'Ramadan approaches, and the Ramadan room is what readers need this week.', metric: 'site.searchShare' });
  const nc = await HANDS.runHand(intent('/ramadan'), { actor: 'soul' });
  ok(!nc.ok && nc.refused === 'council', 'R2: without the council or the owner it does not run');
  for (const bad of ['/donate', '/admin2', '/today', '/journal', '/nowhere', 'https://example.com/', '/ramadan/../donate']) {
    const x = await HANDS.runHand(intent(bad), { actor: 'soul', approval: APPROVED });
    ok(!x.ok && /library's own rooms in its map/.test(x.error), bad + ' is never a door: refused');
  }
  ok([undefined, '0'].includes(S.get(SOUL.K.count('door', D0))) && [undefined, '0'].includes(S.get(SOUL.K.count('r2', D0))), 'a refused door spends no cap: it is given back');
  const r = await HANDS.runHand(intent('/ramadan'), { actor: 'soul', approval: APPROVED });
  const recd = JSON.parse(S.get('nsoul:pub:door'));
  ok(r.ok && recd.path === '/ramadan' && recd.title === 'Ramadan' && recd.desc === 'The month, and the tools for it' && recd.since === D0 && recd.until === addDays(D0, 7),
    'with the council: nsoul:pub:door {path, title, desc, since, until}, the map\'s own words, seven days: ' + JSON.stringify({ path: recd.path, until: recd.until }));
  ok(S.get(SOUL.K.count('door', D0)) === '1' && S.get(SOUL.K.count('r2', D0)) === '1', 'it spends the door cap and one of the day\'s public actions');
  const second = await HANDS.runHand(intent('/hajj'), { actor: 'owner', approval: { owner: true, source: 'decision', id: 'd-1' } });
  ok(!second.ok && /daily cap of 1 door of the week/.test(second.error), 'a second door the same day is the cap, even with the owner\'s approval: ' + second.error);
  ok(JSON.stringify(DOORM.publicDoor(recd, D0)) === JSON.stringify({ path: '/ramadan', title: 'Ramadan', desc: 'The month, and the tools for it' }), 'the public reads {path, title, desc}');
  ok(DOORM.publicDoor(recd, addDays(D0, 6)) && DOORM.publicDoor(recd, addDays(D0, 7)) === null && DOORM.publicDoor(recd, addDays(D0, -1)) === null, 'shown on its day and the six after; gone on its seventh');
  ok(DOORM.publicDoor({ ...recd, title: 'Words a model wrote', desc: 'and more' }, D0).title === 'Ramadan', 'the words are always the map\'s, whatever the record says');
  ok(DOORM.publicDoor({ ...recd, path: '/donate' }, D0) === null, 'a record naming the gift door shows nothing');
  /* chosen again the next day, then undone: the door before it comes back */
  setDay(addDays(D0, 1), '09:00');
  const r2 = await HANDS.runHand(intent('/hajj'), { actor: 'soul', approval: APPROVED });
  ok(r2.ok && JSON.parse(S.get('nsoul:pub:door')).path === '/hajj', 'the next day another room is chosen');
  const undoFirst = await HANDS.undoAction(r.id, 'owner');
  ok(!undoFirst.ok && /newer door was chosen/.test(undoFirst.error), 'the older choice cannot be undone over the newer one');
  const undo2 = await HANDS.undoAction(r2.id, 'owner');
  ok(undo2.ok && JSON.parse(S.get('nsoul:pub:door')).path === '/ramadan' && /door before it is back/.test(undo2.note), 'undo puts back the previous door: ' + undo2.note);
  const undo1 = await HANDS.undoAction(r.id, 'owner');
  ok(undo1.ok && S.get('nsoul:pub:door') === undefined && /no door/.test(undo1.note), 'and undoing the first leaves none: ' + undo1.note);
  /* the Home says it in the room's own words */
  const h = await home();
  ok(h.done.some(x => x.title === 'Put "Ramadan" forward as the door of the week'), 'Done says it in the room\'s own name');
  ok(DOORM.doorOf('/kids/lanterns') && DOORM.doorOf('/companions').desc.endsWith('\uFDFA'), 'a nested room is a door, and the map\'s words keep their own marks');
}

console.log('\n4b. the map is noor-fx.js MAP, word for word; never the gift door or the console');
{
  const fx = fs.readFileSync(path.join(ROOT, 'noor-fx.js'), 'utf8');
  const m = fx.match(/var MAP = (\[[\s\S]*?\]\]\]\]);/);
  const MAPFX = m ? JSON.parse(m[1]) : null;
  ok(MAPFX && JSON.stringify(MAPFX) === JSON.stringify(DOORM.MAP), 'api/_door.js MAP equals noor-fx.js MAP (' + (MAPFX ? MAPFX.reduce((n, s) => n + s[2].length, 0) : 0) + ' rooms)');
  ok(!DOORM.DOORS.some(x => x.path === '/donate' || /^\/admin/.test(x.path) || x.path === '/today') && DOORM.DOORS.length === 39, 'the doors are the map\'s rooms but the gift door, Today and the house\'s own business: ' + DOORM.DOORS.length);
  ok(MP.MISSION_HANDS['feature-door'].describe.includes(DOORM.DOORS.map(x => x.path).join(', ')), 'and the planner is told exactly those rooms');
}

/* assets/noor-dials.js, run as the browser runs it, over one settings
   answer: the box it fills ([data-noor-door], "row" on /today) is returned */
const DIALS_JS = fs.readFileSync(path.join(ROOT, 'assets/noor-dials.js'), 'utf8');
const runDials = async (answer, variant = '') => {
  const box = { hidden: true, innerHTML: '', getAttribute: n => (n === 'data-noor-door' ? variant : null) };
  const doc = { querySelector: s => (s === '[data-noor-door]' ? box : null), querySelectorAll: () => [], getElementById: () => null, createElement: () => ({ style: {}, setAttribute() {} }) };
  const ctx = { document: doc, location: { pathname: variant === 'row' ? '/today' : '/', search: '' }, sessionStorage: { getItem: () => null, setItem() {} },
    fetch: async () => ({ ok: true, json: async () => answer }), console };
  vm.runInNewContext(DIALS_JS, ctx);
  await new Promise(r => setTimeout(r, 30));
  return box;
};

console.log('\n4c. shown on /today, drawn in the browser from the settings answer');
{
  /* review of 6 October 2026: /today is kept at the edge until midnight, so
     a door read into its HTML lagged a new door by up to a day and outlived
     its Undo. The page now holds only an empty box, filled by the dials
     script from the settings answer (30 seconds at the edge), like the
     arrival. /today is the server page of the real day. */
  const real = new Date().toISOString().slice(0, 10);
  resetStore(); setDay(real, '06:10');
  onNet('https://noorcodex.com/api/illuminations', async () => resp(404, {}));
  const PAGE = await import('../api/page.js');
  const SETTINGS = await import('../api/settings.js');
  const call = async q => { const r = fakeRes(); await PAGE.default({ method: 'GET', headers: { host: 'noorcodex.com' }, query: q }, r); return r; };
  const answer = async () => { const r = fakeRes(); await SETTINGS.default({ method: 'GET', headers: { host: 'noorcodex.com' }, query: {} }, r); return r; };
  const t0 = await call({ kind: 'today' });
  const h0 = String(t0.sent || '');
  ok(t0.statusCode === 200 && h0.includes('<div data-noor-door="row" hidden></div>') && /<script src="\/assets\/noor-dials\.js\?v=\d+" defer><\/script>\s*<\/body>/.test(h0),
    '/today holds one empty, hidden box for the door, and loads the dials script that fills it');
  ok(h0.indexOf('data-noor-door') < h0.indexOf('class="n2-rooms"') && h0.indexOf('data-noor-door') > h0.indexOf('The whole library'), 'above the rooms, inside the library\'s own screen');
  ok(!/The door of the week/.test(h0) && !/api\/settings/.test(h0), 'the page itself never carries a door\'s words, and asks nothing of its own');
  const intent = { action: 'feature-door', args: { path: '/hajj' }, why: 'Dhul Hijjah approaches, and the Hajj room is what readers need this week.', metric: 'site.searchShare' };
  const r = await HANDS.runHand(intent, { actor: 'soul', approval: APPROVED });
  const h1 = String((await call({ kind: 'today' })).sent || '');
  ok(r.ok && h1 === h0, 'a door chosen after the page was drawn leaves its HTML exactly as it was, so the copy the edge keeps until midnight is never out of date');
  const a1 = await answer();
  ok(a1.statusCode === 200 && a1.body.lantern && a1.body.lantern.door && a1.body.lantern.door.path === '/hajj' && /s-maxage=30\b/.test(String(a1.headers['Cache-Control'])),
    'the settings answer carries it at once, kept 30 seconds at the edge: ' + a1.headers['Cache-Control']);
  const b1 = await runDials(a1.body, 'row');
  ok(!b1.hidden && b1.innerHTML === '<ul class="n2-list"><li><a href="/hajj"><b>Hajj &amp; Umrah<small>The door of the week · The rites, step by step, with their evidence</small></b></a></li></ul>',
    'and the dials script draws it in /today\'s box as one quiet row of the page\'s own list, in the map\'s words');
  const u = await HANDS.undoAction(r.id, 'owner');
  const a2 = await answer();
  const b2 = await runDials(a2.body, 'row');
  ok(u.ok && a2.body.lantern && a2.body.lantern.door === null && b2.hidden && b2.innerHTML === '', 'after its Undo the answer has no door, and the box stays empty and hidden');
  const h2 = String((await call({ kind: 'today' })).sent || '');
  ok(h2 === h0, '/today\'s own HTML is the same before the door, under it, and after its Undo');
  const dated = String((await call({ kind: 'today', date: DOORM.addDaysD(real, -1) })).sent || '');
  ok(!/data-noor-door|noor-dials/.test(dated), 'a dated day, a record, holds no box and loads no dials script');
  S.set('nsoul:pub:door', JSON.stringify({ id: 'door-o', path: '/hajj', title: 'x', desc: 'y', since: DOORM.addDaysD(real, -9), until: DOORM.addDaysD(real, -2) }));
  const b3 = await runDials((await answer()).body, 'row');
  ok(b3.hidden, 'a door past its seven days is not in the answer, and so not shown');
  S.delete('nsoul:pub:door');
}

console.log('\n4d. shown on the arrival, from the settings answer\'s lantern.door');
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const lib = html.slice(html.indexOf('id="library"'), html.indexOf('id="mizan"'));
  ok(/<p class="hm-count">[^<]*<\/p>\s*<!--[^>]*-->\s*<div data-noor-door hidden><\/div>\s*<div class="hm-lib">/.test(lib), 'the arrival holds one empty placeholder where it lists its doors, above the rooms');
  ok(/src="\/assets\/noor-dials\.js\?v=\d+" defer/.test(html) && !/api\/settings/.test(html), 'and no request of its own: the dials script already asks the settings answer');
  ok(Buffer.byteLength(html) < 50 * 1024, 'the arrival stays under its 50 KB budget (' + Buffer.byteLength(html) + ')');
  const dials = DIALS_JS;
  ok(!/animation|transition|requestAnimationFrame|animate\(/.test(dials.slice(dials.indexOf('function door('), dials.indexOf('/* the remembered answer'))), 'no new motion: the door is a plain row of the house\'s own list');
  const run = answer => runDials(answer, '');
  const shape = { s: { 'journal.on': true }, lantern: { line: { id: 'everyday' }, note: null, door: { path: '/ramadan', title: 'Ramadan', desc: 'The month, and the tools for it' } } };
  const b1 = await run(shape);
  ok(!b1.hidden && b1.innerHTML.includes('<a href="/ramadan"><b>Ramadan<small>The month, and the tools for it</small></b></a>') && /^<p class="hm-count"( style="[^"<>]*")?>The door of the week<\/p>/.test(b1.innerHTML),
    'with { s, lantern: { line, note, door } }: one row, the room\'s own title and line, under the arrival\'s own label');
  const row = await runDials(shape, 'row');
  ok(!row.hidden && !row.innerHTML.includes('hm-count') && row.innerHTML.includes('<small>The door of the week · The month, and the tools for it</small>'),
    'and on /today\'s box (data-noor-door="row") the same row with the label in its small line, the way that page\'s list reads');
  const b2 = await run({ s: {}, lantern: { line: null, note: null, door: null } });
  ok(b2.hidden && b2.innerHTML === '', 'with door null: nothing at all');
  const b3 = await run({ s: {} });
  ok(b3.hidden, 'with no lantern part in the answer (an older settings): nothing at all');
  const b4 = await run({ s: { 'journal.on': false }, lantern: { door: { path: '/journal', title: 'J', desc: 'j' } } });
  ok(b4.hidden, 'a closed journal is never put forward');
  const b5 = await run({ s: {}, lantern: { door: { path: 'javascript:alert(1)', title: 'x', desc: 'y' } } });
  ok(b5.hidden, 'a path that is not a room\'s path is never drawn');
  const b6 = await run({ s: {}, lantern: { door: { path: '/hajj', title: '<img src=x onerror=alert(1)>', desc: '"quoted"' } } });
  ok(!b6.hidden && !b6.innerHTML.includes('<img') && b6.innerHTML.includes('&lt;img') && b6.innerHTML.includes('&quot;quoted&quot;'), 'words are drawn as text, never as markup');
}

/* ===========================================================================
   5. SEARCH FIXES BECOME BUILDS
=========================================================================== */
console.log('\n5. search fixes: the audit\'s failing pages as one build card');
{
  resetStore(); setDay(D0, '09:00');
  const reading = failures => S.set(SOUL.K.inst('search'), JSON.stringify({ ok: true, week: '2026-W41', date: D0, sampled: 25, score: 80, failures }));
  const URL = p => 'https://noorcodex.com' + p;
  reading([
    { url: URL('/dictionary/sabr'), fails: ['no meta description', 'thin: 42 words'] },
    { url: URL('/light/badr'), fails: ['no structured data'] },
    { url: URL('/places/makkah'), fails: ['noindex'] },
    { url: URL('/prophets/yunus'), fails: ['canonical points elsewhere'] }
  ]);
  const r = await MP.searchFixesCard();
  const card = () => openCards().find(d => d.key === 'search-fixes');
  const ups = () => JSON.parse(S.get(SOUL.K.upgrades) || '[]');
  ok(r.ok && r.raised && card() && card().kind === 'build' && card().source === 'search', 'one build card for Claude: ' + (card() && card().title));
  ok(card().steps.length === 3 && card().steps.join(' | ').includes('/dictionary/sabr: no meta description; thin: 42 words') && !card().steps.join(' ').includes('/light/badr'),
    'its steps list the pages failing the four basics (a description, a canonical, enough words, indexable), and only those: ' + card().steps.join(' | '));
  ok(card().options.map(o => o.id).join() === 'build,later,no' && card().goal === 'g-search' && card().link.href === '/admin2#soul', 'Build it, Later, No; for g-search; the spec in the engine room');
  ok(ups().length === 1 && ups()[0].status === 'proposed' && ups()[0].spec.includes(URL('/places/makkah')) && ups()[0].id === card().ref, 'the upgrade it builds is written, the pages in its spec');
  const again = await MP.searchFixesCard();
  ok(again.ok && !again.raised && again.same && openCards().filter(d => d.key === 'search-fixes').length === 1 && ups().length === 1, 'the same list again: not raised again, one card, one upgrade');
  reading([
    { url: URL('/dictionary/sabr'), fails: ['no meta description', 'thin: 45 words'] },
    { url: URL('/places/makkah'), fails: ['noindex'] },
    { url: URL('/prophets/yunus'), fails: ['canonical points elsewhere'] }
  ]);
  const moved = await MP.searchFixesCard();
  ok(!moved.raised && moved.same && ups().length === 1, 'a page whose word count moved, failing the same basics, is the same list');
  reading([
    { url: URL('/dictionary/sabr'), fails: ['no meta description', 'thin: 42 words'] },
    { url: URL('/places/makkah'), fails: ['noindex'] },
    { url: URL('/prophets/yunus'), fails: ['canonical points elsewhere'] },
    { url: URL('/heroes/salahuddin'), fails: ['no canonical'] }
  ]);
  const changed = await MP.searchFixesCard();
  ok(changed.raised && openCards().filter(d => d.key === 'search-fixes').length === 1 && card().steps.length === 4 && ups().length === 1 && ups()[0].id === card().ref && ups()[0].spec.includes('/heroes/salahuddin'),
    'a changed list: the one card again, with the new list, its old unbuilt upgrade replaced by the new one');
  const built = await post({ action: 'decide', id: card().id, option: 'build' });
  ok(built.ok && !card() && ups()[0].status === 'accepted', 'Build it accepts the upgrade into Claude\'s queue: ' + built.message);
  ok(!(await MP.searchFixesCard()).raised, 'answered: the same list is not raised again');
  reading([{ url: URL('/arabic'), fails: ['no meta description'] }]);
  ok((await MP.searchFixesCard()).raised && card() && card().steps.length === 1, 'a new list after it was built: one new card');
  reading([{ url: URL('/arabic'), fails: ['no structured data'] }]);
  const empty = await MP.searchFixesCard();
  ok(empty.resolved && !card() && archive().some(a => a.key === 'search-fixes' && a.status === 'resolved'), 'nothing left to fix: the card closes itself');
  const many = Array.from({ length: 9 }, (_, i) => ({ url: URL('/page-' + i), fails: ['thin: ' + (10 + i) + ' words'] }));
  reading(many);
  await MP.searchFixesCard();
  ok(card().steps.length === 6 && /and 4 more pages, listed in the spec/.test(card().steps[5]), 'nine pages: five in the steps, the rest in the spec');
}

/* ===========================================================================
   6. THE PLANNER SEES THE WHOLE FIELD; THE CYCLE USES IT
=========================================================================== */
console.log('\n6. the planner sees the whole field, every intent names its goal');
{
  resetStore(); setDay(D0, '05:20'); ROUTER.calls.length = 0;
  ROUTER.guardian = 'approve'; ROUTER.skeptic = 'approve';
  S.set('nexp:state', JSON.stringify({ current: { id: 'verse-length', start: addDays(D0, -2), args: {} }, history: [] }));
  S.set(SOUL.K.inst('search'), JSON.stringify({ ok: true, week: '2026-W41', date: D0, sampled: 25, score: 90, failures: [{ url: 'https://noorcodex.com/eid', fails: ['no meta description'] }] }));
  ROUTER.plan = JSON.stringify({ intents: [
    { action: 'feature-door', args: { path: '/ramadan' }, why: 'The Ramadan room is what readers search for in the weeks before the month.', expectedEffect: 'more readers on the Ramadan room', metric: 'site.searchShare', goal: 'g-search' },
    { action: 'draft', args: LETTER({ kind: 'society', to: 'the committee of a Muslim student society' }), why: 'A student society is an audience the reels do not reach yet.', expectedEffect: 'a society that hears of the library', metric: 'northStar', goal: 'g-nowhere' }
  ] });
  /* a letter already waiting, so the plan's own data has something to say about it */
  putSnap(snapFor(addDays(D0, -1)));
  const waiting = await HANDS.runHand(draftIntent(), { actor: 'soul' });
  ok(waiting.ok, 'a letter already waits before the cycle');
  const t = await MIND.tick({});
  ok(t.status === 'done', 'the daily cycle ran to its end: ' + t.status);
  const plan = ROUTER.calls.find(c => c.role === 'strategist');
  const sys = plan.messages[0].content, user = plan.messages[1].content;
  ok(/THE WHOLE FIELD/.test(sys) && /The site \(serves g-reach and g-search\): feature-door/.test(sys) && /Borrowing audiences \(serves g-reach\): draft/.test(sys) && /Search \(serves g-search\): indexnow-submit/.test(sys) && /Posting \(serves [^)]*\): lineup-skip, lineup-swap, rota-lean, fix-posting/.test(sys),
    'the strategist is told every power and the goal each serves');
  ok(/Every intent also names "goal"/.test(sys), 'and that every intent names its goal');
  ok(/THE MISSION POWERS TODAY[^\n]*\n\{"drafts":\{"waiting":1,"waitingMax":3,"perDay":3\}/.test(user) && !/Assalamu|imam of a local mosque|Ramadan room, for your community/.test(user),
    'it reads the mission powers today as totals (1 letter waiting of 3), never a letter itself');
  const rc = await MIND.readCycle(t.id);
  const fd = rc.intents.find(i => i.action === 'feature-door'), dr = rc.intents.find(i => i.action === 'draft');
  ok(fd && fd.goal === 'g-search' && fd.status === 'done' && fd.tier === 'R2' && fd.council && fd.council.approved, 'the door: its goal g-search, through the council, done');
  ok(dr && dr.goal === 'g-reach' && dr.status === 'done' && dr.tier === 'R1', 'the letter: a goal it named that does not exist is the goal kept on its metric (g-reach); R1, done');
  ok(JSON.parse(S.get('nsoul:pub:door')).path === '/ramadan' && draftCards().length === 2, 'the door is up and the new letter waits on the Home beside the first');
  ok(rc.searchFixes && rc.searchFixes.raised && openCards().some(d => d.key === 'search-fixes'), 'the report raised the search fixes card');
  ok(rc.reflect && rc.reflect.outreach && rc.reflect.outreach.n === 0, 'the reflect stage measured the outreach (none due yet)');
  ok(SOUL.CAP_LIMITS.r2 === 6 && SOUL.CAP_LIMITS.door === 1 && SOUL.CAP_LIMITS.drafts === 3 && MIND.MAX_INTENTS === 5, 'the caps are unchanged: 6 public actions, 1 door, 3 drafts, 5 intents');
  /* the money builder's hands are named the moment the registry carries them */
  ok(/Sustaining the house \(serves g-sustain\): giving, support-line, giving-note\./.test(MP.fieldText(HANDS.HANDS)), 'sustaining the house is named with its three hands, now that the registry carries them (merged 6 October)');
  const withGiving = { ...HANDS.HANDS, giving: { tier: 'R0' }, 'support-line': { tier: 'R2' }, 'giving-note': { tier: 'R2' } };
  ok(/Sustaining the house \(serves g-sustain\): giving, support-line, giving-note\./.test(MP.fieldText(withGiving)), 'and then: giving, support-line, giving-note, for g-sustain');
  /* the words the planner reads can never trip a red line when it repeats them */
  for (const n of Object.keys(MP.MISSION_HANDS)) ok(HANDS.redLineCheck({ action: 'note', args: {}, why: MP.MISSION_HANDS[n].describe }).ok, n + '\'s describe passes the red-line guard as a why');
  ok(HANDS.redLineCheck({ action: 'note', args: {}, why: MP.fieldText(withGiving) }).ok, 'and so does the whole field');
  ok(MP.goalOf('g-test', 'northStar', [{ id: 'g-test', status: 'active' }, { id: 'g-reach', metric: 'northStar', status: 'active' }]) === 'g-test'
    && MP.goalOf('g-old', 'northStar', [{ id: 'g-old', status: 'retired', metric: 'x' }, { id: 'g-reach', metric: 'northStar', status: 'active' }]) === 'g-reach'
    && MP.goalOf('', 'nothing', []) === null, 'goalOf: a live goal named, else the goal on its metric, else none');
}

/* ===========================================================================
   7. NOTHING OF THIS SAYS SOUL, AND NO NEW FILE CARRIES A DASH
=========================================================================== */
console.log('\n7. the house\'s words');
{
  const h = await home();
  const said = JSON.stringify({ d: h.decisions.map(x => [x.title, x.why, x.steps]), s: h.today && h.today.slots });
  ok(!/\bsoul\b/i.test(said.replace(/Journey of the Soul/g, '')), 'no card or slot of this says soul');
  for (const f of ['api/_mission.js', 'api/_door.js', 'api/_dayline.js', 'tests/mission.mjs']) ok(!DASH.test(fs.readFileSync(path.join(ROOT, f), 'utf8')), f + ' carries no em or en dash');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
