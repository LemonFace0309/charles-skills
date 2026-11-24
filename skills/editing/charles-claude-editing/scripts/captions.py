"""Burn his captions and the hook title into a reel, drawn the way reelkit draws them, in any folder.

Captions: Helvetica Neue Bold, 66 px on the 1080x1920 grid, white with a 3 px black outline and a soft shadow, sentence
case, 2-3 words a line, centred at reel-spec.json's caption line (y 1380), no animation. Lines break at sentence ends
first, then at commas, joins and pauses, and not after "the", "to" or "and" when a better break exists. A caption comes
up on its first word (a line's first caption on the frame its cut opens) and stays until the next one, or 0.35 s past
its last word where he stops. --keyword writes the comment keyword in caps inside curly quotes, the word and its quotes
yellow (#FFD60A) with the same outline, where he asks for it (within three words after "comment"). Words TikTok may block
("suicide", "kill myself", "self-harm") are censored in the captions and the hook; --censor adds more.

The hook (--hook): black Helvetica Neue Bold on white, each line in its own rounded box sized to that line, so the white
bends where a shorter line meets a longer one, like TikTok's own text. At most two balanced lines, shrinking from 72 px
to 56 px to fit. "|" breaks a line by hand: a third line only when a CAPS word gets its own ("Samsung|EXPOSED|for spying
on users"), or when it can't fit in two. It stays inside the 60 px text inset with its top at y 240 (the headline band,
under the 200 px header), or centred on --hook-y (a split screen's seam). The keyword in it is caps in quotes, in black.
It is up from the start until --hook-until: by default the end of his first sentence, or of the first one that ends
3 s in or later. While it sits on the caption line, the captions wait for it.

Where the words come from (times on the cut's clock):
  default            work/voice_map.json's words, moved onto the cut through work/cut.cuts.json. The text is each kept
                     line's own from the cut list, so names you fixed there stay fixed, and Whisper only times it: a word
                     it heard that the line doesn't have (a "Thanks for watching!" over a breath) never reaches a caption
  --words FILE       a flat list of {"word", "start", "end"}, or reelkit's cut_tx.json ({"segments": [{"words": [...]}]})
  --captions FILE    finished captions: work/captions.json from an earlier run, edited by hand (or reelkit's
                     build/captions.json)
Every run writes work/captions.json and prints every caption. Check each one against what he said; to fix one, edit its
"text" (or move a word to the next caption and set the boundary to that word's start from "words"), give it a "y" to
move it off an asset, and run again with --captions work/captions.json.

usage (from a video's edit folder):
  python3 <skill>/scripts/captions.py <video> <out.mp4> [--work work] [--words FILE | --captions FILE]
      [--keyword WORD] [--censor word=replacement ...] [--hook "text" [--hook-until S] [--hook-y Y]] [--y 1380]
      [--size 1080x1920|2160x3840] [--font PATH] [--preview]
<video> is the edit with everything else on it (the cut, or the reel with its overlays and mix); its sound is kept, as
AAC 256k (AAC is copied). The export is H.264, CRF 20 at 1080x1920 and CRF 16 at 2160x3840, where the footage is scaled
up once and the text is drawn at 2x. Positions are on the 1080x1920 grid at either size. --preview stops before the
encode, leaving the overlay stills in work/captions/. Needs Pillow and ffmpeg."""
import argparse, difflib, json, os, re, subprocess, sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SPEC = json.load(open(os.path.join(HERE, "..", "reel-spec.json"), encoding="utf-8"))
W, H = SPEC["frame"]["width"], SPEC["frame"]["height"]
TOP, BOTTOM = SPEC["platform"]["top"], SPEC["platform"]["bottom"]               # the platform's header and its bottom zone
RAIL_X, RAIL_Y = SPEC["platform"]["buttons"]["left"], SPEC["platform"]["buttons"]["top"]   # the like/comment/share column
INSET = SPEC["text_inset"]["px"]
HEADLINE_TOP = SPEC["bands"]["headline"][0]
CAPTION_Y, CAPTION_PX = SPEC["captions"]["talking_head_centre_y"], SPEC["captions"]["size_px"]

LANCZOS = getattr(Image, "Resampling", Image).LANCZOS
HELVETICA_NEUE = "/System/Library/Fonts/HelveticaNeue.ttc"
OUTLINE = 3                      # px of black outline round a caption
SHADOW_BLUR, SHADOW_ALPHA = 8, 170
CAPTION_MIN_PX = 48              # a caption too wide for the safe width shrinks this far at most
KEYWORD_FILL = (255, 214, 10, 255)
HOLD = 0.35                      # how long a caption stays past its last word where he stops
FLICKER = 0.2                    # a gap this short between two captions is closed: it would read as a flicker
HOOK_SIZES = (72, 66, 60, 56)
HOOK_PAD = 30                    # white past the words, each side of a hook line
HOOK_MIN_UP = 3.0                # the hook's default end is the first sentence end at least this far in

