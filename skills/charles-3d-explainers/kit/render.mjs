#!/usr/bin/env bun
/* Renders a project to video, one frame at a time, in headless Chrome on the GPU.

     bun <kit>/render.mjs <project>                 final: 1080x1920, project.samples (16) sub-frames, PNG frames
     bun <kit>/render.mjs <project> --draft         quick look: half size, 1 sample, JPEG frames, fast encode
     bun <kit>/render.mjs <project> --from 3 --to 9  just that span (audio is cut to match)
     bun <kit>/render.mjs <project> --stills 1.2,4.5,7  PNG stills at those times instead of a clip (into out/stills/),
                                                    each with its tone (YAVG, YLOW, YHIGH, SATAVG) against look.md
     bun <kit>/render.mjs <project> --audit         also check overlay layout (safe areas, collisions, type over bright
                                                    3D, labels whose anchor is off-screen) at every shot

   Options: --samples N, --scale S, --fps F, --crf N, --out name (a clip's name; a prefix for stills), --no-captions,
   --no-audio, --no-lock, --fill F and --no-autosamples (sampling A/B: bokeh fill strength, 0 = off; no automatic
   sample floors, for defocus or for fast motion). Output: <project>/out/<name>.mp4 (H.264 High, BT.709, AAC). Final
   renders take a machine-wide lock so two never fight for the GPU; drafts and stills don't.

   The last line says how it went, so a piped render (| tail) never looks finished when it failed:
     RENDER OK <path> (<frames> frames, <s> s)            exit 0
     RENDER FAILED at <t> s (shot <id>): <message>        exit 1, on stderr
     FINAL HAS AUDIT ISSUES (n): ...                      exit 3: a final rendered with --audit whose audit printed
                                                          lines (the mp4 is kept)
   Progress: a carriage-return counter on a terminal, else one line every 10%. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { args, serve } from './serve.mjs';

const { pos, opt } = args(process.argv.slice(2), ['samples', 'scale', 'fps', 'from', 'to', 'out', 'stills', 'crf', 'fill']);
if (!pos[0]) { console.error('usage: bun render.mjs <project> [--draft] [--from s --to s] [--stills a,b]'); process.exit(1); }
const ROOT = path.resolve(pos[0]);
const project = JSON.parse(fs.readFileSync(path.join(ROOT, 'project.json'), 'utf8'));
const draft = !!opt.draft;
const scale = Number(opt.scale ?? (draft ? 0.5 : 1));
const samples = Number(opt.samples ?? (draft ? 1 : project.samples ?? 16));
const fps = Number(opt.fps ?? project.fps ?? 30);
const captions = !opt['no-captions'];
const FF = fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';
const CHROME = process.env.CHROME_PATH || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => fs.existsSync(p));
if (!CHROME) { console.error('Google Chrome not found: set CHROME_PATH'); process.exit(1); }
const isFinal = !draft && !opt.stills;
const outName = opt.out || (draft ? 'draft' : 'final') + (opt.from || opt.to ? `-${Number(opt.from ?? 0)}-${opt.to != null ? Number(opt.to) : 'end'}` : '');
const PROJ_NAME = path.basename(ROOT);
const t0 = Date.now();
let tStart = t0; // the frame loop's start (after the lock): what log.json's seconds and the RENDER OK line measure
const secs = () => ((Date.now() - tStart) / 1000).toFixed(0);

// ---- cleanup on stop: a part file, the lock, ffmpeg. SIGTERM / SIGHUP / SIGINT exit 143 / 129 / 130 ----
const cleanups = [];
const cleanup = () => { for (const f of cleanups.splice(0)) try { f(); } catch {} };
process.on('exit', cleanup);
for (const [sig, code] of [['SIGTERM', 143], ['SIGHUP', 129], ['SIGINT', 130]]) process.on(sig, () => { cleanup(); console.error(`RENDER FAILED at ${lastT.toFixed(2)} s (shot ${shotAt(lastT)}): stopped by ${sig}`); process.exit(code); });
let lastT = 0, info = null;
const shotAt = (t) => { const s = info?.shots?.find((x) => t < x.end) || info?.shots?.[info.shots.length - 1]; return s?.id ?? '-'; };

// ---- machine-wide GPU lock for full-quality renders ----
// The lock directory holds pid (older renders read it) and info.json { pid, project, name, frames, done, started },
// updated every 30 frames, so a render waiting for it can say whose final it waits for and how long that will take.
const LOCK = path.join(os.tmpdir(), 'charles-3d-explainers-render.lock');
function alive(pid) { try { process.kill(pid, 0); return true; } catch { return false; } }
const readJSON = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
// what a queued final will read: project.json, globals.js and everything under shots/ and lib/
function projectFiles() {
  const out = {};
  const look = (f) => { try { const st = fs.statSync(f); if (st.isFile()) out[path.relative(ROOT, f)] = st.mtimeMs; else if (st.isDirectory()) for (const e of fs.readdirSync(f)) look(path.join(f, e)); } catch {} };
  for (const f of ['project.json', 'globals.js', project.globals, project.words, 'shots', 'lib'].filter(Boolean)) look(path.join(ROOT, f));
  return out;
}
const lockInfo = { pid: process.pid, project: PROJ_NAME, dir: ROOT, name: outName, frames: null, done: 0, started: Date.now() };
const writeLockInfo = () => { try { fs.writeFileSync(path.join(LOCK, 'info.json'), JSON.stringify(lockInfo)); } catch {} };
async function lock() {
  if (!isFinal || opt['no-lock']) return () => {};
  let lastSay = 0, before = null;
  for (;;) {
    try { fs.mkdirSync(LOCK); fs.writeFileSync(path.join(LOCK, 'pid'), String(process.pid)); break; }
    catch {
      let pid = 0; try { pid = Number(fs.readFileSync(path.join(LOCK, 'pid'), 'utf8').trim() || 0); } catch {}
      if (pid && !alive(pid)) { fs.rmSync(LOCK, { recursive: true, force: true }); continue; }
      before ||= projectFiles();
      if (Date.now() - lastSay >= 30000) {
        const o = readJSON(path.join(LOCK, 'info.json'));
        let msg = `queued behind pid ${pid || '?'}`;
        if (o) {
          const el = (Date.now() - o.started) / 1000, left = o.frames && o.done ? (el / o.done) * (o.frames - o.done) : null;
          msg = `queued behind ${o.project}/${o.name}: ${o.frames ? `frame ${o.done}/${o.frames}` : 'starting'}${left != null ? `, about ${left < 90 ? Math.round(left) + ' s' : Math.round(left / 60) + ' min'} left` : ''}`;
        }
        console.log(msg); lastSay = Date.now();
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  lockInfo.started = Date.now(); writeLockInfo();
  const release = () => { try { if (Number(fs.readFileSync(path.join(LOCK, 'pid'), 'utf8')) === process.pid) fs.rmSync(LOCK, { recursive: true, force: true }); } catch {} };
  cleanups.push(release);
  if (before) { // edits made while this final waited go into it: say so
    const now = projectFiles(), changed = [...new Set([...Object.keys(before), ...Object.keys(now)])].filter((f) => before[f] !== now[f]);
    if (changed.length) console.log(`WARNING changed while queued: ${changed.slice(0, 8).join(', ')}${changed.length > 8 ? ` and ${changed.length - 8} more` : ''} (this final renders the files as they are now)`);
  }
  return release;
}

const release = await lock();
const S = serve(ROOT);
const browser = await chromium.launch({
  executablePath: CHROME, headless: true,
  args: ['--use-angle=metal', '--enable-features=CanvasDrawElement', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--enable-webgl', '--force-color-profile=srgb', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--hide-scrollbars', '--mute-audio', '--autoplay-policy=no-user-gesture-required'],
});
cleanups.unshift(() => S.stop());
const W = (project.size || [1080, 1920])[0], H = (project.size || [1080, 1920])[1];
const w = Math.round(W * scale), h = Math.round(H * scale);
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
const url = `${S.url}/kit/engine/index.html?p=/p/&scale=${scale}&samples=${samples}&fps=${fps}&captions=${captions ? 1 : 0}${opt.fill != null ? '&fill=' + Number(opt.fill) : ''}${opt['no-autosamples'] ? '&autosamples=0' : ''}`;
// stops the render: page errors, then the verdict line on stderr; exit 1
const fail = async (t, msg) => {
  const errs = await page.evaluate(() => window.__errors || []).catch(() => []);
  for (const e of [...new Set([...errs, ...logs])].slice(0, 40)) console.error('  ' + e);
  console.error(`RENDER FAILED at ${t.toFixed(2)} s (shot ${shotAt(t)}): ${msg}`);
  await browser.close().catch(() => {}); cleanup(); process.exit(1);
};
await page.goto(url);
const ready = await page.waitForFunction(() => window.__ready, null, { timeout: 120000 }).then((x) => x.jsonValue()).catch(() => 'timeout');
if (ready !== true) await fail(0, `the page failed to start (${ready})`);
info = await page.evaluate(() => window.__info);
const cdp = await page.context().newCDPSession(page);
const shot = async (fmt = 'png') => Buffer.from((await cdp.send('Page.captureScreenshot', { format: fmt, quality: fmt === 'jpeg' ? 92 : undefined, optimizeForSpeed: true, captureBeyondViewport: false })).data, 'base64');
const seek = async (t) => {
  lastT = t;
  try { await page.evaluate(([t, i]) => window.__seek(t, i), [t, Math.round(t * fps)]); }
  catch (e) { return String(e.message || e).replace(/^.*?evaluate: /, '').split('\n').slice(0, 3).join(' | '); }
  return null;
};

const outDir = path.join(ROOT, 'out');
fs.mkdirSync(outDir, { recursive: true });

// Tone of a frame, as look.md section 10 measures it (ffmpeg signalstats at 270 x 480, full range).
const tone = (png) => {
  const r = spawnSync(FF, ['-hide_banner', '-f', 'png_pipe', '-i', '-', '-vf', 'scale=270:480:out_range=pc,format=yuvj444p,signalstats,metadata=mode=print', '-f', 'null', '-'], { input: png, encoding: 'latin1' });
  const v = {}; for (const m of String(r.stderr).matchAll(/lavfi\.signalstats\.(YLOW|YAVG|YHIGH|SATAVG)=([0-9.]+)/g)) v[m[1]] = Number(m[2]);
  return v.YAVG == null ? null : v;
};
// look.md section 10, per kind of world. A shot row's `tone` picks one (a frame-filling photo is `screen`, a product
// on a warm desk `warm`); without it the palette decides: space -> space, studio-cool / studio-light / dusk -> midkey,
// the rest night.
const TONES = {
  night: { say: 'YAVG 30-50, YLOW <= 15, YHIGH-YLOW >= 55, SATAVG <= 20', test: (v) => [v.YAVG < 30 && 'dark (YAVG < 30)', v.YAVG > 50 && 'milky (YAVG > 50)', v.YLOW > 15 && 'lifted blacks (YLOW > 15)', v.YHIGH - v.YLOW < 55 && 'flat (YHIGH - YLOW < 55)', v.SATAVG > 20 && 'saturated (SATAVG > 20)'] },
  midkey: { say: 'YAVG 60-90, SATAVG <= 30', test: (v) => [v.YAVG < 60 && 'dark (YAVG < 60)', v.YAVG > 90 && 'bright (YAVG > 90)', v.SATAVG > 30 && 'saturated (SATAVG > 30)'] },
  space: { say: 'YAVG 16-34, YLOW <= 10, YHIGH-YLOW >= 45', test: (v) => [v.YAVG < 16 && 'dark (YAVG < 16)', v.YAVG > 34 && 'milky (YAVG > 34)', v.YLOW > 10 && 'lifted blacks (YLOW > 10)', v.YHIGH - v.YLOW < 45 && 'flat (YHIGH - YLOW < 45)'] },
  screen: { say: 'YAVG 30-60, SATAVG <= 30', test: (v) => [v.YAVG < 30 && 'dark (YAVG < 30)', v.YAVG > 60 && 'bright (YAVG > 60)', v.SATAVG > 30 && 'saturated (SATAVG > 30)'] },
  warm: { say: 'YAVG 25-60', test: (v) => [v.YAVG < 25 && 'dark (YAVG < 25)', v.YAVG > 60 && 'bright (YAVG > 60)'] },
  // a frame-filling hot surface (molten metal, a sun, a fire): bright is the point, but it keeps contrast and a
  // dark rim somewhere (a melt filling the frame at YAVG 93 read as cream marble, not as heat)
  hot: { say: 'YAVG 40-110, YLOW <= 25, YHIGH-YLOW >= 90', test: (v) => [v.YAVG < 40 && 'dark (YAVG < 40)', v.YAVG > 110 && 'washed out (YAVG > 110)', v.YLOW > 25 && 'lifted blacks (YLOW > 25)', v.YHIGH - v.YLOW < 90 && 'flat (YHIGH - YLOW < 90)'] },
};
const paletteTone = project.palette === 'space' ? 'space' : ['studio-cool', 'studio-light', 'dusk'].includes(project.palette) ? 'midkey' : 'night';
const toneIssues = (v, kind) => TONES[kind].test(v).filter(Boolean);
const fmtTone = (v) => `YAVG ${v.YAVG.toFixed(0)}  YLOW ${v.YLOW.toFixed(0)}  YHIGH ${v.YHIGH.toFixed(0)}  SATAVG ${v.SATAVG.toFixed(1)}`;
// shots whose sub-frames the automatic floors raised; "(motion 148 px)" when the motion floor set the count
const raisedLine = (used, motion = {}) => { const r = Object.entries(used).filter(([, n]) => n !== samples); return r.length ? `sub-frames raised (strong defocus or fast motion): ${r.map(([id, n]) => `${id} ${n}${motion[id]?.n >= n ? ` (motion ${motion[id].px} px)` : ''}`).join(', ')} (base ${samples})` : null; };

if (opt.stills) {
  const dir = path.join(outDir, 'stills'); fs.mkdirSync(dir, { recursive: true });
  const tones = [];
  const times = String(opt.stills).split(',').map(Number);
  for (const t of times) {
    const err = await seek(t);
    if (err) await fail(t, err);
    const f = path.join(dir, `${opt.out ? opt.out + '-' : ''}t${t.toFixed(2)}${draft ? '-draft' : ''}.png`);
    fs.writeFileSync(f, await shot('png'));
    console.log(f);
    if (opt.audit) { const iss = await page.evaluate((t) => window.__audit(t), t); for (const i of iss) console.log(`  audit ${t.toFixed(2)}s: ${i}`); }
    // tone of the 3D picture alone: the overlays are hidden for a second capture
    await page.evaluate(() => { document.getElementById('ui').style.visibility = 'hidden'; });
    const v = tone(await shot('png'));
    await page.evaluate(() => { document.getElementById('ui').style.visibility = ''; });
    if (v && info.shots.length) {
      const row = await page.evaluate((t) => window.__toneOf?.(t) ?? null, t), kind = TONES[row] ? row : paletteTone;
      if (row && !TONES[row]) console.log(`  note: tone "${row}" is not one of ${Object.keys(TONES).join(', ')}; judged as ${paletteTone}`);
      tones.push({ v, kind }); const iss = toneIssues(v, kind);
      console.log(`  tone ${fmtTone(v)}  ${kind}: ${iss.length ? iss.join(', ') : 'ok'}`);
    }
  }
  // one verdict per kind of world, on the median of its stills
  for (const kind of [...new Set(tones.map((x) => x.kind))]) {
    const vs = tones.filter((x) => x.kind === kind).map((x) => x.v);
    const med = (k) => { const a = vs.map((v) => v[k]).sort((x, y) => x - y), m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
    const v = { YAVG: med('YAVG'), YLOW: med('YLOW'), YHIGH: med('YHIGH'), SATAVG: med('SATAVG') }, iss = toneIssues(v, kind);
    console.log(`tone (3D only, ${vs.length > 1 ? 'median of ' + vs.length + ' stills' : '1 still'}, ${kind} world: ${TONES[kind].say}): ${fmtTone(v)}  ${iss.length ? 'OFF: ' + iss.join(', ') : 'in range'}`);
  }
  const rl = raisedLine(await page.evaluate(() => window.__samples?.() || {}), await page.evaluate(() => window.__motion?.() || {}));
  if (rl) console.log(rl);
  const errs = await page.evaluate(() => window.__errors);
  for (const e of [...new Set([...errs, ...logs])]) console.log('  ' + e);
  await browser.close(); cleanup();
  console.log(`RENDER OK ${path.relative(process.cwd(), dir) || dir} (${times.length} still${times.length > 1 ? 's' : ''}, ${secs()} s)`);
  process.exit(0);
}

const from = Number(opt.from ?? 0), to = Math.min(Number(opt.to ?? info.duration), info.duration);
const frames = Math.max(1, Math.round((to - from) * fps));
const name = opt.out || (draft ? 'draft' : 'final') + (opt.from || opt.to ? `-${from}-${to}` : '');
lockInfo.name = name; lockInfo.frames = frames; if (isFinal) writeLockInfo();
const out = path.join(outDir, name + '.mp4');
// ffmpeg writes a partial file that is renamed only when the render succeeds: a stopped or failed render never leaves
// a corrupt out/<name>.mp4 (no moov atom) behind
const part = path.join(outDir, `.${name}.partial.mp4`);
const dropPart = () => fs.rmSync(part, { force: true });
const audio = !opt['no-audio'] && project.audio && fs.existsSync(path.join(ROOT, project.audio)) ? path.join(ROOT, project.audio) : null;
const fmt = draft ? 'jpeg' : 'png';
const crf = String(opt.crf ?? (draft ? 23 : 17));
const ffArgs = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', fmt === 'png' ? 'png' : 'mjpeg', '-i', '-'];
if (audio) ffArgs.push('-ss', String(from), '-t', String(to - from), '-i', audio);
ffArgs.push('-map', '0:v:0'); if (audio) ffArgs.push('-map', '1:a:0');
ffArgs.push('-vf', `scale=${w}:${h}:out_color_matrix=bt709:out_range=tv,format=yuv420p`,
  '-c:v', 'libx264', '-preset', draft ? 'veryfast' : 'slow', '-crf', crf, '-tune', draft ? 'fastdecode' : 'grain', '-profile:v', 'high',
  '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart');
if (audio) ffArgs.push('-c:a', 'aac', '-b:a', '192k', '-af', 'apad'); // pad, never cut: a visual tail after the last word stays
ffArgs.push('-t', String(frames / fps));
ffArgs.push(part);
const ff = spawn(FF, ffArgs, { stdio: ['pipe', 'inherit', 'inherit'] });
const ffDone = new Promise((r) => ff.on('close', r));
cleanups.unshift(() => { try { ff.kill('SIGKILL'); } catch {} }, dropPart);

tStart = Date.now();
const audits = [];
const tty = process.stdout.isTTY;
// every 0.25 s plus three points per shot: sampling only the three let a draft pass while the final's caption sat on a
// bright subject between them
const auditTimes = new Set(opt.audit ? [...info.shots.flatMap((s) => [s.start + 0.4, (s.start + s.end) / 2, s.end - 0.2]), ...Array.from({ length: Math.ceil(info.duration / 0.25) }, (_, i) => i * 0.25)].map((x) => Math.round(x * fps)) : []);
let nextPct = 10;
for (let i = 0; i < frames; i++) {
  const t = from + i / fps;
  const err = await seek(t);
  if (err) { ff.stdin.destroy(); ff.kill('SIGKILL'); dropPart(); await fail(t, err); }
  const buf = await shot(fmt);
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (auditTimes.has(Math.round(t * fps))) for (const iss of await page.evaluate((t) => window.__audit(t), t)) audits.push(`${t.toFixed(2)}s ${iss}`);
  const done = i + 1, el = (Date.now() - tStart) / 1000, per = el / done;
  if (done % 30 === 0 || done === frames) { lockInfo.done = done; if (isFinal) writeLockInfo(); }
  if (tty) { if (done % 30 === 0 || done === frames) process.stdout.write(`\r${name}: ${done}/${frames} frames  ${per.toFixed(2)} s/frame  eta ${Math.round(per * (frames - done))} s   `); }
  else if ((100 * done) / frames >= nextPct || done === frames) { // piped (| tail, a log file): whole lines, every 10%
    console.log(`${name}: ${done}/${frames} frames (${Math.floor((100 * done) / frames)}%)  ${per.toFixed(2)} s/frame  eta ${Math.round(per * (frames - done))} s`);
    while (nextPct <= (100 * done) / frames) nextPct += 10;
  }
}
if (tty) process.stdout.write('\n');
ff.stdin.end();
const ffCode = await ffDone;
if (ffCode !== 0 || !fs.existsSync(part)) { dropPart(); await fail(to, `ffmpeg exited with ${ffCode}; ${path.relative(process.cwd(), out)} was not written`); }
fs.renameSync(part, out);
const errs = await page.evaluate(() => window.__errors);
const used = await page.evaluate(() => window.__samples?.() || {}), motion = await page.evaluate(() => window.__motion?.() || {});
const wordLog = await page.evaluate(() => window.__wordLog || []);
await browser.close(); cleanup();
const rl = raisedLine(used, motion);
if (rl) console.log(rl);
if (errs.length || logs.length) { console.log('page errors/warnings:'); for (const e of [...new Set([...errs, ...logs])].slice(0, 40)) console.log('  ' + e); }
if (audits.length) { console.log('layout audit:'); for (const a of [...new Set(audits)]) console.log('  ' + a); }
// words: every word timing the shots and globals.js asked for ({ shot, phrase, nth, t, text }); check.mjs lists a pop
// within 0.25 s of one of them as planned
fs.writeFileSync(path.join(outDir, name + '.log.json'), JSON.stringify({ out, frames, samples, shotSamples: used, shotMotion: motion, scale, fps, from, to, seconds: (Date.now() - tStart) / 1000, errors: errs, logs, audits, words: wordLog }, null, 1));
if (isFinal && opt.audit && audits.length) {
  console.log(`FINAL HAS AUDIT ISSUES (${new Set(audits).size}): ${path.relative(process.cwd(), out)} is written, but fix the lines above and render again`);
  process.exit(3);
}
console.log(`RENDER OK ${path.relative(process.cwd(), out)} (${frames} frames, ${secs()} s)`);
