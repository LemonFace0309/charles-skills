"""Build a video's plan page from its edit/plan.json and SCRIPT.md: the player (a moving mockup of the reel playing with
its music, a play bar, and the Safe area and Instagram UI toggles), then the script as he reads it, the caption options,
every asset with its source and the references. Nothing else goes around the player.

  python3 -I <skill>/kit/build.py <video folder>           # build/plan.html, <assets_dir>/SOURCES.md, build/music/
  python3 -I <skill>/kit/build.py <video folder> --site    # also build/site/, the shareable copy, to publish as an Artifact

references/plan.md describes plan.json. Times are estimates until edit/cuts.json exists ([{"s": start, "e": end}] per line,
in seconds on the cut); then each line takes its length from the cut.

build/plan.html opens straight from disk. build/site/index.html has no head (the Artifact host wraps the page in its own)
and carries its CSS, script and data inline; its media (the reel's assets and the music) sit under build/site/media/,
listed in build/site/files.json. Publish it with the Artifact tool: file_path build/site/index.html, root build/site,
files = files.json. Publishing the same file path again keeps the link. The build also prints the checks against
charles-claude-editing's rules, with every number taken from <skill>/reel-spec.json (that skill's frame, copied here).
"""
import base64
import copy
import hashlib
import html
import json
import math
import os
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageFont

KIT = Path(__file__).resolve().parent
KIT_AS_RUN = Path(os.path.abspath(__file__)).parent  # through the project's skills/ link, if it ran that way
HN = "/System/Library/Fonts/HelveticaNeue.ttc"
IMG = {".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif"}
VID = {".mp4", ".webm", ".mov", ".m4v"}
ACRONYMS = {"ios": 3, "ai": 2, "nft": 3, "nfts": 4, "ui": 2, "ux": 2, "css": 3, "api": 3, "url": 3, "gpu": 3, "ceo": 3, "mrr": 3}
HOLD = 1.2                 # page.js holds the last frame this long before it loops
LIMITS = (255, 60e6)       # what one Artifact publish takes: files, bytes
# The frame every editing skill lays a reel out on: charles-claude-editing owns reel-spec.json and this skill carries an
# identical copy, so the checks and the page follow the edit's numbers wherever the skill is installed.
SPEC_FILE = KIT.parent / "reel-spec.json"
try:
    SPEC = json.loads(SPEC_FILE.read_text())
except (OSError, ValueError) as e:
    sys.exit(f"Can't read {SPEC_FILE} ({e}). It's a copy of charles-claude-editing's reel-spec.json: put it back.")
W = SPEC["frame"]["width"]
SAFE_TOP, SAFE_BOTTOM = SPEC["platform"]["top"], SPEC["platform"]["bottom"]          # the header, the username and caption
RAIL_X, RAIL_Y = SPEC["platform"]["buttons"]["left"], SPEC["platform"]["buttons"]["top"]   # the like, comment, share column
SIDE = SPEC["text_inset"]["px"]
PACE, AUDIO = SPEC["pacing"], SPEC["audio"]
LIST_SLACK = 12            # list_reel.py lets a list's columns reach 12 px into the side inset
# What each layout does to everything behind its asset (his footage and the reel's own title, list, stopwatch and hook):
# "blur" is charles-claude-editing's overlay with blur. A visual can set its own "backdrop". page.js keeps the same
# table and draws each kind; when the editing skill's layouts change, change both tables, never a single beat.
BACKDROP_BY_PLACE = {"spotlight": "blur"}


def backdrop_of(v):
    return "none" if not v else (v.get("backdrop") or BACKDROP_BY_PLACE.get(v["place"], "none"))


# His face on the 1080x1920 grid, from his eye line (`eye_line`): brows about 70 px above it, chin about 300 under it
# and about 400 px wide around `face_x` (the medians of the face boxes on 34 of his cuts, videos/*/edit/work/face.json).
# His lower lip sits about 0.74 of the way from eyes to chin (face.swift on four of his takes), 190-220 px at his usual
# sizes; LIP takes the low end, so captions placed right under his mouth on a smaller face aren't flagged.
BROW, LIP, CHIN, FACE_W = 70, 190, 300, 400
CAPTION_HOME = SPEC["captions"]["talking_head_centre_y"]   # where captions sit unless an asset sits there
CAPTION_SIZE = SPEC["captions"]["size_px"]


def text_room(y):
    """How wide centred text may run at height y: inside the side insets, and clear of the button column below its top."""
    return 2 * (RAIL_X - W / 2) if y > RAIL_Y else W - 2 * SIDE


def clear_of_face(eye, half):
    """Where a caption card `half` px tall each side of its y clears his face: 1380 when that's under his chin, else just
    under his chin, else above his brows."""
    for y in (CAPTION_HOME, round(eye + CHIN + half + 10)):
        if y - half >= eye + CHIN and y + half <= SAFE_BOTTOM:
            return y
    return round(eye - BROW - half - 10)


MOODS ={"chill", "emotional storytelling", "funny", "motivational", "suspenseful", "upbeat", "wholesome"}
# Words TikTok holds a video back for; write them like s*****e in captions and the hook (charles-claude-editing, Captions).
BLOCKED = ("suicide", "self-harm", "self harm", "kill yourself", "porn", "nude", "rape", "cocaine", "heroin", "nazi", "terrorist")
MEME_SOUNDS = ("vine boom", "dun", "bruh", "airhorn", "air horn", "emotional damage", "oh no", "sad violin")



def syllables(text):
    n = 0
    for w in re.findall(r"[A-Za-z']+|\d+", text):
        lw = w.lower().strip("'")
        if w.isdigit():
            n += 5 if len(w) == 4 else len(w)          # a year said as "twenty twenty-six"; other digits about one each
        elif lw in ACRONYMS:
            n += ACRONYMS[lw]
        else:
            k = len(re.findall(r"[aeiouy]+", lw))
            if lw.endswith("e") and not lw.endswith(("le", "ee")) and k > 1:
                k -= 1
            n += max(1, k)
    return n


def estimate(say, pace):
    """Seconds a line takes before there's a cut.
    list: 0.17 s a syllable plus 0.45 s, which reproduces 22 Backgrounds (22 labels of about 4 syllables in 24.9 s).
    end:  a list reel's sign-off, a little slower and held.
    talk: 3.3 words a second, his pace in a finished cut (charles-scripting-voice), numbers counted as said aloud."""
    if pace == "list":                  # at least 0.9 s, so a one-word item's card can still be read ("Tint" got 0.62 s)
        return max(0.9, 0.17 * syllables(say) + 0.45)
    if pace == "end":
        return 0.17 * syllables(say) + 0.9
    words = len(re.findall(r"[A-Za-z']+", say)) + sum(min(3, len(d)) for d in re.findall(r"\d+", say))
    return max(0.8, words / 3.3)


WEAK = {"a", "an", "the", "of", "to", "on", "in", "and", "or", "for", "at", "by", "with", "is", "it", "your", "my", "his",
        "her", "their", "our", "that", "this", "but", "so", "as", "from", "if"}


