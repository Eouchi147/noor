/* NOOR · the ornament on a card
   ===========================================================================
   Every post now carries its own picture. Not a photograph and not a figure:
   this house draws light and geometry and nothing else, so what follows is a
   small library of motifs out of the Islamic geometric tradition, each one a
   pure function of a seed.

   WHY THE MODEL DOES NOT DRAW

   The Lantern chooses; it does not draw. It is handed the names of the motifs
   below and answers with one of them, and that answer is checked against the
   list before anything is used. A model that could emit arbitrary SVG onto a
   card published in the owner's name could emit anything at all -- a figure, a
   face, the symbol of another faith, a shape nobody vetted. Choosing from a
   vetted vocabulary keeps the whole surface reviewable: there are twelve
   drawings on this site's cards, and a person can look at all twelve.

   WHAT MAY NOT APPEAR

     · no faces, no figures, no living creatures
     · no symbol of another faith -- and because a cross is two strokes rather
       than a word, tests/symbols.mjs reads the geometry of every path here and
       fails on a horizontal stroke crossing a vertical one. The motifs are
       built from arcs, circles and rotated polygons for that reason.
     · nothing that could be mistaken for calligraphy of a divine name, which
       would make the card unfit to be scrolled past or deleted.
   =========================================================================== */

const TAU = Math.PI * 2;
const r2 = n => Math.round(n * 100) / 100;
const pt = (cx, cy, r, a) => r2(cx + Math.cos(a) * r) + " " + r2(cy + Math.sin(a) * r);

/* a small deterministic generator, so one card is always drawn the same way */
export function seedOf(s) {
  let h = 2166136261;
  const t = String(s == null ? "" : s);
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0);
}
const rng = seed => { let x = seed || 1; return () => (x = (x * 1664525 + 1013904223) >>> 0) / 4294967296; };

/* ---- the motifs ---------------------------------------------------------
   Each returns SVG for a box of side `s` centred on (cx, cy). Stroke only:
   an ornament that fills would fight the words it sits above.            */

const rosette = (cx, cy, s, R) => {                    /* petals on a circle */
  const r = s * .5, k = 6 + Math.floor(R() * 3);
  let d = "";
  for (let i = 0; i < k; i++) {
    const a = (i / k) * TAU;
    d += `<circle cx="${r2(cx + Math.cos(a) * r * .5)}" cy="${r2(cy + Math.sin(a) * r * .5)}" r="${r2(r * .5)}"/>`;
  }
  return d + `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(r * .5)}"/>`;
};

const khatim = (cx, cy, s) => {                         /* the eightfold seal */
  const r = s * .5;
  const poly = off => {
    let p = [];
    for (let i = 0; i < 4; i++) p.push(pt(cx, cy, r, off + i * (TAU / 4)));
    return `<path d="M${p.join("L")}Z"/>`;
  };
  /* both squares are turned off the axes, so no edge of one is horizontal and
     no edge of the other vertical: an eight-pointed star, never a cross */
  return poly(Math.PI / 8) + poly(Math.PI / 8 + Math.PI / 4);
};

const arcs = (cx, cy, s, R) => {                        /* light, in ripples */
  let d = "", n = 4 + Math.floor(R() * 3);
  for (let i = 0; i < n; i++) {
    const r = s * .5 * (i + 1) / n;
    d += `<path d="M${pt(cx, cy, r, Math.PI * 1.15)}A${r2(r)} ${r2(r)} 0 0 1 ${pt(cx, cy, r, Math.PI * 1.85)}"/>`;
  }
  return d;
};

const niche = (cx, cy, s) => {                          /* the lamp's recess */
  const w = s * .34, h = s * .5, x = cx - w, yb = cy + h * .8, yt = cy - h;
  return `<path d="M${r2(x)} ${r2(yb)}L${r2(x)} ${r2(cy - h * .1)}`
       + `A${r2(w)} ${r2(w)} 0 0 1 ${r2(cx + w)} ${r2(cy - h * .1)}L${r2(cx + w)} ${r2(yb)}"/>`
       + `<path d="M${r2(cx)} ${r2(yt)}A${r2(w * .5)} ${r2(w * .5)} 0 0 0 ${r2(cx)} ${r2(yt + w)}"/>`;
};

