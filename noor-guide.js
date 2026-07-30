/* NOOR Guide: a quiet clarifier for sensitive chapters.
   Curated Q&A first (noor-guide-data.js); optional live answers via /api/guide
   when the site owner sets ANTHROPIC_API_KEY in Vercel. Self-contained: injects
   its own styles; attach() is a no-op for chapters with no guide topic. */
(function () {
  "use strict";
  const DATA = () => window.NOOR_GUIDE || { topics: {}, glossary: [] };
  const S = {
    ask: "Unclear? Ask",
    title: "A quiet guide",
    hint: "Short answers from the sources, for this chapter only.",
    placeholder: "Ask in your own words...",
    send: "Ask",
    fallback: "That question deserves better than a quick answer. The chapter above carries what the sources state; for anything beyond it, a trusted scholar or your local imam is the right door.",
    close: "Close guide"
  };
  const t = (k, fb) => {
    if (!(window.NOOR_I18N && NOOR_I18N.t)) return fb;
    const v = NOOR_I18N.t("guide." + k);
    return v && v !== "guide." + k ? v : fb;
  };

  const CSS = `
  .ng-pill{display:inline-flex;align-items:center;gap:.45rem;margin:1.4rem auto 0;padding:.45rem .95rem;border-radius:999px;border:1px solid rgba(201,162,39,.45);background:rgba(201,162,39,.07);color:#8a6d1a;font-size:.78rem;font-weight:600;cursor:pointer;transition:background .25s,transform .25s}
  .ng-pill:hover{background:rgba(201,162,39,.14);transform:translateY(-1px)}
  .ng-pill .q{font-family:Amiri,serif;font-weight:700;font-size:.95rem;width:1.35rem;height:1.35rem;border-radius:50%;background:#C9A227;color:#FFFEF7;display:inline-flex;align-items:center;justify-content:center}
  .ng-wrap{text-align:center}
  .ng-sheet{margin-top:1rem;border:1px solid rgba(201,162,39,.35);border-radius:18px;background:linear-gradient(170deg,#FFFDF4,#FAF3DE);padding:1.1rem 1.1rem 1.2rem;text-align:start;box-shadow:0 12px 34px rgba(44,36,22,.10);animation:ngIn .35s cubic-bezier(.22,1,.36,1)}
  @keyframes ngIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
  .ng-head{display:flex;align-items:baseline;justify-content:space-between;gap:.6rem;margin-bottom:.15rem}
  .ng-title{font-weight:700;color:#2C2416;font-size:.92rem}
  .ng-hint{font-size:.72rem;color:rgba(44,36,22,.55);margin-bottom:.8rem}
  .ng-x{border:none;background:none;color:rgba(44,36,22,.45);font-size:1.05rem;cursor:pointer;line-height:1;padding:.2rem}
  .ng-x:hover{color:#2C2416}
  .ng-chips{display:flex;flex-wrap:wrap;gap:.45rem;margin-bottom:.35rem}
  .ng-chip{border:1px solid rgba(44,36,22,.16);background:#FFFEF7;border-radius:999px;padding:.4rem .8rem;font-size:.74rem;color:rgba(44,36,22,.8);cursor:pointer;transition:border-color .2s,background .2s;text-align:start}
  .ng-chip:hover{border-color:#C9A227;background:rgba(201,162,39,.07)}
  .ng-chip[disabled]{opacity:.45;cursor:default}
  .ng-a{margin:.65rem 0 .8rem;padding:.75rem .9rem;border-inline-start:2px solid #C9A227;background:rgba(201,162,39,.06);border-radius:0 12px 12px 0;font-size:.8rem;line-height:1.7;color:#2C2416;animation:ngIn .3s cubic-bezier(.22,1,.36,1)}
  .ng-a .ng-q{display:block;font-weight:700;font-size:.74rem;color:#8a6d1a;margin-bottom:.25rem}
  .ng-form{display:flex;gap:.5rem;margin-top:.6rem}
  .ng-in{flex:1;border:1px solid rgba(44,36,22,.18);border-radius:999px;padding:.5rem .95rem;font-size:.78rem;background:#FFFEF7;color:#2C2416;outline:none;min-width:0}
  .ng-in:focus{border-color:#C9A227;box-shadow:0 0 0 3px rgba(201,162,39,.15)}
  .ng-go{border:none;border-radius:999px;padding:.5rem 1.05rem;font-size:.76rem;font-weight:700;background:linear-gradient(135deg,#C9A227,#E9C86A);color:#1A160F;cursor:pointer}
  .ng-go:hover{filter:brightness(1.05)}
  .ng-think{display:inline-block;margin:.5rem 0 0 .2rem;color:rgba(44,36,22,.5);font-size:.75rem;animation:ngPulse 1.1s ease-in-out infinite}
  @keyframes ngPulse{0%,100%{opacity:.4}50%{opacity:1}}
  @media (prefers-reduced-motion: reduce){.ng-sheet,.ng-a{animation:none}}`;

  let styled = false;
  const ensureStyle = () => {
    if (styled) return; styled = true;
    const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
  };

  const STOP = new Set("the a an of in on at is are was were be been do does did what why how when who will would can could i you he she it we they my your his her its this that these those and or but not no yes to for with from about into if then than as by said says say".split(" "));
  const tokens = s => String(s).toLowerCase().replace(/[^a-z0-9'؀-ۿ ]+/g, " ").split(/\s+/).filter(w => w && !STOP.has(w));

  function localAnswer(topic, query) {
    const qt = tokens(query);
    if (!qt.length) return null;
    let best = null, bestScore = 0;
    for (const item of (topic ? topic.qa : [])) {
      const bag = new Set(tokens(item.q + " " + item.a));
      let s = 0; for (const w of qt) if (bag.has(w)) s++;
      const cov = s / qt.length;
      if (s >= 2 && cov > bestScore) { bestScore = cov; best = item; }
    }
    if (best && bestScore >= 0.34) return { q: best.q, a: best.a };
    // glossary: a known term inside the question
    const ql = " " + String(query).toLowerCase() + " ";
    for (const g of DATA().glossary) {
      const names = [g.term, ...(g.aliases || [])];
      if (names.some(n => ql.includes(" " + String(n).toLowerCase() + " ") || ql.includes(" " + String(n).toLowerCase() + "?"))) {
        return { q: g.term, a: g.def };
      }
    }
    return null;
  }

  let apiAlive = null; // unknown until first try
  async function apiAnswer(query, title, excerpt) {
    if (apiAlive === false) return null;
    try {
      const r = await fetch("/api/guide", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: query.slice(0, 400), title, excerpt: excerpt.slice(0, 5000) })
      });
      if (!r.ok) { apiAlive = false; return null; }
      const j = await r.json();
      apiAlive = true;
      return j && j.answer ? { q: query, a: j.answer } : null;
    } catch { apiAlive = false; return null; }
  }

  function attach(container, key, title) {
    const topic = DATA().topics[key];
    if (!topic || !container || container.querySelector(".ng-wrap")) return;
    ensureStyle();
    const wrap = document.createElement("div");
    wrap.className = "ng-wrap";
    wrap.innerHTML = `<button class="ng-pill" type="button"><span class="q">؟</span><span>${t("ask", S.ask)}</span></button>`;
    container.appendChild(wrap);
    const pill = wrap.querySelector(".ng-pill");
    pill.addEventListener("click", () => {
      pill.style.display = "none";
      const sheet = document.createElement("div");
      sheet.className = "ng-sheet";
      sheet.innerHTML = `
        <div class="ng-head"><span class="ng-title">${t("title", S.title)}</span>
        <button class="ng-x" type="button" aria-label="${t("close", S.close)}">✕</button></div>
        <div class="ng-hint">${topic.intro || t("hint", S.hint)}</div>
        <div class="ng-chips">${topic.qa.map((x, i) => `<button class="ng-chip" type="button" data-i="${i}">${x.q}</button>`).join("")}</div>
        <div class="ng-out"></div>
        <form class="ng-form"><input class="ng-in" type="text" maxlength="200" placeholder="${t("placeholder", S.placeholder)}" aria-label="${t("placeholder", S.placeholder)}"><button class="ng-go" type="submit">${t("send", S.send)}</button></form>`;
      wrap.appendChild(sheet);
      const out = sheet.querySelector(".ng-out");
      const show = (q, a) => {
        const d = document.createElement("div");
        d.className = "ng-a";
        d.innerHTML = `<span class="ng-q"></span>`;
        d.querySelector(".ng-q").textContent = q;
        d.appendChild(document.createTextNode(a));
        out.innerHTML = ""; out.appendChild(d);
        d.scrollIntoView({ block: "nearest", behavior: "smooth" });
      };
      sheet.querySelector(".ng-x").addEventListener("click", () => { sheet.remove(); pill.style.display = ""; });
      sheet.querySelectorAll(".ng-chip").forEach(ch => ch.addEventListener("click", () => {
        const item = topic.qa[+ch.dataset.i]; show(item.q, item.a);
      }));
      sheet.querySelector(".ng-form").addEventListener("submit", async e => {
        e.preventDefault();
        const inp = sheet.querySelector(".ng-in");
        const q = inp.value.trim(); if (!q) return;
        inp.value = "";
        const local = localAnswer(topic, q);
        if (local) return show(local.q, local.a);
        // try live API if the owner enabled it; else honest fallback
        const think = document.createElement("span"); think.className = "ng-think"; think.textContent = "…";
        out.innerHTML = ""; out.appendChild(think);
        const excerpt = (container.innerText || "").slice(0, 6000);
        const live = await apiAnswer(q, title || "", excerpt);
        if (live) return show(q, live.a);
        show(q, t("fallback", S.fallback));
      });
    });
  }

  window.NoorGuide = { attach };
})();
