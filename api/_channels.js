/* NOOR · the six places a post can go
   ===========================================================================
   One post, six shapes. Sending the same 2,200-character block everywhere is
   how an account reads as a bot, and on two of these networks it is also how
   an account dies.

   What each network actually is:

     facebook    2,200 chars, hashtags fine, image optional.   LIVE
     instagram   2,200 chars, up to 30 tags, image REQUIRED.   LIVE
     linkedin    ~3,000 chars, 3-5 tags at most, no emoji
                 confetti. Reads as a trade journal.           needs token
     pinterest   image first. Title <=100, description <=500,
                 and a destination link -- which is what the
                 day's card already is.                        needs token
     x           280 characters. Not a truncation of the
                 caption: a different sentence.                needs token + $
     reddit      title + body, and NO hashtags -- they read
                 as spam there.                                DRAFT ONLY

   Two of those deserve a straight answer rather than a config flag.

   X: as of February 2026 there is no free tier for new developers, and the
   $200/month Basic tier is closed to new signups. The adapter below is
   complete and will work the moment a token exists, but nobody should
   discover that price from a failed cron.

   REDDIT: this one is not a cost question, it is a "do not do this" question.
   Reddit's anti-spam model flags pattern posting sitewide within minutes, and
   posting identical content across subreddits is classified as coordinated
   spam. Shadowbans there are rarely reversed, and a shadowbanned account
   cannot tell it has been shadowbanned. Reddit rewards participation and
   punishes broadcast, so this adapter deliberately does NOT post. It writes a
   draft into the queue for a human to post by hand, in one subreddit, having
   read the room. That is the only way this site keeps a Reddit presence worth
   having.
--------------------------------------------------------------------------- */

const env = k => (process.env[k] || "").trim();
/* LinkedIn versions live about twelve months and the header is mandatory on
   every call -- there is no default. 202508 sunsets in August 2026, so the
   shipped value was already past its own expiry. Kept as an env override so a
   future bump needs a Vercel variable, not a deploy. */
const LI_VERSION = env("LI_VERSION") || "202608";
/* trims to a length WITHOUT flattening the post. The first version collapsed
   every run of whitespace, newlines included, which turned a structured post
   with a heading, a body and a bulleted list into one grey paragraph on every
   network at once. Runs of spaces collapse; line breaks are structure and
   survive, capped at one blank line so a stray gap cannot become a chasm. */
const cut = (s, n) => {
  s = String(s || "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n")
       .split("\n").map(l => l.trim()).join("\n").trim();
  return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…";
};

/* ---------------------------------------------------------------------------
   the shape each network wants
--------------------------------------------------------------------------- */
export const SPEC = {
  facebook:  { chars: 2200, tags: 8,  image: "optional", live: true  },
  instagram: { chars: 2200, tags: 30, image: "required", live: true  },
  linkedin:  { chars: 3000, tags: 4,  image: "optional", live: false },
  pinterest: { chars: 500,  tags: 3,  image: "required", live: false },
  x:         { chars: 280,  tags: 2,  image: "optional", live: false },
  reddit:    { chars: 4000, tags: 0,  image: "optional", live: false }
};

/* one post, told six different ways. `p` is what compose() built:
   { title, body, todo[], basis, url, link, image, tags[] } */
