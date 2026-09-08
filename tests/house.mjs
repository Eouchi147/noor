/* NOOR · the house, read in one call.
   ------------------------------------------------------------------
   Two things are proved here, and the second is the important one.

   THE STEWARD. Every rule fires on a fixture and says the same thing twice:
   the sentence and the evidence carry the same numbers. A network waiting on
   its review is ONE line however many posts it refused. Every action is a
   call a route already handles, with the body shape that handler reads. The
   Lantern is asked last and is never allowed to invent: a paragraph carrying
   a number the findings do not have is thrown away and the template is used,
   and the answer says lantern: false.

   THE FLOW. Stages come from records or they come back unread; a network with
   an empty insights cache is `unread`, never zero; clicks are attributed by
   month because that is the only grain the beacon keeps, and the step that
   crosses two grains carries no rate.

   And over both: the gate, the ten and fifteen minute caches, ?fresh=1, and
   that no token, no secret and no household figure ever reaches an answer.

   Nothing here touches a network or a store: fetch, Redis, Stripe and the
   Lantern are all stubbed.

   Run:  node tests/house.mjs
*/
process.env.ADMIN_SECRET = "a-test-admin-secret-that-is-long-enough";
process.env.KV_REST_API_URL = "https://kv.test";
process.env.KV_REST_API_TOKEN = "kv-test-token";
process.env.FB_PAGE_ID = "1234567890";
process.env.FB_PAGE_TOKEN = "EAAsecretFacebookPageTokenNeverToBeSeen";
process.env.IG_USER_ID = "17841400000000001";
process.env.IG_TOKEN = "IGsecretInstagramTokenNeverToBeSeen";
process.env.TH_TOKEN = "THAAsecretThreadsTokenNeverToBeSeen";
process.env.TH_USER_ID = "17841400000000002";
process.env.TG_BOT_TOKEN = "111:secretTelegramBotTokenNeverToBeSeen";
process.env.TG_CHAT_ID = "@noorcodex";
process.env.LEDGER_FLOOR = "4321";
process.env.STRIPE_SECRET_KEY = "sk_test_notARealKeyForTests";
delete process.env.OPENROUTER_API_KEY;

import crypto from "crypto";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  PASS " + m); } else { fail++; console.log("  FAIL " + m); } };

/* ---------- a Redis in a Map ---------- */
const store = new Map();
const fakeKv = async cmds => cmds.map(c => {
  const [op, ...a] = c;
  if (op === "GET") return store.has(a[0]) ? store.get(a[0]) : null;
  if (op === "SET") { store.set(a[0], a[1]); return "OK"; }
  if (op === "MGET") return a.map(k => store.has(k) ? store.get(k) : null);
  if (op === "LRANGE") { const v = store.get(a[0]) || []; return v.slice(Number(a[1]), Number(a[2]) + 1); }
  if (op === "LPUSH") { const v = store.get(a[0]) || []; v.unshift(...a.slice(1)); store.set(a[0], v); return v.length; }
  if (op === "DEL") { a.forEach(k => store.delete(k)); return 1; }
  return null;
});
const fakeReady = () => true;

/* ---------- Stripe and the store, over one stubbed fetch ----------
   Stripe answers a hundred rows at a time and sets has_more when it is holding
   others. STRIPE_PAGES is how many pages each list here holds: one is the
   ordinary house, and more than one is the busy month that showed the du'a and
   guardian counts were reading only the first page and calling it the total.
   Every row carries an id shaped <kind>_p<page>_<n>, so the cursor the walker
   sends back says which page it is asking for. */
let stripeCalls = [];
let STRIPE_PAGES = 1;
const CHARGE_TS = Math.floor(Date.parse("2026-09-02T10:00:00Z") / 1000);
const askedPage = u => { const m = String(u).match(/starting_after=[a-z]+_p(\d+)_/); return m ? Number(m[1]) + 1 : 1; };
globalThis.fetch = async (url, opt = {}) => {
  const u = String(url);
  const J = (j, status = 200) => ({ ok: status < 400, status, json: async () => j, text: async () => JSON.stringify(j),
                                    headers: { get: () => "" } });
  if (u.startsWith("https://kv.test")) {
    const out = await fakeKv(JSON.parse(opt.body));
    return J(out.map(result => ({ result })));
  }
  stripeCalls.push(u);
  const p = askedPage(u), more = p < STRIPE_PAGES;
  if (u.includes("/v1/charges")) return J({ has_more: more, data: [1, 2, 3].map(i => ({
    id: "ch_p" + p + "_" + i, status: "succeeded", paid: true, amount: 1500, amount_captured: 1500, amount_refunded: 0,
    currency: "usd", created: CHARGE_TS, balance_transaction: { currency: "usd", fee: 75 } })) });
  if (u.includes("/v1/checkout/sessions")) return J({ has_more: more, data: [
    { id: "cs_p" + p + "_1", payment_status: "paid", custom_fields: [{ key: "dua", text: { value: "Ya Allah forgive my parents" } }] },
    { id: "cs_p" + p + "_2", payment_status: "paid", custom_fields: [{ key: "dua", text: { value: "" } }] },
    { id: "cs_p" + p + "_3", payment_status: "unpaid", custom_fields: [{ key: "dua", text: { value: "not counted" } }] },
    { id: "cs_p" + p + "_4", payment_status: "paid", metadata: { noor_dua: "Guidance for the ummah" } } ] });
  if (u.includes("/v1/subscriptions")) return J({ has_more: more, data: [
    { id: "sub_p" + p + "_1", metadata: { noor_market: "uk" } },
    { id: "sub_p" + p + "_2", metadata: { noor_donation: "1" } } ] });
  return J({ error: { message: "unexpected " + u } }, 400);
};

