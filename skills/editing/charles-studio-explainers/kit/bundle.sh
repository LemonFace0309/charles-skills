#!/bin/bash
# Joins this kit's studio.js, the project's scenes/src/*.js (one builder per card) and studio-card.js into the
# project's scenes/cards.js, and copies the fonts the cards use into the project's fonts/.
#   <kit>/bundle.sh <project>        (the project is the explainers folder holding explain.json)
set -euo pipefail
KIT="$(cd "$(dirname "$0")" && pwd)"
P="$(cd "${1:-.}" && pwd)"
mkdir -p "$P/scenes" "$P/fonts"
cp -n "$KIT"/fonts/*.woff2 "$P/fonts/" 2>/dev/null || true
{ echo "/* Built by charles-studio-explainers/kit/bundle.sh. Edit scenes/src/, not this file. */"
  cat "$KIT/studio.js"; echo
  for f in "$P"/scenes/src/*.js; do cat "$f"; echo; done
  cat "$KIT/studio-card.js"; } > "$P/scenes/cards.js"
echo "$P/scenes/cards.js: $(wc -l < "$P/scenes/cards.js") lines"
