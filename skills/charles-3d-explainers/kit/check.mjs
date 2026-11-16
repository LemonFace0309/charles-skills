#!/usr/bin/env bun
/* Measures the pacing and the defects of a rendered video with ffmpeg, and prints a short report.

     bun <kit>/check.mjs <video.mp4> [--project <dir>] [--graph [file.png]] [--json file] [--quiet]

   What it reports:
     stale     spans where nothing on screen moves for more than 0.6 s (the caption band is left out)
     events    how often something new lands: an element arrives (text, a label, a number, a line drawing on, an
               object entering), a calm part of the frame starts moving, a cut or a transition. Reported per second,
               with lulls (more than 1.5 s with nothing new)
     cuts      hard cuts (the whole picture changes in one frame, or in a dark or plain world its correlation with the
               frame before drops far below its neighbours'), the shot list, median shot length
     flashes   single frames that differ from the frames on both sides (a flash, a dark frame, a stray frame)
     pops      something that appears, vanishes or jumps in one frame without easing
     hitches   a repeated frame in the middle of motion (a stutter)
     hook      the opening: median motion over 0.9-2.1 s and the first event; WARNING below 4 or after 1.2 s (studio
               reels that dive read 4.7 to 13.6; static hooks read 0.5 to 2.9)
     static    per-second motion medians; WARNING for 3 s or more in a row under 1.0 after the first second
     dark      frames with a mean grey under 10 outside planned dips and fades, and 1 s or more under 18; in a space
               shot (the row's tone, else the palette) only near-black frames (under 4): a small Earth in black
               space averages 4 to 12 and is right
     black and blown-out frames
     planned   pops, jumps and flashes from 0.35 s before to 0.1 s after a word a shot timed (k.word, from
               <video>.log.json; a line starts drawing a little before its word), inside a count-up (k.ui.hero logs
               its span) or inside a planned transition: listed, and left out of the counts (without a log: those
               on a word onset)
     NOTE      the video is a 1-sample draft: no depth of field or motion blur, so the static, hook and dark lines
               can change at full quality (check a --draft --samples 16 render before the final)
     captions  with a project, chunked and timed exactly as ui.js does: `flicker` (a chunk on screen under 0.7 s) and
               `dangling` (a chunk ending on a word that leans on the next, ui.js leans()); reading speed is information
   The project is found by itself when the video sits in <project>/out/ (pass --no-project to skip it); with it, cuts
   are matched against the planned shots and transitions, and it warns when shots, project files or the engine changed
   after the video was rendered. A partial render (render.mjs --from 8) is read in project time: its log says where it
   starts. Writes <video-name>.check.json next to the video: settings, findings and per-frame series. --graph also draws
   a timeline image (default <video-name>.check.png). --no-captions counts the caption band as picture (for a render
   made with --no-captions).

   How it measures: frames are scaled to 108 px wide, grey, plus an edge image. For each region of the frame (a 6 x 8
   grid) it compares each frame with the one before, the one 0.33 s before and the one 0.6 s before, and subtracts that
   region's own noise: film grain and compression change every frame by about the same amount, while real motion grows
   with the gap. New things show up as a fast rise in a region's edges; a moving camera mostly moves the edges already
   there. These are estimates: look at the moments it names with sheet.mjs --strip before acting on them. */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { args } from './serve.mjs';
import { probe, findProject, shotList, shootHTML, outdated, esc, fontCSS } from './sheet.mjs';

const FF = fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';

// Thresholds (grey levels 0-255, seconds). Tuned on renders with film grain and on a synthetic clip of known defects.
export const LIMITS = {
  stale: 0.6,        // a span with no motion longer than this is stale
  lull: 1.5,         // a gap between new events longer than this is a lull
  hook: 4,           // median motion over 0.9-2.1 s below this: the opening does not dive
  hookEvent: 1.2,    // ...or the first event after the opening frame comes later than this
  static: 1.0,       // a second whose median motion is under this is near-still...
  staticRun: 3,      // ...and this many in a row (after the first second) is a static run
  dark: 10,          // a frame darker than this (mean grey) outside planned dips and fades is a dark frame
  dim: 18,           // ...and a stretch of dimRun s or more darker than this is a dim span
  dimRun: 1.0,
  spaceDark: 4,      // in a space shot only a frame darker than this is dark (no dim spans): a small Earth reads 4-12
  plannedBefore: 0.35, // a pop, jump or flash from this long before a timed word...
  plannedAfter: 0.1,   // ...to this long after it is the planned beat (a line starts drawing just before its word)
  flicker: 0.7,      // a caption chunk on screen for less than this flickers
  still: 1.0,        // a region "moved" over the stale window if it changed this much more than its own noise
  edge: 10,          // a region "gains" something when its edge energy rises this much within 0.33 s
  onset: 3.0,        // a region "starts moving" when its 0.33 s change rises this far above its noise...
  calm: 1.2,         // ...after staying below this for 0.3 s
  pop: 10,           // a region that changes this much in one frame, 4x more than the frames around it, popped
  cutFrac: 0.3,      // a hard cut changes at least this fraction of the pixels in one frame
};

function median(a) { if (!a.length) return 0; const s = Float64Array.from(a).sort(); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function pct(a, p) { if (!a.length) return 0; const s = Float64Array.from(a).sort(); return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))]; }
const r2 = (x) => Math.round(x * 100) / 100;
const fmt = (t) => t.toFixed(2);

// Decode the video to small grey frames, each stacked over its edge image (Sobel at twice the size, then averaged down).
async function decode(file, AW, AH) {
  const vf = `split[a][b];[a]scale=${AW}:${AH}:flags=area,format=gray[l];[b]scale=${AW * 2}:${AH * 2}:flags=area,format=gray,sobel,scale=${AW}:${AH}:flags=area[e];[l][e]vstack`;
  const p = spawn(FF, ['-v', 'error', '-i', file, '-map', '0:v:0', '-vf', vf, '-f', 'rawvideo', '-pix_fmt', 'gray', '-']);
  const parts = []; let err = '';
  p.stderr.on('data', (d) => (err += d));
  for await (const c of p.stdout) parts.push(c);
  const code = await new Promise((r) => p.on('close', r));
  if (code !== 0) throw new Error(`ffmpeg could not decode ${file}: ${err.trim().slice(0, 400)}`);
  const buf = Buffer.concat(parts);
  return { buf, n: Math.floor(buf.length / (2 * AW * AH)) };
}

