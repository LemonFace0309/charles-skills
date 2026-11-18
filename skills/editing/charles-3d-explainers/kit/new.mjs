#!/usr/bin/env bun
/* Starts a project from a voiceover: cuts the audio, transcribes it, and writes project.json and a plan to fill in.

     bun <kit>/new.mjs <project-dir> --audio <file.(m4a|mp3|wav|mp4|mov)> [--palette night-amber] [--from s --to s]
     bun <kit>/new.mjs <project-dir> --audio take.mov --words take.words.json     reuse a transcript instead of Scribe
     bun <kit>/new.mjs <project-dir> --audio vo.m4a --script script.txt          captions read exactly as written
     bun <kit>/new.mjs <project-dir> --audio edit.m4a --from 7.47 --to 12.93 --cut-out 12.43    a cutaway with handles

   Writes into <project-dir>:
     audio.m4a      the voiceover (cut to --from/--to), starting at 0
     words.json     word timings (ElevenLabs Scribe on fal, English; costs about a cent a minute; cached by audio)
     project.json   1080x1920, 30 fps, 16 samples, the palette, captions, no shots yet
     plan.md        a beat table with one row per sentence and its times, plus the numbers and pauses in the script
     shots/, assets/

   --from/--to are times in the source file (seconds, or m:ss.s). --words is a transcript of the source file as given
   (Scribe JSON or a [{text,start,end}] list); it is cut and shifted to match the new audio. --force redoes an existing
   project's audio, words and duration but keeps its shots, captions and other settings, and writes the new beat table
   to plan.new.md so a filled-in plan.md is never lost. --script puts the script's exact words (digits, names,
   punctuation) onto the recogniser's timings; the raw transcript is kept as words.scribe.json. --rescribe transcribes
   again instead of using the cached transcript. --fps, --samples and --lang change the defaults. --cut-out is a
   cutaway's out point in the source file's time (where the edit cuts back to the face; --to runs on past it as a
   handle): it is written as project.json `cutOut` in project time, which sets the last shot's k.out and check.mjs's
   out-point test. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { args } from './serve.mjs';
import { scribe } from './fal.mjs';

const KIT = path.dirname(new URL(import.meta.url).pathname);
const FF = fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';
const FP = fs.existsSync('/opt/homebrew/bin/ffprobe') ? '/opt/homebrew/bin/ffprobe' : 'ffprobe';
const VIDEO_EXT = new Set(['.mp4', '.mov', '.m4v', '.webm', '.mkv']);

const { pos, opt } = args(process.argv.slice(2), ['audio', 'palette', 'from', 'to', 'words', 'script', 'fps', 'samples', 'lang', 'cut-out']);
if (!pos[0] || !opt.audio) {
  console.error('usage: bun new.mjs <project-dir> --audio <file> [--palette night-amber] [--from s --to s] [--words words.json] [--force]');
  process.exit(1);
}
const fail = (m) => { console.error(m); process.exit(1); };
const DIR = path.resolve(pos[0]);
const SRC = path.resolve(opt.audio);
if (!fs.existsSync(SRC)) fail(`no such audio file: ${opt.audio}`);
if (fs.existsSync(path.join(DIR, 'project.json')) && !opt.force) fail(`${path.join(DIR, 'project.json')} already exists (pass --force to redo its audio and words; its shots are kept)`);

// palettes are read from look.js so this list never goes stale
const lookSrc = fs.readFileSync(path.join(KIT, 'engine/look.js'), 'utf8');
const block = lookSrc.slice(lookSrc.indexOf('export const PALETTES'), lookSrc.indexOf('export function palette'));
const PALETTES = [...block.matchAll(/^ {2}'?([a-z][a-z0-9-]*)'?\s*:\s*\{/gm)].map((m) => m[1]);
const PJ = path.join(DIR, 'project.json');
const existing = fs.existsSync(PJ) ? JSON.parse(fs.readFileSync(PJ, 'utf8')) : null;
const palette = opt.palette || existing?.palette || 'night-amber';
if (PALETTES.length && !PALETTES.includes(palette)) fail(`unknown palette "${palette}". Palettes: ${PALETTES.join(', ')}`);

// "12.5", "1:02.5" or "1:02:03" -> seconds
const secs = (v) => { if (v == null) return null; const p = String(v).split(':').map(Number); if (p.some(isNaN)) fail(`bad time: ${v}`); return p.reduce((a, x) => a * 60 + x, 0); };
const probe = (f) => {
  const r = spawnSync(FP, ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,codec_name', '-of', 'json', f], { encoding: 'utf8' });
  if (r.status !== 0) fail(`cannot read ${f}: ${r.stderr.trim()}`);
  const j = JSON.parse(r.stdout);
  return { duration: Number(j.format?.duration || 0), audio: (j.streams || []).find((s) => s.codec_type === 'audio'), video: (j.streams || []).some((s) => s.codec_type === 'video' && s.codec_name !== 'mjpeg' && s.codec_name !== 'png') };
};
const src = probe(SRC);
if (!src.audio) fail(`${opt.audio} has no audio track`);
const from = Math.max(0, secs(opt.from) ?? 0);
const to = Math.min(src.duration || Infinity, secs(opt.to) ?? Infinity);
if (!(to > from)) fail(`--to (${to}) must be after --from (${from})`);
const cut = from > 0 || (opt.to != null && to < src.duration - 0.01);

fs.mkdirSync(DIR, { recursive: true });
for (const d of ['shots', 'assets', 'out']) fs.mkdirSync(path.join(DIR, d), { recursive: true });

// ---- audio ----
const AUDIO = path.join(DIR, 'audio.m4a');
if (!cut && path.extname(SRC).toLowerCase() === '.m4a' && src.audio.codec_name === 'aac') fs.copyFileSync(SRC, AUDIO);
else {
  // video containers: pad the audio so it starts with the picture (phone footage often starts its audio late)
  const af = [];
  if (VIDEO_EXT.has(path.extname(SRC).toLowerCase()) || src.video) af.push('aresample=async=1:first_pts=0');
  if (cut) af.push('afade=t=in:d=0.01', `afade=t=out:st=${Math.max(0, to - from - 0.015).toFixed(3)}:d=0.015`);
  const ff = ['-v', 'error', '-y'];
  if (from > 0) ff.push('-ss', from.toFixed(3));
  if (Number.isFinite(to)) ff.push('-t', (to - from).toFixed(3));
  ff.push('-i', SRC, '-map', '0:a:0', '-vn');
  if (af.length) ff.push('-af', af.join(','));
  ff.push('-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', AUDIO);
  const r = spawnSync(FF, ff, { encoding: 'utf8' });
  if (r.status !== 0) fail(`ffmpeg could not write audio.m4a: ${r.stderr.trim()}`);
}
const audioDur = probe(AUDIO).duration;

// ---- words ----
let scribeJSON;
if (opt.words) {
  const raw = JSON.parse(fs.readFileSync(path.resolve(opt.words), 'utf8'));
  const list = Array.isArray(raw) ? raw : raw.words || [];
  const inside = list.filter((w) => +w.start >= from - 0.02 && +w.start < to - 0.02).map((w) => ({ ...w, start: +(Math.max(0, w.start - from)).toFixed(3), end: +(Math.min(to, w.end) - from).toFixed(3) }));
  const text = inside.filter((w) => !w.type || w.type === 'word').map((w) => String(w.text).trim()).join(' ');
  scribeJSON = { ...(Array.isArray(raw) ? {} : raw), text, words: inside };
  console.log(`words: ${inside.filter((w) => !w.type || w.type === 'word').length} from ${opt.words}`);
} else {
  try { scribeJSON = await scribe(AUDIO, { lang: opt.lang, force: !!opt.rescribe }); }
  catch (e) { fail(`transcription failed: ${e.message}\n(audio.m4a is written; rerun, or pass --words <file>)`); }
}
if (opt.script) {
  // Put the script's exact words (spelling, digits, punctuation) onto the recogniser's timings. Exact matches anchor
  // the alignment (longest common subsequence of normalised words); between anchors, the script's words share out the
  // time of whatever was heard there, so "30,000" written as "thirty thousand" becomes one word spanning both.
  fs.writeFileSync(path.join(DIR, 'words.scribe.json'), JSON.stringify(scribeJSON, null, 1));
  const heard = (scribeJSON.words || []).filter((w) => !w.type || w.type === 'word').map((w) => ({ text: String(w.text).trim(), start: +w.start, end: +w.end })).filter((w) => w.text);
  const said = fs.readFileSync(path.resolve(opt.script), 'utf8').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').split(/\s+/).filter(Boolean);
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const A = said.map(norm), B = heard.map((w) => norm(w.text));
  const L = Array.from({ length: A.length + 1 }, () => new Int32Array(B.length + 1));
  for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) L[i][j] = A[i] && A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const pairs = [];
  for (let i = 0, j = 0; i < A.length && j < B.length;) { if (A[i] && A[i] === B[j]) { pairs.push([i, j]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++; }
  const out = new Array(said.length);
  const fill = (i0, i1, j0, j1, t0, t1) => { // script words i0..i1-1 share heard words j0..j1-1, or the gap t0..t1
    if (i1 <= i0) return;
    const s = j1 > j0 ? heard[j0].start : t0, e = j1 > j0 ? heard[j1 - 1].end : Math.max(t0, t1);
    const weight = said.slice(i0, i1).map((w) => Math.max(1, norm(w).length));
    const total = weight.reduce((a, b) => a + b, 0);
    let acc = 0;
    for (let i = i0; i < i1; i++) { const a = s + (e - s) * (acc / total); acc += weight[i - i0]; out[i] = { text: said[i], start: +a.toFixed(3), end: +(s + (e - s) * (acc / total)).toFixed(3), type: 'word' }; }
  };
  let pi = 0, pj = 0, pt = 0;
  for (const [i, j] of [...pairs, [said.length, heard.length]]) {
    fill(pi, i, pj, j, pt, j < heard.length ? heard[j].start : audioDur);
    if (i < said.length) { out[i] = { text: said[i], start: heard[j].start, end: heard[j].end, type: 'word' }; pt = heard[j].end; }
    pi = i + 1; pj = j + 1;
  }
  const missed = said.length - pairs.length;
  console.log(`script: ${said.length} words, ${pairs.length} matched what was heard exactly, ${missed} timed from their neighbours${missed > said.length * 0.25 ? ' (more than a quarter: is this the right script for this audio?)' : ''}`);
  scribeJSON = { text: said.join(' '), words: out, source: { script: path.resolve(opt.script), scribe: 'words.scribe.json' } };
}
fs.writeFileSync(path.join(DIR, 'words.json'), JSON.stringify(scribeJSON, null, 1));
const words = (scribeJSON.words || []).filter((w) => !w.type || w.type === 'word').map((w) => ({ text: String(w.text).trim(), start: +w.start, end: +w.end })).filter((w) => w.text);
if (!words.length) console.warn('warning: the transcript has no words');

// ---- project.json ----
const fps = Number(opt.fps || existing?.fps || 30);
const lastEnd = words.length ? words[words.length - 1].end : audioDur;
// a window (--from/--to) is exactly its audio; a whole voiceover runs to the last word + 0.6 s, even past an audio file
// cut mid-word, so the reel has room to settle back on its opening image
const duration = Math.round((cut ? Math.min(audioDur, lastEnd + 0.6) : lastEnd + 0.6) * fps) / fps;
const fresh = {
  size: [1080, 1920], fps, samples: Number(opt.samples || 16), palette,
  audio: 'audio.m4a', words: 'words.json', duration: +duration.toFixed(3),
  captions: { highlight: [], mode: 'chunk' },
  shots: [],
  source: { file: SRC, from: +from.toFixed(3), to: +(Number.isFinite(to) ? to : src.duration).toFixed(3) },
};
const cutOutAt = secs(opt['cut-out']);
if (Number.isFinite(cutOutAt)) fresh.cutOut = +(cutOutAt - from).toFixed(3);
// redoing an existing project: new audio, words, duration and source; everything else (shots, captions...) is kept
const project = existing ? { ...fresh, ...existing, fps, palette, audio: fresh.audio, words: fresh.words, duration: fresh.duration, source: fresh.source, ...(opt.samples ? { samples: fresh.samples } : {}), ...(fresh.cutOut != null ? { cutOut: fresh.cutOut } : {}) } : fresh;
// one key per line, values on one line, like the example projects
const line = (v) => JSON.stringify(v, null, 1).replace(/\n\s*/g, ' ').replace(/\[ /g, '[').replace(/ \]/g, ']');
const value = (v) => (Array.isArray(v) && v.length && v.every((x) => x && typeof x === 'object') ? `[\n${v.map((x) => `    ${line(x)}`).join(',\n')}\n  ]` : line(v));
fs.writeFileSync(path.join(DIR, 'project.json'), '{\n' + Object.entries(project).map(([k, v]) => `  ${JSON.stringify(k)}: ${value(v)}`).join(',\n') + '\n}\n');

