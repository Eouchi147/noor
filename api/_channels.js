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
    /* 280 is not a truncated caption, it is a different sentence. Lead with the
       one thing worth knowing, then the link. The link costs 23 characters
       whatever its length, so budget for it rather than measuring it. */
    const room = 280 - 24 - (tags ? tags.length + 1 : 0);
    const lead = p.oneLine || p.title;
    return { text: cut(lead, room) + "\n" + link + (tags ? " " + tags : ""), image: p.image || null };
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

  /* facebook and instagram: the house caption */
  const parts = [p.title, "", p.body];
  if (p.todo && p.todo.length) parts.push("", p.todo.map(t => "• " + t).join("\n"));
  if (p.basis) parts.push("", p.basis);
  if (p.note) parts.push("", p.note);
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
  pinterest: () => !!(env("PIN_BOARD_ID") && env("PIN_TOKEN")),
  x:         () => !!(env("X_TOKEN") || (env("X_API_KEY") && env("X_API_SECRET") && env("X_ACCESS_TOKEN") && env("X_ACCESS_SECRET"))),
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
  }, { Authorization: "Bearer " + tok, "LinkedIn-Version": "202411", "X-Restli-Protocol-Version": "2.0.0" }, opts.fetch);
  return r.ok ? { ok: true, id: (r.j && r.j.id) || "posted" } : r;
}

export async function sendPinterest(shaped, opts = {}) {
  const board = env("PIN_BOARD_ID"), tok = env("PIN_TOKEN");
  if (!board || !tok) return { ok: false, err: "pinterest is not configured" };
  if (!shaped.image) return { ok: false, err: "pinterest needs an image and none was built" };
  const r = await jsonPost("https://api.pinterest.com/v5/pins", {
    board_id: board, title: shaped.title, description: shaped.text, link: shaped.link,
    media_source: { source_type: "image_url", url: shaped.image }
  }, { Authorization: "Bearer " + tok }, opts.fetch);
  return r.ok ? { ok: true, id: (r.j && r.j.id) || "pinned" } : r;
}

export async function sendX(shaped, opts = {}) {
  const tok = env("X_TOKEN");
  if (!tok) return { ok: false, err: "x needs X_TOKEN (OAuth2 user token with tweet.write)" };
  const r = await jsonPost("https://api.x.com/2/tweets", { text: shaped.text },
    { Authorization: "Bearer " + tok }, opts.fetch);
  return r.ok ? { ok: true, id: (r.j && r.j.data && r.j.data.id) || "posted" } : r;
}

/* reddit never sends. It hands back a draft with the reason attached, so the
   console can show it and a person can post it properly. */
export async function sendReddit(shaped) {
  return { ok: false, draft: true, err: "held as a draft on purpose",
    why: "Automated posting to Reddit is flagged as spam sitewide within minutes and shadowbans are rarely reversed. Post this by hand, in one subreddit where you already take part.",
    title: shaped.title, text: shaped.text };
}

export const SENDERS = { linkedin: sendLinkedIn, pinterest: sendPinterest, x: sendX, reddit: sendReddit };
