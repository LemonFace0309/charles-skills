# Evals

Rename these three cases for the new skill, then run them from the repository root:

```bash
node scripts/eval.mjs charles-NAME             # the trigger cases
node scripts/eval.mjs charles-NAME outcomes    # the outcome cases, against a run without the skill
```

- `trigger-*`: a request in the words people type, never naming the skill. The skill must load. Write two.
- `no-trigger-*`: a near miss that belongs to a sibling skill, or to no skill. The skill must not load.
- `outcome-*`: a task with a known answer that shows what the skill adds. Inputs go in `fixtures/`; the answer goes only
  in `graders/`, never in the prompt or the skill's references.

`scripts/check.mjs` fails a skill on the three main shelves that's missing any of the three kinds.
