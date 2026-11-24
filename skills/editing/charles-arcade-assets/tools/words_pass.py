#!/usr/bin/env python3
"""The word pass for a project: transcribe it, snap word starts to their sound, and list what to check by eye.

  words_pass.py <project> [--audio FILE] [--keys paywall,aha] [--retranscribe] [--tol 0.1] [--hf "COMMAND"]

1. Transcribes the audio with HyperFrames into <project>/transcript.json, unless one is there already
   (--retranscribe does it again). HyperFrames uses Parakeet once it is installed (`hf models list`), else
   Whisper small.en.
2. Snaps the first word after each pause to where its sound begins (onsets.py). Recognisers start those words
   0.2-0.4 s off; the original is kept once as transcript.raw.json, and a second run changes nothing.
3. Lists every word whose start is still more than --tol seconds off its sound, and draws them on
   review/words.png: red is the transcript's start, green where the sound starts (onsets.py --check). Inside a
   phrase recognisers drift 0.1-0.25 s, early into the word before or late onto a phrase-final syllable.
4. With --keys, checks only those words and draws review/keys.png: run it again once the beat sheet names the
   words its hits land on, and settle every one.
5. Prints the phrases and words to plan beats from (words.py).

It moves nothing in steps 3 and 4. Confirm each flagged word on its strip, then move it:
  python3 <skill>/tools/onsets.py <project>/transcript.json <audio> --move paywall,aha      (take the suggestion)
  python3 <skill>/tools/onsets.py <project>/transcript.json <audio> --move moment=29.22    (your own time)

The audio is --audio, else the first of part.m4a, assets/voice.m4a, assets/voice.*, voice.* in the project.
Needs ffmpeg, npx (Node 22+) and numpy. Run it with the same python3 the other tools use. The first transcription
downloads the speech model; where Node can't reach the internet through a proxy, pass
--hf "bunx --bun hyperframes@0.8.217", or transcribe elsewhere and put transcript.json in the project.
"""
import argparse, shlex, subprocess, sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
HF = "npx --yes hyperframes@0.8.217"


def find_audio(project, given):
    if given:
        path = Path(given)
        if not path.is_file():
            sys.exit(f"no audio at {path}")
        return path
    for pattern in ("part.m4a", "assets/voice.m4a", "assets/voice.*", "voice.*"):
        hits = sorted(project.glob(pattern))
        if hits:
            return hits[0]
    sys.exit(f"no audio in {project}: pass --audio, or put it at part.m4a or assets/voice.m4a")


def step(title, cmd, hint="", **kw):
    print(f"\n== {title}\n$ {' '.join(shlex.quote(str(c)) for c in cmd)}", flush=True)
    try:
        done = subprocess.run([str(c) for c in cmd], **kw)
    except FileNotFoundError:
        sys.exit(f"{title} failed: {cmd[0]} is not installed{hint}")
    if done.returncode:
        sys.exit(f"{title} failed (exit {done.returncode}){hint}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project", help="the project folder (for a set of sizes, the set's folder)")
    ap.add_argument("--audio", help="the voice (default: part.m4a or assets/voice.m4a in the project)")
    ap.add_argument("--keys", metavar="W1,W2", help="check only the words the hits land on, and draw review/keys.png")
    ap.add_argument("--retranscribe", action="store_true", help="transcribe again even if transcript.json exists")
    ap.add_argument("--tol", default="0.1", help="how far off its sound a start may be, in seconds (default 0.1)")
    ap.add_argument("--hf", default=HF, help=f'how to run HyperFrames (default "{HF}")')
    args = ap.parse_args()

    project = Path(args.project).resolve()
    if not project.is_dir():
        sys.exit(f"{project} is not a folder")
    audio = find_audio(project, args.audio)
    transcript = project / "transcript.json"
    review = project / "review"
    review.mkdir(exist_ok=True)
    for old in ("words.png", "keys.png"):          # this run's strips only, so none is read from an earlier pass
        (review / old).unlink(missing_ok=True)

    if args.retranscribe or not transcript.exists():
        step("transcribe", [*shlex.split(args.hf), "transcribe", audio, "-d", project, "--json"], cwd=project,
             hint='\nIf the model download timed out behind a proxy, pass --hf "bunx --bun hyperframes@0.8.217", '
                  "or transcribe elsewhere and put transcript.json in the project.")
        if not transcript.exists():
            sys.exit(f"HyperFrames wrote no {transcript}")
    else:
        print(f"== transcribe: keeping {transcript.name} (--retranscribe makes a new one)")

    py = sys.executable
    step("snap the words after each pause", [py, TOOLS / "onsets.py", transcript, audio])
    step("words still off their sound", [py, TOOLS / "onsets.py", transcript, audio, "--check", "--tol", args.tol,
                                         "--strip", review / "words.png"])
    if args.keys:
        step("the hit words", [py, TOOLS / "onsets.py", transcript, audio, "--check", "--tol", args.tol,
                               "--words", args.keys, "--strip", review / "keys.png"])
    step("phrases and words to plan from", [py, TOOLS / "words.py", transcript])

    rel = lambda p: p.relative_to(project) if p.is_relative_to(project) else p
    strips = [rel(s) for s in (review / "words.png", review / "keys.png") if s.exists()]
    look = f"Open {' and '.join(map(str, strips))} and move" if strips else "No word is off its sound by more than the tolerance; move"
    print(f"""
== what to do now
1. Proofread names and numbers in {rel(transcript)} against what is said (recognisers write "Chat GBT" for
   ChatGPT, turn product names and comment keywords into common words, and Parakeet writes numbers wrong).
2. {look} only the words the strip confirms:
   {shlex.quote(py)} {shlex.quote(str(TOOLS / 'onsets.py'))} {shlex.quote(str(transcript))} {shlex.quote(str(audio))} --move <word or time>[=<your time>]
   On fast conversational speech most flags are "less sure": settle only the hit words there.
3. {'Settle every hit word above ("not paired" means judge it on the strip).' if args.keys else 'Once the beat sheet names its hit words, run this again with --keys <them>.'}""")


if __name__ == "__main__":
    main()
