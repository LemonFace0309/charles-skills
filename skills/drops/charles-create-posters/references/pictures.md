# Making the picture

The swipe file uses five media. Pick the one that fits the idea and the company, then make it look like the real
thing: a photograph that a photographer could have taken, a print that came off a press, pixels that look printed.

| Medium | Fits | Make it with | Seen on |
| --- | --- | --- | --- |
| Photograph | objects, products, animals, places, light | `gen` (an image model), real photos, `edit` | NVIDIA, Ferrari, McDonald's, Dole, Tesla, Apple |
| Print or painting | heritage, craft, luxury, folk heroes | `gen` with the medium named exactly | Hermès (gouache), Robinhood (engraving), Meta bust |
| Pixels, halftone, dither | digital companies, names that are things, portraits | `art.js` in the poster | Nu, BlackRock, Alphabet's Sundar |
| Type as image | companies whose asset or motto is words | HTML/SVG type, `font`, `art.js` type textures | Verisign, Meta motto, Palantir Q2 |
| Collage | material businesses, archives, many small real things | `gen` or real photos, `cutout`, placed by hand | Dollar Tree, Caterpillar, Rollins |

## Photographs (image models)

`gen` defaults to GPT Image 2.6 (`--model gpt`). In a side-by-side on poster-style prompts it gave the most
photographic results: real film grain, believable monochrome grades, deep blacks, crisp small parts. Nano Banana 2.1
(`nano`) is crisper and more literal (a little stock-like) and is the one to use with reference images. MAI Image 2.7
(`mai`) kept surreal objects (fruit with a city inside) most believable. Seedream and Flux came out flatter and are
fallbacks.

Run at least four at draft size (`--n 4`), lay them out with `sheet`, pick one, fix it with `edit`, then `upscale` it
(Topaz, 2x, its padding frame trimmed) for the final. `--size full` renders 2448 × 3264 directly, at a higher cost per
image. Most posters need 8–16 images in all, about $1–3.

Image models ignore sizes in the prompt ("60% of the frame" comes back at 90%). Ask for the composition in words
("small in the lower third, the top half empty"), and when it still comes back too big, zoom out with `extend`: the
picture shrinks onto the same canvas (`--scale 0.7`; `--anchor bottom` keeps a floor or horizon on the bottom edge)
and the new margin is filled.

- **On an evenly lit plain ground** (flat paper or colour, a wall in even light), add `--flat`: the ground grows
  outward from the picture's own edges in code, with grain matched to the picture. Free, exact, no seam. A
  vignette, a pool of light, a shadow or an object on an edge it grows would carry on past the old corners, so it
  warns; then leave out `--flat` (most lit sweeps need the model) or anchor that side to the frame's edge.
- **Otherwise** the model paints the surroundings. Models shift the colours by several levels and repaint the
  picture's outer rim, which leaves a faint frame-shaped seam on a plain ground, so `extend` finds the picture in the
  result, pastes the original back and shifts the margin to match it. The unhealed version stays beside it (`.raw`).

Zoom out before you grade the colour: the model paints the new margin from the picture's light, not from a grade,
so a backdrop graded first comes back greyer in the margin. Grade last.

Either way, open the seam view `extend` writes (`pic/c.seams.png`, colour differences x5): an edge or a change of tint
at the corner marks will show at 100% on a plain ground.

Edits redraw the whole frame, so a fix to one detail can soften everything else. For a local fix, pass the area:
`edit pic/a.png "<fix>" --out pic/b.png --box 0.3,0.6,0.4,0.25` (x, y, width, height as fractions of the image)
keeps the original everywhere outside that box. For an exact shape (a cut-out, a channel, a silhouette with a gap in
it), describe its geometry in words and edit with `--model gpt`: nano rounds off and fills in exact shapes.

### The prompt

Write it like a photographer's shot list, in this order. Name everything; an image model fills anything unnamed with
the average stock photo.

