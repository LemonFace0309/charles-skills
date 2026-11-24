#!/bin/bash
# Cards at chosen moments over a frame of the footage, cropped to the card, in a grid: the sheet a critic reads.
#   <kit>/sheet.sh <project> <out.png> <cols> <tile-width> <still>...   (still names from build/stills, no .png)
# Render the stills first: bun <explainers-kit>/render.mjs <project> --stills 0.3,1.2. Needs <project>/check/bg.png,
# a 2160x960 frame of the footage under the card.
set -euo pipefail
P="$(cd "$1" && pwd)"; out="$2"; cols="$3"; tw="$4"; shift 4
tmp="$P/build/sheet-tmp"; mkdir -p "$tmp"; find "$tmp" -name '*.png' -delete
n=0
for s in "$@"; do
  n=$((n+1))
  ffmpeg -y -loglevel error -i "$P/check/bg.png" -i "$P/build/stills/$s.png" -filter_complex "[0:v]scale=2160:960[bg];[bg][1:v]overlay=0:0,crop=1860:860:150:60,scale=$tw:-2:flags=area" "$tmp/$(printf %03d $n).png"
done
rows=$(( (n + cols - 1) / cols ))
ffmpeg -y -loglevel error -framerate 1 -pattern_type glob -i "$tmp/*.png" -vf "tile=${cols}x${rows}:padding=6:color=white" -frames:v 1 "$out"
echo "$out ($n)"
