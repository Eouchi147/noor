/* NOOR · what the year is made of
   ===========================================================================
   The observances, and for each one: what a person actually does, what that
   rests on, and whether Muslims agree about it.

   Three rules govern every entry here, and they are not stylistic.

   1. NO INVENTED CITATIONS. Every hadith number below was opened and read on
      sunnah.com before it was written down. Where a practice is real but no
      number could be verified, `basis` says so in words and the post carries
      no number at all. Attributing something to the Prophet (peace be upon
      him) that he did not say is not a formatting error, and a number that
      resolves to the wrong hadith is exactly that. Numbering differs between
      editions -- islamqa numbers the Ashura hadith 1916 where sunnah.com
      numbers it 1134a -- so this file uses sunnah.com numbering throughout
      and links there, or it links nowhere.

   2. DISPUTED MEANS DISPUTED. Mawlid, mid-Sha'ban and 27 Rajab are contested
      among scholars who are all worth listening to. Each carries `status:
      "disputed"` and both positions, named. A library that quietly picks a
      side while sounding neutral is worse than one that argues openly.

   3. THE LANTERN MAY NOT TOUCH ANY OF IT. Every entry is lvl "quran",
      "sunnah" or "debated", all three of which the existing polish guard
      already refuses to rewrite. The wording that reaches a reader is the
      wording written here by a person.
--------------------------------------------------------------------------- */

const S = n => "https://sunnah.com/" + n;

