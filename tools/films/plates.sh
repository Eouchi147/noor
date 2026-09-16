#!/bin/bash
#  Render every PLATE short: compile the brief, render the picture, write the
#  score, lay it under. Both shapes, one at a time with eight workers each,
#  because the workers already use every core. Frames are never redone, so
#  control-C and running this again picks up exactly where it stopped.
#
#      ./plates.sh                 every briefs/plate-*.json
#      ./plates.sh plate-darkroom  just that one
cd "$(dirname "$0")" || exit 1
source .venv/bin/activate || { echo "no venv. Run SETUP.command first."; exit 1; }
mkdir -p out
if [ -n "$1" ]; then LIST="$1"; else
  LIST=$(ls briefs/plate-*.json | sed 's#briefs/##;s#\.json##'); fi
N=$(echo "$LIST" | wc -l | tr -d ' ')
i=0
for b in $LIST; do
  i=$((i+1))
  s=$(python3 -c "import json,sys;print(json.load(open('briefs/$b.json'))['slug'])")
  echo
  echo "=============================================================="
  echo "  [$i/$N]  $b  ->  $s"
  echo "=============================================================="
  python3 shortplate.py "briefs/$b.json" || { echo "  brief rejected, skipping"; continue; }
  for shape in tall wide; do
    python3 noor.py --film "$s" --shape "$shape" --workers 8 --encode --fps 30 --shutter 3 \
      || { echo "  RENDER FAILED: $s ($shape)"; continue 2; }
    rm -f "out/$s.wav"
    #  shortmusic.py's own --mux is not this script's file to change, and it
    #  always looks for and writes back to <slug>-<shape>-60fps.mp4 -- a
    #  number set when every short rendered at 60. The picture here is
    #  genuinely 30 fps, so it borrows that name just long enough to be
    #  found and muxed, and is handed its true name back the moment the
    #  mux is done.
    mv -f "$s-$shape-30fps.mp4" "$s-$shape-60fps.mp4"
    python3 shortmusic.py "$s" --mux --shape "$shape" || echo "  SCORE FAILED: $s ($shape)"
    mv -f "$s-$shape-60fps.mp4" "$s-$shape-30fps.mp4"
  done
done
echo
echo "  done. The finished shorts are the *-30fps.mp4 files in this folder."
