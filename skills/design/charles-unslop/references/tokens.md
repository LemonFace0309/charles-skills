# Tokens

Contents: Spacing scale · App layout · Neutral ramps · Status colours · Accent · Buttons · Type · Radius · Icons · Depth · Motion

Starting values for each pass. When the project already has a good system, keep its values and only fix how they are used. These are starting points, not a house style, so let the direction move them.

## Spacing scale

4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128

- Inside a control: 4 to 12
- Between related items, like rows in a list: 2 to 8
- Between groups, like a label and its list or two cards: 12 to 24
- Between sections: 32 to 64, landing sections 80 to 128
- Row heights: 32 compact, 36 default, 40 to 44 touch
- Hero: 96 to 128 from the navigation to the headline on desktop, 48 to 64 on mobile

## App layout

- Sidebar 240 to 280 wide, content fluid with page padding 24 to 32, capped around 1440 to 1600.
- Top bar or page header 56 to 64 tall.
- Navigation rows 32 to 36, gap 2 to 4, section labels 24 above and 8 below.
- Stat cards in a row share one height, usually 3 or 4 compact cards per row on desktop, numbers only.
- The main chart spans at least two thirds of the content width and is 280 to 360 tall. A second data block next to it is a list or table, narrower, not another chart.

## Neutral ramps

Build one ramp in OKLCH from the world in the direction. Three numbers set it:

- **H, the tint:** the hue of the world's main material, the same on every role. Paper, wood, food, craft and skin sit near H 60 to 85. Night, sky, water and anything technical sit near H 250 to 270. A world with no material of its own gets graphite: any H at C 0.004 or less, which reads as grey.
- **C, how much tint:** 0.003 (graphite) to 0.014 on dark surfaces, 0.002 to 0.006 on light ones, and up to 0.02 on text. Never above 0.02 on a surface, so a surface never reads as a colour of its own. Light surfaces get less, because the same chroma shows more near white.
- **L, per role**, from this table. The steps are what make cards and raised rows read without borders.

