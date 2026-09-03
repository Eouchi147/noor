/* NOOR · the Pinterest round trip, through the real route.
   Run: node tests/pinterest-flow.mjs      (no server, no network: fetch is stubbed)

   tests/pinterest.mjs proves the sender. This proves the two actions that
   stand between a Pinterest approval and a token the sender can use, in
   api/social.js, including who is allowed to call them. */
process.env.ADMIN_SECRET = "test-secret";
process.env.PIN_APP_ID = "1606775";
process.env.PIN_APP_SECRET = "s3cret";
process.env.PIN_BOARD_NAME = "NOOR Codex of Light";
import crypto from "node:crypto";
const real = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url), body = String(init.body || "");
  const reply = (st, o) => ({ ok: st < 300, status: st, json: async () => o, text: async () => JSON.stringify(o) });
  if (u.includes("/v5/oauth/token") && body.includes("authorization_code"))
    return reply(200, { access_token: "at-new", refresh_token: "rt-ROTATED-VALUE", expires_in: 2592000 });
  if (u.includes("/v5/boards")) return reply(200, { items: [{ id: "981723456", name: "NOOR Codex of Light" }] });
  return reply(404, {});
};
const mod = await import("/root/repo/noor-main/api/social.js");
const handler = mod.default;
function mkres() { const o = { code: 0, body: "", headers: {}, ended: false };
  return { setHeader: (k, v) => { o.headers[k] = v; }, writeHead: (c, h) => { o.code = c; Object.assign(o.headers, h); },
    end: () => { o.ended = true; }, status(c) { o.code = c; return this; },
    json(b) { o.body = JSON.stringify(b); return o; }, send(b) { o.body = b; return o; }, out: o }; }
let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? "  ✓ " : "  ✗ ") + m); c ? pass++ : fail++; };

console.log("=== the owner starts the round trip ===");
const cookie = (() => { const exp = Date.now() + 3600000;
  return "noor_admin=" + exp + "." + crypto.createHmac("sha256", "test-secret").update(String(exp)).digest("hex"); })();
let r = mkres();
await handler({ method: "GET", query: { action: "pin-auth" }, headers: { host: "noorcodex.com", cookie } }, r);
ok(r.out.code === 302, "the owner is redirected (" + r.out.code + ")");
const loc = r.out.headers.Location || "";
const U = new URL(loc);
ok(U.origin + U.pathname === "https://www.pinterest.com/oauth/", "to Pinterest's own consent page");
ok(U.searchParams.get("client_id") === "1606775", "carrying the app id");
ok(U.searchParams.get("redirect_uri") === "https://noorcodex.com/pinterest/callback", "and the clean redirect: " + U.searchParams.get("redirect_uri"));
const scopes = (U.searchParams.get("scope") || "").split(",");
ok(scopes.includes("pins:write") && scopes.includes("boards:read"), "asking for exactly what posting needs: " + scopes.join(" "));
const state = U.searchParams.get("state");
ok(!!state && state.includes("."), "with a signed state");

console.log("\n=== a stranger cannot start it ===");
r = mkres();
await handler({ method: "GET", query: { action: "pin-auth" }, headers: { host: "noorcodex.com" } }, r);
ok(r.out.code === 401, "no cookie, no redirect (" + r.out.code + ")");

console.log("\n=== Pinterest hands back a code ===");
r = mkres();
await handler({ method: "GET", query: { action: "pin-callback", code: "abc123", state }, headers: { host: "noorcodex.com" } }, r);
ok(r.out.code === 200, "the callback answers without any cookie, on the signed state alone");
ok(/rt-ROTATED-VALUE/.test(r.out.body), "and shows the refresh token once");
ok(/981723456/.test(r.out.body), "with the board id it looked up from the name");
ok(/PIN_REFRESH_TOKEN/.test(r.out.body) && /PIN_BOARD_ID/.test(r.out.body), "labelled exactly as Vercel wants them");
ok(!/s3cret/.test(r.out.body), "and never echoes the app secret back to the page");
ok((r.out.headers["Cache-Control"] || "").includes("no-store"), "the page is not cached");
ok((r.out.headers["Referrer-Policy"] || "") === "no-referrer", "and cannot leak the code in a referrer");

console.log("\n=== a forged or stale state is refused ===");
r = mkres();
await handler({ method: "GET", query: { action: "pin-callback", code: "abc", state: "9999999999999.deadbeef" }, headers: { host: "noorcodex.com" } }, r);
ok(r.out.code === 401, "a state this house did not sign gets nowhere (" + r.out.code + ")");

console.log("\n=== Pinterest refuses ===");
r = mkres();
await handler({ method: "GET", query: { action: "pin-callback", state, error: "access_denied" }, headers: { host: "noorcodex.com" } }, r);
ok(r.out.code === 400 && /access_denied/.test(r.out.body), "the denial is shown, not swallowed");

console.log("\n" + pass + " passed, " + fail + " failed");
globalThis.fetch = real;
process.exit(fail ? 1 : 0);