export async function analyse(videoFile, o = {}) {
  const V = probe(videoFile);
  const fps = V.fps;
  // project time of frame 0: a partial render (render.mjs --from 8) starts at 8 s; every reported time is project time
  const T0 = o.start ?? V.start ?? 0, T1 = T0 + V.duration;
  const AW = 108, AH = Math.max(2, Math.round((AW * V.height) / V.width / 2) * 2);
  const { buf, n: N } = await decode(videoFile, AW, AH);
  if (N < 3) throw new Error('video too short to check');
  const P = AW * AH;
  const F = (i) => buf.subarray(i * 2 * P, i * 2 * P + P);          // grey
  const G = (i) => buf.subarray(i * 2 * P + P, (i + 1) * 2 * P);    // edges
  const W = Math.max(2, Math.round(LIMITS.stale * fps));           // stale window, frames
  const proj = o.project || null;

  // caption band (left out of motion): ui.js puts captions `bottom` px above the frame bottom, up to two lines
  const cap = proj?.project.captions || {};
  const [W0, H0] = proj?.project.size || [1080, 1920];
  const capOn = o.captions !== false && cap.enabled !== false && !(proj && !proj.project.words);
  const capBottom = H0 - (cap.bottom ?? Math.round((450 * H0) / 1920)), capTop = capBottom - 2 * 1.12 * (cap.size ?? Math.round((66 * W0) / 1080));
  const band = capOn ? [Math.floor(((capTop - 24) / H0) * AH), Math.ceil(((capBottom + 24) / H0) * AH)] : null;

  // regions: a grid of blocks over the frame, minus the caption band
  const BX = 6, BY = Math.max(1, Math.round(AH / 24));
  const nb = BX * BY;
  const bid = new Int16Array(P).fill(-1), bcnt = new Float64Array(nb);
  for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
    if (band && y >= band[0] && y < band[1]) continue;
    const b = Math.min(BY - 1, Math.floor((y / AH) * BY)) * BX + Math.min(BX - 1, Math.floor((x / AW) * BX));
    bid[y * AW + x] = b; bcnt[b]++;
  }
  const live = [...Array(nb).keys()].filter((b) => bcnt[b] >= 40);
  const nbrs = live.map((b) => live.filter((c) => c !== b && Math.abs((c % BX) - (b % BX)) <= 1 && Math.abs(Math.floor(c / BX) - Math.floor(b / BX)) <= 1));

  // per-frame measures
  const Y = new Float32Array(N), HI = new Float32Array(N), LIT = new Float32Array(N);
  const D1 = new Float32Array(N), C1 = new Float32Array(N);           // whole frame: mean |change| vs previous frame, fraction changed > 16
  const R1 = new Float32Array(N), SDv = new Float32Array(N);          // correlation with the previous frame (1 = same picture); grey spread
  const DM = new Float32Array(N);                                     // motion outside the caption band, vs previous frame
  const S = Math.max(2, Math.round(0.33 * fps));                     // event window, frames
  const d1b = new Float32Array(N * nb), dWb = new Float32Array(N * nb), dSb = new Float32Array(N * nb), eb = new Float32Array(N * nb);
  const acc = new Float64Array(nb), accW = new Float64Array(nb), accE = new Float64Array(nb);
  for (let i = 0; i < N; i++) {
    const f = F(i);
    let s = 0, s2 = 0, hi = 0, lit = 0;
    for (let k = 0; k < P; k++) { const v = f[k]; s += v; s2 += v * v; if (v >= 250) hi++; if (v > 16) lit++; }
    Y[i] = s / P; HI[i] = hi / P; LIT[i] = lit / P; SDv[i] = Math.sqrt(Math.max(0, s2 / P - Y[i] * Y[i]));
    if (i > 0) {
      const g = F(i - 1); acc.fill(0);
      let sd = 0, ch = 0, sfg = 0;
      for (let k = 0; k < P; k++) { const d = Math.abs(f[k] - g[k]); sd += d; sfg += f[k] * g[k]; if (d > 16) ch++; const b = bid[k]; if (b >= 0) acc[b] += d; }
      D1[i] = sd / P; C1[i] = ch / P;
      const cov = sfg / P - Y[i] * Y[i - 1];
      R1[i] = SDv[i] > 0.5 && SDv[i - 1] > 0.5 ? cov / (SDv[i] * SDv[i - 1]) : 1;
      let m = 0, c = 0; for (const b of live) { d1b[i * nb + b] = acc[b] / bcnt[b]; m += acc[b]; c += bcnt[b]; } DM[i] = m / c;
    }
    const e = G(i); accE.fill(0);
    for (let k = 0; k < P; k++) { const b = bid[k]; if (b >= 0) accE[b] += e[k]; }
    for (const b of live) eb[i * nb + b] = accE[b] / bcnt[b];
    if (i >= W) {
      const h = F(i - W); accW.fill(0);
      for (let k = 0; k < P; k++) { const b = bid[k]; if (b >= 0) accW[b] += Math.abs(f[k] - h[k]); }
      for (const b of live) dWb[i * nb + b] = accW[b] / bcnt[b];
    }
    if (i >= S) {
      const h = F(i - S); accW.fill(0);
      for (let k = 0; k < P; k++) { const b = bid[k]; if (b >= 0) accW[b] += Math.abs(f[k] - h[k]); }
      for (const b of live) dSb[i * nb + b] = accW[b] / bcnt[b];
    }
  }
  const blockD = (i, j, b) => { const f = F(i), g = F(j); let s = 0; for (let k = 0; k < P; k++) if (bid[k] === b) s += Math.abs(f[k] - g[k]); return s / bcnt[b]; };
  const fullD = (i, j) => { const f = F(i), g = F(j); let s = 0; for (let k = 0; k < P; k++) s += Math.abs(f[k] - g[k]); return s / P; };
  const t = (i) => T0 + i / fps;

  // black / blown out
  const isBlack = (i) => Y[i] < 2.5 && LIT[i] < 0.002;
  const isBlown = (i) => HI[i] > 0.35 || Y[i] > 235;
  const runs = (test) => { const out = []; let a = -1; for (let i = 0; i <= N; i++) { const on = i < N && test(i); if (on && a < 0) a = i; if (!on && a >= 0) { out.push([a, i - 1]); a = -1; } } return out; };

  // flashes: a frame unlike both neighbours (whole frame), or a region that blips for one frame
  const flashes = [], flashAt = new Set();
  for (let i = 1; i < N - 1; i++) {
    const a = D1[i], b = D1[i + 1];
    const local = median([...D1.slice(Math.max(1, i - 6), i - 1), ...D1.slice(i + 2, Math.min(N, i + 8))]);
    const T = Math.max(4, 4 * local);
    if (a > T && b > T) {
      const c = fullD(i - 1, i + 1);
      if (c < 0.4 * Math.min(a, b)) {
        const kind = Y[i] > Math.max(Y[i - 1], Y[i + 1]) + 5 ? 'bright frame' : Y[i] < Math.min(Y[i - 1], Y[i + 1]) - 5 ? 'dark frame' : 'stray frame';
        flashes.push({ t: r2(t(i)), frame: i, kind, change: r2(Math.min(a, b)), area: 1 }); flashAt.add(i); flashAt.add(i + 1);
      }
    }
  }

  // hard cuts: the whole picture changes in one frame
  const cuts = [];
  for (let i = 1; i < N; i++) {
    if (flashAt.has(i)) continue;
    const local = median([...D1.slice(Math.max(1, i - 6), i), ...D1.slice(i + 1, Math.min(N, i + 7))]);
    // a dark world (or a centred subject on a plain ground) changes too few pixels by 16 levels at a cut: there the
    // correlation with the previous frame drops instead, far below its neighbours' (motion keeps it high)
    const dec = 1 - R1[i], decLocal = median([...R1.slice(Math.max(1, i - 6), i), ...R1.slice(i + 1, Math.min(N, i + 7))].map((x) => 1 - x));
    const darkCut = SDv[i] > 3 && SDv[i - 1] > 3 && dec > Math.max(0.35, 4 * decLocal);
    if ((C1[i] > LIMITS.cutFrac && D1[i] > Math.max(6, 5 * local)) || darkCut) cuts.push({ t: r2(t(i)), frame: i, change: r2(D1[i]), frac: r2(C1[i]), ...(darkCut ? { corr: r2(R1[i]) } : {}) });
  }
  const nearCut = (i, k = 1) => cuts.some((c) => Math.abs(c.frame - i) <= k);

  // planned shots and transitions
  const shots = proj ? shotList(proj.project, T1) : [];
  const inRender = (a, b) => b > T0 + 1e-6 && a < T1 - 1e-6;
  const transitionAt = (i) => shots.some((s, k) => k > 0 && s.in.dur > 0 && Math.abs(t(i) - s.start) <= s.in.dur / 2 + 1 / fps);

  // region noise: the 20th percentile of its frame-to-frame change over the surrounding second
  const R = Math.round(fps);
  const noise = new Float32Array(N * nb);
  for (const b of live) {
    for (let i = 1; i < N; i++) {
      const lo = Math.max(1, i - R), hi = Math.min(N - 1, i + R), vals = [];
      for (let j = lo; j <= hi; j += 2) vals.push(d1b[j * nb + b]);
      noise[i * nb + b] = pct(vals, 0.2);
    }
  }

  // stale: no region changed over the last 0.6 s more than its own noise
  const still = new Uint8Array(N), moveW = new Float32Array(N);
  for (let i = W; i < N; i++) {
    let worst = 0;
    for (const b of live) {
      const vals = []; for (let j = i - W + 1; j <= i; j++) vals.push(d1b[j * nb + b]);
      const c = dWb[i * nb + b] - median(vals);
      if (c > worst) worst = c;
    }
    moveW[i] = worst; still[i] = worst < LIMITS.still ? 1 : 0;
  }
  const stale = [];
  for (const [a, b] of runs((i) => i >= W && still[i])) {
    const s = a - W, e = b, dur = (e - s) / fps;
    if (b - a < 2 || dur <= LIMITS.stale) continue;
    let blk = 0; for (let i = s; i <= e; i++) if (isBlack(i)) blk++;
    if (blk > 0.5 * (e - s + 1)) continue; // black is reported on its own
    stale.push({ start: r2(t(s)), end: r2(t(e)), dur: r2(dur) });
  }

  // pops: a region jumps in one frame (big change, 4x the frames around it, and it stays changed)
  const pops = [];
  for (let i = 2; i < N - 1; i++) {
    if (nearCut(i, 1) || flashAt.has(i) || flashAt.has(i - 1) || transitionAt(i)) continue;
    let best = null;
    for (const b of live) {
      const d = d1b[i * nb + b];
      if (d < LIMITS.pop) continue;
      const around = []; for (let j = Math.max(1, i - 5); j <= Math.min(N - 1, i + 5); j++) if (j !== i) around.push(d1b[j * nb + b]);
      if (d < 4 * Math.max(median(around), noise[i * nb + b], 0.5)) continue;
      const stays = blockD(i - 1, i + 1, b);
      if (stays < 0.5 * d) { // gone again next frame: a one-frame blip
        const nx = d1b[(i + 1) * nb + b];
        if (nx > LIMITS.pop) { if (!best || d > best.d) best = { d, b, blip: true }; }
        continue;
      }
      if (!best || d > best.d) best = { d, b, blip: false };
    }
    if (!best) continue;
    const where = `${['top', 'upper', 'middle', 'lower', 'bottom'][Math.min(4, Math.floor((Math.floor(best.b / BX) / BY) * 5))]} ${['left', 'left', 'centre', 'centre', 'right', 'right'][best.b % BX]}`;
    const n = live.filter((b) => d1b[i * nb + b] > LIMITS.pop * 0.6).length;
    if (best.blip) { flashes.push({ t: r2(t(i)), frame: i, kind: `one-frame blip (${where})`, change: r2(best.d), area: r2(n / live.length) }); flashAt.add(i); flashAt.add(i + 1); continue; }
    // was that part of the frame still around the jump? (a true pop) or already moving? (clipping, a snap, a count-up step)
    const around = []; for (let j = Math.max(1, i - 8); j <= Math.min(N - 1, i + 8); j++) if (Math.abs(j - i) > 1) around.push(d1b[j * nb + best.b] - noise[j * nb + best.b]);
    const inMotion = median(around) > 1.0;
    pops.push({ t: r2(t(i)), frame: i, where, change: r2(best.d), regions: n, kind: inMotion ? 'jump inside motion' : 'pop in a still region' });
  }
  flashes.sort((a, b) => a.t - b.t);
  // merge pops on neighbouring frames (one event)
  const popsM = pops.filter((p, k) => !(k && p.frame - pops[k - 1].frame <= 2));

  // hitches: a repeated frame in the middle of motion
  const hitches = [];
  for (let i = 2; i < N - 1; i++) {
    const m = Math.min(D1[i - 1], D1[i + 1]);
    if (m > 1.0 && D1[i] < 0.2 * m && !isBlack(i)) hitches.push({ t: r2(t(i)), frame: i, change: r2(D1[i]), around: r2(m) });
  }

  // events: something new lands. Three kinds of evidence, merged when they fall within 0.4 s of each other:
  //  - a region gains edges fast (text, a label, a number, a line drawing on, an object arriving); a moving camera
  //    mostly moves the edges that are already there, so this sees arrivals even inside motion
  //  - a calm region starts moving (away from regions that were already moving)
  //  - cuts, planned transitions and pops
  let first = 0, last = N - 1; while (first < N - 1 && isBlack(first)) first++; while (last > first && isBlack(last)) last--;
  const onsets = [first];
  for (const b of live) {
    let prev = false, lastOn = -1e9;
    for (let i = S; i < N; i++) {
      const base = eb[(i - S) * nb + b], rise = eb[i * nb + b] - base, on = rise > LIMITS.edge;
      if (on && !prev && i - lastOn > 0.5 * fps && !nearCut(i, S)) {
        let j = i - S; while (j < i && eb[j * nb + b] - base < 0.25 * rise) j++;  // when the rise began
        onsets.push(j); lastOn = i;
      }
      prev = on;
    }
  }
  const chg = (i, b) => { const v = []; for (let j = i - S + 1; j <= i; j++) v.push(d1b[j * nb + b]); return dSb[i * nb + b] - median(v); };
  const C = Math.round(0.3 * fps);
  const moving = new Uint8Array(N * nb);
  for (let i = S; i < N; i++) for (const b of live) if (chg(i, b) > LIMITS.onset) moving[i * nb + b] = 1;
  for (let i = S + C; i < N; i++) {
    for (let li = 0; li < live.length; li++) {
      const b = live[li];
      if (!moving[i * nb + b] || moving[(i - 1) * nb + b]) continue;
      let calm = true; for (let j = i - C; j < i && calm; j++) if (chg(j, b) > LIMITS.calm) calm = false;
      if (!calm) continue;
      let joined = false; for (const c of nbrs[li]) { for (let j = i - C; j < i && !joined; j++) if (moving[j * nb + c]) joined = true; if (joined) break; }
      if (!joined) onsets.push(Math.max(0, i - Math.round(S / 2)));
    }
  }
  for (const c of cuts) onsets.push(c.frame);
  for (const s of shots.slice(1)) { const f = Math.round((s.start - s.in.dur / 2 - T0) * fps); if (f >= 0 && f < N) onsets.push(f); }
  for (const p of popsM) onsets.push(p.frame);
  onsets.sort((a, b) => a - b);
  const events = [];
  for (const i of onsets) if (i >= first && i <= last && (!events.length || i - events[events.length - 1] > Math.round(0.4 * fps))) events.push(i);
  const span = Math.max(1 / fps, (last - first + 1) / fps);
  const evT = events.map((i) => r2(t(i)));
  const lulls = [];
  const marks = [t(first), ...evT.filter((x) => x > t(first) && x < t(last)), t(last)];
  for (let k = 1; k < marks.length; k++) if (marks[k] - marks[k - 1] > LIMITS.lull) lulls.push({ start: r2(marks[k - 1]), end: r2(marks[k]), dur: r2(marks[k] - marks[k - 1]) });
  const perWindow = []; for (let a = Math.floor(T0 / 3) * 3; a < T1; a += 3) perWindow.push({ start: a, end: Math.min(T1, a + 3), events: evT.filter((x) => x >= a && x < a + 3).length });

  // shots: the planned shots this video covers if there is a project, else the stretches between detected cuts
  const seen = shots.filter((s) => inRender(s.start, s.end));
  const bounds = seen.length ? null : [T0, ...cuts.map((c) => c.t), T1];
  const lens = seen.length ? seen.map((s) => s.end - s.start) : bounds.slice(1).map((b, k) => b - bounds[k]).filter((x) => x > 0.05);
  const planned = seen.map((s) => ({ id: s.id, start: r2(s.start), end: r2(s.end), dur: r2(s.end - s.start), in: s.in.type, inDur: s.in.dur, detected: s === shots[0] || s.start <= T0 + 1e-6 ? null : s.in.type === 'cut' ? cuts.some((c) => Math.abs(c.t - s.start) <= 1.5 / fps) : null }));
  const unplanned = shots.length ? cuts.filter((c) => !shots.some((s, k) => k > 0 && Math.abs(c.t - s.start) <= Math.max(1.5 / fps, s.in.dur / 2 + 1 / fps))) : [];

  // black and blown-out spans, with fades noted
  const fadeIn = proj?.project.fadeIn || 0, fadeOut = proj?.project.fadeOut || 0;
  const projEnd = proj?.project.duration ?? T1;
  const black = runs(isBlack).map(([a, b]) => ({ start: r2(t(a)), end: r2(t(b) + 1 / fps), frames: b - a + 1, note: a === 0 && T0 < 0.01 ? (fadeIn ? 'fade in' : 'opening') : b === N - 1 && Math.abs(T1 - projEnd) < 0.1 ? (fadeOut ? 'fade out' : 'ending') : '' }));
  const blown = runs(isBlown).map(([a, b]) => ({ start: r2(t(a)), end: r2(t(b) + 1 / fps), frames: b - a + 1 }));

  // hook: how the opening moves (median motion over 0.9-2.1 s) and when something first happens after frame 0
  let hook = null;
  if (T0 < 0.9 && T1 > 2.1) {
    const m = median(Array.from(DM.subarray(Math.max(1, Math.round((0.9 - T0) * fps)), Math.round((2.1 - T0) * fps))));
    const firstEvent = evT.find((x) => x > T0 + 0.05) ?? null;
    hook = { motion: r2(m), firstEvent, ok: m >= LIMITS.hook && firstEvent != null && firstEvent <= LIMITS.hookEvent };
  }

  // static: per-second medians of motion; a run of near-still seconds after the first (a black second breaks a run:
  // black is reported on its own)
  const perSecond = [];
  for (let s = Math.ceil(T0 - 1e-6); s + 1 <= T1 + 1e-6; s++) {
    const a = Math.max(1, Math.round((s - T0) * fps)), b = Math.min(N, Math.round((s + 1 - T0) * fps));
    if (b - a < 2) continue;
    let blk = 0; for (let i = a; i < b; i++) if (isBlack(i)) blk++;
    perSecond.push({ s, motion: r2(median(Array.from(DM.subarray(a, b)))), black: blk > (b - a) / 2 });
  }
  const staticRuns = [];
  for (let k = 0, run = []; k <= perSecond.length; k++) {
    const x = perSecond[k], low = x && x.s >= 1 && !x.black && x.motion < LIMITS.static;
    if (low && run.length && run[run.length - 1].s !== x.s - 1) { if (run.length >= LIMITS.staticRun) staticRuns.push(run); run = []; }
    if (low) run.push(x);
    else { if (run.length >= LIMITS.staticRun) staticRuns.push(run); run = []; }
  }
  const staticOut = { runs: staticRuns.map((r) => ({ start: r[0].s, end: r[r.length - 1].s + 1, seconds: r.length, motion: r2(Math.max(...r.map((x) => x.motion))) })), nearStill: perSecond.filter((x) => x.s >= 1 && !x.black && x.motion < LIMITS.static).length, seconds: perSecond.length };

  // dark: frames under 10 outside planned dips, fades and black frames (black has its own line), and dim stretches.
  // A space shot (its row's tone, else the palette's world, as render.mjs --stills judges it) is black space with a
  // small lit planet in it: correct frames average 4 to 12 (look.md's space range is for the hero frames), so there
  // only a near-black frame (under 4) is dark, and there are no dim spans.
  const dipAt = (i) => shots.some((s, k) => k > 0 && s.in.type === 'dip' && Math.abs(t(i) - s.start) <= s.in.dur / 2 + 1 / fps);
  const fadeIn0 = proj?.project.fadeIn || 0, fadeOut0 = proj?.project.fadeOut || 0, end0 = proj?.project.duration ?? T1;
  const excused = (i) => isBlack(i) || dipAt(i) || t(i) < fadeIn0 || (fadeOut0 && t(i) > end0 - fadeOut0);
  const palTone = (() => { const p = proj?.project.palette || 'night-amber'; return p === 'space' ? 'space' : ['studio-cool', 'studio-light', 'dusk'].includes(p) ? 'midkey' : 'night'; })();
  const toneAt = (i) => { const tt = t(i); let s = null; for (const x of shots) if (tt >= x.start - 1e-6) s = x; return s?.tone ?? palTone; };
  const isSpace = (i) => toneAt(i) === 'space';
  const dark = {
    frames: runs((i) => Y[i] < (isSpace(i) ? LIMITS.spaceDark : LIMITS.dark) && !excused(i)).map(([a, b]) => ({ start: r2(t(a)), end: r2(t(b) + 1 / fps), min: r2(Math.min(...Y.subarray(a, b + 1))), max: r2(Math.max(...Y.subarray(a, b + 1))), ...(isSpace(a) ? { space: true } : {}) })),
    dim: runs((i) => Y[i] < LIMITS.dim && !excused(i) && !isSpace(i)).filter(([a, b]) => (b - a + 1) / fps >= LIMITS.dimRun).map(([a, b]) => ({ start: r2(t(a)), end: r2(t(b) + 1 / fps), min: r2(Math.min(...Y.subarray(a, b + 1))) })),
  };

  // captions, chunked and timed exactly as ui.js shows them (captionChunks, captionTimes, leans)
  let captions = null, words = [];
  const wordsFile = proj?.project.words ? path.join(proj.dir, proj.project.words) : null;
  if (wordsFile && fs.existsSync(wordsFile)) {
    const ui = await import('./engine/ui.js');
    words = ui.loadWords(JSON.parse(fs.readFileSync(wordsFile, 'utf8')));
    const { chunks } = ui.captionChunks(words, cap);
    // on-screen times (the first chunk from frame 0 when the voice starts within leadIn) and the dangling rule are
    // ui.js's own, never copies: check.mjs flags exactly what the captions show and what the chunker avoids
    const times = ui.captionTimes(chunks, cap), leans = ui.leans;
    const rep = cap.replace || {}, shown = (w) => rep[w.text] ?? rep[w.text.toLowerCase()] ?? rep[w.n] ?? w.text;
    const all = chunks.map((c, i) => {
      const [a, b] = times[i], start = Math.max(0, a), text = c.map(shown).join(' ');
      return { start: r2(start), end: r2(b), dur: r2(b - start), text, chars: text.length, cps: r2(text.length / Math.max(0.05, b - start)), dangling: !!leans(c[c.length - 1].text, chunks[i + 1]?.[0]?.text) };
    }).filter((c) => inRender(c.start, c.end));
    const w = words.filter((x) => x.start >= T0 && x.end <= T1);
    captions = { chunks: all.length, medianCps: r2(median(all.map((c) => c.cps))), flicker: all.filter((c) => c.dur < LIMITS.flicker), dangling: all.filter((c) => c.dangling), all, wordsPerSecond: w.length ? r2(w.length / Math.max(0.1, w[w.length - 1].end - w[0].start)) : 0 };
  }

  // planned events: a pop, jump or flash from 0.35 s before to 0.1 s after a word a shot timed (render.mjs logs every
  // k.word as log.json `words`; a line that starts drawing 0.28 s before its word is that word's beat) or inside a
  // planned transition is the beat, not a glitch. Without a log: one on a word onset (0.12 s before to 0.05 s after).
  let timed = null, renderSamples = null;
  try { const lg = JSON.parse(fs.readFileSync(path.join(path.dirname(videoFile), path.basename(videoFile, path.extname(videoFile)) + '.log.json'), 'utf8')); renderSamples = Number.isFinite(lg.samples) ? lg.samples : null; if (Array.isArray(lg.words) && lg.words.length) timed = lg.words.filter((x) => Number.isFinite(x.t)); } catch {}
  const inTransition = (tt) => shots.find((s, k) => k > 0 && s.in.dur > 0 && Math.abs(tt - s.start) <= s.in.dur / 2 + 1 / fps);
  const planOf = (tt) => {
    if (timed) {
      // a logged span (a count-up: its steps and landing) is planned from 0.1 s before it to plannedAfter after it ends
      const near = (x) => (x.end != null ? tt >= x.t - 0.1 && tt <= x.end + LIMITS.plannedAfter : tt - x.t >= -LIMITS.plannedBefore && tt - x.t <= LIMITS.plannedAfter);
      const w = timed.reduce((best, x) => (near(x) && (!best || Math.abs(x.t - tt) < Math.abs(best.t - tt)) ? x : best), null);
      if (w) return w.kind === 'count' ? `the count-up from ${fmt(w.t)} to ${fmt(w.end)} s` : `${w.shot === 'globals' ? 'g' : 'k'}.word "${w.phrase}" at ${fmt(w.t)} s`;
    } else if (words.some((x) => tt >= x.start - 0.12 && tt <= x.start + 0.05)) return 'on a word onset';
    const s = inTransition(tt);
    return s ? `inside the ${s.in.type} into ${s.id}` : null;
  };
  for (const p of popsM) p.planned = planOf(p.t);
  for (const f of flashes) f.planned = planOf(f.t);
  const plannedFrom = timed ? 'log' : words.length ? 'onsets' : 'transitions';

  return {
    video: path.resolve(videoFile), outdated: outdated(path.resolve(videoFile), proj?.dir), start: r2(T0), duration: r2(V.duration), fps, size: [V.width, V.height], frames: N,
    project: proj ? proj.dir : null, limits: LIMITS, analysis: { width: AW, height: AH, regions: [BX, BY], captionBand: band ? [Math.round((band[0] / AH) * H0), Math.round((band[1] / AH) * H0)] : null },
    summary: {
      eventsPerSecond: r2(events.length / span), events: events.length, longestLull: lulls.length ? Math.max(...lulls.map((l) => l.dur)) : 0,
      stale: stale.length, staleSeconds: r2(stale.reduce((a, s) => a + s.dur, 0)), cuts: cuts.length, medianShot: r2(median(lens)), shots: lens.length,
      flashes: flashes.filter((f) => !f.planned).length, pops: popsM.filter((p) => p.kind !== 'jump inside motion' && !p.planned).length, jumps: popsM.filter((p) => p.kind === 'jump inside motion' && !p.planned).length, planned: [...flashes, ...popsM].filter((x) => x.planned).length, hitches: hitches.length, blackFrames: black.reduce((a, b) => a + b.frames, 0), blownFrames: blown.reduce((a, b) => a + b.frames, 0),
      hook: hook ? hook.motion : null, staticRuns: staticOut.runs.length, darkFrames: dark.frames.length, flicker: captions ? captions.flicker.length : null, dangling: captions ? captions.dangling.length : null,
    },
    renderSamples, hook, static: staticOut, perSecond, dark, plannedFrom, stale, events: evT, lulls, eventsPer3s: perWindow, cuts, unplannedCuts: unplanned, shots: planned, shotLengths: lens.map(r2), flashes, pops: popsM, hitches, black, blown, captions,
    series: { luma: Array.from(Y, r2), change: Array.from(D1, r2), motion: Array.from(DM, r2), moved: Array.from(moveW, r2) },
  };
}

