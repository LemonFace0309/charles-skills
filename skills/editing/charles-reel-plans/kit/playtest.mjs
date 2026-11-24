#!/usr/bin/env node
// Cold playback test of a built plan page, as a computer that has never opened it gets it:
//
//   node <skill>/kit/playtest.mjs <video folder> [--mbps 12] [--cpu 4] [--line <n>]
//
// 1. Serves build/site through page.route at about 12 Mbps with the CPU slowed 4x, presses Play on #check, and reports
//    how long each line's still or clip took to show after its line started, how far each clip ran from the reel's
//    clock, whether the music played, and how many files came into memory.
// 2. Serves whole files to range requests, as a host without byte ranges does, and checks that pause, play and a jump
//    to a later script line (--line, counted from 1; two thirds of the way in by default) carry on instead of starting over.
// It exits 1 when a check fails. It needs Google Chrome (or CHROME_PATH) and playwright-core, found from the video
// folder, the folder you run it from, or this kit (`npm install --prefix <skill>/kit playwright-core` when none has it).
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); return i === -1 ? fallback : Number(args.splice(i, 2)[1]); };
const MBPS = opt("--mbps", 12), CPU = opt("--cpu", 4), LINE = opt("--line", null);
const VD = resolve(args[0] || ".");
const SITE = join(VD, "build/site");
if (!existsSync(join(SITE, "index.html"))) {
  console.error(`${SITE}/index.html isn't there: build it first (python3 -I <skill>/kit/build.py ${args[0] || "."} --site)`);
  process.exit(2);
}

function playwright() {
  for (const from of [join(VD, "x.js"), join(process.cwd(), "x.js"), fileURLToPath(import.meta.url)]) {
    try { return createRequire(from)("playwright-core"); } catch { /* try the next place */ }
  }
  console.error("playwright-core isn't installed where this can find it: npm install --prefix <skill>/kit playwright-core");
  process.exit(2);
}
const { chromium } = playwright();
const BPS = (MBPS * 1e6) / 8;
const TYPES = { ".webp": "image/webp", ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
  ".mp3": "audio/mpeg", ".png": "image/png", ".jpg": "image/jpeg" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];