const ST = await import("../api/_steward.js");
const FL = await import("../api/_flow.js");
const houseRoute = (await import("../api/house.js")).default;

const NOW = "2026-09-08T20:10:00Z";
const TODAY = "2026-09-08";
const YESTERDAY = "2026-09-07";

/* ---------- a house, with everything quiet, that each test bends ---------- */
const slot = (id, at, over = {}) => ({ id, at, state: null, title: "", sentAt: null, results: null, passed: true, ...over });
const okRes = id => ({ ok: true, id });
function mkHouse(over = {}) {
  const base = {
    at: NOW, date: TODAY, hour: 20, mode: "auto", storeOk: true,
    planned: ["reelA", "reelC", "light", "reelD", "word", "reelB", "dusk", "reelE"],
    windowDays: 7, window: 40, days: [TODAY, YESTERDAY],
    today: [
      slot("reelA", 8, { state: "sent", results: { instagram: okRes("ig1"), facebook: okRes("fb1") } }),
      slot("reelC", 11, { state: "sent", results: { instagram: okRes("ig2"), facebook: okRes("fb2") } }),
      slot("light", 12, { state: "sent", results: { instagram: okRes("ig3"), facebook: okRes("fb3") } })
    ],
    channels: [
      { id: "facebook", live: true, draftOnly: false, sent: 12, failed: 0, waiting: 0, last: { date: TODAY, slot: "light" } },
      { id: "instagram", live: true, draftOnly: false, sent: 12, failed: 0, waiting: 0, last: { date: TODAY, slot: "light" } },
      { id: "reddit", live: false, draftOnly: true, sent: 0, failed: 0, waiting: 0, last: null }
    ],
    tokens: { fb: { configured: true, renewedAt: "2026-09-01", daysLeft: 53 },
              ig: { configured: true, renewedAt: "2026-09-01", daysLeft: 53 }, lifeDays: 60 },
    threads: { days: 10, renew: false, since: "2026-08-29" },
    insights: { media: 24, read: 24, unread: 0, refused: 0, needs: "", said: "" },
    visitors: { store: true, date: TODAY, yesterdayDate: YESTERDAY,
                today: { people: 140, views: 420 }, yesterday: { people: 120, views: 360 } },
    gifts: { configured: true, ok: true, count: 3, grossMinor: 4500, currency: "usd" },
    night: { findings: 0, files: [], lastAt: "2026-09-08T04:02:00Z" },
    log: { lines: 8, lastAt: "2026-09-08T12:01:00Z" },
    trouble: []
  };
  return { ...base, ...over };
}
const byId = (fs, id) => fs.find(f => f.id === id);

/* every route and body shape a finding is allowed to offer, checked against
   the handlers in api/social.js, api/insights.js, api/threads.js and
   api/admin-data.js rather than against what looks right */
const ROUTE_OK = /^\/api\/(social|insights)(\?date=\d{4}-\d{2}-\d{2})?$/;
/* Every href a finding may open: a room of the console, or a route that only
   reads. A GET that changes something -- /api/threads?action=renew rotates the
   token the moment it is opened -- is not on this list and must never be, so
   that no mis-tap, prefetch or link checker can perform it. */
const HREF_OK = new Set(["/api/threads?action=status", "/admin2#posts", "/admin2#night"]);
const BODY_ACTIONS = new Set(["send-slot", "retry-channel", "finish-reels", "mode", "renewed", "refresh"]);

console.log("\nthe ladder");
{
  ok(byId(ST.rules(mkHouse({ mode: "off" })), "mode").level === "watch", "off is a watch: nothing goes out on a schedule");
  const off = byId(ST.rules(mkHouse({ mode: "off" })), "mode");
  ok(off.action.kind === "post" && off.action.route === "/api/social" &&
     off.action.body.action === "mode" && off.action.body.mode === "approve",
     "and its action climbs one rung, to approve, through the dial the room already posts");
  ok(byId(ST.rules(mkHouse({ mode: "approve" })), "mode").level === "good" &&
     byId(ST.rules(mkHouse({ mode: "auto" })), "mode").level === "good", "approve and auto are both good, because both are a decision");
}

