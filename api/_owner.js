// Who is allowed to drive the house.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
//
// Three admin routes each grew their own answer to "is this the owner?", and
// one of them was wrong in a way nothing on the outside could show.
//
// The console proves itself with a signed `noor_admin` cookie, set when the
// owner unlocks it. api/admin-data.js verifies that cookie and answers. But
// api/social.js only ever accepted the raw secret, handed over in an
// x-admin-key header or a ?key= query string. The console has no way to send
// either: it does not know the secret, it only holds the cookie. So every
// request the Social room made came back 401, the room rendered empty, and the
// empty state told the owner that ADMIN_SECRET was not set -- which it was,
// and had been since the fifth of August. A wrong guess, printed as a fact.
//
// One check, imported once. A route that guards a public account must not hold
// a private opinion about who the owner is.
// ---------------------------------------------------------------------------

import crypto from "crypto";

/* The cookie is <expiry-in-ms>.<hmac-sha256 of that expiry, keyed on the
   secret>. This is the check api/admin-data.js has always made, moved
   somewhere it can be shared rather than retyped a fourth time. */
function cookieOk(cookieHeader, secret) {
  const m = /(?:^|;\s*)noor_admin=([^;]+)/.exec(cookieHeader || "");
  if (!m) return false;
  const [expStr, sig] = m[1].split(".");
  const exp = parseInt(expStr, 10);
  if (!exp || Date.now() > exp) return false;
  const want = crypto.createHmac("sha256", secret).update(String(exp)).digest("hex");
  const A = Buffer.from(sig || ""), B = Buffer.from(want);
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

/* The header and query forms stay, because the nightly cron and a hand-run
   request have no cookie to offer. Compared in constant time: the old `===` in
   social.js returned faster on a wrong first character than on a right one,
   which is how a secret gets guessed one character at a time. */
function keyOk(given, secret) {
  const A = Buffer.from(String(given || "")), B = Buffer.from(secret);
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

export function ownerOk(req) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const q = (req && req.query) || {};
  const h = (req && req.headers) || {};
  const given = h["x-admin-key"] || q.key || "";
  if (given && keyOk(given, secret)) return true;
  return cookieOk(h.cookie, secret);
}

/* 501 and 401 are different sentences and the console reads both: one means the
   house was never given a key at all, the other means you are not holding it.
   Collapsing them is what produced the misleading empty state. */
export function ownerGate(req) {
  if (!process.env.ADMIN_SECRET) return { ok: false, code: 501, reason: "admin not configured" };
  if (!ownerOk(req)) return { ok: false, code: 401, reason: "locked" };
  return { ok: true };
}
