/* NOOR · the steward
   ===========================================================================
   The owner asked for one place to see the empire at a glance and understand
   it. This is that read: the whole house in one call, answered as FINDINGS.

   A finding is a plain object and nothing else:

     { id, level: "act" | "watch" | "good",
       title,      at most sixty characters
       say,        one or two sentences, facts only, every number from the record
       action,     null, or a real call the console already makes
       evidence }  the numbers the sentence stands on

   TWO RULES, AND THEY ARE THE WHOLE FILE.

   1. THE FINDINGS ARE DETERMINISTIC. Every one of them comes from a record:
      a slot record, the token clock, the insights cache, the visitor
      counters, the ledger's charges, the night shift's list. The Lantern is
      never asked what is wrong and it is never asked what to do. It cannot
      invent a finding, because it is handed the findings after they are made
      and its answer is one paragraph of prose that is thrown away if it
      carries a number the findings do not.

   2. AN ACTION IS AN ENDPOINT THAT ALREADY EXISTS. Every action here is a
      call the console makes today, with the body shape its handler actually
      reads: send-slot and retry-channel and finish-reels and mode and
      renewed on api/social.js, refresh on api/insights.js. A button that
      posts a body no handler understands is worse than no button, because it
      fails silently in front of someone who believed it worked. An action of
      kind "open" is a door a person walks through, so it points at a room of
      the console or at a route that only reads. It never points at a route
      that changes something merely by being opened: a GET that rotates a token
      is not a link, and no finding here will ever carry one.

   WHY A WAITING NETWORK IS ONE LINE. Pinterest is on Trial access, so every
   pin it is offered comes back refused. slotState already knows that is a
   stage and not a fault. Before this rule the room showed one refusal per
   slot per day, nine or ten identical rows nobody could act on, and the real
   faults sat underneath them. A network that is waiting gets exactly one
   line, and it says how many posts were not offered to it.

   WHAT IS READ, AND WHAT IT COSTS. Seven days of slot records, the dials, the
   token clock, the Threads token age, the insights cache for the media those
   records name, two days of visitor counters, thirty days of Stripe charges
   under a page cap and a deadline of their own, the night shift's findings,
   and the tail of nsoc:log. Every reader is injected, so the tests run with no
   network and no store at all.
--------------------------------------------------------------------------- */

import { kv, kvReady } from "./_kv.js";
import { SLOTS } from "./_schedule.js";
import * as CH from "./_channels.js";
import * as TH from "./_threads.js";
import { readSlot as readSlotLive, slotState, tokenClock as tokenClockLive, dials as dialsLive } from "./social.js";
import { K_INS, cacheRead } from "./_insights.js";
import { findings as nightFindingsLive, lastShift } from "./_nightshift.js";
import { computeLedger } from "./ledger.js";
import { askOpenRouter } from "./_models.js";
import { sentences } from "./_prose.js";

export const K_STEWARD = "nsoc:steward";
export const CACHE_MS = 10 * 60 * 1000;      /* the answer is good for ten minutes */
export const WINDOW_DAYS = 7;                /* how far back the slot records are read */
export const GIFT_DAYS = 30;
/* The ledger walks Stripe's charges one sequential page at a time and its own
   ceiling is twenty-five of them. The steward is read inside the Lantern's
   sixteen seconds, so it cannot afford twenty-five: it asks for a few pages
   and a few seconds, and a read that stops at either says so rather than
   spending the whole minute or handing back a count that is quietly short. */
export const GIFT_PAGES = 4;
export const GIFT_MS = 6000;
export const TOKEN_ACT_DAYS = 7;             /* a Meta token this close to death needs a person today */
export const TOKEN_WATCH_DAYS = 14;
export const MAX_TITLE = 60;

/* The eight slots that are planned every day whatever the calendar says. The
   other two (dawn, and the lead that only exists when something is coming up)
   depend on a verified Hijri date, and calling them owed on a day the calendar
   could not be verified would be a fault the house did not have. A caller who
   has a real plan hands it in. */
