#!/usr/bin/env python3
"""Neighbour colours: is each card's colour clearly different from the card before it?

In a list reel each card replaces the last one in the same slot, so two cards in a row on the same colour read as one
card that only changed its words. Charles, 23 Nov 2026: "don't have back to back same colours". Recreated app screens
make this easy to miss, because so many of them are white.

This reads each card's stage colour from a band just inside the card's edges: that's what frames the card when it
swaps in, and a big white panel or a big word in the middle can't hide it. It prints the colour of each card in list
order and flags any card closer than 0.1 (in OKLab) to the one before it.

  python3 -I <kit>/neighbours.py <clips dir> [--t 1.2] [--box 80,70,870,350]

<clips dir> holds the cards in list order, named NN-id (.webm, .mov or .mp4; with several, the .webm is read).
--t is the moment to read, after the card has settled. --box is the card inside a 1080-wide clip: x, y, width,
height. The default is the list-reel term slot. 2x clips are halved first. Needs ffmpeg. It exits with 1 when a
pair is too close, so it can run as a check.
"""
import argparse, math, os, re, statistics, subprocess, sys

ap = argparse.ArgumentParser()
ap.add_argument('dir')
ap.add_argument('--t', default='1.2')
ap.add_argument('--box', default='80,70,870,350')
ap.add_argument('--band', type=int, default=22, help='how far in from the card edge to read, in px')
ap.add_argument('--corner', type=int, default=44, help='skip this much at each corner (the rounding)')
ap.add_argument('--min', type=float, default=0.1, help='flag neighbours closer than this in OKLab')
o = ap.parse_args()
X, Y, W, H = (int(v) for v in o.box.split(','))


def lin(c):
    c /= 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def oklab(r, g, b):
    r, g, b = lin(r), lin(g), lin(b)
    l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    return (0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s)


def to_hex(L, a, b):
    l, m, s = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, \
        (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    rgb = (4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
           -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
           -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)
    enc = lambda c: 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055
    return '#' + ''.join('%02x' % round(255 * min(1, max(0, enc(max(0, c))))) for c in rgb)


clips = {}
for f in sorted(os.listdir(o.dir)):
    m = re.match(r'(\d\d-[^.]+)\.(webm|mov|mp4)$', f)
    if m and (m.group(1) not in clips or f.endswith('.webm')):
        clips[m.group(1)] = os.path.join(o.dir, f)
if not clips:
    sys.exit(f'no NN-id clips in {o.dir}')

prev, close = None, []
for cid in sorted(clips):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', o.t, '-i', clips[cid], '-frames:v', '1', '-vf',
                          f'scale=1080:-2:flags=area,crop={W}:{H}:{X}:{Y}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                         capture_output=True).stdout
    if len(raw) < W * H * 3:
        print(f'{cid:24s} could not read a frame at {o.t} s'); prev = None; continue
    labs = []
    for y in range(0, H, 2):
        for x in range(0, W, 2):
            edge = x < o.band or x >= W - o.band or y < o.band or y >= H - o.band
            corner = (x < o.corner or x >= W - o.corner) and (y < o.corner or y >= H - o.corner)
            if edge and not corner:
                i = (y * W + x) * 3
                labs.append(oklab(raw[i], raw[i + 1], raw[i + 2]))
    lab = tuple(statistics.median(v[k] for v in labs) for k in range(3))
    d = math.dist(lab, prev) if prev else None
    flag = ''
    if d is not None and d < o.min:
        flag = '  <-- too close to the card before'; close.append(cid)
    print(f'{cid:24s} {to_hex(*lab)}  L {lab[0]:.2f}  ' + ('' if d is None else f'{d:.3f} from the one before') + flag)
    prev = lab

if close:
    print(f'\n{len(close)} card(s) share a colour with the card before: {", ".join(close)}. Give one of each pair '
          'another stage (a white app panel can sit on a coloured stage).')
    sys.exit(1)
print('\nEvery card differs from the one before it.')
