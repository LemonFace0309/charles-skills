---
name: charles-ux-animation
description: "The 20 principles of UX and animation as one procedure for building or reviewing how an interface moves and responds: Disney's 12 principles adapted to UI, Fitts's, Hick's, Miller's, Postel's and Jakob's laws, the Doherty threshold, hit areas, and frequency of use. Use when adding or reviewing animation, transitions, micro-interactions, feedback and loading states, click and tap targets, menus and pickers, long numbers and forms, input parsing, or navigation conventions. Triggers on: animate, motion, transition, easing, duration, spring, bounce, anticipation, squash and stretch, follow-through, arcs, staging, secondary action, exaggeration, shake, flip, perspective, appeal, Fitts's law, hit area, tap target, Hick's law, too many options, Miller's law, chunking, Doherty threshold, feels slow, optimistic UI, Postel's law, input format, validation, Jakob's law, conventions, command palette."
---

# UX & Animation

From Charles Liu's "20 Principles of UX & Animation" reel. Built on Disney's 12 principles of animation (Frank Thomas and Ollie Johnston, *The Illusion of Life*), Raphael Salaja's userinterface.wiki, Jon Yablonski's Laws of UX, and Emil Kowalski's rule on frequency.

Every interaction answers four questions, in this order: should it move, where should the eye go, how should it move, and can people hit it, choose it and read it. Walk them in that order every time. A later answer never rescues an earlier one: the perfect curve on an animation that shouldn't exist is still wrong.

## Run it

1. **List the interactions** in scope. For each, write down what triggers it (pointer, touch, keyboard, network), how often one person fires it, and what it has to tell them.
2. **Walk steps 1–4** below for each one.
3. **Name the numbers.** Durations, curves and springs live in named constants or tokens at the top of the file, and every animation uses them. Paired elements share them.
4. **Verify** with the checks at the end. Nothing is done until you've scrubbed it.

Reviewing instead of building? Report each finding as: principle, what's wrong, evidence (file and line, or frame), fix.

## 1. Should it move?

### Frequency of use

```
How often will one person trigger this?
├── Many times a session, or from the keyboard (shortcuts, arrow keys, ⌘K, tabs, list navigation)
│     → no transition. The new state shows on the next frame.
├── A few times a session (menu, popover, modal, drawer, toast, saving a form)
│     → animate, within the timing table in step 3.
└── Rarely: a milestone the person won't repeat this session (onboarding, a first success, finishing a big task)
      → may be expressive: up to 500ms per element, secondary action allowed.

Then: does the motion answer a question? (Where did this come from? Did my action register? What changed?)
├── No  → cut it.
└── Yes → keep it and go to step 2.
```

Press and hover feedback is exempt: it's the response itself, not a transition, so it stays at every frequency (100–150ms). Changes made from the keyboard get none. Why: the hundredth time someone sees an animation, it stops informing and starts delaying. Keyboard users act faster than any transition, so a highlight that glides falls behind the keys.

### Doherty threshold

People stay in flow when the interface answers within 400ms.

- The pressed state shows on the same frame as the input, never after a network round trip.
- Update optimistically when an action almost never fails: like, favorite, toggle, reorder, mark as read, send a message. The change starts on the same frame (a motion that starts at once counts), and rolls back with a message if the server refuses. Never be optimistic about anything the server validates, like saving a form or paying.
- Everything else: disable the trigger at once against double submits, and show "Saving…" or a spinner only after 300ms, held at least 500ms once shown. Why: fast responses never flash a spinner, and slow ones don't flicker.
- Past 1s, if the result appears somewhere (a list, a page), show a skeleton the size of the content there. If it doesn't, the trigger's pending state is enough.

## 2. Where should the eye go?

- **Staging.** One primary motion at a time: the element the person touched, or the one that answers them. Everything else holds still or recedes (a 40–50% black scrim behind an expanded card, siblings at 0.5 opacity). When one action sets off several motions, chain them, each starting as the one before lands (the image reaches the cart, then the badge bumps); never run them side by side. Stagger only the first 6 items of a list, 30–50ms apart; the rest arrive with the sixth. Why: the eye follows one thing; two motions at once split attention and neither lands.
- **Secondary action.** Only on top of a primary motion, never alone. It starts with the primary or up to 100ms after, ends within 150ms of it, and moves at most a third as much. Example: the check draws in, then a ring scales from 1 to 1.4 while fading out. Only in the "rarely" branch of step 1. Why: it backs the main action up; as soon as it's as big or as long, it competes with it.
- **Exaggeration.** Only where a moment must register: an error on submit, a failed attempt (wrong password, declined card), a first success. An error shake moves the field that's wrong through translateX 0, −10, 10, −6, 6, −3, 0px over 360ms, puts focus there, and shows the message beside it. Never on blur, and never on neutral transitions like opening a menu or switching tabs. Why: exaggeration is a volume knob; if everything is loud, nothing is.

