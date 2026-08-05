/* ============================================================
   NOOR FX: shared experience engine (vanilla, zero-build)
   Particles · starfield · parallax · tilt physics · reveals ·
   lazy images · i18n · tilawah audio · cross-links · toasts
   All animation is transform/opacity only (GPU-composited).
   Honors prefers-reduced-motion. ~9 KB gzipped.
   ============================================================ */
(function () {
"use strict";

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const FINE = matchMedia("(hover: hover) and (pointer: fine)").matches;

/* ---------------- i18n (Phase A: EN master inline; packs fetched per-language) ---------------- */
const UI_EN = {
  "nav.books":"Books","nav.path":"Path","nav.characters":"Characters","nav.places":"Places","nav.words":"Words","nav.mizan":"Two Lives","nav.about":"About","nav.kids":"Kids","nav.health":"Health",
  "health.ar":"الطِّبُّ النَّبَوِيّ","health.title":"The Prophetic Pattern of Health","health.sub":"How he ﷺ ate, moved, slept, washed, fasted, and carried his heart: the authentic record on one side, what modern research keeps finding on the other. A portrait of a life, not a prescription.",
  "hero.kicker":"نُورٌ عَلَىٰ نُورٍ","hero.title":"Codex of Light",
  "hero.subtitle":"From the Throne over the water to the radiant faces looking at their Lord: an illuminated chronicle of creation, the prophets, the Seerah, and the end of time.",
  "hero.cta.enter":"Enter the Path","hero.cta.characters":"Characters","hero.cta.kids":"✦ Little Codex",
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
  "about.dedication":"This Codex is offered as sadaqah jariyah, an ongoing gift, in honor of my beautiful wife: a daughter of Afghan lands, heir of the lantern cities of Balkh and Herat, where knowledge was kept alight for centuries. She will recognize herself. Whatever light this work carries, may its reward reach her.",
  "guide.ask":"Unclear? Ask","guide.title":"A quiet guide","guide.hint":"Short answers from the sources, for this chapter only.","guide.placeholder":"Ask in your own words...","guide.send":"Ask","guide.fallback":"That question deserves better than a quick answer. The chapter above carries what the sources state; for anything beyond it, a trusted scholar or your local imam is the right door.","guide.close":"Close guide",
  "mizan.cta.jannah":"See the destination · Jannah","mizan.cta.words":"Carry words that last","mizan.cta.path":"Walk the Path again",
  "search.placeholder":"Search the Codex…","search.none":"No matches in the Codex",
  "modal.sequence":"Sequence","modal.order":"Order of Events","modal.shield":"The Shield · Protection",
  "modal.quran":"Qur'an","modal.hadith":"Hadith & Athar","modal.facts":"Facts","modal.lessons":"Ibrah · Lessons",
  "modal.connected":"Connected in the Path","modal.close":"Close","modal.tilawah":"Tilawah","modal.node":"Node",
  "modal.meaning":"Meaning","modal.whennow":"When the Ummah Says It",
  "about.text":"NOOR is an educational and contemplative Codex. Content from the Qur'an, authentic Hadith, and classical sources. Prophets and companions are represented by light and seals only, never faces. Not a source of legal rulings.",
  "footer.back":"← Back to the Path","footer.note":"Qur'an · authentic Hadith · classical sirah",
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
  "atlas.open":"Open"
};
const NOOR_I18N = {
  lang: localStorage.getItem("noor_lang") || "en",
  packs: { en: UI_EN },
  rtl: ["ar","ur","fa","he","ps","sd","ku"],
  t(k){ const p=this.packs[this.lang]||UI_EN; return p[k] ?? UI_EN[k] ?? k; },
  apply(){
    document.documentElement.lang = this.lang;
    document.documentElement.dir = this.rtl.includes(this.lang) ? "rtl" : "ltr";
    document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = this.t(el.getAttribute("data-i18n")); });
    document.querySelectorAll("[data-i18n-ph]").forEach(el => { el.placeholder = this.t(el.getAttribute("data-i18n-ph")); });
  },
  async setLang(code){
    this.lang = code; localStorage.setItem("noor_lang", code);
    if (code !== "en" && !this.packs[code]) {
      try {
        const r = await fetch(`i18n/${code}.json`, {cache:"force-cache"});
        if (r.ok) { const j = await r.json(); this.packs[code] = Object.assign({}, UI_EN, j.ui || j); }
        else toast(this.t("lang.fallback"));
      } catch (e) { toast(this.t("lang.fallback")); }
    }
    this.apply();
    if (window.NoorPage && NoorPage.rerender) NoorPage.rerender();
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
  if (REDUCED) { el.textContent = target; return; }
  const t0 = performance.now(), dur = ms || 1100;
  function tick(t){
    const p = Math.min(1, (t - t0) / dur), eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * eased);
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
