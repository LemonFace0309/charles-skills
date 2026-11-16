# charles-polish

Takes an interface that already works and improves it level by level: it fixes the details people feel (states, hit
areas, contrast, layout shift, type), makes the motion correct, and checks every animation frame by frame. If the
screen still looks AI-made, run charles-unslop first.

## Install

```bash
npx skills add LemonFace0309/charles-skills --skill charles-polish
```

Add `-g` to install it for every project, or copy this folder into `~/.claude/skills/` (Claude Code) or
`~/.agents/skills/` (Codex).

## Use

```text
/charles-polish this login page
/charles-polish the checkout flow, then verify the motion frame by frame
/charles-polish review the settings screen without changing anything
```