console.log("\ntoday's slots");
{
  const owedHouse = mkHouse({ today: [
    slot("reelA", 8, { state: "sent", results: { instagram: okRes("ig1") } }),
    slot("light", 12), slot("word", 16), slot("reelE", 21, { passed: false }) ] });
  const f = ST.rules(owedHouse);
  const owed = byId(f, "slots-unrecorded");
  ok(owed && owed.level === "act", "on auto, a slot whose hour passed with no record at all is an act");
  ok(!byId(f, "slots-owed"), "and it is not also reported as merely owed: one line, not two");
  ok(owed.evidence.owed === 2 && owed.evidence.slots.join(",") === "light,word", "the two owed slots are named, and the one whose hour has not come is not");
  ok(/12:00/.test(owed.say) && /16:00/.test(owed.say) && /2026-09-08T12:01:00Z/.test(owed.say), "the sentence quotes the hours and when the log was last written");
  /* The evidence is three facts: the hour passed, nothing was written, the log
     was last written at X. None of them can tell a run that never fired from a
     run that was cut off, so the sentence may not name a cause for the absence
     -- that would be a finding standing on evidence the house does not have. */
  ok(!/minute was spent|ran out|timed out|did not reach|cut off/i.test(owed.say + " " + owed.title),
     "and it asserts no cause the record cannot show: " + owed.say);
  ok(owed.action.body.action === "send-slot" && owed.action.body.slot === "light" &&
     owed.action.route === "/api/social?date=" + TODAY, "the action sends the oldest owed slot, with the date in the query the handler reads it from");
  const approve = ST.rules(mkHouse({ mode: "approve", today: owedHouse.today }));
  const owed2 = byId(approve, "slots-owed");
  ok(owed2 && owed2.level === "watch" && !byId(approve, "slots-unrecorded"), "on approve the same slots are owed, and the ladder is why: nothing was going to send them");

  const failedHouse = mkHouse({ today: [
    slot("light", 12, { state: "failed", results: { instagram: { ok: false, error: "(#10) no permission" },
      facebook: { ok: false, error: "token expired" }, reddit: { ok: true, links: ["https://reddit.com/x"] } } }) ] });
  const ff = byId(ST.rules(failedHouse), "slots-failed");
  ok(ff && ff.level === "act" && ff.evidence.failed === 1, "a slot no network took is an act");
  ok(ff.evidence.where === "instagram" && /no permission/.test(ff.say), "the network that refused is named with its own words");
  ok(ff.action.body.action === "retry-channel" && ff.action.body.where === "instagram" &&
     ff.action.body.slot === "light" && ff.action.body.date === TODAY && ff.action.route === "/api/social",
     "and the action retries that one network, which is the body retryChannel reads");

  const partial = ST.rules(mkHouse({ today: [
    slot("word", 16, { state: "partial", results: { facebook: okRes("fb9"), instagram: { ok: false, error: "the card URL answered 404" } } }) ] }));
  const pp = byId(partial, "slots-partial");
  ok(pp && pp.level === "act" && pp.action.body.where === "instagram" && pp.action.body.action === "retry-channel",
     "a half sent slot is an act and retries only the half that refused");
  ok(!byId(partial, "slots-failed"), "and it is not also called failed");

  const pend = ST.rules(mkHouse({ today: [
    slot("reelB", 17, { state: "pending", results: { instagram: { ok: false, pending: "C123" } } }) ] }));
  const dd = byId(pend, "slots-pending");
  ok(dd && dd.level === "watch" && dd.action.body.action === "finish-reels" && dd.action.route === "/api/social?date=" + TODAY,
     "a video still transcoding is a watch, and the action is the finisher the room already presses");
  ok(/nothing failed/i.test(dd.say), "and the sentence says nothing failed, because nothing did");

  const clean = ST.rules(mkHouse());
  ok(byId(clean, "slots-sent").level === "good" && byId(clean, "slots-sent").evidence.sent === 3,
     "a day with everything sent gets one good line with the count");
}

console.log("\na network waiting on its review is one line");
{
  const nine = [];
  for (const [id, at] of [["reelA", 8], ["reelC", 11], ["light", 12], ["reelD", 14], ["word", 16], ["reelB", 17], ["dusk", 20], ["reelE", 21]])
    nine.push(slot(id, at, { state: "sent", results: { instagram: okRes("ig" + at),
      pinterest: { ok: false, fatal: true, trial: true, waiting: true, err: "Pinterest is waiting on its Standard-access review" } } }));
  const h = mkHouse({ today: nine, channels: [
    { id: "instagram", live: true, draftOnly: false, sent: 40, failed: 0, waiting: 0, last: { date: TODAY, slot: "light" } },
    { id: "pinterest", live: true, draftOnly: false, sent: 0, failed: 0, waiting: 9, last: null } ] });
  const f = ST.rules(h);
  const waiting = f.filter(x => x.id === "slots-waiting");
  ok(waiting.length === 1, "eight slots refused by Pinterest make exactly one finding, not eight");
  ok(waiting[0].level === "watch" && /Pinterest/.test(waiting[0].title) && waiting[0].evidence.refused === 9,
     "it is a watch, it names the network, and it counts what was not offered");
  ok(!f.some(x => x.level === "act" && /pinterest/i.test(x.title)), "a stage is never an act: nobody can do anything about a review");
  ok(!byId(f, "channel-silent:pinterest"), "and a waiting network is not also called silent");
  ok(!byId(f, "slots-failed") && !byId(f, "slots-partial"), "nor does a waiting network make a slot read failed or half sent");
}

console.log("\nthe tokens");
{
  const soon = ST.rules(mkHouse({ tokens: { fb: { configured: true, renewedAt: "2026-07-15", daysLeft: 5 },
    ig: { configured: true, renewedAt: "2026-08-20", daysLeft: 41 }, lifeDays: 60 } }));
  const fb = byId(soon, "token-fb");
  ok(fb && fb.level === "act" && /5 days left/.test(fb.title), "a Meta token with five days left is an act, with the count in the title");
  ok(fb.action.body.action === "renewed" && fb.action.body.which === "fb" && fb.action.route === "/api/social",
     "and its action is the console's own I have renewed it, which never sees the token");
  ok(!byId(soon, "token-ig"), "a token with forty one days left says nothing");
  const near = byId(ST.rules(mkHouse({ tokens: { fb: { configured: false }, ig: { configured: true, renewedAt: "2026-08-26", daysLeft: 13 }, lifeDays: 60 } })), "token-ig");
  ok(near && near.level === "watch", "thirteen days is a watch, not yet an act");
  const never = byId(ST.rules(mkHouse({ tokens: { fb: { configured: false }, ig: { configured: true, renewedAt: "", daysLeft: null }, lifeDays: 60 } })), "token-ig");
  ok(never && never.level === "watch" && never.evidence.daysLeft === null, "a token never marked renewed is a watch: the countdown cannot warn");
  const th = byId(ST.rules(mkHouse({ threads: { days: 52, renew: true, since: "2026-07-18" } })), "token-threads");
  ok(th && th.level === "act" && th.action.kind === "open" && th.action.href === "/api/threads?action=status",
     "a Threads token past fifty days is an act, and the button opens the door that only reads");
  /* ?action=renew is a GET that rotates the token as soon as it is opened. A
     button carrying it would rotate the house's token on a mis-tap, so the
     renewal is a sentence the owner performs himself and never a link. */
  ok(!/action=renew/.test(JSON.stringify(th.action)), "the rotating door is on no button of it");
  ok(/\/api\/threads\?action=renew/.test(th.say) && /when you are ready/i.test(th.say),
     "and the say names that door as something the owner opens himself: " + th.say);
  ok(!byId(ST.rules(mkHouse()), "token-threads"), "a ten day old Threads token says nothing");
}

