# Craft

The studio look, rule by rule, with the numbers that worked on the 20 Psychology Principles cards (22 Nov 2026) and the reason for each. The gold is `videos/app-psychology/explainers-v2/` in claude-editing: `scenes/src/80-photo-a.js` and `85-photo-b.js` hold the 20 builders, and `DESIGN-LOG.md` records how each rule was earned.

## The idea

- **Each card is one object and one move, a pun on the principle:**

  | Principle | Object | Move |
  | --- | --- | --- |
  | Price anchoring | A cast-iron anchor tagged "$119.88" | It drops to the floor and rocks on its flukes; the tag is struck and $59.99 a year lands beside it |
  | Decoy effect | A carved decoy duck | It paddles onto the 6-month plan |
  | Commitment | A brass stamp | It presses a wax seal onto the pledge |
  | Variable rewards | A coin | It scratches off "+40 XP" |
  | Loss aversion | A candle burning low | It gutters |
  | What-the-hell effect | A candle | It freezes in ice, still lit |
  | Fresh start | A tear-off calendar | Thursday's page tears off to Monday |
  | IKEA effect | Birch blocks engraved with the Before's own list (Sleep, Focus, Calm) | They drop and stack: "Built by you" |
  | Endowed progress | A printed practice card of ten stamps | The first two are already inked |
  | Barnum effect | A crystal ball | It stands in for the O in a giant YOU |
  | Identity-based habits | A running shoe | It lands on the word "runner", set huge as the ground |
  | Social currency | An enamel TOP 2% pin | It drops in, clicks down and a glint runs across it: "You'd post this" |
  | Reciprocity | A kraft gift | Its lid pops off and the score rises out of the box |
  | Labor illusion | A thermal receipt | It prints up out of the card's edge, a line of work at a time, ending on "Your plan" |
  | Curiosity gap | A card in an envelope | It slides halfway out: one name shows, the next is cut off by the envelope |
  | Social comparison | Meeples on numbered steps | You hop up to the step just below the person above you |

