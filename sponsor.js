/* NOOR sponsor: one patron, configured here, zero rebuild needed.
   Set active:true and fill the fields; the seal renders in the About section.
   Keep the line short; the design stays understated by contract. */
var NOOR_SPONSOR = {
  active: false,
  name: "",                 // e.g. "Al-Amanah Foundation"
  url: "",                  // e.g. "https://example.org" (empty = not linked)
  line: ""                  // one short line, e.g. "Keeping the Codex free for every reader"
};
(function () {
  "use strict";
  function boot() {
    var slot = document.getElementById("sponsor-slot");
    if (!slot || !NOOR_SPONSOR.active || !NOOR_SPONSOR.name) return;
    var st = document.createElement("style");
    st.textContent = ".np-seal{margin:1.4rem auto 0;max-width:24rem;border:1px solid rgba(233,200,106,.35);background:linear-gradient(165deg,rgba(233,200,106,.08),rgba(233,200,106,.02));border-radius:14px;padding:.7rem .9rem;text-align:center}" +
      ".np-k{font-size:.58rem;letter-spacing:.26em;text-transform:uppercase;color:rgba(233,200,106,.75);font-weight:700}" +
      ".np-n{display:block;margin-top:.2rem;font-weight:700;font-size:.85rem;color:#F4E3A1;text-decoration:none}" +
      "a.np-n:hover{text-decoration:underline}" +
      ".np-l{display:block;margin-top:.15rem;font-size:.66rem;color:rgba(255,254,247,.5)}";
    document.head.appendChild(st);
    var name = NOOR_SPONSOR.url
      ? '<a class="np-n" href="' + NOOR_SPONSOR.url + '" rel="noopener sponsored" target="_blank">' + NOOR_SPONSOR.name + '</a>'
      : '<span class="np-n">' + NOOR_SPONSOR.name + '</span>';
    slot.innerHTML = '<div class="np-seal"><span class="np-k">☙ Guardian of this Codex ❧</span>' + name +
      (NOOR_SPONSOR.line ? '<span class="np-l">' + NOOR_SPONSOR.line + '</span>' : '') + '</div>';
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
