---
name: charles-ux-animation
description: "Decides whether and how an interface moves and responds: easing, duration, origin, springs, stagger, arcs, icon swaps, press and hover states, tap targets and response time. Use when animating a modal, menu, tooltip, button, list or page change, reviewing an app's motion, or when it feels slow, janky or off. Layout and flow go to charles-design-laws, a final detail pass to charles-polish."
---

# UX & Animation

From Charles Liu's reels "20 Principles of UX & Animation" and "20 Practical Animation Tips", merged with Emil Kowalski's rules for interface animation and Josh Puckett's Interface Craft, on top of Disney's 12 principles of animation.

Every interaction answers five questions, in this order: should it move, does it answer at once, where should the eye go, how should it move, and can people find it, hit it, choose it and type into it. A later answer never rescues an earlier one: the best curve on an animation that shouldn't exist is still wrong.

## Run it

1. **Match the stack.** Find what the project already animates with (CSS transitions, Tailwind, Motion as `motion` or `framer-motion`, React Spring, WAAPI) and write in that. State changes stay CSS transitions. Where Motion is installed, use it only for what CSS can't do: animating an element out as it unmounts, layout changes, and springs that follow a finger. A change a CSS transition can do never pulls in a library, and a project that has Motion never gets a hand-written spring. Why: two systems animating the same kind of change drift apart in timing and in how they handle interruption.
2. **List the interactions** in scope. For each one, write what starts it (pointer, touch, keyboard, network, scroll), how often one person sets it off in a day, and what it has to tell them. Why: how often decides question 1, and what it tells decides what the motion has to show.
3. **Walk questions 1–5** for every interaction. Each subsection says when it applies; skip one that nothing in scope can trigger (nothing travels across the screen, so no Arcs).
4. **Name the numbers.** Durations, curves and springs live in named tokens (custom properties, the theme, or one constants file), every animation uses them, and elements that behave alike share them. A sequence of three or more stages gets a storyboard ([storyboards](references/techniques.md#storyboards)). Why: a number nobody can find is a number nobody tunes, and two durations 20ms apart read as a mistake.
5. **Verify** with the checks at the end.

[recipes.md](references/recipes.md) has exact values and code for modals, drawers, popovers, tooltips, toasts, entrances, exits, expanders, icon swaps, async buttons, press, number rolls, progress bars, sliders, carousels and the theme switch. [techniques.md](references/techniques.md) has the curve library, springs, interruptibility, arcs, mapping one value to another, rubber banding, loops, masks, cross-fades, storyboards, live tuning, performance and a symptom table. Both open with a contents line; read the section a rule links to.

**Reviewing instead of building?** Unless asked to fix, change nothing. Open the report with the interaction list from step 2, then write one table row per finding: severity, rule, where (file and line, or the frame), before, after. Severity is **broken** (a wrong result, lost input, a blocked or skipped step, something a keyboard or screen-reader user can't reach, motion that hides what people need or ignores a reduced-motion setting), **friction** (slower or more confusing than it needs to be) or **polish**. Sort by severity, then by the five questions: a failed Verify check sorts under the question it serves (reduced motion under 4), and unnamed numbers (step 4) sort last. A bug no rule covers still gets a row, with "no rule" as its rule, so it sorts with the rest.

## 1. Should it move?

### Frequency of use

```
What starts it, and how often?
├── The keyboard (arrow keys, shortcuts, ⌘K, Tab, focus moving)
│     → no animation. The new state shows on the next frame.
├── Something one person does many times a day (a list they sweep with the pointer,
│   a toolbar, tabs or a palette in a tool they live in)
│     → no animation, hover highlights included: on and off at once.
├── Something they do a few times a session (a menu, popover, modal, drawer, toast, a save)
│     → animate, inside the timing table in question 4.
└── A moment they won't repeat today (onboarding, a first success, finishing a big task)
      → may be choreographed: each move up to 500ms, the whole sequence up to 2.5s.

Then: does the motion answer a question (where it came from, whether the action registered,
what changed, what caused it)?
├── No  → cut it.
└── Yes → keep it, and make the motion show the answer ("Make it mean something", question 4).
```

- **Don't animate keyboard actions.** People repeat them all day long and press faster than any transition can finish, so a highlight that glides falls behind the keys and the interface feels delayed.
- **Don't animate things used very often.** A fade informs the first time and only makes people wait by the hundredth; the charm wears off and the delay stays. When you can't tell how often something gets used, ask; if nobody can say, treat the controls of the app's main working view (its toolbar, sidebar, lists and command palette) as used all day.
- Product UI stays inside the timing table. Marketing pages can run longer and showier, because people see them once.

### Tooltips after the first

**Don't animate the next tooltip.** The first tooltip in a group waits for its delay (the library's default, 600–700ms) and animates in. Once one is open, moving to its neighbour shows the next one at once, skipping both the wait and the transition ([tooltip](references/recipes.md#tooltip)). This holds on a toolbar used all day too: the delay keeps tooltips from flashing as the pointer crosses it, and only the first one animates. Keyboard focus shows a tooltip at once, with no delay and no transition. Why: the delay is there so a passing pointer doesn't open one by accident. Once someone is reading tooltips they've already waited once, and every further wait is pure lag.

### Page load

On first load, nothing plays an entrance just for being there: motion is for the changes people make once the page is up. Motion's `AnimatePresence` takes `initial={false}` for this: use it around toggles, tabs and icon swaps, and never around a first-run entrance whose whole point is to play. Why: an entrance on every load replays on every refresh and back navigation, and holds back content people already know is there.

## 2. Does it answer at once?

People stay in flow when the interface answers within 400ms (the Doherty threshold), and a press has to show on the very next frame.

- The pressed state shows on the same frame as the input, never after a network round trip.
- Update optimistically when an action almost never fails: like, favourite, toggle, reorder, mark as read, send a message, remove an item. The change starts on the same frame and rolls back with a message if the server refuses.
- A delete, archive or send leaves the screen at once and offers Undo in a toast for at least 5s. The request goes out when that window closes or the page is hidden, so Undo only has to put the item back. Confirm only what can't be undone, and name the action on the button ("Delete 3 files"). Why: people click through a confirmation by habit, so it prevents nothing, while Undo still works after the mistake.
- In a multi-step flow, a step that passes validation in the browser saves in the background while people move on; a failed save shows a toast with Retry and keeps their new place. A step whose result the next one needs (shipping cost depends on the saved address) waits like a final submit.
- Everything else, including every final submit (paying, placing an order): disable the trigger at once against double submits, show the spinner or "Saving…" only after 300ms, and hold it at least 500ms once it shows ([async buttons](references/recipes.md#async-buttons)). Why: a fast answer never flashes a spinner, and a slow one never flickers.
- Past 1s, show a skeleton the size of the result where it will land (a list, a page). If nothing lands, the trigger's pending state is enough.
- Reads show what the person saw last time, from a cache, then reconcile. Never render a default that flips when the fetch lands, like a bookmark icon jumping from empty to filled.
- Work that takes seconds and can't be skipped (a first import, processing a file) runs in the background, or behind something worth watching, never a bare spinner. A spinner that has to show spins fast. Why: a quicker spin makes the same wait feel shorter, and how long it feels is how long it was.

## 3. Where should the eye go?

### Staging

One primary motion at a time: the element the person touched, or the one that answers them. Everything else holds still or recedes (a 40–50% black scrim behind an expanded card, siblings at 0.5 opacity). Motion is the strongest signal on a screen, so whatever moves gets looked at: spend it on what matters. When one action sets off several different motions, chain them: each starts as the one before lands (the photo reaches the cart, then the badge bumps), never side by side. Why: the eye follows one thing; two motions at once split attention and neither lands.

### Stagger

**Chain animations with a stagger.** When several copies of one element enter together (list rows, cards, menu items, a radial menu's buttons), start each a little after the one before instead of moving them as one block: 40–70ms apart, the longer gap when there are only 3 or 4, and only the first 6 offset (the rest arrive with the sixth). Distinct pieces of one section (the heading, then the copy, then the actions) enter 80–100ms apart. Content riding in on a container that's already moving (a drawer's rows, a modal's body) arrives with the container, in one piece. Why: a small offset reads as one gesture with an order and leads the eye through the group, a block reads as a slide, and a stagger inside a moving container competes with the container.

### Secondary action

Only on top of a primary motion, never alone, and only in the rare moments from question 1. It starts with the primary or up to 100ms after, ends within 150ms of it, and moves at most a third as much: the check draws in, then a ring scales from 1 to 1.4 as it fades. Why: it backs the main action up, and as soon as it's as big or as long, it competes with it.

### Exaggeration

Only where a moment must register: an error on submit, a failed attempt (a wrong password, a declined card), a first success. An error shake moves the wrong field through translateX 0, −10, 10, −6, 6, −3, 0px over 360ms, puts focus there and shows the message beside it. Never on blur, and never on neutral changes like opening a menu or switching tabs. Why: exaggeration is a volume knob, and if everything is loud, nothing is.

## 4. How should it move?

### Timing

| What | Duration |
| --- | --- |
| Press, hover, colour | 100–150ms |
| Tooltip | 125ms |
| Dropdown, popover, select | 150–250ms |
| Modal, drawer, sheet, toast | 200–300ms |
| Moving or resizing in place (a progress fill, rows closing a gap, a reorder, an expander) | 200–300ms |
| Page transition, shared-element move, something flying to a new place | 300–400ms |
| Rare, choreographed moment | up to 500ms a move |

**Keep animations fast:** everything people open and close stays under 300ms, and only moves across the screen take longer. Within a range, bigger elements and longer distances take the longer end. If it feels slow, cut the duration before touching the curve. Why: duration is most of the feel. The same select feels instant at 180ms and sluggish at 400ms.

**Exits** are 20–30% shorter than their entrance, and quieter: a fade with at most a small move, an 8–16px nudge toward where it's going or back to the scale it entered from, never its full height. The exception is something whose destination is the point (a drawer closing, a card swiped away): it leaves the way it came. Never an instant `display: none` on something that animates in, which loses where it went; what question 1 keeps still shows and hides at once. Anything kept mounted so it can animate out is inert while closed (the `inert` attribute and `pointer-events: none`). Why: people stop watching something the moment they dismiss it, so a long exit only holds up what comes next.

### Easing

```
Follows a finger, or can be thrown or redirected mid-gesture (drag, swipe, sheet, slider, carousel)?
      → spring: Motion { type: "spring", duration: 0.5, bounce: 0 }.
        Bounce 0.1–0.3 only for playful, physical objects; never more.
Entering or leaving the screen (popover, menu, modal, toast, page)?
      → ease-out: cubic-bezier(0.32, 0.72, 0, 1), for the entrance and the exit
Staying on screen while it moves or changes size?
      → ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)
Hover or colour?
      → ease, 150ms
Constant rate, where the motion is time itself (spinner, marquee, countdown, hold-to-confirm ring)?
      → linear
```

- **Ease-out for enter and exit.** It covers most of the distance in the first frames, so the response reads as instant: at the same 300ms, an ease-out menu feels faster than an ease-in one. Never ease-in in product UI. It starts slowly, and a slow start reads as lag.
- **Ease-in-out for things moving on screen.** It pulls away and brakes the way a car does between two stops, so a move from one place to another looks physical rather than mechanical.
- **Custom curves, never the CSS keywords.** The built-in `ease-out` and `ease-in-out` are too gentle to read as a decision for anything that moves or scales, and a stronger custom curve feels more energetic ([curves](references/techniques.md#curves) has softer and stronger ones). The `ease` keyword is fine for colour and hover.
- **Never `transition: all`.** Name each property. Why: `all` also animates whatever else changes, like a theme's colours or a position a script sets every frame.
- Anything that can be toggled or interrupted uses a CSS transition or a spring, which turns around from where it is ([interruptibility](references/techniques.md#interruptibility)). Keyframes are only for one-shots nothing interrupts: an entrance on first paint, a loader, a celebration.

### Origin and starting scale

- **Grow popovers from their button.** Popovers, dropdowns, selects and tooltips scale from their trigger: Radix exposes the point as `--radix-<component>-content-transform-origin` (`--radix-popover-content-transform-origin`, for one), Base UI as `--transform-origin`, and anywhere else you set `transform-origin` to the trigger's side by hand. CSS's default origin is the centre, which is wrong for anything anchored to a button. Why: growing out of the button shows where it came from. A modal has no trigger beside it, so it scales from its centre.
- **Never animate from `scale(0)`.** Popovers and menus start at 0.95, tooltips and modals at 0.97 (a tooltip is too small to need more, and a modal too big to take more), always with `opacity: 0`. Why: nothing real appears out of a single point. From 0 it looks like it came from nowhere; from 0.95 it already has a shape.
- Paired elements (modal and overlay, drawer and backdrop, tooltip and arrow) share one duration and one curve. Why: two halves of one object on different clocks look broken.

### Anticipation, press and hover

- **Scale buttons to 0.97.** Buttons, icon buttons and chips scale to 0.97 while pressed (`:active`), with a 150ms transition on the ease-out curve, so letting go mid-press glides back; never below 0.95. Why: the button answers the press before the result arrives, so the interface feels like it's listening. Surfaces wider than 200px (cards, rows) change background on press instead, because 3% of a wide surface is a jump. Dense controls used all day (toolbars, editor chrome) skip the scale and darken their background on press instead, with no transition, so give the button component an opt-out ([press](references/recipes.md#press)). When the element already has a transform, put the scale on a wrapper.
- **A wind-up only before a rare launch.** Before a throw or flip the person sets off in a rare moment (confetti on a first success, a card sent off at the end of onboarding), move 5–10% of the travel the opposite way, or scale to 0.95, over 80–120ms, then go. Never before anything people do often, because the wind-up is added latency.
- **Turn off hover on touch screens.** Hover motion runs only where a real pointer hovers: `@media (hover: hover) and (pointer: fine)` (Tailwind v4's `hover:` variant already checks `hover: hover`). Why: fingers can't hover. A tap fires the hover state and can leave it stuck after the finger lifts, which is never what the person meant.
- **Put hover on a parent that doesn't move.** When a hover moves, lifts or shrinks the element, keep the hover on a parent that stays still and animate a child: `.card:hover .card-inner { translate: 0 -4px; }`. Why: an element that moves itself slides off the cursor, loses its hover, slides back and flickers.

### Arcs

**Move things along arcs.** When something travels between two points that differ on both axes by more than 40px (a product photo flying to the cart, a thrown card, a floating button moving to a corner), move it on a curve that bulges 10–20% of the distance off the straight line ([arcs](references/techniques.md#arcs)). Moves along one axis (drawers, list reorders) stay straight. Why: anything thrown in the real world falls as it flies, so its path bends, and a straight diagonal looks mechanical.

**Add scale and shadow mid-air.** On the arc, scale the object up to at most 1.3 at the peak and back, and grow its shadow with it (from `0 2px 4px` to `0 24px 32px`), so it rises off the page instead of sliding across it. Why: scale and shadow together read as height, and the object feels alive in the air.

### Follow through

When a container stops, the non-text parts inside it settle a beat later: a toast's icon, a sheet's grabber, a dragged card's image. Drive them with a softer spring than the parent (damping ratio 0.7–0.85) or start them 20–40ms after it, with overshoot under 4% of the travel. Text never lags or wobbles, so an all-text panel arrives in one piece, and nothing people use many times a day gets follow-through. In a rare moment, the hero object's last settle may rebound for up to 1s, because by then the person already knows what happened. Why: parts that all stop on the same frame read as one rigid sticker.

### Squash and stretch

Only for things that behave physically: something that bounces, lands, is dropped, caught or flung (a dock icon, a badge landing, a drag-and-drop drop, a slider thumb jumping to a value). Stretch along the direction of travel in step with speed, so it peaks mid-move and is gone when the object stops, and squash on impact. Keep scaleX × scaleY close to 1. A small round thumb (64px or less) may reach 1.3 × 0.85 at full speed; anything larger stays within 15%. It settles within 250ms of stopping. Squash the shape, never the text in it, and never inputs, layout containers or anything read while it moves. Why: it shows weight and speed, while on rigid UI it looks broken.

### Pose to pose

Define the states (closed and open; idle, pressed and done) or keyframes at explicit offsets, and let the engine fill in between. Write frame-by-frame code only for motion driven live by input: drag, scroll, cursor. Why: poses keep motion predictable and tunable in one place.

### Solid drawing

Anything that flips, tilts or turns gets real depth: `perspective` of 600–1000px on its parent (lower exaggerates the depth), `transform-style: preserve-3d`, and `backface-visibility: hidden` on each face. Never fake a flip with `scaleX`. Light it: darken the face turning away, up to 30% black at 90°, and shrink the shadow as it lifts. Press feedback goes on the parent, so it never overwrites the rotation. In a 3D carousel, leave more room around the centre item than between the items behind it, so turned items never cut through each other. Why: without perspective, a rotation renders as a flat squeeze.

### Make it mean something

Borrow a real object's behaviour, so the motion carries the meaning, and never animate for its own sake:

- **Roll numbers like an odometer.** A changing number rolls only the digits that change, upward when it grows and downward when it shrinks, in `tabular-nums` so nothing shifts ([number roll](references/recipes.md#number-roll)). A number tied to a slider ticks as the thumb moves. Why: a rolling digit says "counting" without a word, where a swapped number only flashes.
- An item leaves toward where it went: a deleted row collapses, an archived one slides toward the archive, a sent message rises.
- Something drawn as a physical object (a card, a letter, a ticket) moves like one: it never fades in or out while in view, never passes through another object, and clears its container's edges before it moves toward the viewer.
- Finished things recede: a completed task collapses, fades back or stacks away, so what's left stands out.
- A hint shows the gesture instead of describing it: a looping hand that swipes or drags, gone the moment the person touches.

Why: motion that matches a real thing reads at once; motion that's only decoration has to earn a reason it doesn't have.

### Swap in place

When one element replaces another in the same spot (a label becomes a spinner, a copy icon becomes a check, one card replaces the next):

- **Swap elements in place, both at once.** Never wait for the old one to finish leaving. Stack the two in one spot (one grid cell, or both absolutely positioned in the same box) so nothing around them moves. In Motion, use `AnimatePresence mode="popLayout"`: the default `sync` mode keeps the leaving element in the layout, so the two sit side by side and the new one jumps into place when the old is removed. Why: a swap in sequence doubles the wait for nothing new, and a swap that shifts the layout makes the icon jump.
- **Blur between icons.** Cross-fade them through a 2px blur, with a deep scale (0.3 → 1) on a spring with no bounce ([icon swaps](references/recipes.md#icon-swaps)). Why: halfway through a plain cross-fade the eye sees two sharp icons stacked; the blur melts them into one shape that changes. When the curve and duration are right and two states still look disconnected, the same 2px blur bridges them.
- Something that's traveling or changing shape stays one element for the whole move. Why: a swap mid-move twitches.

### Interruptible

Never block input while something animates. When the person changes their mind halfway (taps a menu again before it has finished opening), the motion turns around from where it is, at the speed it has. Clicks assist: snap to the likely value (a slider click lands on the nearest 10%) and spring there. Drags are direct: the element stays 1:1 under the finger with no easing, and a spring takes over on release, carrying the release velocity. At a bound, rubber-band with diminishing returns after a small dead zone, never a hard stop ([rubber banding](references/techniques.md#rubber-banding)). Why: an interface that makes you wait for its animation is slower than one with none, and people overshoot on purpose to reach an end.

### Loops

Only for ambient objects and rare moments (a hero object, an idle hint, a floating badge): layer a small loop on top of the main motion, a vertical drift within ±10px and a 1–3% scale, out of phase with each other. Drive every loop with a sine wave rather than keyframes, and offset each item's phase rather than delaying its start ([loops](references/techniques.md#loops)). Pause loops while they're off screen. Never loop anything people are reading or aiming at. Why: a keyframe loop shows a seam where it turns around, and a moving target is harder to hit.

### Shaky animations

Move and resize with `transform` and `opacity` only; colour and `stroke-dashoffset` are fine, and blur stays under 20px. Never animate width, height, top, left or margin: collapse a removed row with FLIP (measure, then animate the transform), and open an expander with grid rows ([expanders](references/recipes.md#expanders)). **Fix shaky animations** with `will-change: transform` on the element that shifts by a pixel at the start or end of its move, and on nothing else. Why: the browser hands the element between CPU and GPU rendering as the animation starts and ends, and the two draw it a pixel apart; `will-change` keeps it on the GPU for the whole move. Each element it promotes costs memory, so it never goes on everything.

## 5. Can people find it, hit it, choose it and type into it?

Layout, grouping and flow (proximity, similarity, progress, how a flow ends) belong to charles-design-laws. These five laws are the ones about reaching and using a single control.

### Fitts's law and hit areas

The bigger and closer a target, the faster it's hit. The primary action is the largest target and sits nearest where the pointer or thumb already is: beside the field it submits, at the bottom of the screen on a phone. Destructive actions sit away from it, so a miss can't trigger them, and in a confirmation for one, Cancel takes the default focus.

**Enlarge the tap areas for small buttons.** Every target is at least 44×44px on touch, 40×40px where the only input is a mouse. When the visual has to stay small (16–24px icons, close buttons, checkboxes, slider thumbs), grow the clickable area with a pseudo-element, never the visual:

```css
.tiny-button { position: relative; }
.tiny-button::before {
  content: "";
  position: absolute;
  inset: 50% auto auto 50%;
  width: max(100%, 44px);   /* 40px where the only input is a mouse */
  height: max(100%, 44px);
  translate: -50% -50%;
}
```

Where two grown areas would overlap, shrink both equally, never below 24×24px (WCAG 2.2's floor); if they still overlap, space the items apart. When a whole row acts as one link, the whole row is the target. Why: people aim at the centre and land near it, and 44px is the size Apple and WCAG both give a comfortable target, so an area bigger than the icon absorbs the miss.

### Hick's law

Decision time grows with the number of choices. For options people weigh against each other (plans, sort orders, settings, onboarding choices), cut the ones few people pick and keep each group to 7 or fewer under a heading, so people pick a group and then an item. Put search first when people already know what they want (command palettes, country and font pickers). One decision per step in onboarding and checkout. Mark one option as recommended only when you have a real recommendation, and never pre-select anything that costs money or shares data. Why: comparing slows down with every option, while a search doesn't care how long the list is.

### Miller's law

Working memory holds a handful of items, so chunk anything people read, compare or type that runs past 5 units: card numbers by scheme (4-4-4-4, Amex 4-6-5), phone numbers in their national format, one-time codes as 3 + 3, long forms in sections of at most 5 fields, top-level navigation at 7 items or fewer. Fixed-pattern numbers format as people type. Never make people carry something from one screen to the next; show it where it's needed. Why: a chunk counts as one item, so 16 digits become 4.

### Jakob's law

People spend most of their time in other products and expect yours to work the same way. Keep the conventions: the logo top left links home, account and cart sit top right, ⌘K or Ctrl+K opens the command palette, Esc closes the top layer, Enter submits a one-field form, a swipe from the left edge goes back on iOS, a magnifier means search, and links look like links. Put the novelty in the content and the craft, not in where things live or what gestures do. If you must break a convention, teach it the first time and keep the usual path working. Why: every broken convention costs people a moment of relearning, every time.

### Postel's law

Accept messy input and give back one clean format. A date picked from a range you know (a delivery day, a booking) uses a picker limited to valid days. Anything people type from what they already know (a birthday, a phone or card number, an email) is a text field that parses every common form: "15 jan 2026", "2026-01-15" and "1/15/26" in their locale, numbers with spaces, dashes or brackets, emails with stray spaces or capitals, pasted values with trailing whitespace. Free-form values show back normalized on blur ("Thursday, 15 January 2026"). Validate on blur or submit, never while someone is still typing a field for the first time; once an error shows, re-check on every keystroke so it clears the moment it's fixed. When parsing truly fails, keep what they typed and name the format that works, with an example. Why: a strict format moves your work onto the person.

## Verify

Run every check you can: if the page runs as it is (open the file, or use a dev server that's already up), check it there. Don't build a harness or scaffolding to make something runnable; in a code-only review, list after the findings the checks you couldn't run and what each would catch.

- [ ] **Scrub** every animation at 10% speed (DevTools → Animations, or a frame-by-frame recording). The first frame responds, the last settles with no pop and no 1px jump, and only one thing leads at a time.
- [ ] **Interrupt** each one halfway. It turns around from where it is.
- [ ] **Hammer the keyboard** through every list, menu and shortcut. Nothing trails the keys.
- [ ] **Sweep the pointer** across every list, toolbar and row of tooltip triggers. Highlights follow at once, the tooltips after the first show instantly, and nothing under the pointer flickers.
- [ ] **Slow the network** to 1s or more, and force each failure (offline, a server error). Presses register at once, nothing flashes a spinner under 300ms, optimistic changes roll back with a message, and nothing the person typed is lost.
- [ ] **Tap the edges** of every small target on a phone. Each one hits, and no hover state sticks after a tap.
- [ ] **Reduced motion** (`prefers-reduced-motion: reduce`; `useReducedMotion()` in Motion): every animation is off, fades included, autoplaying video waits for a play button, and every end state and piece of information is the same as with motion on. The one exception is an indicator that work is still happening (a spinner, a progress bar), which keeps moving, because a frozen spinner looks like a hang.
- [ ] **Switch the theme.** No colour transitions fire across the page ([theme switch](references/recipes.md#theme-switch)).
- [ ] **Tenth use:** run each animation at full speed as someone seeing it for the tenth time today. Cut or shorten the one that starts to feel slow.

**Appeal** is what you get when everything above holds. You can't add it at the end, only fail to lose it. Final pass: one set of named curves and durations used everywhere, every state designed (empty, loading, error, success, offline), and nothing appears from nowhere.
