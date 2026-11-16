# charles-storage-cleanup

Finds what's filling your Mac (caches, old simulators and emulators, app builds, dependencies, Git leftovers, apps you
rarely use) and removes what's safe to delete, keeping your active work. When you ask it to clean up, it deletes what
it has confirmed is disposable without asking again, so ask for a report first if you want to review.

## Needs

macOS and Python 3.

## Install

```bash
npx skills add LemonFace0309/charles-skills --skill charles-storage-cleanup
```

Add `-g` to install it for every project, or copy this folder into `~/.claude/skills/` (Claude Code) or
`~/.agents/skills/` (Codex).

## Use

```text
/charles-storage-cleanup what's filling my disk? Report only, don't delete anything
/charles-storage-cleanup clear the caches and simulators I haven't used in a month
/charles-storage-cleanup my free space dropped this week, find out why
```
