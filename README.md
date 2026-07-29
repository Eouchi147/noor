# NOOR — نُور | Codex of Light

A chronological Islamic educational Codex from **Kun Fayakun** to **Jannah**.

**58 nodes** • Qur’an • authentic Hadith • classical sources  
Prophets and Companions represented by **light and abstract seals only** — never faces.

## Live

→ **https://noor-islamic-timeline.vercel.app**

Repo: https://github.com/Eouchi147/noor

## Structure

| Period | Focus |
|--------|--------|
| **Al-Bidaya** | Creation → Nuh, Hud, Salih |
| **Qisas al-Anbiya** | Ibrahim → Isa |
| **Al-Seerah** | Birth of the Prophet → Farewell Hajj & Death |
| **Al-Nihaya** | Signs of the Hour → Jannah (**extreme focus**, infographic-style data cards) |

## Current status (July 2026)

- Visual system: soft light effects, smooth tile physics, CSS-only abstract patterns (fast on iPhone)
- Nihaya section: denser long-form + visual data cards + protection notes (Dajjal)
- Companions page: richer abstract seals, matching design language, 12 seals
- Most major nodes have proper long-form content

## Next smooth steps

1. Fill any remaining short nodes (Hawwa, Qabil & Habil, a few minor Seerah) to full length
2. Add 4–6 more Companion seals as needed
3. Optional: soft period intro banners when filtering
4. Final mobile QA pass on real iPhone
5. Optional Arabic-first toggle later

## Respect rules

- No faces of prophets or companions (light, seals, calligraphy only)
- Content from Qur’an, authentic Hadith, classical sources
- Educational / contemplative — not a fatwa source

## Tech

- `index.html` (main SPA) + `companions.html`
- Tailwind via CDN, pure CSS animations
- Deployed on Vercel from this repo

```bash
npx serve .
```
