/* NOOR · YouTube Shorts, the third home for a reel
   ===========================================================================
   The same 1080x1920 file that goes to Instagram and Facebook goes here too,
   with a title, the caption as its description, and #Shorts on it. Nothing
   else changes: the caption was written and audited beside the video.

   WHAT IT COSTS. The YouTube Data API is free, with a quota of 10,000 units a
   day, and one upload costs 1,600 of them. Six a day is the ceiling; the
   house sends two. A counter in the store keeps it there even if a retry loop
   or a hand-run ever disagrees.

   WHAT IT NEEDS. A Google Cloud project with the YouTube Data API v3 on, an
   OAuth client (web application) whose redirect URI is this site's
   /youtube/callback, and one consent from the owner, given once at
   /api/youtube?action=auth. That consent yields a refresh token, which is
   shown once and pasted into Vercel as YT_REFRESH_TOKEN, exactly as the
   Pinterest token is. The house keeps no copy of it.

   THE ONE THING GOOGLE DOES NOT SAY LOUDLY. A project that has not passed
   the YouTube API compliance audit uploads every video as PRIVATE, whatever
   privacy it asked for. The audit is a free form and is normally granted to a
   non-commercial project like this one; until it is, the reels land on the
   channel but only the owner can see them. The sender notices when the
   answer comes back private and says so, rather than reporting a public post
   that is not.
--------------------------------------------------------------------------- */
import { kv, kvReady } from "./_kv.js";

const env = k => (process.env[k] || "").trim();
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status";
export const SCOPE = "https://www.googleapis.com/auth/youtube.upload";
const K_ACCESS = "nsoc:yt:access";
const K_DAY = d => "nsoc:yt:day:" + d;
export const DAILY_CAP = 5;          /* 5 x 1,600 = 8,000 of the 10,000 units, with room for the rest */
const CATEGORY_EDUCATION = "27";

export const configured = () => !!(env("YT_CLIENT_ID") && env("YT_CLIENT_SECRET") && env("YT_REFRESH_TOKEN"));

export function redirectUri(host) {
  return "https://" + String(host).replace(/^https?:\/\//, "") + "/youtube/callback";
}

export function authUrl(host, state) {
  return AUTH_URL + "?" + new URLSearchParams({
    client_id: env("YT_CLIENT_ID"), redirect_uri: redirectUri(host), response_type: "code",
    scope: SCOPE, access_type: "offline", prompt: "consent", include_granted_scopes: "true", state
  }).toString();
}

/* the code from the consent screen, traded for the tokens; the refresh token
   is what matters and it is handed back to be shown once */
export async function exchange(host, code, fetcher) {
  const r = await (fetcher || fetch)(TOKEN_URL, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: env("YT_CLIENT_ID"), client_secret: env("YT_CLIENT_SECRET"),
                                redirect_uri: redirectUri(host), grant_type: "authorization_code" }).toString()
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j) return { ok: false, err: (j && (j.error_description || j.error)) || ("http " + r.status) };
  if (!j.refresh_token) return { ok: false, err: "Google returned no refresh token: revoke the app at myaccount.google.com/permissions and consent again" };
  return { ok: true, refresh: j.refresh_token, access: j.access_token, scope: j.scope };
}

/* an access token, minted from the refresh token and kept for its hour */
export async function accessToken(fetcher, opts = {}) {
  if (!opts.fresh && kvReady()) {
    try { const c = (await kv([["GET", K_ACCESS]]))[0]; if (c) return { ok: true, token: c }; } catch { }
  }
  const r = await (fetcher || fetch)(TOKEN_URL, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ refresh_token: env("YT_REFRESH_TOKEN"), client_id: env("YT_CLIENT_ID"),
                                client_secret: env("YT_CLIENT_SECRET"), grant_type: "refresh_token" }).toString()
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || !j.access_token) {
    const code = String((j && j.error) || "");
    const why = (j && (j.error_description || j.error)) || ("http " + r.status);
    /* invalid_grant is the one that needs a person: the consent was revoked,
       or the token expired because the OAuth app was left in Testing */
    return { ok: false, err: code === "invalid_grant" ? "invalid_grant: " + why : why,
             fatal: /invalid_grant/i.test(code + " " + why) };
  }
  const ttl = Math.max(60, Math.min(3500, Number(j.expires_in || 3600) - 90));
  if (kvReady()) { try { await kv([["SET", K_ACCESS, j.access_token, "EX", String(ttl)]]); } catch { } }
  return { ok: true, token: j.access_token };
}

