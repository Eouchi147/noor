/* NOOR · Pinterest, from an approval to a Pin.
   Run: node tests/pinterest.mjs        (no server, no network: fetch is stubbed)

   The sender has existed for months and never posted, because the step between
   "Pinterest approved the app" and "the house holds a refresh token" did not
   exist. These check the pieces that close that gap, and the ones that were
   already there and had never been exercised. */
import crypto from "node:crypto";

process.env.ADMIN_SECRET = process.env.ADMIN_SECRET || "test-secret-for-the-house";
const SECRET = process.env.ADMIN_SECRET;

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? "  ✓ " : "  ✗ ") + m); c ? pass++ : fail++; };
const section = t => console.log("\n=== " + t + " ===");

/* ---------- a Pinterest that behaves ---------- */
/* the module reads r.text() and r.json() in different places, so a stub has to
   offer both or it only proves the half of the code it happens to reach */
const reply = (status, obj) => ({ ok: status >= 200 && status < 300, status,
  json: async () => obj, text: async () => JSON.stringify(obj) });
function pinterest(opts = {}) {
  const calls = [];
  const boards = opts.boards || [{ id: "981723456", name: "NOOR Codex of Light" }];
  return {
    calls,
    fetch: async (url, init = {}) => {
      const u = String(url), body = String(init.body || "");
      calls.push({ url: u, method: init.method || "GET", body, auth: (init.headers || {}).Authorization || "" });
      if (u.includes("/v5/oauth/token")) {
        if (opts.refreshFails) return reply(401, { message: "bad refresh" });
        if (body.includes("grant_type=authorization_code"))
          return reply(200, { access_token: "at-new", refresh_token: "rt-rotated", expires_in: 2592000 });
        return reply(200, { access_token: "at-refreshed", expires_in: 2592000 });
      }
      if (u.includes("/v5/boards")) {
        if (opts.boardsFail) return reply(403, {});
        return reply(200, { items: boards });
      }
      if (u.includes("/v5/pins")) {
        const tok = (init.headers || {}).Authorization || "";
        if (opts.expireFirstPin && !tok.includes("refreshed"))
          return reply(401, { message: "token expired" });
        return reply(201, { id: "pin-8812" });
      }
      return reply(404, {});
    }
  };
}
const clearEnv = () => { for (const k of Object.keys(process.env)) if (k.startsWith("PIN_")) delete process.env[k]; };

/* ---------- the module, loaded fresh each time env changes ---------- */
let n = 0;
const load = () => import("../api/_channels.js?v=" + (++n));

const SHAPED = { title: "The cave in the Qur'an held two men for three nights",
  text: "Jabal Thawr rises south of Makkah.", link: "https://noorcodex.com/?node=12",
  image: "https://noorcodex.com/api/card?slot=light" };

section("1. the sender knows when it is not configured");
{
  clearEnv();
  const CH = await load();
  const r = await CH.sendPinterest(SHAPED, { fetch: pinterest().fetch });
  ok(!r.ok, "an empty environment does not post");
  ok(/not configured/.test(r.err), "and says so plainly: " + r.err);
  ok(CH.configured.pinterest() === false, "the console is told the channel is not live");
}

section("2. a board may be named instead of numbered");
{
  clearEnv();
  process.env.PIN_BOARD_NAME = "NOOR Codex of Light";
  process.env.PIN_TOKEN = "at-pasted";
  const CH = await load(), P = pinterest();
  ok(CH.configured.pinterest() === true, "a name plus a token is enough to be live");
  const r = await CH.sendPinterest(SHAPED, { fetch: P.fetch });
  ok(r.ok && r.id === "pin-8812", "the Pin goes up");
  const pin = P.calls.find(c => c.url.includes("/v5/pins"));
  ok(JSON.parse(pin.body).board_id === "981723456", "on the board whose name matched, id looked up, not typed");
  const before = P.calls.filter(c => c.url.includes("/v5/boards")).length;
  await CH.sendPinterest(SHAPED, { fetch: P.fetch });
  ok(P.calls.filter(c => c.url.includes("/v5/boards")).length === before, "and the lookup is not repeated for the next Pin");
}

section("3. a name that matches nothing fails honestly");
{
  clearEnv();
  process.env.PIN_BOARD_NAME = "A board that was never made";
  process.env.PIN_TOKEN = "at-pasted";
  const CH = await load();
  const r = await CH.sendPinterest(SHAPED, { fetch: pinterest().fetch });
  ok(!r.ok && /no board/.test(r.err), "it names the real problem: " + r.err);
}

