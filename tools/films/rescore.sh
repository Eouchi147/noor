#!/bin/sh
#  NOOR - put a new score under films that are already rendered.
#
#      ./rescore.sh              every master in this folder
#      ./rescore.sh short-zero   one film
#
#  WHY THIS EXISTS. The score is muxed at render time, so changing the music
#  would ordinarily mean rendering forty four films again: about two and a
#  half hours of a Mac drawing pictures that were already correct. Nothing
#  about the picture changes when the music does. This writes the new score
#  and swaps the audio track, which is seconds a film rather than minutes.
#
#  shortmusic.py's own --mux looks for <slug>-<shape>-60fps.mp4 and the films
#  are rendered at 30, so it never finds them. That is why the swap is done
#  here instead of there.
#
#  WHAT IT TOUCHES. The masters in this folder, in place, after keeping a copy
#  of each under out/prescore/ the first time it sees it. Nothing else. The
#  delivery copies in out/deliver are NOT rebuilt: run publish-shorts.sh after
#  this, which will remake and re-upload them because their masters changed.
set -e

cd "$(dirname "$0")"
[ -d music ] || { echo "no music/ folder here"; exit 1; }
n=$(ls music/*.m4a music/*.mp3 music/*.wav music/*.flac music/*.aac music/*.ogg 2>/dev/null | wc -l | tr -d ' ')
[ "$n" -gt 0 ] || { echo "music/ is empty. Put the score files there first."; exit 1; }
echo "  $n score$([ "$n" = 1 ] || echo s) in music/:"
ls music/ | sed 's/^/    /'
echo

mkdir -p out/prescore

only="$1"
done_n=0
skipped=0
for f in short-*-tall-30fps.mp4; do
  [ -f "$f" ] || continue
  slug="${f%-tall-30fps.mp4}"
  [ -n "$only" ] && [ "$only" != "$slug" ] && continue
  [ -f "films/$slug.json" ] || { echo "  $slug has no compiled film, skipped"; skipped=$((skipped+1)); continue; }

  echo "  $slug"
  #  the score, written once and used for both shapes
  python3 shortmusic.py "$slug" >/dev/null || { echo "    score failed"; skipped=$((skipped+1)); continue; }
  wav="out/$slug.wav"
  [ -f "$wav" ] || { echo "    no $wav"; skipped=$((skipped+1)); continue; }

  for shape in tall wide; do
    mp4="${slug}-${shape}-30fps.mp4"
    [ -f "$mp4" ] || continue
    #  the picture as it was before the music changed, kept once
    [ -f "out/prescore/$mp4" ] || cp "$mp4" "out/prescore/$mp4"
    tmp="_rescore-${slug}-${shape}.mp4"
    ffmpeg -y -hide_banner -loglevel error \
      -i "out/prescore/$mp4" -i "$wav" \
      -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -ar 48000 -ac 2 -b:a 192k \
      -shortest -movflags +faststart "$tmp" \
      && mv "$tmp" "$mp4" \
      && echo "    $shape rescored" \
      || { echo "    $shape FAILED"; rm -f "$tmp"; }
  done
  done_n=$((done_n+1))
done

echo
echo "  $done_n film$([ "$done_n" = 1 ] || echo s) rescored, $skipped skipped."
echo "  The pictures before the music changed are in out/prescore, so this"
echo "  can be run again against a different set of scores without losing"
echo "  anything, and running it twice does not stack two scores."
echo
echo "  Next: ./publish-shorts.sh, which will see the masters have changed,"
echo "  remake the delivery copies and put them back on the shelf."
