# Plates: generated stills as 2.5D sets

A plate is a cinematic still, generated with AI, that the kit turns into a set the 3D camera can move through. The still
is wrapped onto a dense mesh pushed out by its depth map, so from the camera that "took" the picture it looks exactly
like the still, and as the camera moves, near things slide past far things with real parallax and real lens blur.
Glowing lines, labels and pins sit in the picture at the right depth, because they are placed on its surface.

Two pieces:

- `kit/plate.mjs` makes the still and its depth map (fal: Nano Banana Pro for the image, MoGe-3 for depth and the
  camera's field of view).
- `k.props.plate()` (engine/props/plates.js) builds the 2.5D set in a shot.

## Plate or model?

Use a plate when the scene is a place, not a mechanism:

- Rich, lived-in places that would take days to model: a kitchen at 1 AM, a crowded train, a city street at night, a
  classroom, a server room, a hospital corridor.
- Establishing shots: "you're standing in your kitchen" before the camera dives into the microwave.
- Anything where the audience must recognise a real place in under a second.

Model it (or use a prop) when:

- The camera must go around it, inside it, or far from where the still was taken (plates hold for small moves only).
- It has to move, open, explode, assemble, or react to the voiceover (a plate is frozen).
- It is the thing being explained: the chip, the molecule, the engine. Explanations need geometry you control.
- It needs exact text, numbers, logos or a real product (image models draw these wrong; put text in the type layer).

A common pattern: a plate establishes the place, then a cut or a zoom transition takes the camera into a modelled
close-up of the mechanism.

## Making a plate

```
bun kit/plate.mjs <project> --name kitchen --prompt "A kitchen counter at 1 AM. A closed microwave ..."
```

Writes to `<project>/assets/plates/`:

| file | what |
| --- | --- |
| `kitchen.png` | the still, 1536 x 2752 at the default 2K |
| `kitchen-depth.png` | 16-bit greyscale depth, white = near, linear in 1/distance between `near` and `far` |
| `kitchen.json` | camera field of view, near/far in metres, prompt, models, cost |
| `costs.jsonl` | one line per paid call |

Cost and time: about $0.19 and one to two minutes per plate ($0.15 for the still, about $0.035 for MoGe-3 depth).
`--res 4K` doubles the image cost. A re-run with the same prompt is free (cached); `--force` makes a new one.

Other modes:

- `--ref img.png` (repeatable): edit from reference images. Use the first plate of a scene as the reference for every
  other angle of it, so the set stays the same set (same microwave, same mug, same light).
- `--image still.png`: bring your own still (a photo, a frame, a render) and only make the depth map.
- `--redepth`: run the depth step again on the saved still. `--depth dav2` uses Depth Anything V2 instead of MoGe-3
  (cheaper, but relative depth and softer edges; it is also the automatic fallback if MoGe fails).
- `--dry`: print the full prompt and the cost, spend nothing.
- `--seed N`: keep the composition when you tweak the wording.

## Prompt recipe

Write the prompt as a shot description, in this order: subject, place, moment and light, camera. Then plate.mjs adds
three things so every plate matches the kit's renders and survives being turned into 2.5D:

1. House style: cinematic high-end 3D render, soft global illumination, shallow depth of field, clean stylised
   materials, no text, no logos, no watermark, vertical 9:16.
2. Layout for 2.5D: clear foreground, middle ground and background; the subject in the middle with breathing room;
   a calm top third (the hero number goes there); no mirrors, wires or plants in front.
3. The palette's mood, from `project.json` (`night-amber`: deep navy-blue night, faint cool rim light, one warm amber
   light source). Pass `--no-style` to send your prompt alone.

What makes a plate hold up when the camera moves:

- **One clear subject in the middle third**, at mid distance. Push-ins go towards it, labels pin to it.
- **Depth layers with gaps between them**: a mug in front, the microwave, the wall behind. Parallax needs layers.
- **Nothing important touching the frame edge** near the camera: lateral moves reveal past the edge.
- **No thin things in front** (cables, plant stems, chair legs, railings): thinner than about 1% of the width, they
  are cut away with the depth edge and painted over.
- **No glass, mirrors or water in front of the subject**: depth models put the surface or the reflection at the wrong
  distance, and it tears. Glass far away (a window in the back wall) is fine.
- **Soft background light, sharp subject**: baked-in background blur hides fills; the kit adds real lens blur on top.
- **Camera height and angle in words**: "seen from standing height just above the counter, a gentle three-quarter
  view". Eye-level or slightly high views give the most usable parallax.

Examples:

