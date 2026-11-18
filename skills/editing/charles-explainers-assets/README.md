# charles-explainers-assets

<p align="center">
<img src="examples/scale-before.jpg" width="49%" alt="Before: a dialog that scales in from 0, with its CSS">
<img src="examples/scale-after.jpg" width="49%" alt="After: the same dialog scaling in from 0.97, with the new value highlighted in its CSS">
</p>

Builds the visual that teaches each line of a reel, timed to your words.

```bash
npx skills add LemonFace0309/charles-skills --skill charles-explainers-assets
```

Add `-g` to install it for every project, or copy this folder into `~/.claude/skills/` (Claude Code) or
`~/.agents/skills/` (Codex).

## What it does

- Shows a fix that flips from before to after on your word with its code under it, a principle side by side without
  it and with it, or a term's definition above a demo
- Marks what changes, in red on the problem and green as it's fixed: a guide that straightens, a hatched band over a
  space, corner brackets, a before/after sweep, or the agent cursor moving the part itself
- Sizes each clip for its slot in your edit, and keeps it simple enough to read in the second or two a phone viewer gets

## Examples

The pair at the top is one fix from my animation hacks reel, before and after the word, with its CSS under it.

## Try it

```text
/charles-explainers-assets a before and after for "use tabular numbers", for a 1080x960 card
/charles-explainers-assets a teaching visual for every line of script.md
```

## Needs

Bun, Google Chrome and ffmpeg.

## Pairs with

[charles-claude-editing](../charles-claude-editing/), which asks for these at the size its layout needs, and
[charles-3d-explainers](../charles-3d-explainers/) when an idea needs depth.
