# charles-3d-explainers

[![I reverse engineered Instagram, with 3D cutaways (click to play)](examples/reels/instagram-3d.jpg)](examples/reels/instagram-3d.mp4)

Turns a voiceover into a premium 3D explainer reel, or into 3D cutaways for a talking-head video.

```bash
npx skills add LemonFace0309/charles-skills --skill charles-3d-explainers
```

Add `-g` to install it for every project, or copy this folder into `~/.claude/skills/` (Claude Code) or
`~/.agents/skills/` (Codex).

## What it does

- Shows every line on its word, with a hook that dives into the subject
- Builds dark 3D worlds lit with one warm accent: glowing signal paths, hero numbers that land on the word, labels
  pinned to parts and live app screens on 3D devices
- Renders with continuous camera moves, real depth of field and motion blur, in three.js on headless Chrome

## Examples

Two of my reels, re-edited with 3D cutaways (click to play): the Instagram one at the top, and Tinder.

[![I reverse engineered Tinder, with 3D cutaways](examples/reels/tinder-3d.jpg)](examples/reels/tinder-3d.mp4)

A whole reel made from scratch, on how noise-cancelling headphones work ([`examples/noise-cancel`](examples/noise-cancel),
a project to copy, with [`examples/hook-dive`](examples/hook-dive) for the 3 s diving hook):

[![Noise-cancelling headphones, a 37 s 3D explainer](examples/noise-cancel/poster.jpg)](examples/noise-cancel)

## Try it

```text
/charles-3d-explainers a 40 s reel on how GPS finds you, from voiceover.m4a
/charles-3d-explainers 3D cutaways for the explaining parts of my talking-head reel, edit.mp4
```

## Needs

Bun, Google Chrome and ffmpeg. The optional AI helpers (3D models, plates, character beats) need a fal.ai key.

## Pairs with

[charles-claude-editing](../charles-claude-editing/), which asks for cutaways at the size of their slot, and
[charles-explainers-assets](../charles-explainers-assets/) for flat teaching visuals.
