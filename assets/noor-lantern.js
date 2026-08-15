/* ============================================================
   The Lantern · a small light, rationed on purpose
   ------------------------------------------------------------
   It asks the server whether it is lit before it draws anything,
   so a resting lamp is never offered to a reader and then found
   to be cold. It shows how many questions are left, because a
   ration a person can see is a ration they can spend well, and
   an invisible one just feels like a failure when it runs out.

   Add it to a page with:
     <script src="/assets/noor-lantern.js" defer></script>
   and, for a licensed masjid, put its key on the tag:
     <script src="/assets/noor-lantern.js" data-key="..." defer>
   ============================================================ */
(function () {
  "use strict";
  var TAG = document.currentScript;
  var KEY = (TAG && TAG.getAttribute("data-key")) || "";
  try { KEY = KEY || localStorage.getItem("noor_lic_key") || ""; } catch (e) {}
  var state = { cap: 0, left: 0, open: false, busy: false, history: [] };
  var el = {};

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  /* the answers name rooms as paths; make those clickable and nothing else */
  function linkRooms(s) {
    return esc(s).replace(/(^|[\s(])\/([a-z][a-z0-9-]*(?:\/[a-z0-9-]+)?)/g,
      function (m, pre, path) { return pre + '<a href="/' + path + '">/' + path + "</a>"; });
  }

  function post(payload) {
    return fetch("/api/ask", {
      method: "POST", headers: { "Content-Type": "application/json" },
      credentials: "same-origin", body: JSON.stringify(payload)
    }).then(function (r) { return r.json().then(function (j) { return { code: r.status, j: j }; }); });
  }

  /* ---- the lamp carries its own light -------------------------------
     These rules also live in assets/noor-rtl.css, but a stylesheet is a
     separate request with its own cache. When the Lantern rules were
     added to that file its ?v= query was not bumped, so browsers and the
     CDN went on serving the older copy: the script arrived, drew its
     button and panel, and found no styles at all. The panel then sat
     open in the page flow at the foot of every masjid tool.

     A widget that builds its own DOM should carry its own appearance.
     These are injected only if the sheet did not arrive, so the stylesheet
     stays authoritative whenever it is present. */
  var STYLE =
    "#lantern-open{position:fixed;inset-inline-end:1rem;inset-block-end:1rem;z-index:78;display:inline-flex;align-items:center;gap:.45rem;border:1px solid rgba(201,162,39,.5);background:linear-gradient(135deg,#C9A227,#E9C86A);color:#1A160F;border-radius:999px;padding:.6rem 1rem;font:inherit;font-size:.82rem;font-weight:800;cursor:pointer;box-shadow:0 10px 30px rgba(44,36,22,.22);transition:transform .18s,box-shadow .18s}" +
    "#lantern-open:hover{transform:translateY(-1px);box-shadow:0 14px 36px rgba(44,36,22,.28)}" +
    "#lantern-open.on{opacity:.55}" +
    "#lantern-open .lm-fl{font-size:.95rem}" +
    "#lantern-open .lm-n{font-size:.66rem;font-weight:800;background:rgba(26,22,15,.18);border-radius:999px;padding:.1rem .38rem;min-width:1rem;text-align:center}" +
    "#lantern-open .lm-n:empty{display:none}" +
    "@media (max-width:520px){#lantern-open .lm-tx{display:none}}" +
    "#lantern-panel{position:fixed;inset-inline-end:1rem;inset-block-end:4.4rem;z-index:79;width:min(23rem,calc(100vw - 2rem));background:#FFFEF7;border:1px solid rgba(44,36,22,.14);border-radius:18px;box-shadow:0 26px 64px rgba(44,36,22,.3);display:none;overflow:hidden}" +
    "#lantern-panel.on{display:block}" +
    "#lantern-panel .lm-top{display:flex;align-items:center;gap:.5rem;padding:.7rem .9rem;border-bottom:1px solid rgba(44,36,22,.1);background:linear-gradient(170deg,#FFFCEF,#FFF6DB)}" +
    "#lantern-panel .lm-top b{font-size:.9rem;font-weight:800;color:#2C2416}" +
    "#lantern-panel .lm-sub{font-size:.66rem;color:rgba(44,36,22,.5);font-weight:700}" +
    "#lantern-panel .lm-x{margin-inline-start:auto;border:0;background:none;font-size:1.2rem;line-height:1;color:rgba(44,36,22,.4);cursor:pointer}" +
    "#lantern-panel .lm-log{max-height:min(46vh,24rem);overflow:auto;padding:.7rem .9rem;display:grid;gap:.55rem}" +
    "#lantern-panel .lm-hi{font-size:.79rem;line-height:1.75;color:rgba(44,36,22,.55);margin:0}" +
    "#lantern-panel .lm-msg{font-size:.83rem;line-height:1.8;border-radius:13px;padding:.5rem .7rem}" +
    "#lantern-panel .lm-you{background:rgba(201,162,39,.14);color:#2C2416;justify-self:end;max-width:88%}" +
    "#lantern-panel .lm-lamp{background:#fff;border:1px solid rgba(44,36,22,.1);color:rgba(44,36,22,.85)}" +
    "#lantern-panel .lm-lamp a{color:#8a6d13;font-weight:700}" +
    "#lantern-panel .lm-out{border-color:rgba(143,45,45,.3);background:#fffafa;color:#8f2d2d}" +
    "#lantern-panel .lm-wait{opacity:.5}" +
    "#lantern-panel .lm-ask{display:flex;gap:.4rem;padding:.6rem .7rem;border-top:1px solid rgba(44,36,22,.1)}" +
    "#lantern-panel .lm-ask input{flex:1;min-width:0;border:1px solid rgba(44,36,22,.16);border-radius:11px;padding:.5rem .65rem;font:inherit;font-size:.85rem;outline:0}" +
    "#lantern-panel .lm-ask input:focus{border-color:rgba(201,162,39,.75);box-shadow:0 0 0 3px rgba(201,162,39,.15)}" +
    "#lantern-panel .lm-ask button{flex:none;border:0;border-radius:11px;padding:.5rem .85rem;font:inherit;font-size:.8rem;font-weight:800;background:linear-gradient(135deg,#C9A227,#E9C86A);color:#1A160F;cursor:pointer}" +
    "#lantern-panel .lm-ask button:disabled{opacity:.5;cursor:default}" +
    "@media print{#lantern-open,#lantern-panel{display:none!important}}";

  function haveSheet() {
    for (var i = 0; i < document.styleSheets.length; i++) {
      var sh = document.styleSheets[i], rules;
      try { rules = sh.cssRules; } catch (e) { continue; }   /* cross origin */
      if (!rules) continue;
      for (var k = 0; k < rules.length; k++) {
        if (rules[k].selectorText && rules[k].selectorText.indexOf("#lantern-panel") === 0) return true;
      }
    }
    return false;
  }
  function ensureStyle() {
    if (document.getElementById("lantern-css") || haveSheet()) return;
    var st = document.createElement("style");
    st.id = "lantern-css"; st.textContent = STYLE;
    document.head.appendChild(st);
  }

  function build() {
    ensureStyle();
    var b = document.createElement("button");
    b.id = "lantern-open"; b.type = "button";
    b.setAttribute("aria-label", "Ask the Lantern");
    b.innerHTML = '<span class="lm-fl" aria-hidden="true">✦</span><span class="lm-tx">Ask the Lantern</span>' +
      '<span class="lm-n" id="lantern-left"></span>';
    document.body.appendChild(b);
    var p = document.createElement("div");
    p.id = "lantern-panel"; p.setAttribute("role", "dialog"); p.setAttribute("aria-label", "The Lantern");
    p.innerHTML =
      '<div class="lm-top"><b>The Lantern</b>' +
      '<span class="lm-sub" id="lm-sub"></span>' +
      '<button type="button" class="lm-x" aria-label="Close">×</button></div>' +
      '<div class="lm-log" id="lm-log"><p class="lm-hi">Ask about a word, a rite, a room of this library, or where to begin. ' +
      'Short questions get the best answers, and every answer points at the room that covers it.</p></div>' +
      '<form class="lm-ask" id="lm-form"><input id="lm-q" maxlength="600" autocomplete="off" ' +
      'placeholder="What is qadr? How do I perform ruqya?" aria-label="Your question"/>' +
      '<button type="submit" id="lm-go">Ask</button></form>';
    document.body.appendChild(p);
    el.btn = b; el.panel = p; el.log = p.querySelector("#lm-log");
    el.q = p.querySelector("#lm-q"); el.go = p.querySelector("#lm-go");
    el.sub = p.querySelector("#lm-sub"); el.left = b.querySelector("#lantern-left");
    b.addEventListener("click", toggle);
    p.querySelector(".lm-x").addEventListener("click", toggle);
    p.querySelector("#lm-form").addEventListener("submit", send);
    addEventListener("keydown", function (e) { if (e.key === "Escape" && state.open) toggle(); });
  }

  function paint() {
    el.left.textContent = state.left > 0 ? state.left : "";
    el.sub.textContent = state.left > 0
      ? (state.left + " of " + state.cap + " left today")
      : "rested until tomorrow";
  }
  function toggle() {
    state.open = !state.open;
    el.panel.classList.toggle("on", state.open);
    el.btn.classList.toggle("on", state.open);
    if (state.open) setTimeout(function () { el.q.focus(); }, 40);
  }
  function say(who, text, cls) {
    var d = document.createElement("div");
    d.className = "lm-msg lm-" + who + (cls ? " " + cls : "");
    d.innerHTML = who === "you" ? esc(text) : linkRooms(text);
    el.log.appendChild(d);
    el.log.scrollTop = el.log.scrollHeight;
    return d;
  }

  function send(e) {
    e.preventDefault();
    if (state.busy) return;
    var q = el.q.value.trim();
    if (q.length < 3) return;
    if (state.left <= 0) {
      say("lamp", "You have used the Lantern's light for today. The rooms themselves have no limit, and /dictionary answers most questions on its own.", "lm-out");
      return;
    }
    say("you", q);
    el.q.value = ""; state.busy = true; el.go.disabled = true;
    var wait = say("lamp", "…", "lm-wait");
    post({ q: q, key: KEY, history: state.history.slice(-2) }).then(function (r) {
      wait.remove(); state.busy = false; el.go.disabled = false;
      if (r.code === 200 && r.j.answer) {
        say("lamp", r.j.answer);
        state.history.push({ q: q, a: r.j.answer });
        state.left = r.j.left; state.cap = r.j.cap || state.cap;
      } else if (r.code === 429) {
        say("lamp", (r.j.error || "") + " " + (r.j.note || ""), "lm-out");
        state.left = 0;
      } else {
        say("lamp", r.j.error || "The Lantern could not answer just now.", "lm-out");
        if (typeof r.j.left === "number") state.left = r.j.left;
      }
      paint();
    }).catch(function () {
      wait.remove(); state.busy = false; el.go.disabled = false;
      say("lamp", "The Lantern could not be reached. Your question was not counted.", "lm-out");
    });
  }

  /* never draw a lamp that is not lit */
  post({ probe: true, key: KEY }).then(function (r) {
    if (!r.j || !r.j.enabled) return;
    state.cap = r.j.cap || 0; state.left = typeof r.j.left === "number" ? r.j.left : state.cap;
    if (!state.cap) return;
    build(); paint();
  }).catch(function () {});
})();
