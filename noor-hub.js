/* NOOR hub renderer: one engine for Characters, Places, and Words pages.
   Page provides window.NOOR_HUB = {
     data()          -> the data object (sections as keys)
     type            -> 'char' | 'place' | 'word'  (own entity type; links of this type open locally)
     sections        -> [{key, chip, gate, ar, tk, dk, smallSeal?, extraHeader?}]
     glyph(entry)    -> seal text (default: first word of titleAr)
   } */
document.addEventListener("DOMContentLoaded", () => {
"use strict";
const $ = id => document.getElementById(id);
const HUB = window.NOOR_HUB;
const DATA = HUB.data();
const SECTIONS = HUB.sections;
let lastFocus = null;

const glyph = HUB.glyph || (c => (c.titleAr || "·").split(" ")[0]);

function renderAll(){
  $("section-nav-links").innerHTML = SECTIONS.map(s =>
    `<a href="#${s.key}" class="px-3 py-1.5 rounded-full border border-ink/12 text-ink/60 hover:text-ink">${t(s.tk)} · ${(DATA[s.key]||[]).length}</a>`).join("");
  const stats = $("chero-stats");
  if (stats) stats.innerHTML = SECTIONS.map(s =>
    `<span class="px-3 py-1 rounded-full border border-parchment/20 bg-parchment/5">${t(s.tk)} <b class="text-gold">${(DATA[s.key]||[]).length}</b></span>`).join("");
  $("hub-main").innerHTML = SECTIONS.map(s => {
    const list = DATA[s.key]||[];
    return `
    <section id="${s.key}">
      <div class="sgate ${s.gate} reveal mb-7">
        <div class="flex flex-wrap items-end justify-between gap-3 relative z-10">
          <div>
            <div class="font-amiri text-3xl text-gold mb-0.5">${s.ar}</div>
            <div class="font-semibold text-parchment">${t(s.tk)}</div>
            <div class="text-parchment/60 text-xs mt-0.5 max-w-lg">${t(s.dk)}</div>
          </div>
          <div class="flex items-center gap-2">
            ${s.extraHeader||""}
            <span class="px-3 py-1 rounded-full text-xs font-semibold bg-parchment/10 border border-parchment/25">${list.length}</span>
          </div>
        </div>
      </div>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-7">
        ${list.map((c,i)=>`
        <article class="tile reveal" style="--d:${(i%9)*50}ms" data-key="${s.key}" data-id="${c.id}" role="button" tabindex="0" aria-label="${c.titleEn}">
          <div class="tile-inner">
            <div class="tile-bg ${c.pattern||""}"></div>
            <div class="tile-seal ${s.smallSeal?"seal-sm":""}"><span>${s.smallSeal?(c.titleAr||""):glyph(c)}</span></div>
            <div class="tile-overlay"></div>
            <div class="tile-frame"></div>
            <div class="tile-shine"></div>
            <div class="tile-content">
              <span class="chip ${s.chip} mb-1.5 self-start">${t(s.tk)}</span>
              <h3 class="font-semibold text-[15px] leading-snug">${c.titleEn}</h3>
              ${c.translit?`<p class="text-[11px] text-gold/90 font-semibold mt-0.5">${c.translit}</p>`:`<p class="font-amiri text-sm opacity-90">${c.titleAr||""}</p>`}
              <p class="text-[11px] opacity-70 mt-0.5">${c.role||""}</p>
              <p class="text-xs opacity-70 mt-1 line-clamp-2">${c.summary||""}</p>
            </div>
          </div>
        </article>`).join("")}
      </div>
    </section>`;
  }).join("");
  $("hub-main").querySelectorAll(".tile").forEach(tl => {
    const open = () => openEntry(tl.dataset.key, tl.dataset.id);
    tl.addEventListener("click", open);
    tl.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  });
  NoorFX.initReveal($("hub-main")); NoorFX.initTilt($("hub-main"));
}

function sect(title, inner){ return `<div class="mset mt-6"><h3 class="sect-h"><span class="g">۞</span>${title}</h3>${inner}</div>`; }

function openEntry(key, id){
  const s = SECTIONS.find(x => x.key === key);
  const c = (DATA[key]||[]).find(x => x.id === id);
  if (!c) return;
  lastFocus = document.activeElement;
  const hero = $("modal-hero"), body = $("modal-body");
  hero.className = "modal-hero " + (s.smallSeal ? "tall " : "") + (c.pattern||"");
  hero.innerHTML = `
    <div class="modal-seal ${s.smallSeal?"seal-sm":""}"><span>${s.smallSeal?(c.titleAr||""):glyph(c)}</span></div>
    <div class="absolute inset-0 bg-gradient-to-t from-black/78 to-transparent"></div>
    <div class="absolute bottom-0 p-4 text-parchment">
      <span class="chip ${s.chip} mb-1">${t(s.tk)}</span>
      <h2 class="text-xl font-bold leading-tight">${c.titleEn}</h2>
      <p class="font-amiri opacity-90">${s.smallSeal?"":(c.titleAr||"")}</p>
    </div>`;

  const detailsTxt = c.details || c.summary || "";
  const dropCls = /^["“”«']/.test(detailsTxt.trim()) ? "" : " drop-cap";
  let html = "";
  if (c.translit || c.meaning) html += `<div class="mset">
    <div class="word-ar" dir="rtl">${c.titleAr||""}</div>
    ${c.translit?`<div class="word-translit">${c.translit}</div>`:""}
    ${c.meaning?`<div class="word-meaning">“${c.meaning}”</div>`:""}</div>`;
  html += `<div class="mset ${(c.translit||c.meaning)?"mt-6":""}">
    <p class="text-xs font-semibold text-gold/90 uppercase tracking-wider mb-2.5">${c.role||""}</p>
    <div class="modal-prose${dropCls}">${linkify(detailsTxt)}</div></div>`;
  if (c.whenNow && c.whenNow.length) html += sect(t("words.saidnow"),
    `<ul class="whennow">${c.whenNow.map(x=>`<li><span class="s">✦</span><span>${linkify(x)}</span></li>`).join("")}</ul>`);
  if (c.facts && c.facts.length) html += sect(t("modal.facts"),
    `<div class="facts-grid">${c.facts.map(f=>`<div class="fact-item"><div class="text-[10px] uppercase tracking-wide text-ink/40 mb-0.5">${f.label}</div><div class="text-sm font-semibold text-ink leading-snug">${f.value}</div></div>`).join("")}</div>`);
  if (c.quran && c.quran.length) html += sect(t("modal.quran"),
    c.quran.map(q=>`<div class="quran-card">
      <div class="flex items-start justify-between gap-2 mb-2">
        <span class="text-xs font-bold text-gold pt-1">${q.ref}</span>
        <button class="audio-btn" data-ref="${q.ref}"><svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>${t("modal.tilawah")}</button>
      </div>
      ${q.ar?`<p class="font-amiri text-lg text-ink leading-loose text-right mb-2" dir="rtl">${q.ar}</p>`:""}
      ${q.en?`<p class="text-sm text-ink/70 leading-relaxed">${q.en}</p>`:""}
    </div>`).join(""));
  if (c.hadith && c.hadith.length) html += sect(t("modal.hadith"),
    c.hadith.map(h=>{
      const txt = typeof h === "object" ? h.text : h, src = typeof h === "object" ? h.source : "";
      return `<div class="hadith-item">${linkify(txt)}${src?`<br><span class="hadith-src">${src}</span>`:""}</div>`;
    }).join(""));
  html += `<div class="mset mt-7 pt-4 border-t border-ink/8 flex items-center justify-end">
    <button id="modal-close-2" class="text-gold text-sm font-semibold hover:underline">${t("modal.close")}</button></div>`;
  body.innerHTML = html;

  body.querySelectorAll(".audio-btn").forEach(b => b.onclick = () => playAyah(b.dataset.ref, b));
  const c2 = $("modal-close-2"); if (c2) c2.onclick = closeModal;
  const handlers = {}; handlers[HUB.type] = eid => openFromId(eid);
  bindEntityLinks(body, handlers);

  $("modal-backdrop").classList.add("open");
  $("modal-backdrop").scrollTop = 0;
  document.body.style.overflow = "hidden";
  history.replaceState(null, "", "?open=" + encodeURIComponent(id));
  setTimeout(() => $("modal-close").focus({preventScroll:true}), 60);
}
function openFromId(id){
  for (const k of Object.keys(DATA)) if ((DATA[k]||[]).some(x => x.id === id)) return openEntry(k, id);
}
function closeModal(){
  $("modal-backdrop").classList.remove("open");
  document.body.style.overflow = "";
  stopAyah();
  history.replaceState(null, "", location.pathname);
  if (lastFocus && lastFocus.focus) lastFocus.focus({preventScroll:true});
}
$("modal-close").addEventListener("click", closeModal);
$("modal-backdrop").addEventListener("click", e => { if (e.target === e.currentTarget) closeModal(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

addEventListener("scroll", () => {
  $("site-header").classList.toggle("scrolled", scrollY > 8);
  let cur = SECTIONS[0].key;
  for (const s of SECTIONS) { const el = $(s.key); if (el && el.getBoundingClientRect().top < 170) cur = s.key; }
  document.querySelectorAll("#section-nav-links a").forEach(a => a.classList.toggle("active", a.getAttribute("href") === "#" + cur));
}, {passive:true});

const langSel = $("lang-switch");
if (langSel) { langSel.value = NOOR_I18N.lang; langSel.addEventListener("change", e => NOOR_I18N.setLang(e.target.value)); }
window.NoorPage = { rerender: renderAll };

NOOR_I18N.apply();
renderAll();
NoorFX.initProgress($("progress"));
NoorFX.initHeroCanvas($("chero-canvas"));

try {
  const sp = new URLSearchParams(location.search);
  const oid = sp.get("open");
  if (oid) setTimeout(() => openFromId(oid), 220);
  else if (location.hash) { const el = document.querySelector(location.hash); if (el) setTimeout(() => el.scrollIntoView({behavior:"smooth"}), 120); }
} catch (e) {}
});
