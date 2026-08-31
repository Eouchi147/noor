/* The bug this file exists for:
   /api/social?action=due sat behind ownerGate, which accepts a signed cookie or
   the secret in a header. A Vercel cron sends neither. So the hourly job that
   delivers the day's posts was answered 401 every hour from the moment it
   shipped, and not one of the four daily slots ever ran. Everything upstream
   was correct — the calendar, the schedule, the composed posts — and none of it
   left the building.

   These tests drive the real handler with real request shapes. */
import handler from "../api/social.js";
import crypto from "crypto";

process.env.ADMIN_SECRET = process.env.ADMIN_SECRET || "test-admin-secret-000000000000";
process.env.CRON_SECRET  = "test-cron-secret-1111";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  PASS " + m); } else { fail++; console.log("  FAIL " + m); } };

function res() {
  const r = { code: 0, body: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = c => { r.code = c; return r; };
  r.json = b => { r.body = b; return r; };
  r.end = b => { r.body = b; return r; };
  return r;
}
const call = async (req) => { const r = res(); await handler({ method: "GET", headers: {}, query: {}, ...req }, r); return r; };

/* a valid console cookie, built the way _owner.js verifies it */
function cookie() {
  const exp = Date.now() + 3600e3;
  const sig = crypto.createHmac("sha256", process.env.ADMIN_SECRET).update(String(exp)).digest("hex");
  return "noor_admin=" + exp + "." + sig;
}

console.log("\n=== the cron must get in, and only for 'due' ===");
{
  /* this is the exact shape Vercel sends: no cookie, no key */
  let r = await call({ query: { action: "due" }, headers: { "user-agent": "vercel-cron/1.0" } });
  ok(r.code !== 401, "a vercel-cron user agent is admitted to 'due' (got " + r.code + ")");

  r = await call({ query: { action: "due" }, headers: { "x-vercel-signature": "abc" } });
  ok(r.code !== 401, "so is the x-vercel-signature header (got " + r.code + ")");

  r = await call({ query: { action: "due" },
                   headers: { authorization: "Bearer " + process.env.CRON_SECRET } });
  ok(r.code !== 401, "so is a correct CRON_SECRET bearer (got " + r.code + ")");
}

console.log("\n=== and nothing else is opened up by it ===");
{
  let r = await call({ query: { action: "due" }, headers: {} });
  ok(r.code === 401, "a plain anonymous GET to 'due' is still refused");

  r = await call({ query: { action: "due" }, headers: { authorization: "Bearer wrong-secret-here" } });
  ok(r.code === 401, "a wrong bearer is refused");

  for (const action of ["dials", "log", "preview", "plan", "reddit", "tokens"]) {
    r = await call({ query: { action }, headers: { "user-agent": "vercel-cron/1.0" } });
    ok(r.code === 401, "the cron cannot reach '" + action + "'");
  }

  r = await call({ method: "POST", query: {}, headers: { "user-agent": "vercel-cron/1.0" }, body: {} });
  ok(r.code === 401, "the cron cannot POST anything");
}

console.log("\n=== the owner still gets in the ordinary way ===");
{
  const r = await call({ query: { action: "dials" }, headers: { cookie: cookie() } });
  ok(r.code !== 401, "the console's signed cookie still works (got " + r.code + ")");
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
