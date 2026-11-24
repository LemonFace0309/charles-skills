#!/usr/bin/env node
// Runs one skill's evals (its evals/ folder) with `claude plugin eval`, against this checkout.
//
//   node scripts/eval.mjs <skill> [triggers|outcomes|all] [--alone] [--with-drops] [--runs N] [-j N] [-- <more eval flags>]
//
//   triggers  (the default) the trigger-* and no-trigger-* cases, scored with no baseline arm, so each case checks
//             only whether the skill loaded
//   outcomes  the outcome-* cases, with a no-plugin baseline arm, so the report shows what the skill adds
//   all       every case
//
// By default the skill competes with every skill on the shelves Charles installs (design, editing, qol), as it does in
// a real session: a wrapper plugin in a temp folder links them all in, and copies the tested skill. --with-drops adds the drops shelf, and --alone
// loads the skill by itself. Each run is a full Claude Code session on your own login, so run this from a terminal
// that `claude auth status` shows as signed in. Reports stay on this computer (--no-publish).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listSkills } from './skills.mjs';

const argv = process.argv.slice(2);
const extra = argv.includes('--') ? argv.splice(argv.indexOf('--')).slice(1) : [];
const take = (flag) => {
  const i = argv.indexOf(flag);
  return i === -1 ? null : argv.splice(i, 2)[1];
};
const has = (flag) => (argv.includes(flag) ? (argv.splice(argv.indexOf(flag), 1), true) : false);
const runs = take('--runs');
const jobs = take('-j') ?? '2';
const alone = has('--alone');
const withDrops = has('--with-drops');
const [name, kind = 'triggers'] = argv;

const skills = listSkills();
const skill = skills.find((s) => s.name === name);
if (!skill || !['triggers', 'outcomes', 'all'].includes(kind)) {
  console.error(`usage: node scripts/eval.mjs <skill> [triggers|outcomes|all] [--alone] [--with-drops] [--runs N] [-j N] [-- flags]\nskills: ${skills.map((s) => s.name).join(', ')}`);
  process.exit(2);
}
if (!fs.existsSync(path.join(skill.dir, 'evals'))) {
  console.error(`${skill.rel}/evals/ doesn't exist yet`);
  process.exit(2);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `eval-${name}-`));
let target = skill.dir;
let evalDir = 'evals';
if (!alone) {
  // A plugin whose skills/ folder links in the real skill folders, so edits in this checkout are what gets tested.
  target = path.join(tmp, 'plugin');
  fs.mkdirSync(path.join(target, '.claude-plugin'), { recursive: true });
  fs.mkdirSync(path.join(target, 'skills'));
  fs.writeFileSync(path.join(target, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'charles-skills', version: '0.0.0', description: 'charles-skills, linked from a checkout for evals' }, null, 2));
  const shelves = new Set(['design', 'editing', 'qol', ...(withDrops ? ['drops'] : [])]);
  for (const s of skills) {
    if (!shelves.has(s.shelf) && s.name !== name) continue;
    // Each skill's own files are linked in one by one, leaving out its evals/: the eval runner collects every case it
    // finds in the plugin, so another skill's cases would run too.
    const dir = path.join(target, 'skills', s.name);
    fs.mkdirSync(dir);
    if (s.name === name) {
      // The tested skill is copied in for real, without its evals/ and node_modules: the eval sandbox refuses a read
      // through a link that leaves the plugin, so an outcome run couldn't open a linked references/ or looks/ file
      // and planned from SKILL.md alone (25 Nov 2026).
      fs.cpSync(s.dir, dir, { recursive: true, filter: (src) => {
        const parts = path.relative(s.dir, src).split(path.sep);
        return parts[0] !== 'evals' && !parts.includes('node_modules');
      } });
      continue;
    }
    for (const entry of fs.readdirSync(s.dir)) if (entry !== 'evals') fs.symlinkSync(path.join(s.dir, entry), path.join(dir, entry));
  }
  // The eval dir must be a real folder inside the plugin (a link that leaves it is refused), so this skill's cases are
  // copied in, without earlier results.
  fs.cpSync(path.join(skill.dir, 'evals'), path.join(target, 'evals'), { recursive: true, filter: (src) => path.basename(src) !== 'results' });
}

const out = path.join(tmp, 'result.json');
const report = path.join(tmp, 'report.html');
const args = ['plugin', 'eval', target, '--eval-dir', evalDir, '--no-publish', '--trust-plugin',
  '--json', out, '--report', report, '--output-dir', path.join(tmp, 'results'), '-j', jobs];
if (kind === 'triggers') args.push('--case', '*trigger-*', '--ablation', 'none');
if (kind === 'outcomes') args.push('--case', 'outcome-*', '--allow-tools', 'Bash', 'Write', 'Edit');
if (kind === 'all') args.push('--allow-tools', 'Bash', 'Write', 'Edit');
if (runs) args.push('--runs', runs);
args.push(...extra);

console.log(`${kind} for ${name}${alone ? ' (alone)' : ''}: claude ${args.join(' ')}\n`);
const run = spawnSync('claude', args, { stdio: 'inherit' });
if (!fs.existsSync(out)) process.exit(run.status ?? 1);

const result = JSON.parse(fs.readFileSync(out, 'utf8'));
if (result.partialReason === 'auth_failed') console.log('\nNot signed in: run this from a terminal where `claude auth status` says loggedIn.');
let failed = 0;
for (const c of result.cases) {
  const arm = c.arms.with ?? [];
  const passed = arm.filter((r) => r.passed).length;
  failed += passed < arm.length;
  console.log(`${passed === arm.length ? 'pass' : 'FAIL'}  ${c.name}  ${passed}/${arm.length}` + (c.arms.without ? `  (baseline ${c.arms.without.filter((r) => r.passed).length}/${c.arms.without.length})` : ''));
  for (const r of arm) {
    if (r.error) console.log(`        error: ${r.error}`);
    for (const g of r.graders ?? []) if (!g.passed) console.log(`        ${g.name}: ${g.explanation}`);
  }
}
console.log(`\n${result.cases.length - failed}/${result.cases.length} cases passed, $${(result.costUsd ?? 0).toFixed(2)}. Report: ${report}`);
process.exit(failed ? 1 : 0);
