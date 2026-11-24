# charles-scripting-voice
<!-- text-only -->

Writes the words you say on camera so they sound like you talking, not like an AI script.

```bash
npx skills add LemonFace0309/charles-skills --skill charles-scripting-voice
```

Add `-g` to install it for every project, or copy this folder into `~/.claude/skills/` (Claude Code) or
`~/.agents/skills/` (Codex).

## What it does

- Writes each line from its job: the hook, the next item in a list, a turn in a story, the ask at the end
- Cuts what I cut from every AI draft I filmed: jokes about the topic, clever closing clauses, punchy verdicts and
  clipped grammar
- Adds what I add, fits the script to the clock (about 3.3 words a second over demos, 3.7 talking), and reads every
  line out loud before handing it over

## Examples

Lines an AI wrote for me, and what I actually said on camera:

| AI draft | What I said |
| --- | --- |
| When a password's wrong, don't just turn it red. Shake it, like your mum saying no. | When a password's wrong, don't just turn it red, shake it too so it's obvious. |
| HSL lies about lightness. Build your palettes in OKLCH, and the same lightness actually looks the same. | Our eyes perceive brightness differently, so HSL isn't optimal. Use OKLCH instead. |

`references/edits.md` has 22 of these rewrites, and `references/lines.md` has my real lines for each job, with the
reel and its views.

## Try it

```text
/charles-scripting-voice a 30 s script for these 10 font tips
/charles-scripting-voice this script sounds AI, rewrite it in my voice: script.md
```

## Make it yours

It's tuned to me. To make it sound like you, swap `references/lines.md` and `references/edits.md` for your own lines
and your own rewrites of AI drafts, then swap the three known-answer cases in `evals/` for three of your own reels and
test the change (below).

## Test a change

`evals/` holds three of my reels with known answers: an AI draft or a brief as the input, and what I actually said on
camera, which only the graders see. Run them before keeping a change to the skill:

```bash
node scripts/eval.mjs charles-scripting-voice outcomes
```

That's from a clone of this repo. `evals/README.md` has the command for anywhere else, where each case came from, and
the results so far. Never copy their lines into `references/`, or the test stops meaning anything.

## Pairs with

[charles-reel-plans](../charles-reel-plans/), which calls it for every script, and
[charles-claude-editing](../charles-claude-editing/).
