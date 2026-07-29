# NOOR i18n Foundation

## Goal
Translate the Codex into the **maximum number of languages possible**.
Every architectural choice must keep translation cheap, consistent, and complete.

## Design principles

1. **Content is data, not markup**
   - All user-facing strings live in structured objects (NODES, COMPANIONS, UI dictionary).
   - HTML/JS never hardcodes narrative text except as the English source of truth during build.

2. **One source of truth per language**
   - `/i18n/en.json` — English (source)
   - `/i18n/ar.json` — Arabic
   - `/i18n/fr.json` — French
   - `/i18n/{lang}.json` — every additional language
   - Same keys everywhere. Missing keys fall back to English.

3. **Keys, not sentences in code**
   - UI: `t('nav.path')`, `t('hero.enter')`, `t('modal.close')`
   - Nodes: `node.title`, `node.summary`, `node.details`, `node.facts[].label`
   - Never concatenate translated fragments in ways that break grammar.

4. **RTL from day one**
   - `dir="rtl"` when language is Arabic, Urdu, Persian, Hebrew, etc.
   - Layout uses logical properties where possible (start/end, not left/right).
   - Quranic Arabic blocks always `dir="rtl"` regardless of UI language.

5. **Qur’an & Hadith handling**
   - Arabic ayah text is language-invariant (always Arabic).
   - Translation of meaning is per-language.
   - Afasy audio stays the same; UI labels for “Play” are translated.

6. **Language switcher**
   - Persistent control in header.
   - Preference stored in `localStorage` (`noor_lang`).
   - URL optional later: `?lang=fr` or `/fr/...`

7. **What gets translated**
   - All UI chrome
   - Node titles, summaries, details, fact labels, lessons, impact
   - Companion articles
   - Meta description, titles
   - Transliterated place names only when a language has a settled form

8. **Performance**
   - Load only the active language pack.
   - Keep the fast mobile SPA spirit.

## Minimal runtime API (Phase A — in index.html)

```js
NOOR_I18N.t(key)           // resolve UI string
NOOR_I18N.setLang(code)    // switch + dir + re-render
localStorage noor_lang     // persistence
```

## First languages to prioritise (after English)

1. Arabic (source culture + RTL test)
2. French
3. Urdu
4. Indonesian / Malay
5. Turkish
6. Spanish
7. Bengali
8. Russian
9. Chinese (Simplified)
10. Hausa / Swahili

## Implementation phases

**Phase A (now)**  
UI dictionary · `t()` · `dir`/`lang` on `<html>` · language switcher shell · stable node schema

**Phase B**  
Full EN JSON export of every node + companion · AR complete · FR complete

**Phase C**  
Community / professional pipeline · per-language packs or static builds

## Node schema for translators

Translators fill: `title`, `summary`, `details`, `facts[].label`, meaning of ayah, `hadith`, `lessons`.  
Leave untouched: `id`, `period`, `titleAr`, `quran[].ar`, `ref`, audio URLs.

## Do not break

- Fast mobile experience
- Manuscript visual language (language-agnostic)
- Afasy audio URLs
- Respect rules (no faces) across all languages
