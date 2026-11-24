"""Propose tight, safe in and out points for every phrase in cuts.json, from the sound itself.

Each phrase's in and out move onto his sound, measured band by band against his own line (soundmap.py): inward as far as
the fade of his first or last word (never past anything that could be his word), outward only where the current edge cuts
into the strong part of a word. A final "s", "t", fading vowel or nasal stays in; silence, and a breath or click set
apart from the line, go. cut_take.py
then keeps one frame of room tone before the word and 35-50 ms after it, so every join holds at most 0.1 s of silence.
Where a breath or click runs straight into a line (voice_map.py merged it into the line's stretch of sound), the proposal
adds an "avoid" range, so the join's room tone stops short of it.

It also lists every pause of 0.35 s or more inside a phrase: dead air to cut unless it's a beat he holds looking at the
lens. --split cuts those pauses out (each phrase becomes two), taking the words on either side from work/voice_map.json.

usage (from a video's edit folder, after voice_map.py and a first cuts.json with one phrase per kept line):
  python3 <skill>/scripts/tighten.py [--raw ../footage/raw.mov] [--cuts cuts.json] [--work work] [--split] [--write]
It prints old and new edges per phrase and writes the proposal to work/tighten.json. --write also replaces cuts.json,
after copying it to cuts.json.bak. Then run cut_take.py and check_cut.py. Needs numpy and ffmpeg."""
import argparse, copy, json, os, re, shutil, sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import timeline_audio  # noqa: E402
import soundmap  # noqa: E402
from cut_take import paint  # noqa: E402

DEFAULTS = {"gap": 0.10, "out_max": 0.05, "lead": 0.03, "tail": 0.12, "lead_max": 0.035}
PAUSE_MIN = 0.35
GUARD = 0.015        # how far an avoid range stays from his word
CLICK_LOOK = 0.08    # how far past a word's edge a click under the join is looked for
LISTEN = 0.06        # an inward move this big gets a note to listen: the rare quiet ending the sound can't tell from a breath


