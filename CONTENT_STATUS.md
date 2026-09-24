# NOOR Content Status: v2 (July 2026)

## Definition of Done: all criteria met
| Criterion | Status |
|---|---|
| Badr + Isra ≥ 1000 words, full schema | **1041 / 1031** |
| Uhud, Khandaq, Hudaybiyyah, Fath ≥ 700 + facts + lessons | **1094 / 901 / 907 / 909** |
| Nihaya readable as ordered visual story, dense facts | **19 nodes: sequence + timeline + shield + 6-7 facts each** |
| All tiles have image or intentional pattern, 0 broken paths | **Verified at build time** |
| Cross-links Path ↔ Characters both ways | **Verified by e2e tests** |
| Characters hub covers all 5 sections | **71 seals** |
| UI chrome i18n-keyed, RTL-ready | **66 keys + en.json master pack** |
| Mobile fast, no cramped grid | **~130 KB gz critical path, lazy images, gap-6/8 grid** |
| No prophet/companion faces | **Seals, light, and manuscript scenes only** |
| Repo pushable as static Vercel site | **Yes, see NOOR-HANDOFF.md §3** |

## Node inventory: 64 (bidaya 8 · qisas 15 · seerah 22 · nihaya 19)
New since v1: Farewell Hajj (44) · The Passing ﷺ (45) · Minor Signs (46) · Al-Mahdi (47) · Sun from the West (51) · Al-Hawd (61)
Total narrative: ~30,800 words · 107 ayat cited · 161 hadith cited with sources.

## Regeneration
Edit `scripts/patches/*` → `node scripts/build.mjs` → `node scripts/build-i18n.mjs`.


<!-- graph-counts:start -->
### The graph's own counts

Written by `scripts/graph/write_counts.py`, part of `scripts/graph/run.sh`; do not edit by hand, it is overwritten on the next run. Source: `build/graph/noor-content-graph.json`.

| type | count |
|---|---|
| chapter | 71 |
| companion | 58 |
| day | 25 |
| dua | 18 |
| figure | 75 |
| hadith | 681 |
| hero | 60 |
| kid | 137 |
| light | 350 |
| name | 99 |
| page | 76 |
| place | 34 |
| prophet | 25 |
| reel | 1617 |
| story | 8 |
| surah | 114 |
| verse | 2981 |
| word | 523 |

The reel plan: 1565 cards, 1565 traced to a content object by a `reel_of` edge, 0 not.

The heroes and Hajj "short" films (masterplan's flagship derivatives, outside the plan, named by a `room` field): 52 total, 34 traced, either a `room` fragment naming exactly one graph node, a field-section film matched to one gift by its own brief (`tools/films/briefs/plate-<x>.json`), or a hajj.html fragment naming nothing traced honestly to the page itself; 18 not, listed by scripts/graph/build_graph.py's own `short_untraced` flag rather than guessed from the reel's own title:
- 15: a field section on heroes.html, several gifts, not one record
- 1: brief eyebrow names more than one gift: hero:gift-how-light-enters-the-eye, hero:gift-the-long-road-to-eyeglasses
- 1: no gift in f-mathematics shares a name with the brief
- 1: no gift in f-word-and-page shares a name with the brief
<!-- graph-counts:end -->
