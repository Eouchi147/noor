# NOOR films

`TEMPLATE.md` is the standard every film is written and checked against; `VIDEO_ENGINE.md` at
the root is the map of the engine. This page is the three ways to turn a staged brief
(`briefs/plate-<slug>.json`) into two finished shorts on the shelf: the Actions tab, this
console once it exists, and the owner's own Terminal.

## The three ways to render

**The Actions tab (no Terminal).** `Actions` -> `films` -> `Run workflow`. Three inputs:
`briefs` (comma separated names, without the `plate-` prefix, e.g. `darkroom,zero`; empty
renders every staged brief), `machines` (how many may render at once, 4 by default, 8 at
most), `proof` (12 fps, shutter 1, a quick look rather than the shelf copy). The run compiles
every brief first and fails at once, naming the brief, if one is refused, before any machine
starts; it then renders, scores, audits and shelves the rest, and opens one pull request with
every audit's table in its body. Merge it the way every other pull request from this
repository is merged.

**The console.** Not built yet: the films workflow can be started from `noorcodex.com/admin2`
the same way a reels run already can, once that button exists.

**Terminal, on the owner's Mac.** `cd tools/films && ./plates.sh` (every staged brief) or
`./plates.sh plate-darkroom` (one), then `./publish-shorts.sh` once `BLOB_READ_WRITE_TOKEN`
is exported in the owner's own shell (see `tools/reels/README.md`, "Shorts", for the full
walk through). This is the same chain the Actions workflow runs; either one reaches the same
shelf at the same url for the same film.

## The music release

The two Suno scores `shortmusic.py` cuts from (`music/*.m4a`, about 12 MB together) are the
owner's own files and are never committed: the repository would carry them in every checkout
and every deploy for a `.vercelignore`d folder that never ships. `plates.sh` reads them
straight from the owner's Mac; the workflow reads them from a GitHub Release, once put there.

**The owner's four steps, once:**

1. On GitHub, open the repository and go to `Releases`.
2. `Draft a new release`. Tag it `films-music` (exactly that, lower case, with the dash).
3. Attach the two files from `NOOR Films/noor-render/music/` on the Mac (any two names; the
   engine picks a score by scanning the folder, not by a fixed filename).
4. `Publish release`.

The render job downloads them at the start of every run and fails at once, naming the release
and what is missing, if the release or its files are not there yet. Re-rendering the release
(a new score, or a replacement file under the same tag) is the same four steps again; the
next run picks up whatever is attached.

## The shelf

A finished film reaches the same shelf a reel does, as a row of kind `short` in
`reels/index.json` (see `tools/reels/README.md`, "Shorts", for how a row is built and how the
rota and every network read it). The videos themselves live on Vercel Blob, the same store
`publish-shorts.sh` uploads to, at the same pathname (`reels/<slug>.mp4`,
`reels/<slug>-wide.mp4`) every time, whether the upload came from the owner's own shell or
from this workflow: a film keeps one url for its whole life, no matter which road put it
there.

**The secret the owner adds, once.** `BLOB_READ_WRITE_TOKEN`, the same token
`tools/reels/README.md` already asks for, added at
`github.com/<repo>/settings/secrets/actions` as a repository secret (`New repository secret`,
name it exactly `BLOB_READ_WRITE_TOKEN`, paste the value from the Vercel Blob store's own
settings). It is never typed into a file and never passes through Claude; without it the
assemble job still builds the rows and prints a clear line saying nothing was uploaded, rather
than fail the whole run, and the rows are tried again next time the workflow runs. This is the
one secret the films workflow needs; `GITHUB_TOKEN`, which opens the pull request and reads
the music release, is supplied by Actions itself.

The reels engine's own shelf (`tools/reels/shelf_store.py`) can put a video on either a GitHub
Release or Vercel Blob; the films workflow always chooses the blob path, reusing
`shelf_store.py`'s own `blob_put` helper rather than a GitHub Release, so a film rendered here
and a film the owner publishes by hand write the exact same kind of row.

## What `render_ci.py` does

`render_ci.py <name> [--proof]` is the one file the render job calls per film (`<name>` is a
brief's own name without the `plate-` prefix, the same spelling the workflow's own `briefs`
input takes). Six steps, the same ones `plates.sh` runs by hand: compile the brief
(`shortplate.py`), render tall then wide (`noor.py`, 30 fps and a three sample shutter, or 12
fps and shutter 1 for `--proof`), lay the score under each (`shortmusic.py --mux`, with the
same rename dance `plates.sh` does around its hardcoded `-60fps.mp4` name), audit each
(`audit.py`, its own verdict, PASS, FAIL or SKIPPED a rule at a time, written to
`out/<slug>-<shape>.audit.json`), and draw a contact sheet of each (ten tiles, one at each
line's own midpoint, read straight off the compiled beat rather than guessed; `contact.py`
samples one frame a *beat*, and a plate short's whole picture is one beat, so its own sampling
would draw one tile for a forty second film, not ten). It exits non zero only when the render
itself could not be produced, a refused brief, a render or a mux that failed; an audit FAIL is
not a render failure and ships its film, its table already written for the pull request to
show.
