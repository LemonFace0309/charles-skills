# Look: what makes the frames read as premium

Contents: 1. The frame plan · 2. Type · 3. Palettes by world · 4. Light · 5. Materials · 6. Depth of field · 7. Atmosphere · 8. Composition · 9. What reads as cheap or AI-made · 10. Checklist for your own stills

Every rule here comes with a number measured from the reference reels, and where it maps onto the kit, the setting
to use. Pixel values are in the 1080 x 1920 layout space that `ui.js` uses. Luminance is sRGB 0 to 255.

The references were twelve 9:16 reels: five 2.5-minute dark 3D tech explainers (the main target), five 30 to 46 s 3D
story reels with very fast pacing, and two 72 s explainers built from UI on 3D screens and line doodles. To measure
them, OCR found every text box and when it appears (about 5,600 frames). Glyph extents on full-resolution frames gave
cap heights, x-heights and pill boxes. Colours come from k-means clusters on 3D-only frames, tone from luminance
histograms, and depth of field and focal points from tile sharpness maps with the text masked out. Presenter
(talking-head) shots were removed before measuring the 3D look.

"Night world" below means the four dark worlds (ocean, chip, space, warm interior). "Mid-key" means the brighter
product/kitchen world.

## 1. The frame plan

The zones are `reel-spec.json`'s (the platform's top and the headline, subject and caption bands, shared with
charles-claude-editing); the measured column is where the reference reels put things.

| Zone | y (px) | What goes there | Measured |
| --- | --- | --- | --- |
| Top UI | 0 to 200 | nothing | no overlay text in any reference starts above y 230 |
| Headline band | 240 to 660 | hook title, hero number, HUD, section word | title first line top 250 to 325, hero top 240 to 460, HUD digits top 255 to 275 |
| Subject band | 650 to 1270 | the one focal object | centroid of sharp detail: median x 0.49 to 0.51, y 0.45 to 0.53 of the frame; 10th to 90th percentile y 0.34 to 0.66 |
| Caption band | 1320 to 1500 | captions | one-line caption centred at y 1389 to 1457 |
| Bottom | 1540 to 1920 | quiet world only | the platform's caption and buttons cover it |

- Keep the subject centred. In 82 to 98% of 3D frames the centroid of the sharp detail sits inside the central box;
  for this kit the subject's silhouette stays inside x 200 to 880, y 560 to 1280, clear of the caption band. Move it
  off-centre only for a two-thing comparison or to make room for a label.
- While a caption is up, nothing in y 1320 to 1500 is bright: at most 2% of a caption's box above luma 120 in the 3D
  picture (`--audit` flags more). Fade world lines to 30% below y 1300.
- Text never covers the subject's silhouette: the hero sits above it, the caption below it, labels beside it.
- Side margins: caption lines are short (median width 440 to 550 px, 90th percentile 620 to 770 px), so they keep 150 px
  or more from each edge. Titles and long hero numbers run to 75 to 90 px from the edges; a corner HUD to 35 to 40 px.

## 2. Type

### Typefaces

- Three of the five long references set everything in one heavy neo-grotesk (in the kit: Inter 700 to 800). One sets
  everything in a condensed bold (in the kit: Barlow Condensed 700): captions, title, hero, HUD and labels. One uses a
  rounded geometric bold.
- Use Inter for words. Use Barlow Condensed for counters, and for the whole video only when you want an industrial,
  instrument feel. Never add a third family.
- Anything that counts uses tabular figures (`.hero` and `.hud` already set them).

### Captions

| Property | Measured | Kit |
| --- | --- | --- |
| Size | 56 to 70 px (x-height 30 to 39 px), median about 66 px | `captions.size` (default 66) |
| Weight | 700 to 800 | default 700 |
| Colour | `#FFFFFF`, or warm off-white `#F2EDE4` in a warm world | `--text` |
| Shadow | soft dark drop shadow, no outline | `--shadow` |
| Position | one line centred at y 1389 to 1457 (74% of the height); two lines span 1320 to 1480 with a 77 to 82 px pitch (1.15 to 1.2 x size) | `captions.bottom` (default 450) |
| Length | 3 to 5 words, median 4; single line in 94 to 100% of chunks in three references (the other two mix in 2-line chunks of 5 to 7 words) | `maxWords: 4`, `maxChars: 24` |
| Duration | median 0.8 to 1.4 s per chunk, about 1.0 s overall | follows the words |
| Entrance | the chunk fades in over about 0.1 s with no slide or bounce; or build mode, where each word fades in on its own start (0.07 to 0.13 s) and unspoken words are invisible | `mode: 'chunk'` or `'build'` |

