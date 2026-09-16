#!/bin/bash
#  Render every silent short, then score it, then lay the score under it.
#
#  One at a time and eight workers each, because the workers already use
#  every core: two films at once would not be twice as fast, it would be the
#  same speed with twice the memory. Frames are never redone, so control-C
#  and running this again picks up exactly where it stopped.
cd "$(dirname "$0")" || exit 1
source .venv/bin/activate || { echo "no venv. Run SETUP.command first."; exit 1; }
mkdir -p out
LIST=$(ls briefs/short-*.json | sed 's#briefs/##;s#\.json##')
N=$(echo "$LIST" | wc -l | tr -d ' ')
i=0
for s in $LIST; do
  i=$((i+1))
  echo
  echo "=============================================================="
  echo "  [$i/$N]  $s"
  echo "=============================================================="
  python3 shorts.py "briefs/$s.json" || { echo "  brief rejected, skipping"; continue; }
  python3 noor.py --film "$s" --shape tall --workers 8 --encode || { echo "  RENDER FAILED: $s"; continue; }
  #  the score is a pure function of the film file, so if one is already
  #  sitting in out/ it is the right one and re-synthesising it is forty
  #  seconds thrown away. Delete the wav to force it to be made again.
  if [ -f "out/$s.wav" ]; then echo "  score already written, laying it under"; fi
  if python3 shortscore.py "$s" --mux --shape tall; then
    #  ONE FILE OUT, NOT TWO.
    #  noor.py writes the silent picture and shortscore.py lays the score
    #  under it as a second file, so the folder ended up with two mp4s per
    #  short whose names differ by one word. The silent one sorts first, so
    #  the first thing you double click is the one with no sound. It is also
    #  220 MB that is now duplicated: fifteen shorts is three spare gigabytes
    #  on a disk with twelve. The picture only exists to be scored, so once
    #  it has been, it goes.
    rm -f "$s-tall-60fps.mp4"
  else
    echo "  SCORE FAILED: $s  (the silent picture is kept so you can retry)"
  fi
done
echo
echo "=============================================================="
echo "  done. Finished films:"
ls -la short-*-tall-60fps-scored.mp4 2>/dev/null | awk '{printf "    %8.1f MB  %s\n", $5/1048576, $9}'
echo "=============================================================="
