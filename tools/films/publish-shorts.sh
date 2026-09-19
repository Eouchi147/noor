#!/bin/bash
#  Put the finished shorts on the shelf and write the merged manifest.
#
#  THE TOKEN IS NEVER IN THIS FILE AND NEVER PASSES THROUGH CLAUDE.
#  blobput.py reads BLOB_READ_WRITE_TOKEN out of the environment. Set it in
#  your own shell before running this, the same one the reels workflow uses:
#
#      export BLOB_READ_WRITE_TOKEN=...        (you type this, nobody else)
#      ./publish-shorts.sh
#
#  or, better, put the key on the first line of blob-token.txt in the folder
#  above this one and just run the script: it is read from there, kept out of
#  your shell history, and never printed. See the note at the check itself.
#
#  Each short is uploaded to the same pathname every time, so re-rendering a
#  short overwrites it and its URL never changes. That is the same rule the
#  reels shelf runs on and it is why the manifest does not have to be
#  rebuilt when a picture is remade. The wide (16:9) file, when a short has
#  one, rides beside the tall one under its own name, for YouTube; every
#  other network keeps the tall (9:16) file.
#
#  THE MASTERS ARE NEVER UPLOADED. plates.sh renders at CRF 16, 90 to 180 MB
#  a file, heavier than any network needs and, for Telegram, over its 50 MB
#  upload ceiling outright. Before uploading, this makes a delivery copy of
#  each shape (libx264, preset slow, crf 21, yuv420p, faststart, the audio
#  stream copied, not re-encoded) under out/deliver/<slug>-<shape>.mp4, and
#  uploads that. The transcode is skipped when the copy is already newer
#  than its master; a copy still over 50 MB after transcoding is refused,
#  its size printed, and the run moves on to the next file rather than
#  uploading a file Telegram would only reject.
#
#  TWO HOMES, ONE SCRIPT. Inside the site's own tree (tools/films/) the shelf
#  manifest is ../../reels/index.json and the cards are ../reels/know.json.
#  On the owner's Mac this folder stands alone, so the same files travel with
#  it under shelf/ (index.json, know.json, site/heroes.html), refreshed from
#  main by the Director with every update; whichever of the two exists is
#  used. The upload itself is blobput.py (python3 and curl, which every Mac
#  has) rather than blob.mjs (node and npm, which the Mac may not).
#
#  A RUN CAN BE REPEATED. out/uploads.json remembers every upload that
#  succeeded, with the delivery copy's size and time; a copy that has not
#  changed since is not sent again, so a run cut off half way, or run again
#  after one new film, uploads only what is new.
#
#  WHAT COMES OUT. out/index.merged.json (and out/home.merged.json when a
#  home.json exists) for the record, and the same two files under
#  out/main/reels/ with their real names, so that out/main is a folder
#  whose contents can be dragged onto the repository's upload page as they
#  are (the Director places the rest of a release in out/main beside them).
cd "$(dirname "$0")" || exit 1
#  NOTHING RENDERED, NOTHING TO PUBLISH, AND SAY SO IN ONE SECOND.
#  On 17 September the owner ran this after his masters were no longer in the
#  folder. The upload loop simply never ran, the manifest could build no row
#  for a film with no file, and the run ended in under a minute having quietly
#  written a shelf with the films missing from it. The count is checked here,
#  before anything else, because "there is nothing to do" is an answer a
#  person should get immediately and in plain words.
nbriefs=$(ls briefs/plate-*.json 2>/dev/null | wc -l | tr -d " ")
nmasters=$(ls short-*-tall-30fps.mp4 2>/dev/null | wc -l | tr -d " ")
if [ "$nbriefs" -gt 0 ] && [ "$nmasters" -eq 0 ]; then
  echo
  echo "  There are $nbriefs briefs here and not one rendered film."
  echo "  This script publishes films; it does not make them."
  echo
  echo "      ./plates.sh"
  echo
  echo "  renders them (the frames in frames/ are kept, so anything already"
  echo "  drawn is reused). Then run this again."
  exit 1
fi

