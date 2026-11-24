# The studio look

Contents: The slot and its words · The studio layer · Steps · Deliver

Every card still teaches its line in the second a phone viewer gets, and also looks like a studio made it: an idea you could say in one sentence, the real thing or a real-looking object acting it out, one colour family lit from a side, and one move a person would describe to a friend ("the anchor drops on the price", "a coin scratches off +40 XP"). Everything in SKILL.md applies; this file adds only what's this look's own.

Why: clean, correct UI side by sides didn't hold a scroll on my principles reels; a clear idea, a rich material and a move that lands do. A moment people have felt in an app they use (a streak about to reset, a prize wheel) reads faster than a clever metaphor. And when the line is about what AI makes, viewers judge a recreation against the real pages they've seen, so the card shows a real one. The rounds behind these rules are in `references/history.md`. After a context summary, re-read this file and the project's `DESIGN-LOG.md` too.

## The slot and its words

- **The studio term card:** a transparent 1080x480 clip at reel y 1080, with the card at x 80-950, y 1150-1500 (`references/slots.md`). On a card that flips in place (the hack-reel card), the look goes on the one stage: `references/studio-flips.md`. Where an object causes the flaw, its move is the mark; otherwise pick the mark with `references/marks.md`, as the clean look does.
- **Words:** the tab says what the principle means in plain words, on one line, inside SKILL.md's reading time (16 characters for a 1.2 s item, 22 at most). The words that carry the principle are 34 px or more in the final frame, and the Before and After labels are 24 px chrome that `L.stage` draws.

## The studio layer

`references/studio-craft.md` has each rule with its numbers and the reason for it. In short:

1. **The real thing first.** Walk this for every line:

   ```
   What is the line about?
   ├── What AI or a real product makes (a tell, a habit, a default)
   │   └── THE REAL INSTANCE: a crop of a page that really did it, rendered from its own code, the tell put back
   │       with one move, then marked in red (references/real-instances.md). Never recreate it
   ├── A principle people have felt in an app or game → recreate that moment, big (below)
   └── Neither → the real-world object that is a pun on it (below)
   ```

   **The real moment.** If people have felt the principle in an app or game, recreate that moment, big:
   - a streak about to reset, a daily prize wheel, a candy game's out-of-moves screen;
   - a board game's free dice gift, a dating app's blurred likes, a year-in-review card, the App Store's ratings card;
   - an iOS reminder and its notification.

   Use the app's own look (its type, its colours, its button style), without logos or mascots. Write the app's own copy, never a caption to the viewer. A person on the card is Charles (charles@example.com), never a stand-in like Maya, Noah or Sarah, which marks a screen as generated.

   **An idea before a template.** Only when there's no real moment to show, find the real-world object that is a pun on the principle:
   - an anchor for price anchoring, a wooden decoy duck for the decoy effect, a wax seal for commitment;
   - a scratch card for variable rewards, a candle burning down for a streak about to end, a candle frozen in ice for a streak freeze;
   - an instant photo developing for social currency.

   Say the card in one sentence before building it. If you can't, there's no idea yet.

   Never put a UI widget on the studio side (a checklist, a leaderboard, price rows, a score card, a share pill). Turn it into the object it stands for: a receipt that prints, game pieces on numbered steps, kraft price tags, an enamel pin you'd wear. Why: those widgets are what Claude builds by default, so they read as the default.
2. **Photographed materials, never game icons,** except inside a recreated game screen, where the game's own glossy icons (a gift, dice, a treasure chest) are the real thing. Generate each object as a studio product photograph, with real wear, on a transparent background (`references/studio-objects.md`). Why: glossy, toy-like 3D icons read as a mobile-game ad, while the reference's objects (a marble orb, a crystal prism, a card over a tile grid) look photographed.
3. **Lit, not pasted.** Each object gets:
   - its world's light on its lit side and its deep colour on the far side;
   - a cast shadow on the backdrop, and a contact shadow where it stands;
   - grain over the whole card, type and photos included (`L.obj`, `L.stage`). A real instance's page is the one exception: it stays as rendered, with grain on its mat only.

   Flames light their card and even the type beside them. Why: a photo set on a gradient without these reads as a stock PNG on a template: nothing sits in light.
