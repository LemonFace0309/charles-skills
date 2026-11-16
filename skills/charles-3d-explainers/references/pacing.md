# Pacing: how often things change, and how it stays readable

Measured on the same twelve 9:16 reels as look.md: five 2.5-minute dark 3D explainers (the main target), five 30 to
46 s 3D story reels with very fast pacing, and two 72 s explainers built from UI on 3D screens and line doodles.

How it was measured: frame differencing at 30 fps with global motion estimation (camera pan, zoom and roll, plus how
much of the change the camera move cannot explain) to find cuts and motion-carried transitions; OCR on 5 to 10 frames
per second to time every caption chunk, title, number and label; word timings from the transcripts; face detection to
remove presenter shots; and 4 fps contact strips annotated by eye for what counts as a new event. Times are seconds.

An event is a visual change a viewer notices: a new object enters, an object transforms, a number or label lands, a
light event happens (pulse, ring, flash), the camera reveals something or changes direction, or the shot cuts.
Caption changes are counted separately.

## 1. The numbers

| | Long 3D explainers | Fast story reels | UI and doodle explainers |
| --- | --- | --- | --- |
| Length | about 150 | 30 to 46 | 72 |
| Voice | 3.5 to 4.1 words/s, first word at 0.1 to 0.5 | 2.6 to 3.1 words/s | 3.5 to 3.8 words/s |
| New caption chunk | every 0.8 to 1.4 (median 1.0) | every 0.7 to 0.9 | every 0.9 to 1.1 |
| New visual event | median gap 0.5 to 0.75, longest 2.0 | an action beat about every 1, a new camera angle every 2.2 | a new drawn element every 0.5 to 1 |
| Cut or transition | one per 4.1 on average; median spacing 2.1 to 4.2; longest unbroken stretch 14 to 25 | one per 3.4; median spacing 1.3 to 3.0; one reel is a single 29 s move | one per 6.3; holds of 26 to 45 on one drawing |
| Hard cuts among them | 30% | 2% | 65% |
| Frames with a still camera | 11 to 39% | 0 to 3% | 60 to 79% |
| Hook title on screen | 1.4 to 4.2 (median 2.4) | none | none |
| Hero number vs the spoken number | lands within 0.2, holds 0.8 to 2.6 | none | none |
| Presenter breaks | 6 to 13% of runtime, every 15 to 62 (median about 33), 2 to 7 long | none | intro and call to action only |

The kit is pure 3D, so presenter breaks become chapter resets (section 10).

Five premium studio 3D reels of 28 to 43 s, measured with check.mjs (the level this skill is held to):
1.79 to 2.07 events a second; median frame-to-frame motion 2.8 to 4.2; hook motion (0.9 to 2.1 s) 4.7 to 13.6 in the
four that dive (0.5 in the one with a static title hook); near-still seconds (motion under 1.0) 5 to 21% of the
runtime, with at most one 3 s run. Reels with a static hook read 0.5 to 2.9; one that parked its camera for 6 s lost on camera.

## 2. Shot length

Counting every cut and motion-carried transition (in-shot light events sometimes register as boundaries, so real
setups run slightly longer):

- Long explainers: median shot 2.1 to 2.7 s in four references and 4.2 s in the slowest; mean 3.2 to 6.6 s; 90th
  percentile 6 to 16 s; longest 14 to 25 s.
- Fast story reels: median 1.3 to 3.0 s, mean 1.9 to 3.9 s, 90th percentile 4 to 11 s.

The rule is not "cut every N seconds". A camera setup usually lasts 1.5 to 4 s, and a continuous move may run 10 to
30 s, but only while something new lands at least every 2 s inside it. The longest unbroken stretches in the
references are the camera riding along with the travelling thing (section 5, transition 8).

## 3. Something new about every second

Three 24 s windows of the long explainers, annotated frame by frame at 4 fps, all show the same rhythm:

