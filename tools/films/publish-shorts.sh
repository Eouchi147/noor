#!/bin/bash
#  Put the finished shorts on the shelf and write the merged manifest.
#
#  THE TOKEN IS NEVER IN THIS FILE AND NEVER PASSES THROUGH CLAUDE.
#  blob.mjs reads BLOB_READ_WRITE_TOKEN out of the environment. Set it in
#  your own shell before running this, the same one the reels workflow uses:
#
#      export BLOB_READ_WRITE_TOKEN=...        (you type this, nobody else)
#      ./publish-shorts.sh
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
cd "$(dirname "$0")" || exit 1
BLOB="../reels/blob.mjs"
[ -f "$BLOB" ] || { echo "blob.mjs not found at $BLOB"; exit 1; }
[ -n "$BLOB_READ_WRITE_TOKEN" ] || { echo "BLOB_READ_WRITE_TOKEN is not set. Export it first."; exit 1; }
command -v ffmpeg >/dev/null 2>&1 || { echo "ffmpeg not found on PATH."; exit 1; }

ROWS=out/shorts-rows.json
INDEX=../../reels/index.json
#  HOME, not HOMEJSON, was the shell's own HOME the moment this file was
#  first written: reassigning it (bash keeps a variable exported once it
#  already is, which HOME always is) handed every child process below --
#  ffmpeg, node, python3 -- a working directory named reels/home.json
#  instead of a real home. Named HOMEJSON so nothing here ever touches it.
HOMEJSON=../../reels/home.json
DELIVER=out/deliver
MAXBYTES=52428800
mkdir -p "$DELIVER"
python3 shortmanifest.py >/dev/null || exit 1

#  $1 the rendered master, $2 the delivery copy to make or reuse.
make_delivery_copy() {
  local master="$1" copy="$2"
  if [ -f "$copy" ] && [ "$copy" -nt "$master" ]; then
    return 0
  fi
  ffmpeg -y -loglevel error -i "$master" -c:v libx264 -preset slow -crf 21 \
    -pix_fmt yuv420p -movflags +faststart -c:a copy "$copy"
}

#  $1 the delivery copy, $2 the blob pathname. Prints the URL on success;
#  prints nothing and returns non zero when the copy is over the ceiling
#  or the upload itself fails.
upload_capped() {
  local copy="$1" dest="$2" bytes
  bytes=$(wc -c < "$copy")
  if [ "$bytes" -gt "$MAXBYTES" ]; then
    echo "    $copy is $bytes bytes, over the 50 MB ceiling, skipped" >&2
    return 1
  fi
  node "$BLOB" put "$copy" "$dest" | tail -1
}

TMP=$(mktemp)
echo "[" > "$TMP"
first=1
for f in short-*-tall-30fps.mp4; do
  [ -f "$f" ] || continue
  slug="${f%-tall-30fps.mp4}"
  tallcopy="$DELIVER/${slug}-tall.mp4"
  make_delivery_copy "$f" "$tallcopy" || { echo "    ffmpeg failed on $f"; continue; }
  echo "  uploading $slug"
  url=$(upload_capped "$tallcopy" "reels/$slug.mp4") || continue
  case "$url" in https://*) ;; *) echo "    upload failed: $url"; continue;; esac
  wideurl=""
  wf="${slug}-wide-30fps.mp4"
  if [ -f "$wf" ]; then
    widecopy="$DELIVER/${slug}-wide.mp4"
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
    printf '  {"id":"%s","video":"%s","wide":"%s"}' "$slug" "$url" "$wideurl" >> "$TMP"
  else
    printf '  {"id":"%s","video":"%s"}' "$slug" "$url" >> "$TMP"
  fi
done
echo "" >> "$TMP"; echo "]" >> "$TMP"

python3 - "$TMP" "$ROWS" "$INDEX" "$HOMEJSON" <<'PY'
import datetime, json, os, sys
up_path, rows_path, index_path, home_path = sys.argv[1:5]
up = {r["id"]: r for r in json.load(open(up_path, encoding="utf-8"))}
doc_rows = json.load(open(rows_path, encoding="utf-8"))
rows = doc_rows["cards"]
n_uploaded = 0
for row in rows:
    u = up.get(row["id"])
    if not u:
        continue
    row["video"] = u["video"]
    if u.get("wide"):
        row["wide"] = u["wide"]
    n_uploaded += 1
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
open(merged_path, "w", encoding="utf-8").write(
    json.dumps(idx, ensure_ascii=False, indent=1) + "\n")
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
    open(hmerged_path, "w", encoding="utf-8").write(
        json.dumps(home, ensure_ascii=False, indent=1) + "\n")
    print("  %s rewritten: %d shorts on the shelf" % (hmerged_path, home["shorts"]))
PY
rm -f "$TMP"
echo
echo "  Next: hand out/index.merged.json to the Director, to be uploaded to"
echo "  main as reels/index.json (and out/home.merged.json as reels/home.json,"
echo "  if it was written). The house never pushes: this is the file to carry,"
echo "  the same way every other reels update reaches main."
