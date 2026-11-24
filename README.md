<p align="center">
  <a href="https://www.instagram.com/charles.unemployed/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset=".github/assets/banner-dark.webp">
      <source media="(prefers-color-scheme: light)" srcset=".github/assets/banner-light.webp">
      <img alt="Charles' Skills, for Claude Code and Codex" src=".github/assets/banner-light.webp" width="680">
    </picture>
  </a>
</p>

# Charles' skills

[![skills.sh](https://skills.sh/b/LemonFace0309/charles-skills)](https://skills.sh/LemonFace0309/charles-skills)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Instagram](https://img.shields.io/badge/instagram-%40charles.unemployed-E4405F?logo=instagram&logoColor=white)](https://www.instagram.com/charles.unemployed/)

The skills I use to design apps and make my reels, for Claude Code, Codex and any agent that reads `SKILL.md`. I show
them working in my reels on [Instagram](https://www.instagram.com/charles.unemployed/), and every skill I've given away
there lives here.

<p align="center">
<a href="skills/drops/charles-ux-animation/"><img src=".github/assets/ux-animation.jpg" width="49%" alt="charles-ux-animation: the 20 principles of UX and animation, shown before and after"></a>
<a href="skills/drops/charles-hero-mockups/"><img src=".github/assets/hero-mockups.jpg" width="49%" alt="charles-hero-mockups: a poster-like hero for an electric motorcycle, with one line of signal red"></a>
<a href="skills/design/charles-store-screenshots/"><img src=".github/assets/store-screenshots.jpg" width="49%" alt="charles-store-screenshots: Duolingo's store screenshots as AI makes them, and as the skill makes them"></a>
<a href="skills/editing/charles-3d-explainers/"><img src=".github/assets/3d-explainers.jpg" width="49%" alt="charles-3d-explainers: 3D cutaways from my reel on the Instagram algorithm"></a>
</p>

## Install

```bash
npx skills add LemonFace0309/charles-skills --skill '*'
```

That installs every skill. Add `-g` to install them for every project, not only this one. For one skill, name it:

```bash
npx skills add LemonFace0309/charles-skills --skill charles-unslop
```

Leave off `--skill` to pick from a list grouped by shelf.

<details>
<summary>Claude Code plugins, or by hand</summary>

<br>

In Claude Code you can add a whole shelf at once:

```text
/plugin install design --marketplace LemonFace0309/charles-skills
/plugin install drops --marketplace LemonFace0309/charles-skills
/plugin install editing --marketplace LemonFace0309/charles-skills
/plugin install qol --marketplace LemonFace0309/charles-skills
```

On Claude Code before 2.1.275, run `/plugin marketplace add LemonFace0309/charles-skills` first, then
`/plugin install design@charles-skills`. A plugin skill is called with its shelf in front, like
`/design:charles-unslop`. Pick one way to install: a skill installed both ways loads twice.

By hand, copy a skill's folder into `~/.claude/skills/` for Claude Code or `~/.agents/skills/` for Codex:

```bash
git clone https://github.com/LemonFace0309/charles-skills
cp -R charles-skills/skills/design/charles-unslop ~/.claude/skills/
```

</details>

## Use

Start a new session, then ask for it by name:

```text
/charles-unslop this login page
/charles-color-analysis critique the colours of my landing-page hero, hero.png
/charles-ux-animation the add-to-cart flow
/charles-hero-mockups four landing-page heroes for a ceramics studio, from my reference folder
/charles-store-screenshots three App Store screenshot sets for my habit tracker, from the captures in ./shots
/charles-learn-anything help me understand anti-aliasing
```

Codex uses `$charles-unslop` instead of the slash.

## The skills

### [Design](skills/design/): for the apps I build

| Skill | Use it when |
| --- | --- |
| [charles-unslop](skills/design/charles-unslop/) | A screen looks AI-generated and you want it to look designed |
| [charles-polish](skills/design/charles-polish/) | The UI works but feels off, and it needs a last pass on states, spacing, contrast and motion |
| [charles-color-analysis](skills/design/charles-color-analysis/) | Your colours clash, look muddy or just feel off, and you want exact fixes with before/after previews |
| [charles-unreasonable-craft](skills/design/charles-unreasonable-craft/) | A site or app screen has to wow people, held to the bar of an Awwwards Site of the Day |
| [charles-store-screenshots](skills/design/charles-store-screenshots/) | You need App Store screenshots that make people stop scrolling, rendered at Apple's exact sizes |

### [Drops](skills/drops/): specialist skills, one craft each

Each drop goes deep on a single craft. charles-ux-animation is the most requested skill I have: people have commented
MOTION for it more than 4,000 times.

| Skill | Use it when |
| --- | --- |
| [charles-ux-animation](skills/drops/charles-ux-animation/) | Your interface works but doesn't feel good yet: taps, menus, modals and page changes that should move with intent |
| [charles-hero-mockups](skills/drops/charles-hero-mockups/) | You want to see a landing page's look before you build it, or pitch a client three art directions as finished images |
| [charles-design-tips](skills/drops/charles-design-tips/) | Your screen works but looks thrown together: long text centred, grey greys, one heavy shadow, buttons labelled Submit and empty states with nowhere to go |
| [charles-design-laws](skills/drops/charles-design-laws/) | A screen or flow feels confusing or cluttered: too many choices, groups that don't read as groups, nothing that says what to do next |
| [charles-create-posters](skills/drops/charles-create-posters/) | You want a poster people share for a company, brand or project: one witty picture that could only be that subject, with the art direction of Quartr's posters (earnings details only when you ask) |

### [Editing](skills/editing/): how I make my reels

| Skill | Use it when |
| --- | --- |
| [charles-reel-plans](skills/editing/charles-reel-plans/) | You have a video idea and a reference, and want the script, real assets, caption and music before you film |
| [charles-scripting-voice](skills/editing/charles-scripting-voice/) | A script sounds like AI and you want it to sound like you talking |
| [charles-claude-editing](skills/editing/charles-claude-editing/) | You have raw talking-head footage and want a finished reel with captions, overlays and music |
| [charles-explainers-assets](skills/editing/charles-explainers-assets/) | A line in your video explains something and needs a visual that teaches it, timed to your words, in a clean look or a playful look |
| [charles-3d-explainers](skills/editing/charles-3d-explainers/) | You want a cinematic 3D explainer, or 3D cutaways for a talking-head video |
| [charles-arcade-assets](skills/editing/charles-arcade-assets/) | You want playful pixel-art motion graphics timed to a voiceover |

### [QoL](skills/qol/): small things that save time

| Skill | Use it when |
| --- | --- |
| [charles-eli14](skills/qol/charles-eli14/) | You want something explained clearly, the way a great teacher would explain it to a sharp 14-year-old |
| [charles-learn-anything](skills/qol/charles-learn-anything/) | You want to properly understand a topic in a few minutes: a narrated lesson with demos and quick checks, in Chrome |
| [charles-storage-cleanup](skills/qol/charles-storage-cleanup/) | Your Mac is out of space and you want to know what's safe to delete |

## Credits

- `charles-unslop` is adapted from [unslop](https://github.com/heydamir/unslop) by Damir Sokolovsky and draws on Emil
  Kowalski's unslop design skill.
- `charles-polish` is built from Emil Kowalski's UI polish and animation skills and Josh Puckett's Interface Craft.
- `charles-ux-animation` is built on Disney's 12 principles of animation (Frank Thomas and Ollie Johnston, *The
  Illusion of Life*), Raphael Salaja's [userinterface.wiki](https://www.userinterface.wiki), Jon Yablonski's
  [Laws of UX](https://lawsofux.com), Emil Kowalski's animation skill and his rule on frequency of use, and Josh
  Puckett's Interface Craft.
- `charles-design-tips` takes twelve of its tips from Dan Liu's threads on
  [text layout](https://x.com/danliu/status/1576997489529344001) and
  [choosing colors](https://x.com/danliu/status/1579536039139758080), and eight from Emil Kowalski's design rules
  ([aiforui.dev](https://aiforui.dev)).
- `charles-design-laws` is built on Jon Yablonski's [Laws of UX](https://lawsofux.com), Jakob Nielsen's
  [progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/), Eric Johnson and Daniel
  Goldstein's 2003 study of defaults, and Raphael Salaja's [userinterface.wiki](https://www.userinterface.wiki).

## License

MIT, except `charles-unslop`, which is CC BY 4.0 like the unslop it's adapted from. The fonts in the editing kits are
under the SIL Open Font License, with each licence beside its font, and the Earth textures and 3D models in
`charles-3d-explainers/kit` list their sources and licences in a `NOTICE.md` beside them.