| Window | Events | Median gap | 75% of gaps under | Longest gap |
| --- | --- | --- | --- | --- |
| data journey (photo becomes numbers, gets locked, is split into packets) | 24 | 0.75 | 1.5 | 2.0 |
| logic (one switch, then gates, then arithmetic) | 32 | 0.5 | 0.75 | 2.0 |
| measurement (satellite, signal, equation, result) | 27 | 0.75 | 1.25 | 2.0 |

A typical stretch from the first window, as gaps between events: the photo turns into a grid of pixel blocks; 0.7 s
later the blocks show numbers; 1.5 s later the numbers flip to binary; 0.5 s later the counter ticks; 1.0 s later the
camera rises; 1.25 s later a hero number lands; 1.0 s later it leaves; 0.25 s later a padlock drops in; 0.5 s later it
locks with a ring of light; 1.75 s later an intruder arm enters; 0.75 s later it grabs; 0.75 s later a magnifier shows
scrambled values. One subject at a time, each beat on its word.

Rules:

- Plan one event per 0.7 to 1.2 s of voice and tie each to a word (`k.word('locked')`).
- Never let 2.0 s pass without an event. If the voice dwells on one idea, the camera reveals something or the subject
  reacts (glows, turns, splits, gets a label).
- Events are staggered: two events are never closer than 0.2 to 0.25 s, and a cut never coincides with a hero number
  landing. The one exception is a scale number ("billions of them"), which lands during the pull-back that reveals it.
- About two of every three events happen in the world (something moves, transforms or lights up); about one in three
  is type (a number, a label, a section word).
- Every 3 to 5 s comes a bigger beat: a transition, a hero number or a reveal of scale.
- Captions run on their own clock (a new chunk every 0.8 to 1.4 s) and are not counted as events. Visual events land
  between caption changes as often as on them.

## 4. Camera moves

Which column: a reel of 60 s or less is judged against the fast story reels; the long-explainer column is for
explainers of 2 minutes or more.

Measured on frames away from transitions, with presenter shots removed. Speeds are at 1080 px width; zoom is the change
in image scale per second.

| | Long explainers | Fast story reels |
| --- | --- | --- |
| Still or near-still frames | 11 to 39% | 0 to 3% |
| Push-in | 11 to 19% | 20 to 28% |
| Pull-out | 9 to 17% | 8 to 21% |
| Truck, pan or orbit | 38 to 55% | 49 to 69% |
| Roll-led | 4 to 10% | 2 to 8% |
| Typical drift (median) | 14 to 62 px/s, zoom 1.7 to 12%/s | 43 to 294 px/s, zoom 5 to 23%/s |
| A real move (90th percentile) | 227 to 662 px/s, zoom 26 to 71%/s | 312 to 1056 px/s, zoom 61 to 79%/s |

The moves, and when each is used:

1. Slow push-in, 2 to 6% per second for 2 to 5 s. The default for "this matters": a single subject while it is named
   or explained. `cam.push`, or `cam.path` with two keys.
2. Pull-back reveal, 5 to 20% per second for 1 to 3 s, easing out. One thing becomes many, a part shows its whole, a
   number gets its context ("one switch... and there are billions of them").
3. Follow. The camera rides with the travelling thing (a pulse along a cable, a packet through a network), which holds
   the same screen position while the world streams past at 300 to 600 px/s. `examples/noise-cancel` rides the wave
   from the driver to the eardrum this way; `cam.follow(curve, ...)` rides along any curve.
4. Quarter orbit around a hero object over 3 to 5 s, often combined with a gentle push, to prove it is a real 3D
   object. `cam.orbit` over 60 to 90 degrees.
5. Rise to top-down: from ground level to a map view in 1 to 2 s, to switch from a detail to the layout (a street
   network, a chip floor plan).
