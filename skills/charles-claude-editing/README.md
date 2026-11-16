# charles-claude-editing

Edits raw talking-head footage into Reels and TikToks, for news and education videos. It cuts dead space and stumbles,
picks the best take, and adds 2-3 word captions, overlays, split screens, sound effects, music and, when you ask, a
hook title.

## Needs

A music library in `assets/music/<mood>/` and sound effects in `assets/sound-effects/`. It's written for my own
workflow, so change those paths, and the step that saves each reel to Apple Photos, to fit yours. For motion graphics,
also install charles-arcade-assets and charles-explainers-assets.

## Use

```text
/charles-claude-editing make take.MOV into a reel
/charles-claude-editing add a hook title and music to edit.mp4
```
