#!/bin/bash
#  Put the finished shorts on the shelf and write the manifest rows.
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
#  reels shelf runs on and it is why the manifest does not have to be rebuilt
#  when a picture is remade.
cd "$(dirname "$0")" || exit 1
BLOB="../reels/blob.mjs"
[ -f "$BLOB" ] || { echo "blob.mjs not found at $BLOB"; exit 1; }
[ -n "$BLOB_READ_WRITE_TOKEN" ] || { echo "BLOB_READ_WRITE_TOKEN is not set. Export it first."; exit 1; }

ROWS=out/shorts-rows.json
python3 shortmanifest.py >/dev/null || exit 1
TMP=$(mktemp)
echo "[" > "$TMP"
first=1
for f in short-*-tall-60fps-scored.mp4; do
  [ -f "$f" ] || continue
  slug="${f%-tall-60fps-scored.mp4}"
  echo "  uploading $slug"
  url=$(node "$BLOB" put "$f" "reels/$slug.mp4" | tail -1)
  case "$url" in https://*) ;; *) echo "    upload failed: $url"; continue;; esac
  [ $first -eq 1 ] || echo "," >> "$TMP"; first=0
  printf '  {"id":"%s","video":"%s"}' "$slug" "$url" >> "$TMP"
done
echo "" >> "$TMP"; echo "]" >> "$TMP"

python3 - "$TMP" "$ROWS" <<'PY'
import json, sys
up = {r["id"]: r["video"] for r in json.load(open(sys.argv[1], encoding="utf-8"))}
doc = json.load(open(sys.argv[2], encoding="utf-8"))
n = 0
for row in doc["cards"]:
    if row["id"] in up:
        row["video"] = up[row["id"]]; n += 1
open(sys.argv[2], "w", encoding="utf-8").write(json.dumps(doc, ensure_ascii=False, indent=1) + "\n")
print("  %d of %d rows now carry a live URL -> %s" % (n, len(doc["cards"]), sys.argv[2]))
PY
rm -f "$TMP"
echo
echo "  Next: merge out/shorts-rows.json into reels/index.json (the cards array)"
echo "  and open a pull request, the same way the reels workflow does."