def words_between(words, a, b):
    return [w for w in words if a <= (w["start"] + w["end"]) / 2 <= b]


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--raw", default="../footage/raw.mov")
    ap.add_argument("--cuts", default="cuts.json")
    ap.add_argument("--work", default="work")
    ap.add_argument("--split", action="store_true", help="split phrases at pauses of 0.35 s or more")
    ap.add_argument("--write", action="store_true", help="replace cuts.json (after a cuts.json.bak copy)")
    a = ap.parse_args()

    cfg = json.load(open(a.cuts))
    new = copy.deepcopy(cfg)
    for k, v in DEFAULTS.items():
        new.setdefault(k, v)
    audio, rate, holes = timeline_audio.load(a.raw)
    raw = paint(audio.mean(axis=1), rate, cfg, cfg["phrases"], say=lambda *_: None)
    sm = soundmap.SoundMap(raw, rate, holes)
    dur = len(raw) / rate
    vm_path = os.path.join(a.work, "voice_map.json")
    vm = json.load(open(vm_path)) if os.path.exists(vm_path) else {"islands": [], "words": []}
    phrases = cfg["phrases"]
    starts = sorted(p["in"] for p in phrases) + [h[0] for h in holes]
    ends = sorted(p["out"] for p in phrases) + [h[1] for h in holes]
    avoid = [list(r) for r in cfg.get("avoid", [])]
    out_phrases, rows = [], []
    for i, p in enumerate(phrases):
        nxt = min([s for s in starts if s > p["out"] + 1e-3] + [dur])
        prv = max([e for e in ends if e < p["in"] - 1e-3] + [0.0])
        level = sm.level(p["in"], p["out"])
        words = re.findall(r"[A-Za-z0-9'%$]+", p["text"])
        e_clip, e_fade = sm.end(p["out"], min(nxt - 0.01, p["out"] + 0.6), soundmap.ends_in_stop(words[-1] if words else ""), level)
        s_clip, s_fade = sm.start(p["in"], max(prv + 0.01, p["in"] - 0.6), level)
        q = dict(p)
        # Inward only as far as his sound's fade (the safe direction stops at sound that might be his word); outward only
        # when the current edge cuts strong sound (a clip). An edge already inside the faint fade stays where it is.
        if p["out"] > e_fade or p["out"] < e_clip - soundmap.CLIP_SLACK:
            q["out"] = round(e_fade, 3)
        if p["in"] < s_fade or p["in"] > s_clip + soundmap.CLIP_SLACK:
            q["in"] = round(s_fade, 3)
        note = []
        if abs(q["out"] - p["out"]) > 0.25 or abs(q["in"] - p["in"]) > 0.25:
            note.append("moved more than 0.25 s: check this phrase's text matches the take there")
        if p["out"] - q["out"] > LISTEN or q["in"] - p["in"] > LISTEN:
            note.append(f"LISTEN: an edge moved more than {LISTEN * 1000:.0f} ms into the line; hear its first and last word before cutting")
        # A breath or click merged into this line's stretch of sound: keep the join's room tone off it.
        for isl in vm["islands"]:
            if isl["start"] < q["in"] - 0.04 and isl["end"] > q["in"]:
                avoid.append([round(isl["start"], 3), round(q["in"] - GUARD, 3)])
                note.append(f"avoid {isl['start']:.3f}-{q['in'] - GUARD:.3f} (sound running into his first word)")
            if isl["end"] > q["out"] + 0.04 and isl["start"] < q["out"]:
                avoid.append([round(q["out"] + GUARD, 3), round(isl["end"], 3)])
                note.append(f"avoid {q['out'] + GUARD:.3f}-{isl['end']:.3f} (sound running on after his last word)")
        # A click or a short breath right next to his word, too short for voice_map.py to list: keep the join off it too.
        for t0, t1, side in ((q["out"] + GUARD, q["out"] + CLICK_LOOK, "after"), (q["in"] - CLICK_LOOK, q["in"] - GUARD, "before")):
            i0, i1 = sm.index(t0), sm.index(t1)
            on = sm.on[i0:i1 + 1]
            if on.any():
                hits = np.flatnonzero(on)
                a0, a1 = float(sm.t[i0 + hits[0]] - soundmap.WIN / 2), float(sm.t[i0 + hits[-1]] + soundmap.WIN / 2)
                a0, a1 = (max(a0, q["out"] + GUARD), a1) if side == "after" else (a0, min(a1, q["in"] - GUARD))
                if a1 - a0 > 0.003:
                    avoid.append([round(a0, 3), round(a1, 3)])
                    note.append(f"avoid {a0:.3f}-{a1:.3f} (a click or breath {side} his word)")
        pauses = sm.pauses(q["in"], q["out"], PAUSE_MIN)
        parts = [q]
        if pauses and a.split:
            cuts_at = [(q["in"], None)] + [(p0, p1) for p0, p1 in pauses] + [(None, q["out"])]
            spans = [(cuts_at[j][1] if j else q["in"], cuts_at[j + 1][0] if j + 1 < len(cuts_at) - 1 else q["out"]) for j in range(len(cuts_at) - 1)]
            spans = [(s if s is not None else q["in"], e if e is not None else q["out"]) for s, e in spans]
            texts = [" ".join(w["word"] for w in words_between(vm["words"], s, e)).strip() for s, e in spans]
            if all(texts):
                parts = []
                for (s, e), text in zip(spans, texts):
                    r = dict(q)
                    r["in"], r["out"], r["text"] = round(s, 3), round(e, 3), text
                    parts.append(r)
                note.append(f"split at {len(pauses)} pause(s) of {', '.join(f'{p1 - p0:.2f} s' for p0, p1 in pauses)}")
            else:
                note.append("not split: no words from voice_map.json around the pause (run voice_map.py with words)")
        elif pauses:
            note.append("pause(s) inside: " + ", ".join(f"{p1 - p0:.2f} s at {p0:.2f}" for p0, p1 in pauses) + " (--split cuts them)")
        out_phrases += parts
        rows.append(f"{i + 1:3d} in {p['in']:8.3f} -> {q['in']:8.3f} ({(q['in'] - p['in']) * 1000:+5.0f} ms)   out {p['out']:8.3f} -> "
                    f"{q['out']:8.3f} ({(q['out'] - p['out']) * 1000:+5.0f} ms)   {p['text'][:34]!r}" + ("\n      " + "; ".join(note) if note else ""))
    new["phrases"] = out_phrases
    if avoid:
        merged = []
        for s, e in sorted(avoid):
            if e - s < 0.005:
                continue
            if merged and s <= merged[-1][1] + 0.005:
                merged[-1][1] = max(merged[-1][1], e)
            else:
                merged.append([s, e])
        new["avoid"] = merged
    print("\n".join(rows))
    os.makedirs(a.work, exist_ok=True)
    json.dump(new, open(os.path.join(a.work, "tighten.json"), "w"), indent=1)
    print(f"\nproposal: {os.path.join(a.work, 'tighten.json')}" + ("" if a.write else "  (run again with --write to replace cuts.json)"))
    if a.write:
        shutil.copyfile(a.cuts, a.cuts + ".bak")
        json.dump(new, open(a.cuts, "w"), indent=1)
        print(f"wrote {a.cuts} (the old one is {a.cuts}.bak). Next: cut_take.py, then check_cut.py.")


if __name__ == "__main__":
    main()
