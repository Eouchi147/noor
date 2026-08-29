// The nightly breath of the lantern.
//
// Every illumination on the site falls back to a written treasury when the AI
// cannot be reached, which is why a broken lantern stayed invisible for weeks:
// the Codex looked perfectly lit while the key sat untouched. This endpoint is
// woken once a day by Vercel's scheduler. It generates the day's light, stores
// it, and records what happened, so there is always an answer to "when did the
// lantern last actually speak?"
import { kv, kvReady } from "./_kv.js";
import { probeLantern, refreshIntoStore } from "./_models.js";

/* the dials, read directly: warm.js runs before anything else is warm and has
   no business importing the whole settings route for three values */
async function settingsFor(keys) {
  const out = {};
  if (!kvReady()) return out;
  try {
    const raw = (await kv([["GET", "nb:settings"]]))[0];
    const o = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : {};
    for (const k of keys) if (k in o) out[k] = o[k];
  } catch { }
  return out;
}

export default async function handler(req, res) {
  /* Vercel signs its own cron requests, and anybody who knows this URL could
     otherwise force the daily run: burn the model budget, and once the social
     machine is on auto, make the house post on demand. CRON_SECRET is checked
     when it is set. When it is not, the route still runs, because refusing to
     warm a site whose owner has not set a variable yet is a worse failure than
     an open warm endpoint, and the console says loudly that it is unset. */
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = String(req.headers.authorization || "");
    const given = auth.replace(/^Bearer\s+/i, "") || String((req.query || {}).key || "");
    const fromVercel = !!req.headers["x-vercel-signature"] || /vercel-cron/i.test(String(req.headers["user-agent"] || ""));
    if (given !== secret && !fromVercel) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(401).json({ ok: false, reason: "locked" });
    }
  }

  const started = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const host = req.headers["x-forwarded-host"] || req.headers.host || process.env.VERCEL_URL || "noorcodex.com";
  const base = "https://" + String(host).replace(/^https?:\/\//, "");
  const out = { day: today, ran: [], ms: 0 };

  /* The day's light first: it is the one that is stored and shared. */
  for (const kind of ["light", "friday"]) {
    if (kind === "friday" && new Date().getUTCDay() !== 5) continue;
    try {
      const r = await fetch(base + "/api/illuminations?kind=" + kind + "&warm=1", { headers: { "cache-control": "no-cache" } });
      const j = r.ok ? await r.json() : null;
      out.ran.push({ kind, ok: !!j, source: j && j.source || "", title: (j && (j.title || j.text) || "").slice(0, 60) });
    } catch (e) {
      out.ran.push({ kind, ok: false, err: String(e && e.message || e).slice(0, 60) });
    }
  }

  /* The free-model list, refreshed into the store, so that every cold start
     tomorrow reads a list at most a day old instead of the written guess.
     This is the single most important line in this file. */
  try { out.models = await refreshIntoStore(); }
  catch (e) { out.models = { err: String(e && e.message || e).slice(0, 60) }; }

  /* And a one-word probe, so the console can say when the key last worked. */
  try {
    const p = await probeLantern();
    out.lantern = { ok: p.ok, model: p.answered || "", error: p.error || "", listed: p.listed };
    if (kvReady()) {
      await kv([["SET", "nwarm:last", JSON.stringify({ at: new Date().toISOString(), ok: p.ok, model: p.answered || "", error: p.error || "" })],
                ["EXPIRE", "nwarm:last", "2764800"]]).catch(() => {});
    }
  } catch (e) { out.lantern = { ok: false, error: String(e && e.message || e).slice(0, 60) }; }

  /* The day's post. It sends only if the mode dial allows it, only once
     per day whatever happens, and never before the owner has turned it on. */
  try {
    const { runDaily } = await import("./social.js");
    out.social = await runDaily(String(host).replace(/^https?:\/\//, ""), today, {});
    if (out.social && out.social.post) {
      /* the caption is long and the console can read it from the log */
      out.social.post = { id: out.social.post.light.id, title: out.social.post.light.title };
    }
  } catch (e) { out.social = { err: String(e && e.message || e).slice(0, 80) }; }

  /* The night shift. The Lantern reads the house's own published passages and
     says which ones an editor should look at again, sorts the inbox so a
     correction never sits behind forty messages of thanks, and writes the day
     in three sentences. It never edits, publishes or deletes anything: every
     job files a finding and stops. See api/_nightshift.js for why this shape
     and not another. */
  try {
    const { runNightShift, DEFAULT_AUDIT } = await import("./_nightshift.js");
    const s = await settingsFor(["nightshift.on", "nightshift.audit", "nightshift.triage"]);
    if (s["nightshift.on"] !== false) {
      out.night = await runNightShift(String(host).replace(/^https?:\/\//, ""), {
        audit: typeof s["nightshift.audit"] === "number" ? s["nightshift.audit"] : DEFAULT_AUDIT,
        triage: s["nightshift.triage"] !== false,
        facts: {
          "gifts in the last 30 days": (out.gifts && out.gifts.count30d) ?? null,
          "unread messages": out.unread ?? null,
          "the lantern answered a probe": out.lantern ? String(!!out.lantern.ok) : "unknown",
          "the day's post": out.social ? (out.social.state || out.social.skipped || "nothing") : "unknown",
          "cards the lantern held back": out.doubts ?? null
        }
      });
    } else out.night = { skipped: "the night shift dial is off" };
  } catch (e) { out.night = { err: String(e && e.message || e).slice(0, 80) }; }

  /* On the first of the month the Lantern sorts the journal's replies. Doing it
     here rather than on its own schedule keeps the site to a single cron. */
  if (new Date().getUTCDate() === 1) {
    try {
      const r = await fetch(base + "/api/journal", {
        method: "POST", headers: { "Content-Type": "application/json", "cache-control": "no-cache" },
        body: JSON.stringify({ action: "triage", key: process.env.ADMIN_SECRET || "" })
      });
      out.triage = r.ok ? await r.json() : { ok: false, status: r.status };
    } catch (e) { out.triage = { ok: false, err: String(e && e.message || e).slice(0, 60) }; }
  }

  out.ms = Date.now() - started;
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json(out);
}