CLOSERS = "\"'\u201d\u2019)]"
ABBREV = {"mr.", "mrs.", "ms.", "dr.", "vs.", "st.", "e.g.", "i.e."}
# A caption that ends on one of these leaves its word hanging ("If two | colours", "This is what | I got"); a subject
# pronoun or a helper verb hangs less ("and I | will"). A helper verb starts a caption rather than sitting inside one
# after its subject ("The orange here | is doing", not "here is doing"), unless the subject is a pronoun ("and I will").
CONJ = set("and or but so if because when while nor".split())         # opens the next clause: hangs worst
FUNCTION = set("a an the my your his her its our their this that these those to of in on at for with from by into onto "
               "about as than every each some any no other another what which who whom whose where why how two three four "
               "five six seven eight nine ten".split())
LIGHT = set("i i'm i'll i've i'd we they he she is are was were be been am will would can could should do does did have "
            "has had just really very".split())
AUX = set("is are was were will would can could should do does did has have had".split())
SUBJECT = set("i you we they he she it this that there who what".split())
CENSOR = [(r"\bsuicid(?:e|al)\b", lambda m: m.group(0)[0] + "*" * (len(m.group(0)) - 2) + m.group(0)[-1]),
          (r"\bkill(?:ed|ing)? (?:myself|themselves|himself|herself|yourself)\b", lambda m: m.group(0)[0] + "*" + m.group(0)[2:]),
          (r"\bself[- ]harm\b", lambda m: m.group(0)[:-4] + m.group(0)[-4] + "*" + m.group(0)[-2:])]


def norm(s):
    return "".join(c for c in s.lower() if c.isalnum())


def core(s):
    return s.lower().replace("\u2019", "'").strip("\"'\u201c\u201d.,!?:;()[]")


def ends_sentence(word):
    w = word.rstrip(CLOSERS)
    return w.endswith((".", "?", "!", "\u2026")) and w.lower() not in ABBREV


def soft_break(word):
    return word.rstrip(CLOSERS).endswith((",", ";", ":", "\u2014", "\u2013", "-"))


# ------------------------------------------------------------------ font
class Face:
    def __init__(self, path, index, label):
        self.path, self.index, self.label, self.cache = path, index, label, {}

    def __call__(self, size):
        if size not in self.cache:
            self.cache[size] = ImageFont.truetype(self.path, size, index=self.index)
        return self.cache[size]


def bold_face(path, index=None):
    """The file's Bold face (a .ttc holds several), as (index, "Family Style")."""
    faces = []
    for i in ([index] if index is not None else range(64)):
        try:
            faces.append((i,) + ImageFont.truetype(path, 12, index=i).getname())
        except (OSError, ValueError):
            break
    if not faces:
        sys.exit(f"captions.py: can't read a font from {path}")
    for good in (lambda s: s == "Bold", lambda s: "Bold" in s and not re.search("Italic|Oblique|Condensed|Narrow", s), lambda s: True):
        for i, family, style in faces:
            if good(style):
                return i, f"{family} {style}"


