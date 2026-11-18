# charles-hero-mockups

Mocks up landing-page heroes as images that read like posters: one striking subject, big type tied to it, a quiet
interface and one bold accent colour. Use it to explore a site's art direction before you build it, to pitch directions,
or for finished hero graphics. Each page is a close variation of a reference screenshot you give it, rendered with GPT
Image, then checked and fixed with small edits.

It was called `charles-accent-heroes` until 16 Nov 2026.

## Examples

Six heroes it made:

<p align="center">
<img src="gallery/vanta.jpg" width="49%" alt="Vanta, electric motorcycles: white and graphite, with a line of signal red">
<img src="gallery/halden.jpg" width="49%" alt="Halden Dance Theatre: bottle green and bone, with vermilion silk">
<img src="gallery/glimra.jpg" width="49%" alt="Glimra sunglasses: blush and deep wine, with kelly green">
<img src="gallery/flow-lab.jpg" width="49%" alt="Flow Lab dance classes: mauve taupe and pale lavender, with lavender chrome">
<img src="gallery/tropi.jpg" width="49%" alt="Tropi mango soda: orange and cream, with lime">
<img src="gallery/still-waters.jpg" width="49%" alt="Still Waters retreats: brown and pale gold, with glowing gold">
</p>

## Needs

Python 3 with numpy, requests and Pillow, and an OpenAI API key (`OPENAI_API_KEY`). Renders cost about $0.05 each. The
check that reads every word back only runs on macOS.

## Install

```bash
npx skills add LemonFace0309/charles-skills --skill charles-hero-mockups
```

Add `-g` to install it for every project, or copy this folder into `~/.claude/skills/` (Claude Code) or
`~/.agents/skills/` (Codex).

## Use

```text
/charles-hero-mockups four heroes for a ceramics studio, from my reference folder
/charles-hero-mockups three hero directions for my app's landing page, from the screenshots in ./refs
```
