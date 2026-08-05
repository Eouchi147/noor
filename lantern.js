/* The Lantern · NOOR's resident guide, floating on every room.
   A small golden lamp in the corner; tap it and ask anything about Islam.
   Answers come from /api/ask, held to the Codex's standards (Qur'an,
   authenticated hadith, no fatwas, warmth). Conversation stays on this
   device only (sessionStorage) and is sent nowhere except our own API. */
(function () {
  "use strict";
  var path = location.pathname;
  if (/(^|\/)(admin|ask)(\.html)?$/.test(path)) return;

  var HKEY = "noor_lantern_hist";
  function hist() { try { return JSON.parse(sessionStorage.getItem(HKEY) || "[]"); } catch (e) { return []; } }
  function saveHist(h) { try { sessionStorage.setItem(HKEY, JSON.stringify(h.slice(-12))); } catch (e) {} }

  function esc(x) { return String(x || "").replace(/[<>&"]/g, function (c) { return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]; }); }
  function md(x) {
    var s = esc(x);
    s = s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
    s = s.replace(/\[([^\]]+)\]\((\/[a-z0-9\-\/\.]*|https?:\/\/[^\s)]+)\)/gi, '<a href="$2" style="color:#8a6d13;font-weight:600">$1</a>');
    return s.split(/\n\n+/).map(function (p) { return "<p style='margin:.45em 0'>" + p.replace(/\n/g, "<br/>") + "</p>"; }).join("");
  }

  var css = [
    "#noor-lantern-btn{position:fixed;right:1.05rem;bottom:1.05rem;z-index:80;width:54px;height:54px;border-radius:999px;border:1.5px solid rgba(233,200,106,.65);background:linear-gradient(160deg,#0B1230,#17224e);color:#E9C86A;font-size:1.45rem;cursor:pointer;box-shadow:0 6px 24px rgba(11,18,48,.45),0 0 18px rgba(233,200,106,.35);display:grid;place-items:center;transition:transform .2s}",
    "#noor-lantern-btn:hover{transform:translateY(-2px) scale(1.04)}",
    "#noor-lantern{position:fixed;right:1rem;bottom:5.4rem;z-index:81;width:min(24rem,calc(100vw - 2rem));max-height:min(34rem,calc(100dvh - 7.5rem));display:flex;flex-direction:column;background:#FFFEF7;border:1px solid rgba(201,162,39,.45);border-radius:18px;box-shadow:0 24px 60px rgba(11,18,48,.35);overflow:hidden;font-family:Inter,system-ui,sans-serif}",
    "#noor-lantern .lt-head{display:flex;align-items:center;gap:.55rem;padding:.7rem .95rem;background:linear-gradient(160deg,#0B1230,#17224e);color:#FFFEF7}",
    "#noor-lantern .lt-head b{font-size:.86rem}",
    "#noor-lantern .lt-head small{display:block;font-size:.62rem;color:rgba(255,254,247,.55)}",
    "#noor-lantern .lt-x{margin-left:auto;background:none;border:0;color:rgba(255,254,247,.6);font-size:1rem;cursor:pointer;padding:.2rem}",
    "#noor-lantern .lt-msgs{flex:1;overflow-y:auto;padding:.8rem .95rem;font-size:.8rem;line-height:1.65;color:#2C2416;min-height:8rem}",
    "#noor-lantern .lt-m{margin:.45rem 0;max-width:92%}",
    "#noor-lantern .lt-m.you{margin-left:auto;background:rgba(201,162,39,.13);border:1px solid rgba(201,162,39,.3);border-radius:14px 14px 4px 14px;padding:.5rem .7rem}",
    "#noor-lantern .lt-m.lamp{background:#fff;border:1px solid rgba(44,36,22,.08);border-radius:14px 14px 14px 4px;padding:.5rem .7rem;box-shadow:0 2px 8px rgba(44,36,22,.05)}",
    "#noor-lantern .lt-chips{display:flex;flex-wrap:wrap;gap:.4rem;padding:0 .95rem .5rem}",
    "#noor-lantern .lt-chip{border:1px solid rgba(201,162,39,.45);background:#FFFDF0;color:#6b5510;border-radius:999px;padding:.32rem .7rem;font-size:.68rem;font-weight:600;cursor:pointer}",
    "#noor-lantern .lt-in{display:flex;gap:.5rem;padding:.65rem .8rem;border-top:1px solid rgba(44,36,22,.08);background:#FFFDF6}",
    "#noor-lantern .lt-in input{flex:1;border:1.5px solid rgba(44,36,22,.18);border-radius:999px;padding:.5rem .85rem;font-size:16px;background:#fff;color:#2C2416;outline:none}",
    "#noor-lantern .lt-in input:focus{border-color:#C9A227}",
    "#noor-lantern .lt-in button{border:0;border-radius:999px;width:40px;height:40px;background:linear-gradient(135deg,#C9A227,#E9C86A);color:#1A160F;font-size:1rem;cursor:pointer;font-weight:800}",
    "#noor-lantern .lt-foot{font-size:.6rem;color:rgba(44,36,22,.45);text-align:center;padding:.35rem .8rem .55rem;background:#FFFDF6}",
    "@media (max-width:480px){#noor-lantern{right:.5rem;bottom:5rem}}"
  ].join("\n");

  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  var btn = document.createElement("button");
  btn.id = "noor-lantern-btn";
  btn.type = "button";
  btn.setAttribute("aria-label", "Ask the Lantern, NOOR's guide");
  btn.title = "Ask the Lantern";
  btn.innerHTML = "✦";
  document.body.appendChild(btn);

  var panel = null, msgs = null, input = null, busy = false;

  function addMsg(role, html) {
    var d = document.createElement("div");
    d.className = "lt-m " + (role === "you" ? "you" : "lamp");
    d.innerHTML = html;
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
    return d;
  }

  function buildPanel() {
    panel = document.createElement("div");
    panel.id = "noor-lantern";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "The Lantern, ask about Islam");
    panel.innerHTML =
      '<div class="lt-head"><span style="font-size:1.15rem;color:#E9C86A">✦</span><span><b>The Lantern</b><small>NOOR’s guide · Qur’an and authentic hadith · a guide, not a mufti</small></span><button class="lt-x" aria-label="Close">✕</button></div>' +
      '<div class="lt-msgs"></div>' +
      '<div class="lt-chips"></div>' +
      '<div class="lt-in"><input type="text" maxlength="700" placeholder="Ask anything about Islam…" aria-label="Your question"/><button aria-label="Send">↑</button></div>' +
      '<div class="lt-foot">The Lantern can err · for personal rulings ask a qualified scholar · full room: <a href="/ask.html" style="color:#8a6d13">Ask the Lantern</a></div>';
    document.body.appendChild(panel);
    msgs = panel.querySelector(".lt-msgs");
    input = panel.querySelector(".lt-in input");
    panel.querySelector(".lt-x").addEventListener("click", toggle);
    panel.querySelector(".lt-in button").addEventListener("click", send);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") send(); });

    var h = hist();
    if (h.length) {
      h.forEach(function (m) { addMsg(m.role === "assistant" ? "lamp" : "you", md(m.content)); });
    } else {
      addMsg("lamp", md("Peace be upon you. I am the Lantern, this library's guide. Ask me anything about Islam: a verse, a ruling's background, a prophet's story, how to begin practicing. I answer from the Qur'an and authenticated hadith, and I will always tell you when a question belongs with a scholar."));
      var chips = panel.querySelector(".lt-chips");
      ["What are the five pillars?", "How do I start praying?", "What is the Qur'an?"].forEach(function (q) {
        var c = document.createElement("button");
        c.className = "lt-chip"; c.type = "button"; c.textContent = q;
        c.addEventListener("click", function () { input.value = q; send(); });
        chips.appendChild(c);
      });
    }
  }

  function send() {
    if (busy) return;
    var q = (input.value || "").trim();
    if (!q) return;
    input.value = "";
    var chips = panel.querySelector(".lt-chips"); if (chips) chips.innerHTML = "";
    addMsg("you", md(q));
    var h = hist(); h.push({ role: "user", content: q }); saveHist(h);
    var wait = addMsg("lamp", "<span style='color:rgba(44,36,22,.45)'>✦ the Lantern is thinking…</span>");
    busy = true;
    fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q, history: h.slice(0, -1) }) })
      .then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
      .then(function (o) {
        busy = false;
        var a = (o.j && o.j.answer) || (o.j && o.j.error) || "The Lantern flickered. Try again in a moment.";
        wait.innerHTML = md(a);
        msgs.scrollTop = msgs.scrollHeight;
        if (o.j && o.j.answer) { var h2 = hist(); h2.push({ role: "assistant", content: o.j.answer }); saveHist(h2); }
      })
      .catch(function () { busy = false; wait.innerHTML = md("The Lantern flickered. Try again in a moment."); });
  }

  function toggle() {
    if (!panel) { buildPanel(); input.focus(); return; }
    panel.hidden = !panel.hidden;
    if (!panel.hidden) input.focus();
  }
  btn.addEventListener("click", toggle);
})();
