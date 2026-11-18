#!/usr/bin/env node
// Builds the short links into _site/: one page per skill name and one per comment keyword in site/links.json,
// each forwarding to the skill's folder on GitHub. .github/workflows/pages.yml publishes _site/ on every push.
//   node scripts/build-site.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, REPO, PAGES, listSkills, readJSON, firstImage, pitch } from './skills.mjs';

const OUT = path.join(ROOT, '_site');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function page({ title, description, image, target, url }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
${image ? `<meta property="og:image" content="${esc(image)}">\n<meta name="twitter:card" content="summary_large_image">\n` : ''}<meta http-equiv="refresh" content="0; url=${esc(target)}">
<link rel="canonical" href="${esc(target)}">
<script>location.replace(${JSON.stringify(target)})</script>
<style>body{margin:0;padding:48px 20px;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;color:#16181d;background:#fff}a{color:#2343e6}@media (prefers-color-scheme:dark){body{color:#e9ecf1;background:#0b0d11}a{color:#8296ff}}</style>
</head>
<body>
<p>Opening <a href="${esc(target)}">${esc(title)}</a> on GitHub…</p>
</body>
</html>
`;
}

function write(rel, html) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

fs.rmSync(OUT, { recursive: true, force: true });
const skills = listSkills();
const byName = new Map(skills.map((s) => [s.name, s]));
const links = readJSON('site/links.json');

function skillPage(s, slug) {
  const img = s.readme && firstImage(s.readme);
  return page({
    title: s.name,
    description: (s.readme && pitch(s.readme)) || s.frontmatter?.description || '',
    image: img && !/^https?:/.test(img) ? `https://raw.githubusercontent.com/${REPO}/main/${s.rel}/${img.replace(/^\.\//, '')}` : img,
    target: `https://github.com/${REPO}/tree/main/${s.rel}`,
    url: `${PAGES}/${slug}/`,
  });
}

for (const s of skills) write(`${s.name}/index.html`, skillPage(s, s.name));
for (const [keyword, name] of Object.entries(links)) {
  const s = byName.get(name);
  if (!s) throw new Error(`site/links.json: "${keyword}" points at ${name}, which isn't a skill`);
  write(`${keyword}/index.html`, skillPage(s, keyword));
}

const repo = `https://github.com/${REPO}`;
write('index.html', page({ title: "Charles' skills", description: 'Skills for Claude Code and Codex, from my reels.', target: repo, url: `${PAGES}/` }));

// Typed links arrive in any case (MOTION, Unslop): send those to the right page, everything else to the repo.
const slugs = [...skills.map((s) => s.name), ...Object.keys(links)];
write('404.html', `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Charles' skills</title>
<script>
(function () {
  var slugs = ${JSON.stringify(slugs)};
  var parts = location.pathname.replace(/\\/+$/, '').split('/');
  var last = (parts[parts.length - 1] || '').toLowerCase();
  if (slugs.indexOf(last) >= 0) location.replace('${PAGES}/' + last + '/');
  else location.replace(${JSON.stringify(repo)});
})();
</script>
<style>body{margin:0;padding:48px 20px;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;color:#16181d;background:#fff}a{color:#2343e6}@media (prefers-color-scheme:dark){body{color:#e9ecf1;background:#0b0d11}a{color:#8296ff}}</style>
</head>
<body>
<p>No skill lives at this address. <a href="${repo}">See every skill on GitHub</a>.</p>
</body>
</html>
`);
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

console.log(`_site/: ${skills.length} skill pages, ${Object.keys(links).length} keyword pages (${Object.keys(links).join(', ')})`);
