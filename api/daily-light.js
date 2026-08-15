import { askOpenRouter } from "./_models.js";
import { settings } from "./settings.js";
// Today's Light · one small illumination per day, sitewide.
// Cost discipline: the answer is CDN-cached for a full day, so the AI is
// asked roughly once per day, not once per visitor. If the key is absent
// or the model stumbles, a curated treasury below answers instead, so the
// tile never goes dark and never invents.

const TREASURY = [
  { category: "Founders", title: "A woman founded the world's oldest university", story: "In 859 CE, Fatima al-Fihri, a Muslim woman in Fez, spent her inheritance to found al-Qarawiyyin, recognized by UNESCO and Guinness as the oldest continuously operating degree-granting university on earth. It still teaches today.", detail: "Fez, Morocco · 859 CE", link: "/characters" },
  { category: "Optics", title: "The scientific method has a father from Basra", story: "Ibn al-Haytham's Book of Optics (c. 1021) proved vision happens when light enters the eye, built the first camera obscura experiments, and insisted every claim be tested by repeatable experiment, centuries before Europe's scientific revolution.", detail: "Ibn al-Haytham · c. 965-1040 CE", link: "/words" },
  { category: "Mathematics", title: "Algorithm is a man's name", story: "The word algorithm comes from al-Khwarizmi, the Baghdad scholar whose 9th-century book on completion and balancing gave the world algebra (al-jabr). Every app you touch today runs on ideas that pass through his name.", detail: "House of Wisdom, Baghdad · 9th century", link: "/words" },
  { category: "Medicine", title: "Europe studied a Muslim's medical book for 600 years", story: "Ibn Sina's Canon of Medicine, finished in 1025, organized the world's medical knowledge so completely that European universities used it as a core textbook into the 17th century, and it described contagion long before germ theory.", detail: "Ibn Sina (Avicenna) · 980-1037 CE", link: "/characters" },
  { category: "Surgery", title: "The surgeon whose tools you would recognize today", story: "Al-Zahrawi of Cordoba illustrated some 200 surgical instruments around 1000 CE: forceps, scalpels, surgical needles, and used dissolving catgut for internal stitches, a practice surgeons still rely on.", detail: "Al-Zahrawi · Cordoba, c. 1000 CE", link: "/characters" },
  { category: "Preservation", title: "A book memorized by millions, letter-perfect", story: "The Qur'an is the only book on earth memorized cover to cover by millions of living people, in its original language, across every continent. This unbroken human chain of memory has guarded its text for over 14 centuries.", detail: "From revelation to today", link: "/quran" },
  { category: "Astronomy", title: "A woman built the instruments that read the sky", story: "In 10th-century Aleppo, Mariam al-Ijliya (al-Astrulabi) crafted astrolabes, the era's finest instruments for navigation and timekeeping, and served the city's court as a celebrated maker.", detail: "Aleppo · 10th century", link: "/characters" },
  { category: "Flight", title: "The first recorded flight attempt was in Cordoba", story: "In the 9th century, Abbas ibn Firnas built a glider of silk and feathers and leapt from a height in Cordoba, flying for a time before a rough landing. A crater on the far side of the Moon now bears his name.", detail: "Abbas ibn Firnas · c. 810-887 CE", link: "/characters" },
  { category: "Libraries", title: "Timbuktu was a city of books", story: "At its height, Timbuktu's scholars and families kept hundreds of thousands of manuscripts on law, astronomy, medicine and faith, private libraries in the Sahara, many preserved to this day by their descendants.", detail: "Mali · 13th-16th centuries", link: "/places" },
  { category: "Travel", title: "He out-traveled Marco Polo three times over", story: "Ibn Battuta left Tangier in 1325 for hajj and kept going for 29 years: some 117,000 km across Africa, Arabia, India, Southeast Asia and China, leaving one of history's greatest travel accounts, the Rihla.", detail: "Ibn Battuta · 1304-1369 CE", link: "/places" },
  { category: "Coffee", title: "Your morning coffee has Sufi roots", story: "Coffee spread through the world from 15th-century Yemen, where Sufis in Mocha drank qahwa to stay awake for night devotion. From their gatherings it reached Makkah, Cairo, Istanbul, and eventually every café on earth.", detail: "Yemen · 15th century", link: "/words" },
  { category: "Architecture", title: "Sinan built 300 works of light", story: "Mimar Sinan, chief Ottoman architect of the 16th century, raised over 300 structures including the Süleymaniye and Selimiye mosques, engineering domes so precise they have survived centuries of earthquakes.", detail: "Istanbul & Edirne · 16th century", link: "/places" },
  { category: "Charity", title: "The oldest running charities are waqf endowments", story: "Islamic civilization built the waqf: permanent charitable endowments funding hospitals, fountains, schools and travelers' lodges. Some, like al-Qarawiyyin's, have served their communities for over a thousand years.", detail: "Across the Muslim world", link: "/begin" },
  { category: "Language", title: "Dozens of English words came through Arabic", story: "Sugar, cotton, sofa, tariff, magazine, zenith, nadir, alchemy, alkali, algebra: everyday English carries dozens of words that traveled through Arabic scholarship and trade into Europe's tongues.", detail: "A shared inheritance", link: "/words" }
];

