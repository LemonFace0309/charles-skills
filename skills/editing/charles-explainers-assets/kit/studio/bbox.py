#!/usr/bin/env python3
"""The visible bounds of each object PNG (alpha > 24), as fractions of its width and height: x0 y0 x1 y1.
    python3 <kit>/bbox.py gen/*-512.png
Place objects by these, not by the image box: stacking, dropping into a cup and resting on a shadow need real edges."""
import sys
from PIL import Image

for f in sys.argv[1:]:
    im = Image.open(f).convert("RGBA")
    a = im.getchannel("A").point(lambda v: 255 if v > 24 else 0)
    box = a.getbbox()
    if not box:
        print(f, "empty")
        continue
    w, h = im.size
    print(f.split("/")[-1], " ".join(f"{v:.3f}" for v in (box[0] / w, box[1] / h, box[2] / w, box[3] / h)))