/* ---------------------------------------------------------------------------
   fixed points in the Hijri year, keyed "month-day"
--------------------------------------------------------------------------- */
export const FIXED = {
  "1-1": {
    key: "new-year", tag: "#HijriNewYear", name: "The Hijri New Year", lvl: "debated", status: "agreed",
    what: "A new Islamic year begins. The count starts from the Hijra, the migration to Madinah, not from a birth or a battle: the year a scattered community became a society with obligations to one another.",
    todo: ["There is no prescribed act of worship for this day.",
           "Ashura falls on the 10th of this month: that one is a fast worth preparing for."],
    basis: "The calendar's starting point is a decision of Umar ibn al-Khattab and his council, not a revealed date.",
    lead: []
  },
  "1-9": {
    key: "tasua", tag: "#Ashura", name: "The ninth of Muharram", lvl: "sunnah", status: "agreed",
    what: "The day before Ashura. The Prophet ﷺ said that if he lived to the next year he would fast the ninth as well, so that the fast would not look like anyone else's.",
    todo: ["Fast today and tomorrow, if you are able.",
           "Fasting the tenth alone is still valid: the ninth completes it rather than replacing it."],
    basis: "Sahih Muslim 1134a", url: S("muslim:1134a"),
    note: "He stated the intention but died before that Muharram came, so the ninth rests on his stated intention rather than his practice.",
    lead: []
  },
  "1-10": {
    key: "ashura", tag: "#Ashura", name: "Ashura", lvl: "sunnah", status: "agreed",
    what: "The tenth of Muharram. The Prophet ﷺ said he hoped its fast would expiate the year before it.",
    todo: ["Fast, if you are able.", "Pair it with the ninth where you can."],
    basis: "Sahih Muslim 1162a", url: S("muslim:1162a"),
    note: "In Sunni practice this is a fast, not a mourning observance. The expiation reported is of minor sins; major ones need repentance of their own.",
    lead: [7, 3, 1]
  },
  "7-27": {
    key: "rajab27", tag: "#Rajab", name: "The night journey", lvl: "debated", status: "disputed",
    what: "The Isra and Mi'raj are certain: the Qur'an opens Surah al-Isra with the night journey (17:1). The date is not. No authentic report places it on 27 Rajab or in Rajab at all.",
    todo: ["Read Surah al-Isra and the seerah of that night, on any night.",
           "Scholars differ on singling this date out for worship: Ibn Baz and those following him hold it has no basis and should not be marked; others treat a gathering that teaches the story as permissible, but not as prescribed worship."],
    basis: "The event: Qur'an 17:1. The date: not established in any authentic narration.",
    note: "Most reports circulated about Rajab's special virtues are weak or fabricated. What is established is that Rajab is one of the four sacred months (Qur'an 9:36).",
    lead: []
  },
  "8-15": {
    key: "sha3ban15", tag: "#Shaban", name: "The middle of Sha'ban", lvl: "debated", status: "disputed",
    what: "A night some Muslims mark with prayer and seeking forgiveness, and others hold has no established basis.",
    todo: ["Scholars genuinely differ. Ibn al-Jawzi, al-Tartushi and al-Iraqi held that no reliable report establishes merit for this night. Ibn al-Salah, Ibn Taymiyyah and Ibn Rajab held the supporting chains enough to justify praying alone that night.",
           "Both camps reject the fixed congregational hundred-rak'ah prayer attached to it; hadith critics treat that prayer as baseless.",
           "What is not disputed: fasting generously through Sha'ban as a whole is well established from Aisha in both Sahih collections."],
    basis: "The forgiveness narration is Sunan Ibn Majah 1390, graded weak by Darussalam and authentic by al-Albani through combined chains. The narration commanding prayer and fasting that day is Sunan Ibn Majah 1388, graded fabricated.",
    url: S("ibnmajah:1390"),
    note: "Named graders, because the grading itself is contested. Do not present either narration as a settled basis.",
    lead: []
  },
  "9-1": {
    key: "ramadan", tag: "#Ramadan", name: "Ramadan begins", lvl: "quran", status: "agreed",
    what: "The month of the Qur'an, and the fast that is one of the five pillars.",
    todo: ["Fast from dawn to sunset.", "The night prayer, taraweeh, begins tonight in most mosques.",
           "Those the fast would harm, the ill, the travelling, the pregnant and nursing, the elderly, have allowances written into the ruling itself."],
    basis: "Qur'an 2:183-185",
    lead: [30, 14, 7, 3, 1]
  },
  "9-21": { key: "lastten", tag: "#LaylatAlQadr", name: "The last ten nights", lvl: "sunnah", status: "agreed",
    what: "The Prophet ﷺ said to search for Laylat al-Qadr in the odd nights of the last ten of Ramadan.",
    todo: ["Pray at night through all ten, not one.", "Many keep i'tikaf in the mosque for these nights."],
    basis: "Sahih al-Bukhari 2017", url: S("bukhari:2017"),
    note: "The commonest misconception is that the night IS the 27th. The 27th is the most emphasised candidate, not an established fact: the night is concealed on purpose, and the instruction is to search. Which nights are odd also depends on when Ramadan began where you are.",
    lead: [3] },
  "10-1": {
    key: "eid-fitr", tag: "#EidAlFitr", name: "Eid al-Fitr", lvl: "sunnah", status: "agreed",
    what: "The fast is complete. The first day of Shawwal is a day of eating, and fasting it is forbidden.",
    todo: ["Do not fast today.", "The Eid prayer is in the morning.",
           "Zakat al-Fitr is given before the prayer, not after it."],
    basis: "The prohibition on fasting the two Eids: Sahih al-Bukhari 1991", url: S("bukhari:1991"),
    note: "This is a prohibition and there is consensus on it: it holds even for someone making up missed Ramadan days.",
    lead: [3, 1]
  },
  "10-2": {
    key: "shawwal6", tag: "#Shawwal", name: "The six of Shawwal", lvl: "sunnah", status: "agreed",
    what: "Six voluntary days fasted during Shawwal, which the Prophet ﷺ said is as though one had fasted the whole year.",
    todo: ["Any six days this month, together or spread out.",
           "The majority hold that missed Ramadan days are made up first."],
    basis: "Sahih Muslim 1164a", url: S("muslim:1164a"),
    note: "Imam Malik disliked it, fearing it would come to be treated as obligatory. It is voluntary. Do not present it as a duty.",
    lead: []
  },
  "12-1": {
    key: "dhulhijjah", tag: "#DhulHijjah", name: "The first ten days of Dhul Hijjah", lvl: "sunnah", status: "agreed",
    what: "The Prophet ﷺ said no days have deeds more beloved to Allah than these.",
    todo: ["Increase whatever you already do: dhikr, charity, Qur'an, prayer.",
           "Many fast the first nine days. The tenth is Eid and must not be fasted."],
    basis: "Sahih al-Bukhari 969", url: S("bukhari:969"),
    note: "Bukhari 969 is about righteous deeds generally, not about fasting specifically. Framing it as a fasting hadith overstates it.",
    lead: [7, 3, 1]
  },
  "12-9": {
    key: "arafah", tag: "#Arafah", name: "The Day of Arafah", lvl: "sunnah", status: "agreed",
    what: "The pilgrims stand at Arafah. For everyone else, the Prophet ﷺ said he hoped its fast would expiate the year before it and the year after.",
    todo: ["Fast, if you are not on Hajj.", "Make du'a: much of the day is for asking."],
    basis: "Sahih Muslim 1162a", url: S("muslim:1162a"),
    note: "Pilgrims standing at Arafah do not fast. This fast is for those not on Hajj.",
    lead: [7, 3, 1]
  },
  "12-10": {
    key: "eid-adha", tag: "#EidAlAdha", name: "Eid al-Adha", lvl: "sunnah", status: "agreed",
    what: "The day of sacrifice. Like Eid al-Fitr, it is a day of eating and fasting it is forbidden.",
    todo: ["Do not fast today.", "The Eid prayer is in the morning.",
           "Where a sacrifice is made, a share of the meat is for those who need it."],
    basis: "Sahih al-Bukhari 1991", url: S("bukhari:1991"),
    lead: [3, 1]
  },
  "12-11": {
    key: "tashriq", tag: "#DhulHijjah", name: "The days of Tashriq", lvl: "sunnah", status: "agreed",
    what: "The three days after Eid al-Adha. The Prophet ﷺ called them days of eating and drinking, and they are not fasted.",
    todo: ["Do not fast today.", "The takbir continues through these days."],
    basis: "Sahih Muslim 1141a", url: S("muslim:1141a"),
    note: "Scholars differ on exactly when the takbir after each prayer starts and ends; the common position for those not on Hajj is from Fajr of the ninth to Asr of the thirteenth. No authentic report fixes a single wording.",
    lead: []
  }
};

