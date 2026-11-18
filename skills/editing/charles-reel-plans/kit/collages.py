"""A list reel's collages: each item's 2-4 real images laid out under his chin like prints dropped on a table.

  python3 -I <skill>/kit/collages.py <video folder>              # every group in the composites file -> <composites_dir>/<group>.png
  python3 -I <skill>/kit/collages.py <video folder> 2013 2024    # just these groups
  python3 -I <skill>/kit/collages.py <video folder> --sheet      # also build/contact-sheet.jpg, every collage on one sheet

The zone, the safe rectangle and the seed come from edit/plan.json's "list" block ("zone", "safe", "seed"); the composites
file is plan.json's "composites" (default edit/collages.json) and the output folder its "composites_dir" (default
assets/collages).

The layout is ../eradicating-ai-slop/backgrounds/tools/list_reel.py's: the same zone under the chin, the same seeded search
over sizes, tilts and overlaps, the same scoring (the pick biggest and least covered, nothing important under Instagram's
caption or buttons, every image touching another). One rule is added: logo cards lie on top like stickers and stay 90%
visible, because half a wordmark doesn't read. And found images are framed by kind, so they read as objects:

  screen   a UI or web capture: as it is, with a soft shadow
  photo    a photograph: a thin white print border
  art      a poster, cover or artwork: a thin white print border
  logo     a transparent logo: centred on a white card
  cutout   a transparent object (a phone, an app icon): no frame, the shadow follows its shape

Each PNG is the zone plus a 40 px margin, at 2x (2100x1160 for the default zone), placed at (zone x - 40, zone y - 40) on the
1080x1920 grid: the same canvas and position list_reel.py composites, so the edit can lay these over the cut as they are.
layout.json keeps every rectangle.

Nothing may cover another image's subject (Charles, 16 Nov 2026: "make sure the overlap ... don't cover core subjects").
Each image has a focus box, the part that has to stay in view, and a layout where anything lies over more than 1.5% of a
focus box is thrown out, so images only overlap at their edges. By default the focus is the inner 80% of the image, and
nearly all of it for the pick. Give an image its own "focus" when its subject sits off-centre (Nyan Cat's face at the
right) or when it's a card of words that must all show.

The composites file: [{"group": "2006", "label": "...", "seed": optional, "images": [{"file": "assets/years/2006/1-x.png",
"kind": "screen", "scale": optional size factor, "top": true to lie on top like a sticker, "focus": [x0, y0, x1, y1] as
fractions of the image}, ...]}, ...], the pick first. Paths are relative to the video folder.
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

args = [a for a in sys.argv[1:] if not a.startswith("--")]
vd = Path(args[0] if args else ".").resolve()
PLAN = json.loads((vd / "edit/plan.json").read_text())
LIST = PLAN.get("list") or {}
K = 2
ZX0, ZY0, ZX1, ZY1 = LIST.get("zone", [50, 1150, 1020, 1650])   # where any corner may go: under his chin, clear of the stopwatch
SAFE_L, SAFE_R, SAFE_B = LIST.get("safe", [70, 950, 1500])      # what counts as seen: left of Instagram's buttons, above its caption
MAX_UNDER = 0.3
MAX_ON_FOCUS = 0.015                            # how much of a focus box anything may lie over
FOCUS = {"pick": [0.06, 0.06, 0.94, 0.94], "logo": [0.05, 0.05, 0.95, 0.95], "cutout": [0.12, 0.12, 0.88, 0.88],
         "default": [0.1, 0.1, 0.9, 0.9]}
PAD = 40
SC = 4                                          # the layout search rasterises at 1/4 scale
SEED = LIST.get("seed", 7)
HN = "/System/Library/Fonts/HelveticaNeue.ttc"
OUT = vd / PLAN.get("composites_dir", "assets/collages")


def frame(im, kind):
    """The image as it lies in the collage, RGBA at its own resolution."""
    im = im.convert("RGBA")
    w, h = im.size
    if kind in ("photo", "art"):
        b = max(6, round(min(w, h) * 0.028))
        out = Image.new("RGBA", (w + 2 * b, h + 2 * b), (255, 255, 255, 255))
        out.alpha_composite(im, (b, b))
        return out
    if kind == "logo":
        bbox = im.getchannel("A").getbbox() or (0, 0, w, h)
        im = im.crop(bbox)
        w, h = im.size
        pad = round(max(w, h) * 0.2)
        cw, ch = w + 2 * pad, h + 2 * pad
        if cw / ch > 2.4:                        # a long wordmark gets a taller card, not a strip
            ch = round(cw / 2.4)
        if cw / ch < 1.0:                        # an icon gets a square card
            cw = ch
        card = Image.new("RGBA", (cw, ch), (255, 255, 255, 255))
        card.alpha_composite(im, ((cw - w) // 2, (ch - h) // 2))
        return card
    if kind == "cutout":
        bbox = im.getchannel("A").getbbox()
        return im.crop(bbox) if bbox else im
    return im                                    # screen


def corners(cx, cy, w, h, deg):
    a = math.radians(deg)
    ca, sa = math.cos(a), math.sin(a)
    return [(cx + dx * ca - dy * sa, cy + dx * sa + dy * ca) for dx, dy in ((-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2))]


def mask(poly):
    m = Image.new("L", ((ZX1 - ZX0) // SC + 2, (ZY1 - ZY0) // SC + 2))
    ImageDraw.Draw(m).polygon([((x - ZX0) / SC, (y - ZY0) / SC) for x, y in poly], fill=1)
    return np.asarray(m, bool)


def size_of(rng, w0, h0, hero, shrink, kind):
    asp = w0 / h0
    if kind == "logo":                           # a card reads at a smaller size than a screen
        shrink *= 0.72
    elif kind == "cutout":
        shrink *= 0.9
    if asp >= 1.25:                              # a desktop or tablet screen
        w = rng.uniform(*((500, 570) if hero else (380, 450))) * shrink
        return w, w / asp
    if asp <= 0.75:                              # a phone screen or a tall photo
        h = rng.uniform(*((390, 440) if hero else (350, 410))) * shrink
        return h * asp, h
    side = rng.uniform(*((340, 390) if hero else (280, 330))) * shrink
    return side * math.sqrt(asp), side / math.sqrt(asp)


def focus_poly(rect, f):
    """The focus box (fractions of the image) as a polygon, turned with the image."""
    cx, cy, w, h, deg = rect
    lx, ly = ((f[0] + f[2]) / 2 - 0.5) * w, ((f[1] + f[3]) / 2 - 0.5) * h
    a = math.radians(deg)
    return corners(cx + lx * math.cos(a) - ly * math.sin(a), cy + lx * math.sin(a) + ly * math.cos(a),
                   (f[2] - f[0]) * w, (f[3] - f[1]) * h, deg)


def layout(n, seed, shapes, kinds, scales, prev=None, tops=None, focus=None):
    """shapes: [(w, h)] framed, the pick first. Returns (order, rects): rects[j] = (cx, cy, w, h, deg), order bottom first.
    The first pass is list_reel.py's search exactly. Only if nothing fits (four big images can fill the safe height on their
    own) does it try again with the whole set a little smaller each time."""
    focus = focus or [FOCUS["pick"] if j == 0 else FOCUS.get(k, FOCUS["default"]) for j, k in enumerate(kinds)]
    for step in range(6):
        found = search(n, seed, shapes, kinds, scales, prev, 0.92 ** step, tops or [False] * len(shapes), focus)
        if found:
            return found
    raise AssertionError(f"no layout fits item {n}, even at {0.92 ** 5:.2f}x: drop an image or give one a smaller scale")


def search(n, seed, shapes, kinds, scales, prev, fit, tops, focus):
    stick = [k == "logo" or t for k, t in zip(kinds, tops)]   # logo cards and images marked "top" lie on top, like stickers
    rng = np.random.default_rng([SEED, seed if seed is not None else n])
    count = len(shapes)
    shrink = {2: 1.12, 3: 1.0, 4: 0.9}.get(count, 0.82) * fit
    yy, xx = np.mgrid[0:(ZY1 - ZY0) // SC + 2, 0:(ZX1 - ZX0) // SC + 2]
    gx, gy = ZX0 + (xx + 0.5) * SC, ZY0 + (yy + 0.5) * SC
    under_caption, under_buttons = gy > SAFE_B, gx > SAFE_R
    unsafe = under_caption | under_buttons | (gx < SAFE_L)
    zone_area = (ZX1 - ZX0) * (ZY1 - ZY0) / SC / SC
    best, best_score = None, 1e9
    room = 0.85 * (ZX1 - ZX0) * (SAFE_B + 60 - ZY0)
    for _ in range(6000):
        sizes = [size_of(rng, w0, h0, j == 0, shrink * scales[j], kinds[j]) for j, (w0, h0) in enumerate(shapes)]
        k = min(1.0, math.sqrt(room / sum(w * h for w, h in sizes)))
        rects = []
        for j, (w, h) in enumerate(sizes):
            w, h = w * k, h * k
            deg = (rng.uniform(0.6, 3.0) if j == 0 else rng.uniform(1.5, 5.5)) * rng.choice([-1, 1])
            if j == 0:
                cx = rng.uniform(ZX0 + w / 2, ZX1 - w / 2)
                cy = ZY0 + h / 2 + rng.uniform(0, 70)
            else:
                ax, ay, aw, ah, _ = rects[rng.integers(len(rects))]
                ang = rng.choice([0, 30, 150, 180]) + rng.uniform(-12, 12)
                # prints only catch each other's edges, so no one's subject goes under another (the focus boxes check it)
                ox = rng.uniform(0.02, 0.07) * min(w, aw)
                oy = rng.uniform(0.02, 0.07) * min(h, ah)
                cx = ax + math.cos(math.radians(ang)) * ((aw + w) / 2 - ox)
                cy = ay + math.sin(math.radians(ang)) * ((ah + h) / 2 - oy) + rng.uniform(-0.2, 0.2) * h
            rects.append((cx, cy, w, h, deg))
        polys = [corners(*r) for r in rects]
        if any(not (ZX0 <= x <= ZX1 and ZY0 <= y <= ZY1) for p in polys for x, y in p):
            continue
        if len({np.sign(r[4]) for r in rects}) < 2:
            continue
        order = list(rng.permutation(count))
        if rng.random() < 0.7:
            order.remove(0)
            order.append(0)
        order = [j for j in order if not stick[j]] + [j for j in order if stick[j]]
        ms = [mask(p) for p in polys]
        areas = [m.sum() for m in ms]
        fms = [mask(focus_poly(r, f)) for r, f in zip(rects, focus)]
        vis, on_focus, above = {}, {}, np.zeros_like(ms[0])
        for j in reversed(order):
            vis[j] = (ms[j] & ~above).sum() / areas[j]
            on_focus[j] = (fms[j] & above).sum() / max(1, fms[j].sum())
            above |= ms[j]
        if max(on_focus.values()) > MAX_ON_FOCUS:     # something lies over a subject
            continue
        if vis[0] < 0.92 or min(vis.values()) < 0.6:
            continue
        if any(kinds[j] == "logo" and vis[j] < 0.9 for j in range(count)):   # half a wordmark doesn't read
            continue
        if any((ms[j] & under_caption).sum() > MAX_UNDER * areas[j] or (ms[j] & under_buttons).sum() > MAX_UNDER * areas[j] * 0.67
               for j in range(count)):
            continue
        touching = sum(1 for j in range(count) if any((ms[j] & ms[i]).sum() > 0.03 * min(areas[i], areas[j]) for i in range(count) if i != j))
        score = 1.2 * (count - touching)
        score += sum((ms[j] & unsafe).sum() / areas[j] * (5 if j == 0 else 2.5) for j in range(count))
        cov = above.sum() / zone_area
        score += 3 * max(0, 0.56 - cov) + 2 * max(0, cov - 0.8)
        ux = (gx * above).sum() / above.sum()
        score += abs(ux - 540) / 260
        score += 0.6 * (1 - vis[0]) + 0.4 * sum(1 - v for v in vis.values())
        if prev is not None:
            score += 0.45 * (np.sign(rects[0][0] - 540) == np.sign(prev[0] - 540))
        if score < best_score:
            best_score, best = score, (order, rects)
    return best


def render(item, n, prev):
    ims, kinds, scales, tops, focus = [], [], [], [], []
    for j, spec in enumerate(item["images"]):
        im = Image.open(vd / spec["file"])
        im.load()
        ims.append(frame(im, spec.get("kind", "screen")))
        kinds.append(spec.get("kind", "screen"))
        scales.append(float(spec.get("scale", 1.0)))
        tops.append(bool(spec.get("top", False)))
        focus.append(spec.get("focus") or (FOCUS["pick"] if j == 0 else FOCUS.get(kinds[-1], FOCUS["default"])))
    order, rects = layout(n, item.get("seed"), [im.size for im in ims], kinds, scales, prev, tops, focus)
    canvas = Image.new("RGBA", ((ZX1 - ZX0 + 2 * PAD) * K, (ZY1 - ZY0 + 2 * PAD) * K), (0, 0, 0, 0))
    for j in order:
        cx, cy, w, h, deg = rects[j]
        tw, th = round(w * K), round(h * K)
        img = ims[j].resize((tw, th), Image.Resampling.LANCZOS)
        framed = Image.new("RGBA", (tw + 4, th + 4), (0, 0, 0, 0))   # a clear edge so the tilted border stays smooth
        framed.alpha_composite(img, (2, 2))
        rot = framed.rotate(-deg, resample=Image.Resampling.BICUBIC, expand=True)
        x = round((cx - ZX0 + PAD) * K - rot.width / 2)
        y = round((cy - ZY0 + PAD) * K - rot.height / 2)
        a = rot.getchannel("A").point(lambda v: int(v * 0.42))
        sh = Image.new("RGBA", rot.size, (0, 0, 0, 0))
        sh.putalpha(a)
        sh = sh.filter(ImageFilter.GaussianBlur(9 * K))
        canvas.alpha_composite(sh, (x, y + 7 * K))
        canvas.alpha_composite(rot, (x, y))
    return canvas, order, rects


def sheet(items, out):
    tw, th = (ZX1 - ZX0 + 2 * PAD) // 2, (ZY1 - ZY0 + 2 * PAD) // 2
    cols = 4
    rows = (len(items) + cols - 1) // cols
    sh = Image.new("RGB", (tw * cols, (th + 30) * rows), (34, 34, 38))
    d = ImageDraw.Draw(sh)
    try:
        f = ImageFont.truetype(HN, 18, index=1)
    except OSError:
        f = ImageFont.load_default()
    for i, it in enumerate(items):
        c = Image.open(OUT / f"{it['group']}.png")
        bg = Image.new("RGBA", c.size, (88, 84, 80, 255))      # roughly his skin and tank top under the collage
        bg.alpha_composite(c)
        x, y = (i % cols) * tw, (i // cols) * (th + 30)
        sh.paste(bg.convert("RGB").resize((tw, th), Image.Resampling.LANCZOS), (x, y + 30))
        d.text((x + 8, y + 6), f"{it['group']}  {it.get('label', '')}", font=f, fill=(255, 255, 255))
    sh.save(out, quality=88)
    print(out)


def main():
    items = json.loads((vd / PLAN.get("composites", "edit/collages.json")).read_text())
    only = {a for a in args[1:]}
    OUT.mkdir(parents=True, exist_ok=True)
    lay_path = OUT / "layout.json"
    lay = json.loads(lay_path.read_text()) if lay_path.exists() else {}
    prev = None
    for n, it in enumerate(items, 1):
        g = str(it["group"])
        if only and g not in only:              # keep its stored pick, so the next group lays out as in a full run
            kept = lay.get(g)
            prev = (kept["images"][0]["cx"],) if kept else None
            continue
        canvas, order, rects = render(it, n, prev)
        prev = rects[0]
        canvas.save(OUT / f"{g}.png")
        lay[g] = {
            "label": it.get("label", ""), "canvas": [(ZX0 - PAD), (ZY0 - PAD), (ZX1 - ZX0 + 2 * PAD), (ZY1 - ZY0 + 2 * PAD)],
            "order": [int(j) for j in order],
            "images": [{"file": s["file"], "kind": s.get("kind", "screen"), "cx": round(r[0], 1), "cy": round(r[1], 1),
                        "w": round(r[2], 1), "h": round(r[3], 1), "deg": round(r[4], 2)} for s, r in zip(it["images"], rects)],
        }
        print(f"{g}  {len(it['images'])} images  -> {(OUT / f'{g}.png').relative_to(vd)}")
    lay_path.write_text(json.dumps(dict(sorted(lay.items())), indent=1))
    if "--sheet" in sys.argv:
        (vd / "build").mkdir(exist_ok=True)
        sheet(items, vd / "build/contact-sheet.jpg")   # a review render, so it stays local


if __name__ == "__main__":
    main()
