/* ============================================================
   NOOR FX: shared experience engine (vanilla, zero-build)
   Particles · starfield · parallax · tilt physics · reveals ·
   lazy images · i18n · tilawah audio · cross-links · toasts
   All animation is transform/opacity only (GPU-composited).
   Honors prefers-reduced-motion. ~9 KB gzipped.
   ============================================================ */

/* ------------------------------------------------------------
   THE SOCIAL ROW · the one list of doors the whole house shares.
   Edit here and every footer on the site changes; nothing is
   pasted into a page. The order below is the order drawn.
   An entry whose href is empty is not drawn at all.
   ------------------------------------------------------------ */
var NOOR_SOCIAL = [
  { id: "instagram", name: "Instagram", href: "https://www.instagram.com/noorcodexoflight" },
  /* the Page has no vanity name yet, so its door is its id */
  { id: "facebook",  name: "Facebook",  href: "https://www.facebook.com/profile.php?id=61592864417863" },
  { id: "youtube",   name: "YouTube",   href: "https://www.youtube.com/@noorcodex" },
  { id: "pinterest", name: "Pinterest", href: "https://www.pinterest.com/noorcodex" },
  { id: "telegram",  name: "Telegram",  href: "https://t.me/noorcodex" },
  { id: "threads",   name: "Threads",   href: "https://www.threads.com/@noorcodexoflight" }
];

(function () {
"use strict";

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const FINE = matchMedia("(hover: hover) and (pointer: fine)").matches;

/* ---------------- i18n (Phase A: EN master inline; packs fetched per-language) ---------------- */
const UI_EN = {
  "nav.books":"Books","nav.path":"Path","nav.characters":"Characters","nav.places":"Places","nav.words":"Words","nav.mizan":"Two Lives","nav.about":"About","nav.kids":"Kids","nav.health":"Health",
  "nav.quran":"Qur'an","nav.prophets":"Prophets","nav.hajj":"Hajj","nav.madrasa":"Madrasa","nav.library":"Library","nav.give":"Give",
  "g.learn":"Learn","g.story":"The Story","g.heart":"The Heart","g.little":"Little Ones","g.houses":"Houses & Support",
  "m.madrasa":"The Classroom \u00b7 Madrasa",
  "m.dictionary": "The Encyclopedia of the Path","m.quran":"The Mushaf \u00b7 Study the Qur'an","m.arabic":"Learn Arabic \u00b7 The Letters","m.words":"The Words of the Path","m.health":"Prophetic Health","m.theology":"Theology \u00b7 The Branches","m.school":"The School \u00b7 Full Curriculum",
  "m.path":"The Path of Creation","m.prophets":"The 25 Prophets","m.companions":"The Companions","m.allah":"The Ninety-Nine Names","m.seerah":"The Seerah · Twenty-Three Years","m.characters":"Characters","m.places":"Places","m.heroes":"Heroes of Islam","m.unseen":"The Unseen & the Mysteries",
  "m.pillars":"The Five Pillars","m.hajj":"Hajj & Umrah","m.hajjplan":"Your Pilgrim Plan","m.begin":"Begin \u00b7 New Muslim","m.family":"The Family Room","m.marriage":"Marriage & the Home","m.teens":"For Teenagers",
  "m.protection": "Protection & the Light","m.ramadan":"Ramadan","m.eid":"The Two Eids","m.sermon":"The Last Sermon","m.soul":"The Journey of the Soul","m.mizan":"Two Lives",
  "m.stories":"The Hall of Stories","m.kidscodex":"The Kids' Codex","m.lanterns":"The Lantern Sky",
  "m.masjid":"The Masjid Toolbox","m.orgs":"For Schools & Organizations","m.give":"Give a Gift","m.feedback":"Corrections & Ideas","m.legal":"Terms & Transparency",
  "lang.choose":"Choose your language","lang.note":"The Codex answers in your language. The deepest rooms are still being carried over, wave by wave; what is not yet carried stays in English.","lang.fallback":"That language pack could not be loaded right now.",
  "health.ar":"الطِّبُّ النَّبَوِيّ","health.title":"The Prophetic Pattern of Health","health.sub":"How he ﷺ ate, moved, slept, washed, fasted, and carried his heart: the authentic record on one side, what modern research keeps finding on the other. A portrait of a life, not a prescription.",
  "hero.kicker":"نُورٌ عَلَىٰ نُورٍ","hero.title":"Codex of Light",
  "hero.subtitle":"From the Throne over the water to the radiant faces looking at their Lord: an illuminated chronicle of creation, the prophets, the Seerah, and the end of time.",
  "hero.cta.enter":"Enter the Path",
  "hero2.sub":"The whole of Islam, one illuminated library: the story in order, the Qur'an with recitation, an encyclopedia of the Path, a full madrasa, and rooms for every age. Free forever.","hero2.lead":"The whole of Islam, one illuminated library: the story in order, the Qur'an recited, every word explained. Free forever.","hero2.short":"The whole of Islam, one illuminated library. Free forever.","m.simulation":"Are We in a Simulation?","m.journal":"The Guardian's Journal","m.goodlife":"How to Live a Good Life","m.threelives":"Three Lives \u00b7 Weigh Your Own","p.quran":"The Mushaf","p.goodlife":"How to Live Well","p.prophets":"The 25 Prophets","p.pillars":"The Five Pillars","p.stories":"The Hall of Stories","g.read":"Read","g.live":"Live","g.house":"The House","g.pinned":"Most opened","hero2.more":"A full madrasa, rooms for every age, and a lantern that lights something new each day.","hero2.search":"Search anything: a word, a prophet, a place, a surah\u2026","hero2.door.mushaf":"The Mushaf","hero2.door.mushaf.s":"Every ayah, with recitation","hero.cta.characters":"Characters","hero.cta.kids":"✦ Little Codex",
  "hero.door.path.s":"The whole story, in order, from the first light","hero.door.learn.t":"The Classroom","hero.door.learn.s":"Step by step, properly taught","hero.door.look.t":"Look anything up","hero.door.look.s":"Search it all, in any spelling","hero.door.kids.s":"The same light, for children",
  "stats.nodes":"Chapters","stats.characters":"Characters","stats.places":"Places","stats.words":"Words","stats.quran":"Ayat cited","stats.hadith":"Hadith cited",
  "books.title":"Seven Books","books.sub":"The architecture of the Codex. All seven books are open on the Path.",
  "books.inpath":"In the Path","books.coming":"Coming",
  "book.1.desc":"Creation, the Arsh, Adam, the Flood","book.2.desc":"The prophets from Nuh to Isa",
  "book.3.desc":"Arabia before the Light","book.4.desc":"The Seerah of Muhammad ﷺ",
  "book.5.desc":"Companions & the Four Caliphs","book.6.desc":"Islam across the nations",
  "book.7.desc":"Signs, Qiyamah, Jannah",
  "path.title":"The Path","path.sub":"Kun Fayakun → Jannah · tap any tile to open its chapter",
  "filter.all":"All",
  "period.bidaya":"Al-Bidaya","period.qisas":"Qisas al-Anbiya","period.jahiliyyah":"Al-Jahiliyyah","period.seerah":"Al-Seerah","period.khulafa":"Al-Khulafa","period.umam":"Al-Umam","period.nihaya":"Al-Nihaya",
  "period.bidaya.desc":"The beginning: creation, Adam, and the first generations","period.qisas.desc":"The prophets, Ibrahim to Isa","period.jahiliyyah.desc":"Arabia before the Light: the forgetting, the seekers, the Elephant","period.seerah.desc":"The final Messenger ﷺ, from his birth to his passing","period.khulafa.desc":"The four successors: the ummah holds, opens, unifies, endures","period.umam.desc":"The Book preserved, and the light crossing every nation","period.nihaya.desc":"The signs, the Hour, and the two eternal homes",
  "mizan.title":"Two Lives in True Scale","mizan.sub":"Not poetry: measurements. What the Qur'an and the authentic Sunnah state, in numbers, about the life you are in and the one you are heading to.",
  "mizan.years":"years","mizan.drop.title":"The Finger and the Sea","mizan.drop.ratio":"the drop : the sea","mizan.drop.note":"Everything ever owned, built, or won by every human in history fits in the droplet. The sea is what remains.",
  "mizan.time.title":"The Timeline You Are On","mizan.time.you":"This life, the ummah's span","mizan.time.day":"One Day of the Rising","mizan.time.forever":"Then the abode that does not end","mizan.time.note":"On the Day itself, the deniers will estimate this whole life as \"an hour of a day\" (10:45). Divide seventy by forever: this life rounds to zero, except in what it purchases.",
  "mizan.fx.title":"Exchange Rates of the Next World","mizan.fx.qadr":"one night, Laylat al-Qadr","mizan.fx.grain":"one grain given in charity","mizan.fx.arafah":"one fast on Arafah","mizan.fx.fajr":"two rak'ahs before Fajr","mizan.fx.dunya":"the dunya","mizan.fx.whipb":"a whip's length","mizan.fx.whip":"of Jannah outweighs it all","mizan.fx.wordsb":"two words","mizan.fx.words":"heavy on the Scale","mizan.fx.note":"No market on earth posts rates like these. They are posted, in writing, for the life that lasts.",
  "mizan.dip.title":"The Dip That Resets Memory","mizan.dip.k1":"The most comfortable denier who ever lived","mizan.dip.v1":"one dip in the Fire:","mizan.dip.k2":"The most afflicted believer who ever lived","mizan.dip.v2":"one dip in Jannah:","mizan.dip.note":"One immersion erases the entire memory of seventy years. That is the actual weight of every luxury envied and every hardship feared here.",
  "mizan.follow.title":"What Actually Follows You","mizan.follow.family":"Family","mizan.follow.wealth":"Wealth","mizan.follow.deeds":"Deeds","mizan.follow.returns":"turns back at the grave","mizan.follow.returns2":"turns back at the grave","mizan.follow.stays":"stay with you",
  "mizan.trav.title":"The Rider and the Tree","mizan.trav.note":"If this world weighed as much as a mosquito's wing with Allah, He would not have given a denier a sip of its water (Tirmidhi 2320). It weighs less; so travel light, and load the mount with what the next country accepts.",
  "mizan.follow.debt":"And one thing waits ahead: debt","mizan.follow.debtNote":"Death does not erase it. The martyr is forgiven everything except his debt, and the believer's soul stays attached to what he owes until it is settled. Pay it, or arrange it, while arranging is still yours.",
  "mizan.cap.title":"Two Capitals, Spent Blind","mizan.cap.health":"Health","mizan.cap.healthNote":"works only while it lasts","mizan.cap.time":"Free time","mizan.cap.timeNote":"leaves without notice","mizan.cap.note":"The only two currencies any deed is ever bought with. Both are draining while you read this sentence, and the next life pays out exactly what they purchased.",
  "mizan.leaf.title":"Nothing Here Hurts for Free","mizan.leaf.note":"Here, pain subtracts from what stands against you: every fever, worry, and thorn quietly lightens the load. That exchange runs only on this side of the grave.",
  "mizan.shade.title":"Shade, on the Day There Is None","mizan.shade.s1":"A just leader","mizan.shade.s2":"A youth raised in worship","mizan.shade.s3":"A heart hung on the mosques","mizan.shade.s4":"Two who love each other for Allah alone","mizan.shade.s5":"One who is called by beauty and answers: I fear Allah","mizan.shade.s6":"A hand that gives so secretly the left does not know","mizan.shade.s7":"Eyes that weep alone, remembering Allah","mizan.shade.note":"Fifty thousand years of sun, and shade is bought here, now, mostly for free: none of the seven requires wealth, and every one of them is available today.",
  "about.dedication":"This Codex is offered as sadaqah jariyah, an ongoing gift, kept burning for one heart in particular: a daughter of ancient Khorasan, where knowledge stayed alight for centuries. She will recognize herself. Whatever light this work carries, may its reward reach her first.",
  "guide.ask":"Unclear? Ask","guide.title":"A quiet guide","guide.hint":"Short answers from the sources, for this chapter only.","guide.placeholder":"Ask in your own words...","guide.send":"Ask","guide.fallback":"That question deserves better than a quick answer. The chapter above carries what the sources state; for anything beyond it, a trusted scholar or your local imam is the right door.","guide.close":"Close guide",
  "mizan.cta.jannah":"See the destination · Jannah","mizan.cta.words":"Carry words that last","mizan.cta.path":"Walk the Path again",
  "search.placeholder":"Search the Codex…","search.none":"No matches in the Codex",
  "modal.sequence":"Sequence","modal.order":"Order of Events","modal.shield":"The Shield · Protection",
  "modal.quran":"Qur'an","modal.hadith":"Hadith & Athar","modal.facts":"Facts","modal.lessons":"Ibrah · Lessons",
  "modal.connected":"Connected in the Path","modal.close":"Close","modal.tilawah":"Tilawah","modal.node":"Node",
  "modal.meaning":"Meaning","modal.whennow":"When the Ummah Says It",
  "about.text":"NOOR is an educational and contemplative Codex. Content from the Qur'an, authentic Hadith, and classical sources. Prophets and companions are represented by light and seals only, never faces. Not a source of legal rulings.",
  "footer.back":"← Back to the Path","footer.note":"Qur'an · authentic Hadith · classical sirah","footer.follow":"Follow the light",
  "chars.title":"Characters","chars.sub":"Named beings across the Codex: companions of the Prophet ﷺ, angels who carry the command, jinn who believed or rebelled, animals made into signs, and the creatures of the end of time.",
  "chars.companions":"Companions","chars.angels":"Angels","chars.jinn":"Jinn","chars.animals":"Animals of the Signs","chars.endtime":"End of Time",
  "chars.companions.desc":"Those who saw the Prophet ﷺ, believed, and died upon Islam.","chars.angels.desc":"Created from light. They do not disobey.","chars.jinn.desc":"Created from smokeless fire: believers and rebels.","chars.animals.desc":"Creatures tied to a prophetic story or a clear ayah. Nothing invented.","chars.endtime.desc":"Named figures and forces of the final trials.",
  "nav.quran":"Qur'an","chars.fullpage":"Full companions page →","lang.label":"Language","lang.fallback":"English shown until this language pack is installed.",
  "places.title":"Places","places.sub":"The geography of the Codex: sanctuaries, mountains of revelation, cities and lands, waters and valleys, and the stations of the end.",
  "places.sanctuaries":"Sanctuaries","places.mountains":"Mountains & Heights","places.cities":"Cities & Lands","places.waters":"Waters & Valleys","places.endtimes":"Stations of the End",
  "places.sanctuaries.desc":"The three mosques of journeys, and the first mosque of this ummah.","places.mountains.desc":"Where revelation landed, armies learned, and pilgrims stand.","places.cities.desc":"The cities and lands that carried the story, from Babylon to Tabuk.","places.waters.desc":"Wells, rivers, seas and valleys that heaven used as instruments.","places.endtimes.desc":"Addresses fixed in prophecy: the minaret, the gate, the plain, the gathering.",
  "words.title":"Words of the Path","words.sub":"The exact supplications spoken inside the story: who first said each one, what it did, and when the ummah says it now.",
  "words.verses":"The Words","words.verses.desc":"Eighteen sentences from the Path, sourced, translated, and ready for tonight.",
  "words.saidnow":"Say it now",
  "atlas.open":"Open",
  "m.allah":"The Ninety-Nine Names",
  "m.seerah":"The Seerah · Twenty-Three Years"
};
/* A browser with site data refused -- a locked-down phone, private browsing on
   some builds, a reader who turned storage off -- throws on this read rather
   than answering null. Unguarded it threw here, before the object existed, so
   NOOR_I18N was never defined at all and every page leaning on it went down
   with it. A remembered language is a convenience; English is the floor. */
const NOOR_LANG_0 = (function(){ try { return localStorage.getItem("noor_lang") || "en"; } catch (e) { return "en"; } })();
const NOOR_I18N = {
  lang: NOOR_LANG_0,
  packs: { en: UI_EN },
  rtl: ["ar","ur","fa","he","ps","sd","prs","pa"],
  /* `fb` is what to show when no pack has the key. It used to be the key
     itself, which is how "m.threelives" appeared in the live menu: the English
     label was written correctly into all 106 pages, and the translator
     overwrote good English with its own internal name for it. A missing string
     must never be louder than no translation at all. */
  t(k, fb){ const p=this.packs[this.lang]||UI_EN; const v = p[k] ?? UI_EN[k]; return v ?? (fb !== undefined ? fb : k); },
  /* The English baked into the page is the last fallback, so it is remembered
     once, before the first write, and survives a round trip through another
     language. */
  en(el, attr){
    if (!el.hasAttribute(attr)) el.setAttribute(attr, attr === "data-i18n-en" ? el.textContent : el.placeholder);
    return el.getAttribute(attr);
  },
  apply(){
    document.documentElement.lang = this.lang;
    document.documentElement.dir = this.rtl.includes(this.lang) ? "rtl" : "ltr";
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const fb = this.en(el, "data-i18n-en");
      const v = this.t(el.getAttribute("data-i18n"), fb);
      if (el.textContent !== v) el.textContent = v;
    });
    document.querySelectorAll("[data-i18n-ph]").forEach(el => {
      const fb = this.en(el, "data-i18n-ph-en");
      const v = this.t(el.getAttribute("data-i18n-ph"), fb);
      if (el.placeholder !== v) el.placeholder = v;
    });
    this.syncLangUI();
  },
  fullPacks: {},
  async setLang(code){
    this.lang = code; try { localStorage.setItem("noor_lang", code); } catch (e) {}
    if (code !== "en" && !this.packs[code]) {
      try {
        /* PACK_V: force-cache means a reader who visited before keeps the pack
           they first downloaded, forever, unless the URL changes. Bump this on
           every release that ships translations, exactly like noor-text.js. */
        const r = await fetch(`/i18n/${code}.json?v=83`, {cache:"force-cache"});
        if (r.ok) { const j = await r.json(); this.packs[code] = Object.assign({}, UI_EN, j.ui || j); this.fullPacks[code] = j; }
        else toast(this.t("lang.fallback"));
      } catch (e) { toast(this.t("lang.fallback")); }
    }
    this.apply();
    if (window.NOOR_TEXT) NOOR_TEXT.setLang(code);
    if (window.NoorPage && NoorPage.rerender) NoorPage.rerender();
    /* anything that fetches its own words, the daily light above all, needs to
       know the language changed: a tile written by the AI cannot be swapped by
       a dictionary, it has to be asked again. */
    try { document.dispatchEvent(new CustomEvent("noor:lang", { detail: { lang: code } })); } catch (e) {}
  },
  /* translate a data record (node, character, place, word) through the loaded pack */
  loc(section, rec){
    if (this.lang === "en" || !rec) return rec;
    const f = this.fullPacks[this.lang];
    const o = f && f[section] && f[section][rec.id];
    return o ? this._overlay(rec, o) : rec;
  },
  _overlay(a, b){
    const out = Object.assign({}, a);
    for (const k in b){
      const v = b[k]; if (v == null) continue;
      if (Array.isArray(v) && Array.isArray(a[k])) {
        out[k] = a[k].map(function (el, i) {
          const w = v[i];
          if (w == null) return el;
          if (el && typeof el === "object" && typeof w === "object") return Object.assign({}, el, w);
          return w;
        });
      } else if (v && typeof v === "object" && a[k] && typeof a[k] === "object" && !Array.isArray(a[k])) out[k] = Object.assign({}, a[k], v);
      else out[k] = v;
    }
    return out;
  },
  syncLangUI(){
    const code = this.lang;
    document.querySelectorAll("#lang-cur").forEach(function (el) { el.textContent = code.toUpperCase(); });
    document.querySelectorAll("[data-setlang]").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-setlang") === code); });
  }
};
const t = k => NOOR_I18N.t(k);

