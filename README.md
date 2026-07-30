# NOOR — نُور | Codex of Light

A chronological Islamic educational Codex from **Kun Fayakun** to **Jannah**.

**64 nodes • 71 character seals** • Qur’an (107 ayat, with tilawah) • authentic Hadith (161, with sources) • classical sirah  
Prophets and Companions represented by **light and abstract seals only** — never faces.

## Live

→ **https://noor-islamic-timeline.vercel.app**

Repo: https://github.com/Eouchi147/noor

## Structure

| Period | Focus |
|--------|--------|
| **Al-Bidaya** | Creation → Nuh, Hud, Salih |
| **Qisas al-Anbiya** | Ibrahim → Isa |
| **Al-Seerah** | Jahiliyya → Farewell Hajj → the Passing ﷺ |
| **Al-Nihaya** | Minor Signs → Mahdi → the Ten → Hawd → Sirat → Jannah (sequence strips, timelines, Shield boxes) |

## Current status (July 2026 — v2 “Illuminated”)

- 64-node Path (chronologically renumbered) — every node with facts grid, Qur'an + Alafasy tilawah, sourced hadith, lessons, cross-links
- Flagships: Isra 1031 · Badr 1041 · Uhud 1094 · Khandaq 901 · Hudaybiyyah 907 · Fath 909 · Adam 1013 · Ibrahim 715 · Iqra 670 · Jannah 718 words
- Characters hub: 71 seals (Companions · Angels · Jinn · Animals · End of Time), linked both ways with the Path
- Visual engine (noor-fx.js): starfield + gold motes, layered parallax, 3D tilt tiles, illuminated period gates, cinematic modal — GPU-only, reduced-motion aware
- Tailwind precompiled to assets/tw.css (no runtime CDN compiler) — ~130 KB gz critical path, images lazy-loaded
- i18n Phase A + i18n/en.json master pack (translator-ready) · deep links ?node= / ?open=
- e2e suite: tests/e2e.mjs (40 assertions, desktop + iPhone viewport)

See NOOR-HANDOFF.md for the full delivery report and push guide.

## Respect rules

- No faces of prophets or companions (light, seals, calligraphy only)
- Content from Qur’an, authentic Hadith, classical sources
- Educational / contemplative — not a fatwa source

## Tech

- `index.html` + `characters.html` (+ legacy `companions.html`) · data: `nodes.js`, `characters.js` · engine: `noor-fx.js`
- Content pipeline: `scripts/patches/*` → `node scripts/build.mjs` (validates links/images, prints audit)
- Tailwind precompiled to `assets/tw.css`, pure CSS/canvas animations
- Deployed on Vercel from this repo

```bash
npx serve .
```