```
A kitchen counter at 1 AM. A closed microwave sits on the counter in the middle of the frame, its door window
glowing warm amber from the light inside, a bowl of instant noodles visible through the glass, the glow spilling
across the counter top. The rest of the kitchen is dark and quiet: deep navy-blue shadows, faint cool moonlight from
a window off to the left, a mug on the counter in front, dark cabinets above fading into the night. Seen from
standing height just above the counter, a gentle three-quarter view

A commuter train carriage late at night, nearly empty. One passenger in the middle of the frame, seated, lit by the
glow of their phone. Rows of seats recede behind them, the windows black with streaks of passing city light. Seen
from the aisle at seated eye level, slightly to the side

A city street at night after rain. A single delivery scooter parked under a street lamp in the middle of the frame,
the wet asphalt reflecting the light. Shop fronts recede down the street into haze, signs blurred and unreadable.
Seen from standing height on the pavement
```

Check the result before using it: open the PNG and the depth PNG side by side. The depth should be white where
things are near, with clean edges around the subject. If the still has text on it, a cut-off subject or a mirror in
front, regenerate (a new seed is cheaper than fixing it in the shot).

## Using it in a shot

```js
// shots/01-kitchen.js
export default async function (k) {
  const { camera, glow, cam, ramp, props } = k;
  k.backdrop();
  const set = await props.plate({ image: k.asset('assets/plates/kitchen.png'), width: 4, look: k.pal.post?.look });
  k.scene.add(set);

  // a label pinned to a spot in the picture: u, v are fractions of the PNG, v from the TOP
  k.ui.label('Magnetron', { anchor: set.pin(0.7, 0.47), offset: [-30, -230], at: 2.3, sub: 'makes the waves' });

  // a glowing line drawn into the scene, hugging the counter
  const line = glow.tube(set.curve([[0.33, 0.632], [0.52, 0.66], [0.71, 0.684]], { lift: 0.04 }), { radius: 0.01, color: k.pal.accent, intensity: 3 });
  k.scene.add(line);

  // camera: start at the still's own viewpoint, push a third of the way to the subject
  const v0 = set.view({ margin: 0.05 }), aim = set.pointAt(0.47, 0.52);
  const move = cam.path([
    { t: -0.3, pos: v0.pos, look: v0.look, fov: v0.fov },
    { t: k.dur + 0.3, pos: v0.pos.clone().lerp(aim, 0.34), look: aim, fov: v0.fov },
  ]);
  const focus = set.pin(0.43, 0.5);
  return (t) => {
    move.apply(camera, t, { t, drift: 0.35 });
    line.draw(ramp(t, 1, 2.4, 'inOutCubic'));
    k.lens = { blur: 0.014, focus };
  };
}
```

The full test shot also had a wave riding the counter, dust and a hero number: build those with the kit as usual.

### Finding u, v

Open the still and divide pixel coordinates by its size: the microwave window at pixel (660, 1376) in a 1536 x 2752
still is `(0.43, 0.50)`. `set.toUV(worldPoint)` goes the other way, to check that an overlay lines up.

### Options

`plate({ image, ... })`, all optional except `image`:

