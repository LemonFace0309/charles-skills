# Working in charles-skills

Charles's public skills for Claude Code, Codex and any agent that reads `SKILL.md`. Most visitors arrive from an
Instagram DM on their phone, looking for one skill, so the READMEs come first and the links must never break.

## Where things go

- A skill is `skills/<shelf>/charles-<name>/`: `SKILL.md` for the agent, `README.md` for people, `examples/` for the
  pictures and clips the README shows, and `references/`, `scripts/` or `kit/` for the rest. The folder name is the
  `name` in `SKILL.md`.
- The shelves: `design` (UI craft he uses on his own apps), `editing` (his reel pipeline), `qol` (small everyday
  helpers) and `drops` (skills made for a reel and given away in the DMs). Each shelf has a README listing its skills.
- This repo is the only copy of these skills. claude-editing links to them (`claude-editing/skills/<name>` points
  here), so an edit made from a claude-editing session lands in this repo: commit and push it from here.

## Adding, moving or renaming a skill

- New skill: copy `templates/skill/` to `skills/<shelf>/charles-<name>/` and drop `.template` from its two file names
  (they carry it so installers don't mistake the template for a skill). Write the README in the template's order (real
  output under the title, one sentence, the install line, then the rest), and add the skill to its shelf README, the
  root README and
  `.claude-plugin/marketplace.json`. Then run `scripts/link-skills.sh --project ../claude-editing` and commit the new
  links in claude-editing.
- Moving a skill to another shelf: `git mv` it, update the two shelf READMEs, the root README and `marketplace.json`,
  and rerun both `scripts/link-skills.sh --project ../claude-editing` and `scripts/link-skills.sh`. Installs and short
  links find skills by name, so nothing else changes.
- Renaming a skill breaks every install and every link that uses the old name. Only do it when Charles asks, and then
  add the old name to `site/links.json` so the short link keeps working.

## Links

- ManyChat's "Get the skill" buttons point at short links, `https://lemonface0309.github.io/charles-skills/<keyword>/`,
  never at a GitHub folder. `site/links.json` maps each comment keyword to a skill name; add one when a reel gets a new
  keyword. `site/README.md` explains the rest.

## Before you commit

- Run `node scripts/check.mjs`. GitHub runs it on every push, and it fails on a broken link, a missing install line, a
  `SKILL.md` name that doesn't match its folder, or a skill missing from a README or the plugin list.
- Write READMEs the way the existing ones read: first person, plain words, short sentences, real examples.
- Several sessions can share a checkout. Stage only your own paths and commit right away.
