#!/usr/bin/env bun
/* Contact sheets for review: frames of a video laid out as tiles, each with its time, its shot and the words spoken.

     bun <kit>/sheet.mjs <video.mp4>                                one tile a second
     bun <kit>/sheet.mjs <video.mp4> --every 0.5 --from 4 --to 12   a closer look at one stretch
     bun <kit>/sheet.mjs <video.mp4> --times 0,1.2,3.4              just those moments
     bun <kit>/sheet.mjs <video.mp4> --strip 8.3 [--span 0.8] [--fps 12]   a filmstrip around 8.3 s, for motion and cuts
     bun <kit>/sheet.mjs <video.mp4> --compare other.mp4 [--offset 0]     the same times of two videos in pairs

   --compare puts the first video on the left (A) and the other on the right (B), at t + offset; it works with every
   mode above. --strip takes several times (3.2,8.1) and writes one strip for each.
   Options: --words <words.json | project dir> (found by itself when the video sits in <project>/out/), --no-words,
            --no-project (no shot names or words), --start <s> (project time of the first frame; read from the render log),
            --cols 6, --width 270 (px per frame), --rows 4 (rows per image; longer sheets become -p1, -p2, ...),
            --out file.jpg (or .png), --keep (keep the extracted frames).
   Default output: next to the video, <name>.sheet.jpg, <name>.strip-<t>.jpg or <name>-vs-<other>.sheet.jpg.
   It prints the path of every image it writes. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { args } from './serve.mjs';

const KIT = path.dirname(new URL(import.meta.url).pathname);
const FF = fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';
const FP = fs.existsSync('/opt/homebrew/bin/ffprobe') ? '/opt/homebrew/bin/ffprobe' : 'ffprobe';
export const CHROME = process.env.CHROME_PATH || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => fs.existsSync(p));

// ---------- shared helpers (check.mjs uses these too) ----------
export function probe(file) {
  const r = spawnSync(FP, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,avg_frame_rate,nb_frames,duration:format=duration', '-of', 'json', file], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`cannot read ${file}: ${r.stderr.trim()}`);
  const j = JSON.parse(r.stdout), s = j.streams?.[0];
  if (!s) throw new Error(`${file} has no video stream`);
  const rate = (x) => { const [a, b] = String(x || '0/1').split('/').map(Number); return b ? a / b : a; };
  const fps = rate(s.avg_frame_rate) || rate(s.r_frame_rate) || 30;
  const duration = Number(s.duration || j.format?.duration || 0);
  const frames = Number(s.nb_frames) || Math.round(duration * fps);
  return { file, width: s.width, height: s.height, fps, duration, frames, start: renderStart(file) };
}

// Project time of a video's first frame: render.mjs --from writes it to <name>.log.json next to the video.
export function renderStart(file) {
  const log = path.join(path.dirname(file), path.basename(file, path.extname(file)) + '.log.json');
  try { const j = JSON.parse(fs.readFileSync(log, 'utf8')); return Number.isFinite(+j.from) ? +j.from : 0; } catch { return 0; }
}

// The project a video belongs to: --words <dir>, or the folder above out/, or the video's own folder.
export function findProject(video, hint) {
  const candidates = hint ? [path.resolve(hint)] : [path.dirname(path.resolve(video)), path.dirname(path.dirname(path.resolve(video)))];
  for (const d of candidates) if (fs.existsSync(path.join(d, 'project.json')) && fs.statSync(d).isDirectory()) return { dir: d, project: JSON.parse(fs.readFileSync(path.join(d, 'project.json'), 'utf8')) };
  return null;
}

// Files that changed after the video was rendered, so the video may not show the current project: the project's
// json, words, globals and shots, and the engine. Measured from when the render started (render.mjs logs its length).
export function outdated(video, projDir) {
  let since, rendered = false;
  try {
    since = fs.statSync(video).mtimeMs;
    const log = path.join(path.dirname(video), path.basename(video, path.extname(video)) + '.log.json');
    if (fs.existsSync(log)) { rendered = true; since -= (Number(JSON.parse(fs.readFileSync(log, 'utf8')).seconds) || 0) * 1000; }
  } catch { return []; }
  if (!projDir && !rendered) return []; // not a render of this kit: nothing to compare with
  const out = [];
  const look = (f, name) => { try { const st = fs.statSync(f); if (st.isFile() && st.mtimeMs > since + 1000) out.push(name); } catch {} };
  const walk = (dir, name, re) => { try { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { if (e.isDirectory()) walk(path.join(dir, e.name), `${name}/${e.name}`, re); else if (re.test(e.name)) look(path.join(dir, e.name), `${name}/${e.name}`); } } catch {} };
  if (projDir) {
    const pj = path.join(projDir, 'project.json'); look(pj, 'project.json');
    let project = {}; try { project = JSON.parse(fs.readFileSync(pj, 'utf8')); } catch {}
    for (const k of ['words', 'globals']) if (typeof project[k] === 'string') look(path.join(projDir, project[k]), project[k]);
    for (const sh of project.shots || []) if (sh.file) look(path.join(projDir, sh.file), sh.file);
  }
  walk(path.join(KIT, 'engine'), 'kit/engine', /\.(js|css|html)$/);
  return out;
}

// Words and caption chunks exactly as the engine shows them: ui.js captionChunks (a highlighted phrase stays in one
// chunk) and captionTimes (the same on-screen times, the first chunk up from frame 0 when the voice starts within
// leadIn).
export async function captionTimeline(wordsFile, cfg = {}) {
  const { loadWords, captionChunks, captionTimes } = await import('./engine/ui.js');
  const words = loadWords(JSON.parse(fs.readFileSync(wordsFile, 'utf8')));
  const { chunks } = captionChunks(words, cfg);
  const times = captionTimes(chunks, cfg);
  const rep = cfg.replace || {};
  const shown = (w) => rep[w.text] ?? rep[w.text.toLowerCase()] ?? rep[w.n] ?? w.text;
  const caps = chunks.map((c, i) => ({ words: c, text: c.map(shown).join(' '), start: Math.max(0, times[i][0]), end: times[i][1] }));
  return { words, caps };
}

// The shot list as seq.js resolves it (sorted, each ending where the next begins, transitions with their default
// durations).
const TDUR = { cut: 0, fade: 0.4, dip: 0.4, zoom: 0.6, whip: 0.4, light: 0.5 };
export function shotList(project, duration) {
  const defs = (project?.shots || []).map((d) => ({ ...d })).sort((a, b) => a.start - b.start);
  defs.forEach((d, i) => {
    if (d.end == null) d.end = defs[i + 1] ? defs[i + 1].start : project.duration ?? duration;
    const tin = typeof d.in === 'string' ? { type: d.in } : { ...(d.in || { type: 'cut' }) };
    tin.dur = tin.type === 'cut' ? 0 : tin.dur ?? TDUR[tin.type] ?? 0.5;
    d.in = tin;
  });
  return defs;
}

// Run async jobs with a concurrency limit.
export async function pool(items, n, fn) {
  const out = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); } }));
  return out;
}

const run = (cmd, argv) => new Promise((res, rej) => {
  const p = spawn(cmd, argv, { stdio: ['ignore', 'ignore', 'pipe'] }); let err = '';
  p.stderr.on('data', (d) => (err += d)); p.on('close', (c) => (c === 0 ? res() : rej(new Error(`${path.basename(cmd)} failed: ${err.trim().slice(0, 500)}`))));
});

// One frame (by index) as a PNG scaled to `width`. The seek lands a third of a frame early so the frame itself is kept.
export function grab(video, n, fps, width, file) {
  const at = Math.max(0, (n - 0.3) / fps);
  return run(FF, ['-v', 'error', '-y', '-ss', at.toFixed(4), '-i', video, '-frames:v', '1', '-vf', `scale=${width}:-2:flags=lanczos`, '-update', '1', file]);
}

// Render HTML files to images with headless Chrome (full page). outs[i] gets the screenshot of htmlFiles[i].
export async function shootHTML(htmlFiles, outs, width) {
  if (!CHROME) throw new Error('Google Chrome not found: set CHROME_PATH');
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--force-color-profile=srgb', '--allow-file-access-from-files'] });
  try {
    const page = await browser.newPage({ viewport: { width: Math.ceil(width), height: 100 }, deviceScaleFactor: 1 });
    for (let i = 0; i < htmlFiles.length; i++) {
      await page.goto('file://' + htmlFiles[i]);
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; })))); });
      const jpg = /\.jpe?g$/i.test(outs[i]);
      fs.mkdirSync(path.dirname(outs[i]), { recursive: true });
      await page.screenshot({ path: outs[i], fullPage: true, type: jpg ? 'jpeg' : 'png', quality: jpg ? 90 : undefined });
    }
  } finally { await browser.close(); }
}

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const fontCSS = ['500', '600', '700', '800'].map((w) => `@font-face{font-family:Inter;font-weight:${w};src:url(file://${KIT}/fonts/Inter-${w}.woff2) format('woff2')}`).join('');

// ---------- CLI ----------
if (import.meta.main) {
  const { pos, opt } = args(process.argv.slice(2), ['every', 'times', 'words', 'cols', 'width', 'out', 'strip', 'span', 'fps', 'compare', 'offset', 'rows', 'from', 'to', 'start']);
  if (!pos[0]) { console.error('usage: bun sheet.mjs <video.mp4> [--every 1] [--times a,b] [--strip t --span 0.8 --fps 12] [--compare other.mp4 --offset 0] [--words words.json] [--cols 6] [--width 270] [--out file.jpg]'); process.exit(1); }
  const fail = (m) => { console.error(m); process.exit(1); };
  const A = probe(path.resolve(pos[0]));
  if (opt.start != null) A.start = Number(opt.start);
  const B = opt.compare ? probe(path.resolve(opt.compare)) : null;
  const offset = Number(opt.offset || 0);
  const cols = Math.max(1, Number(opt.cols || 6));
  const tileW = Math.max(60, Math.round(Number(opt.width || 270) / 2) * 2);
  const rowsPer = Math.max(1, Number(opt.rows || 4));
  const pairs = !!B;
  const perRow = pairs ? Math.max(1, Math.floor(cols / 2)) : cols;
  // Times are project times: a partial render (render.mjs --from 8) starts at 8, so its frame 0 is at 8 s.
  const frameOf = (V, T) => Math.max(0, Math.min(V.frames - 1, Math.round((T - V.start) * V.fps)));
  const has = (V, T) => T >= V.start - 0.5 / V.fps && T < V.start + V.duration;
  const timeOf = (V, n) => V.start + n / V.fps;

  // words, captions and shots
  let proj = null, wordsFile = null;
  if (opt.words && fs.existsSync(opt.words) && fs.statSync(opt.words).isFile()) { wordsFile = path.resolve(opt.words); proj = findProject(path.join(path.dirname(wordsFile), 'x'), path.dirname(wordsFile)); }
  else if (!opt['no-project']) { proj = findProject(A.file, opt.words); if (opt.words && !proj) fail(`no project.json in ${opt.words}`); if (proj?.project.words) wordsFile = path.join(proj.dir, proj.project.words); }
  if (opt['no-words']) wordsFile = null;
  const tl = wordsFile && fs.existsSync(wordsFile) ? await captionTimeline(wordsFile, proj?.project.captions || {}) : null;
  const shots = proj ? shotList(proj.project, A.start + A.duration) : [];
  const old = outdated(A.file, proj?.dir);
  if (old.length) console.error(`warning: ${path.basename(A.file)} is older than ${old.slice(0, 3).join(', ')}${old.length > 3 ? ` and ${old.length - 3} more` : ''}; render it again to see the current project`);
  const shotAt = (t) => { let s = null; for (const d of shots) if (d.start <= t + 1e-6) s = d; return s; };

  // the tiles of each output image
  const jobs = []; // { title, sub, times: [project time], center?, out }
  const base = path.join(path.dirname(A.file), path.basename(A.file, path.extname(A.file)));
  const outFor = (suffix) => (opt.out ? path.resolve(opt.out) : base + (B ? `-vs-${path.basename(B.file, path.extname(B.file))}` : '') + suffix + '.jpg');
  if (opt.strip) {
    const span = Number(opt.span || 0.8), sfps = Number(opt.fps || 12);
    const centers = String(opt.strip).split(',').map(Number).filter((x) => !isNaN(x));
    for (const c of centers) {
      if (!has(A, c)) fail(`${c} s is outside ${path.basename(A.file)} (${A.start.toFixed(2)}-${(A.start + A.duration).toFixed(2)} s)`);
      const m = Math.max(1, Math.round((span * sfps) / 2));
      const seen = new Set(), times = [];
      for (let k = -m; k <= m; k++) { const n = frameOf(A, c + k / sfps); if (!seen.has(n)) { seen.add(n); times.push(timeOf(A, n)); } }
      let out = outFor(`.strip-${c.toFixed(2)}`);
      if (opt.out && centers.length > 1) out = out.replace(/(\.\w+)$/, `-${c.toFixed(2)}$1`);
      jobs.push({ title: `filmstrip at ${c.toFixed(2)} s`, sub: `${sfps} fps, ${(times[times.length - 1] - times[0]).toFixed(2)} s span`, times, center: frameOf(A, c), out, strip: true });
    }
  } else {
    let times;
    if (opt.times) times = String(opt.times).split(',').map(Number).filter((x) => !isNaN(x));
    else {
      // the whole video, or the stretch both videos cover when comparing
      let lo = A.start, hi = A.start + A.duration;
      if (B && Math.max(lo, B.start - offset) < Math.min(hi, B.start + B.duration - offset)) { lo = Math.max(lo, B.start - offset); hi = Math.min(hi, B.start + B.duration - offset); }
      const every = Number(opt.every || 1), from = Number(opt.from ?? lo), to = Math.min(Number(opt.to ?? hi), hi - 0.5 / A.fps);
      times = []; for (let t = from; t <= to + 1e-6; t += every) times.push(+t.toFixed(4));
      if (!times.length) fail('no times in that range');
    }
    jobs.push({ title: opt.times ? `${times.length} moments` : `one frame every ${Number(opt.every || 1)} s`, sub: '', times, out: outFor('.sheet') });
  }

  // extract frames
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sheet-'));
  const want = new Map(); // key -> { V, n, file }
  const keyOf = (V, n) => `${V === A ? 'A' : 'B'}${n}`;
  for (const j of jobs) for (const t of j.times) {
    if (has(A, t)) want.set(keyOf(A, frameOf(A, t)), { V: A, n: frameOf(A, t) });
    if (B && has(B, t + offset)) want.set(keyOf(B, frameOf(B, t + offset)), { V: B, n: frameOf(B, t + offset) });
  }
  const items = [...want.entries()];
  await pool(items, 8, async ([k, w]) => { w.file = path.join(tmp, k + '.png'); await grab(w.V.file, w.n, w.V.fps, tileW, w.file); });
  const imgH = (V) => Math.round((tileW * V.height) / V.width / 2) * 2;
  const tileH = Math.max(imgH(A), B ? imgH(B) : 0);

  // what is on screen and being said at t
  const wordsAt = (t) => {
    if (!tl) return '';
    const c = tl.caps.find((x) => t >= x.start && t < x.end);
    if (!c) { const nx = tl.words.find((w) => w.start > t); return `<span class="quiet">${nx && nx.start - t < 1.5 ? 'next: ' + esc(nx.text) : 'no caption'}</span>`; }
    let cur = -1; c.words.forEach((w, i) => { if (w.start <= t + 0.02) cur = i; });
    return c.words.map((w, i) => `<span class="${i === cur && t < w.end + 0.15 ? 'now' : i > cur ? 'later' : ''}">${esc(w.text)}</span>`).join(' ');
  };

  const pageW = 2 * 24 + perRow * (pairs ? 2 * tileW + 6 : tileW) + (perRow - 1) * 14;
  const css = `${fontCSS}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0c0d10;color:#e9ecf2;font-family:Inter,system-ui,sans-serif;width:${pageW}px;padding:20px 24px 26px;-webkit-font-smoothing:antialiased}
  header{display:flex;justify-content:space-between;align-items:baseline;gap:20px;margin-bottom:16px;font-size:17px;font-weight:600;letter-spacing:-.01em}
  header .r{color:#9aa1ad;font-weight:500;font-size:15px;text-align:right}
  header b{color:#fff;font-weight:700}
  .grid{display:grid;grid-template-columns:repeat(${perRow},auto);gap:18px 14px;justify-content:start}
  figure{width:${pairs ? 2 * tileW + 6 : tileW}px}
  .imgs{display:flex;gap:6px;height:${tileH}px}
  .im{position:relative;width:${tileW}px;height:${tileH}px;background:#000;border-radius:6px;overflow:hidden;outline:1px solid #262a33}
  .im img{display:block;width:${tileW}px}
  .im .ab{position:absolute;left:6px;top:6px;font-size:13px;font-weight:800;background:rgba(0,0,0,.6);color:#fff;padding:1px 7px 2px;border-radius:5px}
  .im.none{display:flex;align-items:center;justify-content:center;color:#5b616c;font-size:14px}
  figure.newshot .im{outline:2px solid #5aa8ff}
  figure.center .im{outline:3px solid #ffb43c}
  figcaption{padding-top:7px}
  .meta{display:flex;gap:8px;align-items:baseline;font-size:15px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden}
  .meta .f{color:#7d8491;font-weight:500;font-size:13px}
  .meta .shot{margin-left:auto;color:#8fc2ff;font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis}
  figure.newshot .meta .shot{color:#5aa8ff;font-weight:800}
  .words{margin-top:3px;font-size:15px;font-weight:500;line-height:1.3;color:#c9ced8;height:2.6em;overflow:hidden}
  .words .now{color:#ffb43c;font-weight:800}
  .words .later{color:#6c727d}
  .words .quiet{color:#565c66;font-style:italic}
  .warn{margin:-4px 0 14px;color:#ff8a7a;font-size:15px;font-weight:600}`;

  const written = [], allHtml = [], allOut = [];
  for (const j of jobs) {
    const per = perRow * rowsPer;
    const pages = []; for (let i = 0; i < j.times.length; i += per) pages.push(j.times.slice(i, i + per));
    const htmls = [], outs = [];
    pages.forEach((times, pi) => {
      const figs = times.map((t) => {
        const inA = has(A, t), nA = frameOf(A, t), tA = inA ? timeOf(A, nA) : t;
        const s = shotAt(tA), prevT = j.times[j.times.indexOf(t) - 1];
        const newShot = s && prevT != null && shotAt(prevT) !== s;
        const none = '<div class="im none">no frame</div>';
        const im = (V, n, label) => { const w = want.get(keyOf(V, n)); return w && fs.existsSync(w.file) ? `<div class="im"><img src="file://${w.file}">${label ? `<span class="ab">${label}</span>` : ''}</div>` : none; };
        const imgs = (inA ? im(A, nA, pairs ? 'A' : '') : none) + (B ? (has(B, tA + offset) ? im(B, frameOf(B, tA + offset), 'B') : none) : '');
        const cls = [j.strip && nA === j.center ? 'center' : '', newShot ? 'newshot' : ''].join(' ');
        return `<figure class="${cls}"><div class="imgs">${imgs}</div><figcaption><div class="meta"><span>${tA.toFixed(j.strip ? 3 : 2)} s</span><span class="f">f${nA}</span>${s ? `<span class="shot">${newShot ? 'new: ' : ''}${esc(s.id)}</span>` : ''}</div>${tl ? `<div class="words">${wordsAt(tA)}</div>` : ''}</figcaption></figure>`;
      }).join('');
      const who = B ? `A <b>${esc(path.basename(A.file))}</b> &nbsp;·&nbsp; B <b>${esc(path.basename(B.file))}</b>${B.start ? ` (starts at ${B.start.toFixed(2)} s)` : ''}${offset ? ` (shifted ${offset > 0 ? '+' : ''}${offset} s)` : ''}` : `<b>${esc(path.basename(A.file))}</b>`;
      const span = A.start ? `${A.start.toFixed(2)}-${(A.start + A.duration).toFixed(2)} s of the project` : `${A.duration.toFixed(2)} s`;
      const info = `${span} · ${A.width}×${A.height} · ${+A.fps.toFixed(3)} fps · ${j.title}${j.sub ? ' · ' + j.sub : ''}${pages.length > 1 ? ` · page ${pi + 1}/${pages.length}` : ''}`;
      const warn = old.length ? `<div class="warn">Older than ${esc(old.slice(0, 3).join(', '))}${old.length > 3 ? ` and ${old.length - 3} more` : ''}: this render may not show the current project.</div>` : '';
      const html = `<!doctype html><meta charset="utf-8"><style>${css}</style><header><div>${who}</div><div class="r">${info}${proj ? ` · ${esc(path.basename(proj.dir))}` : ''}</div></header>${warn}<div class="grid">${figs}</div>`;
      const hf = path.join(tmp, `page-${written.length + pi}.html`); fs.writeFileSync(hf, html); htmls.push(hf);
      outs.push(pages.length > 1 ? j.out.replace(/(\.\w+)$/, `-p${pi + 1}$1`) : j.out);
    });
    allHtml.push(...htmls); allOut.push(...outs);
    written.push(...outs);
  }
  await shootHTML(allHtml, allOut, pageW);
  if (!opt.keep) fs.rmSync(tmp, { recursive: true, force: true });
  for (const f of written) console.log(f);
}