const CERTAIN_SLOTS = SLOTS.filter(s => !s.needsDate && !s.conditional).map(s => s.id);
const hourOf = id => (SLOTS.find(s => s.id === id) || {}).at;
const prevDate = d => new Date(Date.parse(d + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
const NET_NAME = { facebook: "Facebook", instagram: "Instagram", youtube: "YouTube", telegram: "Telegram",
  threads: "Threads", pinterest: "Pinterest", linkedin: "LinkedIn", x: "X", reddit: "Reddit" };
const netName = c => NET_NAME[c] || String(c || "");
const t60 = s => { const x = String(s || "").trim(); return x.length <= MAX_TITLE ? x : x.slice(0, MAX_TITLE - 1).replace(/\s+\S*$/, "") + "…"; };
const n0 = n => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
const money = (minor, cur) => (Math.round(Number(minor || 0)) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + String(cur || "").toUpperCase();
const list = xs => xs.length <= 1 ? (xs[0] || "") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1];

/* ---------------------------------------------------------------------------
   READING THE HOUSE

   Every reader is optional and every one of them is wrapped: a store that will
   not answer costs the steward that one paragraph, never the whole read. What
   could not be read is named in `trouble`, because a finding missing because a
   reader failed and a finding missing because nothing is wrong must never look
   the same.
--------------------------------------------------------------------------- */
export async function gather(opts = {}) {
  const now = opts.now ? new Date(opts.now) : new Date();
  const date = opts.date || now.toISOString().slice(0, 10);
  const hour = now.getUTCHours();
  const readSlot = opts.readSlot || readSlotLive;
  const trouble = [];
  const tryTo = async (what, fn, fallback) => {
    try { return await fn(); }
    catch (e) { trouble.push(what + ": " + String((e && e.message) || e).slice(0, 90)); return fallback; }
  };

  const D = await tryTo("the dials", () => (opts.dials ? opts.dials() : dialsLive()),
    { mode: "off", fb: true, ig: true, polish: true, stories: true, storeOk: false });

  /* the window of slot records, a day at a time so the store is never handed
     seventy reads at once */
  const days = [];
  for (let i = 0; i < (opts.windowDays || WINDOW_DAYS); i++) days.push(new Date(Date.parse(date + "T00:00:00Z") - i * 86400000).toISOString().slice(0, 10));
  const planned = Array.isArray(opts.plan) && opts.plan.length ? opts.plan.slice() : CERTAIN_SLOTS.slice();
  const window = [];
  for (const d of days) {
    const got = await Promise.all(planned.map(id => Promise.resolve(readSlot(d, id)).catch(() => null)));
    got.forEach((rec, i) => { if (rec) window.push({ date: d, slot: planned[i], rec }); });
  }

  /* A network that is waiting on its review refuses in more than one voice:
     the Trial answer carries `waiting`, but a pin cut by the clock or set aside
     for drift on the same network does not, and the first live morning read
     "3 of today's posts are half sent" with "Send it to Pinterest again" under
     it, an action that could only meet the same review. So once a network is
     seen waiting anywhere in the window, every failure on that network is read
     as waiting too, before the slot's state is judged. */
  const waitingNets = new Set();
  for (const w of window) for (const [c, r] of Object.entries((w.rec && w.rec.results) || {})) if (r && (r.waiting || r.trial)) waitingNets.add(c);
  for (const w of window) {
    const rs = w.rec && w.rec.results;
    if (!rs) continue;
    for (const c of waitingNets) {
      const r = rs[c];
      if (r && !r.ok && !r.pending && !r.skipped && !r.waiting && !r.trial) w.rec = { ...w.rec, results: { ...rs, [c]: { ...r, waiting: true, settled: true } } };
    }
  }

  /* today, slot by slot: what has a record, what has none and whose hour has
     gone. The state is read back through slotState so this file and the poster
     can never disagree about what half sent means. */
  const today = planned.map(id => {
    const found = window.find(w => w.date === date && w.slot === id);
    const rec = found ? found.rec : null;
    const state = rec ? (rec.results ? slotState(rec.results) : rec.state || null) : null;
    return { id, at: hourOf(id), state, title: (rec && rec.title) || "", sentAt: (rec && rec.at) || null,
             results: (rec && rec.results) || null, passed: hourOf(id) != null && hour >= hourOf(id) };
  });

  /* the channels, and what the window says each one actually did */
  const channels = CH.ALL.map(c => {
    let sent = 0, failed = 0, waiting = 0, last = null;
    for (const w of window) {
      const r = w.rec && w.rec.results && w.rec.results[c];
      if (!r) continue;
      if (r.waiting || r.trial) { waiting++; continue; }
      if (r.ok) { sent++; if (!last || w.date > last.date) last = { date: w.date, slot: w.slot }; continue; }
      if (r.skipped) continue;
      failed++;
      if (!last || w.date > last.date) last = { date: w.date, slot: w.slot };
    }
    return { id: c, live: !!(CH.configured[c] && CH.configured[c]()), draftOnly: CH.draftOnly.has(c),
             sent, failed, waiting, last };
  });

  const tokens = await tryTo("the token clock", () => (opts.tokenClock ? opts.tokenClock() : tokenClockLive()),
    { fb: { configured: false, daysLeft: null }, ig: { configured: false, daysLeft: null }, lifeDays: 60 });
  const threads = await tryTo("the Threads token age", () => (opts.threadsAge ? opts.threadsAge() : TH.tokenAge()), { days: null });

  /* the insights cache, for exactly the media the window's records name. No
     network call: what has not been read yet is unread, and says so. */
  const insights = await tryTo("the insights cache", async () => {
    const media = [];
    for (const w of window) {
      const rs = (w.rec && w.rec.results) || {};
      for (const net of ["instagram", "facebook", "youtube"]) {
        const r = rs[net];
        /* a card sent as a story only carries the story's id, which no
           post edge answers for: not media to read (see _insights collect) */
        if (r && r.ok && r.id && !r.storyOnly) media.push({ net, id: String(r.id), key: K_INS(net, String(r.id)) });
      }
    }
    const got = media.length ? await (opts.cacheRead || cacheRead)(media.map(m => m.key), opts) : [];
    let read = 0, unread = 0, refused = 0, needs = "", said = "";
    got.forEach((v, i) => {
      if (!v) { unread++; return; }
      if (v.error || v.needs) {
        refused++;
        if (media[i].net === "instagram" && !needs) {
          if (v.needs) { needs = v.needs; said = String(v.error || ""); }
          else if (v.code === 10 || v.code === 200 || /permission|manage_insights/i.test(String(v.error || ""))) {
            needs = "instagram_manage_insights"; said = String(v.error || "");
          }
        }
        return;
      }
      read++;
    });
    if (media.length && !got.length) unread = media.length;
    return { media: media.length, read, unread, refused, needs, said };
  }, { media: 0, read: 0, unread: 0, refused: 0, needs: "", said: "" });

  /* the readers on the site: today so far against the whole of yesterday */
  const visitors = await tryTo("the visitor counters", async () => {
    if (opts.visitors) return await opts.visitors(date);
    const ready = opts.kvReady || kvReady;
    if (!ready()) return { store: false, today: null, yesterday: null };
    const store = opts.kv || kv;
    const y = prevDate(date);
    const r = await store([["MGET", "nv:" + date + ":people", "nv:" + date + ":views",
                            "nv:" + y + ":people", "nv:" + y + ":views"]]);
    const v = (r && r[0]) || [];
    const num = x => { const n = parseInt(x, 10); return Number.isFinite(n) ? n : null; };
    return { store: true, date, yesterdayDate: y,
             today: { people: num(v[0]) || 0, views: num(v[1]) || 0 },
             yesterday: { people: num(v[2]) || 0, views: num(v[3]) || 0 } };
  }, { store: false, today: null, yesterday: null });

  const gifts = await tryTo("the ledger", async () => {
    if (opts.gifts) return await opts.gifts(GIFT_DAYS);
    if (!process.env.STRIPE_SECRET_KEY) return { configured: false, count: null, grossMinor: null, currency: "" };
    const from = Math.floor((now.getTime() - GIFT_DAYS * 86400000) / 1000);
    const led = await computeLedger({ from,
      maxPages: opts.giftPages || GIFT_PAGES,
      deadline: Date.now() + (opts.giftMs || GIFT_MS) });
    /* the count and what arrived, and nothing else off this object: the
       household floor is private and never leaves the ledger */
    return { configured: true, ok: !!led.ok, partial: !!led.partial,
             count: (led.totals && led.totals.count) || 0,
             grossMinor: (led.totals && led.totals.gross) || 0, currency: led.currency || "" };
  }, { configured: false, count: null, grossMinor: null, currency: "" });

  const night = await tryTo("the night shift", async () => {
    if (opts.night) return await opts.night();
    const f = await nightFindingsLive(60);
    const last = await lastShift();
    return { findings: f.length, files: [...new Set(f.map(x => String((x && x.file) || "")).filter(Boolean))].slice(0, 3),
             lastAt: (last && last.at) || "" };
  }, { findings: 0, files: [], lastAt: "" });

  const log = await tryTo("the run log", async () => {
    if (opts.log) return await opts.log();
    const ready = opts.kvReady || kvReady;
    if (!ready()) return { lines: 0, lastAt: "" };
    const store = opts.kv || kv;
    const r = await store([["LRANGE", "nsoc:log", "0", "8"]]);
    const rows = ((r && r[0]) || []).map(x => { try { return typeof x === "string" ? JSON.parse(x) : x; } catch { return null; } }).filter(Boolean);
    return { lines: rows.length, lastAt: (rows[0] && rows[0].at) || "" };
  }, { lines: 0, lastAt: "" });

  return { at: now.toISOString(), date, hour, mode: D.mode, dials: D, storeOk: !!D.storeOk,
           planned, today, window: window.length, windowDays: days.length, days,
           channels, tokens, threads, insights, visitors, gifts, night, log, trouble };
}

/* ---------------------------------------------------------------------------
   THE RULES

   Deterministic, synchronous, and pure: the same house always makes the same
   findings, which is what lets a test hand it a fixture and read the answer.
--------------------------------------------------------------------------- */
const post = (label, route, body) => ({ label, kind: "post", body, route });
const open = (label, href) => ({ label, kind: "open", href });

export function rules(h) {
  const out = [];
  const date = h.date;
  const socialToday = "/api/social?date=" + date;

  /* --- the ladder ------------------------------------------------------ */
  if (h.mode === "off") {
    out.push({ id: "mode", level: "watch", title: t60("The schedule is off"),
      say: "Nothing goes out on a schedule: the ladder is on \"off\", which is the shipped state. Posting by hand from this room still works.",
      action: post("Move it up to approve", "/api/social", { action: "mode", mode: "approve" }),
      evidence: { mode: h.mode } });
  } else if (h.mode === "approve") {
    out.push({ id: "mode", level: "good", title: t60("The schedule drafts and waits for you"),
      say: "The ladder is on \"approve\": every slot is written and left for you, and nothing reaches a network until you press Post.",
      action: null, evidence: { mode: h.mode } });
  } else {
    out.push({ id: "mode", level: "good", title: t60("The schedule is running"),
      say: "The ladder is on \"auto\", so the hourly run sends what the day owes without anybody in the loop.",
      action: null, evidence: { mode: h.mode } });
  }

  /* --- today's slots --------------------------------------------------- */
  const owed = h.today.filter(s => s.passed && !s.state);
  const failed = h.today.filter(s => s.state === "failed");
  const partial = h.today.filter(s => s.state === "partial");
  const pending = h.today.filter(s => s.state === "pending");
  const sent = h.today.filter(s => s.state === "sent");

  if (owed.length) {
    const oldest = owed[0];
    const hours = owed.map(s => String(s.at).padStart(2, "0") + ":00");
    /* On auto, a slot whose hour has gone with no record at all is not a
       decision anybody made, and it is worth waking somebody for. WHY IT HAS
       NO RECORD IS NOT SAID HERE. The house can see three things -- the hour
       passed, nothing was written, and when the log was last written -- and
       none of them can tell a run that never fired from a run that was cut off
       at sixty seconds from a store that lost the write. Naming one of those
       as the cause would be a finding standing on evidence that does not exist,
       so the sentence stops at what is recorded. */
    const auto = h.mode === "auto";
    out.push({ id: auto ? "slots-unrecorded" : "slots-owed", level: auto ? "act" : "watch",
      title: t60(auto ? owed.length + " of today's posts have no record"
                      : owed.length + " of today's posts are still owed"),
      say: auto
        ? "The " + list(hours) + " " + (owed.length === 1 ? "slot has" : "slots have") + " no record at all, " + (owed.length === 1 ? "its hour has" : "their hours have") + " passed, and the ladder is on \"auto\". The last line in the log was written " + (h.log.lastAt || "never") + "."
        : "The " + list(hours) + " " + (owed.length === 1 ? "slot has" : "slots have") + " no record and " + (owed.length === 1 ? "its hour has" : "their hours have") + " passed. The ladder is on \"" + h.mode + "\", so nothing was going to send " + (owed.length === 1 ? "it" : "them") + " by itself.",
      action: post("Send the " + String(oldest.at).padStart(2, "0") + ":00 slot now", socialToday, { action: "send-slot", slot: oldest.id }),
      evidence: { owed: owed.length, slots: owed.map(s => s.id), hours, mode: h.mode, lastLogAt: h.log.lastAt || "" } });
  }

  if (failed.length) {
    const s = failed[0];
    const where = firstBrokenChannel(s.results);
    out.push({ id: "slots-failed", level: "act",
      title: t60(failed.length + " of today's posts reached no network"),
      say: "The " + list(failed.map(x => String(x.at).padStart(2, "0") + ":00")) + " " + (failed.length === 1 ? "slot was" : "slots were") + " refused by every live network. " + (where ? netName(where) + " said: " + saidBy(s.results[where]) : "No network recorded a reason."),
      action: where ? post("Send it to " + netName(where) + " again", "/api/social", { action: "retry-channel", date, slot: s.id, where }) : null,
      evidence: { failed: failed.length, slots: failed.map(x => x.id), where: where || "", said: where ? saidBy(s.results[where]) : "" } });
  }

  if (partial.length) {
    const s = partial[0];
    const where = firstBrokenChannel(s.results);
    out.push({ id: "slots-partial", level: "act",
      title: t60(partial.length + " of today's posts are half sent"),
      say: "The " + list(partial.map(x => String(x.at).padStart(2, "0") + ":00")) + " " + (partial.length === 1 ? "slot landed" : "slots landed") + " on one network and was refused by another, so it is not sent. " + (where ? netName(where) + " said: " + saidBy(s.results[where]) : ""),
      action: where ? post("Send it to " + netName(where) + " again", "/api/social", { action: "retry-channel", date, slot: s.id, where }) : null,
      evidence: { partial: partial.length, slots: partial.map(x => x.id), where: where || "", said: where ? saidBy(s.results[where]) : "" } });
  }

  if (pending.length) {
    out.push({ id: "slots-pending", level: "watch",
      title: t60(pending.length + " " + (pending.length === 1 ? "post is" : "posts are") + " still transcoding"),
      say: "A network took the video for the " + list(pending.map(x => String(x.at).padStart(2, "0") + ":00")) + " " + (pending.length === 1 ? "slot" : "slots") + " and has not finished with it. Nothing failed: the next hourly run publishes it, or you can finish it now.",
      action: post("Finish them now", socialToday, { action: "finish-reels" }),
      evidence: { pending: pending.length, slots: pending.map(x => x.id) } });
  }

  /* ONE LINE FOR A NETWORK THAT IS WAITING, whatever the day's tally is. */
  const waiting = h.channels.filter(c => c.waiting > 0);
  if (waiting.length) {
    const total = waiting.reduce((t, c) => t + c.waiting, 0);
    out.push({ id: "slots-waiting", level: "watch",
      title: t60(list(waiting.map(c => netName(c.id))) + " is waiting on its review"),
      say: list(waiting.map(c => netName(c.id))) + " refused " + n0(total) + " " + (total === 1 ? "post" : "posts") + " in " + h.windowDays + " days because the account is not open yet. That is a stage and not a fault: nothing is retried and posting resumes by itself when access is granted.",
      action: null,
      evidence: { networks: waiting.map(c => c.id), refused: total, days: h.windowDays } });
  }

  if (!owed.length && !failed.length && !partial.length && sent.length) {
    out.push({ id: "slots-sent", level: "good",
      title: t60("Every post owed today has gone"),
      say: n0(sent.length) + " of today's " + n0(h.today.length) + " slots are recorded sent and none is owed, failed or half sent.",
      action: null, evidence: { sent: sent.length, planned: h.today.length } });
  }

  /* --- the tokens ------------------------------------------------------ */
  for (const which of ["ig", "fb"]) {
    const t = h.tokens && h.tokens[which];
    if (!t || !t.configured) continue;
    const name = which === "ig" ? "Instagram" : "Facebook";
    if (t.daysLeft == null) {
      out.push({ id: "token-" + which, level: "watch",
        title: t60("The " + name + " token has never been marked renewed"),
        say: "A Meta token lives " + n0((h.tokens && h.tokens.lifeDays) || 60) + " days and dies silently. Nothing here knows how old this one is, so the countdown cannot warn you.",
        action: post("I have just renewed it", "/api/social", { action: "renewed", which }),
        evidence: { network: name, daysLeft: null, lifeDays: (h.tokens && h.tokens.lifeDays) || 60 } });
    } else if (t.daysLeft <= TOKEN_WATCH_DAYS) {
      out.push({ id: "token-" + which, level: t.daysLeft <= TOKEN_ACT_DAYS ? "act" : "watch",
        title: t60("The " + name + " token has " + n0(t.daysLeft) + " days left"),
        say: "It was marked renewed on " + (t.renewedAt || "an unknown day") + " and a Meta token lives " + n0((h.tokens && h.tokens.lifeDays) || 60) + " days. When it dies every post to " + name + " fails with no warning.",
        action: post("I have just renewed it", "/api/social", { action: "renewed", which }),
        evidence: { network: name, daysLeft: t.daysLeft, renewedAt: t.renewedAt || "", lifeDays: (h.tokens && h.tokens.lifeDays) || 60 } });
    }
  }
  if (h.threads && h.threads.days != null && h.threads.renew) {
    out.push({ id: "token-threads", level: "act",
      title: t60("The Threads token is " + n0(h.threads.days) + " days old"),
      /* THE ACTION IS READ-ONLY, AND DELIBERATELY. ?action=renew is a GET that
         rotates the token the moment it is opened, so a button carrying it
         would rotate the house's Threads token on a mis-tap, on a prefetch, or
         on a link checker following it. The button opens the status door, which
         only reads; the renewal is a sentence the owner performs himself, once
         he means to, which is also the house's rule about secrets. */
      say: "A Threads token lives " + n0(TH.TOKEN_LIFE_DAYS) + " days and this one has been in place " + n0(h.threads.days) + ". When you are ready, open /api/threads?action=renew in this browser: it shows a fresh token once, and an expired token cannot be renewed at all.",
      action: open("See the Threads connection", "/api/threads?action=status"),
      evidence: { days: h.threads.days, since: h.threads.since || "", lifeDays: TH.TOKEN_LIFE_DAYS } });
  }

  /* --- what strangers watched ------------------------------------------ */
  if (h.insights && h.insights.needs) {
    out.push({ id: "insights-permission", level: "act",
      title: t60("The Instagram token cannot read what a post did"),
      say: "Instagram refused the reading with " + h.insights.needs + " missing, so " + n0(h.insights.media) + " " + (h.insights.media === 1 ? "post has" : "posts have") + " no numbers against them. Generate a token carrying that permission, paste it into Vercel as IG_TOKEN, redeploy, and read again.",
      action: post("Read what strangers watched again", "/api/insights", { action: "refresh", days: 14 }),
      evidence: { needs: h.insights.needs, media: h.insights.media, said: h.insights.said || "" } });
  }

  /* --- the readers ----------------------------------------------------- */
  if (h.visitors && h.visitors.today && h.visitors.yesterday) {
    const t = h.visitors.today.people, y = h.visitors.yesterday.people;
    /* Today is not over. A morning is only compared with a whole day once
       enough of the day has passed for the comparison to mean anything. */
    const lateEnough = h.hour >= 18;
    const down = lateEnough && y >= 10 && t < y / 2;
    out.push({ id: "readers", level: down ? "watch" : "good",
      title: t60(down ? "Readers are down on yesterday" : "Readers today: " + n0(t)),
      say: n0(t) + " " + (t === 1 ? "reader has" : "readers have") + " been on the site so far today and " + n0(y) + " were counted yesterday" +
           (down ? ", which is less than half a day's worth with the day nearly gone." : ". Today is not over, so the two are not a like for like comparison."),
      action: null,
      evidence: { todayPeople: t, todayViews: h.visitors.today.views, yesterdayPeople: y, yesterdayViews: h.visitors.yesterday.views, hourUTC: h.hour } });
  }

  /* --- the gifts ------------------------------------------------------- */
  if (h.gifts && h.gifts.configured && h.gifts.count != null) {
    const c = h.gifts.count;
    /* A read that stopped at its page cap or its deadline has counted some of
       the charges and not all of them, so the count is a floor and is written
       as one. Calling it the month's total would be a number the record does
       not have, and the ledger is where the whole of it is read. */
    const part = !!h.gifts.partial;
    out.push({ id: "gifts", level: part ? "watch" : (c > 0 ? "good" : "watch"),
      title: t60(part ? "At least " + n0(c) + " " + (c === 1 ? "gift" : "gifts") + " in " + GIFT_DAYS + " days"
                      : (c > 0 ? n0(c) + " " + (c === 1 ? "gift" : "gifts") + " in " + GIFT_DAYS + " days" : "No gift in " + GIFT_DAYS + " days")),
      say: part
        ? n0(c) + " " + (c === 1 ? "gift" : "gifts") + " and " + money(h.gifts.grossMinor, h.gifts.currency) + " were counted before this read reached the end of the time it is given for Stripe. The whole of the " + GIFT_DAYS + " days is read in the ledger; the count here is a floor, not a total."
        : (c > 0
          ? n0(c) + " " + (c === 1 ? "gift" : "gifts") + " arrived in the last " + GIFT_DAYS + " days, " + money(h.gifts.grossMinor, h.gifts.currency) + " in all, counted from Stripe's own charges."
          : "Stripe records no charge at all in the last " + GIFT_DAYS + " days. Nothing is broken by that; it is what the record says."),
      action: null,
      evidence: { count: c, grossMinor: h.gifts.grossMinor, currency: h.gifts.currency, days: GIFT_DAYS, partial: part } });
  }

  /* --- the night shift -------------------------------------------------- */
  if (h.night && h.night.findings > 0) {
    out.push({ id: "night", level: "watch",
      title: t60(n0(h.night.findings) + " " + (h.night.findings === 1 ? "passage" : "passages") + " the Lantern flagged"),
      say: "The night shift flagged " + n0(h.night.findings) + " " + (h.night.findings === 1 ? "passage" : "passages") + " for a second reading" +
           (h.night.files && h.night.files.length ? ", in " + list(h.night.files) : "") +
           ". Nothing on the site was changed and nothing was corrected for you.",
      /* the room, not the JSON behind it: /api/admin-data?probe=night answers a
         machine, and an owner who taps a finding should land where he can read
         what was flagged and clear it */
      action: open("Read the night's findings", "/admin2#night"),
      evidence: { findings: h.night.findings, files: h.night.files || [], lastAt: h.night.lastAt || "" } });
  }

  /* --- a network that joined and has never posted ------------------------ */
  for (const c of h.channels) {
    if (!c.live || c.draftOnly) continue;
    if (c.sent > 0 || c.waiting > 0) continue;
    out.push({ id: "channel-silent:" + c.id, level: "act",
      title: t60(netName(c.id) + " is connected and has posted nothing"),
      say: netName(c.id) + " is configured, so the house believes it can send there, and no post of the last " + h.windowDays + " days landed on it" +
           (c.failed ? "; " + n0(c.failed) + " " + (c.failed === 1 ? "attempt was" : "attempts were") + " refused." : ". Nothing was even attempted."),
      action: c.last ? post("Send the last slot to " + netName(c.id), "/api/social", { action: "retry-channel", date: c.last.date, slot: c.last.slot, where: c.id }) : null,
      evidence: { network: c.id, days: h.windowDays, sent: c.sent, failed: c.failed, last: c.last || null } });
  }

  /* --- the Reddit drafts ------------------------------------------------ */
  const drafts = [];
  for (const s of h.today) {
    const r = s.results && s.results.reddit;
    if (r && r.links && r.links.length) drafts.push({ slot: s.id, title: r.title || s.title || "" });
  }
  if (drafts.length) {
    out.push({ id: "reddit-drafts", level: "watch",
      title: t60(n0(drafts.length) + " Reddit " + (drafts.length === 1 ? "draft is" : "drafts are") + " waiting for you"),
      say: "The machine wrote " + n0(drafts.length) + " Reddit " + (drafts.length === 1 ? "post" : "posts") + " today and sent " + (drafts.length === 1 ? "it" : "them") + " nowhere: Reddit is drafts only, always, because a post there that reads as an advert costs the account.",
      /* the Posts surface carries the drafts with a tap that copies each one;
         the raw route behind it is JSON and nothing can be done with it */
      action: open("Open the Reddit drafts", "/admin2#posts"),
      evidence: { drafts: drafts.length, slots: drafts.map(d => d.slot) } });
  }

  /* --- what could not be read ------------------------------------------- */
  if (!h.storeOk) {
    out.push({ id: "store", level: "act", title: t60("The store did not answer"),
      say: "The dials could not be read, which means the slot records, the counters and the token clock cannot be trusted either. Everything below is what could still be read, and it may be short.",
      action: null, evidence: { storeOk: false, trouble: h.trouble || [] } });
  } else if (h.trouble && h.trouble.length) {
    out.push({ id: "trouble", level: "watch", title: t60(h.trouble.length + " " + (h.trouble.length === 1 ? "reader" : "readers") + " of the house failed"),
      say: "Part of this read did not answer, so a finding may be missing rather than absent: " + h.trouble.join("; ") + ".",
      action: null, evidence: { trouble: h.trouble } });
  }

  const RANK = { act: 0, watch: 1, good: 2 };
  return out.sort((a, b) => RANK[a.level] - RANK[b.level]);
}

/* the live channel that refused, so a retry has a name to aim at. A channel
   that was never asked, or that is waiting on a review, is not a refusal. */
function firstBrokenChannel(results) {
  for (const [ch, r] of Object.entries(results || {})) {
    if (CH.draftOnly.has(ch)) continue;
    if (!r || r.ok || r.pending || r.skipped || r.waiting || r.trial) continue;
    return ch;
  }
  return "";
}
const saidBy = r => String((r && (r.error || r.err)) || "no reason recorded").slice(0, 160);

/* ---------------------------------------------------------------------------
   THE PARAGRAPH

   The one place the Lantern is asked anything, and it is asked to say what
   matters most, not what is wrong: the findings above already know that. Its
   answer passes the same mechanical guard the day's caption passes -- a number
   that was not in the input throws the whole answer away -- and when it does
   not answer at all the paragraph is built from the findings instead and the
   answer says lantern: false. The console must be able to tell the two apart.
--------------------------------------------------------------------------- */
const PROMPT =
  "You are the chief of staff of a small free Islamic library that publishes to social networks. " +
  "You are handed the day's findings as JSON: each one is already true and already checked. " +
  "Write ONE paragraph of at most three sentences saying what matters most today and why, in plain English, " +
  "for the one person who runs the house. " +
  "You may use only numbers that appear in the findings. You may not add a fact, a name, a cause or an instruction " +
  "that is not in them, and you may not invent an action. " +
  "No em dashes, no exclamation marks, no headings, no lists, no second person. " +
  "Reply with the paragraph and nothing else.";

/* every number the findings actually carry, in the shapes a sentence writes
   them: 1234, 1,234 and 12.5 all reduce to the same thing */
const numbersIn = v => {
  const out = new Set();
  const s = typeof v === "string" ? v : JSON.stringify(v == null ? "" : v);
  for (const m of String(s).match(/\d[\d,]*(?:\.\d+)?/g) || []) {
    const clean = m.replace(/,/g, "").replace(/\.0+$/, "");
    out.add(clean);
    /* a date in the record lets its parts stand: 2026-09-08 permits 2026, 09 and 8 */
    out.add(String(Number(clean)));
  }
  return out;
};

/* A reasoning model sometimes hands back its thinking instead of its answer:
   the first live paragraph began "We need to produce one paragraph, max three
   sentences". Thinking has a shape: it talks about the task (the paragraph,
   the sentences, the findings, the JSON, the person), it says "we need" and
   "I should", it quotes the instructions back. None of that is a sentence
   about the house, so it is refused and the template speaks instead. */
const THINKING = /\b(we need|we must|we should|i should|i need|i will|let me|let's|must use|the user|the findings|the json|paragraph|sentences?\b|chief of staff|instruction|the task|as an ai|plain english)\b/i;
export function guardParagraph(text, findings) {
  let raw = String(text || "");
  raw = raw.replace(/<think>[^]*?<\/think>/gi, " ").replace(/^\s*<think>[^]*$/i, " ");
  raw = raw.replace(/\s+/g, " ").trim();
  if (!raw) return { ok: false, why: "the editor did not answer" };
  if (THINKING.test(raw)) return { ok: false, why: "it thought aloud about the task instead of answering" };
  if (/[—–]/.test(raw)) return { ok: false, why: "it used a dash the house does not write" };
  const kept = sentences(raw).slice(0, 3).join(" ");
  if (!kept) return { ok: false, why: "it wrote nothing that ends" };
  if (kept.length > 520) return { ok: false, why: "it wrote more than a paragraph" };
  const allowed = numbersIn(findings);
  const used = [...numbersIn(kept)];
  const stray = used.filter(x => !allowed.has(x));
  if (stray.length) return { ok: false, why: "it used a number the findings do not carry: " + stray[0] };
  return { ok: true, text: kept };
}

/* the paragraph the house writes when the Lantern is dark, built from the
   findings and from nothing else */
export function template(findings) {
  const act = findings.filter(f => f.level === "act");
  const watch = findings.filter(f => f.level === "watch");
  const good = findings.filter(f => f.level === "good");
  const parts = [];
  if (act.length === 1) parts.push("One thing needs you today: " + lower(act[0].title) + ".");
  else if (act.length > 1) parts.push(act.length + " things need you today, beginning with " + lower(act[0].title) + ".");
  else parts.push("Nothing in the house is asking for you today.");
  if (watch.length === 1) parts.push("One more is worth watching: " + lower(watch[0].title) + ".");
  else if (watch.length > 1) parts.push(watch.length + " more are worth watching, beginning with " + lower(watch[0].title) + ".");
  if (parts.length < 3 && good.length) parts.push(cap(lower(good[0].title)) + ", and the rest reads as it should.");
  return parts.slice(0, 3).join(" ");
}
const lower = s => { const x = String(s || "").trim(); return x && /^[A-Z][a-z]/.test(x) ? x.charAt(0).toLowerCase() + x.slice(1) : x; };
const cap = s => { const x = String(s || "").trim(); return x ? x.charAt(0).toUpperCase() + x.slice(1) : x; };

export async function paragraph(findings, opts = {}) {
  const fallback = { text: template(findings), lantern: false, refused: "" };
  if (opts.lantern === false) return { ...fallback, refused: "the Lantern was not asked" };
  const ask = opts.ask || askOpenRouter;
  /* only what a sentence may stand on travels: the level, the title and the
     say. The evidence is already inside those sentences. */
  const input = findings.map(f => ({ level: f.level, title: f.title, say: f.say }));
  let got;
  try {
    got = await ask([{ role: "system", content: PROMPT }, { role: "user", content: JSON.stringify(input) }],
      { max_tokens: 260, temperature: 0.3, timeout: 8000, budget: 16000, maxTries: 2,
        title: "NOOR Codex of Light · the state of the house" });
  } catch (e) { return { ...fallback, refused: String((e && e.message) || e).slice(0, 90) }; }
  if (!got || !got.text) return { ...fallback, refused: (got && got.error) || "the editor did not answer" };
  const g = guardParagraph(got.text, findings);
  if (!g.ok) return { ...fallback, refused: g.why, model: got.model || "" };
  return { text: g.text, lantern: true, refused: "", model: got.model || "" };
}

/* ---------------------------------------------------------------------------
   THE WHOLE ANSWER, AND THE TEN MINUTES IT KEEPS
--------------------------------------------------------------------------- */
export async function readCache(opts = {}) {
  const ready = opts.kvReady || kvReady;
  if (!ready()) return null;
  try {
    const store = opts.kv || kv;
    const raw = (await store([["GET", K_STEWARD]]))[0];
    if (!raw) return null;
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!v || !v.at) return null;
    const nowMs = opts.now ? +new Date(opts.now) : Date.now();
    if (nowMs - Date.parse(v.at) > (opts.cacheMs || CACHE_MS)) return null;
    return v;
  } catch { return null; }
}

async function writeCache(v, opts = {}) {
  const ready = opts.kvReady || kvReady;
  if (!ready()) return;
  try {
    const store = opts.kv || kv;
    await store([["SET", K_STEWARD, JSON.stringify(v), "EX", "1800"]]);
  } catch { }
}

export async function steward(opts = {}) {
  if (!opts.fresh) {
    const hit = await readCache(opts);
    if (hit) return { ...hit, cached: true };
  }
  const house = await gather(opts);
  const found = rules(house);
  const p = await paragraph(found, opts);
  const out = {
    ok: true, at: house.at, date: house.date,
    say: p.text, lantern: !!p.lantern, refused: p.refused || "",
    counts: { act: found.filter(f => f.level === "act").length,
              watch: found.filter(f => f.level === "watch").length,
              good: found.filter(f => f.level === "good").length },
    findings: found,
    read: { mode: house.mode, slots: house.today.length, windowDays: house.windowDays,
            media: house.insights.media, trouble: house.trouble }
  };
  await writeCache(out, opts);
  return { ...out, cached: false };
}
