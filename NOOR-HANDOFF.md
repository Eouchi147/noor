# NOOR: Delivery Handoff (July 2026 · v2 “Illuminated”)

Everything below is finished, tested headlessly (desktop + iPhone viewport), and ready to push.
Live target: https://noor-islamic-timeline.vercel.app · Repo: https://github.com/Eouchi147/noor

---

## 0. Critical fixes (the live site was broken)

The deployed `nodes.js` had **4 missing commas → a fatal SyntaxError**, so `NODES` never loaded
(empty timeline in production). `index.html` also called `linkifylinkify(...)` (typo), which broke
every modal, and `?node=` deep links from Characters→Path were never implemented. All fixed.

## 1. What shipped

### Content (Definition of Done: all met)
| Target | Required | Delivered |
|---|---|---|
| Isra & Mi'raj / Badr | ≥1000 words, full schema | 1031 / 1041 |
| Uhud / Khandaq / Hudaybiyyah / Fath | ≥700 + facts + lessons | 1094 / 901 / 907 / 909 |
| Adam / Ibrahim-Fire / Iqra | 600-1000+ | 1013 / 715 / 670 |
| Jannah closing node | strong theological close | 718 + vision sequence |
| Nihaya cluster | ordered visual story, dense data | 19 nodes, each with sequence strip, numbered Order-of-Events timeline, 6-7 facts, hadith w/ sources, Shield boxes (Dajjal, Sun-West, Sirat) |
| Every node | facts grid + Qur'an + hadith + lessons | 64/64, min 289 words, 5 facts; 107 ayat + 161 hadith cited with collection numbers |

**The Path grew 58 → 64 nodes** (renumbered chronologically, all cross-links remapped by script):
- **44 The Farewell Hajj** · **45 The Passing of the Prophet ﷺ** (the Seerah previously jumped from Tabuk to Dajjal)
- **46 Minor Signs** · **47 Al-Mahdi** · **51 Sun from the West** · **61 Al-Hawd** (canonical, source-backed, no filler)
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

### Visual experience (new, per your directive: light & GPU-only)
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
- **Tailwind is now compiled** (`assets/tw.css`, 16 KB, 4 KB gz) instead of the 350 KB runtime CDN
  compiler → much faster on iPhone, works offline, removes a third-party runtime dependency.
- Shared engine `noor-fx.js` (6 KB gz): particles, parallax, tilt, reveals, lazy-bg, i18n, tilawah
  audio (everyayah Alafasy + cdn.islamic.network fallback + toggle + toast fallback), linkify, toasts.
- Characters data extracted to `characters.js` (same zero-build pattern as `nodes.js`).
- Deep links: `index.html?node=ID` and `characters.html?open=ID` both work; URL updates on open.
- i18n Phase A complete: 66-key `t()` dictionary, `data-i18n` chrome, language switcher, RTL-ready
  (`dir` flips for ar/ur/fa/…), non-EN packs fetched from `i18n/{code}.json` with graceful EN fallback,
  and **`i18n/en.json` (381 KB) master pack**, every node + character field, ready for translators.
- Content pipeline: `scripts/patches/*.mjs` (authored content) → `node scripts/build.mjs` regenerates
  `nodes.js` + `characters.js` from pristine snapshots in `.build-src/`, renumbers, remaps links,
  validates (64 sequential ids, period order, dead links, missing images) and prints a word-count audit.

### Tests (tests/e2e.mjs: 40 assertions, all passing)
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
git commit -m "NOOR v2: 64-node Path (+Farewell Hajj, Passing, Mahdi, Sun-West, Hawd, Minor Signs), 71-seal Characters hub, illuminated visual engine, compiled Tailwind, i18n master pack, e2e tests, fixes fatal nodes.js syntax error"
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
Never edit `nodes.js` / `characters.js` by hand, edit `scripts/patches/*` and rebuild.

## 5. Art status
All 64 tiles have art or an intentional pattern; the 4 previously-unused manuscripts were assigned
(F7Hii→Farewell Hajj, qf2ej→The Passing, un6AP→Minor Signs, izWIV→Mahdi). **Two new nodes have no JPG
yet** (Sun from the West, Al-Hawd, currently on the nihaya pattern, which reads fine). When you want
them, generate with the master prompt (§6 of the project doc) + subjects: “sun rising over a western
horizon, reversed dawn, closing gate of light” and “a vast luminous basin, cups like stars, crescent
of pilgrims drinking”. No faces, as always.

