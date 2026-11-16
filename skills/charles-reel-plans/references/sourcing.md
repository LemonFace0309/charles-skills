# Sourcing the assets

Start `research/ASSET-BRIEF.md` from the template below, and give each sourcing agent that file and its own groups. `videos/evolution-of-design/research/ASSET-BRIEF.md` is a filled-in one: 21 years, four agents, 73 images.

## The brief template

```markdown
# Asset brief: <what the assets are for>

<One paragraph: the video, what each group's assets do on screen (under his chin for 1-2 s, a split for 3 s...), and the
idea source with its link. Say which image in a group is the pick: it shows the line's words. The others are anchors a
viewer recognises at a glance, and they must still be about the subject.>

## His rules for found images (from charles-claude-editing)

- The real thing, not a recreation: the actual site, app, product photo, logo or post. No mock-ups, no stock photos, and no
  AI-generated images unless the AI image is the subject (Théâtre D'opéra Spatial for 2022's "AI art goes mainstream").
- Organic beats polished: a photo someone took of the first iPhone at Macworld beats a studio render.
- Accurate to the date: 2013 is iOS 7 on an iPhone 5s, not iOS 8 on a 6. Check every date.
- Live web pages in dark mode when they have one (capture.py --dark). Archived pages stay as they were.
- Nothing political: no campaign posters, no politicians.
- No watermarks, no black bars, no letterboxing. Crop to the part that tells the story.

## Sizes

<Work out each asset's size at reel scale, then ask for twice that. Under the chin, each image is 280-570 px wide on the
1080 grid, so: screens, photos and art 1400 px or more on the long side, with 800 px as the floor (say so when a pick is
under 1200); logos and icons 1000 px or more, as transparent PNGs; aspect ratio between 0.55 and 1.9, so crop a long page
to its hero instead of the whole scroll. A split's asset fills 1080 × 936 or 1080 × 768, so 2160 px wide.>

## Kinds (recorded per image; collages.py frames each kind its own way)

| kind | what | how it's shown |
| --- | --- | --- |
| `screen` | a UI or web page capture | a soft shadow, no border |
| `photo` | a photograph | a thin white print border and a shadow |
| `art` | a poster, cover, illustration or artwork | a thin white print border |
| `logo` | a transparent logo, wordmark or app icon | on a white card with padding |
| `cutout` | a transparent object (a phone, a console) | a shadow that follows its shape |

## Where things go

- Raw downloads and candidates: `research/raw/<group>/`. It's git-ignored, so keep them local.
- Picks: `<assets_dir>/<group>/<n>-<slug>.<png|jpg|webp>`, with n = 1 for the pick, then 2, 3 and at most 4.
- `<assets_dir>/<group>/sources.json`: a list with one entry per pick, in order:
  `{"file", "kind", "what", "artifact_date", "source", "source_url", "file_page", "license", "author", "notes"}`, where
  `source` is one of `wayback`, `live-capture`, `commons`, `enwiki`, `press`, `own`, `other`.
- Write only inside your own groups' folders. Don't edit the kit, other groups or anything outside this video, and don't commit.

## Tools (run from the video folder)

    python3 -I <kit>/commons.py search "first iPhone Macworld 2007" --limit 8            # Wikimedia Commons
    python3 -I <kit>/commons.py search "iOS 7" --limit 8 --wiki en                       # English Wikipedia (non-free, small)
    python3 -I <kit>/commons.py get "File:Some file.jpg" research/raw/<group>/x.jpg --width 1920
    python3 -I <kit>/capture.py "https://web.archive.org/web/<timestamp>/<url>" research/raw/<group>/x.png --size 1280x800 --wait 10000
    python3 -I <kit>/capture.py "https://github.com/<owner>/<repo>" research/raw/<group>/x.png --dark --size 1280x900
    python3 -I <kit>/capture.py "https://platform.twitter.com/embed/Tweet.html?id=<id>&theme=dark" research/raw/<group>/x.png --dark --size 560x900

- `commons.py get` writes `<file>.json` with the licence and author, and `capture.py` writes `<file>.json` with the URL.
- Wayback: pick a timestamp inside the right year. `https://archive.org/wayback/available?url=<site>&timestamp=<yyyymmdd>`
  returns the closest capture, and capture.py strips the Wayback toolbar itself.
- Any other image download: `curl -sL -A "Mozilla/5.0" -o research/raw/<group>/<name>.<ext> "<image url>"`, then write the
  page URL into a `<name>.<ext>.json` beside it. Download image files only, and never run anything downloaded.
- Crop and convert with Pillow, always as `python3 -I`, with your script kept outside `research/raw/`.
- Look at every pick with the Read tool before keeping it.

Source preference: (1) the real page from the Wayback Machine on the right date, (2) official press images (Apple Newsroom,
Microsoft, Google's blogs), (3) Wikimedia Commons, (4) English Wikipedia's non-free copies, only when nothing better exists,
because they're small, (5) the creator's own page. No Pinterest re-uploads, no wallpaper sites, and nothing behind a login
or paywall.

## The groups

| Group | On screen | 1 (the pick) | Anchors (pick 1-3) |
| --- | --- | --- | --- |
| <group id> | <its label or line> | <what shows the words, and where to look for it> | <recognisable things from the same time, in order of preference> |
```

## Pitfalls the first run hit

- Wikimedia answers 429 (too many requests) even to one agent now and then, and always to original-size requests from several at once. `commons.py` waits and retries up to four times; ask `get` for a standard width such as 1920, since other widths round up to the next standard one anyway (1600 comes back 1920).
- A plain Commons search can return only PDFs. `commons.py search` keeps to images unless the query names a `filetype:`.
- The Wayback Machine served one of four parallel agents a bot-traffic block page. Let only one agent capture from it at a time.
- The Wayback Machine sometimes mixes eras: the October 2013 iOS page loaded an older iOS 6 badge. Crop to the part that's right.
- Apple's marketing images bleed off their edges (the iOS 7 close-up cut the phone in half), which breaks "show assets whole". An archived product page captured at 2x usually has the whole device.
- Some famous artifacts only exist as tiny non-free copies (Doge, The Dress, iBooks' wooden shelf). Swap them for another real artifact from the same time instead of upscaling. A few small ones still read at collage size, like the 530 px Fail Whale.
- Media in `videos/` that was never pulled from Git LFS is a pointer file Pillow can't open. Render the page it came from (the HTML in `gen/` or `page/`) with capture.py, or `git lfs pull --include` the one file.
- Claude in Chrome refuses to return text containing URL query strings, so return media ids or bare paths, not full image URLs.
