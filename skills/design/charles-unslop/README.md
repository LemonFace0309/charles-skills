# charles-unslop

![Show the actual product: a glossy sphere becomes a cited answer](examples/show-the-product.jpg)

Turns a screen that looks AI-made into one with its own point of view.

```bash
npx skills add LemonFace0309/charles-skills --skill charles-unslop
```

Add `-g` to install it for every project, or copy this folder into `~/.claude/skills/` (Claude Code) or
`~/.agents/skills/` (Codex).

## What it does

- Finds the tells: glows, emoji icons, pill badges, generic headlines
- Deletes what doesn't earn its place, then fixes spacing, colour, icons, copy and type, in that order
- Gives the screen one moment only that product could have

## Examples

Fixes from my "20 Ways to Unslop AI Designs" reel, on pages that AI models built. The one at the top is "show the
actual product".

![Keep icons consistent: emoji become one set of line icons](examples/consistent-icons.jpg)

![Add specificity to your headline: "Curiosity, meet clarity." becomes "Cited answers from papers."](examples/specific-headline.jpg)

## Try it

```text
/charles-unslop this login page
/charles-unslop review the dashboard an agent just built
```

## Pairs with

[charles-polish](../charles-polish/) once the screen looks designed and you want it to feel finished.

## Credits

Adapted from [unslop](https://github.com/heydamir/unslop) by Damir Sokolovsky
([@heydamir](https://x.com/heydamir)), and draws on Emil Kowalski's unslop design skill and the feedback on my
"Removing AI Slop" series. What I changed: the passes are reordered around deleting first; the rules on backgrounds,
brand icons and materials are rewritten; the colour tokens are rebuilt in OKLCH with status colours that come from the
page's palette; the font list became a way to choose type; and motion values come from
[charles-polish](../charles-polish/). Like the original, this skill is under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