def chunk(text):
    """Caption lines of 2-3 words, as charles-claude-editing sets them: broken at the sentence's own pauses first, never
    ending on a small word ("the", "on") when the next line can take it, and without commas or full stops at the end."""
    lines = []
    for phrase in re.split(r"(?<=[,.;:?!])\s+", text.strip()):
        words = phrase.split()
        while words:
            take = len(words) if len(words) <= 3 else 2 if len(words) == 4 else 3
            if 1 < take < len(words) and words[take - 1].lower().strip(",.;:") in WEAK:
                take -= 1
            lines.append(" ".join(words[:take]))
            words = words[take:]
    out = []
    for line in lines:                  # a lone word joins its neighbour when that stays at 3 words or fewer
        if out and len(line.split()) == 1 and len(out[-1].split()) < 3 and not out[-1].endswith(("?", "!", ".")):
            out[-1] += " " + line
        else:
            out.append(line)
    if len(out) > 1 and len(out[0].split()) == 1 and len(out[1].split()) < 3:
        out[:2] = [out[0] + " " + out[1]]
    return [re.sub(r"[,.;:]+$", "", line) for line in out]


def cards_for(beat, default_on, start, dur):
    """The caption cards a line shows, timed across it by syllables: [{"lines": [...], "start", "end"}]."""
    cap = beat.get("caption")
    if cap is False or (cap is None and not beat.get("captions", default_on)):
        return [], False
    if isinstance(cap, list):
        cards, explicit = [c if isinstance(c, list) else [c] for c in cap], True
    else:
        cards, explicit = [[line] for line in chunk(cap if isinstance(cap, str) else beat["say"])], isinstance(cap, str)
    weights = [max(1, syllables(" ".join(c))) for c in cards]
    out, t = [], start
    for c, w in zip(cards, weights):
        d = dur * w / sum(weights)
        out.append({"lines": c, "start": round(t, 3), "end": round(t + d, 3)})
        t += d
    return out, explicit


def measurer(size):
    try:
        return ImageFont.truetype(HN, size, index=1).getlength      # Helvetica Neue Bold, as the list renderer measures
    except OSError:
        return lambda s: 0.56 * size * len(s)                       # no Helvetica Neue here: a rough width


def list_block(plan, beats):
    L = {"row0": 372, "pitch": 35, "size": 30, "number_width": 49, "col_gap": 40, "stopwatch": [60, 800], **plan["list"]}
    rows = [{"number": b["number"], "label": b["label"]} for b in beats if b.get("row") is not None]
    per_col = L.get("per_col") or math.ceil(len(rows) / 2)
    width = measurer(L["size"])
    widths = [L["number_width"] + width(r["label"]) for r in rows]
    colw = [max(widths[:per_col]), max(widths[per_col:] or [0])]
    x0 = (1080 - colw[0] - colw[1] - L["col_gap"]) / 2
    x1 = x0 + colw[0] + L["col_gap"] + colw[1]
    lo, hi = SIDE - LIST_SLACK, W - SIDE + LIST_SLACK
    # rows that reach below the button column's top have to stay left of it too
    hi = min(hi, RAIL_X) if L["row0"] + (per_col - 1) * L["pitch"] + L["size"] / 2 > RAIL_Y else hi
    if x0 < lo or x1 > hi:
        widest = max(rows, key=lambda r: width(r["label"]))["label"]
        sys.exit(f"The list is too wide ({x0:.0f} to {x1:.0f} px; it has to stay inside {lo:.0f} to {hi:.0f}, from "
                 f"reel-spec.json's text inset and button column). Shorten the widest labels (\"{widest}\" is "
                 f"{width(widest):.0f} px) or narrow number_width / col_gap.")
    stop_at = max(b["start"] + b["dur"] for b in beats if b.get("row") is not None)
    # A list that leads into a tutorial can count DOWN instead ("countdown": {"until": <beat index>, "label": "Video
    # tutorial in", "hide": true}): the timer reaches 00.00 as that line starts, with its label over the plate, and with
    # "hide" the title, list and timer leave the screen there.
    cd = L.get("countdown")
    countdown = None
    if cd:
        countdown = {"label": cd.get("label", ""), "to": round(beats[cd["until"]]["start"], 3), "label_size": cd.get("label_size", 30)}
    return {"rows": rows, "per_col": per_col, "colx": [round(x0, 1), round(x0 + colw[0] + L["col_gap"], 1)],
            "numw": L["number_width"], "row0": L["row0"], "pitch": L["pitch"], "size": L["size"],
            "stopwatch": L.get("stopwatch"), "stop_at": round(stop_at, 3), "edges": [round(x0, 1), round(x1, 1)],
            "countdown": countdown, "hide_from": countdown["to"] if countdown and cd.get("hide") else None}


def first_sentence_end(beats):
    """When his first sentence ends: the hook stays up that long, kept to 3-5 s (charles-claude-editing, Hook Title)."""
    end = next((b["start"] + b["dur"] for b in beats if re.search(r"[.?!][\"')”’]*\s*$", b["say"])), beats[0]["start"] + beats[0]["dur"])
    return round(min(5.0, max(3.0, end)), 2)


def hook_block(plan, beats, until_default, length_for_sub):
    hk = plan.get("hook") or {}
    style = hk.get("style", "title" if plan.get("list") else "tiktok")
    lines = hk.get("lines") or ([plan["title"]] if style == "title" else [])
    sub = hk.get("sub")
    if sub and "{under}" in sub:        # "(20 years in under {under} seconds)": the next 5 s up from where the list ends
        sub = sub.replace("{under}", str(5 * math.ceil(length_for_sub / 5 - 1e-9)))
    if style == "title":
        # 56 and 40 rather than 22 Backgrounds' 45 and 36, which read small on a phone
        return {"style": "title", "lines": lines, "sub": sub, "y": hk.get("y", 256), "size": hk.get("size", 56),
                "sub_size": hk.get("sub_size", 40), "sub_gap": hk.get("sub_gap", 2), "until": None}
    return {"style": "tiktok", "lines": lines, "y": hk.get("y", 240), "size": hk.get("size", 72), "pad": hk.get("pad", 30),
            "until": hk.get("until", until_default)}


def box(v, caption_y, eye, under_chin):
    """The box page.js draws a visual in, on the 1080x1920 grid (x, y, w, h)."""
    def zone(z0, z1):
        hh = min(430, z1 - z0 - 60)
        return (150, round((z0 + z1) / 2 - hh / 2), 780, hh)
    place = v["place"]
    if place == "screen":
        return (0, 0, 1080, 1920)
    if place == "split":
        seam = v.get("seam", 936)
        return (0, seam, 1080, 1920 - seam) if v.get("side") == "bottom" else (0, 0, 1080, seam)
    if place == "spotlight":
        return (120, SAFE_TOP + 30, 840, caption_y - 90 - SAFE_TOP - 30)
    if place == "above":
        return zone(SAFE_TOP, eye)
    if place == "below":
        return zone(eye + 150, caption_y - 40)
    if place == "bottom":
        return zone(caption_y + 45, SAFE_BOTTOM)
    if place == "under-chin":
        return tuple(under_chin)
    if place == "rect":
        return tuple(v["rect"])
    sys.exit(f"unknown place \"{place}\" (above, below, bottom, spotlight, split, screen, under-chin, rect)")


