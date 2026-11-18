# hook-dive: a 3.4 s diving hook

A finished beauty shot on frame 0, an event on the hero by 1 s, then a 3-stage dive joined by zoom transitions.
Copy the folder, keep the timing and the camera functions, and swap the three worlds for your topic.

## The recipe (this example's numbers)

1. Frame 0 is finished: hero 42% of the width, centre (524, 985), hottest pixels 250, backlit by
   `k.backdrop({ horizon: { strength: 0.55, y: 0.5, width: 0.075 } })` (`y` = its screen height) and lit from inside.
2. Title (`style: 'cond'`, 2 lines, about 140 px) and first caption are up from frame 0; no `fadeIn`.
3. The camera moves on frame 0, linear start: 6.5%/s push + 0.75°/s orbit (background 25 to 38 px/s).
4. Event on the hero on its word by 1.0 s: a glint (moving light + flare sprite with a 1.9 x 0.034 streak) on "sand", 0.87 s.
5. Dive: from 0.86 s the push accelerates (`d0 * exp(-0.065 t - 1.9 (t - 0.86)^2.4)`, 130%/s by the cut) at the hero's centre, held at screen centre.
6. Stage 2 at 1.26 s on the verb: `{ "type": "zoom", "dur": 0.5 }` into a frame-filling `mat.molten` surface, camera still diving (37 to 70%/s).
7. Stage 3 at 2.04 s: the first explained object, `{ "type": "zoom", "dur": 0.5, "out": true }` (the scale steps back out; plain `zoom` if it keeps going in); 0.78 s per stage.
8. Title `until: 1.15`, `outDur: 0.25`: it leaves as the dive starts, gone before the melt fills the frame.
9. The caption band stays dark in every stage, even the bright one (the crucible's lip sits under the melt).
10. Result: `check.mjs` hook 5.4 on the final (6.3 draft, bar 4), first event 0.77 s, no lull, no static or dark line, audit clean.

## Files

| File | What it does |
|---|---|
| `project.json` | 1080x1920, 30 fps, night-amber, 16 samples, no audio; the title; the three shots and their zoom transitions; captions with one highlight ("melted", the heat it names, in the accent). |
| `words.json` | Our own line in Scribe format, 0.25 to 3.34 s: "This grain of sand, melted down, grows one perfect crystal." Shot starts sit on word onsets. |
| `shots/hero.js` | Stage 1: the frosted quartz grain (shape, refracted ember heart, inner point light), the black-sand bed, the horizon band and low warm backlight, the glint, the camera and its accelerating dive. |
| `shots/surface.js` | Stage 2: the molten surface over the crucible's dark lip; the camera slides down the line through the lip, so the lip holds its screen height while the melt rushes up. |
| `shots/first.js` | Stage 3: `props.boule` rising out of the melt and turning; a heat glow by world height on the crystal and the crucible's lip; the meniscus ring; `k.look.productLight`; the chamber lit from below; the gleam on "perfect" and the label on "crystal" (the crystal sits left of centre so the label fits). |

Lessons that each cost a render: a smooth, clear transmissive hero reads as a glass bead or a water drop; frost
(`roughness` about 0.3), soft flats and an off-centre ember behind it read as quartz. A light straight behind a glossy
hero draws a 1 px HDR rim that the bokeh fill smears into a dotted halo: soften the clearcoat or move the light. Big
dark surfaces (a floor, a lip) glare at grazing angles under a low backlight: Lambert, or no rim light, for those.
Render `--stills 0` at full scale first and judge it at phone size: if the viewer does not swipe, frame 0 was the hook.