| option | default | what it does |
| --- | --- | --- |
| `width` | 4 | width of the picture plane in world units (the subject's depth lands there) |
| `depthScale` | 1 | relief. 1 = as estimated, 0.6 = flatter and safer for bigger moves, 0 = a flat card |
| `segments` | 512 | mesh columns. Edges are refined to the full-resolution depth, so more is rarely needed |
| `pivot` | median | `[u, v]` of the spot that sits on the picture plane |
| `look` | 0.35 | the palette's AgX look (`k.pal.post?.look`) so the still survives the film stage as generated |
| `highlights` | 8 | brightest light a white pixel becomes. Lower it if the still blooms too much |
| `brightness` | 1 | dims the whole plate (0.6 to let overlays carry the frame) |
| `reach` | 0.12 | biggest sideways move you plan, as a fraction of the camera distance: sets how far behind each edge the background is painted in |
| `skirt` | 0.25 | rim around the picture, stretched from its edge pixels, so near things can slide without opening a void |
| `edge` | 25 | how steep a depth jump must be to cut the mesh. Lower cuts more |
| `layers` | 2 | 1 = a single mesh with nothing cut (edges stretch like rubber; fine for very small moves) |
| `tonemap` | 'inverse' | 'none' sends the still in as plain light (it then looks flatter and dimmer than generated) |
| `fov`, `near`, `far` | from the .json | for depth maps made elsewhere (white = near) |

### Helpers on the returned group

| helper | returns |
| --- | --- |
| `set.view({ margin, aspect })` | `{ pos, look, fov }`: the still's own camera, narrowed by `margin` so moves have slack. Start here |
| `set.pointAt(u, v, lift)` | world position of that spot of the picture, on the surface. `lift` moves it towards the camera along its ray, so it floats just in front without moving in the picture |
| `set.pin(u, v, lift)` | an empty Object3D on the surface, parented to the plate: the anchor for `k.ui.label` and `k.lens.focus` |
| `set.curve([[u, v], ...], { lift, samples })` | a world-space curve through those spots, hugging the surface: for `glow.tube` and `glow.pulse` |
| `set.normalAt(u, v, radius)` | the surface direction there (world), averaged over `radius` of the width: to stand things up on a counter or a floor |
| `set.depthAt(u, v)` | distance from the still's camera along its view axis |
| `set.localAt(u, v, lift)` | like pointAt, in the plate's own space, for overlays you add to the plate group |
| `set.toUV(worldPoint)` | `[u, v]`: where a 3D point lands in the still |
| `set.setBrightness(v)` | dims or lifts the whole plate; call it from `update(t)` to fade the set under an explanation |
| `set.fov`, `set.distance`, `set.width`, `set.height`, `set.eye` | the still's camera: vertical field of view, distance to the picture plane, plane size, position |

## Camera moves: how far before it breaks

Measured on the kitchen plate (subject about 1 m away, a mug 0.6 m away), with the defaults. Distances are fractions
of `set.distance`, the still camera's distance to the picture plane. "Clean" means no visible fault on a paused frame;
"phone-clean" means faults only visible on a paused, zoomed frame.

| move | clean | phone-clean | breaks |
| --- | --- | --- | --- |
| push in towards the subject | 45% of the way | | past ~45% the 2K still goes soft (use `--res 4K`) |
| truck or pedestal (sideways, up) | 10% | 20% | 30%: you see under the counter edge, fills run long (clean with `depthScale: 0.6`) |
| orbit around the subject | 6 degrees | 12 degrees | 20 degrees (fine with `depthScale: 0.6`) |
| pan, tilt, roll, zoom (no position change) | free | | until the frame leaves the picture plus skirt |

What decides it is how far the camera's position moves compared with the distance to the nearest thing in frame, not
to the subject: what a move uncovers behind an edge grows with 1/near - 1/far, so a mug at 0.45 m in front of a
wall at 1 m uncovers about twice as much as the same mug at 0.6 m. Rules of thumb:

- Push-ins are the plate's best move: everything expands outwards, so almost nothing is uncovered.
- Make sideways moves slow and small, ending on the subject; combine a 30% push with at most a 4% drift.
- Always start from `set.view()` with a small margin (0.04 to 0.06) and never pull back past it.
- For a bigger move, flatten the relief: with `depthScale: 0.6` a 20-degree orbit and a 30% truck were clean in the
  tests, at the cost of less depth.
- Raise `reach` to the biggest sideways move you plan, so fills behind edges are wide enough.
- For a big move across a scene, use two plates of the same set (`--ref`) and cut or zoom-transition between them.

## Overlays in a plate

- Put overlays on the surface with `pointAt`, `pin` and `curve`. They are depth-tested against the plate, so a line
  that passes behind the mug is hidden by it, and parallax keeps them locked to the picture as the camera moves.
- Keep thin glowing lines near the focus distance. A thin, very bright line far out of focus breaks into separate
  copies of the lens aperture (the camera body averages 16 lens positions); in focus it stays a clean line.
- Lift lines a little (0.02 to 0.05 world units, or along `normalAt` for things that should stand on a surface), or
  they sink into the bumps of the depth map.
- Labels pinned with `set.pin()` follow the set exactly; keep their text inside the safe area (`--audit`).
- `fx.dust` between the camera and the subject sells the air in the room; out of focus it turns into bokeh.

## What the plate does for you

- Cuts the mesh at depth jumps and slides each cut edge to the true silhouette in the full-resolution depth map, so
  edges follow the mug, not the grid.
- Builds a background layer behind each near object: the near side of every jump is flooded (as far as a `reach`
  move would uncover there) and filled from the nearest pixels on the far side, so what a moving camera uncovers
  continues the counter or the wall behind it.
- Stretches a skirt of edge pixels around the picture so near things can slide sideways.
- Runs the still through the inverse of the film stage's AgX tone curve (a 33-cube LUT), so after the film stage it
  looks the way it was generated, and its brightest pixels become HDR light that blooms like the kit's own glows.
  Very saturated, very bright colours come out slightly paler, as everything does through AgX.
- Builds in 0.3 to 0.7 s and renders at about 0.13 s per final frame (16 samples, 1080 x 1920) on an M-series GPU.

## Troubleshooting

| you see | fix |
| --- | --- |
| a smear or ghost beside a near object | the move is too big for that object: shrink it, or raise `reach`, or lower `depthScale` |
| a dark wedge at a frame edge | the frame left the picture: smaller sideways move, bigger `view()` margin, or a bigger `skirt` |
| the plate looks dull or flat | pass the palette's look: `look: k.pal.post?.look` |
| the still blooms too much | `highlights: 3` or `brightness: 0.8` |
| a thin object disappeared | it was thinner than the cut: regenerate without it, or `layers: 1` for tiny moves |
| tearing on glass, a mirror or water | regenerate without it, or keep it far from the camera |
| everything feels flat even when moving | the depth is relative (`--depth dav2`): rerun with MoGe, or raise `depthScale` |
| a staircase along an edge | the depth map's edge is soft there; `--redepth` with MoGe, or more `segments` |
