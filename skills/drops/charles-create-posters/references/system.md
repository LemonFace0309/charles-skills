# The system

Measured from Quartr's 2026 posters' full-size files (NVIDIA, Nu, Tesla, Hermès). `kit/template/system.css` holds
every number here, so a poster built from the template is on-system before you touch it. Change a number only for a
reason you can name.

What goes on the picture is decided by the tree in SKILL.md: the logo alone by default, the user's own words when they
gave some, the event lines only for an event poster they asked for.

## Canvas

- **2520 × 3360 px, 3:4 portrait.** X shows 3:4 uncropped in the timeline, so the whole poster is seen.
- Built as a 1260 × 1680 CSS px page rendered at 2x. All CSS numbers are half the poster's pixels.

## Type

- **One face, one size, one weight.** Inter Display (Inter at optical size 32), weight 580, 24 px (48 px on the
  poster, 1.9% of the width), line height 30 px, tracking −0.018 em. This reproduces the NVIDIA poster's line widths
  within 1% and its stroke weight within 2%. The template sets it; never add sizes.
- **No headline.** The picture is the headline. Two exceptions: when the words are the art (Uber's quote, Meta's
  motto), and a title the user asked for, set in `.title` (44 px CSS, weight 560) bottom left or sideways.
- **Ink:** on near-black grounds, a mid grey from #656565 to #6b6b6b, deliberately quiet (NVIDIA). On paper, the
  brand's near-black (#261d2b for Nu). On a brand colour, black or the ground's darkest tone (Rollins, Verisign), or
  white at 90% when the ground is dark (Tesla, Meta). Type reads at full size and nearly disappears at phone size.

## The logo (every poster)

