#!/usr/bin/env node
// Checks the repo the way the installer and a visitor see it. Errors fail the run; warnings are a to-do list.
//   node scripts/check.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, REPO, SHELVES, listSkills, readJSON, relativeTargets } from './skills.mjs';

const errors = [];
const warnings = [];
const err = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const IMAGE_KB = 400;

// Only the four shelves sit in skills/, each with a README.
for (const e of fs.readdirSync(path.join(ROOT, 'skills'), { withFileTypes: true })) {
  if (e.isDirectory() && !SHELVES.includes(e.name)) err(`skills/${e.name}/ isn't a shelf (${SHELVES.join(', ')})`);
  if (e.isFile()) err(`skills/${e.name}: only the shelves belong in skills/`);
}
for (const shelf of SHELVES) {
  if (!exists(`skills/${shelf}/README.md`)) err(`skills/${shelf}/README.md is missing`);
}

// Each skill: a valid SKILL.md and a README with its install line.
const skills = listSkills();
const byName = new Map();
for (const s of skills) {
  if (byName.has(s.name)) err(`${s.rel}: same name as ${byName.get(s.name).rel}`);
  byName.set(s.name, s);
  if (!/^charles-[a-z0-9]+(-[a-z0-9]+)*$/.test(s.name)) err(`${s.rel}: a skill folder is charles- plus lowercase words and hyphens`);
  const fm = s.frontmatter;
  if (!fm) { err(`${s.rel}/SKILL.md has no frontmatter`); continue; }
  if (fm.name !== s.name) err(`${s.rel}/SKILL.md: name is "${fm.name}" but the folder is "${s.name}"`);
  if (!fm.description) err(`${s.rel}/SKILL.md has no description`);
  else if (fm.description.length > 1024) err(`${s.rel}/SKILL.md: the description is ${fm.description.length} characters, over the 1,024 limit`);
  if (!s.readme) { err(`${s.rel}/README.md is missing`); continue; }
  const install = `npx skills add ${REPO} --skill ${s.name}`;
  if (!s.readme.includes(install)) err(`${s.rel}/README.md has no install line (${install})`);
  const top = s.readme.split('\n').slice(0, 8).join('\n');
  const textOnly = s.readme.includes('<!-- text-only -->');   // Charles chose no picture for this skill
  if (!textOnly && !/!\[[^\]]*\]\(|<img\s|<video\s/.test(top)) warn(`${s.rel}/README.md: no picture or clip straight under the title`);
}

// Every relative link and picture in a README points at a file that exists; pictures stay small.
const readmes = ['README.md', 'site/README.md', ...SHELVES.map((s) => `skills/${s}/README.md`), ...skills.filter((s) => s.readme).map((s) => `${s.rel}/README.md`)];
for (const file of readmes.filter(exists)) {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  for (const { target, line, image } of relativeTargets(text)) {
    const abs = path.resolve(path.dirname(path.join(ROOT, file)), target);
    if (!abs.startsWith(ROOT) || !fs.existsSync(abs)) { err(`${file}:${line} links to ${target}, which doesn't exist`); continue; }
    if (image && /\.(png|jpe?g|gif|webp)$/i.test(abs)) {
      const kb = fs.statSync(abs).size / 1024;
      if (kb > IMAGE_KB) warn(`${file}:${line}: ${target} is ${Math.round(kb)} KB (keep pictures under ${IMAGE_KB} KB)`);
    }
  }
}

// The root README and each shelf README list every skill they hold.
const root = exists('README.md') ? fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8') : '';
for (const s of skills) {
  if (!root.includes(`${s.rel}`)) err(`README.md doesn't link to ${s.rel}`);
  const shelfFile = `skills/${s.shelf}/README.md`;
  if (exists(shelfFile) && !fs.readFileSync(path.join(ROOT, shelfFile), 'utf8').includes(`(${s.name}`)) err(`${shelfFile} doesn't link to ${s.name}`);
}

// One plugin per shelf in the marketplace, listing exactly the skills on that shelf.
const market = readJSON('.claude-plugin/marketplace.json');
const plugins = new Map(market.plugins.map((p) => [p.name, p]));
for (const shelf of SHELVES) {
  const p = plugins.get(shelf);
  if (!p) { err(`.claude-plugin/marketplace.json has no "${shelf}" plugin`); continue; }
  const listed = new Set((p.skills ?? []).map((x) => x.replace(/^\.\//, '').replace(/\/$/, '')));
  const actual = new Set(skills.filter((s) => s.shelf === shelf).map((s) => s.rel));
  for (const rel of actual) if (!listed.has(rel)) err(`marketplace.json: "${shelf}" doesn't list ${rel}`);
  for (const rel of listed) if (!actual.has(rel)) err(`marketplace.json: "${shelf}" lists ${rel}, which isn't a skill on that shelf`);
}
for (const name of plugins.keys()) if (!SHELVES.includes(name)) err(`marketplace.json: "${name}" isn't a shelf`);

// Every comment keyword leads to a skill that exists.
for (const [keyword, name] of Object.entries(readJSON('site/links.json'))) {
  if (!/^[a-z0-9-]+$/.test(keyword)) err(`site/links.json: "${keyword}" should be lowercase letters, digits and hyphens`);
  if (!byName.has(name)) err(`site/links.json: "${keyword}" points at ${name}, which isn't a skill here`);
  if (byName.has(keyword)) err(`site/links.json: "${keyword}" is already a skill name`);
}

for (const w of warnings) console.log(`warning  ${w}`);
for (const e of errors) console.log(`error    ${e}`);
console.log(`\n${skills.length} skills on ${SHELVES.length} shelves: ${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