#  THE KEY MAY COME FROM A FILE, AND USUALLY SHOULD.
#  Typing "export BLOB_READ_WRITE_TOKEN=..." writes the key into the shell's
#  history file, where it sits in plain text for as long as that file lives
#  and is read by anything that reads history. The key that published this
#  shelf in September had to be replaced for a related reason, and replacing
#  a key by typing it is how the next one leaks too.
#
#  So: if the variable is not already set, the key is read from a file named
#  blob-token.txt in the folder ABOVE this one, which is the same place and
#  the same habit as github-token.txt. Nothing about it is printed, here or
#  anywhere below, and the file is tightened to owner only on the way past.
#  Exporting by hand still works and still wins; this is only the gentler
#  road for anyone who would rather not put a secret in their history.
if [ -z "${BLOB_READ_WRITE_TOKEN:-}" ] && [ -f ../blob-token.txt ]; then
  chmod 600 ../blob-token.txt 2>/dev/null
  BLOB_READ_WRITE_TOKEN=$(head -1 ../blob-token.txt | tr -d '[:space:]')
  export BLOB_READ_WRITE_TOKEN
  [ -n "$BLOB_READ_WRITE_TOKEN" ] && echo "  key taken from blob-token.txt, nothing typed and nothing shown"
fi
if [ -z "${BLOB_READ_WRITE_TOKEN:-}" ]; then
  echo "  No key. Either put it in blob-token.txt in the folder above this one,"
  echo "  which keeps it out of your shell history, or export it by hand:"
  echo
  echo "      export BLOB_READ_WRITE_TOKEN=..."
  echo
  exit 1
fi
command -v ffmpeg >/dev/null 2>&1 || { echo "ffmpeg not found on PATH."; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "curl not found on PATH."; exit 1; }
[ -f blobput.py ] || { echo "blobput.py is missing beside this script."; exit 1; }
if [ -d .venv ]; then source .venv/bin/activate 2>/dev/null; fi


#  THE KEY IS TESTED BEFORE ANY WORK IS DONE.
#  The first real run spent fourteen minutes making all twenty two delivery
#  copies and only then found that not one upload would be accepted: the
#  shelf's answer was never looked at until the first file was already
#  encoded, and the run ended with a full out/deliver and an empty shelf.
#  Twelve bytes go up first now. A wrong or expired key costs ten seconds.
mkdir -p out
if ! probe=$(python3 blobput.py probe 2>&1); then
  echo
  echo "  The shelf would not take a twelve byte test file, so nothing was encoded."
  echo "  What it said:"
  echo "    $probe"
  echo
  echo "  Almost always this is the key: open the Blob store on Vercel, Storage,"
  echo "  its .env.local tab, copy BLOB_READ_WRITE_TOKEN whole (it begins"
  echo "  vercel_blob_rw_), and export it again in this same window."
  exit 1
fi
echo "  $probe"

ROWS=out/shorts-rows.json
if [ -f ../../reels/index.json ]; then INDEX=../../reels/index.json; else INDEX=shelf/index.json; fi
[ -f "$INDEX" ] || { echo "no shelf manifest at ../../reels/index.json or shelf/index.json"; exit 1; }
#  HOME, not HOMEJSON, was the shell's own HOME the moment this file was
#  first written: reassigning it (bash keeps a variable exported once it
#  already is, which HOME always is) handed every child process below --
#  ffmpeg, node, python3 -- a working directory named reels/home.json
#  instead of a real home. Named HOMEJSON so nothing here ever touches it.
if [ -f ../../reels/home.json ]; then HOMEJSON=../../reels/home.json; else HOMEJSON=shelf/home.json; fi
DELIVER=out/deliver
UPLOADS=out/uploads.json
ERRLOG=out/upload-errors.log
MAXBYTES=52428800
mkdir -p "$DELIVER" out/main/reels
python3 shortmanifest.py >/dev/null || exit 1
[ -f "$UPLOADS" ] || echo "[]" > "$UPLOADS"
: > "$ERRLOG"

