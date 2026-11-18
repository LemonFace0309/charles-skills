#!/usr/bin/env python3
"""Build a lesson folder into one page you can open in Chrome, with narration that highlights each word as it's read.

  python3 build.py <lesson dir> [--tts auto|kokoro|none] [--voice NAME] [--open]

<lesson dir> holds lesson.json, and optionally widgets.js (the lesson's interactive pieces) and assets/ (images).
Writes <lesson dir>/build/index.html plus build/audio/. Narration:
  kokoro  Kokoro-82M on fal.ai (needs FAL_KEY). Natural, about $0.02 per 1,000 characters, so about $0.12 for a
          900-word lesson. The default when a key is set.
  none    no audio files; the page reads aloud with the browser's own voice, free but more robotic.
(OpenAI's speech models shut down on 6 Jan 2027, so they're left out on purpose.)
Each sentence is voiced once and cached in build/cache/, so a rebuild only pays for sentences that changed.
Standard library only; ffmpeg, if installed, shrinks the audio to mp3.
"""
import argparse, concurrent.futures as cf, hashlib, html, json, os, re, shutil, struct, subprocess, sys, time, urllib.request, wave
from pathlib import Path

KIT = Path(__file__).resolve().parent
PRICE_PER_1K_CHARS = {"kokoro": 0.02}
VOICES = {"kokoro": "af_heart"}
GAP_SENTENCE, GAP_PARAGRAPH = 0.24, 0.5


def find_key(name, *starts):
    if os.environ.get(name):
        return os.environ[name]
    for start in starts:
        for d in [Path(start).resolve(), *Path(start).resolve().parents]:
            env = d / ".env"
            if env.is_file():
                m = re.search(rf"^(?:export\s+)?{name}=['\"]?([^'\"\n]+)", env.read_text(), re.M)
                if m:
                    return m.group(1).strip()
    return None


# ---------- text: must match parse() in player.js, so word i here is word i on the page ----------
def parse(text):
    paras = []
    for raw in re.split(r"\n\s*\n", (text or "").strip()):
        src = re.sub(r"\s+", " ", raw).strip()
        src = re.sub(r"\[\[[\w-]+\]\]\s?", "", src).replace("**", "")
        words = re.findall(r"\S+", src)
        if words:
            paras.append(words)
    return paras


def sentences(paras):
    """[(words, last_in_paragraph)] split after words ending in . ! or ? (same rule as the page's browser voice)."""
    out = []
    for p in paras:
        cur = []
        for k, w in enumerate(p):
            cur.append(w)
            if re.search(r"[.!?][\"')\]]*$", w) or k == len(p) - 1:
                out.append((cur, k == len(p) - 1))
                cur = []
    return out


def units(lesson):
    """Everything the narrator reads: each step's predict question (read before the reveal) and its main text."""
    for st in lesson["steps"]:
        if st.get("predict"):
            yield f"{st['id']}.q", parse(st["predict"]["q"])
        yield f"{st['id']}.say", parse(st["say"])


