"""Find and fetch Wikimedia files with their licence, for a reel's assets. Run it from the video folder.

  python3 -I <skill>/kit/commons.py search "first iPhone Macworld 2007" [--limit 8] [--wiki en]
  python3 -I <skill>/kit/commons.py get "File:First iPhone Macworld 2007 DSCF1286.agr.jpg" research/raw/2007/iphone.jpg [--width 1800] [--wiki en]

search prints each match's title, full size, licence and file page. get saves a rendering at --width (SVGs come back as PNG,
and a raster narrower than --width comes back at its own size), then writes <out>.json beside it: file page, licence, author,
credit, date and the size saved. Those .json files are what each asset group's sources.json is built from.

Search keeps to images (filetype:bitmap|drawing) unless the query names a filetype, since a plain search can come back all
PDFs. Wikimedia rounds a rendering up to its standard widths (1280, 1920, 2560 ...), so --width 1600 saves 1920 wide. When
Wikimedia answers 429 (too many requests) or 503, the request waits and tries again, up to four times.

--wiki en searches and fetches from English Wikipedia instead of Commons. That's where non-free screenshots, covers and logos
live (low resolution, used under fair use), so check the saved size before picking one.
"""
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

UA = "reel-plan-asset-research/1.0 (local script)"
APIS = {"commons": "https://commons.wikimedia.org/w/api.php", "en": "https://en.wikipedia.org/w/api.php"}
META = "LicenseShortName|LicenseUrl|Artist|Credit|DateTimeOriginal|ImageDescription|UsageTerms|Copyrighted"


def fetch(url, timeout=60):
    """The response body, waiting and retrying when Wikimedia says it's busy (429, 503)."""
    for attempt in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503) or attempt == 4:
                raise
            wait = int(e.headers.get("Retry-After") or 0) or (4, 10, 20, 40)[attempt]
            print(f"  Wikimedia answered {e.code}; trying again in {wait} s", file=sys.stderr)
            time.sleep(wait)


def api(wiki, **params):
    params = {"format": "json", "formatversion": "2", **params}
    return json.loads(fetch(APIS[wiki] + "?" + urllib.parse.urlencode(params), timeout=30))


def plain(html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html or "")).strip()


def search(query, limit=8, wiki="commons"):
    if "filetype:" not in query:
        query += " filetype:bitmap|drawing"
    d = api(wiki, action="query", generator="search", gsrnamespace=6, gsrsearch=query, gsrlimit=limit,
            prop="imageinfo", iiprop="size|mime|extmetadata|url", iiextmetadatafilter=META)
    pages = sorted(d.get("query", {}).get("pages", []), key=lambda p: p.get("index", 0))
    for p in pages:
        ii = (p.get("imageinfo") or [{}])[0]
        m = ii.get("extmetadata", {})
        lic = m.get("LicenseShortName", {}).get("value", "?")
        print(f"{p['title']}\n    {ii.get('width')}x{ii.get('height')} {ii.get('mime')} | {lic} | "
              f"{plain(m.get('Artist', {}).get('value'))[:60]} | {ii.get('descriptionurl')}")
    if not pages:
        print("no matches")


def get(title, out, width=1800, wiki="commons"):
    if not title.startswith("File:"):
        title = "File:" + title
    d = api(wiki, action="query", titles=title, prop="imageinfo", iiprop="url|size|mime|extmetadata",
            iiurlwidth=width, iiextmetadatafilter=META)
    page = d["query"]["pages"][0]
    if "imageinfo" not in page:
        sys.exit(f"not found on {wiki}: {title}")
    ii = page["imageinfo"][0]
    src = ii.get("thumburl") or ii["url"]
    if ii.get("mime") != "image/svg+xml" and ii.get("width", 0) <= width:
        src = ii["url"]                       # the original is no bigger than the rendering would be
    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    if ii.get("mime") == "image/svg+xml" and out.suffix.lower() != ".png":
        out = out.with_suffix(".png")
    out.write_bytes(fetch(src))
    m = ii.get("extmetadata", {})
    meta = {
        "file_page": ii.get("descriptionurl"),
        "fetched_from": src,
        "wiki": wiki,
        "title": title,
        "license": m.get("LicenseShortName", {}).get("value"),
        "license_url": m.get("LicenseUrl", {}).get("value"),
        "author": plain(m.get("Artist", {}).get("value")),
        "credit": plain(m.get("Credit", {}).get("value")),
        "date": plain(m.get("DateTimeOriginal", {}).get("value")),
        "description": plain(m.get("ImageDescription", {}).get("value"))[:300],
        "original_size": [ii.get("width"), ii.get("height")],
    }
    try:
        from PIL import Image
        with Image.open(out) as im:
            meta["saved_size"] = list(im.size)
    except Exception as e:  # Pillow missing or an unreadable file: the size is checked by eye instead
        meta["saved_size"] = f"unread: {e}"
    Path(str(out) + ".json").write_text(json.dumps(meta, indent=1, ensure_ascii=False))
    print(f"{out}  {meta['saved_size']}  {meta['license']}  {meta['author'][:50]}")


if __name__ == "__main__":
    a = sys.argv[1:]
    opt = lambda k, d: type(d)(a[a.index(k) + 1]) if k in a else d
    wiki = "en" if opt("--wiki", "commons") == "en" else "commons"
    if not a or a[0] not in ("search", "get"):
        sys.exit(__doc__)
    if a[0] == "search":
        search(a[1], opt("--limit", 8), wiki)
    else:
        get(a[1], a[2], opt("--width", 1800), wiki)
