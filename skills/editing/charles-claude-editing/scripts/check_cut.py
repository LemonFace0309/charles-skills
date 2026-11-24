"""Prove a cut keeps every word whole and leaves no dead air. Run it after cut_take.py; it exits 1 on any failure.

Each kept line is measured on the raw take (painted as cuts.json says, so it reads what the cut is made from), band by band
(soundmap.py), against the word itself rather than the room:
- CLIPPED: his word still sounds, within 20 dB of its last syllable, more than 15 ms past the cut, or before it at a line's
  start. That is a cut through his word ("poli-" for "polished"). Broadband tests miss it, because a final "s", "t", "f"
  or "sh" is quiet below 3 kHz.
- dead air at a join: more than 0.1 s from his last sound (its fade 30 dB down) to his next, counted on both sides of the
  cut. A breath or a click inside that stretch counts as dead air, not as speech: it shows him getting ready.
- noise under a crossfade: a breath or click where the 11 ms crossfade sits, heard as a tick.
- the reel's ends: at most 0.06 s before his first word and 0.15 s after his last.
- identity: every kept line is the raw take sample for sample between its in and out.
It also lists, without failing, the fade of a word that runs on past its cut (soft: lengthen the out if it sounds abrupt),
and every pause of 0.35 s or more inside a line (dead air to cut, unless it is a beat he holds looking at the lens).

usage (from a video's edit folder; the defaults are cut_take.py's layout):
  python3 <skill>/scripts/check_cut.py [--raw ../footage/raw.mov] [--cuts cuts.json] [--work work] [--sheet joins.png]
      [--hear] [--json result.json]
--hear also transcribes every line of the cut on its own with no prompt (faster-whisper), so a sound the cut took away
can't be filled back in from the script; run it with `uv run --with faster-whisper --with numpy python ...`.
Needs numpy and ffmpeg; --sheet needs Pillow."""
import argparse, json, os, re, struct, sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import timeline_audio  # noqa: E402
import soundmap  # noqa: E402
from cut_take import paint  # noqa: E402

JOIN_MAX = 0.10      # silence kept at a join, both sides together
LEAD_MAX = 0.06      # before his first word, at the reel's start
TAIL_MAX = 0.15      # after his last word, at the reel's end
PAUSE_MIN = 0.35     # a pause inside a line this long is dead air to cut, unless it's a held beat
SOFT_MIN = 0.02      # a fade running on this far past the cut gets mentioned
XF_NOISE = 6.0       # dB over a band's sound threshold that a crossfade may not carry


def read_wav(path):
    d = open(path, "rb").read()
    i, fmt, body = 12, None, None
    while i + 8 <= len(d):
        tag, size = d[i:i + 4], struct.unpack("<I", d[i + 4:i + 8])[0]
        if tag == b"fmt ":
            fmt = struct.unpack("<HHIIHH", d[i + 8:i + 24])
        elif tag == b"data":
            body = d[i + 8:i + 8 + size]
        i += 8 + size + (size & 1)
    x = np.frombuffer(body, dtype=np.float32 if fmt[0] == 3 else np.int16).astype(np.float32)
    if fmt[0] != 3:
        x /= 32768.0
    return x.reshape(-1, fmt[1]).mean(axis=1), fmt[2]


def last_word(text):
    w = re.findall(r"[A-Za-z0-9'%$]+", text)
    return w[-1] if w else text.strip()


