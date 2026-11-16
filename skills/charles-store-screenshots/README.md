# charles-store-screenshots

Designs App Store and Play Store screenshot sets: a two-frame hook, frames that run into each other like one picture,
and your real app UI at its best moment. Each set is built in HTML from your captures and photos, rendered to Apple's
exact iPhone, iPad and iPhone Duo sizes, and checked at search-result size.

## Needs

Python 3 with Playwright, Pillow and requests, and Google Chrome. Generated art needs an OpenAI API key
(`OPENAI_API_KEY`), and photo cutouts need a fal.ai key (`FAL_KEY`).

## Use

```text
/charles-store-screenshots three App Store screenshot sets for my habit tracker, from the captures in ./shots
/charles-store-screenshots critique my current screenshots in ./store
```
