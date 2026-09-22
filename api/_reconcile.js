/* NOOR · what a network actually holds, set against what the house believes
   ===========================================================================
   WHY THIS FILE EXISTS

   On 21 September 2026 the owner found one of his films on YouTube twice,
   sent on the 7th and again on the 21st. Three faults were fixed that day:
   the picker now steps past what has gone out, the guard's window went from
   twenty one days to sixty, and backfillPosted wrote 319 sends into the hash
   the guard reads. Every one of those makes the house's own memory better.

   None of them would have FOUND the duplicate. The owner found it, in his
   own Studio, by looking. The house had no way to ask a network what it
   actually holds, so a gap between the ledger and the world could only ever
   be discovered by a person happening to scroll.

   The masterplan says it in one line, section 11: never treat a successful
   API response as proof of final publication, verify the actual platform
   result. An ok from an upload call means the request was accepted. It does
   not mean the video is there today, it does not mean it is there once, and
   its absence from our ledger does not mean nothing was sent.

   So this reads the other side. It enumerates what a network really carries,
   sets it against what our records claim, and names three things:

     absent      the ledger says this reel went to this network, and the
                 network does not have it. A silent failure, or something
                 removed since.
     unrecorded  the network holds one of our reels and no record of ours
                 says we sent it. This is the 7 September case exactly.
     twice       the network holds the same reel more times than it should.

   WHAT IT DOES NOT DO. It writes nothing, anywhere, to any network or to the
   store. It has no opinion about what should be done with a finding. A pass
   that can only report cannot itself become the next silent failure.

   WHAT IT CANNOT SEE, SAID HERE RATHER THAN DISCOVERED LATER. An item is
   named back to a reel by the platform's own id where a record of ours kept
   one, and by its title otherwise. A reel that has left the shelf AND whose
   sends are outside the ledger's reach can be named by neither, so it is
   reported as a video on the channel that is not from the shelf. That is
   true, and it is also the shape a duplicate among long retired reels would
   take. Reaching further back in the ledger is the remedy and the reach is
   the caller's.

   THE RULE THAT MATTERS MOST. A network this cannot enumerate must never
   read as clean. Telegram's bot API cannot list a channel's history at all;
   an adapter that has not been written yet is not the same thing as a
   network with nothing wrong. Both say so by name, and neither produces a
   finding of any kind, because "we did not look" and "we looked and all is
   well" are different sentences and only one of them is reassuring. This is
   the fault of the whole of this week in a new costume: a step doing nothing
   and the next step believing it.
--------------------------------------------------------------------------- */

import * as YT from "./_youtube.js";
import * as CH from "./_channels.js";
import { buildSlot, REEL_SLOTS } from "./_schedule.js";

/* -------------------------------------------------------------------------
   NAMING A PLATFORM ITEM BACK TO A REEL

   The ledger holds the platform's own id for anything it recorded, and an id
   match is exact. For an item the ledger never recorded, which is precisely
   the item this pass exists to find, there is no id, and the title is what is
   left: the network was handed a title this house built, so building it again
   the same way names the item.

   THE SAME WAY MEANS THE SAME ROAD, NOT A COPY OF ITS LAST STEP. The first cut
   of this file called YT.title(card), which prefers the card's own title, and
   the sender never does that for a Short: buildSlot puts the hook in the
   post's title for an ordinary reel, and the short branch of the channel
   shaper overrides a film's name with its hook on purpose. So every film whose
   name differs from its hook, which is every film, went up under a title the
   index had never heard of. Fed the owner's own 7 September case, the pass
   filed the duplicate as "not from the shelf" and reported the two sides in
   agreement. The refuter found it; a test built from the same wrong premise
   had been passing beside it.

   So the card is run through buildSlot and CH.shape exactly as the poster runs
   it, and the wide title through CH.shapeYouTubeWide exactly as the dual
   upload builds it. If either ever changes how it titles a video, this index
   changes with it, because it is the same code.

   A short with a wide file goes to YouTube TWICE BY DESIGN, the tall file as a
   Short and the wide file as an ordinary video (the owner's instruction of 16
   September). Two items for such a reel is correct and must not be called a
   duplicate; the index therefore records what each title means, "short" or
   "wide", so the count is judged per shape rather than per reel.
------------------------------------------------------------------------- */

const ANY_REEL_SLOT = REEL_SLOTS[0];

