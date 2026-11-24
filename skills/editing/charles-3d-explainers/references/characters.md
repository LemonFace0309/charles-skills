# Characters: short beats of a person doing something

Contents: 1. Character beat or object shot? · 2. The route, and how it was chosen · 3. Making a beat with clip.mjs · 4. Prompt templates · 5. One person across beats · 6. Holding and cutting · 7. Grading to the palette · 8. Clips inside a shot · 9. What fails · 10. Cost and time per beat

A character beat is 1 to 1.5 s of a person acting out the line: someone in bed at night scrolling a phone, a thumb
swiping a card, a passenger wincing at engine noise, a crowd all looking down at their phones. The kit makes them as
AI video clips started from a first frame in the kit's look, graded to the palette, then cut into the edit or played
inside a 3D shot. This file covers when to use one, how to make one that matches the renders, how to cut it, and what
breaks.

The method: one character sheet per video (Nano Banana Pro), one first frame per beat made from that sheet, the
frame animated by Kling 4 image-to-video, and the clip graded by `kit/clip.mjs`. About $0.62 and 6 minutes per beat (fal prices, Nov 2026).

## 1. Character beat or object shot?

A character beat shows a body part at macro scale, graded to the world: an eye blinking, a thumb pressing, a fingertip
under a chip, a hand reaching for a phone in the dark. Never a full cartoon figure or a clay mannequin: next to
hard-surface 3D renders both read as a style break (in testing: a cartoon kid and a cartoon hand, called out by every
judge). The tool's default look is photoreal macro (`--look photoreal`); `--look stylised` is the old soft-clay
animated-film look, for a deliberately stylised reel only.

Use a character beat when the line is about a human moment, and the viewer has to feel it before they can understand
it:

- A habit or a feeling: "you scroll for an hour before bed", "the noise gets to you": the eyes lit by the screen, a
  thumb mid-scroll.
- The viewer's own body or behaviour: "your thumb", "your eyes", "you flinch".
- A reaction that proves a point: a wince at 85 dB, a squint at a bright screen.

Never a character beat:

- A device action (send, tap, swipe, type): build the device screen with the real UI and a thumb (`props.hand` with
  `k.screen`; `hand.press(p)` brings the thumb's pad down on the glass and `hand.thumbUV()` says where, so the button
  goes there: kit.md snippet 40). The UI is the information; a generated hand on a generated phone has none.
- The thing itself: what is inside the phone, how the signal travels, how loud 85 dB is. That is an object shot (a kit
  render). The usual pattern is one character beat, then a hard cut on the next word to the object shot that explains
  it.

At most one character beat per 15 s. They are expensive, and the explanation lives in the 3D shots.

## 2. The route, and how it was chosen

Two routes were built and tested on the same three beats (bed at night, thumb swipe, plane passenger). Every result
was judged on stills and strips at phone size against `look.md`.

**Route b, AI video from a kit-look first frame (the route clip.mjs uses).** The first frames were made with Nano
Banana Pro from one character sheet, then animated by five video models for 4 s each:

| Model (fal endpoint) | Bed, scrolling | Thumb swipe | Plane, wince | Same person | Failures seen | Time | Cost, 4 s (Nov 2026) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Kling 4 (`kling/v4/image-to-video`, 720p) | thumb flicks, a blink, a gentle push | swipes at 0.4 to 0.75 s, the card leaves, the next one slides in | jolt at 0.5 s, wince, hand to the ear cup by 1.5 to 2 s | best: face, hair and hoodie hold for the whole clip | a hair flip on the jolt; the thumb ends pointing up | 3.5 to 5.3 min | $0.63 |
| Kling 4 Flash (`kling/v4/flash/image-to-video`) | (kit-render frame) blinks, eyes move, the screen glow flickers | not run | milder wince, the hand rises at about 1.7 s | as good as Kling 4 | none seen | 76 to 85 s | $0.38 |
| Gemini Omni Flash 1.2 (`google/gemini-omni-flash/v1.2/image-to-video`) | scrolls, but pushes in about 60 % and brightens | swipes at about 1 s, the thumb follows; invents a cartoon face on the next card | the most expressive wince, but cuts closer at about 1 s; the face drifts towards realism | good, then drifts | adds its own camera moves and cut-like jumps | about 1 min | $0.33 |
| MiniMax H3 Max (`minimax/h3-max/image-to-video`, 768P) | thumb flicks, a blink; brightens | the card flies off the phone into the air; invents a cartoon man on the next card | sets the engine on fire in the window, jumps the camera, then yawns | fair | invents story details | about 31 s | $0.22 (Nov promo), $0.32 list |
| Seedance 2.0 Fast (`bytedance/seedance-2.0/fast/image-to-video`) | refused: the frame shows a face | swipes late (2.5 s); the next card is a realistic photo | refused | n/a | refuses any frame with a face, even a stylised 3D one | 4.5 min | $0.97 |

