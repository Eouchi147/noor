// NOOR · the owner's own door onto one day's reel line-up.
// ---------------------------------------------------------------------------
// GET  /api/lineup?date=YYYY-MM-DD   every reel slot of that day: what the
//   rota would post (after any running experiment and any override already
//   set), the slot's own record state, and the override itself if there is
//   one. The same reading api/social.js's own plan/today preview and the
//   Lantern's lineup tool give, so a console, a script and the model agree.
// POST /api/lineup {action:"set", date, slot, override:{action:"skip"}}
// POST /api/lineup {action:"set", date, slot, override:{action:"swap", id}}
// POST /api/lineup {action:"clear", date, slot}
//
// Every real decision -- what is allowed, what is refused, and why -- lives
// in api/_lineup.js, which is what tests/lineup.mjs tests with no network
// and no cookie at all. This file is deliberately thin: the owner gate
// (exactly api/experiments.js's own door), reading the shelf and the day's
// bias so a swap can be checked against what every OTHER slot would show,
// and the HTTP shape.
//
// Owner-gated exactly like api/experiments.js: the console's signed cookie,
// or ADMIN_SECRET in a header for a hand-run request.
// ---------------------------------------------------------------------------

import { ownerGate } from "./_owner.js";
import { REEL_SLOTS } from "./_schedule.js";
import { biasFor } from "./_experiments.js";
import { recentlyPosted, recentlyPostedRaw, readSlot } from "./social.js";
import {
  readOverrides, getOverride, setOverride, clearOverride,
  chooseReelWithOverride, otherPicksFor, buildDayContext
} from "./_lineup.js";

const json = (res, code, obj) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(code).json(obj);
};

export default async function handler(req, res) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || process.env.VERCEL_URL || "noorcodex.com";
  const gate = ownerGate(req);
  if (!gate.ok) return json(res, gate.code, { ok: false, error: gate.reason });

  try {
    if (req.method === "GET") {
      const date = String((req.query && req.query.date) || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json(res, 400, { ok: false, error: "date must be YYYY-MM-DD" });
      /* a read: fails open on every piece, exactly buildDayContext's own
         promise (api/_lineup.js), the same one this route's own poster
         keeps for a fault on the live path */
      const ctx = await buildDayContext(host, date, { biasFor, recentlyPosted });
      const overrides = await readOverrides(date, {});
      /* every reel slot's own record, read once, up front: a slot the day
         has already decided (rec.reel) is a FACT for both this slot's own
         row and every OTHER slot's otherPicks, never a pick recomputed
         against a `seen` window that card has since joined itself
         (2026-09-26 review, second finding -- see api/_lineup.js's own
         chooseReelWithOverride and otherPicksFor). */
      const records = {};
      for (const s of REEL_SLOTS) records[s] = await readSlot(date, s).catch(() => null);
      const slots = [];
      for (const slot of REEL_SLOTS) {
        const rec = records[slot];
        const otherPicks = await otherPicksFor(ctx.cards, date, slot, ctx.hijri, ctx.seen, ctx.bias, { records });
        const { card, override } = await chooseReelWithOverride(ctx.cards, date, slot, ctx.hijri, ctx.seen, ctx.bias, null, { otherPicks, rec });
        slots.push({
          slot, locked: !!rec, state: rec ? rec.state : null,
          override: overrides[slot] || null,
          appliedOverride: override,
          card: card ? { id: card.id, kind: card.kind || "light", hook: card.hook || "", slot: card.slot || "" } : null
        });
      }
      return json(res, 200, { ok: true, date, slots });
    }

    if (req.method !== "POST") return json(res, 405, { ok: false, error: "GET or POST only" });
    let body = req.body || {};
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
    const action = String(body.action || "");
    const date = String(body.date || "").slice(0, 10);
    const slot = String(body.slot || "");

    if (action === "clear") {
      const r = await clearOverride({ date, slot }, {});
      return json(res, r.ok ? 200 : 400, r);
    }
    if (action === "set") {
      const ov = (body.override && typeof body.override === "object") ? body.override : {};
      /* a write: the duplicate guard's own window must be read straight, or
         refused outright -- never silently treated as an empty window,
         which would let a real duplicate straight through the one check
         built to catch it (2026-09-26 review fix). Everything else this
         needs (the shelf, the hijri date, the day's own experiment lean)
         keeps buildDayContext's ordinary fail-open promise: a fault on any
         of those only costs the half-check they feed, never the write
         itself, and setOverride's own downstream checks (the shelf, the
         slot's own record) still stand guard regardless. */
      let seen;
      try { seen = await recentlyPostedRaw(date); }
      catch { return json(res, 200, { ok: false, error: "the duplicate guard could not be read, so nothing was set" }); }
      const ctx = await buildDayContext(host, date, { seen, biasFor });
      /* the same records-first otherPicks every other view now builds
         (api/_lineup.js's own otherPicksFor): a slot already recorded is a
         fact, not a pick to recompute against `seen`, so a hand-set swap
         is never refused over another slot's own recomputed pick drifting
         onto it (2026-09-26 review, first finding). */
      const records = {};
      for (const s of REEL_SLOTS) if (s !== slot) records[s] = await readSlot(date, s).catch(() => null);
      const otherPicks = await otherPicksFor(ctx.cards, date, slot, ctx.hijri, ctx.seen, ctx.bias, { records });
      const r = await setOverride({ date, slot, action: ov.action, id: ov.id },
        { manifest: ctx.cards, seen: ctx.seen, otherPicks, by: "owner", note: String(body.note || "") });
      return json(res, r.ok ? 200 : 400, r);
    }
    return json(res, 400, { ok: false, error: "unknown action" });
  } catch (e) {
    return json(res, 200, { ok: false, error: String(e && e.message || e).slice(0, 200) });
  }
}
