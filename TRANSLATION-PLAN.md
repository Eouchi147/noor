# NOOR translation plan (execute after the Codex is approved and frozen)

Goal: the Codex in every major language of the ummah, meticulously, without breaking the one-page-per-room architecture.

## Order of languages
1. Arabic (ar, RTL) 2. French (fr) 3. Urdu (ur, RTL) 4. Turkish (tr) 5. Indonesian (id) 6. Malay (ms) 7. Bengali (bn) 8. Persian (fa, RTL) 9. Spanish (es) 10. German (de), then onward by audience size.

## Architecture (already prepared)
- UI strings: locales/en.json is the master. Each language adds locales/<code>.json with identical keys. The site's data-i18n hooks (noor-fx.js NOOR_I18N) consume them.
- Long-form rooms: parallel directories (/ar/, /fr/, ...) with translated copies of each page, linked by hreflang tags and one sitemap per language. RTL languages get dir="rtl" on <html> plus the RTL stylesheet flip.
- Qur'an room: no retranslation needed; the reader switches editions via the AlQuran Cloud API (already supports en.sahih, fr.hamidullah; add ar tafsir, ur.jalandhry, tr.diyanet, id.indonesian, etc.).
- Today's Light + Lantern core: prompt gains "answer in <language>".

## Method per language (meticulous path)
1. Freeze English source. Export each page's text blocks.
2. Build the sacred-terms glossary first: Allah, the Prophet's ﷺ honorific, surah names, established transliterations. These are never machine-guessed.
3. First-pass translation with a strong model, one page per pass, glossary enforced.
4. Native-speaker review pass (non-negotiable for religious content).
5. Typography pass: Arabic-script languages need font swaps (Amiri already loaded) and RTL layout checks page by page.
6. Ship one language completely before starting the next.

## Rules
- Never translate Qur'an text itself; only pair it with established published translations.
- Meaning over word-for-word; the Codex's warmth must survive.
- Zero em dashes in every language.