**Route a, a posed 3D character inside the kit.** The same character, full body in an A-pose, became a mesh (Tripo
H3.1, $0.30), was auto-rigged (Meshy rigging, $0.20), loaded in a shot and posed with two-bone IK, lit by `k.rig`,
moved by `cam.path` and focused by `k.lens`:

- Bed: it reads as a person looking at a phone with a warm face, but nothing acts. The screen faces away, so the
  scroll is invisible; the skin looks waxy and the hands blocky at this distance; the hair texture shows seams.
- Thumb: the auto-rig gave no usable finger bones, so the thumb cannot move. The best route-a version is the kit's
  sculpted `props.hand()` with a live `k.screen` card swipe: a clean object shot in which nobody acts. (The kit hand's
  own thumb now presses the screen: `hand.press(p)`.)
- Plane: a body-only wince (hand to the ear cup, head turned away). There is no face rig, so there is no expression,
  and the cabin has to be modelled.
- Cost and time: about $0.65 and 4 minutes of fal time once per character, then 1.5 to 2 hours of posing and lighting
  for each new pose. Identity and palette are perfect, because it is one mesh under the kit's own lights.

**Hybrid.** A route-a kit render used as the first frame of Kling 4 Flash kept the render's exact look and identity
and added blinks, eye movement and a flickering screen glow ($0.38, 85 s). The motion is subtle, but it is the way to
animate a person who must look exactly like a kit render.

**Verdict.** Route b wins all three beats on motion, acting and time: Kling 4 from a Nano Banana Pro first frame,
made from one character sheet. Route a is worth it only when the person must live inside a kit scene (the camera
flies from a 3D object to the person, labels pin to their hand), at small size or in silhouette, or as a field of
static figures for a count. Even then, animate the kit render with route b (the hybrid) rather than posing by hand.

## 3. Making a beat with clip.mjs

```
# once per video: the character sheet (a still only, $0.15)
bun K/clip.mjs <project> --name hero --still-only \
  --frame "Character reference portrait for a stylised 3D animated short film: a young man in his mid twenties with short black hair and a soft swept fringe, warm light-brown skin, a friendly round face, dark eyes, wearing an oversized slate-blue hoodie. Waist-up, three-quarter view, calm neutral expression, looking slightly off camera; the warm light is a soft amber glow from below-front."

# each beat: first frame from the sheet, then the motion ($0.15 + $0.47 for 3 s)
bun K/clip.mjs <project> --name plane --ref <project>/assets/clips/hero-first.png --dur 3 \
  --frame "He is seated in a window seat of an airliner on a night flight, leaning back against the tall dark seat back and headrest, wearing large over-ear headphones in matte charcoal, eyes half closed. The cabin lights are off: near-black navy shadows, a cool blue night glow from the small oval window beside him tracing his profile, the dark wing faintly visible outside. One small warm amber reading light above him is the only warm light. Seen from the aisle at seated eye level, a gentle three-quarter view, framed from the chest up, his head in the middle of the frame." \
  --prompt "The plane shudders slightly with a rumble; he winces, squeezing his eyes shut and pressing one hand against the headphone cup. The camera holds steady with a very slow push in."
```

Each run writes `assets/clips/<name>.mp4` (graded, project size and frame rate, no audio), `<name>.strip.jpg` (a frame
every 0.25 s with times and frame numbers: pick the window to cut from it), `<name>-first.png`, `<name>.json` (prompts,
model, cost, timings, tone before and after) and `raw/<name>.mp4` (the model's file, with its soundtrack). Look at
the first frame before paying for the video: `--still-only` stops after it, `--dry` prints both prompts and the cost.

Other modes:

- `--first-frame still.png`: animate any still: a kit render (`render.mjs --stills`), a plate, a frame of a previous
  clip. It is cropped to the project's aspect.
- `--last-frame end.png` (Kling 4, Gemini, H3 Max, Seedance): the clip ends on that frame. Use the first frame of the
  next shot so the cut lands on an identical picture (the action stays plausible only if the two frames are close).
  The request is built and checked; no end-frame clip has been judged yet, so look at the strip before using one.
- `--take 2`: a new take of the same request; take 1 stays cached. `--force` runs everything again.
- `--video take.mp4`: grade, conform and strip a clip made elsewhere.
- `--frames [width]`: extract JPEG frames for use inside a shot (section 8).
- `--keep-audio`: keep the model's soundtrack (the Kling 4, Gemini and H3 Max files all carry one; listen before
  using it as an SFX bed).
