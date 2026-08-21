/* Structural guard for the owner's console.
 *
 * Written after a single missing </div> silently swallowed every tab. The
 * page still parsed, the tabs still highlighted, and every pane rendered
 * blank, because they had all been re-parented inside a container carrying
 * `hidden`. Nothing in the test suite noticed, because nothing was checking
 * shape, only content.
 *
 * So this checks shape. It is deliberately dumb and fast, needs no browser,
 * and fails loudly:
 *
 *   1 every <div> is closed
 *   2 every tab has a pane and every pane has a tab
 *   3 no pane is nested inside another pane
 *   4 no pane sits inside an element carrying `hidden`, except the login
 *     gate that is supposed to hold all of them
 *   5 every inline script parses
 *
 *   node scripts/check-admin.mjs
 */
import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "admin.html");
const src = fs.readFileSync(file, "utf8");
const fails = [];

/* the markup, with scripts removed so JS strings full of tags cannot skew it */
const markup = src.replace(/<script[\s\S]*?<\/script>/g, "");

/* 1 · balance */
const opens = (markup.match(/<div\b/g) || []).length;
const closes = (markup.match(/<\/div>/g) || []).length;
if (opens !== closes)
  fails.push(`div balance is ${opens - closes} (${opens} open, ${closes} closed). ` +
             `An unclosed div re-parents everything after it and can blank the whole console.`);

/* 2 · tabs and panes agree */
/* the active tab carries class="tab on", so match the class loosely or the
   guard develops a blind spot exactly where the default tab lives */
const tabs = [...markup.matchAll(/<button[^>]*\bclass="tab\b[^"]*"[^>]*\bdata-pane="([a-z-]+)"/g)].map(m => m[1]);
/* the open pane carries class="pane on", same trap as the tabs */
const panes = [...markup.matchAll(/<div[^>]*\bclass="pane\b[^"]*"[^>]*\bid="pane-([a-z-]+)"/g)].map(m => m[1]);
for (const t of tabs) if (!panes.includes(t)) fails.push(`tab "${t}" has no pane`);
for (const p of panes) if (!tabs.includes(p)) fails.push(`pane "${p}" has no tab`);

/* 3 and 4 · where each pane actually sits, by walking the tags in order */
const stack = [];
const nesting = [];
const tagRe = /<(\/?)(\w+)([^>]*?)(\/?)>/g;
let m;
while ((m = tagRe.exec(markup))) {
  const [, slash, tag, attrs, selfClose] = m;
  if (tag.toLowerCase() === "br" || tag.toLowerCase() === "img" ||
      tag.toLowerCase() === "input" || tag.toLowerCase() === "meta" ||
      tag.toLowerCase() === "link" || selfClose) continue;
  if (slash) { for (let i = stack.length - 1; i >= 0; i--) { if (stack[i].tag === tag) { stack.length = i; break; } } continue; }
  const id = (attrs.match(/\bid="([^"]+)"/) || [])[1] || "";
  const isPane = /\bclass="pane\b[^"]*"/.test(attrs);
  const isHidden = /\bhidden\b/.test(attrs);
  if (isPane) nesting.push({ id: "pane-" + (id.replace(/^pane-/, "") || "?"), ancestors: stack.map(s => ({ id: s.id, hidden: s.hidden })) });
  stack.push({ tag, id, hidden: isHidden });
}
const GATE = new Set(["dash"]);           // the one wrapper allowed to hold panes hidden
for (const n of nesting) {
  const paneAncestor = n.ancestors.find(a => /^pane-/.test(a.id));
  if (paneAncestor) fails.push(`${n.id} is nested inside ${paneAncestor.id}`);
  const badHidden = n.ancestors.find(a => a.hidden && !GATE.has(a.id));
  if (badHidden) fails.push(`${n.id} sits inside hidden "#${badHidden.id || "unnamed"}", so it can never be seen`);
}

/* 5 · every inline script parses */
const scripts = src.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g) || [];
scripts.forEach((block, i) => {
  const body = block.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, "");
  if (/type="application\/(ld\+)?json"/.test(block)) return;
  try { new Function(body); }
  catch (e) { fails.push(`inline script ${i + 1} does not parse: ${e.message}`); }
});

console.log(`admin.html · ${tabs.length} tabs, ${panes.length} panes, ${scripts.length} inline script(s)`);
if (fails.length) {
  console.error("\nFAILED:");
  fails.forEach(f => console.error("  · " + f));
  process.exit(1);
}
console.log("every pane is reachable, every tab has a home, and the markup closes.");