section("4. the refresh token alone is enough to post");
{
  clearEnv();
  process.env.PIN_BOARD_ID = "981723456";
  process.env.PIN_APP_ID = "1606775";
  process.env.PIN_APP_SECRET = "s3cret";
  process.env.PIN_REFRESH_TOKEN = "rt-stored";
  const CH = await load(), P = pinterest();
  ok(CH.configured.pinterest() === true, "app credentials plus a refresh token read as live");
  const r = await CH.sendPinterest(SHAPED, { fetch: P.fetch });
  ok(r.ok, "the Pin goes up with no PIN_TOKEN in the environment at all");
  const t = P.calls.find(c => c.url.includes("/v5/oauth/token"));
  ok(!!t && t.body.includes("grant_type=refresh_token"), "an access token was minted from the refresh token");
  ok(t.auth.startsWith("Basic "), "using the app id and secret, as Pinterest requires");
}

section("5. an access token that died mid-month is replaced, once");
{
  clearEnv();
  process.env.PIN_BOARD_ID = "981723456";
  process.env.PIN_TOKEN = "at-stale";
  process.env.PIN_APP_ID = "1606775";
  process.env.PIN_APP_SECRET = "s3cret";
  process.env.PIN_REFRESH_TOKEN = "rt-stored";
  const CH = await load(), P = pinterest({ expireFirstPin: true });
  const r = await CH.sendPinterest(SHAPED, { fetch: P.fetch });
  ok(r.ok, "the post still lands");
  ok(P.calls.filter(c => c.url.includes("/v5/pins")).length === 2, "after exactly one retry");
}

section("6. the sandbox is reachable without touching the real profile");
{
  clearEnv();
  process.env.PIN_API_BASE = "https://api-sandbox.pinterest.com";
  process.env.PIN_BOARD_ID = "981723456";
  process.env.PIN_TOKEN = "at-sandbox";
  const CH = await load(), P = pinterest();
  ok(CH.pinBase() === "https://api-sandbox.pinterest.com", "PIN_API_BASE moves the base");
  await CH.sendPinterest(SHAPED, { fetch: P.fetch });
  ok(P.calls.every(c => c.url.startsWith("https://api-sandbox.pinterest.com")), "and every call goes there, none to the live API");
}

section("7. an image is not optional on Pinterest");
{
  clearEnv();
  process.env.PIN_BOARD_ID = "981723456";
  process.env.PIN_TOKEN = "at-pasted";
  const CH = await load();
  const r = await CH.sendPinterest({ ...SHAPED, image: null }, { fetch: pinterest().fetch });
  ok(!r.ok && /image/.test(r.err), "a Pin with no image is refused before it is sent");
}

section("8. the shape Pinterest is given");
{
  const CH = await load();
  const long = "x".repeat(400);
  const sh = CH.shape({ title: long, body: long, basis: "Bukhari 3615", link: "https://noorcodex.com/?node=12",
                        image: "https://noorcodex.com/api/card", tags: ["#a", "#b", "#c", "#d", "#e"] }, "pinterest");
  ok(sh.title.length <= 100, "the title fits Pinterest's hundred characters (" + sh.title.length + ")");
  ok(sh.text.length <= 500, "the description fits its five hundred (" + sh.text.length + ")");
  ok(sh.link === "https://noorcodex.com/?node=12", "and the link home survives");
}

section("9. the round trip's signed state");
{
  const sign = () => { const exp = Date.now() + 15 * 60 * 1000;
    return exp + "." + crypto.createHmac("sha256", SECRET).update("pin" + exp).digest("hex"); };
  const check = (state, secret) => {
    const [e, sig] = String(state || "").split(".");
    const exp = parseInt(e, 10);
    if (!exp || Date.now() > exp) return false;
    const want = crypto.createHmac("sha256", secret).update("pin" + exp).digest("hex");
    const A = Buffer.from(sig || ""), B = Buffer.from(want);
    return A.length === B.length && crypto.timingSafeEqual(A, B);
  };
  ok(check(sign(), SECRET), "a state this house signed is accepted back");
  ok(!check(sign(), "another-secret"), "one signed by anybody else is not");
  const past = (Date.now() - 1000) + ".";
  ok(!check(past + crypto.createHmac("sha256", SECRET).update("pin" + (Date.now() - 1000)).digest("hex"), SECRET),
     "and an expired one is not, so a stale link cannot be replayed");
  ok(!check("", SECRET), "an empty state is refused");
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
