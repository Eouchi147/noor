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
        if ((init.method || "GET") === "POST") { const b = JSON.parse(body); boards.push({ id: "made-" + boards.length, name: b.name }); return reply(201, { id: "made-" + (boards.length - 1), name: b.name }); }
        return reply(200, { items: boards });
      }
      if (u.includes("/v5/pins") && opts.trial)
        return reply(403, { code: 3, message: "Apps with Trial access may not create Pins in production https://api.pinterest.com - use API Sandbox https://api-sandbox.pinterest.com instead." });
      if (u.includes("/v5/pins")) {
        const tok = (init.headers || {}).Authorization || "";
        if (opts.expireFirstPin && !tok.includes("refreshed"))
          return reply(401, { message: "token expired" });
        return reply(201, { id: "pin-8812" });
      }
      /* a video pin: the upload slot, the file, the processing, in that order */
      if (u.endsWith("/v5/media")) return reply(201, { media_id: "m-77", media_type: "video",
        upload_url: "https://pinterest-media-upload.s3.test/", upload_parameters: { key: "k1", policy: "p1" } });
      if (u.startsWith("https://pinterest-media-upload.s3.test/")) { calls[calls.length - 1].form = init.body; return reply(204, {}); }
      if (u.includes("/v5/media/m-77")) { opts.polls = (opts.polls || 0) + 1;
        return reply(200, { status: opts.mediaFails ? "failed" : (opts.polls >= 2 ? "succeeded" : "processing") }); }
      if (u.startsWith("https://noorcodex.com/reels/")) return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array([0, 0, 0, 24]).buffer };
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