## 6. Suggested next steps (per CHRONOLOGY.md’s 86-node vision)
Lut · Ayyub · Shuayb · Yunus · Zakariya/Yahya nodes; Al-Khulafa book (71-74); Arabic pack
(`i18n/ar.json`) as the RTL proof; optional per-period splitting of nodes.js if it grows past ~500 KB.


---

# v3 "Atlas & Words" (this delivery)

## What changed
1. **Copy audit**: codespell + two independent proofreading passes over all ~45,000 words; confirmed errors fixed (inverted Buraq comparison, a mislabeled Khaybar link, a wrong node target in the Sirat chapter, Ludd spelling unified, plus phrasing repairs in Hind and Suhayl).
2. **Characters completed to one standard**: all 36 original seals rewritten to flagship depth (sourced hadith, facts, dense links), and the roster grown 71 → 98: 20 new Companions (Abu Hurayrah, Anas, Mu'adh, Abu Dharr, Ibn Mas'ud, Ubayy, Zayd ibn Thabit, Ibn Abbas, Ibn Umar, Usama, Abu Ayyub, Ibn Salam, Amr ibn al-As, Ikrimah, Umm Ayman, Hafsah, Safiyyah, Zaynab, al-Hasan, al-Husayn), Angels of Badr, Khinzab, four new sign-animals (the Speaking Wolf, the Four Birds of Ibrahim, the Sabbath fish, the donkey of the hundred years), and Dhul-Suwayqatayn.
3. **Places hub** (places.html + places.js): 34 fully sourced places in five sections (Sanctuaries, Mountains & Heights, Cities & Lands, Waters & Valleys, Stations of the End), each with narrative, facts, ayat/hadith, and links into nodes, characters, and words.
4. **Words of the Path hub** (words.html + words.js), the freely chosen extra category: 18 supplications spoken inside the story (Hasbunallah, Dhun-Nun, Adam's words, Nuh's bismillah, Musa's three, the cave sentence, the Ta'if complaint, Sallim-sallim, the two light-heavy words, the shahadah, the adhan du'a, Sayyid al-Istighfar, the hawqala, the salawat, Rabbana atina, the istirja), each with Arabic, transliteration, meaning, origin story, sources, and a "Say it now" section.
5. **Cross-link graph is now 4-way**: {{n:}} {{c:}} {{p:}} {{w:}} all validated at build; place/word links woven into the Path chapters (Badr, Thawr, Arafat, the Scale, the Sirat...). 214 entries, 0 dead links.
6. **Em dash eradicated everywhere** (content, UI, docs, i18n pack) with a context-aware scrubber in the builder and a hard build-time guard + e2e assertions on every page's rendered text.
7. **Hero v2**: lapis night sky, golden crescent with halo, occasional shooting stars, aurora drift, ornate arch frame with eight-point star, mosque-skyline dunes, ghost calligraphy layer, six count-up stat chips. Hub pages share the night sky + crescent.
8. **Engineering**: hub pages unified into one renderer (noor-hub.js + assets/hub.css); characters.html, places.html, words.html are thin shells; i18n/en.json master pack now 563 KB covering nodes + characters + places + words (90 UI keys); e2e suite grown to 48 assertions across 4 pages.

## Push (same as before)
Unzip noor-v3.zip over your clone (or fetch the bundle), then:
```bash
git add -A
git commit -m "NOOR v3: Places + Words hubs, 98-seal Characters, copy audit, em-dash purge, hero v2"
git push origin main
```


---

# v4 "Seven Open Books" (this delivery)

## What changed
1. **All seven Books are now IN THE PATH** (64 → 71 chapters, renumbered with scripted remap and validation):
   Book 3 Al-Jahiliyyah (24 Jahiliyya · 25 The Hunafa, new · 26 Year of the Elephant), Book 5 Al-Khulafa
   (47 Abu Bakr: The Ummah Holds · 48 Umar: Justice Opens the Lands · 49 Uthman: One Book for the Ummah ·
   50 Ali: Wisdom in the Storm), Book 6 Al-Umam (51 The Preservation: Book, Sunnah, Chain · 52 Light across
   the Nations). Seven period gates, seven filters, and every Book card now clickable, filtering the Path.
2. **Auto-linked graph**: a build-time dictionary linker (longest-match, word-boundary, first-occurrence,
   self-skip, validated targets) now weaves every recognizable name, prophet, battle, and place across all
   221 entries: node links grew ~250 → 451, character links to 348. Click anything, land on its article.
3. **NEW "Two Lives in True Scale" (#mizan)**: a sourced dunya-vs-akhirah infographic band on the index:
   the Finger and the Sea (Muslim 2858) with animated droplet; the Timeline bar (~70 years · the 50,000-year
   Day (70:4) · eternity); Exchange Rates (Laylat al-Qadr 97:3, ×700 charity 2:261, Arafah, Fajr sunnah,
   whip-length Bukhari 6415, two words Bukhari 7563); the Dip That Resets Memory (Muslim 2807); What
   Actually Follows You (Bukhari 6514, Muslim 2958); the Rider and the Tree (Tirmidhi 2377, Bukhari 6416,
   mosquito's wing Tirmidhi 2320). Animated counters, every figure carrying its source chip, fully i18n-keyed,
   with CTAs into Jannah (71), Words, and the Path. "Two Lives" added to the nav.
4. e2e suite now 55 assertions, all green; i18n pack 137 UI keys + 71 chapters.

## Push
Same flow; this bundle contains v3 + v4 together (supersedes noor-v3.bundle if not yet pushed):
```bash
cd ~/Desktop/noor
git fetch ~/Downloads/noor-v4.bundle noor-v2-illuminated:noor-v4
git merge noor-v4
git push origin main
```

## v5 — "Clarity" (owner-requested audit)

Owner flagged sentences that were "not very english... not clear enough" (Khinzab's "personnel file", Dhul-Suwayqatayn's "appointment in its file"). Root cause: a recurring authorial tic of bureaucratic/corporate metaphors (file, ledger, dossier, audit, logistics, inventory, checklist...) plus a handful of garbled or over-compressed sentences.

- Full-corpus proofread of all 221 articles (71 nodes, 98 characters, 34 places, 18 words) + index.html prose: 5 parallel reviewer passes over ~433K chars, findings verified verbatim against the generated files.
- **205 sentence-level fixes** compiled into `scripts/patches/clarity-v5.mjs`, applied by a new post-scrub clarity pass in `build.mjs` that **fails the build if any fix stops matching** (same discipline as the dash guard). Compiler: `scripts/compile-clarity.mjs` (validates marker targets are preserved; no dashes introduced).
- Also fixed: stale "Path node 48/50/52" labels left from the v4 renumbering; two mid-sentence "·" artifacts; node 69 retitled "Hisab & Mizan: The Records and the Scale"; three mizan strings in index.html + UI_EN ("the life that lasts", "turns back at the grave", "The son of Adam says").
- Vocabulary sweep now returns **zero** hits for the whole metaphor family across all content.
- i18n/en.json regenerated. All 55 e2e assertions pass.

## v6 — "The Rose of Light" (hero, deeper mizan, Little Codex, Guide)

**Hero rebuilt as a living illuminated composition.** On load, a point of light blooms ("Kun") and a great eightfold sacred-geometry rose draws itself stroke by stroke around the crescent: outer ring, tick ring, two interlocked squares, octagon, eight petal rings, star finials, plus a counter-rotating inner order. Then the whole rose turns imperceptibly (260s/190s), the halo breathes, نور ghost-glows with a light sweep, a conic ray-wheel turns behind it on desktop, and mist drifts over the dunes. All transform/opacity GPU animation; the draw is CSS stroke transitions (no JS animation loop added). Mobile gets its own tuning: 55% faster draw, tighter rose, no ray-wheel, existing DPR-capped canvas. Reduced motion: everything renders in final state.

**Two Lives, deepened (6 → 9 infographic cards + the owner's correction):**
- What Follows You now carries the debt strip: martyr forgiven all but debt (Muslim 1886); the believer's soul attached to his debt until settled (Tirmidhi 1078, hasan).
- New: Two Capitals, Spent Blind (Bukhari 6412) · Nothing Here Hurts for Free with falling gold leaves (Bukhari 5641; 5660 · Muslim 2571) · Shade on the Day There Is None, the seven shaded as chips (Bukhari 660 · Muslim 1031).

**kids.html — "The Greatest Game" (Little Codex).** Seven tap-through superlative rounds (Fastest, Strongest, Biggest, Sees the Most, Most Giving, Most Loving, Lasts Longest): champions with hand-drawn flat SVGs each beaten by the next, ending every round at an ayah/sahih hadith and one of the Beautiful Names collected as a gem (54:50, 35:41, 2:255, 6:59, 14:34, Bukhari 5999, 57:3). Seven gems form the constellation finale ("Allahu Akbar"). Self-contained 63KB, zero deps, localStorage progress, no human figures anywhere. Linked from nav, mobile pills, and a hero CTA.

**The Guide — a quiet clarifier, not a chatbot to chat with.** A small "؟ Unclear? Ask" pill appears ONLY on 33 sensitive chapters (Iblis's refusal, 4:157, the fitnah of the Companions, every major Sign, Hisab fairness, etc. + Iblis/Qarin/Harut-Marut seals). It opens three curated questions per topic (99 authored answers, all cited, mainstream, no fatwas: rulings are pointed to a scholar) plus free-text matching against the Q&As and a 43-term glossary. Data: noor-guide-data.js · UI: noor-guide.js (self-styling, i18n-ready keys).
**Optional live mode:** api/guide.js is a dormant Vercel function. Set `ANTHROPIC_API_KEY` in Vercel → the free-text box silently upgrades to real Claude answers, constrained to the open article, 2-3 sentences, no rulings. Without the key the site is 100% static and the curated layer answers alone. Nothing to configure otherwise.

Tests: suite grown to 68 assertions (rose draw, 9 mizan cards, debt strip, seven chips, kids full round on mobile, guide pill gating on/off, glossary free-text). All pass. i18n/en.json regenerated (165 UI keys).

## v7 — "Ten Wonders" (game pack, hero air)

**Hero decluttered per owner.** The "From the Throne over the water..." subtitle moved out of the hero into the About section (same i18n key). The six stat boxes left the hero entirely: they are now a slim counter band (#codex-count) between the hero and Seven Books: horizontally scrollable chips on mobile, centered on desktop, same count-up. The rose now stands nearly alone: kicker, title, three CTAs.

**Little Codex expanded 1 → 10 activities.** Nine new self-contained games in kids/ (all: single file, zero deps, inline SVG art, one rAF loop, ≤44KB each, reduced-motion fallbacks, localStorage nk-* progress, gentle-failure design, no dashes, no human figures):
1. Story Steps (story-steps.html): order 6 prophet stories, 5 moments each, streak stars.
2. Two by Two (ark-pairs.html): memory pairs that physically board Nuh's ark; 11:41 finale.
3. Catch the Name (star-catcher.html): falling-star match of 12 Beautiful Names, multiplier flames, constellation end.
4. Build with Ibrahim (kaaba-builder.html): stack 12 courses, perfect-drop bonuses, kiswa drape, 2:127.
5. Hajar's Search (zamzam.html): alternate-tap sa'i ×7, dig frenzy, water eruption, five jars; Muslim 2473.
6. Three Words in the Dark (yunus.html): collect the du'a of Yunus word by word, sea lightens, whale + gourd vine; 21:88.
7. The 700 Seed (orchard.html): plant, hold-to-water, watch 7 ears roll to 700, harvest to baskets; 2:261.
8. Five Lanterns (lanterns.html): tap prayers as light crosses the sky dome, house fills with glow, 3-day streak; Tirmidhi 413 (hasan).
9. Echo of Light (echo.html): dhikr Simon on four Amiri medallions; Bukhari 7563 finale.
kids.html gained a "More Wonders" grid (9 accent-ringed cards with ✓ done seals read from localStorage) and a wonders counter ("X of 10", the Greatest Game counts at 7 gems).

Tests: suite at 88 assertions, all green (hub cards, per-game smoke: clean load, overflow, dash, back-link).

## v8 — "At-Tibb" (Prophetic Health page)

New page **health.html** ("Health" in every nav): a scrollytelling portrait of the Prophet's ﷺ lived pattern through a health lens. Architecture: 8 sections with a fixed scrollspy dot rail (desktop), scroll-triggered infographics, and the page's signature **sunnah | science duo card** (gold lane: "He ﷺ" with exact citation; sage lane: "The research" with named field/finding, deliberately conservative).

Sections & anchors: 01 The Measure (animated vessel of thirds, Tirmidhi 2380; Bukhari 5393; Bukhari 1975) · 02 The Plate (6 medallions: dates AD 2356/Bukhari 5445, honey 16:69/Bukhari 5684 + Cochrane cough note, olive Tirmidhi 1851 hasan + PREDIMED, talbina Bukhari 5689 + barley beta-glucan claim, paced water Muslim 2028, table adab Bukhari 5376/Muslim 2034) · 03 The Fast (24h ring sweep + Mon/Thu week strip Muslim 1162/Tirmidhi 747 + white days Tirmidhi 761; suhur Bukhari 1923; NEJM 2019 TRE review) · 04 The Day (sun-arc animation; 17:79, Bukhari 1145, Tirmidhi 1212 hasan, qaylula practice Bukhari 941, Bukhari 568, Bukhari 247; circadian/nap science) · 05 The Motion (Muslim 2664, Shama'il gait, Abu Dawud 2578 racing Aisha, Bukhari 2837 Trench, Muslim 1917 archery, Muslim 666 mosque steps; gait-speed cohorts) · 06 The Clean (Muslim 223; 5-drop wudu animation; siwak Bukhari 887; Friday ghusl Bukhari 858; waking hands Bukhari 162; covered vessels Muslim 2014; covered sneeze Tirmidhi 2745; quarantine Bukhari 5728) · 07 The Heart (Muslim 2999; anger protocol Bukhari 6116/Abu Dawud 4782; gratitude, relaxation-response and HRV literature; ummah bonds Muslim 2586 + Holt-Lunstad) · 08 Fourteen Centuries Early (handwashing 1847, quarantine 14th c., eating windows 21st c.) + an honesty box: measured claims only, weak-evidence practices (hijama) named as unproven rather than stretched, page is not medical advice.

Integration: nav links added on index (desktop + mobile pills) and all three hubs; UI_EN keys nav.health/health.*; health.html added to Tailwind content globs, tw.css rebuilt; i18n/en.json regenerated (169 UI keys). Tests: suite at 101 assertions, all green.

## v9 — "Pocket Polish" (mobile UX hardening)

Owner's iPhone screenshot showed the page zoomed out with the old horizontally-scrolling counter band overflowing the layout. Fixes, all pages:
- Viewport locked on every page (root + all kids/*): `maximum-scale=1.0, user-scalable=no, viewport-fit=cover`. No more accidental pinch/double-tap zoom and no Safari zoom-out-to-fit. (iOS accessibility zoom still works system-wide, by design.)
- Global UX guard injected on every page: `overflow-x:clip` on body (any future overflowing element can no longer widen the canvas), `touch-action:manipulation` on links/buttons (kills the double-tap-zoom delay), transparent tap highlight, `-webkit-text-size-adjust:100%`.
- The codex counter band is no longer a scroll container at all on mobile: 3×2 centered grid of stacked pills (value over label); ≥sm stays a centered row. Root cause of the screenshot removed structurally.
- Guide free-text input is 16px on small screens (prevents iOS auto-zoom on focus).
- `theme-color` metas everywhere (dark night tint for hero pages) so the browser chrome matches.
All 101 e2e assertions green (band grid still satisfies the 6-chip and count-up checks).

### v9.1 — nav wrap + scale lock + cache-bust

Owner's second iPhone screenshot: page still auto-shrunk (white right gutter) and mobile nav pills ran off the right edge; counters stacked 1-per-row (stale CSS).
- Root causes: (1) `minimum-scale` was unset, so iOS could still shrink-to-fit; now `minimum-scale=1.0` locks scale at exactly 1 on every page. (2) The mobile pill nav was a horizontal scroll strip; it is now a centered two-row wrap on all pages (nothing cut, no scroll container, Health pill added to hub strips). (3) vercel.json serves /assets immutable for a year with an unchanged filename, so phones held old tw.css (hence the stacked counters, `grid-cols-3` missing): all `tw.css`/`hub.css` links now carry `?v=9`; bump this query on any future CSS rebuild.
- `overflow-x: clip` extended to html as well as body. Decorative hero layers that exceed the viewport are all inside `#hero{overflow:hidden}` (verified by element scan; document scrollWidth = 390 at 390).
All 101 e2e assertions green. Note for the owner: after deploying, close and reopen the tab on the phone once so Safari drops the old cached CSS.

## v10 — "Two Heroes" (Adam & Isla story games, dedication, sponsor seal, Places mobile fix)

**Two flagship story games** in kids/, highlighted at the top of the Little Codex as gold "Hero Story" cards (sheen animation, character portraits):
- **Adam and the Upper Hand** (adam.html, nk-adam): shy, strong Adam, five days before turning six. Each day: a training mini-game (pulse-hold bucket, rhythm lifts, L/R hill run, timing stone, rope swipes) then a choice moment where helping someone spends that strength (kitten, spilled dates, goose+kite, thirsty garden, and the peak: standing beside a laughed-at friend, no mechanics, just courage). Confidence meter physically straightens his posture pose by pose. Finale: light six candles, the وَلِيُّ اللّٰه badge, and exactly 10:62, Bukhari 1429 (the upper hand = the giving hand), Muslim 2664. Resumable by day.
- **Isla and the Growing Sky** (isla.html, nk-isla): almost-two genius with a giant magnifier. A wonder-tree where every answered question sprouts TWO new question-buds; the camera pulls back stage by stage (room → garden → sky → sea and stars) because knowing more makes the world bigger. Two racing counters: "I know: N" vs "New questions: 2N". Twelve micro-discoveries (seed, moon phases, Alif, color mixing, counting, bees, constellation, air, rain, float/sink, sea scale, the final zoom-out to "Allah made all of it"). Finale: طَالِبَةُ الْعِلْم badge + 20:114 + Muslim 2699 + Abu Dawud 3641.
- Both: cartoon paper-cut fictional children (the sacred no-depiction rule for prophets/companions is untouched), self-contained, resumable, reduced-motion safe. Wonders counter now "X of 12".

**Dedication (owner request):** the About section now carries صَدَقَةٌ جَارِيَة, dedicating the Codex as sadaqah jariyah in honor of **Ziba**, with homage to her Afghan ancestry (Dari meaning of her name; Balkh and Herat as lantern cities) + Muslim 1631. i18n key about.dedication.

**Sponsor system (expansion item 1):** sponsor.js: single-patron config `{active,name,url,line}`; when active, an understated "Guardian of this Codex" seal renders in About (#sponsor-slot). Change sponsor = edit 3 fields, no rebuild. Ships dormant.

**Places mobile submenu fix (expansion item 9):** on phones the hub section-nav is no longer sticky (it scrolls away instead of stacking under the tall header) and is a compact single-row swipe strip with edge fade. hub.css bumped to ?v=10.

Tests: 105 assertions green (hero cards, counter 12, adam/isla smoke in the games loop).

## v11 — "Arcade Souls" (hero games rebuilt, nav unified)

Owner feedback: swipe broken, art too plain, wanted Clash-Royale-grade compulsion. Both hero games fully rebuilt:
- **Art:** chunky outlined toy-arcade style (thick #241a3d linework, soft 3D bevels, drop shadows, glare-capped 3D buttons with pressed states). Adam and Isla redrawn as proper chibi characters (big expressive eyes with highlights, blush, kufi/buns, outlined limbs); poses still evolve with confidence.
- **Compulsion systems:** Hasanat coin counter with floaty "+10 ✦" numbers; combo multipliers with slam-in banners; screen shake on misses; haptic buzz (Android); 3-star victory overlay after every day/discovery (stars slam in CR-style); and the centerpiece: **collectible cards with foil-flip mint animations**: 5 Strength Cards in Adam (Bucket Bearer → Heart Lifter, COMMON→LEGENDARY rarity frames, stat chips) shown as a mystery deck on the title screen; 12 Wonder Cards in Isla with an Album viewer. Replays keep best stars.
- **Swipe fixed properly:** pointermove-accumulation + setPointerCapture + pointercancel handling (iOS scroll no longer eats the gesture); applies to Adam's rope/kite and Isla's bird.
- Storage keys unchanged (nk-adam/nk-isla, resume works); zero dashes; reduced-motion safe.

**Navigation unified (owner bug):** every main page (index, characters, places, words, health, companions) now renders the identical canonical menu: desktop Books·Path·Characters·Places·Words·Health·Two Lives·Kids·About + language select; mobile pills Path·Characters·Places·Words·Health·Kids·Books. Active page highlighted; no more items appearing/disappearing between pages. Verified programmatically identical across pages.

All e2e assertions green.