/* the post the poster would build for this card, or null */
function postFor(card) {
  if (!card || !card.id) return null;
  /* buildSlot declines a row with no video, and a title does not depend on
     the file, so a card missing its address is still given one to be named */
  const row = card.video ? card : { ...card, video: "https://noorcodex.com/reels/" + card.id + ".mp4" };
  try { return buildSlot(ANY_REEL_SLOT, { reel: row, base: "" }); } catch { return null; }
}

/* the titles YouTube was actually given for this card, by shape */
export function youtubeTitles(card) {
  const post = postFor(card);
  if (!post) return {};
  const out = {};
  try { const s = CH.shape(post, "youtube"); if (s && s.title) out.short = s.title; } catch { }
  try { const w = CH.shapeYouTubeWide(post); if (w && w.title) out.wide = w.title; } catch { }
  return out;
}

/* how many items a reel should legitimately have on a network, per shape.
   The total alone is not enough: a film is allowed two videos, so its Short
   going up twice comes to two and passes a total of two untouched. Two Shorts
   is a duplicate whatever else the reel is allowed. */
export function allowanceOn(card, network) {
  if (network !== "youtube") return { total: 1, short: 1, wide: 0 };
  /* A CARD OFF THE SHELF IS NOT A CARD WITH NO WIDE FILE. A reel leaves the
     shelf once every network has it (the owner's rule of 9 September), so a
     retired film still has its Short and its wide video on the channel,
     lawfully, while the card that would have said so is gone. Read as "no
     wide", that pair is a duplicate. So ignorance is lenient: one of each
     shape, which still catches two Shorts, and the finding says it assumed. */
  if (!card) return { total: 2, short: 1, wide: 1, assumed: true };
  const w = card.wide ? 1 : 0;
  return { total: 1 + w, short: 1, wide: w };
}
export function expectedOn(card, network) { return allowanceOn(card, network).total; }

/* title -> [{ reel, shape }]. A title claimed by more than one card keeps all
   of its claimants: an ambiguous name is reported as ambiguous, because
   guessing which card a video belongs to is how a wrong duplicate gets
   announced to somebody who then stops believing the tool. */
export function titleIndex(cards, network = "youtube") {
  const by = new Map();
  const add = (t, reel, shape) => {
    const k = norm(t);
    if (!k) return;
    if (!by.has(k)) by.set(k, []);
    const list = by.get(k);
    if (!list.some(e => e.reel === reel && e.shape === shape)) list.push({ reel, shape });
  };
  for (const c of (Array.isArray(cards) ? cards : [])) {
    if (!c || !c.id) continue;
    if (network === "youtube") {
      const t = youtubeTitles(c);
      if (t.short) add(t.short, c.id, "short");
      if (t.wide) add(t.wide, c.id, "wide");
    }
  }
  return by;
}

/* compared on collapsed whitespace, case folded: neither carries meaning
   here and both have been seen to differ. The ellipsis a cut title ends with
   is a real character and is left alone. */
export function norm(s) {
  return String(s == null ? "" : s).replace(/\s+/g, " ").trim().toLowerCase();
}

/* Below this share of a ledger found on the network, the absences are not
   asserted. A real run should find nearly all of them; under half is far more
   likely a measurement fault than a channel that lost half its uploads. Only
   applied once the ledger is big enough for a ratio to mean anything. The
   withheld items are still handed back, listed under the caveat, so a real
   mass loss is never hidden, only never announced as certain. */
export const MIN_COVERAGE = 0.5;
export const MIN_LEDGER_FOR_COVERAGE = 10;
const WITHHELD_LIST = 60;

