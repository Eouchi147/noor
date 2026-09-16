---
name: noor-review
description: Independent adversarial review of a diff, a batch or a pull request of the NOOR repository, by the refuter on Opus, with the suites run and a verdict. Use before anything ships and whenever the owner asks whether something is right.
---
# /noor-review <tree or pull request>

1. The Director names the tree under review and the reference copy (normally
   `/root/ship/noor` against `/root/repo/noor-live`, or a pull request's branch fetched to a
   scratch folder), the files in scope, and the suites that cover them.
2. **Refuter** (noor-refuter, `opus`), one spawn. Orders: assume it is wrong; `diff -ru`;
   run the named suites and any suite touching the files; construct the inputs the builder
   did not (empty, huge, unicode, missing file, network 500, midnight UTC); check the house
   rules (no dashes, nothing invented, no faces, no secrets, a truthful `changes.txt` line);
   check nothing outside scope moved; verdict SHIP, SHIP WITH NOTES, FIX FIRST or STOP with
   reproductions.
3. The Director reads the verdict only. FIX FIRST returns to the builder that made the
   change with the reproduction pasted in; a second FIX FIRST on the same point goes to
   noor-debugger (`fable`). STOP is decided by the Director, or by the owner when it is his
   call (a policy, money, a public change of behaviour).
4. A SHIP verdict is recorded in the release note (`/noor-release`).
