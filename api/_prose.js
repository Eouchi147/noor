// Sentences, not character counts.
//
// ---------------------------------------------------------------------------
// WHAT WAS WRONG
//
// The card cut the story at whatever word fell on the eighth line and the
// caption cut it at character 297, so the first real post to Instagram ended:
//
//     ...the boundary line between the two countries was drawn by Cyril
//     Radcliffe, a British lawyer who…
//
// A card has to be readable on its own. Someone scrolling past sees the
// picture and nothing else, and a picture that stops mid-clause teaches
// nothing and looks careless on an account about a religion.
//
// So both the card and the caption now stop at a full stop. The card takes as
// many whole sentences as fit in its box; the caption takes the whole story,
// which is longer than the card can hold and is therefore a real expansion of
// it rather than a repetition.
// ---------------------------------------------------------------------------

/* Full stops that are not the end of a sentence. This corpus is history, so it
   is full of "c. 610", "d. 1071", "r. 634 to 644" and initials, and every one
   of them would otherwise split a sentence in half. */
/* Only abbreviations that are FOLLOWED by the rest of their clause belong
   here. Era markers do not: "in 92 AH." ends a sentence, it does not abbreviate
   one, and listing AH here silently glued two sentences together. */
const NOT_AN_END = new Set([
  "c", "ca", "d", "b", "r", "fl", "no", "p", "pp", "vol", "ed", "eds", "trans",
  "st", "mt", "dr", "mr", "mrs", "ms", "prof", "vs", "etc", "ie", "eg", "approx",
  "jr", "sr"
]);

export function sentences(text) {
  const s = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
  if (!s) return [];
  const out = [];
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== "." && s[i] !== "!" && s[i] !== "?") continue;
    /* a run of closing quotes or brackets still belongs to this sentence */
    let j = i + 1;
    while (j < s.length && /["'’”)\]]/.test(s[j])) j++;
    if (j >= s.length) break;
    if (s[j] !== " ") continue;
    /* the next sentence has to look like one */
    const after = s.slice(j + 1);
    if (!/^["'‘“(]?[A-ZÀ-ɏ0-9]/.test(after)) continue;
    if (s[i] === ".") {
      const word = (s.slice(start, i).match(/([A-Za-z]+)$/) || [])[1] || "";
      if (word.length === 1 && /[A-Z]/.test(word)) continue;      /* an initial */
      if (NOT_AN_END.has(word.toLowerCase())) continue;
    }
    out.push(s.slice(start, j).trim());
    start = j + 1;
  }
  const tail = s.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

/* As many whole sentences as `fits` will accept. Returns "" when not even the
   first one fits, so the caller can decide what to do rather than being handed
   a half sentence it did not ask for. */
export function fitSentences(text, fits) {
  const parts = sentences(text);
  let kept = "";
  for (const s of parts) {
    const next = kept ? kept + " " + s : s;
    if (!fits(next)) break;
    kept = next;
  }
  return kept;
}

/* The character-count form, for callers measuring length rather than lines. */
export const trimToSentences = (text, maxChars) =>
  fitSentences(text, t => t.length <= maxChars);
