"""Look at the picture at every cut, not just the sound. When he finishes a line he relaxes (a hand drops, his eyes go to
the script, an arm reaches to stop the recording), and even 0.3 s of that after a word reads as unedited. check_cut.py
proves the sound; this shows what the frames do.

For every join in work/cut.cuts.json it draws one row from the raw take, on the cut's 30 fps grid:
  the last 6 frames the cut keeps of the phrase that ends (a yellow bar marks the frames after his voice stopped),
  the 3 frames after it that the cut drops (greyed),
  the 3 frames before the next phrase that the cut drops (greyed), and the first 3 it keeps.
The last row is the end of the reel: its last 8 kept frames and 3 dropped ones. It also prints, per join, how long the
kept picture runs on after his voice stops, and how much the picture moves there against how much it moves while he
talks, so a hand dropping or a head turning shows up as a number too.

usage (from a video's edit folder; the defaults are cut_take.py's layout):
  python3 <skill>/scripts/check_joins.py [--raw ../footage/raw.mov] [--work work] [--out work/joins_picture.jpg]
Look at every row before showing a cut: movement away from the line in the kept frames means that join gets re-cut (an
earlier "out" in cuts.json, or an "lcut" so the word plays over the next clip). Needs numpy, Pillow and ffmpeg."""
import argparse, json, os, subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFont

FPS = 30
TW, TH = 144, 256                     # a frame in the sheet


def font(size):
    for path in ("/System/Library/Fonts/HelveticaNeue.ttc", "/System/Library/Fonts/Helvetica.ttc", "DejaVuSans.ttf", "Arial.ttf"):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


FONT = font(15)


def frames(raw, t0, n):
    """n frames of the raw take from t0 on the 30 fps grid, small."""
    out = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{max(t0, 0):.4f}", "-i", raw, "-vf", f"fps={FPS},scale={TW}:{TH}",
                          "-frames:v", str(n), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    arr = np.frombuffer(out, np.uint8)
    k = len(arr) // (TW * TH * 3)
    return [arr[i * TW * TH * 3:(i + 1) * TW * TH * 3].reshape(TH, TW, 3) for i in range(k)]


def motion(fs):
    """Mean frame-to-frame change, 0-255."""
    if len(fs) < 2:
        return 0.0
    return float(np.mean([np.abs(a.astype(float) - b.astype(float)).mean() for a, b in zip(fs, fs[1:])]))


def tile(f, label, kept=True, after_voice=False):
    im = Image.fromarray(f if kept else (f * 0.45 + 70).astype(np.uint8))
    d = ImageDraw.Draw(im)
    if after_voice:
        d.rectangle((0, 0, TW, 6), fill=(255, 210, 0))
    d.text((4, TH - 20), label, font=FONT, fill=(255, 255, 255), stroke_width=2, stroke_fill=(0, 0, 0))
    return im


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--raw", default="../footage/raw.mov")
    ap.add_argument("--work", default="work")
    ap.add_argument("--out", default=None, help="the sheet (default: <work>/joins_picture.jpg)")
    a = ap.parse_args()
    out = a.out or os.path.join(a.work, "joins_picture.jpg")
    kept = json.load(open(os.path.join(a.work, "cut.cuts.json")))["kept"]
    rows, report = [], []
    for i, k in enumerate(kept):
        last = i == len(kept) - 1
        n_keep = 8 if last else 6
        lcut = k.get("lcut", 0)                                # an L-cut leaves the picture early (cut_take.py)
        t_end = k["in"] + (k["frames"] - lcut) / FPS           # the picture's out point on the raw take
        fs_keep = frames(a.raw, t_end - n_keep / FPS, n_keep)
        fs_drop = frames(a.raw, t_end, 3)
        tiles = []
        for j, f in enumerate(fs_keep):
            t = t_end - (n_keep - j) / FPS
            tiles.append(tile(f, f"{t - k['voice_out']:+.2f}", True, t >= k["voice_out"]))
        tiles += [tile(f, f"+{(j + 1) / FPS:.2f} cut", False) for j, f in enumerate(fs_drop)]
        tail_frames = max(0, round((t_end - k["voice_out"]) * FPS))
        talking = frames(a.raw, max(k["voice_in"], k["voice_out"] - 1.0), 12)
        after = frames(a.raw, k["voice_out"], max(tail_frames, 1) + 1)
        m_talk, m_after = motion(talking), motion(after)
        if not last:
            nxt = kept[i + 1]
            tiles.append(Image.new("RGB", (12, TH), (30, 30, 30)))
            t_in = nxt["in"] - lcut / FPS                      # the next picture starts early by the same L-cut
            tiles += [tile(f, f"-{(3 - j) / FPS:.2f} cut", False) for j, f in enumerate(frames(a.raw, t_in - 3 / FPS, 3))]
            tiles += [tile(f, f"{t_in + j / FPS - nxt['voice_in']:+.2f}") for j, f in enumerate(frames(a.raw, t_in, 3))]
        flag = "  <- check" if (m_after > 1.5 * max(m_talk, 0.5) and tail_frames >= 2) or tail_frames > 3 else ""
        what = "end of the reel" if last else f"join {i + 1} at {kept[i + 1]['cut_start']:.2f} s" + (f" (L-cut {lcut})" if lcut else "")
        report.append(f"{what:22s} picture runs {tail_frames} frames ({tail_frames / FPS:.2f} s) past his voice; motion there "
                      f"{m_after:.1f} vs {m_talk:.1f} while talking{flag}   ...{k['text'][-32:]}")
        row = Image.new("RGB", (sum(t.width for t in tiles), TH + 24), (20, 20, 20))
        ImageDraw.Draw(row).text((6, 4), what, font=FONT, fill=(255, 230, 120))
        x = 0
        for t in tiles:
            row.paste(t, (x, 24))
            x += t.width
        rows.append(row)
    sheet = Image.new("RGB", (max(r.width for r in rows), sum(r.height for r in rows)), (20, 20, 20))
    y = 0
    for r in rows:
        sheet.paste(r, (0, y))
        y += r.height
    sheet.save(out, quality=88)
    print("\n".join(report))
    print(f"-> {out}: yellow bar = kept after his voice stopped; grey = dropped by the cut. Labels are seconds from his "
          "voice stopping (or, after a cut, starting).")


if __name__ == "__main__":
    main()
