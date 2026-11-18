# charles-arcade-assets

Makes retro pixel-art motion graphics timed to a voiceover: a pixel mascot acting out every line, rebuilt app screens,
and the real pages, logos and photos the words name, each landing on its word. It renders a whole reel, or a card,
split panel or overlay at the size your edit needs.

## Needs

Node 22+, Python 3 with Pillow and numpy, ffmpeg, Google Chrome, and a fal.ai key (`FAL_KEY`) for the art. It renders
with HyperFrames, which runs through npx. My sprite library isn't included, so you generate your own cast.

## Install

```bash
npx skills add LemonFace0309/charles-skills --skill charles-arcade-assets
```

Add `-g` to install it for every project, or copy this folder into `~/.claude/skills/` (Claude Code) or
`~/.agents/skills/` (Codex).

## Use

```text
/charles-arcade-assets a pixel-art reel for voiceover.m4a
/charles-arcade-assets a 1280x630 card for 4.2-9.8 s of edit.mp4
```