def find_font(path):
    if path:
        return Face(path, *bold_face(path)), None
    if os.path.exists(HELVETICA_NEUE):
        return Face(HELVETICA_NEUE, *bold_face(HELVETICA_NEUE)), None
    found = None
    try:        # fontconfig's closest match to Helvetica Neue Bold: on Linux usually Nimbus Sans, Liberation Sans or DejaVu Sans
        out = subprocess.run(["fc-match", "-f", "%{file}\n%{index}", "Helvetica Neue:bold"], capture_output=True, text=True).stdout.split("\n")
        if out[0] and os.path.exists(out[0]):
            found = (out[0], int(out[1]) if len(out) > 1 and out[1].strip().isdigit() else None)
    except OSError:
        pass
    for p in ("/System/Library/Fonts/Helvetica.ttc", "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "C:/Windows/Fonts/arialbd.ttf"):
        if not found and os.path.exists(p):
            found = (p, None)
    if not found:
        sys.exit("captions.py: Helvetica Neue isn't installed here and no fallback font was found: pass --font /path/to/a/bold.ttf")
    face = Face(found[0], *bold_face(*found))
    if face.label.startswith("Helvetica Neue"):
        return face, None
    return face, (f"Helvetica Neue isn't installed here, so the captions and the hook use {face.label} ({face.path}) instead. "
                  f"Pass --font to choose another.")


# ------------------------------------------------------------------ words
def read_words(path):
    data = json.load(open(path, encoding="utf-8"))
    if isinstance(data, dict):
        data = [w for s in data["segments"] for w in s.get("words", [])] if "segments" in data else data.get("words", [])
    out = [{"word": str(w.get("word", w.get("text", ""))).strip(), "start": float(w["start"]), "end": float(w["end"])} for w in data]
    return sorted((w for w in out if w["word"]), key=lambda w: w["start"])


def spread(toks, s, e):
    """Tokens across [s, e], each getting time in proportion to its letters."""
    n = [max(1, len(norm(t))) for t in toks]
    out, t = [], s
    for tok, k in zip(toks, n):
        d = max(0.0, e - s) * k / sum(n)
        out.append((tok, t, t + d))
        t += d
    return out


def align(heard, said, a, b):
    """The line's own words (said), timed by Whisper's (heard) where they match, spread evenly where they differ. Words
    Whisper heard that the line doesn't have are dropped."""
    if not said:
        return [(w["word"], w["start"], w["end"]) for w in heard]
    if not heard:
        return spread(said, a, b)
    out = []
    ops = difflib.SequenceMatcher(None, [norm(w["word"]) for w in heard], [norm(t) for t in said], autojunk=False).get_opcodes()
    for tag, i0, i1, j0, j1 in ops:
        if tag == "equal":
            out += [(said[j0 + k], heard[i0 + k]["start"], heard[i0 + k]["end"]) for k in range(i1 - i0)]
        elif tag == "replace":
            out += spread(said[j0:j1], heard[i0]["start"], heard[i1 - 1]["end"])
        elif tag == "insert":
            s = out[-1][2] if out else a
            out += spread(said[j0:j1], s, max(s, heard[i0]["start"] if i0 < len(heard) else b))
    return out


def words_from_take(work, say):
    """voice_map.json's words on the cut's clock, with each kept line's own text (see the docstring)."""
    vm_path, cc_path = os.path.join(work, "voice_map.json"), os.path.join(work, "cut.cuts.json")
    for p in (vm_path, cc_path):
        if not os.path.exists(p):
            sys.exit(f"captions.py: no {p}. Run voice_map.py and cut_take.py first, or pass --words")
    raw = [w for w in json.load(open(vm_path, encoding="utf-8")).get("words", []) if str(w.get("word", "")).strip()]
    if not raw:
        sys.exit(f"captions.py: {vm_path} has no words (voice_map.py ran with --no-words): run it with words, or pass --words")
    kept = json.load(open(cc_path, encoding="utf-8"))["kept"]
    out = []
    for ci, k in enumerate(kept):
        a, b = k["voice_in"], k["voice_out"]
        heard = [w for w in raw if w["end"] > a - 0.05 and w["start"] < b + 0.05]
        said = k.get("text", "").split()
        if [norm(w["word"]) for w in heard] != [norm(t) for t in said]:
            say(f"  line {ci + 1}: Whisper heard {' '.join(w['word'] for w in heard)!r}; the captions use the cut list's {k.get('text', '')!r}")
        last = a
        for word, s, e in align(heard, said, a, b):
            s = min(max(s, last), b)               # inside his voice, in order
            e = min(max(e, s), b)
            last = s
            out.append({"word": word, "start": round(k["cut_start"] + s - k["in"], 4), "end": round(k["cut_start"] + e - k["in"], 4), "clip": ci})
    return out, kept


def clips_for(words, work, dur, say):
    """With --words: the kept lines of work/cut.cuts.json, when it describes this video, so captions break at its joins."""
    p = os.path.join(work, "cut.cuts.json")
    if not os.path.exists(p):
        return []
    cc = json.load(open(p, encoding="utf-8"))
    if abs(cc.get("duration", -1) - dur) > 0.05:
        say(f"  {p} is {cc.get('duration')} s and the video {dur:.2f} s: its joins are not used")
        return []
    kept = cc["kept"]
    for w in words:
        mid = (w["start"] + w["end"]) / 2
        w["clip"] = next((ci for ci, k in enumerate(kept) if k["cut_start"] - 0.02 <= mid < k["cut_end"] + 0.02), None)
    return kept


# ------------------------------------------------------------------ text
def sentence_case(words):
    """Capitals where sentences start. A line that carries on a sentence keeps the capital Whisper gives every line's first
    word only for a name: I, an acronym, a mixed-case word, or a word he capitalises mid-line elsewhere."""
    starts = [i == 0 or ends_sentence(words[i - 1]["word"]) for i in range(len(words))]
    line_start = [i == 0 or words[i].get("clip") != words[i - 1].get("clip") for i in range(len(words))]
    names = {norm(w["word"]) for i, w in enumerate(words) if not starts[i] and not line_start[i] and w["word"][:1].isupper()}
    for i, w in enumerate(words):
        t = w["word"]
        lead = len(t) - len(t.lstrip("\"'\u201c\u2018("))
        head, body = t[:lead], t[lead:]
        if not body:
            continue
        if starts[i]:
            if body == body.lower():
                w["word"] = head + body[0].upper() + body[1:]
        elif line_start[i] and body[0].isupper() and not any(c.isupper() for c in body[1:]) \
                and not re.match(r"I(?:$|['\u2019])", body) and norm(body) not in names:
            w["word"] = head + body[0].lower() + body[1:]


def quote_caps(tok):
    bare = tok.strip("\"\u201c\u201d")
    word = bare.rstrip(".,!?:;")
    return "\u201c" + word.upper() + "\u201d" + bare[len(word):]


def is_keyword_token(tok):
    """The comment keyword as captions write it: CAPS in curly quotes."""
    letters = [c for c in tok if c.isalpha()]
    return tok.startswith("\u201c") and len(letters) >= 2 and all(c.isupper() for c in letters)


def mark_keyword(toks, keywords, say):
    """Quote and capitalise each keyword where he asks for it: within three words after "comment". When he never says it
    there, its last mention is the ask."""
    for kw in keywords:
        hits = [i for i, t in enumerate(toks) if norm(t) == norm(kw)]
        if not hits:
            say(f"  note: the keyword {kw!r} is never said, so no caption shows it")
            continue
        asked = [i for i in hits if any(norm(toks[k]) in ("comment", "comments") for k in range(max(0, i - 3), i))]
        if not asked:
            asked = hits[-1:]
            say(f"  note: {kw!r} never comes right after \"comment\", so its last mention is marked: check it's the ask")
        for i in asked:
            toks[i] = quote_caps(toks[i])


def censor(text, extra):
    def keep_case(rep):                            # FOMO -> F*MO, Suicide -> S*****e, suicide -> s*****e
        return lambda m: rep.upper() if m.group(0).isupper() and len(m.group(0)) > 1 else \
            (rep[:1].upper() + rep[1:]) if m.group(0)[:1].isupper() else rep
    for pat, rep in CENSOR + [(r"\b" + re.escape(w) + r"\b", keep_case(r)) for w, r in extra]:
        text = re.sub(pat, rep, text, flags=re.IGNORECASE)
    return text


def max_text_w(y):
    """The widest a line of text may run, centred, at centre height y: inside the side inset, and left of the button
    column once it reaches the column's height."""
    return 2 * (RAIL_X - W // 2) if y > RAIL_Y else W - 2 * INSET


# ------------------------------------------------------------------ captions
def best_split(words, seg, face, max_w):
    """Split one sentence (indices into words) into captions of 1-3 words at the lowest cost."""
    n = len(seg)
    font = face(CAPTION_PX)

    def cost(idx, last):
        c = 0.5                                    # a little per caption: fewer changes when it reads the same
        if len(idx) == 1 and n > 1:
            c += 4.5 if last else 6
        if not last:
            end = core(words[idx[-1]]["word"])
            c += 7 if end in CONJ else 5 if end in FUNCTION else 2 if end in LIGHT else 0
        for a, b in zip(idx, idx[1:]):            # a comma, a join or a pause belongs between captions, not inside one
            if soft_break(words[a]["word"]) or words[a].get("clip") != words[b].get("clip"):
                c += 4
            if words[b]["start"] - words[a]["end"] > 0.3:
                c += 3
            if core(words[b]["word"]) in AUX and core(words[a]["word"]) not in SUBJECT:
                c += 1
        if idx[0] != seg[0] and is_keyword_token(words[idx[0]]["word"]):
            c += 10                                # the keyword stays with the words that ask for it: Comment “SCREENSHOTS”
        # Too wide for the safe width at 66 px: shrinking a little (as reelkit does) beats a bad break, a lot rarely does.
        need = (font.getlength(" ".join(words[k]["word"] for k in idx)) + 2 * OUTLINE) / max_w
        c += 0 if need <= 1 else 3 if need <= CAPTION_PX / 58 else 8 if need <= CAPTION_PX / CAPTION_MIN_PX else 20
        return c

    best, nxt = [0.0] * (n + 1), [n] * (n + 1)
    for i in range(n - 1, -1, -1):
        best[i] = float("inf")
        for j in range(min(n, i + 3), i, -1):     # on a tie the longer caption goes first, as he splits them
            c = cost(seg[i:j], j == n) + best[j]
            if c < best[i]:
                best[i], nxt[i] = c, j
    out, i = [], 0
    while i < n:
        out.append(seg[i:nxt[i]])
        i = nxt[i]
    return out


def build_captions(words, kept, dur, face, y, keywords, extra, fps, say):
    sentence_case(words)
    toks = [w["word"] for w in words]
    mark_keyword(toks, keywords, say)
    for w, t in zip(words, toks):
        w["word"] = t
    chunks, seg = [], []
    for i, w in enumerate(words):
        seg.append(i)
        if ends_sentence(w["word"]) or i == len(words) - 1:
            chunks += best_split(words, seg, face, max_text_w(y))
            seg = []
    caps = []
    for idx in chunks:
        first, last = words[idx[0]], words[idx[-1]]
        start = first["start"]
        ci = first.get("clip")
        if kept and ci is not None and (idx[0] == 0 or words[idx[0] - 1].get("clip") != ci) and start - kept[ci]["cut_start"] <= 0.25:
            start = kept[ci]["cut_start"]          # a line's first caption comes up on the frame its shot does
        text = re.sub(r"[\s.,;:\u2026\u2014\u2013-]+$", "", censor(" ".join(words[k]["word"] for k in idx), extra))
        caps.append({"start": max(0.0, start), "end": last["end"] + HOLD, "text": text,
                     "words": [[words[k]["word"], round(words[k]["start"], 3), round(words[k]["end"], 3)] for k in idx]})
    return finish_times(caps, dur, fps)


def finish_times(caps, dur, fps):
    """Each caption on whole frames, up until the next one (or HOLD past its last word), at least a frame long."""
    snap = lambda t: round(round(t * fps) / fps, 4)
    caps = sorted(caps, key=lambda c: c["start"])
    for a, b in zip(caps, caps[1:]):
        if b["start"] - a["end"] < FLICKER:
            a["end"] = b["start"]
    out, prev_end = [], 0.0
    for c in caps:
        c["start"], c["end"] = snap(max(c["start"], prev_end)), snap(min(c["end"], dur))
        if c["end"] - c["start"] < 1 / fps - 1e-6:
            c["end"] = snap(c["start"] + 1 / fps)
        if c["start"] >= dur - 1e-6:
            break
        out.append(c)
        prev_end = c["end"]
    return out


def read_captions(path, keywords, extra, dur, fps, say):
    data = json.load(open(path, encoding="utf-8"))
    rows = data["captions"] if isinstance(data, dict) else data
    caps = []
    for r in rows:
        if isinstance(r, dict):
            caps.append({k: r[k] for k in ("start", "end", "text", "y", "words") if k in r})
        else:                                      # reelkit's build/captions.json: [start, end, text]
            caps.append({"start": r[0], "end": r[1], "text": r[2]})
    toks = [t for c in caps for t in c["text"].split(" ")]
    mark_keyword(toks, keywords, say)
    k = 0
    for c in caps:
        n = len(c["text"].split(" "))
        c["text"] = censor(" ".join(toks[k:k + n]), extra)
        k += n
    return finish_times(caps, dur, fps)


def draw_caption(canvas, text, y, face, scale):
    """reelkit's caption: white with a black outline over a soft shadow, centred on (540, y); a caption too wide for the
    safe width shrinks. The keyword token is drawn yellow, word by word from the line's left edge."""
    size = CAPTION_PX
    while size > CAPTION_MIN_PX and face(size).getlength(text) + 2 * OUTLINE > max_text_w(y):
        size -= 2
    font = face(size * scale)
    at = (W // 2 * scale, y * scale)
    l, t, r, b = font.getbbox(text, anchor="mm")
    m = 3 * SHADOW_BLUR * scale
    box = (max(0, int(at[0] + l - m)), max(0, int(at[1] + t - m)), min(canvas.width, int(at[0] + r + m)), min(canvas.height, int(at[1] + b + m)))
    layer = Image.new("RGBA", (box[2] - box[0], box[3] - box[1]), (0, 0, 0, 0))
    ImageDraw.Draw(layer).text((at[0] - box[0], at[1] - box[1]), text, font=font, anchor="mm", fill=(0, 0, 0, SHADOW_ALPHA))
    canvas.alpha_composite(layer.filter(ImageFilter.GaussianBlur(SHADOW_BLUR * scale)), (box[0], box[1]))
    d = ImageDraw.Draw(canvas)
    stroke = dict(stroke_width=OUTLINE * scale, stroke_fill=(0, 0, 0, 255))
    toks = text.split(" ")
    if not any(is_keyword_token(tok) for tok in toks):
        d.text(at, text, font=font, anchor="mm", fill="white", **stroke)
        return
    x = at[0] - d.textlength(text, font=font) / 2
    for i, tok in enumerate(toks):
        if tok:
            d.text((x, at[1]), tok, font=font, anchor="lm", fill=KEYWORD_FILL if is_keyword_token(tok) else "white", **stroke)
        x += d.textlength(tok + (" " if i < len(toks) - 1 else ""), font=font)


# ------------------------------------------------------------------ hook
def hook_text(text, keywords, extra):
    text = censor(text, extra)
    for kw in keywords:
        text = re.sub(r"[\"\u201c\u201d]?\b" + re.escape(kw) + r"\b[\"\u201c\u201d]?", "\u201c" + kw.upper() + "\u201d", text, flags=re.IGNORECASE)
    return [ln.strip() for ln in re.split(r"\s*(?:\||\\n|\n)\s*", text.strip()) if ln.strip()]


def wrap_hook(text, face, max_w, max_lines):
    """reelkit's wrap: the largest size that fits max_lines lines, then the narrowest width that keeps that many lines,
    so the lines balance and no word is left alone."""
    words = text.split()

    def greedy(f, width):
        lines, cur = [], ""
        for w in words:
            t = (cur + " " + w).strip()
            if not cur or f.getlength(t) + 2 * HOOK_PAD <= width:
                cur = t
            else:
                lines.append(cur)
                cur = w
        return lines + [cur]

    for size in HOOK_SIZES:
        f = face(size)
        lines = greedy(f, max_w)
        if len(lines) <= max_lines and all(f.getlength(ln) + 2 * HOOK_PAD <= max_w for ln in lines):
            width = max_w
            while width > 200 and len(greedy(f, width - 10)) == len(lines):
                width -= 10
            return greedy(f, width), size
    return None, None


def fit_hook(lines, face, max_w, say):
    """(lines, size) for the hook: wrapped to two lines, or the lines given by hand at the largest size that fits."""
    if len(lines) == 1:
        got, size = wrap_hook(lines[0], face, max_w, 2)
        if got:
            return got, size
        got, size = wrap_hook(lines[0], face, max_w, 3)
        if got:
            say(f"  note: the hook needs three lines even at {HOOK_SIZES[-1]} px; a shorter one fits in two")
            return got, size
        sys.exit("captions.py: the hook doesn't fit in three lines: shorten it")
    if len(lines) > 3:
        sys.exit("captions.py: a hook has two lines at most (three when a CAPS word gets its own)")
    if len(lines) == 3:
        caps_alone = any(len(ln.split()) == 1 and sum(c.isalpha() for c in ln) >= 2 and ln == ln.upper() for ln in lines)
        if not caps_alone and wrap_hook(" ".join(lines), face, max_w, 2)[0]:
            say("  note: three hook lines with no CAPS word on a line of its own; SKILL.md keeps a hook to two")
    size = 72
    while size > 48 and any(face(size).getlength(ln) + 2 * HOOK_PAD > max_w for ln in lines):
        size -= 2
    return lines, size


def make_hook(lines, size, face, scale=1):
    """reelkit's make_hook: TikTok's native text-with-background. Each line in its own white box sized to that line, the
    boxes stacked edge to edge; where a narrower line meets a wider one, the wider box's corner rounds out and the narrower
    box flows into it with an inside curve. The outline is drawn 4x for clean curves. Laid out on the 1080 grid, drawn
    `scale` times larger, and cropped to the white."""
    font = face(size)
    lh = round(size * 1.3)
    r = round(lh * 0.24)
    boxes, y = [], 20
    for ln in lines:
        tw = font.getlength(ln)
        boxes.append(((W - tw) // 2 - HOOK_PAD, y, (W + tw) // 2 + HOOK_PAD, y + lh))
        y += lh
    S = 4
    mask = Image.new("L", (W * S, (y + 20) * S), 0)
    md = ImageDraw.Draw(mask)

    def convex(cx, cy, dx, dy, rc):           # round the outer corner at (cx, cy); (dx, dy) points into the shape
        if rc < 1:
            return
        x0, x1 = sorted((cx, cx + dx * rc))
        y0, y1 = sorted((cy, cy + dy * rc))
        md.rectangle((x0 * S, y0 * S, x1 * S, y1 * S), fill=0)
        ox, oy = cx + dx * rc, cy + dy * rc
        md.ellipse(((ox - rc) * S, (oy - rc) * S, (ox + rc) * S, (oy + rc) * S), fill=255)

    def concave(ex, jy, dx, dy, rc):          # inside curve where a box side (x = ex) meets the edge y = jy
        if rc < 1:                             # (dx, dy): from the corner towards the empty space
            return
        x0, x1 = sorted((ex, ex + dx * rc))
        y0, y1 = sorted((jy, jy + dy * rc))
        md.rectangle((x0 * S, y0 * S, x1 * S, y1 * S), fill=255)
        ox, oy = ex + dx * rc, jy + dy * rc
        md.ellipse(((ox - rc) * S, (oy - rc) * S, (ox + rc) * S, (oy + rc) * S), fill=0)

    for bx in boxes:
        md.rectangle(tuple(v * S for v in bx), fill=255)
    first, last = boxes[0], boxes[-1]
    convex(first[0], first[1], 1, 1, r)
    convex(first[2], first[1], -1, 1, r)
    convex(last[0], last[3], 1, -1, r)
    convex(last[2], last[3], -1, -1, r)
    joins = []
    for a, b in zip(boxes, boxes[1:]):
        step = abs(a[0] - b[0])               # lines are centred, so both sides step by the same amount
        if step < 2:
            continue
        rj = min(r, step / 2)
        jy = b[1]
        wide, narrow_top = (b, True) if a[0] > b[0] else (a, False)
        dy = 1 if narrow_top else -1          # into the wider box, away from the join
        convex(wide[0], jy, 1, dy, rj)
        convex(wide[2], jy, -1, dy, rj)
        joins.append((a, b, rj, narrow_top))
    for a, b, rj, narrow_top in joins:
        narrow = a if narrow_top else b
        jy = b[1]
        dy = -1 if narrow_top else 1          # the inside curve sits on the narrower line's side of the join
        concave(narrow[0], jy, -1, dy, rj)
        concave(narrow[2], jy, 1, dy, rj)
    mask = mask.resize((W * scale, (y + 20) * scale), LANCZOS)
    img = Image.new("RGBA", mask.size, (255, 255, 255, 0))
    img.putalpha(mask)
    d = ImageDraw.Draw(img)
    big = face(size * scale)
    for ln, bx in zip(lines, boxes):
        tw = d.textlength(ln, font=big)
        d.text(((W * scale - tw) // 2, (bx[1] + bx[3]) // 2 * scale), ln, font=big, anchor="lm", fill="black")
    return img.crop(mask.getbbox())


def sentence_end_times(caps):
    """When each caption that ends a sentence goes down: from its last word's punctuation, else its own text's."""
    out = []
    for c in caps:
        last = c["words"][-1][0] if c.get("words") else c["text"]
        if ends_sentence(last) or c["text"].rstrip(CLOSERS).endswith(("?", "!")):
            out.append(c["end"])
    return out


# ------------------------------------------------------------------ video
def probe(path):
    info = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries",
                                               "stream=codec_type,codec_name,width,height,r_frame_rate,color_transfer,duration:"
                                               "stream_side_data=rotation:format=duration", "-of", "json", path]))
    v = next((s for s in info["streams"] if s["codec_type"] == "video"), None)
    if v is None:
        sys.exit(f"captions.py: {path} has no video")
    a = next((s for s in info["streams"] if s["codec_type"] == "audio"), None)
    w, h = v["width"], v["height"]
    if any(abs(int(float(sd.get("rotation", 0)))) % 180 == 90 for sd in v.get("side_data_list", [])):
        w, h = h, w                                # a phone take stored sideways, played upright
    num, den = (int(x) for x in v.get("r_frame_rate", "30/1").split("/"))
    fps = num / den if den and 1 <= num / den <= 240 else 30.0
    return {"w": w, "h": h, "fps": fps, "rate": v["r_frame_rate"] if fps == (num / den if den else 0) else "30",
            "dur": float(v.get("duration") or info["format"]["duration"]),
            "hdr": v.get("color_transfer") in ("arib-std-b67", "smpte2084"), "audio": a["codec_name"] if a else None}


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("video")
    ap.add_argument("out")
    ap.add_argument("--work", default="work")
    src = ap.add_mutually_exclusive_group()
    src.add_argument("--words", help="word times on the cut's clock: a flat list or reelkit's cut_tx.json")
    src.add_argument("--captions", help="finished captions to draw as they are (work/captions.json, edited)")
    ap.add_argument("--keyword", action="append", default=[], help="the comment keyword: caps, curly quotes, yellow")
    ap.add_argument("--censor", action="append", default=[], metavar="WORD=REPLACEMENT")
    ap.add_argument("--hook", help='the hook title; "|" breaks a line by hand')
    ap.add_argument("--hook-until", type=float, help="when the hook goes (s); default the end of his first sentence")
    ap.add_argument("--hook-y", type=float, help="centre the hook on this y (a split screen's seam); default its top at y 240")
    ap.add_argument("--y", type=float, default=CAPTION_Y, help=f"the captions' centre y (default {CAPTION_Y})")
    ap.add_argument("--size", default="1080x1920", choices=["1080x1920", "2160x3840"])
    ap.add_argument("--font", help="a bold font file to use instead of Helvetica Neue")
    ap.add_argument("--preview", action="store_true", help="write the captions and overlay stills, skip the encode")
    a = ap.parse_args()

    say = print
    extra = []
    for c in a.censor:
        if "=" not in c:
            sys.exit(f"captions.py: --censor takes word=replacement, not {c!r}")
        extra.append(tuple(c.split("=", 1)))
    face, font_note = find_font(a.font)
    if font_note:
        say(font_note)
    say(f"font: {face.label} ({face.path}, face {face.index})")
    v = probe(a.video)
    if v["hdr"]:
        sys.exit(f"captions.py: {a.video} is HDR: convert it to SDR first (SKILL.md, step 1)")
    if abs(v["w"] / v["h"] - W / H) > 0.01:
        sys.exit(f"captions.py: {a.video} is {v['w']}x{v['h']}, not 9:16: it would have to be stretched or cropped")
    scale = int(a.size.split("x")[0]) // W
    fps, dur = v["fps"], v["dur"]
    if not TOP + 45 <= a.y <= BOTTOM - 45:
        say(f"  note: captions at y {a.y:.0f} run outside the safe area ({TOP}-{BOTTOM})")

    if a.captions:
        caps = read_captions(a.captions, a.keyword, extra, dur, fps, say)
    else:
        if a.words:
            words = read_words(a.words)
            kept = clips_for(words, a.work, dur, say)
        else:
            words, kept = words_from_take(a.work, say)
        if not words:
            sys.exit("captions.py: no words to caption")
        caps = build_captions(words, kept, dur, face, a.y, a.keyword, extra, fps, say)

    hook = None
    if a.hook:
        lines = hook_text(a.hook, a.keyword, extra)
        lines, size = fit_hook(lines, face, W - 2 * INSET, say)
        img = make_hook(lines, size, face)
        top = HEADLINE_TOP if a.hook_y is None else round(a.hook_y - img.height / 2)
        if top + img.height > RAIL_Y:              # low enough to reach the button column: keep left of it
            lines, size = fit_hook(hook_text(a.hook, a.keyword, extra), face, 2 * (RAIL_X - W // 2), say)
            img = make_hook(lines, size, face)
            top = HEADLINE_TOP if a.hook_y is None else round(a.hook_y - img.height / 2)
        if top < TOP or top + img.height > BOTTOM:
            sys.exit(f"captions.py: the hook would run from y {top} to {top + img.height}, outside the safe area ({TOP}-{BOTTOM})")
        until = a.hook_until
        if until is None:
            ends = sentence_end_times(caps)
            until = next((t for t in ends if t >= HOOK_MIN_UP - 1e-6), ends[-1] if ends else min(dur, 4.0))
        until = round(round(min(until, dur) * fps) / fps, 4)
        hook = {"text": a.hook, "lines": lines, "size_px": size, "top": top, "bottom": top + img.height, "until": until,
                "img": img if scale == 1 else make_hook(lines, size, face, scale)}

    cap_y = lambda c: c.get("y", a.y)
    covers = lambda c: hook and hook["top"] - 45 < cap_y(c) < hook["bottom"] + 45   # a caption on the hook's spot waits
    os.makedirs(a.work, exist_ok=True)
    out_caps = [{k: c[k] for k in ("start", "end", "text", "y", "words") if k in c} for c in caps]
    json.dump({"video": a.video, "size": a.size, "y": a.y, "keyword": a.keyword,
               "hook": {k: v_ for k, v_ in hook.items() if k != "img"} if hook else None, "captions": out_caps},
              open(os.path.join(a.work, "captions.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)

    if hook:
        say(f"hook 0.00-{hook['until']:.2f} s, {len(hook['lines'])} line(s) at {hook['size_px']} px, y {hook['top']}-{hook['bottom']}: "
            + " / ".join(hook["lines"]))
    say(f"{len(caps)} captions at y {a.y:.0f}:")
    for c in caps:
        flag = "  (waits for the hook)" if covers(c) and c["start"] < hook["until"] else ""
        say(f"  {c['start']:6.2f}-{c['end']:6.2f}  {c['text']}" + (f"   y {c['y']:.0f}" if "y" in c else "") + flag)

    # One full-frame still per state (which caption, whether the hook is up), shown by the concat demuxer for as long as
    # that state lasts, at the video's frame rate so every change lands on the frame it belongs to.
    build = os.path.join(a.work, "captions")
    os.makedirs(build, exist_ok=True)
    for f in os.listdir(build):
        if f.startswith("ov_") and f.endswith(".png"):
            os.remove(os.path.join(build, f))
    snap = lambda t: round(round(t * fps) / fps, 4)
    bounds = {0.0, snap(dur)} | {c["start"] for c in caps} | {c["end"] for c in caps} | ({hook["until"]} if hook else set())
    bounds = sorted(b for b in bounds if 0 <= b <= snap(dur))
    lines, cache, key = ["ffconcat version 1.0"], {}, None
    quote = lambda path: path.replace("'", "'\\''")            # a ' in a folder name, the way ffconcat escapes it
    for t0, t1 in zip(bounds, bounds[1:]):
        if t1 - t0 < 1e-4:
            continue
        mid = (t0 + t1) / 2
        hook_up = bool(hook) and mid < hook["until"]
        cap = next((c for c in caps if c["start"] <= mid < c["end"]), None)
        if cap and hook_up and covers(cap):
            cap = None
        key = (hook_up, cap["text"] if cap else None, cap_y(cap) if cap else None)
        if key not in cache:
            canvas = Image.new("RGBA", (W * scale, H * scale), (0, 0, 0, 0))
            if hook_up:
                canvas.alpha_composite(hook["img"], ((W * scale - hook["img"].width) // 2, hook["top"] * scale))
            if cap:
                draw_caption(canvas, cap["text"], cap_y(cap), face, scale)
            p = os.path.abspath(os.path.join(build, f"ov_{len(cache):04d}.png"))
            canvas.save(p, compress_level=1)
            cache[key] = p
        lines.append(f"file '{quote(cache[key])}'\noption framerate {v['rate']}\nduration {t1 - t0:.6f}")
    lines.append(f"file '{quote(cache[key])}'\noption framerate {v['rate']}")
    listing = os.path.join(build, "overlay.txt")
    open(listing, "w").write("\n".join(lines) + "\n")
    say(f"wrote {os.path.join(a.work, 'captions.json')} and {len(cache)} overlay stills in {build}")
    if a.preview:
        return

    ow, oh = W * scale, H * scale
    up = f"scale={ow}:{oh}:flags=lanczos," if (v["w"], v["h"]) != (ow, oh) else ""
    graph = (f"[0:v]{up}format=yuv420p[base];"
             f"[1:v]format=rgba,scale=out_color_matrix=bt709:out_range=tv,format=yuva420p[ov];"
             f"[base][ov]overlay=0:0:format=yuv420:eof_action=repeat,format=yuv420p[v]")
    if v["audio"] == "aac":
        audio = ["-c:a", "copy"]
    elif v["audio"]:
        encoders = subprocess.run(["ffmpeg", "-hide_banner", "-encoders"], capture_output=True, text=True).stdout
        audio = ["-c:a", "aac_at" if re.search(r"\baac_at\b", encoders) else "aac", "-b:a", "256k"]
    else:
        audio = []
    say(f"encoding {ow}x{oh} ...")
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", a.video, "-f", "concat", "-safe", "0", "-i", listing,
                    "-filter_complex", graph, "-map", "[v]", "-map", "0:a:0?", "-t", f"{dur:.4f}",
                    "-c:v", "libx264", "-preset", "slow", "-crf", "16" if scale > 1 else "20", "-pix_fmt", "yuv420p",
                    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
                    *audio, "-movflags", "+faststart", a.out], check=True)
    say(f"wrote {a.out}")


if __name__ == "__main__":
    main()
