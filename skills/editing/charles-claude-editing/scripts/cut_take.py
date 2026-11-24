"""Cut a raw take down to his spoken phrases. Cuts land only in the silence between phrases; a phrase is never touched.

cuts.json holds the phrases (tighten.py proposes them from the sound; check them before you cut):
  {"gap": 0.10, "out_max": 0.05, "lead": 0.03, "tail": 0.12, "lead_max": 0.035,
   "phrases": [{"text": "...", "in": 5.478, "out": 8.911}, ...]}
in and out are where his voice starts and fully ends, weak final consonants included, on the file's real timeline
(timeline_audio.py). gap is the silence kept at a join: at most out_max of it follows his voice, at most lead_max of it
leads into the next phrase, and a join never reaches into another sound (a breath or click from work/voice_map.json).
Per phrase, optional:
  "tail" / "lead"  room tone kept after / before this phrase, for a word whose fade runs long or a click right before it
  "lcut": N        an L-cut: the picture leaves this phrase N frames (1-4) before its sound, and the next phrase's picture
                   starts N frames early, so the end of the word plays over the next shot. Never negative: a J-cut holds
                   frames of him finishing, which reads as a pause. Paint out a hand swing instead.
Optional, top level:
  "avoid": [[start, end], ...]   more stretches the room tone must stop short of (a breath merged into his speech)
  "paint": [[start, end], ...]   sounds inside a kept clip but outside his words (a click on a word's end, a breath running
                                 out of one), replaced with the take's own room tone ("room": [start, end], its quietest
                                 stretch) under 8 ms crossfades. Paint never touches the samples between a phrase's in and out.
  "round": "down"                end on the earlier frame when it still keeps 30 ms after his voice
  "lead_min" / "tail_min"        room tone always kept before / after a phrase (default 0.006 s), so the crossfade never
                                 touches his first or last sound

Audio joins are 11 ms crossfades of room tone. The picture is cut on the 30 fps grid, within 17 ms of the sound.

usage (from a video's edit folder; the defaults are this layout):
  python3 <skill>/scripts/cut_take.py [--raw ../footage/raw.mov] [--cuts cuts.json] [--work work] [--no-video]
writes work/cut_voice.wav, work/cut.cuts.json and work/cut.mov (ProRes 422 HQ with the untouched voice), and prints
every join. Then run check_cut.py, then check_joins.py. Needs numpy and ffmpeg."""
import argparse, json, math, os, struct, subprocess, sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import timeline_audio  # noqa: E402

FPS = 30
XF_S = 0.011        # the room-tone crossfade at every join
MARGIN = 0.012      # how close a cut may come to another sound
LEAD_MIN = 0.006    # room tone always kept at each edge: half the crossfade and a little more


def write_wav(path, x, rate):
    pcm = np.asarray(x, dtype=np.float32).tobytes()
    ch = 1 if x.ndim == 1 else x.shape[1]
    with open(path, "wb") as f:
        f.write(b"RIFF" + struct.pack("<I", 36 + len(pcm)) + b"WAVEfmt " + struct.pack("<IHHIIHH", 16, 3, ch, rate, rate * 4 * ch, 4 * ch, 32)
                + b"data" + struct.pack("<I", len(pcm)) + pcm)


