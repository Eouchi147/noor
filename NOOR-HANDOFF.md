# NOOR — Delivery Handoff (July 2026 · v2 “Illuminated”)

Everything below is finished, tested headlessly (desktop + iPhone viewport), and ready to push.
Live target: https://noor-islamic-timeline.vercel.app · Repo: https://github.com/Eouchi147/noor

---

## 0. Critical fixes (the live site was broken)

The deployed `nodes.js` had **4 missing commas → a fatal SyntaxError**, so `NODES` never loaded
(empty timeline in production). `index.html` also called `linkifylinkify(...)` (typo), which broke
every modal, and `?node=` deep links from Characters→Path were never implemented. All fixed.

## 1. What shipped

### Content (Definition of Done — all met)
| Target | Required | Delivered |
|---|---|---|
| Isra & Mi'raj / Badr | ≥1000 words, full schema | 1031 / 1041 |
| Uhud / Khandaq / Hudaybiyyah / Fath | ≥700 + facts + lessons | 1094 / 901 / 907 / 909 |
| Adam / Ibrahim-Fire / Iqra | 600–1000+ | 1013 / 715 / 670 |
| Jannah closing node | strong theological close | 718 + vision sequence |
| Nihaya cluster | ordered visual story, dense data | 19 nodes, each with sequence strip, numbered Order-of-Events timeline, 6–7 facts, hadith w/ sources, Shield boxes (Dajjal, Sun-West, Sirat) |
| Every node | facts grid + Qur'an + hadith + lessons | 64/64 — min 289 words, 5 facts; 107 ayat + 161 hadith cited with collection numbers |

**The Path grew 58 → 64 nodes** (renumbered chronologically, all cross-links remapped by script):
- **44 The Farewell Hajj** · **45 The Passing of the Prophet ﷺ** (the Seerah previously jumped from Tabuk to Dajjal)
- **46 Minor Signs** · **47 Al-Mahdi** · **51 Sun from the West** · **61 Al-Hawd** (canonical, source-backed — no filler)
- Nihaya reordered per Muslim 2901/2941 (wind before fire; sun-west paired with Dabba; fire last of the Ten).

**Characters hub 37 → 71 seals** (dupe `an-abil` removed): 38 Companions (incl. Mus'ab, Sa'd ibn Mu'adh,
Hudhayfah, Nu'aym, Umm Salamah, Khalid, Abbas, Abu Sufyan, Uthman ibn Talha, Suhayl, Ja'far, Ammar,
Sumayyah, Anas ibn an-Nadr, Hanzala, Wahshi, Hind, Asma, Ka'b, Waraqah…), 11 Angels (+Malak al-Mawt,
Kiraman Katibin, Throne-bearers, Angel of the Mountains), 4 Jinn (+Qarin), 12 Animals (+Buraq, Ram of
the Sacrifice, Serpent of the Staff), 6 End-time (+Mahdi, Jassasah). Cross-links run **both directions**
and every `{{n:}}`/`{{c:}}` target is validated at build time (0 dead links).

**Authenticity discipline:** every hadith carries its collection + number; sub-Sahihayn material is
labeled (e.g., Dabba's marking reports); popular-but-weak items (Thawr spider/dove, Tala' al-Badru
dating) are addressed honestly in prose rather than silently repeated.

### Visual experience (new, per your directive — light & GPU-only)
- Hero: canvas starfield + rising gold motes, 3-layer parallax dunes + minaret silhouette, light rays,
  moon-glow, shimmering gold title, live stat chips (64 · 71 · 107 · 161), scroll cue.
- Path: illuminated **period gates** (Bidaya dawn-gold / Qisas sage / Seerah lapis / Nihaya star-night),
  golden center rail, staggered reveal-on-scroll, **3D tilt physics** on pointer devices, gold shine
  sweep, inner gold frames, ambient background drift, lazy-loaded manuscript art (700px preload margin).
- Modal: girih tile strip, Ken-Burns hero, staggered section reveals, illuminated ۞ section headers,
  sequence strips, gold-medallion timelines, sage Shield boxes, tilawah buttons with equalizer state,
  hadith source chips, hover-lift facts, connection chips. Mobile: full-sheet modal, safe-area aware.
- All animation is transform/opacity; canvas pauses off-screen & on hidden tab; `prefers-reduced-motion`
  disables everything; tilt only on `(hover:hover) and (pointer:fine)`.

