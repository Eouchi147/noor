#!/usr/bin/env python3
"""NOOR · the Guardian's Journal index page.

The list of entries is fetched at runtime from the store, so publishing an
entry never touches this file and never needs a deploy. This page is the
binding: the head, the seal that says whose opinion this is, and the shelf.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from room import shell

MAIN = """
<div class="jwrap">
<div class="jhead">
<p class="jorn">The Guardian&rsquo;s Journal</p>
<h1>Thoughts from inside the work</h1>
<p class="jsub">Everything else in this Codex is written in the voice of the tradition, and carries the evidence for every line. This page is not that. These are the reflections of one contemporary Muslim who is building this library, thinking aloud about faith, doubt, work and the age we are living in. Read them as you would read a letter from someone walking the same road: worth hearing, and entirely capable of being wrong.</p>
<span class="jseal"><i aria-hidden="true">&#1606;</i><span>One reader&rsquo;s opinion, not a ruling</span></span>
</div>

<div class="jdiv" aria-hidden="true"><i>&#10022;</i></div>

<div id="jlist" class="jlist"><p class="jempty">Opening the journal&hellip;</p></div>

<div class="jdiv" aria-hidden="true"><i>&#10022;</i></div>

<div class="jback" style="text-align:center;padding-bottom:3rem">
<p style="font-size:.82rem;line-height:1.85;color:var(--jink-soft);margin:0 auto;max-width:32rem">
Every entry is open for reply, with no account and no login. Disagreement is welcome here and is never removed for being disagreement.
<a href="/journal-rules" style="color:#7A5B12">How replies are handled &rarr;</a></p>
</div>
</div>

<script>
(function(){
  var box = document.getElementById("jlist");
  function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
  function when(iso){
    try{ var d=new Date(iso);
      var lang=(window.NOOR_I18N&&NOOR_I18N.lang)||document.documentElement.lang||"en";
      return d.toLocaleDateString(lang,{year:"numeric",month:"long",day:"numeric"});
    }catch(e){ return String(iso||"").slice(0,10); }
  }
  fetch("/api/journal").then(function(r){return r.ok?r.json():null}).then(function(j){
    var list = (j&&j.entries)||[];
    if(!list.length){
      box.innerHTML = '<p class="jempty">The first entry has not been written yet. When it is, it will stand here.</p>';
      return;
    }
    var n = list.length;
    box.innerHTML = list.map(function(e,i){
      var num = n - i;
      return '<article class="jentry">' +
        '<p class="jmeta">Entry ' + num + ' &middot; ' + esc(when(e.at)) + '</p>' +
        '<h2><a href="/journal/' + encodeURIComponent(e.slug) + '">' + esc(e.title) + '</a></h2>' +
        (e.dek ? '<p class="jdek">' + esc(e.dek) + '</p>' : '') +
        '<p class="jfoot">' +
          (e.words ? '<span>' + Math.max(1, Math.round(e.words/220)) + ' min</span>' : '') +
          '<span>' + (e.comments||0) + ' ' + ((e.comments===1)?'reply':'replies') + '</span>' +
          (e.tags||[]).map(function(t){return '<span class="jtag">'+esc(t)+'</span>'}).join("") +
        '</p></article>';
    }).join("");
  }).catch(function(){
    box.innerHTML = '<p class="jempty">The journal could not be opened just now. The rest of the Codex is unaffected.</p>';
  });
})();
</script>
"""

JSONLD = """<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Blog","name":"The Guardian's Journal",
"description":"Personal reflections from the builder of NOOR Codex of Light: opinion, clearly labelled as opinion, open to reply.",
"url":"https://noorcodex.com/journal",
"isPartOf":{"@type":"WebSite","name":"NOOR Codex of Light","url":"https://noorcodex.com"}}
</script>"""

html = shell(
    slug="journal",
    title="The Guardian's Journal · thoughts from inside the work",
    desc="Personal reflections from the person building NOOR Codex of Light. Opinion, clearly labelled as opinion, never presented as a ruling, and open to reply without an account.",
    ar="",
    kick="",
    h1="",
    lead="",
    extra_head='<link rel="stylesheet" href="/assets/journal.css?v=89"/>',
    css='.rhero{display:none}\nmain{background:#F5EEDC}\nbody{background:#F5EEDC}',
    jsonld=JSONLD,
    main=MAIN,
    footline="Opinion, offered openly. The teaching rooms of the Codex carry their evidence; this one carries a name.")

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
open(os.path.join(root, "journal.html"), "w", encoding="utf-8").write(html)
print("journal.html written:", len(html), "bytes")
