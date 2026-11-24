#!/usr/bin/env python3
"""Generates the cards' objects with OpenAI's Images API, for when fal can't run them (its answer to a spent account
is 403 "Exhausted balance"). Same prompts file and same output as fal_gen.py, without edits of an earlier picture.

    python3 -I <kit>/openai_gen.py <project> prompts.json            # every entry
    python3 -I <kit>/openai_gen.py <project> prompts.json keycap     # just these

prompts.json, in the project: {"name": {"prompt": "...", "size": "square_hd" | "landscape_16_9" | "portrait_16_9",
"background": "transparent" | "opaque", "model": "..."}}. Writes gen/<name>.png and gen/<name>-512.png (longest side
512), and appends {name, endpoint, prompt, seconds, date} to gen/jobs.jsonl.

The key is OPENAI_API_KEY from the environment, or from the nearest .env above the project. It is never printed.
Pick the model fresh (references/playful-objects.md): the default was the best transparent-capable one on 22 Nov 2026.
"""
import base64, json, os, pathlib, subprocess, sys, time, urllib.error, urllib.request
from concurrent.futures import ThreadPoolExecutor

MODEL = "gpt-image-2.6-flare"
SIZES = {"square_hd": "1024x1024", "landscape_16_9": "1536x1024", "portrait_16_9": "1024x1536"}


def find_key(start):
    if os.environ.get("OPENAI_API_KEY"):
        return os.environ["OPENAI_API_KEY"]
    for d in [start, *start.parents]:
        env = d / ".env"
        if env.is_file():
            for line in env.read_text().splitlines():
                line = line.strip().removeprefix("export ")
                if line.startswith("OPENAI_API_KEY="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("no OPENAI_API_KEY in the environment or any .env above the project")


def main():
    project = pathlib.Path(sys.argv[1]).resolve()
    specs = json.loads((project / sys.argv[2]).read_text())
    names = sys.argv[3:] or list(specs)
    key = find_key(project)
    gen = project / "gen"
    gen.mkdir(exist_ok=True)

    def run(name):
        spec = specs[name]
        body = {"model": spec.get("model", MODEL), "prompt": spec["prompt"], "n": 1, "size": SIZES[spec.get("size", "square_hd")],
                "quality": spec.get("quality", "high"), "output_format": "png", "background": spec.get("background", "transparent")}
        req = urllib.request.Request("https://api.openai.com/v1/images/generations", method="POST", data=json.dumps(body).encode(),
                                     headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
        t0 = time.time()
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                data = json.loads(r.read())["data"][0]
        except urllib.error.HTTPError as e:
            return f"{name}: FAILED {e.code} {e.read().decode(errors='replace')[:300]}"
        except Exception as e:  # report it and let the other jobs finish
            return f"{name}: FAILED {e}"
        dest = gen / f"{name}.png"
        dest.write_bytes(base64.b64decode(data["b64_json"]))
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(dest), "-vf", "scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos",
                        str(gen / f"{name}-512.png")], check=False)
        secs = round(time.time() - t0, 1)
        with open(gen / "jobs.jsonl", "a") as f:
            f.write(json.dumps({"name": name, "endpoint": f"openai {body['model']}", "prompt": spec["prompt"], "seconds": secs, "date": time.strftime("%Y-%m-%d")}) + "\n")
        return f"{name}: gen/{name}.png in {secs} s"

    with ThreadPoolExecutor(max_workers=6) as ex:
        for line in ex.map(run, names):
            print(line)


if __name__ == "__main__":
    main()