The fast story reels sit lower and shorter: one line of 2 to 3 words centred at y 1505, a new chunk every 0.7 to
0.9 s, white with a thin dark outline because their worlds are bright. The UI/doodle explainers sit higher and
smaller: about 40 px type centred at y 1228, because the drawing owns the middle of the frame.

Highlights:

- At most one per chunk. About one chunk in four carries one (between one in three and one in six), which is roughly
  one highlight every 4 s.
- Highlight a number with its unit ("200 milliseconds", "12 centimeters", "80%"), the name of the mechanism being
  introduced, or the viewer's own object ("your phone"). Never a filler word.
- The highlight takes the colour that thing has in the 3D world: heat, energy and signals amber or orange; water and
  cold blue; radio waves in a green-wave world green; far-away space objects lavender. A neutral noun or number can
  take a white pill. The colour is how the caption points at the picture.
- Pill: solid fill, near-black text (`#121311` to `#141410`), height 1.10 to 1.14 x the font size (74 to 80 px at 66
  to 70 px type), side padding about 0.22 em (15 px), radius 0.15 to 0.2 em (10 to 14 px), no border, no glow. It
  appears with its word as a 0.1 s fade (the kit's wipe also works). The padding is reserved from the start, so the
  line never reflows.
- Measured pill fills: amber `#F4B744` and `#F6BE54`, orange `#F2A142`, blue `#55ADF6`, white `#F4F4F4`.
- Coloured text instead of a pill (used with condensed and rounded caption faces): amber-yellow `#F2C12E`, green
  `#9EF987`, pale gold `#F2D787`, lavender `#CDD3FB` with a faint glow.

### Hook title

- On frame 0, first line top at y 250 to 325, 2 or 3 lines, ending by y 660.
- Size it by width: the longest line is 810 to 960 px wide (75 to 89% of the frame). That gives 74 px for a 3-line
  sentence, 95 to 110 px for a 2-line question, up to 136 px for 2 lines of condensed capitals. Line pitch 0.97 to
  1.05 x size.
- One emphasis only:
  - a pill on 1 or 2 words (amber `#F6BE54`, near-black text, pill height about 1.25 x size, side padding about
    0.24 em), never broken across two lines; or
  - one word in the accent colour; or
  - in the condensed style, the whole headline in the accent (`#F9CF20`) with an outer glow, plus one white
    sub-line at 0.45 x size.
- It stays 1.4 to 4.2 s (median 2.4 s) and fades out. It may be swapped once for a second headline (on screen about
  0.8 s) before the story starts. In a reel that dives (SKILL.md Hook) it leaves as the dive starts, by 1.2 to 2.4 s.
- The hook headline this kit makes: 2 to 6 words at 110 to 150 px. Condensed: `title(html, { style: 'cond' })`, Barlow
  Condensed 800 capitals in the accent with a 0.12 em glow and a white `((sub-line))` at 0.32 x.
- The title is not the first sentence of the voiceover. The voice starts the story ("This is one water molecule");
  the title states the surprising claim ("Why does [ice] float?"). Keep it to 9 words or fewer so it reads in one
  second.
- Kit: `k.ui.title('Why does [[ice]]\nfloat?', { at: 0, until: 2.2, y: 270, size: 108 })`. With no `size`, `title()`
  fits the longest line to 880 px (900 px in the condensed style).

### Hero numbers

- Position: centred, top edge at y 240 to 460. A number that measures something in the world (a distance along a beam,
  the gap between two points) sits beside that thing instead, in the subject band (y 650 to 1100).
- Size by length. Long values (7 or more digits with separators) fill 900 to 930 px of width: cap height 78 to 96 px,
  which is Inter 800 at 107 to 132 px. Short values (6 characters or fewer) go big: cap height 125 to 260 px (180 to
  360 px type), 300 to 780 px wide. Never below a 75 px cap height. For Inter 800:
  `size = min(300, 900 / (0.6 * digits + 0.3 * separators))`. With no `size`, `hero()` applies this formula.
- Colour: white with the soft shadow for a neutral fact; the world's accent with an outer glow (blur about 0.15 x size,
  50 to 60% opacity) for the quantity the story is about; `#CA2D4A` red for a loss or an error; a gradient only when
  the idea is literally a spectrum.
