#!/bin/sh
# NOOR Content Graph: rebuild the graph, validate it, and derive
# assets/entity-graph.json, assets/person-words.json and
# assets/reel-subjects.json from it, in one command.
#
#   sh scripts/graph/run.sh [repo]
#
# Needs Node 22 (for the JavaScript data files) and Python 3. Writes only
# under <repo>/build/graph (git ignored, kept out of the Vercel deployment
# by .vercelignore's /build/ and /scripts/) and, at the last three steps,
# the files the rooms and the insights read: assets/entity-graph.json,
# assets/person-words.json and assets/reel-subjects.json. Run it whenever
# the Lights, the dictionary, the Path, the prophets, characters.js,
# places.js, words.js, unseen-data.js, the eight stories, the reels'
# shelf (reels/index.json), or scripts/graph/same-as.json change
# (OPERATIONS.md).
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${1:-$(cd "$HERE/../.." && pwd)}"
OUT="$REPO/build/graph"

echo "1/6 extracting the JavaScript collections..."
node "$HERE/extract_js.mjs" "$REPO" "$OUT/out/js"

echo "2/6 building the graph..."
python3 "$HERE/build_graph.py" --repo "$REPO" --out "$OUT"

echo "3/6 validating it..."
python3 "$HERE/validate_graph.py" "$OUT/noor-content-graph.json"

echo "4/6 deriving assets/entity-graph.json..."
python3 "$HERE/derive_entity_graph.py" --graph "$OUT/noor-content-graph.json" --out "$REPO/assets/entity-graph.json"

echo "5/6 deriving assets/person-words.json..."
python3 "$HERE/derive_person_words.py" --same-as "$HERE/same-as.json" --out "$REPO/assets/person-words.json"

echo "6/6 deriving assets/reel-subjects.json..."
python3 "$HERE/derive_reel_subjects.py" --repo "$REPO" --out "$REPO/assets/reel-subjects.json"

python3 "$HERE/write_counts.py" --graph "$OUT/noor-content-graph.json" --file "$REPO/CONTENT_STATUS.md"

echo "done: $OUT/noor-content-graph.json, $REPO/assets/entity-graph.json, $REPO/assets/person-words.json, $REPO/assets/reel-subjects.json, CONTENT_STATUS.md's generated block"