## 3. How should it move?

### Timing

| What | Duration |
| --- | --- |
| Press, hover, color | 100–150ms |
| Tooltip, dropdown, popover | 150–200ms |
| Modal, drawer, sheet, toast | 200–300ms |
| Page transition, shared-element move, flip, something flying to a new place | 300–400ms |
| Rare, choreographed moment | up to 500ms per element |

Menus, popovers, modals, drawers and toasts stay under 300ms; only the spatial moves in the fourth row take longer. Exits are 20% shorter than entrances. Within a range, larger elements and longer distances take the longer end. If it feels slow, cut the duration before touching the curve. Why: duration is the feel; the same move feels sluggish at 500ms and instant at 150ms.

### Slow in and slow out

```
Driven by a gesture (drag, swipe, a sheet pulled by a finger, a thrown card)?
      → spring with no bounce: Motion { type: "spring", bounce: 0, visualDuration: 0.35 },
        or stiffness 400, damping 40, mass 1. Bounce up to 0.2 only for physical, playful objects.
Appearing or disappearing (popover, menu, modal, toast, page)? → ease-out: cubic-bezier(0.23, 1, 0.32, 1)
Moving or resizing while on screen?                           → ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)
Hover or color?                                               → ease, 150ms
Constant (spinner, marquee, a bar tied to real progress)?     → linear
```

Tap- and click-driven changes use CSS transitions, which retarget from where the element is when interrupted. Never ease-in for an entrance: the slow start reads as lag. Never linear for anything that starts and stops: real objects speed up and slow down.

### Arcs

When something travels between two points that differ on both axes by more than 40px (a product image flying to the cart, a thrown card, a floating button moving to a corner), move it on a curve. Put x and y on separate tracks (two nested wrappers in CSS), one ease-out and the other ease-in, cubic-bezier(0.55, 0, 1, 0.45). Or keyframe a midpoint 10–20% of the distance off the straight line. Single-axis moves (drawers, list reorders) stay straight. Why: thrown and falling things travel in arcs; a straight diagonal reads as mechanical.

### Anticipation

- A wind-up belongs to the "rarely" branch: before a launch the person sets off (confetti on a first success, a card sent off at the end of onboarding), move 5–10% of the travel the opposite way, or scale to 0.95, over 80–120ms, then go. Never before anything people do often, because the wind-up is added latency.
- The everyday form is the press. Buttons, icon buttons and chips scale to 0.96 on press (never below 0.95), 100ms ease-out, and back on release. Surfaces wider than 200px (cards, rows) change background instead, because 4% of a wide surface is a jump. Put the scale on a wrapper when the element already has a transform. Why: it confirms the press before the result arrives.

### Follow through

When a container stops, its contents settle a beat later. Drive the children with a softer spring than the parent (damping ratio 0.7–0.85) or start them 20–40ms after it, with overshoot under 4% of the travel. Use it on things that arrive or are released: drawers, sheets, the icon in a toast, a dragged card. Text never lags or wobbles, and frequent interactions never get it. Why: parts that all stop on the same frame read as one rigid sticker.

### Squash and stretch

Only for objects that behave physically: something that bounces, lands, or is dropped or caught (a dock icon, a badge landing, a drag-and-drop drop). Squash the shape, never the text in it. Stretch along the direction of travel at speed and squash on impact, by at most 15%, recovering within 150–200ms, and keep the volume: scaleX × scaleY ≈ 1 (scaleY 0.87 with scaleX 1.15). Never on inputs, layout containers, or anything read while it moves. Why: it shows weight and give; on rigid UI it looks broken.

### Pose to pose

Define the states (closed and open, idle and pressed and done) or keyframes at explicit offsets, and let the engine interpolate between them. Anything that can be interrupted uses transitions or springs, which retarget from where the element is; keyframe animations restart from 0%, so keep them for one-shot sequences. Write frame-by-frame code (straight ahead) only for motion driven live by input: drag, scroll, cursor. Why: poses make motion predictable, tunable in one place, and interruptible.

### Solid drawing

Anything that flips, tilts or turns gets real depth:

```css
.scene { perspective: 800px; }   /* 600–1000px at card size; lower values exaggerate the depth */
.card  { transform-style: preserve-3d; transition: transform 400ms cubic-bezier(0.77, 0, 0.175, 1); }
.face  { backface-visibility: hidden; }
.back, .card.flipped { transform: rotateY(180deg); }
```

