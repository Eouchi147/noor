# NOOR Content Status — v2 (July 2026)

## Definition of Done — all criteria met
| Criterion | Status |
|---|---|
| Badr + Isra ≥ 1000 words, full schema | **1041 / 1031** |
| Uhud, Khandaq, Hudaybiyyah, Fath ≥ 700 + facts + lessons | **1094 / 901 / 907 / 909** |
| Nihaya readable as ordered visual story, dense facts | **19 nodes: sequence + timeline + shield + 6–7 facts each** |
| All tiles have image or intentional pattern, 0 broken paths | **Verified at build time** |
| Cross-links Path ↔ Characters both ways | **Verified by e2e tests** |
| Characters hub covers all 5 sections | **71 seals** |
| UI chrome i18n-keyed, RTL-ready | **66 keys + en.json master pack** |
| Mobile fast, no cramped grid | **~130 KB gz critical path, lazy images, gap-6/8 grid** |
| No prophet/companion faces | **Seals, light, and manuscript scenes only** |
| Repo pushable as static Vercel site | **Yes — see NOOR-HANDOFF.md §3** |

## Node inventory: 64 (bidaya 8 · qisas 15 · seerah 22 · nihaya 19)
New since v1: Farewell Hajj (44) · The Passing ﷺ (45) · Minor Signs (46) · Al-Mahdi (47) · Sun from the West (51) · Al-Hawd (61)
Total narrative: ~30,800 words · 107 ayat cited · 161 hadith cited with sources.

## Regeneration
Edit `scripts/patches/*` → `node scripts/build.mjs` → `node scripts/build-i18n.mjs`.
