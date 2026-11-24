---
type: llm
---
card.css and card.html plant nine detail problems, each with a known fix:
1. `.card` uses `transition: all 0.6s ease-in`: name the properties, about 150ms, ease or ease-out, never ease-in alone.
2. `.card:hover` scales the card: no hover scale on cards (a color or surface step), and hover gated to (hover: hover).
3. `.card:hover` changes font-weight to 700: never change weight on hover, because it reflows text.
4. `.label` is #a3a3a3 on a light card: about 2.4:1, under 4.5:1.
5. `.count` animates a number without tabular-nums, so its width jiggles.
6. `.btn` is 28px tall: under the 44px touch minimum (40px desktop); extend the hit area, for example with a pseudo-element.
7. `.btn:focus` removes the outline: keep a visible focus ring with at least 3:1 contrast.
8. `.btn:active` presses to scale(0.85): press at about 0.96, never below 0.95.
9. `.modal` enters from scale(0), on a keyframe: enter from about 0.95 with opacity, ease-out, under 300ms; use a transition so it can be interrupted.
(A tenth, the z-index of 9999 on the toast, counts as a bonus finding.)

PASS if the review finds at least 7 of the 9 with a concrete fix matching the known fix, gives each finding a severity and a file:line or selector as evidence, and doesn't edit the files.
FAIL otherwise.