- `--endpoint`: any model in the table above, or another fal image-to-video endpoint (common field names are tried).

## 4. Prompt templates

The tool appends the house look to every first frame (`--no-style` turns it off), so the frame prompt describes only
the shot. The default is photoreal macro (`--look photoreal`): "Photoreal macro cinematography for a
premium 3D product film: real skin with fine texture and a soft subsurface glow, true-to-life proportions, a 100 mm
macro lens at f/2.8", then the same lighting, depth of field and no-text lines as below. The model table and the
measurements in this file were made with the stylised look (`--look stylised`), quoted here:

> Rendered like a premium stylised 3D animated film: smooth matte skin like soft clay with a gentle subsurface glow,
> simplified sculpted features, hair as clean sculpted shapes, fabric with subtle knit texture, no pores, no fine
> wrinkles. Lit like a high-end product shot at night: a dark world fading to near black, a soft dim cool key light
> from above, a strong cool rim light tracing every silhouette, and exactly one warm light source, the story object.
> Shallow depth of field with soft round bokeh, gentle film contrast, calm and cinematic. No text, no letters, no
> numbers, no logos, no watermark, no UI labels.

plus the palette's colour line (as in `plate.mjs`) and the layout line: the face or the hands in the middle third, calm
dark space in the top third, nothing important in the bottom fifth.

**Character sheet** (`--frame`, no `--ref`):

```
Character reference portrait for a stylised 3D animated short film: <age and build>, <hair: colour, length, shape>,
<skin tone>, <face: one or two simple features>, wearing <one garment in a muted cool colour>. Waist-up, three-quarter
view, calm neutral expression, looking slightly off camera; the warm light is a soft amber glow from below-front.
```

Give the person one or two memorable shapes (a swept fringe, an oversized hoodie) and keep clothes muted and cool:
the warm accent belongs to the story object (the phone, the reading light), never to the person.

**Beat first frame** (`--frame`, with `--ref` the sheet):

```
<Where and when>. <What he is doing, a moment before the action, in one pose>. <The one warm light: what emits it and
what it lights>. <The cool light: from where, what it rims>. <Camera: height, angle, framing; the face or the hands in
the middle of the frame>.
```

- Bed: "He lies on his back in bed at night, head sunk into a pale pillow, a dark duvet pulled up to his chest,
  holding a phone above his face with both hands, thumb on the screen, eyes on it. The phone's screen faces him and is
  the only warm light: its glow lights his face, his fingers and the pillow around his head. A cool blue moonlight rim
  from a window behind the bed outlines his hair and the folds of the duvet. Seen from above and slightly to the side,
  framed from the chest up, his face in the middle of the frame."
- Thumb: "Macro close-up of his right hand holding a phone upright, the thumb resting on the left half of the screen.
  The screen shows one big rounded photo card, an abstract soft warm gradient, two round buttons below it, no text.
  The screen is in night mode: a soft, dim warm amber glow, never white or blown out, and it is the only warm light;
  the hand has a cool blue rim light from behind; the background melts into dark navy bokeh."
- Crowd: "A crowded subway platform late at night: dozens of people stand waiting, every one of them looking down at
  a phone, their faces lit warm from below by the screens. In the middle of the frame, a little closer to the camera
  than the rest, the young man in the slate-blue hoodie also looks down at his phone. The crowd fades into dark blue
  haze behind him."

**Motion** (`--prompt`). The tool appends "Keep the character, the stylised 3D render look and the lighting exactly as
in the image; no cuts, no text."

```
<One action: the body part that moves, a verb and a speed ("in one quick stroke", "small slow flicks")>. <What stays
still ("the hand holding the phone stays steady")>. <Camera: "holds steady" or "pushes in very slowly">.
```

Rules that came out of the tests:

