# Evals

Three cases with known answers: what Charles actually said. None of their lines appear in `references/`, so the skill can't copy the answer.

| Case | Input | Tests |
| --- | --- | --- |
| `design-hacks-type.md` | An AI draft of ten typography hacks | Rewriting a fast list of fixes |
| `unslop-repos-part-3.md` | An AI draft of a five-library roundup | Rewriting a roundup with reactions and his own angle |
| `left-my-job.md` | A brief of facts from an unscripted 2025 reel | Writing his storytelling voice from nothing |

To test a change to the skill:

1. Give one agent the skill (SKILL.md and `references/`, not this folder) and the three inputs. Give a second agent only the inputs and "write it in Charles' natural voice". Neither may open `evals/`, `videos/`, `research/charles-voice/` or `formats/`: the format playbooks quote his real lines from these reels' series, such as the GitHub libraries' "Comment repos" ask. Where they'd need a fact only Charles has, they write `[ASK: …]` instead of inventing one.
2. Give a third agent the answers and the two outputs per case, labelled A and B at random, and ask which is closer to how he actually said it, with examples.
3. Count, for each output: witty similes and jokes about the topic, sentences with no verb, "you can", "which"/"that" clauses, words per sentence, and intensifiers per 100 words. Compare with the answer.

Keep a change only if the skill's output gets closer to the answer and stays ahead of the plain agent.

## Results

**16 Nov 2026, first version.** A blind judge scored each output 1 to 10 for how closely it matches his take.

| Case | With the skill | Without | What the skill got wrong |
| --- | --- | --- | --- |
| `unslop-repos-part-3` | 8 | 5 | Too few reactions for a roundup (the intensifier rate was set for stories) |
| `design-hacks-type` | 6 | 7 | Joined problem and fix with "so" six times; asked for a personal angle in a list he never adds one to |
| `left-my-job` | 6 | 7 | Pasted his "Yeah, I know, stupid, right?" from another reel; narrated "I thought…" where he says "I was like…"; 206 words where he said 325 |

The plain agent kept the AI draft's jokes ("a typewriter thing", "look like they're yelling") and its quips ("people still lose way too much time playing with it"). Its story was choppy: 11 words a sentence to his 18.

Fixed the same day, before the second run: intensifier rates by format, fix shapes with no one shape for more than half the items, no angle in fast lists, never pasting his lines, and a monologue pace of 3.7 words a second.

**16 Nov 2026, second version** (the fixes above), against the same plain outputs, with a new blind judge and reshuffled labels:

| Case | With the skill | Without | What the skill still gets wrong |
| --- | --- | --- | --- |
| `design-hacks-type` | 7 | 6 | Some fixes come before their problem ("Truncate long file names in the middle, so…") |
| `unslop-repos-part-3` | 7 | 6 | Reactions packed into long comma chains in milder words ("it's still super fun to play with") |
| `left-my-job` | 7 | 5 | Narrates "I honestly thought they were all just brilliant" instead of acting it out |

Word counts against his: 159 to 160, 172 to 173, 251 to 325. Added after this run started, so untested: quoting his past self ("I'm like, '…'"), opening an item with its name, the problem first in at least 8 of 10 fixes, and "like" and "right?" as hedges in stories.