/* ---------------------------------------------------------------------------
   the twelve months, for the mornings that belong to no observance

   The dawn slot used to say "an ordinary day" and stop, which is true and
   teaches nothing. Most mornings ARE ordinary; the month they sit in never is.
   So each month carries a short piece a person can actually use, written under
   the same three rules as everything above: verified numbers or no numbers,
   disputes named as disputes, nothing here for the Lantern to touch.
--------------------------------------------------------------------------- */
export const MONTHS = {
  1: { name: "Muharram", lvl: "sunnah",
    what: "Muharram is one of the four sacred months the Qur'an names, in which wrongdoing weighs heavier and fighting was forbidden (Qur'an 9:36). The Prophet ﷺ called it the month of Allah, and said its fast is the most excellent after Ramadan.",
    basis: "Sahih Muslim 1163a", url: S("muslim:1163a"),
    note: "The month's summit is Ashura on the tenth, with the ninth fasted beside it." },
  2: { name: "Safar", lvl: "sunnah",
    what: "Safar carries no rulings of its own, and that absence is its lesson. Arabia held the month to be unlucky; the Prophet ﷺ swept the superstition away in one line: no omen-borne contagion, no Safar. A month cannot harm you, and nothing in the calendar is against you.",
    basis: "Sahih Muslim 2220a", url: S("muslim:2220a"),
    note: "The ordinary rhythm carries the month: Friday, Monday and Thursday, and the three white days." },
  3: { name: "Rabi al-Awwal", lvl: "debated",
    what: "The month in which, by the weight of the sources, the Prophet ﷺ was born, and in which he certainly died. His birth is the quietest fact in his biography and his death the most precisely recorded, and both fall here.",
    basis: "The death in Rabi al-Awwal, 11 AH, is established in the earliest biographies; the birth date is reported variously, with the twelfth most often cited.",
    note: "Marking the birth is a matter the scholars genuinely differ on, and both positions are held by people worth hearing. What no one disputes is that knowing his life is part of loving him." },
  4: { name: "Rabi al-Akhir", lvl: "editorial",
    what: "No fast, no feast, no night of vigil is prescribed in Rabi al-Akhir. Months like this one are what most of a Muslim life is made of, and the deen was built to be lived in them: the five prayers, the Friday gathering, the two fasting days a week for those who keep them.",
    basis: "",
    note: "The white days of every month, the thirteenth to the fifteenth, are this month's standing appointment." },
  5: { name: "Jumada al-Ula", lvl: "editorial",
    what: "An unmarked month. The Prophet's ﷺ own practice filled ordinary months with small constant things, and he said the most beloved deeds to Allah are the most constant, even if small. A month with no occasion is the month that shows what is actually habit.",
    basis: "The constancy hadith is in both Sahih collections, from Aisha.",
    note: "" },
  6: { name: "Jumada al-Akhirah", lvl: "editorial",
    what: "The last unmarked month before the sacred season begins. From next month the year climbs: Rajab is sacred, Sha'ban carried the Prophet's ﷺ longest voluntary fasting, and then Ramadan. This month is the quiet before that ascent, and the right place to settle debts of prayer and fasting.",
    basis: "",
    note: "" },
  7: { name: "Rajab", lvl: "quran",
    what: "Rajab is one of the four sacred months (Qur'an 9:36), held sacred even before Islam, and the Qur'an confirmed it. Nothing further is soundly established for it: most reports naming special Rajab prayers or fasts are weak or fabricated, and the scholars of hadith say so plainly.",
    basis: "Qur'an 9:36",
    note: "Honouring the month means what honouring any sacred month means: weighing wrongdoing more heavily, not inventing worship for it." },
  8: { name: "Sha'ban", lvl: "sunnah",
    what: "Aisha said she never saw the Prophet ﷺ fast more in any month, after Ramadan, than in Sha'ban. It is the month deeds of the year are raised, and he wished his to be raised while he was fasting; the ummah has read it as Ramadan's training ground ever since.",
    basis: "Aisha's report is in both Sahih collections; the raising of deeds is in the Sunan, graded hasan by some.",
    note: "The middle night is genuinely disputed, and the entry for that night names both positions." },
  9: { name: "Ramadan", lvl: "quran",
    what: "The month the Qur'an came down, and the fast that is one of the five pillars (Qur'an 2:183-185). Every day of it is a dated observance of its own.",
    basis: "Qur'an 2:183-185",
    note: "" },
  10: { name: "Shawwal", lvl: "sunnah",
    what: "The month opens with Eid al-Fitr, a day on which fasting is forbidden, and then offers six voluntary days which the Prophet ﷺ said complete the year, as though one had fasted all of it.",
    basis: "Sahih Muslim 1164a", url: S("muslim:1164a"),
    note: "Any six days of the month, together or apart; most scholars say missed Ramadan days come first." },
  11: { name: "Dhul-Qa'dah", lvl: "quran",
    what: "The first of the two pilgrimage months, and one of the four sacred months (Qur'an 9:36). In Arabia it was the truce month in which the roads opened for the journey to Makkah, and Anas reports that the Prophet's ﷺ umrahs all fell in it, apart from the one joined to his Hajj.",
    basis: "Qur'an 9:36. Anas's report on the umrahs is in the Sahih collections.",
    note: "" },
  12: { name: "Dhul-Hijjah", lvl: "sunnah",
    what: "The month of Hajj. Its first ten days are the days the Prophet ﷺ said hold the deeds most beloved to Allah, with Arafah on the ninth, Eid al-Adha on the tenth and the days of Tashriq after it.",
    basis: "Sahih al-Bukhari 969", url: S("bukhari:969"),
    note: "" }
};