console.log("\nwhat strangers watched, and what the house could not read");
{
  const f = byId(ST.rules(mkHouse({ insights: { media: 24, read: 0, unread: 0, refused: 24,
    needs: "instagram_manage_insights", said: "(#10) Application does not have permission" } })), "insights-permission");
  ok(f && f.level === "act" && /instagram_manage_insights/.test(f.say), "a token that can post but cannot read is an act and names the permission");
  ok(f.action.route === "/api/insights" && f.action.body.action === "refresh" && f.action.body.days === 14,
     "and the action is the refresh the insights room already posts");
  ok(!byId(ST.rules(mkHouse()), "insights-permission"), "with the permission in place it says nothing");
  const bad = ST.rules(mkHouse({ storeOk: false, trouble: ["the dials: kv timeout"] }));
  ok(byId(bad, "store").level === "act", "a store that did not answer is an act, said once");
  const some = ST.rules(mkHouse({ trouble: ["the ledger: stripe 402"] }));
  ok(byId(some, "trouble").level === "watch" && /stripe 402/.test(byId(some, "trouble").say),
     "a reader that failed is named, so a missing finding is never mistaken for a quiet house");
}

console.log("\nthe readers, the gifts, the night shift, a silent network and the Reddit drafts");
{
  const up = byId(ST.rules(mkHouse()), "readers");
  ok(up.level === "good" && /140/.test(up.say) && /120/.test(up.say), "readers today and yesterday are both quoted");
  ok(/not over/.test(up.say), "and the sentence says today is not over, because it is not");
  const down = byId(ST.rules(mkHouse({ hour: 20, visitors: { store: true, today: { people: 20, views: 40 }, yesterday: { people: 120, views: 300 } } })), "readers");
  ok(down.level === "watch" && down.evidence.todayPeople === 20, "less than half of yesterday, late in the day, is a watch");
  const early = byId(ST.rules(mkHouse({ hour: 6, visitors: { store: true, today: { people: 20, views: 40 }, yesterday: { people: 120, views: 300 } } })), "readers");
  ok(early.level === "good", "the same numbers at six in the morning are not a finding: a morning is not a day");

  const g = byId(ST.rules(mkHouse()), "gifts");
  ok(g.level === "good" && /3 gifts/.test(g.say) && /45\.00 USD/.test(g.say), "gifts in thirty days: the count and what arrived");
  ok(!/floor|household/i.test(JSON.stringify(g)), "and nothing about a household");
  ok(byId(ST.rules(mkHouse({ gifts: { configured: true, ok: true, count: 0, grossMinor: 0, currency: "usd" } })), "gifts").level === "watch",
     "no gift in thirty days is a watch, said as what the record says");
  ok(!byId(ST.rules(mkHouse({ gifts: { configured: false, count: null } })), "gifts"), "and with no Stripe key there is no gift finding at all");
  /* the ledger walks Stripe one page at a time and the steward reads it under a
     deadline, so a busy month can end the walk before the last page. What was
     counted is then a floor and the finding says so rather than calling it the
     total, which would be a number the record does not have. */
  const partG = byId(ST.rules(mkHouse({ gifts: { configured: true, ok: true, partial: true, count: 400, grossMinor: 600000, currency: "usd" } })), "gifts");
  ok(partG && partG.level === "watch" && partG.evidence.partial === true && partG.evidence.count === 400,
     "a gift read that stopped short is a watch and carries partial in its evidence");
  ok(/^At least 400 gifts/.test(partG.title) && /floor, not a total/.test(partG.say),
     "and it is written as a floor, not as the month's total: " + partG.title);

  const n = byId(ST.rules(mkHouse({ night: { findings: 4, files: ["build/lights-03.json"], lastAt: "2026-09-08T04:00:00Z" } })), "night");
  ok(n.level === "watch" && /flagged 4 passages/.test(n.say) && n.action.href === "/admin2#night",
     "the night shift's findings are counted and the action opens the room that reads them, not the JSON behind it");
  ok(/nothing was corrected/i.test(n.say), "and it says nothing was corrected, because nothing was");

  const silent = byId(ST.rules(mkHouse({ channels: [
    { id: "telegram", live: true, draftOnly: false, sent: 0, failed: 2, waiting: 0, last: { date: YESTERDAY, slot: "dusk" } },
    { id: "reddit", live: false, draftOnly: true, sent: 0, failed: 0, waiting: 0, last: null } ] })), "channel-silent:telegram");
  ok(silent && silent.level === "act" && silent.evidence.failed === 2, "a network that joined and has posted nothing is an act");
  ok(silent.action.body.action === "retry-channel" && silent.action.body.where === "telegram" &&
     silent.action.body.date === YESTERDAY && silent.action.body.slot === "dusk", "and the action sends its last slot to it again");
  ok(!ST.rules(mkHouse()).some(x => /^channel-silent/.test(x.id)), "a network that is posting says nothing, and a draft-only one is never called silent");

  const red = byId(ST.rules(mkHouse({ today: [
    slot("light", 12, { state: "sent", results: { instagram: okRes("ig1"),
      reddit: { ok: true, title: "The cave", text: "x", links: ["https://www.reddit.com/r/islam/submit?..."] } } }) ] })), "reddit-drafts");
  ok(red && red.level === "watch" && red.evidence.drafts === 1 && red.action.href === "/admin2#posts",
     "a Reddit draft waiting is a watch, and the action opens the surface that lists the drafts, not the JSON behind it");
  ok(ST.rules(mkHouse()).concat(ST.rules(mkHouse({ night: { findings: 4, files: [], lastAt: "" },
      threads: { days: 55, renew: true }, today: [slot("light", 12), slot("word", 16)] })))
    .every(x => !x.action || x.action.kind !== "open" || HREF_OK.has(x.action.href)),
     "and every door the steward offers is a room of the console or a route that only reads");
}

