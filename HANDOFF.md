# NOOR: how to pick the work up

One page. Read `CLAUDE.md` (how the work is run), then `CURRENT_STATE.md` (where it
stands), then this. `NOOR.md` is the owner's brief; `OPERATIONS.md` is how the house runs
day to day; `ARCHITECTURE.md`, `VIDEO_ENGINE.md` and `SOCIAL_ENGINE.md` are the maps.

## The three places files live

- **GitHub `Eouchi147/noor`, branch `main`**: the truth. Vercel deploys every commit to
  noorcodex.com (project `noor-islamic-timeline`, team `samkeamy-7230s-projects`).
- **The session box** (a cloud Linux container, ephemeral): the working tree
  `/root/ship/noor` (edit here), the reference copy `/root/repo/noor-live` (what main
  holds; refresh it after every release), the audit under `/root/audit/`, the films
  engine under `/root/noor-reels/deliver/tools/films/`. A fresh box starts empty: get
  main again by downloading `https://codeload.github.com/Eouchi147/noor/zip/refs/heads/main`
  on the owner's Mac through `device_bash` (the cloud proxy refuses GitHub's API and
  codeload; `raw.githubusercontent.com` is allowed for single files), stripping
  `reels/*.jpg`, and staging the archive into the box.
- **The owner's Mac**: `/Users/sam/Desktop/NOOR Films` (connected folder; the render
  mirror `noor-render/`, the audit pack, the drag-in folder) and `~/Downloads`.

## How a change reaches the site

The house never pushes. The Director (or a builder with the browser tools) uploads files
through GitHub's web UI in the owner's Chrome: `github.com/Eouchi147/noor/upload/main/<folder>`,
one folder per commit, commit title under 60 characters, description ending with the
attribution lines the session reminder gives. Verify each file with
`raw.githubusercontent.com` afterwards and copy the batch into the reference copy.
Workflows (`reels`, `dictionary`, and any removal workflow) open pull requests; the house
reviews their file lists through `api.github.com` in the browser and merges them in the
browser. Every change gets a line in `changes.txt` first.

## How the machine is read

- The console: `noorcodex.com/admin2`; the owner types the password. Once unlocked in his
  browser, `noorcodex.com/api/social?action=status`, `?action=plan&date=YYYY-MM-DD` and
  `?action=log` answer with the records (read them with `get_page_text`, never a token in
  a report).
- The function log: the Vercel tools (`get_runtime_logs`, scoped to the production
  deployment id and a one hour window, search `noor`); the hourly line reads
  `{"noor":"sent","slot":"reelA","state":"sent","took":{...}}`.
- GitHub Actions: `api.github.com/repos/Eouchi147/noor/actions/runs/<id>/jobs` in the
  browser; a job's log through `github.com/.../commit/<sha>/checks/<job>/logs/<step>`
  fetched from a github.com page (the owner is signed in there).

## The agents

Five roles in `.claude/agents/`; the harness offers them by name only when it read the
folder at session start. Until then: `Agent` with `subagent_type: general-purpose`, the
`model` field from the table in `CLAUDE.md`, and the role brief pasted at the top of the
orders. Verified 16 September 2026 that `haiku`, `sonnet`, `opus` and `fable` answer as
claude-haiku-4-5, claude-sonnet-5, claude-opus-5 and claude-fable-5-1.

## The commands

- Tests: `node tests/<name>.mjs` (Node 22); the browser suites need
  `ln -sfn /root/audit/perf/node_modules node_modules`,
  `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` and a server built from
  `/root/audit/perf/scripts/server.mjs` with its ROOT pointed at the tree.
- The reels: `tools/reels/README.md`; a run is started from the Actions tab (`reels`,
  inputs `ids`); the Monday run needs nothing.
- The films: `VIDEO_ENGINE.md`.

## The films

`VIDEO_ENGINE.md` is the map. In a session: `cd tools/films`, `python3 film.py all
darkroom` (compile, voice, sound), `python3 film.py render darkroom --run` (proof; add
`--full` on the Mac), `python3 film.py mux darkroom --shape tall`, `python3 audit.py
darkroom --shape tall`. Piper voices are fetched from GitHub's release assets
(`https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-en-us-ryan-medium.tar.gz`
into `/tmp/pipervoices/`); `music/` is on the Mac only. The refuter's purity test:
seek 20000, 9500, 20000 and compare frames byte for byte.

## The first three things to do next

1. The owner's verdict on the dark room proof (look, voice, architecture); then the
   revisions he asks for, the full render on the Mac, and the export through the reels
   shelf and the social machine.
2. The content corrections (content-001 to 006) with the hadith numbers checked in the
   owner's browser, and the diet of the old rooms (batch 6).
3. The remaining medium and low findings of the audit, in the pack's order.
