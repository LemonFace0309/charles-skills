#!/usr/bin/env bun
/* charles-create-posters kit. Run with Bun or Node 18+ from anywhere:

     bun <kit>/poster.mjs new <dir> [--event]                a poster folder: poster.html, brief.md, pic/, logo/, out/
                                                             (--event: the lockup and the two event sentences)
     bun <kit>/poster.mjs refs [--out <dir>]                 the real posters to study, plus refs/sheet.jpg
     bun <kit>/poster.mjs gen "<prompt>" --out pic/a.png [--model gpt|nano|mai|seedream|flux|krea] [--n 4]
                              [--size 1536x2048|full] [--ref img ...] [--allow-text]
     bun <kit>/poster.mjs edit <image> "<instruction>" --out pic/b.png [--model nano|gpt] [--ref img ...] [--box x,y,w,h]
     bun <kit>/poster.mjs composite <original> <edited> --box x,y,w,h --out pic/c.png   (redo a boxed edit's blend, free)
     bun <kit>/poster.mjs extend <image> --out pic/wide.png [--scale 0.7] [--anchor center|bottom|top] [--flat]   (zoom out)
     bun <kit>/poster.mjs recolor <image> --to "#hex" [--from "#hex"] [--range 24] --out pic/b.png   (pull a drifted hue onto the brand's)
     bun <kit>/poster.mjs recolor <image> --to "#hex" --ground pic/cut.png [--subject 0] --out pic/b.png   (grade the backdrop)
     bun <kit>/poster.mjs upscale <image> --out pic/final.png [--factor 2] [--model "High Fidelity V3"]
     bun <kit>/poster.mjs cutout <image> --out pic/cut.png
     bun <kit>/poster.mjs logo "<Company>" --out logo/company.svg [--qid Q182477] [--file "File:Nvidia logo.svg"] [--url <svg> [--symbol <id>]]
     bun <kit>/poster.mjs font "<Google family>" --out <dir>/fonts [--axes "wght@400;700"]
     bun <kit>/poster.mjs render <dir> [--html poster.html] [--year 2027]   (--year only if a date without one isn't the next one)
     bun <kit>/poster.mjs check <dir> [--refs 01,06,13,15]
     bun <kit>/poster.mjs sheet <image>... --out <file.jpg> [--cols 4] [--width 420]

   Pictures, edits, upscales and cutouts call fal.ai and need FAL_KEY (environment, or a .env in or above the working
   folder, or ~/.env). Rendering needs Google Chrome (or CHROME_PATH). Packages: run `bun install` (or
   `npm install`) in this folder once. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { falRun, download, dataUri, imagesOf } from './fal.mjs';
import { trimBorder, compositeBox, growGround, healExtension, seamView, blindTiles, fitTo } from './imageops.mjs';

const KIT = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.join(KIT, 'template');
const FONT_DIRS = [path.join(KIT, 'fonts'), path.join(KIT, 'node_modules/@fontsource/ibm-plex-mono/files')];
const CACHE = path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'charles-create-posters');
const UA = 'charles-create-posters/1.0 (poster kit; https://github.com/LemonFace0309/charles-skills)';

function fail(msg) { console.error(`error: ${msg}`); process.exit(1); }

function parse(argv, bools = []) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (!t.startsWith('--')) { out._.push(t); continue; }
    const k = t.slice(2);
    if (bools.includes(k)) { out[k] = true; continue; }
    const v = argv[++i];
    if (v === undefined) fail(`--${k} needs a value`);
    if (out[k] === undefined) out[k] = v; else out[k] = [].concat(out[k], v);
  }
  return out;
}
const list = (v) => (v === undefined ? [] : [].concat(v));

async function need(name) {
  try { return await import(name); } catch { fail(`missing package "${name}". Run: cd "${KIT}" && bun install   (or npm install)`); }
}

const CHROMES = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];

async function chrome() {
  const { chromium } = await need('playwright-core');
  const executablePath = CHROMES.find((p) => p && fs.existsSync(p));
  try {
    return await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}),
      args: ['--force-color-profile=srgb', '--hide-scrollbars', '--font-render-hinting=none'] });
  } catch (e) {
    fail(`couldn't start Chrome (${String(e.message).split('\n')[0]}). Install Google Chrome or set CHROME_PATH; if a sandbox blocked it, rerun with permission.`);
  }
}

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf' };

/* Serves the poster folder at / and the kit's template at /kit/ (fonts at /kit/fonts/). */
function serve(root) {
  const send = (res, file) => {
    if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  };
  const inside = (base, rel) => { const f = path.resolve(base, '.' + rel); return f.startsWith(path.resolve(base)) ? f : null; };
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (url.startsWith('/kit/fonts/')) { const name = path.basename(url); return send(res, FONT_DIRS.map((d) => path.join(d, name)).find((f) => fs.existsSync(f))); }
    if (url.startsWith('/kit/')) return send(res, inside(TEMPLATE, url.slice(4)));
    send(res, inside(root, url));
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

/* ---------- new ---------- */
function cmdNew(a) {
  const dir = path.resolve(a._[0] || fail('usage: new <dir> [--event]'));
  if (fs.existsSync(path.join(dir, 'poster.html'))) fail(`${dir}/poster.html exists already`);
  for (const d of ['pic', 'logo', 'out']) fs.mkdirSync(path.join(dir, d), { recursive: true });
  fs.copyFileSync(path.join(TEMPLATE, a.event ? 'poster-event.html' : 'poster.html'), path.join(dir, 'poster.html'));
  const facts = a.event ? `## The event (every fact checked against the source: date, time, zone, label, publisher's offer)\n\n` : '';
  fs.writeFileSync(path.join(dir, 'brief.md'), `# Poster brief\n\n## What goes on it (the logo alone, the user's words exactly, or an event they asked for)\n\n${facts}## The subject's world (name, logo, founder, product, words, material, heritage, its story right now, culture)\n\n## Ideas (20+, one line each, with their move)\n\n## Shortlist (3) with scores\n\n## The one, and why\n\n## Picture plan (medium, palette, light, crop, where the logo goes)\n\n## Critique log (each round: what the check showed, what changed)\n`);
  console.log(`new ${a.event ? 'event ' : ''}poster at ${dir}\n  next: write brief.md, then the picture into pic/, the logo into logo/${a.event ? ' (and the publisher\'s)' : ''}, then edit poster.html and render`);
}

/* ---------- refs ---------- */
function refList() { return JSON.parse(fs.readFileSync(path.join(KIT, 'refs.json'), 'utf8')); }

async function fetchTo(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return dest;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
  return dest;
}

async function ensureRefs(out = path.join(CACHE, 'refs')) {
  const data = refList();
  fs.mkdirSync(out, { recursive: true });
  const ff = ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg'].find((p) => fs.existsSync(p)) || 'ffmpeg';
  const haveFF = spawnSync(ff, ['-version']).status === 0;
  const done = [];
  for (const p of data.posters) {
    const dest = path.join(out, `${p.id}.jpg`);
    try {
      if (p.image) await fetchTo(p.image.split('?')[0] + '?name=orig', dest);
      else if (!fs.existsSync(dest)) {
        if (!haveFF) { console.warn(`skip ${p.id}: needs ffmpeg to cut it from ${p.video}`); continue; }
        const v = data.videos[p.video];
        const mp4 = await fetchTo(v.url, path.join(out, '_video', path.basename(v.url)));
        const frames = path.join(out, '_video', path.basename(v.url, '.mp4'));
        if (!fs.existsSync(frames)) { fs.mkdirSync(frames, { recursive: true }); spawnSync(ff, ['-v', 'error', '-i', mp4, '-vf', `fps=${v.fps}`, path.join(frames, 'f%03d.png')]); }
        const [x0, y0, x1, y1] = v.crop;
        const r = spawnSync(ff, ['-v', 'error', '-y', '-i', path.join(frames, `f${String(p.frame).padStart(3, '0')}.png`), '-vf', `crop=${x1 - x0}:${y1 - y0}:${x0}:${y0}`, '-q:v', '2', dest]);
        if (r.status !== 0) throw new Error(String(r.stderr));
      }
      done.push({ ...p, file: dest });
    } catch (e) { console.warn(`skip ${p.id}: ${e.message}`); }
  }
  return { out, posters: done, data };
}

async function cmdRefs(a) {
  const { out, posters } = await ensureRefs(a.out ? path.resolve(a.out) : undefined);
  await contactSheet(posters.map((p) => ({ file: p.file, label: `${p.id.slice(0, 2)} ${p.company} · ${p.date.slice(0, 7)}` })), path.join(out, 'sheet.jpg'), { cols: 6, width: 400 });
  for (const p of posters) console.log(`${p.file}  ${p.company}, ${p.event}: ${p.idea}`);
  console.log(`\nsheet: ${path.join(out, 'sheet.jpg')}  (notes on each: ${path.join(KIT, '..', 'references', 'swipe.md')})`);
}

/* ---------- pictures ---------- */
const MODELS = {
  gpt: { t2i: 'openai/gpt-image-2.6/sunburst/text-to-image', edit: 'openai/gpt-image-2.6/sunburst/edit',
    input: (o) => ({ prompt: o.prompt, image_size: { width: o.w, height: o.h }, quality: o.quality || 'high', output_format: 'png', num_images: 1,
      ...(o.refs.length ? { image_urls: o.refs } : {}), ...(o.mask ? { mask_url: o.mask } : {}) }) },
  nano: { t2i: 'google/nano-banana-2.1', edit: 'google/nano-banana-2.1/edit',
    input: (o) => ({ prompt: o.prompt, aspect_ratio: o.ratio, resolution: o.w * o.h > 6e6 ? '4K' : '2K', output_format: 'png', num_images: 1,
      ...(o.refs.length ? { image_urls: o.refs } : {}) }) },
  mai: { t2i: 'microsoft/mai-image-2.7/text-to-image', input: (o) => ({ prompt: o.prompt, image_size: o.w >= o.h ? 'landscape_4_3' : 'portrait_4_3', resolution: '2K', output_format: 'png' }) },
  seedream: { t2i: 'bytedance/seedream/v5.5/text-to-image', input: (o) => ({ prompt: o.prompt, image_size: { width: o.w, height: o.h }, output_format: 'png', num_images: 1 }) },
  flux: { t2i: 'blackforestlabs/flux-3/text-to-image', input: (o) => ({ prompt: o.prompt, aspect_ratio: o.ratio, resolution: '2k', output_format: 'png' }) },
  krea: { t2i: 'krea/v3/text-to-image', input: (o) => ({ prompt: o.prompt, image_size: { width: o.w, height: o.h }, output_format: 'png' }) },
};
const NO_TEXT = ' No text, letters, numbers, logos or watermarks anywhere in the image.';

function sizeOf(s, model) {
  if (!s || s === 'draft') return [1536, 2048];
  if (s === 'full') return model === 'gpt' ? [2448, 3264] : [2520, 3360];
  const m = String(s).match(/^(\d+)x(\d+)$/); if (!m) fail(`--size WxH, draft or full, not ${s}`);
  return [Number(m[1]), Number(m[2])];
}
function ratioOf(w, h) {
  const opts = [['1:1', 1], ['4:5', 0.8], ['3:4', 0.75], ['2:3', 2 / 3], ['9:16', 0.5625], ['5:4', 1.25], ['4:3', 4 / 3], ['3:2', 1.5], ['16:9', 16 / 9]];
  return opts.reduce((b, o) => (Math.abs(o[1] - w / h) < Math.abs(b[1] - w / h) ? o : b))[0];
}
function outNames(out, n) {
  const ext = path.extname(out) || '.png', base = out.slice(0, out.length - path.extname(out).length);
  return n === 1 ? [base + ext] : Array.from({ length: n }, (_, i) => `${base}-${i + 1}${ext}`);
}

/* Rough spend, logged beside the poster in spend.jsonl. fal prices these models by tokens and size, and billing isn't
   readable with every key, so these are estimates (USD per call) to keep a run honest, not an invoice. */
const PRICE = { gpt: (w, h) => (w * h > 6e6 ? 0.4 : 0.2), nano: (w, h) => (w * h > 6e6 ? 0.3 : 0.15), mai: () => 0.1, seedream: () => 0.03,
  flux: () => 0.2, krea: () => 0.08, upscale: () => 0.1, cutout: () => 0.01 };
function projectDir(file) {
  for (let d = path.dirname(path.resolve(file)); d !== path.dirname(d); d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, 'poster.html')) || fs.existsSync(path.join(d, 'brief.md'))) return d;
  }
  return process.cwd();
}
function logSpend(file, what, usd) {
  const f = path.join(projectDir(file), 'spend.jsonl');
  fs.appendFileSync(f, JSON.stringify({ at: new Date().toISOString(), what, usd }) + '\n');
  const total = fs.readFileSync(f, 'utf8').trim().split('\n').reduce((t, l) => t + (JSON.parse(l).usd || 0), 0);
  console.log(`spend so far on this poster, estimated: $${total.toFixed(2)}${total > 5 ? '  -- over $5: tell the user before spending more' : ''}`);
}

