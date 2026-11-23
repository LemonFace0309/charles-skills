# Real instances

When a line claims something about what AI or a real product makes (a tell, a habit, a default), the card shows a page that really made it: a crop rendered from that page's own code, the tell put back onto it with one move, then marked in red. Never a recreation.

Why: Charles, 23 Nov 2026, on cards that recreated AI-built pages: "the graphics you rendered don't always look like the ai slop versions of them that people are used to. Try actually rendered instances of them popping up on actual websites when people vibecode a website with ai". Then: "as much as possible show real instances of the tells (like in our first video for ai tells)". That first reel (474,291 plays) was raw crops of pages four models built, with the tell marked in red. A recreation is a guess at the look, and the viewer is checking it against pages they've seen.

The worked example is in claude-editing: `videos/eradicating-ai-slop/slop-tells-2/explainers/`. It has `real/instances.mjs` (crops and states), `real/layers.py` (the cut-outs), `real/scan.mjs` (ranking candidates across a corpus), `scenes/src/20-real.js` (the cards) and round 4 of `DESIGN-LOG.md`.

## 1. Find the instance

Render pages you can keep: HTML the models built for the video, or a product's live page saved the day you film. Search their DOM for the tell by what it is, not by eye:
- a glyph (`↗`, `·`);
- a selector (`svg.lucide-sparkles`);
- a computed style (a left border wider than the top one, an animation named `ping`, a blur of 16 px or more);
- a pattern in a heading's text (two two-word sentences).

When there are several, render each with and without the tell and rank them by how much of the crop changes.

Take the first candidate that passes every check:
- **Big enough.** The tell is 20 px or more in the final frame. A 6 px dot needs a crop at about 3x.
- **True to the tab.** A tab that names a model ("GPT's favourite", "Claude loves it") gets that model's page, and a tab with a number gets an instance the number covers. Why: one card paired "Claude loves it" with a Gemini page, and a fact on screen that the picture under it contradicts is the very thing this reel mocks.
- **Out of place.** Not where the tell belongs: status dots on a status page, a coloured rule on a blockquote, cards on a dashboard. Why: there the viewer thinks "that's just how those look", and the line loses its point.
- **Not its neighbour.** Not the same page, or the same section, as the card before or after it.

## 2. Crop it

- Crop at the card screen's aspect: 834x314 inside the 18 px mat.
- Put every edge in a gap between lines of ink. Measure where each line's ink starts and ends on a render, because line boxes overlap in tight headings. Why: every crop set from element boxes cut through a line somewhere: a paragraph's tops along the bottom edge, a pill under the top edge.
- A crop may cut what carries on past the frame (a dashboard's side, the bottom of a tall card, a page scrolling). It never cuts a line of text through its letters, and never the tell.

## 3. Render the two states

Render both at the card's 2x size:
- **As built** (`b.png`).
- **The tell taken out** (`a.png`). How depends on the tell:
  - an element or glyph: `visibility: hidden`, so the page keeps its gap;
  - a border: its colour transparent;
  - a style, such as one italic word: set back to the line's own style;
  - a glow: only its own paint off (`background-image`, `box-shadow`, `::before` and `::after`), never its children;
  - a dither: the art blurred, as its smooth original.

Before either shot, stop every infinite animation and force every scroll reveal on, so both are the settled page. Then add:
- **The tell's states, when it moves.** A count-up gets about 10 frames from zero, eased out, the way the page's own counter runs.
- **A shot of each target alone, when targets overlap** (two lines of one heading). Why: otherwise one line's layer carries the next line's ascenders, and both show when it moves.

## 4. Cut the tell out

For each target, cut the pixels where `b.png` differs from `a.png` inside its box, softened by a pixel. On the page's own background the layer then lines up exactly. A target inside another (a code card inside a feature card) is left out of the outer one, with an 8 px margin, and arrives after it.

## 5. Put it back with one move

The tell starts arriving at 0.1 s and has landed by 0.5 s. Choose the move by what the tell is:

```
What is the tell?
├── A glyph or icon → thrown in from the side, or popped from 55% with a twist
├── A word, pill, card or line on its own → dropped into its gap
│   └── Lines stacked tight, or a word under another line → lifted 26-30 px from below (a drop crosses the line above)
├── A label → stamped down from 1.4x
├── A box drawn under copy (a card's background and border) → drawn open in place from its top-left corner
├── A border → drawn along its length
├── A style change → the new style fades up over the old one with a lean
├── A colour the whole page takes → painted across by an object (a roller)
├── A glow → spreading out from its centre
├── A count → stepped through its states, 0.045 s each
└── A scroll reveal → the page's own transition (on Sonnet's coffee page, 18 px and 0.8 s ease) under a short scroll that ends on the crop
```

A layer that moves carries the soft edge of whatever stays on the page under it. So a box under copy draws open where it stands: one that slid in doubled the copy inside it.

## 6. Mark it

Mark the tell the way the first reel did (its `tools/make_examples.py`):
- #ff2626 at about 4 card px, with square corners;
- a box, a rule under the tell, a ring, or an arrow from open space;
- never over a border, divider or shape that is itself the tell.

The mark snaps on 0.06 s after the tell lands. Leave it off when the move already points at the tell: a page changing colour, a glow spreading, a scroll, boxes drawing open, a row of cards dropping in.

Never ring a diagonal glyph. A red ring round ↗ reads as a "no" sign, so box it.

## 7. Frame it

- Set the crop in an 18 px mat of the card's colour, with the screen's corners at 12 px (the card's 30 less the mat). Why: AI pages are mostly near-black or white, so without the mat, neighbouring cards look like one.
- Grain goes on the mat only. The page is the evidence, so it stays as rendered.
