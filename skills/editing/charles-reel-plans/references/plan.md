# edit/plan.json

The one file the plan lives in. `kit/build.py` turns it into the page, and the editing session reads it to build the reel. Paths are relative to the video folder. Everything is on the 1080×1920 grid; double it for a 2160×3840 export. The frame's zones, the caption line and the pacing and audio limits come from `<skill>/reel-spec.json`.

Contents: The whole file · A beat · Places · Backdrops · A hook · The list block · Timing · Checks · What the kit writes · Collages

## The whole file

| Key | What it is | Default |
| --- | --- | --- |
| `title` | The video's name: the page title, and a list reel's on-screen title | required |
| `format` | `list`, `talk`, or a format folder's name | `talk` |
| `format_name` | How the page names it ("list reel") | `<format> reel` |
| `hook` | The on-screen hook (below) | a list reel's `title` |
| `beats` | One per line he says, in order (below) | required |
| `list` | Only for list reels: the list, the stopwatch and the collage zone (below) | none |
| `captions` | Whether lines get word captions unless a beat says otherwise | `false` for a list reel, else `true` |
| `pace` | How lines are timed before there's a cut (Timing) | `list` for a list reel, else `talk` |
| `caption_y`, `caption_size` | Where captions sit and how big they are | reel-spec.json's `captions.talking_head_centre_y` and `size_px` |
| `eye_line` | His eyes' height, which sets the "above" and "below" boxes | 860 |
| `assets_dir` | The folder holding one folder per asset group | `assets/beats` |
| `composites`, `composites_dir` | A list reel's collage spec and its rendered PNGs | none, `assets/collages` |
| `reading` | One to three sentences on how to read the script, for the README | none |
| `filming` | Notes for filming, one sentence each, for the README | none |
| `music` | `file`, `at` (seconds into the track), `under` (dB under his voice), `why`, `alternatives` (each with `file`, `at`, `why`). The player plays `file` from `at`; the alternatives are for the edit | none |
| `fonts` | `{family: path}` inlined into the page (the stopwatch's Digital7Mono) | none |
| `post` | `handle`, `caption`, `options` (more captions, each `{"label", "text"}`), `comment`, `credit`. The page's Caption section shows each one with Copy, in that order; `credit` is for the README. Every caption and option carries the `ib:` credit line (SKILL.md, step 8). Older plans may have `caption_alt`, a shorter alternative without the credit: the page still shows it, but never write one | none |
| `reference` | `structure` and `structure_title` (the reel copied), `idea`, `idea_title` and `idea_author` (what's credited). Older plans have only this; `references` replaces it on the page | none |
| `references` | Every post, reel, video and page the video came from, in order, for the page's References section. Each is `{"url", "title", "by", "why"}`, plus `"stats"`, `"image"`, `"local"` or `"kind"` when they apply. `why` is what it gave this video, in a sentence ("The structure. The title and subtitle, the list that fills in as he speaks, the stopwatch"). `by` is the name and handle, `stats` the counts with the day they were read ("2.4M views and 28K likes on 16 Nov 2026"), `image` a still in the video folder (a screenshot or a contact sheet, never someone else's video; one that isn't on this computer, like a still of someone else's post that stays local, is left out with a warning), and `local` the folder of one of our own videos. The kit names each link's platform ("X post", "Instagram reel", "TikTok", "YouTube video", or the site's host); `kind` overrides it | the idea and the structure from `reference` |
| `footage`, `reframe` | For the edit: the take's path and its reframe | none |
| `script` | The script file the page's Script section shows, line for line | `SCRIPT.md` |

## A beat

```json
{"say": "iOS seven kills skeuomorphism", "label": "iOS 7 kills skeuomorphism", "number": 2013, "group": "2013",
 "visual": {"place": "under-chin", "src": "assets/collages/2013.png"}}
```