export function shape(p, ch) {
  const s = SPEC[ch]; if (!s) return null;
  const tags = (p.tags || []).slice(0, s.tags).join(" ");
  const link = p.link || "";

  if (ch === "x") {
    /* 280 is not a truncated caption, it is a different sentence.
       And on X the link is not free in the ordinary sense: since the 2026 move
       to pay-per-use, a post CONTAINING a URL is billed at $0.20 where a post
       without one is $0.015 -- thirteen times more, for one field. Four posts a
       day is the difference between about $24 a month and about $1.80. So the
       link is a switch, not an assumption. Default keeps it, because a library
       post nobody can follow is worth less than the saving; X_OMIT_LINK=1 turns
       it off for anyone who would rather have the money. */
    const withLink = env("X_OMIT_LINK") !== "1";
    const room = 280 - (withLink ? 24 : 0) - (tags ? tags.length + 1 : 0);
    const lead = p.oneLine || p.title;
    return { text: cut(lead, room) + (withLink ? "\n" + link : "") + (tags ? " " + tags : ""),
             image: p.image || null };
  }

  if (ch === "pinterest") {
    return {
      title: cut(p.title, 100),
      text: cut([p.body, p.basis].filter(Boolean).join(" "), 500),
      image: p.image, link
    };
  }

  if (ch === "linkedin") {
    /* the register shifts: no hashtag wall, and the basis is a citation rather
       than a flourish, because that is what this audience reads for */
    const parts = [p.title, "", p.body];
    if (p.todo && p.todo.length) parts.push("", p.todo.map(t => "• " + t).join("\n"));
    if (p.basis) parts.push("", p.basis);
    if (p.invite) parts.push("", p.invite);
    parts.push("", link);
    if (tags) parts.push("", tags);
    return { text: cut(parts.join("\n"), s.chars), image: p.image || null };
  }

  if (ch === "reddit") {
    /* no tags, no promo block, and the link at the end as a source rather than
       a call to action. A Reddit post that reads like an advert is removed. */
    const parts = [p.body];
    if (p.todo && p.todo.length) parts.push("", p.todo.map(t => "- " + t).join("\n"));
    if (p.basis) parts.push("", "*" + p.basis + "*");
    if (p.note) parts.push("", "> " + p.note);
    parts.push("", "Fuller version: " + link);
    return { title: cut(p.title, 300), text: cut(parts.join("\n"), s.chars), image: p.image || null };
  }

  /* A reel arrives with its caption already written and audited beside the
     video it belongs to, so the house builder is not asked to assemble a
     second, worse one under a video that has already said it. */
  if (p.caption) return { text: cut(p.caption, s.chars), image: p.image || null };

  /* facebook and instagram: the house caption. The invitation sits between
     the material and the link: first the teaching, whole; then, for whoever
     the picture stopped, what the library is and that it is free; the link
     and the tags close. Reddit deliberately never carries it -- a promotion
     there costs the account -- and X has no room for it. */
  const parts = [p.title, "", p.body];
  if (p.todo && p.todo.length) parts.push("", p.todo.map(t => "• " + t).join("\n"));
  if (p.basis) parts.push("", p.basis);
  if (p.note) parts.push("", p.note);
  if (p.invite) parts.push("", p.invite);
  parts.push("", link);
  if (tags) parts.push("", tags);
  return { text: cut(parts.join("\n"), s.chars), image: p.image || null };
}

/* ---------------------------------------------------------------------------
   is a channel switched on, and can it actually send
--------------------------------------------------------------------------- */
export const configured = {
  facebook:  () => !!(env("FB_PAGE_ID") && env("FB_PAGE_TOKEN")),
  instagram: () => !!(env("IG_USER_ID") && (env("IG_TOKEN") || env("IG_ACCESS_TOKEN") || env("FB_PAGE_TOKEN"))),
  linkedin:  () => !!(env("LI_ORG_URN") && env("LI_TOKEN")),
  /* A board (by id or by name) and some way to hold a token: either one
     pasted in, or the app credentials that can mint one. */
  pinterest: () => !!((env("PIN_BOARD_ID") || env("PIN_BOARD_NAME")) &&
                      (env("PIN_TOKEN") ||
                       (env("PIN_APP_ID") && env("PIN_APP_SECRET") && env("PIN_REFRESH_TOKEN")))),
  /* X is double-gated on purpose. Every post there is billed, and a post
     carrying a link is billed at thirteen times the base rate, so a token
     sitting in the environment must not be enough to start spending. It takes
     a token AND X_ENABLE=1. A retry loop on a broken cron is a billable event;
     this is the switch that means one cannot happen by accident. */
  x:         () => env("X_ENABLE") === "1" &&
                   !!(env("X_TOKEN") || (env("X_API_KEY") && env("X_API_SECRET") && env("X_ACCESS_TOKEN") && env("X_ACCESS_SECRET"))),
  /* deliberately never "configured" for sending. See the note at the top. */
  reddit:    () => false
};
export const draftOnly = new Set(["reddit"]);
export const ALL = Object.keys(SPEC);

/* ---------------------------------------------------------------------------
   the senders. Each returns { ok, id } or { ok:false, err }.
--------------------------------------------------------------------------- */
async function jsonPost(url, body, headers, fetcher) {
  const r = await (fetcher || fetch)(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body)
  });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch { }
  if (!r.ok) return { ok: false, err: (j && (j.message || (j.error && (j.error.message || j.error)))) || ("http " + r.status) };
  return { ok: true, j };
}

