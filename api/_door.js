// NOOR · the door of the week: the one room of the library the site puts forward.
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS (3 October 2026, LANTERN.md section 8, item 2)
//
// The Lantern may choose which of the library's own rooms the site puts
// forward for a week (api/_mission.js, the R2 hand feature-door). This file
// is the small, public half of that power: the rooms it may choose from,
// the record it writes, and the one read the public side makes of it. It is
// kept apart from api/_mission.js on purpose, so the server page /today
// (api/page.js) and the settings answer can read the door without loading
// the Lantern's hands, its council or its memory.
//
// THE ROOMS. MAP below is the library's own map, copied word for word from
// noor-fx.js (its MAP list, the menu every page opens); tests/mission.mjs
// reads noor-fx.js and fails the moment the two differ, so a room added,
// renamed or reworded there must be carried here the same day. A door is
// always said in the map's own words, its title and its one line, never in
// a model's: the record names a path, and the words are looked up here at
// every read, so even a record written by hand cannot put other words on
// the public pages.
//
// NEVER PUT FORWARD: the gift door (LANTERN.md: never /donate) and the
// console (it is in no map); Today, which already has its own screen on
// both pages the door is shown on; and the house's own business rather
// than the library (the journal, corrections, the terms).
//
// THE RECORD, nsoul:pub:door: {id, path, title, desc, since, until, at, by,
// why}. `since` is the day it was chosen; it shows on that day and the six
// after it, and `until` (since plus 7 days) is the first day it no longer
// shows. A door past its days is simply not shown; the record stays as it
// is until the next choice replaces it.
// ---------------------------------------------------------------------------

import { kv, kvReady } from "./_kv.js";

export const DOOR_KEY = "nsoul:pub:door";
export const DOOR_DAYS = 7;

/* noor-fx.js MAP, verbatim: [section, its line, [[title, line, path], ...]] */
export const MAP = Object.freeze([
  ["The Qur'an", "The text itself, and what is needed to hold it", [
    ["The Mushaf", "All 114 surahs, with recitation for every ayah", "/quran"],
    ["The Letters", "Learn to read the Arabic script, letter by letter", "/arabic"],
    ["The Words of the Path", "The du'as worth carrying, in Arabic and English", "/words"]
  ]],
  ["Belief", "Who He is, who He sent, and what is unseen", [
    ["The Ninety-Nine Names", "His names, what He is not, and the three doors of tawhid", "/allah"],
    ["The 25 Prophets", "Every prophet named in the Qur'an", "/prophets"],
    ["The Seerah", "Twenty-three years, his character and his habits", "/muhammad"],
    ["Theology", "The branches, and where they parted", "/theology"],
    ["The Unseen", "Angels, jinn, the barzakh, the signs of the Hour", "/unseen"],
    ["The Journey of the Soul", "What happens after the last breath", "/soul"]
  ]],
  ["Worship", "How it is actually done", [
    ["The Five Pillars", "Shahadah, salah, zakat, sawm, hajj", "/pillars"],
    ["Begin", "For anyone new to Islam, from the first day", "/begin"],
    ["Ramadan", "The month, and the tools for it", "/ramadan"],
    ["Hajj & Umrah", "The rites, step by step, with their evidence", "/hajj"],
    ["Your Pilgrim Plan", "A plan written from your own answers", "/hajj-plan"],
    ["The Two Eids", "Fitr and Adha", "/eid"]
  ]],
  ["The Story", "Where all of it came from, and where it is going", [
    ["The Path of Creation", "71 chapters, from Kun Fayakun to the Hour", "/path"],
    ["Today", "One Light, one word and one chapter of the Path, every day", "/today"],
    ["The Lights", "350 Lights of history and science, each with its date", "/light"],
    ["The Verses", "One verse, one thought, each with its recitation and its meaning", "/verses"],
    ["The Companions", "The men and women who saw him ﷺ", "/companions"],
    ["Heroes of Islam", "The people who carried it after them", "/heroes"],
    ["Characters", "Everyone the Codex names", "/characters"],
    ["Places", "The ground it happened on", "/places"],
    ["The Last Sermon", "The final khutbah, line by line", "/sermon"],
    ["Two Lives", "The scale, and what is on it", "/mizan"]
  ]],
  ["Daily Life", "The practice as it meets an ordinary week", [
    ["How to Live a Good Life", "Tayyiba: a good life, not an easy one", "/good-life"],
    ["Three Lives", "Weigh your own against them", "/three-lives"],
    ["The Family Room", "Children, parents, neighbours", "/family"],
    ["Marriage & the Home", "From the proposal to the household", "/marriage"],
    ["Prophetic Health", "The body, the plate, the fast, hijama", "/health"],
    ["For Teenagers", "Written for them, not about them", "/teens"],
    ["Protection & the Light", "Sihr, ruqya, the evil eye, and the myths", "/protection"],
    ["Are We in a Simulation?", "The modern question, answered from the text", "/simulation"]
  ]],
  ["Look It Up", "When you need one thing, fast", [
    ["The Encyclopedia of the Path", "523 words this library uses, defined", "/dictionary"],
    ["The Classroom", "The whole curriculum, in order", "/madrasa"],
    ["The School", "The full course, for schools and organisations", "/school"]
  ]],
  ["Children", "Built for them, not simplified for them", [
    ["The Kids' Codex", "The Greatest Game", "/kids"],
    ["The Hall of Stories", "His names, told as stories", "/stories"],
    ["The Lantern Sky", "Light the whole day with prayer", "/kids/lanterns"]
  ]],
  ["The House", "The building itself", [
    ["Give a Gift", "Keep the lamp lit", "/donate"],
    ["The Masjid Toolbox", "Boards, timetables and printables", "/masjid"],
    ["The Guardian's Journal", "What the keeper is thinking about", "/journal"],
    ["Corrections & Ideas", "Tell us what is wrong", "/feedback"],
    ["Terms & Transparency", "Where the money goes, and what is collected", "/legal"]
  ]]
]);

