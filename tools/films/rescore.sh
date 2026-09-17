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
#
#  THREE FAULTS THE FIRST VERSION HAD, all of the same family: a step did
#  nothing and the next step believed it.
#
#  1. IT TRUSTED A WAV IT DID NOT MAKE. shortmusic.py leaves out/<slug>.wav
#     behind from previous runs. The first real use of this script ran on a
#     machine where python could not read its own script file, so shortmusic
#     exited zero having written nothing, and the mux happily picked up a wav
#     from the night before, made from the OLD music, and reported success
#     for every film. Each wav is now deleted before its film is scored and
#     its existence checked after, so a score that was not made cannot be
#     mistaken for one that was.
#
#  2. IT BUILT A FILENAME THAT COULD NOT EXIST. The slug already carries its
#     "short-" prefix; a second one was being added, so every mux target was
#     a file that was not there, [ -f ] skipped it without a word, and the
#     loop counted the film done. Nineteen films were reported rescored and
#     nineteen files were never opened. A film that matches no master is now
#     an error that is named, not a silent pass.
#
#  3. IT TRUSTED THE BACKUP COPY. One cp came across truncated, 28 MB of a
#     192 MB film, and ffmpeg then failed on it. That failure was caught, but
#     only by luck: a backup that is short is not a backup, so it is now
#     compared byte for byte against the master before anything is muxed from
#     it, and the master is left alone if it is not right.
set -u

cd "$(dirname "$0")" || exit 1
[ -d music ] || { echo "no music/ folder here"; exit 1; }
n=$(ls music/*.m4a music/*.mp3 music/*.wav music/*.flac music/*.aac music/*.ogg 2>/dev/null | wc -l | tr -d ' ')
[ "$n" -gt 0 ] || { echo "music/ is empty. Put the score files there first."; exit 1; }
echo "  $n score$([ "$n" = 1 ] || echo s) in music/:"
ls music/ | sed 's/^/    /'
echo

mkdir -p out/prescore

only="${1:-}"
done_n=0
failed=""
for f in short-*-tall-30fps.mp4; do
  [ -f "$f" ] || continue
  slug="${f%-tall-30fps.mp4}"
  [ -n "$only" ] && [ "$only" != "$slug" ] && continue
  [ -s "films/$slug.json" ] || { failed="$failed $slug(no-compiled-film)"; continue; }

  echo "  $slug"
  #  1: never trust a wav this run did not write
  rm -f "out/$slug.wav"
  python3 shortmusic.py "$slug" >/dev/null 2>&1
  if [ ! -s "out/$slug.wav" ]; then
    echo "    score failed, nothing written, master left alone"
    failed="$failed $slug(no-score)"
    continue
  fi

  shapes=0
  ok=1
  for shape in tall wide; do
    #  2: the slug already says "short-"
    mp4="${slug}-${shape}-30fps.mp4"
    [ -f "$mp4" ] || continue
    shapes=$((shapes + 1))
    pre="out/prescore/$mp4"
    #  3: a short backup is not a backup. A copy made NOW must match the
    #  master byte for byte; one that was already there is from an earlier
    #  run and holds the picture as it was before any score was swapped, so
    #  its size is its own and only its emptiness would be a fault.
    if [ ! -f "$pre" ]; then
      want=$(wc -c < "$mp4" | tr -d ' ')
      cp "$mp4" "$pre" 2>/dev/null
      got=$(wc -c < "$pre" 2>/dev/null | tr -d ' ')
      if [ "${got:-0}" != "$want" ]; then
        echo "    $shape: the backup came across as ${got:-0} of $want bytes, master left alone"
        failed="$failed $slug/$shape(bad-backup)"
        ok=0
        continue
      fi
    fi
    if [ ! -s "$pre" ]; then
      echo "    $shape: the backup is empty, master left alone"
      failed="$failed $slug/$shape(empty-backup)"
      ok=0
      continue
    fi
    tmp="_rescore-${slug}-${shape}.mp4"
    if ffmpeg -y -hide_banner -loglevel error \
        -i "$pre" -i "out/$slug.wav" \
        -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -ar 48000 -ac 2 -b:a 192k \
        -shortest -movflags +faststart "$tmp" 2>/dev/null && [ -s "$tmp" ]; then
      if mv "$tmp" "$mp4"; then
        echo "    $shape rescored"
      else
        echo "    $shape: could not replace the master"
        failed="$failed $slug/$shape(mv)"
        ok=0
      fi
    else
      echo "    $shape FAILED"
      rm -f "$tmp"
      failed="$failed $slug/$shape(ffmpeg)"
      ok=0
    fi
  done

  if [ "$shapes" -eq 0 ]; then
    echo "    no master of any shape matched this film"
    failed="$failed $slug(no-master-matched)"
    continue
  fi
  [ "$ok" -eq 1 ] && done_n=$((done_n + 1))
done

echo
echo "  $done_n film$([ "$done_n" = 1 ] || echo s) rescored."
if [ -n "$failed" ]; then
  echo "  NOT done:$failed"
  echo "  Every master named there was left exactly as it was."
fi
echo "  The pictures before the music changed are in out/prescore, so this"
echo "  can be run again against a different set of scores without losing"
echo "  anything, and running it twice does not stack two scores."
echo
echo "  Next: ./publish-shorts.sh, which will see the masters have changed,"
echo "  remake the delivery copies and put them back on the shelf."