1. **Kind of picture:** "Editorial still-life photograph", "Luxury campaign photograph", "Night flash photograph",
   "Macro food photograph".
2. **The subject, exactly:** what it is, its material and condition, how many. "A single black leather motorcycle
   jacket, worn soft at the elbows, on a wooden hanger".
3. **The set:** ground and surroundings. "On an old bentwood coat stand in an empty room with black velvet curtains".
4. **The light, named:** "one hard spotlight from high left, everything else falls to black", "flat overcast north
   light", "on-camera flash at night, the background lost to black", "one saturated red gel light from the right".
   When you add an object to a scene, name the scene's light for it too ("the needle lit only by the dusk sky behind
   it"): models light an added object like a studio product, and critics see two lights.
5. **Camera and film:** "shot on 35mm Kodak Tri-X, pushed, visible grain", "medium format, Portra 400", "85mm, f/2".
6. **Composition, with room for the logo:** where the subject sits, how big, and what stays empty. Pick it for
   the idea: small and low in a big field when emptiness is the point (a jacket waiting for its owner); big and close
   when the subject is the joke (a potato crowned like a jewel reads faster filling the frame than as a dot); full
   bleed when it's a pattern. Match the layout you plan (system.md).
7. **Mood, three words at most:** "quiet, mysterious, expensive".

Light the ground, never fill it. A real seamless paper or wall falls off from the light to the edges and takes the
subject's shadow; a flat field of one colour makes the subject look cut out and pasted on. Write it in: "the red
paper sweep lit from the upper left, falling off to deep red at the edges".

`gen` adds "no text, letters, numbers, logos or watermarks" itself; keep it there, because type comes from the poster
and logos from real files. Pass `--allow-text` only when the picture shows real printed matter (a price tag, a label)
and you'll check every word.

