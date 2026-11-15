# kit/models: where each model came from

The people props (`engine/props/people.js`) load these files. The audio props (`engine/props/audio.js`) are
procedural and use no model file. Every generated model was made with `kit/model.mjs`, which writes the
reference image, the raw result's cost and the cleaning settings to a `<name>.json` file next to the GLB.

| File | Triangles | Size | Made with | Cost |
|---|---|---|---|---|
| `head.glb` | 99,998 | 0.40 MB | fal `fal-ai/nano-banana-pro` reference image, then `fal-ai/hunyuan-3d/v3.1/pro/image-to-3d` (`generate_type: "Geometry"`) | $0.525 |
| `hand-sculpt.glb` | 41,785 | 0.18 MB | the same two endpoints | $0.525 |
| `hand.glb` | 39,011 | 0.21 MB | `bake-hand.mjs` from `hand-sculpt.glb` (no fal) | $0 |

## head.glb

Prompt (the house reference style is added by `model.mjs`, view `front`, `--geometry`):

> A smooth, sculpted mannequin head of an adult human, neutral expression, realistic proportions, bald, closed
> relaxed lips, eyes open with smooth sculpted eyeballs (no pupils), head and full neck down to the collarbones,
> like a premium matte clay bust

Cleaning: `--geometry --open-base --largest --tris 100000`. Hunyuan returned a hollow cast: an outer skin with a
second wall 1.5 to 8 mm inside it, joined to the skin through the nostrils, ear canals and mouth, and open at the
base. `--open-base` plugs the base, flood-fills the air from outside and keeps only the triangles that face that
air (235,171 of 500,004 removed). It then closes the 281 holes this leaves with fans, and `--largest` drops the stray
pieces left in the ear canals. The result is one watertight surface, so cutaways (`ear()`, `model({ cut, crop })`)
and surface sampling see a solid. `head()` then crops the uneven base flat at 9% of the height and caps it.

`ear()` has no file of its own: it crops a block around the left ear out of `head.glb` and caps every face. The
canal, eardrum and section channel are procedural.

## hand-sculpt.glb (the raw sculpt; `hand()` loads the baked `hand.glb` below)

Prompt (view `front`, `--geometry --tris 50000`):

> A realistic adult human right hand holding a modern smartphone upright in portrait orientation, the phone's flat
> screen facing the viewer, the thumb resting on the left edge of the phone, the fingertips curled around the right
> edge, the forearm ending in a clean flat cut just above the wrist, like a sculpted hand model

After cleaning, a one-off gltf-transform script removed the sculpted phone. It deleted 8,215 triangles that lie on
the phone's surface: all three corners within 0.011 file units of a phone-shaped rounded box, with the face turned
the way the box surface turns there. The box was measured from the phone's flat faces: centre (-0.002, 0.7335,
0.0467), half size (0.175, 0.3532, 0.0353), plan corner radius 0.058, edge radius 0.015, all in file units.
`hand()` puts the kit's own `phone()` in that box, so the screen can show a live `k.screen()`.

## hand.glb (baked)

`bun kit/models/bake-hand.mjs` turns `hand-sculpt.glb` into `hand.glb` (after test judges called the sculpt a
mannequin: waxy, uniformly long sausage fingers, dark claw-like nails). Every step is in the script; in short:

- drops the 103 loose slivers and the strips lying on (or needle-thin against) the removed phone's faces (2,653
  triangles; one strip ran up from the thumb's tip and showed as a thin loop once the thumb moved);
- follows each finger along its own curl (rings of equal geodesic distance from its tip, with parallel-transport
  frames), thins and tapers it (thumb 0.97, index 1.0, middle 0.92, ring 0.86, pinky 0.77 of the sculpt's thickness,
  0.9 more at the distal phalanx) and slides the index, ring and pinky tips back along the curl (0.03, 0.025, 0.06
  file units) so the fingers no longer end level;
- finds the sculpt's nail plates (a flood fill from the groove's centroid, stopped by the groove's concavity and by
  the plate's size), smooths the groove round them (Taubin, no shrink) and writes the masks the skin shader reads
  (`_MASKS`: nail plate, free edge, flush at the fingertips, crease);
- solves the thumb's press (`_THUMB` weights per vertex and the joints in the mesh's extras): the thumb turns 98
  degrees about an axis by the phone's left edge (the thenar takes the turn) and flexes at the IP joint, so its pad
  lands on the glass 5% of the screen's width in from the edge without entering the phone at any point of the motion;
- adds two zero-area triangles at the sculpt's box corners, so `hand({ height })` keeps the size and centring it had
  (the sculpt's box reached the removed phone's top edge).

The positions are in the sculpt's file units, so `people.js`'s phone box (above) still applies.

## Procedural props, and the generated versions that were not used

`speakerDriver()`, `headphones()` and `microphone()` are built from revolved and swept profiles in `audio.js`.
Generated versions were made with the same pipeline for comparison and were not shipped:

- Headphones (`--tris 80000`, textured, $0.525). The silhouette was convincing at a distance, but the
  sliders, seams and hinges melted together. The material was one baked texture, and the model had no microphones,
  no driver to cut open and nothing that could move.
- Microphone (`--tris 60000`, textured, $0.525). The head was a smooth capsule with the grille only painted on, and
  the XLR end came out as a separate floating ring.
- A loudspeaker driver was not generated: its cone has to move (`push(x)`) and its cutaway must show real parts in
  section.

## Endpoint comparison (same reference image, geometry only, Nov 2026 list prices)

| Endpoint | Cost | Time | Raw triangles | Result |
|---|---|---|---|---|
| `fal-ai/hunyuan-3d/v3.1/pro/image-to-3d` | $0.375 | 100-145 s | 500,000 | Crispest features, faithful to the reference, faces +z. Hollow shell for this bust (fixed by `--open-base`). Chosen. |
| `fal-ai/trellis-2` (1024) | $0.30 | 208 s | 227,000 | Good proportions with softer features. A thin double wall, faces +z. |
| `tripo3d/h3.1/image-to-3d` (no texture) | $0.20 | 171 s | 1,447,000 | Solid single surface, but noisier skin and it faced +x (needs `--rotate 0,-90,0`). |

Other image-to-3D endpoints on fal, at list price: `fal-ai/hunyuan-3d/v3.1/rapid/image-to-3d` ($0.225),
`fal-ai/hyper3d/rodin/v2.5` ($0.40, with a `texture_delight` option that removes baked lighting),
`meshy/v7.1/image-to-3d` ($1.20 textured), and `fal-ai/sam-3/3d-objects` (for objects in real photos).

## License

These files are output of models served by fal.ai, generated under fal's Terms of Service. Those terms grant use
"for your own personal or internal business use". They do not explicitly assign ownership of output, they say
output "may not be unique across users", they put use at the customer's own risk, and they let third-party model
providers attach their own terms (here Tencent for Hunyuan 3D and Google for the reference images). Check those
terms before you redistribute the files outside your own videos. The procedural props carry no third-party terms.