/* ---------------- toast ---------------- */
let toastBox;
function toast(msg){
  if (!toastBox) { toastBox = document.createElement("div"); toastBox.className = "noor-toasts"; document.body.appendChild(toastBox); }
  const el = document.createElement("div"); el.className = "noor-toast"; el.textContent = msg;
  toastBox.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 400); }, 3200);
}

/* ---------------- tilawah audio (Alafasy) ---------------- */
const SURA_AYAS=[7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];
const OFFS = SURA_AYAS.reduce((a,n)=>{a.push(a[a.length-1]+n);return a;},[0]);
let currentAudio = null, currentBtn = null, currentRef = null;
function stopAyah(){
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  if (currentBtn) { currentBtn.classList.remove("playing"); currentBtn = null; }
  currentRef = null;
}
function playAyah(ref, btn){
  if (currentRef === ref && currentAudio) { stopAyah(); return; }   // toggle
  stopAyah();
  const m = String(ref).trim().match(/^(\d{1,3}):(\d{1,3})/);
  if (!m) { toast("Tilawah unavailable for this reference"); return; }
  const s = +m[1], a = +m[2];
  const primary = `https://everyayah.com/data/Alafasy_128kbps/${String(s).padStart(3,"0")}${String(a).padStart(3,"0")}.mp3`;
  const fallback = `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${OFFS[s-1]+a}.mp3`;
  const audio = new Audio(primary);
  let usedFallback = false;
  audio.onerror = () => { if (!usedFallback) { usedFallback = true; audio.src = fallback; audio.play().catch(()=>{ toast("Tilawah could not be loaded"); stopAyah(); }); } else { toast("Tilawah could not be loaded"); stopAyah(); } };
  audio.onended = stopAyah;
  audio.play().catch(()=>{ audio.onerror(); });
  currentAudio = audio; currentRef = ref;
  if (btn) { currentBtn = btn; btn.classList.add("playing"); }
}

/* ---------------- cross-links (4 types: n=node c=character p=place w=word) ---------------- */
const ETYPE = { n:"node", c:"char", p:"place", w:"word" };
function linkify(text){
  if (!text) return "";
  return String(text).replace(/\{\{(n|c|p|w):([^|}]+)\|([^}]+)\}\}/g, (_, typ, id, label) => {
    const safe = label.replace(/"/g, "&quot;");
    return `<button type="button" class="entity-link el-${typ}" data-etype="${ETYPE[typ]}" data-eid="${id}">${safe}</button>`;
  });
}
/* handlers: {node(id), char(id), place(id), word(id)}: unspecified types get the default cross-page hop */
function bindEntityLinks(root, handlers){
  const h = Object.assign({
    node: id => location.href = "index.html?node=" + id,
    char: id => location.href = "characters.html?open=" + encodeURIComponent(id),
    place: id => location.href = "places.html?open=" + encodeURIComponent(id),
    word: id => location.href = "words.html?open=" + encodeURIComponent(id)
  }, handlers || {});
  (root || document).querySelectorAll(".entity-link").forEach(btn => {
    btn.onclick = e => {
      e.preventDefault(); e.stopPropagation();
      const t = btn.dataset.etype;
      h[t](t === "node" ? +btn.dataset.eid : btn.dataset.eid);
    };
  });
}

/* ---------------- count-up numbers ---------------- */
function countUp(el, target, ms){
  /* Fifty thousand years is a number a reader has to feel, and "50000" is a
     database value. Anything at four figures or more is grouped the way the
     reader's own language groups it: 50,000 in English, 50 000 in French,
     ٥٠٬٠٠٠ in Arabic. Below that nothing is grouped, so a year or a chapter
     number is never given a comma it should not have. */
  const say = n => n >= 1000
    ? n.toLocaleString(document.documentElement.lang || undefined)
    : String(n);
  if (REDUCED) { el.textContent = say(target); return; }
  const t0 = performance.now(), dur = ms || 1100;
  function tick(t){
    const p = Math.min(1, (t - t0) / dur), eased = 1 - Math.pow(1 - p, 3);
    el.textContent = say(Math.round(target * eased));
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ---------------- scroll reveals (one observer, stagger via --d) ---------------- */
function initReveal(root){
  const els = (root || document).querySelectorAll(".reveal:not(.visible)");
  if (REDUCED) { els.forEach(el => el.classList.add("visible")); return; }
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); }
  }), { threshold: 0.08, rootMargin: "0px 0px -4% 0px" });
  els.forEach(el => io.observe(el));
}

/* ---------------- lazy background images ---------------- */
function initLazyBg(root){
  const els = (root || document).querySelectorAll("[data-bg]:not(.bg-loaded)");
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target, url = el.getAttribute("data-bg");
    const img = new Image();
    img.onload = () => { el.style.backgroundImage = `url('${url}')`; el.classList.add("bg-loaded"); };
    img.onerror = () => el.classList.add("bg-loaded"); /* pattern fallback stays */
    img.src = url;
    io.unobserve(el);
  }), { rootMargin: "700px" });
  els.forEach(el => io.observe(el));
}

