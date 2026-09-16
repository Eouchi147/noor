#!/bin/bash
#  Render every PLATE short: compile the brief, render the picture, write the
#  score, lay it under. One at a time with eight workers each, because the
#  workers already use every core. Frames are never redone, so control-C and
#  running this again picks up exactly where it stopped.
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
  python3 noor.py --film "$s" --shape tall --workers 8 --encode || { echo "  RENDER FAILED: $s"; continue; }
  rm -f "out/$s.wav"
  python3 shortmusic.py "$s" --mux --shape tall || echo "  SCORE FAILED: $s"
done
echo
echo "  done. The finished shorts are the *-tall-60fps.mp4 files in this folder."