### Engineering
- **Tailwind is now compiled** (`assets/tw.css`, 16 KB — 4 KB gz) instead of the 350 KB runtime CDN
  compiler → much faster on iPhone, works offline, removes a third-party runtime dependency.
- Shared engine `noor-fx.js` (6 KB gz): particles, parallax, tilt, reveals, lazy-bg, i18n, tilawah
  audio (everyayah Alafasy + cdn.islamic.network fallback + toggle + toast fallback), linkify, toasts.
- Characters data extracted to `characters.js` (same zero-build pattern as `nodes.js`).
- Deep links: `index.html?node=ID` and `characters.html?open=ID` both work; URL updates on open.
- i18n Phase A complete: 66-key `t()` dictionary, `data-i18n` chrome, language switcher, RTL-ready
  (`dir` flips for ar/ur/fa/…), non-EN packs fetched from `i18n/{code}.json` with graceful EN fallback,
  and **`i18n/en.json` (381 KB) master pack** — every node + character field, ready for translators.
- Content pipeline: `scripts/patches/*.mjs` (authored content) → `node scripts/build.mjs` regenerates
  `nodes.js` + `characters.js` from pristine snapshots in `.build-src/`, renumbers, remaps links,
  validates (64 sequential ids, period order, dead links, missing images) and prints a word-count audit.

### Tests (tests/e2e.mjs — 40 assertions, all passing)
Desktop & iPhone viewports: 64 tiles, 4 gates, 71 seals, modal content, cross-links both directions,
deep links, Escape/close, search, AR→RTL switch, lazy-image deferral, reduced-motion, no horizontal
overflow, zero console errors.

## 2. Page weight (gzipped, index.html critical path)
HTML 12 KB + tw.css 4 KB + noor-fx 6 KB + nodes.js 108 KB (the entire 30,800-word library) ≈ **130 KB**;
images lazy-load on approach (~110 KB each, only near-viewport ones fetched). Characters page adds
characters.js 25 KB gz instead of nodes.js.

## 3. Push from your Mac

```bash
cd ~/Desktop && git clone https://github.com/Eouchi147/noor.git && cd noor   # or cd into your existing clone
# unzip the delivered noor-v2.zip over the repo root (it contains only repo files):
unzip -o ~/Downloads/noor-v2.zip -d .

git rm -f --ignore-unmatch DEPLOY_TOMORROW.md UPLOAD_GUIDE.md BATCH_A_CONTENT.md   # obsolete docs
git add -A
git commit -m "NOOR v2: 64-node Path (+Farewell Hajj, Passing, Mahdi, Sun-West, Hawd, Minor Signs), 71-seal Characters hub, illuminated visual engine, compiled Tailwind, i18n master pack, e2e tests — fixes fatal nodes.js syntax error"
git push origin main
```
Vercel will auto-redeploy. Hard-refresh (or redeploy without build cache) if it lags.

## 4. Regenerating things later
```bash
npm install                 # once (dev only: tailwindcss + playwright)
node scripts/build.mjs      # content: patches → nodes.js + characters.js (+ validation & audit)
node scripts/build-i18n.mjs # refresh i18n/en.json master pack
npm run css                 # only if you change utility classes in the HTML
npm test                    # e2e suite (needs a local server on :8123: npx serve -l 8123)
```
Never edit `nodes.js` / `characters.js` by hand — edit `scripts/patches/*` and rebuild.

## 5. Art status
All 64 tiles have art or an intentional pattern; the 4 previously-unused manuscripts were assigned
(F7Hii→Farewell Hajj, qf2ej→The Passing, un6AP→Minor Signs, izWIV→Mahdi). **Two new nodes have no JPG
yet** (Sun from the West, Al-Hawd — currently on the nihaya pattern, which reads fine). When you want
them, generate with the master prompt (§6 of the project doc) + subjects: “sun rising over a western
horizon, reversed dawn, closing gate of light” and “a vast luminous basin, cups like stars, crescent
of pilgrims drinking”. No faces, as always.

## 6. Suggested next steps (per CHRONOLOGY.md’s 86-node vision)
Lut · Ayyub · Shuayb · Yunus · Zakariya/Yahya nodes; Al-Khulafa book (71–74); Arabic pack
(`i18n/ar.json`) as the RTL proof; optional per-period splitting of nodes.js if it grows past ~500 KB.