- Unit: same colour, 0.30 to 0.40 x the number's size, on the same baseline, about 0.1 em gap ("200,000 km/s"). Kit:
  `unit` (0.4 em).
- Sub-label: what is being counted, 1 to 5 words, 0.20 to 0.45 x the number's size (40 to 64 px), white at 75 to 90%
  opacity, centred 10 to 30 px below ("turns per second", "packets"). Kit: `sub` (0.3 x the number, 40 to 64 px).
- Long precise values (clocks, coordinates): group the digits in threes with thin spaces ("12:04:09.381 000 112"), put
  a small label above each line ("Satellite", "Your phone": about 0.55 x size, 70% white), and colour only the digits
  that differ, in the accent.
- Equations build term by term on the words. A tiny label (28 to 32 px, 60% white) above a term names it ("speed of
  light" over "299,792 km/s"). The term being solved for is in the accent.
- A hero holds 0.8 to 2.6 s (median about 1.4 s), then fades and lifts out in about 0.3 s. It enters with a fade plus
  a scale from 0.85 to 1.0 over about 0.2 s, or with a count-up (see pacing.md).

### HUD (running counter)

- One corner, usually top-right. Top of the digits at y 255 to 275, right end of the unit at x 1040 to 1045.
- Barlow Condensed 700, cap height about 60 px (86 to 90 px type), zero-padded to a fixed width ("005"), unit at
  0.3 x ("ms").
- Colour: the cool secondary, light cyan `#77D9FC`, with a soft glow (about 18 px, 40 to 55%). Never the warm accent:
  the warm colour belongs to the story's subject.
- A second counter (items arrived, items lost) goes top-left at the same height: the count in white, or in red while
  something is missing, with "/ total" in white at 0.33 x.
- It never moves, resizes or changes colour between shots.
- Kit: `hud({ format: (v) => String(v).padStart(3, '0'), unit: 'ms' })`; the defaults are 88 px, `#77d9fc`, right
  edge (unit included) at x 1040, y 250.
- For time-lapse ideas there is a centred variant: a line-art stopwatch icon, "0:00" in Inter 800 (cap about 100 px),
  and a sub-label "1 tick = 1 second" at 0.45 x, in the headline band.

### Labels pinned to 3D points

- 44 to 60 px bold (cap height 31 to 45 px), white, soft shadow, 1 to 3 words. An optional second line of 34 px or
  more (kit default 0.74 x 46) carries the detail, tinted with the cool secondary (`#7BB7D6`) or 70% white. Text that
  must be read is 40 px or more; smaller sub-lines (20 to 35 px) were unreadable at phone size in testing.
- 30 to 150 px from the anchor, beside or above it; never on the subject's silhouette, never in the caption band.
- Mark the anchor with a small glowing dot (6 to 10 px core plus bloom) on the exact point, or not at all when the
  label sits next to an obvious object.
- Leader lines are rare; most reference labels have none. When one is needed: 2 px, white at about 80%, straight,
  150 px or shorter. In-world lines do this job far more often: a border drawn on the planet, a beam, a dimension line
  with end ticks (`glow.dimension`).
- At most two labels at once, each on screen 1.5 to 4 s.
- Kit: `label()` defaults to 46 px with a 0.74 x sub line (34 px at least), a dot and no leader line (`line: true` when
  the anchor would be ambiguous); `size` sets another size.

### Line art and doodles

- Two uses: symbols drawn in 3D space over the real object (a logic-gate symbol over the 3D gate, a loop drawn as a
  glowing circuit), with a white-hot core, an amber halo and bloom; and a flat doodle page for abstract steps.
- Doodle page: flat charcoal `#21262B`, warm off-white strokes `#D6D5CA` at 5 to 6 px with round caps and a slight
  hand-drawn wobble, hand-lettered capitals with a cap height of 45 to 60 px, one muted gold for the key term, green
  for plus or success, brick red `#C04D49` for minus or failure.
- Each element draws on with its word in 0.3 to 0.8 s, and the drawing accumulates into one composition.
- Kit: `ui.doodle(svg)` (defaults 0.6 s, 5 px, `#d6d5ca`, a slight seeded wobble); `glow.line` and `glow.tube` for
  symbols in 3D.

## 3. Palettes by world

Sampled from 3D-only frames. Luminance columns: median of per-frame medians (with the interquartile range across
frames), share of pixels below 20, share above 200.

| World | Kit palette | Darks (most of the frame) | Mids and structure | Warm accent | Cool secondary | Luminance |
| --- | --- | --- | --- | --- | --- | --- |
| Ocean night | `ocean-blue` | `#03092F` `#050B28` `#0A113E` `#091343` `#0C122B` | `#191F45` `#13216C` `#323F92` (dune crests) | `#F9D21F` pulse, title, highlighted words | `#77D9FC` HUD, fibre light | 23 (17 to 37), 41% < 20, 0.9% > 200 |
| Chip night | `night-amber` | `#0A1728` `#111A28` `#122132` `#152539` | `#2F3039` `#4F4B4B` (metal) | `#EEB043` and `#D0A657` glow, core `#EED5B1`, pill `#F4B744` | none | 32 (24 to 45), 22% < 20, 1.0% > 200 |
| Space | `space` | `#0C0B0D` `#0F1114` `#151213` `#1D1A1A` (neutral, slightly warm) | Milky Way `#292728` `#3F3A39` `#746862` | `#F6BC51` signal lines, solved term | `#CDD3FB` and `#B3B9D9` lavender for far-away objects | 21 (16 to 30), 47% < 20, 0.7% > 200 |
| Night city | `space` | `#0B0A0B` (44% of the frame) | facades `#4B423A` `#786E63` | windows `#D3C5B8` `#C2A97E`, lines `#F6BC51` | none | 16 to 19, 50 to 54% < 20, 1 to 3% > 200 |
| Warm dark interior | `emerald-night`, see note | `#090705` `#17100C` `#181412` `#26221A` (brown-black) | backlit windows `#DEB989` | the signal is green: `#77BB61`, text `#9EF987` | pale gold text `#F2D787` | 11 (9 to 40), 67% < 20, 1.5% > 200 |
| Night kitchen / product | `studio-cool` | `#0B192B` `#020A16` `#0A2C4B` `#1F3F60` | `#376591` `#5A81A6` `#7F9AB6` | `#F2A142` waves, heat | `#55ADF6` water | 71 (60 to 112), 1% < 20 (mid-key) |
| Sunset bookend | `dusk` | `#2C0709` `#4B1814` `#864219` | `#B9771F` `#AB5162` | `#F6DEBC` sun, glowing object | none | about 70, 18 to 22% < 20 |
| Doodle page | none | `#21262B`, flat | none | muted gold | red `#C04D49`, green | flat |

- One warm accent per video, given to the protagonist of the explanation: the signal, the pulse, the active part, the
  term being solved. One cool secondary for the system around it: time, infrastructure, water. Red only for loss or
  failure.
- Big areas stay dark and low in chroma. In a night world the background's brightest RGB channel stays at about 90 or
  below (the ocean darks peak at 62). Vivid pixels (saturation above 0.5 with the brightest channel above 90) cover a
  median 0 to 12% of a night frame, and even the busiest 10% of frames stay under 45%.
- Pixels above 200 are 0.7 to 1.5% of a night frame: emissive cores, the hero number and text. If more than about 4%
  of the frame is near-white, the scene is overlit.
- Measured with the command in the checklist, night worlds read YAVG 35 to 44 (25 to 59 across frames), YLOW 2 to 15,
  YHIGH 69 to 90 (155 in the backlit interior) and SATAVG 3 to 17. The mid-key kitchen reads YAVG 74 and SATAVG 20.
- `emerald-night`: in the reference the world is a warm near-black interior and only the radio waves are green. Do not
  tint the whole world green. The kit palette follows this row: brown-black backdrop and fog, warm lights (key
  `#ffe7cc`, rim `#deb989`, fill `#26221a`, secondary `#f2d787`), and the accent `#7dff9a` for the signal only.
- `ocean-blue`: the secondary is the HUD's `#77d9fc`; the backdrop's glow stays deep blue (`haze: '#58b4ff'`) so the
  big areas keep the measured blues.
- The sunset and desert palette is for the opening and closing images (the bookends), not for the explanation.

## 4. Light

- Key: soft and dim. Most night frames have no visible sun. The key is a cool top-back light (moonlight through water,
  sky glow above dunes, haze in a hall) that shapes forms with gradients.
- Rim: strong, cool edge light on every silhouette (dune crests, transistor edges, rack edges, the frame of a phone).
  After the emissives, rim highlights are the brightest pixels in the frame.
- When a floor fills the frame, use the rig's `shadowSize` 30 to 40 (the default 12 draws a hard shadow-frustum edge
  across it). A low rim or backlight glares on any big dark surface at grazing angles (wood, a floor, a crucible's
  lip): use the dark walnut (`desk({ tone: 0.25 })`), a Lambert material, or no rim light for those surfaces.
