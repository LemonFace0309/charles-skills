// What scripts/check.mjs and scripts/build-site.mjs both need: the shelves, every skill on them, and its parts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO = 'LemonFace0309/charles-skills';
export const PAGES = 'https://lemonface0309.github.io/charles-skills';
export const SHELVES = ['design', 'editing', 'qol', 'drops'];

export const readJSON = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));

// Top-level `key: value` pairs from SKILL.md's frontmatter, with YAML quotes undone.
export function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v.startsWith('"') && v.endsWith('"') && v.length > 1) v = v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    else if (v.startsWith("'") && v.endsWith("'") && v.length > 1) v = v.slice(1, -1).replace(/''/g, "'");
    out[kv[1]] = v;
  }
  return out;
}

// Every folder two levels under skills/ that holds a SKILL.md: skills/<shelf>/<name>/.
export function listSkills() {
  const skills = [];
  const base = path.join(ROOT, 'skills');
  for (const shelf of fs.readdirSync(base, { withFileTypes: true })) {
    if (!shelf.isDirectory()) continue;
    for (const entry of fs.readdirSync(path.join(base, shelf.name), { withFileTypes: true })) {
      const dir = path.join(base, shelf.name, entry.name);
      if (!entry.isDirectory() || !fs.existsSync(path.join(dir, 'SKILL.md'))) continue;
      const readmeFile = path.join(dir, 'README.md');
      skills.push({
        name: entry.name,
        shelf: shelf.name,
        dir,
        rel: `skills/${shelf.name}/${entry.name}`,
        frontmatter: frontmatter(fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8')),
        readme: fs.existsSync(readmeFile) ? fs.readFileSync(readmeFile, 'utf8') : null,
      });
    }
  }
  return skills.sort((a, b) => SHELVES.indexOf(a.shelf) - SHELVES.indexOf(b.shelf) || a.name.localeCompare(b.name));
}

// The first picture in a README (markdown or <img>), as written.
export function firstImage(readme) {
  const md = readme.match(/!\[[^\]]*\]\(([^)\s]+)/);
  const html = readme.match(/<img[^>]*\ssrc="([^"]+)"/);
  const hits = [md && { at: md.index, src: md[1] }, html && { at: html.index, src: html[1] }].filter(Boolean);
  return hits.sort((a, b) => a.at - b.at)[0]?.src ?? null;
}

// The README's opening sentence or paragraph: the first prose after the title, pictures, badges and code.
export function pitch(readme) {
  const blocks = readme.replace(/```[\s\S]*?```/g, '').replace(/<!--[\s\S]*?-->/g, '').split(/\n\s*\n/);
  for (const raw of blocks) {
    const b = raw.trim();
    if (!b || /^(#|!\[|<|\[!\[|\||>)/.test(b)) continue;
    return b.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[`*_]/g, '').replace(/\s+/g, ' ').trim();
  }
  return '';
}

// Relative link and picture targets in a markdown file, with the line each sits on.
export function relativeTargets(text) {
  const out = [];
  const lines = text.split('\n');
  let fenced = false;
  lines.forEach((line, i) => {
    if (/^\s*```/.test(line)) fenced = !fenced;
    if (fenced) return;
    const found = [...line.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g), ...line.matchAll(/\s(?:src|href)="([^"]+)"/g)];
    for (const m of found) {
      const target = m[1];
      if (/^(https?:|mailto:|#|data:)/.test(target)) continue;
      out.push({ target: decodeURI(target.split('#')[0].split('?')[0]), line: i + 1, image: m[0].startsWith('!') || /src=/.test(m[0]) });
    }
  });
  return out;
}