4. **One colour family per card,** lit on its object, with the deep colour behind the type. Two or three cards in 20 stand on cream instead, with dark ink and one loud colour, and never black. Every word you must read passes 4.5:1. Why:
   - the stock violet, magenta and orange gradient is an AI tell;
   - the reference puts one loud hero on cream, and a set with no neutral ground tires the eye;
   - a near-black world turns the card into a hole on my black T-shirt;
   - a light behind the type put most white headlines at 2-4:1.

   **No two cards in a row share a colour.** Two light cards count as the same colour, whether white, grey, cream or a pale tint. Recreated app screens are often white, so when a white screen's neighbour is light too, put its panel on a coloured stage: a paywall on a savings green, the Calendar icon on its red. Run `kit/studio/neighbours.py` on the clips in list order. Why: each card replaces the last in the same slot, so a repeat reads as one card that changed its words.

   Brand colours: keep the hue, and use its deeper shade for words. A bright orange on white is 2.2:1, and #b85c00 is 4.5:1. White text on a bright game button gets a dark outline, the way games draw it.
5. **A light you can name, standing still.** Light each world softly from its object's side, and give every glow a source. Why: a pool of light that slid onto the After bleached the very numbers it pointed at, and read as AI glow rather than studio light.
6. **Few words, and a side by side is still one component twice.** A fast list has no Before (SKILL.md, Pick the form). A slower reel's principle card is `references/forms.md`'s side by side: the same component without the principle and with it, in two equal wells, both lit in the card's colour family, so the principle is the only difference. Why: the two looks act the same, and a plain default beside a studio object made the look a second difference (the Before tile of the 20 Psychology Principles' early rounds, dropped before anything shipped).
   - The After, or a fast list's card, says its point in three words or fewer, as the biggest type on the card, and some of its words are up by 0.3 s. Why: a phone viewer sees the card for about 1.4 s.
   - Numbers get a second voice:
     - thin numerals for prices and gaps;
     - dot-matrix for scores and counters;
     - mono for small print on receipts, tickets and tags.

     Why: one bold sans everywhere reads as a default.
   - Words keep 40 px inside the card's edges. The payoff (the seal, the prize) is always whole, and props drawn in code look as real as the photos: paper gets warm stock, grain and a curl shade.
7. **Four layouts across the set:**
   - the object beside its words;
   - type locked with the object (YOU with a crystal ball as its O, a shoe standing on the word "runner");
   - the object cropped big by the card's bottom or right edge;
   - the object carrying the words (a ticket, a stamp card, a calendar).

   Why: one composition 20 times reads as a template, and the reference's signature move is type and subject locked together (SPOTTED set behind a head).

   **Space a type lockup by eye, from the letters.**
   - The small line sits one cap height above the big word. Measure from the word's x-height when it's lowercase, because a lowercase word has no ascenders.
   - No two letters touch.
   - The object rests wholly on the letters.

   Why: spaced from the line boxes, "You're a" floated 88 px above "runner", tight tracking left its letters all but touching, and half the shoe hung past the last r.