- A product in a night world gets `k.look.productLight(k.scene, product)`, a narrow cool spot from top-back plus a
  small fill: white plastic reads mid-grey under the night rig without it.
- Warm light comes only from story objects: the pulse in the cable, the active transistor, the signal lines, a phone
  screen, lit windows. The emissive object also lights its surroundings with a warm pool, so the cable glows where the
  pulse is and the floor under the active gate turns gold.
- Values: the hero glow's core reaches 240 to 255; everything else apart from text stays under about 120. The darkest
  1% of pixels sits at 7 to 10, not crushed to 0 (deep space and the warm interior go to 1).
- Vignette: corners at 30 to 68% of the centre's brightness.
- Separation: a slightly lighter backdrop region behind the subject (a horizon glow, haze in a hall), so dark objects
  read against it.
- Mid-key product scenes: a large soft top light, a white rim, cool blue fill; the warm accent is still the emissive
  story element.
- Kit, for an object against a backdrop: `k.rig({ keyScale: 0.4 to 0.6, rimScale: 1.2 to 1.6, fillScale: 0.3 to 0.5,
  soft: 0.8 to 1.2 })` with `rimPos` behind the subject (on the far side from the camera), `k.backdrop({ glow: 0.1 to
  0.2 })`, emissive intensity 4 to 6 for lines and 14 to 30 for pulse heads.