console.log("\nthe shape of every finding");
{
  const all = [];
  for (const h of [mkHouse(), mkHouse({ mode: "off", today: [slot("light", 12), slot("word", 16, { state: "failed", results: { facebook: { ok: false, error: "no" } } })] }),
                   mkHouse({ tokens: { fb: { configured: true, daysLeft: 2, renewedAt: "2026-07-11" }, ig: { configured: true, daysLeft: null, renewedAt: "" }, lifeDays: 60 },
                             threads: { days: 55, renew: true }, night: { findings: 9, files: ["a.json"], lastAt: "" },
                             insights: { media: 4, read: 0, unread: 0, refused: 4, needs: "instagram_manage_insights", said: "no" },
                             channels: [{ id: "youtube", live: true, draftOnly: false, sent: 0, failed: 0, waiting: 0, last: null }] })])
    all.push(...ST.rules(h));
  ok(all.length > 12, "the fixtures raise " + all.length + " findings between them");
  ok(all.every(f => f.id && ["act", "watch", "good"].includes(f.level)), "every finding has an id and one of the three levels");
  ok(all.every(f => f.title.length <= 60), "no title is longer than sixty characters");
  ok(all.every(f => f.say && ST_sentences(f.say) <= 2), "every say is one or two sentences");
  ok(all.every(f => f.evidence && typeof f.evidence === "object"), "every finding carries its evidence");
  ok(all.every(f => f.action === null || (f.action.kind === "post" ? ROUTE_OK.test(f.action.route) && BODY_ACTIONS.has(f.action.body.action) : HREF_OK.has(f.action.href))),
     "every action is a route that exists, with a body its handler reads");
  ok(all.every(f => !f.action || (f.action.label && f.action.label.length <= 60)), "and every action has a label");
  const RANK = { act: 0, watch: 1, good: 2 };
  const sorted = ST.rules(mkHouse({ mode: "off", night: { findings: 3, files: [], lastAt: "" },
    today: [slot("light", 12, { state: "failed", results: { facebook: { ok: false, error: "no" } } })] })).map(f => RANK[f.level]);
  ok(sorted.every((r, i) => !i || sorted[i - 1] <= r) && sorted[0] === 0, "acts sort above watches, and watches above goods: " + sorted.join(""));
  ok(!/—|–/.test(JSON.stringify(all)), "no finding contains a dash the house does not write");
}
function ST_sentences(s) { return (String(s).match(/[.!?](\s|$)/g) || []).length; }