def first_word(text):
    w = re.findall(r"[A-Za-z0-9'%$]+", text)
    return w[0] if w else text.strip()


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--raw", default="../footage/raw.mov")
    ap.add_argument("--cuts", default="cuts.json")
    ap.add_argument("--work", default="work")
    ap.add_argument("--sheet", help="write a spectrogram sheet of every join to this PNG")
    ap.add_argument("--hear", action="store_true", help="transcribe each line of the cut alone, with no prompt")
    ap.add_argument("--json", help="write the findings to this JSON file")
    a = ap.parse_args()

    cfg = json.load(open(a.cuts))
    kept = json.load(open(os.path.join(a.work, "cut.cuts.json")))["kept"]
    audio, rate, holes = timeline_audio.load(a.raw)
    raw = paint(audio.mean(axis=1), rate, cfg, cfg["phrases"], say=lambda *_: None)
    sm = soundmap.SoundMap(raw, rate, holes)
    cut, crate = read_wav(os.path.join(a.work, "cut_voice.wav"))
    assert crate == rate, ("the cut's sound and the take have different rates", crate, rate)
    dur = len(raw) / rate

    starts = sorted(k["voice_in"] for k in kept)
    ends = sorted(k["voice_out"] for k in kept)
    hole_starts = sorted(h[0] for h in holes)
    hole_ends = sorted(h[1] for h in holes)
    fails, notes, rows = [], [], []

    def fail(msg):
        fails.append(msg)
        rows.append("  FAIL  " + msg)

    def note(msg):
        notes.append(msg)
        rows.append("  note  " + msg)

    edges = []
    for i, k in enumerate(kept):
        # How far each edge may look: up to the next kept line or hole on the take's timeline, never into it.
        nxt = min([s for s in starts if s > k["voice_out"] + 1e-3] + [h for h in hole_starts if h > k["voice_out"]] + [dur])
        prv = max([e for e in ends if e < k["voice_in"] - 1e-3] + [h for h in hole_ends if h < k["voice_in"]] + [0.0])
        lim_out = min(nxt - 0.01, k["voice_out"] + 0.6)
        lim_in = max(prv + 0.01, k["voice_in"] - 0.6)
        level = sm.level(k["voice_in"], k["voice_out"])
        e_clip, e_fade = sm.end(k["voice_out"], lim_out, soundmap.ends_in_stop(last_word(k["text"])), level)
        s_clip, s_fade = sm.start(k["voice_in"], lim_in, level)
        edges.append((s_clip, s_fade, e_clip, e_fade))
        label = f"line {i + 1:2d} {k['text'][:40]!r}"
        rows.append(label)
        if e_clip > k["out"] + soundmap.CLIP_SLACK:
            fail(f"line {i + 1}: CLIPPED, the end of {last_word(k['text'])!r} sounds {(e_clip - k['out']) * 1000:.0f} ms past the cut "
                 f"(cut {k['out']:.3f}, his word ends {e_fade:.3f}). Set its out to {e_fade:.3f} and cut again.")
        elif e_fade > k["out"] + SOFT_MIN:
            note(f"line {i + 1}: the fade of {last_word(k['text'])!r} runs {(e_fade - k['out']) * 1000:.0f} ms past the cut, "
                 f"30 dB down. Listen: if it stops abruptly, set its out to {e_fade:.3f}.")
        if s_clip < k["in"] - soundmap.CLIP_SLACK:
            fail(f"line {i + 1}: CLIPPED, the start of {first_word(k['text'])!r} sounds {(k['in'] - s_clip) * 1000:.0f} ms before the cut "
                 f"(cut {k['in']:.3f}, his word starts {s_fade:.3f}). Set its in to {s_fade:.3f} and cut again.")
        # Identity: the kept line is the take, sample for sample, between its in and out.
        r0 = round(k["voice_in"] * rate)
        n0 = k["cut_sample"] + r0 - k["raw_sample"]
        n1 = n0 + round((k["voice_out"] - k["voice_in"]) * rate)
        if n1 > len(cut) or n0 < 0:
            fail(f"line {i + 1}: its sound runs off the cut's file, so the cut is stale: run cut_take.py again")
        else:
            delta = float(np.abs(cut[n0:n1] - raw[r0:r0 + (n1 - n0)]).max()) if n1 > n0 else 0.0
            if delta > 1e-4:
                fail(f"line {i + 1}: the cut's sound differs from the take inside the line (by {delta:.4f}): run cut_take.py again")
        for p0, p1 in sm.pauses(k["voice_in"], k["voice_out"], PAUSE_MIN):
            note(f"line {i + 1}: {p1 - p0:.2f} s of dead air inside the line at {p0:.2f}-{p1:.2f} on the take. Split the line there "
                 f"(two phrases in cuts.json) unless it's a beat he holds looking at the lens.")

    # The ends of the reel.
    first, last = kept[0], kept[-1]
    lead = max(0.0, edges[0][1] - first["in"])
    tail = max(0.0, last["out"] - edges[-1][3])
    rows.append(f"start: {lead * 1000:.0f} ms before his first word; end: {tail * 1000:.0f} ms after his last")
    if lead > LEAD_MAX + 1e-3:
        fail(f"start: the reel opens {lead:.2f} s before his first word (at most {LEAD_MAX:.2f}): move the first line's in to {edges[0][1]:.3f}")
    if tail > TAIL_MAX + 1e-3:
        fail(f"end: the reel runs {tail:.2f} s past his last word (at most {TAIL_MAX:.2f}): give the last line \"tail\": "
             f"{max(0.0, TAIL_MAX - 0.03):.2f} or move its out to {edges[-1][3]:.3f}")

    # Every join: dead air from his last sound to his next, and what sits under the crossfade.
    joins = []
    for i in range(1, len(kept)):
        p, q = kept[i - 1], kept[i]
        after = max(0.0, p["out"] - edges[i - 1][3])
        before = max(0.0, edges[i][1] - q["in"])
        sil = after + before
        lo = sm.over_at(p["out"])
        li = sm.over_at(q["in"])
        joins.append((q["cut_start"], sil, p, q))
        line = f"join {i:2d} at {q['cut_start']:6.2f} s: {sil * 1000:3.0f} ms of dead air ({after * 1000:.0f} after, {before * 1000:.0f} before)"
        rows.append(line)
        if sil > JOIN_MAX + 1e-3:
            fail(f"join {i} at {q['cut_start']:.2f} s: {sil * 1000:.0f} ms from his last sound to his next (at most {JOIN_MAX * 1000:.0f}). "
                 f"Move line {i}'s out to {edges[i - 1][3]:.3f} and line {i + 1}'s in to {edges[i][1]:.3f}, or lower \"gap\".")
        for side, over, t in (("out of", lo, p["out"]), ("into", li, q["in"])):
            # His own word reaching the crossfade is the clip test's business (a fail, or a fade it notes); this one is
            # for what isn't his word: a breath, a lip click or a knock next to the cut.
            clipped_here = (side == "out of" and edges[i - 1][3] > p["out"] - soundmap.WIN) or \
                           (side == "into" and edges[i][1] < q["in"] + soundmap.WIN)
            excess = over[soundmap.WORD] - soundmap.RISE[soundmap.WORD]
            if not clipped_here and excess.max() > XF_NOISE:
                band, lvl = sm.loudest(over)
                fail(f"join {i} at {q['cut_start']:.2f} s: a breath or click under the crossfade {side} the line ({band} {lvl:+.0f} dB "
                     f"over the room at {t:.3f} on the take). Move the cut off it, or paint it with room tone (\"paint\" in cuts.json).")

    if a.hear:
        from faster_whisper import WhisperModel
        m = WhisperModel("medium.en", device="cpu", compute_type="int8")
        x16 = np.interp(np.arange(int(len(cut) * 16000 / rate)) * rate / 16000, np.arange(len(cut)), cut).astype(np.float32)
        norm = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())
        for i, k in enumerate(kept):
            seg = np.pad(x16[int(k["cut_start"] * 16000):int(k["cut_end"] * 16000)], 4800)
            segs, _ = m.transcribe(seg, beam_size=5, condition_on_previous_text=False, language="en", initial_prompt=None, vad_filter=False)
            heard = " ".join(s.text.strip() for s in segs)
            ok = norm(last_word(k["text"])) in norm(heard[-40:]) and norm(first_word(k["text"])) in norm(heard[:40])
            rows.append(f"heard {i + 1:2d}: {heard}")
            if not ok:
                note(f"line {i + 1}: with no prompt Whisper hears {heard!r} for {k['text']!r}: listen to its first and last word")

    if a.sheet:
        draw_sheet(a.sheet, cut, rate, joins, fails)

    print("\n".join(rows))
    print(f"\n{len(kept)} lines, {len(kept) - 1} joins: " + ("every word whole, every join tight" if not fails else f"{len(fails)} to fix"))
    if a.json:
        json.dump({"fails": fails, "notes": notes, "lines": len(kept)}, open(a.json, "w"), indent=1)
    sys.exit(1 if fails else 0)