8. **One signature move, built from Disney's principles:**
   - a wind-up before the pop;
   - a squash on landing;
   - follow-through after it: a swing that settles, coins that arc, a page that tears away.

   Rigid things (iron, brass, a coin, wood) never squash: they fall, stop and rock. The move lands by 0.6 s and then holds still, except where real life moves (a flame's flicker, a gear still turning). Why: a price that kept bobbing after it landed read as unfinished.
9. **The tells to refuse:**
   - Tobi's four default looks: the paper edition, the black launch page with a purple glow, the KPI dashboard and the dark dev tool, except as the real instance a card is showing;
   - game icons and stock gradients;
   - glows with no source, and objects with no shadow;
   - giant faint words that repeat the label;
   - anything clipped by the card's edge, crossing the "After" label, or resting against the top edge, which the tab covers on a long line. Bring things in from the right or the bottom where you can; only a fast drop (an anchor) comes through the top, and it's gone from the edge in a few frames.

## Steps

These replace SKILL.md's Build step and add to its checks.

1. **Read the reference,** if I gave one. Write down what it does in plain terms: the ideas, the materials, the light, the colour, the type and the moves. Save its images in the project's `research/reference/` and keep them out of git: they're other designers' work.
2. **Add to the beat sheet** each line's idea: the object or moment, the move and the colour family.
3. **Explore three directions,** rendered side by side on two or three lines, before building all of them (`references/studio-hill-climb.md`). One of them can be your own synthesis.
4. **Render the real instances** for the lines that have them (`references/real-instances.md`), then **generate the objects** for the rest with `kit/studio/fal_gen.py` and look at each one on a mid colour. Make every changed state of an object (a happy plush and a sad one, a candle and the candle in ice) with the edit endpoint from the first image, so the two match. Measure each object's visible bounds with `kit/studio/bbox.py` before you place it.
5. **Build** with `kit/studio/studio.js` on the kit's renderer, one file of builders per few cards in `scenes/src/`, joined by `kit/studio/bundle.sh <project>` (add `--no-card` when the project brings its own card for another slot, as design hacks part 2's `99-card.js` does for the hack-reel card). The bundle locks the project to the studio kit it was built with (`kit.lock`): a later bundle refuses when the kit has changed since, and says which files did. Pass `--update-kit` only when you mean to take the new kit, then compare an untouched card against the last export. Why: re-rendering an old project with today's kit changes its finished cards even when nothing in the project changed.
6. **Hill-climb.** Render stills at 0.3 s and at the end pose, sheet them over my footage (`kit/studio/sheet.sh`), and have a fresh critic score them against the reference. Fix the biggest problem first, re-render, look again, and log every round in the project's `DESIGN-LOG.md`.
   - Stop at the bar I named, or when three rounds in a row don't raise the score.
   - Fix by eye too. Collisions, clipped text and blow-outs show up on the sheets before any critic sees them.
7. **Check every card for the six faults that reach finished cards,** and fix what fails:
   - **Names and copy.** A person is Charles (charles@example.com) and a screen carries the app's own copy, never a stand-in name or a caption to the viewer. Why: a stand-in name marks the screen as generated, and a caption breaks the recreation.
   - **Entrances from nothing.** Nothing scales in from 0: start from 0.95 or more, or travel in. The one exception is a real instance's tell, which pops from 55% because its arrival is the event (`references/real-instances.md`, step 5). Why: real objects always have a shape, and a pop from nothing reads as cheap.
   - **Springs that overshoot more than 30%.** Keep `L.spring`'s c at 0.72 × √k or more: its default (k 260, c 18) overshoots 12%, and the approved cards ran k 300-500 with c 14-20. Rigid things don't squash at all. Why: more overshoot turns a material into a toy.
   - **Numbers that roll more than changed.** Only the digits that change roll (`roller`), the old digit up and out, the new one up and in, over 0.2 s. Why: rolling every digit hides which part changed.
   - **Dead frames mid-move.** Read each move frame by frame from the rendered clip (`references/studio-craft.md`, Motion): no stretch inside it where nothing moves, done by 0.6 s, then only real-life motion on top of the push-in. Why: a pause inside a move reads as a stutter.
   - **Collisions.** Nothing crosses a label, the tab's corner, the card's edge or another object by accident, at any frame, including the end of the push-in. Why: an accidental overlap reads as a bug.

   Why this list and not a whole UI pass: rules made for app screens (body weights of 400-500, no gloss, sentence case everywhere) fight recreated game screens and big display type, so the pass checks only what a card needs.
8. **Run the phone check** (SKILL.md) and `kit/studio/neighbours.py` over the clips in list order, then deliver.

## Deliver

On top of SKILL.md's hand-over:

- every clip of the studio term card with alpha at 2x for the edit (`render.mjs` writes ProRes 4444), and VP9 with alpha at 1x for the plan page;
- `explain.json` with each line's tab, takeaway and source;
- the generated objects in `gen/`, with `gen/jobs.jsonl` saying the model, the prompt and the date;
- `DESIGN-LOG.md` with each critic round's scores and what it changed;
- `kit.lock`, so a later re-render uses the same kit or says it can't.