def checks(plan, vd, beats, hook, lst, music, under_chin):
    """The rules from charles-claude-editing that a plan can break, measured. Each failure is one sentence for the page."""
    out = []
    cap_y, cap_size, eye = plan.get("caption_y", CAPTION_HOME), plan.get("caption_size", CAPTION_SIZE), plan.get("eye_line", 860)
    cap_w = measurer(cap_size)
    most = SPEC["captions"]["words_per_line"][1]
    total = beats[-1]["start"] + beats[-1]["dur"]
    for n, b in enumerate(beats, 1):
        lines = [line for c in b["cards"] for line in c["lines"]]
        bv = b["visual"]
        line_y = bv.get("seam", 936) if bv and bv["place"] == "split" else (b.get("caption_y") or cap_y)   # a split's sit on the seam
        for line in lines:
            words = len(line.split())
            if words > most:
                out.append(f"Line {n}: the caption \"{line}\" has {words} words; captions take "
                           f"{'-'.join(map(str, SPEC['captions']['words_per_line']))} a line.")
            elif words == 1 and len(lines) > 1 and b["caption_explicit"]:
                out.append(f"Line {n}: \"{line}\" is a one-word caption line; join it to the line next to it.")
            if cap_w(line) > text_room(line_y):
                why = f"left of the buttons from x {RAIL_X}" if line_y > RAIL_Y else f"inside the {SIDE} px side insets"
                out.append(f"Line {n}: the caption \"{line}\" is {cap_w(line):.0f} px wide; at y {line_y} captions get "
                           f"{text_room(line_y):.0f} px, {why}. Shorten it or break it into two cards.")
        said = " ".join(lines + [b["label"] or ""]).lower()
        for word in BLOCKED:
            if re.search(rf"\b{re.escape(word)}\b", said):
                out.append(f"Line {n}: censor \"{word}\" on screen (TikTok holds videos back for it), as {word[0]}{'*' * (len(word) - 2)}{word[-1]}.")
        v = b["visual"]
        cy = b.get("caption_y") or cap_y
        fl = 540 + plan.get("face_x", 0) - FACE_W / 2          # his face's left edge; eye_line is his eyes' height
        # Captions stay off his face while it's on screen and sharp. An asset at the caption line can push them up to
        # right under his mouth, never onto it.
        if lines and backdrop_of(v) == "none" and not (v and v["place"] in ("split", "screen")):
            half = max(len(c["lines"]) for c in b["cards"]) * cap_size * 1.12 / 2   # page.js centres a card on its y
            if abs(plan.get("face_x", 0)) < (max(cap_w(line) for line in lines) + FACE_W) / 2:
                pushed = False
                if v:
                    _, by, _, bh = box(v, cy, eye, under_chin)
                    pushed = by < CAPTION_HOME + 45 and by + bh > CAPTION_HOME - 45
                if cy - half < eye + LIP and cy + half > eye - BROW:
                    to = f"just under his mouth, {round(eye + LIP + half + 5)}" if pushed else clear_of_face(eye, half)
                    out.append(f"Line {n}: the captions sit on his eyes or mouth; move this line's caption_y to {to}.")
                elif cy - half < eye + CHIN and cy + half > eye - BROW and not pushed:
                    out.append(f"Line {n}: the captions sit on his chin with nothing blurred behind them and no asset at "
                               f"y {CAPTION_HOME} pushing them up; put this line's caption_y at {clear_of_face(eye, half)}.")
        if not v:
            continue
        x, y, w, h = box(v, cy, eye, under_chin)
        if v["place"] == "bottom" and SAFE_BOTTOM - (cap_y + 45) < 160:
            out.append(f"Line {n}: \"bottom\" needs room under the captions; set caption_y to {SAFE_BOTTOM - 45 - 160} or "
                       "less for this line.")
        if b["cards"] and v["place"] not in ("split", "screen") and y < (b.get("caption_y") or cap_y) + 45 and y + h > (b.get("caption_y") or cap_y) - 45:
            out.append(f"Line {n}: the captions sit on the asset; move this line's caption_y above or below it.")
        # An asset over his face (brows to mouth) with nothing blurred behind leaves the title and the list crisp over a
        # face that's gone, which reads as a mistake rather than a layout. (face_y only moves the page's stand-in.)
        ow = max(0, min(x + w, fl + FACE_W) - max(x, fl))
        oh = max(0, min(y + h, eye + LIP) - max(y, eye - BROW))
        if v["place"] not in ("split", "screen") and backdrop_of(v) == "none" and ow * oh > 0.2 * FACE_W * (BROW + LIP):
            out.append(f"Line {n}: the asset covers his face with nothing blurred behind it. Give it \"backdrop\": \"blur\" "
                       "(an overlay with blur, which blurs his footage and the title and list behind it), or move it off his face.")
        src = vd / v["file"]
        if v["type"] == "image" and v["place"] != "under-chin" and src.exists():
            with Image.open(src) as im:
                iw, ih = im.size
            scale = (max if v["place"] in ("screen", "split") else min)(w / iw, h / ih)   # cover fills the box, contain fits it
            dw, dh = iw * scale, ih * scale
            if v["place"] in ("above", "below", "bottom", "rect", "spotlight") and (dw < 240 or dh < 160):
                out.append(f"Line {n}: {src.name} is drawn {dw:.0f}x{dh:.0f} in its {w}x{h} \"{v['place']}\" box, too small to read on a "
                           "phone. Give a portrait asset \"spotlight\" or a split, or move the captions to make room.")
            kind = sources(src.parent).get(src.name, {}).get("kind", "")
            need = 2 if kind == "screen" or v.get("text") else 1     # small text goes out at 2160x3840, so it needs 2x pixels
            if scale * need > 1.05:
                out.append(f"Line {n}: {src.name} ({iw}x{ih}) gets stretched {scale * need:.1f}x in its {w}x{h} box{' at the 2x export' if need == 2 else ''}, "
                           "so it will look soft. Find a bigger copy.")
    run = None                                    # one still up across consecutive lines adds up
    for n, b in enumerate(beats + [{"visual": None, "dur": 0}], 1):
        v = b["visual"]
        still = v["file"] if v and v["type"] == "image" and v["place"] not in ("under-chin", "screen") and not v.get("long_ok") else None
        if run and still == run[0]:
            run[2] += b["dur"]
            continue
        if run and run[2] > PACE["max_still_s"] + 0.05:
            where = f"Line {run[1]}" if run[1] == n - 1 else f"Lines {run[1]}-{n - 1}"
            out.append(f"{where}: {Path(run[0]).name} stays up {run[2]:.1f} s, past {PACE['max_still_s']:g} s. Give part of it "
                       "another asset, or set long_ok if he's reading it or it's complex (a tweet, code, a diagram he keeps "
                       "pointing at).")
        run = [still, n, b["dur"]] if still else None
    if not lst:                                   # a list reel's list changes on every line
        run, start = 0.0, 1
        for n, b in enumerate(beats, 1):
            if b["visual"]:
                run, start = 0.0, n + 1
                continue
            run += b["dur"]
            if run > PACE["max_without_new_s"]:
                where = f"Line {n}" if start == n else f"Lines {start}-{n}"
                out.append(f"{where}: {run:.1f} s with nothing new on screen; give {'it' if start == n else 'one of them'} an "
                           f"asset (the limit is {PACE['max_without_new_s']:g} s).")
                run = -1e9
    if hook.get("style") == "tiktok" and hook.get("lines"):
        hw = measurer(hook["size"])
        if len(hook["lines"]) > 2:
            out.append(f"The hook has {len(hook['lines'])} lines; two at most, three only when a CAPS word gets its own.")
        for line in hook["lines"]:
            if hw(line) + 2 * hook["pad"] > text_room(hook["y"]):
                out.append(f"The hook line \"{line}\" is too wide for the {SIDE} px side insets; split it or shorten it.")
        if hook.get("until") and not 2.5 <= hook["until"] <= 5.5:
            out.append(f"The hook stays up {hook['until']:.1f} s; keep it to his first sentence, 3-5 s.")
    m = plan.get("music") or {}
    library = (repo_root(vd) / "assets/music").is_dir()         # claude-editing keeps tracks in mood folders there
    low, high = AUDIO["music_under_voice_db"]
    if not music["tracks"]:
        out.append("No music: pick a track from assets/music/<mood>/." if library else "No music: ask Charles for a track.")
    elif not low <= float(m.get("under", (low + high) / 2)) <= high:
        out.append(f"The music sits {m.get('under')} dB under his voice; keep it {low:g}-{high:g} dB.")
    for e in (([m] if m.get("file") else []) + m.get("alternatives", [])) if library else []:
        mood = Path(e["file"]).parent.name
        if mood not in MOODS:
            out.append(f"{Path(e['file']).name} isn't in a mood folder of assets/music/ ({', '.join(sorted(MOODS))}).")
    sfx = [b for b in plan["beats"] if b.get("sfx")]
    per_min = AUDIO["sfx_per_minute_max"]
    if total and len(sfx) / (total / 60) > per_min:
        out.append(f"{len(sfx)} sound effects in {total:.0f} s is more than {per_min} a minute.")
    memes = [b["sfx"] for b in sfx if any(k in b["sfx"].lower() for k in MEME_SOUNDS)]
    if len(memes) > AUDIO["meme_sfx_per_reel_max"]:
        out.append(f"{len(memes)} meme sounds ({', '.join(memes)}); {AUDIO['meme_sfx_per_reel_max']} per video at most, on a "
                   "punchline.")
    return out