export async function sendLinkedIn(shaped, opts = {}) {
  const urn = env("LI_ORG_URN"), tok = env("LI_TOKEN");
  if (!urn || !tok) return { ok: false, err: "linkedin is not configured" };
  const r = await jsonPost("https://api.linkedin.com/rest/posts", {
    author: urn, commentary: shaped.text, visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: "PUBLISHED", isReshareDisabledByAuthor: false
  }, { Authorization: "Bearer " + tok, "LinkedIn-Version": LI_VERSION, "X-Restli-Protocol-Version": "2.0.0" }, opts.fetch);
  return r.ok ? { ok: true, id: (r.j && r.j.id) || "posted" } : r;
}

/* A Pinterest access token dies after 30 days. The refresh token rolls on a
   60-day window that renews each time it is used, so a site that posts daily
   never falls out -- but only if something actually performs the refresh. This
   does it inline on the first 401 rather than leaving a cron to fail silently
   for a month. The new access token is held in memory for this lambda; the
   rotating refresh token is reported back so the console can show that it
   changed and needs storing. */
let PIN_MEM = { tok: "", at: 0 };

/* Pinterest has two worlds: api.pinterest.com, and api-sandbox.pinterest.com
   where writes are free and nothing reaches a real profile. An app waiting on
   Pinterest's review cannot post to the first one, so without this the whole
   path stays untested until the day it goes live, which is the worst possible
   day to find out. PIN_API_BASE moves every call at once. */
export const pinBase = () => (env("PIN_API_BASE") || "https://api.pinterest.com").replace(/\/+$/, "");

async function pinRefresh(fetcher) {
  const id = env("PIN_APP_ID"), sec = env("PIN_APP_SECRET"), rt = env("PIN_REFRESH_TOKEN");
  if (!id || !sec || !rt) return null;
  try {
    const r = await (fetcher || fetch)(pinBase() + "/v5/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded",
                 Authorization: "Basic " + Buffer.from(id + ":" + sec).toString("base64") },
      body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(rt)
    });
    if (!r.ok) return null;
    const j = await r.json();
    if (j && j.access_token) { PIN_MEM = { tok: j.access_token, at: Date.now() }; return j.access_token; }
  } catch { }
  return null;
}

/* A board id is a nineteen digit number that appears nowhere in the Pinterest
   interface: you can only get it from the API. Asking the owner to find one is
   asking him to do by hand the one thing the API is for, so the board may be
   named instead and looked up once. The answer is held for the life of the
   lambda; boards do not get renamed mid-afternoon. */
let PIN_BOARD_MEM = { id: "", name: "", at: 0 };
export async function pinBoardId(tok, opts = {}) {
  const fixed = env("PIN_BOARD_ID");
  if (fixed) return fixed;
  const want = (env("PIN_BOARD_NAME") || "").trim();
  if (!want || !tok) return "";
  if (PIN_BOARD_MEM.id && PIN_BOARD_MEM.name === want && Date.now() - PIN_BOARD_MEM.at < 6 * 3600000)
    return PIN_BOARD_MEM.id;
  try {
    const r = await (opts.fetch || fetch)(pinBase() + "/v5/boards?page_size=100",
      { headers: { Authorization: "Bearer " + tok } });
    if (!r.ok) return "";
    const j = await r.json();
    const list = (j && j.items) || [];
    const hit = list.find(b => String(b.name || "").trim().toLowerCase() === want.toLowerCase());
    if (hit && hit.id) { PIN_BOARD_MEM = { id: String(hit.id), name: want, at: Date.now() }; return String(hit.id); }
  } catch { }
  return "";
}

export async function sendPinterest(shaped, opts = {}) {
  let tok = (PIN_MEM.tok && Date.now() - PIN_MEM.at < 20 * 86400000) ? PIN_MEM.tok : env("PIN_TOKEN");
  /* No access token in the environment is the normal state once the app is
     live: only the rotating refresh token is stored, and the access token is
     minted from it. Refresh first rather than failing on an absence. */
  if (!tok) tok = await pinRefresh(opts.fetch);
  if (!tok) return { ok: false, err: "pinterest is not configured: no PIN_TOKEN and no working PIN_REFRESH_TOKEN" };
  const board = await pinBoardId(tok, opts);
  if (!board) return { ok: false, err: "pinterest has no board: set PIN_BOARD_ID or PIN_BOARD_NAME" };
  if (!shaped.image) return { ok: false, err: "pinterest needs an image and none was built" };
  const body = {
    board_id: board, title: shaped.title, description: shaped.text, link: shaped.link,
    media_source: { source_type: "image_url", url: shaped.image }
  };
  let r = await jsonPost(pinBase() + "/v5/pins", body, { Authorization: "Bearer " + tok }, opts.fetch);
  if (!r.ok && /401|expired|unauthor/i.test(String(r.err))) {
    const fresh = await pinRefresh(opts.fetch);
    if (fresh) r = await jsonPost(pinBase() + "/v5/pins", body, { Authorization: "Bearer " + fresh }, opts.fetch);
  }
  return r.ok ? { ok: true, id: (r.j && r.j.id) || "pinned" } : r;
}

