"""Where his words really start and stop in a take, band by band, read on the file's own timeline.

Broadband loudness is what clipped his words: a final "s", "t" or "sh" carries most of its energy at 3-16 kHz and barely
moves the total level, so a cut that a broadband test calls silent can still slice it. Here every band is read against
the room in that band, the way voice_map.py finds his phrases.

A word's edge is measured against his own line. After a line he usually breathes out, and a breath, a lip click or the
room's rumble and hum sit far below his voice and have no pitch, so "anything over the room" would run on through them.
A word goes on while it is voiced in the 300-3000 Hz band, or hiss-shaped above 3 kHz (a fricative or a release), within
FADE_DROP of the line's own level in that band and over the room. Its clip edge is the last moment inside that extent
where it is still within CLIP_DROP of the line's level: cutting before that takes part of the word itself.

check_cut.py and tighten.py import this. It needs numpy, and ffmpeg through timeline_audio.py."""
import numpy as np

BANDS = [(60, 300), (300, 3000), (3000, 8000), (8000, 16000)]
NAMES = ["low (60-300 Hz)", "voice (300-3000 Hz)", "hiss (3-8 kHz)", "air (8-16 kHz)"]
RISE = np.array([12.0, 10.0, 8.0, 8.0])   # dB above that band's room that counts as sound (voice_map.py's)
WORD = [1, 2, 3]                          # the bands a word's loudest syllable is found in
LOW_EXTRA = 6.0                           # the 60-300 Hz band counts toward a word only this far over its own RISE
HOP = 0.005                               # seconds between frames (rounded to whole samples; see SoundMap.dt)
WIN = 0.012                               # analysis window: short, so an edge lands within a few ms of where it is
FADE_DROP = 40.0                          # the word has ended once every band is this far below its syllable: deep enough for a "th", an "f" or an "ng" fading out
CLIP_DROP = 20.0                          # sound within this of the peak is the word itself: cutting it clips the word
CLIP_RISE = 14.0                          # and clears the room by RISE plus this: a breath (13-20 dB over the room) never does
CLIP_SLACK = 0.015                        # a cut may leave this much of the word past it: the crossfade and the window's blur
SYLLABLE = 0.25                           # how far from a tested edge the word's nearest syllable is looked for
FADE_TAIL = 0.15                          # a word's faint fade runs at most this far past its last strong sound
MIN_GAP = 0.035                           # a shorter dip is inside a word (a stop's closure), as voice_map.py merges it
MIN_RUN = 0.015                           # a shorter blip is a click or a tick, not the word going on
RELEASE_WINDOW = 0.10                     # a stop's release follows its closure within this; a click before his next line comes later
BRIDGE = 0.12                             # a silence this short with strong sound beyond it is a closure inside the word
RELEASE_CLIP = (0.02, 0.07)               # a burst this long counts toward a clip; a click is shorter, a breath longer
BRIDGE_DROP, BRIDGE_RISE = 15.0, 12.0     # what a closure may be bridged to: clearly the word (a vowel, a loud "s"), never a breath
RELEASE_MAX = 0.15                        # a release, aspiration included ("effect" breathes out its t for ~80 ms); a new word is longer and not followed by quiet
VOICED = 0.35                             # normalised autocorrelation at the pitch lag above which a frame is voiced
GATE_VOICED, GATE_HISSY = False, False    # voicing and hiss shape proved unreliable on phone takes with a hum (24 Nov 2026 calibration); kept for tests
VOICE_LOUD = 10.0


