#!/bin/sh
# NOOR Content Graph: rebuild the graph, validate it, and derive
# assets/entity-graph.json from it, in one command.
#
#   sh scripts/graph/run.sh [repo]
#
# Needs Node 22 (for the JavaScript data files) and Python 3. Writes only
# under <repo>/build/graph (git ignored, kept out of the Vercel deployment
# by .vercelignore's /build/ and /scripts/) and, at the last step, the one
# file the rooms read: assets/entity-graph.json. Run it whenever the Lights,
# the dictionary, the Path, the prophets, characters.js, places.js,
# words.js, unseen-data.js or the eight stories change (OPERATIONS.md).
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${1:-$(cd "$HERE/../.." && pwd)}"
OUT="$REPO/build/graph"

echo "1/4 extracting the JavaScript collections..."
node "$HERE/extract_js.mjs" "$REPO" "$OUT/out/js"

echo "2/4 building the graph..."
python3 "$HERE/build_graph.py" --repo "$REPO" --out "$OUT"

echo "3/4 validating it..."
python3 "$HERE/validate_graph.py" "$OUT/noor-content-graph.json"

echo "4/4 deriving assets/entity-graph.json..."
python3 "$HERE/derive_entity_graph.py" --graph "$OUT/noor-content-graph.json" --out "$REPO/assets/entity-graph.json"

python3 "$HERE/write_counts.py" --graph "$OUT/noor-content-graph.json" --file "$REPO/CONTENT_STATUS.md"

echo "done: $OUT/noor-content-graph.json, $REPO/assets/entity-graph.json, CONTENT_STATUS.md's generated block"
