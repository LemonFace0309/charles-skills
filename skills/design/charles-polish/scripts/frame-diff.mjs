#!/usr/bin/env node
/* Plots how much each frame changes from the one before, so a pop shows up as a spike
   and a dead stretch as a flat line, before you read a single frame by eye.

   node frame-diff.mjs <frames-folder> [options]

   <frames-folder>  frames in name order: web-frames.mjs --motion's <name>-<width>-<scheme>/
                    folder, or sheet.mjs --keep's folder
   --fps 60         frame rate, to label times in ms
   --out <png>      the plot (default: <frames-folder>-diff.png)
   --size 160       width the frames are compared at, in px (small hides noise)
   --spike 3        a frame that changes this many times more than both its neighbours is
                    flagged: a pop, a flash or a swap. The fast first frames of an ease-out
                    aren't, because the frames beside them move almost as much
   --still 0.6      a still run this long (s) between two moves is flagged as dead

   Prints every flagged frame with the frames to read around it. Change is the mean
   absolute difference in brightness (0-255) between neighbouring frames. */
import fs from "node:fs";
import path from "node:path";
import { fail, need, parseArgs } from "./lib.mjs";

const a = parseArgs(process.argv.slice(2));
const dir = a._[0];
if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) fail("usage: node frame-diff.mjs <frames-folder> [--fps 60] [--out diff.png] (options are listed at the top of this file)");
const fps = Number(a.fps ?? 60);
const size = Number(a.size ?? 160);
const spikeX = Number(a.spike ?? 3);
const stillS = Number(a.still ?? 0.6);
const out = a.out ?? `${dir.replace(/\/+$/, "")}-diff.png`;
const sharp = (await need("sharp")).default;

const files = fs.readdirSync(dir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort();
if (files.length < 3) fail(`${dir} holds ${files.length} frames; capture at least 3`);

let prev = null;
const change = [0];
for (const f of files) {
  const { data } = await sharp(path.join(dir, f)).resize({ width: size }).greyscale().raw().toBuffer({ resolveWithObject: true });
  if (prev) {
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += Math.abs(data[i] - prev[i]);
    change.push(sum / data.length);
  }
  prev = data;
}

const ms = (i) => Math.round((i * 1000) / fps);
const MOVING = 0.05; // below this, nothing visible moved (compression and antialiasing noise stay under it)
const moving = change.filter((c) => c >= MOVING).sort((x, y) => x - y);
const median = moving.length ? moving[Math.floor(moving.length / 2)] : 0;
const report = [];

// Spikes: a frame that changes far more than both neighbours is a pop, a flash or a swap. Comparing with the
// neighbours, not with the median, keeps a legitimate fast start (an ease-out's first frames) out of the list.
const POP = 0.3; // smallest change worth flagging: about a 40 px square flipping at the default --size
const spikes = new Set();
change.forEach((c, i) => {
  if (!i || c < POP) return;
  const around = Math.max(change[i - 1] ?? 0, change[i + 1] ?? 0);
  if (c > spikeX * around) {
    spikes.add(i);
    const ratio = around ? `${(c / around).toFixed(1)}x its neighbours` : "with still frames on both sides";
    report.push(`spike  ${files[i]} (${ms(i)} ms): change ${c.toFixed(2)}, ${ratio}. Read ${files[Math.max(0, i - 2)]} to ${files[Math.min(files.length - 1, i + 2)]}`);
  }
});

// Dead stretches: a still run between two moves. Still frames before the first move and after the last are the rest poses.
const first = change.findIndex((c) => c >= MOVING);
const last = change.length - 1 - [...change].reverse().findIndex((c) => c >= MOVING);
const stills = new Set();
for (let i = first + 1; first >= 0 && i < last; i++) {
  if (change[i] >= MOVING) continue;
  let j = i;
  while (j < last && change[j] < MOVING) j++;
  if ((j - i) / fps >= stillS) {
    for (let k = i; k < j; k++) stills.add(k);
    report.push(`still  ${files[i]} to ${files[j - 1]} (${ms(i)}-${ms(j)} ms): ${((j - i) / fps).toFixed(2)} s with nothing moving between two moves`);
  }
  i = j;
}

// The plot: one bar per frame, spikes red, dead stretches shaded grey, a tick every 100 ms.
const W = Math.max(400, change.length * 4);
const H = 180;
const top = Math.max(...change, 1);
const bar = (W - 40) / change.length;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#101012"/>`;
for (const i of stills) svg += `<rect x="${(30 + i * bar).toFixed(1)}" y="10" width="${bar.toFixed(1)}" height="${H - 32}" fill="#5c5c63" opacity="0.35"/>`;
for (let t = 0; t <= ms(change.length); t += 100) {
  const x = 30 + (t / 1000) * fps * bar;
  svg += `<line x1="${x}" y1="10" x2="${x}" y2="${H - 22}" stroke="#2a2b2e"/><text x="${x + 2}" y="${H - 8}" font-family="monospace" font-size="10" fill="#8a8a90">${t}</text>`;
}
change.forEach((c, i) => {
  const h = Math.max(1, (c / top) * (H - 40));
  const fill = spikes.has(i) ? "#ff5a4f" : "#7fb2ff";
  svg += `<rect x="${(30 + i * bar).toFixed(1)}" y="${(H - 22 - h).toFixed(1)}" width="${Math.max(1, bar - 1).toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}"/>`;
});
svg += `</svg>`;
await sharp(Buffer.from(svg)).png().toFile(out);

console.log(`${files.length} frames at ${fps} fps, moving ${first >= 0 ? `${ms(first)}-${ms(last)} ms` : "never"}, median change ${median.toFixed(2)}`);
console.log(report.length ? report.join("\n") : "no spikes and no dead stretches");
console.log(`plot: ${out} (blue moving, red spikes, grey dead stretches, ms along the bottom)`);
