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

  function build() {
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