When the picture must keep a shape (a bottle, a car, a logo's outline), give it as a reference to `--model gpt`.
Nano with a style reference tends to copy the reference image wholesale and drop the shape. When a generated colour
drifts off the brand's (a yellow lime for a brand green), `recolor --to "#hex"` pulls those hues onto the brand's
while keeping the shading. It's for an object of one hue; on a landscape, with its spread of hues, it drags the
neighbours along, so prompt the colour instead. When the backdrop came out off the brand (a dull navy for an
electric blue), cut the subject out and grade the backdrop: `cutout pic/a.png --out pic/cut.png`, then
`recolor pic/a.png --to "#hex" --ground pic/cut.png --out pic/b.png`. It keeps the light and takes the brand's hue
and colourfulness; `--subject 0.3` lets a reflective subject take a little of it, as a mirror would. Grade after
any `extend`, never before.

### Real products and places

When the product has to be exactly right (a specific car, a packaged product, a device), the model will get details
wrong. Get a real photo (the company's press kit, or Wikimedia Commons with its licence noted in `brief.md`) and use
`edit pic/real.jpg "<put it in this scene>" --model nano`, or `cutout` it and composite it in the poster with your
own shadow. Check badges, wheel counts, buttons and proportions against the real photo at 100%.

### People

Never generate a real person's face or body: it looks wrong, and putting words or acts on a real person isn't ours to
do. When the idea needs a person, in order of preference:

1. **Their signature object instead** (the jacket, the glasses, the chair). It's usually the better poster anyway.
2. **An anonymous figure** seen from behind, in silhouette or too small to identify.
3. **A real, licensed photo** (Wikimedia Commons, CC BY or CC BY-SA; note the author and licence in `brief.md` and in
   your delivery message), treated so it becomes a print: `Art.halftone`, `Art.pixelate`, `Art.dither`, a blur or a
   crop to the eyes. Never alter what the person is doing or wearing.

## Prints and paintings

Name the technique, the tool, the paper and the printing: "copperplate engraving, fine cross-hatching, printed in one
dark green ink on green bookcloth", "loose gouache and watercolour on cold-press paper, visible brushstrokes, the
white paper showing through", "two-colour risograph, slightly misregistered". Prints sit on `data-grain="paper"`;
paintings often want the `band` layout so the unpainted paper holds the logo and any words.

## Pixels, halftones and dithers (art.js)

Draw them in the poster with `art.js`, so every edge is crisp at 2520 px:

- `Art.pixelate(canvas, source, { cols, palette })`: a mosaic in a fixed palette. The source can be a generated
  picture, a real photo, or shapes you draw on a canvas. Use 16–40 columns and 4–7 colours from the brand.
- `Art.halftone(canvas, source, { cell, angle, ink, ground })`: dots sized by darkness, for portraits and objects.
- `Art.dither(canvas, source, { palette, pixel, kind })`: Atkinson or Bayer dithering into a palette.
- `Art.typeTexture(canvas, mask, { text, font, cell })`: a word repeated in a monospace grid that draws the mask's
  shape (a logo SVG works as the mask).

The trap is "too video game". Keep cells big, colours few and flat, no glows, gradients or bevels, and put the result
on paper grain so it reads as printed.

## Type as image

Load the faces you need with `font "<Google family>" --out <dir>/fonts` and set the type in HTML or SVG. Type posters
cost nothing in image calls but take the longest to build: budget the time for a layout that fills the panel without
visible repeats, and draw it in code you keep (`plan/` or a script) so it can be rebuilt. For a type
wall, use 10–20 genuinely different faces (a blackletter, a pixel face, a script, a slab, a wide grotesk, a mono) at
very different sizes, in one colour. For text along a path, use an SVG `<textPath>`. Every word must be spelled right:
type set in code always is, which is why type is never generated.

## Collage

Make or find the pieces (generated objects on plain grounds, real photos), `cutout` them, and place them by hand in
the poster as `<img>` layers with `transform: rotate()` and a soft shadow (`filter: drop-shadow(...)`). Vary size and
angle like a person did it, overlap edges, and let one piece break the frame or cross the type if it helps the joke
(Rollins). A seeded random (`Art.random(seed)`) makes scatter repeatable.

## The tells: check every picture at 100%

Reject or fix any of these. Fix one thing at a time with `edit`; re-roll only when the idea or composition is wrong.

- Plastic or waxy surfaces, skin like rubber, metal like chrome paint.
- Melted or mangled detail: fingers, wheels, spokes, zips, stitching, buttons, cables, small text.
- Any text, letters or logo-like marks inside the picture.
- Too perfect: symmetry, tiled repeats, every object identical when real ones would differ.
- Light that doesn't agree: shadows going two ways, a subject lit with no source in the scene, a glowing rim.
- HDR crunch, oversharpening, a bright halo around the subject.
- Anatomy and structure: count legs, fingers, wheels and windows; check that faces have one nose and one mouth; check
  that an object could actually be built and a food could actually be eaten. Quartr's own posters slip here (roaches
  with eight legs, a fox with two snouts, a burger stack that makes no sense), and a sharp viewer catches it.
- A subject that's too small to read at phone size, or so big it fills the frame like a catalogue shot. The one
  detail the idea depends on (the sole in the iron, the mustard on the marble) must read at 300 px wide.
- The picture fighting the type: busy detail where the logo or words sit.
- Crunch from the upscaler: fine texture (brushed metal, fabric, paper) sharpened into a pattern, sometimes into
  marks that look like letters. Check the upscale at 100%; `upscale --soften 0.35` blends a plain upscale back in.
- Banding in a smooth sky or sweep. Check it at 100% before fixing it: downscaled sheets and thumbnails band on their
  own, so a gradient that steps in a preview is often smooth in the file.
- Fine texture that only looks real at 100%. Critics, and the feed, judge at thumbnail size: stitches, weave, paper
  fibre and snow have to read as real at 300 px too. Upscaling a generated fine texture can turn it wiry; add paper
  and grain in the poster's finish instead of baking them into the picture.