def paint(x, rate, cfg, phrases, say=print):
    """The take with cfg["paint"] stretches replaced by its own room tone. check_cut.py calls this too, so it measures
    the sound the cut is made from."""
    if not cfg.get("paint"):
        return x
    x = x.copy()
    r0, r1 = (round(v * rate) for v in cfg["room"])
    room = x[r0:r1].astype(x.dtype)
    fx = int(0.008 * rate)
    ramp = (np.sin(np.linspace(0, np.pi / 2, fx)) ** 2).astype(x.dtype)
    rp = 0
    for t0, t1 in cfg["paint"]:
        for q in phrases:
            assert t1 <= q["in"] or t0 >= q["out"], ("paint inside his words", t0, t1, q["text"][:40])
        c0, c1 = round(t0 * rate), round(t1 * rate)
        n = c1 - c0
        fill = np.resize(np.roll(room, -rp), n)
        rp = (rp + n) % len(room)
        m = np.ones(n, dtype=x.dtype)                 # 1 = room tone, 0 = the take
        e = min(fx, n // 2)
        m[:e] = ramp[:e]
        m[n - e:] = ramp[:e][::-1]
        x[c0:c1] = x[c0:c1] * (1 - m) + fill * m
        say(f"  painted {t0:.3f}-{t1:.3f} ({(t1 - t0) * 1000:.0f} ms) with room tone from {cfg['room'][0]:.2f}")
    return x


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--raw", default="../footage/raw.mov")
    ap.add_argument("--cuts", default="cuts.json")
    ap.add_argument("--work", default="work")
    ap.add_argument("--no-video", action="store_true", help="write only the sound and cut.cuts.json")
    a = ap.parse_args()

    cfg = json.load(open(a.cuts))
    gap, lead, tail = cfg.get("gap", 0.10), cfg.get("lead", 0.03), cfg.get("tail", 0.12)
    out_max = cfg.get("out_max", 0.05)
    phrases = cfg["phrases"]
    for p in phrases:
        assert int(p.get("lcut", 0)) >= 0, ("a negative lcut is a J-cut: paint the movement out instead", p["text"][:40])
    audio, rate, holes = timeline_audio.load(a.raw)
    x = audio.mean(axis=1)          # a phone's two channels are identical
    dur = len(x) / rate
    vm_path = os.path.join(a.work, "voice_map.json")
    islands = json.load(open(vm_path))["islands"] if os.path.exists(vm_path) else []
    if not islands:
        print(f"note: no {vm_path}, so joins only keep clear of the phrases themselves (run voice_map.py first)")
    # Everything that isn't one of the kept phrases: a cut stops short of these.
    others = [(s["start"], s["end"]) for s in islands
              if not any(s["start"] < p["out"] - 0.01 and p["in"] + 0.01 < s["end"] for p in phrases)] + [tuple(h) for h in holes]
    others += [tuple(r) for r in cfg.get("avoid", [])]
    others += [(p["in"], p["out"]) for p in phrases]
    free_after = lambda t: min([s for s, _ in others if s >= t + 1e-6] + [dur]) - t
    free_before = lambda t: t - max([e for _, e in others if e <= t - 1e-6] + [0.0])
    kept = []
    n_ph = len(phrases)
    for i, p in enumerate(phrases):
        before = p.get("lead", lead if i == 0 else None)
        after = p.get("tail", tail if i == n_ph - 1 else None)
        if before is None:
            prev = phrases[i - 1]
            out_pad = prev.get("tail", min(out_max, gap - 0.02, free_after(prev["out"]) - MARGIN))
            before = min(gap - out_pad, free_before(p["in"]) - MARGIN, cfg.get("lead_max", gap))
        if after is None:
            after = min(out_max, gap - 0.02, free_after(p["out"]) - MARGIN)
        # Never less than half the crossfade plus a little on either side, or the fade itself eats his first or last sound.
        before, after = max(before, cfg.get("lead_min", LEAD_MIN)), max(after, cfg.get("tail_min", LEAD_MIN))
        s = max(0.0, p["in"] - before)
        e = min(dur, p["out"] + after)
        # A whole number of frames, never less than 35 ms past the end of his voice (30 ms with "round": "down").
        if cfg.get("round") == "down":
            n = math.floor((e - s) * FPS + 1e-6)
            if s + n / FPS < p["out"] + min(0.03, max(after, 0.0)) - 1e-4:
                n += 1
        else:
            n = round((e - s) * FPS)
            if s + n / FPS < p["out"] + min(0.035, max(after, 0.0)):
                n += 1
        kept.append({"in": round(s, 4), "out": round(s + n / FPS, 4), "frames": n, "voice_in": p["in"], "voice_out": p["out"],
                     "text": p["text"], "lcut": int(p.get("lcut", 0)) if i < n_ph - 1 else 0})

    x = paint(x, rate, cfg, phrases)

    # The sound: each stretch taken from the timeline, joined with a short crossfade over the room tone.
    xf = int(XF_S * rate)
    total = sum(k["frames"] for k in kept)
    length = round(total / FPS * rate)
    out = np.zeros(length, dtype=np.float32)
    fade = np.sin(np.linspace(0, np.pi / 2, xf)) ** 2
    pos = 0
    for i, k in enumerate(kept):
        s = round(k["in"] * rate)
        n = round(k["frames"] / FPS * rate)
        s0 = pos - (xf // 2 if i else 0)
        src0 = s - (xf // 2 if i else 0)
        m = n + (xf // 2 if i else 0) + (xf - xf // 2 if i < n_ph - 1 else 0)
        m = min(m, length - s0, len(x) - src0)
        part = x[src0:src0 + m].copy()
        w = np.ones(m, dtype=np.float32)
        if i:
            w[:xf] = fade
        if i < n_ph - 1:
            w[-xf:] = fade[::-1]
        out[s0:s0 + m] += part * w
        k["cut_start"], k["cut_sample"], k["raw_sample"] = round(pos / rate, 4), pos, s
        pos += n
        k["cut_end"] = round(pos / rate, 4)

    os.makedirs(a.work, exist_ok=True)
    write_wav(os.path.join(a.work, "cut_voice.wav"), out, rate)
    print(f"{'in':>8} {'out':>8} {'frames':>6}  cut clock")
    for i, k in enumerate(kept):
        g = ""
        if i:
            prev = kept[i - 1]
            sil = (prev["out"] - prev["voice_out"]) + (k["voice_in"] - k["in"])
            g = f"  silence before {sil * 1000:.0f} ms"
        print(f"{k['in']:8.3f} {k['out']:8.3f} {k['frames']:6d}  {k['cut_start']:7.3f}-{k['cut_end']:7.3f}{g}  {k['text'][:44]}")
    print(f"total {total / FPS:.3f} s, {n_ph} phrases")
    json.dump({"kept": kept, "rate": rate, "cut_points": [k["cut_start"] for k in kept[1:]], "duration": round(total / FPS, 4)},
              open(os.path.join(a.work, "cut.cuts.json"), "w"), indent=1)
    if a.no_video:
        return

    # The picture: the same frames on the 30 fps grid. An "lcut" moves a join's picture cut that many frames earlier than
    # its sound cut: the ending phrase loses those frames and the next one starts that much early.
    parts = [f"[0:v]fps={FPS},split={n_ph}" + "".join(f"[vs{i}]" for i in range(n_ph)) + ";"]
    for i, k in enumerate(kept):
        early_in = kept[i - 1]["lcut"] if i else 0
        f0 = round(k["in"] * FPS) - early_in
        assert f0 >= 0 and k["frames"] - k["lcut"] + early_in > 0, ("an lcut runs off the take", k["text"][:40])
        parts.append(f"[vs{i}]trim=start_frame={f0}:end_frame={f0 + k['frames'] - k['lcut'] + early_in},setpts=PTS-STARTPTS[v{i}];")
        if k["lcut"]:
            print(f"  L-cut: the picture leaves '{k['text'][-30:]}' {k['lcut']} frames before its sound")
    fc = "".join(parts) + "".join(f"[v{i}]" for i in range(n_ph)) + f"concat=n={n_ph}:v=1:a=0[v]"
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", a.raw, "-i", os.path.join(a.work, "cut_voice.wav"),
                    "-filter_complex", fc, "-map", "[v]", "-map", "1:a:0", "-c:v", "prores_ks", "-profile:v", "3",
                    "-pix_fmt", "yuv422p10le", "-c:a", "pcm_s24le", "-shortest", os.path.join(a.work, "cut.mov")], check=True)


if __name__ == "__main__":
    main()
