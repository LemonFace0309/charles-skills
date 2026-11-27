# Recipes

Contents: [the curves](#the-curves) · [exit timing in CSS](#exit-timing-in-css) · [modal](#modal) · [drawer and sheet](#drawer-and-sheet) · [popover and dropdown](#popover-and-dropdown) · [tooltip](#tooltip) · [toast](#toast) · [entrances](#entrances) · [exits](#exits) · [expanders](#expanders) · [icon swaps](#icon-swaps) · [async buttons](#async-buttons) · [press](#press) · [number roll](#number-roll) · [progress bar](#progress-bar) · [sliders](#sliders) · [carousels](#carousels) · [theme switch](#theme-switch)

Values for the usual components, following SKILL.md: ease-out in and out, ease-in-out for moves on screen, exits 20–30% shorter than entrances, and only `transform`, `opacity` and blur under 20px animate (plus `grid-template-rows` for an expander). Every one is off under reduced motion. Keep the numbers and write them in the project's stack.

## The curves

```css
:root {
  --ease-out: cubic-bezier(0.32, 0.72, 0, 1);      /* entering and leaving */
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);  /* moving or resizing on screen */
}
```

There's no ease-in token on purpose: nothing in product UI uses one. In a Tailwind v4 project, read [curves](techniques.md#curves) before putting these in `@theme`.

## Exit timing in CSS

A transition runs with the timing declared on the state the element is heading to. So the open state carries the entrance's duration, and the closed (base) state carries the shorter exit. Every recipe below is written that way.

## Modal

220ms in, 160ms out, both on `--ease-out`: opacity 0 → 1 and scale 0.97 → 1 from its centre. The overlay fades on the same clock. Don't slide a modal in from off screen, grow it from nothing or bounce it: it interrupts people, so it arrives without fuss.

```css
.overlay, .modal {
  opacity: 0;
  pointer-events: none;
  transition-property: opacity, transform;
  transition-duration: 160ms;
  transition-timing-function: var(--ease-out);
}
.modal { transform: scale(0.97); }
.overlay[data-open], .modal[data-open] {
  opacity: 1;
  pointer-events: auto;
  transition-duration: 220ms;
}
.modal[data-open] { transform: none; }
```

Set `inert` on the modal while it's closed.

## Drawer and sheet

280ms in, 200ms out, on `--ease-out`, sliding all the way back to its edge, because where it goes is the point. The backdrop fades on the same timings, and the drawer's contents ride in with it as one piece. Use a transition, never keyframes, because people close drawers before they finish opening. A sheet people drag runs on a spring, `{ type: "spring", duration: 0.5, bounce: 0 }`, so it carries on at the speed the finger let go. A quick flick closes it even when it has barely moved: past a release velocity (distance over time) of about 0.1px/ms, dismiss it whatever the distance.

```css
.drawer { transform: translateX(100%); transition: transform 200ms var(--ease-out); }
.drawer[data-open] { transform: translateX(0); transition-duration: 280ms; }
```

Set `inert` on the drawer while it's closed.

## Popover and dropdown

160ms in, 120ms out: a fade, a scale from 0.95 and a 4px drift, growing out of the trigger. Arrow keys move the highlight inside it with no transition.

```css
.dropdown {
  transform-origin: var(--transform-origin, var(--radix-dropdown-menu-content-transform-origin, top));
  opacity: 0;
  transform: translateY(-4px) scale(0.95);
  transition-property: opacity, transform;
  transition-duration: 120ms;
  transition-timing-function: var(--ease-out);
}
.dropdown[data-open] { opacity: 1; transform: none; transition-duration: 160ms; }
```

## Tooltip

125ms in, 90ms out: a fade and a scale from 0.97, from the trigger. The first tooltip waits for the hover delay and animates. While one is open, the next opens with neither: Base UI marks that tooltip `data-instant`, and Radix gives it `data-state="instant-open"`. The open and close selectors below are Base UI's; with Radix, animate on `data-state`.

```css
.tooltip {
  transform-origin: var(--transform-origin);
  transition-property: opacity, transform;
  transition-duration: 125ms;
  transition-timing-function: var(--ease-out);
}
.tooltip[data-starting-style], .tooltip[data-ending-style] { opacity: 0; transform: scale(0.97); }
.tooltip[data-ending-style] { transition-duration: 90ms; }
.tooltip[data-instant], .tooltip[data-state="instant-open"] { transition: none; }
```

Without a library, put the delay on the open state only, so a closing tooltip never lingers, and keep one "warm" flag for the whole group. The group turns warm once a tooltip has shown and cools 300ms after the pointer leaves its triggers; while it's warm, tooltips skip the delay and the transition. Keyboard focus shows a tooltip at once.

```css
.tooltip {
  opacity: 0;
  scale: 0.97;
  transition: opacity 90ms var(--ease-out), scale 90ms var(--ease-out);
}
.has-tip:hover .tooltip {
  opacity: 1;
  scale: 1;
  transition-duration: 125ms;
  transition-delay: 600ms; /* on the open state only */
}
.has-tip:focus-visible .tooltip { opacity: 1; scale: 1; transition: none; }
.tips-warm .tooltip,
.tips-warm .has-tip:hover .tooltip { transition: none; }
```

```js
let cooling;
group.addEventListener("transitionend", (event) => {
  if (event.target.classList.contains("tooltip")) group.classList.add("tips-warm");
});
group.addEventListener("pointerover", () => clearTimeout(cooling));
group.addEventListener("pointerout", () => {
  cooling = setTimeout(() => group.classList.remove("tips-warm"), 300);
});
```

Gate the hover rule with `@media (hover: hover) and (pointer: fine)`, as SKILL.md says.

## Toast

240ms in, 170ms out, rising 16px from its screen edge with a fade, and leaving the same way. When toasts stack, the older ones move with `transform` on `--ease-in-out`, never by reflowing. Swiping one away uses a spring. A toast with an action (Undo, Retry) stays at least 5s, and its timer pauses while the pointer is over it or the tab is hidden.

```css
.toast {
  opacity: 0;
  transform: translateY(16px);
  transition-property: opacity, transform;
  transition-duration: 170ms;
  transition-timing-function: var(--ease-out);
}
.toast[data-open] { opacity: 1; transform: none; transition-duration: 240ms; }
```

## Entrances

Only for content that arrives on its own, never inside a container that's already moving. Don't move one wrapper; animate its pieces. A section's heading, copy and actions start 90ms apart, a hero headline goes word by word 80ms apart, and copies of one element start 40–70ms apart, the first 6 only. The softest entrance pairs a fade with an 8px rise and a 2px blur that clears.

```tsx
// Motion
const group = { shown: { transition: { staggerChildren: 0.09 } } };
const part = {
  hidden: { opacity: 0, y: 8, filter: "blur(2px)" },
  shown: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.35, ease: [0.32, 0.72, 0, 1] } },
};

<motion.section variants={group} initial="hidden" animate="shown">
  {pieces.map((p) => <motion.div key={p.id} variants={part}>{p.content}</motion.div>)}
</motion.section>
```

```css
/* CSS: give each piece its place in line, style="--order: 0", 1, 2… */
@keyframes arrive { from { opacity: 0; translate: 0 8px; filter: blur(2px); } }
.arriving > * {
  animation: arrive 350ms var(--ease-out) both;
  animation-delay: calc(var(--order, 0) * 90ms);
}
```

## Exits

A fade with a nudge of about 8px toward where it's going, plus a 2px blur if it looks abrupt, in about 150ms on `--ease-out`. A full slide off screen is only for things whose destination is the point (a closing drawer, a swiped-away card). When the leaving item has siblings (a list row, a toast in a stack, a tag), wrap them in `AnimatePresence mode="popLayout"`, so the rest close the gap with transforms while it leaves.

```tsx
<motion.li exit={{ opacity: 0, y: -8, filter: "blur(2px)", transition: { duration: 0.15, ease: [0.32, 0.72, 0, 1] } }} />
```

## Expanders

The one layout animation allowed: a one-cell grid whose row goes from `0fr` to `1fr`, which animates the content's real height without measuring it. Only the expanding element does this. It resizes in place, so it runs on `--ease-in-out`, 250ms open and 190ms closed.

```css
.expander { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 190ms var(--ease-in-out); }
.expander[data-open] { grid-template-rows: 1fr; transition-duration: 250ms; }
.expander > .inner { min-height: 0; overflow: hidden; }
```

Set `inert` on `.inner` while it's closed.

## Icon swaps

An icon that changes with state (play and pause, copy and check, like and liked) cross-fades into the next one, never a hard toggle:

- Scale 0.3 → 1. The old icon shrinks far as the new one grows, so one reads as becoming the other; a small change (0.8 or 0.9) looks like a flicker.
- Opacity 0 → 1, with the scale.
- Blur 2px → 0, which melts the halfway point into one shape instead of two stacked icons.
- A spring with no bounce, `{ type: "spring", duration: 0.35, bounce: 0 }`, because an icon isn't a toy.

```tsx
const swap = {
  away: { opacity: 0, scale: 0.3, filter: "blur(2px)" },
  here: { opacity: 1, scale: 1, filter: "blur(0px)" },
};

<AnimatePresence mode="popLayout" initial={false}>
  <motion.span key={done ? "check" : "copy"} variants={swap} initial="away" animate="here" exit="away"
    transition={{ type: "spring", duration: 0.35, bounce: 0 }}>
    {done ? <Check /> : <Copy />}
  </motion.span>
</AnimatePresence>
```

Without Motion, keep both icons in one grid cell and toggle a class on the button. Nothing unmounts, so the swap back animates too, and the cell never changes size:

```css
.swap { display: inline-grid; }
.swap > svg {
  grid-area: 1 / 1;
  transition-property: opacity, scale, filter;
  transition-duration: 250ms;
  transition-timing-function: var(--ease-out);
}
.swap > .next, .swap.done > .current { opacity: 0; scale: 0.3; filter: blur(2px); }
.swap.done > .next { opacity: 1; scale: 1; filter: none; }
```

Worth it on state toggles, actions that appear on hover, contextual toolbars and loading-to-done states; not on navigation icons that never change, or on text.

## Async buttons

States: idle → pending → success or error, plus retry and reset. Design the change between each pair, and build a dev-only page that shows every state, with a switch that forces the failure, so the error gets designed too.

- The button disables on press and keeps its size: the label, the spinner and the check share one grid cell, so a swap never changes its width.
- The spinner shows only after 300ms and stays at least 500ms once it shows.
- Each swap cross-fades both layers at once in 150ms, the leaving one shrinking to 0.9 as it fades and the arriving one growing from 0.9.
- Success swaps to the check. An error swaps back to the label and puts the message beside the button.
- Hide the inactive layers from screen readers (`aria-hidden`) and announce the result in an `aria-live` region.

```css
.async-button { display: inline-grid; }
.async-button > * {
  grid-area: 1 / 1;
  place-self: center;
  opacity: 0;
  scale: 0.9;
  transition: opacity 150ms var(--ease-out), scale 150ms var(--ease-out);
}
.async-button[data-state="idle"] > .label,
.async-button[data-state="pending"] > .spinner,
.async-button[data-state="success"] > .check { opacity: 1; scale: 1; }
```

```js
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The spinner appears only after 300ms, and once it appears it stays at least 500ms.
async function submit(button, action) {
  button.disabled = true;
  let spinnerSince = 0;
  const showSpinner = setTimeout(() => {
    button.dataset.state = "pending";
    spinnerSince = performance.now();
  }, 300);
  const settle = async () => {
    clearTimeout(showSpinner);
    if (spinnerSince) await sleep(Math.max(0, 500 - (performance.now() - spinnerSince)));
  };
  try {
    await action();
    await settle();
    button.dataset.state = "success";
  } catch (error) {
    await settle();
    button.dataset.state = "idle"; // and show the message beside the button
    throw error;
  } finally {
    button.disabled = false;
  }
}
```

## Press

The press rule from SKILL.md, with the opt-out built into the button:

```css
.button { transition: scale 150ms var(--ease-out); }
.button:active:not(:disabled, [data-dense]) { scale: 0.97; }
```

```tsx
// dense: toolbars and editor chrome, pressed all day, skip the scale
function Button({ dense = false, className, ...props }) {
  return <button data-dense={dense || undefined} className={cn("button", className)} {...props} />;
}
```

## Number roll

Roll only the digits that change, like an odometer. Each digit is a column of 0–9 inside a window one digit tall with `overflow: hidden`, moved with `translateY` on `--ease-in-out` over 300–400ms: upward when the value grows, downward when it shrinks. A carry from 9 to 0 keeps rolling the same way (end the column with a second 0). Set the number in `tabular-nums`, so its width never shifts. When the number follows a slider, roll a step each time the thumb crosses one. Screen readers get the final value once: the columns are `aria-hidden`, and a visually hidden copy of the value sits in an `aria-live="polite"` region. Under reduced motion, the digits swap.

## Progress bar

A step progress bar grows from its last value, never from 0: `transform: scaleX(value)` with `transform-origin: left` (never `width`), on `--ease-in-out` over 300ms. It never moves backward while a task runs, and once people have done something, it never reads 0%.

## Sliders

- The whole track is the target. The label and the value sit inside it, the value in `tabular-nums` or a monospace face so its digits hold still.
- A click snaps to the nearest 10% and springs there. A drag follows the pointer 1:1, with no easing.
- The thumb shows on hover or drag by growing out along its x axis, not by fading. When it crosses the label or the value, they fade and shrink aside, then spring back once it has passed.
- Hover or drag raises the track's brightness a little. Ticks every 10% show only on hover.
- Past 0 or 100%, after a small dead zone, the whole control stretches toward the pull with diminishing returns, and springs back on release ([rubber banding](techniques.md#rubber-banding)).
- A fast jump stretches the thumb along its travel ([squash and stretch](../SKILL.md#squash-and-stretch)).
- Holding the value for about 800ms turns it into a field for an exact number.
- Keyboard: `role="slider"` with `aria-valuenow`, `aria-valuemin` and `aria-valuemax`. Arrows move one step, Shift with an arrow or Page Up and Page Down move 10%, Home and End go to the ends. Reduced motion drops the spring and the stretch.

## Carousels

- A drag is 1:1; on release, a spring carries the velocity to the nearest item.
- In 3D, leave more room around the centre item than between the items behind it, so turned items never cut through each other, even mid-drag.
- Items fade with distance from the centre through their wrapper, never child by child ([cross-fades and groups](techniques.md#cross-fades-and-groups)).

## Theme switch

Switch transitions off for the frame the theme changes, then back on, so every colour lands at once instead of each fading at its own speed:

```css
.theme-changing,
.theme-changing *,
.theme-changing *::before,
.theme-changing *::after { transition: none !important; }
```

```js
const root = document.documentElement;
root.classList.add("theme-changing");
setTheme(next);
// Keep transitions off until the new colours have painted once, then turn them back on.
requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("theme-changing")));
```