// ---------- report ----------
export function report(r) {
  const L = [], s = r.summary;
  const name = path.basename(r.video);
  L.push(`check ${name}: ${r.start ? `${fmt(r.start)}-${fmt(r.start + r.duration)} s of the project (times below are project times)` : `${fmt(r.duration)} s`}, ${r.size[0]}x${r.size[1]}, ${+r.fps.toFixed(3)} fps, ${r.frames} frames${r.project ? `, project ${path.basename(r.project)}` : ''}`);
  if (r.renderSamples === 1) L.push('  NOTE      a 1-sample draft: no depth of field or motion blur, so the static, hook and dark lines can change at full quality; check a --draft --samples 16 render before the final');
  if (r.outdated?.length) L.push(`  WARNING   this video is older than ${r.outdated.slice(0, 3).join(', ')}${r.outdated.length > 3 ? ` and ${r.outdated.length - 3} more` : ''}: render it again before judging`);
  const target = s.eventsPerSecond >= 0.8 ? 'ok' : 'slow';
  L.push(`  pacing    ${s.eventsPerSecond.toFixed(2)} new events a second (${target}; aim for about 1)` + (r.lulls.length ? `, ${r.lulls.length} lull${r.lulls.length > 1 ? 's' : ''} over ${LIMITS.lull} s: ${r.lulls.slice().sort((a, b) => b.dur - a.dur).slice(0, 4).map((l) => `${fmt(l.start)}-${fmt(l.end)}`).join(', ')}` : ', no lulls'));
  if (r.hook) L.push(`  hook      motion ${r.hook.motion.toFixed(1)} over 0.9-2.1 s, first event ${r.hook.firstEvent != null ? `at ${fmt(r.hook.firstEvent)} s` : 'none'}` + (r.hook.ok ? ': ok' : `: WARNING ${[r.hook.motion < LIMITS.hook && `aim for ${LIMITS.hook} or more (the references read 4.7 to 13.6 when they dive): move the camera from frame 0 and dive between 1.0 and 2.0 s`, !(r.hook.firstEvent != null && r.hook.firstEvent <= LIMITS.hookEvent) && `something visibly happens on the hero by ${LIMITS.hookEvent} s`].filter(Boolean).join('; ')}`));
  if (r.static) L.push(`  static    ${r.static.runs.length ? `WARNING near-still (motion under ${LIMITS.static}) for ${r.static.runs.map((x) => `${x.start}-${x.end} s (${x.seconds} s)`).join(', ')}: a real move every 2 to 3 s; never ${LIMITS.staticRun} s near-still in a row` : `no run of ${LIMITS.staticRun} near-still seconds`} (${r.static.nearStill} of ${r.static.seconds} s under ${LIMITS.static})`);
  L.push(`  stale     ${r.stale.length ? r.stale.map((x) => `${fmt(x.start)}-${fmt(x.end)} s (${x.dur.toFixed(1)} s)`).join(', ') : `nothing frozen for more than ${LIMITS.stale} s`}`);
  const shotTxt = r.shots.length ? `${r.shots.length} planned shots, median ${s.medianShot.toFixed(1)} s (${r.shots.map((x) => `${x.id} ${x.dur.toFixed(1)}`).join(', ')})` : `${s.shots} shots by cut, median ${s.medianShot.toFixed(1)} s`;
  L.push(`  cuts      ${r.cuts.length ? r.cuts.map((c) => fmt(c.t)).join(', ') + ' s' : 'no hard cuts'}; ${shotTxt}`);
  if (r.unplannedCuts.length) L.push(`  WARNING   hard cut${r.unplannedCuts.length > 1 ? 's' : ''} inside a shot (a camera jump or a glitch?): ${r.unplannedCuts.map((c) => fmt(c.t)).join(', ')} s`);
  const missed = r.shots.filter((x) => x.detected === false);
  for (const x of missed) L.push(`  WARNING   cut at ${fmt(x.start)} s (into ${x.id}) changes too little: change the size 1.5x or the angle 35 degrees, or keep one move`);
  const unpl = r.flashes.filter((f) => !f.planned);
  L.push(`  flashes   ${unpl.length ? unpl.map((f) => `${fmt(f.t)} s ${f.kind}`).join('; ') : 'none'}`);
  const list = (ps) => ps.slice(0, 8).map((p) => `${fmt(p.t)} s (${p.where})`).join(', ') + (ps.length > 8 ? ` and ${ps.length - 8} more` : '');
  const still = r.pops.filter((p) => p.kind !== 'jump inside motion' && !p.planned), moving = r.pops.filter((p) => p.kind === 'jump inside motion' && !p.planned);
  L.push(`  pops      ${still.length ? list(still) + ': something appears, vanishes or jumps in one frame without easing' : 'none'}`);
  if (moving.length) L.push(`  jumps     ${list(moving)}: a one-frame jump inside motion (clipping, a light or glow switching, a count-up step); check with a strip`);
  const plan = [...r.pops, ...r.flashes].filter((p) => p.planned).sort((a, b) => a.t - b.t);
  if (plan.length) L.push(`  planned   ${plan.length} pop${plan.length > 1 ? 's' : ''}, jump${plan.length > 1 ? 's' : ''} or flash${plan.length > 1 ? 'es' : ''} on ${r.plannedFrom === 'log' ? 'a timed word' : r.plannedFrom === 'onsets' ? 'a word onset (no word log: render with this kit to time them)' : 'a transition'} or inside a transition, not counted: ${plan.slice(0, 6).map((p) => `${fmt(p.t)} s (${p.planned})`).join(', ')}${plan.length > 6 ? ` and ${plan.length - 6} more` : ''}`);
  if (r.hitches.length) L.push(`  hitches   repeated frame in motion at ${r.hitches.slice(0, 8).map((h) => fmt(h.t)).join(', ')} s`);
  const bl = r.black.map((b) => `${fmt(b.start)}-${fmt(b.end)} s${b.note ? ` (${b.note})` : ''}`).join(', ');
  L.push(`  black     ${bl || 'none'}${r.blown.length ? `; blown out: ${r.blown.map((b) => `${fmt(b.start)}-${fmt(b.end)} s`).join(', ')}` : ''}`);
  if (r.dark) {
    const d = r.dark, parts = [];
    if (d.frames.length) parts.push(`under ${LIMITS.dark} (${LIMITS.spaceDark} in a space shot): ${d.frames.slice(0, 6).map((x) => `${fmt(x.start)}-${fmt(x.end)} s (grey ${x.min.toFixed(0)}${x.max.toFixed(0) !== x.min.toFixed(0) ? ` to ${x.max.toFixed(0)}` : ''})`).join(', ')}${d.frames.length > 6 ? ` and ${d.frames.length - 6} more` : ''}`);
    if (d.dim.length) parts.push(`${LIMITS.dimRun} s or more under ${LIMITS.dim}: ${d.dim.slice(0, 6).map((x) => `${fmt(x.start)}-${fmt(x.end)} s (${x.min.toFixed(0)})`).join(', ')}${d.dim.length > 6 ? ` and ${d.dim.length - 6} more` : ''}`);
    L.push(`  dark      ${parts.length ? parts.join('; ') + ': a world never drops to black between its events (keep the darks at 6 to 10, the frame above 18)' : 'none'}`);
  }
  if (r.captions) {
    const c = r.captions;
    L.push(`  captions  ${c.chunks} chunks, ${c.wordsPerSecond.toFixed(1)} words a second, median ${c.medianCps.toFixed(0)} characters a second (information)`);
    L.push(`  flicker   ${c.flicker.length ? `${c.flicker.slice(0, 6).map((x) => `"${x.text}" ${x.dur.toFixed(2)} s at ${fmt(x.start)} s`).join(', ')}${c.flicker.length > 6 ? ` and ${c.flicker.length - 6} more` : ''}: on screen under ${LIMITS.flicker} s` : 'none'}`);
    L.push(`  dangling  ${c.dangling.length ? `${c.dangling.slice(0, 6).map((x) => `"${x.text}" at ${fmt(x.start)} s`).join(', ')}${c.dangling.length > 6 ? ` and ${c.dangling.length - 6} more` : ''}: a chunk ends on a word that leans on the next` : 'none'}`);
  }
  return L.join('\n');
}

