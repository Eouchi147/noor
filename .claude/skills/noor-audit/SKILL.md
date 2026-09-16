---
name: noor-audit
description: Audit a part of NOOR (the site, the content, the social machine, the reels, a subsystem) through parallel specialists with verified findings, and produce the KEEP, REFACTOR, REPLACE, REMOVE, AUTOMATE matrix. Use when the owner asks what is wrong, what is strong, or before a rebuild.
---
# /noor-audit <scope>

1. The Director writes one shared brief (the pattern is `/root/audit/BRIEF.md`: every
   finding verified with file:line or a command and its output; severity; a verdict from
   KEEP, REFACTOR, REPLACE, REMOVE, AUTOMATE; honest effort; strong things named as KEEP;
   no dashes; findings.json plus report.md under 2,500 words into `/root/audit/<dim>/`).
2. **Scouts** (noor-scout, `haiku`) map the scope first when it is unfamiliar: files,
   sizes, readers, generators. One per dimension, in parallel.
3. **Researchers** (noor-researcher, `sonnet`) run the dimensions that need measurement
   or reading in depth (architecture, search and metadata, performance with the local
   server and Playwright, content and the graph, the social code and its runtime records),
   in parallel, one per dimension, each with the scout's map in its orders. Runtime
   evidence (Vercel logs, the console's records) is read by the Director or a researcher
   with the browser tools, never guessed.
4. **Refuter** (noor-refuter, `opus`) re-reads the high findings of each report and
   proves or downgrades them (a finding nobody reproduced is marked suspected).
5. The Director synthesises: the matrix, what is already corrected, the order of the rest,
   and one organised page for the owner (the pattern is `/root/audit/noor-audit-2026.html`).
   The reports and the data go to the owner's folder.