6. Scale journey: a continuous zoom through 2 to 4 orders of magnitude in 1 to 3 s (planet to city to street; device to
   chip to transistor), with heavy motion blur in the middle. `cam.logZoom`, often split across two shots joined by a
   zoom transition.
7. Top-down drift over grids, 20 to 50 px/s, for the long holds on numbers or equations.
8. Whip or snap, 2 to 6 frames of motion blur to a new angle on the same subject (story reels).

Rules:

- The camera never locks off in the story reels, and in the long explainers it holds still only while a number,
  equation or diagram is being read. Keep at least the kit's drift (`apply(..., { drift: 0.4 to 0.6 })`) on every
  shot.
- While a hero number or equation is up, the camera drifts at 20 to 40 px/s in four of five long references. Two of
  them slow down for it (from 60 to 110 px/s); the other two already drift that slowly. In the fifth the camera keeps
  flying, because its numbers are scale numbers that ride on pull-back reveals.
- Cut on motion. In three of five long references the camera moves 1.5 to 9 times faster in the 0.4 s around a
  transition than elsewhere; the other two cut from slow drifts. The story reels hide every change inside a whip or a
  fast push.
- One move per setup. A push can carry a slight orbit; do not stack push, orbit and roll at full strength.
- Every move eases in and out (`ease: 'inOutSine'`, `flow: true` through several keys). Only whips and zoom-throughs
  are fast in the middle on purpose.

## 4b. Framing: sizes and heights

Measured in November 2026 on ten 3D story reels (character stories with their own 3D characters, 27 to 86 million
views each, 100 to 180 s long): 12 evenly spaced frames from each, 118 labelled after two transition frames were
dropped, and a cut-and-whip count on the eight whose cuts could be read.

| Size | Share | Height | Share |
| --- | --- | --- | --- |
| Insert or extreme close-up (a hand, an eye, a note, a phone screen) | 17% | Low, looking up | 38% |
| Close-up | 14% | Eye level | 33% |
| Medium close-up | 8% | High, looking down | 25% |
| Medium | 34% | Top-down | 3% |
| Wide | 27% | | |

- 7% of frames are also rolled (dutch), in three of the ten reels, and only in danger.
- 29% of frames look past something near the lens: a shoulder or the back of a head, bars, a bed edge, a protractor
  on a desk. It is defocused and sits at the frame's edge.
- Shot sizes run as a ladder: wide (the room), medium (the person), close, then an insert of the thing the line names
  (hands tapping, the F on the forehead, the email on the laptop, the calendar on "a week"), and back out. Inserts
  land on their word and come every two or three shots.
- The camera sits low inside rooms, at waist height or below with a wide lens, so the ceiling and its lights are in
  frame and near hands and props loom. The ones looking up are heroes, threats and people speaking; the ones looking
  down are someone lying, sitting or being judged, and the layout of a room.
- Notes, documents, screens and phones get a full-frame insert, straight down or seen from the holder's eyes, readable
  in under a second.
- About 6 in 10 transitions are whips of 3 to 6 frames, the rest hard cuts. Shots run 1.1 to 4.3 s (the middle half),
  median about 2.3 s, and the camera never rests inside them.
- What it means here: SKILL.md's Framing tree. An explainer keeps its square-on teaching frames, which the story reels
  have no use for, and varies size and height in every setup around them.

## 5. Transitions

Shares are of all detected boundaries (long explainers / fast story reels), from an automatic classification that was
spot-checked by eye, so treat them as approximate. Durations are medians of the visible transition itself; the camera
move around it lasts longer.

