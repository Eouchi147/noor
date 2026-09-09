# The compilations

Long-form videos for YouTube, joined from the reels that already exist.
A reel lives a day in a feed; the same reels end to end are a half-hour
video YouTube keeps and searches for years. Nothing is written for them:
every frame is a reel that was audited and rendered, and the description
is the manifest's own text (each reel's hook as a chapter, the reciters it
names) with the library's line.

    compile.py           downloads the reels from the store, joins them with ffmpeg
                         (a stream copy; no frame is touched), writes out/<name>.mp4,
                         the chapter list, a JSON with title, description, tags and
                         ids, and a 1280x720 thumbnail on the night from the first
                         reel's cover
    yt_upload.py         the resumable upload, the thumbnail, the playlist of the
                         kind; keeps compilations.json so nothing goes up twice
    compilations.json    the ledger: name -> video id, date, the ids joined
    test_compile.py      19 checks; `python3 -m pytest -q test_compile.py`

## What it makes

| name                | what                                                  | title                                                              |
|---------------------|-------------------------------------------------------|--------------------------------------------------------------------|
| `names`             | the 99 Names in their order                           | The 99 Names of Allah, with their meaning · NOOR Codex of Light    |
| `dua`               | the 18 du'as of the Path                              | Du'as of the Path, from the Qur'an and the Sunnah                  |
| `verses-patience`   | verses whose meaning carries patience, hardship, ease | Thirty verses on patience, recited, with meaning                   |
| `verses-mercy`      | mercy, merciful, forgiveness                          | Thirty verses on mercy, recited, with meaning                      |
| `verses-gratitude`  | grateful, gratitude, thanks                           | Thirty verses on gratitude, recited, with meaning                  |
| `verses-remembrance`| remember, remembrance                                 | Thirty verses on remembrance, recited, with meaning                |
| `words-a-d` … `words-s-z` | the words of the Path by first letter           | The words of the Path, A to D, explained                           |
| `know-1`, `know-2` …| the Did you knows, forty at a time                    | Did you know? Forty true things from Islamic history, part N       |

A count in a title is the true count: twenty-eight verses say
"Twenty-eight", the last Did you know part says how many it holds. A
verse compilation credits every reciter and the Saheeh International
translation. Vertical long-form, 1080x1920, as the reels are; YouTube
takes it. A video over twelve hours would be split into parts; nothing on
the shelf comes near it (the Names are 33 minutes, a words block about 35).

## The one step

Copy the three values the site already holds in Vercel into the
repository's secrets, under the same names:

    GitHub → the noor repository → Settings → Secrets and variables → Actions
    → New repository secret, three times:

        YT_CLIENT_ID
        YT_CLIENT_SECRET
        YT_REFRESH_TOKEN

They are the same three that are in Vercel's environment variables for the
site (the consent given once at `/api/youtube?action=auth`). Nothing else
is needed. Until they are there the workflow still builds the videos and
keeps them as run artifacts for three days; the upload step says in one
line that YouTube is not connected.

## Running it

Actions → **compilations** → Run workflow.

- `names`: which to build, space separated. Default
  `names dua verses-patience verses-mercy`. `verses`, `words` or `know`
  alone means the whole family.
- `public`: publish. Off by default: videos go up **unlisted**, to be
  looked at and made public by hand from YouTube Studio.
- `again`: send a compilation the ledger already has (a re-render, a new
  title).

It also runs on its own on the first Monday of the month at 05:00 UTC and
sends whatever the ledger has not seen, four at most.

Each run: builds, uploads, writes the step summary (each video, its length,
its link and whether YouTube kept it private), keeps the mp4s as artifacts
for three days, and opens a pull request on `reels/compilations` carrying
`compilations.json` with the links in its body. Merge it; a compilation
on the ledger is not sent again. An upload YouTube took without answering
with a video id is written to the ledger as **unconfirmed** with its
session, so it is not sent twice by itself: look for the title in YouTube
Studio, and tick `again` if it is not there.

## Quota

YouTube gives 10,000 units a day. An upload is 1,600, the thumbnail 50,
the playlist about 100: roughly 1,750 a compilation. A run sends four at
most (7,000), leaving the day's Shorts theirs (`api/_youtube.js` sends
two, 3,200). If YouTube answers that the day is spent the run stops
cleanly; what was built stays as artifacts and the next run sends it.

Two things YouTube does that are worth knowing. A project that has not
passed the YouTube API audit keeps every upload **private** whatever it
asked for; the summary says so when it happens, and the video can be made
unlisted or public by hand in Studio. And the playlist step needs the
`youtube` scope, which the site's consent (upload and readonly) does not
carry; when YouTube refuses it the video is up all the same and the line
says why. Adding the videos to a playlist by hand in Studio takes a minute.