Press feedback goes on `.scene`, so it never overwrites the rotation. Light it: an overlay that darkens the face turning away, up to 30% black at 90°, and a shadow that shrinks as the object lifts. Never fake a flip with `scaleX`. Why: without `perspective`, a rotation renders as a flat squeeze.

## 4. Can people hit it, choose it and read it?

### Fitts's law

The bigger and closer a target, the faster it's hit. The primary action is the largest target and sits nearest where the pointer or thumb already is: beside the field it submits, at the bottom of the screen on mobile. Destructive actions sit away from the primary action, so a miss can't trigger them. In a confirmation for a destructive action, Cancel takes the default focus, and the destructive button is never larger than Cancel and names the verb ("Delete address"). Menus and popovers open from their trigger. Targets are at least 44×44px on touch and 40×40px with a pointer.

### Hit area

When the visual has to stay small (16–24px icons, close buttons, checkboxes, slider thumbs), make the clickable zone bigger than it looks:

```css
.icon-button { position: relative; }
.icon-button::before { content: ""; position: absolute; inset: -10px; }
```

Size the inset so the zone reaches the minimums above. Where two zones would overlap, shrink both insets equally, never below 24×24px (the WCAG 2.2 floor); if they'd still overlap, space the items apart or move one action elsewhere. Icon buttons inside a clickable card sit above the card's link and stop the click from reaching it. When a whole row acts as one link, the whole row is the target. Why: people aim at the center and land near it, and a zone bigger than the visual absorbs the miss.

### Hick's law

Decision time grows with the number of choices. For options people weigh against each other (plans, sort orders, settings, onboarding choices), cut the ones few people pick, and keep each group to 7 or fewer under a heading, so people pick a group and then an item. Put search first when people already know what they want (command palettes, country and font pickers): that's a lookup, and search makes length irrelevant. One decision per step in onboarding and checkout. Mark one option as recommended only when you have a real recommendation, and never pre-select anything that costs money or shares data.

### Miller's law

Working memory holds a handful of items, so chunk anything people read, compare or type that runs past 5 units: card numbers by scheme (4-4-4-4, Amex 4-6-5), phone numbers in their national format, one-time codes as 3 + 3, long forms in sections of at most 5 fields, top-level navigation at 7 items or fewer. Fixed-pattern numbers format as people type. Never make people carry something from one screen to the next; show it where it's needed. Why: a chunk counts as one item, so 16 digits become 4.

### Postel's law

Accept messy input and give back one clean format. Parse every common form: dates ("15 jan 2026", "2026-01-15", "1/15/26" in the person's locale), phone and card numbers with spaces, dashes or brackets, emails with stray spaces or capitals, pasted values with trailing whitespace. Free-form values like dates are parsed on blur and shown back normalized ("Thursday, 15 January 2026"). Validate on blur or submit, never while someone is still typing a field for the first time; once an error shows, re-check on every keystroke so it clears the moment it's fixed. When parsing truly fails, keep what they typed and name the format that works, with an example. Never reject input you could have parsed. Why: a strict format moves your work onto the person.

### Jakob's law

People spend most of their time in other products, and expect yours to work the same way. Keep the conventions: the logo top-left links home; account and cart sit top-right; ⌘K or Ctrl+K opens the command palette; Esc closes the top layer; Enter submits a single-field form; swiping from the left edge goes back on iOS; a magnifier means search and a gear means settings; links look like links. Put the novelty in the content and the craft, not in where things live or what gestures do. If you must break a convention, teach it the first time and keep the conventional path working.

## Verify

- [ ] **Scrub** every animation at 10% speed (DevTools → Animations, or a frame-by-frame capture). The first frame responds, the last frame settles with no pop, and only one thing leads at a time.
- [ ] **Interrupt** each one halfway. It turns around from where it is.
- [ ] **Hammer the keyboard** through every list and shortcut. Nothing lags behind the keys.
- [ ] **Slow the network** to 1s or more. Presses register at once, nothing flashes a spinner under 300ms, and slow results show progress where they'll land.
- [ ] **Tap the edges** of every small target on a phone.
- [ ] **Paste messy input** into every field.
- [ ] **Reduced motion** (`prefers-reduced-motion: reduce`): movement becomes an opacity change of 150ms or less, and the information stays the same.
- [ ] **Properties:** movement and size changes use only `transform` and `opacity`; color and `stroke-dashoffset` are fine. Never animate width, height, top, left or margin; collapse a removed row with FLIP (measure, then animate the transform).

**Appeal** is what you get when everything above holds. You can't add it at the end, only fail to lose it. Final pass: one set of named curves and durations used everywhere; every state designed (empty, loading, error, success); nothing appears from nothing (enter from `scale(0.95)` and `opacity: 0`, never `scale(0)`).