/* never put forward (see the header) */
export const NEVER = Object.freeze(["/donate", "/today", "/journal", "/feedback", "/legal"]);

/* every room the door may open on, in the map's order, with its section */
export const DOORS = Object.freeze(MAP.flatMap(([section, , rooms]) => rooms
  .filter(r => !NEVER.includes(r[2]))
  .map(r => Object.freeze({ path: r[2], title: r[0], desc: r[1], section }))));

const PATH_RX = /^\/[a-z0-9-]+(\/[a-z0-9-]+)*$/;
const realDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
export const addDaysD = (date, n) => new Date(Date.parse(date + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);

/* a room of the map by its path, in the map's own words, or null */
export function doorOf(path) {
  const p = String(path || "").trim();
  if (!PATH_RX.test(p)) return null;
  const d = DOORS.find(x => x.path === p);
  return d ? { path: d.path, title: d.title, desc: d.desc } : null;
}

/* the record as the public reads it on `today`: {path, title, desc} in the
   map's own words, or null (no record, a path no longer in the map, or a
   day outside since..until) */
export function publicDoor(rec, today) {
  if (!rec || typeof rec !== "object") return null;
  const d = doorOf(rec.path);
  if (!d) return null;
  if (!realDate(rec.since) || !realDate(rec.until) || !realDate(today)) return null;
  if (today < rec.since || today >= rec.until) return null;
  return d;
}

/* the stored record, or null; a store fault throws (a writer must never
   read a fault as "no door") */
export async function readDoorRaw(ctx = {}) {
  const ready = ctx.kvReady || kvReady;
  if (!ready()) return null;
  const r = await (ctx.kv || kv)([["GET", DOOR_KEY]]);
  const raw = r && r[0];
  if (raw == null || raw === "") return null;
  try { const v = typeof raw === "string" ? JSON.parse(raw) : raw; return v && typeof v === "object" ? v : null; } catch { return null; }
}

/* the public read: the door showing today, or null. Never throws. */
export async function readPublicDoor(today, ctx = {}) {
  try { return publicDoor(await readDoorRaw(ctx), today || new Date().toISOString().slice(0, 10)); }
  catch { return null; }
}
