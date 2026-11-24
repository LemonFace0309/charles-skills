# Evals

Three cases with known answers (what Charles actually said on camera), plus the trigger cases every skill in this
repository carries. Each case is a folder in the `claude plugin eval` format: `prompt.md` is what the tested session
sees, and `graders/` holds the checks. His real lines live only in the graders. None of them appear in `references/`,
and the eval sandbox stops the tested session from reading this folder, so the skill can't copy the answer.

## Run them

From a clone of charles-skills:

```bash
node scripts/eval.mjs charles-scripting-voice outcomes
node scripts/eval.mjs charles-scripting-voice triggers
```

Anywhere else, point Claude Code at this skill's folder:

```bash
claude plugin eval <path to charles-scripting-voice> --case 'outcome-*' --no-publish
```

Outcome runs add a baseline arm with no skill, so the report shows what the skill adds over a plain agent told to
write in Charles' voice. Each case runs three times. Use a strong judge for the voice cases (`--judge-model sonnet`
or better): the default judge is small. Keep a change to the skill only if its scores go up and it stays ahead of the
baseline.

## The cases

| Case | Input | What it tests | Where the answer came from |
| --- | --- | --- | --- |
| `outcome-design-hacks-type` | An AI draft of ten typography hacks | Rewriting a fast list of fixes | `videos/design-hacks/type` in claude-editing: the draft from commit 4ec1af8 (SCRIPT.md, 10 Nov 2026) and the cut take's transcript (`edit/work/cut/transcript.json`). The cut starts after the hook, which went on screen. |
| `outcome-unslop-repos-part-3` | An AI draft of a five-library roundup | Rewriting a roundup with reactions and his own angle | `videos/unslop-repos`: Part 3's draft (`kit/script.md`, 10 Nov 2026) and the take's transcript (`part-3/edit/transcript.json`, filmed 13 Nov). He reordered the repos while filming. |
| `outcome-left-my-job` | A brief of facts from an unscripted reel | Writing his storytelling voice from nothing | His reel of 20 May 2025 (https://www.instagram.com/reel/DJ36NIhBhCs/, 11.6K plays, 76 s), Whisper medium.en's transcript, unedited. The brief now reads in his own first person, as he'd ask for it, and keeps "At first I thought they were brilliant" on purpose: the skill has to turn it into a quote of his past self. |

Never copy a line from these cases into `references/`, or the test stops meaning anything.

## Results

**16 Nov 2026, first version** (before the plugin-eval format). A blind judge scored each output 1 to 10 for how
closely it matched his take:

| Case | With the skill | Without | What the skill got wrong |
| --- | --- | --- | --- |
| unslop-repos-part-3 | 8 | 5 | Too few reactions for a roundup (the intensifier rate was set for stories) |
| design-hacks-type | 6 | 7 | Joined problem and fix with "so" six times; asked for a personal angle in a list he never adds one to |
| left-my-job | 6 | 7 | Pasted his "Yeah, I know, stupid, right?" from another reel; narrated "I thought…" where he says "I was like…"; 206 words where he said 325 |

The plain agent kept the AI draft's jokes ("a typewriter thing", "look like they're yelling") and its quips ("people
still lose way too much time playing with it"). Its story was choppy: 11 words a sentence to his 18.

Fixed the same day: intensifier rates by format, fix shapes with no one shape for more than half the items, no angle in
fast lists, never pasting his lines, and a monologue pace of 3.7 words a second.

**16 Nov 2026, second version**, against the same plain outputs, with a new blind judge:

| Case | With the skill | Without | What the skill still got wrong |
| --- | --- | --- | --- |
| design-hacks-type | 7 | 6 | Some fixes came before their problem ("Truncate long file names in the middle, so…") |
| unslop-repos-part-3 | 7 | 6 | Reactions packed into long comma chains in milder words ("it's still super fun to play with") |
| left-my-job | 7 | 5 | Narrated "I honestly thought they were all just brilliant" instead of acting it out |

Word counts against his: 159 to 160, 172 to 173, 251 to 325. Added after this run, and first tested by the
plugin-eval cases: quoting his past self ("I'm like, '…'"), opening an item with its name, the problem first in at
least 8 of 10 fixes, and "like" and "right?" as hedges in stories. Each case's graders check exactly those.
