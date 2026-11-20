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

## Links

- ManyChat's "Get the skill" buttons point at short links, `https://lemonface0309.github.io/charles-skills/<keyword>/`,
  never at a GitHub folder. `site/links.json` maps each comment keyword to a skill name; add one when a reel gets a new
  keyword. `site/README.md` explains the rest.

## Before you commit

- Run `node scripts/check.mjs`. GitHub runs it on every push, and it fails on a broken link, a missing install line, a
  `SKILL.md` name that doesn't match its folder, frontmatter `npx skills` can't parse (it skips that skill), or a skill
  missing from a README or the plugin list.
- Write READMEs the way the existing ones read: first person, plain words, short sentences, real examples. A README
  carrying `<!-- text-only -->` under its title is one Charles decided needs no picture; leave it that way.
- Several sessions can share a checkout. Stage only your own paths and commit right away.