// ---------- timeline graph ----------
export async function graph(r, out) {
  const Wd = 1600, pad = 60, x = (s) => pad + ((s - r.start) / r.duration) * (Wd - 2 * pad);
  const yT = 70, hT = 180; // motion lane
  const H = yT + hT + (r.captions ? 130 : 100);
  const mot = r.series.motion, lum = r.series.luma, mov = r.series.moved;
  const maxM = Math.max(4, ...mot.slice(1).map((v) => Math.min(v, 40)));
  const poly = (arr, y0, h, mx, from = 0) => arr.map((v, i) => (i < from ? '' : `${x(r.start + i / r.fps).toFixed(1)},${(y0 + h - (Math.min(v, mx) / mx) * h).toFixed(1)}`)).filter(Boolean).join(' ');
  let lastX = -1e9, row = 0;
  const shotsSVG = r.shots.map((s) => {
    const sx = x(Math.max(r.start, s.start));
    row = sx - lastX < 150 ? 1 - row : 0; lastX = sx;
    const right = sx > Wd - pad - 150;
    const label = `${esc(s.id)}${s.start > r.start + 1e-6 && s.in !== 'cut' ? ` (${esc(s.in)})` : ''}`;
    return `<line x1="${sx}" x2="${sx}" y1="40" y2="${H - 40}" class="shot"/><text x="${right ? sx - 4 : sx + 4}" y="${50 + row * 13}" class="lbl" text-anchor="${right ? 'end' : 'start'}">${label}</text>`;
  }).join('');
  const staleSVG = r.stale.map((s) => `<rect x="${x(s.start)}" width="${Math.max(2, x(s.end) - x(s.start))}" y="${yT}" height="${hT}" class="stale"/>`).join('');
  const lullSVG = r.lulls.map((s) => `<rect x="${x(s.start)}" width="${Math.max(2, x(s.end) - x(s.start))}" y="${yT + hT + 8}" height="14" class="lull"/>`).join('');
  const evSVG = r.events.map((e) => `<line x1="${x(e)}" x2="${x(e)}" y1="${yT + hT + 6}" y2="${yT + hT + 24}" class="ev"/>`).join('');
  const cutSVG = r.cuts.map((c) => `<line x1="${x(c.t)}" x2="${x(c.t)}" y1="${yT}" y2="${yT + hT}" class="cut"/>`).join('');
  const marks = [...r.flashes.filter((f) => !f.planned).map((f) => ['flash', f.t]), ...r.pops.filter((p) => !p.planned).map((p) => [p.kind === 'jump inside motion' ? 'jump' : 'pop', p.t]), ...r.hitches.map((h) => ['hitch', h.t])].map(([k, tt]) => `<circle cx="${x(tt)}" cy="${yT + 10}" r="6" class="${k}"/>`).join('');
  const cx = (v) => x(Math.min(r.start + r.duration, Math.max(r.start, v)));
  const capSVG = r.captions ? r.captions.all.map((c) => `<rect x="${cx(c.start)}" width="${Math.max(1, cx(c.end) - cx(c.start) - 1)}" y="${yT + hT + 52}" height="22" rx="3" class="${c.dur < LIMITS.flicker ? 'fast' : c.dangling ? 'mid' : 'ok'}"><title>${esc(c.text)}</title></rect>`).join('') : '';
  const ticks = []; for (let s = Math.ceil(r.start); s <= r.start + r.duration + 1e-6; s += 1) ticks.push(`<line x1="${x(s)}" x2="${x(s)}" y1="${H - 44}" y2="${H - 38}" class="tick"/>` + (s % 2 === 0 ? `<text x="${x(s)}" y="${H - 24}" class="tl">${s}</text>` : ''));
  const s = r.summary;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Wd}" height="${H}" viewBox="0 0 ${Wd} ${H}">
    <rect width="${Wd}" height="${H}" fill="#0c0d10"/>
    <text x="${pad}" y="26" class="ttl">${esc(path.basename(r.video))} · ${s.eventsPerSecond.toFixed(2)} events/s · ${r.stale.length} stale · ${s.cuts} cuts · ${s.flashes} flashes · ${s.pops} pops · ${s.jumps} jumps${s.hook != null ? ` · hook ${s.hook}` : ''}${r.captions ? ` · ${s.flicker} flicker · ${s.dangling} dangling` : ''}</text>
    ${staleSVG}${shotsSVG}
    <rect x="${pad}" y="${yT}" width="${Wd - 2 * pad}" height="${hT}" class="lane"/>
    <polyline points="${poly(lum, yT, hT, 255)}" class="luma"/>
    <polyline points="${poly(mov, yT, hT, Math.max(8, ...mov), Math.round(LIMITS.stale * r.fps))}" class="moved"/>
    <polyline points="${poly(mot, yT, hT, maxM)}" class="motion"/>
    ${cutSVG}${marks}${lullSVG}${evSVG}${capSVG}
    <text x="${pad - 8}" y="${yT + 14}" class="side">motion</text><text x="${pad - 8}" y="${yT + hT + 20}" class="side">events</text>${r.captions ? `<text x="${pad - 8}" y="${yT + hT + 68}" class="side">captions</text>` : ''}
    ${ticks.join('')}
    <text x="${Wd - pad}" y="${H - 6}" class="key" text-anchor="end">orange motion · blue 0.6 s change · grey luma · red bands stale · yellow lulls · white ticks events · cyan cuts · dots: red flash, orange pop, ring jump, violet hitch · captions green ok, yellow dangling, red flicker</text>
  </svg>`;
  const html = `<!doctype html><meta charset="utf-8"><style>${fontCSS}body{margin:0;background:#0c0d10;font-family:Inter,sans-serif}
    .ttl{fill:#fff;font:700 17px Inter}.lbl{fill:#8fc2ff;font:600 12px Inter}.side{fill:#7d8491;font:600 12px Inter;text-anchor:end}.tl{fill:#7d8491;font:500 12px Inter;text-anchor:middle}.key{fill:#5b616c;font:500 12px Inter}
    .lane{fill:none;stroke:#262a33}.luma{fill:none;stroke:#59606c;stroke-width:1.5}.motion{fill:none;stroke:#ffb43c;stroke-width:1.6}.moved{fill:none;stroke:#3d7fd1;stroke-width:1.2;opacity:.8}
    .stale{fill:rgba(255,70,70,.22)}.lull{fill:rgba(255,200,60,.35)}.ev{stroke:#fff;stroke-width:2}.cut{stroke:#3fe0ff;stroke-width:2}.shot{stroke:#3a4250;stroke-dasharray:4 4}
    .flash{fill:#ff4d4d}.pop{fill:#ff9a3c}.jump{fill:none;stroke:#ff9a3c;stroke-width:2}.hitch{fill:#b77dff}.ok{fill:#2f9e6a}.mid{fill:#c9a227}.fast{fill:#e04848}.tick{stroke:#4a505b}</style>${svg}`;
  const hf = out.replace(/\.\w+$/, '') + '.graph.html';
  fs.writeFileSync(hf, html);
  try { await shootHTML([hf], [out], Wd); } finally { fs.rmSync(hf, { force: true }); }
  return out;
}

// ---------- CLI ----------
if (import.meta.main) {
  const argv = process.argv.slice(2);
  // --graph takes an optional file: only an image path right after it counts as its value
  const gi = argv.indexOf('--graph');
  let graphOut = gi >= 0 ? true : null;
  if (gi >= 0 && argv[gi + 1] && /\.(png|jpe?g)$/i.test(argv[gi + 1])) { graphOut = argv[gi + 1]; argv.splice(gi, 2); } else if (gi >= 0) argv.splice(gi, 1);
  const { pos, opt } = args(argv, ['project', 'json']);
  if (!pos[0]) { console.error('usage: bun check.mjs <video.mp4> [--project <dir>] [--graph [file.png]] [--json file] [--no-project] [--quiet]'); process.exit(1); }
  const video = path.resolve(pos[0]);
  if (!fs.existsSync(video)) { console.error(`no such video: ${pos[0]}`); process.exit(1); }
  let project = null;
  if (!opt['no-project']) { project = findProject(video, typeof opt.project === 'string' ? opt.project : null); if (typeof opt.project === 'string' && !project) { console.error(`no project.json in ${opt.project}`); process.exit(1); } }
  const t0 = Date.now();
  const r = await analyse(video, { project, captions: !opt['no-captions'] });
  const base = path.join(path.dirname(video), path.basename(video, path.extname(video)));
  const jsonOut = typeof opt.json === 'string' ? path.resolve(opt.json) : base + '.check.json';
  fs.writeFileSync(jsonOut, JSON.stringify({ ...r, seconds: r2((Date.now() - t0) / 1000) }, null, 1));
  if (!opt.quiet) console.log(report(r));
  console.log(`  wrote     ${jsonOut}`);
  if (graphOut) { const g = await graph(r, typeof graphOut === 'string' ? path.resolve(graphOut) : base + '.check.png'); console.log(`  graph     ${g}`); }
}