async function open(wholeFiles) {
  const launch = { headless: true, args: ["--autoplay-policy=no-user-gesture-required"] };
  const browser = await chromium.launch(process.env.CHROME_PATH ? { ...launch, executablePath: process.env.CHROME_PATH }
    : { ...launch, channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.route("https://plan.test/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/" || url.pathname === "/index.html") {
      // the published page has no head of its own: the Artifact host wraps it, as this does
      const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${readFileSync(join(SITE, "index.html"), "utf8")}</body></html>`;
      return route.fulfill({ status: 200, contentType: "text/html", body });
    }
    const file = join(SITE, decodeURIComponent(url.pathname));
    if (!existsSync(file)) return route.fulfill({ status: 404, body: "" });
    const buf = readFileSync(file);
    const type = TYPES[file.slice(file.lastIndexOf("."))] || "application/octet-stream";
    const range = route.request().headers()["range"];
    let status = 200, body = buf;
    const headers = { "content-type": type, "accept-ranges": wholeFiles ? "none" : "bytes" };
    if (range && !wholeFiles) {
      const [a, b] = range.replace("bytes=", "").split("-");
      const start = +a, end = b ? Math.min(+b, buf.length - 1) : buf.length - 1;
      body = buf.subarray(start, end + 1);
      status = 206;
      headers["content-range"] = `bytes ${start}-${end}/${buf.length}`;
    }
    await sleep((body.length / BPS) * 1000);
    return route.fulfill({ status, headers, body });
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
  await page.goto("https://plan.test/#check");
  await page.waitForSelector("#play");
  return { browser, page };
}

// The reel's clock comes from #scrub, never the rounded #t-now. For a clip, `drift` is how far its frame is from where
// the reel's clock puts it (page.js syncClip: its line's start, plus `from`, looping or holding its last frame).
const state = (page) => page.evaluate(() => {
  const V = window.VIDEO, t = +document.querySelector("#scrub").value;
  const i = V.beats.findLastIndex((b) => t >= b.start);
  const v = document.querySelector("#visual");
  const el = v && !v.hidden ? v.querySelector("img, video") : null;
  const shown = !el ? null : el.tagName === "IMG" ? (el.complete && el.naturalWidth > 0) : el.readyState >= 2;
  let drift = null;
  const b = V.beats[i], vis = b && b.visual;
  if (el && el.tagName === "VIDEO" && vis && vis.type === "video" && Number.isFinite(el.duration) && el.duration > 0 && !el.paused) {
    let want = Math.max(0, t - b.start + (vis.from || 0));
    want = el.loop ? want % el.duration : Math.min(want, Math.max(0, el.duration - 0.04));
    const d = Math.abs(el.currentTime - want);
    drift = el.loop ? Math.min(d, el.duration - d) : d;
  }
  return { t, i, shown, drift,
    dot: !!document.querySelector(".heard-dot.on"), mem: (document.querySelector(".mem-note") || {}).textContent || "",
    total: V.total, beats: V.beats.map((x) => ({ start: x.start, dur: x.dur, say: x.say, visual: !!x.visual, video: !!(x.visual && x.visual.type === "video") })),
    script: (V.script || []).filter((ln) => ln.text.trim()).map((ln) => ({ i: ln.i, text: ln.text })) };
});

// 1. Cold play with byte ranges
{
  const { browser, page } = await open(false);
  const first = await state(page);
  const beats = first.beats, total = first.total;
  await page.click("#play");
  const firstSeen = new Map(), drifts = new Map(), dotSeen = [];
  const t0 = Date.now();
  let last = first;
  const LIMIT = 3 * total + 6;   // slowed down on a busy computer it can hold for clips and run under real time
  while (Date.now() - t0 < LIMIT * 1000) {
    const s = await state(page);
    last = s;
    dotSeen.push(s.dot);
    if (s.i >= 0 && beats[s.i].visual && s.shown && !firstSeen.has(s.i)) firstSeen.set(s.i, s.t - beats[s.i].start);
    // a clip's drift counts from 0.5 s into its line, once the first seek has had time to land
    if (s.drift != null && s.t - beats[s.i].start > 0.5) drifts.set(s.i, [...(drifts.get(s.i) || []), s.drift]);
    if (s.t >= total - 0.05) break;
    await sleep(50);
  }
  const late = [], drifting = [], medians = [];
  beats.forEach((b, i) => {
    if (!b.visual) return;
    const d = firstSeen.get(i);
    if (d == null || d > 0.15) late.push(`line ${i + 1} (${b.say.slice(0, 28)}): ${d == null ? "never" : d.toFixed(2) + " s"}`);
    const ds = (drifts.get(i) || []).sort((x, y) => x - y);
    if (ds.length) {
      const med = ds[Math.floor(ds.length / 2)];
      medians.push(med);
      // page.js lets a running clip drift up to 0.25 s before it seeks, so a median past that never caught up
      if (med > 0.25) drifting.push(`line ${i + 1} (${b.say.slice(0, 28)}): median ${med.toFixed(2)} s off, worst ${ds.at(-1).toFixed(2)} s`);
    }
  });
  const wall = (Date.now() - t0) / 1000;
  const [inMem, files] = (last.mem.match(/(\d+)\/(\d+)/) || []).slice(1).map(Number);
  const heard = dotSeen.filter(Boolean).length;
  console.log(`cold play: reached ${last.t.toFixed(2)} of ${total} s in ${wall.toFixed(1)} s (${wall <= total + 6 ? "kept real time" : "held for files or ran slow"}); `
    + `music played in ${heard} of ${dotSeen.length} samples; files in memory ${last.mem || "not shown"}`);
  console.log(late.length ? `  late visuals: ${late.join("; ")}` : "  every visual showed within 0.15 s of its line");
  const clips = beats.filter((b) => b.video).length;
  console.log(drifting.length ? `  clips off the reel's clock: ${drifting.join("; ")}`
    : !clips ? "  no clips to time"
    : `  every clip stayed on the reel's clock (${medians.length} of ${clips} clip lines measured, worst median ${Math.max(0, ...medians).toFixed(3)} s)`);
  if (last.t < total - 0.1) failures.push(`the reel stopped at ${last.t.toFixed(2)} of ${total} s`);
  if (late.length) failures.push(`${late.length} visual(s) showed late`);
  if (drifting.length) failures.push(`${drifting.length} clip(s) ran off the reel's clock`);
  if (!heard) failures.push("the music never played");
  if (files && inMem < files) failures.push(`only ${inMem} of ${files} files came into memory`);
  await browser.close();
}

// 2. Whole files only (no byte ranges): pause, play and a jump to a later script line must carry on
{
  const { browser, page } = await open(true);
  const s0 = await state(page);
  const lines = s0.script.filter((ln) => ln.i != null);
  const want = LINE != null ? LINE - 1 : Math.floor((s0.beats.length * 2) / 3);
  const k = lines.findIndex((ln) => ln.i >= want);
  await page.click("#play");
  await sleep(6000);
  const a = await state(page);
  await page.click("#play");
  await sleep(800);
  const b = await state(page);
  await page.click("#play");
  await sleep(1500);
  const c = await state(page);
  let jump = "no script line is tied to a later line, so no jump was tested";
  if (k >= 0) {
    const target = s0.beats[lines[k].i].start;
    await page.locator("#script-lines p.seekable").nth(k).click();
    await sleep(1500);
    const d = await state(page);
    const ok = d.t >= target && d.t < target + 3;
    jump = `jumped to line ${lines[k].i + 1} at ${target.toFixed(2)} s, now ${d.t.toFixed(2)} (${ok ? "ok" : "WRONG"}); music ${d.dot ? "on" : "off"}`;
    if (!ok) failures.push(`a jump to line ${lines[k].i + 1} landed at ${d.t.toFixed(2)} s instead of ${target.toFixed(2)}`);
  }
  console.log(`whole files: playing ${a.t.toFixed(2)} s, paused at ${b.t.toFixed(2)}, playing again ${c.t.toFixed(2)} `
    + `(${c.t > b.t ? "carried on" : "STARTED OVER"}); ${jump}`);
  if (!(c.t > b.t)) failures.push("pause and play started the reel over");
  await browser.close();
}

console.log(failures.length ? `\nFAIL: ${failures.join("; ")}` : "\nPASS");
process.exit(failures.length ? 1 : 0);
