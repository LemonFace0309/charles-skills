# charles-storage-cleanup
<!-- text-only -->

Finds what's filling your Mac and removes what's safe to delete, keeping your active work.

```bash
npx skills add LemonFace0309/charles-skills --skill charles-storage-cleanup
```

Add `-g` to install it for every project, or copy this folder into `~/.claude/skills/` (Claude Code) or
`~/.agents/skills/` (Codex).

## What it does

- Looks through caches, old simulators and emulators, app builds, dependencies, Git leftovers and apps you rarely use
- Explains what the biggest folders actually hold and why they exist before anything goes
- Deletes what it has confirmed is disposable, in measured batches, and logs every path it removed

When you ask it to clean up, it deletes what's confirmed disposable without asking again, so ask for a report first if
you want to review.

## Try it

```text
/charles-storage-cleanup what's filling my disk? Report only, don't delete anything
/charles-storage-cleanup clear the caches and simulators I haven't used in a month
/charles-storage-cleanup my free space dropped this week, find out why
```

## Needs

macOS and Python 3.
