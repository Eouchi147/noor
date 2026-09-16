---
name: noor-release
description: Ship a reviewed change of the NOOR repository to GitHub main through the owner's browser (the house never pushes), record it in the change archive, verify the deployment, and update the state documents. Use after /noor-review says SHIP.
---
# /noor-release <batch name>

Preconditions: a SHIP or SHIP WITH NOTES verdict from `/noor-review`; every changed file
has its line in `changes.txt`; the reference copy `/root/repo/noor-live` is at main.

1. **Stage.** List the changed files (`diff -rq` tree against reference), copy them with
   their folders into `/mnt/user-data/outputs/<batch>/` (the browser's upload tool reads
   only there). Group by folder: GitHub's upload page takes one folder per commit.
2. **Upload** (the Director, or noor-builder on `sonnet` with the browser tools loaded
   through ToolSearch and the exact list of folders and files). Per folder:
   `https://github.com/Eouchi147/noor/upload/main/<folder>`, find the file input, upload,
   set the commit title (under 60 characters, the house's plain voice) and the description
   ending with the attribution lines from the session's system reminder, commit directly
   to main. Never a force, never a branch unless the change needs a preview.
3. **Verify.** For every file, fetch
   `https://raw.githubusercontent.com/Eouchi147/noor/main/<path>` and `cmp` it against the
   tree; then copy the batch into the reference copy so the next diff is clean. Watch the
   Vercel deployment reach READY (the Vercel tools, or the owner's browser on the site) and
   check one changed page live.
4. **A pull request opened by a workflow** (reels, dictionary, the removal workflow): read
   its file list through `api.github.com` in the owner's browser, confirm it carries only
   what the workflow promises, merge it in the browser with the attribution lines in the
   merge description, and record the merge in `changes.txt`.
5. **Record.** Update `CURRENT_STATE.md` (what is live), and `DECISIONS.md` if the owner
   decided anything. Tell the owner in one short message: what changed, where it is
   recorded, what to look at.