const lamp = (cx, cy, s) => {                            /* a hanging lantern */
  const w = s * .26, h = s * .42;
  return `<path d="M${r2(cx - w)} ${r2(cy - h * .35)}Q${r2(cx)} ${r2(cy - h)} ${r2(cx + w)} ${r2(cy - h * .35)}`
       + `Q${r2(cx + w * 1.15)} ${r2(cy + h * .5)} ${r2(cx)} ${r2(cy + h * .8)}`
       + `Q${r2(cx - w * 1.15)} ${r2(cy + h * .5)} ${r2(cx - w)} ${r2(cy - h * .35)}Z"/>`
       + `<circle cx="${r2(cx)}" cy="${r2(cy + h * .05)}" r="${r2(w * .34)}"/>`;
};

const rays = (cx, cy, s, R) => {                          /* light, spreading */
  const n = 9 + Math.floor(R() * 5); let d = "";
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + .19;                        /* off the axes */
    d += `<path d="M${pt(cx, cy, s * .16, a)}L${pt(cx, cy, s * .5, a)}"/>`;
  }
  return d + `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(s * .12)}"/>`;
};

const hexfield = (cx, cy, s, R) => {                       /* a tiled ground */
  const r = s * .13; let d = "";
  for (let row = -1; row <= 1; row++)
    for (let col = -2; col <= 2; col++) {
      const x = cx + col * r * 1.74 + (row & 1 ? r * .87 : 0), y = cy + row * r * 1.5;
      if (Math.hypot(x - cx, y - cy) > s * .52) continue;
      let p = [];
      for (let i = 0; i < 6; i++) p.push(pt(x, y, r * .92, Math.PI / 6 + i * (TAU / 6)));
      d += `<path d="M${p.join("L")}Z"/>`;
    }
  return d;
};

const interlace = (cx, cy, s, R) => {                      /* girih strapwork */
  const r = s * .46, k = 5 + Math.floor(R() * 3); let d = "";
  for (let i = 0; i < k; i++) {
    const a = (i / k) * TAU + .31;
    d += `<path d="M${pt(cx, cy, r, a)}Q${r2(cx)} ${r2(cy)} ${pt(cx, cy, r, a + TAU / k * 2)}"/>`;
  }
  return d;
};

const crescentArcs = (cx, cy, s) => {                       /* nested waxing */
  const r = s * .44;
  return `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(r)}"/>`
       + `<path d="M${pt(cx, cy, r * .74, Math.PI * 1.35)}A${r2(r * .74)} ${r2(r * .74)} 0 1 1 ${pt(cx, cy, r * .74, Math.PI * .65)}"/>`;
};

const wellOfStars = (cx, cy, s, R) => {                     /* a scatter, fixed */
  let d = ""; const n = 7 + Math.floor(R() * 5);
  for (let i = 0; i < n; i++) {
    const a = R() * TAU, rr = s * (.14 + R() * .36);
    d += `<circle cx="${pt(cx, cy, rr, a).split(" ")[0]}" cy="${pt(cx, cy, rr, a).split(" ")[1]}" r="${r2(2 + R() * 4)}"/>`;
  }
  return d + `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(s * .5)}"/>`;
};

const openBook = (cx, cy, s) => {                            /* leaves, not a face */
  const w = s * .44, h = s * .26;
  return `<path d="M${r2(cx)} ${r2(cy - h * .5)}Q${r2(cx - w * .6)} ${r2(cy - h)} ${r2(cx - w)} ${r2(cy - h * .3)}`
       + `L${r2(cx - w)} ${r2(cy + h * .7)}Q${r2(cx - w * .6)} ${r2(cy)} ${r2(cx)} ${r2(cy + h * .5)}"/>`
       + `<path d="M${r2(cx)} ${r2(cy - h * .5)}Q${r2(cx + w * .6)} ${r2(cy - h)} ${r2(cx + w)} ${r2(cy - h * .3)}`
       + `L${r2(cx + w)} ${r2(cy + h * .7)}Q${r2(cx + w * .6)} ${r2(cy)} ${r2(cx)} ${r2(cy + h * .5)}"/>`;
};