- **The test:** someone could describe the card to a friend in one sentence. If the sentence is "a nicer screen", there's no idea yet. And the After must change the thing the principle changes: round 5's alarm clock answered "Daily reminder" with a louder reminder, when the principle (implementation intentions) is about adding a time and a place.
- **Never a UI widget in the After.** A checklist, a leaderboard, price rows, a score card, a share pill or a frosted panel is what Claude builds by default, so on the studio side it reads as the default (round 4's critic). Turn it into the object it stands for: the checklist into a receipt that prints, the leaderboard into game pieces on steps, plan rows into price tags, a share button into a pin you'd wear.

## Real app moments (round 6)

When the line is about apps, show the moment it fires in one people already use. The 20 Psychology Principles set, after Charles' 23 Nov notes:

| Principle | The moment | Its move |
| --- | --- | --- |
| Variable rewards | A daily prize wheel | It winds back, spins, the flapper ticks over each peg as it slows, and lands on +500 coins |
| Loss aversion | A Duolingo-style 46-day streak | The flame gutters while "Resets in 2:59:58" ticks |
| Price anchoring | A paywall | $119.99 first, struck, then $59.99 a year and Save 50% |
| Reciprocity | A board game's free gift | The box shakes, the lid pops, dice tumble out: +50 rolls, Collect |
| FOMO | A limited-time chest offer | The countdown ticks through its last minute |
| IKEA effect | An avatar builder | Hair, glasses and a hoodie fly from their chips onto the face, then Saved |
| Decoy effect | A three-plan picker | 6 months at $59.99 makes 12 at $69.99 a steal; the selection moves there |
| Commitment | Hold to commit | The ring fills, closes into a disc, and the disc draws a check |
| Sunk cost fallacy | A candy game's out-of-moves screen | 1 jelly left, +5 moves for 9 gold bars |
| Endowed progress | A coffee app's rewards stars | 2 of 10 stars, a welcome gift |
| Curiosity gap | A dating app's likes grid | Eight blurred photos, 24 likes, See who likes you |
| Framing effect | A paywall's per-year / per-day toggle | $39.99 a year becomes $0.11 a day, billed once a year |
| Loading the next trigger | A reminder time picker | The wheels spin to 8:00 PM, then the 8 PM notification arrives |
| Fresh start effect | The iOS calendar icon | Thursday the 20th flips to Monday the 24th: New week |
| Tamagotchi effect | An egg-shaped virtual pet | Its hearts drain and the pixel face turns sad: Hungry |
| Scarcity | A board game's dice | The last roll goes, the dice grey out, free rolls in 59:59 |
| Status | A league badge | Gold becomes Diamond as it jumps |
| Social proof | The App Store's ratings card | 4.8, the bars fill, 2.1M ratings |
| Social currency | A Wrapped-style card | Top 2% of listeners, Share to story |
| Identity-based habits | A running shoe | It lands on the word "runner" |

- **Recreate the look, not the brand:** the app's colours, type and button style, but no logos, mascots or real event names. Glossy game icons are right inside a game's own screen.
- **The app's own type:** 'SF Pro Text', 'SF Pro Display' and 'SF Pro Rounded' by name (the Duolingo-like rounded heavy), with 'Arial Rounded MT Bold' behind it. In headless Chrome on macOS, `-apple-system` and `ui-rounded` fall back to a serif, quoted or not.
- **Write the app's copy, never a caption to the viewer:** "Resets in 2:59:58", "Billed $39.99 once a year", "Time for Spanish". Never generic names like Maya.
- **Contrast:** keep each brand's hue and take its deeper shade for words (Duolingo orange #b85c00, Tinder-like gold #9a6b00, iOS red #d70015, iOS blue #0062cc). Game buttons keep white text with a 2 px dark outline (`-webkit-text-stroke` with `paint-order: stroke fill`), which `words.mjs` can't measure, so check it by eye.
- **Numbers roll only the digit that changes** (`roller` in the 20 Psychology Principles cards): the old digit up and out, the new one up and in, over 0.2 s. A countdown ticks at real seconds.
- **Show the outcome after the cause:** the price lands after the strike, the notification after the reminder is set, the dice after the lid.

## The stage

- **The card:** 870x350, radius 30, with the scene as its own background (no white frame). The black tab sits on its top-left edge, inset 22 px, in Helvetica Neue Bold 30. On a long line the tab covers the whole top edge, so objects at rest bleed off the bottom or the right edge, never the top: round 3's anchor ring, cut flat at the top, read as the tab slicing it. Bring moving things in from the right or the bottom too (the running shoe comes in toe first from the right); only a fast drop comes through the top.
- **Before:** a flat tile at x 18, y 18, 270 wide, in the card's own colour: `color-mix(in oklch, <deep> 62%, rgb(52 54 60))`, or warm dark brown `#3b342c` on cream, with a hairline highlight. It's dark on every card: viewers learn "dark box = Before", and a light tan tile on the cream cards reversed it (round 5's critic). It holds one element, what Claude builds by default, in plain Inter at 26 px or more: a bare number, one button, a short list. As the After plays, it dims to about 78%. A graphite block on every colour read as a dead black third (round 2), and three toasts or a stats list was more than a 1.4 s read allows (round 3).
- **The labels:** "Before" and "After" in Inter 650 at 24 px, on one line at y 36: chrome the viewer learns by position. At 32 px they were as loud as the tab (round 3).
- **After:** the rest of the card, from x about 318. Nothing may cross the "After" label, so start the After's content at y 76 or below near x 316-420. Keep every word 40 px inside the card's edges, and keep the payoff (the prize, the seal) whole.
- **Words:** the After says its point in three words or fewer ("Built by you", "Fresh start", "See who else"), and some of its words are on screen by 0.3 s. Round 3 had 20-30 words a card, and five cards showed an object and no words at 0.3 s.
- **Four layouts, rotated through the set,** so the eye isn't handed one template 20 times (round 3's critic: "one composition, 20 times"):
  - the object beside its words;
  - type locked with the object, the reference's SPOTTED move: YOU with a crystal ball as its O, a shoe standing on the word "runner", a flame lighting the streak number;
  - the object 1.5x larger, cropped by the card's bottom or right edge (gears, a coffee cup, a block of ice);
  - the object carrying the words: a ticket, a pledge, a stamp card, a calendar, a review card, a Polaroid.
- **Colour:**
  - One family per card: a single saturated base, lit softly from the object's side, falling off to the deep colour at the far corner (`L.fam(light, mid, deep, at)`), with soft-light grain at 0.2.
  - Rotate families so neighbours never share one. The 20 used tangerine, blue night, teal, coral, green, sky, mustard, crimson, ocean, deep lime, hot pink, caramel, mint, cobalt, peach, ice, emerald, cherry, electric blue and chartreuse.
  - Never a two-blob mesh, never the violet, magenta and orange mix, and never a world darker than its family's mid colour.
  - **Cream for two or three cards in 20** (`L.cream()`): dark ink and one loud colour (a cobalt price, a pink call to action, a red headline). The reference puts one loud hero on cream, and round 3's critic found no neutral ground in 20 colour worlds. Never black: the card sits on my black T-shirt.
  - No more than four of one hue family in a set, spread apart (round 3 had six blues).
- **Contrast:**
  - Put the light on the object (the After's centre-left, `at` about '46% 58%') and let the deep colour fall in behind the type on the right (`deepAt` '100% 92%').
  - Mix the base toward its deep colour (`color-mix(in oklch, mid 64%, deep)`).
  - On a naturally bright family (mustard, chartreuse), use dark ink for the After's words and label instead (`{ deepAt: null, ink }`).
  - Then run the explainer kit's `words.mjs --only <ids> --times 0.6,1.2`. Every must-read word passes 4.5:1, or it isn't done. It can't measure two effects, so measure those from the pixels instead: a gradient clipped to the glyphs (it reads 1:1), and dot-matrix type (it averages the dots with the gaps, reading 4.37:1 for dots that sit at 9.5:1). The first round-3 pass, lit from the upper right behind the type, put most white headlines at 2-4:1.
- **Light every object (`L.obj`).** A photo cut out and set on a gradient reads as a stock PNG: round 3's critic called "nothing sits in light" the most wrong note. So each object gets:
  - the world's light colour on its lit side and the world's deep colour on its far side, both masked to its own shape (soft-light and multiply);
  - a cast shadow on the backdrop, down and to the left, since every prompt puts the key light upper right;
  - a contact shadow where it stands on something, which fades and shrinks as it leaves the floor.
- **Grain over everything,** photos and type included, at 0.34 overlay (0.26 on cream), so the photos, the paper and the colour read as one print. At 0.2 soft-light under the content, nobody could see it.
- **Light sources light things.** A flame lights its card with a flickering warm pool (`L.flameLight`), and it can light type too: a radial gradient centred on the flame, clipped to the glyphs, dims as the flame gutters.
- **The light stands still.** The world is lit from the object's side, and each glow has a source (a candle, a crystal ball).
  - Never slide a glowing pool across the card. In round 2 it bleached the numbers it pointed at, and the critic called it the single most wrong note.
  - Never use plus-lighter on white paper or faces. It blows them out.
- **Depth:**
  - Objects bleed off the card's bottom or right edge where they can, like the gears cropped by the corner and the ice block cut by the floor.
  - Something resting on the floor gets a soft contact shadow, and paper and cards get a two-layer shadow.
  - Paper drawn in code (`L.paper`) gets warm stock, grain at 0.16 and a curl shade, so it stands next to the photos.

## Type

- **The principle's words are the biggest type on the card:** Inter Tight 800 at 40-104 px, tracked -0.045em ("46-day streak", "$0.16 a day", "You're a runner now").
- **Before copy is plain Inter:** 300 for big numbers, 600-650 for headings. It should look like the default it is.
- **Give numbers a second voice:** thin numerals (Inter 250) for prices and gaps, dot-matrix (Doto) for scores and counters, and mono (JetBrains Mono) for small print on receipts, tickets and tags. Keep the Befores in plain regular weight (400-500), so the refined type belongs to the After. Round 4's critic found one bold sans everywhere and the thin numerals all on the plain side. Skip the serif with an italic accent word: it's one of Tobi's four default looks.
- **Use dot-matrix type (Doto) only at 48 px or more.** At 24 px it reads as noise.
- **Measure every line against its box before you trust it.** The first passes clipped "/mo", "a day" and a countdown at the card's edge.

## Motion

- **Physics first:** rigid things (iron, brass, a coin, a clock) never squash. They fall, stop and swing once on a dying sine (the anchor: 4.5° × e^(−6t) × sin(16t)). Soft things (felt, paper, wax) may squash a little.
- **Use Disney's principles on purpose:**
  - a wind-up (a shake or squash, 0.06-0.3 s) before a pop;
  - a squash on landing (`L.drop`);
  - springs for follow-through (`L.spring`, k 300-500, c 14-20);
  - arcs for anything thrown (coins, a result card leaving a gift).
- **The move is done by 0.6 s, then holds still.** Only real-life motion carries on (a flame's flicker, a gear still turning), on top of the 1.2%-a-second push-in on the whole stage. A price that kept bobbing after it landed read as unfinished (round 2).
- **Keep transient effects inside the After.** A speed streak that crossed into the Before tile read as a bug, so clip effects to the After's lane.
- **Use only curves that exist.** The kit's are `E.out`, `E.inOut` and `E.quadIn`. There is no `E.in`, and before `L.P` learned to throw on an unknown curve, a stamp lifting on `E.in` quietly fell back to ease-out and was gone in two frames.
- **To draw a stroke on** (a signature, a scratch), give the path `pathLength="1"` and `stroke-dasharray="1 2"`, then run `stroke-dashoffset` from 1 to 0. With `"1 1"`, a round cap leaves a dot at the end of the path before it's drawn.
- **Read every move frame by frame from the rendered clip,** not only from stills: pull frames 0.1 s apart through the move (`ffmpeg … select='between(n,16,31)',tile=4x4`). Both bugs above passed the still checks. Check every clip is newer than the bundle first: when Chrome fails a screenshot mid-render, the kit leaves the old clip in place, and a filtered log can hide the failure (round 4b's first re-render shipped nothing).

## The tells

Refuse each of these on sight:

- **Game-icon objects:** glossy, chunky, candy-coloured.
- **Tobi's four default looks:** a serif headline with one italic accent word and mono labels; a black page with a purple glow and a tilted screenshot; four KPI cards with sparklines; the dark dev tool.
- **Paint:** stock gradients, and glows with no source.
- **Words:** a giant faint word that repeats the label, words clipped by an edge, and copy that crosses a label.
- **Motion:** anything moving in the Before half of the card.
