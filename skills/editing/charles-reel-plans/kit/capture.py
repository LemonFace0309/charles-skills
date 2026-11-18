"""Screenshot a live or archived web page, or a frame of the plan page, at 2x with headless Google Chrome.

  python3 -I <skill>/kit/capture.py URL OUT.png [--size 1280x800] [--scale 2] [--dark] [--wait 8000] [--crop x,y,w,h]
  python3 -I <skill>/kit/capture.py "file://$PWD/build/plan.html?solo&t=12.4" build/frame.png --size 1080x1920 --scale 1

- A Wayback Machine URL (web.archive.org/web/<timestamp>/<url>) is captured without the Wayback toolbar: the timestamp gets
  the if_ flag, which serves the archived page with its own CSS and images but no banner.
- --dark asks the page for its dark theme (prefers-color-scheme: dark). Charles's rule for live pages is dark mode.
- --wait is how long the page gets to load and settle, in virtual milliseconds.
- --crop is in CSS pixels on the --size viewport (x,y,w,h). The saved PNG is the crop at --scale.

Writes OUT.png and OUT.png.json (the URL, when, the viewport) so every capture keeps its source.
"""
import json
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

CHROME = next((c for c in ("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", shutil.which("google-chrome"),
                           shutil.which("chromium")) if c and Path(c).exists()), None)


def main(a):
    if len(a) < 2:
        sys.exit(__doc__)
    if not CHROME:
        sys.exit("Google Chrome or Chromium is needed")
    url, out = a[0], Path(a[1])
    opt = lambda k, d: a[a.index(k) + 1] if k in a else d
    w, h = map(int, opt("--size", "1280x800").split("x"))
    scale = float(opt("--scale", "2"))
    url = re.sub(r"(web\.archive\.org/web/\d+)(?:[a-z]{2}_)?/", r"\1if_/", url)
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        shot = Path(tmp) / "shot.png"
        cmd = [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--mute-audio", f"--user-data-dir={tmp}/profile",
               f"--force-device-scale-factor={scale}", f"--window-size={w},{h}", f"--virtual-time-budget={opt('--wait', '8000')}",
               f"--screenshot={shot}", url]
        if "--dark" in a:
            cmd.insert(1, "--force-dark-mode")
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
        if not shot.exists():
            sys.exit(f"Chrome wrote no screenshot for {url}")
        from PIL import Image
        im = Image.open(shot)
        im.load()
    if "--crop" in a:
        x, y, cw, ch = (float(v) for v in opt("--crop", "").split(","))
        im = im.crop(tuple(round(v * scale) for v in (x, y, x + cw, y + ch)))
    im.save(out)
    Path(str(out) + ".json").write_text(json.dumps({
        "url": url, "captured": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "viewport": [w, h], "scale": scale, "dark": "--dark" in a, "crop_css": opt("--crop", None), "saved_size": list(im.size),
    }, indent=1))
    print(f"{out}  {im.size[0]}x{im.size[1]}")


if __name__ == "__main__":
    main(sys.argv[1:])
