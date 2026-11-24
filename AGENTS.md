# Working in charles-skills

Charles' public skills for Claude Code, Codex and any agent that reads `SKILL.md`. Most visitors arrive from an
Instagram DM on their phone, looking for one skill, so the READMEs come first and the links must never break.

## Where things go

- A skill is `skills/<shelf>/charles-<name>/`: `SKILL.md` for the agent, `README.md` for people, `examples/` for the
  pictures and clips the README shows, and `references/`, `scripts/` or `kit/` for the rest. The folder name is the
  `name` in `SKILL.md`.
- The shelves: `design` (UI craft he uses on his own apps), `editing` (his reel pipeline), `qol` (small everyday
  helpers) and `drops` (specialist skills that each go deep on one craft; each launched with a reel). Each shelf has a
  README listing its skills by when to use them. Describe drops by what they do for people, never as one-offs.
- This repo is the only copy of these skills. Charles' computers link every shelf into `~/.claude/skills` and
  `~/.agents/skills` (`scripts/link-skills.sh all`), and claude-editing keeps no copies or links of them (Charles,
  20 Nov 2026), so an edit made from any session lands in this repo: commit and push it from here. claude-editing's
  tools run some kits straight from this clone, at `../charles-skills/skills/<shelf>/<name>/`.

## Adding, moving or renaming a skill

- New skill: copy `templates/skill/` to `skills/<shelf>/charles-<name>/` and drop `.template` from its two file names
  (they carry it so installers don't mistake the template for a skill). Write the README in the template's order (real
  output under the title, one sentence, the install line, then the rest), and add the skill to its shelf README, the
  root README and
  `.claude-plugin/marketplace.json`. Then run `scripts/link-skills.sh all` so this computer's agents load it.
- Moving a skill to another shelf: `git mv` it, update the two shelf READMEs, the root README and `marketplace.json`,
  and rerun `scripts/link-skills.sh all`. Installs and short links find skills by name, but claude-editing's tools
  reach some kits by shelf: update its paths in the same change (`git grep skills/<old-shelf>/<name>` there).
- Renaming a skill breaks every install and every link that uses the old name. Only do it when Charles asks, and then
  add the old name to `site/links.json` so the short link keeps working.

## Writing a skill

- The description is what an agent reads before it decides to load a skill, and every installed skill shares one
  listing, cut to fit a budget: 1% of the context by default, 2% on Charles' Macs, where over 100 skills share it.
  Past the budget, the least-used skills lose their descriptions and stop loading on their own. Write it in the third
  person and under 400 characters: what it makes or fixes, when to use it in the words people type, and the sibling
  it hands off to. `scripts/check.mjs` fails one over 500 characters or written with "I" or "my".
- Every skill on design, editing and qol has `evals/`: two `trigger-*` cases that must load it, a `no-trigger-*` near
  miss that must not, and an `outcome-*` case with a known answer (`templates/skill/evals/` shows the shapes). After
  changing a description or a rule, run `node scripts/eval.mjs <skill>` and `node scripts/eval.mjs <skill> outcomes`
  from a terminal signed in to Claude Code. Known answers live only in `graders/`, never where the skill reads.
- A skill works in any folder. A path into claude-editing (tools/reelkit, formats/, videos/, assets/music/) is "when
  present", with a fallback, and `compatibility:` in the frontmatter says what the skill needs beyond the agent.
- `scripts/copies.json` lists files that are copies of one source: the editing skills' `reel-spec.json`, which
  charles-claude-editing owns, and charles-polish's capture scripts, which come from charles-unreasonable-craft.
  Change the source, copy it across, and the check confirms they match.

## Links

- ManyChat's "Get the skill" buttons point at short links, `https://lemonface0309.github.io/charles-skills/<keyword>/`,
  never at a GitHub folder. `site/links.json` maps each comment keyword to a skill name; add one when a reel gets a new
  keyword. `site/README.md` explains the rest.

## Before you commit

- Run `node scripts/check.mjs`. GitHub runs it on every push, and it fails on a broken link, a missing install line, a
  `SKILL.md` name that doesn't match its folder, frontmatter `npx skills` can't parse (it skips that skill), or a skill
  missing from a README or the plugin list. On design, editing and qol it also fails on a long or first-person
  description, a copy that differs from its source, a reference over 100 lines with no contents line, a skill path
  with no shelf, and a skill without its evals.
- Write READMEs the way the existing ones read: first person, plain words, short sentences, real examples. A README
  carrying `<!-- text-only -->` under its title is one Charles decided needs no picture; leave it that way.
- Several sessions can share a checkout. Stage only your own paths and commit right away.
