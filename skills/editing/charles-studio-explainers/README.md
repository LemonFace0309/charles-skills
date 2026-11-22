# charles-studio-explainers

![Four cards from my 20 psychology principles reel: a candle burned low lighting a giant 46-day streak that ends tonight, YOU with a crystal ball as its O, a running shoe standing on the word runner, and two kraft price tags where a decoy duck greys out the 6-month plan so yearly is only $5 more](examples/cards.jpg)

Turns a reel's explainer cards from plain UI mock-ups into cards that look like a design studio made them.

```bash
npx skills add LemonFace0309/charles-skills --skill charles-studio-explainers
```

Add `-g` to install it for every project, or copy this folder into `~/.claude/skills/` (Claude Code) or
`~/.agents/skills/` (Codex).

## What it does

- Finds an object for every line that's a pun on it: an anchor for price anchoring, a decoy duck for the decoy effect, a coin scratching a scratch card for surprise rewards
- Generates each object as a photographed studio product shot and sits it in real light (its world's colour on its edges, a contact shadow, grain over everything), in one colour family or on cream, with one move that sells the idea
- Rotates four layouts across a set, including type locked with the object, and keeps each card to a few words a phone viewer reads in a second
- Keeps the same timing and readability as my explainer skill, and improves the cards round by round with fresh critics against a reference until they match it

## Try it

```text
/charles-studio-explainers these explainer cards are boring, make them look like this reference
/charles-studio-explainers make before/after cards for my 20 psychology principles list reel
```

## Needs

- `charles-explainers-assets` installed next to it (its renderer and checks), Bun, Google Chrome and ffmpeg
- A fal key (`FAL_KEY`) for the objects. A full set of 20-35 objects took under 10 minutes on GPT Image 2.6

## Pairs with

- [charles-explainers-assets](../charles-explainers-assets/): the base this builds on. Use it alone when a clean demo is enough
- [charles-reel-plans](../charles-reel-plans/): puts the finished cards into the plan page's mockup of the reel
- [charles-unreasonable-craft](../../design/charles-unreasonable-craft/): the critique rubric and the "render the directions" habit this skill borrows

## Credits

The bar came from Tobi Donadon's [Construct Design](https://www.tobiadonadon.com/projects/construct/design) and his
article [How to Make Claude Design Like a Real Studio](https://x.com/tobiadonadon_/status/2124269680122638822).