async function picture({ prompt, out, model = 'gpt', n = 1, size, refs = [], mask, allowText = false, edit = false, quality }) {
  const M = MODELS[model] || fail(`--model is one of ${Object.keys(MODELS).join(', ')}`);
  const endpoint = refs.length || edit ? (M.edit || fail(`${model} can't take reference images; use gpt or nano`)) : M.t2i;
  const [w, h] = sizeOf(size, model);
  const full = prompt + (allowText ? '' : NO_TEXT);
  const input = M.input({ prompt: full, w, h, ratio: ratioOf(w, h), refs: refs.map(dataUri), mask: mask && dataUri(mask), quality });
  const names = outNames(path.resolve(out), n);
  const t0 = Date.now();
  const results = await Promise.allSettled(names.map(async (file) => {
    const { result, seconds } = await falRun(endpoint, input);
    const im = imagesOf(result)[0]; if (!im) throw new Error(`no image in response: ${JSON.stringify(result).slice(0, 300)}`);
    await download(im.url, file);
    fs.writeFileSync(file.replace(/\.[a-z]+$/i, '.json'), JSON.stringify({ endpoint, model, prompt: full, size: [w, h], refs, seconds, seed: result.seed }, null, 1));
    return file;
  }));
  for (const r of results) console.log(r.status === 'fulfilled' ? `wrote ${r.value}` : `failed: ${r.reason.message}`);
  const made = results.filter((r) => r.status === 'fulfilled').length;
  if (made) logSpend(names[0], `${edit ? 'edit' : refs.length ? 'gen with refs' : 'gen'} ${model} x${made}`, made * (PRICE[model] || (() => 0.2))(w, h));
  const ok = results.filter((r) => r.status === 'fulfilled').length;
  console.log(`${model} via ${endpoint}: ${ok} of ${n} image(s), ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  if (results.every((r) => r.status === 'rejected')) process.exit(1);
}

async function cmdGen(a) {
  if (!a._[0] || !a.out) fail('usage: gen "<prompt>" --out pic/a.png [--model gpt] [--n 4] [--size draft|full|WxH] [--ref img]');
  await picture({ prompt: a._[0], out: a.out, model: a.model, n: Number(a.n || 1), size: a.size, refs: list(a.ref), allowText: !!a['allow-text'], quality: a.quality });
}
async function cmdEdit(a) {
  const [img, instruction] = a._;
  if (!img || !instruction || !a.out) fail('usage: edit <image> "<instruction>" --out pic/b.png [--model nano|gpt] [--ref more.png] [--box x,y,w,h]');
  // Edits redraw the whole frame. With --box (fractions 0..1 of the image, or pixels), only that box takes the edit,
  // through a feathered edge, and everything else stays the original's pixels.
  const box = a.box ? String(a.box).split(',').map(Number) : null;
  if (box && (box.length !== 4 || box.some((v) => !Number.isFinite(v)))) fail('--box x,y,w,h: four numbers, fractions of the image (0..1) or pixels');
  const raw = box ? path.resolve(a.out).replace(/(\.[a-z]+)$/i, '.raw$1') : a.out;
  await picture({ prompt: instruction, out: raw, model: a.model || 'nano', n: 1, size: a.size, refs: [img, ...list(a.ref)], mask: a.mask, allowText: !!a['allow-text'], edit: true, quality: a.quality });
  if (box) {
    const browser = await chrome();
    try { const px = await compositeBox(browser, path.resolve(img), raw, box, path.resolve(a.out), Number(a.feather || 24)); console.log(`kept the original outside ${px.join(',')} (px): wrote ${a.out}; the full edit is ${raw} (re-blend it with a wider box for free: composite ${img} ${raw} --box ... --out ...)`); }
    finally { await browser.close(); }
  }
}
/* Image models drift off brand colours (a yellow lime for a brand green). recolor turns the hues near --from (or the
   picture's most saturated hue) to --to's hue, keeps every pixel's lightness and only scales its saturation towards the
   brand's, capped, so shading and texture survive and nothing goes neon. */
async function cmdRecolor(a) {
  const img = a._[0]; if (!img || !a.to || !a.out) fail('usage: recolor <image> --to "#58cc02" [--from "#a8d400"] [--range 24] --out pic/b.png\n       recolor <image> --to "#10069f" --ground pic/cut.png [--subject 0] --out pic/b.png');
  if (a.ground) return recolorGround(a);
  const browser = await chrome();
  try {
    const res = await (await browser.newPage()).evaluate(async ({ src, to, from, range }) => {
      const im = new Image(); im.src = src; await im.decode();
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height); const p = d.data;
      const hex = (h) => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
      const toHsl = ([r, gg, b]) => { r /= 255; gg /= 255; b /= 255; const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), l = (mx + mn) / 2;
        if (mx === mn) return [0, 0, l]; const dd = mx - mn, s = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn);
        const h = mx === r ? (gg - b) / dd + (gg < b ? 6 : 0) : mx === gg ? (b - r) / dd + 2 : (r - gg) / dd + 4; return [h * 60, s, l]; };
      const hue2 = (p2, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p2 + (q - p2) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p2 + (q - p2) * (2 / 3 - t) * 6; return p2; };
      const toRgb = (h, s, l) => { if (!s) return [l * 255, l * 255, l * 255]; const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p2 = 2 * l - q, hh = h / 360;
        return [hue2(p2, q, hh + 1 / 3) * 255, hue2(p2, q, hh) * 255, hue2(p2, q, hh - 1 / 3) * 255]; };
      const [th, ts] = toHsl(hex(to));
      let fh;
      if (from) fh = toHsl(hex(from))[0];
      else { const bins = new Array(36).fill(0); for (let i = 0; i < p.length; i += 16) { const [h, s, l] = toHsl([p[i], p[i + 1], p[i + 2]]); if (s > 0.35 && l > 0.15 && l < 0.85) bins[Math.floor(h / 10) % 36] += s; }
        fh = bins.indexOf(Math.max(...bins)) * 10 + 5; }
      let changed = 0;
      for (let i = 0; i < p.length; i += 4) {
        const [h, s, l] = toHsl([p[i], p[i + 1], p[i + 2]]); if (s < 0.12) continue;
        const dh = Math.abs(((h - fh + 540) % 360) - 180); if (dh > range) continue;
        // full strength only on clearly coloured pixels: faint tints (shadows on white cloth, reflections) stay as they
        // were, because a warm tint reads as neutral and the same tint turned green reads as a halo
        const sw = Math.min(1, Math.max(0, (s - 0.18) / 0.27)); const ramp = sw * sw * (3 - 2 * sw);
        const w = (dh < range * 0.6 ? 1 : 1 - (dh - range * 0.6) / (range * 0.4)) * ramp;
        const ns = s > 0.4 ? Math.min(1, s * Math.min(1.25, ts / s) ** 0.5) : s;         // nudge saturation, capped
        const nh = h + (((th - h + 540) % 360) - 180) * w;
        const [r, gg, b] = toRgb((nh + 360) % 360, s + (ns - s) * w, l);
        p[i] = r; p[i + 1] = gg; p[i + 2] = b; changed++;
      }
      g.putImageData(d, 0, 0);
      return { data: c.toDataURL('image/png'), fh: Math.round(fh), th: Math.round(th), share: changed / (p.length / 4) };
    }, { src: dataUri(path.resolve(img)), to: a.to, from: a.from, range: Number(a.range || 24) });
    fs.writeFileSync(path.resolve(a.out), Buffer.from(res.data.split(',')[1], 'base64'));
    console.log(`wrote ${a.out}: hues near ${res.fh}° turned to ${res.th}° on ${(res.share * 100).toFixed(0)}% of the pixels. Check edges at 100% for halos.`);
  } finally { await browser.close(); }
}

/* The backdrop onto the brand's colour: every pixel outside the cutout's subject keeps its lightness (the light and
   shadow stay the photographer's) and takes the brand's hue, with chroma scaled to its lightness (a darker patch of
   the same paper holds less colour), worked in OKLab; where that would clip, the chroma comes down just enough (a
   smooth search, so no banding). The subject takes --subject of it (0 to 1), and only on the colours that mirror
   the backdrop's hue: a reflective subject picks up the new colour, a green leaf stays green. */
async function recolorGround(a) {
  const img = path.resolve(a._[0]), mask = path.resolve(a.ground);
  if (!fs.existsSync(mask)) fail(`${a.ground} not found: make it with cutout <image> --out ${a.ground}`);
  const browser = await chrome();
  try {
    const res = await (await browser.newPage()).evaluate(async ({ src, msk, to, subject }) => {
      const load = async (s) => { const im = new Image(); im.src = s; await im.decode(); return im; };
      const im = await load(src), mk = await load(msk), W = im.naturalWidth, H = im.naturalHeight;
      const draw = (x, blur) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d', { willReadFrequently: true }); if (blur) g.filter = `blur(${blur}px)`; g.drawImage(x, 0, 0, W, H); return { c, g, d: g.getImageData(0, 0, W, H) }; };
      const base = draw(im), p = base.d.data, m = draw(mk, Math.max(2, Math.round(W / 600))).d.data;
      const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4), gam = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.max(0, c) ** (1 / 2.4) - 0.055);
      const lab = (r, g, b) => { r = lin(r / 255); g = lin(g / 255); b = lin(b / 255);
        const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), mm = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
        return [0.2104542553 * l + 0.793617785 * mm - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * mm + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * mm - 0.808675766 * s]; };
      const rgb = (L, A, B) => { const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3, mm = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3, s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
        return [4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s].map((v) => gam(v) * 255); };
      const n = parseInt(to.replace('#', ''), 16), [Lb, Ab, Bb] = lab((n >> 16) & 255, (n >> 8) & 255, n & 255), Cb = Math.hypot(Ab, Bb), hb = Math.atan2(Bb, Ab);
      const ang = (x, y) => Math.abs(((x - y + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
      // the backdrop's own hue, from its coloured pixels: the subject only takes the grade where it mirrors this hue
      let sx = 0, sy = 0; for (let i = 0; i < p.length; i += 4 * 9) if (m[i + 3] < 25) { const [, A, B] = lab(p[i], p[i + 1], p[i + 2]), C = Math.hypot(A, B); if (C > 0.02) { sx += A / C; sy += B / C; } }
      const hg = Math.atan2(sy, sx);
      const inGamut = (o) => o.every((v) => v >= -0.5 && v <= 255.5);
      const before = [], after = [];
      for (let i = 0; i < p.length; i += 4) {
        const subj = m[i + 3] / 255;
        const [L, A, B] = lab(p[i], p[i + 1], p[i + 2]), C = Math.hypot(A, B), h = Math.atan2(B, A);
        const mirror = subj > 0 ? Math.max(0, Math.min(1, (0.8 - ang(h, hg)) / 0.35)) * Math.min(1, C / 0.04) : 0;   // within ~26° of the backdrop's hue, fading out by ~46°
        const w = (1 - subj) + subj * subject * mirror; if (w <= 0.001) continue;
        const Ct = Cb * Math.min(1.4, Math.max(0, L / Lb)) ** 0.8, dh = ((hb - h + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
        const nh = h + dh * w, nC = C + (Ct - C) * w, cs = Math.cos(nh), sn = Math.sin(nh);
        let out = rgb(L, nC * cs, nC * sn);
        if (!inGamut(out)) {   // the most chroma that fits, found by halving
          let lo = 0, hi = 1; out = rgb(L, 0, 0);
          for (let it = 0; it < 14; it++) { const mid = (lo + hi) / 2, o = rgb(L, nC * mid * cs, nC * mid * sn); if (inGamut(o)) { lo = mid; out = o; } else hi = mid; }
        }
        if (subj < 0.1 && (i / 4) % 7 === 0) { before.push([p[i], p[i + 1], p[i + 2]]); after.push(out); }
        p[i] = out[0]; p[i + 1] = out[1]; p[i + 2] = out[2];
      }
      base.g.putImageData(base.d, 0, 0);
      const medHex = (arr) => '#' + [0, 1, 2].map((ch) => { const v = arr.map((x) => x[ch]).sort((q, r) => q - r); return Math.round(Math.max(0, Math.min(255, v[v.length >> 1] || 0))).toString(16).padStart(2, '0'); }).join('');
      return { data: base.c.toDataURL('image/png'), before: medHex(before), after: medHex(after), share: before.length * 7 / (W * H) };
    }, { src: dataUri(img), msk: dataUri(mask), to: a.to, subject: Number(a.subject || 0) });
    fs.writeFileSync(path.resolve(a.out), Buffer.from(res.data.split(',')[1], 'base64'));
    console.log(`wrote ${a.out}: the backdrop (${Math.round(res.share * 100)}% of the picture) graded onto ${a.to}, its light kept; its median went from ${res.before} to ${res.after}. Check the subject's edge at 100% for a fringe; a darker or lighter median than the brand's is the light, not an error.`);
  } finally { await browser.close(); }
}

async function cmdComposite(a) {
  const [orig, edited] = a._;
  if (!orig || !edited || !a.box || !a.out) fail('usage: composite <original> <edited> --box x,y,w,h --out pic/c.png [--feather 24]');
  const box = String(a.box).split(',').map(Number);
  const browser = await chrome();
  try { const px = await compositeBox(browser, path.resolve(orig), path.resolve(edited), box, path.resolve(a.out), Number(a.feather || 24)); console.log(`wrote ${a.out}: the edit inside ${px.join(',')} (px), the original elsewhere`); }
  finally { await browser.close(); }
}

/* Image models ignore "make it 60% of the frame". extend shrinks the picture onto a canvas of the same size and fills
   the new margin. With --flat, the picture's own plain ground grows outward in code (free, no model, no seam). Without
   it, the edit model paints the surroundings; models shift the colours a little and repaint the picture's outer rim,
   which leaves a faint seam ~1% inside the old edge, so the kit finds the picture in the result, pastes the original
   back exactly and shifts the margin to match it. Either way it writes a seam view to check. */
async function cmdExtend(a) {
  const img = a._[0]; if (!img || !a.out) fail('usage: extend <image> --out pic/wide.png [--scale 0.7] [--anchor center|bottom|top] [--flat] [--model nano|gpt]');
  const scale = Number(a.scale || 0.7), anchor = a.anchor || 'center';
  const out = path.resolve(a.out), seams = out.replace(/(\.[a-z]+)$/i, '.seams.png');
  const frac = [(1 - scale) / 2, anchor === 'bottom' ? 1 - scale : anchor === 'top' ? 0 : (1 - scale) / 2, scale, scale];
  const seamNote = () => console.log(`seam view: ${seams} (colour differences x5). Open it: an edge or a change of tint along the yellow corner marks is a seam that will show on a plain ground.`);
  if (a.flat) {
    const browser = await chrome();
    try {
      const r = await growGround(browser, path.resolve(img), out, { scale, anchor });
      await seamView(browser, out, seams, frac);
      console.log(`wrote ${a.out}: the picture at ${Math.round(scale * 100)}% (${anchor}), its ground grown outward from its own edges (grain ${r.grain}), no model`);
      if (r.busy.length) console.log(`  WARNING: the ${r.busy.join(', ')} edge${r.busy.length > 1 ? 's aren\'t' : ' isn\'t'} evenly lit plain ground (light, a shadow or an object crosses it, or the light curves along it, as in a vignette), so the grown margin smudges there. Leave out --flat to have the model paint the surroundings (the kit heals its seam), or anchor that side to the frame.`);
      seamNote();
    } finally { await browser.close(); }
    return;
  }
  const padded = out.replace(/(\.[a-z]+)$/i, '.padded.png');
  const browser = await chrome();
  let box;
  try {
    const r = await (await browser.newPage()).evaluate(async ({ src, scale, anchor }) => {
      const im = new Image(); im.src = src; await im.decode();
      const W = im.naturalWidth, H = im.naturalHeight, w = Math.round(W * scale), h = Math.round(H * scale);
      const x = Math.round((W - w) / 2), y = anchor === 'bottom' ? H - h : anchor === 'top' ? 0 : Math.round((H - h) / 2);
      const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
      g.fillStyle = '#808080'; g.fillRect(0, 0, W, H); g.drawImage(im, x, y, w, h);
      return { data: c.toDataURL('image/png'), box: [x / W, y / H, w / W, h / H] };
    }, { src: dataUri(path.resolve(img)), scale, anchor });
    fs.writeFileSync(padded, Buffer.from(r.data.split(',')[1], 'base64')); box = r.box;
  } finally { await browser.close(); }
  const raw = out.replace(/(\.[a-z]+)$/i, '.raw$1');
  await picture({ prompt: 'Extend this photograph outward into the flat grey border so the whole frame is one seamless, wider shot of the same scene: continue the background, ground, light, grain and colour naturally to every edge. Keep everything inside the original picture as it is.', out: raw, model: a.model || 'nano', n: 1, refs: [padded], edit: true });
  if (!fs.existsSync(raw)) fail(`the model returned no picture (its reason is above). Run it again, or try --model ${a.model === 'gpt' ? 'nano' : 'gpt'}: their content checkers differ, and one sometimes refuses a picture the other takes.`);
  const b2 = await chrome();
  try {
    const r = await healExtension(b2, raw, path.resolve(img), out, box);
    if (r.matched) {
      const sh = Object.entries(r.sides).map(([s, v]) => `${s} ${v.shift.map((n) => (n > 0 ? '+' : '') + n).join(' ')}`).join(', ');
      const most = Math.max(0, ...Object.values(r.sides).flatMap((v) => v.shift.map(Math.abs)));
      console.log(`wrote ${a.out}: the picture at ${Math.round(scale * 100)}% (${anchor}), its surroundings painted in, the original pasted back where the model put it (match ${r.score}) and the margin shifted to it (R G B levels: ${sh})${most > 6 ? `; the model had moved the colours by up to ${Math.round(most)} levels, and the original's are back` : ''}. Unhealed: ${path.relative(process.cwd(), raw)}`);
    } else {
      fs.copyFileSync(raw, out);
      console.log(`wrote ${a.out}: the picture at ${Math.round(scale * 100)}% (${anchor}) with its surroundings painted in. Couldn't heal the seam: ${r.why}. On a plain ground use --flat instead.`);
    }
    // the model may hand back its own size (1792 x 2400 for 1536 x 2048): the result keeps the input's
    const dims = await (await b2.newPage()).evaluate(async (src) => { const im = new Image(); im.src = src; await im.decode(); return [im.naturalWidth, im.naturalHeight]; }, dataUri(path.resolve(img)));
    const from = await fitTo(b2, out, out, dims);
    if (from) console.log(`  the model answered at ${from.join(' x ')}; scaled back to ${dims.join(' x ')}`);
    await seamView(b2, out, seams, box);
  } finally { await b2.close(); }
  seamNote();
}