- Kit, when a floor or terrain fills the frame: directional lights light every square metre of it equally, and that
  even mid-blue floor is what reads as milky. Keep them dim (`keyScale` about 0.2, `rimScale` about 0.35 placed low and
  behind, `fillScale` about 0.15, `k.env(kind, 0.15)`) and let point lights at the emissive objects make the warm
  pools. Tested on an ocean shot whose rim light sat on the camera side (acting as a front fill): this took
  the opening still from YAVG 50 and SATAVG 34 to 43 and 23, with the floor dark except around the pulse.
- A milky frame is not fixed by exposure or fog. Tested on an ocean world: `post.exposure: 0.55` brings YAVG from 51 to 70
  down to 35 to 49, but the two ocean stills stay flat (YHIGH minus YLOW falls to 41 and 49); a darker fog and
  backdrop alone moved YAVG by only 1 to 3. Fix the light on big surfaces (above), then composition and detail: the
  reference looks down the cable from higher up, in deep focus, with the whole sea floor sharp and full of rocks and
  ripples.

## 5. Materials

What reads as expensive in the references:

- Brushed or polished metal reflecting a soft studio-like environment, roughness about 0.25 to 0.4, with long visible
  highlights (`mat.brushed`, `mat.metal`, `k.env('studio')`).
- A bevel on every hard edge (rounded boxes for tags, racks, chips, packets). No knife edges.
- Clearcoat on painted and plastic parts, matte rubber on cables and grips for contrast.
- Glass shells and cutaways to show the inside of things: thin dark edges, refraction, the inner parts lit
  (`mat.glass`). Glass, crystal and liquid only read with something lit behind them (a horizon glow, an inner point
  light): transmission shows only what is behind, so in a dark void they read as opaque pebbles.
