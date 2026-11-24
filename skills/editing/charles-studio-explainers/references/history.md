# History

Contents: Why the skill exists · The 20 Psychology Principles run · Design hacks part 2 · The notes that set the rules

Where the rules came from. Read it when a rule seems arbitrary or you're about to break one; never copy a line from it into a card. Video folders named here are in the claude-editing repository, each with its own `DESIGN-LOG.md`.

## Why the skill exists

- Charles' first cards for 20 Psychology Principles were clean white UI side by sides: "Make the explainer graphics MUCH more interesting. Reference this reel and hill climb until we can make it like this" (22 Nov 2026), pointing at Tobi Donadon's article "How to Make Claude Design Like a Real Studio" and his Construct Design library.
- After five rounds of object metaphors: "try to use practical examples from mobile apps. Not ones that are too abstract. Think of what the best apps and games use like Monopoly Go, Duolingo, Candy Crush, etc. U can even recreate UI from iconic/well known apps to create a familiarity effect" (23 Nov 2026).
- On cards that recreated AI-built pages: "the graphics you rendered don't always look like the ai slop versions of them that people are used to. Try actually rendered instances of them popping up on actual websites when people vibecode a website with ai", then "as much as possible show real instances of the tells (like in our first video for ai tells)" (23 Nov 2026). That first reel, raw crops of pages four models built with the tell marked in red, had 474,291 plays.

## The 20 Psychology Principles run (22-23 Nov 2026)

Directions tested:
- d1, Night Widgets: a dark stage with glowing gradient tiles;
- d2, Object Studio: a colour field, a giant number behind and 3D game objects;
- d3, Lit Phones: two phones and a spotlight;
- d4, a synthesis: a colour world per card, a graphite Before tile and an object doing the move.

Round 1 rejected d3 as unreadable and d2's game objects. Round 2 compared d4, the critic's own proposal (d5, a cobalt stage with lit widgets) and d6, photographed objects, one colour family and a landing light. d6 became the system.

Closeness to the reference, out of 10, each from a fresh critic:
- Round 1: d1 5, d2 4, d3 3.
- Round 2: d4 3, d5 4, d6 5.
- Round 3 (d6 with its critic's fixes, on all 20): 4.5.
- Round 4 (lit objects, four layouts, cream grounds, three-word Afters): 4. Its sub-scores rose (instant read 5 → 6, principle clarity 6 → 6.5, system 6 → 7), while craft held at 4 and the moves fell from 5 to 4.
- Round 5 (objects instead of UI widgets, thin, dot-matrix and mono type for numbers, plain Befores): 4. Craft rose from 4 to 5 and the instant read from 6 to 7, while closeness held.
- Round 6 came from Charles' notes instead of a critic: no Before in a fast list, real app and game moments instead of object metaphors, well-known principle names, no generic names, and a pass of charles-unslop, emil-animations and charles-polish. "This is much better" was round 4; round 6 is what he asked for next. Round 6b fixed back-to-back colours.

What each round's critic named as the single most wrong note, in order: game icons (they "read as a mobile-game ad"); a pool of light sliding onto the After that bleached the numbers it pointed at; "nothing sits in light" (photos set on a gradient with no light, shadow or grain); a default UI loader; an After that was only a louder version of its Before (an alarm clock answering "Daily reminder" with a louder reminder).

Other findings that became rules: 20-30 words a card, and five cards with an object but no words at 0.3 s (round 3); one bold sans everywhere and the thin numerals on the plain side (round 4); a light tan Before tile on cream cards reversing "dark box = Before" (round 5); labels at 32 px as loud as the tab (round 3); an anchor ring cut flat at the top read as the tab slicing it (round 3); six blues in one set (round 3); a price that kept bobbing after it landed (round 2); a speed streak crossing into the Before tile; a stamp lifting on a curve that didn't exist, falling back to ease-out and gone in two frames; an SVG turbulence grain tile that measured under one level on colour and 0.0 on white, so for three rounds the cards had no grain at all; Chrome failing a screenshot mid-render and leaving the old clip in place (round 4b's first re-render shipped nothing).

After round 6, Charles called "You're a runner" weird spacing: "You're a" floated 88 px above the word, -0.045em left its letters all but touching, and half the shoe hung past the last r. And, 23 Nov 2026: "don't have back to back same colours". Round 6 had put a lime Wrapped card before the lime runner, and four pairs of white or pale cards in a row.

The step that ran charles-unslop, emil-animations and charles-polish over every card (Charles asked for that pass on 23 Nov 2026) became the six checks in SKILL.md step 7: those skills' app-screen rules (body weights of 400-500, no gloss, sentence case) fought the recreated game screens and big display type, and the faults the pass actually caught were the six it now names.

## Design hacks part 2 (23 Nov 2026)

- Round 1's critic found eight of ten cards were "a white card over a dark pill on a grainy gradient, the screenshot-tool look; only 9 makes the object the interface". Card 9 was the toaster, and it scored 9 for interest where the sheet-only cards scored 4 to 5.
- A spot of light behind an interface read as "one radial blob", and behind a dark window as "a dark card on an indigo glow, the AI default".
- Round 1's most wrong note: "on the change word the scene rewinds, or only the code moves". Round 2's: "payoff a second late".
- "The thin bar stops" was the weakest change on the best-looking card, which led to the toast that sinks into the toaster.
- Round 1's reads called the slip sliding back and the field clearing "loop seams".

## The notes that set the rules

- Before/After labels at 24 px: kept on 24 Nov 2026 when charles-explainers-assets' labels came down from 30 to match ("Let's do 24px for labels").
- The kit lock: a re-render of an older project picked up the kit as it was that day and changed the finished cards' grain and colours, so `bundle.sh` now writes `kit.lock` and refuses to rebuild against a changed kit. Run on 24 Nov 2026 against copies of real projects, it found design hacks part 2's bundled kit already different from the kit of that day.