/* -------------------------------------------------------------------------
   THE JOIN, WHICH TOUCHES NOTHING

   Pure: handed the two sides and the index, returns findings. No fetch, no
   store, no clock.

   inventory: [{ id, title, at, atFull, url, upload }]   what the network has
   ledger:    [{ reel, id, url, at, slot, shape }]       what we recorded
   ledgerFrom: the first day the ledger covers; an item published before it
               cannot have a record by construction, and is not "unrecorded"
------------------------------------------------------------------------- */
export function compare({ inventory = [], ledger = [], index = new Map(), cards = [],
                          network = "youtube", enumeration = { complete: true },
                          minCoverage = MIN_COVERAGE, ledgerFrom = null, statusComplete = true } = {}) {
  const byId = new Map();
  for (const c of cards) if (c && c.id) byId.set(c.id, c);

  const ledgerById = new Map();
  for (const L of ledger) if (L && L.reel && L.id) ledgerById.set(String(L.id), L);

  /* a video YouTube itself rejected (as a duplicate of one already there, most
     often) sits in the uploads playlist but was never published: it is
     reported as what it is and is not counted as a copy of anything */
  const rejected = [];
  /* THE MASTERPLAN'S OWN CASE. A send we recorded as ok whose video YouTube
     then rejected, failed or deleted: the upload call said yes and nothing
     was ever published. It is not absent, since the network still lists it,
     and it must never read as fine, so it is its own finding. */
  const failed = [];

  /* --- name every item the network holds, once ------------------------ */
  const items = [];
  const seenIds = new Set();
  for (const it of inventory) {
    if (!it || !it.id || seenIds.has(String(it.id))) continue;
    seenIds.add(String(it.id));
    if (it.upload === "rejected" || it.upload === "failed" || it.upload === "deleted") {
      const recd = ledgerById.get(String(it.id));
      const row = { id: it.id, title: it.title || null, at: it.at || null, url: it.url || null, upload: it.upload,
                    reel: recd ? recd.reel : null };
      (recd ? failed : rejected).push(row);
      continue;
    }
    const rec = ledgerById.get(String(it.id)) || null;
    const hits = index.get(norm(it.title)) || [];
    let reel = rec ? rec.reel : null, shape = null, ambiguous = null;
    if (!reel) {
      if (hits.length === 1) { reel = hits[0].reel; shape = hits[0].shape; }
      else if (hits.length > 1) ambiguous = [...new Set(hits.map(h => h.reel))];
    } else {
      /* the title names the shape when it can; the record of the send is the
         fallback, for a title edited on the platform since */
      const mine = hits.find(h => h.reel === reel);
      shape = mine ? mine.shape : (rec.shape || null);
    }
    items.push({ ...it, reel, shape, ambiguous, recorded: !!rec });
  }

  /* --- absent ----------------------------------------------------------- */
  const have = new Set(inventory.filter(Boolean).map(i => String(i.id)));
  const withIds = [...ledgerById.values()];
  let absent = withIds.filter(L => !have.has(String(L.id)))
    .map(L => ({ reel: L.reel, id: L.id, url: L.url || null, at: L.at || null, slot: L.slot || null }));

  /* a record with no platform id cannot be looked for at all: counted and
     named, never called missing and never called fine */
  const unverifiable = ledger.filter(L => L && L.reel && !L.id)
                             .map(L => ({ reel: L.reel, at: L.at || null, slot: L.slot || null }));

  /* THE GATE. An absence is inferred from a thing NOT being in a list, which
     is evidence only if the list is whole. */
  const found = withIds.length - absent.length;
  const coverage = withIds.length ? found / withIds.length : null;
  const enumComplete = !enumeration || enumeration.complete !== false;
  let withheld = null;
  if (!enumComplete)
    withheld = { why: "the walk did not finish: " + ((enumeration && enumeration.why) || "reason not given") };
  else if (withIds.length >= MIN_LEDGER_FOR_COVERAGE && coverage != null && coverage < minCoverage)
    withheld = { why: "only " + found + " of " + withIds.length + " recorded sends were found on the network, "
                    + Math.round(coverage * 100) + " percent, which is likelier to mean the enumeration did not see "
                    + "everything than that the network lost them. They are listed so nothing is hidden; check a "
                    + "few by hand before believing any." };
  if (withheld) {
    withheld.count = absent.length;
    withheld.items = absent.slice(0, WITHHELD_LIST);
    absent = [];
  }

  /* --- unrecorded, and what is simply older than the ledger ------------- */
  const named = items.filter(i => i.reel && !i.recorded);
  const beyondReach = ledgerFrom ? named.filter(i => i.at && i.at < ledgerFrom) : [];
  const unrecorded = named.filter(i => !beyondReach.includes(i))
    .map(i => ({ reel: i.reel, id: i.id, title: i.title || null, url: i.url || null, at: i.at || null, shape: i.shape }));

  /* --- twice ------------------------------------------------------------- */
  const perReel = new Map();
  for (const i of items) {
    if (!i.reel) continue;
    if (!perReel.has(i.reel)) perReel.set(i.reel, []);
    perReel.get(i.reel).push(i);
  }
  const order = (a, b) => String(a.atFull || a.at || "").localeCompare(String(b.atFull || b.at || ""))
                         || (a.recorded === b.recorded ? 0 : a.recorded ? -1 : 1)
                         || String(a.id).localeCompare(String(b.id));
  const copyOf = (i) => ({ id: i.id, title: i.title || null, url: i.url || null, at: i.at || null,
                           shape: i.shape, recorded: i.recorded });
  const twice = [];
  for (const [reel, list] of perReel) {
    const card = byId.get(reel) || null;
    const allow = allowanceOn(card, network);
    const byShape = {};
    for (const i of list) { const k = i.shape || "unknown"; (byShape[k] = byShape[k] || []).push(i); }
    /* a shape over its own allowance is a duplicate whatever the total says;
       unknown shapes are judged only through the total, since an unknown is
       most likely the lawful other half of a pair */
    /* A DUPLICATE IS TWO OF THE SAME SHAPE. Every allowance per shape is at
       most one, so that is the whole rule for a known shape; a lone item of a
       shape the card no longer expects (a film that lost its wide file after
       a lawful pair went up) is one video, and one video is never a copy.
       Items whose shape could not be worked out are judged only through the
       total, and only then, since an unknown may be a pair's other half. */
    const doubled = Object.entries(byShape)
      .filter(([k, l]) => k !== "unknown" && l.length > 1)
      .map(([k]) => k);
    const overflow = !!byShape.unknown && list.length > allow.total;
    if (!doubled.length && !overflow) continue;
    /* ONLY THE DOUBLED SHAPE IS OFFERED FOR REMOVAL. Listing every item of the
       reel under keep and remove once told the owner to delete his lawful wide
       video because it happened to sort second. Within a doubled shape the
       oldest is kept, by full timestamp, a recorded send before an unrecorded
       one on a tie; the reel's lawful items are shown apart and never labelled. */
    const extra = [];
    for (const k of doubled) {
      const l = byShape[k].slice().sort(order);
      l.forEach((i, n) => extra.push({ ...copyOf(i), keep: n === 0 }));
    }
    const lawful = list.filter(i => !doubled.includes(i.shape || "unknown")).sort(order).map(copyOf);
    twice.push({
      reel, count: list.length, expected: allow.total,
      assumed: allow.assumed ? "this reel is no longer on the shelf, so its lawful number of videos was assumed rather than read" : null,
      shapes: doubled.length ? doubled : null,
      /* no shape doubled but too many in total: the shapes could not be told
         apart, so nothing is marked for removal and a person has to look */
      byHand: !doubled.length,
      copies: doubled.length ? extra : list.slice().sort(order).map(copyOf),
      lawful
    });
  }

  const foreign = items.filter(i => !i.reel && !i.ambiguous)
                       .map(i => ({ id: i.id, title: i.title || null, at: i.at || null, url: i.url || null }));
  const ambiguous = items.filter(i => i.ambiguous)
                         .map(i => ({ id: i.id, title: i.title || null, at: i.at || null, url: i.url || null, reels: i.ambiguous }));

  return {
    network,
    counted: { onNetwork: items.length + rejected.length, inLedger: ledger.length, withIds: withIds.length,
               named: items.filter(i => i.reel).length, found, coverage },
    coverage,
    absent, unrecorded, twice, failed, ambiguous, withheld, unverifiable, foreign, rejected,
    beyondReach: beyondReach.map(i => ({ reel: i.reel, id: i.id, at: i.at || null, url: i.url || null })),
    /* CLEAN IS A CLAIM, made only by a pass entitled to make it: everything
       was looked at and nothing was found. A withheld absence does not know;
       an ambiguous title could be the duplicate itself; a record with no id
       was never checked either way. */
    clean: !withheld && !absent.length && !unrecorded.length && !twice.length && !failed.length
           && !ambiguous.length && !unverifiable.length && !beyondReach.length
           /* a video whose status was never read could be the rejected after
              an ok this pass exists to catch, so a partial status read cannot
              be clean either */
           && statusComplete !== false,
    /* what the pass could not name, said beside the verdict rather than under
       it: a video that matches no card is most often the owner's own upload,
       and is not a fault, but it is also the shape a reel whose hook was
       edited after it went up would take, so a clean verdict never claims
       to have covered it */
    caveats: [
      ...(foreign.length ? [foreign.length + " video" + (foreign.length === 1 ? "" : "s") + " on the channel match no reel on the shelf and could not be judged"] : []),
      ...(statusComplete === false ? ["YouTube did not say the status of every video, so an upload rejected after an ok could be among those it did not answer for"] : []),
      ...(rejected.length ? [rejected.length + " upload" + (rejected.length === 1 ? "" : "s") + " YouTube itself rejected, never published and in no record of ours"] : [])
    ]
  };
}

