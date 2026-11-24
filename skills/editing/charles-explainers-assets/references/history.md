# History

Contents: The notes that set the rules · Design hacks part 2, three builds · Marks · The agent cursor · Words · The playful look · The 20 Psychology Principles run · Two skills become one · Gold

Where the rules in SKILL.md and the looks came from. Read it when a rule seems arbitrary or you're about to break one; never copy a line from it into a card. Video folders named here are in the claude-editing repository, with each video's own `DESIGN-LOG.md` when it has one.

## The notes that set the rules

- **Too busy** (the animation hacks, first version): graphs, lenses, onion skins and speed badges on every clip. Charles: "Graphics are too busy -> make them MUCH more simple. Viewers only see the screen for a brief time so make it simple (just the before/after component + the css)". Became the frame budget and its cut list.
- **Too little over time:** "The video isn't as engaging as I'd like it to be" (unslop repos), "The other deals are too boring when you show them" (Black Friday) and "Stale assets in the screen for too long ... should be avoided" (his note on this skill). Became Never stale and one asset per item, more for long lines.
- **A principle on its own** (the UX-principles mock, 13 Nov 2026): every card a single demo, so a wind-up read as a card moving. "It would've been better to have the before/after side by side for many of them to better understand the principle." Became the side by side for principles. For a fast list it was overruled on 23 Nov (The 20 Psychology Principles run).
- **Twin end poses** (the UX-principles rebuild): six motion principles held identical panels for up to 1.4 s, and both fresh reads called it the weakest part. Became the short side by side's end pose and second run (`forms.md`).
- **Small grey halves** (the animation-rules reel): grey stand-ins in small panels, labels too small to read.
- **A still before** (the first design-hacks reel): the voice named the problem while the picture waited. Became "the flaw happens by 0.6 s".
- **Dissolves** (the Day N reels): Charles had the dissolves between levels replaced with transitions. Became morph or fade-through, never a cross-dissolve.
- **Soft text** (1080-wide cards): small text looked soft in Photos. Became render at 2×.

## Design hacks part 2, three builds (22-23 Nov 2026)

1. A small grey component in the middle of a big grey card, with a fix that happened by itself: "The explainer assets are way too boring. Look at how the original video did it and make it much more engaging like that ... Include zoom ins/colours/agent cursors".
2. A real app in colour on every card, but a camera that punched in and pulled back on eight of ten, the agent editing the code on all ten, two wipes, and brackets that flipped from red to green: "make the transitions even better. It feels tacky at times I'm ngl ... make the graphics more visually interesting". A frame-by-frame critique named the camera first, then the wipes, the brackets and the cursor resting on the code it changed. Five things moved in the half second around the change on one card, and on three others nothing but the code and a bracket changed at all. The camera's zooms ran on the ease-in-out, which covers 63% of its distance in the middle fifth of its time: "the hard zoom cut he already dislikes, with soft shoulders".
3. Kept the colour and the cost and dropped the rest, in the playful look (`references/playful-flips.md`). The first critics' most wrong note: "on the change word the scene rewinds, or only the code moves" (receipts slid back, a field cleared and was typed again, read as the fix deleting what was typed). The second critics found the payoff 0.9 to 1.35 s after the word on six cards of ten: "the word is a subtraction or a label". One card's laptop window, mouse and phone, for a line about hover on phones, was "the busiest card with the smallest change", with 14 pt buttons; one tall phone with rows twice the size said it better. A fingertip-sized disc over a target's corner read as a tap on a dead button. The approved cards are `examples/playful-flips.jpg`.

What the third build's critics found about the look:
- Round 1 found eight of ten cards were "a white card over a dark pill on a grainy gradient, the screenshot-tool look; only 9 makes the object the interface". Card 9 was the toaster, and it scored 9 for interest where the sheet-only cards scored 4 to 5.
- A spot of light behind an interface read as "one radial blob", and behind a dark window as "a dark card on an indigo glow, the AI default".
- "The thin bar stops" was the weakest change on the best-looking card, which led to the toast that sinks into the toaster.
- Round 1's reads called the slip sliding back and the field clearing "loop seams".

## Marks (20 practical design tips, 16 Nov 2026)

- "There should also be better visual indicators showing the difference between before and after if we're not doing the two column layout (especially in the transitions between the before/after to make it more clear)". The first blind read missed the gray tint, the toast padding, the text tint and the stat gap.
- The first marked build: a red ring round a typed email read as "invalid email", hatching on a black button read as its colour, and dashed boxes read as drop zones.
- A first build of "keep body text regular" ended with green on the title, which didn't change, and nothing on the body, which did.
- A gray tint of 3 to 7 levels a channel showed nothing even under a sweep, and a stacking bug once left the one part that should change pixel-identical.
- Charles asked for "fake agent cursors that move components around".
- On design hacks part 2's second build, brackets round an event drew in while the pointer was still travelling and flipped to green a few frames after the fix.