| # | Type | Share (long / fast) | Duration | When | Kit |
| --- | --- | --- | --- | --- | --- |
| 1 | Hard cut on a word | 30% / 2% | 1 frame | to and from the presenter; enumerated steps, one cut per verb ("mix it, / heat it, / cool it") | `in: 'cut'`, shot start on `k.word()` |
| 2 | Defocus or blend | 20% / 23% | 0.17 s (0.1 to 0.27) | between places at the same scale | `in: { type: 'fade', dur: 0.3 }` |
| 3 | Zoom-through | 26% / 53% | 0.23 to 0.27 s (0.17 to 0.5) | the story changes scale: into an object, out to the whole, down to the ground | `in: { type: 'zoom', dur: 0.5 to 0.7 }` plus a push or `logZoom` in both shots; `out: true` for a pull-back |
| 4 | Light flash | 10% / 0% | 0.38 s (0.27 to 0.6) | light or energy carries the story (a signal enters a fibre, a photo becomes data); chapter changes | `in: { type: 'light', dur: 0.5, at: [x, y] }`, bursting from the light source's screen point |
| 5 | Dip to dark | 8% / 2% | 0.30 s (0.2 to 0.43) | time passes; leaving one world for another | `in: { type: 'dip', dur: 0.5, color: [0, 0, 0] }` |
| 6 | Whip | 6% / 21% | 0.13 to 0.17 s | a new angle on the same subject (never between two framings that differ by less than 1.5x in size or 35 degrees); fast story beats | `in: { type: 'whip', dur: 0.3 to 0.45, dir: [1, 0] }` |
| 7 | Match cut | a few per video | 1 frame or a blend | the voice draws an analogy: the same shape in the same screen position (a dot becomes a dot, one fist becomes another, a 3D gate becomes its line symbol) | frame both shots so the shape sits at the same pixel |
| 8 | Follow, no transition | the longest stretches | none | the travelling thing leads the camera from place to place | one shot with `cam.follow` (or `cam.path`) along the route |
| 9 | Portal | a few per video | 0.5 to 1 s | an object shown small (on a phone screen, in a thought bubble, beside the subject) grows until it is the next scene | push into the object, then `zoom` |

Rules:

- Pick the transition from the story, not for variety: scale change means zoom, energy means light, time means dip,
  analogy means match cut, travel means follow.
- Transitions are short: the visible part lasts 0.1 to 0.6 s. Anything slower reads as a slideshow.
- The subject of the incoming shot appears where the eye already is (section 9).

## 6. The running example and the HUD

The long explainers stay easy to follow over 2.5 minutes because two things never change identity.

The running example:

- One concrete thing from the viewer's life is introduced in the hook (a photo someone just sent, the phone in your
  hand, a grain of sand, your dinner) and is carried through the whole explanation.
- When the explanation goes from one to many, one item is singled out and tagged with a short label or number (one
  packet out of 1,500 with a 4-digit tag). From then on the camera follows that item, and the same tag appears as a 2D
  overlay even over cutaways, so the viewer always knows what to watch.
- It comes back at least every 30 to 40 s, and it is on screen in the final 5 s.
- Four of the five long references end on their opening image (the same object, framing and light), so the reel loops
  seamlessly.

The HUD (the measured case is a millisecond clock over a data journey):

- It appears when the journey starts (about 20 s in, after the setup) at 000 and stays in the same corner, size and
  colour until the journey ends (136 s), over every shot.
- It runs in story time, not screen time. While the steps are explained one by one it ticks 1 ms every 1.8 to 8 s of
  screen time (mostly 1.8 s, about 1,800 times slow motion). While the voice digresses (a 28 s aside) it holds still.
  During travel it fast-forwards at about 10 ms per second of screen time. It reaches the final value on the line that
  states it.
- The voice quotes it ("at 3 milliseconds...") once per chapter, so the HUD and the caption agree.
- A second counter can sit in the opposite corner for a different quantity (items arrived out of a total). It turns red
  while something is missing and back to the accent when it resolves (13 s later in the reference).
- The same device works for any process: a stopwatch whose scale is announced ("1 tick = 1 second") turns a nanosecond
  process into human time and can jump units (minutes, then days) as the idea grows.