class SoundMap:
    """Band levels over a take every HOP seconds. `over[i, b]` is frame i's level in band b above the room there."""

    def __init__(self, x, rate, holes=()):
        self.x, self.rate = x, rate
        n = int(round(WIN * rate))
        self.n = n + n % 2
        hop = int(round(HOP * rate))
        self.dt = hop / rate                                  # the real hop: 220 samples at 44.1 kHz is 4.989 ms, not 5
        self.win = np.hanning(self.n)
        freqs = np.fft.rfftfreq(self.n, 1 / rate)
        self.masks = [(freqs >= a) & (freqs < min(b, rate / 2)) for a, b in BANDS]
        count = max(1, (len(x) - self.n) // hop + 1)
        db = np.zeros((count, len(BANDS)))
        for s in range(0, count, 8192):
            idx = np.arange(s, min(s + 8192, count))
            db[idx] = self._bands(np.stack([x[i * hop:i * hop + self.n] for i in idx]))
        self.t = (np.arange(count) * hop + self.n / 2) / rate  # each frame's centre on the take's timeline
        self.db = db
        keep = np.ones(count, bool)
        for a, b in holes:                                    # the room is read away from timestamp holes, whose zeros drag it down
            keep[max(0, self.index(a) - 20):self.index(b) + 20] = False
        # The room, per band: the take's quiet 12th percentile, raised wherever the room itself is louder for a while (a
        # hum that comes and goes, a fan), read as the quietest 5% of the 6 s around each moment.
        self.floor = np.percentile(db[keep] if keep.any() else db, 12, axis=0)
        step, half = self.frames(0.25), self.frames(3.0)
        grid = np.arange(0, count, step)
        local = []
        for g in grid:
            sl = slice(max(0, g - half), g + half + 1)
            local.append(np.percentile(db[sl][keep[sl]] if keep[sl].any() else db[sl], 5, axis=0))
        local = np.array(local)
        idx = np.arange(count)
        self.room = np.maximum(self.floor[None, :], np.stack([np.interp(idx, grid, local[:, b]) for b in range(len(BANDS))], axis=1))
        self.over = db - self.room
        self.on = (self.over > RISE).any(axis=1)
        lin = 10 ** (db / 10)
        # A fricative (s, sh, f, a t's release) puts more energy above 3 kHz than below it; a vowel or a hum doesn't.
        self.hissy = lin[:, 2] + lin[:, 3] > lin[:, 0] + lin[:, 1]
        # Voiced: the waveform repeats at a pitch between 70 and 400 Hz (a vowel, an "m", an "l", a creak). A breath and the
        # room don't, so voice-band sound only counts as his word where it is voiced.
        self.voiced = self._voicing(hop, count)

    def _voicing(self, hop, count):
        """Whether each frame repeats at a pitch, read below 1 kHz on a 50 ms window with lags for 40-400 Hz, so a creak or
        vocal fry at the end of a line (pulses as slow as 40 a second) still counts as voiced."""
        n = int(0.05 * self.rate)
        lo, hi = int(self.rate / 400), int(self.rate / 40)
        size = 1 << (2 * n - 1).bit_length()
        band = (np.fft.rfftfreq(size, 1 / self.rate) > 50) & (np.fft.rfftfreq(size, 1 / self.rate) < 1000)
        win = np.hanning(n)
        out = np.zeros(count, bool)
        half = n // 2
        for s in range(0, count, 1024):
            idx = np.arange(s, min(s + 1024, count))
            c = (idx * hop + self.n // 2).astype(int)
            seg = np.stack([self.x[ci - half:ci - half + n] if 0 <= ci - half and ci - half + n <= len(self.x) else np.zeros(n) for ci in c])
            f = np.fft.rfft((seg - seg.mean(axis=1, keepdims=True)) * win, size, axis=1) * band
            ac = np.fft.irfft(np.abs(f) ** 2, size, axis=1)[:, :hi + 1]
            out[idx] = ac[:, lo:hi + 1].max(axis=1) / (ac[:, 0] + 1e-12) > VOICED
        return out

    def _bands(self, frames):
        p = np.abs(np.fft.rfft(frames * self.win, axis=1)) ** 2
        return np.stack([10 * np.log10(p[:, m].sum(axis=1) + 1e-14) if m.any() else np.full(len(p), -140.0)
                         for m in self.masks], axis=1)

    def index(self, t):
        return int(np.clip(round((t - self.t[0]) / self.dt), 0, len(self.t) - 1))

    def frames(self, seconds):
        return max(1, int(round(seconds / self.dt)))

    def over_at(self, t):
        """Each band's level over the room in one window centred exactly on t: what a cut's crossfade lets through."""
        s = int(round(t * self.rate)) - self.n // 2
        if s < 0 or s + self.n > len(self.x):
            return np.zeros(len(BANDS))
        return self._bands(self.x[s:s + self.n][None])[0] - self.room[self.index(t)]

    def loudest(self, over):
        """The band of `over` that rises most above its RISE, and by how much over the room."""
        b = int(np.argmax(np.asarray(over) - RISE))
        return NAMES[b], float(over[b])

    def _peak(self, a, b):
        i0, i1 = self.index(a), self.index(b)
        return self.over[i0:max(i0, i1) + 1].max(axis=0)

    def _mask(self, i0, i1, peak, drop, rise=0.0, keep_short=False):
        """Frames in [i0, i1] where a WORD band is over the room by RISE (+ rise) and within `drop` of `peak`. Runs shorter
        than MIN_RUN are dropped unless keep_short: a lip click or a tick is not the word going on."""
        thr = np.maximum(RISE + rise, peak - drop)
        o = self.over[i0:i1 + 1]
        v = self.voiced[i0:i1 + 1] | (o[:, 1] > thr[1] + VOICE_LOUD) if GATE_VOICED else True
        h = self.hissy[i0:i1 + 1] if GATE_HISSY else True
        # A nasal ("n", "ng", "m") fades out below 300 Hz, so the low band counts toward a word's fade, but only well over
        # the room, and never as strong sound: rumble and handling noise live there.
        low = (o[:, 0] > np.maximum(thr[0], RISE[0] + LOW_EXTRA)) if rise == 0 else False   # never toward a clip or a bridge
        m = low | ((o[:, 1] > thr[1]) & v) | (((o[:, 2] > thr[2]) | (o[:, 3] > thr[3])) & h)
        if keep_short:
            return m
        out, i, n = m.copy(), 0, self.frames(MIN_RUN)
        while i < len(m):
            if m[i]:
                j = i
                while j < len(m) and m[j]:
                    j += 1
                if j - i < n:
                    out[i:j] = False
                i = j
            else:
                i += 1
        return out

    def _walk(self, mask, j, step, stop):
        """From frame j (inside the word), move by `step` over the mask, bridging dips shorter than MIN_GAP. Returns the
        last frame of sound reached. `stop` is the index the walk may not pass."""
        last = j
        gap_n = self.frames(MIN_GAP)
        while (j - stop) * step <= 0:
            if mask[j]:
                last = j
            elif abs(j - last) >= gap_n:
                break
            j += step
        return last

    def _bridge(self, fade, strong, edge, step, stop):
        """Cross a silence inside a word: a stop's closure ("I-d" in "Identity", "ligh-ts") can last longer than MIN_GAP.
        When strong sound (clip-level: a vowel, a loud consonant) starts again within BRIDGE beyond `edge`, it is the same
        word, so the walk goes on from there. A breath sits 20 dB or more below the word, so it is never strong enough."""
        for _ in range(3):
            far = edge + step * self.frames(BRIDGE)
            rng = range(edge + step * self.frames(MIN_GAP), (min(far, stop) if step > 0 else max(far, stop)) + step, step)
            hit = next((r for r in rng if strong[r]), None)
            if hit is None:
                return edge
            edge = self._walk(fade, hit, step, stop)
        return edge

    def _reference(self, a, b, level):
        """What a word's sound is measured against, per band. The voice band takes the nearest syllable's own peak, because
        a line's last syllable is often 15-25 dB quieter than its loudest; the hiss bands take the line's level when it is
        higher, so a breath after a loud "s" can't pass for more of the word."""
        ref = self._peak(a, b)
        if level is not None:
            ref[2:] = np.maximum(ref[2:], level[2:])
        return ref

    def level(self, a, b):
        """A line's own loud level per band over the room: its 95th percentile between a and b."""
        i0, i1 = self.index(a), self.index(b)
        return np.percentile(self.over[i0:max(i0 + 1, i1 + 1)], 95, axis=0)

    def end(self, near, limit, stop_final=False, level=None):
        """(clip edge, fade edge) of the word ending around `near`, the out point being tested: it may sit early, inside
        the word, or late, in the silence after it. The walk starts on the loudest frame within SYLLABLE of `near`, runs
        forward over the word, and, when the word ends in a stop (`stop_final`), crosses its closure to its release, up to
        twice ("effect" has a k and a t). Never past `limit`. Edges are reported late by half a window, so a check
        errs toward calling a cut clipped."""
        a, b = near - SYLLABLE, min(limit, near + SYLLABLE / 2)
        i0, ib, i1 = self.index(a), self.index(b), self.index(limit)
        peak = self._reference(a, b, level)
        fade = self._mask(i0, i1, peak, FADE_DROP)
        raw = self._mask(i0, i1, peak, FADE_DROP, keep_short=True)
        if not fade[:ib - i0 + 1].any():
            return near, near
        start = int(np.argmax(self.over[i0:ib + 1][:, WORD].max(axis=1)))
        strong = self._mask(i0, i1, peak, CLIP_DROP, rise=CLIP_RISE)
        sure = self._mask(i0, i1, peak, BRIDGE_DROP, rise=BRIDGE_RISE)
        last = self._bridge(fade, sure, self._walk(fade, start, 1, i1 - i0), 1, i1 - i0)
        # A word that ends in a stop ("up", "effect") goes silent for its closure, then releases a short burst; that burst
        # is the word's last sound, and the word ends with it ("effect" has two: the k, then the t). Only these words get
        # the bridge, because after any other word a short burst is a lip click.
        for _ in range(2 if stop_final else 0):
            lo, hi = last + self.frames(MIN_GAP), min(i1 - i0, last + self.frames(RELEASE_WINDOW))
            run = next((r for r in range(lo, hi + 1) if raw[r]), None)
            if run is None:
                break
            k = run
            while k <= i1 - i0 and raw[k]:
                k += 1
            if (k - run) * self.dt > RELEASE_MAX:          # longer than a release: a new word or a breath, not this word
                break
            if RELEASE_CLIP[0] <= (k - run) * self.dt <= RELEASE_CLIP[1]:   # a release, not a 2-8 ms lip click or a breath
                strong[run:k] |= self._mask(i0 + run, i0 + k - 1, peak, CLIP_DROP, rise=CLIP_RISE, keep_short=True)
            last = k - 1
        clip = start + (int(np.flatnonzero(strong[start:last + 1])[-1]) if strong[start:last + 1].any() else 0)
        # A word's faint fade lasts a beat; a smooth exhale can run for 300 ms. Past FADE_TAIL after its last strong sound,
        # what is left is breath, so the word's fade stops there.
        last = min(last, clip + self.frames(FADE_TAIL)) if strong[start:last + 1].any() else last
        return float(self.t[i0 + clip] + WIN / 2), float(self.t[i0 + last] + WIN / 2)

    def start(self, near, limit, level=None):
        """(clip edge, fade edge) of the word starting around `near`: the same walk in reverse from the first syllable's
        loudest frame, never before `limit`. Edges are reported early by half a window."""
        a, b = max(limit, near - SYLLABLE / 2), near + SYLLABLE
        i0, ia, ib = self.index(limit), self.index(a), self.index(b)
        peak = self._reference(a, b, level)
        fade = self._mask(i0, ib, peak, FADE_DROP)
        if not fade[ia - i0:].any():
            return near, near
        top = ia - i0 + int(np.argmax(self.over[ia:ib + 1][:, WORD].max(axis=1)))
        strong_all = self._mask(i0, ib, peak, CLIP_DROP, rise=CLIP_RISE)
        first = self._bridge(fade, self._mask(i0, ib, peak, BRIDGE_DROP, rise=BRIDGE_RISE), self._walk(fade, top, -1, 0), -1, 0)
        strong = strong_all[first:]
        clip = first + (int(np.flatnonzero(strong)[0]) if strong.any() else top - first)
        first = max(first, clip - self.frames(FADE_TAIL)) if strong.any() else first
        return float(self.t[i0 + clip] - WIN / 2), float(self.t[i0 + first] - WIN / 2)

    def pauses(self, a, b, min_len):
        """Stretches inside a line [a, b] where his words stop for min_len or longer: dead air he left mid-line. Read against
        the line's own level, so a breath inside the pause still counts as part of the pause."""
        i0, i1 = self.index(a), self.index(b)
        word = self._mask(i0, i1, self.level(a, b), FADE_DROP)
        out, last = [], None
        for i, w in enumerate(word):
            if w:
                if last is not None and (i - last) * self.dt >= min_len:
                    out.append((float(self.t[i0 + last] + WIN / 2), float(self.t[i0 + i] - WIN / 2)))
                last = i
        return out


def ends_in_stop(word):
    """Whether a word, as spelled, ends in a stop consonant whose release comes after a short silence ("up", "effect",
    "used", "back"), and not a silent letter ("sending", "thumb", "sign")."""
    w = "".join(c for c in word.lower() if c.isalpha())
    return bool(w) and (w[-1] in "ptkbdg" or w.endswith("ed")) and not w.endswith(("ng", "mb", "gn"))