def repo_root(vd):
    return next((p for p in [vd, *vd.parents] if (p / ".git").exists()), vd)


def rel_from_page(vd, path):
    """A path relative to the video folder, as the page in build/ reaches it."""
    return "../" + str(Path(path))


def sources(folder):
    entries = {}
    for p in sorted(folder.glob("sources*.json")):
        try:
            for e in json.loads(p.read_text()):
                entries[e["file"].split("/")[-1]] = e
        except (json.JSONDecodeError, KeyError, TypeError) as err:
            print(f"skipping {p}: {err}")
    return entries


def link_for(vd, root, link):
    """Web links stay; a path in the repository or the video folder becomes one the local page can open; anything else
    isn't a link."""
    if not link or re.match(r"https?:", link):
        return link or ""
    for base in (root, vd):
        if (base / link).exists():
            return os.path.relpath(base / link, vd / "build")
    return ""


def groups_for(plan, vd, beats):
    adir = vd / plan.get("assets_dir", "assets/beats")
    comp_path = vd / plan["composites"] if plan.get("composites") else None
    comps = json.loads(comp_path.read_text()) if comp_path and comp_path.exists() else []
    in_comp = {str(c["group"]): [s["file"] for s in c["images"]] for c in comps}
    root = repo_root(vd)
    shown = {}                          # every image a line shows, by group, in order
    for b in beats:
        v = b.get("visual")
        if b.get("group") is not None and v and v.get("place") != "under-chin" and v.get("src"):
            shown.setdefault(str(b["group"]), [])
            if v["src"] not in shown[str(b["group"])]:
                shown[str(b["group"])].append(v["src"])
    out, seen = [], set()
    for i, b in enumerate(beats):
        g = b.get("group")
        if g is None or str(g) in seen:
            continue
        seen.add(str(g))
        folder = adir / str(g)
        meta = sources(folder) if folder.exists() else {}
        files = [p for p in sorted(folder.iterdir()) if p.suffix.lower() in IMG | VID] if folder.exists() else []
        used = list(in_comp.get(str(g), [])) + shown.get(str(g), [])
        key = lambda p: (str(p.relative_to(vd)) not in used, used.index(str(p.relative_to(vd))) if str(p.relative_to(vd)) in used else 0, p.name)
        images = []
        for p in sorted(files, key=key):
            e = meta.get(p.name, {})
            size = None
            if p.suffix.lower() in IMG:
                with Image.open(p) as im:
                    size = list(im.size)
            images.append({"src": rel_from_page(vd, p.relative_to(vd)), "used": str(p.relative_to(vd)) in used,
                           "kind": e.get("kind", ""), "what": e.get("what", ""), "date": e.get("artifact_date", ""),
                           "source": e.get("source", ""), "link": link_for(vd, root, e.get("file_page") or e.get("source_url") or ""),
                           "license": e.get("license", ""), "author": e.get("author", ""), "size": size,
                           "video": p.suffix.lower() in VID})
        out.append({"id": str(g), "title": b.get("label") or b["say"], "number": b.get("number"), "beat": i,
                    "plate": None, "images": images})
    return out


def write_sources(plan, vd, groups):
    if not any(g["images"] for g in groups):
        return
    cell = lambda s: str(s or "").replace("|", "/").replace("\n", " ").strip()
    adir = plan.get("assets_dir", "assets/beats")
    out = ["# Image sources", "", f"Written by the charles-reel-plans kit from `{adir}/<group>/sources*.json`. \"Used\" means it's on screen.", ""]
    for g in groups:
        out += [f"## {g['number'] if g['number'] is not None else g['id']}: {g['title']}", "",
                "| File | Used | What | Source | Licence | Author |", "| --- | --- | --- | --- | --- | --- |"]
        for im in g["images"]:
            link = im["link"]
            src = f"[{cell(im['source']) or 'link'}]({link})" if link.startswith("http") else cell(im["source"])
            out.append(f"| `{im['src'].split('/')[-1]}` | {'yes' if im['used'] else 'spare'} | {cell(im['what'])} | {src} | "
                       f"{cell(im['license'])} | {cell(im['author'])[:80]} |")
        out.append("")
    (vd / adir / "SOURCES.md").write_text("\n".join(out))


