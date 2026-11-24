"""Find where he is making sound in a raw take, from the audio itself, and what he said in each stretch.

A cut can only land in the gaps this finds. Broadband loudness misses the weak ends of words (the "sh" in "polished",
the "ch" in "touch"), so a moment counts as sound if ANY of four bands stands clear of that band's own room noise.
Whisper only says what was said, one stretch at a time (a whole-file transcript merges his repeated takes into one or
drops them). It never decides where a word ends: its word edges are off by up to a tenth of a second.

usage (from a video's edit folder):
  uv run --with faster-whisper --with numpy python <skill>/scripts/voice_map.py [--raw ../footage/raw.mov]
      [--out work/voice_map.json] [--prompt "the script, so names come out right"] [--model medium.en] [--no-words]
--no-words skips Whisper and writes only the stretches (cut_take.py needs nothing more).
Writes the stretches, Whisper's words on the take's timeline, the audio's timestamp holes and each band's room noise."""
import argparse, json, os, sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import timeline_audio  # noqa: E402

BANDS = [(60, 300), (300, 3000), (3000, 8000), (8000, 16000)]
RISE = [12, 10, 8, 8]           # dB above that band's room noise that counts as sound
MIN_GAP = 0.035                 # a shorter dip stays inside the stretch (the closure of a stop consonant, say)
MIN_RUN = 0.03                  # a shorter blip is not voice
HOP_S, N = 0.005, 1024


def bands_db(x, rate):
    hop = int(HOP_S * rate)
    n = max(1, (len(x) - N) // hop)
    win = np.hanning(N)
    freqs = np.fft.rfftfreq(N, 1 / rate)
    masks = [(freqs >= a) & (freqs < b) for a, b in BANDS]
    E = np.zeros((n, len(BANDS)))
    for s in range(0, n, 4096):
        idx = np.arange(s, min(s + 4096, n))
        P = np.abs(np.fft.rfft(np.stack([x[i * hop:i * hop + N] * win for i in idx]), axis=1)) ** 2
        for b, m in enumerate(masks):
            E[idx, b] = P[:, m].sum(axis=1)
    return 10 * np.log10(E + 1e-14), lambda i: (i * hop + N / 2) / rate


def stretches(db, t_of, holes):
    keep = np.ones(len(db), bool)
    for a, b in holes:
        keep[max(int(a / HOP_S) - 50, 0):int(b / HOP_S) + 51] = False   # the floor is read away from the holes' zeros
    floor = np.percentile(db[keep] if keep.any() else db, 12, axis=0)
    on = ((db - floor) > np.array(RISE)).any(axis=1)
    gap, run = int(MIN_GAP / HOP_S), int(MIN_RUN / HOP_S)
    i = 0
    while i < len(on):
        if not on[i]:
            j = i
            while j < len(on) and not on[j]:
                j += 1
            if j - i < gap and 0 < i and j < len(on):
                on[i:j] = True
            i = j
        else:
            i += 1
    spans, i = [], 0
    while i < len(on):
        if on[i]:
            j = i
            while j < len(on) and on[j]:
                j += 1
            if j - i >= run:
                spans.append((t_of(i), t_of(j)))
            i = j
        else:
            i += 1
    return spans, floor


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--raw", default="../footage/raw.mov")
    ap.add_argument("--out", default="work/voice_map.json")
    ap.add_argument("--prompt", default=None, help="the script, so Whisper spells names right")
    ap.add_argument("--model", default="medium.en")
    ap.add_argument("--no-words", action="store_true")
    a = ap.parse_args()

    audio, rate, holes = timeline_audio.load(a.raw)
    x = audio.mean(axis=1)
    db, t_of = bands_db(x, rate)
    spans, floor = stretches(db, t_of, holes)
    model = None
    if not a.no_words:
        from faster_whisper import WhisperModel
        model = WhisperModel(a.model, device="cpu", compute_type="int8")
        n16 = int(len(x) * 16000 / rate)                       # 16 kHz on the same timeline
        x16 = np.interp(np.arange(n16) * rate / 16000, np.arange(len(x)), x).astype(np.float32)
    islands, words, prev = [], [], 0.0
    for t0, t1 in spans:
        text = ""
        if model is not None and t1 - t0 >= 0.08:
            pad = 0.05
            seg = x16[max(0, int((t0 - pad) * 16000)):int((t1 + pad) * 16000)]
            segs, _ = model.transcribe(np.pad(seg, 1600), word_timestamps=True, vad_filter=False, condition_on_previous_text=False,
                                       initial_prompt=a.prompt, beam_size=5, language="en")
            parts = []
            for s in segs:
                parts.append(s.text.strip())
                for w in s.words or []:
                    words.append({"word": w.word.strip(), "start": round(t0 - pad - 0.1 + w.start, 3), "end": round(t0 - pad - 0.1 + w.end, 3)})
            text = " ".join(parts)
        islands.append({"start": round(t0, 3), "end": round(t1, 3), "text": text})
        print(f"{len(islands) - 1:3d}  {t0:7.3f} {t1:7.3f}  {t1 - t0:5.2f}s  gap {t0 - prev:5.2f}  {text}", flush=True)
        prev = t1
    print("holes:", [(round(h0, 3), round(h1, 3)) for h0, h1 in holes])
    for ha, hb in holes:
        inside = [i for i, s in enumerate(islands) if s["start"] < hb and ha < s["end"]]
        print(f"  hole {ha:.3f}-{hb:.3f}: " + (f"TOUCHES stretch {inside}" if inside else "in silence"))
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    json.dump({"floor_db": [round(float(f), 1) for f in floor], "holes": holes, "islands": islands, "words": words}, open(a.out, "w"), indent=1)


if __name__ == "__main__":
    main()
