# History

Contents: The notes that set the rules · Design hacks part 2, three builds · Marks · The agent cursor · Words · Gold

Where the rules in SKILL.md came from. Read it when a rule seems arbitrary or you're about to break one; never copy a line from it into a card. Video folders named here are in the claude-editing repository, with each video's own `DESIGN-LOG.md` when it has one.

## The notes that set the rules

- **Too busy** (the animation hacks, first version): graphs, lenses, onion skins and speed badges on every clip. Charles: "Graphics are too busy -> make them MUCH more simple. Viewers only see the screen for a brief time so make it simple (just the before/after component + the css)". Became the frame budget and its cut list.
- **Too little over time:** "The video isn't as engaging as I'd like it to be" (unslop repos), "The other deals are too boring when you show them" (Black Friday) and "Stale assets in the screen for too long ... should be avoided" (his note on this skill). Became Never stale and one asset per item, more for long lines.
- **A principle on its own** (the UX-principles mock, 13 Nov 2026): every card a single demo, so a wind-up read as a card moving. "It would've been better to have the before/after side by side for many of them to better understand the principle." Became the side by side for principles.
- **Twin end poses** (the UX-principles rebuild): six motion principles held identical panels for up to 1.4 s, and both fresh reads called it the weakest part. Became the short side by side's end pose and second run (`forms.md`).
- **Small grey halves** (the animation-rules reel): grey stand-ins in small panels, labels too small to read.
- **A still before** (the first design-hacks reel): the voice named the problem while the picture waited. Became "the flaw happens by 0.6 s".
- **Dissolves** (the Day N reels): Charles had the dissolves between levels replaced with transitions. Became morph or fade-through, never a cross-dissolve.
- **Soft text** (1080-wide cards): small text looked soft in Photos. Became render at 2×.

## Design hacks part 2, three builds (22 Nov 2026)

1. A small grey component in the middle of a big grey card, with a fix that happened by itself: "The explainer assets are way too boring. Look at how the original video did it and make it much more engaging like that ... Include zoom ins/colours/agent cursors".
2. A real app in colour on every card, but a camera that punched in and pulled back on eight of ten, the agent editing the code on all ten, two wipes, and brackets that flipped from red to green: "make the transitions even better. It feels tacky at times I'm ngl ... make the graphics more visually interesting". A frame-by-frame critique named the camera first, then the wipes, the brackets and the cursor resting on the code it changed. Five things moved in the half second around the change on one card, and on three others nothing but the code and a bracket changed at all. The camera's zooms ran on the ease-in-out, which covers 63% of its distance in the middle fifth of its time: "the hard zoom cut he already dislikes, with soft shoulders".
3. Kept the colour and the cost and dropped the rest. The first critics' most wrong note: "on the change word the scene rewinds, or only the code moves" (receipts slid back, a field cleared and was typed again, read as the fix deleting what was typed). The second critics found the payoff 0.9 to 1.35 s after the word on six cards of ten: "the word is a subtraction or a label". One card's laptop window, mouse and phone, for a line about hover on phones, was "the busiest card with the smallest change", with 14 pt buttons; one tall phone with rows twice the size said it better. A fingertip-sized disc over a target's corner read as a tap on a dead button. The approved cards are `examples/gold-cards.jpg`.

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
- Before/After labels went from 30 to 24 px on 24 Nov 2026 (Charles: "Let's do 24px for labels"), to match charles-studio-explainers, whose labels at 32 px had been as loud as the tab.

## Gold

- Design hacks part 1's contact sheet (`videos/design-hacks/design/assets/contact-sheet.jpg`) was the gold for colour and fill. It isn't copied into `examples/`, because it also carries what the skill now cuts: "01/10" numbering, verdict pills, a cream ground and a stand-in name.
- `examples/gold-cards.jpg` is design hacks part 2's approved build (the third), from its `check/phone.png`.
- `examples/gold-marks.jpg` is the 20 practical design tips cards a moment before and after each change, rendered from `scenes/tips.js` with the kit's `check.mjs --times 3.9,5.4`. Card 11 is left out: its field still says "maya@northwin", a stand-in name Charles later ruled out.