- Kit: put the HUD in `globals.js` and drive it with `keys` through the narration's anchor words, which gives exactly
  this slow, hold, fast-forward behaviour:

  ```js
  const a = g.word('starts'), b = g.word('aside'), c = g.word('across'), d = g.wordEnd('later.');
  g.ui.hud({ at: a - 0.3, until: d + 1, size: 88, color: '#77d9fc', x: 1040, y: 250, unit: 'ms',
    value: (t) => Math.round(g.keys(t, [[a, 0], [b, 20, 'linear'], [c, 20], [d, 200, 'linear']])),
    format: (v) => String(v).padStart(3, '0') });
  ```

## 7. Numbers on screen

- A number lands on its word: on eight measured hero numbers, the first frame showing the value sat between 0.18 s
  before and 0.22 s after the spoken number began. Use `at: k.word('200,000') - 0.1`.
- How numbers arrive:
  - Roll: a large exact value rolls up in 0.25 to 0.3 s (three frames of blurred digits, then the value). Kit:
    `count: { range: [0, v], dur: 0.3, ease: 'outCubic' }`.
  - Type-on: digits appear left to right in 0.4 to 0.6 s, with the not-yet-said digits dim or hidden. Kit: a content
    function, `k.ui.hero((t) => ...)`.
  - Live count: a distance grows with the motion it measures (640 m to 2.5 km over 4 s, steady); arrivals count up over
    about 1.2 s and then hold; a precision clock keeps its last digits running while the camera holds.
  - Fast-forward with a unit jump: a stopwatch eases out over 1.6 s to the target, then switches unit (days) and steps
    about once per 0.5 s.
- Hold 0.8 to 2.6 s (median about 1.4 s), then fade and lift out over about 0.3 s. Counters and clocks are the
  exception: they stay for their whole section.
- A comparison number joins beside or below the first on its own word ("40 lanes", then "2,000 a second" next to it;
  "12 hours" over "60 words"). Never both at once.
- Every number gets its meaning on screen: a unit (0.3 to 0.4 x the size) and, when the unit is not enough, a
  sub-label of 1 to 5 words (see look.md).
- Results are built, not stated: the inputs arrive first (a time, a speed), slide into an equation term by term on the
  words, and the result lands last in the accent. Then it moves into the world (the distance turns and lies along the
  beam it measures).
- A verb of calculation (calculate, measure, work out) gets the equation even when the voice never says it: the GPS
  reference builds distance = 299,792 km/s × 0.073 s = 21,943 km term by term. A number counting up to the answer
  explains nothing.
- A size comparison holds its number over the comparison image ("100 billion" stays up while the chip sits on the
  nail).

## 8. The hook: the first 2 seconds

- Frame 0 is a finished beauty shot: the hero glows from inside or against a warm horizon, its hottest pixels reach
  240, it fills 35 to 60% of the width in the subject band, and the headline and a caption are up (the voice starts
  at 0.1 to 0.5 s; the kit shows the first caption from frame 0). No fade from black: leave `fadeIn` unset.
- The camera is already moving on frame 0 (20 to 40 px/s, a linear or outSine start). Something happens on the hero by
  1.0 s (a glint, an ignition, a pulse). Between 1.0 and 2.0 s the camera dives: two or three stages (into the
  object, through its surface, to the first explained thing), each 0.5 to 0.8 s, joined by zoom transitions. Four of
  the five measured studio reels dive like this (into a melt; a warp away from a distant object; an object down to
  its molecules; through clouds down to a lake). Long 2-minute explainers can open slower (3 to 36 px/s, the first big change
  at 1.2 to 2.5 s); story reels start mid-action at 180 to 540 px/s.
- The headline is 2 to 6 words at 110 px or more (or condensed capitals in the accent), the rest of the sentence in a
  small sub-line. It leaves as the dive starts, by 1.2 to 2.4 s.
- The title pairs a far-away or surprising thing with something in the viewer's hand or home, in 9 words or fewer:
  "This [distant thing] is how your [everyday object] [does everyday thing]", or "How your [object] [does impossible
  thing]". The voice opens on the concrete object instead: "This is [the thing]."
