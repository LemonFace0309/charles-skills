# Charles's skills

Skills for Claude Code, Codex and other agents that read `SKILL.md`. If you came from a reel, you want `charles-unslop`, `charles-polish`, `charles-accent-heroes` or `charles-ux-animation`.

| Skill | What it does |
| --- | --- |
| [charles-unslop](skills/charles-unslop/SKILL.md) | Turns AI-looking UI into a designed interface with one real idea |
| [charles-polish](skills/charles-polish/SKILL.md) | Hill-climbs working UI, fixes the details, and checks motion frame by frame |
| [charles-ux-animation](skills/charles-ux-animation/SKILL.md) | The 20 principles of UX and animation as one procedure for building and reviewing how an interface moves and responds, with Emil Kowalski's animation rules, Interface Craft's motion techniques and 13 more laws of UX |
| [charles-unreasonable-craft](skills/charles-unreasonable-craft/SKILL.md) | Pushes web and app design toward an award-level bar |
| [charles-accent-heroes](skills/charles-accent-heroes/SKILL.md) | Makes award-level landing-page hero images with one bold accent colour, as close variations of reference screenshots. Needs Python and an OpenAI API key; the word check uses macOS |
| [charles-store-screenshots](skills/charles-store-screenshots/SKILL.md) | Designs App Store screenshot sets: a two-frame hook, frames that bleed into each other and real app UI, rendered to exact iPhone, iPad and iPhone Duo sizes. Needs Python, Playwright and Chrome; generated art needs an OpenAI API key |
| [charles-storage-cleanup](skills/charles-storage-cleanup/SKILL.md) | Finds what's filling a Mac and removes what's safely disposable. Ask for a report first if you want to review before anything is deleted |
| [charles-claude-editing](skills/charles-claude-editing/SKILL.md) | Edits talking-head footage into Reels and TikToks. Written for my own workflow, so its music and sound paths need changing |
| [charles-arcade-assets](skills/charles-arcade-assets/SKILL.md) | Makes pixel-art motion graphics timed to a voiceover. The sprite library isn't included, so you generate your own cast. Formerly charles-arcade-motion |
| [charles-explainers-assets](skills/charles-explainers-assets/SKILL.md) | Builds the visual that teaches each line of a reel: a fix flipping from before to after on the word, a principle side by side without it and with it, a coloured agent cursor making the change, the code under it and a definition tab above. Needs Bun, Chrome and ffmpeg |

## Install

Run this in your project, swapping in the skill you want:

```bash
npx skills add LemonFace0309/charles-skills --skill charles-unslop
```

Add `-g` to install it for every project.

Prefer to do it by hand? Copy the skill's folder into `~/.claude/skills/` for Claude Code or `~/.agents/skills/` for Codex:

```bash
git clone https://github.com/LemonFace0309/charles-skills
cp -R charles-skills/skills/charles-unslop ~/.claude/skills/
```

## Use

Start a new session, then ask for it by name:

```text
/charles-unslop this login page
/charles-polish the checkout flow, then verify the motion frame by frame
/charles-accent-heroes four landing-page heroes for a ceramics studio, from my reference folder
/charles-store-screenshots three App Store screenshot sets for my habit tracker, from the captures in ./shots
/charles-ux-animation the add-to-cart flow
```

Codex uses `$charles-unslop` instead of the slash.

## Credits

- `charles-unslop` is adapted from [unslop](https://github.com/heydamir/unslop) by Damir Sokolovsky, CC BY 4.0, and draws on Emil Kowalski's unslop design skill.
- `charles-polish` is built from Emil Kowalski's UI polish and animation skills and Josh Puckett's Interface Craft.
- `charles-ux-animation` is built on Disney's 12 principles of animation (Frank Thomas and Ollie Johnston, *The Illusion of Life*), Raphael Salaja's [userinterface.wiki](https://www.userinterface.wiki), Jon Yablonski's [Laws of UX](https://lawsofux.com), Emil Kowalski's animation skill and his rule on frequency of use, and Josh Puckett's Interface Craft.
- Fonts in `charles-arcade-assets/template/assets/fonts` and `charles-explainers-assets/kit/fonts` are under the SIL Open Font License, with each licence beside its font.