// ---- plan.md ----
const f2 = (x) => x.toFixed(2);
const cell = (s) => String(s).replace(/\|/g, '\\|');
const sentences = [];
let cur = [];
words.forEach((w, i) => {
  cur.push(w);
  const next = words[i + 1];
  if (!next || /[.!?]["')\]]*$/.test(w.text) || next.start - w.end > 1.0) { sentences.push(cur); cur = []; }
});
const NUMWORD = /^(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundreds?|thousands?|millions?|billions?|trillions?|dozens?|half|twice|percent|tenth|hundredth|thousandth|millionth|billionth)$/i;
const numbers = words.map((w, i) => ({ w, i })).filter(({ w }) => /\d|%|\$/.test(w.text) || NUMWORD.test(w.text.replace(/[^a-z]/gi, '')));
const pauses = words.slice(1).map((w, i) => ({ after: words[i], gap: w.start - words[i].end })).filter((p) => p.gap >= 0.35);
const name = path.basename(DIR);
const wps = words.length / Math.max(0.1, lastEnd - (words[0]?.start ?? 0));
const plan = `# ${name}

- Audio: \`audio.m4a\`, ${f2(audioDur)} s (project ${f2(duration)} s), ${words.length} words, ${wps.toFixed(1)} words a second
- Palette: ${palette}
- Hook (on screen from frame 0):
- Hero subject (the one thing the camera follows):
- Running number or clock (HUD), if any:

## Beats

One row per sentence, with its times in seconds. Split rows so something new lands about every second, and keep one
focal subject per frame. **visual** is what the viewer sees, **shot** is the file in \`shots/\`, **camera** is the move,
**overlays** are the hero number, HUD, labels and the caption highlight.

| start | end | words | visual | shot | camera | overlays |
|------:|----:|-------|--------|------|--------|----------|
${sentences.map((s) => `| ${f2(s[0].start)} | ${f2(s[s.length - 1].end)} | ${cell(s.map((w) => w.text).join(' '))} | | | | |`).join('\n')}

## Numbers

Candidates for a hero count-up, a HUD or a caption highlight.

${numbers.length ? numbers.map(({ w, i }) => `- ${f2(w.start)} s: ${cell([w.text, words[i + 1]?.text].filter(Boolean).join(' '))}`).join('\n') : '- none'}

## Pauses

Gaps of 0.35 s or more between words: the natural places for a cut or a new beat.

${pauses.length ? pauses.map((p) => `- ${f2(p.after.end)}-${f2(p.after.end + p.gap)} s (${f2(p.gap)} s) after "${cell(p.after.text)}"`).join('\n') : '- none'}

## Review loop

\`\`\`
bun ${KIT}/render.mjs . --stills 0,1.5,3        # look at single frames
bun ${KIT}/render.mjs . --draft                 # out/draft.mp4
bun ${KIT}/sheet.mjs out/draft.mp4              # one tile a second, with the words
bun ${KIT}/check.mjs out/draft.mp4              # stale spans, pops, cuts, events a second, caption speed
\`\`\`
`;
let planFile = path.join(DIR, 'plan.md');
if (fs.existsSync(planFile)) { planFile = path.join(DIR, 'plan.new.md'); console.log('plan.md exists: left as it is; the new beat table is in plan.new.md'); }
fs.writeFileSync(planFile, plan);

const n = (k, word) => `${k} ${word}${k === 1 ? '' : 's'}`;
console.log(`${DIR}
  audio.m4a    ${f2(audioDur)} s${cut ? ` (cut ${f2(from)}-${f2(Number.isFinite(to) ? to : src.duration)} s of ${path.basename(SRC)})` : ''}
  words.json   ${n(words.length, 'word')}, ${n(sentences.length, 'sentence')}
  project.json ${palette}, ${f2(duration)} s, ${project.shots.length ? `${n(project.shots.length, 'shot')} kept` : 'no shots yet'}
  ${path.basename(planFile).padEnd(12)} ${n(sentences.length, 'beat')} to fill in
next: fill in plan.md, write shots/*.js, list them in project.json "shots", then render stills.`);
