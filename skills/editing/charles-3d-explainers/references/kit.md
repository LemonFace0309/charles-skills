# Kit reference

Everything the kit can do, as it is now: the shot contract, `project.json`, every field on `k`, the overlays, the
engine modules, every prop, the command-line tools, and tested snippets for the common jobs. `K` is the skill's
`kit/` folder. Run everything with `bun` and headless Google Chrome. The libraries are pinned in `kit/package.json`, which is
where to check the current versions: as of Nov 2026, three 0.180 and GSAP 3.13. Complete projects to copy:
`examples/noise-cancel/` (a whole 37 s reel, silent; its contact sheet is in `out/`) and `examples/hook-dive/` (a 3.4 s
diving hook).

Contents: [1 Files](#1-files) · [2 Shots](#2-shot-modules) · [3 project.json](#3-projectjson) ·
[4 globals.js](#4-globalsjs) · [5 k](#5-what-a-shot-receives-k) · [6 Overlays](#6-overlays-kui) ·
[7 Camera body](#7-lens-motion-blur-soft-light) · [8 Film stage](#8-film-stage-post) · [9 look](#9-look) ·
[10 glow](#10-glow) · [11 fx](#11-fx) · [12 cam](#12-cam) · [13 util](#13-util) · [14 screens](#14-screens) ([clips](#clips-in-a-shot)) ·
[15 Props](#15-props) · [16 Tools](#16-command-line-tools) · [17 Snippets](#17-snippets-all-rendered-and-checked) ·
[18 Gotchas](#18-gotchas)

Snippets ([17](#17-snippets-all-rendered-and-checked)): 1 label on a moving object · 2 count-up hero · 3 HUD clock ·
4 log-scale zoom across shots · 5 path and pulse · 6 HTML app screen · 7 instanced field with a hero · 8 rack focus ·
9 GSAP timeline · 10 ride along a pulse · 11 function plot · 12 bars · 13 stack and counter · 14 scoreboard ·
15 face dots · 16 headphones on a head · 17 speaker cone · 18 ear canal · 19 model from a prompt · 20 scale bar on a
dive · 21 label that avoids its object · 22 product light · 23 glass hero on a warm horizon · 24 molten surface ·
25 stars, Milky Way, steam and motes · 26 logic gate · 27 SVG rune · 28 radio waves · 29 wave between two objects ·
30 light in a cable · 31 field vectors · 32 carve with light · 33 earbuds out of their case · 34 inside a microwave ·
35 phone turning to glass · 36 pearl hero in a cloud · 37 packets out of a block · 38 die on a board · 39 range
spheres crossing · 40 a thumb presses send · 41 camera up over a planet

## 1. Files

| File | What it is |
|---|---|
| `engine/core.js` | The camera body: each output frame is N sub-frame renders averaged (lens, shutter, pixel and light jitter), then the bokeh fill. `DOF` holds the sampling settings (the bokeh fill, the defocus and motion sample floors). |
| `engine/post.js` | The film stage: transitions, bloom, AgX tone map, grade, vignette, grain, dither. `DEFAULT_POST`. |
| `engine/seq.js` | The editor: loads `project.json`, builds shots, resolves word timings, runs transitions, captions, `window.__seek(t)` and the layout audit (`AUDIT`). |
| `engine/look.js` | Palettes, reflection environments, backdrop (with a warm horizon), light rig, product light, fog, material presets (molten included), noise textures. |
| `engine/glow.js` | Light as information: tubes that draw on (with a white-hot core), line art, pulses, arrows, field vectors, rings, arcs, waves, wave fields, function plots, dimension lines, logic-gate symbols, SVG paths drawn in light, a sweep of light. |
| `engine/fx.js` | Atmosphere: lens-aware dust, stars and the Milky Way (sharp under any lens), volumetric beams, glow sprites, steam, converging motes. |
| `engine/cam.js` | Camera moves: spline paths, orbits, log zooms, push-ins, follow, rack focus, framing helpers, organic drift. |
| `engine/ui.js`, `ui.css` | The type layer (DOM over the canvas): captions, title, hero, HUD, labels, text, doodles, scale bars. Exports the caption logic for tools. |
| `engine/screens.js` | Live HTML/CSS drawn into a texture (app screens on 3D devices). |
| `engine/util.js` | Pure helpers: ramps, keys, easing, monotone curves, seeded random, noise, number formatting. |
| `engine/props/*.js` | Prop factories, all reached as `k.props.*`: `base`, `devices`, `space`, `world`, `science`, `plates`, `charts`, `type`, `model`, `people`, `audio`. |
| `engine/props/model.js` | `model()`: any GLB as a prop (meshopt/Draco, orient, fit, normals, kit materials, anchors, surface points, dots, crop/cut cutaways). |
| `engine/props/people.js` | `head()`, `ear()`, `hand()`, `glasses()`: a sculpted mannequin head, an anatomical ear block with a canal cutaway, a hand in skin holding the kit phone (its thumb presses the screen: `hand.press(p)`), a pair of glasses. |
| `engine/props/audio.js` | `speakerDriver()`, `headphones()`, `microphone()`: procedural, with cutaways and moving parts. |
| `engine/props/charts.js`, `type.js` | 3D data (`bars`, `lineChart`, `donut`, `stack`, `scoreboard`) and extruded 3D type (`extrude`). |
| `render.mjs` | Renders stills, drafts and finals to `out/`. |
| `serve.mjs` | Serves one project for a normal browser (debugging). |
| `new.mjs` | Starts a project from a voiceover (audio, words, `project.json`, `plan.md`). |
| `fal.mjs` | fal.ai client and CLI (Scribe word timings, any endpoint, uploads, price estimates). |
| `sheet.mjs` | Contact sheets, filmstrips and A/B comparisons of a rendered video, with words and shot names. |
| `check.mjs` | Measures pacing and defects of a rendered video (the hook, static runs, stale spans, pops, cuts, dark frames judged by each shot's `tone`, caption flicker and dangling words). |
| `plate.mjs` | Makes an AI still plus depth map for `k.props.plate()` (see `references/plates.md`). |
| `model.mjs` | Prompt (or image, or GLB) to a cleaned, compressed GLB and a preview still, through fal. |
| `clip.mjs` | Character beats: a short AI video clip of a person, from a first frame in the kit's look, graded to the palette (`references/characters.md`). |
| `clips/clip.js` | A clip's frames as a time-pure texture in a shot (`k.clip`): on a device screen or as a full-frame plate. |
| `models/` | Baked GLBs for people.js (`head.glb`, `hand.glb`) and `NOTICE.md` (how each was made, license). `hand.glb` is baked from the raw sculpt `hand-sculpt.glb` by `bake-hand.mjs` (finger lengths and thicknesses, nail plates, skin masks, the thumb's press rig): `bun K/models/bake-hand.mjs`. |
| `fonts/*.typeface.json`, `fonts/typeface.mjs` | Glyph outlines (three.js typeface format, font units), pair kerning, tabular figures and metrics of Inter 700/800 and Barlow Condensed 700, for 3D type (`props/type.js`), and the converter that makes them from the OFL fonts in `node_modules/@fontsource` (licences next to them). |

## 2. Shot modules

```js
// shots/03-orbit.js
export default async function (k) {
  // build: runs once. Make every object, material and overlay here.
  const ring = k.glow.ring(1.6, { color: k.pal.accent });
  k.scene.add(ring);
  return (t, ft) => {
    // update: shot-local seconds. Set the whole scene for that instant.
    ring.draw(k.ramp(t, k.word('orbit') - 0.1, k.word('orbit') + 0.8));
  };
}
```

- `t` is seconds from the shot's `start`. It runs from `-in.dur / 2` (while this shot transitions in) to
  `dur + next.in.dur / 2` (while the next one transitions in), so start camera keys a little before 0 and end them
  after `k.dur`.
- **Purity rule.** `update(t, ft)` runs at the frame time, then once per sub-frame (16 times a frame by default) at
  times up to half a shutter either side of the frame (±1/120 s at 30 fps), in any order, and again at the exact
  frame time. `ft` is the output frame's time, the same for every sub-frame of a frame: set in-world text and counters
  from it (set from `t`, they would show a blend of several values in one frame). Shots and props must be pure
  functions of `t`:
  - no `Math.random()` (use `k.rng(seed)` at build time), no `Date`, `performance.now()` or `requestAnimationFrame`;
  - no accumulated state (`x += v * dt`, toggles, "if first frame"); compute every value from `t`;
  - GSAP only through `k.tl` (paused, seeked to `t` every sub-frame), never `gsap.to()` on the global ticker;
  - setters such as `.draw(p)`, `.at(t)`, `.setOpen(p)` overwrite state, so call them every update.
- **Build everything up front.** When build returns, seq.js sets the resolution of `Line2` materials, the point scale of
  dust and stars (`uRes`: sprite sizes then follow the live fov), registers lens-aware materials and sky layers
  (`uSkew`, [7](#7-lens-motion-blur-soft-light)) and sets texture anisotropy, but only for objects already in the scene. Objects or materials created later miss this. Hide things
  with `visible = false` instead of adding them late.
- **Lifetime.** A shot is built the first time it is needed and compiled on the GPU. At most 6 shots stay alive; the
  least recently used is disposed (with its overlays and `k.screen` canvases) and rebuilt if needed again. Anything
  flagged `userData.shared = true` (module-level caches such as `look.environment`, the props' generated textures and
  the rack faces) or still used by another live shot is kept: flag your own module-level caches the same way. A
  project with no shots previews as black with its captions and title. Build errors and missing words (`k.word`) are
  collected and printed by `render.mjs`.
- **Default camera:** `PerspectiveCamera(35, W / H, 0.05, 3000)` at `(0, 1, 8)` looking at the origin. The engine
  calls `updateProjectionMatrix()` after every update, so setting `camera.fov` or `camera.near` in update just works.

## 3. project.json

| Key | Default | Meaning |
|---|---|---|
| `size` | `[1080, 1920]` | Output pixels. Overlay coordinates are in these pixels. |
| `fps` | `30` | Frame rate. |
| `samples` | `16` | Sub-frames per final frame (lens, motion blur, AA, soft shadows). `--draft` uses 1. Strong defocus and fast motion raise a shot's count ([7](#7-lens-motion-blur-soft-light)). |
| `shutter` | `0.5` | Shutter as a fraction of the frame interval (0.5 = 180°). |
| `palette` | `'night-amber'` | One palette for the whole video ([9](#9-look)). |
| `accent` | palette's | Overrides the palette's accent (pills, `k.pal.accent`, and every prop and glow colour that defaults to the accent). |
| `words` | none | Word timings: Scribe JSON `{words:[{text,start,end,type}]}` or `[{text,start,end}]`. |
| `audio` | none | Voiceover muxed by `render.mjs` (cut to `--from/--to`, padded with silence to the video's length). Absent: silent video. |
| `duration` | last word end + 0.6 (10 with no words) | Length in seconds. |
| `fadeIn`, `fadeOut` | `0` | Seconds of fade from / to `post.fadeColor` (black). The overlays fade with the picture. |
| `cutOut` | none | A cutaway's out point in project time (the edit's out point minus `--from`): where the reel cuts back to the face. The render runs on through the handle after it, which never shows. Sets `k.out` for the shot it falls in, and check.mjs warns when the camera still travels there. |
| `post` | `{}` | Film-stage overrides for the whole video ([8](#8-film-stage-post)). |
| `dof` | `{}` | Sampling quality for the whole video: `{ fill: 2, spacing: 20, maxAuto: 64, maxMotion: 96, motionSpacing: 2 }` ([7](#7-lens-motion-blur-soft-light)). `maxAuto: 0` turns off the depth-of-field sample floor, `maxMotion: 0` the motion floor. |
| `captions` | on | Caption settings, below. `{ "enabled": false }` turns them off. |
| `title` | none | Hook title: `{ html, at: 0, until: 3, y, size, style }`. Every key but `html` goes to `ui.title` as written, so `style: 'cond'` (condensed capitals in the accent) works from here; markup and the `y` and `size` defaults in [6](#6-overlays-kui). |
| `globals` | none | A module with overlays that span shots ([4](#4-globalsjs)). |
| `shots` | `[]` | The shot list, below. |
| `source` | | Written by `new.mjs` (where the audio was cut from). Not read by the engine. |

**`shots[]`**: `{ id, file, start, end?, in?, params?, tone? }`. Sorted by `start`; each shot ends where the next begins
(`end` is rarely needed: in a gap the next shot shows early). `params` arrives as `k.params`, so one shot file can
serve several rows. `tone` names the kind of world the shot shows, so `render.mjs --stills` judges its tone against the
right range ([16](#16-command-line-tools)): `'night'`, `'space'`, `'screen'` (a photo or data filling the frame),
`'warm'` (a product shot, a warm interior), `'hot'` (a frame-filling melt, fire or sun) or `'midkey'`. Without it the palette decides: `space` > space;
`studio-cool`, `studio-light`, `dusk` > midkey; the rest night.

**`in` (transition into this shot).** A string is shorthand for `{ type }`. Without `dur`, each type has its own
default: `fade` 0.4, `dip` 0.4, `zoom` 0.6, `whip` 0.4, `light` 0.5 s; an unknown type logs an error. The transition
is centred on `start` (from `start - dur/2` to `start + dur/2`); both shots render during it (double cost), their
overlays hand over (below), and their `post` settings blend. Blending happens in linear HDR before bloom.

| `type` | Effect | Options |
|---|---|---|
| `cut` | Hard cut (default). | `dur` is forced to 0. |
| `fade` | Crossfade in linear light. | `dur` |
| `dip` | Through a colour and back. | `color`: `[r, g, b]` in linear scene light, or a hex / CSS colour (sRGB, made linear). Default black. Through the tone map `'#ffffff'` reads light grey; `[8, 8, 8]` reads white. |
| `zoom` | A rushes at the camera with a radial smear, B lands from slightly small. Scale journeys. `out: true` pulls back instead: A shrinks away into the distance while B lands from slightly large (the step back out to the big picture). | `dur`, `out` |
| `whip` | Whip pan: both shots smear along `dir` (64 taps, jittered per pixel; the frame's edges mirror instead of wrapping). | `dir: [x, y]`, default `[1, 0]` |
| `light` | A flare bursts from the light source's screen point and carries the cut: a white-hot core, a soft halo and a thin horizontal streak in the flare colour, the picture brightening around it, the bloom swelling (+0.2 at the middle). The corners stay dark. At most once per 20 s. | `dur`; `at: [x, y]`: the source's screen position as fractions of the frame, **y from the top** (`[k.project(p).x / k.W, k.project(p).y / k.H]` of the light), default `[0.5, 0.45]`; `color`: the flare, default the accent taken 30% towards white (`[r, g, b]` linear or a hex / CSS colour). |

`dir`, `color`, `at` and `out` are reset for every transition, so one that leaves them out gets the defaults.

During a `whip`, `zoom` or `light`, the outgoing shot's overlays (heroes, labels, HUDs, text owned by the shot) leave
in the first third of the transition and the incoming shot's arrive in the last third, so no type rides the smear.
A `fade` or `dip` blends both shots' overlays with the picture. Captions, `project.title` and `globals.js` overlays
belong to no shot and are not touched.

**`captions`**

| Key | Default | Meaning |
|---|---|---|
| `enabled` | `true` | `false` turns captions off (also `--no-captions`). |
| `highlight` | `[]` | Words or phrases to mark: `"Pacific"`, `"200,000 kilometers"`, or `{ match, style: 'pill' \| 'text', all: false, color, ink }`. `pill` = a pill that grows on the word, its ink colour following the pill's edge; `text` = the colour sweeps across the letters. `color`: the colour that thing has in the world (look.md), any CSS colour (default the palette's accent). `ink`: the letters on the pill (with a `color`, `#121311` on a light colour and `#ffffff` on a dark one, whichever contrasts more; without one, the palette's `ink`). Every occurrence unless `all: false`. A highlighted phrase always stays in one chunk. A phrase that is nowhere in the words logs a warning. |
| `numbers` | off | `'pill'` or `'text'`: mark every word containing a digit that is not already marked. |
| `replace` | `{}` | Display text per word: `{ "kilometers": "km", "one.": "1." }`. Keys match the word as written, lower-cased, or normalised. Matching for highlights still uses the spoken words. |
| `mode` | `'chunk'` | `'chunk'` shows the whole chunk; `'build'` reveals words as they are spoken. |
| `trailing` | `'drop'` | A voiceover cut off mid-sentence ends on a word that leans on one never said ("...your song. But"): it is left uncaptioned, since alone it would flicker and dangle. `'keep'` captions it. |
| `leadIn` | `0.8` | When the first word starts within this many seconds, the first chunk is fully up from frame 0 (no fade), so the hook frame has its caption. |
| `maxWords`, `maxChars`, `gap` | `4`, `24`, `0.32` | Chunk size: the target length (one line is about 28 characters at 66 px) and the pause, in seconds, that a chunk should not span. Soft limits: a chunk goes over them to keep a phrase whole or to stay on screen `minDur`, up to `maxWords + 2` words and `maxChars + 10` characters (`+ 12` with a highlighted phrase in it): two balanced lines at most. |
| `minDur` | `0.7` | Shortest time a chunk stays on screen. A shorter one merges with a neighbour in its sentence whenever the size caps allow (check.mjs's `flicker` line lists the ones they do not). |
| `bottom` | `450` | Pixels from the bottom edge to the caption's bottom; one line is centred at y ~1432. Other sizes: `450 * H / 1920`. The caption shade (`post.captionShade`, [8](#8-film-stage-post)) moves with it. |
| `size` | `66` | Font size, px (Inter 700). Other sizes: `66 * W / 1080`. |

Captions come from the words. Of all the ways to split the voiceover, the kit takes the one with the lowest total cost
(dynamic programming over the whole voiceover), so each rule is weighed against the others:

- Never: a highlighted phrase split across two chunks.
- Only when nothing else works: a chunk that ends on a word leaning on the next one (an article, preposition,
  conjunction, possessive, demonstrative before its noun, auxiliary, `it`, a subject pronoun, `not`, or a contraction
  or possessive such as "let's", "doesn't", "mom's"), a break inside a capitalised run that does not start a sentence
  ("Los Angeles"), a break between a number and the word after it ("200,000 kilometers", "one hundred billion",
  "8 billion light-years"; not before a leaning word: "billion | of these" may break), a chunk across a sentence end,
  a chunk over the size caps.
- Strongly avoided: a chunk on screen under `minDur`.
- Avoided: a comma inside a chunk (more so when the chunk carries the tail of the clause before it, or starts the next
  clause and cuts it), a pause over `gap` inside, one word alone, an acronym cut from its noun ("GPS | satellite"), two
  highlights in one chunk, uneven sizes (a 5-word sentence splits 3 + 2 and a 6-word one 3 + 3, never 4 + 1), a break
  before "of" ("grain | of sand").

`replace` counts too: a word replaced by `""` is no word and no character. A chunk stays under `minDur` only where the
caps force it: a clause too long for one chunk said too fast for two ("In the time it took for you to blink," is
8 words in 1.2 s).

A chunk is on screen from 0.06 s before its first word until 0.06 s before the next chunk, or 0.45 s after its last
word when the next one is 0.7 s or more away; the first one from frame 0 under `leadIn`. Word matching everywhere
(`highlight`, `k.word`, `g.word`) ignores case and every character except letters, digits, `%`, `$` and inner dots:
`k.word('200,000')` finds "200,000", `k.word('later')` finds "later.", and `"Los Angeles"` matches two words in a row
(`k.word`, `k.gword` and `g.word` try the exact spelling, case and punctuation included, before these rules,
[5](#5-what-a-shot-receives-k)). Where the normalised words miss, a looser match is tried at the same word:

- A number is the same written in digits or in words: "30,000" = "thirty thousand", "80" = "eighty", "1,000,000" =
  "a million", "80%" = "eighty percent", "2,501" = "twenty-five hundred and one". A spoken number ends at punctuation.
- US and UK spellings are the same: colour, cancelling, centre, optimise, analyse, catalogue, grey.
- Accents and hyphens are ignored: "noise canceling" finds "Noise-cancelling".

Occurrences count in time order, whichever way they were written. A phrase that is nowhere in the words logs one
warning (`"…" is not in the words …`).

`engine/ui.js` exports the caption logic for tools, so nothing times captions its own way (`sheet.mjs` and
`check.mjs` use these; so should any other tool, not `chunkWords`):

| Export | Returns |
|---|---|
| `captionChunks(words, cfg)` | `{ chunks, marks }`: the chunks (arrays of word objects) exactly as the captions show them, and the highlighted words (`word -> { style, first, color, ink }`). |
| `captionTimes(chunks, cfg)` | `[[start, end], ...]` in seconds, as the captions show them (`start` is `-1` for a first chunk held from frame 0 by `leadIn`). |
| `leans(text, next)` | `true` when a chunk ending on the word `text`, before the word `next`, leaves it dangling (check.mjs's `dangling` line uses it, so it flags exactly what the chunker avoids; "of these \| can fit" is fine: `these` is a pronoun there). |
| `inkOn(color)` | `'#121311'` or `'#ffffff'`, the ink for a pill of that colour (hex and `rgb()` anywhere; any CSS colour in the page; `null` when it cannot tell). |

**URL parameters** (`kit/engine/index.html?p=/p/&scale=0.5&samples=1&fps=30&captions=0`, plus `&fill=0&autosamples=0`
for a sampling A/B: `autosamples=0` turns off both automatic floors): `render.mjs` sets these; use them with
`serve.mjs`.

## 4. globals.js

`export default (g) => { ... }`, run once at load. For overlays that span shots (a running clock, a counter). Times
are global seconds.

| `g.` | |
|---|---|
| `ui.title / hero / hud / text / scaleBar` | Same as `k.ui.*` ([6](#6-overlays-kui)) but global times (a scale bar's step times too). No `label` (it needs a shot camera) and no `doodle`. |
| `word(phrase, nth = 0)`, `wordEnd(...)` | Global start / end of a phrase over the whole voiceover (the exact spelling first, then a loose match, [3](#3-projectjson)); `nth` counts from 0. A miss returns 0 and logs an error, like `k.word`. |
| `gword(phrase, nth = 0)` | Same as `g.word` (the name shots use for a whole-voiceover lookup). |
| `words` | All words `{ text, start, end, n }`. |
| `pal` | The palette. |
| `U` and every util | `g.ramp`, `g.keys`, `g.fmtNum`, ... ([13](#13-util)) |

## 5. What a shot receives (`k`)

| Time and words | |
|---|---|
| `k.start`, `k.end`, `k.dur` | The shot's global start and end, and its length. |
| `k.out` | Shot time when the shot is last seen: `k.dur`, or the cutaway's out point (`cutOut`) when that comes first. A move that ends on a hard cut or on the out point lands by `k.out - 0.2`; key a move to `k.dur + 0.3` only into a whip or a zoom, which carries it. In a cutaway the last shot's `k.dur` runs 0.5 s past the out point, into the handle. |
| `k.word(phrase, nth = 0)` | Shot-local start of a phrase (exact or loose match, [3](#3-projectjson)). Searched inside the shot first (the exact spelling, case and punctuation included, then a loose match), then 1 s either side of it. A hit outside the shot logs a warning in the render log with how far outside it is and where the exact spelling is (`k.word("AND") in shot gate matched "and" at 33.52 s, 0.40 s before the shot (…); exact "AND" at 35.74 s`). `nth` counts from 0 among the matches in the span searched. Time common words by two-word phrases (`'AND gate'`, `'At zero'`). Missing: returns 0 and logs an error. Each lookup is resolved once and cached, so calling it inside update costs nothing and warns once. |
| `k.wordEnd(phrase, nth = 0)` | Shot-local end of the phrase's last word, found as `k.word` finds it. |
| `k.gword(phrase, nth = 0)`, `k.gwordEnd(...)` | The whole voiceover (`nth` counts from 0 from its start), returned in shot-local seconds (negative before the shot): for one world built across several shot rows, or a word said in another shot. `k.wordGlobal` / `k.wordEndGlobal` are the same. |
| `k.words()` | Words starting in this shot, shot-local times. |
| `k.id`, `k.params` | The shot's id and its `params` from `project.json`. |
| `k.tl` | A paused GSAP timeline seeked to `t` every sub-frame: `k.tl.to(obj, { x: 1, duration: 0.6 }, k.word('up'))`. |

Every resolved `k.word`, `k.gword` and `g.word` is logged once to `window.__wordLog` as `{ shot, phrase, nth, t, text }`
(`t` in global seconds; `which: 'end'` for an end); `render.mjs` writes it to `out/<name>.log.json` as `words`, and
`check.mjs` lists a pop from 0.35 s before to 0.1 s after one of those times as planned, and every step and the
landing of a count-up (`k.ui.hero` with `count` logs its span).

| Scene | |
|---|---|
| `k.scene`, `k.camera`, `k.renderer` | three.js scene, `PerspectiveCamera`, `WebGLRenderer`. |
| `k.W`, `k.H`, `k.aspect`, `k.fps` | Output size (`project.size`), aspect, frame rate. |
| `k.pal` | The palette (`accent`, `glow`, `ink`, `text`, `bg`, `fog`, `env`, `key`, `rim`, `fill`, `post`). |
| `k.env(kind = pal.env, intensity = 1, o)` | Sets `scene.environment` (reflections): `'studio'`, `'night'`, `'sunset'`, `'space'`, `'orbit'`, `'room'`. `'orbit'` takes `o = { sun: [x, y, z], earth: [x, y, z] }` directions (the sun defaults to the `k.rig()` key light's). |
| `k.backdrop({ glow, glowColor, glowPos, radius, horizon })` | Gradient sky sphere in the palette, with an optional soft glow behind the subject (in the palette's `haze`, else its `glow`) and an optional warm horizon band behind everything ([9](#9-look)). Returns the mesh, with `setGlow(v)` and `setHorizon(v)`. |
| `k.fog(scale = 1)` | Exponential fog in the palette (none for `space`). |
| `k.rig({ keyPos, rimPos, target, shadows, shadowSize, keyScale, rimScale, fillScale, soft = 0.6 })` | Key (shadowed), rim and hemisphere fill. `soft` = key light radius for soft shadows (0 = hard). Returns `{ key, rim, fill }`. |
| `k.softLight(light, radius = 0.5)` | Adds another light to area sampling (soft shadows). |
| `k.lens` | `{ blur, focus, aperture, fill, autoSamples }`, read every sub-frame ([7](#7-lens-motion-blur-soft-light)). |
| `k.motionBlur` | Shutter multiplier for this shot (default 1, 0 = off). |
| `k.motionProbes` | Objects whose screen speed sets the motion sample floor ([7](#7-lens-motion-blur-soft-light)) besides the focus point: `k.motionProbes.push(padlock)` (an `Object3D`, a `Vector3` or `[x, y, z]`). Assigning an object or a list of objects also works (`k.motionProbes = [lock, key]`). The floor sums each probe's path across the shutter (five instants), so a probe on a part that swings back inside it (an atom of a molecule twisting at 60 Hz) still raises the samples. |
| `k.samples` | This shot's base sub-frames (default the project's): `k.samples = 48`. The automatic floors in [7](#7-lens-motion-blur-soft-light) can still raise it; drafts stay at 1. |
| `k.post` | Film-stage overrides for this shot ([8](#8-film-stage-post)). Set in build, or in update for an animated grade (the value after the frame's last update wins). |
| `k.project(v)` | World point (`Vector3` or `[x, y, z]`) to overlay pixels: `{ x, y, behind }`. |

| Assets | |
|---|---|
| `k.asset(rel)` | URL of a project file (`k.asset('assets/photo.png')`). |
| `k.image(rel, { srgb })` | `Promise<Texture>` from a project path or URL. |
| `k.imagePlane(rel, { width, glow, radius, transparent, side, tonemap, look, highlights })` | `Promise<Mesh>`: an image on a plane, height from its aspect. `tonemap: 'inverse'` shows a photo as it is in its file ([15 base](#base)). |
| `k.screen({ w, h, html, css, file, background })` | `Promise<screen>`: live HTML as a texture ([14](#14-screens)). |
| `k.clip(rel, { at, speed, loop, from, keep })` | `Promise<clip>`: the frames `clip.mjs --frames` wrote to `rel` (`'assets/clips/plane'`) as a texture that shows frame `floor((t - at) * fps * speed + from * fps)` for each output frame, loaded before the frame's sub-renders ([Clips in a shot](#clips-in-a-shot)). |
| `k.font(spec, text = 'Aδ')` | `Promise`: loads a face the engine does not preload, before canvas text is drawn with it: `await k.font('italic 400 40px Inter')`. |
| `k.kit(rel)` | URL of a kit file (`k.kit('textures/earth/earth_day_4096.jpg')`). |

| Namespaces | |
|---|---|
| `k.THREE`, `k.gsap` | The libraries. Addons import as `'three/addons/...'` in a shot file. |
| `k.look`, `k.mat` | [9](#9-look) (`k.mat` = `k.look.mat`). |
| `k.glow`, `k.fx`, `k.cam` | [10](#10-glow), [11](#11-fx), [12](#12-cam). |
| `k.props` | [15](#15-props). |
| `k.ui` | [6](#6-overlays-kui), shot-local times, owned by the shot (they fade or hand over with its transitions, [3](#3-projectjson)). `k.ui.scaleBar(o)` takes shot-local `at`, `until` and step times. |
| `k.U` and every util spread on `k` | `k.ramp`, `k.keys`, `k.pulse`, `k.ease`, `k.rng`, `k.lerp`, `k.clamp`, ... ([13](#13-util)) |

## 6. Overlays (`k.ui`)

DOM elements over the canvas, laid out in project pixels (y from the top). Every default below is for 1080 x 1920.
For other sizes, type and x defaults scale by `W / 1080` (an asset is shown at reel width, so its type keeps its
phone size) and y defaults by `H / 1920`, and the default side margin (the HUD's `x`, an aligned hero) is at least
60 px, the slot asset's safe edge. Explicit `x`, `y`, `size` and `offset` values are always project pixels.
Times are shot-local in `k.ui`, global in `g.ui` and `project.title`. Layers, back to front: labels,
hero/text/doodle/scale bar, title, HUD, captions. Elements rise, fade and de-blur in from `at`, and fade and lift out
after `until` (`null` = to the end of the shot, or of the video in `globals.js`). An element whose `at` is at or before
global time 0 is fully on from the first frame (the hook). Content strings are HTML.

| Element | Options (defaults) |
|---|---|
| `title(html, o)` | `at 0`, `until null`, `y 250` (top of the first line's box; its caps start about 0.14 em lower), `size` (none: the longest headline line fills 880 px wide at 64 to 140 px, or in the condensed style 900 px at 90 to 160 px, measured once the fonts are loaded; `((sub-lines))` are left out of the measure), `style` (none, or `'cond'`; any other value warns and draws the default), `inDur 0.45`, `outDur 0.35`. Markup: `[[pill]]` (1.25 em tall, 0.24 em side padding; never breaks, so a pill that crosses a `\n` moves whole to the start of a new line), `{{accent text}}`, `\n` new line, `((small line))` (0.45 em, 40 px at least). Lines stagger in 0.07 s apart. Inter 800, centred, line pitch 1.0, at most 940 px wide. **`style: 'cond'`** (look.md's condensed headline): Barlow Condensed 800 capitals in the accent with a 0.12 em glow, line pitch 0.95; the sub-line in white Inter 600 at 0.32 em (40 px at least); `{{…}}` turns white (the rest is already the accent); a pill stays the accent with ink letters, centred on the capitals. Also `project.json` `title.style`. |
| `hero(content, o)` | `at`, `until`, `y 300` (top), `size` (none: `min(300, 900 / (0.6 * glyphs + 0.3 * separators))` from the longest text it will show, with the unit counted at 0.4 em and condensed digits at 0.8; "30,000" → 273 px, "1 in 1,000,000" → 125, "80" + `dB` → 300), `unit` (0.4 em, after the value, 0.1 em gap), `sub` (HTML line below, 0.3 em clamped to 40 to 64 px), `count`, `cond` (Barlow Condensed), `color`, `align 'center'` (`'left'` / `'right'`: 40 px in from that side), `x` (left edge), `inDur 0.4`, `outDur 0.3`. `content`: HTML, or `(t) => html` (shot-local `t`). Spans `<span class="acc">` (accent) and `<span class="dim">` (45%) work inside. |
| `hero` `count` | `{ range: [from, to] \| from, to, at (default the hero's at), dur 1.1, ease 'outExpo', decimals 0, pad 0, comma true, prefix, suffix }`. Replaces `content`. |
| `hud(o)` | `value: (t) => number`, `format (v) => string` (default `fmtNum`), `unit` (0.4 em, 36 px at least), `sub` (white Inter 600, 0.3 em, 40 px at least), `at`, `until`, `x` (right edge of the whole counter, unit included; default 1040), `y 250` (digit tops at ~267), `align 'right'` \| `'left'` (`x` = left edge, default 40) \| `'center'`, `size 88`, `color` (default the palette's `hud`, else `#77d9fc`). Barlow Condensed 700, tabular digits, soft glow. |
| `label(html, o)` | `anchor` (an `Object3D`, a world `Vector3`, or `(t) => Vector3`; anything else throws), `offset` px from the anchor to the text's near edge (default `[36, -36]`: up and to the right; `[120, -90]` with a line), `side` (none, or `'right'`, `'left'`, `'above'`, `'below'`, `'auto'`), `avoid` (none, or an `Object3D`, a world `Box3`, or a list of them), `gap 30` (px from the `avoid` box to the text), `size 46` (the `sub` line is 0.74 x, 34 px at least), `at`, `until`, `sub`, `style 'plain' \| 'card' \| 'tag'`, `dot true` (an 8 px glowing dot on the point), `line false` (a 2 px leader line, ending 10 px from the text; look.md: rare, only when the anchor would be ambiguous). Follows the anchor every frame; hidden while it is behind the camera. With no `side` and no `avoid`: the text sits right of the offset point when `offset[0] >= 0`, else left, centred vertically on it, and slides back inside the frame when it would run off the side. With `side`: the text goes on that side of the anchor (`offset`'s distances). With `avoid`: on that side of the object's box, `gap` px out, level with the anchor; the box is the union of every visible mesh's and line's own bounding box, projected every frame, so the text never covers the object as it turns or the camera moves. `side` defaults to `'auto'` with `avoid`: the first of right, left, above that has room and covers no type on screen (hero, title, HUD, text, doodles, scale bars), then below; else the first of right, left, above with room; else the roomiest of them. Text placed by `side` stays 60 px inside the frame and, in a reel, between y 200 and 1300 (clear of the caption band). The dot stays on the anchor. |
| `text(html, o)` | `at`, `until`, `x 540` (W/2), `y 960` (H/2, top), `size 48`, `weight 700`, `align 'center'` (`x` is the centre; the right edge for `'right'`, the left edge for `'left'`), `width 900`, `cls`, `color`. |
| `doodle(svg, o)` | SVG markup that draws itself on: `at`, `until`, `dur 0.6` (look.md: each element draws on in 0.3 to 0.8 s; give each element its own doodle on its word), `x 540` (centre), `y 760` (top), `width 520`, `color '#d6d5ca'` (warm off-white), `stroke 5` (screen px, whatever the viewBox), `wobble 1` (a slight hand-drawn wobble, about ±1.5 px in waves about 90 px long, fixed by `seed 1`; `0` = clean geometry), `glow true`. Strokes draw in document order with round caps and joins; fills are removed. |
| `scaleBar(o)` | A scale bar for a zoom journey: its length written above a white bar with end ticks, stepping down an order of magnitude on each zoom word. `steps: [[t, label, px], ...]` (required; shot-local seconds in `k.ui`, global in `g.ui`): from each step's `t` the bar eases to `px` wide (layout px) and the label crossfades (the old one lifts out as the new one rises in), over 0.25 s. `x 540` (the bar's centre) with `align 'center'`, or `align 'left'` with `x 150` (its left end: the microscope corner, at about `y: 1265`), `y 1200` (the bar's centre line), `size 42` (the label, Inter 700, tabular digits), `stroke 4` (the bar's thickness; 14 px end ticks), `at` (it enters at its first step, or at `at` if later), `until`. Draws on from the centre (or the left end) in 0.35 s; fades and lifts out after `until`. Steps are sorted by time, so a `k.word` that matches an earlier word moves its step first. |

Captions come from `project.json` (Inter 700 66 px, centred, at most 900 px wide; one line centred at y ~1432). A
chunk fades in over 0.12 s with no slide. A highlight pill is 1.12 em tall with a 0.18 em radius. Its 0.22 em side
padding is reserved from the start, so the line never reflows, and a -0.1 em margin takes half of it back: before the
pill grows, the gap before the phrase is about 1.5 spaces, not 2. The 'text' style reserves nothing and keeps plain
spaces. The pill grows from 0.04 s before its word to 0.16 s after, and the ink colour follows its edge exactly. The
'text' style sweeps the colour the same way. A highlight's `color` and `ink` arrive on its span as `--accent` and
`--ink`. Each factory returns an item; there is nothing to call in update.

**Layout audit.** `render.mjs --audit` (and `window.__audit(t)`) lists overlay boxes closer than 40 px to a side,
above y 200 (the HUD is allowed there), below `H - 380` (the Reels caption band), or overlapping each other. At any
size other than 1080 x 1920 the bands are not used: it lists boxes closer than 60 px to any edge (the HUD's and an
aligned hero's default side margin is 60 px there). Caption and hero boxes fit their text, a title is measured line
by line, and an overlap leaves out 0.1 em of empty leading at the top and bottom of each box, so a short caption, a
narrow number, a label beside a short title line or type stacked at a 1.0 line pitch does not "collide" with its
neighbour. A wide hero (about 900 px) at its default height does collide with a corner HUD, which is a real issue:
with a HUD on screen, put a wide hero at `y: 400` or lower.

It also reads the 3D picture under the type. The 3D canvas is drawn once into a quarter-size probe (whatever the
render scale), and every visible box counts its share of bright pixels:

- a caption with more than 2% of its box above luma 120 (`cap "…" sits on bright 3D (11% of its box above luma 120,
  over the 2% allowed a caption)`): a glowing line, edge or subject runs through the caption band while a caption is
  up. Keep the band to dark, defocused world, or shade it: `post.captionShade` ([8](#8-film-stage-post)) darkens the
  3D picture under the band in the film stage, so the audit (which reads the finished picture) sees it;
- a hero or title with more than 10% of its box above luma 150, or a label with more than 20% (`lbl "…" sits on the
  subject (24% of its box above luma 150, over the 20% allowed a label)`; a label beside a lit city or on a lit panel
  catches 10 to 20% of the light around its subject, and is fine): put it beside the subject (`label({ avoid })`).

Every line names the threshold it used. And it lists a label that is due (between its `at` and `until`, its shot on
screen) while its anchor is off the frame or behind the camera (`lbl "Radio waves" is due but its anchor is off-screen
(x -501, y 699)`): end it with `until`, or keep its anchor framed. The thresholds are `AUDIT` in `engine/seq.js`
(`{ cap: 0.02, capLuma: 120, subject: 0.10, label: 0.20, subjectLuma: 150 }`).

## 7. Lens, motion blur, soft light

Each output frame averages `samples` renders. Per sample the engine moves the lens across its aperture (depth of
field with round bokeh), the shutter across `shutter / fps` (motion blur), the pixel grid (anti-aliasing) and every
soft light across its disk (soft shadows). Drafts render 1 sample: no depth of field, motion blur or soft shadows,
so check those on `--samples 16` stills.

| `k.lens` key | Meaning |
|---|---|
| `blur` | Aperture as a fraction of the focus distance: 0.006 hint, 0.01 subtle, 0.02 cinematic, 0.04 macro. Scale-free: the look holds when the camera moves in or out. |
| `aperture` | The same in world units (used when `blur` is absent). Default 0. |
| `focus` | A distance (number), a world `Vector3` or `[x, y, z]`, an `Object3D` (its world position) or `(ts) => any of these`; `cam.rack()` makes such a function for a rack focus. Measured along the view axis. Default 8. |
| `fill` | Bokeh fill strength for this shot. Default the project's `dof.fill` (2); 0 turns it off. |
| `autoSamples` | `false` keeps this shot at `k.samples`: no automatic floor for strong defocus or for fast motion. |

- Set `k.lens = { ... }` inside update to follow a moving subject; it is read per sub-frame.
- **Strong defocus and fast motion are handled automatically.** N lens samples leave N sharp copies of thin bright
  detail out of focus (glow lines, text, rims, highlights), and N shutter samples leave N copies of anything that
  crosses many pixels while the shutter is open. Three things hide them:
  - **Bokeh fill.** After accumulating, a gather blur of radius `fill` x CoC / sqrt(N), sized per pixel from the depth
    of the most central lens sample, closes the gaps between the copies. The copies sit about 1.8 x CoC / sqrt(N)
    apart, so `fill` must be above about 1.8: below it, out-of-focus highlights read as a waffle or zebra stripes (more
    samples alone do not remove them); 2 closes them, and more brings blocky steps along thin additive glow rings near
    focus. It only acts where the central sample and the average differ in contrast (the guard: the log2 variance
    ratio over blocks of at most 32 px, faded in from `DOF.evLo` 2 to `DOF.evHi` 3), so in-focus things that write no
    depth (`text3d`, additive glows) stay sharp, and not where the copies are under 1.5 px apart (they already read as
    one blur). It never pulls a sharper surface in front into the blur behind it. Additive glows (meshes with additive
    blending and `depthWrite: false`: wavefront rings, halos, light sheets) are rendered once more on their own at half
    size; over a glow and about 16 px around it the gather stays within 2 px and never pulls glow light into its
    neighbours, because a glow writes no depth and would otherwise be smeared outward in the guard's blocks (jagged
    steps along in-focus rings). Points (dust, stars) and camera-locked quads do not count; an object opts out with
    `userData.noGlowMask`. Cost on an M4: 1 to 9 ms a 1080 x 1920 frame (at most about 7% of a 16-sample frame).
  - **Sample floor.** A shot's sub-frames are raised to N = π (R / `dof.spacing`)² (spacing 20 px), at most
    `dof.maxAuto` (64). R is the circle-of-confusion radius at infinity in px = render height / 2 x
    `projectionMatrix[5]` x `blur`, about 3580 x `blur` at fov 30 and 1920 px. At fov 30: `blur` 0.012 or less stays at
    16, 0.016 gives 26, 0.02 gives 41, 0.022 gives 49, 0.025 and up gives 64. With `fill: 0` the spacing halves (4x the
    samples). Cost is linear in N: a desk shot at `blur` 0.022 went from 113 to 282 ms a frame (16 to 49 samples).
  - **Motion floor.** With motion blur on and more than one sample, the engine evaluates the shot at both ends of the
    shutter (`update` is pure) and projects the focus point (when `k.lens.focus` is an object or a point), a world
    point on the view axis at the focus distance (the camera's own motion) and every `k.motionProbes` object. D = the
    largest of those screen displacements in render px; the shot's sub-frames rise to `ceil(D / dof.motionSpacing)`
    (2 px), at most `dof.maxMotion` (96). Copies merge only when they are no further apart than a thin glowing line
    is wide: 6 px apart a glowing ring still shows as separate rings, 3 px apart as faint stripes, 2 px apart as a
    smear. It costs two extra `update` calls a frame and spends samples only where something moves fast. D is in
    render px, so a `--scale 0.5` render asks for half the samples a full one does.
  - `render.mjs` prints which shots it raised ("sub-frames raised (strong defocus or fast motion): lock 72 (motion
    143 px), ... (base 16)"; the motion note when the motion floor set the count) and records `shotSamples` and
    `shotMotion` (`{ id: { px, n } }`) in `out/<name>.log.json`.
- Still visible: an out-of-focus object passing **in front of** an in-focus subject renders badly where it overlaps
  the subject, with or without the fill (stepped copies or a hard band: the fill reads the subject's depth there), and
  so does an out-of-focus `text3d` in front of an in-focus background (it writes no depth). Keep a foreground object at
  the focus distance, or rack to it ([18](#18-gotchas)).
- **Sky layers stay sharp.** A material with a `uSkew` uniform (`fx.stars`, `fx.milkyWay`) is a sky at infinity:
  every sub-frame the engine sets `uSkew` to the lens offset of a point at infinity, and the shader takes it back off
  (`gl_Position.xy -= uSkew * gl_Position.w`), so stars land on the same pixel in every lens sample and never blur. A
  custom sky shader can do the same: declare `uniform vec2 uSkew` (value a `Vector2`).
- `render.mjs --fill F --no-autosamples` (fill strength, 0 off; no automatic floors) renders A/B stills. In a shot,
  `(await import(k.kit('engine/core.js'))).DOF.debug = true` paints the fill's mask red and its radius green.
- `k.motionBlur = 0` turns motion blur off for a shot; `project.shutter` sets it for the video.
- `k.rig()` registers its key light for soft shadows; add others with `k.softLight(light, radius)`.

## 8. Film stage (`post`)

Merged per frame: `DEFAULT_POST` < palette `post` < `project.post` < `k.post`. Values blend across transitions; during a
`light` transition the bloom also rises by 0.2 x sin(π p) (p = the transition's progress), so the flare spills into
the frame.

| Key | Default | Meaning |
|---|---|---|
| `exposure` | 1.0 | Multiplier before the tone map. |
| `bloom` | 0.06 | Fraction of light spread by the bloom chain (HDR emissives above 1 bloom). |
| `bloomRadius` | 1.0 | Spread of each bloom level. |
| `ca` | 0.0025 | Chromatic aberration towards the edges. |
| `vignette` | 0.55 | Edge darkening. |
| `grain` | 0.035 | Luminance film grain, strongest in the mids, re-seeded every frame. |
| `look` | 0.35 | Blend towards AgX "punchy" (more contrast and saturation). |
| `saturation`, `contrast` | 1, 1 | Display-referred, after the tone map. |
| `lift`, `gamma`, `gain` | `[0,0,0]`, `[1,1,1]`, `[1,1,1]` | Colour wheels (display-referred). |
| `shadowTint`, `highlightTint` | `[0,0,0]` | Split toning added to shadows / highlights. |
| `fade`, `fadeColor` | 0, `[0,0,0]` | Mix to a colour (used by `fadeIn` / `fadeOut`). |
| `captionShade` | 0 | The caption shade: the fraction of scene light taken out under the caption band (0.5 = one stop at full strength; at most 0.95). Full from y 1300 to 1500 of 1920 and fading out to y 1150 above and 1650 below (it follows `captions.bottom`), in linear light before the bloom and the tone map, so it grades like a graduated filter in front of the lens: lit things stay lit, only darker, and the bloom comes from the shaded picture. Per project (`project.json` `post`) or per shot (`k.post.captionShade`, blended across transitions). |

Order: caption shade (and the bloom chain's input) > lens (chromatic aberration) > bloom > exposure > vignette > AgX >
grade > saturation and contrast > fade > grain > dither.

**Caption shade.** For a world whose lit parts reach into the caption band (a planet, a lit hand, a screen low in the
frame), `"post": { "captionShade": 0.5 }` keeps the band under the audit's limit and reads as natural grading, never as
a bar: on two test frames (a night globe, a lit phone low in the frame), 0 failed the caption audit (4% and 3% of the
box above luma 120) and 0.5 passed; the band's rows went from 46 to 26 and 33 to 17 (mean
luma), the frame above y 1150 and below 1650 untouched. 0.4 to 0.6 suits most worlds; 0.7 is strong. It cannot hide a
glowing line (HDR light stays bright after one stop): keep lines out of the band while a caption is up. Drop
hand-made scrims (a dark quad in front of the camera): they darken the band hard to the bottom edge, a letterbox bar.

## 9. look

**Palettes** (`look.PALETTES`, `look.palette(name)`):

| Name | Accent | Glow (secondary) | Env | World |
|---|---|---|---|---|
| `night-amber` | `#ffb43c` | `#5aa8ff` | night | navy night, amber light |
| `ocean-blue` | `#ffd23f` | `#77d9fc` | night | deep blue, yellow light |
| `space` | `#f2be62` | `#f6e7c8` | space | near black, no fog |
| `studio-cool` | `#ff9a3c` | `#ffb15c` | studio | blue-grey studio |
| `dusk` | `#ffb43c` | `#ffcf7a` | sunset | violet to orange |
| `emerald-night` | `#7dff9a` | `#f2d787` | night | warm brown-black interior, warm lights; only the signal is green |
| `studio-light` | `#2f6bff` | `#7aa2ff` | studio | bright, dark text (`text #0e1116`) |

Each palette also has `bg` [top, bottom], `fog` [colour, density], `ink` (text on the accent), `text`, `key` / `rim`
/ `fill` [colour, intensity] and `post`. Two keys are optional: `hud` (the HUD's colour, default `#77d9fc`) and
`haze` (the backdrop's glow when the secondary is too light to wash a big area: `ocean-blue` keeps a blue haze while
its secondary is the HUD's cyan). Measured palettes per world are in `references/look.md`. `look.theme.pal` is the video's palette (set before any shot is built) and
`look.accentDefault()` its accent: every prop, glow and material colour that marks the highlight defaults to it.

| Function | |
|---|---|
| `look.environment(renderer, kind, pal, o)` | Prefiltered reflection environment, cached per kind, palette and `o`, and never disposed with a shot. Use `k.env()`. `'orbit'`: black sky with faint stars, a sun disc and a blue planet filling one side, so metal, foil and glass read in space (`'space'` is nearly black: polished parts read as holes). |
| `look.backdrop(pal, { glow 0, glowColor, glowPos [0.5, 0.55], radius 400, horizon 0 })` | Use `k.backdrop()`. `glowColor` defaults to the palette's `haze`, else its `glow`. `horizon`: a warm glowing band across the whole frame behind everything, for hooks in any palette: a strength (0.3 to 0.5 behind a hero in a night palette) or `{ strength .4, color '#ff8a3c', y .6, width .1 }`; `y` is the band's screen height (0 bottom, 1 top, like `glowPos`), `width` its half-height as a fraction of the frame. Both glows are screen-locked. Returns the mesh with `setGlow(v)` and `setHorizon(v)` (pure setters for update). Not fogged. |
| `look.rig(scene, pal, o)` | Use `k.rig()`. Key shadow map 2048, frustum ±`shadowSize` (12). |
| `look.productLight(scene, target, o)` | A product light for a night world: a narrow soft-edged cool spot from high above and a little behind the target, which casts the product's shadow (so its cone never lands on the floor in front of it), plus a narrow soft fill from the camera side, about as wide as the product, that lights the faces the camera sees. White plastic reads white without lifting the room. `target`: an `Object3D` (aimed at its `userData.center`, sized by `userData.radius`) or a point (pass `radius`). `o`: `color '#dfe8ff'`, `intensity 30` (the illuminance at the target is `intensity / 10` whatever the scale or distance: 3, against the night rig key's 2.6 at `keyScale` 1), `angle .18` (the spot's half-angle in radians; it is placed far enough for the cone to cover the target), `penumbra .9`, `pos` (the spot's world position), `fill .8` (the fill's share of the intensity), `shadow true` (1024 px map), `radius`. Returns `{ spot, fill, set(v), follow() }`: `set(v)` scales both (pure); `follow()` re-aims at a target that moved (call it in update). No `k.` wrapper: `k.look.productLight(k.scene, product)` after `k.rig()` (it adds to the rig, it does not replace it). It registers nothing with the camera body: `k.softLight(pl.spot, r)` softens its shadow (snippet 22). |
| `look.applyFog(scene, pal, scale)` | Use `k.fog()`. |
| `look.noiseTexture({ size 512, kind 'fbm' \| 'grain' \| 'brushed' \| 'ripples', scale 6, seed 1, repeat 8 })` | Tileable greyscale `CanvasTexture` for `bumpMap` / `roughnessMap`. |

**Materials** (`k.mat`). Options: `rough`, `env` (envMapIntensity), `extra` (any three.js material fields).

| Preset | Signature | Notes |
|---|---|---|
| `plastic` | `(color, { rough .32, clearcoat .6, ccRough .18 })` | Clearcoated plastic. |
| `matte` | `(color, { rough .85 })` | Standard, no metal. |
| `metal` | `(color, { rough .28 })` | Polished metal. |
| `brushed` | `(color, { rough .38, aniso .4, anisoRot 0 })` | Anisotropic metal: highlights stretch along the surface's u direction (`anisoRot: Math.PI / 2` for v). Needs UVs that vary across the face: with constant UVs it renders as a flat blown-out sheet. On a cylinder (u runs around it), 0.8 flattens the sides. |
| `gold` | `({ rough .25 })` | No colour argument. |
| `glass` | `({ color, rough .04, transmission 1, thickness .6, ior 1.45, clearcoat 1, ccRough .15 })` | No colour argument; options first. Real transmission (an extra pass). |
| `frosted` | `({ color, rough .35, thickness 1 })` | No colour argument. |
| `ceramic` | `(color, { rough .22 })` | Clearcoat and sheen. |
| `rubber` | `(color, o)` | Rough, dark. |
| `emissive` | `(color accent, intensity 4, { fog, opacity, depthWrite, additive })` | Unlit HDR colour: 2-6 reads as a glowing line, 10+ as a hot core. |
| `lit` | `(color, glow accent, glowIntensity 2, { rough .35, metal 0, clearcoat .4, ccRough .15 })` | Lit surface that also glows (screens, LEDs on a part). |
| `molten` | `({ rim, mid, core, gain 1, scale 1, crust .5, fade true, rough .12 })` | No colour argument; options first. Incandescent liquid (molten silicon, glass, metal): white-hot where the surface faces the camera and in the hottest convection cells, deep orange at the silhouette, thin darker veins of cooling skin drifting over it, under a glossy wet coat that catches the environment. `m.set(heat, t)` in every update (pure): heat 0..1 scales the glow (the hottest cells reach about 6, which the tone map turns white), `t` drives the churn. `fade: true` fades the surface in with the heat (opacity `heat * 1.2`), so it can lie over a solid object's own mesh (same geometry, `renderOrder = 2`); `fade: false` keeps it opaque (dark when cold). `scale`: the churn's feature size in the object's own units (1 suits an object about 1 across; 0.9 for a 9-unit surface seen from 3 away). `rim`, `mid`, `core`: arrays are linear RGB (defaults `[.9, .12, .01]`, `[1, .42, .06]`, `[1, .8, .45]`), strings sRGB hex. `crust`: how dark the veins get (0 none). |

Clearcoats default to `ccRough` 0.15 to 0.18. A mirror coat (0) makes pinpoint highlights that break into dot grids
out of focus. A uniform emissive reads as a glowing soap egg; `mat.molten`'s facing ramp and churn are what read as
liquid heat.

## 10. glow

Emissive colours above 1 are HDR and bloom. Tubes, arrows, field vectors, waves, plots, gates and SVG paths have a
white-hot core: the middle of the silhouette (the faces turned to the camera) runs into `coreColor`, which defaults
to the colour taken nearly to white, in one mesh, so a line reads as light, not paint. Colours default to the video's
accent.

| Function | Returns, methods |
|---|---|
| `tube(curve, { radius .02, color accent, intensity 4, segments 240, radial 10, core true, coreColor, coreIntensity (1.6 x intensity), opacity, additive, fog false })` | Group. `.draw(p)` shows 0..p of the curve, `.window(a, b)` a moving segment, `.setIntensity(i, coreI)`, `.setColor(c, i)`. Intensity 0 hides it (an opaque tube would draw black); every glow piece below does the same. |
| `line(points, { width .02, color accent, intensity 3, dashed, opacity 1, worldUnits true })` | `Line2` (width in world units). `.draw(p)` by whole segments, `.setIntensity(i)`. Points: `Vector3`s or `[x, y, z]`. |
| `pulse(curve, { size .06, color (the accent, lighter), intensity 14, tail .08, tailLength, tailRadius, segments 240, fade 0, fadeIn, fadeOut, lift 0, up [0,1,0] })` | Group: a bright head with a halo and a fading tail. `.place(u)` puts it at arc-length fraction `u` (hidden outside 0..1). It takes a fraction, not a time: `.place(k.ramp(t, t0, t1, 'linear'))`, or a loop `.place((t * 0.5) % 1)`. `tail` is a fraction of the curve; **`tailLength`** is the tail in world units whatever the curve's length (on a 144-unit cable `tail` 0.08 is an 11-unit bar; `tailLength: 0.5` is half a unit, and the tail tube gets enough segments to draw it smoothly). `fade` (e.g. 0.12) dims it in over the start of the curve and out over the end, so a loop does not jump back to the start; `fadeIn` / `fadeOut` set the two ends apart. A fading head shrinks as it dims (an opaque head dimmed to grey read as a solid grey ball over its line), and a fading pulse's tail is additive, so it never darkens the line under it. **`lift`**: a pulse on the centre line of an opaque tube (a cable, a wire, a trace) is hidden inside it and shows only its halo, a ring around the tube; `lift` moves the head and tail that far along `up` (world units, square to the curve at every point), so set it to the tube's radius and the head rides on the top with its white core showing and the tail runs as a lit stripe along the top. `.curve` is the curve it rides (the lifted one). The halo is drawn nearer the camera than the head, so a floor or a cable under it does not slice it off in a straight line. `.at(u)` is the old name (it warns once when given a time). |
| `arrow(from, to, { radius .02, color accent, intensity 4, head (7 x radius), headRadius (2.8 x radius), bend 0, normal [0,1,0], curve, segments 160, core, coreColor, opacity, fog })` | Group, built fully drawn. `.draw(p)` grows the shaft and carries the cone head at its tip (on `to` at 1). `bend` lifts the middle by that fraction of the length towards `normal`; `curve` follows any path. `.setIntensity(i)`, `.curve`, `.shaft`, `.head`. |
| `vector({ color accent, intensity 2, radius .012, head (7.5 x radius), headRadius (2.9 x radius), dir [1,0,0], core true, coreColor })` | A field arrow (an electric field, a force, a velocity) whose signed length you set every frame: `.set(len, alpha = 1)` points it along `dir` for `len > 0` and the other way for `len < 0`. The head keeps its size and shrinks only when the arrow is shorter than 1.6 heads, so a field oscillating through zero reads as one arrow turning over. Unlit HDR with a white-hot core, like `arrow`. `.material`. |
| `ring(radius, { axis [0,1,0], center, tubeRadius .012, color accent, intensity 3, segments 256, core, start 0 })` | A circle as a `tube` (`.draw`, `.window`). |
| `arcCurve(a, b, { height .3, sphere: { center, radius, lift .15 }, samples 64 })` | A `Curve3` that lifts off between two points, or a great-circle arc over a sphere. |
| `wave({ length 4, amp .25, wavelength 1, radius .018, color accent, intensity 4, segments 300, axis 'x', plane 'y', core, coreColor, envelope, fn })` | Group. `colors: ['#ff3b3b', ...]` spreads colour stops evenly along it (u 0..1), or `(u) => colour`, instead of one colour: a spectrum, or a 1 in amber and a 0 in blue on one wave (the core stays white). `.set({ phase, amp, wavelength, length, from, to, envelope: (u) => k, fn: (x, u) => y })` rebuilds it from the construction options plus what you pass: a field you leave out goes back to its default, so each call stands alone (call it every update). `fn` draws any curve instead of the sine (x in world units from the middle), e.g. two waves summed: `fn: (x) => Math.sin(x * 4 - t * 3) * 0.2 + Math.sin(x * 9 + t) * 0.08`; the envelope still applies. `.setIntensity(i)`, `.setColor(c, i)`. |
| `waveField({ radius 3, color accent, wavelength (.13 x radius), width (.06 x wavelength), speed 1.2, intensity 2.5, falloff 1.8, axis [0,1,0], segments 160 })` | Expanding wavefronts on a disc: radio, sound or a ripple leaving a source, thin rings of light travelling out and fading with distance, in one additive shader (any number of fronts costs the same). Use it instead of scaling `glow.ring`s. Lies flat by default (`axis` is its normal, like `ring`'s); `field.quaternion.copy(camera.quaternion)` in update turns it to face the camera. `.set({ time, start, stop, intensity, wavelength, speed, front, back })` every update, each call standing alone: the source emits from `start` to `stop` (seconds on the same clock as `time`; both open by default), the first crest leaving at `start`, so `set({ time: t })` is a steady source, `set({ time: t, start: t0 })` one that switches on at t0 and `set({ time: t, start: t0, stop: t0 + 0.35 })` a burst of a few rings. `front` / `back` (radii) override start / stop. `falloff`: e-folds of brightness from the centre to the rim (1.8 puts the rim at 17%). Lines never get thinner than a pixel, so far rings do not shimmer. `.setIntensity(i)`. |
| `waveBetween(a, b, { up [0,1,0], amp (.045 x length), wavelength (.13 x length), radius (.0065 x length), speed (2.5 wavelengths a second), taper .08, intensity 5, color accent, colors, core true, segments 400 })` | A wave of light running from `a` to `b` (a phone to an earbud, an antenna to a tower): a `glow.wave` laid along a -> b and oscillating towards `up`, its ends tapered over `taper` of the length so it leaves and arrives softly. `a` and `b` are points, or `Object3D`s read in world space at every `set()` (so it follows a bobbing bud; add the wave to the scene, not to a moving parent). `.set({ time, speed, to, from, amp, wavelength, fn, phase, a, b })` every update, each call standing alone: the crests travel from a to b at `speed`; `to` (0..1) draws it out of `a` with a tapered front; `fn: (x, u) => y` draws any shape instead of the sine (x in world units from the middle; `glow.fsk(bits)` for bits); `a` / `b` move the ends. `colors` as `glow.wave`'s, from `a` (u 0) to `b` (u 1). `.setIntensity(i)`, `.setColor(c, i)`, `.wave`, `.len`. |
| `fsk(bits, { one 4, zero 2, len 1, amp .2, x0 })` | Frequency-shift keying as a function for `glow.wave({ fn })` or `waveBetween`'s `set({ fn })`: each bit is a stretch of `len` world units at `one` (a 1) or `zero` (a 0) cycles per unit, the phase carried across each change so the wave never jumps. `bits`: `'1011'`, `[1, 0, 1, 1]` or `[{ f, len }]`. x is measured from the wave's middle, so `glow.wave({ length: fn.total, fn })` fits the bits exactly (`x0` moves the first bit's start; default `-total / 2`). `fn.total` (the length), `fn.bits` = `[{ bit, f, x0, x1, mid }]` (stand a "1" over `fn.bits[0].mid`). To scroll the bits along, draw `(x) => fn(x - speed * t)`. |
| `plot(fn, { x0 -1, x1 1, y0, y1, width 2.4, height 1.4, samples 240, radius .014, color accent, intensity 4, core, axes true, axisColor '#ffffff', axisIntensity 1.2, axisWidth .007, ticks 5, tickSize .035, arrows true })` | Group: the graph of `y = fn(x)` as a glowing line over thin axes, in its XY plane facing +z, centred on the origin. `y0` / `y1` default to fn's range (values outside clamp). `.draw(p)` traces the graph on (arc length, like a pen), `.axes.draw(p)` draws the axes (ticks appear as the axis reaches them, arrowheads at the end). `.curve` is the graph as a `Curve3` in the plot's space: `plot.add(glow.pulse(plot.curve))`. `.point(x)`, `.toLocal(x, y)`, `.range`. `.ticks.x` / `.ticks.y` = `[{ value, anchor }]`, for `k.ui.label`. `ticks: { x: [...], y: [...] }` picks the values; `0` hides them. |
| `dimension(a, b, { tick .08, width .012, color '#ffffff', intensity 1.6, normal [0,1,0] })` | A measurement line with end ticks. `.draw(p)`. Pair with a label for the value. |
| `gate(type, { height 1, width, inputs 2, leads true, lead (.35 x height), radius (.015 x height), color accent, intensity 5, core true, segments 400 })` | The standard logic-gate symbols in light: `'and'` (flat back, round front), `'or'` (curved back, pointed front), `'not'` (triangle and bubble), `'nand'`, `'nor'` (with the bubble) and `'xor'` (a second back curve). In the XY plane facing +z, centred on the body; `width` defaults to the classic proportions (1.2 x height for and/nand, 1.3 for or/nor/xor, 0.95 for not). `inputs` leads on the back (`'not'` always 1), evenly spaced, each `lead` long, and one output lead from the front; `leads: false` draws the outline alone. `.draw(p)` traces the outline over p 0..0.75, then the inputs flow in and the output flows out over 0.5..1 (drawn fully when built). `.inputs[i]` (outer end into the gate) and `.output` (gate out) are `LineCurve3`s for a `glow.pulse`; `.curve` (the outline), `.strokes`, `.leads`, `.setIntensity(i)`, `.setColor(c)`. Anchors `in0`, `in1`, ... (outer ends of the inputs), `out` (end of the output), `center`. `userData.radius` covers the leads, so `cam.frame(gate)` works. |
| `svgPath(d, { size 1, fit 'max' \| 'width' \| 'height', radius (.02 x size), color accent, intensity 5, core true, head true, headSize (3.2 x radius), headIntensity 22, tail .1, segments 400 })` | Any SVG path drawn in light, with a bright head travelling at the tip as it draws: a rune, a logo stroke, a hand-drawn arrow. `d` is a path's `d` attribute: every command, arcs included; each `M` starts a new stroke, `Z` closes one. Fitted so its larger side (or `fit`) is `size` world units, centred on the origin in the XY plane facing +z, y up. `.draw(p)` draws the strokes one after another by length with the head riding the tip (it fades in over the first 12% of each stroke and out over the last 6%, shrinking as it fades, so a stroke ends without a pop; hidden at 0 and 1; `head: false` for none); drawn fully when built. `.setIntensity(i)`, `.strokes` (tubes), `.curves` (`Curve3`s, for your own pulses), `.heads`, `.width`, `.height`. Anchor `tip`: the point being drawn (for a light that follows it, or focus). |
| `sweep(k, { radius 1.5, y 0, color accent, cover '#7d8492', height (1.5 x radius), intensity 7, light (4 at radius 1.5, scaled) })` | "Carve it with light": a sheet of light sweeps across a disc lying at height `y` (a wafer, a plate, a die) and leaves the surface's pattern behind it. Ahead of the sheet a plain cover disc hides the surface (`cover`: a colour, a material, or `false` for the light alone); behind it the cover is clipped away. `.set(p, on = 1)` every update: p 0..1 carries the sheet across (0 before the near edge, 1 past the far one), `on` its strength. It travels along its own +x: move and turn the group like any other, the clip plane follows it. Turns on `k.renderer.localClippingEnabled`. Parts `.cover`, `.sheet`, `.edge` (the glowing line on the surface), `.lamp` (a warm point light riding the line). Anchor `edge` (the middle of the line). Takes `k` because it needs the renderer. |
| `hot(color, intensity)` | `Color` times intensity (HDR). |

## 11. fx

| Function | Returns, methods |
|---|---|
| `dust({ count 400, center [0,0,0], size [10,6,10], pointSize .018, color '#ffd9a0', intensity 1.2, drift [.02,.03,0], seed 7 })` | `Points`. `.at(t)` drifts them (call it every update), `.setIntensity(i)` fades them (pure). Lens-aware: out of focus they grow into smooth bokeh discs. Point sizes follow the live fov every sub-frame (`projectionMatrix[1][1]`), so motes keep their size relative to the scene at any fov. |
| `stars({ count 20000, radius 300, pointSize 7, intensity 1, seed 3 })` | `Points` on a sphere, real-sky tints: brightness `0.35 + R^4 x 2.6` (most faint, a few HDR-bright), size `pointSize x (0.6 + R^3 x 1.6)` px at 1920 high, 6% bright with a halo at 2.2x size. Sharp under any depth of field (`uSkew`, [7](#7-lens-motion-blur-soft-light)). `pointSize` 7 keeps a faint star 1.5 to 3 px at phone width. A frame at fov 30 sees 1.2% of the sphere, and about 70% of those stars clear luma 60 at 390 px wide: the defaults put about 170 visible stars in a frame of clear sky (look.md asks for 150 or more). |
| `milkyWay({ normal [0.3,1,0.25], width .16, stars 30000, glow .1, center [-0.6,0.1,-1], radius 320, pointSize 2.2, intensity 1, color '#e8d6bd', glowColor '#a8927a', seed 5 })` | `Group` (`.stars`, `.glow`): the Milky Way made of stars. `stars` tiny stars (1.5 to 3 px at 1920 high) crowd a great circle whose pole is `normal` (half-width `width`, radians), a third of them in the bulge towards `center` (a direction), thinned by dust lanes with crisp edges (a rift wandering along the middle, small knots); under them a faint unresolved glow, smooth along the band and dimmed by the same lanes (one shader function, so the dark rifts in the glow are where the stars thin), its peak `glow` x a typical band star. It reads as a faint river of stars with a dark rift, never as an fbm smoke band (soft fbm clouds are what read as smoke). Subtle by default: raise `intensity` (both) or `glow` for a bolder band. Same lens compensation as `stars`. Static: nothing to call in update. |
| `beam({ from [0,5,0], to [0,0,0], radiusTop .05, radiusBottom 1.2, color '#ffe2b0', intensity .6, softness 1.6 })` | Additive volumetric cone. `.setIntensity(i)`. |
| `glowSprite({ color accent, intensity 2, size 1, position [0,0,0] })` | Camera-facing soft glow. `.setIntensity(i)`. |
| `steam({ count 7, center [0,0,0], radius .5, height 1.6, width .7, color '#fff1df', intensity .5, seed 3, speed .25 })` | `Group` of soft wisps rising from a disc of `radius` at `center`: camera-facing planes with a scrolling fbm plume (additive). `.at(t, camera, amount = 1)` every update: sets the time, turns each wisp to the camera about the vertical and scales it by `amount` (0 hides it). |
| `converge({ count 70, radius 1.3, color accent, size .012, intensity 9, seed 3 })` | `InstancedMesh` of HDR motes that spiral in from a sphere of about `radius` and shrink as they arrive (sound pulled out of thin air, energy gathering into a part). `.set(t, target, t0, t1, life = .9)` every update: each mote flies for `life` s, starting between `t0` and `t1 - life`; `target` is a `Vector3`, `[x, y, z]` or an `Object3D` (followed as it moves). |

Snippet 25 uses `stars`, `milkyWay`, `steam` and `converge`.

## 12. cam

A pose is `{ pos, look, fov?, roll?, up? }`. Every move has `.at(t) -> pose` and `.apply(camera, t, o)`, which passes
`t` on to the drift. **`up`** (`[x, y, z]` or a `Vector3`) is the camera's up for that pose: a camera orbiting a planet
keeps up away from the surface (`up: camera position minus the planet's centre`). `cam.apply` sets `camera.up` from it
before the camera looks; a pose without `up` puts world up back if an earlier pose set one, and otherwise leaves
`camera.up` alone (so a `camera.up` set by hand still works, but `up` in the pose replaces it). Any move's pose takes
one: `cam.apply(camera, { ...move.at(t), up: n }, { t })`.

| Function | |
|---|---|
| `path(keys, { ease 'inOutSine', flow false, curve 'centripetal', tension .5 })` | Catmull-Rom move through `[{ t, pos, look, fov?, roll? }]` (shot-local `t`; `pos` and `look` take `Vector3`s or arrays); two keys are a straight line, halfway at the halfway time. Each segment eases on its own, so the camera settles at every key. `flow: true` makes one glide through all the keys: the ease runs over the whole move, each key is passed at its `t` on that eased clock (the first and last exactly, a middle one a little later or earlier; `ease: 'linear'` passes each at its `t`), and each spline is travelled by arc length, so the speed changes smoothly through every key however unevenly the keys are spaced. The look point travels its own spline the same way (a pan in place still turns); fov and roll ease between keys. A hold (two keys at one position) stops the camera; a far key soon after it then needs a dash, and `path` warns when one stretch runs more than 3x the move's average speed while another sits under a quarter of it: `cam.path flow: keys 3-4 (t 2.66-3.16) cover 1.86 units, 6.9x the move's average speed, next to a hold …` ([18](#18-gotchas)). A `cam.frame()` result spreads into a key: `{ t: 0, ...A }`. A key may carry `up`: it eases between keys like roll (a key without one is world up); with no `up` on any key the camera's up is left alone. |
| `orbit({ center, radius 6, height 1.5, a0 -20, a1 20, t0 0, t1 5, ease, fov })` | Orbit between two angles (degrees). |
| `logZoom({ target, dir [0,.25,1], from 20, to 1, t0 0, t1 3, ease 'inOutCubic', lookOffset, fov })` | Distance changes exponentially, so every second covers the same number of powers of ten. `dir` points from the target to the camera. `.at(t)` also returns `dist`. |
| `push({ target, from [0,1,8], to [0,.8,6], t0, t1, ease, fov })` | A two-key dolly. |
| `follow(curve, { t0 0, t1 5, from 0, to 1, offset [0,0,0], lookAhead .08, look, lookOffset, ease 'inOutSine', up, fov, roll })` | Rides along a curve: a fly-through, or chasing a pulse down a wire. Between `t0` and `t1` the camera travels the curve from fraction `from` to `to` (arc length, eased). `offset` moves it in the curve's own frame, `[right, up, back]` (`[0, 0.3, 1.2]` trails behind and above). It looks `lookAhead` further along (a fraction of the curve; past the end it carries on straight), or at `look` (a point or an `Object3D`). The frame is built from world up, so the horizon stays level. With `up` (`[x, y, z]`, or `(point, t) => [x, y, z]` for one that changes along the curve: `(p) => p.clone().sub(earth.position)` round a planet) the frame is built from it and the camera's up follows it too. To ride with a pulse, use `ease: 'linear'` and place the pulse a little ahead. |
| `rack(keys, { dur .45, ease 'inOutCubic', camera })` | A rack focus for `k.lens.focus`. `keys`: `[[t, subject, dur?], ...]`; each pull starts at its `t` and eases over `dur` (0.3 to 0.6 s reads as a deliberate pull). A subject is an `Object3D` (followed as it moves), a `Vector3` / `[x, y, z]`, a distance, or a function `(t) => any of these` (a point riding a curve). Mixing distances with points needs `{ camera: k.camera }`. |
| `apply(camera, pose, { drift .6, t 0, seed 0 })` | Places the camera from a pose (`pos`, `look` and `up` as `Vector3`s or `[x, y, z]` arrays). `drift` adds a slow float (0.6% of the distance) and roll. **Pass `{ t }`** here: without it the drift is frozen (a move's own `.apply(camera, t)` passes it for you). |
| `fit(radius, { fill .6, fov 30, aspect 9/16 })` | Distance at which a sphere of `radius` fills `fill` of the frame **width**. |
| `frame(target, radius, { az 25, el 15, fill .6, fov 30, aspect 9/16, lookOffset })` | A pose from azimuth / elevation (degrees) at the `fit` distance. `target` can be a prop, framed by its bounding sphere (`userData.center` / `userData.radius`, measured when missing), so `cam.frame(laptop, { az: 30 })` needs no radius. An anchor or a point takes a radius. For other sizes pass `aspect: k.aspect`. |

A 9:16 frame is narrow: at fov 30 it is only about 17° wide, so frame by width. Every prop gives `userData.radius`
(world units, at the scale it is built), and `userData.center` when its middle is not its origin.

## 13. util

All pure. On `k` and `g` directly, and as `k.U`.

| Function | |
|---|---|
| `ramp(t, t0, t1, ease = 'inOutSine')` | 0 before `t0`, 1 after `t1`, eased between. The workhorse for "on that word". |
| `pulse(t, t0, rise .15, hold .2, fall .4, ease)` | 0 > 1 > 0 envelope. |
| `keys(t, [[t0, v0], [t1, v1, ease], ...], defEase)` | Piecewise keyframes for numbers or arrays. |
| `monotone(xs, ys)` | Monotone cubic (Fritsch-Carlson) through the points `(xs[i], ys[i])`, `xs` increasing: passes through every point, never overshoots or runs backwards between them, slope continuous; flat outside the ends. `const phase = k.monotone([0, 1.2, 2], [0, 0.2, 1]); phase(t)`: a phase that speeds up on cue without reversing. `cam.path`'s flow clock. |
| `ease.*`, `easeFn(name \| fn)` | `linear`, `in/out/inOut` + `Sine`, `Quad`, `Cubic`, `Expo`; `outQuart`, `inOutQuart`, `outQuint`, `inOutQuint`, `outBack`, `settle` (fast start, long soft landing). Names match GSAP's. Every curve is exactly 0 at 0 and 1 at 1, with no step next to either end. The Expo curves are rescaled for this; the textbook versions jump 0.05 to 0.1% on the first or last frame. |
| `clamp(x, a = 0, b = 1)`, `lerp`, `invLerp(a, b, x)` (clamped), `smooth`, `smoother` | Basics. |
| `rng(seed)` | Seeded generator: `const R = k.rng(4); R()` in 0..1. Use at build time. |
| `hash1(n)`, `noise1(x, seed)` | Hash in 0..1; smooth 1D value noise in -1..1 (organic wobble from `t`). |
| `fmtNum(v, { decimals 0, comma true, pad 0 })` | `1234567` > `"1,234,567"`. |
| `halton`, `toDisk` | Sampling sequences used by the engine. |

## 14. screens

```js
const scr = await k.screen({ w: 1179, h: 2556, html, css, background: '#000' });  // or file: 'assets/app.html'
scr.update = (t, root) => { /* change the DOM for shot-local t */ };
phone.setScreen(scr.texture);
```

- Returns `{ root, shadow, canvas, texture, w, h, update, ok, render, dispose }`. CSS is scoped to the screen (shadow
  DOM); the page's fonts (Inter, Barlow Condensed) are available.
- The DOM is redrawn once per output frame, before the sub-frames, so HTML changes do not motion-blur within a frame.
- Needs Chrome's HTML-in-canvas (`render.mjs` enables it). `scr.ok` is false without it and the texture stays blank,
  for example in a normal browser opened with `serve.mjs` unless Chrome runs with `--enable-features=CanvasDrawElement`.
- Size the screen to the pixels it covers in the frame: 1179 x 2556 (a phone at 3x) for a phone that fills the frame
  height, 1600 x 1032 for a laptop, 1920 x 1080 for a monitor. Size barely changes speed: on an M4 the redraw is under
  1 ms up to 2048 x 4437, and heavy CSS such as big blur filters adds about 1.4 ms a frame per megapixel. Memory is
  about 10 bytes a pixel; the limit is 16384 px a side. Phone screens are about 0.46 wide per 1 tall, laptops 1.55:1,
  monitors 16:9.
- Ready-made phone screens: `props.mapScreen()` (a night-mode street map) and `props.nowPlayingScreen()` (a music
  player), HTML templates that `k.screen()` takes as they are ([15 devices](#devices)).

### Clips in a shot

A clip made by `clip.mjs --frames` can play on a 3D screen or sit as a full-frame plate under the kit's type. It is
time-pure: each output frame shows frame `floor((t - at) * fps * speed + from * fps)` (held at the ends, or wrapped
with `loop: true`), loaded once before the frame's sub-renders, so motion blur and depth of field never mix two clip
frames.

| `kit/clips/clip.js` | |
|---|---|
| `k.clip(rel, o)` / `clip(k, rel, o)` | `Promise<clip>`. `rel`: the frames folder (`'assets/clips/plane'`). Options: `at 0` (shot-local second at which the clip's first frame shows; `T0 - k.start` keeps one project time across shots), `speed 1`, `loop false`, `from 0` (seconds into the clip), `keep 12` (decoded frames in memory). Returns `{ texture, info, frames, duration, aspect, index(t), time(t), render(t) }`.  |
| `clipPlane(k, clip, o)` | A camera-locked quad that covers the frame (`fit 'cover'` or `'contain'`) at `dist 50`, drawn first. `tonemap 'inverse'` (default) runs it through the inverse of the film stage's AgX curve (`look` from the palette, `highlights 6`), so it looks as it did in the file after bloom, AgX and the grade; `gain 1`. Set `k.lens = { blur: 0 }`: the clip has its own depth of field, and the lens jitter would blur a camera-locked quad at any focus distance. |

Tested (16-sample stills and a 150-frame render): the plane clip on a 3D phone, a `zoom` transition, then the same
moment full frame under a hero number.

```js
// shots/phone.js: the clip on a phone, the camera pushing into the screen
const c = await k.clip('assets/clips/plane', { at: 0 - k.start });   // the clip starts at project time 0
const phone = props.phone({ width: 1, color: 'black', glow: 1.0 });
phone.setScreen(c.texture);
scene.add(phone);
// in update: k.lens = { blur: 0.012, focus: phone };

// shots/plate.js ("in": { "type": "zoom", "dur": 0.5 }): the same moment, full frame, with a hero number over it
const { clipPlane } = await import(k.kit('clips/clip.js'));
const c = await k.clip('assets/clips/plane', { at: 0 - k.start });
clipPlane(k, c);
k.ui.hero('', { at: 0.55, until: k.dur - 0.2, y: 300, size: 200, unit: 'dB', sub: 'inside the cabin', count: { range: [0, 85], dur: 0.6, ease: 'outQuint' } });
return (t) => { k.lens = { blur: 0 }; };
```

Make plates from first frames with a calm top third
(`clip.mjs` asks for it) when a hero number goes over them.

## 15. Props

Every factory is on `k.props`. Sizes are world units. Every prop is an `Object3D` with the same contract:

- `userData.radius`: its bounding radius in world units, at the scale it is built. Plus `userData.center` when its
  middle is not its origin (props that stand on y = 0), so `cam.frame(prop)` frames it with no radius.
- `g.anchors`: named `Object3D` markers that move with their parts (a lid, a wing, an atom), for
  `k.ui.label({ anchor })`, `k.lens.focus` and `cam.frame`.
- `g.anchor(name)`: returns one, and throws with the valid names on a typo (`laptop.anchor("lid"): no such anchor.
  Anchors: screen, keyboard, trackpad, hinge`). Props without parts have an empty map.

Give your own props the same contract with `props.withAnchors(group, { name: object3D, ... })` and
`props.measureBounds(group)` (call it once the prop is built, in its usual pose). Animated props are pure: call
their `at(t)` / setters in every update. Colours that mark the highlight (glows, LEDs, lit traces, grids, orbits)
default to the video's accent. Override with `{ pal: k.pal }` or `{ accent }` (science), `accent` (devices) or
`color`. Textures a props file caches across shots are flagged `userData.shared`, so evicting a shot never disposes
them.

### base

| Factory | |
|---|---|
| `phone({ width 1 \| perMetre, color 'titanium' \| 'black' \| 'silver' \| 'gold' \| 'blue' \| hex, screen, glow 1.15 })` | Flagship phone, screen facing +z, centred on itself, height 2.065 x width (a real one is 0.0715 m wide). The screen is off (black glass) until `.setScreen(texture)` puts a `k.screen()` texture or an image on it (`null` turns it off). `.setGlow(v)`, `.screen` (mesh). **`.setXray(v, o)`**: the phone's own body turns to glass (`xray` below, the screen kept readable at 45%); anything you add to the phone stays solid, so `phone.add(board)` and `phone.setXray(k.ramp(t, t0, t1))` show the parts inside (`o` overrides `floor` / `screenFloor`). Anchors `screen camera faceId` (the sensors in the island). `userData { width, height, depth, screenSize, perMetre, size, radius }`. |
| `globe({ radius 1, sun [1,.25,.6], night 1, clouds .9, atmosphere 1, rimColor, segments 128, dayBoost 1, lights 1, earthshine .06 })` | **Async.** Earth with day/night, city lights, clouds, ocean glint and atmosphere. `sun` is a world direction. `earthshine`: the night side keeps a faint cool copy of the day side's albedo (clouds included, brightest facing the camera), so with `lights: 0` the planet still reads as a ball, never as a black hole; `0` is the old pure-black night side, `.setEarthshine(v)` sets it (pure); `.setLights(v)` sets the city lights (pure: cities that light on a word). Anchors `north`, `south` and every `CITIES` name, on the surface and turning with the globe (`globe.anchor('Tokyo')`). `.pin(lat, lon, alt .004, name)` adds one (named pins join the anchors). `.latLon(lat, lon, alt)` local point, `.setSun(v)`, `.surface`. 4096 px textures: holds up to a continent filling the frame; closer, hand over to another shot. **`.lightDots(count = 3500, { threshold .3, size (.003 x radius), color '#ffe8c6', intensity 1, seed 3, alt .004 })`**: receivers, people or devices as glowing dots where the city lights are (sampled from the night texture: brighter places get more, at an even density per area), just above the surface and turning with the globe. Synchronous (it reuses the loaded texture); added to the globe. Returns `Points` with `.reveal(t, { from, t0 0, speed 1.2 })` (lights them in a wave spreading from `from`, a local point such as `globe.latLon(lat, lon)` or `[lat, lon]`, at `speed` radians a second from t0; before any reveal they are all on), `.ping(v)` (swells and brightens them), `.setGain(v)`, `.count`. `size` is a dot's diameter in world units; dots keep their size at any render scale. |
| `CITIES` | `{ 'Los Angeles': [lat, lon], 'New York', 'London', 'Shanghai', 'Tokyo', ... }` (20 places). |
| `text3d(text, { size .3, font 'Inter', weight 800, color, bg, pad .35, radius .25, glow 0, px 160, letterSpacing -.02, align, opacity })` | Crisp text on a plane (`\n` for lines). `bg` makes a tag or a board; `glow > 0` makes it emissive. `.setText(s)` (rebuilds; do not call every frame), `userData.size`, `userData.radius`. |
| `imagePlane(url, { width 1, glow 0, radius 0, transparent, side, tonemap 'none', look, highlights 6 })` | **Async.** Prefer `k.imagePlane(rel)`. `glow 0` lights the image like a print; `glow > 0` sends it in as plain light x glow, which AgX flattens and washes out (a photo at glow 2 came out 31 grey levels off its file on average). **`tonemap: 'inverse'`** runs it through the inverse of the film stage's AgX curve, as `clipPlane` and `plate` do, so after bloom, AgX and the grade it looks as in its file (3 levels off on the same photo); `glow` is then a gain on that (1 = as in the file), `look` defaults to the palette's. Unlit, so give it no light. |
| `loadTexture(url, { srgb true })` | **Async.** Prefer `k.image(rel)`. |
| `roundedRect(w, h, r)`, `planarUV(geo)` | Shape and UV helpers. |
| `withAnchors(g, anchors)`, `measureBounds(g)` | The prop contract for your own props (above). |
| `xray(object, v, { keep, floor .14, screen, screenFloor .45 })` | See inside any prop: as v goes 0 -> 1 every mesh under `object` (or in a list of meshes) fades to `floor` of its opacity and stops writing depth past v 0.5, except what is under `keep` (an `Object3D` or a list), which stays solid: put the parts inside there. `screen` (a mesh) fades only to `screenFloor`. Pure: call it every update; at v = 0 every material is exactly as built. Materials change in place ([18](#18-gotchas)). |

### devices

Modelled from real measurements and scaled by `perMetre` (world units per metre). Pass the natural size option or
`perMetre`; give several props the same `perMetre` to stage them at true relative size (`REAL` lists real sizes in
metres). Props stand on y = 0, centred, front facing +z (stopwatch, magnifier and `earbud` are centred on
themselves). Each has `userData { perMetre, size: [w, h, d], footprint?, radius, center }`, `g.anchors` (named
`Object3D`s for labels, focus and `cam.frame`) and `g.anchor(name)`. `accent` defaults to the palette's.

| Factory | Options | Methods, anchors |
|---|---|---|
| `laptop` | `width 1.2, open 1, color 'silver' \| 'space' \| 'midnight' \| 'starlight' \| 'black', screen, glow 1.1, angle 112, backlight 0, wake true` | `setOpen(p)`, `setScreen(tex)` (about 1.55:1), `setGlow`, `setBacklight`; anchors `screen keyboard trackpad hinge` |
| `monitor` | `width 1.6, color, screen, glow` | `setScreen(tex)` (16:9), `setGlow`; anchors `screen stand` |
| `serverRack` | `units 42, racks 1, gap 0, height \| perMetre (1 unit per metre), seed, busy .6, glow .05, glowColor, ledIntensity 9` | `at(t, busy)`, `slide(i, p)`, `highlight(i, v)` (before `at`), `devices[{ type, rack, u, size, anchor }]`. Anchors: `top`, and one per device type in the rack, the top-most of each (`switch patch server1 server2 storage gpu blank`). |
| `router` | `width 1, antennas 4, color, ledColor, busy, fold 0` | `at(t, busy)`, `setFold(p)`, `antennas`; anchors `signal leds` |
| `cellTower` | `height 4, sectors 3, perSector 3, dishes 2, beacon, thickness 1.6, pads` | `at(t)` (beacon). Anchors `top`, `sector0`, `sector1`, ... (+z points outward; `anchors.sectors[k]` still works). |
| `padlock` | `width 1, open 0, finish 'brass' \| 'steel' \| 'black', glow 0, swing 35` | `setOpen(p)` (lift then swing), `setGlow(v)`; anchors `keyhole shackle` |
| `stopwatch` | `width 1, dial 'black' \| 'white', time 0, tick 0, sweep false` | `setTime(s)`, `setSweep(v)`; anchors `dial crown hand` |
| `magnifier` | `width 1, finish 'black' \| 'brass' \| 'silver', zoom 2.2, refract true, res 1024, distortion .22, fringe .012` | `setZoom(v)`, `lens` (mesh); anchors `lens handle`. The glass magnifies what is behind it `zoom` times about its centre, with a little pincushion and colour fringe at the rim. The scene is rendered again through the lens each sub-frame, so everything magnifies, glows and text included (about one more scene render per sub-frame at `res`). Focus `k.lens` on what is behind the lens and it stays sharp in the glass while the rim softens. `zoom` 1 to 2.5 is the "zoom in" beat. `refract: false` is a reflective lens with no extra pass. |
| `microwaveOven` | `width 1.6, open 0, on 0, color 'steel' \| 'black' \| 'white', display '0:30', rpm 6, displayColor, enamel '#2a2c30', enamelGlow .05, door true, lamp '#ffd9a0' \| { color '#ffd9a0', intensity 1, shadow true }` | `setOpen(p)` (no-op with `door: false`), `setOn(v)`, `at(t)` (turntable), `setDisplay('1:25')`, `setDisplayGlow`, `plate` (group that turns), `lamp` (the SpotLight), `door` (`null` with `door: false`); anchors `display window cavity plate cavityCam waveguide` (the cover on the cavity's right wall, where the microwaves come in) |
| `earbuds` | `width 1, open 0, color '#f5f7fa', tipColor '#dfe2e5', led '#46ff7e', ledIntensity 4, angle 105` | `setOpen(p)`, `setLed(color, k)`, `lift(p, t, { height, spread, forward, bob })`, `setCase(v)` (false hides the case and keeps the buds: a close-up of lifted buds otherwise has the bright out-of-focus case right under them, in the caption band), `buds[2]` (`userData.home`), `lid`; anchors `led lid buds budL budR` |
| `earbud` | `width .4, side 'left' \| 'right', color '#f5f5f2', tipColor '#e4e6e8'` | anchor `tip` |

- **microwaveOven.** The cavity is dark enamel (`enamel`, with `enamelGlow` of the lamp's colour when on) lit by the
  lamp, a shadow-casting warm spot under the ceiling aimed at the plate, so food on the plate shades itself and the
  walls fall off into the corners: it reads as a lit box, not an evenly glowing one. `lamp` takes a colour or
  `{ color, intensity (a multiplier on the default), shadow }`; `k.softLight(mw.lamp, size)` softens its shadows. The
  lamp is switched off (no shadow pass) while `on` is 0. A perforated vent sits on the back wall. The turntable is lit
  glass (transmission): it shows the floor through it and catches the lamp's highlight. `door: false` leaves the door
  off, a cutaway the camera can look straight into; the `window` anchor then sits in the opening. `cavityCam` is a
  camera spot 0.7 m (real) from the plate and 24 degrees above it, in front of the opening:
  `cam.apply(camera, { pos: mw.anchor('cavityCam').getWorldPosition(v), look: plateWorld, fov: 30 })` frames the food
  with the lit back wall and vent behind it and the oven's dark frame across the top and bottom (snippet 34). With the
  door shut the window reads dark on the dark enamel; for a glowing "it's running" window pass `enamelGlow: 0.2` to
  `0.3`.
- **earbuds / earbud.** The shell is glossy white polycarbonate: a satin base (rough .3) under a clear coat (ccRough
  .08); the ear tips matte silicone (rough .7 with a soft sheen). Each bud has a dark acoustic-mesh grille on the
  outer shoulder and at the top of the stem, the speaker port's mesh in the ear tip's opening, and the optical sensor
  dot on the inner side. The case has a grooved lid seam, a brushed steel hinge and the round pairing button on the
  back, and a status LED that glows softly through the front. `case.lift(p, t, { height 1.02, spread .33, forward .1
  (x the case width), bob 1 })`: the buds rise out of their wells (p 0..1, eased) to float `height` above them,
  `spread` apart and `forward` out, turned towards the front, with a slow float once up (`bob: 0` holds them still).
  Pure; returns the right bud's world position; the `budL` / `budR` anchors follow. White plastic reads mid-grey in a
  night world unless a light falls on it: give the case `k.look.productLight(k.scene, pods)` (snippet 33). Floating
  buds leave that light's cone: aim a second one at `pods.anchor('budR')`.

Helpers:

- `REAL`, `slabGeometry(w, d, h, { rc, top, bottom, topKind, bottomKind })` (rounded or chamfered slab),
  `wallpaper({ w 1600, h 1034, accent, glow, bg, ui true })` (a desktop screen texture; `accent` is the palette's by
  default and its second ribbon a deeper shade of it; `ui: false` and a portrait size for phones).
- `contactShadow({ width, depth, opacity .55, spread .35, shape 'box' | 'round' })`: soft floor shadow sized to
  `userData.footprint`. `'round'` is an ellipse `width` x `depth` for bowls, cups and cans, and anything standing on
  glass (which takes no shadow map).
- `mapScreen({ w 1179, h 2556, seed 3, accent, dots 90, spread 2.4, title 'My Location', place, background })`: an
  HTML template for `k.screen`: a night-mode street map (a river, parks, a turned street grid, arterials), your
  location dot in the accent with its accuracy circle, a ping ring, other receivers around you and a location card.
  Returns `{ w, h, html, css, background, set(root, state), receivers }`. `set(root, { accuracy 0..1 (the circle
  shrinks from 900 to 150 px onto your dot), ping 0..1 (a ring leaves the dot; hidden at 0 and 1), card 0..1 (the card
  rises in), scale (the map's zoom: 1; 0.42 shows the receivers around you), dots 0..1 (the receivers appear,
  staggered) })`.
- `nowPlayingScreen({ w 1179, h 2556, title 'Night Drive', artist 'Neon Coast', device 'Earbuds', accent, seed 11,
  elapsed 42, length 213, background, playAt })`: a music player's Now Playing screen with generic sunset-road cover art, a
  live waveform in the accent, progress, controls and a "Connected" card for earbuds. Returns `{ w, h, html, css,
  background, set(root, state), timeline(times) }`. `set(root, { t, playing 0..1, press 0..1, ring 0..1, wave 0..1
  (default = playing), bits 0..1 (every other bar fades), card 0..1, elapsed (s) })`. `timeline({ play, connect, wave,
  bits })` returns an `update(t, root)` that runs those beats at those shot times (omit any): the press and ring on
  `play`, the card up 0.3 s from `connect` and away 1.1 s later. `playAt: hand.thumbUV()` moves the play button under
  the kit hand's thumb (kept 140 px inside the screen) and hides the skip buttons: the thumb lands near the screen's
  edge at mid-height, never on the bottom-centre controls.

Both screens are laid out for a phone at 3x and scaled to `w` x `h`, and both are pure: work the state out from `t`
with `k.ramp` and pass it to `set` in `scr.update` (`const scr = await k.screen(map); scr.update = (t, root) =>
map.set(root, { accuracy: k.ramp(t, t1, t1 + 0.45) })`).

### space

| Factory | Options | Methods |
|---|---|---|
| `satellite` | `size 1 (bus height), panels 1, wing 0, foil 'gold' \| 'silver' \| 'black', wingPanels 2, seed, env 'orbit' \| null, sun, envIntensity` | `setPanels(p)` folds the wings, `setWing(rad)`, `antenna` (Object3D, beam origin; the Earth face looks down -y). Anchors `bus antenna wingL wingR`; the wing anchors sit mid-wing on the cell side and ride along as the wings unfold. The panel backs show the cells' backs, close to the front in tone, so a wing turning over does not flash. Builds in about 0.1 s per foil map, which is cached after the first build. |
| `moon` | `radius 1, seed, maria 1, craters 1, color, mareColor, segments 192, sun 'view', phase 70, sunAngle 25, sunColor, sunIntensity 3` | `latLon(lat, lon, alt)` (unit sphere; the group carries the radius), `pin(lat, lon, alt, name)`, `surface`; anchors `north south`. The Moon only shows relief along its terminator, so by default (`sun: 'view'`) it lights itself from beside the camera: `phase` degrees round from it (0 full, 90 half), from `sunAngle` on screen (0 right, 90 top). The terminator stays in frame wherever the camera is, and turns with it. `sun: [x, y, z]` is a fixed world direction to the sun (for orbits, or to match other lit props). `sun: 'scene'` uses the scene's key light and its shadows; a frontal key flattens it. The light's colour and strength come from the scene's first directional light, else `sunColor` x `sunIntensity`. |
| `sun` | `radius 1, intensity 1, color, core, corona 1, light 0, seed` | `at(t)`, `setIntensity(i)`, `light` (a PointLight when `light > 0`) |
| `galaxy` | `radius 5, arms 2, count 90000, pitch 19, thickness .05, spin .02, seed, intensity, core, dust .45, jet false, quasar false, jetLength .7, jetIntensity (1; 1.6 with quasar), armColor, coreColor, knotColor` | `at(t)` turns it, `setJet(p, intensity = jetIntensity)` grows the jets (p clamps at 1; the intensity has no cap: `setJet(1, 1.6 * (1 + 1.4 * flash))` on the word), `setFlare(v)` scales the quasar's flare (1 default, 1.5 to 2 on the word); `jet`, `flare`, `stars`; anchor `core`. Lies in XZ. `dust` 0.45 (at 1 the lanes read as black holes when the disc fills the frame). Jets (`jet: true`, built fully grown): thin collimated cones with a hot spine and a faint sheath, brightest at the core and fading outwards, with bright knots riding out along them. `quasar: true` (implies `jet`) adds the hook's lens flare: a blinding point that reaches 240 to 255 after the tone map, a round halo 2 to 3% of the frame width that fades to nothing before the flare's own quad ends (it used to stop at the quad's edge, a lighter rectangle round the core on a dark sky), and a horizontal streak about 3 px thick at 1080 x 1920 with a soft skirt (it was a 1 px line no one saw at phone size), in screen space (their size does not change with distance), depth-tested (a planet in front hides it) and lens-aware. |
| `orbit` | `radius 3, inclination 0, node 0, center, segments 256, color accent, intensity 3, width .008, ghost 0, ghostColor, core, start 0` | `draw(p)`, `window(a, b)`, `pointAt(u)`, `curve`, `normal`, `setIntensity(i)` |
| `constellation` | `planes 6, perPlane 4, radius 4.2, inclination 55, period 40, size .07, color accent, ringIntensity .4, ringWidth .0035, glint 1.2, seed` | `at(t)`, `positionOf(i, t)`, `orbits`, `satellites`, `count` |
| `asteroids` | `count 500, shape 'belt' \| 'field', radius 6, width 1.6, thickness .35, extent [10,4,10], size .09, seed, variants 5, detail 10, color, orbitSpeed .01, tumble .25` | `at(t)` |
| `swarm` | `count 2600, rMin 1.08, rMax 1.7, mid .12, rMid 4.17, size .03, color '#dfe6f5', seed 8, period 30` | `Points`: thousands of satellites as specks on circular orbits of random inclination round the origin (an Earth of radius 1): most in low orbit between `rMin` and `rMax`, `mid` of them in a shell at `rMid` (where GPS flies). Inner ones move faster (Kepler; an orbit at r 1.1 takes `period` s). The orbits run on the GPU, so thousands cost nothing per sub-frame. `at(t)`, `reveal(p)` (fades them in, staggered), `setGain(v)`. `size` is world units; specks keep at least 1 px and dim instead of vanishing. |
| `rangeSphere` | `radius 1, color accent, intensity 1, opacity .18, segments 96` | A `Mesh`: every point one distance from a satellite, drawn as a fresnel rim only (additive, a soap bubble's outline), no latitude grid. Keep `opacity` at 0.2 or less, so the Earth and the other spheres show through. Put it at the satellite. `set({ radius, opacity })` in update (pure); `userData.radius` follows. The shell fades out where it comes within 0.2 of its radius of the lens (from 0.02), so a camera flying through it never flashes; no opacity fade by hand is needed. |
| `crossingCircle` | `(a, b, { color accent, intensity 5, width .008, segments 256 })` | A `Group`: the circle where two range spheres cross, as a glowing ring. `a`, `b`: `rangeSphere`s (or `{ position \| center, radius }`) in the circle's parent space. `update()` re-reads both (call it in update while their radii animate; pure); `center`, `radius`, `normal`, `exists` (false, ring hidden, while they do not meet); `draw(p)`, `setIntensity(i)`, `pointAt(u)`, `ring`. `faceOn(dist, from = [0, 0, 10])` returns a camera pose `{ pos, look, fov }` on the circle's axis, on `from`'s side (`dist` defaults to `cam.fit(radius, { fill: .6 })`): seen at an angle the circle is a thin ellipse or a line, so the beat that names it frames it face-on (snippet 39). |

Helpers: `orbitQuaternion(inclination, node)`, `rockGeometry({ seed, detail, roughness, squash, cuts, dents, crease })`,
`orbitEnvironment({ sun, earth 62, seed })` (env map so metal reads in empty space), `noise3`, `fbm3`, `glslNoise`.

### world

| Factory | Options | Methods |
|---|---|---|
| `city` | `size 24, blocks 10, seed, lit .3, height 1, downtown 1, traffic 500, lamps, beacons, sprawl 2.5, windows 1.5, glass .6, windowColor, coolColor, lampColor, wallColor, groundColor` | `at(t)` (traffic, beacons), `buildings`, `ground`. Anchors `center` (ground, middle), `tallest` (top of the tallest tower), `street` (mid-block on the street nearest the middle). `userData { radius, pitch, street, floor, tallest }`. |
| `terrain` | `size 40, height 3, seed, segments 256, scale 1, ridge .35, warp .6, flat 0, color, color2, grid 0, gridSize 1, gridColor accent, gridWidth .02, wire 0, wireColor, wireSize, scan 0, scanSpeed 4` | `heightAt(x, z)` (its own space), `heightAtWorld(x, z)` (world units in and out, wherever it is moved, turned or scaled), `at(t)` (scan ring), `surface`. Keep `blur` at 0.004 or less when a grid runs to the horizon. |
| `oceanFloor` | `size 60, seed, dunes .25, ripples 1, rippleAngle 35, rocks 140, snow 900, caustics 0, color '#222c46', rockColor '#0c1222', snowColor, causticColor, segments 240` | `heightAt(x, z)` (its own space), `heightAtWorld(x, z)` (world units in and out: lay a cable on a floor you moved), `at(t)`, `snow` (fx.dust). The default sand is a deep blue-grey (tested values): the old `'#6a7086'` read milky, YAVG 73 to 76 under the ocean-blue rig, now about 39. |
| `desk` | `width 3.2, depth 1.6, thickness .07, wood 'walnut' \| 'oak' \| 'ash' \| 'maple' \| 'teak' \| 'white' \| 'black' \| colour, legs false, legHeight 1.4, radius .012, grain 10, seed, tone, rough, sheen` | Top surface at y = 0. `tone`: a brightness multiplier on the wood or laminate colour (0.25 is a dark walnut nightstand); `rough`: the base roughness; `sheen`: the clear coat. Walnut defaults to a dark oiled walnut (`tone` .5, `rough` .78, `sheen` .15, coat roughness .38) so a cool rim does not glare mid-blue off it (at .66 it still did); the other woods keep `tone` 1, their own roughness and `sheen` .35. A lighter lacquered walnut: `{ tone: 1, rough: 0.5, sheen: 0.35 }`. `surface`; anchor `top`; `userData { top, size }` |
| `room` | `width 7, depth 6, height 3.2, win { wall, width, height, sill, offset, panes }, floor 'oak', wallColor, sun, sunAngle [34, -28], sunColor, sunIntensity 7, sky 2.6, shaft 1, motes 500, bounce .35, ceiling, seed` | `at(t)`, `sun` (shadowed light: `k.softLight(room.sun, 0.15)`), `window { center, normal, width, height }`, `floor`, `bounce`; anchors `window` (its centre), `floor`. Open side faces +z. |
| `road` | `length 60, path, lanes 2, laneWidth .9, shoulder .3, center 'dashed' \| 'double' \| 'solid', wet .35, lamps 0 (spacing), lampSide, lampHeight 1.7, lampColor, lampIntensity, traffic 0, speed 3, seed, color` | `pointAt(u, lateral)`, `frameAt(u)`, `curve`, `at(t)` |
| `tree` | `height 1.6, seed, style 'round' \| 'pine' \| 'birch', color, trunkColor, detail 5` | A smooth-shaded stylised tree with a leaf bump: soft lumpy canopy puffs ('round', 'birch') or drooping tiers of branch clusters ('pine'). Base at the origin. `detail` subdivides the canopy. |
| `forest` | `count 200, area [30,30], height 1.6, seed, styles, heightAt, clear 0, center, variants 6, color, trunkColor, detail 3` | Instanced; `heightAt` from a terrain places them on it. |
| `noodleBowl` | `radius .7 (the rim), height .62, strands 64, seed 4, glaze '#17171a', noodle '#e4b462', broth '#5e2e0e', level .62, noodleRadius .024 (x radius), shadow true` | A dark stoneware bowl of crimped instant noodles piled into a mound over glossy broth with drops of oil, standing on y = 0 (on a table, or added to `microwaveOven().plate` so it turns). The last strand lies across the crown: the hero noodle a camera can dive into. `shadow`: a round contact shadow under it (it shows on glass). `setHeat(v)` 0..1 warms the noodles (a faint glow from inside) for "it heats up"; `heroCurve` (a `Curve3` along the hero noodle, bowl space), `noodleMat`. Anchors `top` (the crown of the mound), `hero` (the middle of the hero noodle), `broth`. `userData { radius, center, size }` |

Helpers: `noise2`, `fbm2`.

### science

Pass `{ pal: k.pal }` to every one, and call `k.env()`: glossy surfaces get their look from reflections. Every one
has `userData.radius`; the instanced fields (`glyphField` and those built on it) measure it from their home layout.

| Factory | Options | Methods |
|---|---|---|
| `molecule` | `atoms [{ el, pos, q }], bonds [[i, j, order]] (auto if omitted), model 'ball' \| 'space', style 'pearl' \| 'glass' \| 'soft' \| 'matte' \| 'glossy', env 'product' \| 'scene', scale 1 (units per angstrom), charges, chargeSize .32, signOffset (.29 x scale), bondStyle 'neutral' \| 'split'` | `at(t, { vibrate, freq, mode })`, `setCharges(v)` (all), `setCharge(i, v)` (one atom: an index or an anchor name, `setCharge('O', 1)`), `atoms[i]`. Anchors: the atoms, named by element and numbered when one repeats (water: `O H1 H2`, methane: `C H1 H2 H3 H4`); `anchor(i)` also takes an atom index. `signOffset`: how far past its atom's surface a delta sign sits. |
| `water`, `co2`, `methane`, `ammonia` | Same options. | Presets (`MOLECULES` also has `oxygen`, `nitrogen`, `hydrogen`; `ELEMENTS` has colours and radii). |
| `moleculeCloud` | `kind 'water' \| spec, count 300, size [8,5,6], shell [rMin, rMax], center [0,0,0], scale .35, model 'space', style 'matte', colors, glow` | `at(t, { twist, freq, axis, jitter, drift })`, `setTint(i, color, k = 1)` (molecule i's atoms mix towards a colour), `setGlow(i, v, color = accent)` (molecule i glows; linear colour x v), `clearLine(from, to, radius)` (at build time, moves every molecule within `radius` of the segment, the camera's line of sight to the hero, sideways out of it; returns how many). The setters write per-instance attributes and overwrite: set them in update. Around a ball-and-stick hero (`water()` at scale 1), match it: `model: 'ball'`, `scale: 1`. They act on the atoms, not on the bonds of a `model: 'ball'` cloud. `shell` fills a spherical shell (even in volume) around `center` instead of the box `size`, so a camera orbiting a hero inside `rMin` sees molecules in every direction. |
| `dottedBond` | `count 5, size .05, color '#ffffff', intensity 3, inset .18` | An `InstancedMesh`: a hydrogen bond (any weak link) as a row of glowing dots between two points that can move. `set(A, B, p = 1, glow = 1)` every update: `A`, `B` are `Vector3`s in the bond's parent space, `p` draws the dots on in order, `glow` scales the brightness; `inset` keeps that fraction of the distance clear at each end. |
| `atom` | `shells [2, 8, 1]` or `electrons 6` (filled 2, 8, 8, ...), `protons, neutrons, radius 1.5, nucleusRadius .26, tilt 1, speed 1, trail .22` | `at(t)`, `setGlow(v)`, `electrons[i]`; anchors `nucleus`, `shell0`, `shell1`, ... (`anchors.shells[k]` still works) |
| `transistor` | `kind 'finfet' \| 'sheets', fins, xray, colors, env 'product' \| 'scene', envIntensity .6, on 0` | `setOn(v)`, `setGate(v)`, `setChannel(v)`, `at(t)`; anchors `gate source drain channel`. 1.36 x 1.04 x 1.45. Metal greys by default (`colors` keys and defaults: `base '#14171c'`, `oxide '#2b2f37'`, `fin '#8b94a3'`, `body '#353a44'`, `gate '#b8bdc6'` (brushed), `spacer '#5d636e'`, `metal '#d2b48a'` (the copper-warm contacts)); `env: 'product'` reflects the product studio so they read as metal in a night world. `setGate(v)` lights the gate contact (the brushed gate only warms, 0.12); `setChannel(v)` lights the fins and the electrons: the accent marks only the active part. |
| `transistorArray` | `cols 15, rows 15, spacing 1.75, kind, skip: (c, r) => bool, colors, env, envIntensity` | `setOn(i, v)`, `on((i, c, r) => v)`, `index(c, r)`, `pos(i)`. The same colours and env as `transistor`. |
| `chipDie` | `size 2, aspect 1, thickness (.025 x size), blocks DIE_BLOCKS, substrate true, iridescence .35, env 'product' \| 'scene'` | `highlight(name, v, { fill, edge })` (`'CPU' 'GPU' 'Cache' 'NPU' 'Memory' 'Media' 'Radio' 'I/O'`). Anchors: every block by name (`die.anchor('GPU')` throws on an unknown block). `blocks`, `top`. Every depth follows the size: the die is 0.025 x size thick, the substrate 0.035 x size, the capacitors and solder balls scale by size / 2, so a fingernail-sized die is a thin plate, not a cube (pass `thickness` for an absolute one). |
| `wafer` | `radius 1.5, dies 13, iridescence 1, env 'product' \| 'scene'` | Mirror wafer with thin-film rainbows, reflecting the product studio (with `env: 'scene'`, light it with `k.env('studio')`). |
| `boule` | `radius .62, length 2.6, crown true, seed 3.7 (rod length, in radii), ridges 4, ridge .007 (radii), tail false, color '#c6cbd4', rough .24, env 'product' \| 'scene', envIntensity .9, segments 256` | A Czochralski silicon crystal standing on its cut end at y = 0: the body with growth ridges down it, the shoulder (crown), the thin neck and the seed rod, the three features that make it nameable from a still. Polished silicon with growth striations round it. `crown: false` is a trimmed ingot with bevelled ends (lay it down to slice it); `tail: true` ends the body in a rounded tail cone. Anchors `bottom body shoulder neck seed` (`body`, `shoulder`, `neck` on the +z surface, for labels). `userData { radius, center, length, height }`, `body` (the mesh). |
| `waferStack` | `count 10, radius .62, thickness .02, gap .05, axis 'y' \| 'x', dies false \| true \| n, spread 1, edgeColor '#e8ecf2', env` | Polished wafers piled up from y = 0 (`'y'`) or standing in a row like slices off a boule (`'x'`, from x = 0, on their edges at y = 0). A wafer reads as one by its bright thin edge and a stack of them. `spread(p)` opens the gaps (0 touching, 1 the full gap; pure; the anchors follow), `wafers[i]`. `dies: true` (13 across) or a number prints the die grid on the faces, one texture for all. Anchors `top edge center` (`edge` is on the middle wafer's rim, facing +z). |
| `pcb` | `size [4, 2.6], thickness (.015 x size[0]), color 'green' \| 'black' \| 'blue' \| 'red', seed, density 1, chip true \| 'footprint' \| false, parts true` | `traces[i] { curve, points, length }` (board space, longest first), `chipTraces()` (the traces that leave the chip's pad ring, each ordered from the chip outwards, so a pulse placed 0 -> 1 runs out of the chip), `lightTrace(i \| trace, { color, intensity })` (a `glow.tube`), `traceWidth`, `footprint { center, size }` (local: the chip square on the board's top), `toLocal(u, v)`, `chip` (mesh), `top`. Depths follow the width: board 0.015 x size[0], chip body 0.0175 x size[0], parts and lifts likewise (pass `thickness` for an absolute board). `chip: 'footprint'` draws the pad ring and silk outline without the chip body, to seat a `chipDie` there: `chipDie({ size: pcb.footprint.size * 0.92 })` at `pcb.footprint.center` (snippet 38). Anchor `chip`: the top of the body, or the board surface at the footprint's centre. |
| `fiberCable` | `radius .6, length 8, step .42, fibers 8, layers FIBER_LAYERS, reach 2.2, pulseSpeed 1.6, light 0` | `setLight(v)`, `at(t)`; anchors `jacket armour copper insulation core tips` (on each layer's cut face) |
| `glyphField` | `count, geometry, label (i) => str, face 'top' \| 'front', material 'physical' \| 'basic', textSize, maxWidth, tracking, selfLit, chars, font, weight, home` | Instanced mesh with per-instance labels (up to 12 characters). `set(i, { label, color, glow, ink, inkGlow, labelAlpha })`, `setLabel`, `setColor`, `setGlow`, `setInk`, `layout((i, o) => { o.pos, o.rot, o.q, o.scale, o.s, o.hide })`, `worldPos(i)`, `home(i)` |
| `packetField` | `count 1500, cols 50, size [.5,.16,.3], gap [.1,.1], label, look 'solid' \| 'dark', layout 'grid' \| 'block', block [nx, nz, ny], heroSlot, hero, heroInk, heroInkGlow` | glyphField plus `burst(t, { t0, dur, from, spread, lift, stagger })`, `stream(t, { curve, speed, spacing, flip })`, `pluck(t, i, { t0, dur, to, scale, spin })` (after this frame's layout), `ripple(i, t, { t0, center, speed, width })`, `fromBlock(t, { t0, dur .6, wave .085, jitter .08, lift .6, spin 1.2, offset, ease })`, `gridPos(i)`, `blockPos(i)`, `block`, `heroSlot`. `layout: 'block'` rests the packets packed almost touching in one solid block standing on y = 0 (`block` defaults to about square in plan, `ny` layers; x fastest, then z, then up). `fromBlock` starts every packet in the block and, after `t0`, arcs each to its grid slot in a wave from the block's centre, nearest first (`wave` s per unit of distance): "it splits into 1,500 packets". `offset` moves the block before the split (slide, jam, recoil). `heroSlot` / `hero`: packet number `hero` (as labelled, 1-based: `hero: 847` is `#0847`) sits in instance `heroSlot` and the packet that was there takes its number, so the hero rises from the slot nearest the camera: `field.pluck(t, field.heroSlot, { to })`. Works with a custom `label` too (it is called with the swapped index). The hero's number glows (`heroInk`: cream on the solid look's accent plastic, the accent on the dark look; `heroInkGlow` 1.6 / 2.5), so it reads when plucked up to the camera with no light on its face (a test reel needed a point light on it; dark ink on unlit plastic was unreadable); `heroInkGlow: 0` prints it like the rest, `F.set(heroSlot, { ink, inkGlow })` overrides it. |
| `bitField` | `rows 12, cols 20, cell .2, style 'tiles' \| 'glyphs', face 'front' \| 'top', value (i) => str, hot '1'` | `flipAt(t, { t0, dur, delay, to, lift })`, `scramble(t, { rate, chars, len, amount })`, `pop(t, { t0, dur, delay })`, `reset()` |
| `dataTiles` | `image (url, texture, img, canvas), cols 48, width 4, label 'none' \| 'lum' \| 'hex' \| 'bits' \| 'bit' \| fn, face` | **Async.** `pixels[i] { r, g, b, l, x, y }`, `mix(v)` photo > neutral tiles, `autoInk()`, `layout(...)` |

Helpers: `glyphAtlas({ chars, font, weight, px })`, `productEnv()` (the product studio, an env for one material's
`envMap`: `chipDie`, `wafer`, `boule`, `waferStack`, `transistor`, `transistorArray` and the `pearl` and `glass` atoms
reflect it by default; `env: 'scene'` for the shot's own environment), `DIE_BLOCKS`, `FIBER_LAYERS`, `MOLECULES`,
`ELEMENTS`. Label fonts must be loaded before build: the engine preloads Inter 400-900 (with its Greek subset) and
Barlow Condensed 500-800; `await k.font(spec)` for anything else.

- **Atom styles.** `'pearl'` (the default for `molecule`) is a frosted translucent pearl lit from inside: a
  transmissive shell in the element's colour (roughness .32, transmission .4) with an inner glow brightest where it
  faces the camera and a faint lit rim, around an emissive core (0.55 r, 0.7). It never goes dark at the silhouette.
  `'glass'` is a clear shell around a coloured core, with a long attenuation (8 x scale), the product studio's
  reflections and a faint lit rim, so its rim does not refract the dark world into a black ring. `'matte'` (the
  default for `moleculeCloud`: no clearcoat, roughness .55, env .5) is for crowds out of focus: pinpoint highlights
  multiply into lattices there. `'soft'` is a clearcoat marble lit from within, `'glossy'` candy plastic. Heroes in
  `'pearl'`, crowds in `'matte'`.

### plates

`plate({ image, width 4, depthScale 1, segments 512, pivot, fov, edge 25, layers 2, reach .12, skirt .25, look .35,
tonemap 'inverse', highlights 8, brightness 1, maxDepth 12 })` (**async**) turns a still made by `plate.mjs` into a
2.5D set: `view()` (the still's own camera pose: start moves there), `pointAt(u, v, lift)`, `localAt`,
`pin(u, v, lift, name)` (label anchor; named pins join `set.anchors`, and `set.anchor(name)` finds them),
`curve([[u, v], ...], { lift })` (for `glow.tube` / `pulse`), `normalAt`, `depthAt`, `toUV(point)`,
`setBrightness(v)`. `userData.radius` covers the picture plane. Also `decodeDepth(url)` and `inverseToneLUT(o)`. When
to use one, prompts, and how far the camera can move: `references/plates.md`.

### charts

Data props for numbers, comparisons and growth. Each grows or draws on from one parameter (call it every update; pure),
gives the accent (`accentDefault()`, or pass `accent` / `pal`) to the one thing the story is about, and has `g.anchors`,
`g.anchor(name)` and `userData { radius, center, size }`, so `cam.frame(prop, { az, el, fill })` frames it. Surfaces
reflect the palette-tinted type studio (`typeEnv`), so metal reads as metal in any world; `reflect: 'scene'` uses the
scene's environment instead. Printed labels and values are flat Inter type. Text that changes takes values of the
frame time: shots get `update(t, ft)`; pass the same ramp of `ft` so digits stay crisp under motion blur.

| Factory | Options (defaults) | Methods, anchors |
|---|---|---|
| `bars(values, o)` | `labels` (printed on the plinth front), `highlight 'max'` (an index, or `null` for none), `values false` (print each value above its bar), `format (v) => string`, `width .3`, `depth` (= width), `height 1.6` (the bar of `max`), `spacing .45` (gap / width), `max` (largest value), `min 0`, `material 'metal' \| 'frosted' \| 'glass' \| 'ceramic'`, `color`, `stagger` (up to .14 of p between bars), `order 'index' \| 'value' \| 'center'`, `ease 'outCubic'`, `plinth true`, `plinthHeight`, `labelSize .3 * width`, `valueSize .34 * width`, `edge 5`, `light true`, `lightIntensity 1` | `grow(p, textP = p)`: heights from `p`; printed values count with `textP`. `highlight(v)` 0..1: the accent bar's glowing top edge, inner glow and warm light (default 1). Parts `bars`, `labels`, `values`. Anchors `bar0`, `bar1`... (top of each bar, they move), `hero` (top of the accent bar), `label0`..., `top`, `base` (plinth front), `center` |
| `lineChart(points, o)` | `points`: numbers (evenly spaced) or `[x, y]` pairs. `width 2.4`, `height 1.4`, `depth` (= width / 2, the floor grid), `min` (0, or the data minimum if lower), `max` (data max + 8%), `xMin`, `xMax`, `smooth true` (monotone: never overshoots a point), `radius .0065 * width`, `intensity 4.5`, `area true`, `areaOpacity .42`, `grid true`, `gridColor`, `gridIntensity` (from the palette's brightness), `yTicks 4`, `xTicks`, `dots true`, `dotSize 2`, `head true`, `headIntensity 9`, `drop true` (a line from the head to the floor), `labels` (x labels on the floor's front edge), `labelSize`, `labelTilt .9` (`Math.PI / 2` stands them up), `light false` | `draw(p)`: p is the x progress (time); the head rides the newest point. `pointAt(i)` (world position), `curve`. Anchors `head` (moves), `p0`, `p1`..., `start`, `end`, `top`, `center` |
| `donut(fractions, o)` | Fractions or raw values (normalised; zeros skipped). `radius 1`, `inner .6`, `thickness .2 * radius`, `gap .022 * radius`, `bevel`, `fillet`, `highlight` (the largest; an index or `null`), `material 'metal' \| 'frosted' \| 'glass' \| 'ceramic'`, `colors [...]`, `face 'up' \| 'front'`, `clockwise true`, `values false` (`true` prints "62%" on each slice, or `(f, i) => string`), `valueSize`, `popDistance`, `popLift`, `edge 4.5`, `light true`, `ease 'linear'` | `grow(p)`: slices sweep in from 12 o'clock; their bevelled ends hold their shape. `pop(v)`: the accent slice slides out and lifts. `slices`. Anchors `slice0`..., `hero`, `center`, `top` |
| `stack(count, o)` | `item 'card' \| 'coin' \| 'brick'`, `size .5` (card width, coin diameter, brick length), `perStack` (card 24, coin 14), `cols`, `stackGap 1.22`, `layout 'stacks' \| 'wall'` (bricks default to a running-bond wall), `hero` (the last item), `tag` (printed on the hero's face), `tagColor`, `jitter 1`, `seed 7`, `fall` (items in flight at once), `drop 1.6 * size`, `lift [x, y, z]` (where `single` takes the hero), `heroScale .35`, `color`, `edgeColor`, `light true` | `fill(p)`: `p * count` items are in place, each dropping in. `single(v)`: the hero lifts out, turns its face to the camera, takes the accent with a glowing edge and shows its tag. `item` (the `InstancedMesh`), `heroMesh`. Anchors `hero` (follows it), `top`, `base`, `center` |
| `scoreboard(o)` | `digits 6`, `decimals 0`, `comma true`, `label` (printed in spaced capitals), `unit`, `value 0`, `width 2`, `depth .13 * width`, `font 'condensed' \| 'inter'`, `color` (accent), `intensity 3.4`, `leadingZeros 'dim' \| 'hide' \| 'show'`, `dim .07`, `split true` (the flip-clock line), `led true`, `housingColor` | `set(value)`: a number or string, clamped to the digits; call it with a value of `ft`. `setGlow(v)`. Anchors `display`, `label`, `top`, `center` |

### type

Real 3D type: glyph outlines of Inter 700 and 800 and Barlow Condensed 700, extruded with a rounded bevel (smooth
normals, flat faces), kerned with the fonts' own pair kerning, with tabular figures. Every letter is its own mesh. The
fonts are typeface JSONs in `kit/fonts/` (three.js typeface format in font units, plus `kern`, `tnum` and metrics),
converted from the OFL fonts whose licences sit next to them (`OFL-Inter.txt`, `OFL-BarlowCondensed.txt`). They load
when the kit starts, so `extrude` is synchronous. Coverage is the Latin subset (Basic Latin, Latin-1, curly quotes,
dashes, € ™ − ↑ ↓); → and ← are drawn by turning ↑; anything else draws as "?" and logs a warning.

`extrude(text, o)` returns a Group:

| Option | Default | |
|---|---|---|
| `size` | `.5` | Cap height in world units: digits and capitals are this tall (an em is about 1.37 x size). |
| `depth` | `.3 * size` | Extrusion. `0` = flat type, for labels printed on a surface. |
| `bevel`, `bevelSegments`, `curveSegments` | `.045 * size`, `4`, `8` | Rounded bevel; the outline keeps its size. |
| `font`, `weight` | `'inter'`, `800` | `'inter'` (700, 800) or `'condensed'` (Barlow Condensed 700). The nearest weight is used. |
| `material` | `'metal'` (flat: `'ink'`) | A preset below, a three.js material, or `{ face, side }`. Letters get their own clone. |
| `color`, `sideColor`, `intensity`, `rough`, `envIntensity` | per preset | `intensity`: emissive and ink brightness (HDR above 1). |
| `reflect` | `'studio'` | Reflections from `typeEnv` (palette-tinted studio), or `'scene'`. |
| `align`, `valign` | `'center'`, `'middle'` | `left \| center \| right`; `middle` (centre of the cap height) `\| baseline \| top \| bottom` sits at y = 0. |
| `tracking`, `lineHeight` | `-.01` em (Inter), `1.08` em | `\n` breaks lines. |
| `tabular` | `false` | Fixed-width figures. Use for anything that counts. |
| `unit`, `unitScale`, `unitGap` | none, `.4`, `.1` em | A smaller unit on the same baseline: `extrude('80', { unit: 'dB' })`. |
| `reveal`, `stagger`, `ease`, `order` | `'rise'`, auto, `'outCubic'`, `'start'` | The default style of `reveal(p)`; `order` is `start \| end \| center \| random`. |
| `shadows` | `true` | Letters cast shadows. |

A hyphen before a digit becomes a true minus ("−12.5%").

| Preset | Look |
|---|---|
| `metal` | Polished silver face (roughness .13), brushed sides (.4). The neutral hero number. |
| `chrome` | Mirror face and sides; needs a moving camera to show its reflections. |
| `brushed` | Brushed aluminium face with streaks. |
| `emissive` | Channel letters: a glowing face (`color` = accent, `intensity 4`) in a dark brushed-metal return. |
| `lit` | Frosted acrylic lit from inside (accent, `intensity 1.6`). |
| `glass` | Clear glass with dispersion. Reads only over something lit behind it. |
| `frosted` | Frosted acrylic with a little light inside (`glow .22`). |
| `plastic` | Lacquer over a satin base (accent). |
| `ceramic` | Glossy white ceramic. |
| `ink` | Unlit flat colour (`intensity .9`), for printed labels. |

| Method | |
|---|---|
| `reveal(p, style)` | Letters come in with a stagger. `'rise'`: up through a mask under each line (the cut reads as a solid section). `'drop'`: down through a mask above. `'flip'`: stand up about the baseline. `'pop'`: scale from nothing. `'glow'`: emissive and lit letters switch on with a short overshoot (other presets pop). `'draw'`: each outline traces on like a neon tube, then the letter fills with light from the bottom up. |
| `setText(str, unit)` | New text from cached glyphs (cheap). For counters, call it with a value of `ft`. The reveal state carries over. |
| `setGlow(v)` | Emissive, ink and lit brightness as a fraction of the preset's. |
| `letters`, `materials`, `width`, `height`, `text` | |

Anchors `center`, `front`, `top`, `bottom`, `left`, `right`, `baseline` (they follow `setText`). `userData { radius, size, box }`.

Helpers: `measureText(text, { size, font, weight, tracking, tabular })` returns `{ width, advance, em }` in world units
(one line). `typeface(font, weight)` returns the loaded face (metrics, glyphs, `kern`). `typeEnv(pal)` returns the
studio reflection map that type and charts use (set `material.envMap` to it on your own props).
`bevelNormals(geo, angle = 40, capCount = 0)` gives a non-indexed ExtrudeGeometry smooth bevels with flat caps (build at
about 100 units and scale the mesh). `TYPE_MATERIALS` lists the presets.

### model

`model(url, o)` (**async**) turns any GLB into a kit prop. Use it for real objects the kit does not model (a tooth, a toaster, a jet engine), usually made with `model.mjs`. It bakes every node transform into the geometry, turns the model to face +z with +y up, centres it, scales it to `size` and repairs broken normals. It can also replace the file's materials: generated textures carry baked-in light and shadow that fight `k.rig()`, so prefer a kit material unless colour is the point.

| Option | Default | |
|---|---|---|
| `size`, `fit` | `1`, `'max'` | World units for the largest side (`fit: 'height' \| 'width' \| 'depth'` picks one). |
| `up`, `front`, `rotate`, `mirror` | `'+y'`, `'+z'`, `[0,0,0]`, none | Which file axes are up and front; then an extra turn in degrees; `mirror: 'x'` flips. |
| `center` | `'bottom'` | `'bottom'` stands on y = 0, centred on x and z. Also `'center'` or `'none'`. |
| `material` | `'keep'` | `'keep'` (the file's own, with env reflections), `'clay'`, `'skin'`, `'satin'`, `'wire'`, `'xray'`, any `look.mat` name (`'plastic'`, `'metal'`, `'molten'`, ...), a Material, or `(mesh) => Material`. |
| `color`, `rough`, `metal`, `env`, `opacity`, `intensity` | per preset | Material overrides. `intensity` and `opacity` are for `wire` and `xray`. |
| `sheen`, `sheenColor`, `clearcoat`, `roughVar`, `mottle`, `scatter`, `scatterK` | `.5`, `'#ff9a80'`, `.2`, `.3`, `1`, `'#d0503c'`, `.12` | For `'skin'`, which is skin, not paint: grain at two scales (a fine bump and a low-frequency roughness variation, `roughVar`), soft albedo mottling (`mottle`: redder and paler patches), a salmon sheen, a thin soft coat (roughness .45) and a warm scatter rim (`pow(1 - abs(n.v), 2.5) x scatterK` emissive in the `scatter` colour, so the edges glow warm like skin; `scatter: false` turns it off). Default colour `#a8735e`. |
| `grain`, `grainScale` | per preset | Object-space micro-bump (no UVs needed): strength, and feature size as a fraction of the model's size. `0` turns it off. |
| `smooth` | `'auto'` | `'auto'` repairs missing or inward normals, `true` smooths (welded by position), a number is a crease angle, `false` keeps the file's normals. |
| `shadows` | `true` | Cast and receive. |
| `anchors` | `{}` | `{ name: [fx, fy, fz] }` (box fractions 0..1), `{ at: [fx, fy, fz], snap: '+z' }` (moved onto the surface from outside along that axis), `'NodeName'`, or a `Vector3`. |
| `crop` | none | A plane or a list of planes `{ normal, at (box fraction on that axis) \| point, name }`. Keeps what is behind every plane and caps each face with the solid's section. Applied in order: the first must cross the model where its surface is closed. |
| `cut` | none | Same plane form, plus `holes: [[Vector3...]]` (channels in the section). Removes the wedge in front of all the planes at once (a product cutaway) and caps its faces. |
| `capColor`, `capMaterial` | the model's material, 0.8x darker | Look of the section faces. |

Returns a Group with:
- `meshes`, `caps` (section meshes) and `capStats`.
- `anchors`: built-in `center top bottom front back left right` plus yours. `anchor(name)` throws on a typo. `addAnchor(name, pos)` and `frac([fx, fy, fz])` (box fractions to a point).
- `hit(origin, dir)`: `{ point, normal, distance }` or null, in prop space.
- `surfacePoints(n, seed = 1, o)` and `dots(points, o)`.
- `userData { radius, size, center, footprint, box, triangles, scale, fromFile, src }`. Frame it with `cam.frame(m.userData.center, m.userData.radius)`.

`surfacePoints(n, seed, { region: { min: [fx,fy,fz], max }, facing: [x,y,z], minDot 0.2, filter(p, nrm), even true, spacing, mesh })` returns `[{ position, normal }]`, deterministic and evenly spread (blue-noise dart throwing). It suits dot patterns, sparks and label spots. `even: false` is faster.

`surfaceDots(points, { size .006 (m.dots: 0.6% of the model), color accent, intensity 5, lift, opacity 1, from (Vector3 | 'random'), seed })` builds glowing discs lying on the surface, in one draw call. Its methods:
- `.reveal(p, { from, soft .15 })` grows them in from `from` (p 0..1, pure).
- `.setIntensity(i)` and `.setColor(c, i)`.
- `.count` and `.points`.

Also exported: `modelMaterial(kind, o)`, `smoothNormals(geo, crease = 180)`, `loadGLB(url)` (cached raw GLTF), `removeRegion(geo, planes)` and `capGeometry(geos, plane, { front, back })`.

### people

`head()`, `ear()` and `hand()` are **async** and load `kit/models/*.glb` once per page; `glasses()` is synchronous. L and R are the person's own sides: the head faces +z, so L is at +x. Size them with the natural option or `perMetre` (`REAL_PEOPLE = { head: 0.335, hand: 0.205, ear: 0.12, glasses: 0.14 }` metres), as in devices.js. People are never toys: the hand wears `'skin'`; the head and the ear stay clay because they are anatomical models.

| Factory | Options | Methods, anchors |
|---|---|---|
| `head` | `height 1 \| perMetre, material 'clay', color, rough, grain, env, shadows` | A sculpted bust: neutral face, no hair, flat capped base on y = 0. Anchors `noseTip eyeL eyeR cheekL cheekR chin mouth forehead earL earR` (on the skin). `faceDots(n = 3000, seed = 7, { spread 1, even true })`: points over the face oval. `dots(n = 3000, { size, color, intensity 5, from 'noseTip' \| anchor name \| Vector3 \| 'random', seed })`: a `surfaceDots` mesh to `head.add()`. `look(material, o)`: a second skin (`'xray'`, `'wire'`) to add, faded with `.set(v)`. |
| `ear` | `height 1 \| perMetre, side 'left' \| 'right', cutaway false, material 'clay', color, capColor, canalColor, drumColor, accent` | An anatomical block cut from the head, with the outer ear facing +x (`side 'right'`: -x), standing on y = 0. `cutaway: true` removes the front half on a vertical plane through the canal (the section faces +z): the canal is a channel into the head with the eardrum at its end. `setDrum(x, { glow 0 })` moves the drum (x -1..1) and lights it in the accent. Anchors `pinna opening canal drum center`. |
| `hand` | `height 1 \| perMetre, phone true, screen, phoneColor 'black', glow, material 'skin', tone, color, sheen, sheenColor, scatter, scatterK, clearcoat, rough, roughVar, nailColor, crease .55, wrap .45, side 'left' \| 'right'` | Holds the kit `phone()` upright, screen to +z, wrist on y = 0. `hand.phone`, `setScreen(tex)`, `setGlow(v)`. Anchors `screen faceId thumb thumbTip wrist` (`thumb` on the thumb's front where it always was, `thumbTip` at its tip; both follow `press`). **`hand.press(p)`** (p 0..1, pure: call it every update, `0` at rest): the thumb rolls off the phone's side and its pad comes down on the glass about 5% of the screen's width in from that edge (the IP joint flexes a little; the thenar takes the turn). **`hand.thumbUV(p = 1)`** -> `[u, v]`: the screen point under the pad at press p, u from the screen's left and v from its top (0..1): a `k.screen` layout puts the button the thumb presses at `left: u * w, top: v * h` (snippet 40). `[0.055, 0.51]` for the default left hand, `[0.945, 0.51]` with `side: 'right'`. `tone 'night' \| 'day'` picks the skin's colour and sheen and defaults from the palette (`'night'` when the palette's env is night or space): day `#a8735e`, night `#9a6656` (a little deeper and less glossy: under a cool key a day skin goes orange wherever the warm story light lands, but an earlier greyed night skin read grey-blue). Both get the hand's own skin: light that wraps past the terminator in red (`wrap`), redder fingertips, darker and redder creases (`crease`; the kit has no ambient occlusion) and pink glossy nail plates with a pale free edge (`nailColor`), from masks baked in `hand.glb`. `color` and the other skin options override the tone's. `material: 'clay'` gives a clay mannequin hand. |
| `glasses` | `width 1 \| perMetre (real 0.14 m), frame '#0d0d10', lens '#ffcf8a', lensOpacity .18, accent, fold 0` | Thick acetate frames with warm-tinted lenses, centred on the bridge, lenses facing +z (the wearer looks along +z, so L is at +x); `width` is the frame front's width. `setGlow(v)` lights the rims in the accent, front and back ("put on these special glasses"); `setFold(p)` folds the temples flat behind the lenses (0 open, 1 folded; pure). Anchors `lensL lensR bridge hingeL hingeR`. `userData.radius` frames the front. Thin and close to the lens: keep them at the focus distance. |

The earlier sculpt read as a mannequin in testing (waxy, uniformly long sausage fingers, dark claw-like nails, clay
under the night rig). `hand.glb` is now baked from that sculpt (`kit/models/hand-sculpt.glb`) by
`kit/models/bake-hand.mjs`: each finger is followed along its own curl (rings of equal distance from its tip) and
thinned and tapered to the tip (middle 0.92, ring 0.86, pinky 0.77 of the sculpt's thickness), and the index, ring and
pinky slide back along their curl (the pinky ends shortest, the middle longest); the sculpt's nail plates are found
(a fill bounded by the groove cut round them), their grooves smoothed, and painted by the skin shader; the strips the
phone's removal left are dropped; the thumb's press is solved so the pad lands on the glass without entering the
phone. The prop keeps the sculpt's size and centring. The press reads best from the front and three-quarter views (as
a phone user sees it); from above or from behind the phone the thenar's turn shows.

### audio

Procedural, synchronous, with real proportions in millimetres. `REAL_AUDIO = { speakerDriver: 0.13, headphones: 0.262, microphone: 0.185 }` (the studio microphone is 0.225). Setters are pure: call them every update.

| Factory | Options | Methods, anchors |
|---|---|---|
| `speakerDriver` | `width 1 (basket diameter) \| perMetre, cutaway false \| true (90) \| degrees, cutAngle 45 (degrees counter-clockwise from +x as you face it), color 'graphite' \| 'silver' \| 'black' \| hex, cone, cap 'silver' \| 'black', accent` | A 5-inch cone driver with its axis on +z and the rim front at z = 0. The cutaway shows the motor in section with machined faces. `push(x)` moves the cone, cap and coil (x -1..1 of 5 mm excursion) and stretches the surround and spider. `setGlow(v)` makes the voice coil glow (current). Anchors `front dustCap cone surround coil magnet spider basket` (on the cut face when cut). |
| `headphones` | `width 1 \| perMetre, color 'black' \| 'silver' \| 'sand' \| 'navy' \| hex, cutaway false, accent` | Over-ear, as worn: the origin sits between the cushions at ear-canal height, the band over +y, the wearer facing +z. `cutaway` removes the front half of the left cup (foam and shell in section, driver inside). `setMics(v)` lights the mic rings, `push(x)` moves both diaphragms, `setLed(v)`. Anchors `cupL cupR driverL driverR micL micR feedbackL feedbackR band`. |
| `microphone` | `height 1 \| perMetre, style 'handheld' \| 'studio', finish 'black' \| 'silver' \| 'champagne' \| hex, grille, accent` | Stands on y = 0, capsule facing +z. handheld: a ball grille over dark foam on a tapered handle. studio: a large-diaphragm condenser with the gold diaphragm visible. `vibrate(x)`, `setGlow(v)`. Anchors `capsule grille body base`. |

## 16. Command-line tools

All take paths; run them from anywhere as `bun K/<tool>.mjs`.

**render.mjs**: `bun K/render.mjs <project> [flags]`

| Flag | |
|---|---|
| (none) | Final: `out/final.mp4`, full size, `project.samples` (the automatic floors may raise a shot's), PNG frames, H.264 High crf 17 `-tune grain`, BT.709, AAC 192k padded (never cut) to the video's length. Takes a machine-wide GPU lock (waits for another final). A shot that throws stops the render with its id and time and leaves no mp4. |
| `--draft` | Half size, 1 sample, JPEG frames, fast encode (crf 23): `out/draft.mp4`. No lock. |
| `--stills 1.2,4.5` | PNGs into `out/stills/t1.20.png` (`<out>-t1.20.png` with `--out`, `-draft` with `--draft`). After each still: its tone (YAVG, YLOW, YHIGH, SATAVG of the 3D picture, overlays hidden) against the range for its shot row's `tone` ([3](#3-projectjson)), or the palette's: night YAVG 30-50, YLOW at most 15, YHIGH minus YLOW at least 55, SATAVG at most 20; space YAVG 16-34, YLOW at most 10, YHIGH minus YLOW at least 45; screen YAVG 30-60, SATAVG at most 30; warm YAVG 25-60; hot (a frame-filling melt, fire or sun) YAVG 40-110, YLOW at most 25, YHIGH minus YLOW at least 90; midkey YAVG 60-90, SATAVG at most 30. Then one verdict per kind of world, on the median of its stills. An unknown `tone` is named and judged by the palette. No lock. Add `--samples 16 --scale 0.5` (no `--draft`) for quick depth-of-field checks. |
| `--from a --to b` | Only that span; audio cut to match; name `final-a-b` / `draft-a-b`. |
| `--audit` | Print the layout audit ([6](#6-overlays-kui): safe areas, collisions, type over bright 3D, labels whose anchor is off-screen) at each still, or at each shot's start + 0.4 s, middle and end - 0.2 s. A final (not `--draft`) with audit lines prints `FINAL HAS AUDIT ISSUES (n)` and exits 3; the mp4 is kept. |
| `--samples N`, `--scale S`, `--fps F`, `--crf N` | Overrides. |
| `--out name` | A clip's name (without `.mp4`); for stills, a file-name prefix, so stills at different settings do not overwrite each other. |
| `--fill F`, `--no-autosamples` | Sampling A/B: bokeh fill strength (0 = off); no automatic sample floors, for defocus or motion ([7](#7-lens-motion-blur-soft-light)). |
| `--no-captions`, `--no-audio`, `--no-lock` | |

The last line says how it went, so a render piped through `tail` never looks finished when it failed:
`RENDER OK <path> (<frames> frames, <s> s)` (exit 0; stills: `RENDER OK out/stills (n stills, s)`), or
`RENDER FAILED at <t> s (shot <id>): <message>` on stderr (exit 1), after the page's errors. A final with audit lines
exits 3. Progress is a carriage-return counter on a terminal, and one line every 10% otherwise (a log file, `| tail`).

Clips write ffmpeg's output to `out/.<name>.partial.mp4` and rename it to `out/<name>.mp4` only when the render
succeeds; a failed ffmpeg, a shot that throws, or SIGTERM / SIGHUP / SIGINT (exit 143 / 129 / 130) delete the partial
file, kill ffmpeg and release the lock, so a stopped render never leaves a corrupt mp4.

Finals take a machine-wide GPU lock (`$TMPDIR/charles-3d-explainers-render.lock/`, holding `pid` and `info.json`
`{ pid, project, dir, name, frames, done, started }`, updated every 30 frames). A final that finds it taken waits and
says whose render it waits for every 30 s: `queued behind noise-cancel/final: frame 420/1100, about 3 min left`. It notes the
times of `project.json`, `globals.js`, the words and everything under `shots/` and `lib/` when it starts waiting, and
when it gets the lock it warns `WARNING changed while queued: shots/data.js, project.json (this final renders the files
as they are now)`. A lock whose process is gone is taken over.

Clips also write `out/<name>.log.json`: `from`, `to`, frames, samples, `seconds` (the frame loop), errors, logs,
audits, `shotSamples`, `shotMotion`, and `words` (every word timing the shots and `globals.js` resolved:
`{ shot, phrase, nth, t, text }`), which `sheet.mjs` and `check.mjs` read. Page errors and warnings (missing words,
`k.word` hits outside their shot, exceptions) print after the render, and so do the shots whose sub-frames the
automatic floors raised. Speed on an M4: about 0.1 s a frame for drafts; finals 0.1 to 0.3 s a frame at 16 samples,
more for heavy props and transitions. Shots whose defocus raises the sample floor take longer (2.4 to 2.5x at `blur`
0.02 to 0.022).

**serve.mjs**: `bun K/serve.mjs <project> [--port 4870]` prints a URL for a normal browser. In the console:
`await __seek(3.2)`, `__info` (duration, shots with their `tone`, size), `__audit(3.2)` (with
`window.__auditDebug = true` it adds a `debug` line per box with its shares above luma 150 and 120), `__errors`,
`__samples()` (the most sub-frames each shot has used), `__motion()` (per shot, the largest screen motion while the
shutter was open and the sub-frames the motion floor asked for), `__toneOf(t)` (the active shot row's `tone`, or
null), `__wordLog` (the word timings resolved so far).

**new.mjs**: `bun K/new.mjs <dir> --audio <m4a|mp3|wav|mp4|mov> [flags]` writes `audio.m4a`, `words.json`,
`project.json` (1080x1920, 30 fps, 16 samples, the palette, `captions: { highlight: [], mode: 'chunk' }`, no shots),
`plan.md` (a beat row per sentence with times, plus the numbers and pauses in the script), `shots/`, `assets/`, `out/`.
The `duration` it writes, in whole frames: a window (`--from` / `--to`) runs to the end of its audio, or to the last
word + 0.6 s if that comes first; a whole voiceover runs to the last word + 0.6 s, even past the end of the audio
(render.mjs pads the audio with silence), so the reel has room to settle on its last image.

| Flag | |
|---|---|
| `--palette name` | Default `night-amber` (checked against `look.js`). |
| `--from s --to s` | Cut the source (seconds or `m:ss.s`), with 10-15 ms fades. |
| `--cut-out s` | A cutaway's out point in the source's time (where the edit cuts back to the face; `--to` runs on past it as a handle): written as `cutOut` in project time, which sets the last shot's `k.out` and check.mjs's out-point test. |
| `--script file` | Put the script's exact words (digits, names, punctuation) onto the recogniser's timings; the raw transcript is kept as `words.scribe.json`. Use it whenever a script exists. |
| `--words file` | Use this transcript of the source (Scribe JSON or `[{text,start,end}]`) instead of Scribe; cut and shifted to match. |
| `--force` | Redo audio, words and duration of an existing project; keeps shots, captions and settings; the new beat table goes to `plan.new.md`. |
| `--rescribe` | Transcribe again instead of using the cache. |
| `--fps`, `--samples`, `--lang eng` | Defaults. |

**fal.mjs** (needs `FAL_KEY` in the environment or a `.env` above the working directory or the kit; never printed):

| Command | |
|---|---|
| `bun K/fal.mjs scribe <audio\|video> <out.json> [--lang eng] [--events] [--force]` | ElevenLabs Scribe word timings (video: first audio track). |
| `bun K/fal.mjs run <endpoint> <input.json> <out.json> [--save <dir>] [--force] [--dry] [--project <dir>]` | Any fal endpoint; local file paths in the input are uploaded; `--save` downloads every file URL in the result. `--dry` prints the endpoint, the input, the files it would upload and the price estimate, and spends nothing (no upload, no job; `<out.json>` may be left out); a cached result says it would cost nothing. `--project <dir>` appends the paid call to `<dir>/assets/costs.jsonl` as `{ when, what: 'fal.mjs run', endpoint, out, usd, secs, requestId }` (a cached result is not logged). |
| `bun K/fal.mjs upload <file>` | Prints a fal storage URL. |

Results are cached by input under `~/.cache/charles-3d-explainers/` (a re-run costs nothing; `--force` redoes it).
The estimate comes from fal's pricing API (`api.fal.ai/v1/models/pricing`, a free GET) when it answers, else from the
list prices of the endpoints the kit uses, times the units the input asks for (`num_images`, a video's `duration`):
`about $0.79 ($0.157 per second x 5, fal pricing API)`. Unknown: `price unknown: see https://fal.ai/models/<id>`.
As a module: `findKey()`, `upload(file)`, `submit(endpoint, input)`, `wait(job)`, `run(endpoint, input, { force, base,
cacheKey, timeout, quiet, onPaid })` (`onPaid({ endpoint, secs, requestId })` is called once when a job really ran),
`estimate(endpoint, input)` (`{ usd, unitPrice, unit, qty, source }` or null), `download(url, file)`,
`scribe(file, { lang, events, diarize, force })`, `SCRIBE`.

**sheet.mjs**: `bun K/sheet.mjs <video> [flags]` prints the path of every image it writes (default
`<name>.sheet.jpg` next to the video). Each tile shows the project time, frame, shot id and the caption on screen
(chunked and timed exactly as the engine does, with ui.js `captionChunks` and `captionTimes`: the first chunk shows from
frame 0 when the voice starts within `leadIn`) with the spoken word highlighted.

| Flag | |
|---|---|
| `--every 1`, `--from a --to b`, `--times a,b` | Which moments. |
| `--strip t[,t2] [--span .8] [--fps 12]` | A filmstrip around each time (motion, cuts, pops). |
| `--compare other.mp4 [--offset 0]` | A/B pairs at the same times. |
| `--words words.json \| projectDir`, `--no-words`, `--no-project`, `--start s` | Where words and shots come from (found by itself for `<project>/out/` videos). |
| `--cols 6`, `--width 270`, `--rows 4`, `--out file.jpg`, `--keep` | Layout; long sheets become `-p1`, `-p2`, ... `--keep` keeps the extracted frames. |

It warns when the project or engine changed after the video was rendered. Partial renders are shown in project time.

**check.mjs**: `bun K/check.mjs <video> [--project dir] [--no-project] [--graph [file.png]] [--json file]
[--no-captions] [--quiet]` prints a report and writes `<name>.check.json`. `--graph` draws a timeline image (caption
chunks green, yellow when dangling, red when they flicker). Times are project times. Captions are chunked and placed
exactly as the engine shows them (the caption band, left out of the motion measures, follows `captions.bottom` and
`size`), and planned transitions use the engine's default durations. Confirm what it flags with `sheet.mjs --strip`.
Lines:

| Line | |
|---|---|
| `pacing` | New events a second, lulls over 1.5 s. |
| `hook` | Median motion over 0.9-2.1 s and the first event after frame 0. `WARNING` below 4, or when the first event comes after 1.2 s. The references read 4.7 to 13.6 when they dive. Only when the video covers 0.9-2.1 s. |
| `static` | Per-second medians of motion. `WARNING` for 3 or more seconds in a row under 1.0 after the first second (a black second breaks a run), plus how many seconds are under 1.0. |
| `stale` | Spans where nothing moves for more than 0.6 s. |
| `cuts` | Hard cuts and the planned shots. A cut is the whole picture changing in one frame or, in a dark or plain world where few pixels change much, the frame's correlation with the one before dropping far below its neighbours'. A planned hard cut that lands while the camera still travels (its last three frames move at least 3 px a frame, and at least 15% of the top speed of its last 1.2 s) into a shot at least twice as calm reads `WARNING cut at X s (into id) lands while the camera still travels ...`: land the move by `k.out - 0.2`, or carry it through a whip. The same test runs at a cutaway's out point (`cutOut` in project.json): `WARNING the cutaway's out point ... lands while the camera still travels`. Speeds are the camera's own (render.mjs logs `camera` per frame in `<video>.log.json`: px a frame at 1080 wide that ten world points move, five at the focus distance and five far behind it), so a prop moving at the cut never counts; a render without that log is measured on the picture (2.5, mean grey change a frame outside the caption band) and the warning says so. A planned cut that is not seen reads `WARNING cut at X s (into id) changes too little: change the size 1.5x or the angle 35 degrees, or keep one move`. |
| `flashes`, `pops`, `jumps` | Unplanned only. |
| `planned` | Pops, jumps and flashes from 0.35 s before to 0.1 s after a word a shot timed (`words` in `<video>.log.json`, written by render.mjs; a line that starts drawing 0.28 s before its word is that word's beat), inside a count-up (from 0.1 s before its start to 0.1 s after it lands: `k.ui.hero` logs the span) or inside a planned transition: listed with the word or the count-up, left out of the counts. A `NOTE` line says when the video is a 1-sample draft, whose static, hook and dark lines can change at full quality. A video rendered without the word log falls back to pops on a word onset (0.12 s before to 0.05 s after). |
| `hitches` | A repeated frame in the middle of motion (a stutter). |
| `black` | Black and blown-out spans. |
| `dark` | Frames with a mean grey under 10 outside planned dips, fades and black frames, and stretches of 1 s or more under 18. In a space shot (the shot row's `tone`, else the palette, as `--stills` judges it) only near-black frames, under 4: black space with a small Earth in it averages 4 to 12 and is right (look.md's space range is for the hero frames), so there are no dim spans there. Night and the other worlds keep both rules. |
| `captions` | Chunks (chunked and timed exactly as ui.js shows them: `captionChunks`, `captionTimes`), words a second and the median characters a second (information only). |
| `flicker` | Chunks on screen under 0.7 s (with the kit's chunker, only the ones the size caps force). |
| `dangling` | Chunks that end on a word that leans on the next (ui.js `leans()`: "a", "the", "of", "your", "towards", "But", ...), exactly what the chunker avoids. Must be empty. |

`LIMITS` holds the thresholds: `stale 0.6`, `lull 1.5`, `hook 4`, `hookEvent 1.2`, `static 1.0`, `staticRun 3`,
`dark 10`, `dim 18`, `dimRun 1`, `spaceDark 4`, `plannedBefore 0.35`, `plannedAfter 0.1`, `flicker 0.7`, plus the
motion measures'. The JSON adds
`hook { motion, firstEvent, ok }`, `static { runs, nearStill, seconds }`, `perSecond [{ s, motion, black }]`,
`dark { frames, dim }`, `plannedFrom` (`log`, `onsets` or `transitions`), `planned` on each pop and flash,
`captions.flicker` / `.dangling`, and summary counts `hook`, `staticRuns`, `darkFrames`, `planned`, `flicker`,
`dangling` (pops, jumps and flashes count unplanned ones).

**plate.mjs**: `bun K/plate.mjs <project> --name N --prompt "..." [--ref img.png]... [--aspect 9:16] [--res 2K|4K]
[--seed N] [--depth moge|dav2] [--image still.png] [--redepth] [--no-style] [--force] [--dry] [--keep-raw]` writes
`assets/plates/N.png`, `N-depth.png`, `N.json` and logs costs to `assets/plates/costs.jsonl` (about $0.19 a plate at fal's Nov 2026 prices;
`--dry` prints the prompt and the estimate). Details in `references/plates.md`.

**clip.mjs**: `bun K/clip.mjs <project> --name N --prompt "what happens" [--first-frame still.png | --frame "the still" [--ref img.png]...] [flags]`
makes a 1 to 2 s character beat: a first frame in the kit's look (or yours), animated by a fal video model, graded
to the project's palette and conformed to its size and frame rate. Writes to `<project>/assets/clips/`: `N.mp4`
(graded, project size and fps, no audio), `N.strip.jpg` (a frame every 0.25 s with times, to pick the window to cut),
`N-first.png`, `N.json` (prompts, model, cost, timings, tone before and after), `raw/N.mp4` (the model's file with its
audio), `costs.jsonl`. Cached by input: a re-run with the same request costs nothing and says "kept". When and how:
`references/characters.md`.

| Flag | |
|---|---|
| `--prompt "..."` | What happens: one action, the body part, a speed, what stays still, the camera. The tool adds "keep the subject, the look and the lighting exactly as in the image; no cuts, no text". |
| `--first-frame still.png` | Animate this still (a kit render from `render.mjs --stills`, a plate, any image); cropped to the project aspect. It may be the tool's own `assets/clips/N-first.png`: make the frame with `--still-only`, check it, then animate it with `--first-frame`. |
| `--frame "..."` | Make the first frame instead (Nano Banana Pro, 2K 9:16, $0.15) from this description; the house look (`--look`), the palette's colour line and the layout line are appended (`--no-style` sends it as written). Without `--frame` or `--first-frame`, the frame is "the opening frame of" the prompt. |
| `--look photoreal` | The house look of a generated first frame: `photoreal` (default: photoreal macro, real skin with fine texture, a 100 mm macro lens) or `stylised` (the soft-clay animated-film look; only for a deliberately stylised reel). The motion prompt keeps the same look. |
| `--ref img.png` | Reference image for the first frame (repeatable): pass the character sheet to keep one person across beats. `--character name` = `--ref <project>/assets/characters/name.png`. |
| `--ref-prop img.png` | Reference image of an object in the shot, not the character (repeatable): a photo on a phone, a product. The prompt says it is an object, exactly as it looks there, so the model does not copy it as the person. |
| `--still-only` | Stop after the first frame (make the character sheet, or check a frame before paying for video). |
| `--last-frame end.png` | End on this frame (Kling 4, Gemini Omni Flash, H3 Max, Seedance; not Kling 4 Flash). |
| `--dur 5` | Seconds to generate, clamped to the model's range. 3 is enough for one quick action (40% cheaper, denser motion). |
| `--endpoint kling/v4/image-to-video` | Video model. Tested in Nov 2026, at that month's fal prices: `kling/v4/image-to-video` (default, 720p, $0.157/s, 3.5 to 5.5 min), `kling/v4/flash/image-to-video` ($0.094/s, about 80 s), `google/gemini-omni-flash/v1.2/image-to-video` ($0.082/s, about 1 min, adds camera moves), `minimax/h3-max/image-to-video` ($0.08/s list, 30 s, invents details), `bytedance/seedance-2.0/fast/image-to-video` ($0.24/s, refuses faces). Other fal image-to-video endpoints get the common field names. |
| `--res` | The model's resolution option (default its cheapest good one: 720p, 768P for H3 Max). |
| `--take N` | A new take of the same request (take 1 stays cached); raw file `raw/N-tN.mp4`. |
| `--trim a,b` | Keep seconds a..b of the generated clip. |
| `--grade auto` | `auto`: gamma into the palette's YAVG range (night 30 to 50, target 40), saturation cap, black level, shadow tint, vignette when the corners are bright, the kit's grain. `none`: conform only. |
| `--fps N` | Output frame rate (default project fps; models make 24, frames are repeated). |
| `--frames [width]` | Also extract `assets/clips/N/f0001.jpg...` and `frames.json` for `k.clip` (540 for a device screen, full width for a plate). |
| `--video take.mp4` | Bring your own clip: grade, conform, strip and frames only. |
| `--keep-audio` | Keep the model's soundtrack. |
| `--force`, `--dry` | Run the paid calls again; print both prompts, the request and the cost without spending. |

Errors: a content-check refusal exits with code 2 and names the fix (Seedance rejects any frame with a face; use the
default model).

**model.mjs**: `bun K/model.mjs <project> --name <n> --prompt "..." [flags]`, or `--image ref.png` (skips the image step), or `--glb file.glb` (cleans only, no fal). Steps:
1. A product-shot reference: the object alone on mid-grey, soft light (`fal-ai/nano-banana-pro`, 1K square).
2. Image-to-3D.
3. Cleaning: no cameras or lights, weld, simplify to the triangle target, smooth normals welded by position, textures as JPEG at 2048 or less (data maps at half), meshopt compression (`props.model()` decodes it).
4. A three-view preview in the kit's night look.

Every step is cached by its input under `~/.cache/charles-3d-explainers/models/`. Writes `assets/models/<n>.glb`, `<n>.png` (preview), `<n>-ref.png`, `<n>.json`, and appends paid calls to `assets/models/costs.jsonl`. A typical object costs $0.53 and takes 2 to 3 min. The prices in this section are fal's list prices as of Nov 2026,
kept in `kit/model.mjs`; `--dry` prints the estimate, and each endpoint's page on fal.ai has today's price. It ends up 40 to 100k triangles and 0.2 to 1.2 MB.

| Flag | |
|---|---|
| `--endpoint` | `hunyuan` (default, `fal-ai/hunyuan-3d/v3.1/pro/image-to-3d`, $0.375, crispest), `trellis2` ($0.30, softer), `tripo` ($0.20 untextured, solid but noisier; faces +x, so add `--rotate 0,-90,0`), `rodin` ($0.40, de-lit textures), `meshy` ($1.20), `hunyuan-rapid` ($0.225), or any fal endpoint id that takes `image_url` and returns a GLB. |
| `--tris 60000`, `--tex 2048` | Triangle target; largest texture side. |
| `--geometry` | Shape only: no textures or UVs. The reference is rendered as matte clay (cleaner shape) and untextured modes cost less. Use it whenever a kit material will be used. |
| `--pbr` | Ask for metal/rough/normal maps where offered. |
| `--view` | `three-quarter` (default), `front` (heads, faces, flat objects), `side`, `top`. |
| `--image-model` | `pro` ($0.15) or `fast` (`fal-ai/nano-banana`, $0.04) or an endpoint id. |
| `--seed N`, `--rotate x,y,z`, `--normals smooth \| keep \| <crease degrees>` | |
| `--solid` | Keep only the outer surface. Generators often return a hollow shell, with a second wall a few mm under the skin; it breaks cutaways and surface sampling. Closes the holes this leaves. |
| `--open-base` | `--solid` for busts and statues whose hollow is open at the bottom: plugs the base first. Not for objects with overhangs near the bottom. |
| `--largest` | With `--solid`, keep only the largest connected piece. |
| `--no-preview`, `--force`, `--dry` | `--dry` prints the reference prompt and the cost estimate. |

**fonts/typeface.mjs**: `bun K/fonts/typeface.mjs <in.woff> <out.typeface.json> [--name "Inter 900"]` converts a TrueType-flavoured WOFF (the `@fontsource` files in `K/node_modules`) into a typeface JSON for `props/type.js`, with GPOS pair kerning (including the extension lookups three's opentype.js skips), tabular figures and metrics. Add a weight by converting it next to the others (`Inter-900.typeface.json`).

## 17. Snippets (all rendered and checked)

Each was built into a test project and checked on draft stills and 16-sample stills. They assume the usual
`const { THREE, scene, camera, cam, props, glow, fx } = k;` at the top of the shot.

**1. A label pinned to a moving object.** An `Object3D` anchor needs nothing in update. For a point that is not an
object, anchor a function of shot time.

```js
const sat = props.satellite({ size: 0.11 }); scene.add(sat);
const satPos = (t) => new THREE.Vector3(k.lerp(-0.55, 0.3, t / k.dur), 0.32 + 0.06 * Math.sin(t * 0.9), 0);
k.ui.label('GPS satellite', {
  anchor: sat, offset: [70, 150], line: true, at: k.word('satellite') - 0.1, until: k.dur - 0.2, sub: '20,200 km up',
});
k.ui.label('ground track', { anchor: (t) => satPos(t).setY(-0.58), at: k.word('night') - 0.1 });
return (t) => {
  sat.position.copy(satPos(t));
  // ...camera...
};
```

Labels are 46 px with a dot and no leader line by default, the text up and to the right of the dot. The satellite's
label sits 150 px off a small, moving object, so it takes a line.

To pin to a spot on a turning globe, use its anchors: every `CITIES` entry is one (`anchor: earth.anchor('Tokyo')`),
and `earth.pin(lat, lon, 0.004, 'Base')` adds another (then `earth.anchor('Base')`).

**2. A count-up hero on its word.**

```js
const t10 = k.word('10,000');
k.ui.hero('', {
  at: t10 - 0.1, until: k.dur + 0.3, y: 400, size: 170, unit: 'km', sub: 'in one hour',
  count: { range: [0, 10000], dur: 0.9, ease: 'outQuint' },
});
```

Every ease lands exactly on the value, the default `outExpo` included. Without `size` the hero is sized by its
longest text.

**3. A HUD clock in globals.js** (story time: 0 to 60:00 while the phrase is said, then holds).

```js
// globals.js
export default (g) => {
  const a = g.word('crosses'), b = g.wordEnd('hour.');
  const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  g.ui.hud({
    at: a - 0.3, until: g.word('Light') - 0.4, sub: 'flight time',
    value: (t) => 3600 * g.ramp(t, a, b, 'linear'), format: mmss,
  });
};
```

The defaults are look.md's HUD: 88 px, `#77d9fc`, right edge at x 1040, y 250. For slow, hold, fast-forward, use
`g.keys(t, [[a, 0], [b, 20, 'linear'], [c, 20], [d, 200, 'linear']])`.

**4. Planet to phone: a log-scale zoom.** One layer holds detail for about one power of ten (the globe's textures
blur past a continent), so a scale journey is a chain of shots, each with its own detailed layer, joined by `zoom`
transitions. Accelerate into each join (`inCubic`) and decelerate out of it (`outCubic`) so the rush carries through.

```json
{ "id": "planet", "file": "shots/planet.js", "start": 7.5 },
{ "id": "phone", "file": "shots/phone.js", "start": 10.0, "in": { "type": "zoom", "dur": 0.6 } }
```

```js
// shots/planet.js
const earth = await props.globe({ radius: 2, sun: [0.8, 0.3, -0.5] });          // night side towards camera
scene.add(earth); scene.add(fx.stars()); k.env('night', 0.6);
const N = earth.latLon(...props.CITIES['Los Angeles']).normalize();          // globe at the origin: local = world
const zoom = cam.logZoom({ target: N.clone().multiplyScalar(2), dir: N, from: 9, to: 1.1, t0: 0, t1: k.dur + 0.3, ease: 'inCubic', fov: 32 });
return (t) => {
  zoom.apply(camera, t, { drift: 0.3 });
  k.lens = { blur: 0.006, focus: zoom.at(t).dist };
};

// shots/phone.js
const desk = props.desk({ width: 3, depth: 2, wood: 'walnut' }); scene.add(desk);   // top at y = 0
const phone = props.phone({ width: 0.5, screen: props.wallpaper({ w: 1179, h: 2556, ui: false, accent: k.pal.accent }) });
phone.rotation.x = -Math.PI / 2; phone.position.y = phone.userData.depth / 2; scene.add(phone);   // screen up
const zoom = cam.logZoom({ target: [0, 0, 0], dir: [0, 1, 0.35], from: 7, to: 2, t0: -0.3, t1: k.dur - 0.2, ease: 'outCubic', fov: 32 });
return (t) => {
  zoom.apply(camera, t, { drift: 0.3 });
  k.lens = { blur: 0.012, focus: phone };
};
```

For a zoom that goes below about 0.5 units in one shot, keep the near plane in step: `camera.near = pose.dist * 0.02`
in update (`const pose = zoom.at(t); cam.apply(camera, pose, { t })`).

**5. A glowing path that draws on, and a pulse that rides its front.**

```js
const curve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-0.85, 0.075, 1.35), new THREE.Vector3(-0.6, 0.075, 0.85), new THREE.Vector3(-0.45, 0.14, 0.35), chipTop,
]);
const path = glow.tube(curve, { radius: 0.012, color: k.pal.accent, intensity: 4 });
const head = glow.pulse(curve, { size: 0.03, color: k.pal.accent, intensity: 18, tail: 0.15 });
scene.add(path, head);
const t0 = k.word('races'), t1 = k.wordEnd('chip.');
return (t) => {
  const p = k.ramp(t, t0 - 0.1, t1, 'inOutSine');
  path.draw(p);
  head.place(p);                                // a fraction of the curve, not a time; hidden outside 0..1
  k.lens = { blur: 0.012, focus: curve.getPointAt(k.clamp(p)) };
};
```

On a circuit board, the board's own traces work the same way: `board.lightTrace(0)` returns a tube to `.draw(p)`, and
`glow.pulse(board.traces[0].curve)` must be added to the board (`board.add(head)`), since its curves are in board
space.

**6. An HTML app screen on the phone.**

```js
const scr = await k.screen({
  w: 1179, h: 2556,
  css: `.app{position:absolute;inset:0;background:#0b0b0d;font-family:Inter;color:#fff}
    .list{position:absolute;left:44px;right:44px;bottom:240px;display:flex;flex-direction:column;gap:26px}
    .b{padding:30px 42px;border-radius:52px;font:500 52px/1.25 Inter;background:#26262a;align-self:flex-start}
    .new{background:#ffb43c;color:#1b1206;transform-origin:0 100%}`,
  html: `<div class="app"><div class="list"><div class="b">Sending you the photo</div><div class="b new">Here it is!</div></div></div>`,
});
const tMsg = k.word('message.');
scr.update = (t, root) => {
  const p = k.ramp(t, tMsg - 0.15, tMsg + 0.3, 'outBack');
  const b = root.querySelector('.new');
  b.style.opacity = Math.min(1, p);
  b.style.transform = `translateY(${(1 - p) * 40}px) scale(${0.9 + 0.1 * p})`;
};
const phone = props.phone({ width: 1 });
phone.setScreen(scr.texture);
scene.add(phone);
// in update: phone.setGlow(0.3 + 0.85 * k.ramp(t, k.word('lights') - 0.1, k.word('lights') + 0.4));
```

**7. An instanced field with one hero instance.** 1,500 numbered packets in one draw call; packet #0847 leaves its
slot and a label follows it. An instance is not an `Object3D`, so the label anchors a function.

```js
const f = props.packetField({ pal: k.pal, count: 1500, cols: 50 });   // labels '#0001'...'#1500'
f.position.set(0, 0.08, -2.5); scene.add(f);
const hero = 846;                                                      // '#0847'
f.set(hero, { glow: 0.4 });
const tYours = k.word('yours.');
k.ui.label('#0847', { anchor: () => f.worldPos(hero), offset: [70, -100], at: tYours - 0.1, style: 'tag' });
return (t) => {
  f.burst(t, { t0: -0.4, dur: 1.0, from: [0, 0.6, 4.4], spread: 0.8, lift: 1.0 });   // lays out every instance
  f.pluck(t, hero, { t0: tYours - 1.0, dur: 1.2, to: [0, 0.9, 5.2], scale: 1.35 });  // then moves the hero
  k.lens = { blur: 0.018, focus: f.worldPos(hero) };
};
```

The same pattern with transistors: `props.transistorArray({ skip: (c, r) => c === 7 && r === 14 })` leaves a cell
empty for a hero `props.transistor()`.

**8. A rack focus.** `cam.rack` holds on one subject and pulls to the next at its time; a subject can be a prop, an
anchor, a point or a distance.

```js
const tPhone = k.word('phone.');
const focus = cam.rack([[0, chip], [tPhone - 0.35, phone, 0.6]]);   // [t, subject, pull duration]
return (t) => {
  k.lens = { blur: 0.02, focus };
};
```

The bokeh fill and the automatic sample floor smooth the far subject's thin bright edges
([7](#7-lens-motion-blur-soft-light)): at fov 30 this shot renders 41 sub-frames a frame.

**9. GSAP on the shot timeline.** `k.tl.fromTo(moon.scale, { x: 0.8, y: 0.8, z: 0.8 }, { x: 1, y: 1, z: 1,
duration: 1.4, ease: 'power2.out' }, 0)`: positions are shot-local seconds; the engine seeks it every sub-frame.

**10. Ride along with a pulse.** The camera trails the head down the wire; the pulse sits a little ahead of it.

```js
const ride = cam.follow(curve, { t0, t1, from: 0.05, to: 0.55, offset: [0.25, 0.35, 1.2], lookAhead: 0.12, ease: 'linear', fov: 40 });
return (t) => {
  ride.apply(camera, t, { drift: 0.3 });
  head.place(k.lerp(0.05, 0.55, k.ramp(t, t0, t1, 'linear')) + 0.06);
};
```

**11. A function plot that draws on, with tick labels.**

```js
const pl = glow.plot((x) => Math.exp(-x * x * 0.6) * Math.cos(x * 2.5), { x0: -4, x1: 4, width: 2.6, height: 1.6 });
scene.add(pl);
const dot = glow.pulse(pl.curve, { size: 0.035 }); pl.add(dot);        // the curve is in the plot's space
for (const tk of pl.ticks.x) k.ui.label(`${tk.value}`, { anchor: tk.anchor, offset: [0, 40], dot: false });
const A = cam.frame(pl, { az: -6, el: 4, fill: 0.8, fov: 32 });       // a prop: framed by its bounds, no radius
return (t) => {
  cam.apply(camera, A, { t });
  pl.axes.draw(k.ramp(t, 0, 0.4));
  pl.draw(k.ramp(t, 0.2, 0.9));
  dot.place(k.ramp(t, 0.2, 0.9, 'linear'));
};
```

The chart and type snippets below use the usual `const { THREE, scene, camera, cam, props } = k;`.

**12. Bars that grow on their words; the accent bar lights on its number.**

```js
const ch = props.bars([18, 26, 41, 64], { labels: ['2020', '2021', '2022', '2023'], values: true, format: (v) => Math.round(v) + '%' });
scene.add(ch);
const t0 = k.word('grew'), t1 = k.word('64%');
const A = cam.frame(ch, { az: -14, el: 14, fill: 0.85 }), B = cam.frame(ch, { az: 8, el: 12, fill: 0.85 });
const move = cam.path([{ t: 0, ...A }, { t: k.dur, ...B }]);
return (t, ft) => {
  ch.grow(k.ramp(t, t0 - 0.1, t1, 'linear'), k.ramp(ft, t0 - 0.1, t1, 'linear'));   // shape from t, numbers from ft
  ch.highlight(k.ramp(t, t1 - 0.1, t1 + 0.4));
  move.apply(camera, t, { t });
  k.lens = { blur: 0.012, focus: ch.anchor('hero') };
};
```

**13. A count of things: 200 cards pile up, the 200th lifts out tagged, a 3D counter above.**

```js
const st = props.stack(200, { item: 'card', size: 0.5, tag: '#200' });
scene.add(st);
const n = props.extrude('0', { size: 0.3, material: 'emissive', tabular: true });
n.position.copy(st.anchor('top').position).add(new THREE.Vector3(0, 0.45, 0)); scene.add(n);
const tA = k.word('200'), tB = k.word('200th');
k.ui.label('<span style="font-size:46px">The 200th time</span>', { anchor: st.anchor('hero'), offset: [40, -260], at: tB, until: k.dur, line: false });
const A = cam.frame(st, { az: -22, el: 22, fill: 0.9 });
return (t, ft) => {
  st.fill(k.ramp(t, tA - 0.3, tB - 0.3, 'linear'));
  st.single(k.ramp(t, tB - 0.2, tB + 0.6));
  n.setText(k.fmtNum(200 * k.ramp(ft, tA - 0.3, tB - 0.3, 'linear')));   // text from ft: crisp digits
  n.reveal(k.ramp(t, tA - 0.5, tA));
  cam.apply(camera, A, { t });
  k.lens = { blur: 0.01, focus: st.anchor('hero') };
};
```

**14. A scoreboard counting on its word.**

```js
const sb = props.scoreboard({ digits: 6, label: 'times a year' });
scene.add(sb);
const t1 = k.word('200,000');
const A = cam.frame(sb, { az: -10, el: 6, fill: 0.9 });
return (t, ft) => {
  sb.set(200000 * k.ramp(ft, t1 - 0.8, t1 + 0.2, 'outQuint'));   // from ft, never t
  cam.apply(camera, A, { t });
  k.lens = { blur: 0.012, focus: sb.anchor('display') };
};
```

**15. The dot projector's pattern on a face** (Face ID): 2,600 dots grow out from the nose.

```js
const h = await props.head({ height: 1, material: 'clay' });   // 'satin' (dark glossy) makes the dots pop more
scene.add(h);
const dots = h.dots(2600, { intensity: 6 }); h.add(dots);       // 30,000 also works: ~2 s at build, pass size: 0.0012
return (t) => {
  dots.reveal(k.ramp(t, k.word('dots') - 0.2, k.word('dots') + 1.2));
  k.lens = { blur: 0.018, focus: h.anchor('noseTip') };
};
```

**16. Headphones on the head at true scale, microphones listening, left cup cut open.**

```js
const h = await props.head({ height: 1 }); scene.add(h);
const pm = h.userData.perMetre;
const hp = props.headphones({ perMetre: pm, color: 'black', cutaway: true });
const eL = h.anchor('earL').position, eR = h.anchor('earR').position;
hp.position.set((eL.x + eR.x) / 2, (eL.y + eR.y) / 2 - 0.004 * pm, (eL.z + eR.z) / 2 - 0.004 * pm);
scene.add(hp);
return (t) => { hp.setMics(0.6 + 0.4 * Math.sin(t * 6)); hp.push(Math.sin(t * 9)); k.lens = { blur: 0.014, focus: hp.anchor('micL') }; };
```

**17. A speaker cone playing a wave, motor in section, coil carrying current.**

```js
const d = props.speakerDriver({ width: 1, cutaway: true });     // 90 degree wedge at the upper right
d.position.y = 0.62; scene.add(d);
return (t) => {
  const w = Math.sin(t * 6);
  d.push(w); d.setGlow(0.55 + 0.45 * w);
  k.lens = { blur: 0.014, focus: d.anchor('coil') };            // glow.wave from d.anchor('front') for the sound
};
```

**18. Into the ear: the canal and the eardrum.**

```js
const e = await props.ear({ height: 0.6, cutaway: true }); scene.add(e);
const at = e.anchor('canal').getWorldPosition(new THREE.Vector3()).lerp(e.userData.center, 0.35);
const A = cam.frame(at, 0.13, { az: 15, el: 10, fill: 0.8 });   // from the front-right, the section faces +z
return (t) => {
  e.setDrum(Math.sin(t * 8) * 0.8, { glow: 0.25 + 0.25 * Math.sin(t * 8) });
  cam.apply(camera, A, { t }); k.lens = { blur: 0.012, focus: e.anchor('drum') };
};
```

**19. Any object from a prompt, and a product cutaway of it.**

```
bun K/model.mjs <project> --name toaster --prompt "a retro chrome two-slice toaster" --dry   # check prompt and cost
bun K/model.mjs <project> --name toaster --prompt "a retro chrome two-slice toaster"         # ~$0.53, cached after
```

```js
const m = await props.model(k.asset('assets/models/toaster.glb'), {
  size: 1.2, material: 'plastic', color: '#d8d4cc', anchors: { lever: { at: [0.9, 0.7, 0.5], snap: '+x' } },
  // cut: [{ normal: [1, 0, 0], at: 0.5 }, { normal: [0, 0, 1], at: 0.5 }], capColor: '#d9b48a',  // quarter wedge out
});
scene.add(m);
const A = cam.frame(m.userData.center, m.userData.radius, { az: 30, el: 15, fill: 0.8 });
```

The cut was checked on `kit/models/head.glb` with `crop: { normal: [0, -1, 0], at: 0.1 }` first, which closes its base. `hand()` with `screen: k.screen(...)` gives a live app screen in a hand.

**20. A scale bar on a dive.** One bar across the shots of a zoom journey lives in `globals.js` (global times); inside
one shot, `k.ui.scaleBar` takes shot-local times. Time each step by a phrase that occurs once.

```js
// globals.js
export default (g) => {
  g.ui.scaleBar({
    steps: [[g.word('zoom'), '1 mm', 260], [g.word('further,'), '10 µm', 260], [g.word('even further.'), '100 nm', 260]],
    until: g.word('transistor.'),
  });
};
```

Equal lengths read as "each step is another order of magnitude"; changing lengths (`300`, `180`, `340`) ease between
steps. For the microscope corner: `align: 'left', y: 1265` (the left end at x 150).

**21. A label that keeps off its object.** `avoid` keeps the text off the whole object, wings and antennas included,
while the camera moves; the dot stays on the anchor.

```js
const sat = props.satellite({ size: 1, foil: 'gold' }); scene.add(sat);
k.ui.label('GPS satellite', { anchor: sat, avoid: sat, at: k.word('satellite') - 0.05, until: k.word('atomic') - 0.25 });
```

With the wings open across the frame, `'auto'` puts the label above the satellite, clear of the antenna, and moves it
below when a hero arrives above it.

**22. A product lit in a night world.** White plastic reads mid-grey under the night rig; the product light makes it
read white without lifting the room.

```js
const box = /* the product: give it userData.radius (and userData.center when its middle is not its origin) */;
const pl = k.look.productLight(k.scene, box);           // after k.rig(): it adds to the rig, it does not replace it
k.softLight(pl.spot, 0.15);                             // optional: soft shadow edge
// in update, only if the product moves: pl.follow();
```

**23. A glass hero on a warm horizon** (the hook's beauty shot). Transmission only shows what is behind the hero: put
the horizon band at the hero's screen height and keep the camera low enough that the band, not the floor, sits behind
it. Without the horizon the same glass renders as a dark pebble.

```js
k.env('night', 0.6);
k.backdrop({ glow: 0.05, horizon: { strength: 0.4, y: 0.5 } });   // y: the hero's screen height (0 bottom, 1 top)
k.rig({ keyPos: [-2, 7, -3], rimPos: [1, 1.6, -6], keyScale: 0.4, rimScale: 1.6, fillScale: 0.25, soft: 1.0 });
const quartz = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: '#f3ead8', roughness: 0.1, transmission: 0.92, thickness: 0.6, ior: 1.54, attenuationColor: '#e8c89a', attenuationDistance: 2.0, clearcoat: 1, clearcoatRoughness: 0.1 }));
const inner = new THREE.PointLight('#ffb15c', 1.6, 1.6, 2); inner.position.copy(quartz.position); scene.add(quartz, inner);
// camera low, about level with the hero: pos [0.7, 0.42, 3.4], look [0, 0.4, 0]
```

**24. A molten surface** (a melt, the dive through the surface).

```js
const m = k.mat.molten({ scale: 0.9, fade: false });
const sea = new THREE.Mesh(new THREE.PlaneGeometry(9, 9, 220, 220).rotateX(-Math.PI / 2), m); // a gentle swell in y helps
scene.add(sea);
return (t) => { m.set(k.ramp(t, k.word('Melt') - 0.1, k.word('Melt') + 0.4), t); /* camera 1.5 up, 3 back */ };
```

To melt an object, lay `k.mat.molten()` (fade on) over its own geometry with `renderOrder = 2` and ramp the heat.

**25. Stars, the Milky Way, steam and converging motes.**

```js
scene.add(fx.stars());                                       // 20000 stars, sharp under any blur
scene.add(fx.milkyWay({ normal: [0.3, 1, 0.25], center: [-0.7, 0.15, -1] }));
const st = fx.steam({ center: [0, 0.6, 0], radius: 0.38 }); scene.add(st);
const motes = fx.converge({ radius: 1.1 }); scene.add(motes);
return (t) => {
  st.at(t, camera, 0.35 + 0.7 * k.ramp(t, k.word('hot'), k.word('hot') + 0.4));
  motes.set(t, bud, k.word('music') - 0.15, k.word('air') + 0.45);   // bud: the Object3D they gather into
};
```

**26. An AND gate around the two switches that make it, a signal through it.** The gate stands just behind the parts;
the pulses ride its lead curves.

```js
const gate = glow.gate('and', { height: 1.9, width: 3.0 });   // around two parts 1.0 wide at x = ±0.75
gate.position.set(0, 1.0, -0.62); scene.add(gate);
const pin = glow.pulse(gate.inputs[0], { size: 0.045, intensity: 22, tail: 0.3 }); gate.add(pin);
const pout = glow.pulse(gate.output, { size: 0.045, intensity: 22, tail: 0.3 }); gate.add(pout);
const tAnd = k.word('AND gate');
return (t) => {
  gate.draw(k.ramp(t, tAnd - 0.2, tAnd + 0.6));
  pin.place(k.ramp(t, tAnd + 0.6, tAnd + 1.0, 'linear')); pout.place(k.ramp(t, tAnd + 1.0, tAnd + 1.3, 'linear'));
};
```

**27. A rune that draws itself, its light following the pen.**

```js
const rune = glow.svgPath('M6.5 6.5 L17.5 17.5 L12 23 L12 1 L17.5 6.5 L6.5 17.5', { size: 0.46 }); // the Bluetooth rune
rune.position.set(0, 0.72, 0.2); scene.add(rune);
const light = new THREE.PointLight(new THREE.Color(k.pal.accent), 1.2, 2.0, 1.8); scene.add(light);
return (t) => {
  rune.draw(k.ramp(t, t0 - 0.1, t0 + 0.55));
  rune.anchor('tip').getWorldPosition(light.position); light.position.z += 0.12;
};
```

**28. Radio waves: a steady source on the floor and a burst facing the camera.**

```js
const field = glow.waveField({ radius: 3 }); field.position.set(0, 0.01, 0); scene.add(field);      // flat
const burst = glow.waveField({ radius: 0.9, speed: 0.8 }); burst.position.copy(bud); scene.add(burst);
return (t) => {
  field.set({ time: t });                                                     // always on
  burst.quaternion.copy(camera.quaternion);                                   // after the camera is placed
  burst.set({ time: t, start: tMagic, stop: tMagic + 0.35 });                 // three rings leave on "magic"
};
```

**29. A wave from the phone to the earbud, carrying bits.**

```js
const wb = glow.waveBetween(phone.anchor('screen'), pods.anchor('budR')); scene.add(wb);
const bits = glow.fsk('1011', { len: wb.len / 4, amp: wb.len * 0.04 });
return (t) => {
  wb.set({ time: t, to: k.ramp(t, tRadio - 0.25, tRadio + 0.45) });          // a sine travelling to the bud
  // or the bits, scrolling towards the bud: wb.set({ fn: (x) => bits(x - 0.3 * t) });
};
```

**30. Light in a cable lying on the floor.** A pulse on the centre line of an opaque tube shows only its halo: lift it
by the tube's radius.

```js
const cable = new THREE.Mesh(new THREE.TubeGeometry(path, 600, 0.075, 18), k.mat.plastic('#1a1f2b', { rough: 0.6 }));
const head = glow.pulse(path, { size: 0.1, intensity: 26, tailLength: 0.6, tailRadius: 0.03, lift: 0.075 }); // = radius; tail in world units
scene.add(cable, head);
// update: head.place(k.ramp(t, t0, t1, 'linear'));
```

**31. Field vectors along a wave.**

```js
const vs = Array.from({ length: 13 }, (_, i) => { const v = glow.vector({ dir: [0, 1, 0], color: '#cfe0ff', radius: 0.014 }); v.position.set(-1.8 + i * 0.3, 1.2, 0); scene.add(v); return v; });
return (t) => vs.forEach((v, i) => v.set(0.55 * Math.sin(2.86 * (-1.8 + i * 0.3) - 4 * t)));
```

**32. Carve it with light.** A sheet of light crosses a wafer and leaves its pattern behind.

```js
const sw = glow.sweep(k, { radius: 1.5, y: waferTop }); scene.add(sw);
return (t) => { sw.set(k.ramp(t, tCarve - 0.1, k.dur + 0.1), k.ramp(t, tCarve - 0.15, tCarve + 0.15)); };
```

**33. Earbuds rising out of their case, product-lit.**

```js
const pods = props.earbuds({ perMetre: 10, open: 1, led: k.pal.accent, ledIntensity: 5 }); scene.add(pods);
k.look.productLight(scene, pods);                                  // the case reads white under a dim key
return (t) => {
  const bud = pods.lift(k.ramp(t, tPods - 0.1, tPods + 0.9), t);   // the right bud's world position
  k.lens = { blur: 0.012, focus: pods.anchor('budR') };
};
```

**34. Inside a running microwave.** Rig: `k.rig({ keyScale: 0.18, rimScale: 0.25, fillScale: 0.15 })`,
`k.env('night', 0.35)`. The oven's shell shadows the key, so the cavity is lit by its lamp alone.

```js
const mw = props.microwaveOven({ width: 5.2, color: 'black', door: false, on: 1 }); scene.add(mw);
k.softLight(mw.lamp, 0.2);
const bowl = props.noodleBowl({ radius: 0.68, height: 0.6, seed: 7 }); mw.plate.add(bowl);
mw.at(0); mw.updateMatrixWorld(true);
const P = mw.anchor('cavityCam').getWorldPosition(new THREE.Vector3());
const L = mw.anchor('plate').getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.3, 0));
return (t) => { mw.at(t); cam.apply(camera, { pos: P, look: L, fov: 30 }, { t }); k.lens = { blur: 0.012, focus: bowl.anchor('top') }; };
```

**35. A phone turning to glass over the chip inside.**

```js
const inner = new THREE.Group(); phone.add(inner);               // a board, the chip, the battery
// ... build them in the phone's space (phone.userData.width / height / depth) ...
return (t) => { phone.setXray(k.ramp(t, tChip - 0.12, tChip + 0.3)); };
```

**36. A pearl hero in a cloud that surrounds it.** The matte crowd defocuses into smooth discs.

```js
const hero = props.water({ pal: k.pal, charges: true }); scene.add(hero);            // pearl by default
const cloud = props.moleculeCloud({ kind: 'water', count: 320, shell: [3.2, 16], scale: 0.8 }); scene.add(cloud); // matte
return (t) => {
  hero.at(t, { vibrate: 0.02 }); cloud.at(t, { twist: 0.3 });
  hero.setCharge('O', k.ramp(t, k.word('negative') - 0.1, k.word('negative') + 0.3));
  for (let i = 0; i < 40; i++) cloud.setGlow(i * 7, 0.6 * k.ramp(t, k.word('heat'), k.word('heat') + 1)); // neighbours warm up
  k.lens = { blur: 0.03, focus: hero };
};
```

**37. Packets split out of one block.**

```js
const F = props.packetField({ count: 1500, cols: 50, look: 'dark', heroSlot: 1074, hero: 847 }); F.position.y = 0.08; scene.add(F);
return (t) => {
  F.fromBlock(t, { t0: k.word('split') - 0.05, offset: [0, 0, 0.95 * k.ramp(t, k.word('sent'), k.word('go'), 'inCubic')] });
  F.pluck(t, F.heroSlot, { t0: k.word('each') - 0.25, dur: 1.1, to: [0, 1.0, 0.95], scale: 1.5 });
};
```

**38. A die seated on a board, its traces lit outwards.** The proportions hold at any size (a 4 cm board works too:
set `camera.near` small).

```js
const board = props.pcb({ size: [3, 3], color: 'black', chip: 'footprint' }); scene.add(board);   // at the origin
const die = props.chipDie({ size: board.footprint.size * 0.92 }); die.position.copy(board.footprint.center); scene.add(die);
const outs = board.chipTraces().slice(0, 12).map((tr, i) => {
  board.lightTrace(tr, { intensity: 2.5 });
  const p = glow.pulse(tr.curve, { size: board.traceWidth * 1.4, intensity: 14, tail: 0.1, fade: 0.15 }); board.add(p);
  return { p, d: (i * 0.137) % 1 };
});
// update: outs.forEach((o) => o.p.place((t * 0.6 + o.d) % 1));
```

**39. Two satellites' range spheres and the circle where they cross, seen face-on.**

```js
const a = props.rangeSphere({ radius: 1.9 }); a.position.copy(S1); scene.add(a);
const b = props.rangeSphere({ radius: 1.7 }); b.position.copy(S2); scene.add(b);
const cc = props.crossingCircle(a, b); scene.add(cc);
const face = cc.faceOn(null, camStart.pos);              // build time: the pose that shows the circle round
return (t) => {
  b.set({ radius: 1.7 * k.ramp(t, k.word('second') - 0.1, k.word('second') + 0.6) });
  cc.update(); cc.draw(k.ramp(t, k.word('smaller'), k.word('smaller') + 0.5));
  cam.apply(camera, face, { t });
};
```

**40. A thumb presses "send" on its word.** The button sits where `thumbUV()` says the pad lands, so the press and
the button's own press-in meet on the glass. `side: 'right'` puts the thumb on the screen's right, where send is.

```js
const hand = await props.hand({ height: 1, side: 'right', glow: 1.0 });
const [u, v] = hand.thumbUV();                                     // [0.945, 0.51]: screen fractions
const W = 1179, H = 2556;
const scr = await k.screen({ w: W, h: H, html: '<div class="app"><div class="send"></div></div>',
  css: `.app{position:absolute;inset:0;background:#0b0d12}
        .send{position:absolute;width:150px;height:150px;margin:-75px 0 0 -75px;border-radius:50%;background:#2f7bff;left:${u * W}px;top:${v * H}px}` });
hand.setScreen(scr.texture); scene.add(hand);
const tSend = k.word('send');
scr.update = (t, root) => { root.querySelector('.send').style.transform = `scale(${1 - 0.15 * k.pulse(t, tSend - 0.02, 0.06, 0.08, 0.2)})`; };
return (t) => {
  hand.press(k.pulse(t, tSend - 0.3, 0.3, 0.12, 0.35));            // the pad reaches the glass on the word
  k.lens = { blur: 0.01, focus: hand.anchor('thumbTip') };
};
```

**41. A camera over a planet keeps its up away from the surface.**

```js
const move = cam.path([{ t: 0, pos: A, look: P, up: A.clone().normalize() }, { t: k.dur, pos: B, look: P, up: B.clone().normalize() }], { flow: true });
// or along a curve: cam.follow(orbitCurve, { t0: 0, t1: k.dur, offset: [0, 0.3, 1.2], up: (p) => p.clone().sub(earth.position) })
return (t) => move.apply(camera, t);                                // replaces camera.up.copy(...) in every update
```

## 18. Gotchas

- `cam.apply(camera, pose)` without `{ t }` freezes the drift. A move's own `.apply(camera, t)` passes `t` itself.
- The hook must be finished on frame 0: an overlay whose `at` is at or before global time 0 (`project.title` by
  default) is fully on from the first frame. Do not use `fadeIn` for a hook: it fades the overlays with the picture.
- `k.word` and `g.word` misses log an error and return 0 (the element lands at the shot's or the video's start); a
  phrase that is nowhere in the words, written either way, also logs a warning. Check the console lines after every
  render.
- `k.word` prefers a match inside the shot, the exact spelling first, and its `nth` counts from 0 among the matches in
  the span it searched; a hit outside the shot is logged with the distance. A common word ('and', 'at') can still land
  on the one said just before the cut: time it by a two-word phrase. For a word said in another shot use `k.gword`.
- `cam.frame` and `cam.fit` assume 9:16; pass `aspect: k.aspect` for other sizes.
- `mat.glass`, `mat.frosted`, `mat.gold` and `mat.molten` take options first, not a colour.
- `in.color` for `dip`: a hex string is sRGB, made linear; through the tone map `'#ffffff'` reads light grey,
  `[8, 8, 8]` reads white.
- `text3d`, `glyphField` and `screen` fonts must be loaded before build; Inter 400-900 (with Greek) and Barlow
  Condensed 500-800 are. For others: `await k.font('italic 400 40px Inter')` in build.
- Greek letters (λ, Δ, μ, π, Ω) come from Inter's Greek faces (`fonts/Inter-greek-400…800.woff2`, 400 to 800 only).
  Other scripts fall back to the system font.
- `globe()` textures blur past a continent filling the frame; chain shots for deeper zooms (snippet 4).
- Strong defocus is handled by the bokeh fill and the sample floor ([7](#7-lens-motion-blur-soft-light)), but a
  defocused object passing in front of the in-focus subject renders badly with or without the fill (stepped copies or
  a hard band where they overlap): keep it at the focus distance, or rack to it. Thin things near the lens (glasses, a
  wire, a rim) are the usual culprits.
- Labels have no leader line by default (`line: true` adds one). Offsets chosen for leader lines (100 px or more)
  leave the text floating far from its dot without one.
- A hero with no `size` is sized by its text: pass `size` to match two heroes, or to keep a number the same size
  across shots.
- Overlay layers are `.layer.layer-<name>`. Do not style `.layer.title` and the like: `.title`, `.hero`, `.hud`,
  `.cap` and `.lbl` style the elements.
- `pulse.place(u)` (and the old `pulse.at(u)`) take a fraction of the curve, not a time: given seconds, the pulse
  vanishes after 1 s.
- A `glow.pulse` on the centre line of an opaque tube (a cable, a wire) shows only its halo, a ring round the tube:
  give it `lift` = the tube's radius.
- `wave.set()` rebuilds from the construction options plus what you pass: call it every update with every field
  that changes.
- The Moon lights itself from beside the camera by default (`sun: 'view'`), so its relief shows wherever the camera
  goes. When it must agree with other lit things in the same sun, give it `sun: [x, y, z]` (or `'scene'`).
- `magnifier()` renders the scene a second time per sub-frame (`refract: false` skips it). What shows in the glass
  is in focus only if `k.lens.focus` is on what is behind the lens.
- `anchor(name)` throws on a bad name; `g.anchors` lists them. `cam.frame(prop)` needs no radius, but an anchor
  passed to `cam.frame` does.
- A texture, material or geometry you cache at module level and share between shots must be flagged
  `userData.shared = true`; otherwise evicting the first shot that used it disposes it, and the shots after it upload
  (or prefilter) it again mid-render.
- 3D type `size` is the cap height, not the font size.
- Text that changes (`extrude.setText`, `scoreboard.set`, the second argument of `bars.grow`) takes values of `ft`; shapes and motion take `t`.
- `glass` type and glass bars read only against something lit behind them. In a night world use `frosted`, `lit` or `emissive`.
- The fonts hold the Latin subset only; other characters draw as "?" with a console warning.
- Bars, donut and the stack hero put a small warm `PointLight` inside their accent part (the warm pool around a lit object); `light: false` removes it.
- `model()`, `head()`, `ear()` and `hand()` are async: `await` them in build.
- Generated meshes are often hollow shells (Hunyuan and Trellis returned the bust that way). Bake with `--solid` (or `--open-base` for a bust or statue) before using `crop`, `cut` or `surfacePoints` on them. Otherwise sections come out as thin bands and points land on the hidden inner wall.
- Crops run in order, and each section is taken from the solid closed so far: put first a plane that crosses the model where its surface is closed. A section that finds no closed loop is skipped (`m.capStats` says why).
- A plane's `at` is a box fraction along its axis: 0 is the minimum, 1 the maximum, whatever way the normal points.
- Generated textures have light and shadow baked in. Prefer `material: 'clay' \| 'satin' \| 'plastic'` with a `color`, and keep `'keep'` for objects whose colours carry meaning.
- The ear's section shows the canal and the eardrum only: no middle or inner ear.
- A `light` transition's `at` is y-from-the-top, like the overlays (`[k.project(p).x / k.W, k.project(p).y / k.H]`),
  not texture space.
- Mirrored edges: early in a whip's incoming half and late in its outgoing half the frame's edge shows a mirrored strip
  of the shot under a lighter smear; keep a bright subject away from the edge the whip comes from.
- `cam.path` with `flow: true` cannot glide through a hold: keys that stop and then cover a long way in a short time
  ask for a dash, and the whole-move ease passes middle keys early, which makes it faster still. `path` warns; spread
  those keys, drop the hold, or use `flow: false`.
- The motion floor measures the focus point, the camera and `k.motionProbes`: a fast object that is none of these (a
  second falling part) needs `k.motionProbes.push(it)` to get its samples.
- A caption chunk can wrap onto two balanced lines: a natural clause over about 28 characters, or a merge that keeps a
  chunk on screen `minDur`. check.mjs's `flicker` line can still list a chunk the size caps force (a clause too long
  for one chunk said too fast for two): reword it, or accept it.
- A highlight `ink` you set is used as given (white on a light pill is hard to read); leave it out and the kit picks the
  readable one.
- `label` `side: 'auto'` decides every frame (overlays are pure functions of time), so the text can jump to another
  side mid-label when a hero arrives or the camera sweeps the object toward an edge. Check stills at both ends of a
  label's span; pass `side` to pin it.
- `avoid` measures visible meshes and lines only: glow sprites and point clouds are left out, and an invisible part
  does not count until it shows. When a part is behind the camera, the label falls back to its anchor point.
- The condensed title fits its longest line to 900 px: "How does [[sand]] think?" on one line comes out at 97 px, and
  `'How does {{sand}}\nthink?'` on two at 153 px. For the 110 px or more of the hook rule, break a headline of 4 or
  more words into two lines.
- Scale bar steps are sorted by time: a step timed by a word that also occurs earlier (the first "even" may be in
  another sentence) lands early and reorders the bar. Time each step by a phrase that occurs once.
- `fx.stars()` defaults are what reads at phone size (20000 stars, `pointSize` 7); a smaller `count` or `pointSize`
  thins the sky below the 150 visible stars look.md asks for. Leave them out.
- `look.productLight` has no `k.` wrapper: call `k.look.productLight(k.scene, target)`. It adds two spots (and a
  1024 px shadow map) to the scene and registers nothing; `follow()` in update if the product moves.
- `k.backdrop({ horizon })` sits behind everything, so a floor that reaches the horizon hides it: the band shows above
  the floor's far edge and through glass. Its `y` is a screen height, not a world height.
- `mat.molten`'s `fade` (default true) makes the material transparent; for a surface that must stay opaque when cold,
  pass `fade: false`.
- Pearl and glass atoms (and `chipDie`, `wafer`, `boule`, `waferStack` and the transistors) reflect the product studio,
  not the shot's environment: `env: 'scene'` for the shot's own.
- `moleculeCloud.setTint` / `setGlow` write per-instance attributes: call them every update like any setter.
- `galaxy.setJet(p, intensity)` takes the jets' intensity as its second argument (no cap): flash them on a word with it.
  Writing the jet's uniforms by hand works until the next `setJet` overwrites them.
- `crossingCircle` reads the spheres' `userData.radius`: change a range sphere's radius with `set({ radius })`, not by
  scaling it, then call `cc.update()`.
- `pcb` and `chipDie` depths follow their size; pass `thickness` for an absolute one.
- `oceanFloor.heightAt` and `terrain.heightAt` are in the prop's own space; for a floor you moved, turned or scaled use
  `heightAtWorld(x, z)` (world in, world out).
- `waveBetween` with `Object3D` ends reads their world positions: add it to the scene, not to a parent that moves.
- `glow.sweep` clips its cover with a world-space plane it recomputes in every `set()`: call `set` every update even
  when the sheet does not move, or a group you moved leaves the old cut behind.
- `xray` (and `phone.setXray`) changes materials in place: a material shared with something outside the object fades
  there too, and `keep` is what stays solid.
- `earbuds` floating out of their case leave a `productLight` aimed at the case: aim a second one at the bud.
- A microwave with the door shut shows a dark window on the default dark enamel: `enamelGlow: 0.2` to `0.3` for a warm
  "running" window.
- On your own closed props, set small dark parts (grilles, buttons) a hair proud of the surface instead of using
  `polygonOffset`: an offset decal inside a closed lid, seen edge-on, pokes through it as a thin dark line.
- `hand.press(p)` is a setter like the others: call it every update (`hand.press(0)` at rest), never once on a word.
  `hand.thumbUV()` is the pad's point at a full press; put the button there, not at the `thumb` anchor's projection
  (that is the thumb's side at rest, off the screen).
- `post.captionShade` takes light out of the 3D picture, one stop at 0.5: a glowing line (HDR) in the caption band
  stays bright through it. Keep lines out of the band while a caption is up; the shade is for lit surfaces and planets.
- The camera's up: a pose's `up` wins over a `camera.up` set by hand, and a pose without one after a pose with one goes
  back to world up. Mixing the two in one shot is the way to a camera that flips; put `up` in every pose instead.
- `globe()` lights its night side faintly (`earthshine .06`): city lights now sit on a dim, cool planet instead of black.
  For the old pure-black night side pass `earthshine: 0`.
- `imagePlane(…, { glow })` without `tonemap: 'inverse'` is plain light through AgX: a photo comes out flatter and paler
  than its file (washed out at glow 2). Use the inverse for photos that must look as they are.