| Role | Dark L | Light L |
| --- | --- | --- |
| Deepest surface, like a sidebar | 0.16 | |
| Page background | 0.19 | 0.975 |
| Card | 0.215 | 0.995 (half the page's C) |
| Raised, like an active row or input | 0.255 | 0.945 |
| Hairline | primary text at 8% | primary text at 8% |
| Primary text | 0.94 | 0.22 |
| Secondary text | 0.72 | 0.44 |
| Muted text and icons | 0.645 | 0.52 |

With these steps muted text keeps 4.6:1 or more on every surface, secondary 6.3:1 and primary 13:1, in both modes. Move L only after measuring again: muted text is for meta and captions, and it is the first thing to fall under 4.5:1.

The same recipe at three tints, worked out:

| Role | Graphite dark (H 286) | Warm dark (H 75) | Ink dark (H 262) |
| --- | --- | --- | --- |
| Deepest | #0d0d0e | #0f0d09 | #0a0d13 |
| Page | #141415 | #161310 | #10141a |
| Card | #19191b | #1c1915 | #161a20 |
| Raised | #232324 | #25221f | #1f232a |
| Primary text | #ebebee | #f1eae1 | #e4ecf9 |
| Secondary text | #a4a4a7 | #aaa49b | #9ea5b2 |
| Muted text and icons | #8d8d90 | #938d84 | #878e9a |

| Role | Graphite light | Warm light | Ink light |
| --- | --- | --- | --- |
| Page | #f6f6f8 | #f9f6f2 | #f4f7fb |
| Card | #fdfdfe | #fffdfb | #fcfdff |
| Raised | #ececee | #efece8 | #ebedf1 |
| Primary text | #1a1a1c | #1e1a13 | #161b24 |
| Secondary text | #525255 | #57524a | #4d535e |
| Muted text and icons | #69696b | #6e6860 | #636975 |

Apps and dashboards take graphite, or a ramp just as grey, for every surface: people stare at them for hours and the content brings the colour. A warm light page is the cream default of generated screens, so use the warm light ramp only when the world really is paper, food, craft or skin.

## Status colours

Success, warning and error come from the page's own palette, never from a framework's stock green and red. A stock green check on an ink page reads as borrowed. Keep the meaning people already know, and fit the rest:

1. **Hue:** stay in the band people read without thinking: success H 140 to 160, warning H 70 to 90, error H 20 to 35. Within the band, turn toward the palette's own hue by up to 15° when that keeps the meaning (a moss world's success sits at the green end, a coral world's error at the warm end). Real-world meanings win over the palette: a delay can be amber on a blue page, and an error never turns blue to match a blue brand.
2. **Lightness and chroma:** take the accent's L and C, or start from L 0.55, C 0.13 on light pages and L 0.74, C 0.12 on dark ones. Lower C toward 0.10 in calm worlds.
3. **Check it:** a status mark keeps 3:1 against its surface, and status text keeps 4.5:1, which on light pages means L 0.50 or darker for text set in the colour itself.

## Accent

- Keep a real brand color. A violet to blue or any other hue to hue glow gradient is slop, not a brand color, unless the user says otherwise.
- Without a brand color, take its hue from the world. Warm worlds suit amber, coral or ember (H 30 to 70). Cool worlds suit cobalt, teal or a clear sky blue (H 200 to 260). Natural worlds suit moss or sage (H 120 to 150). Avoid the purple to blue family unless the brand really is purple.
- Text on the accent reaches 4.5 to 1 contrast. Darken the accent (lower L, keep H and C) or use dark text when it does not.
- The accent covers a few percent of the screen, like the primary action, the selection and one key figure.

## Buttons

- Hero buttons 44 to 48 tall, navigation buttons 32 to 36, padding 16 to 20 on the sides.
- Primary on dark: an off white from the ramp with dark text, or the accent. Primary on light: the primary text color as a fill with white text, or the accent.
- Secondary: the raised surface with a hairline, primary text.
- A soft top highlight like `inset 0 1px 0 rgba(255,255,255,0.12)` on dark buttons gives depth without a glow.

## Type

**Choosing the family.** Names go stale: the families every model reaches for are the template look, so this file names none. Walk this each time:

1. Write the character from the direction as two or three concrete words.
2. Find the type that the product's world already uses: the lettering on its objects, its paperwork, its signs, its screens. That is where a face with a reason comes from.
3. Write down the first family that comes to mind, and any family you'd pick for any project. Rule both out. They're the defaults a designer would suspect.
4. Use one family, or two that are clearly distinct (a serif with a sans, a wide display with a plain text face). A second family gets one job, like headlines or figures.
5. Check it at the real size: figures need tabular numbers, the interface face needs a 400 and a 500 weight, and every glyph the copy uses has to exist.

A display face belongs to large headlines only, never to labels or buttons.

**Scale.** A screen uses at most five of these sizes.

| Use | Size | Line height | Weight |
| --- | --- | --- | --- |
| Small labels, meta, counts | 12 | 16 | 400 |
| Secondary text, captions | 13 to 14 | 20 | 400 |
| Body, nav items | 14 to 15 | 20 to 22 | 400 to 500 |
| Logo wordmark | 16 to 18 | 1 | 500 to 600 |
| Hero subhead | 18 to 20 | 28 to 30 | 400, secondary color, at most 36rem wide |
| Card figures | 28 to 32 | 1 | 500, tabular |
| Page title | 28 to 36 | 1.15 | 400 to 500 |
| Hero headline | 56 to 72 desktop, 36 to 44 mobile | 1.05 to 1.1 | 400 to 500, or the display face's heavy weight (SKILL.md, Type) |

**Tracking**, as charles-polish sets it: none below 28px, −0.01em from 28 to 47px, −0.022em from 48px, and +0.08em on capitals at any size.

## Radius

| Element | Radius |
| --- | --- |
| Keycap, tag, small button | 4 to 6 |
| Row, input, button | 8 to 10 |
| Card | 12 to 16 |
| Panel or window | 14 to 20 |

Nested radius: inner = outer − padding, never below 4. A 16px card with 8px padding holds items with an 8px radius.

## Icons

One set, at one size (16 or 18px) and one stroke that matches the text beside it (about 1.5px next to 400 to 500 weights), in the muted or secondary text color, 8 to 10px from its label. Pick the set by the character: rounded ends for soft products, square ends and sharp corners for exact ones. The set every generated screen ships with is a tell, so choose one on purpose.

## Depth

- Dark: surface steps plus a hairline. An active row can carry `inset 0 1px 0 rgba(255,255,255,0.12)` as a top highlight.
- Light: `0 1px 2px rgba(0,0,0,0.05)` for small things, `0 8px 24px rgba(0,0,0,0.06)` for floating ones, tinted toward the ramp's H.

## Motion

Unslop's job for motion is deletion (pass 9). For the curves, durations and press scale of what stays, use charles-polish's motion section. Without it: ease-out for anything entering or leaving, 150ms for hover and press, under 300ms for menus and modals, and a press scale of 0.96.

---

Part of unslop by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), CC BY 4.0. Changed here: the ramps rebuilt in OKLCH, status colours fitted to the palette, the type families replaced by a process, and the motion values handed to charles-polish. Keep this credit in copies and adaptations.
