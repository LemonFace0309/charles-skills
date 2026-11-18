# Short links

Every skill has a link that keeps working wherever its folder moves:

```text
https://lemonface0309.github.io/charles-skills/<skill name>/    e.g. …/charles-unslop/
https://lemonface0309.github.io/charles-skills/<keyword>/       e.g. …/motion/
```

ManyChat's "Get the skill" buttons use the keyword links, never a GitHub folder URL. `links.json` maps each comment
keyword to a skill name. When a reel gets a new keyword, add it there and point the button at
`https://lemonface0309.github.io/charles-skills/<keyword>/`.

`scripts/build-site.mjs` turns the skills and `links.json` into the pages, and `.github/workflows/pages.yml` publishes
them on every push to `main`. Each page forwards to the skill's folder on GitHub and carries its title, first line and
picture for link previews. Build it locally with `node scripts/build-site.mjs` (it writes `_site/`, which git ignores).
