# Craft

Contents: The idea · Real app moments · The stage · Type · Motion · The tells

The playful look, rule by rule, with the numbers that worked on the 20 Psychology Principles cards and the reason for each. When the claude-editing repository is present, its gold is `videos/app-psychology/explainers-v2/`: `scenes/src/80-apps-a.js` and `85-apps-b.js` hold the 20 builders, and `DESIGN-LOG.md` records how each rule was earned. `history.md` has the rounds.

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

- **The test:** someone could describe the card to a friend in one sentence. If the sentence is "a nicer screen", there's no idea yet. And the After must change the thing the principle changes: an alarm clock that answered "Daily reminder" with a louder reminder missed implementation intentions, which are about adding a time and a place.
- **Never a UI widget in the After.** A checklist, a leaderboard, price rows, a score card, a share pill or a frosted panel is what Claude builds by default, so on the playful side it reads as the default. Turn it into the object it stands for: the checklist into a receipt that prints, the leaderboard into game pieces on steps, plan rows into price tags, a share button into a pin you'd wear.

## Real app moments

When the line is about apps, show the moment it fires in one people already use. The 20 Psychology Principles set:

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
- **Write the app's copy, never a caption to the viewer:** "Resets in 2:59:58", "Billed $39.99 once a year", "Time for Spanish". A person in it is Charles (charles@example.com), never a stand-in like Maya.
- **Contrast:** keep each brand's hue and take its deeper shade for words (Duolingo orange #b85c00, Tinder-like gold #9a6b00, iOS red #d70015, iOS blue #0062cc). Game buttons keep white text with a 2 px dark outline (`-webkit-text-stroke` with `paint-order: stroke fill`), which `words.mjs` can't measure, so check it by eye.
- **Numbers roll only the digit that changes** (`roller` in the 20 Psychology Principles cards): the old digit up and out, the new one up and in, over 0.2 s. A countdown ticks at real seconds.
- **Show the outcome after the cause:** the price lands after the strike, the notification after the reminder is set, the dice after the lid.

## The stage

