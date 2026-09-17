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
/* upload, to put a Short up; readonly, to read what it did afterwards. The
   first consent carried upload alone, and the Readers room was answered
   "insufficient authentication scopes" for every Short: a token that can
   publish a video cannot count its views. One consent grants both. */
export const SCOPE = "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly";
const K_ACCESS = "nsoc:yt:access";
const K_DAY = d => "nsoc:yt:day:" + d;
export const DAILY_CAP = 6;          /* six reel slots a day: 6 x 1,600 = 9,600 of the 10,000 units; the reads cost one to three each. It was 5, and the sixth reel of every day was refused as over quota, forever. */
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

/* the plain title, no #Shorts: for the ordinary 16:9 video beside a
   short's own Short (shapeWide, below), which is not filed as one and so
   is titled the film's own name rather than the reel's hook. */
export function titlePlain(p) {
  let t = String(p.title || p.hook || "NOOR").replace(/\s+/g, " ").trim();
  if (t.length > 100) t = t.slice(0, 99).replace(/\s+\S*$/, "") + "…";
  return t;
}

/* what the sender needs from the post, in one place */
export function shape(p) {
  const desc = String(p.caption || p.body || "").replace(/[ \t]+/g, " ").trim();
  const tags = (desc.match(/#\w+/g) || []).map(t => t.slice(1)).slice(0, 15);
  return { title: title(p), description: desc.slice(0, 4900), tags: [...new Set(["NOOR", "Islam", ...tags])].slice(0, 15),
           video: p.video || null, image: p.image || null, text: desc };
}

/* THE ORDINARY 16:9 VIDEO BESIDE A SHORT'S OWN SHORT.
   The owner's instruction of 16 September 2026: a short with a wide file
   goes to YouTube twice, the tall file as a Short and the wide file as a
   normal, longer-form video -- same channel, same category and language
   (upload(), below, sets both the same way for every video it sends), no
   #Shorts, the film's own title rather than the hook. Built the same way
   shape() is, minus the suffix. */
export function shapeWide(p) {
  const desc = String(p.caption || p.body || "").replace(/[ \t]+/g, " ").trim();
  const tags = (desc.match(/#\w+/g) || []).map(t => t.slice(1)).slice(0, 15);
  return { title: titlePlain(p), description: desc.slice(0, 4900), tags: [...new Set(["NOOR", "Islam", ...tags])].slice(0, 15),
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
  /* opts.short: true (the default, every call before 16 September 2026) is
     the Short's own /shorts/ url; false is shapeWide's ordinary video,
     which the same path would misfile -- a 16:9 upload has no business
     under /shorts/. */
  const isShort = opts.short !== false;
  const out = { ok: true, id: j.id,
    url: isShort ? ("https://youtube.com/shorts/" + j.id) : ("https://www.youtube.com/watch?v=" + j.id),
    privacy: st.privacyStatus || "" };
  if (st.privacyStatus && st.privacyStatus !== "public") {
    out.note = "YouTube kept it " + st.privacyStatus + ": the project has not passed the API audit yet, so only you can see it. It is uploaded; it is not published.";
    out.private = true;
  }
  return out;
}

const VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";
/* WHAT BECAME OF A VIDEO ALREADY UPLOADED, READ THE WAY fbReelStatus (in
   api/social.js) READS FACEBOOK'S: one look, not a poll held open. A
   duplicate refusal -- YouTube's own guard against the same file landing
   twice, which the wide upload beside a short's own Short can trip --
   sometimes only surfaces once YouTube has finished processing the file,
   which can run well past this run's own clock; a look that lands before
   then is reported pending rather than treated as a failure, and nothing
   here starts the upload over because of it, the same restraint a
   Facebook reel the clock cut is given by the finisher rather than a
   fresh attempt. */
export async function status(id, opts = {}) {
  const fetcher = opts.fetch || fetch;
  const tok = await accessToken(fetcher, opts);
  if (!tok.ok) return { ok: false, pending: true, error: tok.err };
  try {
    const r = await fetcher(VIDEOS_URL + "?part=status&id=" + encodeURIComponent(id),
      { headers: { authorization: "Bearer " + tok.token } });
    const j = await r.json().catch(() => null);
    const item = j && Array.isArray(j.items) && j.items[0];
    if (!r.ok || !item) return { ok: false, pending: true, error: "status http " + (r && r.status) };
    const st = item.status || {};
    if (st.uploadStatus === "rejected")
      return { ok: false, duplicate: st.rejectionReason === "duplicate", reason: st.rejectionReason || "rejected" };
    if (st.uploadStatus === "processed") return { ok: true };
    /* "uploaded": accepted, not yet processed -- YouTube's normal state in
       the seconds right after an insert, and the common answer here */
    return { ok: false, pending: true };
  } catch (e) {
    return { ok: false, pending: true, error: String(e && e.message || e).slice(0, 80) };
  }
}

/* WHAT A SHORT DID, IN NUMBERS. api/_insights.js already asks for statistics
   alone, on demand, for the Readers room's read-back; this is the same edge
   asked with contentDetails alongside it, for the daily snapshot (masterplan
   step 8), which wants a video's length as well as its counts, and takes the
   access token handed to it rather than minting its own -- one snapshot walk
   reads many ids and a token good for the hour is not re-fetched per id. Up
   to fifty ids in one call, YouTube's own ceiling; a call that fails names
   the whole chunk's error rather than throwing, the same restraint every
   network read in this house keeps, so one bad id never stops the rest. */
export async function ytStats(ids, tok, opts = {}) {
  const fetcher = opts.fetch || fetch;
  const out = {};
  const list = Array.isArray(ids) ? ids.filter(Boolean) : [];
  if (!list.length) return out;
  if (!tok) { list.forEach(id => { out[id] = { error: "no YouTube token" }; }); return out; }
  for (let i = 0; i < list.length; i += 50) {
    const chunk = list.slice(i, i + 50);
    let r, j;
    try {
      r = await fetcher(VIDEOS_URL + "?part=statistics,contentDetails&id=" + chunk.map(encodeURIComponent).join(","),
                        { headers: { authorization: "Bearer " + tok } });
      j = await r.json().catch(() => ({}));
    } catch (e) { chunk.forEach(id => { out[id] = { error: String(e && e.message || e).slice(0, 160) }; }); continue; }
    if (!r.ok) {
      const why = (j && j.error && (j.error.message || j.error.status)) || ("http " + r.status);
      chunk.forEach(id => { out[id] = { error: "YouTube refused: " + why }; });
      continue;
    }
    const seen = {};
    for (const it of (j && Array.isArray(j.items) ? j.items : [])) {
      const s = it.statistics || {}, cd = it.contentDetails || {};
      seen[it.id] = { viewCount: s.viewCount != null ? Number(s.viewCount) : null,
                      likeCount: s.likeCount != null ? Number(s.likeCount) : null,
                      commentCount: s.commentCount != null ? Number(s.commentCount) : null,
                      duration: cd.duration || null };
    }
    chunk.forEach(id => { out[id] = seen[id] || { error: "YouTube lists no such video" }; });
  }
  return out;
}
