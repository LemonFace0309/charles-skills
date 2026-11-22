#!/usr/bin/env python3
"""Generates the cards' objects on fal, all jobs at once, as transparent PNGs, and logs each job.

    python3 -I <kit>/fal_gen.py <project> prompts.json            # every entry
    python3 -I <kit>/fal_gen.py <project> prompts.json anchor seal  # just these

prompts.json, in the project: {"name": {"prompt": "...", "endpoint": "openai/gpt-image-2.6/flare/text-to-image",
"size": "square_hd", "background": "transparent", "image": "gen/x.png"}}. "image" makes it an edit of that picture
(use the edit endpoint), which keeps a second state of an object matching the first. Writes gen/<name>.png and
gen/<name>-512.png, and appends {name, endpoint, prompt, seconds, date} to gen/jobs.jsonl.

The key is FAL_KEY from the environment, or from the nearest .env above the project. It is never printed.
Pick the endpoint fresh (references/objects.md): the default is the best transparent-capable model on 22 Nov 2026.
"""
import base64, json, mimetypes, os, pathlib, subprocess, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

DEFAULT = "openai/gpt-image-2.6/flare/text-to-image"


def find_key(start):
    if os.environ.get("FAL_KEY"):
        return os.environ["FAL_KEY"]
    for d in [start, *start.parents]:
        env = d / ".env"
        if env.is_file():
            for line in env.read_text().splitlines():
                line = line.strip().removeprefix("export ")
                if line.startswith("FAL_KEY="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("no FAL_KEY in the environment or any .env above the project")


def main():
    project = pathlib.Path(sys.argv[1]).resolve()
    specs = json.loads((project / sys.argv[2]).read_text())
    names = sys.argv[3:] or list(specs)
    key = find_key(project)

    def call(method, url, body=None):
        req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None,
                                     headers={"Authorization": f"Key {key}", "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=180) as r:
            return json.loads(r.read())

    def run(name):
        spec = specs[name]
        ep = spec.get("endpoint", DEFAULT)
        body = {"prompt": spec["prompt"], "image_size": spec.get("size", "square_hd"), "num_images": 1,
                "output_format": "png", "quality": spec.get("quality", "high"), "background": spec.get("background", "transparent")}
        if spec.get("image"):
            p = project / spec["image"]
            body["image_urls"] = [f"data:{mimetypes.guess_type(p.name)[0] or 'image/png'};base64,{base64.b64encode(p.read_bytes()).decode()}"]
        t0 = time.time()
        try:
            job = call("POST", f"https://queue.fal.run/{ep}", body)
            while True:
                st = call("GET", job["status_url"])
                if st.get("status") == "COMPLETED":
                    break
                if st.get("status") in ("FAILED", "ERROR"):
                    return f"{name}: FAILED {st}"
                time.sleep(2)
            url = call("GET", job["response_url"])["images"][0]["url"]
        except Exception as e:  # report it and let the other jobs finish
            return f"{name}: FAILED {e}"
        gen = project / "gen"
        gen.mkdir(exist_ok=True)
        dest = gen / f"{name}.png"
        urllib.request.urlretrieve(url, dest)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(dest), "-vf", "scale=512:512:flags=lanczos", str(gen / f"{name}-512.png")], check=False)
        secs = round(time.time() - t0, 1)
        with open(gen / "jobs.jsonl", "a") as f:
            f.write(json.dumps({"name": name, "endpoint": ep, "prompt": spec["prompt"], "seconds": secs, "date": time.strftime("%Y-%m-%d")}) + "\n")
        return f"{name}: gen/{name}.png in {secs} s"

    with ThreadPoolExecutor(max_workers=6) as ex:
        for line in ex.map(run, names):
            print(line)


if __name__ == "__main__":
    main()
