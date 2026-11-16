# charles-accent-heroes

Makes landing-page hero images that read like posters: one striking subject, big type tied to it, a quiet interface and
one bold accent colour. Each page is a close variation of a reference screenshot you give it, rendered with GPT Image,
then checked and fixed with small edits.

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

## Use

```text
/charles-accent-heroes four heroes for a ceramics studio, from my reference folder
/charles-accent-heroes one hero for my dance studio, from the screenshots in ./refs
```