console.log("\nthe Lantern writes the paragraph, and may not invent one number");
{
  const found = ST.rules(mkHouse({ today: [slot("light", 12), slot("word", 16)] }));
  const good = await ST.paragraph(found, { ask: async () => ({ text: "Two of today's posts have no record at all, which is the only thing in the house asking for you. Everything else reads as it should.", model: "free/one" }) });
  ok(good.lantern === true && /Two of today's posts/.test(good.text), "a paragraph the guard accepts is used, and the answer says the Lantern wrote it");
  const invented = await ST.paragraph(found, { ask: async () => ({ text: "Reach fell to 4,812 people today and two posts are owed.", model: "free/one" }) });
  ok(invented.lantern === false && /4812|4,812/.test(invented.refused), "a number the findings do not carry throws the whole paragraph away, and the refusal names it");
  ok(invented.text === ST.template(found), "and the template is used instead");
  const dark = await ST.paragraph(found, { ask: async () => ({ text: "", error: "all models failed" }) });
  ok(dark.lantern === false && dark.refused === "all models failed" && dark.text.length > 10, "a dark Lantern costs the paragraph nothing but its authorship");
  const threw = await ST.paragraph(found, { ask: async () => { throw new Error("out of time"); } });
  ok(threw.lantern === false && /out of time/.test(threw.refused), "and an asker that throws is caught");
  const dash = await ST.paragraph(found, { ask: async () => ({ text: "Two posts are owed — the rest is quiet." }) });
  ok(dash.lantern === false && /dash/.test(dash.refused), "an em dash is refused, because the house does not write one");
  const long = await ST.paragraph(found, { ask: async () => ({ text: "One. Two. Three. Four." }) });
  ok(long.lantern === true && long.text === "One. Two. Three.", "at most three sentences survive");
  const off = await ST.paragraph(found, { lantern: false });
  ok(off.lantern === false && off.text === ST.template(found), "and the Lantern can be left out of it entirely");
  ok(/One thing needs you today/.test(ST.template(found)), "the template counts the acts: " + ST.template(found));
  ok(ST.template(ST.rules(mkHouse())).length > 0 && ST_sentences(ST.template(ST.rules(mkHouse()))) <= 3, "and it is never more than three sentences");
  ok(ST.guardParagraph("Nothing at all today.", []).ok, "a paragraph with no number in it needs no permission");
}

console.log("\nthe steward, end to end, with the store and the Lantern stubbed");
{
  store.clear();
  let slotReads = 0;
  const records = {
    [TODAY + "#light"]: { at: TODAY + "T12:00:00Z", slot: "light", state: "sent", title: "The day's card",
      results: { instagram: { ok: true, id: "ig-1" }, facebook: { ok: true, id: "fb-1" },
                 pinterest: { ok: false, trial: true, waiting: true, err: "waiting on Standard access" } } },
    [TODAY + "#word"]: { at: TODAY + "T16:00:00Z", slot: "word", state: "partial", title: "The word",
      results: { facebook: { ok: true, id: "fb-2" }, instagram: { ok: false, error: "the card URL answered 500" } } }
  };
  store.set("nsoc:ins:instagram:ig-1", JSON.stringify({ at: NOW, reach: 900, views: 2400 }));
  store.set("nv:" + TODAY + ":people", "140"); store.set("nv:" + TODAY + ":views", "420");
  store.set("nv:" + YESTERDAY + ":people", "120"); store.set("nv:" + YESTERDAY + ":views", "360");
  store.set("nsoc:log", [JSON.stringify({ at: TODAY + "T16:00:00Z", date: TODAY, slot: "word", state: "partial" })]);
  const inject = {
    now: NOW, date: TODAY, kv: fakeKv, kvReady: fakeReady,
    readSlot: async (d, s) => { slotReads++; return records[d + "#" + s] || null; },
    dials: async () => ({ mode: "auto", fb: true, ig: true, polish: true, stories: true, storeOk: true }),
    tokenClock: async () => ({ fb: { configured: true, renewedAt: "2026-08-01", daysLeft: 22 },
                               ig: { configured: true, renewedAt: "2026-07-25", daysLeft: 6 }, lifeDays: 60 }),
    threadsAge: async () => ({ days: 12, renew: false }),
    night: async () => ({ findings: 2, files: ["build/lights-01.json"], lastAt: TODAY + "T04:00:00Z" }),
    ask: async () => ({ text: "One post is half sent and the Instagram token has 6 days left.", model: "free/one" })
  };
  const a = await ST.steward(inject);
  ok(a.ok && a.cached === false && Date.parse(a.at) === Date.parse(NOW), "the first read is made, not remembered");
  ok(a.lantern === true && /half sent/.test(a.say), "the Lantern's paragraph is used when it stays inside the findings");
  ok(byId(a.findings, "slots-partial") && byId(a.findings, "token-ig").level === "act", "the real readers produce the half sent slot and the token about to die");
  ok(byId(a.findings, "slots-waiting") && byId(a.findings, "slots-waiting").evidence.refused === 1, "and Pinterest's refusal is the one waiting line");
  ok(a.counts.act >= 2 && a.counts.act + a.counts.watch + a.counts.good === a.findings.length, "the counts add up to the findings");
  const before = slotReads;
  const b = await ST.steward(inject);
  ok(b.cached === true && slotReads === before, "a second read inside ten minutes is the same answer and touches no record");
  const c = await ST.steward({ ...inject, fresh: true });
  ok(c.cached === false && slotReads > before, "fresh=1 reads the house again");
  const stale = await ST.steward({ ...inject, now: "2026-09-08T20:25:00Z" });
  ok(stale.cached === false, "and after ten minutes the cache is not offered");
  ok(store.has(ST.K_STEWARD), "the answer is kept under nsoc:steward");
  ok(JSON.parse(store.get(ST.K_STEWARD)).at, "with the time it was made");

  console.log("\nand nothing private is in it");
  const s = JSON.stringify(a);
  for (const secret of [process.env.FB_PAGE_TOKEN, process.env.IG_TOKEN, process.env.TH_TOKEN,
                        process.env.TG_BOT_TOKEN, process.env.ADMIN_SECRET, process.env.STRIPE_SECRET_KEY])
    ok(!s.includes(secret), "no token or secret reaches the steward's answer (" + secret.slice(0, 6) + "…)");
  ok(!s.includes("4321") && !/household|floor/i.test(s), "and no household figure, and no word about one");
}

console.log("\nthe flow");
{
  store.clear();
  const days = FL.daysBack(14, NOW);
  const records = {};
  for (const d of days.slice(-4)) {
    records[d + "#light"] = { at: d + "T12:00:00Z", slot: "light", state: "sent", title: "card " + d,
      results: { instagram: { ok: true, id: "ig" + d }, facebook: { ok: true, id: "fb" + d } } };
    records[d + "#reelA"] = { at: d + "T08:00:00Z", slot: "reelA", state: "sent", title: "reel " + d,
      results: { instagram: { ok: true, id: "igr" + d }, youtube: { ok: true, id: "yt" + d } } };
  }
  /* only Instagram has ever been read back */
  for (const d of days.slice(-4)) {
    store.set("nsoc:ins:instagram:ig" + d, JSON.stringify({ at: NOW, reach: 100, views: 300 }));
    store.set("nsoc:ins:instagram:igr" + d, JSON.stringify({ at: NOW, reach: 200, views: 900 }));
  }
  for (const d of days) { store.set("nv:" + d + ":people", "10"); store.set("nv:" + d + ":views", "30"); }
  store.set("nm:2026-09:s:instagram", "40"); store.set("nm:2026-09:s:facebook", "5");
  store.set("nm:2026-08:s:instagram", "12");
  const inject = { now: NOW, kv: fakeKv, kvReady: fakeReady,
    readSlot: async (d, s) => records[d + "#" + s] || null };

  const f = await FL.flow(14, inject);
  const st = id => f.stages.find(s => s.id === id);
  ok(f.ok && f.days === 14 && f.from === days[0] && f.to === days[13], "fourteen days, named from and to");
  ok(st("posts").value === 8 && st("posts").by.instagram === 8 && st("posts").by.youtube === 4 && st("posts").by.facebook === 4,
     "posts made comes from the slot records, counted by network");
  ok(st("reach").value === 1200 && st("reach").by.instagram === 1200, "reach is summed out of the insights cache");
  ok(st("reach").by.facebook === null && st("reach").by.youtube === null, "a network the cache holds nothing for is null, never zero");
  ok(st("views").value === 4800 && st("views").unread === false, "views likewise");
  ok(f.notes.some(n => /facebook, youtube/.test(n) && /unread rather than zero/.test(n)), "and a note names the unread networks");
  ok(st("clicks").attribution === "month" && st("clicks").value === 57 && st("clicks").by.instagram === 52,
     "clicks are the beacon's referrer counters, summed over the months the window touches");
  ok(f.notes.some(n => /once per person per day into a key per month/.test(n)), "with a note saying the grain is a month and not the window");
  ok(st("readers").value === 140 && st("pages").value === 420, "readers and pages read come from the beacon's own day counters");
  ok(f.notes.some(n => /returning reader is not counted/.test(n)), "a returning reader is not counted anywhere, and the answer says so");
  ok(st("gifts").value === 3 && st("given").value === 45 && st("given").unit === "USD", "gifts are Stripe's own charges: the count and what arrived");
  ok(st("duas").value === 2, "du'as are counted off the checkout sessions that carry one");
  ok(st("guardians").value === 1, "a monthly gift is not counted as a guardian");
  ok(f.stages.every(s => s.id && s.label && s.unit && s.source && typeof s.unread === "boolean"), "every stage names its source");
  ok(f.stages.every(s => s.value === null || typeof s.value === "number"), "and every value is a number or nothing");
  const e = id => f.edges.find(x => x.from + ">" + x.to === id);
  ok(e("posts>reach").rate === 150 && e("posts>reach").value === 1200, "the step from posts to reach carries the rate the two records make");
  ok(e("reach>clicks").rate === null, "the step from reach to arrivals carries no rate: the two are different grains");
  ok(e("readers>gifts").rate !== null && e("readers>pages").rate === 3, "the steps inside one grain do carry rates");
  ok(!JSON.stringify(f).includes("4321"), "and no household figure is anywhere in the funnel");

  console.log("\nthe flow with nothing in it, and the fifteen minutes it keeps");
  store.clear();
  const empty = await FL.flow(14, { now: NOW, kv: fakeKv, kvReady: fakeReady, readSlot: async () => null });
  ok(empty.stages.find(s => s.id === "posts").value === 0, "no record is nought posts, which is a fact");
  ok(empty.stages.find(s => s.id === "reach").unread === true && empty.stages.find(s => s.id === "reach").value === null,
     "but nothing read back is unread, not nought");
  ok(empty.stages.find(s => s.id === "clicks").attribution === "none" &&
     empty.notes.some(n => /No referrer counter exists/.test(n)), "and with no counter at all the attribution is none, said plainly");
  ok(empty.edges.every(x => x.rate === null || typeof x.rate === "number"), "the edges survive an empty house");

  let built = 0;
  const counted = { now: NOW, kv: fakeKv, kvReady: fakeReady, readSlot: async () => { built++; return null; } };
  const c1 = await FL.cached(14, counted);
  const at1 = built;
  const c2 = await FL.cached(14, counted);
  ok(c1.cached === false && c2.cached === true && built === at1, "a second flow inside a quarter hour is the same answer, unbuilt");
  const c3 = await FL.cached(14, { ...counted, fresh: true });
  ok(c3.cached === false && built > at1, "fresh=1 builds it again");
  const c4 = await FL.cached(7, counted);
  ok(c4.days === 7 && c4.cached === false && store.has(FL.K_FLOW(7)) && store.has(FL.K_FLOW(14)), "each window is its own key");
  const big = await FL.flow(90, { now: NOW, kv: fakeKv, kvReady: fakeReady, readSlot: async () => null });
  ok(big.days === 30, "and thirty days is the most that can be asked for");

  console.log("\nStripe answers a hundred at a time, and the walk is bounded");
  {
    /* THE BUG THIS HOLDS SHUT. du'as and guardians asked Stripe for a hundred
       rows and counted what came back, so on the day the house had a hundred
       and one the number was simply wrong and nothing said so. */
    store.clear();
    const inj = { now: NOW, kv: fakeKv, kvReady: fakeReady, readSlot: async () => null };
    STRIPE_PAGES = 3;
    stripeCalls = [];
    const three = await FL.flow(14, inj);
    const s3 = id => three.stages.find(s => s.id === id);
    ok(s3("duas").value === 6 && s3("guardians").value === 3,
       "three pages of sessions and subscriptions are all counted, not the first alone (" + s3("duas").value + " du'as, " + s3("guardians").value + " guardians)");
    ok(s3("gifts").value === 9 && s3("given").value === 135, "and the charges page the same way, through the ledger");
    ok(stripeCalls.filter(u => u.includes("/v1/subscriptions")).length === 3, "one call per page and no more");
    ok(stripeCalls.some(u => /\/v1\/subscriptions.*starting_after=sub_p1_2/.test(u)),
       "each page after the first is asked for with the last id of the one before it");
    ok(three.stages.every(s => s.unread === false || s.value === null), "a stage that read every page is not unread");

    /* more pages than the walk is allowed: the count would be short, so there
       is no count. An absence is honest; a total that is quietly missing two
       hundred rows is not. */
    STRIPE_PAGES = 9;
    stripeCalls = [];
    const cut = await FL.flow(14, inj);
    const sc = id => cut.stages.find(s => s.id === id);
    ok(stripeCalls.filter(u => u.includes("/v1/subscriptions")).length === FL.MAX_PAGES,
       "the walk stops at the page cap rather than going on for as long as Stripe has rows");
    ok(sc("duas").value === null && sc("duas").unread === true && sc("duas").partial === true,
       "a walk that stopped with more to come leaves the du'as unread, never counted short");
    ok(sc("guardians").value === null && sc("guardians").unread === true, "and the guardians standing likewise");
    ok(sc("gifts").value === null && sc("given").value === null && sc("gifts").partial === true,
       "and the gifts and what arrived, which the ledger reads under the same cap");
    ok(cut.notes.some(n => /more pages of charges than this read had/.test(n)) &&
       cut.notes.some(n => /more pages of checkout sessions/.test(n)) &&
       cut.notes.some(n => /more pages of active subscriptions/.test(n)),
       "and each one says in a sentence why it is unread");

    /* the deadline, which is the other end of the same promise: a walk that has
       spent its seconds stops even when the page cap has not been reached */
    stripeCalls = [];
    const late = await FL.guardiansNow({ deadline: Date.now() - 1 });
    ok(late.partial === true && stripeCalls.filter(u => u.includes("/v1/subscriptions")).length === 1,
       "a deadline already past buys exactly one page, and the answer is partial");
    STRIPE_PAGES = 1;
  }

  console.log("\na permission the token does not carry is a refusal, not a reading");
  {
    /* watched() guarded !v and v.error but not v.needs, so a post Instagram
       refused for want of instagram_manage_insights counted as read: the
       network went into the denominator of a reach the house never saw. */
    const posts = [{ media: { instagram: "m-refused", facebook: "m-read" } }];
    const w = await FL.watched(posts, { cacheRead: async () => ([
      { needs: "instagram_manage_insights", error: "(#10) Application does not have permission" },
      { reach: 40, views: 90 }]) });
    ok(w.unread.includes("instagram"), "the network that refused the reading is unread");
    ok(w.reach.by.instagram === null && w.views.by.instagram === null, "and its reach and views are null, never nought");
    ok(w.reach.value === 40 && w.reach.by.facebook === 40, "while the network that answered is counted as it always was");
  }
}

console.log("\nthe door");
{
  const res = () => { const r = { code: 0, body: null, headers: {} };
    r.setHeader = (k, v) => { r.headers[String(k).toLowerCase()] = v; };
    r.status = c => { r.code = c; return r; };
    r.json = o => { r.body = o; return r; };
    r.end = () => r; return r; };

  const locked = res();
  await houseRoute({ method: "GET", query: { action: "steward" }, headers: {} }, locked);
  ok(locked.code === 401 && locked.body.error === "locked", "no cookie, no house: 401 locked");
  ok(locked.headers["cache-control"] === "no-store", "and even the refusal is never cached");

  const secret = process.env.ADMIN_SECRET;
  delete process.env.ADMIN_SECRET;
  const unset = res();
  await houseRoute({ method: "GET", query: {}, headers: {} }, unset);
  ok(unset.code === 501 && /not configured/.test(unset.body.error), "with no ADMIN_SECRET at all it says so, which is a different sentence");
  process.env.ADMIN_SECRET = secret;

  const exp = Date.now() + 3600000;
  const cookie = "noor_admin=" + exp + "." + crypto.createHmac("sha256", secret).update(String(exp)).digest("hex");
  store.clear();
  const inA = res();
  await houseRoute({ method: "GET", query: { action: "steward", fresh: "1" }, headers: { cookie } }, inA);
  ok(inA.code === 200 && inA.body.ok === true && Array.isArray(inA.body.findings), "the console's own cookie opens it and gets findings");
  ok(inA.body.lantern === false && inA.body.enabled === true, "with no OpenRouter key the paragraph is the template and says lantern: false");
  ok(inA.headers["cache-control"] === "no-store" && inA.headers["content-type"].includes("application/json"), "no-store, and JSON");

  const inB = res();
  await houseRoute({ method: "GET", query: { action: "flow", days: "9" }, headers: { cookie } }, inB);
  ok(inB.code === 200 && inB.body.ok === true && inB.body.days === 9 && inB.body.stages.length > 6, "and the flow answers on the same route");

  const bad = res();
  await houseRoute({ method: "GET", query: { action: "nonsense" }, headers: { cookie } }, bad);
  ok(bad.code === 400 && /unknown action/.test(bad.body.error), "an action it does not know is an error, never a run of something else");

  const wrong = res();
  await houseRoute({ method: "DELETE", query: {}, headers: { cookie } }, wrong);
  ok(wrong.code === 405, "and only GET and POST are answered");

  const key = res();
  await houseRoute({ method: "POST", query: {}, body: { action: "steward", fresh: true },
                     headers: { "x-admin-key": secret } }, key);
  ok(key.code === 200 && key.body.ok === true, "a hand-run request carrying the secret in a header is let in too");
  const whole = JSON.stringify(inA.body) + JSON.stringify(inB.body) + JSON.stringify(key.body);
  for (const s of [process.env.FB_PAGE_TOKEN, process.env.IG_TOKEN, process.env.TH_TOKEN, process.env.TG_BOT_TOKEN,
                   process.env.STRIPE_SECRET_KEY, secret, "4321"])
    ok(!whole.includes(s), "the route's answers carry nothing private (" + s.slice(0, 6) + "…)");
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