- When the story has a striking quantity, put it up early: in two of five long references the first hero number lands
  at 3 to 5 s.
- The hook image comes back at the very end (section 6).

## 9. Fast but not chaotic

The fast reels change something about every second, but they never ask the eye to search. How:

1. One focal point per beat. In 82 to 98% of 3D frames the sharp detail is centred inside the middle half of the
   frame (median at x 0.50, y 0.48 to 0.53). The brightest, sharpest and most saturated thing is the same thing;
   everything else is darker, blurred or both. In the story reels 61 to 97% of frames are shallow focus, with only the
   subject sharp.
2. The eye does not have to travel. Across a transition the centre of sharp detail moves a median 150 to 300 px (15 to
   25% of the width). The new subject appears where the old one was.
3. Many angles, one subject. In a fast reel the camera finds a new angle about every 2.2 s, but all the angles in a
   stretch circle the same subject (the hand, the dot, the cup), cutting in to its detail, out to its context and back
   in.
4. One change at a time. The camera, the subject's state and the overlay text take turns. Events are spaced 0.25 s or
   more apart, and a number never lands during a cut.
5. Motion hides the cuts. Story reels have almost no clean hard cuts (2% of boundaries); every change rides inside a
   whip or a fast push with motion blur, so the eye reads one continuous flow.
6. Little text. At most a caption, one hero number or counter, and two labels. Story reels show only the caption
   (2 to 3 words).
7. The voice leads. Each visual event lands on the word that names it, and the captions repeat the words, so every
   change is announced twice.

## 10. Structure of a whole video

From the long explainers, translated to a pure 3D video:

| Part | Length | What happens |
| --- | --- | --- |
| Cold open | the first 5 to 15 s | the hook (section 8) and the first striking fact |
| Question | 2 to 7 s | the references cut to the presenter here; in 3D, restate the question over a quiet establishing shot with a section word or hero term |
| Chapters | 20 to 40 s each | one world or one scale per chapter, each opening with its biggest transition (zoom-through, light flash) and a new hero number or section word |
| Return | the last 5 to 10 s | pull back to the big picture, then end on the opening image so the reel loops |

## 11. Checklist for your own cut

Run these on `words.json`, `project.json` and a draft (`bun kit/render.mjs <project> --draft`):

1. List every event with its time. The median gap is 1.0 s or less, and no gap exceeds 2.0 s.
2. Every event is tied to a word (`k.word`), and no two events are closer than 0.25 s.
3. A bigger beat (transition, hero number, scale reveal) comes every 3 to 5 s.
4. Shots: setups last 1.5 to 4 s, or a single follow move carries the time with events inside it. Transitions use a
   kit `dur` of 0.3 to 0.7 s, and their visible part lasts 0.6 s or less.
5. Each transition matches its reason: zoom for scale, light for energy, dip for time, a match cut for an analogy,
   follow for travel.
6. The camera is never locked off, except during a number or equation read (and then it still drifts). Cuts happen on
   motion.
7. Frame 0 shows the lit hero object (a beauty shot), the headline and a caption, with the camera moving. Something
   happens on the hero by 1.0 s, the dive runs between 1.0 and 2.0 s, and the headline is gone by 2.4 s.
8. Every hero number appears within 0.2 s of its word, has a unit or sub-label, and holds 0.8 to 2.6 s.
9. Captions: a new chunk every 0.8 to 1.4 s, 3 to 5 words, at most one highlight per chunk.
10. The running example appears in the hook, at least every 40 s, and in the last 5 s. If there is a HUD, it never
    moves and the voice quotes it.
11. In stills at three adjacent events, the focal object sits within about 300 px of the same screen point and is the
    only bright, sharp thing.
12. check.mjs prints `hook` 4 or more, no `static` run (3 s near-still) and no `dark` frame.
