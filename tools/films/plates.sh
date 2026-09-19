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

    #  ---- AND DROP THIS FILM'S OLDER FRAME GENERATIONS -------------------
    #  The frames cache is keyed on a hash of the film, the page, spec.py and
    #  every hand written file in web/. That is the right key: edit a line of
    #  a film or a line of the motion engine and the old frames are no longer
    #  the film, so a fresh cache is started and resuming stays honest.
    #
    #  Nothing ever removed the cache that was left behind. By 19 September
    #  there were 178 frame directories on the owner's Mac for 82 films, and
    #  96 of them belonged to builds that no longer existed and could never
    #  be reused again: 48.7 GB, quietly, with the disk at 98 percent and no
    #  room to render eleven more films. Every engine change had cost a
    #  generation of every film in the library.
    #
    #  So a film drops its own older generations once its current ones have
    #  actually been drawn. Three things keep it narrow. It runs only after
    #  the encode and the mux, so the master exists. It asks noor.py itself
    #  where the current frames are rather than working the hash out again
    #  here, which is how a copy of a rule drifts from the rule. And it does
    #  nothing at all unless that current directory is really on disk, so a
    #  failed render or an unanswered question can never be read as "none of
    #  these are current, remove them all".
    keep=$(python3 noor.py --film "$s" --shape "$shape" --fps 30 --cells 2>/dev/null)
    keep=$(basename "${keep:-none}")
    if [ -n "$keep" ] && [ -d "frames/$keep" ]; then
      for d in frames/"$s"-"$shape"-30fps-*; do
        [ -d "$d" ] || continue
        [ "$(basename "$d")" = "$keep" ] && continue
        sz=$(du -sk "$d" 2>/dev/null | cut -f1)
        if rm -rf "$d"; then
          echo "  dropped an older frame cache, $(( ${sz:-0} / 1024 )) MB: $(basename "$d")"
        fi
      done
    fi
  done
done
echo
echo "  done. The finished shorts are the *-30fps.mp4 files in this folder."
