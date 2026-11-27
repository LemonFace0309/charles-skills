# Techniques

Contents: [curves](#curves) · [springs](#springs) · [interruptibility](#interruptibility) · [arcs](#arcs) · [mapping one value to another](#mapping-one-value-to-another) · [rubber banding](#rubber-banding) · [loops](#loops) · [masks and reveals](#masks-and-reveals) · [cross-fades and groups](#cross-fades-and-groups) · [storyboards](#storyboards) · [timelines and live tuning](#timelines-and-live-tuning) · [performance](#performance) · [symptoms](#symptoms)

## Curves

Start with the two defaults: ease-out `cubic-bezier(0.32, 0.72, 0, 1)` for anything entering or leaving, and ease-in-out `cubic-bezier(0.77, 0, 0.175, 1)` for anything moving on screen. Reach into the families below only when a default feels too soft or too sharp for one element: quad and cubic are gentler, quart and up are snappier. The CSS keywords are too weak for movement; `ease` is fine for hover and colour.

```css
/* ease-out: entering, leaving, answering input */
--ease-out-quad:  cubic-bezier(0.25, 0.46, 0.45, 0.94);
--ease-out-cubic: cubic-bezier(0.215, 0.61, 0.355, 1);
--ease-out-quart: cubic-bezier(0.165, 0.84, 0.44, 1);
--ease-out-quint: cubic-bezier(0.23, 1, 0.32, 1);
--ease-out-expo:  cubic-bezier(0.19, 1, 0.22, 1);
--ease-out-circ:  cubic-bezier(0.075, 0.82, 0.165, 1);

/* ease-in-out: moving or resizing on screen */
--ease-in-out-quad:  cubic-bezier(0.455, 0.03, 0.515, 0.955);
--ease-in-out-cubic: cubic-bezier(0.645, 0.045, 0.355, 1);
--ease-in-out-quart: cubic-bezier(0.77, 0, 0.175, 1);
--ease-in-out-quint: cubic-bezier(0.86, 0, 0.07, 1);
--ease-in-out-expo:  cubic-bezier(1, 0, 0, 1);
--ease-in-out-circ:  cubic-bezier(0.785, 0.135, 0.15, 0.86);
```

`linear` is only for a constant rate, where the motion is time itself: a marquee, a ticker, a countdown, a hold-to-delete ring.

Tailwind v4 defines `--ease-out` and `--ease-in-out` itself, so putting these values under those names in `@theme` retimes every `ease-*` utility in the app. Do that only when the change is meant for the whole app; for one component, add the curves under new names (`--ease-enter`, `--ease-move`).

## Springs

Write springs as duration and bounce, `{ type: "spring", duration: 0.5, bounce: 0 }` in Motion. Use stiffness, damping and mass only to match an animation that already uses them; good starting points are 300 and 30 for containers and cards, 350 and 28 for slides and entrances, and 500 and 25 for badges and pop-ins. Bounce stays 0 in product UI, and 0.1–0.3 for something playful and physical. A spring keeps its velocity when it's interrupted, which is why everything that follows a finger runs on one.

## Interruptibility

A transition always heads from wherever the element is now to its newest target, so a second click mid-flight turns it around. Keyframes replay the same fixed sequence from the start every time, so a second click jumps back and plays it again. So every state the person can switch back and forth runs on a transition or a spring.

```css
/* Turns around: closing halfway through opening heads back from where it is */
.panel { transform: translateX(100%); transition: transform 200ms var(--ease-out); }
.panel[data-open] { transform: translateX(0); transition-duration: 280ms; }

/* Jumps: closing halfway through restarts from a fixed frame */
.panel[data-open] { animation: panel-in 280ms var(--ease-out) forwards; }
```

## Arcs

Move x in a straight line and lift y by half a sine wave, which peaks at the middle of the move:

```js
// progress: 0 → 1, already eased. lift: px off the straight line at the middle, 10–20% of the distance.
function alongArc(start, end, lift, progress) {
  const x = start.x + (end.x - start.x) * progress;
  const y = start.y + (end.y - start.y) * progress;
  return { x, y: y - lift * Math.sin(Math.PI * progress) };
}
```

- **Motion:** recent versions ship an `arc` helper, passed as the transition's `path`: `transition={{ duration: 0.4, path: arc({ strength: 0.35, peak: 0.5, direction: "cw" }) }}`. `strength` sets how far the path bulges, `peak` where along the move the top falls, and `direction` which side it bows to. Check that the installed version exports `arc` before you use it; if it doesn't, drive x and y from `alongArc`.
- **CSS:** put x and y on two nested wrappers that move over the same duration on different curves, x on `--ease-out` and y on `--ease-in-out`. The axis that gets ahead early decides which way the path bows, so swap the two curves to bow it the other way, and pick a stronger ease-out from the families above to bow it further.

Scale and shadow make the flight read as height: scale 1 → 1.3 → 1 over the move (`scale: [1, 1.3, 1]` in Motion), with the shadow growing from `0 2px 4px rgb(0 0 0 / 0.12)` at rest to `0 24px 32px rgb(0 0 0 / 0.22)` at the peak. Animating `box-shadow` repaints every frame, so draw the big shadow once on a pseudo-element and fade that instead:

```css
.flyer { position: relative; box-shadow: 0 2px 4px rgb(0 0 0 / 0.12); }
.flyer::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: 0 24px 32px rgb(0 0 0 / 0.22);
  opacity: 0;
}
.flyer.in-flight::after { animation: rise 400ms var(--ease-in-out); }
@keyframes rise { 50% { opacity: 1; } }
```

## Mapping one value to another

Most effects that answer scroll, the pointer or another value are one number driving another:

```js
// Clamp the fraction, not the output.
function mapRange(value, [fromLow, fromHigh], [toLow, toHigh], clamp = true) {
  let t = (value - fromLow) / (fromHigh - fromLow);
  if (clamp) t = Math.min(Math.max(t, 0), 1);
  return toLow + (toHigh - toLow) * t;
}
```

- To ease a mapping, map to 0–1, pass that through an easing function, then map it to the output.
- A collapsing header maps 0–128px of scroll to the large title's scale, 1 → 0.5, from its left edge.
- A pointer tilt maps the pointer's position across a card to `rotateY` −14° → 14° and `rotateX` 14° → −14°, centred on 0 so the middle of the card means no tilt, and smooths it with a spring.
- Dock magnification maps each icon's distance from the pointer, eased, to a scale from 1 up to the maximum.
- A value shown as a colour mixes through several stops (green, then amber, then red), in OKLCH so the midpoints don't go muddy.

Whenever you're about to write an if/else ladder that changes a visual across a range, write a mapping instead.

## Rubber banding

Past a bound, the pull keeps moving the element with diminishing returns, toward a ceiling it never reaches, once it clears a small dead zone in which the element simply holds at the bound:

```js
const DEAD_ZONE = 12;   // px of overshoot that only holds at the bound
const SOFTNESS = 150;   // px of pull that reaches half the ceiling; larger feels stiffer
const CEILING = 64;     // px the stretch approaches but never reaches

const past = Math.max(0, overshoot - DEAD_ZONE);
const stretch = CEILING * (past / (past + SOFTNESS));
```

On release, spring back to the bound. Why the dead zone: people overshoot on purpose to land on 0 or 100%, and that shouldn't stretch anything.

## Loops

Drive loops with a sine wave: it's smooth at every point and repeats with no seam, where a keyframe loop shows a bump at the turn.

```js
// seconds: time since start. rate: cycles per second. offset: where in the cycle this item starts (0–1).
const wave = (seconds, rate, offset = 0) => Math.sin(2 * Math.PI * (rate * seconds + offset)); // −1 … 1
const drift = wave(seconds, 0.8) * 10;                                         // ±10px
const breathe = mapRange(wave(seconds, 0.8, 0.25), [-1, 1], [0.98, 1.02]);    // out of step with the drift
```

- For a row of items, give each the same wave with its own offset (index × 0.08 cycles) instead of a delay; the row moves like one thing breathing.
- For drift that feels less mechanical, add a wave at twice the rate and half the height, and another at four times the rate and a quarter of the height, then divide by 1.75 to keep the range.
- To cycle a colour, swing the hue within ±20°, never around the whole wheel.
- Pause every loop off screen, with an `IntersectionObserver` or `animation-play-state: paused`.

## Masks and reveals

- `clip-path` gives a crisp edge: a wipe goes from `inset(0 100% 0 0)` to `inset(0)`, an iris from `circle(0% at 50% 50%)` to `circle(75% at 50% 50%)`.
- `mask-image` gives a soft edge. Fade the ends of a scrolling row instead of cutting them off: `mask-image: linear-gradient(90deg, transparent, #000 48px, #000 calc(100% - 48px), transparent)`.
- Fade content out (under a "Show more") with a mask, never with an overlay painted in the background colour, which breaks on any other background, dark mode included.
- To slide something into a slot, clip away the part that's already inside with `clip-path: inset()` as it crosses the opening, and draw the slot's front edge above it.

## Cross-fades and groups

- Two layers cross-fading at partial opacity let the background through, so the midpoint looks washed out. Put both in a group with `isolation: isolate` and give both `mix-blend-mode: plus-lighter`; their opacities (a and 1 − a) then add up to full coverage.
- Fade a group through its wrapper, never child by child, or overlapping children show through each other.
- When two states still look disconnected after the curve and duration are right, a 2px blur during the change bridges them.

## Storyboards

A sequence of three or more stages reads like a script: a comment that lists what happens when, one object of start times, and one config object per element.

```tsx
/* Timeline, ms after the tap
 *    0  card rises from 0.95
 *  180  title highlights
 *  300  rows slide up, 40ms apart
 *  520  button fades in
 */
const AT = { card: 0, title: 180, rows: 300, button: 520 };

const CARD = { from: 0.95, spring: { type: "spring", duration: 0.5, bounce: 0 } };
const ROWS = { gap: 0.04, rise: 8 }; // seconds between rows, px each row rises

const [step, setStep] = useState(0);
useEffect(() => {
  setStep(0);
  const timers = Object.values(AT).map((ms, i) => setTimeout(() => setStep(i + 1), ms));
  return () => timers.forEach(clearTimeout);
}, [replay]);
// In JSX: animate={{ scale: step >= 1 ? 1 : CARD.from }} transition={CARD.spring}
```

- The comment and `AT` always match. Times count from the trigger, not from the stage before.
- Every value lives in the config object named after its element, so the JSX holds no bare numbers.
- One `step` number, compared with `>=`, so stages add up; repeated items are arrays rendered with `.map()`.
- A `replay` value in the effect's dependencies replays the sequence while you tune it.

## Timelines and live tuning

- Choreography with overlapping tracks (an envelope flips while a letter rises out of it) is tuned on a scrubbable timeline, such as DialKit's Timeline, not with delay sliders and timers.
- Plan the big steps first, group the properties by object, then refine each step.
- Put changes that can't animate (a z-index swap, an element swap, a sound) on the same timeline as events, and scrub to the frame where they land unseen. Too early or too late, and a z-index swap shows as a jump.
- Scrub for the earliest start that doesn't make anything clip or overlap.
- While tuning, expose durations, curves and springs as live controls (a DialKit panel), then hard-code what works as named constants and keep the controls out of production. DialKit is a new dependency, so add it only with the person's OK.

## Performance

- Animate `transform` and `opacity`. Keep blur under 20px (it's slowest in Safari), and never animate a CSS custom property that's read deep in a tree, because each change restyles everything below it.
- In React, never drive a per-frame animation through state, which re-renders every frame. Write styles straight to the element through a ref, or hand the motion to WAAPI or the library's own frame loop. In Motion, a full transform string (`animate={{ transform: "translateX(100px)" }}`) can run on the compositor where `x: 100` runs on the main thread, so use the string for things that move during heavy work on the page.
- CSS transitions keep running smoothly through heavy JavaScript. JavaScript engines run on `requestAnimationFrame`, and you need them for springs, gestures and values worked out live. Use the simplest one that does the job.
- `will-change: transform` goes only on an element that shifts by a pixel at the start or end of its move. Each element it promotes to its own layer costs memory, so never set it on everything.

## Symptoms

| Symptom | Fix |
| --- | --- |
| Feels off and you can't say why | Record it and step through it a frame at a time |
| Jumps by a pixel at the start or end | `will-change: transform` on that element only |
| Flickers when hovered | Hover on a still parent, animate a child |
| A hover state sticks after a tap on a phone | `@media (hover: hover) and (pointer: fine)` |
| Two icons visible at once mid-swap | Swap both at once in one spot, with a 2px blur |
| The new icon jumps into place | `AnimatePresence mode="popLayout"`, or stack both in one grid cell |
| A popover grows out of its own middle | `transform-origin` at the trigger |
| Something pops out of a dot | Start at 0.95 with opacity 0, never `scale(0)` |
| Every tooltip makes you wait again | Delay only the first; the rest open instantly |
| A dropdown feels slow at a normal duration | Ease-out instead of ease-in, with a custom curve |
| A list highlight trails the arrow keys | No transition on keyboard-driven changes |
| Every colour fades on a theme switch | Turn transitions off for the switch ([recipe](recipes.md#theme-switch)) |
| A drawer jumps when closed mid-open | A transition or spring instead of keyframes |
| Feels slow | Cut the duration before touching the curve |