- One action per clip, and say it happens quickly. Long or compound actions (wince, then relax, then smile) spread
  over the clip and drift.
- Never describe sounds or danger as events: "engine noise" became an engine on fire. Say "a rumble" or "a slight
  shudder" and describe only what the person does.
- Screens and cards: describe abstract content and add "no text appears on the screen". The next card in a swipe
  still gets invented content (a face, a silhouette): crop or cut before it lands if it matters.
- Ask for a still or very slow camera; the kit adds the edit's movement. Gemini and H3 Max add moves anyway.
- Make the first frame dark already (night mode screens, lights off). A bright first frame stays bright; the grade
  can only pull it so far without looking muddy.

## 5. One person across beats

- Invent the person. Never prompt for a real person's likeness or reuse a real photo of someone as the sheet; the
  character stands for "you", the viewer.
- Make the sheet once, look at it at phone size, and pass it as `--ref` to every beat's first frame. Nano Banana Pro
  kept the face, hair, skin and hoodie across all four test frames (bed, plane, crowd, A-pose) from one sheet.
- Mention the same garment in every frame prompt ("the young man in the slate-blue hoodie"). It anchors the edit
  model and the viewer.
- Kling 4 holds the identity through the clip; Gemini and H3 Max drift towards a more realistic face after about 1 s,
  so cut from their first second.
- For a crowd, the sheet's character goes in the middle, a step closer, and the only one in focus. The others become
  look-alikes of him; keep them dark and out of focus so it reads as a crowd, not clones.
- Close-ups of hands share the skin tone and sleeve with the sheet ("a slate-blue hoodie sleeve at the wrist").
- A beat that must match a 3D shot exactly (the phone prop the reel already showed): render the kit's still and
  animate it (`--first-frame`), or end on it (`--last-frame`).

## 6. Holding and cutting

- Hold a beat 1.0 to 1.5 s: long enough to read the action, short enough that the model's drift never shows. Cut a
  longer clip into two beats with a 3D shot between them rather than holding it.
- Choose the window on the strip: start 2 to 4 frames before the action begins (the first frame of the generated
  clip is a still image, and the motion takes 0.3 to 0.6 s to start), end mid-gesture or just after it lands. The
  tested actions landed 0.4 to 2 s in.
- Cut in on a word onset, like any cut (SKILL.md transitions), while something is moving in both shots. A hard cut
  suits a story beat; a whip (0.35 to 0.45 s) suits a new angle on the same idea.
- Match the eye: put the clip's face (or the thumb) where the outgoing shot's subject was. In a 1080 x 1920 frame keep
  both within about 100 px of each other, in the subject band (y 650 to 1270). Read positions off the strip, then
  frame the 3D shot to match with `cam.frame` and `lookOffset`, or regenerate the first frame with the layout in words.
- Cut out on motion: on the hand arriving, the card leaving, the blink. Never on the clip's last frames (they slow to
  a stop and drift most).
- Talking-head cutaway (no engine involved): conform with clip.mjs at the edit's size and frame rate, then overlay
  the window you picked at the edit time, keeping the talking-head's audio:

  ```
  ffmpeg -i talk.mp4 -i assets/clips/plane.mp4 -filter_complex \
    "[1:v]trim=1.30:2.50,setpts=PTS-STARTPTS+12.40/TB[c];[0:v][c]overlay=enable='between(t,12.40,13.60)':eof_action=pass[v]" \
    -map "[v]" -map 0:a -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p -c:a copy out.mp4
  ```

  (1.2 s of the clip from 1.30 s, shown from 12.40 to 13.60 s of the edit; tested frame-exact at 30 fps.)

## 7. Grading to the palette

`clip.mjs` grades every clip unless `--grade none`:

- Measures the median tone of the clip (look.md section 10: YAVG, YLOW, YHIGH, SATAVG on frames every 0.5 s).
- If YAVG is outside the palette's range (night worlds 30 to 50, `studio-cool` 60 to 90), a gamma moves it to the
  middle (40 at night), checked once and corrected.
- Caps saturation (SATAVG 18 at night), pulls lifted blacks down (YLOW above 12), tints the shadows towards the
  palette's darks (navy for `night-amber`), adds a vignette only when the corners are bright, and adds the kit's film
  grain so the clip is not smoother than the renders.
- Conforms to the project size (cover crop, lanczos) and frame rate (the models make 24 fps; frames are repeated to
  30, which is invisible at this length).

