#!/bin/bash
# Joins this kit's studio.js, the project's scenes/src/*.js (one builder per card) and studio-card.js into the
# project's scenes/cards.js, copies the fonts the cards use into the project's fonts/, and locks the project to the kit
# it was built with.
#   <kit>/bundle.sh <project> [--update-kit] [--no-card]      (the project is the explainers folder holding explain.json)
#   --no-card: the project brings its own card in scenes/src/ for another slot (design hacks part 2's 99-card.js for
#   the hack-reel card), so the kit's studio-card.js, the term card, isn't appended.
#
# Why the lock: re-rendering an old project with today's kit changes the finished cards (grain, colours, timing) even
# when nothing in the project changed. So the first bundle writes <project>/kit.lock (a content hash of every kit file
# it uses) and stamps the hash into scenes/cards.js. Later bundles refuse when the kit has changed since, and print
# which files did; --update-kit takes the new kit on purpose. A project bundled before locks existed is checked by
# comparing the studio.js inside its scenes/cards.js with today's.
set -euo pipefail
KIT="$(cd "$(dirname "$0")" && pwd)"
P="$(cd "${1:-.}" && pwd)"
UPDATE=0; CARD=1
for a in "${@:2}"; do
  case "$a" in
    --update-kit) UPDATE=1 ;;
    --no-card) CARD=0 ;;
    *) echo "unknown option: $a (use --update-kit or --no-card)" >&2; exit 2 ;;
  esac
done

hash() { if command -v shasum >/dev/null; then shasum -a 256 "$@"; else sha256sum "$@"; fi; }
FILES=(studio.js studio-card.js)
for f in "$KIT"/fonts/*.woff2; do FILES+=("fonts/$(basename "$f")"); done
LOCK_NOW="$(cd "$KIT" && for f in "${FILES[@]}"; do printf '%s %s\n' "$(hash "$f" | cut -c1-16)" "$f"; done)"
KIT_HASH="$(printf '%s\n' "$LOCK_NOW" | hash | cut -c1-12)"
LOCK="$P/kit.lock"
CARDS="$P/scenes/cards.js"

refuse() {
  echo "The studio kit changed since $(basename "$P") was bundled: $1." >&2
  echo "Re-rendering now would change the finished cards (grain, colours, timing) though nothing in the project changed." >&2
  echo "To take the new kit on purpose: $0 $P --update-kit, then compare an untouched card against the last export." >&2
  exit 1
}

if [ "$UPDATE" = 0 ]; then
  if [ -f "$LOCK" ]; then
    WAS="$(grep -v '^#' "$LOCK" | grep -v '^kit ')"
    if [ "$WAS" != "$LOCK_NOW" ]; then
      CHANGED="$( { diff <(printf '%s\n' "$WAS") <(printf '%s\n' "$LOCK_NOW") || true; } | grep '^[<>]' | awk '{print $3}' | sort -u | paste -sd ', ' - || true)"
      refuse "${CHANGED:-the file list}"
    fi
  elif [ -f "$CARDS" ]; then
    # Bundled before locks: the kit's studio.js sits right after the one-line header, byte for byte.
    N=$(wc -c < "$KIT/studio.js")
    if [ "$(tail -n +2 "$CARDS" | head -c "$N" | hash | cut -c1-64)" != "$(hash "$KIT/studio.js" | cut -c1-64)" ]; then
      refuse "studio.js differs from the copy inside scenes/cards.js (no kit.lock yet)"
    fi
  fi
fi

mkdir -p "$P/scenes" "$P/fonts"
if [ "$UPDATE" = 1 ]; then cp -f "$KIT"/fonts/*.woff2 "$P/fonts/"; else cp -n "$KIT"/fonts/*.woff2 "$P/fonts/" 2>/dev/null || true; fi
{ echo "/* Built by charles-explainers-assets/kit/studio/bundle.sh from kit $KIT_HASH. Edit scenes/src/, not this file. */"
  cat "$KIT/studio.js"; echo
  for f in "$P"/scenes/src/*.js; do cat "$f"; echo; done
  if [ "$CARD" = 1 ]; then cat "$KIT/studio-card.js"; fi; } > "$CARDS"
{ echo "# The studio kit (charles-explainers-assets/kit/studio) this project was bundled with. bundle.sh refuses to rebuild when the kit"
  echo "# changes; --update-kit takes the new kit. Hashes are the first 16 hex digits of each file's SHA-256."
  echo "kit $KIT_HASH"
  printf '%s\n' "$LOCK_NOW"; } > "$LOCK"
echo "$CARDS: $(wc -l < "$CARDS") lines, kit $KIT_HASH$([ "$UPDATE" = 1 ] && echo ' (updated)')"