def norm(text):
    """A line cut down to its letters and digits, to match SCRIPT.md's lines to the plan's: no list number, case, quotes or
    punctuation."""
    text = re.sub(r"^\s*\d+\.\s+", "", text.lower().replace("\u2019", "'").replace("\u2018", "'"))
    return re.sub(r"[^a-z0-9]+", "", text)


def script_for(plan, vd, beats, hook):
    """The script as he reads it: SCRIPT.md line for line, in his notes' format, each spoken line tied to the plan's lines
    it covers (`i` the first, `last` the last), so the page can jump there and keep it lit while any of them plays.
    Without a SCRIPT.md, the same format from the plan."""
    path = vd / plan.get("script", "SCRIPT.md")
    if path.exists():
        lines = path.read_text().strip("\n").split("\n")
    else:
        lines = [f"**{plan['title']}**", ""]
        if hook.get("lines"):
            lines += ["Text hook: " + " ".join(hook["lines"] + ([hook["sub"]] if hook.get("sub") else [])), ""]
        lines += [f"{b['number']}. {b['say']}" if b["row"] is not None else b["say"] for b in beats]
    says = [norm(b["say"]) for b in beats]
    names = [{says[k], norm(b["label"] or "")} - {""} for k, b in enumerate(beats)]   # a list line can match its label
    out, j = [], 0
    for line in lines:
        bare = line.replace("*", "").strip()
        n, i = norm(bare), None
        # The title and the text hook are never spoken lines. Matches are looked for only a few lines ahead, so a short
        # line can't latch onto a word further on (the title "Anti-aliasing" did, to "that's called anti-aliasing").
        if n and not re.match(r"text hook\b", bare, re.I) and not re.fullmatch(r"\*\*.+\*\*", line.strip()):
            for k in range(j, min(len(beats), j + 6)):
                if n in names[k] or (len(says[k]) >= 8 and says[k] in n):
                    i, j = k, k + 1
                    while j < len(beats) and len(says[j]) >= 8 and says[j] in n:   # a sentence the plan cut into lines
                        j += 1
                    break
                if len(n) >= 20 and n in says[k]:                                   # lines the plan keeps as one
                    i, j = k, k
                    break
        out.append({"text": line, "i": i, "last": None if i is None else max(i, j - 1)})
    for a, b in zip(out, out[1:]):      # a label line (*4. Your 60 = background*) goes with the line it introduces
        if a["i"] is None and b["i"] is not None and re.fullmatch(r"\*[^*].*\*", a["text"].strip()):
            a["i"], a["last"] = b["i"], b["last"]
    return out


LENGTHS = {}


def clip_length(path):
    if path not in LENGTHS:
        r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                           capture_output=True, text=True)
        try:
            LENGTHS[path] = float(r.stdout.strip())
        except ValueError:
            LENGTHS[path] = 0.0
    return LENGTHS[path]


def poster_for(vd, src, at):
    """A still of a clip at `at` seconds, its transparency kept, for the clip's card on the page: build/posters/."""
    d = clip_length(src)
    if d > 0:
        at = min(at, max(0.0, d - 0.05))
    name = re.sub(r"[^A-Za-z0-9]+", "-", str(src.relative_to(vd).with_suffix(""))).strip("-")
    out = vd / "build/posters" / f"{name}-{round(at * 1000)}.webp"
    if out.exists() and out.stat().st_mtime >= src.stat().st_mtime:
        return out
    out.parent.mkdir(parents=True, exist_ok=True)
    png = out.with_suffix(".png")
    dec = ["-c:v", "libvpx-vp9"] if src.suffix.lower() == ".webm" else []    # ffmpeg's own VP9 decoder drops the alpha
    subprocess.run(["ffmpeg", "-v", "error", "-y", *dec, "-ss", f"{at:.3f}", "-i", str(src), "-frames:v", "1",
                    "-vf", "format=rgba", str(png)], check=False)
    if not png.exists():
        return None
    webp(png, out, 720, 80)
    png.unlink()
    return out


# (host, path, what the page calls it, its badge) for a reference's link; anything else is named by its host
REF_KINDS = [(r"(^|\.)(x|twitter)\.com$", r"/status/", "X post", "X"), (r"(^|\.)(x|twitter)\.com$", "", "X profile", "X"),
             (r"(^|\.)instagram\.com$", r"^/reels?/", "Instagram reel", "IG"), (r"(^|\.)instagram\.com$", r"^/p/", "Instagram post", "IG"),
             (r"(^|\.)instagram\.com$", "", "Instagram", "IG"), (r"(^|\.)tiktok\.com$", "", "TikTok", "TT"),
             (r"(^|\.)(youtube\.com|youtu\.be)$", r"^/shorts/", "YouTube Short", "YT"),
             (r"(^|\.)(youtube\.com|youtu\.be)$", "", "YouTube video", "YT"), (r"(^|\.)threads\.(net|com)$", "", "Threads post", "TH"),
             (r"(^|\.)bsky\.app$", "", "Bluesky post", "BS"), (r"(^|\.)github\.com$", "", "GitHub", "GH"),
             (r"(^|\.)dribbble\.com$", "", "Dribbble shot", "DR")]


def refs_for(plan, vd):
    """The posts, reels, videos and pages the video came from (plan.json's `references`), each with what it gave this
    video, for the page's References section. A plan written before `references` existed has only `reference` (its idea
    and the reel it borrows the structure from), and those two become the list."""
    refs = plan.get("references")
    if refs is None:
        old = plan.get("reference") or {}
        refs = []
        if old.get("idea"):
            refs.append({"url": old["idea"], "title": old.get("idea_title"), "by": old.get("idea_author"), "why": "The idea"})
        s = old.get("structure")
        if s and refs and refs[0]["url"] == s:
            refs[0]["why"] = "The idea and the structure"
        elif s:
            web = s.startswith("http")
            refs.append({"url": s if web else None, "local": old.get("structure_source") or (None if web else s),
                         "title": old.get("structure_title"), "why": "The structure"})
    root, out = repo_root(vd), []
    for n, r in enumerate(refs, 1):
        url, local = r.get("url"), r.get("local")
        kind, badge = "Our video", "Ours"
        if url:
            u = urllib.parse.urlparse(url)
            host = u.netloc.lower().removeprefix("www.")
            kind, badge = next(((k, b) for hp, pp, k, b in REF_KINDS if re.search(hp, host) and re.search(pp, u.path)),
                               (host, "Web"))
        item = {"url": url, "title": r.get("title") or url or local, "by": r.get("by"), "why": r.get("why"),
                "kind": r.get("kind") or kind, "badge": badge, "stats": r.get("stats")}
        if local:       # a folder in the repository: shown as its path, a link only on the local page
            p = next((q for q in (vd / local, root / local) if q.exists()), None)
            if p:
                item["folder"] = str(p.resolve().relative_to(root))
                item["local"] = os.path.relpath(p.resolve(), vd / "build")
        if r.get("image"):     # a still of it (a screenshot, a contact sheet), never someone else's video
            src = vd / r["image"]
            if src.suffix.lower() not in IMG:
                sys.exit(f"references: reference {n}'s image has to be a still ({', '.join(sorted(IMG))}), not {src.suffix}")
            if src.exists():
                item["image"] = f"../{r['image']}"
            else:   # a still of someone else's post is never committed, so on another computer the card goes without
                print(f"  references: {n}'s image {r['image']} isn't on this computer, so its card shows the platform instead")
        out.append({k: v for k, v in item.items() if v})
    return out