#  THE DELIVERY RECIPE, AND WHY IT IS EXACTLY THIS.
#  The first film to go out, on 17 September, was taken by YouTube (both
#  shapes) and by Telegram and refused by Instagram: "could not process the
#  video: ERROR", seven seconds after the container was made. The masters
#  are rendered from full range frames, so ffmpeg wrote yuvj420p with
#  color_range pc at level 5.0, and `-c:a copy` carried the score through at
#  252 kbps. The reels that Instagram accepts every day of the week are
#  encoded (tools/reels/compile.py, webreel.py) as high profile yuv420p with
#  aac at 48 kHz, two channels, 96 kbps. So a delivery copy is now made to
#  that same proven recipe rather than to a lighter version of the master:
#  the levels are really converted (scale=in_range=full:out_range=tv, not
#  merely tagged), bt709 is written on all three tags, and the audio is
#  re-encoded rather than copied. The result is also smaller, 21 MB against
#  31, which is further under Telegram's ceiling and quicker to upload.
#  The masters are never touched.
#
#  REV is the recipe's own revision, and it is part of every copy's NAME.
#  It was a marker file beside them at first, written at the end of a run,
#  and on 17 September a run that encoded nothing at all still wrote it: the
#  old copies were then stamped with the new recipe's number and the next
#  run skipped all forty four as already current. A file on disk cannot say
#  which recipe produced it, so the recipe is in the file name, where it
#  cannot be claimed by a file that does not have it.
REV=2
make_delivery_copy() {
  local master="$1" copy="$2"
  if [ -f "$copy" ] && [ "$copy" -nt "$master" ]; then
    return 0
  fi
  ffmpeg -y -loglevel error -i "$master" \
    -vf "scale=in_range=full:out_range=tv" \
    -c:v libx264 -preset medium -crf 21 -profile:v high -pix_fmt yuv420p \
    -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
    -movflags +faststart \
    -c:a aac -ar 48000 -ac 2 -b:a 96k "$copy"
}

#  $1 the delivery copy, $2 the blob pathname. Prints the URL on success;
#  prints nothing and returns non zero when the copy is over the ceiling
#  or the upload itself fails. A copy already sent, unchanged since (same
#  size and time in out/uploads.json), is not sent again: its recorded URL
#  is printed instead.
upload_capped() {
  local copy="$1" dest="$2" bytes stamp had url
  bytes=$(wc -c < "$copy" | tr -d ' ')
  if [ "$bytes" -gt "$MAXBYTES" ]; then
    echo "    $copy is $bytes bytes, over the 50 MB ceiling, skipped" >&2
    return 1
  fi
  stamp=$(python3 -c "import os,sys;print(int(os.path.getmtime(sys.argv[1])))" "$copy")
  had=$(python3 - "$UPLOADS" "$dest" "$bytes" "$stamp" <<'PY2'
import json, sys
path, dest, bytes_, stamp = sys.argv[1:5]
for r in json.load(open(path, encoding="utf-8")):
    if r.get("pathname") == dest and str(r.get("bytes")) == bytes_ and str(r.get("stamp")) == stamp and str(r.get("url", "")).startswith("https://"):
        print(r["url"]); break
PY2
)
  if [ -n "$had" ]; then
    echo "    already on the shelf, unchanged: $dest" >&2
    echo "$had"
    return 0
  fi
  #  the shelf's own words are kept, not just shown and lost: a run left
  #  running in another window is read afterwards from this file
  url=$(python3 blobput.py put "$copy" "$dest" 2>>"$ERRLOG") || {
    echo "    upload failed, see $ERRLOG" >&2
    return 1
  }
  case "$url" in https://*) ;; *) return 1;; esac
  python3 - "$UPLOADS" "$dest" "$bytes" "$stamp" "$url" <<'PY3'
import json, sys
path, dest, bytes_, stamp, url = sys.argv[1:6]
rows = [r for r in json.load(open(path, encoding="utf-8")) if r.get("pathname") != dest]
rows.append({"pathname": dest, "bytes": int(bytes_), "stamp": int(stamp), "url": url})
open(path, "w", encoding="utf-8").write(json.dumps(rows, ensure_ascii=False, indent=1) + "\n")
PY3
  echo "$url"
}