| Key | What it is |
| --- | --- |
| `say` | The words as he says them (charles-scripting-voice). Required |
| `label` | The written form, when it's on screen: a list label, or a short name for the line |
| `number` | A list reel's row number (1-22, or a year). Lines with a number fill the list in order; a line without one, like the sign-off, doesn't |
| `group` | The asset group: its images are in `<assets_dir>/<group>/` and the page shows them as one card, the used ones with their sources (spares stay in SOURCES.md) |
| `visual` | `{"place", "src", "what"}`, where `what` is the title of the asset's card on the page, in plain words for what's on screen (never a file or skill name), plus `"seam"` and `"side"` for a split, or `"rect": [x, y, w, h]` for a fixed box. `src` can be an image or a video. `"long_ok": true` lets a still stay past 3 s (a tweet or code he reads, a complex asset, one he keeps referring to); `"text": true` marks an asset with small text, so it needs 2x pixels. A video plays on the reel's clock from its line's start, pausing and seeking with it, and loops if the line outlasts it; `"loop": false` holds its last frame instead, for a clip timed to its line's words (an explainer card, a 3D cutaway). `"from"` is where in the clip the line starts, in seconds, so one clip runs on across several lines: the next line with the same `src` carries it on without reloading |
| `caption` | `false` for none; a string to caption instead of `say`; or a list of cards, each a string or a list of stacked lines (`[["What's 2027", "gonna look like?"]]`) |
| `captions` | `true` or `false`, overriding the plan's default for this line |
| `caption_y` | Moves this line's captions, when an asset sits at the caption line |
| `pace`, `dur` | This line's pace, or a fixed length in seconds |
| `sfx` | The sound effect on this line, for the edit ("camera shutter as the screenshot lands"). The page lists it and the checks count it |
| `note` | One sentence for the edit: what happens on screen, a filming note |

## Places

The boxes `page.js` draws, from charles-claude-editing's layouts and reel-spec.json's platform zones. The editor uses the same names, and the defaults below are for the spec's numbers as they stand.

| `place` | Box (x, y, w, h) | Use |
| --- | --- | --- |
| `above` | 780 wide, at most 430 tall, centred between the platform's top zone and `eye_line`: (150, 315, 780, 430) by default | sticker-sized, over his head |
| `below` | 780 wide, centred between `eye_line` + 150 and `caption_y` − 40: (150, 1040, 780, 270) by default | sticker-sized and wider than tall, between his chin and the captions |
| `bottom` | 780 wide, centred between `caption_y` + 45 and the platform's bottom zone. It needs 160 px there, so a low `caption_y` leaves no room; the build says how high to set it | under the captions (a big tweet) |
| `spotlight` | 840 wide, from 30 px under the platform's top zone to 90 px above `caption_y`: (120, 230, 840, 1060) by default | centred and seen whole, with him blurred behind. Portrait assets go here |
| `split` | the asset's side of the seam, full width; `seam` 936 (50/50) or 768 (40/60), `side` "top" or "bottom" | another video or a recording. Captions move to the seam, and his face to the other half |
| `screen` | 0, 0, 1080, 1920 | immersive B-roll that replaces him |
| `under-chin` | the list zone plus 40 px on each side, (10, 1110, 1050, 580) by default | a list reel's collage, rendered by `kit/collages.py` |
| `rect` | `rect` as given | anything else, with `fit` "contain" or "cover" |

### Backdrops

What a layout does to everything behind its asset. An asset that covers his face (eyes to mouth) takes the whole reel behind it out of focus: `"backdrop": "blur"` on the visual is charles-claude-editing's overlay with blur, and it blurs his footage and the reel's own layers, the title, list, stopwatch and hook, so only the asset and the captions stay sharp. `spotlight` has it by default; a big `rect` over his face needs it set. An asset that doesn't take the whole screen's attention stays off his face instead. `kit/build.py` fails any visual over his face with no backdrop. Why: with the title and list still crisp over a face that's gone, the blur doesn't read as a layout, and the edit has to blur the same layers the plan blurs.

The page draws a backdrop as one pane over everything below the asset, from the same table `kit/build.py` checks against (`BACKDROP_BY_PLACE` in both, one `.backdrop[data-kind]` rule per kind in `page.css`). When the editing skill's layouts change, change the table and its rule, never a single beat.

## A hook

