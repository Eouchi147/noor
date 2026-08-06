// Owner-only visitor map, read from the Codex's own lamp counter.
// Requires the noor_admin cookie plus a connected Vercel KV store.

import crypto from "crypto";

function verify(cookieHeader, secret) {
  const m = /(?:^|;\s*)noor_admin=([^;]+)/.exec(cookieHeader || "");
  if (!m) return false;
  const [expStr, sig] = m[1].split(".");
  const exp = parseInt(expStr, 10);
  if (!exp || Date.now() > exp) return false;
  const want = crypto.createHmac("sha256", secret).update(String(exp)).digest("hex");
  const A = Buffer.from(sig || ""), B = Buffer.from(want);
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

async function kv(cmds) {
  const r = await fetch(process.env.KV_REST_API_URL + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + process.env.KV_REST_API_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(cmds)
  });
  if (!r.ok) throw 0;
  return (await r.json()).map(x => x.result);
}

export default async function handler(req, res) {
  const SECRET = process.env.ADMIN_SECRET;
  if (!SECRET) return res.status(501).json({ error: "admin not configured" });
  if (!verify(req.headers.cookie, SECRET)) return res.status(401).json({ error: "locked" });
  const enabled = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  const out = { enabled, days: [], countries: [], rooms: [], sources: [], totals: { views30: 0, people30: 0 } };
  if (!enabled) return res.status(200).json(out);

  try {
    const days = [];
    for (let i = 29; i >= 0; i--) days.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
    const months = [...new Set(days.map(d => d.slice(0, 7)))];

    const viewKeys = days.map(d => "nv:" + d + ":views");
    const peopleKeys = days.map(d => "nv:" + d + ":people");
    const keyLists = await kv(months.map(m => ["KEYS", "nm:" + m + ":*"]));
    const dimKeys = [].concat(...keyLists.map(x => x || []));

    const values = await kv([
      ["MGET", ...viewKeys],
      ["MGET", ...peopleKeys],
      ...(dimKeys.length ? [["MGET", ...dimKeys]] : [])
    ]);
    const views = (values[0] || []).map(x => parseInt(x, 10) || 0);
    const people = (values[1] || []).map(x => parseInt(x, 10) || 0);
    const dims = dimKeys.length ? (values[2] || []).map(x => parseInt(x, 10) || 0) : [];

    out.days = days.map((d, i) => ({ date: d, views: views[i], people: people[i] }));
    out.totals.views30 = views.reduce((a, b) => a + b, 0);
    out.totals.people30 = people.reduce((a, b) => a + b, 0);

    const cAgg = {}, rAgg = {}, sAgg = {};
    dimKeys.forEach((k, i) => {
      const m = k.match(/^nm:\d{4}-\d{2}:(c|r|s):(.+)$/);
      if (!m) return;
      if (m[1] === "c") cAgg[m[2]] = (cAgg[m[2]] || 0) + dims[i];
      else if (m[1] === "s") sAgg[m[2]] = (sAgg[m[2]] || 0) + dims[i];
      else rAgg[m[2]] = (rAgg[m[2]] || 0) + dims[i];
    });
    out.countries = Object.entries(cAgg).map(([k, v]) => ({ c: k, n: v })).sort((a, b) => b.n - a.n).slice(0, 20);
    out.rooms = Object.entries(rAgg).map(([k, v]) => ({ r: k, n: v })).sort((a, b) => b.n - a.n).slice(0, 14);
    out.sources = Object.entries(sAgg).map(([k, v]) => ({ s: k, n: v })).sort((a, b) => b.n - a.n).slice(0, 14);
    return res.status(200).json(out);
  } catch {
    return res.status(200).json(out);
  }
}
