---
name: noor-build
description: Build a change to the NOOR site or its tools through the specialists (scout maps, builder implements, refuter challenges) without the owner choosing a model. Use for any implementation request larger than a one line fix.
---
# /noor-build <what to build>

The Director runs this. The owner never names a model.

1. **Decide the size.** A one line fix with an obvious file: the Director edits it, runs
   the suite that covers it, and goes to `/noor-release`. Anything else continues.
2. **Scout** (noor-scout, `haiku`): one spawn. Orders: map every file, symbol, call site,
   test and document the change touches; report file:line and a scratch path. Skip this
   step when the Director already holds the map from the last hour.
3. **Research** (noor-researcher, `sonnet`) only when a library, an API or a fact outside
   the tree is involved. Orders name the question and the sources that count.
4. **Builder** (noor-builder, `sonnet`): one spawn per batch, one tree at a time. Orders
   carry the scout's map, the exact objective, scope, forbidden actions, the suites to run,
   and the `changes.txt` line requirement. Batch related edits into one spawn.
5. **Refuter** (noor-refuter, `opus`): reads the diff against the reference copy, runs the
   suites, tries to break it, returns a verdict. FIX FIRST goes back to the same builder
   with the reproduction; twice failed goes to noor-debugger (`fable`); STOP comes to the
   Director for a decision.
6. **Ship** with `/noor-release`. Update `CURRENT_STATE.md`.

Marching orders always carry the eight fields of CLAUDE.md. Reports come back under 40
lines; detail lives under `/root/audit/handoff/`.