/* ---------------- hero canvas: stars + rising gold motes ---------------- */
function initHeroCanvas(canvas){
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const DPR = Math.min(devicePixelRatio || 1, 2);
  let W, H, stars = [], motes = [], running = false, raf = 0, tPrev = 0;
  const isSmall = innerWidth < 640;
  const N_STARS = isSmall ? 70 : 130, N_MOTES = isSmall ? 26 : 55;

  function size(){
    const r = canvas.getBoundingClientRect();
    W = canvas.width = Math.round(r.width * DPR); H = canvas.height = Math.round(r.height * DPR);
  }
  let shooting = null, nextShot = 3500 + Math.random()*6000;
  function seed(){
    stars = Array.from({length: N_STARS}, () => ({ x: Math.random()*W, y: Math.random()*H*0.72, r: (Math.random()*1.1+0.3)*DPR, p: Math.random()*Math.PI*2, s: Math.random()*0.9+0.25 }));
    motes = Array.from({length: N_MOTES}, () => spawnMote(true));
  }
  function spawnMote(any){
    return { x: Math.random()*W, y: any ? Math.random()*H : H + 10*DPR, r: (Math.random()*1.6+0.5)*DPR, v: (Math.random()*9+5)*DPR/1000, drift: (Math.random()-.5)*6*DPR/1000, p: Math.random()*Math.PI*2, o: Math.random()*0.35+0.18 };
  }
  function frame(ts){
    if (!running) return;
    const dt = Math.min(ts - tPrev || 16, 50); tPrev = ts;
    ctx.clearRect(0, 0, W, H);
    for (const st of stars) {
      st.p += dt*0.0012*st.s;
      const a = 0.28 + 0.5*Math.abs(Math.sin(st.p));
      ctx.globalAlpha = a; ctx.fillStyle = "#FFFDF2";
      ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, 6.2832); ctx.fill();
    }
    for (let i = 0; i < motes.length; i++) {
      const mo = motes[i];
      mo.y -= mo.v*dt; mo.x += mo.drift*dt + Math.sin((mo.p += dt*0.001))*0.06*DPR;
      if (mo.y < -12*DPR) motes[i] = spawnMote(false);
      ctx.globalAlpha = mo.o * (0.65 + 0.35*Math.sin(mo.p*2));
      ctx.fillStyle = "#E9C86A";
      ctx.beginPath(); ctx.arc(mo.x, mo.y, mo.r, 0, 6.2832); ctx.fill();
    }
    /* occasional shooting star */
    nextShot -= dt;
    if (!shooting && nextShot <= 0) {
      const x0 = W * (0.15 + Math.random()*0.7), y0 = H * (0.05 + Math.random()*0.25);
      const ang = Math.PI * (0.72 + Math.random()*0.16);
      shooting = { x: x0, y: y0, vx: Math.cos(ang)*0.9*DPR, vy: Math.sin(ang)*0.9*DPR, life: 0, max: 520 + Math.random()*260 };
      nextShot = 6000 + Math.random()*8000;
    }
    if (shooting) {
      const s = shooting; s.life += dt;
      const px = s.x, py = s.y;
      s.x += s.vx*dt*0.6; s.y += s.vy*dt*0.6;
      const fade = 1 - s.life/s.max;
      if (fade <= 0) shooting = null;
      else {
        const grad = ctx.createLinearGradient(px - s.vx*46, py - s.vy*46, s.x, s.y);
        grad.addColorStop(0, "rgba(255,253,242,0)");
        grad.addColorStop(1, `rgba(255,253,242,${0.75*fade})`);
        ctx.strokeStyle = grad; ctx.lineWidth = 1.3*DPR; ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.moveTo(px - s.vx*46, py - s.vy*46); ctx.lineTo(s.x, s.y); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }
  function start(){ if (!running) { running = true; tPrev = 0; raf = requestAnimationFrame(frame); } }
  function stop(){ running = false; cancelAnimationFrame(raf); }

  size(); seed();
  if (REDUCED) { // draw one static frame
    for (const st of stars) { ctx.globalAlpha = 0.5; ctx.fillStyle = "#FFFDF2"; ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, 6.2832); ctx.fill(); }
    return;
  }
  const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? start() : stop()), { threshold: 0.02 });
  io.observe(canvas);
  document.addEventListener("visibilitychange", () => document.hidden ? stop() : start());
  let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { size(); seed(); }, 180); }, { passive: true });
}

/* ---------------- multilayer parallax (scroll + pointer) ---------------- */
function initParallax(container){
  if (REDUCED || !container) return;
  const layers = container.querySelectorAll("[data-depth]");
  if (!layers.length) return;
  let px = 0, py = 0, sy = 0, queued = false;
  function apply(){
    queued = false;
    for (const l of layers) {
      const d = parseFloat(l.dataset.depth) || 0;
      l.style.transform = `translate3d(${px*d*30}px, ${py*d*18 + sy*d*0.5}px, 0)`;
    }
  }
  function queue(){ if (!queued) { queued = true; requestAnimationFrame(apply); } }
  addEventListener("scroll", () => { const r = container.getBoundingClientRect(); if (r.bottom > 0) { sy = -r.top; queue(); } }, { passive: true });
  if (FINE) container.addEventListener("pointermove", e => {
    const r = container.getBoundingClientRect();
    px = (e.clientX / r.width - 0.5) * 2; py = (e.clientY / Math.max(r.height,1) - 0.5) * 2; queue();
  }, { passive: true });
}

