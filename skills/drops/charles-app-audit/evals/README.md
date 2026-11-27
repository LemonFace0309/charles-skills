# Evals

Run them from the repository root, in a terminal signed in to Claude Code:

```bash
node scripts/eval.mjs charles-app-audit --with-drops            # the trigger cases
node scripts/eval.mjs charles-app-audit outcomes --with-drops   # the planted-issues app, against a run without the skill
```

- `trigger-launch-check`, `trigger-bill-worry`: people asking whether their app is safe to launch, in their own words.
- `no-trigger-diff-review`: a review of one diff for bugs, which is a code review, not an app audit.
- `outcome-planted-issues`: PawPal, a small Next.js, Supabase, Twilio, Stripe and OpenAI app with problems planted in it
  and one that only looks like a problem. What a good audit finds is in its `graders/`, never in the prompt or the
  skill's references. Its `.env.example` holds placeholders only (fake keys signed "placeholder", empty values) and was
  added with `git add -f` past the repo's `.env*` rule, because the planted problems start there.

First run, 27 Nov 2026, by hand rather than through `eval.mjs` (the terminal here wasn't signed in): with the skill, an
agent found every planted problem with its file and line, rated them as the graders expect, left the public key alone
and changed nothing, and added a map of the ways in, worst-case costs a day, a "Needs checking" list with dashboard
paths and a coverage section. A plain "audit this" on the same app also found the planted problems, in about half the
time and tokens (11 minutes and 144,000 tokens against 21 and 256,000). What the skill adds is the structure, the legal
and cost checks, and consistency; rerun both arms with `eval.mjs ... outcomes` after changing a rule.