Measured: the plane clip went from YAVG 41 SATAVG 12 to 39 and 15, the crowd from 42 to 34, the thumb from 48 to 45
(all inside the night range, next to kit renders at 35 to 45). It does not fix a frame that is lit wrong: a bright
first frame (a white screen, a lit cabin) graded down looks muddy. Fix the first frame (section 4).

Models brighten their clips over time (the Kling bed clip went from YAVG 39 to 49 over 4 s); the grade is one setting
for the clip, so cut from the first 2 s.

## 8. Clips inside a shot

A clip can play on a 3D screen (a phone that shows the passenger; push in, then zoom-cut to the clip full frame) or
sit as a full-frame plate under the kit's type (a hero number over the wince). Shots must stay pure functions of time,
so the clip is extracted to frames (`clip.mjs --frames`) and each output frame shows frame `floor((t - at) * fps)`,
loaded before the frame's sub-renders. With the seq.js change (`k.clip`) and `kit/clips/clip.js`:

```js
const { clipPlane } = await import(k.kit('clips/clip.js'));
const c = await k.clip('assets/clips/plane', { at: 0 });      // { texture, index(t), duration, aspect, ... }
phone.setScreen(c.texture);                                    // on a device
// or, full frame under captions and labels (the clip has its own depth of field):
clipPlane(k, c);
return (t) => { k.lens = { blur: 0 }; };
```

For one moment to continue across two shots (the phone, then the same clip full frame), give both the same project
time: `at: T0 - k.start`. Without seq.js's `k.clip`, `clip(k, rel, o)` from the same module does the same through a
2 x 2 `k.screen`. Extract frames at 540 px wide for a device screen (`--frames 540`) and at full width for a plate
(`--frames`). Tested: the plane clip on a 3D phone, a zoom transition, then the same moment as a plate under a hero
number, at 16 samples (and a 150-frame render at 0.07 s a frame, half size, 4 samples). A frame rendered alone and
the same frame rendered after two others came out bit-identical, so the clip is time-pure.

## 9. What fails

- **Faces refused.** Seedance 2.x rejects any first frame with a human face ("likeness" check), stylised or not. Use
  it for hands-only shots, or use Kling.
- **Invented story.** Models add what the prompt implies: fire for "engine noise", a person on the next dating card, a
  card that flies out of the phone into the air. Describe only the action; check the strip.
- **Camera moves and cuts you did not ask for** (Gemini, H3 Max): a push-in of half the frame or a jump closer in the
  middle of the clip. Cut around them or use Kling.
- **Drift.** After 1 to 2 s faces become more realistic, light gets brighter, hands change grip. Short windows.
- **Text.** Anything readable in a first frame comes out garbled in motion. No text in frames; put words in the kit's
  type layer over the clip.
- **Hands.** Kling kept hands clean at this stylisation; H3 Max morphed fingers on the grip. Close-ups of hands need
  the hand already in the first frame, in the pose the action starts from.
- **Route a.** An image-to-3D mesh must face +z before auto-rigging (a mesh facing +x was rigged with its arms
  front-to-back); the rigger refuses meshes over 380,000 triangles (generate with a face limit of about 150,000);
  finger rigging came out unusable; the stock animation libraries are game moves (runs, fights, dances), not everyday
  actions; there is no face to act with.

## 10. Cost and time per beat

fal's list prices as of Nov 2026; each endpoint's page on fal.ai has today's.

| Step | Cost | Time |
| --- | --- | --- |
| Character sheet (once per video) | $0.15 | 25 to 40 s |
| First frame per beat (Nano Banana Pro edit, 2K) | $0.15 | 25 to 40 s |
| Video, Kling 4 720p | $0.157/s: $0.47 for 3 s, $0.79 for 5 s | 3.5 to 5.5 min |
| Video, Kling 4 Flash (drafts, quick tests) | $0.094/s: $0.28 for 3 s | about 80 s |
| Grade, conform, strip, frames | free | 10 to 15 s |
| Typical beat: first frame + one 3 s Kling 4 take | $0.62 (the test crowd beat) | 6 min |
| The same with one retake of the video | $1.09 | 11 min |

Run the beats of a video in parallel (one clip.mjs per beat); fal queues them side by side. Prices are fal's list
prices in November 2026; `--dry` prints the estimate and `assets/clips/costs.jsonl` logs every paid call.