section("3. a name that matches nothing is made, once, in public");
{
  clearEnv();
  process.env.PIN_BOARD_NAME = "A board that was never made";
  process.env.PIN_TOKEN = "at-pasted";
  const CH = await load();
  const P = pinterest();
  const r = await CH.sendPinterest(SHAPED, { fetch: P.fetch });
  const made = P.calls.filter(c => c.url.endsWith("/v5/boards") && c.method === "POST");
  ok(r.ok && made.length === 1 && JSON.parse(made[0].body).privacy === "PUBLIC" && JSON.parse(made[0].body).name === "A board that was never made",
     "the board is created, public, under exactly that name, and the pin lands on it");
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

section("9. a board for every kind, and the general one for the rest");
{
  clearEnv();
  process.env.PIN_TOKEN = "at-pasted"; process.env.PIN_BOARD_NAME = "NOOR Codex of Light";
  const CH = await load();
  ok(CH.pinBoardFor({ slot: "word" }) === "Islamic words, explained", "the word card goes to the words board");
  ok(CH.pinBoardFor({ reel: true, kind: "verse" }) === "One verse of the Qur'an", "a verse reel goes to the verse board");
  ok(CH.pinBoardFor({ reel: true, kind: "know" }) === "Lights of Islamic history and science", "Did you know goes with the Lights");
  ok(CH.pinBoardFor({ slot: "dawn" }) === "The Islamic year, day by day" && CH.pinBoardFor({ reel: true, kind: "day" }) === "The Islamic year, day by day", "dawn and This day share the calendar board");
  ok(CH.pinBoardFor({ slot: "dusk" }) === "The Path of Creation", "the chapter goes to the Path");
  ok(CH.pinBoardFor({ slot: "light" }) === "Lights of Islamic history and science", "the day's card is a Light and goes with the Lights");
  ok(CH.pinBoardFor({ reel: true, kind: "codex" }) === "" && CH.pinBoardFor({ slot: "lead" }) === "The Islamic year, day by day", "The Codex takes the general board; the countdown the calendar");
  const sh = CH.shape({ title: "Taqwa", body: "b", link: "https://noorcodex.com/dictionary?w=1", image: "https://noorcodex.com/api/card", slot: "word" }, "pinterest");
  ok(sh.board === "Islamic words, explained" && !sh.video, "shape names the board and carries no video for a card");
  const boards = [{ id: "1", name: "NOOR Codex of Light" }, { id: "2", name: "Islamic words, explained" }];
  const P = pinterest({ boards });
  const r = await CH.sendPinterest(sh, { fetch: P.fetch });
  const pin = JSON.parse(P.calls.find(c => c.url.includes("/v5/pins")).body);
  ok(r.ok && pin.board_id === "2", "the pin lands on the words board");
  const P2 = pinterest({ boards: [{ id: "1", name: "NOOR Codex of Light" }] });
  const CH2 = await load();
  const r2 = await CH2.sendPinterest(sh, { fetch: P2.fetch });
  const pin2 = JSON.parse(P2.calls.find(c => c.url.includes("/v5/pins")).body);
  ok(r2.ok && pin2.board_id === "1", "a board not on the profile yet falls back to the general one rather than failing");
}

section("10. a reel is a video pin");
{
  clearEnv();
  process.env.PIN_TOKEN = "at-pasted"; process.env.PIN_BOARD_NAME = "NOOR Codex of Light";
  process.env.PIN_MEDIA_EVERY_MS = "5";
  const CH = await load();
  const post = { title: "With hardship, ease", caption: "the audited caption", body: "x", link: "https://noorcodex.com/verse/94",
    image: "https://noorcodex.com/reels/verse-94-5-cover.jpg", video: "https://noorcodex.com/reels/verse-94-5.mp4", reel: true, kind: "verse" };
  const sh = CH.shape(post, "pinterest");
  ok(sh.video === post.video && sh.text === "the audited caption" && sh.board === "One verse of the Qur'an", "shape carries the video, the audited caption and the verse board");
  const P = pinterest({ boards: [{ id: "1", name: "NOOR Codex of Light" }, { id: "9", name: "One verse of the Qur'an" }] });
  const r = await CH.sendPinterest(sh, { fetch: P.fetch });
  const seq = P.calls.map(c => c.url.replace("https://api.pinterest.com", ""));
  ok(r.ok && r.id === "pin-8812", "the pin is made");
  const iReg = seq.indexOf("/v5/media"), iUp = seq.findIndex(u => u.startsWith("https://pinterest-media-upload")), iPin = seq.findIndex(u => u === "/v5/pins");
  ok(iReg > -1 && iUp > iReg && iPin > iUp, "register, upload, then the pin, in that order");
  ok(seq.filter(u => u.includes("/v5/media/m-77")).length === 2, "processing is polled until it succeeds");
  const up = P.calls[iUp];
  ok(up.form && typeof up.form.get === "function" && up.form.get("key") === "k1" && up.form.get("file") && up.form.get("file").size === 4, "the upload carries Pinterest's fields and the file's bytes");
  const pin = JSON.parse(P.calls[iPin].body);
  ok(pin.media_source.source_type === "video_id" && pin.media_source.media_id === "m-77" && pin.media_source.cover_image_url === post.image && pin.board_id === "9", "the pin is a video pin with the cover, on the verse board");
  const Pf = pinterest({ mediaFails: true });
  const rf = await CH.sendPinterest(sh, { fetch: Pf.fetch });
  ok(!rf.ok && /process/.test(rf.err) && !Pf.calls.some(c => c.url.endsWith("/v5/pins")), "a video Pinterest cannot process makes no pin and says why");
}

section("11. Trial access, and the sandbox it points to");
{
  clearEnv();
  process.env.PIN_TOKEN = "at-pasted"; process.env.PIN_BOARD_NAME = "NOOR Codex of Light";
  const CH = await load();
  const P = pinterest({ trial: true });
  const r = await CH.sendPinterest(SHAPED, { fetch: P.fetch });
  ok(r.ok === false && r.fatal === true && r.trial === true && /sandbox/.test(r.err), "the Trial refusal is a state, not a fault: fatal, named, and it says what to set");
  ok(P.calls.filter(c => c.url.includes("/v5/pins")).length === 1, "and it is not tried twice in one go");

  clearEnv();
  process.env.PIN_API_BASE = "https://api-sandbox.pinterest.com";
  process.env.PIN_APP_ID = "1606775"; process.env.PIN_APP_SECRET = "s3cret";
  process.env.PIN_REFRESH_TOKEN = "rt-production"; process.env.PIN_SANDBOX_REFRESH_TOKEN = "rt-sandbox";
  process.env.PIN_BOARD_NAME = "NOOR Codex of Light";
  const CH2 = await load();
  ok(CH2.pinSandbox() === true && CH2.configured.pinterest(), "with PIN_API_BASE on the sandbox the channel is configured from the sandbox token");
  const boards = [];
  const P2 = pinterest({ boards });
  const reelShaped = CH2.shape({ title: "With hardship, ease", caption: "the caption", link: "https://noorcodex.com/verse/94",
    image: "https://noorcodex.com/reels/verse-94-5-cover.jpg", video: "https://noorcodex.com/reels/verse-94-5.mp4", reel: true, kind: "verse" }, "pinterest");
  const r2 = await CH2.sendPinterest(reelShaped, { fetch: P2.fetch });
  const tokCall = P2.calls.find(c => c.url.includes("/v5/oauth/token"));
  ok(tokCall && tokCall.url.startsWith("https://api-sandbox.pinterest.com") && tokCall.body.includes("rt-sandbox"), "the token is minted on the sandbox host from the sandbox refresh token, not the production one");
  ok(r2.ok && r2.sandbox === true, "the pin is made, and the result says it was the sandbox");
  const made = P2.calls.filter(c => c.url.endsWith("/v5/boards") && c.method === "POST").map(c => JSON.parse(c.body).name);
  ok(made.length === 1 && made[0] === "One verse of the Qur'an", "the sandbox had no boards, so the verse board was created there, once");
  const pin = JSON.parse(P2.calls.find(c => c.url.includes("/v5/pins")).body);
  ok(pin.media_source.source_type === "image_url" && pin.media_source.url === reelShaped.image && !P2.calls.some(c => c.url.endsWith("/v5/media")), "the sandbox takes no video, so the reel's cover is pinned as an image and no upload is attempted");
  ok(pin.board_id === "made-0" && P2.calls.every(c => !c.url.startsWith("https://api.pinterest.com")), "every call went to the sandbox host");
  const r3 = await CH2.sendPinterest(reelShaped, { fetch: P2.fetch });
  ok(r3.ok && P2.calls.filter(c => c.url.endsWith("/v5/boards") && c.method === "POST").length === 1, "the second pin reuses the board it made");
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
