"""Find where a song's full beat starts, so the plan's music `at` lands on a hit and never in a quiet intro.

  python3 -I <skill>/kit/music_start.py <track> --length <reel seconds> [--near <s>] [--after <s>]
  python3 -I <skill>/kit/music_start.py --video <video folder>   # the plan's music file, the reel's length from build/times.json

It prints the track's loudness every 0.5 s, finds the breaks (a second or more well under the song's full level) and the
hit that ends each one (or, in music with no drums, the swell back to full), then picks the earliest one after --after
with no breakdown (two seconds or more under full) before the reel ends, and prints 40 ms steps around it and the `at`
to write in plan.json. --near snaps to the hit nearest a spot instead (a start he liked, or the part of the song the
reference used). Loudness is RMS in dBFS of the mixed-down track: only the differences matter.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

RATE = 22050
STEP = 0.04                # the fine grid
WIN = 0.5                  # the coarse table
BREAK_DB = 6.0             # a break sits this far under the song's full level...
BREAK_S = 1.0              # ...for at least this long
BREAKDOWN_S = 2.0          # a break this long under him is a breakdown; a one-bar drop shorter than this is part of the beat
HIT_DB = 6.0               # a hit jumps this much over the 120 ms before it
FULL_DB = 3.0              # after a hit, the next 2 s average within this of the full level


def load(path):
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(RATE), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(pcm, dtype=np.float32)


def levels(x, step):
    n = int(step * RATE)
    k = len(x) // n
    rms = np.sqrt((x[:k * n].reshape(k, n).astype(np.float64) ** 2).mean(axis=1))
    return 20 * np.log10(rms + 1e-9)


def find_breaks(coarse, full):
    """[(start s, end s)] where the 0.5 s level stays BREAK_DB under the full level for BREAK_S or longer. A quiet
    opening counts as a break, so the first hit after an intro is a candidate."""
    quiet = coarse < full - BREAK_DB
    out, i = [], 0
    while i < len(quiet):
        if quiet[i]:
            j = i
            while j < len(quiet) and quiet[j]:
                j += 1
            if (j - i) * WIN >= BREAK_S:
                out.append((i * WIN, j * WIN))
            i = j
        else:
            i += 1
    return out


def hit_after(fine, t0, full, within=None):
    """(time, "hit") for the first 40 ms step from t0 on where the level jumps HIT_DB over the 120 ms before it and the
    next 2 s are full; else (time, "swell") for the first step where the next 2 s are full, which is how music without
    drums comes back; else None. `within` limits how far past t0 to look, in seconds."""
    i0 = max(3, int(t0 / STEP))
    ahead = int(2.0 / STEP)
    i1 = len(fine) - ahead if within is None else min(len(fine) - ahead, i0 + int(within / STEP))
    swell = None
    for i in range(i0, i1):
        full_next = fine[i:i + ahead].mean() >= full - FULL_DB
        if full_next and fine[i] - fine[i - 3:i].min() >= HIT_DB:
            return i * STEP, "hit"
        if full_next and swell is None:
            swell = i * STEP
    return (swell, "swell") if swell is not None else None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("track", nargs="?")
    ap.add_argument("--video", help="a video folder: read edit/plan.json's music file and build/times.json's length")
    ap.add_argument("--length", type=float, help="the reel's length in seconds")
    ap.add_argument("--near", type=float, help="pick the hit closest to this time instead of the earliest that stays full")
    ap.add_argument("--after", type=float, default=0.0, help="ignore hits before this time (s)")
    a = ap.parse_args()

    track, length = a.track, a.length
    if a.video:
        vd = Path(a.video)
        plan = json.loads((vd / "edit/plan.json").read_text())
        track = track or str((vd / (plan.get("music") or {}).get("file", "")).resolve())
        times = vd / "build/times.json"
        if length is None and times.exists():
            length = json.loads(times.read_text())["total"]
    if not track or not Path(track).is_file():
        sys.exit("Give a track file (or --video with a plan whose music.file exists).")
    if length is None:
        sys.exit("Give --length (the reel's length in seconds), or build the plan first so build/times.json has it.")

    x = load(track)
    dur = len(x) / RATE
    fine, coarse = levels(x, STEP), levels(x, WIN)
    body = coarse[int(1 / WIN):max(int(1 / WIN) + 1, len(coarse) - int(1 / WIN))]   # leave out the first and last second
    full = float(np.percentile(body, 75))
    print(f"{Path(track).name}: {dur:.1f} s, full level {full:.1f} dBFS (the loudest quarter of 0.5 s steps starts here)")
    print("\nEvery 0.5 s (dBFS; # = within 3 dB of full, + = within 6, . = quieter):")
    lo = float(np.percentile(coarse, 5))
    for row in range(0, len(coarse), 8):
        cells = coarse[row:row + 8]
        marks = "".join("#" if v >= full - 3 else "+" if v >= full - 6 else "." for v in cells)
        print(f"  {row * WIN:6.1f}  {marks:8s}  " + " ".join(f"{v:5.1f}" for v in cells))

    breaks = find_breaks(coarse, full)
    breakdowns = [(s, e) for s, e in breaks if e - s >= BREAKDOWN_S]
    print("\nBreaks: " + (", ".join(f"{s:.1f}-{e:.1f} s" for s, e in breaks) or "none")
          + f" (breakdowns, {BREAKDOWN_S:g} s or longer: " + (", ".join(f"{s:.1f}" for s, e in breakdowns) or "none") + ")")

    def next_breakdown(t):
        return next((s for s, e in breakdowns if s > t + 0.5), None)

    def row(t, kind):
        nb = next_breakdown(t)
        return {"at": t, "kind": kind, "next": nb, "ok": nb is None or nb >= t + length}

    rows = []
    for s, e in breaks:
        found = hit_after(fine, max(e - WIN, a.after), full, within=4.0)   # a hit can land in the break's last half second
        if found and found[0] + length <= dur and all(abs(r["at"] - found[0]) > 0.5 for r in rows):
            rows.append(row(*found))
    opening = hit_after(fine, a.after, full, within=4.0)                     # the song may open straight into its beat
    if opening and opening[0] + length <= dur and (not breaks or opening[0] < breaks[0][0]):
        rows.insert(0, row(*opening))
    rows = [r for r in rows if r["at"] >= a.after]
    print(f"Starts after a break (a reel of {length:.1f} s):" if rows else "No start after a break leaves the reel's length of song.")
    for r in rows:
        nxt = "none" if r["next"] is None else f"{r['next']:.1f} s"
        print(f"  {r['at']:7.2f} s  {r['kind']:5s}  next breakdown {nxt}  {'stays full' if r['ok'] else 'breaks down under him'}")

    if a.near is not None:
        # the hit nearest the spot he gave, within 1.5 s, on the 40 ms grid
        i0, i1 = max(3, int((a.near - 1.5) / STEP)), min(len(fine), int((a.near + 1.5) / STEP))
        hits = [i for i in range(i0, i1) if fine[i] - fine[i - 3:i].min() >= HIT_DB]
        if hits:
            pick = row(min(hits, key=lambda i: abs(i * STEP - a.near)) * STEP, "hit")
        else:
            print(f"\nNo hit within 1.5 s of {a.near:g} s: the level never jumps {HIT_DB:g} dB there, so it starts on the spot.")
            pick = row(a.near, "spot")
    elif rows:
        pick = next((r for r in rows if r["ok"]), max(rows, key=lambda r: (r["next"] or dur) - r["at"]))
    else:
        sys.exit("No start after a break: pass --near with a spot from the table, try --after earlier, or another track.")

    at = pick["at"]
    print(f"\n40 ms steps around {at:.2f} s (> marks the start):")
    i = int(round(at / STEP))
    for k in range(max(0, i - 12), min(len(fine), i + 13)):
        print(f"  {k * STEP:7.2f}  {fine[k]:6.1f}  {'>' if k == i else ' '} {'|' * max(0, int((fine[k] - lo) / 2))}")
    print(f"\nat = {at:.2f}  ({pick['kind']}" + (f", nearest {a.near:g} s" if a.near is not None else "") + ")")
    if not pick["ok"]:
        nb = pick["next"]
        print(f"WARNING: a breakdown starts at {nb:.1f} s, {nb - at:.1f} s into the reel, before it ends at {length:.1f} s. "
              "Pick a later start (--after), another track, or a shorter reel.")

if __name__ == "__main__":
    main()