const dome = (cx, cy, s) => {                                 /* a roof, an arch */
  const w = s * .38, h = s * .34;
  return `<path d="M${r2(cx - w)} ${r2(cy + h)}L${r2(cx - w)} ${r2(cy)}`
       + `A${r2(w)} ${r2(h * 1.2)} 0 0 1 ${r2(cx + w)} ${r2(cy)}L${r2(cx + w)} ${r2(cy + h)}"/>`
       + `<path d="M${r2(cx)} ${r2(cy - h * 1.2)}A${r2(w * .2)} ${r2(w * .2)} 0 0 0 ${r2(cx)} ${r2(cy - h * .8)}"/>`;
};

export const MOTIFS = {
  rosette, khatim, arcs, niche, lamp, rays,
  hexfield, interlace, crescent: crescentArcs, stars: wellOfStars, leaves: openBook, dome
};
export const MOTIF_NAMES = Object.keys(MOTIFS);

/* what each one is for, so the Lantern is choosing with its eyes open */
export const MOTIF_FOR = {
  rosette:  "geometry, order, the pattern under things",
  khatim:   "the eightfold seal; completeness, a settled matter",
  arcs:     "light arriving in waves; mercy, repetition, ripples",
  niche:    "the recess that holds the lamp; the Qur'an, revelation",
  lamp:     "the lamp itself; guidance, a single light in the dark",
  rays:     "light spreading from one source; teaching, spreading, dawn",
  hexfield: "a tiled ground; craft, science, the made world",
  interlace:"strapwork drawn without lifting the pen; continuity, chains, isnad",
  crescent: "the month turning; the calendar, time, a night",
  stars:    "a sky; the unseen, wonder, navigation",
  leaves:   "open leaves of a book; scholarship, writing, the word",
  dome:     "an arch and a roof; a mosque, a place, a city, a journey"
};

/* ---------------------------------------------------------------------------
   drawing one
--------------------------------------------------------------------------- */
export function ornament(name, opts = {}) {
  const key = MOTIFS[name] ? name : MOTIF_NAMES[seedOf(name) % MOTIF_NAMES.length];
  const { cx = 540, cy = 300, size = 260, seed = key, opacity = .22, width = 2.4 } = opts;
  const R = rng(seedOf(seed));
  const body = MOTIFS[key](cx, cy, size, R);
  return `<g opacity="${opacity}" fill="none" stroke="rgba(244,212,106,.9)" stroke-width="${width}"
   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</g>`;
}

/* the name the card should use when nobody has chosen one */
export function motifFor(text, seed) {
  const t = String(text || "").toLowerCase();
  const pick = [
    [/qur'?an|verse|surah|ayah|revel|recit|mushaf/, "niche"],
    [/light|lamp|guid|dawn|nur/,                    "lamp"],
    [/night|moon|month|calendar|hijri|ramadan|eid/, "crescent"],
    [/star|sky|unseen|navigat|astronom/,            "stars"],
    [/book|write|scholar|word|dictionar|manuscript/,"leaves"],
    [/mosque|masjid|city|journey|travel|built|road/,"dome"],
    [/science|craft|made|geometry|number|medicine/, "hexfield"],
    [/chain|isnad|narrat|companion|lineage/,        "interlace"],
    [/mercy|forgive|relent|patien|kind/,            "arcs"],
    [/complete|seal|final|perfect|whole/,           "khatim"],
    [/teach|spread|send|call|invite/,               "rays"]
  ];
  for (const [re, name] of pick) if (re.test(t)) return name;
  return MOTIF_NAMES[seedOf(seed || t) % MOTIF_NAMES.length];
}