#  ---------------------------------------------------------------------------
#  THE COVER, AND WHY IT IS NOT OPTIONAL
#
#  Instagram is the one network that refuses to publish a reel without a
#  cover picture, and the shelf row every film gets carries "cover": true,
#  which tells the poster to look for reels/<slug>-cover.jpg on the site.
#  This script never made one. So on 17 September the first film went to
#  YouTube, Facebook, Threads and Telegram and was refused by Instagram with
#  "could not process the video: ERROR", which reads like a bad encode and is
#  not: the pre-flight fetched a cover that was not there. All twenty two
#  films carried the same hole, four afternoons a week, and it would have gone
#  on until somebody looked.
#
#  The frame is taken at four fifths of the way in. That is inside the payoff,
#  where the drawing is finished and its last line is on screen, which is the
#  right tile for a profile grid: the whole picture, not an empty opening
#  frame.
#
#  It is UPLOADED to the same shelf as the film, not carried to the repository
#  by hand, because the hand is where this broke: a picture that has to be
#  dragged separately from the row that promises it will one day not be. On
#  the shelf the two are made, sent and recorded together, and the merge below
#  will not list a film whose cover did not arrive.
make_cover() {
  local master="$1" dest="$2" dur t
  #  THE SAME RULE make_delivery_copy USES, AND FOR THE SAME REASON.
  #  A cover is a frame OF a master. Keeping one that is older than the master
  #  it claims to show means a film that was re-rendered goes up behind the
  #  picture it used to have. That is not hypothetical either: the twenty two
  #  covers made on 17 September outlived the masters they came from by one
  #  day, and the re-render that gave those films their moving parts would
  #  have been published under stills of the versions where nothing moved.
  #  A cover no older than its master is the current frame; anything else is
  #  remade.
  if [ -f "$dest" ] && [ "$dest" -nt "$master" ]; then
    return 0
  fi
  dur=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$master" 2>/dev/null)
  t=$(python3 -c "import sys;print(round(float(sys.argv[1] or 40)*0.80,2))" "$dur")
  ffmpeg -y -loglevel error -ss "$t" -i "$master" -frames:v 1 \
         -vf "scale=1080:-2" -q:v 3 "$dest" 2>/dev/null || return 1
  return 0
}

TMP=$(mktemp)
echo "[" > "$TMP"
first=1
for f in short-*-tall-30fps.mp4; do
  [ -f "$f" ] || continue
  slug="${f%-tall-30fps.mp4}"
  tallcopy="$DELIVER/${slug}-tall.r${REV}.mp4"
  make_delivery_copy "$f" "$tallcopy" || { echo "    ffmpeg failed on $f"; continue; }
  echo "  uploading $slug"
  url=$(upload_capped "$tallcopy" "reels/$slug.mp4") || continue
  case "$url" in https://*) ;; *) echo "    upload failed: $url"; continue;; esac
  #  THE COVER GOES UP WITH THE FILM, ON THE SAME SHELF, IN THE SAME RUN.
  #  See the note on make_cover. A cover that does not reach the shelf means
  #  the row does not travel: the merge below refuses it, exactly as it
  #  refuses a row whose video never arrived.
  coverjpg="$DELIVER/${slug}-cover.jpg"
  coverurl=""
  if make_cover "$f" "$coverjpg"; then
    coverurl=$(upload_capped "$coverjpg" "reels/$slug-cover.jpg") || coverurl=""
    case "$coverurl" in https://*) ;; *) coverurl="";; esac
  fi
  [ -n "$coverurl" ] || echo "    NO COVER for $slug: its row will be left off the shelf"
  wideurl=""
  wf="${slug}-wide-30fps.mp4"
  if [ -f "$wf" ]; then
    widecopy="$DELIVER/${slug}-wide.r${REV}.mp4"
    if make_delivery_copy "$wf" "$widecopy"; then
      echo "  uploading $slug (wide)"
      wideurl=$(upload_capped "$widecopy" "reels/$slug-wide.mp4") || wideurl=""
      case "$wideurl" in https://*) ;; *) wideurl="";; esac
    else
      echo "    ffmpeg failed on $wf"
    fi
  fi
  [ $first -eq 1 ] || echo "," >> "$TMP"
  first=0
  if [ -n "$wideurl" ]; then
    printf '  {"id":"%s","video":"%s","wide":"%s","cover":"%s"}' "$slug" "$url" "$wideurl" "$coverurl" >> "$TMP"
  else
    printf '  {"id":"%s","video":"%s","cover":"%s"}' "$slug" "$url" "$coverurl" >> "$TMP"
  fi
done
echo "" >> "$TMP"; echo "]" >> "$TMP"

python3 - "$TMP" "$ROWS" "$INDEX" "$HOMEJSON" <<'PY'
import datetime, json, os, sys
up_path, rows_path, index_path, home_path = sys.argv[1:5]
up = {r["id"]: r for r in json.load(open(up_path, encoding="utf-8"))}
doc_rows = json.load(open(rows_path, encoding="utf-8"))