- **The card:** 870x350, radius 30, with the scene as its own background (no white frame). The black tab sits on its top-left edge, inset 22 px, in Helvetica Neue Bold 30. On a long line the tab covers the whole top edge, so objects at rest bleed off the bottom or the right edge, never the top: an anchor ring cut flat at the top read as the tab slicing it. Bring moving things in from the right or the bottom too (the running shoe comes in toe first from the right); only a fast drop comes through the top.
- **A side by side** (a slower reel's principle): `forms.md`'s two equal wells, both lit in the card's family, the same component in each. The early rounds' Before tile (a 270 px default beside the playful After) is gone: it made the look a second difference, and a graphite block on every colour read as a dead black third.
- **The labels:** "Before" and "After" in Inter 650 at 24 px, on one line at y 36: chrome the viewer learns by position. At 32 px they were as loud as the tab.
- **Nothing crosses a label:** content starts below the Before and After labels (y 76 or lower near them). Keep every word 40 px inside the card's edges, and keep the payoff (the prize, the seal) whole.
- **Words:** the After says its point in three words or fewer ("Built by you", "Fresh start", "See who else"), and some of its words are on screen by 0.3 s. Why: 20-30 words a card can't be read in 1.4 s, and a card with no words at 0.3 s shows an object without its point.
- **Four layouts, rotated through the set,** so the eye isn't handed one template 20 times:
  - the object beside its words;
  - type locked with the object, the reference's SPOTTED move: YOU with a crystal ball as its O, a shoe standing on the word "runner", a flame lighting the streak number;
  - the object 1.5x larger, cropped by the card's bottom or right edge (gears, a coffee cup, a block of ice);
  - the object carrying the words: a ticket, a pledge, a stamp card, a calendar, a review card, a Polaroid.
- **Colour:**
  - One family per card: a single saturated base, lit softly from the object's side, falling off to the deep colour at the far corner (`L.fam(light, mid, deep, at)`), with soft-light grain at 0.2.
  - Rotate families so neighbours never share one. The 20 used tangerine, blue night, teal, coral, green, sky, mustard, crimson, ocean, deep lime, hot pink, caramel, mint, cobalt, peach, ice, emerald, cherry, electric blue and chartreuse.
  - **Never two light cards in a row,** whether white, grey, cream or a pale tint: on a phone they read as the same colour. Recreated app screens are often white, so a white screen whose neighbour is light too goes on a coloured stage. A working order: purple, white, green, sky, red-orange, yellow, indigo, mint, periwinkle, dark green, white, royal blue, iOS grey, red, teal, amber, navy, white, pink, lime, with a paywall panel on a savings green, a plan picker on deep indigo, the Calendar icon on its own red, a league badge on navy and a Wrapped card in bubblegum pink.
  - **Check it with `kit/playful/neighbours.py <clips dir>`.** It reads each card's stage from a 22 px band just inside the card's edges, because that's what changes when a card swaps in. A white panel or a giant word in the middle can't fool it. It flags any card within 0.1 of the one before in OKLab, which caught white then white (0.000), white then iOS grey (0.038) and grey then pale mint (0.039). The closest pair it passed was mint then periwinkle, at 0.22. The most common colour on the card is the wrong measure: a paywall read as white and a runner card as the word's ink.
  - Never a two-blob mesh, never the violet, magenta and orange mix, and never a world darker than its family's mid colour.
  - **Cream for two or three cards in 20** (`L.cream()`): dark ink and one loud colour (a cobalt price, a pink call to action, a red headline). The reference puts one loud hero on cream, and 20 colour worlds with no neutral ground tire the eye. Never black: the card sits on my black T-shirt.
  - No more than four of one hue family in a set, spread apart.
- **Contrast:**
  - Put the light on the object (the After's centre-left, `at` about '46% 58%') and let the deep colour fall in behind the type on the right (`deepAt` '100% 92%').
  - Mix the base toward its deep colour (`color-mix(in oklch, mid 64%, deep)`).
  - On a naturally bright family (mustard, chartreuse), use dark ink for the After's words and label instead (`{ deepAt: null, ink }`).
  - Then run the kit's `words.mjs --only <ids> --times 0.6,1.2`. Every must-read word passes 4.5:1, or it isn't done. It can't measure two effects, so measure those from the pixels: a gradient clipped to the glyphs (it reads 1:1), and dot-matrix type (it averages the dots with the gaps, reading 4.37:1 for dots that sit at 9.5:1). Why: lit from the upper right behind the type, most white headlines sat at 2-4:1.
- **Light every object (`L.obj`).** A photo cut out and set on a gradient reads as a stock PNG, with nothing sitting in light. So each object gets:
  - the world's light colour on its lit side and the world's deep colour on its far side, both masked to its own shape (soft-light and multiply);
  - a cast shadow on the backdrop, down and to the left, since every prompt puts the key light upper right;
  - a contact shadow where it stands on something, which fades and shrinks as it leaves the floor.
- **Grain over everything,** photos and type included, so the photos, the paper and the colour read as one print: `L.grain` at 0.3 overlay on a colour, and on cream or white its light tile multiplied at 0.55 (`L.stage` does both). At 0.2 soft-light under the content, nobody could see it.
- **Measure the grain, don't trust it.** Take a flat patch of a still and read its standard deviation: real grain is 3-8 levels (`L.stage` gives 3-8 on a colour and 3 on cream). An SVG turbulence tile once measured under one level on colour and 0.0 on white, so the cards had no grain at all for three rounds. Overlay can't darken white, which is why light worlds multiply. A real instance's page gets none (`real-instances.md`).
- **Light sources light things.** A flame lights its card with a flickering warm pool (`L.flameLight`), and it can light type too: a radial gradient centred on the flame, clipped to the glyphs, dims as the flame gutters.
- **The light stands still.** The world is lit from the object's side, and each glow has a source (a candle, a crystal ball).
  - Never slide a glowing pool across the card: it bleached the numbers it pointed at and read as AI glow.
  - Never use plus-lighter on white paper or faces. It blows them out.
- **Depth:**
  - Objects bleed off the card's bottom or right edge where they can, like the gears cropped by the corner and the ice block cut by the floor.
  - Something resting on the floor gets a soft contact shadow, and paper and cards get a two-layer shadow.
  - Paper drawn in code (`L.paper`) gets warm stock, grain at 0.16 and a curl shade, so it stands next to the photos.

## Type

- **The principle's words are the biggest type on the card:** Inter Tight 800 at 40-104 px, tracked -0.045em ("46-day streak", "$0.16 a day", "You're a runner now").
- **A word set huge (150 px or more) goes no tighter than -0.02em.** Tracking in em scales with the type, so the gaps keep the same proportion at every size. At 214 px, though, -0.045em left "runner"'s r and u, and its two n's, all but touching. At 245 px and -0.02em the tightest gap is 7 px, from the r's flag to the u; the rest run 12-20 px, and none touch.
- **A lockup is spaced from the letters, not the line boxes.** "You're a" over "runner": the small line's baseline sits about one of its cap heights above the big word's x-height (34 px for a 54 px line, whose caps are 39 px). A lowercase word has no ascenders, so its line box carries about 0.39 em of empty space above the letters, and spacing from the boxes left 88 px. Set both in the same face. Let the small line's Y overhang the big word's stem by about 2 px, so its diagonal looks flush. The object rests wholly on the letters: the shoe's heel ends where the r's flag ends. Its run-in hop stays low (16 px), so the heel never meets the card's top edge.
- **Both wells of a side by side set their copy the same way;** only the principle differs.
- **Give numbers a second voice:** thin numerals (Inter 250) for prices and gaps, dot-matrix (Doto) for scores and counters, and mono (JetBrains Mono) for small print on receipts, tickets and tags. Why: one bold sans everywhere reads as a default. Skip the serif with an italic accent word: it's one of Tobi's four default looks.
- **Use dot-matrix type (Doto) only at 48 px or more.** At 24 px it reads as noise.
- **Measure every line against its box before you trust it.** Unmeasured lines clipped "/mo", "a day" and a countdown at the card's edge.
- **Tabular figures only on a number that changes** (`L.T(..., { tnum: true })`). In running text Inter's tnum sets hyphens and punctuation on the figures' width: "Control - plane".
- **Draw every arrow and symbol as an icon** (`L.icon`), never type it. A glyph the bundled fonts lack falls back to a thin system face: the kit's fonts have → but no ↗, and a tab of "Claude →, GPT ↗" mixed the two weights.
- **Place anything that sits in a line of text from its baseline.** An empty inline-block's bottom edge sits on the baseline, and an interpunct centres 0.29 em above it. Placed from the line box's top, dots between words floated at the x-height.

## Motion

- **Physics first:** rigid things (iron, brass, a coin, a clock) never squash. They fall, stop and swing once on a dying sine (the anchor: 4.5° × e^(−6t) × sin(16t)). Soft things (felt, paper, wax) may squash a little.
- **Use Disney's principles on purpose:**
  - a wind-up (a shake or squash, 0.06-0.3 s) before a pop;
  - a squash on landing (`L.drop`);
  - springs for follow-through (`L.spring`, k 300-500, c 14-20);
  - arcs for anything thrown (coins, a result card leaving a gift).
- **The move is done by 0.6 s, then holds still.** Only real-life motion carries on (a flame's flicker, a gear still turning), on top of the 1.2%-a-second push-in on the whole stage. A price that kept bobbing after it landed read as unfinished.
- **Keep transient effects inside their own well.** A speed streak that crossed into the Before read as a bug, so clip effects to their lane.
- **Use only curves that exist.** The kit's are `E.linear`, `E.out`, `E.inOut`, `E.cssEase`, `E.cssOut`, `E.cssInOut`, `E.mInOut`, `E.move`, `E.travel` (anything a hand moves, and a zoom; SKILL.md) and `E.quadIn`. There is no `E.in`: before `L.P` learned to throw on an unknown curve, a stamp lifting on `E.in` quietly fell back to ease-out and was gone in two frames.
- **To draw a stroke on** (a signature, a scratch), give the path `pathLength="1"` and `stroke-dasharray="1 2"`, then run `stroke-dashoffset` from 1 to 0. With `"1 1"`, a round cap leaves a dot at the end of the path before it's drawn.
- **Read every move frame by frame from the rendered clip,** not only from stills: pull frames 0.1 s apart through the move (`ffmpeg … select='between(n,16,31)',tile=4x4`). Both bugs above passed the still checks. Check every clip is newer than the bundle first: when Chrome fails a screenshot mid-render, the kit leaves the old clip in place, and a filtered log can hide the failure.

## The tells

Refuse each of these on sight:

- **Game-icon objects:** glossy, chunky, candy-coloured.
- **Tobi's four default looks:** a serif headline with one italic accent word and mono labels; a black page with a purple glow and a tilted screenshot; four KPI cards with sparklines; the dark dev tool.
- **Paint:** stock gradients, and glows with no source.
- **Words:** a giant faint word that repeats the label, words clipped by an edge, and copy that crosses a label.
- **Motion:** in a side by side, a move in one well that the other doesn't make, besides the principle itself.
