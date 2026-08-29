# The Illuminations Library · writer's spec

Read this, then read `build/lights-a.json` as the exemplar if it exists.

You are writing entries for **Today's Light**: the single card that greets every
reader of NOOR Codex of Light each morning. One shows per day, chosen for that
day. There are currently fourteen. There need to be many hundreds.

Output ONE valid UTF-8 JSON file at the path you are given:

```json
{"tranche":"<letter>","lights":[ {...}, {...} ]}
```

## The record

```json
{"id": "unique-kebab-id",
 "kind": "onthisday|science|founder|book|place|practice|word|companion|sign|number",
 "category": "One or two words shown as a chip, e.g. Astronomy",
 "title": "A concrete claim, 4 to 11 words, no colon",
 "story": "90 to 150 words. Plain, unhurried, factual. This is the whole card.",
 "detail": "Who and when and where, under 60 chars. e.g. 'Ibn Sina · 980-1037 CE'",
 "when": {"y": 859, "m": 7, "d": 14},
 "hijri": {"m": 9},
 "tags": ["knowledge","women"],
 "lvl": "quran|sunnah|debated|editorial",
 "src": "required when lvl is quran, sunnah or debated"}
```

- `when` — **only for `kind:"onthisday"`**, and only when the date is genuinely
  known. `y` is required, `m` and `d` optional. **A day you are not sure of is
  omitted, not guessed.** An entry with `y` only still works: it becomes an
  anniversary-year light.
- `hijri` — optional seasonal anchor, `{"m":9}` for Ramadan, `{"m":12}` for Hajj,
  `{"m":1}` for Muharram, `{"m":3}` for Rabi al-Awwal.
- `tags` — free, lowercase, 1 to 4. Used to match a light to a season or a room.
- `lvl` — `editorial` for history and science (our own telling of a known fact);
  `quran` / `sunnah` / `debated` when the card rests on scripture or a report,
  and then `src` is **required**.

## The rules, non-negotiable

1. **Never invent a date, a name, a number or an attribution.** If a year is
   disputed or approximate, write it as `c. 1021` in `detail` and say so in the
   story. A wrong date on a card that greets a hundred thousand readers is worse
   than a card that does not exist. When unsure: leave the entry out.
2. **Never invent a hadith or a verse reference.** Same rule as the whole site.
3. **No em dashes or en dashes anywhere.** Use a comma, a colon, or a new sentence.
4. No exclamation marks, no emoji, no rhetorical questions.
5. Never use: profound, beautiful, amazing, journey, deeply, truly, powerful,
   transformative, incredible, mind-blowing.
6. Write **the Prophet ﷺ** with that symbol, and **Qur'an** with the apostrophe.
7. **No triumphalism and no grievance.** These cards state what happened. They do
   not score points against anybody, and they do not claim Muslims invented
   things they did not. Where a discovery had many hands, say so.
8. Concrete over abstract. Name the person, the city, the year, the object.
9. Each story must be able to stand on its own with no other context.
10. Valid JSON, no trailing commas. Write with the Write tool.

## What makes a good card

The reader is on a phone at 7am. The card has to be worth the fifteen seconds.
The best ones carry **one specific fact that reframes something ordinary**: the
word algorithm is a man's name; the thread inside a modern surgical patient does
not need removing because a surgeon in Cordoba noticed the body absorbs catgut;
the oldest continuously operating university was founded by a woman with her
inheritance.

Avoid: vague praise of "the golden age", lists without a story, anything a reader
could not repeat to somebody else an hour later.

Reply with only: `<letter> done, N lights`.
