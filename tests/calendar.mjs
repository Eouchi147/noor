/* The failure modes. Fully automatic means nobody is watching, so the
   guarantees have to live here rather than in a person's judgement. */
import { stubFetch } from "./_stub-hijri.mjs";
import * as H from "../api/_hijri.js";
import * as C from "../api/_calendar.js";
import * as S from "../api/_schedule.js";
import * as CH from "../api/_channels.js";
import fs from "fs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  PASS " + m); } else { fail++; console.log("  FAIL " + m); } };
const idx = JSON.parse(fs.readFileSync("assets/menu-index.json", "utf8"));

console.log("\n=== 1. an unreachable calendar says nothing rather than guessing ===");
{
  const dead = async () => { throw new Error("network is down"); };
  const h = await H.verifiedHijri("2026-08-31", { fetch: dead, noCache: true });
  ok(h === null, "a dead API returns null, not a date");
  const plan = await S.planDay("2026-08-31", { fetch: dead, noCache: true });
  ok(plan.verified === false, "the plan knows it is unverified");
  ok(!plan.slots.includes("dawn"), "the dated slot is dropped");
  ok(!plan.slots.includes("lead"), "the countdown is dropped");
  ok(plan.slots.includes("word") && plan.slots.includes("dusk"),
     "but the undated slots still run — the site keeps talking");
}

console.log("\n=== 2. a malformed answer is refused, not parsed hopefully ===");
{
  for (const [name, body] of [
    ["empty",        {}],
    ["no hijri",     { data: {} }],
    ["month 13",     { data: { hijri: { day: "5", month: { number: 13 }, year: "1448" } } }],
    ["day 44",       { data: { hijri: { day: "44", month: { number: 3 }, year: "1448" } } }],
    ["year 999",     { data: { hijri: { day: "5", month: { number: 3 }, year: "999" } } }],
    ["day missing",  { data: { hijri: { month: { number: 3 }, year: "1448" } } }]
  ]) {
    const f = async () => ({ ok: true, status: 200, json: async () => body });
    const h = await H.verifiedHijri("2026-08-31", { fetch: f, noCache: true });
    ok(h === null, name + " is refused");
  }
}

console.log("\n=== 3. the tabular arithmetic is nowhere near this file ===");
{
  /* the comment in _hijri.js names hijriOf to explain why it is banned, so the
     check has to be for a real import or call, not for the word appearing */
  const code = f => f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const f of ["api/_hijri.js", "api/_schedule.js", "api/_calendar.js"]) {
    const src = code(fs.readFileSync(f, "utf8"));
    ok(!/hijriOf/.test(src), f + " never calls the tabular arithmetic");
    ok(!/_lights\.js/.test(src) || f === "api/_schedule.js", f + " does not reach for it");
  }
}

console.log("\n=== 4. nobody is told to fast on a day fasting is forbidden ===");
{
  const f = stubFetch();
  /* the White Days reminder must not fire in Dhul Hijjah: the 13th is Tashriq */
  const wd = C.RECURRING.find(r => r.key === "whitedays");
  for (const d of [13, 14, 15]) {
    ok(wd.when("2027-05-01", { d, m: 12 }) === false, `White Days suppressed on ${d} Dhul Hijjah`);
    ok(wd.when("2027-01-01", { d, m: 7 }) === true, `White Days still run on ${d} Rajab`);
  }
  /* and the two Eids say plainly not to fast */
  for (const k of ["10-1", "12-10", "12-11"]) {
    const e = C.FIXED[k];
    ok(/do not fast/i.test(e.todo.join(" ")), `${e.name} says do not fast`);
  }
}