/* ---------------------------------------------------------------------------
   things that come round every week or every month
--------------------------------------------------------------------------- */
export const RECURRING = [
  {
    key: "jumuah", tag: "#Jumuah", name: "Friday", lvl: "sunnah", status: "agreed",
    when: g => new Date(g + "T12:00:00Z").getUTCDay() === 5,
    what: "The week's gathering. There is an hour on Friday in which supplication is answered.",
    todo: ["Read Surah al-Kahf, today or last night.",
           "Ask in the hour before Maghrib, and in the hour the imam sits until the prayer ends: the strongest two views on when it falls, and Ibn Baz advised hoping for both."],
    basis: "The hour: Sahih Muslim 853", url: S("muslim:853"),
    note: "The Surah al-Kahf report is not in Bukhari or Muslim: it is in Mishkat al-Masabih 2175, from al-Bayhaqi, and the stronger chain is Abu Sa'id's own words rather than the Prophet's. The practice is broadly recommended; the attribution should not be inflated."
  },
  {
    key: "monthu", tag: "#Sunnah", name: "Monday and Thursday", lvl: "sunnah", status: "agreed",
    when: g => [1, 4].includes(new Date(g + "T12:00:00Z").getUTCDay()),
    what: "The Prophet ﷺ said deeds are presented on these two days, and he liked his to be presented while fasting.",
    todo: ["Fast, if it does you no harm."],
    basis: "Jami at-Tirmidhi 747, graded hasan", url: S("tirmidhi:747"),
    note: "Voluntary, and dropped if it causes harm."
  },
  {
    key: "whitedays", tag: "#Sunnah", name: "The White Days", lvl: "sunnah", status: "agreed",
    /* the suppression below is not a nicety. The 13th of Dhul Hijjah is a day
       of Tashriq, which may not be fasted -- so the one month of the year when
       this reminder would be actively wrong is the month it must not run. */
    when: (g, h) => h && [13, 14, 15].includes(h.d) && h.m !== 12,
    what: "The thirteenth, fourteenth and fifteenth of each Hijri month: the three days whose fast the Prophet ﷺ named to Abu Dharr.",
    todo: ["Fast today, if you are able."],
    basis: "Jami at-Tirmidhi 761, graded hasan", url: S("tirmidhi:761"),
    note: "The underlying recommendation is three days a month; these three are the preferred form, not a separate obligation."
  }
];