def assets_for(plan, vd, beats, groups, under_chin):
    """Every asset the reel shows, in order, for the page: a card per list item's group (its collage, then each image in
    it with its source and licence; spares stay in SOURCES.md) and one per other thing a line shows, with every line it's
    on. Lines that show the same file as the same thing (a clip that carries on, a card that comes back) share a card."""
    by_group = {g["id"]: g for g in groups}
    cap_y, eye, root = plan.get("caption_y", CAPTION_HOME), plan.get("eye_line", 860), repo_root(vd)
    cards, index = [], {}
    for i, b in enumerate(beats):
        v, g = b["visual"], b["group"]
        key = ("group", str(g)) if g is not None and str(g) in by_group else ("file", v["file"], v.get("what") or "") if v else None
        if key is None:
            continue
        if key in index:
            cards[index[key]]["beats"].append(i)
            continue
        index[key] = len(cards)
        listed = b["number"] is not None and b["label"]
        card = {"beats": [i], "number": b["number"], "start": b["start"],
                "title": b["label"] if listed else (v or {}).get("what") or b["say"], "what": "", "meta": None,
                "plate": None, "pieces": [im for im in by_group[key[1]]["images"] if im["used"]] if key[0] == "group" else []}
        if v:
            w, hh = box(v, cap_y, eye, under_chin)[2:]
            src = vd / v["file"]
            plate = {"src": v["src"], "type": v["type"], "alpha": bool(v.get("alpha")), "aspect": round(w / hh, 3)}
            if v["type"] == "video" and src.exists():
                d, at = clip_length(src), (v.get("from") or 0) + 0.7 * b["dur"]      # most of the way into its line
                if d > 0 and at >= d:
                    at = at % d if v.get("loop", True) is not False else d - 0.05
                p = poster_for(vd, src, at)
                plate["poster"] = rel_from_page(vd, p.relative_to(vd)) if p else None
            card["plate"] = plate
            if key[0] == "file":
                e = sources(src.parent).get(src.name, {}) if src.parent.exists() else {}
                if listed:
                    card["what"] = v.get("what") or e.get("what", "")
                card["meta"] = {"source": e.get("source", ""), "license": e.get("license", ""),
                                "link": link_for(vd, root, e.get("file_page") or e.get("source_url") or "")}
        cards.append(card)
    return cards
























def cut_music(plan, vd, length):
    """build/music/<n>-<title>.mp3: each track from its start point for the reel's length and the loop's hold, faded out at
    the end, at one loudness so switching tracks doesn't jump. The page then plays each clip from 0 and never has to seek
    inside a long song. MP3 because every browser plays it and the Artifact host serves it."""
    m = plan.get("music") or {}
    entries = [m] if m.get("file") else []          # the player plays the pick; alternatives stay in the plan for the edit
    folder = vd / "build/music"
    folder.mkdir(parents=True, exist_ok=True)
    tracks = []
    for k, e in enumerate(entries):
        path = (vd / e["file"]).resolve()
        if not path.exists():
            print(f"music not found, skipped: {e['file']}")
            continue
        stem = path.stem
        title, artist = (re.split(r" [-—] ", stem, maxsplit=1) + [""])[:2] if re.search(r" [-—] ", stem) else (stem, "")
        out = folder / f"{k + 1}-{re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')}.mp3"
        at = float(e.get("at") or 0)
        stamp = {"file": str(path), "at": at, "length": round(length, 2)}
        side = out.with_suffix(".json")
        if not (out.exists() and side.exists() and json.loads(side.read_text()) == stamp):
            fade = f"afade=t=in:d=0.03,afade=t=out:st={length - 1.8:.2f}:d=1.8"
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(at), "-t", f"{length:.2f}", "-i", str(path),
                            "-af", f"{fade},loudnorm=I=-16:TP=-1.5:LRA=11",
                            "-ar", "44100", "-ac", "2", "-c:a", "libmp3lame", "-b:a", "160k", str(out)], check=True)
            side.write_text(json.dumps(stamp))
        tracks.append({"title": title.strip(), "artist": artist.strip(), "at": 0.0, "from": at,
                       "src": rel_from_page(vd, out.relative_to(vd)), "why": e.get("why", "")})
    return {"under": m.get("under", 8.5), "tracks": tracks}


def real_cut(vd, n_beats):
    """The cut's own times, one {"s", "e"} per line, or None before there's a cut. edit/cuts.json is either that list or
    reelkit's cutter spec ({"phrases": ...}, what cut_take.py reads), whose result, edit/work/cut.cuts.json, has each kept
    line's cut_start and cut_end."""
    p = vd / "edit/cuts.json"
    if not p.exists():
        return None
    c = json.loads(p.read_text())
    if isinstance(c, list):
        return c
    w = vd / "edit/work/cut.cuts.json"
    if not w.exists():
        print("edit/cuts.json is reelkit's cutter spec and edit/work/cut.cuts.json isn't there yet, so the times stay "
              "before-filming ones")
        return None
    kept = json.loads(w.read_text()).get("kept") or []
    if len(kept) != n_beats:
        print(f"edit/work/cut.cuts.json keeps {len(kept)} lines and the plan has {n_beats}, so the times stay before-filming "
              "ones: one kept line per beat")
        return None
    return [{"s": k["cut_start"], "e": k["cut_end"]} for k in kept]