- **Where:** top left on the margin (`data-layout="top"`, the template's place) when the top of the picture is quiet;
  bottom left (`bottom`) when the subject fills the top; centred in the quiet middle (`centre`) when the picture is a
  frame or symmetric. Never across the subject.
- **How big** (`--logo-h`, CSS px): a mark beside a word (NVIDIA's eye) 31; a capitalised wordmark 21–24; an
  all-lowercase wordmark 30; a symbol beside a mixed-case word (Spotify's) 36–38; a round badge or seal with lettering
  in it 38–42; a solid badge (a filled box with the name inside, IKEA's) 32–36. Why: these give each kind the visual weight of one line of 24 px type, which is as loud as the logo
  should be. Judge the result by eye at 100% and nudge `margin-top` when a logo's box includes a dot or a descender.
- **Contrast:** on most posters the logo is the only name, so its ink stays at 3:1 or more against the ground behind
  it (NVIDIA's grey on black is 3.2:1), and 4.5:1 for a badge with fine lettering. `render` measures it. Why: quiet
  is the point, but a logo nobody can find leaves the picture without its subject.
- **Which logo:** the subject's own (Alphabet, not Google; Darden, not Olive Garden), except where a company and its
  famous brand share a name, when it's the famous mark (the Coca-Cola script).
- **Brand colours** come from the subject's own site or brand page (its stylesheet, its press kit), never from a logo
  file on Commons, which often carries an old colour. When the site refuses automated requests (a 403 or a
  maintenance page), open it in a browser if you have one, or take the colours from its press kit or brand guide.
- **Logos are real files, never drawn.** `logo "<Company>"` fetches the logo Wikidata lists from Wikimedia Commons.
  Commons often keeps one from before a rebrand (an old wordmark the company's own guide now forbids), so compare it
  at 100% with the logo in the subject's site header or brand guide, and when they differ take theirs with
  `logo --url` (or another Commons file with `--file`). A site's logo file is sometimes an icon sheet of symbols,
  which draws nothing on its own: `logo --url` lists them, and `--symbol <id>` takes one out as its own file.
- **The mask:** `.mark` turns any file into a flat silhouette in the ink colour. White in the file counts as paper (a
  white box behind the logo and white details are knocked out), empty padding is trimmed so `--logo-h` is the ink's
  height, and a ® or ™ that sits apart at the top right comes off (it prints as a speck; `data-logo-keep-marks` keeps
  it). `render` says when it did any of these. A logo whose inner detail is a colour rather than white (a wordmark on
  a coloured badge) still masks into a solid blob: take the one-colour file with `logo --url`, or name the colour
  that should read as paper with `data-logo-knockout="#ffdb00"` (IKEA's yellow oval, so its blue box keeps the oval
  as a window onto the ground), or use `data-logo-color="original"`.

## Words the user gave (only when they gave them)

Set exactly their words in the one size, in `.copy` blocks in the template's columns (`<p class="copy a">` in column
A, `<p class="copy b">` in column B), broken by sense with `<br>`: three lines a block at most, each line under 24
characters. Add nothing they didn't write: no date, time, tagline or call to action. When their words don't fit three
lines, shorten the breaks, never the type, and ask before cutting a word of theirs. `render` flags orphans, blocks
over three lines and lines that run into the next column.

## Event posters (only when asked)

A lockup and two short sentences, measured on the NVIDIA poster. `new <folder> --event` starts from this.

```
On Tuesday, Nov 17,              Listen live and read
NVIDIA will host its             along on Margin
Q3 FY2027 earnings call.         at 05:00 PM ET.
```

(Quartr's own NVIDIA poster breaks "Q3 / FY2027"; keep the pair together, and let `render` move column A for the
long line: here `--colA: 648px`.)

- **Sentence one** says what happens and when: "On {Weekday}, {Mon} {D}, {Company} will host its {quarter}
  earnings call." Other events: "...its Q3 2026 trading update.", "...its CMD 2026.", "On Monday, Oct 26, 2026
  Anthropic filed its S-1 ahead of its Nasdaq listing under ANT."
- **The quarter** exactly as the company writes it in its release: Q3 FY2027 for NVIDIA (its fiscal year runs ahead
  of the calendar), Q3 2026 for most, Q2 FY2026 for retailers whose year ends in January. Get it from the press
  release that announced the call, never from memory.
- **The year** in the date only when the call falls in a different year from the quarter it reports (a Q4 2026 call
  in February 2027 says "Feb 4, 2027"). The year makes the first line too long for column A, so the column moves
  left, as Quartr does on its Dollar Tree poster: `render` measures the line and prints the `--colA` that fits
  (630–650 px). A date without a year is checked against the next time it comes round; pass `--year` only when
  that's wrong.
- **Sentence two** is the publisher's real offer and the time, in the publisher's own words: "Live on…", "Listen on…",
  "Read the transcript on…". Never claim a feature they don't have, and never borrow Quartr's line ("Streamed &
  transcribed in real time on…"). With no publisher, "Live at 05:00 PM ET." and the lockup is the subject's logo alone.
- **The time** gets tabular figures and a slashed zero: wrap it in `<span class="time">05:00 PM ET</span>`. Slash
  zeros only in the time, which reads as data, never in dates or years, which read as prose; a slashed zero anywhere
  else looks like a mistake. Zero-pad the hour and add a zone: US companies' times convert to ET (NVIDIA announces
  2:00 PM PT; the poster says 05:00 PM ET); European companies keep their own zone (CET, or CEST in summer; BST); give
  both when the audience is split ("08:00 AM ET / 02:00 PM CET").
- **Never split a pair across a line break:** a quarter and its year ("Q4 2026", "Q3 FY2027") or a date and its
  year ("Feb 25, 2027") stay on one line. Quartr's own posters slip here ("Q3 / 2026"), and a sharp reader sees it as
  junior work; `render` flags it.
- **Each line under 24 characters.** A longer publisher name pushes "at" onto its own line: shorten the words, never
  the type. When the facts and the line length disagree, the facts win: keep the company's own quarter label and the
  right date, and cut a soft word instead ("December quarter call" for "December quarter earnings call").
- **The lockup:** publisher | subject, in the ink colour: the publisher's wordmark with a 21 px cap height, 21 px of
  space, a 2.5 × 32 px rule, 21 px of space, then the subject's logo at the sizes above. The two names weigh the same
  and their visual centres line up. The subject may come first when its name is the bigger draw (Hermès, Rollins,
  Verisign did this). The publisher's wordmark is their SVG if they have one
  (`<span class="mark publisher" data-logo="logo/publisher.svg">`), else their name set in `.wordmark` (Inter 640,
  caps, +6% tracking). Never Quartr's name or wordmark.

## Layouts

Put the logo and any words where the picture is quiet, on the margins, and never across the subject. Pick by the
picture:

| `data-layout` | Logo and words go | Use when | Seen on |
| --- | --- | --- | --- |
| `top` | logo top left, any words top right | the subject sits low, the top is empty | NVIDIA, Rollins |
| `bottom` | logo bottom left, words bottom right | the subject sits high, the bottom is empty | Tesla, Verisign |
| `split` | logo top left (on an event poster: publisher top left, subject top right), words along the bottom | a full-bleed pattern or a centred subject | Dollar Tree, Meta Q2 |
| `centre` | stacked in the middle | the picture is a frame or a symmetric pattern with a quiet middle | Nu |
| `edge` | read upward along the left edge | the picture needs the full height, or it's a page-in-page | BlackRock, Palantir Q2 |
| `band` | an unpainted paper band at the bottom | painted, printed or drawn pictures | Hermès |
| `frame` | the picture inside a border in the brand colour; logo and words in the bottom border | type walls and graphic panels | Verisign |

Write your own when the idea needs it (Meta Q4 2025 runs its words along the infinity loop with an SVG `textPath`),
but keep the type at the system size and on the margins or on the drawing.

The picture doesn't have to bleed. `system.css` has three helpers: `.place` sets a photo into the field at a position
and width you choose, `.burn` darkens towards the edges around a point like a darkroom burn, and `.lift` on
`.picture` stops anything going darker than `--black` (#111 by default), because image models put out pure #000 and
a printed poster never reaches it.

## The 2025 look (event posters, only when asked)

The 2025 posters used Quartr's older system: the publisher's logo top left, the company's logo top right, and three
small columns along the bottom ("Ferrari Q3|25 / earnings call", "Tuesday / Nov 04, 2025", "9:00 AM ET / live on
Quartr"), sometimes stacked down the left (McDonald's, Dole). Use it only when someone asks for that look, with their
own publisher in Quartr's place.

## Finish

| `data-grain` | Use for | Measured on |
| --- | --- | --- |
| `film` | photographs, dark grounds | NVIDIA's blacks: σ ≈ 4/255, 2–3 px clumps |
| `paper` | flat colour, pixels, type, prints, paintings | Nu's paper: σ ≈ 3/255 with embossed tooth |
| `none` | clean CGI on pure black | Tesla |

Film grain was measured on black. Left to itself it eases area by area, from 1 on near-black and grey to 0.55 on
bright, saturated colour (a dusk navy sky takes 0.66, a red sweep 0.55), where the same specks read as salt and
pepper; `render` says when it eased it, and `data-grain-amount` sets one even strength yourself.

`data-dust` (0 to 1) adds specks and hairs. Use it only when the picture is meant to look like scanned film
(0.15–0.35); on a clean studio shot, dust reads as dirt a retoucher would have removed. The grain sits over the type
too, as on a scanned print. Each poster gets its own grain and dust pattern from its words; set `data-seed` only to
repeat a render exactly.
