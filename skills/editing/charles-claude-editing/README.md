# charles-claude-editing

![Frames from two of my reels edited with it: the Day 4 title, short captions, screens over the shot, and a popup over a blurred background](examples/reels.jpg)

Edits raw talking-head footage into Reels and TikToks, for news and education videos.

```bash
npx skills add LemonFace0309/charles-skills --skill charles-claude-editing
```

Add `-g` to install it for every project, or copy this folder into `~/.claude/skills/` (Claude Code) or
`~/.agents/skills/` (Codex).

## What it does

- Cuts dead space and stumbles, and picks the best take
- Adds 2-3 word captions, overlays, split screens, sound effects and music
- Writes a hook title when you ask for one

## Try it

```text
/charles-claude-editing make take.MOV into a reel
/charles-claude-editing add a hook title and music to edit.mp4
```

## Needs

A music library in `assets/music/<mood>/` and sound effects in `assets/sound-effects/`. It's written for my own
workflow, so change those paths, and the step that saves each reel to Apple Photos, to fit yours.

## Pairs with

[charles-reel-plans](../charles-reel-plans/) and [charles-scripting-voice](../charles-scripting-voice/) before you
film, and [charles-explainers-assets](../charles-explainers-assets/), [charles-3d-explainers](../charles-3d-explainers/)
and [charles-arcade-assets](../charles-arcade-assets/) for the visuals it asks for.