def draw_sheet(path, cut, rate, joins, fails):
    from PIL import Image, ImageDraw, ImageFont
    try:
        font = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", 15)
    except OSError:
        font = ImageFont.load_default()
    W, H, cols, win, n, hop = 620, 235, 3, 0.9, 1024, 44
    wnd = np.hanning(n)
    ref = 20 * np.log10(np.percentile(np.abs(cut), 99.9) * n / 4 + 1e-9)
    stops = np.array([[0, 0, 0], [60, 10, 110], [200, 50, 80], [250, 160, 40], [255, 255, 220]], float)

    def cmap(v):
        p = v * (len(stops) - 1)
        i = np.clip(p.astype(int), 0, len(stops) - 2)
        f = (p - i)[..., None]
        return (stops[i] * (1 - f) + stops[i + 1] * f).astype(np.uint8)
    sheet = Image.new("RGB", (cols * W, max(1, (len(joins) + cols - 1) // cols) * H), (14, 14, 16))
    for j, (t, sil, p, q) in enumerate(joins):
        a0 = t - win / 2
        seg = cut[max(0, int(a0 * rate)):int((a0 + win) * rate)]
        if len(seg) < n + hop:
            continue
        fr = np.stack([seg[s:s + n] * wnd for s in range(0, len(seg) - n, hop)])
        v = np.clip((20 * np.log10(np.abs(np.fft.rfft(fr, axis=1)) + 1e-9) - ref + 80) / 75, 0, 1)
        im = Image.fromarray(cmap(v[:, :int(16000 / (rate / n))].T[::-1]), "RGB").resize((W, H - 75))
        pan = Image.new("RGB", (W, H), (14, 14, 16))
        pan.paste(im, (0, 20))
        d = ImageDraw.Draw(pan)
        bad = any(f"join {j + 1} " in f or f"line {j + 1}:" in f or f"line {j + 2}:" in f for f in fails)
        d.line([(W / 2, 20), (W / 2, H)], fill=(255, 80, 80) if bad else (90, 255, 120))
        d.text((6, 1), f"join {j + 1} at {t:.2f} s  {sil * 1000:.0f} ms  {'FIX' if bad else 'ok'}", font=font, fill=(255, 255, 255))
        d.text((6, H - 22), f"...{p['text'][-26:]} | {q['text'][:26]}...", font=font, fill=(200, 200, 200))
        sheet.paste(pan, ((j % cols) * W, (j // cols) * H))
    sheet.save(path)


if __name__ == "__main__":
    main()