export async function sendX(shaped, opts = {}) {
  const tok = env("X_TOKEN");
  if (!tok) return { ok: false, err: "x needs X_TOKEN (OAuth2 user token with tweet.write)" };
  const r = await jsonPost("https://api.x.com/2/tweets", { text: shaped.text },
    { Authorization: "Bearer " + tok }, opts.fetch);
  return r.ok ? { ok: true, id: (r.j && r.j.data && r.j.data.id) || "posted" } : r;
}

/* ===========================================================================
   REDDIT · THE ONE-CLICK HAND-OFF

   The problem with automating Reddit is not the API, which permits posting.
   It is that Reddit's spam model reads *pattern* -- same domain, on a
   schedule, across subreddits you do not moderate -- and answers with a
   sitewide shadowban you cannot see. Your posts look normal to you and are
   invisible to everyone else, sometimes for weeks. Worse, it can escalate to
   a domain ban on noorcodex.com, which silently punishes every reader who
   ever links the site in good faith.

   Rate-limiting an automated poster does not fix this. A bot posting once a
   week is still a bot posting on a schedule, and the pattern is the thing
   being detected.

   So this does not post at all. It builds a Reddit submit URL with the title
   and body already filled in, and hands it over. You click it, you are on
   Reddit in your own session, you read the room, you press submit. To Reddit
   that is a person posting, because it is. There is no automation to detect.

   Two guards remain, both about you rather than about Reddit's filter:
   a subreddit allowlist, so a draft can only ever be aimed somewhere you
   actually take part; and a cooling-off period, because the community norm is
   roughly one self-promotional post per nine genuine contributions and a
   fortnight between links is a rhythm that respects it.
=========================================================================== */
export const redditSubs = () =>
  env("REDDIT_SUBS").split(",").map(x => x.trim().replace(/^\/?r\//, "")).filter(Boolean);
export const redditEveryDays = () => {
  const n = parseInt(env("REDDIT_EVERY_DAYS"), 10);
  return Number.isFinite(n) && n > 0 ? n : 14;
};
export function redditSubmitUrl(sub, title, text) {
  return "https://www.reddit.com/r/" + encodeURIComponent(sub) + "/submit"
    + "?title=" + encodeURIComponent(String(title).slice(0, 300))
    + "&text=" + encodeURIComponent(String(text).slice(0, 40000));
}
export async function sendReddit(shaped, opts = {}) {
  const subs = redditSubs();
  const every = redditEveryDays();
  const last = opts.lastRedditAt ? Date.parse(opts.lastRedditAt) : 0;
  const daysSince = last ? (Date.now() - last) / 86400000 : Infinity;
  const cooling = daysSince < every;
  return {
    ok: false, draft: true,
    err: cooling
      ? "holding — " + Math.ceil(every - daysSince) + " more day(s) before the next one"
      : (subs.length ? "ready for you to post" : "ready, but no subreddit is set"),
    why: "Nothing is posted to Reddit automatically. Automated posting is read as spam and answered with a shadowban you cannot see. This is a draft with a one-click link; you post it yourself.",
    cooling, daysSince: Number.isFinite(daysSince) ? Math.floor(daysSince) : null, every,
    title: shaped.title, text: shaped.text,
    /* one link per allowed subreddit, already filled in */
    links: cooling ? [] : subs.map(sr => ({ sub: sr, url: redditSubmitUrl(sr, shaped.title, shaped.text) })),
    hint: subs.length ? "" : "Set REDDIT_SUBS to the subreddits you actually take part in, comma separated."
  };
}

export const SENDERS = { linkedin: sendLinkedIn, pinterest: sendPinterest, x: sendX, reddit: sendReddit };