/* -------------------------------------------------------------------------
   ASKING YOUTUBE WHAT IT HAS

   Every video a channel has uploaded sits in one playlist YouTube keeps for
   it. channels.list for that playlist's id, then playlistItems.list fifty at a
   time, then videos.list fifty at a time for each video's status: one quota
   unit a call. Five hundred videos cost 21 units of the ten thousand a day;
   the caps below are 40 pages and so at most 81 units. The alternative,
   search.list with forMine, costs a hundred a call and stops near five
   hundred results.

   THE PRIVATE VIDEO PROBLEM. Until Google's compliance audit is granted every
   upload lands private. An authorised owner's read of their own uploads
   playlist returns private videos, but if that ever stops being true a pass
   would report hundreds of private reels missing. compare() withholds its
   absences when coverage is implausible, so this is measured each run and
   believed only when the measurement is sane.
------------------------------------------------------------------------- */

const API = "https://www.googleapis.com/youtube/v3";
export const PAGE = 50;
export const MAX_PAGES = 40;
export const WALK_BUDGET_MS = 25000;
export const CALL_TIMEOUT_MS = 8000;

export async function ytInventory(opts = {}) {
  const fetcher = opts.fetch || fetch;
  const started = Date.now();
  const left = () => (opts.budgetMs == null ? WALK_BUDGET_MS : opts.budgetMs) - (Date.now() - started);

  let tok;
  if (opts.token) tok = { ok: true, token: opts.token };
  else if (!YT.configured()) return { ok: false, enumerable: false, why: "YouTube is not connected (YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN)" };
  else {
    /* the token call bounded like every other: a hung line to Google must
       not hold the whole answer */
    const bounded = (u, init = {}) => {
      const ctl = typeof AbortController === "function" ? new AbortController() : null;
      const t = ctl ? setTimeout(() => ctl.abort(), CALL_TIMEOUT_MS) : null;
      return fetcher(u, { ...init, signal: ctl ? ctl.signal : undefined }).finally(() => { if (t) clearTimeout(t); });
    };
    try { tok = await YT.accessToken(bounded, opts); }
    catch (e) { return { ok: false, enumerable: false, why: "YouTube could not be reached for a token: " + String(e && e.message || e).slice(0, 120) }; }
  }
  if (!tok.ok) return { ok: false, enumerable: false, why: "YouTube refused a token: " + tok.err };

  /* one call, never a throw: a network that drops the line or hangs is a
     refusal with a reason, not an exception that takes the answer with it */
  const get = async (path) => {
    const ctl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), Math.max(1000, Math.min(CALL_TIMEOUT_MS, left()))) : null;
    try {
      const r = await fetcher(API + path, { headers: { authorization: "Bearer " + tok.token }, signal: ctl ? ctl.signal : undefined });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j) {
        const why = (j && j.error && (j.error.message || j.error.status)) || ("http " + (r && r.status));
        return { ok: false, why };
      }
      return { ok: true, j };
    } catch (e) {
      return { ok: false, why: (e && e.name === "AbortError") ? "no answer in time" : String(e && e.message || e).slice(0, 120) };
    } finally { if (timer) clearTimeout(timer); }
  };

  const ch = await get("/channels?part=contentDetails&mine=true");
  if (!ch.ok) return { ok: false, enumerable: false, why: "YouTube refused the channel read: " + ch.why };
  const item = ch.j && Array.isArray(ch.j.items) && ch.j.items[0];
  const uploads = item && item.contentDetails && item.contentDetails.relatedPlaylists
                       && item.contentDetails.relatedPlaylists.uploads;
  if (!uploads) return { ok: false, enumerable: false, why: "YouTube named no uploads playlist for this channel" };

  const items = [];
  const seen = new Set();
  const tokens = new Set();
  let page = null, pages = 0, complete = true, why = null, repeats = 0;
  do {
    if (pages >= MAX_PAGES) { complete = false; why = "stopped at " + MAX_PAGES + " pages"; break; }
    if (left() <= 2500) { complete = false; why = "ran out of time after " + pages + " pages"; break; }
    const q = "/playlistItems?part=snippet,contentDetails&maxResults=" + PAGE +
              "&playlistId=" + encodeURIComponent(uploads) + (page ? "&pageToken=" + encodeURIComponent(page) : "");
    const r = await get(q);
    if (!r.ok) { complete = false; why = "YouTube refused page " + (pages + 1) + ": " + r.why; break; }
    pages++;
    for (const it of (Array.isArray(r.j.items) ? r.j.items : [])) {
      const cd = it.contentDetails || {}, sn = it.snippet || {};
      /* ONE VIDEO IS ONE ITEM. An upload landing mid walk shifts the page
         boundary and hands the same video back on two pages; counted twice,
         it is a duplicate this pass invented, with "remove" pointing at the
         only copy there is. */
      if (!cd.videoId) continue;
      if (seen.has(cd.videoId)) { repeats++; continue; }
      seen.add(cd.videoId);
      const full = cd.videoPublishedAt || sn.publishedAt || "";
      items.push({ id: cd.videoId, title: sn.title || "", at: full.slice(0, 10) || null, atFull: full || null,
                   url: "https://www.youtube.com/watch?v=" + cd.videoId });
    }
    const next = r.j.nextPageToken || null;
    if (next && tokens.has(next)) { complete = false; why = "YouTube handed back a page token it had already given"; break; }
    if (next) tokens.add(next);
    page = next;
  } while (page);

  /* WHAT STATE ARE THEY IN. The privacy of each, and whether YouTube even
     accepted it: a video rejected as a duplicate stays in the playlist and must
     not be read as a published copy. A refusal here does not fail the walk. */
  const privacy = {};
  let privacyComplete = opts.privacy === false ? null : true;
  if (opts.privacy !== false && items.length) {
    const byId = new Map(items.map(x => [x.id, x]));
    for (let i = 0; i < items.length; i += 50) {
      if (left() <= 2000) { privacyComplete = false; break; }
      const chunk = items.slice(i, i + 50);
      const r = await get("/videos?part=status&id=" + chunk.map(x => encodeURIComponent(x.id)).join(","));
      if (!r.ok) { privacyComplete = false; break; }
      for (const it of (Array.isArray(r.j.items) ? r.j.items : [])) {
        const st = it.status || {};
        const p = st.privacyStatus || "unknown";
        privacy[p] = (privacy[p] || 0) + 1;
        const row = byId.get(it.id);
        if (row) { row.privacy = p; row.upload = st.uploadStatus || null; }
      }
    }
    if (privacyComplete === true && Object.values(privacy).reduce((a, b) => a + b, 0) < items.length) privacyComplete = false;
  }

  return { ok: true, enumerable: true, items, pages, complete, why, privacy, privacyComplete, repeats,
           playlist: uploads, tookMs: Date.now() - started };
}

/* -------------------------------------------------------------------------
   THE NETWORKS, AND WHAT CAN HONESTLY BE ASKED OF EACH

   Only youtube is enumerable today. "No adapter yet" and "the platform offers
   no such read" are different facts, and each row says which.
------------------------------------------------------------------------- */
export const NETWORKS = {
  youtube:   { enumerable: true,  inventory: ytInventory },
  telegram:  { enumerable: false, why: "the bot API cannot list a channel's history: getUpdates only reaches forward from now, so nothing can enumerate what was sent before" },
  instagram: { enumerable: false, why: "the Graph edge exists and the token is already held; the adapter is not written yet" },
  facebook:  { enumerable: false, why: "the Graph edge exists and the token is already held; the adapter is not written yet" },
  threads:   { enumerable: false, why: "the Graph edge exists and the token is already held; the adapter is not written yet" },
  pinterest: { enumerable: false, why: "listing pins needs Standard access, which is still in review; the adapter is not written yet" },
  x:         { enumerable: false, why: "reading a timeline is not in the tier this house holds" },
  reddit:    { enumerable: false, why: "this house only ever drafts to Reddit, so there is nothing of ours to enumerate" },
  linkedin:  { enumerable: false, why: "the adapter is not written yet" }
};