async function cmdUpscale(a) {
  const img = a._[0]; if (!img || !a.out) fail('usage: upscale <image> --out pic/final.png [--factor 2] [--soften 0.35]');
  const factor = Number(a.factor || 2);
  const { result } = await falRun('topaz/upscale/image/precision', { image_url: dataUri(img), upscale_factor: factor, model: a.model || 'High Fidelity V3', output_format: 'png', face_enhancement: false });
  const out = path.resolve(a.out); await download(imagesOf(result)[0].url, out); logSpend(out, 'upscale', PRICE.upscale());
  // Topaz pads its output with a dark frame (9 px on a 2x): cut it and scale back to exactly factor x the source.
  const browser = await chrome();
  try {
    const dims = await (await browser.newPage()).evaluate(async (src) => { const im = new Image(); im.src = src; await im.decode(); return [im.naturalWidth, im.naturalHeight]; }, dataUri(img));
    const { trimmed, size } = await trimBorder(browser, out, out, dims.map((v) => Math.round(v * factor)), Math.round(4.5 * factor));
    console.log(`wrote ${a.out} (${size.join('x')}; trimmed the upscaler's frame: ${[trimmed.top, trimmed.right, trimmed.bottom, trimmed.left].join('/')} px${trimmed.assumed ? ', its usual width, since dark edges hide it' : ''})`);
    // the upscaler can crunch fine texture into patterns (even letter-like marks): blend a plain upscale back in
    const soft = Number(a.soften || 0);
    if (soft > 0) {
      const data = await (await browser.newPage()).evaluate(async ({ src, up, s }) => {
        const load = async (x) => { const im = new Image(); im.src = x; await im.decode(); return im; };
        const A = await load(src), U = await load(up), c = document.createElement('canvas'); c.width = U.naturalWidth; c.height = U.naturalHeight;
        const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(A, 0, 0, c.width, c.height);
        g.globalAlpha = 1 - s; g.drawImage(U, 0, 0); return c.toDataURL('image/png');
      }, { src: dataUri(img), up: dataUri(out), s: Math.min(1, soft) });
      fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
      console.log(`  blended ${Math.round(Math.min(1, soft) * 100)}% of a plain upscale back in`);
    }
  } finally { await browser.close(); }
}
async function cmdCutout(a) {
  const img = a._[0]; if (!img || !a.out) fail('usage: cutout <image> --out pic/cut.png');
  const { result } = await falRun('fal-ai/birefnet/v2', { image_url: dataUri(img), model: 'General Use (Heavy)', operating_resolution: '2048x2048', output_format: 'png', refine_foreground: true });
  await download(imagesOf(result)[0].url, path.resolve(a.out)); logSpend(a.out, 'cutout', PRICE.cutout()); console.log(`wrote ${a.out}`);
}

