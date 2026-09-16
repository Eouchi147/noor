---
name: noor-handoff
description: Close a NOOR working session or pause a large piece of work so the next session starts from the state documents and not from memory. Use before ending a session, after a big batch, or when the owner asks where things stand.
---
# /noor-handoff

1. Update `CURRENT_STATE.md`: what is live (with dates), what is in flight (tree, files,
   tests), what is blocked and on whom, the numbers that matter (reels on the shelf,
   findings closed, the next slot times).
2. Update `DECISIONS.md` with every decision the owner made since the last entry, dated,
   in his words where they matter.
3. Update `HANDOFF.md`: how to resume in one page: the working tree and the reference
   copy, how files reach GitHub, how the console and the logs are read, the agents and
   how to spawn them when the named types are not offered, the commands, and the first
   three things to do next.
4. `VIDEO_ENGINE.md` and `SOCIAL_ENGINE.md` if their subsystems changed shape.
5. Ship the documents with `/noor-release` (they are `.md`, kept out of the deployment by
   `.vercelignore`, kept in the repository on purpose) and tell the owner in three lines.