# ---------- speech ----------
def http(url, data=None, headers=None, timeout=120):
    req = urllib.request.Request(url, data=data, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def tts_kokoro(text, voice, key):
    body = json.dumps({"prompt": text, "voice": voice, "speed": 1.0}).encode()
    res = json.loads(http("https://fal.run/fal-ai/kokoro/american-english", body,
                          {"Authorization": f"Key {key}", "Content-Type": "application/json"}))
    return http(res["audio"]["url"])



def read_wav(path):
    with wave.open(str(path), "rb") as w:
        return w.getparams(), w.readframes(w.getnframes())


def trim(params, frames):
    """Drop the silence a TTS engine leaves before and after a sentence, so the gaps and the word timings are ours."""
    if params.sampwidth != 2:
        return frames
    n = len(frames) // 2
    s = struct.unpack(f"<{n}h", frames)
    if params.nchannels > 1:
        s = s[::params.nchannels]
    peak = max((abs(x) for x in s), default=0)
    if not peak:
        return frames
    thr = max(250, peak * 0.03)
    step = max(1, params.framerate // 2000)
    a = next((i for i in range(0, len(s), step) if abs(s[i]) > thr), 0)
    b = next((i for i in range(len(s) - 1, -1, -step) if abs(s[i]) > thr), len(s) - 1)
    pad = int(params.framerate * 0.03)
    a, b = max(0, a - pad), min(len(s), b + pad)
    bpf = params.sampwidth * params.nchannels
    return frames[a * bpf:b * bpf]


def word_times(words, start, dur):
    """Spread a sentence's duration over its words by length, with a little extra for punctuation pauses."""
    weights = []
    for w in words:
        x = len(re.sub(r"[^\w]", "", w)) + 1.5
        if re.search(r"[,;:]$", w):
            x += 2.5
        weights.append(x)
    total = sum(weights) or 1
    t, out = start, []
    for x in weights:
        d = dur * x / total
        out.append([round(t, 3), round(t + d, 3)])
        t += d
    return out


def build_audio(lesson, out, cache, engine, voice, key, log):
    say = {"kokoro": tts_kokoro}[engine]
    jobs = {}
    plan = []
    for ukey, paras in units(lesson):
        sents = sentences(paras)
        plan.append((ukey, sents))
        for words, _ in sents:
            text = " ".join(words)
            h = hashlib.sha1(f"{engine}|{voice}|{text}".encode()).hexdigest()[:16]
            jobs[h] = text
    todo = {h: t for h, t in jobs.items() if not (cache / f"{h}.wav").exists()}
    new_chars = sum(len(t) for t in todo.values())
    log(f"narration: {len(jobs)} sentences, {len(todo)} new ({new_chars:,} characters, about "
        f"${new_chars / 1000 * PRICE_PER_1K_CHARS[engine]:.2f}) with {engine} voice {voice}")

    def fetch(item):
        h, text = item
        for attempt in range(3):
            try:
                data = say(text, voice, key)
                (cache / f"{h}.wav").write_bytes(data)
                return
            except Exception as e:  # noqa: BLE001 - retry, then report which sentence failed
                if attempt == 2:
                    raise RuntimeError(f"{engine} failed on: {text[:60]}… ({e})")
                time.sleep(1.5 * (attempt + 1))
    with cf.ThreadPoolExecutor(16) as pool:
        list(pool.map(fetch, todo.items()))

    narration = {}
    audio_dir = out / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    ffmpeg = shutil.which("ffmpeg")
    for ukey, sents in plan:
        params, chunks, times, t = None, [], [], 0.0
        for words, para_end in sents:
            h = hashlib.sha1(f"{engine}|{voice}|{' '.join(words)}".encode()).hexdigest()[:16]
            p, frames = read_wav(cache / f"{h}.wav")
            params = params or p
            if (p.framerate, p.sampwidth, p.nchannels) != (params.framerate, params.sampwidth, params.nchannels):
                raise RuntimeError(f"{ukey}: sentences came back in different audio formats")
            frames = trim(p, frames)
            dur = len(frames) / (p.sampwidth * p.nchannels) / p.framerate
            times += word_times(words, t, dur)
            chunks.append(frames)
            gap = GAP_PARAGRAPH if para_end else GAP_SENTENCE
            chunks.append(b"\x00" * int(gap * p.framerate) * p.sampwidth * p.nchannels)
            t += dur + gap
        if not params:
            continue
        safe = re.sub(r"[^\w.-]", "_", ukey)
        wav_path = audio_dir / f"{safe}.wav"
        with wave.open(str(wav_path), "wb") as w:
            w.setparams(params)
            w.writeframes(b"".join(chunks))
        src = f"audio/{safe}.wav"
        if ffmpeg:
            mp3 = audio_dir / f"{safe}.mp3"
            r = subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-i", str(wav_path), "-ac", "1", "-b:a", "64k", str(mp3)])
            if r.returncode == 0:
                wav_path.unlink()
                src = f"audio/{safe}.mp3"
        narration[ukey] = {"src": src, "dur": round(t, 2), "words": times}
    return narration


# ---------- checks ----------
def check(lesson, widgets_js):
    errs, warns = [], []
    steps = lesson.get("steps") or []
    if not lesson.get("title"):
        errs.append("lesson.json needs a title")
    if not 3 <= len(steps) <= 9:
        warns.append(f"{len(steps)} steps; 4 to 7 keeps a lesson under about 8 minutes")
    seen = set()
    for k, st in enumerate(steps):
        st.setdefault("id", f"s{k + 1}")
        where = f"step {k + 1} ({st['id']})"
        if st["id"] in seen:
            errs.append(f"{where}: duplicate id")
        seen.add(st["id"])
        if not st.get("title") or not st.get("say"):
            errs.append(f"{where}: needs a title and say")
        n = sum(len(p) for p in parse(st.get("say", "")))
        if n > 150:
            warns.append(f"{where}: {n} words of narration; keep a step under 150 so it stays one idea")
        for kind in ("predict", "check"):
            q = st.get(kind)
            if q and not (q.get("q") and 2 <= len(q.get("choices", [])) <= 4 and 0 <= q.get("answer", -1) < len(q["choices"]) and q.get("why")):
                errs.append(f"{where}: {kind} needs q, 2-4 choices, a valid answer index and why")
        w = st.get("widget")
        if w and not re.search(rf"""learn\.widget\(\s*['"]{re.escape(w)}['"]""", widgets_js):
            errs.append(f"{where}: widget '{w}' isn't registered in widgets.js")
    for k, q in enumerate(lesson.get("quiz") or []):
        if not (q.get("q") and 2 <= len(q.get("choices", [])) <= 4 and 0 <= q.get("answer", -1) < len(q["choices"]) and q.get("why")):
            errs.append(f"quiz {k + 1}: needs q, 2-4 choices, a valid answer index and why")
    if len(lesson.get("terms") or []) > 6:
        warns.append("more than 6 key terms up front; pick the ones the lesson can't do without")
    return errs, warns


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("lesson")
    ap.add_argument("--tts", default="auto", choices=["auto", "kokoro", "none"])
    ap.add_argument("--voice")
    ap.add_argument("--open", action="store_true", help="open the page in Chrome when it's built")
    a = ap.parse_args()
    t0 = time.time()
    src = Path(a.lesson).resolve()
    lesson = json.loads((src / "lesson.json").read_text())
    widgets_js = (src / "widgets.js").read_text() if (src / "widgets.js").exists() else ""
    errs, warns = check(lesson, widgets_js)
    for w in warns:
        print(f"warning  {w}")
    if errs:
        for e in errs:
            print(f"error    {e}")
        sys.exit(1)
    out = src / "build"
    cache = out / "cache"
    cache.mkdir(parents=True, exist_ok=True)

    engine, key = a.tts, None
    if engine in ("auto", "kokoro"):
        key = find_key("FAL_KEY", src, Path.cwd(), Path.home())
        if not key and engine == "kokoro":
            sys.exit("--tts kokoro needs FAL_KEY in the environment or a .env file")
        engine = "kokoro" if key else "none"
    narration = {}
    if engine != "none":
        voice = a.voice or VOICES[engine]
        narration = build_audio(lesson, out, cache, engine, voice, key, print)
        lesson["voiceLabel"] = f"Kokoro · {voice}"
    else:
        print("narration: none (the page will use the browser's voice)")

    if (src / "assets").is_dir():
        shutil.copytree(src / "assets", out / "assets", dirs_exist_ok=True)
    js = lambda o: json.dumps(o, ensure_ascii=False).replace("</", "<\\/")
    page = (KIT / "template.html").read_text()
    for k, v in {"{{TITLE}}": html.escape(lesson["title"]), "{{CSS}}": (KIT / "page.css").read_text(),
                 "{{LESSON}}": js(lesson), "{{NARRATION}}": js(narration), "{{LEARN_JS}}": (KIT / "learn.js").read_text(),
                 "{{WIDGETS_JS}}": widgets_js, "{{PLAYER_JS}}": (KIT / "player.js").read_text()}.items():
        page = page.replace(k, v)
    (out / "index.html").write_text(page)
    words = sum(sum(len(p) for p in parse(st["say"])) for st in lesson["steps"])
    print(f"built {out / 'index.html'}: {len(lesson['steps'])} steps, {words} words (~{words / 150:.0f} min at 1x) in {time.time() - t0:.0f}s")
    if a.open:
        target = str(out / "index.html")
        if sys.platform == "darwin" and Path("/Applications/Google Chrome.app").exists():
            subprocess.run(["open", "-a", "Google Chrome", target])
        else:
            import webbrowser
            webbrowser.open(Path(target).as_uri())


if __name__ == "__main__":
    main()