- Molecules: heroes in the 'pearl' style (translucent, lit from inside), crowds in 'matte' (pinpoint highlights turn
  into lattices out of focus). Transistors and chips in metal greys, with the accent only on the active part. Anything
  human in 'skin' (the hand's default), never clay. Anything molten in `mat.molten` (white-hot facing the camera,
  orange rim), never a uniform emissive ("a glowing soap egg").
- Frosted, translucent spheres for atoms and molecules, with strong bokeh around them (`mat.frosted`).
- Emissive lines with a white-hot core and a coloured sheath (`glow.tube`, `glow.pulse`).
- Micro-detail at three scales on anything big: ripples, pebbles and rocks on a seabed; panels, seams and bolts on a
  machine; braid and jacket on a cable. Instances vary in size and rotation (`noiseTexture` bump maps help).
- Real objects at real scale as size cues: a fingernail under a chip, a garden hose next to a cable, a human hair next
  to a fibre.

What reads as cheap: unbevelled boxes, one roughness for everything, glossy plastic on every surface, untextured
infinite floors, objects floating with no contact shadow or reflection, identical instances in a perfect grid,
saturated diffuse colours.

## 6. Depth of field

Two regimes, chosen per shot:

- Object and macro shots (a part, a mechanism, a character, a molecule): 5 to 25% of the textured frame is sharp. One
  focal plane runs through the subject, and both the foreground and the background melt. Out-of-focus lights become
  round discs 20 to 120 px across. In the night-kitchen, warm-interior and story references, 61 to 97% of frames look
  like this.
- World shots (a planet, a city, the ocean floor, a top-down grid): deep focus, with more than half of the textured
  frame sharp. The subject is singled out by light and contrast, not blur. The space and ocean references are 66 to 78%
  world shots; the chip reference splits 35% macro and 53% deep.

Rules:

- Focus sits on the thing the caption names right now. When the subject changes inside a shot, pull focus over 0.3 to
  0.6 s.
- Kit: `k.lens = { blur: 0.016 to 0.03, focus: subject }` for object shots, `blur` 0.006 or less for world shots.
  Never blur a world shot to hide missing detail.

## 7. Atmosphere

- Floating particles (marine snow, dust, haze motes): 10 to 40 visible, most of them out of focus as soft discs 20 to
  70 px across, dim (at most a quarter of the hero glow's brightness), drifting under 30 px/s. Kit:
  `fx.dust({ count: 300 to 900, pointSize: 0.01 to 0.02, intensity: 0.6 to 1.2 })` with the lens on.
- Distance fades into the world's dark colour, so the far field becomes backdrop (rows of transistors, dunes, city
  blocks). It is not a grey haze laid over the subject.
- A lighter gradient region behind the subject, such as a horizon glow (`k.backdrop({ horizon: 0.4 })` in any
  palette; every diving studio hook measured has warm light behind or inside its hero).
- Space: the kit's stars stay sharp under any lens (never blur them); 150 or more visible at 390 px width, the Milky
  Way made of stars with dust lanes (`fx.milkyWay`), never an fbm smoke band; blacks at 6 to 10.
- Stars: dense, mostly dim, a few bright; a warm Milky Way band behind planets.
- Sparks and glints on active elements; volumetric beams for signals going up or down (`fx.beam`).
- Lens: bloom on emissives (halo about 1 to 3% of the frame width), sometimes a thin horizontal streak on the single
  brightest point, the vignette above. No rainbow flares.

## 8. Composition

- One focal object per frame: the brightest, sharpest and most saturated thing is the same thing, near the centre.
- Lead the eye with a line: a cable from a bottom corner to the centre, a beam from the top, a street into the
  distance.
- Portrait frames are narrow. Fill 50 to 80% of the width with the subject in object shots (`cam.fit` thinks in
  width). In world shots, run a horizon or a line through the subject band.
- When a hero number or title is up, the subject sits lower (centre at about y 900 to 1100) so the number has dark
  space above it.
- Show a scale cue whenever a size is said.

## 9. What reads as cheap or AI-made