const THEMES = [
  "a Muslim scientific or medical breakthrough, classical golden age",
  "a moment from the life of a companion of the Prophet ﷺ",
  "an on-this-day event of Islamic history near this date",
  "a wonder of Islamic architecture or a sacred place",
  "a modern discovery, invention or achievement by a Muslim",
  "the story behind a word, practice or tradition of the ummah",
  "libraries, books and the preservation of knowledge in Islam"
];

function dayIndexOf(dateStr) {
  const d = new Date(dateStr + "T12:00:00Z");
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start) / 86400000);
}
function fallback(dateStr) {
  const f = TREASURY[dayIndexOf(dateStr) % TREASURY.length];
  return Object.assign({ date: dateStr, source: "treasury" }, f);
}

/* warm-instance memory: one generation per date, capped */
const cache = new Map();
function remember(dateStr, data) {
  cache.set(dateStr, data);
  if (cache.size > 64) cache.delete(cache.keys().next().value);
  return data;
}

export default async function handler(req, res) {
  const today = new Date().toISOString().slice(0, 10);
  /* ?date=YYYY-MM-DD reaches back through the lamp's memory, 30 days deep.
     Past days freeze at the CDN for a month; today refreshes daily. */
  let want = String((req.query && req.query.date) || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(want)) want = today;
  const age = Math.floor((Date.parse(today) - Date.parse(want)) / 86400000);
  if (!(age >= 0 && age <= 30)) want = today;
  const isToday = want === today;
  res.setHeader("Cache-Control", isToday
    ? "public, s-maxage=86400, stale-while-revalidate=172800"
    : "public, s-maxage=2592000, stale-while-revalidate=2592000");
  if (cache.has(want)) return res.status(200).json(cache.get(want));

  const key = process.env.OPENROUTER_API_KEY;
  /* the owner can send the lamp back to the curated treasury, which never
     invents and never costs anything */
  let dial = null;
  try { dial = await settings(); } catch {}
  if (dial && dial["light.ai"] === false) return res.status(200).json(remember(want, fallback(want)));
  if (!key) return res.status(200).json(remember(want, fallback(want)));

  const SYSTEM = [
    "You write one small daily illumination for NOOR Codex of Light, a free Islamic library. Reply with JSON ONLY, exactly:",
    '{"category":"...","title":"...","story":"...","detail":"..."}',
    "category: one or two words (History, Medicine, Astronomy, Companions, Architecture, On this day...).",
    "title: a striking, truthful headline under 60 characters.",
    "story: 55 to 90 words, vivid and precise, for a general audience. Theme for this day: " + THEMES[dayIndexOf(want) % THEMES.length] + ". A well-established fact only.",
    "detail: one short line: who / where / when.",
    "Accuracy is sacred: choose only well-documented facts; never invent dates, numbers or quotes; avoid miracle-science claims and disputed attributions. Never use the em dash character; use commas or · instead."
  ].join("\n");

  try {
    /* the whole free chain, not one model: this line used to name Claude Sonnet,
       and a single model that is rate limited is a tile that does not appear */
    const got = await askOpenRouter(
      [{ role: "system", content: SYSTEM },
       { role: "user", content: "The light for " + want + ". Choose the single best-documented fact fitting the theme." }],
      { max_tokens: 350, temperature: isToday ? 0.5 : 0.2 }
    );
    if (!got.text) throw 0;
    const raw = got.text;
    let p = null;
    try { p = JSON.parse(raw); } catch { const m = raw.match(/\{[\s\S]*\}/); if (m) { try { p = JSON.parse(m[0]); } catch {} } }
    if (!p || !p.title || !p.story) throw 0;
    const clean = x => String(x || "").replace(/—|–/g, "·").trim();
    const data = {
      date: want, source: "lantern",
      category: clean(p.category).slice(0, 24) || "History",
      title: clean(p.title).slice(0, 90),
      story: clean(p.story).slice(0, 700),
      detail: clean(p.detail).slice(0, 90)
    };
    return res.status(200).json(remember(want, data));
  } catch {
    return res.status(200).json(remember(want, fallback(want)));
  }
}