#  EVERY UPLOAD THAT EVER SUCCEEDED, NOT JUST THIS RUN'S.
#  The comment below always said "or in an earlier one recorded in
#  out/uploads.json" and the code never read that file, so a run which
#  uploaded nothing dropped EVERY row. On 17 September the owner's masters
#  were no longer in the folder, the upload loop therefore never ran once,
#  and the merged shelf came out with one short instead of twenty two: one
#  drag away from wiping twenty one films off the live site. The ledger of
#  past uploads is now read first and this run's uploads are laid over it,
#  so a row keeps its place as long as its file is on the shelf at all.
led = os.path.join(os.path.dirname(up_path) or ".", "out", "uploads.json")
if not os.path.exists(led):
    led = os.path.join("out", "uploads.json")
if os.path.exists(led):
    for r in json.load(open(led, encoding="utf-8")):
        path, url = r.get("pathname", ""), r.get("url", "")
        if not url.startswith("https://") or not path.startswith("reels/"):
            continue
        if path.endswith("-cover.jpg"):
            up.setdefault(path[len("reels/"):-len("-cover.jpg")], {})["cover"] = url
            continue
        name = path[len("reels/"):-len(".mp4")] if path.endswith(".mp4") else ""
        if name.endswith("-wide"):
            up.setdefault(name[:-5], {})["wide"] = url
        elif name:
            up.setdefault(name, {})["video"] = url
    #  an entry with a wide or a cover and no tall is not a row that can travel
    up = {k: v for k, v in up.items() if v.get("video")}
#  A ROW TRAVELS ONLY WITH ITS FILES, AND THE COVER IS ONE OF THEM.
#
#  shortmanifest.py also lists the older shorts (their caption off a know.json
#  card) whenever their compiled film exists, but a row whose video was never
#  put on the shelf would send the rota to a URL that answers 404. Only a row
#  whose upload succeeded in this run, or in an earlier one recorded in
#  out/uploads.json, is merged; the rest are named here and left off.
#
#  THE COVER WAS NOT PART OF THAT LAW AND SHOULD ALWAYS HAVE BEEN. Every film
#  row carries cover, and until today it carried the bare value true, which
#  tells the poster to fetch reels/<id>-cover.jpg from the site. Nothing in
#  this pipeline ever made that file. So on 17 September the first film went
#  to YouTube, Facebook, Threads and Telegram and Instagram alone refused it,
#  and the console's own words were right where Meta's were not: "the card
#  URL answered 404". Instagram is the one network whose spec marks the image
#  required. All twenty two films carried the same hole, and every one of them
#  would have been refused in turn, four afternoons a week, until a person
#  happened to look.
#
#  The fault was never the missing picture. It was that a row could PROMISE a
#  picture that nothing had made and still reach the live shelf. So the cover
#  now travels the same road as the video, uploaded beside it in the same run
#  by the same function, recorded in the same ledger, and checked here by the
#  same law: no cover on the shelf, no row on the shelf. A film cannot now be
#  posted anywhere before its cover exists, because it cannot be listed.
rows = doc_rows["cards"]
n_uploaded = 0
left = []
nocover = []
kept = []
for row in rows:
    u = up.get(row["id"])
    if not u:
        left.append(row["id"])
        continue
    if not u.get("cover"):
        nocover.append(row["id"])
        continue
    row["video"] = u["video"]
    row["cover"] = u["cover"]
    if u.get("wide"):
        row["wide"] = u["wide"]
    n_uploaded += 1
    kept.append(row)
if left:
    print("  not on the shelf (no file uploaded, so no row): " + ", ".join(left))
if nocover:
    print("  not on the shelf (no cover uploaded, and Instagram refuses a reel\n"
          "  without one, so the row is held back rather than posted broken): "
          + ", ".join(nocover))
rows = kept

#  AND A LAST REFUSAL, BEFORE ANYTHING IS WRITTEN.
#  Whatever the reason, a run that would take films OFF the shelf that the
#  shelf already carries is a run that has gone wrong. It says so and writes
#  nothing, rather than leaving a merged file that looks ready to drag.
def shorts_in(path):
    """how many distinct films a shelf file carries. DISTINCT ids, not rows:
    collapsing a shelf that carried the same id twice is the merge doing its
    job, not a film going missing."""
    if not os.path.exists(path):
        return 0
    return len({c.get("id") for c in json.load(open(path, encoding="utf-8"))["cards"]
                if c.get("kind") == "short"})