def build(vd):
    plan = json.loads((vd / "edit/plan.json").read_text())
    cuts = real_cut(vd, len(plan["beats"]))
    if cuts and len(cuts) != len(plan["beats"]):
        sys.exit(f"edit/cuts.json has {len(cuts)} lines and the plan has {len(plan['beats'])}: one cut per line.")
    is_list = bool(plan.get("list"))
    default_pace = plan.get("pace", "list" if is_list else "talk")
    default_caps = plan.get("captions", not is_list)            # a list reel's list is its captions
    # Before filming each line is an estimate (Timing in references/plan.md, or its `dur`); once edit/cuts.json exists,
    # the cut's timings win. Nothing reads the script aloud: he rejected every AI copy of his voice.
    beats, t, row, planned = [], 0.0, 0, []
    for i, b in enumerate(plan["beats"]):
        pace = b.get("pace") or ("end" if is_list and b.get("number") is None and i == len(plan["beats"]) - 1 else default_pace)
        planned.append(round(b.get("dur") or estimate(b["say"], pace), 2))
        if cuts:
            dur = round(cuts[i]["e"] - cuts[i]["s"], 3)
        else:
            dur = round(b.get("dur") or estimate(b["say"], pace), 2)
        cards, explicit = cards_for(b, default_caps, t, dur)
        v = copy.deepcopy(b.get("visual"))
        if v:
            if v.get("src"):
                src = vd / v["src"]
                if not src.exists():
                    print(f"line {i + 1}: {v['src']} doesn't exist yet; the mockup shows nothing there")
                v["type"] = "video" if src.suffix.lower() in VID else "image"
                v["file"] = v["src"]
                v["src"] = rel_from_page(vd, v["src"])
                if not v.get("what") and v["place"] != "under-chin":
                    v["what"] = sources(src.parent).get(src.name, {}).get("what", "")
            else:
                v = None
        beats.append({"start": round(t, 3), "dur": dur, "say": b["say"], "label": b.get("label"),
                      "number": b.get("number"), "row": row if b.get("number") is not None and is_list else None,
                      "cards": cards, "caption_explicit": explicit, "caption_y": b.get("caption_y"), "visual": v,
                      "group": b.get("group"), "note": b.get("note", ""), "sfx": b.get("sfx", ""), "pace": pace})
        if b.get("number") is not None and is_list:
            row += 1
        t += dur
    total = round(t, 3)
    # Every line's start and length on the reel's clock (the estimate's, or the cut's), for anything timed to his words: a
    # clip that runs across lines, an explainer card that changes on a word (charles-explainers-assets).
    (vd / "build").mkdir(exist_ok=True)
    (vd / "build/times.json").write_text(json.dumps({"source": "cut" if cuts else "estimate", "total": total,
        "beats": [{"i": i, "start": b["start"], "dur": b["dur"], "say": b["say"]} for i, b in enumerate(beats)]}, indent=1))
    lst = list_block(plan, beats) if is_list else None
    hook = hook_block(plan, beats, first_sentence_end(beats), lst["stop_at"] if lst else total)
    groups = groups_for(plan, vd, plan["beats"])
    for g in groups:
        g["plate"] = beats[g["beat"]]["visual"]["src"] if beats[g["beat"]]["visual"] else None
    root = repo_root(vd)
    data = {
        "title": plan["title"], "format_name": plan.get("format_name", f"{plan.get('format', 'talking-head')} reel"),
        "total": total, "timed": "cut" if cuts else "estimate", "beats": beats, "groups": groups,
        "reel": {"hook": hook, "list": lst, "captions": {"y": plan.get("caption_y", CAPTION_HOME), "size": plan.get("caption_size", CAPTION_SIZE)},
                 "safe": {"top": SAFE_TOP, "bottom": SAFE_BOTTOM, "rail_x": RAIL_X, "rail_y": RAIL_Y, "side": SIDE},
                 "eye_line": plan.get("eye_line", 860),
                 # a collage PNG is the zone plus a 40 px margin, placed 40 px up and left of the zone (collages.py)
                 "under_chin": (lambda z: [z[0] - 40, z[1] - 40, z[2] - z[0] + 80, z[3] - z[1] + 80])(
                     (plan.get("list") or {}).get("zone", [50, 1150, 1020, 1650]))},
        "music": cut_music(plan, vd, total + HOLD + 0.4),
        "fonts": {fam: "data:font/ttf;base64," + base64.b64encode((vd / path).read_bytes()).decode()
                  for fam, path in (plan.get("fonts") or {}).items() if (vd / path).exists()},
        "post": plan.get("post", {}), "reference": plan.get("reference", {}), "reading": plan.get("reading", ""),
        "filming": plan.get("filming", []),
        "files": {"folder": str(vd.relative_to(root)) if vd != root else vd.name,
                  "list": plan.get("files") or [["SCRIPT.md", "what you read"], ["edit/plan.json", "the plan the edit reads"],
                                                [f"{plan.get('assets_dir', 'assets/beats')}/", "the images and their sources"]],
                  "rebuild": f"python3 -I {os.path.relpath(KIT_AS_RUN, vd) if KIT_AS_RUN.is_relative_to(root) and root != vd else '<charles-reel-plans>/kit'}/build.py . --site"},
    }
    data["checks"] = checks(plan, vd, beats, hook, lst, data["music"], data["reel"]["under_chin"])
    write_sources(plan, vd, groups)
    player = {k: data[k] for k in ("title", "total", "timed", "beats", "reel", "music", "fonts")}
    player["post"] = {k: data["post"][k] for k in ("handle", "caption", "caption_alt", "options", "comment") if data["post"].get(k)}
    player["script"] = script_for(plan, vd, beats, hook)
    player["assets"] = assets_for(plan, vd, beats, groups, data["reel"]["under_chin"])
    player["references"] = refs_for(plan, vd)
    (vd / "build").mkdir(exist_ok=True)
    (vd / "build/plan.html").write_text(page(player, site=False))
    n_vis = sum(1 for b in beats if b["visual"])
    ends = f", list ends {lst['stop_at']:.1f} s" if lst else ""
    subtitle = f", subtitle {hook['sub']}" if hook.get("sub") else ""
    tied = sum(1 for ln in player["script"] if ln["i"] is not None)
    print(f"build/plan.html: {len(beats)} lines, {n_vis} with an asset, {len(player['assets'])} asset cards, {total:.1f} s "
          f"({data['timed']}){ends}{subtitle}, {len(data['music']['tracks'])} music tracks; script: {tied} of "
          f"{sum(1 for ln in player['script'] if ln['text'].strip())} lines tied to the plan's lines; "
          f"{len(player['references'])} references")
    if "references" not in plan:
        print("  references: only the idea and the structure from `reference`. List every post, reel and video that shaped "
              "this one in plan.json's `references`, each with its `why` (references/plan.md)")
    for n, r in enumerate(player["references"], 1):
        if not r.get("why"):
            print(f"  references: {n} ({r.get('title')}) has no `why`: say what it gave this video")
    print("Checks against charles-claude-editing's rules: " + ("all pass" if not data["checks"] else ""))
    for c in data["checks"]:
        print(f"  - {c}")
    if "--site" in sys.argv:
        write_site(player, vd)


def page(data, site):
    body = (KIT / "page/body.html").read_text()
    css = (KIT / "page/page.css").read_text()
    js = (KIT / "page/page.js").read_text()
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    title = html.escape(data["title"])
    desc = html.escape(f"{data['title']}: the reel playing with its music, the script, the caption options, every asset "
                       "and the references it came from.")
    scripts = f"<script>\nwindow.VIDEO = {payload};\n</script>\n<script>\n{js}</script>\n"
    if site:   # no head: the Artifact host adds its own, so the title, description and style lead the file
        return (f'<title>{title}</title>\n<meta name="description" content="{desc}">\n'
                f'<meta name="claude:viewport-fit-sides" content="cover">\n<style>\n{css}</style>\n{body}\n{scripts}')
    return ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            f'<title>{title}</title>\n<meta name="description" content="{desc}">\n<style>\n{css}</style>\n</head>\n'
            f'<body>\n{body}\n{scripts}</body>\n</html>\n')