- A list reel: `{"style": "title", "lines": ["Evolution of Design"], "sub": "(20 years in under {under} seconds)"}`. Helvetica Neue Medium 56 at y 256, the subtitle Regular 40 two px under it, up the whole reel (`size`, `sub_size`, `sub_gap`; the edit's `title_size`, `sub_size` and `sub_gap`). `{under}` becomes the next multiple of 5 s at or above where the list ends.
- A talk reel, only when he asked for a hook: `{"style": "tiktok", "lines": ["I reverse engineered", "Tinder's algorithm"], "until": 3.5}`. Black Helvetica Neue Bold 72 in white boxes, each line its own box, at y 280, or on the seam when the reel opens on a split. It stays up until `until`, by default the end of his first sentence (the first line whose `say` ends in . ? or !), kept to 3-5 s. Two lines at most (charles-claude-editing, Hook Title).

## The list block

```json
"list": {"row0": 372, "pitch": 35, "size": 30, "number_width": 77, "col_gap": 28, "stopwatch": [60, 800],
         "zone": [50, 1150, 1020, 1650], "safe": [70, 950, 1500], "seed": 7}
```

These are the numbers of claude-editing's list renderer (`formats/list/tools/list_reel.py`), with the rows 4 px lower to clear the bigger subtitle.

A list that leads into something else (a tutorial after ten styles) can count down to it: `"countdown": {"until": 10, "label": "Video tutorial in", "hide": true}`. The stopwatch then shows the seconds left until beat `until` starts (beats counted from 0), with `label` in Helvetica Neue Bold `label_size` px (30) over the plate, and with `hide` the title, list and stopwatch leave the screen as that beat starts, for a split or a new screen to take over. Rows run from y 372 every 35 px in two columns, the left one holding half the rows rounded up. The years or numbers show at 60% white from the first frame, each label fills in on its line, and the newest is orange (255, 150, 60). The stopwatch is digital-7 (mono) at 84 px in red (255, 42, 42) on a 246 × 96 plate, and it stops when the last numbered line ends. `zone` is where any collage corner may go. `safe` is what counts as seen: left of x 70 or right of 950 sits under the buttons, and below 1500 under the caption. `seed` is the collage search's.

For the edit, list_reel.py takes `labels` from the beats' labels in order, `title` and `sub` from the hook (with `{under}` filled in), `layout` from this block (`size` is its `list_size`), `collage` from `zone`, `safe`, `seed` and the composites file, and `music` from `music`. Its `title_size`, `sub_size` and `sub_gap` come from the hook's `size`, `sub_size` and `sub_gap`. Write all three into `reel.json` even when the plan leaves them to the kit's defaults (56, 40 and 2), because list_reel.py's own defaults for the subtitle are the older 36 and 8, and the edit would come out smaller than the page shows.

## Timing

Before there's a cut, `kit/build.py` estimates each line:

- `list`: 0.17 s a syllable plus 0.45 s, and at least 0.9 s so a one-word item's card can be read. That reproduces 22 Backgrounds exactly: 22 labels of about 4 syllables in 24.9 s.
- `end`: 0.17 s a syllable plus 0.9 s. A list reel's sign-off, which is read slower and held.
- `talk`: 3.3 words a second, his pace in a finished cut (charles-scripting-voice, step 5). Numbers count as said aloud.

Once the editing session writes `edit/cuts.json`, each line takes its real length, and the page says the times are from the cut. That file is either `[{"s": start, "e": end}]`, one per beat in seconds on the cut, or the cutter spec (`{"phrases": ...}`, what charles-claude-editing cuts the take from), in which case the times come from its result, `edit/work/cut.cuts.json`: each kept line's `cut_start` and `cut_end`, one per beat. The voice is off then, because the cut has his real one.

## Checks

Every build measures the plan against the rules in SKILL.md marked ✓, with reel-spec.json's numbers, and prints what
fails. They are: caption lines longer than `captions.words_per_line`, or of 1 word next to others; captions wider than
the room at their height (inside the side insets, and clear of the button column below its top); a list that runs into
the insets or the button column (the build stops); words TikTok blocks, on screen; one still up past `pacing.max_still_s`
across consecutive lines without `long_ok`; longer than `pacing.max_without_new_s` with nothing new (talk reels);
captions sitting on an asset; an asset over his face (brows to mouth) with nothing blurred behind it; captions on his face
with nothing blurred behind them, where an asset at the caption line may push them up to right under his mouth but never
onto it; "bottom" without room under the captions; an image stretched past its pixels (2x for `screen` kinds and
`"text": true`), or drawn under 240×160 in its box; a hook of more than 2 lines, wider than the insets, or up less than
2.5 s or more than 5.5 s; no music, music outside `audio.music_under_voice_db` under the voice, or (when the repository
has `assets/music/`) a track outside a mood folder; more sound effects a minute than `audio.sfx_per_minute_max`, or more
meme sounds than `audio.meme_sfx_per_reel_max`.

His face, for those checks, is measured from `eye_line`, his eyes' height: brows 70 px above it, lower lip 190 under it,
chin 300 under it, 400 px wide around `face_x` (the medians of the face boxes on 34 of his cuts). `face_y` only moves the
page's stand-in, so when he sits higher or lower, set `eye_line` too.

Captions written by the kit break at the sentence's own commas and full stops first, never end a line on a small word like
"the" or "on" when the next line can take it, and drop commas and full stops at the end of a line. Write `caption` by hand
only where that still reads wrong.

## What the kit writes

- `build/plan.html`: the page, which opens from disk. The player is the reel, a little short of the window's height on a computer; a play bar (tap or space plays and pauses, the arrow keys step through the lines) with full screen at its end (or F); the Safe area and Instagram UI toggles; and the music, with where it starts. Full screen is the browser's own where the page may use it. Where the browser refuses, the player fills the page's window instead, and so it does on an iPhone, which only puts a bare video full screen. Inside claude.ai an automated click got the window version, which proves nothing about a real click. Asset sources show by name ("Wikimedia Commons", "Wayback Machine", "X post"), not by their `source` code. Beside it on a computer and under it on a phone come Script (the `script` file line for line; a line he says lights up while it plays and jumps the reel there), Caption (the `post` captions, each with Copy) and Assets (one card per group or per asset a line shows, in order: a still as the reel shows it, which opens full size, its `what`, its source and licence from `sources.json`; a card jumps the reel to its line) and References (each of `references`: its platform and author, its title linking to it, what it gave this video and its counts; a still, when it has one, opens full size). A section with nothing in it is left out. `?solo&t=12.4` shows only the reel at 1080×1920, paused at 12.4 s, for exporting frames. `&ig=1` and `&safe=1` turn the Instagram UI and the safe area on. `#check` on the link adds a dot after the clock that turns orange while the music plays, and the count of the reel's files in memory. The player loads the music first, then each line's clip or still in the order the reel shows them, two at a time and into memory, where a seek is instant, with the line the reel is on always next. It holds the reel, music and all, behind a small spinner while what it shows hasn't arrived. It never seeks a clip on top of a seek still running, and it cues the next line's clip on its first frame a second before its cut. The sections' thumbnails wait until the reel's files are in. The music comes into memory first and goes in while the reel is paused, so pausing, playing again and jumping to a line never start it over, even on a host that can't serve byte ranges. The music only seeks when it isn't already where the reel is, and the reel never follows it back to the start.
- `build/posters/`: a still of each clip at 70% of its line, transparency kept, for its card.
- `build/music/1-<title>.mp3`: the track cut from `at` to the reel's length, faded out, and normalised to −16 LUFS.
- `build/times.json`: every line's start and length on the reel's clock (estimated, or the cut's), for assets timed to his words.
- `<assets_dir>/SOURCES.md`: every image's source and licence in one table, for the credits.
- `build/site/`: `index.html` with its CSS, script and data inline and no head (the Artifact host adds one), plus `media/` (the reel's images as WebP at the size the player shows, videos as small MP4s, the music, the clips' stills, and each group's images large and as thumbnails) and `files.json`, the list to publish. One publish takes up to 255 files and 64 MB. The kit warns when a site is bigger, and then the rest goes up in further publishes to the same file path. A video visual with `"alpha": true` (a clip with a transparent background, like an explainer card) goes out twice instead, up to 1080 px wide: VP9 with alpha in WebM for Chrome, Edge and Firefox, and HEVC with alpha (an `.mp4` made with macOS's encoder, since artifacts don't serve `.mov`) for Safari and every iOS browser, which can't show WebM's alpha. The player picks the one the browser shows. Both are scaled with premultiplied alpha, so their clear edges don't pick up a dark fringe. Give it the WebM as `src`, since ffmpeg can't read the alpha back out of HEVC.

## Collages

`edit/collages.json`, for a list reel: `[{"group": "2013", "label": "...", "seed": 7, "images": [{"file": "assets/years/2013/1-x.png", "kind": "screen", "scale": 1.0, "top": false, "focus": [0.1, 0.1, 0.9, 0.9]}]}]`, the pick first. `kind` is screen, photo, art, logo or cutout (`references/sourcing.md`). `focus` is the part of the image, as fractions of its width and height, that nothing may lie over: the inner 80% by default, `[0.06, 0.06, 0.94, 0.94]` for the pick, and the whole card for a card of words. Overlaps are 2-7% of the smaller image, so prints only catch each other's edges. Each collage puts its pick on the other side of x 540 from the one before, so changing one group can re-lay every group after it. Re-render only that group (`kit/collages.py . <group>`). If its pick has moved to the other side, try other `seed`s until it's back where it was, and the later collages keep the layouts he's already seen (2016's new image re-laid 2017 to 2024 until its seed went from 11 to 13).