#  measured against the shelf being merged into AND against what this folder
#  last produced, whichever knows about more films: on the owner's Mac the
#  first is a copy of main from before the films landed, so on its own it
#  would have noticed nothing.
had = max(shorts_in(index_path), shorts_in(os.path.join("out", "main", "reels", "index.json")))
if had:
    if len(rows) < had:
        sys.exit("\n  REFUSED: the shelf has %d films and this run could only\n"
                 "  account for %d. Nothing has been written. The usual cause is\n"
                 "  that the rendered masters (short-<name>-tall-30fps.mp4) are no\n"
                 "  longer in this folder, so there was nothing to upload.\n"
                 "  Render them again with ./plates.sh, then run this again."
                 % (had, len(rows)))
#  the rows file itself keeps the real URLs too, for anyone reading it by hand
open(rows_path, "w", encoding="utf-8").write(
    json.dumps(doc_rows, ensure_ascii=False, indent=1) + "\n")

#  MERGE into a COPY of reels/index.json: a row per id, replaced if it
#  already exists, appended otherwise; every other row untouched.
os.makedirs("out", exist_ok=True)
if os.path.exists(index_path):
    idx = json.load(open(index_path, encoding="utf-8"))
else:
    idx = {"n": 0, "written": "", "cards": []}
#  a shelf carrying the same id twice (an old merge bug, now fixed, could
#  still have left one behind) is collapsed to one row first, at the
#  position of its first appearance, holding whichever copy came last; a
#  dict keyed by id can otherwise only ever point at ONE of several rows
#  sharing an id, and every row after that one is never replaced and never
#  removed, so the id keeps posting whatever the stale copy still says.
by_id = {}
deduped = []
for c in idx["cards"]:
    cid = c.get("id")
    if not cid:
        deduped.append(c)
        continue
    if cid in by_id:
        deduped[by_id[cid]] = c
    else:
        by_id[cid] = len(deduped)
        deduped.append(c)
idx["cards"] = deduped
for row in rows:
    i = by_id.get(row["id"])
    if i is None:
        idx["cards"].append(row)
        by_id[row["id"]] = len(idx["cards"]) - 1
    else:
        idx["cards"][i] = row
idx["n"] = len(idx["cards"])
merged_path = os.path.join("out", "index.merged.json")
merged_text = json.dumps(idx, ensure_ascii=False, indent=1) + "\n"
open(merged_path, "w", encoding="utf-8").write(merged_text)
#  the same file under its real name, in a folder shaped like the repository,
#  so out/main can be dragged onto the upload page as it is
os.makedirs(os.path.join("out", "main", "reels"), exist_ok=True)
open(os.path.join("out", "main", "reels", "index.json"), "w", encoding="utf-8").write(merged_text)
print("  %d shorts uploaded, %d short rows now in %s (%d rows total)"
      % (n_uploaded, len(rows), merged_path, idx["n"]))

#  reels/home.json, the same way render_missing.py derives it: a silent
#  short carries no verse, so only its shorts count changes here, and that
#  count is what decides the afternoon row of the rota (README, "Shorts").
if os.path.exists(home_path):
    home = json.load(open(home_path, encoding="utf-8"))
    home["shorts"] = sum(1 for c in idx["cards"] if c.get("kind") == "short")
    home["written"] = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    hmerged_path = os.path.join("out", "home.merged.json")
    home_text = json.dumps(home, ensure_ascii=False, indent=1) + "\n"
    open(hmerged_path, "w", encoding="utf-8").write(home_text)
    open(os.path.join("out", "main", "reels", "home.json"), "w", encoding="utf-8").write(home_text)
    print("  %s rewritten: %d shorts on the shelf" % (hmerged_path, home["shorts"]))
PY
rm -f "$TMP"
echo
echo "  Next: out/main/reels/index.json is the shelf with the films on it."
echo "  Each film's cover went up beside its video and its row points at it,"
echo "  so there is nothing else to carry: a film with no cover on the shelf"
echo "  is not on the shelf at all, and cannot be posted broken."
echo "  Tell the Director it has finished and the shelf is committed for you."
echo
echo "  These words used to say to open out/main in Finder and drag it onto"
echo "  github.com/Eouchi147/noor/upload/main, because the house never pushed."
echo "  The owner lifted that on 17 September and the Director commits"
echo "  directly now. Do not drag out/main: it holds forty seven pages and"
echo "  the api scripts beside the shelf, and carrying all of it by hand is a"
echo "  way to put a stale copy of a page over a fresh one. The only file"
echo "  this run makes that belongs on main is out/main/reels/index.json,"
echo "  with out/main/reels/home.json beside it when that is rewritten too."