def webp(src, out, longest, quality):
    out.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as im:
        im = im.convert("RGBA") if im.mode in ("RGBA", "LA", "P") else im.convert("RGB")
        if max(im.size) > longest:
            im.thumbnail((longest, longest), Image.LANCZOS)
        im.save(out, "WEBP", quality=quality, method=4)


def write_site(data, vd):
    """build/site/: index.html and media/ (the reel's images as WebP at the size the player shows, videos as small MP4s,
    the music clip, the clips' stills, and each collage image large and as a thumbnail), with files.json listing the
    media for the publish. Clip encodes are kept in build/encoded/ by source and settings, so a rebuild copies the same
    bytes instead of encoding again: VP9's WebM and VideoToolbox's HEVC come out different every run, which made
    unchanged clips look changed and every rebuild slow."""
    site = vd / "build/site"
    if site.exists():
        shutil.rmtree(site)
    media = site / "media"
    d = copy.deepcopy(data)
    d["site"] = True
    done = {}

    def encoded(src, out, args):
        """ffmpeg `args` (with OUT where the output goes) run once per source file, its mtime and size, and the args."""
        st = src.stat()
        key = hashlib.sha1(json.dumps([str(src), st.st_mtime_ns, st.st_size, args]).encode()).hexdigest()[:20]
        kept = vd / "build/encoded" / f"{key}{out.suffix}"
        if not kept.exists():
            kept.parent.mkdir(parents=True, exist_ok=True)
            tmp = kept.with_name(f"{key}.part{out.suffix}")
            subprocess.run([str(tmp) if a == "OUT" else a for a in args], check=True)
            tmp.replace(kept)
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(kept, out)

    def put(page_src, size, quality, kind):
        """page_src is how the local page reaches the file (../<path in the video folder>)."""
        key = (page_src, kind)
        if key in done:
            return done[key]
        src = (vd / "build" / page_src).resolve()
        rel = Path(page_src[3:]) if page_src.startswith("../") else Path(src.name)
        if src.suffix.lower() in VID:
            out = media / kind / rel.with_suffix(".mp4")
            encoded(src, out, ["ffmpeg", "-v", "error", "-y", "-i", str(src), "-an", "-vf", "scale='min(720,iw)':-2",
                               "-c:v", "libx264", "-crf", "28", "-preset", "veryfast", "-pix_fmt", "yuv420p",
                               "-movflags", "+faststart", "OUT"])
        elif src.suffix.lower() == ".mp3" or kind == "poster":
            out = media / kind / rel.name
            out.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, out)
        else:
            out = media / kind / rel.with_suffix(".webp")
            webp(src, out, size, quality)
        done[key] = str(out.relative_to(site))
        return done[key]

    def put_alpha(page_src):
        """A clip with a transparent background ("alpha": true, like an explainer card) goes out twice, up to 1080 px wide
        so its UI text stays sharp: VP9 with alpha in WebM, which Chrome, Edge and Firefox show, and HEVC with alpha for
        Safari and every iOS browser, which are all WebKit and drop WebM's alpha. page.js picks one. HEVC needs macOS."""
        key = (page_src, "alpha")
        if key in done:
            return done[key]
        src = (vd / "build" / page_src).resolve()
        rel = Path(page_src[3:]) if page_src.startswith("../") else Path(src.name)
        webm, hevc = (media / "reel" / rel.with_suffix(ext) for ext in (".webm", ".mp4"))   # artifacts don't serve .mov
        webm.parent.mkdir(parents=True, exist_ok=True)
        dec = ["-c:v", "libvpx-vp9"] if src.suffix.lower() == ".webm" else []   # ffmpeg's own VP9 decoder drops the alpha
        # scaled premultiplied, so the clear pixels' colour can't bleed into the edges as a dark fringe
        # (Color Design 101's 2x cards came out fringed when this scaled straight alpha)
        vf = "format=rgba,premultiply=inplace=1,scale='min(1080,iw)':-2:flags=lanczos,unpremultiply=inplace=1"
        encoded(src, webm, ["ffmpeg", "-v", "error", "-y", *dec, "-i", str(src), "-an", "-vf", vf, "-c:v", "libvpx-vp9",
                            "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "34", "-row-mt", "1", "-auto-alt-ref", "0",
                            "-deadline", "good", "-cpu-used", "4", "OUT"])
        encoded(src, hevc, ["ffmpeg", "-v", "error", "-y", *dec, "-i", str(src), "-an", "-vf", vf + ",format=bgra",
                            "-c:v", "hevc_videotoolbox", "-allow_sw", "1", "-alpha_quality", "0.75", "-q:v", "55",
                            "-tag:v", "hvc1", "-movflags", "+faststart", "OUT"])
        done[key] = (str(webm.relative_to(site)), str(hevc.relative_to(site)))
        return done[key]

    for b in d["beats"]:
        v = b["visual"]
        if v and v.get("alpha") and v["type"] == "video":
            v["src"], v["alt"] = put_alpha(v["src"])
        elif v:
            v["src"] = put(v["src"], 1600, 84, "reel")
    for a in d["assets"]:
        p = a["plate"]
        if p:
            if p["type"] == "video" and p["alpha"]:
                p["src"], p["alt"] = put_alpha(p["src"])
            else:
                p["src"] = put(p["src"], 1600, 84, "reel")       # the same file the reel shows, so it isn't sent twice
            if p.get("poster"):
                p["poster"] = put(p["poster"], 0, 0, "poster")
        for im in a["pieces"]:
            if im["video"]:
                im["src"] = im["large"] = put(im["src"], 0, 0, "reel")
                im["thumb"] = None
                continue
            im["large"] = put(im["src"], 1400, 80, "large")
            im["thumb"] = put(im["src"], 120, 78, "thumb")
            im["src"] = im["large"]
    for tr in d["music"]["tracks"]:
        tr["src"] = put(tr["src"], 0, 0, "music")
    for r in d["references"]:
        if r.get("image"):
            r["large"] = put(r["image"], 1400, 80, "large")
            r["thumb"] = put(r["image"], 240, 78, "ref")
            r["image"] = r["large"]
        r.pop("local", None)        # a path in the repository, which the published copy doesn't have
    (site / "index.html").write_text(page(d, site=True))
    files = sorted(str(p.relative_to(site)) for p in media.rglob("*") if p.is_file())
    (site / "files.json").write_text(json.dumps([{"path": f} for f in files], indent=0))
    size = sum((site / f).stat().st_size for f in files) + (site / "index.html").stat().st_size
    print(f"build/site: index.html ({(site / 'index.html').stat().st_size // 1024} KB) and {len(files)} media files, "
          f"{size / 1e6:.1f} MB in all")
    if len(files) > LIMITS[0] or size > LIMITS[1]:
        print(f"  over one publish's limits ({LIMITS[0]} files, {LIMITS[1] / 1e6:.0f} MB): publish the page with the first part of "
              "files.json, then the rest to the same file path in further publishes")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    build(Path(args[0] if args else ".").resolve())
