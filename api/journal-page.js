// One journal entry, rendered on the server.
//
// The index at /journal fetches its list in the browser, which is fine for a
// shelf. An individual entry must not: it needs a real title, a real
// description and real words in the HTML the moment a crawler or a messaging
// app asks for it, or the journal is invisible to search and looks empty when
// anyone shares a link. So this route builds the page whole, from the store,
// on request, and Vercel caches it at the edge for a minute.
//
// Reached through a rewrite in vercel.json: /journal/<slug> lands here.
import { kv, kvReady } from "./_kv.js";
import { render } from "./journal.js";

const SITE = "https://noorcodex.com";

const esc = s => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const slugify = s => String(s || "").toLowerCase()
  .replace(/[‘’']/g, "").replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "").slice(0, 70);

function page({ title, desc, canonical, body, status }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}"/>
<link rel="canonical" href="${esc(canonical)}"/>
<meta property="og:type" content="article"/>
<meta property="og:title" content="${esc(title)}"/>
<meta property="og:description" content="${esc(desc)}"/>
<meta property="og:url" content="${esc(canonical)}"/>
<meta property="og:site_name" content="NOOR Codex of Light"/>
<meta name="twitter:card" content="summary_large_image"/>
<link rel="icon" href="/assets/icon-192.png"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="stylesheet" href="/assets/journal.css?v=89"/>
<style>
  html,body{margin:0;background:#F5EEDC}
  .jtop{max-width:44rem;margin:0 auto;padding:1.1rem 1.15rem .2rem;display:flex;align-items:center;
    justify-content:space-between;gap:1rem;font-family:Inter,system-ui,sans-serif}
  .jtop a{text-decoration:none;color:#3A2E1C}
  .jtop .jmark{display:flex;align-items:center;gap:.55rem;font-size:.72rem;letter-spacing:.2em;
    text-transform:uppercase;font-weight:700;color:rgba(58,46,28,.6)}
  .jtop .jmark i{width:1.7rem;height:1.7rem;border-radius:50%;background:#2C2416;color:#F4D46A;
    display:grid;place-items:center;font-style:normal;font-family:Amiri,serif;font-size:.9rem}
  .jtop .jto{font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:#A9812B;font-weight:700}
  .jfooter{border-top:1px solid rgba(169,129,43,.25);margin-top:2.4rem;padding:1.6rem 1.15rem 2.6rem;text-align:center}
  .jfooter p{font-family:Inter,system-ui,sans-serif;font-size:.72rem;line-height:1.9;color:rgba(58,46,28,.5);margin:0}
  .jfooter a{color:rgba(58,46,28,.68)}
</style>
</head>
<body>
<div class="jwrap">
<div class="jtop">
  <a class="jmark" href="/"><i aria-hidden="true">&#1606;</i><span>Codex of Light</span></a>
  <a class="jto" href="/journal">The Journal</a>
</div>
${body}
<div class="jfooter">
  <p><a href="/journal">All entries</a> &middot; <a href="/">The Codex</a> &middot;
     <a href="/journal-rules">How replies are handled</a> &middot; <a href="/donate">Keep it lit</a></p>
  <p style="margin-top:.5rem">Opinion, offered openly. The teaching rooms of the Codex carry their evidence; this one carries a name.</p>
</div>
</div>
</body>
</html>`;
}

function notFound(res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(404).send(page({
    title: "That entry is not here · The Guardian's Journal",
    desc: "This journal entry could not be found.",
    canonical: SITE + "/journal",
    body: `<div class="jhead"><p class="jorn">The Guardian&rsquo;s Journal</p>
<h1>That entry is not here</h1>
<p class="jsub">It may have been renamed, or it may never have existed. The shelf itself is one step away.</p>
<p style="margin-top:1.2rem"><a href="/journal" style="color:#7A5B12">Open the journal &rarr;</a></p></div>`
  }));
}

export default async function handler(req, res) {
  const slug = slugify((req.query && req.query.slug) || "");
  if (!slug || !kvReady()) return notFound(res);

  let entry = null, comments = [];
  try {
    const id = (await kv([["GET", "nj:slug:" + slug]]))[0];
    if (!id) return notFound(res);
    const raw = (await kv([["GET", "nj:e:" + id]]))[0];
    if (!raw) return notFound(res);
    entry = JSON.parse(raw);
    if (entry.status !== "published") return notFound(res);
    const rows = (await kv([["LRANGE", "nj:c:" + id, "0", "400"]]))[0] || [];
    comments = rows.map(r => { try { return JSON.parse(r); } catch { return null; } })
      .filter(Boolean).filter(c => !c.held);
  } catch { return notFound(res); }

  const when = (() => {
    try { return new Date(entry.at).toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric" }); }
    catch { return String(entry.at || "").slice(0, 10); }
  })();
  const mins = Math.max(1, Math.round((entry.words || 0) / 220));
  const desc = entry.dek || String(entry.body || "").replace(/\s+/g, " ").slice(0, 180);

  const commentHtml = comments.length
    ? comments.map(c => `<div class="jc"><p class="jw"><b>${esc(c.name)}</b> &middot; ${esc(String(c.at || "").slice(0, 10))}</p><p>${esc(c.body)}</p></div>`).join("")
    : `<p class="jsay" style="margin-top:1.4rem">No replies yet. Yours would be the first.</p>`;

  const jsonld = {
    "@context": "https://schema.org", "@type": "BlogPosting",
    headline: entry.title, description: desc,
    datePublished: entry.at, dateModified: entry.edited || entry.at,
    url: SITE + "/journal/" + entry.slug,
    isPartOf: { "@type": "Blog", name: "The Guardian's Journal", url: SITE + "/journal" },
    publisher: { "@type": "Organization", name: "NOOR Codex of Light", url: SITE }
  };

  const body = `
<div class="jback"><a href="/journal">&larr; All entries</a></div>
<article class="jpage">
  <p class="jmeta">${esc(when)} &middot; ${mins} min</p>
  <h1>${esc(entry.title)}</h1>
  ${entry.dek ? `<p class="jdek">${esc(entry.dek)}</p>` : ""}
  <p style="text-align:center;margin:1.15rem 0 0">
    <span class="jseal"><i aria-hidden="true">&#1606;</i><span>One reader&rsquo;s opinion, not a ruling</span></span>
  </p>
  <div class="jbody">${render(entry.body)}</div>
  <p class="jend" aria-hidden="true">&#10022;</p>
</article>

<section class="jtalk">
  <h2>Replies</h2>
  <p class="jnote">Open to anyone, with no account and no login. Disagreement is welcome and is never removed for being disagreement. Only spam, scams and floods are held back, and a person looks at everything that is held.</p>
  <form class="jform" id="jf">
    <input id="jn" maxlength="40" placeholder="Your name, or leave it blank" autocomplete="off"/>
    <textarea id="jb" maxlength="4000" placeholder="Say what you think." required></textarea>
    <div class="jrow">
      <button class="jsend" type="submit">Send the reply</button>
      <span class="jsay" id="js"></span>
    </div>
  </form>
  <div class="jcs" id="jcs">${commentHtml}</div>
</section>

<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<script>
(function(){
  var f=document.getElementById("jf"), n=document.getElementById("jn"),
      b=document.getElementById("jb"), s=document.getElementById("js"), box=document.getElementById("jcs");
  function esc(x){return String(x==null?"":x).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
  f.addEventListener("submit", function(ev){
    ev.preventDefault();
    var text=(b.value||"").trim();
    if(text.length<2){ s.textContent="Write a little more first."; return; }
    var btn=f.querySelector("button"); btn.disabled=true; s.textContent="Sending\\u2026";
    fetch("/api/journal",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({action:"comment",slug:${JSON.stringify(entry.slug)},name:n.value,body:text})})
      .then(function(r){return r.json()})
      .then(function(j){
        btn.disabled=false;
        if(!j||!j.ok){ s.textContent="That did not go through. Try again in a moment."; return; }
        b.value="";
        if(j.held||j.queued){ s.textContent="Received. This one is waiting for a human to look at it, which usually means a filter saw a link."; return; }
        s.textContent="Posted. Thank you.";
        var d=document.createElement("div"); d.className="jc";
        d.innerHTML='<p class="jw"><b>'+esc(j.comment.name)+'</b> &middot; just now</p><p>'+esc(j.comment.body)+'</p>';
        var first=box.querySelector(".jc");
        if(first) box.insertBefore(d,first); else { box.innerHTML=""; box.appendChild(d); }
      })
      .catch(function(){ btn.disabled=false; s.textContent="No connection just now."; });
  });
})();
</script>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=600");
  return res.status(200).send(page({
    title: entry.title + " · The Guardian's Journal",
    desc, canonical: SITE + "/journal/" + entry.slug, body
  }));
}