## The agent cursor

- Charles asked for coloured cursors like Figma's.
- On design hacks part 2's second build the agent used the product and then edited the code on every card: up to five trips in 3.5 s, sitting on the code as it changed.
- The chip under a one-line code block fell outside the card on half the clicks, and on the first dark-mode card the chip sat on the row whose colour was the change.

## Words

- Design terms: the definitions ran at a median 30 characters a second, 17 of the 20 over 20, and the comment was "the texts go by too fast".
- The typography hacks' code was a one-line chip, about 22 px in the reel, with half the recipe.
- "Sorry the text contrast is bad" was the first line of the UX-principles caption: white text over a white wall.
- Before/After labels went from 30 to 24 px on 24 Nov 2026 (Charles: "Let's do 24px for labels"), to match the playful look, whose labels at 32 px had been as loud as the tab.

## The playful look

- Charles' first cards for 20 Psychology Principles were clean white UI side by sides: "Make the explainer graphics MUCH more interesting. Reference this reel and hill climb until we can make it like this" (22 Nov 2026), pointing at Tobi Donadon's article "How to Make Claude Design Like a Real Studio" and his Construct Design library.
- After five rounds of object metaphors: "try to use practical examples from mobile apps. Not ones that are too abstract. Think of what the best apps and games use like Monopoly Go, Duolingo, Candy Crush, etc. U can even recreate UI from iconic/well known apps to create a familiarity effect" (23 Nov 2026).
- On cards that recreated AI-built pages: "the graphics you rendered don't always look like the ai slop versions of them that people are used to. Try actually rendered instances of them popping up on actual websites when people vibecode a website with ai", then "as much as possible show real instances of the tells (like in our first video for ai tells)" (23 Nov 2026). That first reel, raw crops of pages four models built with the tell marked in red, had 474,291 plays.
- The kit lock: a re-render of an older project picked up the kit as it was that day and changed the finished cards' grain and colours, so `kit/playful/bundle.sh` writes `kit.lock` and refuses to rebuild against a changed kit. Run on 24 Nov 2026 against copies of real projects, it found design hacks part 2's bundled kit already different from the kit of that day.

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

The step that ran charles-unslop, emil-animations and charles-polish over every card (Charles asked for that pass on 23 Nov 2026) became the six checks in `looks/playful.md`, Steps: those skills' app-screen rules (body weights of 400-500, no gloss, sentence case) fought the recreated game screens and big display type, and the faults the pass actually caught were the six it now names.

## Two skills become one (25 Nov 2026)

The playful look was its own skill, charles-studio-explainers, from 22 to 25 Nov 2026, built on this one's renderer, checks and timing. Charles on merging them: "I mostly just wanted them to act in the same way where they provide additional visual feedback to whatever point I'm making on screen (before/after one after the other, before/after side by side, an example of what I'm saying, etc). But I wanted them to be different styles (one is more sleek/clean/minimalist with certain side effects like highlighting/agent cursors/targets, the other is more colourful and playful)."

What had drifted while they were two:
- This skill's gold sheet was design hacks part 2, made in the playful look, so its phone check ("smaller, emptier, busier or greyer") pulled clean cards toward colour worlds and grain.
- A principle in a fast list got a side by side here (13 Nov) and no Before there (23 Nov). Both looks now take the newer note.
- This skill's AI-tells list banned cream, gradient grounds and glows outright, which the playful look uses on its own terms.
- The motion hacks' contact sheet was tried as the clean look's gold on the day of the merge and dropped: its small components in wide grey bands are what "way too boring" meant. The practical design tips cards, with their marks and agent cursors, are the clean gold instead.
- The look was renamed playful the same day, at Charles' pick: "studio" was the reference article's word, and his own was "colourful and playful". Its kit's two code files keep their first names (`kit/playful/studio.js`, `studio-card.js`), so older projects' `kit.lock` files still match.
- The studio skill restated this one's rules and had to be kept in step by hand; its "hold the end pose with a living loop such as a bob" contradicted its own craft rule against a price that kept bobbing.

## Gold

- Design hacks part 1's contact sheet (`videos/design-hacks/design/assets/contact-sheet.jpg`) was the gold for colour and fill. It isn't copied into `examples/`, because it also carries what the skill now cuts: "01/10" numbering, verdict pills, a cream ground and a stand-in name.
- `examples/clean-marks.jpg` is the 20 practical design tips cards a moment before and after each change, rendered from `scenes/tips.js` with the kit's `check.mjs --times 3.9,5.4`. Card 11 is left out: its field still says "maya@northwin", a stand-in name Charles later ruled out.
- `examples/playful-flips.jpg` is design hacks part 2's approved build (the third), from its `check/phone.png`.
- `examples/playful-list.jpg` is four of the 20 Psychology Principles cards (round 6): the streak, the out-of-moves screen, the blurred likes and the prize wheel.