/* ---------------------------------------------------------------------------
   what is true of this one day
--------------------------------------------------------------------------- */
export function readDay(h) {
  if (!h) return null;                       /* unverified date -> say nothing */
  const out = { hijri: h, fixed: null, recurring: [], lead: [] };
  out.fixed = FIXED[h.m + "-" + h.d] || null;
  /* Dhul Hijjah 2-8 all sit inside the ten days */
  if (!out.fixed && h.m === 12 && h.d >= 2 && h.d <= 8) out.fixed = FIXED["12-1"];
  if (!out.fixed && h.m === 12 && h.d >= 12 && h.d <= 13) out.fixed = FIXED["12-11"];
  if (!out.fixed && h.m === 9 && h.d >= 22 && h.d <= 29) out.fixed = FIXED["9-21"];
  for (const r of RECURRING) { try { if (r.when(h.g, h)) out.recurring.push(r); } catch { } }
  return out;
}

/* which observances are N days out, so the lead-up can be announced */
export function leadsFor(todayH, aheadList) {
  const out = [];
  if (!todayH) return out;
  for (const ah of aheadList) {
    if (!ah) continue;
    const f = FIXED[ah.m + "-" + ah.d];
    if (!f || !f.lead || !f.lead.length) continue;
    const gap = Math.round((Date.parse(ah.g) - Date.parse(todayH.g)) / 86400000);
    if (f.lead.includes(gap)) out.push({ obs: f, days: gap, on: ah });
  }
  return out;
}