/* how many went up today, so the quota is never the thing that fails */
export async function usedToday(date) {
  if (!kvReady()) return 0;
  try { return Number((await kv([["GET", K_DAY(date)]]))[0] || 0); } catch { return 0; }
}
async function countOne(date) {
  if (!kvReady()) return;
  try { await kv([["INCR", K_DAY(date)], ["EXPIRE", K_DAY(date), "172800"]]); } catch { }
}

/* the title YouTube shows: the hook, cut to its 100, with #Shorts so the
   file is filed where a vertical minute belongs */
export function title(p) {
  let t = String(p.title || p.hook || "NOOR").replace(/\s+/g, " ").trim();
  const tail = " #Shorts";
  if (t.length + tail.length > 100) t = t.slice(0, 100 - tail.length - 1).replace(/\s+\S*$/, "") + "…";
  return t + tail;
}

/* what the sender needs from the post, in one place */
export function shape(p) {
  const desc = String(p.caption || p.body || "").replace(/[ \t]+/g, " ").trim();
  const tags = (desc.match(/#\w+/g) || []).map(t => t.slice(1)).slice(0, 15);
  return { title: title(p), description: desc.slice(0, 4900), tags: [...new Set(["NOOR", "Islam", ...tags])].slice(0, 15),
           video: p.video || null, image: p.image || null, text: desc };
}

/* the upload itself: the file is fetched from the site and sent in one
   multipart request, which is what a two megabyte reel wants; the resumable
   protocol is for files that could fail halfway */
export async function upload(shaped, opts = {}) {
  const fetcher = opts.fetch || fetch;
  const date = opts.date || new Date().toISOString().slice(0, 10);
  if (!configured()) return { ok: false, skipped: "YouTube is not connected (YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN)" };
  if (!shaped.video) return { ok: false, error: "no video for YouTube", err: "no video for YouTube" };
  const used = await usedToday(date);
  if (used >= DAILY_CAP) return { ok: false, error: "YouTube's daily quota is spent (" + used + " uploads today)", err: "quota", quota: true };

  const tok = await accessToken(fetcher);
  if (!tok.ok) return { ok: false, error: "YouTube token: " + tok.err, err: tok.err, fatal: !!tok.fatal, code: tok.fatal ? "invalid_grant" : "token" };

  let bytes;
  try {
    const v = await fetcher(shaped.video);
    if (!v.ok) return { ok: false, error: "the video could not be fetched (http " + v.status + ")", err: "video http " + v.status };
    bytes = Buffer.from(await v.arrayBuffer());
  } catch (e) { return { ok: false, error: "the video could not be fetched: " + String(e && e.message || e).slice(0, 80), err: "video fetch" }; }
  if (bytes.length < 20000) return { ok: false, error: "the video is " + bytes.length + " bytes, which is not a video", err: "video empty" };

  const meta = { snippet: { title: shaped.title, description: shaped.description, tags: shaped.tags,
                            categoryId: CATEGORY_EDUCATION, defaultLanguage: "en" },
                 status: { privacyStatus: "public", selfDeclaredMadeForKids: false, embeddable: true } };
  const boundary = "noor" + Date.now().toString(36);
  const head = Buffer.from("--" + boundary + "\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n" +
                           JSON.stringify(meta) + "\r\n--" + boundary + "\r\ncontent-type: video/mp4\r\n\r\n");
  const tail = Buffer.from("\r\n--" + boundary + "--\r\n");
  const body = Buffer.concat([head, bytes, tail]);

  let r, j;
  try {
    r = await fetcher(UPLOAD_URL, { method: "POST",
      headers: { authorization: "Bearer " + tok.token, "content-type": "multipart/related; boundary=" + boundary,
                 "content-length": String(body.length) }, body });
    j = await r.json().catch(() => null);
  } catch (e) { return { ok: false, error: "YouTube did not answer: " + String(e && e.message || e).slice(0, 80), err: "network" }; }
  if (!r.ok || !j || !j.id) {
    const why = (j && j.error && (j.error.message || j.error.status)) || ("http " + r.status);
    const reason = j && j.error && j.error.errors && j.error.errors[0] && j.error.errors[0].reason || "";
    /* quotaExceeded is worth naming: it is the one that will clear by itself tomorrow */
    return { ok: false, error: "YouTube refused: " + why, err: why, code: reason || r.status,
             quota: /quota/i.test(reason + why), fatal: /forbidden|uploadLimitExceeded/i.test(reason) };
  }
  await countOne(date);
  const st = j.status || {};
  const out = { ok: true, id: j.id, url: "https://youtube.com/shorts/" + j.id, privacy: st.privacyStatus || "" };
  if (st.privacyStatus && st.privacyStatus !== "public") {
    out.note = "YouTube kept it " + st.privacyStatus + ": the project has not passed the API audit yet, so only you can see it. It is uploaded; it is not published.";
    out.private = true;
  }
  return out;
}
