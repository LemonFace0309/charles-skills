# Charles's skills

Skills for Claude Code, Codex and other agents that read `SKILL.md`. If you came from a reel, you want `charles-unslop`, `charles-polish`, `charles-hero-mockups` (the accent colour reels; it was `charles-accent-heroes` until 16 Nov 2026) or `charles-ux-animation`.

| Skill | What it does |
| --- | --- |
| [charles-unslop](skills/charles-unslop/SKILL.md) | Turns UI that looks AI-made into a designed screen with its own point of view |
| [charles-polish](skills/charles-polish/SKILL.md) | Takes UI that works and fixes the details and motion, checked frame by frame |
| [charles-ux-animation](skills/charles-ux-animation/SKILL.md) | Builds and reviews how an interface moves and responds, using the 20 principles of UX and animation |
| [charles-unreasonable-craft](skills/charles-unreasonable-craft/SKILL.md) | Holds a site or app design to the bar of an Awwwards Site of the Day and an Apple Design Award |
| [charles-hero-mockups](skills/charles-hero-mockups/SKILL.md) | Mocks up poster-like landing-page heroes as images, each with one bold accent colour |
| [charles-color-analysis](skills/charles-color-analysis/SKILL.md) | Critiques the colour of a graphic, landing page, app screen or palette, with exact fixes and before/after previews |
| [charles-store-screenshots](skills/charles-store-screenshots/SKILL.md) | Designs App Store screenshot sets and renders them at Apple's exact sizes |
| [charles-storage-cleanup](skills/charles-storage-cleanup/SKILL.md) | Finds what's filling a Mac and removes what's safe to delete |
| [charles-claude-editing](skills/charles-claude-editing/SKILL.md) | Edits talking-head footage into Reels and TikToks |
| [charles-arcade-assets](skills/charles-arcade-assets/SKILL.md) | Makes pixel-art motion graphics timed to a voiceover |
| [charles-explainers-assets](skills/charles-explainers-assets/SKILL.md) | Makes the visual that teaches each line of a reel, timed to the words |
| [charles-3d-explainers](skills/charles-3d-explainers/SKILL.md) | Makes 3D explainer reels from a voiceover, and 3D cutaways for talking-head videos |
| [charles-reel-plans](skills/charles-reel-plans/SKILL.md) | Plans a reel before it's filmed: the script, real assets, the caption, the music and a shareable mockup page |

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
/charles-hero-mockups four landing-page heroes for a ceramics studio, from my reference folder
/charles-color-analysis critique the colours of my landing-page hero, hero.png
/charles-store-screenshots three App Store screenshot sets for my habit tracker, from the captures in ./shots
/charles-ux-animation the add-to-cart flow
/charles-3d-explainers a 40 s reel on how GPS finds you, from voiceover.m4a
/charles-reel-plans an evolution of design reel, from this post, structured like my 22 Backgrounds reel
```

Codex uses `$charles-unslop` instead of the slash.

## Credits

- `charles-unslop` is adapted from [unslop](https://github.com/heydamir/unslop) by Damir Sokolovsky, CC BY 4.0, and draws on Emil Kowalski's unslop design skill.
- `charles-polish` is built from Emil Kowalski's UI polish and animation skills and Josh Puckett's Interface Craft.
- `charles-ux-animation` is built on Disney's 12 principles of animation (Frank Thomas and Ollie Johnston, *The Illusion of Life*), Raphael Salaja's [userinterface.wiki](https://www.userinterface.wiki), Jon Yablonski's [Laws of UX](https://lawsofux.com), Emil Kowalski's animation skill and his rule on frequency of use, and Josh Puckett's Interface Craft.
- Fonts in `charles-arcade-assets/template/assets/fonts`, `charles-explainers-assets/kit/fonts` and `charles-3d-explainers/kit/fonts` are under the SIL Open Font License, with each licence beside its font. The Earth textures and the 3D models in `charles-3d-explainers/kit` carry their sources and licences in a `NOTICE.md` beside them.
