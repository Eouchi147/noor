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

export default async function handler(req, res) {
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