/* ---------- logos (Wikidata P154 -> Wikimedia Commons) ---------- */
async function getJson(url) { const r = await fetch(url, { headers: { 'User-Agent': UA } }); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.json(); }
async function cmdLogo(a) {
  const name = a._[0]; if ((!name && !a.file && !a.url) || !a.out) fail('usage: logo "<Company>" --out logo/company.svg [--qid Q...] [--file "File:X.svg"] [--url https://.../logo.svg]');
  if (a.url) {   // the company's own file (press kit, site header), when Commons has no current logo
    const r = await fetch(a.url, { headers: { 'User-Agent': 'Mozilla/5.0' } }); if (!r.ok) fail(`couldn't download ${a.url}: ${r.status}`);
    let buf = Buffer.from(await r.arrayBuffer()); const isSvg = /<svg[\s>]/i.test(buf.subarray(0, 4000).toString());
    let out = path.resolve(a.out); out = out.replace(/\.[a-z0-9]+$/i, '') + (isSvg ? '.svg' : (path.extname(new URL(a.url).pathname) || '.png'));
    let note = '';
    if (isSvg) {
      // an icon sheet (a site's sprite of <symbol>s) draws nothing by itself: take one symbol out as its own file
      const txt = buf.toString('utf8');
      const symbols = [...txt.matchAll(/<symbol\b([^>]*)>([\s\S]*?)<\/symbol>/gi)].map((m) => ({ id: (m[1].match(/\bid\s*=\s*["']([^"']+)/) || [])[1], vb: (m[1].match(/viewBox\s*=\s*["']([^"']+)/i) || [])[1], body: m[2] }));
      const want = a.symbol || decodeURIComponent(new URL(a.url).hash.slice(1));
      if (symbols.length) {
        const pick = symbols.find((s) => s.id === want);
        if (!pick) note = `\n  WARNING: this is an icon sheet of ${symbols.length} symbols (${symbols.map((s) => s.id).filter(Boolean).slice(0, 12).join(', ')}${symbols.length > 12 ? ', ...' : ''}) and draws nothing as a logo. Run again with --symbol <id> to take one.`;
        else {
          const defs = (txt.match(/<defs\b[\s\S]*?<\/defs>/gi) || []).map((d) => d.replace(/<symbol\b[\s\S]*?<\/symbol>/gi, '')).join('');
          buf = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"${pick.vb ? ` viewBox="${pick.vb}"` : ''}>${defs}${pick.body}</svg>\n`);
          note = `\n  took the symbol "${pick.id}" out of the icon sheet`;
        }
      }
    }
    fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, buf);
    console.log(`wrote ${out} from ${a.url}${note}\n  check it at 100% and note the source in brief.md`); return;
  }
  let file = a.file;
  if (!file) {
    let qid = a.qid;
    if (!qid) {
      const s = await getJson(`https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&type=item&limit=8&search=${encodeURIComponent(name)}`);
      for (const hit of s.search || []) {
        const e = await getJson(`https://www.wikidata.org/wiki/Special:EntityData/${hit.id}.json`);
        const claims = e.entities[hit.id].claims || {};
        if (claims.P154) { qid = hit.id; console.log(`using ${hit.id}: ${hit.label} (${hit.description || ''})`); break; }
      }
      if (!qid) fail(`no Wikidata item for "${name}" has a logo. Take the company's own SVG (its site header or press kit) with --url, or a Wikimedia Commons file with --file "File:<name>.svg"`);
    }
    const e = await getJson(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`);
    const logos = (e.entities[qid].claims.P154 || []).filter((c) => c.mainsnak.datavalue);
    const named = (l) => /logo|wordmark|logotype/i.test(l.mainsnak.datavalue.value);
    const ended = (l) => (l.qualifiers?.P582 ? 1 : 0);
    logos.sort((x, y) => (ended(x) - ended(y)) || ((y.rank === 'preferred') - (x.rank === 'preferred')) || (named(y) - named(x)));
    if (!logos.length) fail(`${qid} has no logo image (P154)`);
    for (const l of logos) console.log(`  candidate: File:${l.mainsnak.datavalue.value}${l.qualifiers?.P582 ? ' (ended)' : ''}`);
    file = 'File:' + logos[0].mainsnak.datavalue.value;
    if (!named(logos[0])) console.log(`  WARNING: "${file}" isn't named as a logo (Wikidata sometimes lists a flag or a badge). Look at it; if it's wrong, take the company's own file with --url.`);
  }
  const title = file.replace(/^File:/i, '');
  const r = await fetch(`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(title)}`, { headers: { 'User-Agent': UA } });
  if (!r.ok) fail(`couldn't download ${file}: ${r.status}`);
  let out = path.resolve(a.out);
  const ext = path.extname(title).toLowerCase();
  if (path.extname(out).toLowerCase() !== ext) out = out.replace(/\.[a-z0-9]+$/i, '') + ext;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
  console.log(`wrote ${out}  from https://commons.wikimedia.org/wiki/${encodeURIComponent('File:' + title)}\n  check it at 100% against the logo in the company's own site header or brand guide: Commons often keeps a logo from before a rebrand. If they differ, take the company's file with --url (or another Commons file with --file).`);
}

/* ---------- fonts (Google Fonts) ---------- */
async function cmdFont(a) {
  const fam = a._[0]; if (!fam || !a.out) fail('usage: font "<Google family>" --out <dir>/fonts [--axes "wght@400;700"]');
  const q = encodeURIComponent(fam).replace(/%20/g, '+') + (a.axes ? ':' + a.axes : '');
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${q}&display=block`, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36' } })).text();
  if (!css.includes('@font-face')) fail(`Google Fonts has no "${fam}"${a.axes ? ` with ${a.axes}` : ''}`);
  const dir = path.resolve(a.out); fs.mkdirSync(dir, { recursive: true });
  let i = 0, local = css;
  for (const url of [...new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)]+/g) || [])]) {
    const name = `${fam.replace(/\s+/g, '-').toLowerCase()}-${i++}${path.extname(new URL(url).pathname) || '.woff2'}`;
    await fetchTo(url, path.join(dir, name)); local = local.split(url).join(name);
  }
  const cssFile = path.join(dir, `${fam.replace(/\s+/g, '-').toLowerCase()}.css`);
  fs.writeFileSync(cssFile, local);
  console.log(`wrote ${cssFile} and ${i} font file(s). Link it: <link rel="stylesheet" href="${path.relative(path.dirname(dir), cssFile)}"> and use font-family: '${fam}'`);
}

/* ---------- render ---------- */
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function factCheck(text, year) {
  const notes = [], now = Date.now();
  for (const m of text.matchAll(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+([A-Z][a-z]{2,8})\.?\s+(\d{1,2})(?:,\s*(\d{4}))?/g)) {
    const mi = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()); if (mi < 0) continue;
    // no year in the copy: the next time that date comes round (a call announced in November for February is next year's)
    let y = Number(m[4] || year), how = m[4] ? '' : year ? ', from --year' : '';
    if (!y) { const cy = new Date().getUTCFullYear(); y = Date.UTC(cy, mi, Number(m[3])) < now - 31 * 864e5 ? cy + 1 : cy; how = `, the next ${m[2]} ${m[3]}; pass --year if that's wrong`; }
    const d = new Date(Date.UTC(y, mi, Number(m[3])));
    if (DAYS[d.getUTCDay()] !== m[1]) notes.push(`WRONG DAY: "${m[0]}" is a ${DAYS[d.getUTCDay()]} in ${y}${how}`);
    else notes.push(`ok: ${m[0]} (${y}${how})`);
  }
  for (const m of text.matchAll(/\b(\d{1,2}):(\d{2})\s?(AM|PM|am|pm)\s?([A-Z]{2,4})?/g)) {
    if (m[1].length === 1) notes.push(`style: "${m[0]}" - the 2026 posters zero-pad the hour (05:00 PM ET)`);
    if (!m[4]) notes.push(`missing time zone after "${m[0]}"`);
  }
  if (/earnings|results|investor|webcast|conference call/i.test(text) && !/\b(19|20)\d\d\b|FY\d{2,4}|Q[1-4]/.test(text)) notes.push('an event line with no quarter or year');
  return notes;
}

async function cmdRender(a) {
  const dir = path.resolve(a._[0] || '.');
  const html = a.html || 'poster.html';
  if (!fs.existsSync(path.join(dir, html))) fail(`${path.join(dir, html)} not found (make one with: new <dir>)`);
  const outDir = path.join(dir, 'out'); fs.mkdirSync(outDir, { recursive: true });
  const stem = path.basename(html, '.html');
  const { server, port } = await serve(dir);
  const browser = await chrome();
  try {
    const page = await browser.newPage({ viewport: { width: 1260, height: 1680 }, deviceScaleFactor: 2 });
    const problems = [];
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) problems.push(`${m.type()}: ${m.text()}`); });
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => problems.push(`missing: ${r.url().replace(`http://127.0.0.1:${port}`, '')}`));
    page.on('response', (r) => { if (r.status() >= 400) problems.push(`missing (${r.status()}): ${r.url().replace(`http://127.0.0.1:${port}`, '')}`); });
    await page.goto(`http://127.0.0.1:${port}/${html}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__posterReady === true, null, { timeout: 180000 });
    const err = await page.evaluate(() => window.__posterError); if (err) problems.push(`poster script: ${err}`);
    const el = await page.$('.poster'); if (!el) fail('no .poster element');
    const box = await el.boundingBox();
    if (Math.round(box.width) !== 1260 || Math.round(box.height) !== 1680) problems.push(`the poster is ${box.width}x${box.height} CSS px, not 1260x1680`);
    const png = path.join(outDir, `${stem}.png`), jpg = path.join(outDir, `${stem}.jpg`);
    await el.screenshot({ path: png, type: 'png' });
    await el.screenshot({ path: jpg, type: 'jpeg', quality: 92 });
    const info = await page.evaluate(() => {
      const t = [...document.querySelectorAll('.copy, .title, [data-check-text]')].map((e) => e.innerText).join('\n');
      const out = [];
      const poster = document.querySelector('.poster').getBoundingClientRect();
      for (const e of document.querySelectorAll('.copy, .title, .lockup, .stack, .edge')) {
        const r = e.getBoundingClientRect(); if (!r.width) continue;
        const m = 70 - 1;
        const vertical = getComputedStyle(e.closest('.edge') || e).transform !== 'none';
        if (!vertical && (r.left < poster.left + m - 1 || r.right > poster.right - m + 1)) out.push(`${e.className} crosses the side margin (${Math.round(r.left)}-${Math.round(r.right)})`);
        if (r.top < poster.top + 40 || r.bottom > poster.bottom - 40) out.push(`${e.className} is within 40px of the top or bottom edge`);
      }
      // line breaks: group each copy block's words by line and flag orphans and long blocks
      for (const e of document.querySelectorAll('.copy')) {
        const words = []; const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
        for (let n; (n = walker.nextNode());) for (const m of n.textContent.matchAll(/\S+/g)) {
          const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
          const b = r.getClientRects()[0]; if (b) words.push({ w: m[0], top: Math.round(b.top), right: b.right });
        }
        const lines = []; for (const w of words) { const l = lines.find((x) => Math.abs(x.top - w.top) < 4); if (l) { l.words.push(w.w); l.right = Math.max(l.right, w.right); } else lines.push({ top: w.top, words: [w.w], right: w.right }); }
        const name = (e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 28);
        if (lines.length > 3) out.push(`"${name}..." runs to ${lines.length} lines; the posters keep each block to 3 (rephrase, move a break${e.classList.contains('a') ? ', or move column A left: see the column A note' : ''})`);
        for (const l of lines) { const txt = l.words.join(' '); if (txt.replace(/[^A-Za-z0-9]/g, '').length <= 3 && lines.length > 1) out.push(`orphan "${txt}" on its own line in "${name}..."`); }
        // pairs that must never be split across lines: a quarter and its year, a date and its year
        for (let i = 0; i + 1 < lines.length; i++) {
          const end = lines[i].words[lines[i].words.length - 1], next = lines[i + 1].words[0];
          if (/^(Q[1-4]|H[12]|FY)$/i.test(end) && /^(FY)?\d{2,4}\b/i.test(next)) out.push(`"${end} / ${next}": a quarter split from its year across a line break; move the break`);
          if (/^\d{1,2},$/.test(end) && /^(19|20)\d\d/.test(next)) out.push(`"${end} / ${next}": a date split from its year across a line break; move the break`);
        }
        if (lines.some((l) => l.right > poster.right - 69)) out.push(`"${name}..." runs past the right margin`);
      }
      // column A's longest line, unwrapped, against column B: a date with its year often needs column A moved left
      const ca = document.querySelector('.row > .copy.a'), cb = document.querySelector('.row > .copy.b');
      if (ca && cb) {
        const clone = ca.cloneNode(true);
        Object.assign(clone.style, { position: 'absolute', left: '0', top: '0', width: 'max-content', maxWidth: 'none', whiteSpace: 'nowrap', visibility: 'hidden' });
        ca.parentElement.appendChild(clone); const natural = clone.getBoundingClientRect().width; clone.remove();
        const a0 = ca.getBoundingClientRect().left, b0 = cb.getBoundingClientRect().left, gap = b0 - (a0 + natural);
        if (gap < 20) out.push(`column A: its longest line is ${Math.round(natural)} px and ${gap < 18 ? 'wraps' : `ends ${Math.round(gap)} px from column B`} (keep 20 or more): set :root { --colA: ${Math.floor((b0 - poster.left - natural - 32) / 2) * 2}px; } or break that line earlier`);
      }
      const lk = document.querySelector('.lockup'), mk = lk && lk.querySelector('.mark:not(.publisher)');
      let lockup = null;
      if (lk && mk) {
        const r = lk.getBoundingClientRect(), c = getComputedStyle(mk).backgroundColor.match(/[\d.]+/g).slice(0, 3).map(Number);
        lockup = { box: [r.left - poster.left, r.top - poster.top, r.width, r.height], ink: c };
      }
      return { text: t, layout: out, notes: window.__posterNotes || [], lockup };
    });
    const notes = [...factCheck(info.text, a.year ? Number(a.year) : 0), ...info.layout, ...info.notes];
    // the logo's contrast against what's behind it: the median of the rendered pixels around the lockup
    if (info.lockup) {
      const shot = await browser.newPage();
      const ratio = await shot.evaluate(async ({ src, box, ink }) => {
        const im = new Image(); im.src = src; await im.decode();
        const [x, y, w, h] = box.map((v) => Math.round(v * 2)), pad = 24, X = Math.max(0, x - pad), Y = Math.max(0, y - pad);
        const W = Math.min(im.naturalWidth - X, w + 2 * pad), H = Math.min(im.naturalHeight - Y, h + 2 * pad);
        const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(im, X, Y, W, H, 0, 0, W, H); const d = g.getImageData(0, 0, W, H).data;
        const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
        const lum = (r, gg, b) => 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b);
        const ls = []; for (let i = 0; i < d.length; i += 4) ls.push(lum(d[i], d[i + 1], d[i + 2])); ls.sort((p, q) => p - q);
        const ground = ls[ls.length >> 1], li = lum(...ink);
        return (Math.max(ground, li) + 0.05) / (Math.min(ground, li) + 0.05);
      }, { src: `data:image/png;base64,${fs.readFileSync(png).toString('base64')}`, box: info.lockup.box, ink: info.lockup.ink });
      await shot.close();
      if (ratio < 3) notes.push(`the logo is ${ratio.toFixed(1)}:1 against the ground behind it; keep 3:1 or more (4.5:1 for a badge with fine lettering): lighten --ink on a dark ground, darken it on a light one`);
    }
    // feed-size view: what a phone shows in the timeline (~400 px wide)
    const feed = await browser.newPage({ viewport: { width: 400, height: 534 }, deviceScaleFactor: 1 });
    await feed.setContent(`<body style="margin:0;background:#000"><img src="data:image/jpeg;base64,${fs.readFileSync(jpg).toString('base64')}" style="width:400px;height:534px;display:block"></body>`);
    await feed.waitForTimeout(150);
    await feed.screenshot({ path: path.join(outDir, `${stem}-feed.png`) });
    console.log(`rendered ${png} (2520x3360), ${jpg}, ${path.join(outDir, `${stem}-feed.png`)} (feed size)`);
    console.log(info.text.trim() ? 'copy:\n  ' + info.text.trim().split('\n').join('\n  ') : 'copy: none (the logo alone)');
    for (const n of notes) console.log(`check: ${n}`);
    for (const p of [...new Set(problems)]) console.log(`PROBLEM ${p}`);
    if (problems.length) process.exitCode = 2;
  } finally { await browser.close(); server.close(); }
}

/* ---------- check: the poster beside the real ones, at feed size and at full width ---------- */
async function cmdCheck(a) {
  const dir = path.resolve(a._[0] || '.');
  const poster = fs.existsSync(dir) && fs.statSync(dir).isFile() ? dir : path.join(dir, 'out', 'poster.jpg');
  if (!fs.existsSync(poster)) fail(`${poster} not found; render first`);
  const { posters } = await ensureRefs();
  // a mixed row by default: dark photo, colour photo, type, pixels, print, collage
  const want = a.refs ? String(a.refs).split(',').map((s) => s.trim().padStart(2, '0')) : ['01', '03', '04', '02', '13', '09'];
  const refs = posters.filter((p) => want.includes(p.id.slice(0, 2)));
  const outDir = path.dirname(poster);
  const stem = path.basename(poster).replace(/\.[a-z]+$/i, ''); const tag = stem === 'poster' ? '' : `-${stem}`;
  const tiles = [{ file: poster, label: 'THIS POSTER' }, ...refs.map((p) => ({ file: p.file, label: `${p.company} (Quartr)` }))];
  await contactSheet(tiles, path.join(outDir, `check-feed${tag}.jpg`), { cols: tiles.length, width: 300 });
  await contactSheet(tiles.slice(0, 3), path.join(outDir, `check-large${tag}.jpg`), { cols: 3, width: 760 });
  // The blind row: real posters whose info sits in the top or bottom band (cropped off, so no lockup or company-named
  // folder gives yours away), shuffled with a seed from your file so the letters stay put between runs, and written to
  // a neutral folder the critic can be pointed at.
  const blindRefs = posters.filter((p) => ['01', '03', '04', '06', '09', '20'].includes(p.id.slice(0, 2)));
  const blindSet = [{ file: poster }, ...blindRefs.map((p) => ({ file: p.file }))];
  let seedv = 0; for (const ch of poster) seedv = (seedv * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => { seedv = (seedv * 1664525 + 1013904223) >>> 0; return seedv / 4294967296; };
  const order = [...blindSet]; for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const blindDir = path.join(os.tmpdir(), `poster-critic-${(seedv % 1e6).toString(36)}`);
  fs.rmSync(blindDir, { recursive: true, force: true }); fs.mkdirSync(blindDir, { recursive: true });
  // every file alike: the top and bottom 12% of its own height cut off (where the lockup and copy sit), the same
  // width, re-encoded (no metadata) and dated alike, so nothing but the picture tells them apart
  const letters = order.map((t, i) => path.join(blindDir, `${String.fromCharCode(65 + i)}.jpg`));
  const nb = await chrome();
  try { await blindTiles(nb, order.map((t) => t.file), letters, { crop: 0.12, width: 720 }); } finally { await nb.close(); }
  const when = new Date(); for (const f of letters) fs.utimesSync(f, when, when);
  await contactSheet(letters.map((f, i) => ({ file: f, label: String.fromCharCode(65 + i) })), path.join(blindDir, 'row.jpg'), { cols: order.length, width: 300 });
  fs.utimesSync(path.join(blindDir, 'row.jpg'), when, when);
  const yours = String.fromCharCode(65 + order.findIndex((t) => t.file === poster));
  const html = path.join(path.dirname(outDir), `${stem}.html`);
  const layout = fs.existsSync(html) ? (fs.readFileSync(html, 'utf8').match(/class="poster"[^>]*data-layout="(\w+)"/) || [])[1] : '';
  const stats = await measure([poster, ...refs.map((p) => p.file)]);
  console.log('quiet = share of the frame that is calm field (16 px blocks with little detail); lum = mean brightness; colour = colourfulness');
  stats.forEach((s, i) => console.log(`${(i ? refs[i - 1].company : 'THIS POSTER').padEnd(20)} quiet ${(s.quiet * 100).toFixed(0).padStart(3)}%  lum ${s.lum.toFixed(0).padStart(3)}  colour ${s.colour.toFixed(0).padStart(3)}`));
  console.log(`\nwrote ${path.join(outDir, `check-feed${tag}.jpg`)} (open it: does yours hold its own in this row?) and ${path.join(outDir, `check-large${tag}.jpg`)}`);
  console.log('note: quiet counts any fine texture (weave, paper, stitches) as detail, so read it as a guide, not a score');
  console.log(`blind row for a fresh critic: ${blindDir} (row.jpg plus each poster as a letter, cropped and sized alike; no names in the path). Yours is ${yours}; don't tell the critic, and tell it to keep any files it makes in that folder and write nothing anywhere else.`);
  if (['centre', 'center', 'edge'].includes(layout)) console.log(`  note: your logo and words sit ${layout === 'edge' ? 'along the left edge' : 'in the middle'}, so the crop can't hide them. Tell the critic the posters come from different studios and to judge the picture and the idea, not the names.`);
}

async function measure(files) {
  const browser = await chrome();
  try {
    const page = await browser.newPage();
    const out = [];
    for (const f of files) {
      const src = `data:image/jpeg;base64,${fs.readFileSync(f).toString('base64')}`;
      out.push(await page.evaluate(async (src) => {
        const im = new Image(); im.src = src; await im.decode();
        const W = 360, H = Math.round(360 * im.naturalHeight / im.naturalWidth);
        const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.drawImage(im, 0, 0, W, H);
        const d = x.getImageData(0, 0, W, H).data;
        let quiet = 0, blocks = 0, lum = 0, rg = [], yb = [];
        for (let by = 0; by + 8 <= H; by += 8) for (let bx = 0; bx + 8 <= W; bx += 8) {
          let s = 0, s2 = 0;
          for (let y = by; y < by + 8; y++) for (let xx = bx; xx < bx + 8; xx++) { const o = (y * W + xx) * 4; const l = 0.2126 * d[o] + 0.7152 * d[o + 1] + 0.0722 * d[o + 2]; s += l; s2 += l * l; }
          const m = s / 64, v = s2 / 64 - m * m; blocks++; if (Math.sqrt(Math.max(0, v)) < 7) quiet++;
        }
        for (let o = 0; o < d.length; o += 4) { lum += 0.2126 * d[o] + 0.7152 * d[o + 1] + 0.0722 * d[o + 2]; rg.push(d[o] - d[o + 1]); yb.push((d[o] + d[o + 1]) / 2 - d[o + 2]); }
        const stat = (a) => { const m = a.reduce((p, q) => p + q, 0) / a.length; return [m, Math.sqrt(a.reduce((p, q) => p + (q - m) ** 2, 0) / a.length)]; };
        const [mrg, srg] = stat(rg), [myb, syb] = stat(yb);
        return { quiet: quiet / blocks, lum: lum / (d.length / 4), colour: Math.sqrt(srg ** 2 + syb ** 2) + 0.3 * Math.sqrt(mrg ** 2 + myb ** 2) };
      }, src));
    }
    return out;
  } finally { await browser.close(); }
}

/* ---------- sheet ---------- */
async function contactSheet(tiles, out, { cols = 4, width = 420 } = {}) {
  const browser = await chrome();
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const cells = tiles.map((t) => {
      const ext = path.extname(t.file).toLowerCase(); const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.svg' ? 'image/svg+xml' : 'image/jpeg';
      const img = `<img${ext === '.svg' ? ' class="svg"' : ''} src="data:${mime};base64,${fs.readFileSync(t.file).toString('base64')}">`;
      return `<figure>${img}<figcaption>${String(t.label || path.basename(t.file)).replace(/[<&]/g, '')}</figcaption></figure>`;
    }).join('');
    await page.setContent(`<style>body{margin:0;background:#141414;font:14px/1.3 -apple-system,Helvetica,sans-serif;color:#ddd}
      main{display:grid;grid-template-columns:repeat(${cols},${width}px);gap:14px;padding:14px;width:max-content;align-items:start}
      figure{margin:0}img{width:${width}px;height:auto;display:block;background:#0a0a0a}img.svg{background:#e9e9e6;padding:24px}
      figcaption{padding:7px 2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:${width}px}</style><main>${cells}</main>`);
    await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
    const m = await page.$('main');
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    await m.screenshot({ path: path.resolve(out), type: 'jpeg', quality: 86 });
  } finally { await browser.close(); }
  return out;
}
async function cmdSheet(a) {
  if (!a._.length || !a.out) fail('usage: sheet <image>... --out sheet.jpg [--cols 4] [--width 420]');
  await contactSheet(a._.map((f) => ({ file: path.resolve(f) })), a.out, { cols: Number(a.cols || 4), width: Number(a.width || 420) });
  console.log(`wrote ${a.out}`);
}

const [cmd, ...rest] = process.argv.slice(2);
const a = parse(rest, ['allow-text', 'flat', 'event']);
const cmds = { new: cmdNew, refs: cmdRefs, gen: cmdGen, edit: cmdEdit, composite: cmdComposite, extend: cmdExtend, recolor: cmdRecolor, upscale: cmdUpscale, cutout: cmdCutout, logo: cmdLogo, font: cmdFont, render: cmdRender, check: cmdCheck, sheet: cmdSheet };
if (!cmds[cmd]) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace('#!/usr/bin/env bun\n/* ', '')); process.exit(cmd ? 1 : 0); }
await cmds[cmd](a);