/* ---------------- tile tilt physics (desktop only) ---------------- */
function initTilt(root){
  if (REDUCED || !FINE) return;
  (root || document).querySelectorAll(".tile:not([data-tilt])").forEach(tile => {
    tile.setAttribute("data-tilt", "1");
    const inner = tile.querySelector(".tile-inner") || tile;
    let raf = 0, rx = 0, ry = 0, hover = false;
    function render(){ inner.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`; raf = 0; }
    tile.addEventListener("pointerenter", () => { hover = true; inner.classList.add("tilting"); }, { passive: true });
    tile.addEventListener("pointermove", e => {
      if (!hover) return;
      const r = tile.getBoundingClientRect();
      ry = ((e.clientX - r.left) / r.width - 0.5) * 7;
      rx = (0.5 - (e.clientY - r.top) / r.height) * 6;
      if (!raf) raf = requestAnimationFrame(render);
    }, { passive: true });
    tile.addEventListener("pointerleave", () => { hover = false; rx = ry = 0; inner.classList.remove("tilting"); inner.style.transform = ""; }, { passive: true });
  });
}

/* ---------------- ambient tile parallax on scroll (bg drift) ---------------- */
function initTileDrift(){
  if (REDUCED) return;
  let ticking = false;
  function onScroll(){
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      const vh = innerHeight;
      document.querySelectorAll(".tile-bg.bg-loaded").forEach(bg => {
        const r = bg.parentElement.getBoundingClientRect();
        if (r.bottom < -80 || r.top > vh + 80) return;
        const off = ((r.top + r.height/2) - vh/2) * 0.05;
        bg.style.transform = `translate3d(0, ${off.toFixed(1)}px, 0) scale(1.12)`;
      });
      ticking = false;
    });
  }
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

/* ---------------- progress bar ---------------- */
function initProgress(bar){
  if (!bar) return;
  addEventListener("scroll", () => {
    const h = document.documentElement;
    bar.style.width = (h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight) * 100) + "%";
  }, { passive: true });
}

/* ---------------- exports ---------------- */
window.NoorFX = { initReveal, initLazyBg, initHeroCanvas, initParallax, initTilt, initTileDrift, initProgress, countUp, REDUCED, FINE };
window.NOOR_I18N = NOOR_I18N;
window.t = t;
window.toast = toast;
window.playAyah = playAyah;
window.stopAyah = stopAyah;
window.linkify = linkify;
window.bindEntityLinks = bindEntityLinks;
})();

/* v13 nav: center the active chip in the mobile rail */
(function(){function c(){var a=document.querySelector(".mnav .active");if(a&&a.scrollIntoView)try{a.scrollIntoView({inline:"center",block:"nearest"})}catch(e){}}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",c);else c();})();

/* ================= v24 · the language doors =================
   NOOR speaks twenty one languages through its own gateway pages. When a
   reader's language is detected, the Codex offers its own door instead
   of browser-translate instructions. Sacred text stays shielded:
   the Qur'an's Arabic, the Bismillah, and the house marks are never
   machine-translated anywhere. */
(function () {
  "use strict";
  function protectSacred(root) {
    (root || document).querySelectorAll(".font-quran,.font-amiri,.ar,.bismillah,[data-ar]").forEach(function (el) {
      el.setAttribute("translate", "no");
      el.classList.add("notranslate");
    });
  }
  var LANGS = [
    ["fa", "فارسی", "نور را به فارسی بخوانید", "وارد شوید"],
    ["prs", "دری", "نور را به دری بخوانید", "داخل شوید"],
    ["pa", "پنجابی", "نور پنجابی وچ پڑھو", "اندر آؤ"],
    ["ha", "Hausa", "Karanta NOOR da Hausa", "Shiga"],
    ["ps", "پښتو", "نور په پښتو ولولئ", "ننوځئ"],
    ["so", "Soomaali", "Ku akhri NOOR af-Soomaali", "Gal"],
    ["ku", "Kurdî", "NOOR bi Kurdî bixwîne", "Bikeve"],
    ["sw", "Kiswahili", "Soma NOOR kwa Kiswahili", "Ingia"],
    ["ar", "العربية", "اقرأ نُور بالعربية", "ادخل"],
    ["fr", "Français", "Lire NOOR en français", "Entrer"],
    ["es", "Español", "Lee NOOR en español", "Entrar"],
    ["de", "Deutsch", "NOOR auf Deutsch lesen", "Eintreten"],
    ["ru", "Русский", "Читайте NOOR на русском", "Войти"],
    ["tr", "Türkçe", "NOOR'u Türkçe okuyun", "Girin"],
    ["ur", "اردو", "نُور اردو میں پڑھیں", "داخل ہوں"],
    ["hi", "हिन्दी", "NOOR हिन्दी में पढ़ें", "प्रवेश करें"],
    ["bn", "বাংলা", "বাংলায় NOOR পড়ুন", "প্রবেশ করুন"],
    ["id", "Bahasa Indonesia", "Baca NOOR dalam Bahasa Indonesia", "Masuk"],
    /* zh, ja and ko had live gateway pages for months and no door offered to
       them: the array was written before those three were built, and every
       count on the site was copied from its length. */
    ["zh", "中文", "用中文阅读 NOOR", "进入"],
    ["ja", "日本語", "NOOR を日本語で読む", "入る"],
    ["ko", "한국어", "NOOR를 한국어로 읽기", "들어가기"]
  ];
  function detected() {
    var l = ((navigator.language || "en").slice(0, 2) || "en").toLowerCase();
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i][0] === l) return LANGS[i];
    return null;
  }
  function onGateway() {
    var p = location.pathname.replace(/\/+$/, "");
    for (var i = 0; i < LANGS.length; i++) if (p === "/" + LANGS[i][0]) return true;
    return false;
  }
  function langRow() {
    return LANGS.map(function (p) {
      return '<button type="button" data-doorlang="' + p[0] + '" style="background:none;border:0;cursor:pointer;font:inherit;color:#E9C86A;font-weight:600;white-space:nowrap;padding:0">' + p[1] + "</button>";
    }).join('<span style="color:rgba(255,254,247,.35)"> · </span>') +
    '<span style="color:rgba(255,254,247,.35)"> · </span><button type="button" data-doorlang="en" style="background:none;border:0;cursor:pointer;font:inherit;color:#E9C86A;font-weight:600;padding:0">English</button>';
  }
  function bindDoor(d) {
    d.querySelectorAll("[data-doorlang]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (window.NOOR_I18N) NOOR_I18N.setLang(b.getAttribute("data-doorlang"));
        try { localStorage.setItem("noor_door", "1"); } catch (e) {}
        d.remove();
      });
    });
  }
  function shell() {
    var old = document.getElementById("noor-translate-hint");
    if (old) old.remove();
    var d = document.createElement("div");
    d.id = "noor-translate-hint";
    d.setAttribute("role", "status");
    d.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);bottom:1rem;z-index:90;max-width:min(30rem,calc(100vw - 2rem));background:#0B1230;color:#FFFEF7;border:1px solid rgba(233,200,106,.55);border-radius:14px;box-shadow:0 14px 40px rgba(4,6,15,.55);padding-block:.85rem .85rem;padding-inline:1rem 2.5rem;font-size:.78rem;line-height:1.65;font-family:Inter,system-ui,sans-serif";
    return d;
  }
  function closeBtn(d, remember) {
    var b = document.createElement("button");
    b.setAttribute("aria-label", "Close");
    b.style.cssText = "position:absolute;top:.35rem;right:.45rem;background:none;border:0;color:rgba(255,254,247,.6);font-size:1rem;cursor:pointer;padding:.25rem;line-height:1";
    b.textContent = "✕";
    b.addEventListener("click", function () {
      d.remove();
      if (remember) try { localStorage.setItem("noor_door", "1"); } catch (e) {}
    });
    d.appendChild(b);
  }
  /* The door: your language detected, your gateway offered. */
  function showDoor(lang) {
    var d = shell();
    var wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;align-items:center;gap:.7rem;flex-wrap:wrap";
    wrap.innerHTML = '<span style="color:#E9C86A" data-ic=globe></span><span style="font-weight:600">' + lang[2] + "</span>" +
      '<button type="button" data-doorlang="' + lang[0] + '" style="background:linear-gradient(135deg,#C9A227,#E9C86A);border:0;cursor:pointer;font-family:inherit;color:#1A160F;font-weight:800;border-radius:999px;padding:.4rem 1.05rem;font-size:.78rem;white-space:nowrap">' + lang[3] + " →</button>";
    d.appendChild(wrap);
    closeBtn(d, true);
    bindDoor(d);
    document.body.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.remove(); }, 22000);
  }
  /* The chooser: the  button opens every door. */
  function showChooser() {
    var d = shell();
    var det = detected();
    var head = det ? det[2] : "Choose your language";
    d.insertAdjacentHTML("beforeend",
      '<div style="font-weight:700;margin-bottom:.45rem"><span style="color:#E9C86A;margin-inline-end:.45rem"></span>' + head + "</div>" +
      '<div style="font-size:.74rem;line-height:2">' + langRow() + "</div>");
    if (det) {
      d.insertAdjacentHTML("beforeend",
        '<a href="/' + det[0] + '" style="display:inline-block;margin-top:.55rem;background:linear-gradient(135deg,#C9A227,#E9C86A);color:#1A160F;font-weight:800;text-decoration:none;border-radius:999px;padding:.4rem 1.05rem;font-size:.78rem">' + det[3] + " →</a>");
    }
    closeBtn(d, false);
    bindDoor(d);
    document.body.appendChild(d);
  }
  function init() {
    protectSacred();
    /* re-shield content rendered after load (the Mushaf, the hubs) */
    try {
      new MutationObserver(function (muts) {
        muts.forEach(function (m) {
          m.addedNodes && m.addedNodes.forEach(function (n) { if (n.nodeType === 1) protectSacred(n); });
        });
      }).observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
    var b = document.getElementById("translate-btn");
    if (b) b.addEventListener("click", function () { showChooser(); });
    /* Any page may ask for the chooser. Until now only a page carrying
       #translate-btn could open it, which meant the 1,135 rendered rooms --
       /today, every Path chapter, every verse, every surah -- had no way to
       change language at all: their top line was a brand and nothing else. */
    window.NOOR_LANG = { choose: showChooser };
    document.addEventListener("click", function (e) {
      var t = e.target && e.target.closest ? e.target.closest("[data-noor-lang]") : null;
      if (!t) return;
      e.preventDefault();
      showChooser();
    }, true);
    var lang = detected();
    if (!lang || onGateway()) return;
    var dismissed = false, shown = false;
    try {
      dismissed = localStorage.getItem("noor_door") === "1" || localStorage.getItem("noor_thint") === "1";
      shown = sessionStorage.getItem("noor_door_s") === "1";
    } catch (e) {}
    if (!dismissed && !shown) {
      try { sessionStorage.setItem("noor_door_s", "1"); } catch (e) {}
      setTimeout(function () { showDoor(lang); }, 2200);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

/* ================= reveal safety net =================
   Scroll-reveal sections start invisible and wait for an observer.
   If any page's observer is missing or broken (the blank-prophets bug),
   this net force-lights anything near the viewport that stayed dark.
   The animation still plays normally; this only catches strays. */
(function () {
  "use strict";
  function unveil() {
    document.querySelectorAll(".reveal").forEach(function (el) {
      if (el.classList.contains("in") && el.classList.contains("visible")) return;
      var r = el.getBoundingClientRect();
      /* anything the reader has reached or passed must be lit */
      if (r.top < innerHeight + 120) { el.classList.add("in"); el.classList.add("visible"); }
    });
  }
  setInterval(unveil, 1700);
  window.addEventListener("scroll", function () { setTimeout(unveil, 900); }, { passive: true });
})();

/* ================= the lamp counter =================
   One tiny anonymous ping per page view: day, country (added by the
   host, never the IP), room. First ping of the day marks one person.
   No cookies, no IDs, no fingerprints, ever. Off on the admin page. */
(function () {
  "use strict";
  if (/(^|\/)admin(\.html)?$/.test(location.pathname)) return;

  /* ---- who does not get counted ---------------------------------------
     The owner is on this site more than anyone alive, and every one of his
     visits used to land in the same number a stranger's did. A browser marks
     itself once, here, and is never counted again: open
     noorcodex.com/?nocount=1 on a device, or simply open the console, which
     sets the same flag. ?nocount=0 undoes it. It is per browser, because
     that is all a site can honestly know without an identifier -- and an
     identifier is the one thing this counter has never had.

     navigator.webdriver is true in any browser being driven by software,
     which is how a page opened by automation stops looking like a reader. */
  try {
    var q = location.search;
    if (/[?&]nocount=0/.test(q)) localStorage.removeItem("noor_nocount");
    else if (/[?&]nocount=1/.test(q)) localStorage.setItem("noor_nocount", "1");
    if (localStorage.getItem("noor_nocount") === "1") return;
  } catch (e) {}
  if (navigator.webdriver) return;

  /* Which host counts is decided by the beacon, not here. A page can be served
     from a preview build, a laptop or the live domain, and only the server can
     be trusted to know which -- so it is checked there, once, rather than
     asserted in two places that can drift apart. */

  try {
    var today = new Date().toISOString().slice(0, 10);
    var first = 0;
    try { if (localStorage.getItem("noor_seen") !== today) { localStorage.setItem("noor_seen", today); first = 1; } } catch (e) {}
    /* where this reader came from, as a coarse source name only:
       never the full URL, never a query string, never an ID. */
    var src = "";
    try {
      var q = (location.search.match(/[?&]s=([a-z0-9_-]{1,16})/i) || [])[1];
      if (q) src = q.toLowerCase();
      else if (document.referrer) {
        var h = new URL(document.referrer).hostname.replace(/^www\./, "").toLowerCase();
        src = h === location.hostname ? "" : h;
      } else src = "direct";
    } catch (e) {}
    var payload = JSON.stringify({ p: location.pathname, n: first, s: src, h: new Date().getHours() });

    /* ---- and only a page somebody actually looked at -------------------
       Firing on load counted three things that are not a reading: a page the
       browser prefetched in the background against a link never clicked, a
       prerender nobody ever saw, and a headless crawler that loads and leaves
       within the same instant.

       So it waits, and then asks whether the page is in front of a person. A
       little over a second is long enough that none of the three survive it,
       and short enough that a real reader deciding to leave has usually not
       gone yet. It does cost the genuine one-second bounce -- which, in a
       number labelled "readers", is arguably the right thing to lose. */
    function count() {
      if (document.visibilityState !== "visible") return;
      if (navigator.sendBeacon) navigator.sendBeacon("/api/beacon", new Blob([payload], { type: "application/json" }));
      else fetch("/api/beacon", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(function () {});
    }
    if (document.prerendering) document.addEventListener("prerenderingchange", function () { setTimeout(count, 1200); }, { once: true });
    else if (document.visibilityState === "visible") setTimeout(count, 1200);
    else document.addEventListener("visibilitychange", function h2() {
      if (document.visibilityState === "visible") { document.removeEventListener("visibilitychange", h2); setTimeout(count, 1200); }
    });

    /* how long the visit lasted, in whole seconds, sent once when the reader
       leaves or first hides the tab. Aggregate only: no ID travels with it. */
    var t0 = Date.now(), durSent = false;
    function sendDur() {
      if (durSent) return; durSent = true;
      var secs = Math.round((Date.now() - t0) / 1000);
      if (secs < 3 || secs > 7200) return;
      var pl = JSON.stringify({ p: location.pathname, d: secs });
      if (navigator.sendBeacon) navigator.sendBeacon("/api/beacon", new Blob([pl], { type: "application/json" }));
    }
    addEventListener("pagehide", sendDur);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") sendDur(); });
  } catch (e) {}
})();

/* ================= v25 · the embed lantern =================
   Any room of the Codex can live inside another site or app.
   In an iframe (or with ?embed=1) the room sheds its chrome:
   no header, no footer, no giving bands, nothing commercial,
   only the content and a small quiet NOOR mark. Hosts receive
   the content height by postMessage for auto-sizing. */
(function () {
  "use strict";
  var inFrame = false;
  try { inFrame = window.self !== window.top; } catch (e) { inFrame = true; }
  var forced = /[?&]embed=1/.test(location.search);
  if (!inFrame && !forced) return;
  document.documentElement.setAttribute("data-noor-embed", "1");
  function init() {
    var css = document.createElement("style");
    css.textContent = "header,footer,#sponsor-slot,#noor-translate-hint,.mnav,[data-embed-hide]{display:none!important}body{padding-top:0!important}";
    document.head.appendChild(css);
    /* the quiet mark: every embedded room says where the light comes from */
    var mark = document.createElement("a");
    mark.href = "https://noorcodex.com/?ref=embed";
    mark.target = "_blank"; mark.rel = "noopener";
    mark.textContent = "✦ NOOR";
    mark.title = "NOOR · Codex of Light · noorcodex.com";
    mark.style.cssText = "position:fixed;right:.55rem;bottom:.55rem;z-index:95;font:700 10px/1 Inter,system-ui,sans-serif;letter-spacing:.08em;color:#C9A227;background:rgba(20,16,10,.78);border:1px solid rgba(201,162,39,.45);border-radius:999px;padding:.32rem .6rem;text-decoration:none;opacity:.85";
    document.body.appendChild(mark);
    /* height reports for host auto-sizing */
    function report() {
      try { parent.postMessage({ noorEmbedHeight: document.documentElement.scrollHeight }, "*"); } catch (e) {}
    }
    report();
    try { new ResizeObserver(report).observe(document.documentElement); } catch (e) { setInterval(report, 1200); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

/* ================= v27 · touch menus & the installable lamp =================
   (1) The Library panel opens on tap, not only hover: phones and iPads
   get a real click-toggle with outside-tap and Escape to close.
   (2) The Codex registers its service worker and becomes installable:
   add to home screen and the library opens like an app, shell offline. */
(function () {
  "use strict";
  function init() {
    /* touch-friendly dropdowns */
    var style = document.createElement("style");
    style.textContent = ".dd.open .dd-mega,.dd.open .dd-menu{display:block!important}";
    document.head.appendChild(style);
    document.querySelectorAll(".dd").forEach(function (dd) {
      var btn = dd.querySelector(".dd-btn");
      if (!btn) return;
      btn.addEventListener("click", function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        var was = dd.classList.contains("open");
        document.querySelectorAll(".dd.open").forEach(function (x) { x.classList.remove("open"); });
        if (!was) dd.classList.add("open");
      });
    });
    document.addEventListener("click", function (ev) {
      if (!ev.target.closest || !ev.target.closest(".dd")) {
        document.querySelectorAll(".dd.open").forEach(function (x) { x.classList.remove("open"); });
      }
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") document.querySelectorAll(".dd.open").forEach(function (x) { x.classList.remove("open"); });
    });
    /* the installable lamp (skipped inside embeds) */
    var embedded = document.documentElement.hasAttribute("data-noor-embed");
    if (!embedded && "serviceWorker" in navigator && location.protocol === "https:") {
      navigator.serviceWorker.register("/sw.js").catch(function () {});
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

/* ================= v36 · the iconography of the house =================
   No emoji anywhere: every pictograph is a hand-drawn line icon in the
   Codex's own ink. One registry; any element with data-ic="name" is
   rendered; window.NOOR_IC(name) serves dynamic HTML builders. */
(function () {
  "use strict";
  var W = "<svg class='isvg' viewBox='0 0 24 24' aria-hidden='true'>";
  var E = "</svg>";
  var I = {
    globe: W + "<circle cx='12' cy='12' r='9'/><path d='M3 12h18M12 3c2.8 2.6 4 5.6 4 9s-1.2 6.4-4 9c-2.8-2.6-4-5.6-4-9s1.2-6.4 4-9Z'/>" + E,
    school: W + "<path d='M4 20V11l4-2.5V20M20 20V11l-4-2.5V20M8 20h8M8 13h8'/><path d='M12 3c1.8 1.1 2.8 2.6 2.8 4.4H9.2C9.2 5.6 10.2 4.1 12 3Z'/><path d='M12 20v-4'/>" + E,
    scale: W + "<path d='M12 4v16M7 20h10M12 6 4.5 9M12 6l7.5 3'/><path d='M4.5 9 2 14.5a3 3 0 0 0 5 0L4.5 9Z'/><path d='M19.5 9 17 14.5a3 3 0 0 0 5 0L19.5 9Z'/>" + E,
    book: W + "<path d='M12 6c-1.8-1.6-4.4-2-8-1.4V19c3.6-.6 6.2-.2 8 1.4 1.8-1.6 4.4-2 8-1.4V4.6C16.4 4 13.8 4.4 12 6Z'/><path d='M12 6v14.4'/>" + E,
    lamp: W + "<path d='M9 7h6l1.2 8.5a4.2 4.2 0 0 1-8.4 0Z'/><path d='M10.4 7V5.4A1.4 1.4 0 0 1 11.8 4h.4a1.4 1.4 0 0 1 1.4 1.4V7M12 19.6V21.5M12 10.2v2.6'/>" + E,
    dove: W + "<path d='M20.5 6.5c-4.2-.4-6.9 1-8.6 3.3C10.3 8 8.4 7.2 5.5 7.4c1 1.6 1.6 3 1.7 4.6L3.5 14c2.6 1.6 5.4 2.2 8 1.6 3.8-.9 6.9-3.9 9-9.1Z'/><path d='M17.2 6.9c.2-1 .8-1.8 1.9-2.2'/>" + E,
    nib: W + "<path d='M13 5.5 18.5 11l-6.8 6.8c-2.2 2.2-4.9 2.1-8.2 1.7.4-3.3.5-6 2.7-8.2Z'/><path d='M13 5.5 15.8 2.7a1.5 1.5 0 0 1 2.1 0l3.4 3.4a1.5 1.5 0 0 1 0 2.1L18.5 11M9.5 14.5l1.2 1.2'/>" + E,
    columns: W + "<path d='M3.5 8.5 12 4l8.5 4.5M5 8.5V18M9.7 8.5V18M14.3 8.5V18M19 8.5V18M3.5 18h17M3.5 21h17'/>" + E,
    kite: W + "<path d='M12 3 19 10l-7 8-7-8Z'/><path d='M12 3v15M5 10h14M12 18c-.5 2-2 3-4 3'/>" + E,
    seed: W + "<path d='M12 21v-8'/><path d='M12 13C12 9 9.5 7 5.5 7c0 4 2.5 6 6.5 6ZM12 11c0-3 2-4.8 5.5-4.8 0 3.4-2 5.1-5.5 4.8Z'/><path d='M8 21h8'/>" + E,
    scroll: W + "<path d='M7 4h11a2 2 0 0 1 2 2v1H9M7 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-1'/><path d='M9 10h7M9 13.5h7M9 17h4'/>" + E,
    lock: W + "<rect x='5.5' y='10.5' width='13' height='9' rx='2'/><path d='M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5M12 14v2.2'/>" + E,
    play: "<svg class='isvg' viewBox='0 0 24 24' aria-hidden='true'><path d='M8 5.8v12.4c0 .9 1 1.4 1.7 1L19 13a1.2 1.2 0 0 0 0-2L9.7 4.9c-.8-.5-1.7 0-1.7.9Z' fill='currentColor' stroke='none'/></svg>",
    star: "<svg class='isvg' viewBox='0 0 24 24' aria-hidden='true'><path d='M12 2.5c.9 4.6 2.4 6.6 7 7.5-4.6.9-6.1 2.9-7 7.5-.9-4.6-2.4-6.6-7-7.5 4.6-.9 6.1-2.9 7-7.5Z' fill='currentColor' stroke='none'/></svg>",
    moon: W + "<path d='M19.5 14.5A8.5 8.5 0 0 1 9.5 4.5 8.5 8.5 0 1 0 19.5 14.5Z'/>" + E,
    sun: W + "<circle cx='12' cy='12' r='4'/><path d='M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6'/>" + E,
    drop: W + "<path d='M12 3.5c3.2 4.6 6 7.4 6 10.7a6 6 0 0 1-12 0c0-3.3 2.8-6.1 6-10.7Z'/><path d='M9.3 14.5a2.7 2.7 0 0 0 2.1 2.5'/>" + E,
    heart: W + "<path d='M12 20c-5.2-3.4-8.5-6.6-8.5-10A4.6 4.6 0 0 1 8.1 5.4c1.6 0 3 .8 3.9 2.1a4.8 4.8 0 0 1 3.9-2.1 4.6 4.6 0 0 1 4.6 4.6c0 3.4-3.3 6.6-8.5 10Z'/>" + E,
    scope: W + "<path d='M4 9.5 17.5 4l2 4.5L6.5 14Z'/><path d='M13 12.5 10 21M13.8 10.6 17 19M8 21h8'/><circle cx='19.8' cy='5.5' r='1.2'/>" + E,
    gear: W + "<circle cx='12' cy='12' r='3.2'/><path d='M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8'/>" + E,
    compass: W + "<circle cx='12' cy='12' r='9'/><path d='M15.5 8.5 13.6 13.6 8.5 15.5l1.9-5.1Z'/>" + E,
    camera: W + "<rect x='3' y='7' width='18' height='13' rx='2.5'/><path d='M8.5 7 10 4h4l1.5 3'/><circle cx='12' cy='13.3' r='3.6'/>" + E,
    calc: W + "<rect x='5' y='3' width='14' height='18' rx='2'/><path d='M8.5 7.5h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 15.5h.01M12 15.5h.01M15.5 15.5h.01'/>" + E,
    clock: W + "<circle cx='12' cy='12' r='9'/><path d='M12 6.5V12l3.5 2'/>" + E,
    hand: W + "<path d='M7 11V5.8a1.5 1.5 0 0 1 3 0V10M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.6a1.5 1.5 0 0 1 3 0V12'/><path d='M16 12l1.8-2.4a1.5 1.5 0 0 1 2.5 1.6L17 17.5a6 6 0 0 1-5.4 3.5c-3.3 0-4.9-1.8-5.8-4.6L4.5 12.2A1.4 1.4 0 0 1 7 11Z'/>" + E,
    leaf: W + "<path d='M19.5 4.5C11 4.5 5.5 9 4.5 19.5 15 18.5 19.5 13 19.5 4.5Z'/><path d='M4.5 19.5C8 13 12 9.5 17 7'/>" + E,
    kaaba: W + "<path d='M4 8.5 12 4l8 4.5v7L12 20l-8-4.5Z'/><path d='M4 8.5 12 13l8-4.5M12 13v7M4 11.5c2.7 1.5 13.3 1.5 16 0' stroke-dasharray='2 1.6'/>" + E,
    eye: W + "<path d='M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z'/><circle cx='12' cy='12' r='2.8'/>" + E,
    bulb: W + "<path d='M12 3a6 6 0 0 1 3.4 10.9c-.8.6-1.4 1.5-1.4 2.6h-4c0-1.1-.6-2-1.4-2.6A6 6 0 0 1 12 3Z'/><path d='M10 19.5h4M10.8 22h2.4'/>" + E,
    flask: W + "<path d='M9.5 3h5M10.5 3v5.2L5.2 17.5A2.4 2.4 0 0 0 7.3 21h9.4a2.4 2.4 0 0 0 2.1-3.5L13.5 8.2V3'/><path d='M7.8 15h8.4'/>" + E,
    note: W + "<rect x='5' y='3.5' width='14' height='17' rx='2'/><path d='M8.5 8h7M8.5 12h7M8.5 16h4.5'/>" + E,
    hands: W + "<path d='M11.5 20.5 5 15.2c-1.2-1-1.3-2.7-.2-3.7l.2-.2c1-.9 2.4-.8 3.4 0l3.1 2.7 3.1-2.7c1-.8 2.4-.9 3.4 0l.2.2c1.1 1 1 2.7-.2 3.7Z'/><path d='M7 8.5c1.3-2 3-3 5-3s3.7 1 5 3'/>" + E,
    shield: W + "<path d='M12 3 19.5 6v5c0 4.8-3 8.4-7.5 10-4.5-1.6-7.5-5.2-7.5-10V6Z'/><path d='M9 11.8l2.1 2.2 3.9-4'/>" + E,
    tools: W + "<path d='M14.5 6.5a4 4 0 0 1 5-5l-3 3 .7 2.3 2.3.7 3-3a4 4 0 0 1-5 5L7 20a2 2 0 0 1-2.8-2.8Z' transform='scale(0.92) translate(1 1)'/>" + E,
    key: W + "<circle cx='8' cy='15.5' r='4.5'/><path d='M11.5 12 20 3.5M16 7.5l3 3M13.5 10l2 2'/>" + E,
    home: W + "<path d='M4.5 11 12 4l7.5 7M6.5 9.5V20h11V9.5'/><path d='M10 20v-5.5h4V20'/>" + E,
    minaret: W + "<path d='M10 21V8.5a2 2 0 0 1 4 0V21M10 21h4M9 21h6'/><path d='M12 6.5V4.8M11 4.8h2M10 12h4'/>" + E,
    question: W + "<circle cx='12' cy='12' r='9'/><path d='M9.4 9.2A2.7 2.7 0 0 1 12 7.4c1.5 0 2.7 1 2.7 2.4 0 1.9-2.7 2.1-2.7 3.9'/><path d='M12 17h.01'/>" + E,
    trophy: W + "<path d='M8 4h8v5a4 4 0 0 1-8 0Z'/><path d='M8 5.5H5a3 3 0 0 0 3 4M16 5.5h3a3 3 0 0 1-3 4M12 13v3.5M9 20h6M10 16.5h4V20h-4Z'/>" + E
  };
  window.NOOR_IC = function (name) { return I[name] || ""; };
  function render(root) {
    (root || document).querySelectorAll("[data-ic]").forEach(function (el) {
      var n = el.getAttribute("data-ic");
      if (I[n] && !el.querySelector("svg")) el.innerHTML = I[n];
    });
  }
  window.NOOR_IC_RENDER = render;
  var css = document.createElement("style");
  css.textContent = ".isvg{display:inline-block;width:1.22em;height:1.22em;vertical-align:-0.24em;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}[data-ic]{line-height:1}";
  document.head.appendChild(css);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { render(); });
  else render();
  try { new MutationObserver(function (m) { m.forEach(function (x) { x.addedNodes && x.addedNodes.forEach(function (n) { if (n.nodeType === 1) render(n); }); }); }).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
})();

/* ================= v49 · the calm menu =================
   One header for the whole house: burger sheet on small screens,
   in-place language switching everywhere. */
(function () {
  "use strict";
  function init() {
    /* Safety net: a fixed sheet trapped inside an ancestor that has a filter,
       backdrop-filter or transform is sized against that ancestor, not the
       screen. Re-home it on the body so it always fills the viewport. */
    var sheet = document.getElementById("nav-sheet");
    if (sheet && sheet.parentNode !== document.body) document.body.appendChild(sheet);
    var burger = document.getElementById("nav-burger");
  /* Home-screen installs on older iOS do not answer the display-mode query,
     but they do set navigator.standalone. One class on <html> lets the CSS
     reserve the notch either way. */
  try {
    if (window.navigator.standalone === true ||
        (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches)) {
      document.documentElement.classList.add("standalone");
    }
  } catch (e) { /* the page is correct without it */ }

    if (burger) burger.addEventListener("click", function () {
      var open = document.body.classList.toggle("sheet-open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") document.body.classList.remove("sheet-open"); });
    var sheet = document.getElementById("nav-sheet");
    if (sheet) sheet.addEventListener("click", function (e) { if (e.target.closest("a")) document.body.classList.remove("sheet-open"); });
    document.querySelectorAll("[data-setlang]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (window.NOOR_I18N) NOOR_I18N.setLang(b.getAttribute("data-setlang"));
        document.body.classList.remove("sheet-open");
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      });
    });
    var ql = null;
    try { ql = new URLSearchParams(location.search).get("lang"); } catch (e) {}
    if (ql) { if (window.NOOR_I18N) NOOR_I18N.setLang(ql); }
    else if (window.NOOR_I18N && NOOR_I18N.lang !== "en") NOOR_I18N.setLang(NOOR_I18N.lang);
    else if (window.NOOR_I18N) NOOR_I18N.apply();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

/* ================= v83 · the row of doors under the footer =================
   The house has doors on other people's platforms, and until now a reader
   who wanted them had to already know they existed. This draws them once,
   in one place, into the footer of every page that has one.

   The list is NOOR_SOCIAL at the top of this file; that is the only thing
   anyone should have to edit. The marks are drawn here in the same 24x24
   stroke style as the rest of the iconography: no brand colours, no
   wordmarks, no fetched images, nothing a network could change under us.
   Where it lands, in order: after the line carrying footer.note, else
   before the languages nav, else at the end of the footer. Once, ever. */
(function () {
  "use strict";
  var GOLD = "#C9A227", DIM = "rgba(201,162,39,.55)";

  /* the marks · fill:none, stroke:currentColor, the house's 1.6 weight */
  var MARK = {
    instagram: "<rect x='3.4' y='3.4' width='17.2' height='17.2' rx='5'/>" +
               "<circle cx='12' cy='12' r='4.1'/><circle cx='16.8' cy='7.2' r='.95'/>",
    facebook:  "<path d='M14.6 4.4h-1.7a3.4 3.4 0 0 0-3.4 3.4V20'/><path d='M7.4 11.1h5.7'/>",
    youtube:   "<rect x='2.9' y='5.6' width='18.2' height='12.8' rx='4'/>" +
               "<path d='M10.4 9.5 15.8 12l-5.4 2.5Z'/>",
    pinterest: "<path d='M8.6 20.9V4.5h4.2a4.15 4.15 0 0 1 0 8.3H8.6'/>",
    telegram:  "<path d='M21 3.8 2.9 11.4a.6.6 0 0 0 0 1.1l5.3 1.9 2 5.4a.6.6 0 0 0 1.1.1l2.5-3.6 4.3 3.1a.6.6 0 0 0 .9-.3Z'/>" +
               "<path d='M21 3.8 8.2 14.4'/>",
    threads:   "<circle cx='12' cy='12' r='3.4'/>" +
               "<path d='M15.4 12v1.9a2.4 2.4 0 0 0 4.8 0V12a8.2 8.2 0 1 0-4.6 7.4'/>"
  };

  var CSS =
    ".noor-social{margin:1.5rem auto 0;padding:0 1rem;text-align:center;max-width:100%}" +
    ".noor-social p.noor-social-label{margin:0 0 .1rem;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;" +
      "font-size:10px;font-weight:600;line-height:1.6;letter-spacing:.2em;text-transform:uppercase;color:" + DIM + "}" +
    ".noor-social ul.noor-social-row{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:.1rem;margin:0;padding:0;list-style:none}" +
    ".noor-social ul.noor-social-row>li{margin:0;padding:0;list-style:none;line-height:0}" +
    ".noor-social a.noor-social-link{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;" +
      "border-radius:999px;color:" + DIM + ";text-decoration:none;border:0;background:none;" +
      "-webkit-tap-highlight-color:transparent;transition:color .25s ease}" +
    ".noor-social a.noor-social-link:hover,.noor-social a.noor-social-link:focus-visible{color:" + GOLD + ";text-decoration:none}" +
    ".noor-social a.noor-social-link:focus-visible{outline:2px solid " + GOLD + ";outline-offset:-6px}" +
    ".noor-social a.noor-social-link svg{display:block;width:22px;height:22px;fill:none;stroke:currentColor;" +
      "stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}" +
    "@media (prefers-reduced-motion:reduce){.noor-social a.noor-social-link{transition:none}}";

  /* Where the footer of this page actually is. Three shapes exist in the
     house: a <footer>, the About band that carries footer.note, and the bare
     languages line at the foot of a translated index. */
  function place(row) {
    var feet = document.querySelectorAll("footer");
    var foot = feet.length ? feet[feet.length - 1] : null;
    var note = document.querySelector("[data-i18n='footer.note']");
    if (note && (!foot || foot.contains(note))) {
      note.insertAdjacentElement("afterend", row);
      return "note";
    }
    var langs = document.querySelector("nav[aria-label='Languages'],.langs");
    if (langs && (!foot || foot.contains(langs))) {
      langs.parentNode.insertBefore(row, langs);
      return "langs";
    }
    if (foot) { foot.appendChild(row); return "footer"; }
    return null;
  }

  function init() {
    /* an embedded room is someone else's page: it carries no footer and no
       doors out of it */
    if (document.documentElement.getAttribute("data-noor-embed") === "1") return;
    if (document.querySelector("[data-noor-social]")) return;
    var open = NOOR_SOCIAL.filter(function (s) { return s.href; });
    if (!open.length) return;

    var row = document.createElement("div");
    row.className = "noor-social";
    row.setAttribute("data-noor-social", "");

    var label = document.createElement("p");
    label.className = "noor-social-label";
    label.setAttribute("data-i18n", "footer.follow");
    label.textContent = (window.NOOR_I18N && NOOR_I18N.t("footer.follow", "Follow the light")) || "Follow the light";
    row.appendChild(label);

    var ul = document.createElement("ul");
    ul.className = "noor-social-row";
    open.forEach(function (s) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.className = "noor-social-link";
      a.href = s.href;
      a.target = "_blank";
      a.rel = "me noopener";
      a.setAttribute("aria-label", s.name);
      a.setAttribute("data-social", s.id);
      a.innerHTML = "<svg viewBox='0 0 24 24' aria-hidden='true' focusable='false'>" + (MARK[s.id] || "") + "</svg>";
      li.appendChild(a);
      ul.appendChild(li);
    });
    row.appendChild(ul);

    if (!place(row)) return;                 /* no footer on this page */
    /* The row is built after NOOR_I18N has already walked the page, so on a
       page in another language its label would sit in English until something
       else caused an apply. The pack may also have arrived only after the line
       above wrote the label. The one node is translated here, exactly the way
       apply() does it -- the baked English remembered first, so it survives a
       round trip through another language -- and nothing else is touched. */
    try {
      if (window.NOOR_I18N) {
        var fb = NOOR_I18N.en(label, "data-i18n-en");
        var v = NOOR_I18N.t("footer.follow", fb);
        if (label.textContent !== v) label.textContent = v;
      }
    } catch (e) { /* the English already in the label stands */ }
    var css = document.createElement("style");
    css.id = "noor-social-css";
    css.textContent = CSS;
    document.head.appendChild(css);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

/* ================= the second cut's skin =================
   Every page that is not already in the shell (no data-n2 on <html> or
   <body>) is dressed by it: assets/noor2.css and assets/noor2-skin.css are
   appended, assets/noor2.js is loaded, and NOOR2.inject() adds the bar of
   five doors, the share in the footer and the home-screen offer, and
   harmonises a night page's header. The kids' games (kids/*.html, not
   kids.html) keep their own full-screen UI; an embedded room stays bare;
   the consoles are their own. The version tail matches api/page.js. */
/* ===================== the top line's right hand =========================
   Every page in the house wears the same top line: the brand on the left, and
   on the arrival two doors on the right -- the language, and the menu. The
   1,135 rooms rendered by api/page.js and the 523 dictionary words wear the
   left half only. Tapping Today from the bar landed a reader on a page with no
   way to change language and no way to reach any other room except the five in
   the bar. The arrival built those two doors in its own markup, so they were
   never part of the shell, and everything the shell dresses went without them.

   They belong to the shell. This adds them to any top line that has no right
   hand of its own, which leaves the arrival exactly as it is. */
(function () {
  "use strict";
  var W = window, D = document;
  function dress() {
    var top = D.querySelector("header.n2-top");
    if (!top || top.querySelector(".n2-top-r, .hm-top-r")) return;
    if (D.documentElement.getAttribute("data-noor-embed") === "1") return;

    var r = D.createElement("div");
    r.className = "n2-top-r";

    var lang = D.createElement("a");
    lang.className = "n2-pill n2-top-lang";
    lang.href = "#lang";
    lang.setAttribute("data-noor-lang", "");
    lang.setAttribute("aria-label", "Choose your language");
    lang.textContent = ((W.NOOR_I18N && NOOR_I18N.lang) || D.documentElement.lang || "en")
      .split("-")[0].toUpperCase();

    var menu = D.createElement("a");
    menu.className = "n2-pill n2-top-menu";
    menu.href = "/#search";
    menu.setAttribute("data-nm-open", "");
    menu.setAttribute("aria-label", "Open the menu: every room of the library, by section");
    menu.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M4 7h16M4 12h16M4 17h10"/></svg><span>Menu</span>';

    r.appendChild(lang);
    r.appendChild(menu);
    top.appendChild(r);
    /* three pills and a wordmark do not fit a 390px phone; the room's own pill
       is the one that yields, because the two doors are the same on every page
       and the reader learns where they are. */
    if (top.querySelectorAll(".n2-pill").length > 2) top.classList.add("n2-top-3");

    var css = D.createElement("style");
    css.id = "n2-top-r-css";
    css.textContent =
      ".n2-top-r{display:flex;gap:8px;flex:none;margin-inline-start:auto}" +
      ".n2-top-menu svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;" +
        "stroke-linecap:round;margin-inline-end:6px}" +
      ".n2-top-lang{font-family:var(--n2-mono,ui-monospace,monospace);letter-spacing:.08em}" +
      "@media (max-width:420px){.n2-top-menu span{display:none}" +
        ".n2-top-menu svg{margin:0}.n2-top-menu{padding:0 12px}}" +
      "@media (max-width:520px){.n2-top-3 .n2-brand .n2-en{display:none}}";
    if (!D.getElementById("n2-top-r-css")) D.head.appendChild(css);

    /* the pill follows the reader's choice */
    D.addEventListener("noor:lang", function (e) {
      var c = (e && e.detail && e.detail.lang) || (W.NOOR_I18N && NOOR_I18N.lang);
      if (c) lang.textContent = String(c).split("-")[0].toUpperCase();
    });
  }
  /* The top line arrives three different ways: written into the page (the
     arrival), rendered by api/page.js, or built by NOOR2.inject() after the
     shell's stylesheets land. The third is the common case and it happens
     after DOMContentLoaded, so waiting for the document is not enough -- the
     first cut of this ran, found no header, and left every room in the house
     exactly as it had been. Watch for it instead. */
  function watch() {
    dress();
    if (D.querySelector("header.n2-top .n2-top-r")) return;
    try {
      var mo = new MutationObserver(function () {
        dress();
        if (D.querySelector("header.n2-top .n2-top-r")) mo.disconnect();
      });
      mo.observe(D.documentElement, { childList: true, subtree: true });
      setTimeout(function () { try { mo.disconnect(); } catch (e) {} }, 12000);
    } catch (e) {
      var n = 0, t = setInterval(function () {
        dress();
        if (++n > 40 || D.querySelector("header.n2-top .n2-top-r")) clearInterval(t);
      }, 300);
    }
  }
  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", watch);
  else watch();
})();

(function () {
  "use strict";
  var H = document.documentElement, p = location.pathname;
  if (H.hasAttribute("data-n2") || H.getAttribute("data-noor-embed") === "1") return;
  if (/^\/kids\/./.test(p) || /^\/admin/.test(p)) return;
  /* left was a hand-kept number, and adding a fourth stylesheet to the list
     below without changing it took the bar off every room in the house: the
     count reached zero one callback early, when NOOR2 was not defined yet, and
     never came back to zero afterwards, so inject() was never called and no
     page had a bar. A number that has to be kept in step with a list by hand
     will eventually not be. It counts the list now. */
  /* The version tail. It must move whenever ANY file in SHEETS below changes,
     or the change does not reach anybody: /assets/*.css is served with
     stale-while-revalidate, so ?v=3 is its own cache key and it will happily
     keep handing out the copy it already has. That is how a night sheet with
     the masjid's sermon text finally readable in it sat on the server for an
     hour while every visitor kept getting the one where it was 1.17:1.
     Bumped to 4 for: the night reading four more stylesheets, --soft turning,
     and noor2-legible.css.
     Bumped to 5 for: the night no longer painting rooms that were already dark,
     --parchment left alone and its grounds turned by property instead, the
     background shorthand no longer eating background-clip, and a legibility
     floor measured with itself switched off. api/page.js carries the same
     number; tests/rooms.mjs checks the two agree. */
  var V = "5", left = 0, started = false;
  function waitFor(n) { left += n; }
  function done() {
    if (--left > 0 || !started) return;
    if (window.NOOR2 && NOOR2.inject) NOOR2.inject();
  }
  function css(href) { var l = document.createElement("link"); l.rel = "stylesheet"; l.href = href; l.onload = done; l.onerror = done; document.head.appendChild(l); }
  function init() {
    if (document.body && document.body.hasAttribute("data-n2")) return;
    /* The night, on the rooms a person wrote. They were left in the first
       cut's parchment when the shell went to the arrival, the words and the
       generated rooms, so the site read in two lights at once and the older
       one was on the rooms people actually came for. assets/noor2-night.css
       turns their own palette over -- it is generated from their own styles
       by scripts/build-night.py, so nothing is missed.

       The class goes on before the sheet is asked for, and NOOR2.inject() is
       held until every stylesheet has landed: it reads the page's computed
       background to decide whether the bar and the footer's share button
       should be dressed for night or for parchment, and it must not be asked
       while the page is still the colour it is about to stop being. */
    /* Was this room ever parchment?

       The night sheet is generated from the rooms' own styles, and until
       September 2026 every rule it produced answered on every page. That was
       fine while the rooms it read and the rooms it painted were the same set.
       They are not: kids.html, allah.html and muhammad.html were written in
       the night to begin with -- body{background:var(--deep);color:var(
       --parchment)} -- so the parchment is their *writing*. Turning the house
       tokens over turned those rooms inside out: the Little Codex wordmark went
       black on black, its star tiles grew cream bands under white labels, and a
       moon-phase dial from another room painted a gold wedge across the word
       "Codex", because .moon is a class name and a class name is not a
       namespace.

       So the room is asked what colour its own floor is, before the night is
       put on it. A light floor is a parchment room and gets .n2-room, which is
       what every rule read out of a room's <style> is scoped to. A dark floor
       is already the night and is left exactly as its author wrote it. Nothing
       is listed, so nothing can fall out of date: a room written dark tomorrow
       is protected the day it lands. */
    var lit = 1;
    for (var el = document.body; el; el = el.parentElement) {
      var m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,\/]\s*([\d.]+))?/
        .exec(getComputedStyle(el).backgroundColor || "");
      if (!m || (m[4] !== undefined && parseFloat(m[4]) < 0.5)) continue;
      lit = (0.2126 * +m[1] + 0.7152 * +m[2] + 0.0722 * +m[3]) / 255;
      break;
    }
    H.classList.add("n2-night");
    if (lit >= 0.45) H.classList.add("n2-room");
    /* Which room this is. A handful of the night's rules were read out of a
       room's <style> and have no class in them at all -- main p, footer, label,
       input, h3 -- and a bare element name is not a namespace: the language
       front doors' `main p` turned light and then answered on /begin, where the
       Seeker's card is still cream, and wrote white on cream. Those rules are
       addressed to the room that asked for them, and this is the address. */
    var rp = location.pathname.replace(/\/+$/, "").replace(/\.html$/, "");
    if (/\/index$/.test(rp)) rp = rp.slice(0, -6);
    H.setAttribute("data-room", rp.replace(/^\/+/, "") || "home");
    var SHEETS = ["/assets/noor2.css", "/assets/noor2-skin.css",
                  "/assets/noor2-night.css", "/assets/noor2-legible.css"];
    waitFor(SHEETS.length + 1);            /* the sheets, and noor2.js */
    started = true;
    for (var i = 0; i < SHEETS.length; i++) css(SHEETS[i] + "?v=" + V);
    /* noor2-legible.css is last in that list on purpose: it is the legibility
       floor, generated the same way the night is -- by walking the real pages
       and measuring what the browser actually paints -- and it says only two
       things. Every piece of text reaches 4.5:1 against the ground genuinely
       behind it, and nothing meant to be read is under 12px. Loading it last
       is half of how it wins; scripts/build-legible.mjs explains the other. */
    var s = document.createElement("script"); s.src = "/assets/noor2.js?v=" + V; s.defer = true; s.onload = done; s.onerror = function () {};
    document.head.appendChild(s);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

/* ================= the search a shell page was missing =================
   The bar the shell draws has five doors and the fifth is Search. It opens
   assets/noor-search.js's sheet -- but only where that file is on the page.
   The 523 word pages, rebuilt in the shell on 9 September 2026, were not
   given it: their Search was a bare link, and a reader who arrived from a
   reel, tapped it, and wanted the meaning of another word was put down in
   front of a 220KB directory instead of a field to type in. Those pages are
   where the reels land, so that is the search that matters most.

   8KB, and only where it is missing: a page that already loads the sheet, or
   has no Search to open it, is left exactly as it is. The bar is drawn by
   noor2.js, which may still be arriving, so the wait is for the door and not
   for the clock -- and it gives up rather than watch forever. */
(function () {
  "use strict";
  /* A page counts as having the search when it can answer find(), not when
     something called NOOR_SEARCH is present: the retired sheet defined that
     same global with open() and no find(), so testing the name alone made
     this loader stand down on precisely the pages that needed it. */
  function able() { return !!(window.NOOR_SEARCH && window.NOOR_SEARCH.find); }
  window.NOOR_NEED_SEARCH = function () {
    if (able()) return Promise.resolve(true);
    if (!window.__noorSearchLoad) window.__noorSearchLoad = new Promise(function (done) {
      var s = document.createElement("script");
      /* by its plain path, never ?v=nn -- a version query is its own cache
         key, and the stale copy lives under one of them */
      s.src = "/assets/noor-search.js";
      s.onload = function () { done(able()); };
      s.onerror = function () { done(false); };
      document.head.appendChild(s);
    });
    return window.__noorSearchLoad;
  };
  if (able()) return;
  var tries = 0;
  function add() { window.NOOR_NEED_SEARCH(); }
  function look() {
    if (able()) return;
    if (document.querySelector("[data-n2-search],[data-n2-more]")) return add();
    if (++tries > 20) return;                       /* ~5 s, then let it be */
    setTimeout(look, 250);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", look);
  else look();
})();

/* ================= the quiet guide, wherever a box asks for it =============
   noor-guide.js answers from the sources on the thirty chapters that carry a
   curated topic -- the Dajjal, the grave, the trials, Harut and Marut. When
   the home was rebuilt in the shell on 9 September 2026 its two scripts were
   not carried over and the pill went off the arrival: the chapters a reader is
   most likely to be uneasy in lost the one thing there to steady them.

   A page that wants it says so on the box that should carry it --
   data-guide="n:55" -- and this fetches the 61KB of answers once, the first
   time such a box appears, and never on a page that has none. attach() is a
   no-op for a chapter with no topic, so a wrong key costs nothing. The sheets
   of the shell are built after this file runs, so new boxes are watched for;
   the observer is dropped once the answers are in and the first box is served,
   and re-armed by the next one, which keeps a long session cheap. */
(function () {
  "use strict";
  var doc = document, asked = null, seen = "data-guide-done";
  function load() {
    if (asked) return asked;
    asked = new Promise(function (done) {
      var left = 2, bad = 0;
      ["/noor-guide-data.js", "/noor-guide.js"].forEach(function (src) {
        var t = doc.createElement("script");
        t.src = src; t.defer = true;
        t.onerror = function () { bad = 1; };
        t.onload = t.onerror = function () { if (--left === 0) done(!bad); };
        doc.head.appendChild(t);
      });
    });
    return asked;
  }
  function serve(box) {
    if (!box || box.hasAttribute(seen)) return;
    box.setAttribute(seen, "");
    var key = box.getAttribute("data-guide");
    load().then(function (ok) {
      if (!ok || !window.NoorGuide || !NoorGuide.attach) return;
      if (doc.contains(box)) NoorGuide.attach(box, key, doc.title);
    });
  }
  function sweep() { var l = doc.querySelectorAll("[data-guide]:not([" + seen + "])"), i = 0; for (; i < l.length; i++) serve(l[i]); }
  function watch() {
    sweep();
    if (!window.MutationObserver) return;
    new MutationObserver(sweep).observe(doc.body, { childList: true, subtree: true });
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", watch);
  else watch();
})();

/* ================= Friday, once, quietly =================================
   Jumu'ah had a band across the top of the page, drawn by sponsor.js under
   the shared header. The arrival has no shared header any more, so from the
   day the home was rebuilt the best day of the week reached every room in the
   house except the one every reader arrives through.

   A band is also the wrong shape for it. A band is furniture: it is there on
   Tuesday too, so the eye has already learned to skip that strip of the page.
   This is a card that comes once, on Friday, a breath after the page has
   settled, above the thumb where the bar is -- and then goes, whether it is
   answered or not, and does not come again until the next Jumu'ah. Nothing is
   covered, nothing is blocked, no scroll is locked: a reader who ignores it
   loses nothing and is not asked twice.

   The Islamic day turns at sunset, so Jumu'ah begins on Thursday evening.
   Without the reader's location we cannot know their maghrib, so the ordinary
   convention: after six on Thursday, and all of Friday until six -- the same
   rule sponsor.js used, kept here so both agree. ?jumuah=1 forces it on for a
   look. The words are the house's own, from the band it replaces. */
(function () {
  "use strict";
  var doc = document, W = window, p = location.pathname;
  if (/(^|\/)admin/.test(p) || /(^|\/)kids\//.test(p)) return;   /* no cards near children */
  if (/[?&]embed=1/.test(location.search)) return;
  try { if (W.self !== W.top) return; } catch (e) { return; }

  function jumuah() {
    try { if (/[?&]jumuah=1/.test(location.search)) return "forced"; } catch (e) {}
    var d = new Date(), day = d.getDay(), h = d.getHours();
    if (day === 5 && h < 18) return d.toISOString().slice(0, 10);
    if (day === 4 && h >= 18) {                    /* the eve: key it to Friday */
      var f = new Date(d.getTime() + 86400000);
      return f.toISOString().slice(0, 10);
    }
    return null;
  }
  function seen(k, set) {
    try {
      if (set) return localStorage.setItem("noor-jumuah", k);
      return localStorage.getItem("noor-jumuah") === k;
    } catch (e) { return set ? null : false; }
  }

  var CSS = ''
    + '.nj{position:fixed;left:50%;transform:translate(-50%,140%);bottom:calc(var(--n2-bar-h,0px) + 14px + env(safe-area-inset-bottom,0px));'
    + 'width:min(420px,calc(100vw - 28px));z-index:34;box-sizing:border-box;padding:14px 16px 13px;border-radius:18px;'
    + 'background:rgba(10,16,36,.94);border:1px solid rgba(233,200,106,.34);'
    + 'box-shadow:0 18px 50px rgba(0,0,0,.5),0 0 44px rgba(233,200,106,.07);'
    + '-webkit-backdrop-filter:blur(22px);backdrop-filter:blur(22px);opacity:0;'
    + 'font-family:Inter,system-ui,sans-serif;color:rgba(255,254,247,.86);'
    + 'transition:transform .62s cubic-bezier(.2,.7,.2,1),opacity .4s cubic-bezier(.2,.7,.2,1)}'
    + '.nj.on{transform:translate(-50%,0);opacity:1}'
    + '.nj-h{display:flex;align-items:center;gap:9px;margin:0 0 7px}'
    + '.nj-m{font-size:17px;line-height:1;color:#E9C86A;animation:njb 6s ease-in-out infinite}'
    + '@keyframes njb{0%,100%{opacity:.72}50%{opacity:1}}'
    + '.nj-e{flex:1;font:500 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.18em;'
    + 'text-transform:uppercase;color:#E9C86A}'
    + '.nj-x{flex:none;width:26px;height:26px;margin:-4px -6px -4px 0;border:0;background:none;cursor:pointer;'
    + 'color:rgba(255,254,247,.5);font-size:17px;line-height:1;border-radius:8px}'
    + '.nj-x:hover{color:#E9C86A}'
    + '.nj-p{margin:0;font-size:13.5px;line-height:1.6;color:rgba(255,254,247,.72)}'
    + '.nj-a{display:inline-block;margin-top:11px;font-size:13.5px;font-weight:600;color:#E9C86A;'
    + 'text-decoration:none;border-bottom:1px solid rgba(233,200,106,.36);padding-bottom:2px}'
    + '.nj-a:hover{border-bottom-color:#E9C86A}'
    + '@media (prefers-reduced-motion:reduce){.nj{transition:none}.nj-m{animation:none}}'
    + '@media print{.nj{display:none}}';

  function show(key) {
    if (doc.querySelector(".nj") || doc.querySelector("[data-jumuah]")) return;
    var st = doc.createElement("style"); st.id = "nj-css"; st.textContent = CSS; doc.head.appendChild(st);
    var c = doc.createElement("aside");
    c.className = "nj";
    c.setAttribute("role", "note");
    c.setAttribute("aria-label", "Jumu'ah");
    c.innerHTML =
      '<p class="nj-h"><span class="nj-m" aria-hidden="true">☾</span>' +
      '<span class="nj-e">Jumu’ah Mubarak</span>' +
      '<button class="nj-x" type="button" aria-label="Close">×</button></p>' +
      '<p class="nj-p">The Prophet ﷺ called Friday the best day the sun rises upon. ' +
      'Send prayers upon him abundantly, and give something, even small. There is an hour in this day ' +
      'when du’a is not refused.</p>' +
      '<a class="nj-a" href="/quran?surah=18">Open Surah Al-Kahf →</a>';
    doc.body.appendChild(c);
    if (key !== "forced") seen(key, 1);       /* asked once, answered or not */
    requestAnimationFrame(function () { requestAnimationFrame(function () { c.classList.add("on"); }); });
    var gone = false;
    function go() {
      if (gone) return; gone = true;
      c.classList.remove("on");
      setTimeout(function () { if (c.parentNode) c.parentNode.removeChild(c); }, 700);
    }
    c.querySelector(".nj-x").addEventListener("click", go);
    c.querySelector(".nj-a").addEventListener("click", go);
    /* it leaves on its own if it is not wanted: a reminder, not a demand */
    setTimeout(go, 22000);
  }

  function start() {
    var key = jumuah();
    if (!key) return;
    if (key !== "forced" && seen(key)) return;
    setTimeout(function () { show(key); }, 2200);
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start);
  else start();
})();


/* ================= More: the map of the house, and the search ============
   The bar carries five doors and the library has forty-two rooms. Until 9
   September 2026 the other thirty-seven were reachable only through the menu
   dial, which lived on the arrival alone -- so a reader standing in any room
   on a phone could not get to the Prophets at all. And the fifth door said
   Search while the field on the arrival opened something else, so the one
   control that was there answered two different ways.

   This is the fifth door now. It opens one sheet that does both jobs:

     empty        the map -- eight sections, forty-two rooms, each with the
                  line that says what it is
     two letters  the search -- every word, prophet, companion, place, hero,
                  surah, station and room, ranked, best group first

   The map is inlined (3 KB) because it changes when a room is built, which is
   rarely, and a reader should never wait on a request to find out what is in
   the house. The search index (assets/noor-search.js) is fetched only when
   someone actually types. The dial and its 120 KB index are retired.

   Closes on the backdrop, the close button, Escape, or a pull past 80 px.
   Under prefers-reduced-motion nothing moves. */
(function () {
  "use strict";
  var doc = document, W = window;
  var MAP = [["The Qur'an","The text itself, and what is needed to hold it",[["The Mushaf","All 114 surahs, with recitation for every ayah","/quran"],["The Letters","Learn to read the Arabic script, letter by letter","/arabic"],["The Words of the Path","The du'as worth carrying, in Arabic and English","/words"]]],["Belief","Who He is, who He sent, and what is unseen",[["The Ninety-Nine Names","His names, what He is not, and the three doors of tawhid","/allah"],["The 25 Prophets","Every prophet named in the Qur'an","/prophets"],["The Seerah","Twenty-three years, his character and his habits","/muhammad"],["Theology","The branches, and where they parted","/theology"],["The Unseen","Angels, jinn, the barzakh, the signs of the Hour","/unseen"],["The Journey of the Soul","What happens after the last breath","/soul"]]],["Worship","How it is actually done",[["The Five Pillars","Shahadah, salah, zakat, sawm, hajj","/pillars"],["Begin","For anyone new to Islam, from the first day","/begin"],["Ramadan","The month, and the tools for it","/ramadan"],["Hajj & Umrah","The rites, step by step, with their evidence","/hajj"],["Your Pilgrim Plan","A plan written from your own answers","/hajj-plan"],["The Two Eids","Fitr and Adha","/eid"]]],["The Story","Where all of it came from, and where it is going",[["The Path of Creation","71 chapters, from Kun Fayakun to the Hour","/#timeline"],["The Companions","The men and women who saw him ﷺ","/companions"],["Heroes of Islam","The people who carried it after them","/heroes"],["Characters","Everyone the Codex names","/characters"],["Places","The ground it happened on","/places"],["The Last Sermon","The final khutbah, line by line","/sermon"],["Two Lives","The scale, and what is on it","/mizan"]]],["Daily Life","The practice as it meets an ordinary week",[["How to Live a Good Life","Tayyiba: a good life, not an easy one","/good-life"],["Three Lives","Weigh your own against them","/three-lives"],["The Family Room","Children, parents, neighbours","/family"],["Marriage & the Home","From the proposal to the household","/marriage"],["Prophetic Health","The body, the plate, the fast, hijama","/health"],["For Teenagers","Written for them, not about them","/teens"],["Protection & the Light","Sihr, ruqya, the evil eye, and the myths","/protection"],["Are We in a Simulation?","The modern question, answered from the text","/simulation"]]],["Look It Up","When you need one thing, fast",[["The Encyclopedia of the Path","523 words this library uses, defined","/dictionary"],["The Classroom","The whole curriculum, in order","/madrasa"],["The School","The full course, for schools and organisations","/school"]]],["Children","Built for them, not simplified for them",[["The Kids' Codex","The Greatest Game","/kids"],["The Hall of Stories","His names, told as stories","/stories"],["The Lantern Sky","Light the whole day with prayer","/kids/lanterns"]]],["The House","The building itself",[["Give a Gift","Keep the lamp lit","/donate"],["The Masjid Toolbox","Boards, timetables and printables","/masjid"],["For Schools & Organisations","Use the Codex in your own place","/license"],["The Guardian's Journal","What the keeper is thinking about","/journal"],["Corrections & Ideas","Tell us what is wrong","/feedback"],["Terms & Transparency","Where the money goes, and what is collected","/legal"]]]];

  var CSS = ''
    + '.nmr{position:fixed;inset:0;z-index:60;display:none}'
    + '.nmr.on{display:block}'
    + '.nmr-back{position:absolute;inset:0;background:rgba(4,6,15,.72);opacity:0;'
    + '-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);transition:opacity .34s cubic-bezier(.2,.7,.2,1)}'
    + '.nmr.on .nmr-back{opacity:1}'
    + '.nmr-p{position:absolute;left:50%;bottom:0;width:min(680px,100%);max-height:92vh;'
    + 'transform:translate(-50%,100%);display:flex;flex-direction:column;'
    + 'background:rgba(10,16,36,.97);border:1px solid rgba(233,200,106,.26);border-bottom:0;'
    + 'border-radius:22px 22px 0 0;box-shadow:0 -18px 60px rgba(0,0,0,.6);'
    + '-webkit-backdrop-filter:blur(26px);backdrop-filter:blur(26px);'
    + 'transition:transform .56s cubic-bezier(.2,.7,.2,1);font-family:Inter,system-ui,sans-serif}'
    + '.nmr.on .nmr-p{transform:translate(-50%,0)}'
    + '.nmr-grip{width:38px;height:4px;border-radius:2px;background:rgba(255,254,247,.22);'
    + 'margin:9px auto 0;flex:none}'
    + '.nmr-top{display:flex;align-items:center;gap:10px;padding:12px 16px 12px;flex:none}'
    + '.nmr-f{flex:1;display:flex;align-items:center;gap:9px;min-width:0;min-height:48px;padding:0 15px;'
    + 'background:rgba(255,254,247,.06);border:1px solid rgba(233,200,106,.26);border-radius:14px;'
    + 'transition:border-color .25s cubic-bezier(.2,.7,.2,1)}'
    + '.nmr-f:focus-within{border-color:rgba(233,200,106,.6)}'
    + '.nmr-f svg{width:17px;height:17px;flex:none;color:#E9C86A}'
    + '.nmr-f input{flex:1;min-width:0;border:0;outline:0;background:none;font:inherit;font-size:16px;'
    + 'color:#FFFEF7;caret-color:#E9C86A}'
    + '.nmr-f input::placeholder{color:rgba(255,254,247,.42)}'
    + '.nmr-f input::-webkit-search-cancel-button{display:none}'
    + '.nmr-x{flex:none;min-height:44px;padding:0 13px;cursor:pointer;background:none;'
    + 'border:1px solid rgba(233,200,106,.22);border-radius:12px;'
    + 'font:500 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.16em;'
    + 'text-transform:uppercase;color:rgba(255,254,247,.62);transition:color .2s,border-color .2s}'
    + '.nmr-x:hover{color:#E9C86A;border-color:rgba(233,200,106,.5)}'
    + '.nmr-b{flex:1 1 auto;overflow-y:auto;-webkit-overflow-scrolling:touch;'
    + 'padding:2px 16px calc(20px + env(safe-area-inset-bottom,0px));overscroll-behavior:contain}'
    + '.nmr-s{margin:16px 0 6px;font:500 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;'
    + 'letter-spacing:.2em;text-transform:uppercase;color:#E9C86A}'
    + '.nmr-s small{display:block;margin-top:6px;font-family:Inter,system-ui,sans-serif;font-size:13px;'
    + 'letter-spacing:0;text-transform:none;color:rgba(255,254,247,.44)}'
    + '.nmr-r{display:flex;align-items:center;gap:12px;padding:11px 2px;text-decoration:none;'
    + 'border-top:1px solid rgba(233,200,106,.12);transition:background .18s cubic-bezier(.2,.7,.2,1)}'
    + '.nmr-r:first-of-type{border-top:0}'
    + '.nmr-r:hover,.nmr-r:focus-visible{background:rgba(233,200,106,.08);outline:none}'
    + '.nmr-r span{flex:1;min-width:0}'
    + '.nmr-r b{display:block;font-size:15.5px;font-weight:600;color:#FFFEF7;line-height:1.3}'
    + '.nmr-r i{display:block;font-style:normal;font-size:13px;line-height:1.5;color:rgba(255,254,247,.5);margin-top:2px}'
    + '.nmr-r em{font-style:normal;font-family:Amiri,serif;font-size:15px;color:#E9C86A;margin-inline-start:7px}'
    + '.nmr-r svg{width:14px;height:14px;flex:none;stroke:#E9C86A;fill:none;stroke-width:2;opacity:.6}'
    + '.nmr-none{margin:18px 2px;font-size:14px;line-height:1.7;color:rgba(255,254,247,.5)}'
    + '.nmr-none a{color:#E9C86A;font-weight:600}'
    + '@media (min-width:620px){.nmr-cols{columns:2;column-gap:26px}'
    + '.nmr-cols>div{break-inside:avoid;-webkit-column-break-inside:avoid}}'
    + '@media (prefers-reduced-motion:reduce){.nmr-back,.nmr-p,.nmr-r,.nmr-f{transition:none!important}}'
    + '@media print{.nmr{display:none!important}}';

  var CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
  var box = null, input = null, body = null, openNow = false, tid = 0;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function row(title, line, url, ar) {
    return '<a class="nmr-r" href="' + esc(url) + '"><span><b>' + esc(title) +
      (ar ? '<em class="notranslate" translate="no">' + esc(ar) + "</em>" : "") + "</b>" +
      (line ? "<i>" + esc(line) + "</i>" : "") + "</span>" + CHEV + "</a>";
  }
  function drawMap() {
    body.innerHTML = '<div class="nmr-cols">' + MAP.map(function (s) {
      return '<div><p class="nmr-s">' + esc(s[0]) + (s[1] ? "<small>" + esc(s[1]) + "</small>" : "") + "</p>" +
        s[2].map(function (r) { return row(r[0], r[1], r[2]); }).join("") + "</div>";
    }).join("") + "</div>";
  }
  function drawHits(groups, term) {
    if (!groups.length) {
      body.innerHTML = '<p class="nmr-none">Nothing under that spelling yet. Try fewer letters, or the ' +
        'plain English word. <a href="/feedback">Tell us what was missing</a> and it gets added.</p>';
      return;
    }
    var shown = 0, h = "";
    for (var k = 0; k < groups.length && shown < 34; k++) {
      var g = groups[k], cap = k === 0 ? 8 : 5;
      h += '<p class="nmr-s">' + esc(g.name) + "</p>";
      h += g.hits.slice(0, cap).map(function (x) { shown++; return row(x.t, x.s, x.u, x.a); }).join("");
      if (g.hits.length > cap) h += '<p class="nmr-none" style="margin:6px 2px 0">and ' +
        (g.hits.length - cap) + " more in " + esc(g.name) + "</p>";
    }
    body.innerHTML = h;
  }
  function look() {
    var term = input.value.trim();
    if (term.length < 2) return drawMap();
    var mine = term;
    var go = function () {
      var S = W.NOOR_SEARCH;
      if (!S || !S.find) return;
      S.find(term).then(function (groups) { if (input.value.trim() === mine) drawHits(groups, mine); });
    };
    /* If the page is carrying a copy of the retired search, fetch the one that
       can answer and then look again -- rather than returning in silence and
       leaving the reader typing into a field that never replies. */
    if (W.NOOR_SEARCH && W.NOOR_SEARCH.find) return go();
    if (W.NOOR_NEED_SEARCH) W.NOOR_NEED_SEARCH().then(function (ok) {
      if (ok && input.value.trim() === mine) go();
    });
  }

  function shell() {
    if (box) return;
    var st = doc.createElement("style"); st.id = "nmr-css"; st.textContent = CSS;
    doc.head.appendChild(st);
    box = doc.createElement("div");
    box.className = "nmr";
    box.innerHTML = '<div class="nmr-back"></div>' +
      '<div class="nmr-p" role="dialog" aria-modal="true" aria-label="The library">' +
      '<i class="nmr-grip" aria-hidden="true"></i>' +
      '<div class="nmr-top"><label class="nmr-f">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">' +
      '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
      '<input type="search" id="nmr-q" autocomplete="off" spellcheck="false" ' +
      'placeholder="Search, or read the whole library" aria-label="Search the library"/></label>' +
      '<button type="button" class="nmr-x" aria-label="Close">esc</button></div>' +
      '<div class="nmr-b" id="nmr-b"></div></div>';
    doc.body.appendChild(box);
    input = box.querySelector("#nmr-q");
    body = box.querySelector("#nmr-b");
    box.querySelector(".nmr-back").addEventListener("click", close);
    box.querySelector(".nmr-x").addEventListener("click", close);
    input.addEventListener("input", function () { clearTimeout(tid); tid = setTimeout(look, 90); });
    input.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      var a = body.querySelector(".nmr-r"); if (a) a.click();
    });
    body.addEventListener("click", function (e) { if (e.target.closest(".nmr-r")) close(); });
    /* a pull down on the grip closes it, like the shell's own sheets */
    var p = box.querySelector(".nmr-p"), y0 = null;
    p.addEventListener("pointerdown", function (e) {
      if (!e.target.closest(".nmr-grip") && !e.target.closest(".nmr-top")) return;
      if (e.target.closest("input,button")) return;
      y0 = e.clientY; p.setPointerCapture(e.pointerId);
    });
    p.addEventListener("pointermove", function (e) {
      if (y0 === null) return;
      var dy = Math.max(0, e.clientY - y0);
      p.style.transform = "translate(-50%," + dy + "px)";
    });
    function end(e) {
      if (y0 === null) return;
      var dy = Math.max(0, e.clientY - y0); y0 = null; p.style.transform = "";
      if (dy > 80) close();
    }
    p.addEventListener("pointerup", end);
    p.addEventListener("pointercancel", end);
  }
  function esckey(e) { if (e.key === "Escape" && openNow) { e.preventDefault(); close(); } }

  function open() {
    shell();
    openNow = true;
    doc.documentElement.classList.add("nmr-open");
    doc.body.style.overflow = "hidden";
    drawMap();
    requestAnimationFrame(function () { box.classList.add("on"); });
    setTimeout(function () { if (openNow) box.classList.add("on"); }, 90);
    doc.addEventListener("keydown", esckey);
    /* warm the index while a reader is reading the map */
    if (W.NOOR_SEARCH && W.NOOR_SEARCH.find) W.NOOR_SEARCH.find("");
    else if (W.NOOR_NEED_SEARCH) W.NOOR_NEED_SEARCH();
    setTimeout(function () { if (matchMedia("(hover:hover)").matches) input.focus(); }, 60);
  }
  function close() {
    if (!box) return;
    openNow = false;
    box.classList.remove("on");
    doc.documentElement.classList.remove("nmr-open");
    doc.body.style.overflow = "";
    doc.removeEventListener("keydown", esckey);
    input.value = "";
    setTimeout(function () { if (!openNow) box.classList.remove("on"); }, 600);
  }

  /* every way in: the bar's fifth door, the arrival's field, the "/" key, the
     old magnifiers on the pages that still carry one, and /#search from a link */
  doc.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-n2-more],[data-n2-search],[data-nm-open],#hm-search,#search-toggle");
    if (!t) return;
    e.preventDefault(); e.stopPropagation();
    open();
  }, true);
  /* ------------------------------------------------- the door says "More"
     523 word pages and a handful of others were built with the fifth door as
     Search: a magnifier, labelled Search, pointing at /dictionary. They open
     this same sheet -- it answers their door as readily as the new one -- but
     a reader crossing from a word page to a rendered room found the last
     door in the bar had changed its name and its picture, which is exactly
     the inconsistency that was complained about.

     Rebuilding all 523 pages to change two elements is a poor trade for the
     reader, who gets nothing from it, so the door is corrected where it
     stands. The pages will carry it themselves at the next rebuild; until
     then the house is one house on every screen. */
  function relabel() {
    var bar = doc.querySelector(".n2-bar");
    if (!bar || bar.querySelector("[data-n2-more]")) return;
    var a = bar.querySelector("a[data-n2-search],a[data-nm-open]");
    if (!a) return;
    a.setAttribute("data-n2-more", "");
    a.setAttribute("href", "/#search");
    var svg = a.querySelector("svg");
    if (svg) svg.innerHTML = '<circle cx="5.5" cy="6" r="1.6"/><circle cx="5.5" cy="12" r="1.6"/>' +
      '<circle cx="5.5" cy="18" r="1.6"/><path d="M11 6h8M11 12h8M11 18h8"/>';
    /* the label is the bar's own last text node, not a wrapper we can assume */
    for (var n = a.lastChild; n; n = n.previousSibling) {
      if (n.nodeType === 3 && n.nodeValue.trim()) { n.nodeValue = "More"; return; }
      if (n.nodeType === 1 && n.tagName !== "SVG" && n.textContent.trim()) { n.textContent = "More"; return; }
    }
  }
  /* the bar may be the page's own or drawn later by noor2.js, so look twice */
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", relabel); else relabel();
  var relooks = 0;
  var reloop = setInterval(function () { relabel(); if (++relooks > 16) clearInterval(reloop); }, 250);

  W.addEventListener("keydown", function (e) {
    if (openNow) return;
    if (e.key !== "/" && !(e.key === "k" && (e.metaKey || e.ctrlKey))) return;
    var n = e.target.tagName;
    if (n === "INPUT" || n === "TEXTAREA" || e.target.isContentEditable) return;
    e.preventDefault(); open();
  });
  if (location.hash === "#search") setTimeout(open, 300);
  W.NOOR_MORE = { open: open, close: close };
})();