console.log("\n=== 5. every citation resolves to a real, checkable place ===");
{
  const all = [...Object.values(C.FIXED), ...C.RECURRING];
  let n = 0, bad = 0;
  for (const o of all) {
    if (!o.url) continue;
    n++;
    if (!/^https:\/\/sunnah\.com\/[a-z]+:[0-9]+[a-z]?$/.test(o.url)) { bad++; console.log("    odd url: " + o.url); }
  }
  ok(bad === 0, n + " citation links are well-formed sunnah.com references");
  /* anything the research could not verify must carry no number at all */
  const byKey = k => Object.values(C.FIXED).find(o => o.key === k);
  for (const k of ["rajab27", "sha3ban15", "mawlid"]) {
    const o = byKey(k); if (!o) continue;
    ok(o.status === "disputed", o.name + " is marked disputed");
    ok(/differ|disputed|no basis|not established|weak|fabricated/i.test(
        [o.basis, o.note, (o.todo||[]).join(" ")].join(" ")),
       o.name + " says in words that scholars differ");
  }
  ok(!byKey("rajab27").url, "27 Rajab carries no citation, because none exists");
  ok(/not established/i.test(byKey("rajab27").basis), "and says so plainly");
}

console.log("\n=== 6. the Lantern may not touch any of it ===");
{
  const CITED = new Set(["quran", "sunnah", "debated"]);
  const all = [...Object.values(C.FIXED), ...C.RECURRING];
  const loose = all.filter(o => !CITED.has(o.lvl));
  ok(loose.length === 0, "every observance is at a level the polish guard refuses"
     + (loose.length ? " — loose: " + loose.map(o => o.key).join(",") : ""));
}

console.log("\n=== 7. a cron that was down does not empty a backlog into the feed ===");
{
  const plan = ["dawn", "lead", "light", "word", "dusk"];
  const late = S.dueNow(plan, new Date("2026-08-31T23:00:00Z"), []);
  ok(late.length === 1, "nine hours down still sends one post, not five");
  ok(late[0].id === "dusk", "and it is the most recent one, not the stalest");
  const none = S.dueNow(plan, new Date("2026-08-31T03:00:00Z"), []);
  ok(none.length === 0, "before the first slot, nothing is due");
  const sentAll = S.dueNow(plan, new Date("2026-08-31T23:00:00Z"), plan);
  ok(sentAll.length === 0, "nothing already sent is sent twice");
}

console.log("\n=== 8. each network gets its own shape, inside its own limits ===");
{
  const f = stubFetch();
  const date = "2027-05-15";
  const plan = await S.planDay(date, { fetch: f, noCache: true });
  const ctx = { date, hijri: plan.hijri, day: plan.day, leads: plan.leads,
    words: idx.words, path: idx.path,
    link: "https://noorcodex.com/?light=" + date,
    image: "https://noorcodex.com/api/card?date=" + date + "&fmt=png" };
  const p = S.buildSlot("dawn", ctx);
  ok(p && /Arafah/.test(p.title), "15 May 2027 is read as the Day of Arafah");
  for (const ch of CH.ALL) {
    const s = CH.shape(p, ch);
    const len = (s.text || "").length;
    ok(len > 0 && len <= CH.SPEC[ch].chars, `${ch} fits (${len}/${CH.SPEC[ch].chars})`);
  }
  ok(!/#/.test(CH.shape(p, "reddit").text), "reddit carries no hashtags");
  ok(CH.shape(p, "x").text.length <= 280, "x fits in 280");
  ok(!!CH.shape(p, "pinterest").image, "pinterest has an image");
}

console.log("\n=== 9. reddit never posts by itself ===");
{
  ok(CH.configured.reddit() === false, "reddit never reports as configured");
  ok(CH.draftOnly.has("reddit"), "reddit is marked draft-only");
  const r = await CH.sendReddit({ title: "t", text: "b" });
  ok(r.ok === false && r.draft === true, "its sender returns a draft, never a send");
  ok(/spam|shadowban/i.test(r.why), "and says why, so it is not mistaken for a bug");
}

console.log("\n=== 10. a partial outage costs one day, not the calendar ===");
{
  /* the API answers for today but fails for the days ahead */
  const flaky = stubFetch(dd => dd !== "31-08-2026");
  const plan = await S.planDay("2026-08-31", { fetch: flaky, noCache: true });
  ok(plan.verified === true, "today still verifies");
  ok(plan.leads.length === 0, "no countdown is invented from unverifiable days ahead");
  ok(plan.slots.includes("dawn"), "and today's dated post still runs");
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