- Milky frames: lifted, foggy and flat. In numbers, a night world with YAVG above 50, SATAVG above 25, or YHIGH minus
  YLOW under 55. An early ocean, phone and packet set measured YAVG 51 to 70 and SATAVG 28
  to 37; a premium studio ocean shot measures YAVG 38 and SATAVG 17.
- Large saturated mid-blue areas (`#08355D` to `#164E77`) instead of deep navy (`#03092F` to `#0A113E`).
- Two warm accents competing, or the accent used as decoration rather than to mark the subject.
- Glow on everything, bloom on surfaces that do not emit, neon edges on every object.
- A product on a seamless colour backdrop. Put it in a place: a nightstand at night, a hand in a dark room.
- Text over the subject, titles longer than 3 lines, a pill broken across two lines, two highlights in one caption.
- Small labels (under 40 px) with leader lines everywhere; frosted-glass cards; sci-fi HUD clutter (hex grids, corner
  brackets, scan lines) that carries no information.
- A locked-off camera; random shake; a tilted horizon that does not move.
- A number that differs from what the voice says, lands late, or stays after the voice has moved on.
- Plastic-toy materials (see section 5), perfect symmetry, perfect repetition.
- An empty navy void with one glowing line in it; a field of tiles or bits square to the camera filling the frame;
  clay or cartoon people beside hard-surface renders.
- A light transition that washes the frame to flat grey; whips and zooms with stepped copies; out-of-focus
  highlights broken into lattices or stripes (the kit's defaults fix all three: keep them).
- Rainbow gradients without a reason, emoji, clip-art icons, stock "AI brain" imagery.

## 10. Checklist for your own stills

Render 4 to 6 stills spread over the video (`bun kit/render.mjs <project> --stills a,b,c,d --audit`) and check each 3D
frame:

1. Tone. Run
   `ffmpeg -hide_banner -i still.png -vf "scale=270:480:out_range=pc,format=yuvj444p,signalstats,metadata=mode=print" -f null - 2>&1 | grep -oE "(YLOW|YAVG|YHIGH|SATAVG)=[0-9.]+"`.
   Judge the median over your stills (single frames vary about as much as the references do: YAVG 25 to 60). A night
   world needs YAVG 30 to 50, YLOW 15 or less, YHIGH minus YLOW 55 or more, and SATAVG 20 or less. A mid-key world needs
   YAVG 60 to 90 and SATAVG 30 or less. Per shot row (`tone` in project.json; render.mjs uses it): space YAVG 16 to
   34, YLOW 10 or less, YHIGH minus YLOW 45 or more; screen (a photo or data filling the frame) YAVG 30 to 60, SATAVG
   30 or less; warm (a product shot, a warm interior) YAVG 25 to 60; hot (a frame-filling melt, fire or sun) YAVG 40
   to 110, YLOW 25 or less, YHIGH minus YLOW 90 or more.
2. The brightest, sharpest and most saturated thing is one object, its silhouette inside x 200 to 880, y 560 to 1280.
3. One warm hue in the frame (plus white); the cool secondary only for time or the system; red only for loss.
4. Caption: 3 to 5 words on one line, 62 to 70 px, centred at y 1390 to 1460, white, at most one highlight, in the
   colour of the thing it names.
5. Hero: top edge at y 240 to 460; a long number about 900 px wide, a short one with a cap height of 125 px or more;
   unit 0.3 to 0.4 x, sub-label 0.2 to 0.45 x.
6. HUD: fixed corner, condensed, zero-padded, cyan, in the same place in every shot.
7. Labels: 44 px or larger, two or fewer on screen, beside the anchor, no leader line unless the anchor is ambiguous.
8. No text above y 200 or below the caption band (y 1500), none within 60 px of the sides, none under the buttons
   (right of x 940 from y 840 down), none over the subject. `--audit` reports each from `reel-spec.json`; a corner
   HUD may sit 40 px from the sides.
9. Depth of field fits the shot: in an object shot only the subject is sharp, with discs behind it; a world shot is
   sharp across the floor or the planet and full of detail.
10. Materials: visible bevels, at least two roughness levels, micro-detail at three scales on anything that fills more
    than a third of the frame.
11. Air: some floating motes or haze, dark corners, a lighter region behind the subject.
