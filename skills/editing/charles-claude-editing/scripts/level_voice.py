"""Even out his voice across a reel the way an editor rides a fader: slow gain only. No compressor, no EQ, no denoise,
nothing that changes the sound of his voice (denoising and isolation make it sound processed).

Loudness is K-weighted (BS.1770) and measured only where he is speaking, so a pause can't read as "quiet":
1. Each phrase is brought to the same level, -16 LUFS while he speaks (reel-spec.json): a clip gain, moving in the
   silence between phrases.
2. Inside a phrase a slow rider (400 ms measure, smoothed again) takes out most of the drift, like a line trailing off at
   its end, and leaves the emphasis on single syllables alone.
Where he speaks comes from the word times in --words (a transcript on the cut's clock, {"segments": [{"words": [{start,
end}]}]}) when there is one, else from the sound itself (soundmap.py).

usage (from a video's edit folder, after cut_take.py):
  python3 <skill>/scripts/level_voice.py [--work work] [--words work/cut_tx.json] [--max-gain 10]
reads work/cut_voice.wav and work/cut.cuts.json, writes work/voice.wav (48 kHz mono float) and work/voice_gain.json, and
prints the levels before and after. Needs numpy and scipy."""
import argparse, json, os, struct, sys

import numpy as np
from scipy.ndimage import gaussian_filter1d
from scipy.signal import lfilter, resample_poly

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

TARGET = -16.0      # LUFS of the voice while he speaks, before the final mix sets the overall level
RIDE = 0.65         # how much of the drift inside a phrase the rider takes out: most of it, so a line still lands as said
HOP = 0.01
WIN = 0.4


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
    assert fmt[0] == 3 and fmt[5] == 32, "expected 32-bit float WAV (cut_take.py writes one)"
    return np.frombuffer(body, dtype=np.float32).reshape(-1, fmt[1]), fmt[2]


def write_wav(path, x, rate):
    x = np.asarray(x, dtype=np.float32)
    x = x.reshape(len(x), -1)
    pcm = x.tobytes()
    ch = x.shape[1]
    with open(path, "wb") as f:
        f.write(b"RIFF" + struct.pack("<I", 36 + len(pcm)) + b"WAVEfmt " + struct.pack("<IHHIIHH", 16, 3, ch, rate, rate * 4 * ch, 4 * ch, 32)
                + b"data" + struct.pack("<I", len(pcm)) + pcm)


def kweight48(x):
    y = lfilter([1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585], x)
    return lfilter([1.0, -2.0, 1.0], [1, -1.99004745483398, 0.99007225036621], y)


def lufs(energy):
    return -0.691 + 10 * np.log10(energy + 1e-12)


def word_mask(n, rate, words_path, x):
    mask = np.zeros(n, dtype=bool)
    if words_path and os.path.exists(words_path):
        for s in json.load(open(words_path))["segments"]:
            for w in s["words"]:
                mask[int(w["start"] * rate):int(w["end"] * rate)] = True
        return mask
    import soundmap
    sm = soundmap.SoundMap(x.astype(np.float32), rate)
    pad = int(0.03 * rate)
    for i in np.flatnonzero(sm.on):
        c = int(sm.t[i] * rate)
        mask[max(0, c - pad):c + pad] = True
    return mask


def local_loudness(k2, mask, rate):
    """Loudness around each moment over the speech samples only, with NaN where there's no speech in the window."""
    hop = int(HOP * rate)
    win = int(WIN * rate)
    e = np.concatenate([[0], np.cumsum(k2 * mask)])
    c = np.concatenate([[0], np.cumsum(mask)])
    centers = np.arange(0, len(k2), hop)
    a = np.clip(centers - win // 2, 0, len(k2))
    b = np.clip(centers + win // 2, 0, len(k2))
    cov = c[b] - c[a]
    out = np.full(len(centers), np.nan)
    ok = cov > 0.12 * rate      # at least 120 ms of speech to judge by
    out[ok] = lufs((e[b[ok]] - e[a[ok]]) / cov[ok])
    return centers / rate, out


def report(name, k2, mask, rate, kept):
    t, L = local_loudness(k2, mask, rate)
    vals = L[~np.isnan(L)]
    ph = []
    for k in kept:
        a, b = int(k["cut_start"] * rate), int(k["cut_end"] * rate)
        m = mask[a:b]
        ph.append(lufs(k2[a:b][m].mean()) if m.any() else np.nan)
    ph = np.array(ph)
    print(f"{name}: phrases {np.nanmin(ph):.1f} to {np.nanmax(ph):.1f} LUFS (spread {np.nanmax(ph) - np.nanmin(ph):.1f} dB)   400 ms: "
          f"p5 {np.percentile(vals, 5):.1f}, p50 {np.percentile(vals, 50):.1f}, p95 {np.percentile(vals, 95):.1f}")
    return ph


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--work", default="work")
    ap.add_argument("--words", default="work/cut_tx.json", help="word times on the cut's clock, when there are some")
    ap.add_argument("--max-gain", type=float, default=10.0, help="more boost for a phrase read far from the mic")
    a = ap.parse_args()
    x, r0 = read_wav(os.path.join(a.work, "cut_voice.wav"))
    x = x[:, 0].astype(np.float64)
    rate = 48000
    if r0 != rate:
        g = np.gcd(rate, r0)
        x = resample_poly(x, rate // g, r0 // g)
    kept = json.load(open(os.path.join(a.work, "cut.cuts.json")))["kept"]
    mask = word_mask(len(x), rate, a.words, x)
    k2 = kweight48(x) ** 2
    ph = report("before", k2, mask, rate, kept)
    t, L = local_loudness(k2, mask, rate)
    gain = np.full(len(t), np.nan)
    for k, p in zip(kept, ph):
        if np.isnan(p):
            continue
        i = (t >= k["cut_start"]) & (t < k["cut_end"])
        gain[i] = (TARGET - p) + RIDE * (p - L[i])     # the phrase's clip gain, plus most of the local drift
    good = ~np.isnan(gain)
    gain = np.interp(t, t[good], gain[good])
    gain = np.clip(gain, -9, a.max_gain)
    # Smooth enough that it can't follow a syllable, and the moves between phrases fall in the silence.
    gain = gaussian_filter1d(gain, 0.11 / HOP, mode="nearest")
    y = x * 10 ** (np.interp(np.arange(len(x)) / rate, t, gain) / 20)
    report("after ", kweight48(y) ** 2, mask, rate, kept)
    print(f"   gain used: {gain.min():+.1f} to {gain.max():+.1f} dB; sample peak before {20 * np.log10(np.abs(x).max()):+.1f} dBFS, "
          f"after {20 * np.log10(np.abs(y).max()):+.1f} dBFS")
    write_wav(os.path.join(a.work, "voice.wav"), y, rate)
    json.dump({"t": t[::2].round(3).tolist(), "gain_db": gain[::2].round(2).tolist()}, open(os.path.join(a.work, "voice_gain.json"), "w"))


if __name__ == "__main__":
    main()
