# noise-cancel

- Voiceover: our own 37 s script, 98 words (2.7 a second); `words.json` from new.mjs with `--script`. The example ships
  silent: `audio` was taken out of `project.json` after review.
- Palette: night-amber. One warm accent for the headphones' own sound (the inverted wave, `#ffb43c`), the cool
  secondary for the cabin's hum (`#5fb4ff`), white for silence, pale white-blue for the voice (`lib/colors.js`).
- Running example: the viewer's headphones on a plane, on the tray table in front of the window seat. On screen at
  0-1.3, 4-4.8, 11-13, 31-32 and 34-37 s; inside them (cup, chip, ear) for most of the rest.
- Hook: frame 0 = the headphones on the tray, the sunset line in the window behind them; title "Silence made of
  [[sound]]"; noise cancelling switches on with its word; a three-stage dive (tray -> inside the cup -> the waves).
- HUD: none (no quantity the story keeps returning to).
- Chapters: cold open 0-7.5 (hook + 80 dB), the mechanism 7.5-24.7, the limits 24.7-37 (opens on a `light`).
- Places: the cabin (wide, the row, the window seat, the service panel), the cup's outside, the chip inside the cup,
  the cup and the ear in section.

## Beats

| start-end | words | the visual, on which word | shot type | camera | overlays | link |
|---|---|---|---|---|---|---|
| 0.00-1.26 | Noise-cancelling | headphones on the tray before the window; glint 0.1-0.55; mic rings, LED and amber rings on "-cancelling" | hero reveal | linear push 6%/s + orbit, dive from 0.9 s | title, caption | `hero.js` |
| 1.26-2.10 | headphones erase | inside the left cup, cut open over the ear; hum already in the canal; driver kicks on "erase" | scale journey | dive, ~150%/s | | zoom 0.5 `cup.js` |
| 2.10-3.88 | sound by adding more sound. | square-on section: amber wave leaves the driver on "adding", both fall flat behind it on "sound." | teaching (preview) | slow push | | zoom out 0.5 `hook.js` |
| 3.88-7.52 | On a plane, the cabin hums at about 80 decibels. | crane from the tray to the whole cabin; hum rings on "hums"; 80 dB on "80" | hero number | crane up and round | hero 80 dB | zoom out 0.6 `cabin.js` |
| 7.52-10.98 | That hum is a pressure wave, air squeezing and stretching. | over the row: the hum line; on "air" a grid of air parcels bunches and spreads with it; labels on "squeezing", "stretching" | teaching | truck with the wave | squeeze, stretch | whip 0.4 `air.js` |
| 10.98-13.28 | Microphones on your headphones catch it. | the left cup: mic ring lights on "Microphones", the wave flattens into the port on "catch" | hero reveal | push | Microphone | zoom 0.6 `mic.js` |
| 13.28-17.60 | A chip flips the wave upside down, so every squeeze becomes a stretch. | the chip; a copy turns over and goes amber on "flips"; crest and trough light on "squeeze", "stretch" | teaching | 32° orbit + push | flipped, squeeze, stretch | zoom 0.5 `chip.js` |
| 17.60-24.66 | The speaker plays this inverted wave into your ear. The two waves cancel out. That's destructive interference. | follow the amber front from the driver to the drum; the two waves named; collapse on "cancel"; a bead of silence on "out"; the term; pull back | follow + teaching | follow, hold square-on, pull back | Speaker, Eardrum, hum, inverted copy, Destructive interference | whip 0.4 `ear.js` |
| 24.66-26.22 | The hum keeps changing, | over the row again; the hum's pitch and loudness wander from "changing" | change | truck | | light 0.5 `changing.js` |
| 26.22-29.70 | so some headphones adjust 50,000 times a second. | the chip; the amber copy becomes a staircase rewritten by sweeps from "adjust"; 50,000 /s | hero number | 30° orbit + push | hero 50,000 /s | zoom 0.5 `adjust.js` |
| 29.70-32.28 | But the flight attendant's voice still gets through. | the service panel; the attendant pictogram lights on her word; her voice leaves the grille; the camera tilts with it to the headphones, where it goes through | follow | whip-tilt down | Flight attendant | zoom out 0.6 `voice.js` |
| 32.28-37.03 | Voices are higher. Their waves are shorter, so the tiniest delay ruins the match. | lanes over the window: hum (long) and voice (squeezes short on "higher"); one wave of each on "waves"; amber copies on "tiniest", late on "delay"; sums on "ruins": hum flat, voice not; home to frame 0 | two states + payoff | truck, then back to frame 0's pose | hum, voice | whip 0.4 (vertical) `ending.js` |

Caption highlights: "pressure wave" (hum blue), "inverted wave" and "delay" (amber), "destructive interference" (white),
"voice" (pale). No highlight on the hero numbers' words.

## Changes made in review (keep them)

- Cabin: point lights are candela (E = I / d^2): the first window light at 1.4 cd lit the cabin orange (YAVG 97).
  Window light is a spot from outside the hull aimed at the headphones.
- Night sky: a reversed `smoothstep` (edge0 > edge1, undefined in GLSL) washed the window beige; rewritten.
- Headphones turned (yaw -0.96) so the left cup faces the aisle: the tray hangs off the seat in front, and any camera
  in front of the cup was inside that seat back.
- Section shots: the cutaway opens only the cup, so a clipping plane removes the yoke and band in front of the
  section. Cut faces: ear warm brown, headphones cool grey.
- Air: `fx.dust` adds a fixed 0.06-unit wobble per mote (6 cm here); its clock stays at 0 and the static offset is
  subtracted, so the grid holds.
- Chip and ear holds needed arrivals (labels, a bead, a flare with new edges): check.mjs counts arrivals, not glows.
- Count-ups end within their word's planned window (`at: word - 0.15 to 0.18`, `dur 0.25`).
- Adjust: the sweep phase is the integral of 1 / T (a changing period with `t % T` jumped); a uniform-grid lookup,
  not `k.monotone` (linear search per call).
- Voice: shades drawn, reading light on, the label ends before the tilt; the tilt ends before the voice reaches the
  cup, so the line never crosses the caption band.
- Ending: lanes read high over the dark wall (camera level with them, so the sunset line is not behind them), then
  settle above the headphones as the camera returns to frame 0's pose; the sunset line fades up on the way home.

## Review loop

```
bun K/render.mjs . --stills 0,3,6.6,16.9,21.4,28.2,37      # 16-sample stills: add --samples 16 --scale 0.5
bun K/render.mjs . --draft --audit
bun K/sheet.mjs out/draft.mp4 --every 1 --words .
bun K/check.mjs out/draft.mp4 --project .
```
