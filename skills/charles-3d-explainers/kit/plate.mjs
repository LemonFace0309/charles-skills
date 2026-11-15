#!/usr/bin/env bun
/* Makes a plate: an AI-generated cinematic still plus its depth map, which engine/props/plates.js turns into a 2.5D
   set that the 3D camera can move through (with glowing lines and labels tracked into it).

     bun <kit>/plate.mjs <project> --name kitchen --prompt "a kitchen counter at 1 AM, a microwave glowing"
     bun <kit>/plate.mjs <project> --name kitchen --prompt "..." --ref layout.png --ref style.png   (edit from references)
     bun <kit>/plate.mjs <project> --name kitchen --image my-still.png      (bring your own still: depth only)
     bun <kit>/plate.mjs <project> --name kitchen --redepth                 (run the depth step again on the saved still)

   Options:
     --aspect 9:16        image aspect (default 9:16, the reel frame)
     --res 2K|4K          image resolution (default 2K = 1536 x 2752; 4K for push-ins past ~45%, costs double)
     --seed N             fixed seed, so a re-run with a tweaked prompt changes less
     --depth moge|dav2    depth model: moge = MoGe-3 (metric depth + camera field of view, sharp edges, default),
                          dav2 = Depth Anything V2 (relative depth, cheaper, softer edges)
     --no-style           send the prompt as written, without the house style
     --force              generate again even if the same request is already on disk
     --dry                print the full prompt and the cost estimate, spend nothing
     --keep-raw           keep the depth model's raw outputs in assets/plates/.raw/

   Writes <project>/assets/plates/<name>.png (the still), <name>-depth.png (16-bit greyscale, white = near, linear in
   1/distance between near and far) and <name>.json (camera field of view, near/far, prompt, models, cost). Every paid
   call is appended to assets/plates/costs.jsonl. FAL_KEY comes from the environment or the nearest .env file. */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const KIT = path.dirname(new URL(import.meta.url).pathname);
const IMAGE_MODEL = 'fal-ai/nano-banana-pro';
const DEPTH_MODELS = { moge: 'microsoft/moge-3', dav2: 'fal-ai/image-preprocessors/depth-anything/v2' };
// $ estimates (fal list prices, Nov 2026): the image is per image (4K counts double); MoGe is per input megapixel.
const PRICE = { image: 0.15, image4k: 0.3, moge: 0.015, dav2: 0.01 };

// The house style: every plate in a video should look like frames of one film, and like the kit's own 3D renders.
const STYLE = 'Style: a cinematic high-end 3D render, soft global illumination, shallow depth of field, clean stylised materials with subtle surface texture, rich but gentle contrast, a little atmospheric haze. No text, no letters, no numbers, no logos, no watermark, no UI. Vertical 9:16 frame.';
// What makes a still survive being turned into 2.5D: depth layers, a subject with room around it, nothing fine and
// see-through in front (thin, glassy and mirror-like things get the wrong depth and tear when the camera moves).
const LAYOUT = 'Composition: clear foreground, middle ground and background; the main subject in the middle of the frame with breathing room on every side, not cut off by the edges; calm, uncluttered space in the top third; no mirrors, no thin wires or plants in the foreground.';
const MOOD = {
  'night-amber': 'Colour: deep navy-blue night tones, faint cool blue rim light, and one warm amber light source.',
  'ocean-blue': 'Colour: deep ocean-blue tones with one warm yellow light source.',
  space: 'Colour: near-black space tones, one warm golden key light, faint cool fill.',
  'studio-cool': 'Colour: cool blue-grey studio tones with one warm orange accent light.',
  dusk: 'Colour: violet-to-orange dusk tones with warm amber highlights.',
  'emerald-night': 'Colour: dark green-black night tones with one bright mint-green light source.',
  'studio-light': 'Colour: bright, airy off-white studio tones with one cobalt-blue accent.',
};

// ---------- arguments ----------
function parse(argv) {
  const valued = new Set(['name', 'prompt', 'ref', 'aspect', 'res', 'seed', 'depth', 'image']);
  const pos = [], opt = { ref: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { pos.push(a); continue; }
    const k = a.slice(2);
    if (valued.has(k)) { const v = argv[++i]; if (v == null) die(`--${k} needs a value`); if (k === 'ref') opt.ref.push(v); else opt[k] = v; }
    else opt[k] = true;
  }
  return { pos, opt };
}
function die(msg) { console.error('plate: ' + msg); process.exit(1); }

// ---------- fal ----------
function findKey(...starts) {
  if (process.env.FAL_KEY) return process.env.FAL_KEY.trim();
  for (const s of starts) {
    for (let d = path.resolve(s); ; d = path.dirname(d)) {
      const f = path.join(d, '.env');
      if (fs.existsSync(f)) { const m = fs.readFileSync(f, 'utf8').match(/^FAL_KEY=(.+)$/m); if (m) return m[1].trim().replace(/^["']|["']$/g, ''); }
      if (path.dirname(d) === d) break;
    }
  }
  die('FAL_KEY not found: set it in the environment or in a .env file');
}
let KEY = null;
async function http(url, { body, method, raw } = {}) {
  for (let attempt = 0; ; attempt++) {
    let r;
    try {
      r = await fetch(url, { method: method || (body ? 'POST' : 'GET'), headers: { Authorization: `Key ${KEY}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    } catch (e) { if (attempt < 3) { await sleep(2000 * (attempt + 1)); continue; } throw e; }
    if (r.ok) return raw ? r : r.json();
    const text = await r.text();
    if (r.status >= 500 && attempt < 3) { await sleep(3000 * (attempt + 1)); continue; }
    throw new Error(`HTTP ${r.status} from ${url.replace(/\?.*/, '')}: ${text.slice(0, 900)}`);
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function upload(file) {
  const bytes = fs.readFileSync(file);
  const ext = path.extname(file).toLowerCase();
  const type = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[ext] || 'application/octet-stream';
  const init = await http('https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3', { body: { content_type: type, file_name: path.basename(file) } });
  const put = await fetch(init.upload_url, { method: 'PUT', headers: { 'Content-Type': type }, body: bytes });
  if (!put.ok) throw new Error(`upload of ${path.basename(file)} failed: HTTP ${put.status}`);
  return init.file_url;
}
async function queue(endpoint, payload, label) {
  const t0 = Date.now();
  const job = await http(`https://queue.fal.run/${endpoint}`, { body: payload });
  let last = '';
  for (;;) {
    const st = await http(job.status_url);
    if (st.status === 'COMPLETED') break;
    if (st.status !== last) { process.stdout.write(`  ${label}: ${st.status.toLowerCase().replace('_', ' ')}\n`); last = st.status; }
    if (Date.now() - t0 > 15 * 60 * 1000) throw new Error(`${endpoint} timed out (${st.status})`);
    await sleep(2500);
  }
  const res = await http(job.response_url);
  return { res, secs: (Date.now() - t0) / 1000 };
}
async function download(url, file) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download failed: HTTP ${r.status}`);
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  return file;
}

// ---------- PNG (read any non-interlaced PNG, write 16-bit greyscale) ----------
function readPNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let o = 8, W, H, bits, type, inter, pal = null; const idat = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o), kind = buf.toString('ascii', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len);
    if (kind === 'IHDR') { W = d.readUInt32BE(0); H = d.readUInt32BE(4); bits = d[8]; type = d[9]; inter = d[12]; }
    else if (kind === 'PLTE') pal = d;
    else if (kind === 'IDAT') idat.push(d);
    else if (kind === 'IEND') break;
    o += 12 + len;
  }
  if (inter) throw new Error('interlaced PNGs are not supported');
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = Math.max(1, (ch * bits) >> 3), stride = (W * ch * bits + 7) >> 3;
  const out = Buffer.alloc(stride * H);
  for (let y = 0; y < H; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[dst + x - bpp] : 0, b = y ? out[dst - stride + x] : 0, c = x >= bpp && y ? out[dst - stride + x - bpp] : 0;
      let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[dst + x] = v & 255;
    }
  }
  // first channel (or palette red) as floats 0..1
  const first = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (bits === 16) first[i] = out.readUInt16BE(y * stride + x * ch * 2) / 65535;
    else if (bits === 8) first[i] = (type === 3 ? pal[out[y * stride + x] * 3] : out[y * stride + x * ch]) / 255;
    else { const per = 8 / bits, byte = out[y * stride + Math.floor(x / per)], v = (byte >> (8 - bits * (1 + (x % per)))) & ((1 << bits) - 1); first[i] = type === 3 ? pal[v * 3] / 255 : v / ((1 << bits) - 1); }
  }
  return { width: W, height: H, bits, type, channels: ch, first };
}
const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
function crc32(buf) { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(kind, data) { const b = Buffer.alloc(12 + data.length); b.writeUInt32BE(data.length, 0); b.write(kind, 4, 'ascii'); data.copy(b, 8); b.writeUInt32BE(crc32(b.subarray(4, 8 + data.length)), 8 + data.length); return b; }
function writePNG16(file, W, H, values) { // values: Float32Array 0..1, row-major from the top
  const stride = W * 2, raw = Buffer.alloc((stride + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (stride + 1)] = 2; // "up" filter: smooth depth compresses far better
    for (let x = 0; x < W; x++) {
      const v = Math.round(Math.min(1, Math.max(0, values[y * W + x])) * 65535), pv = y ? Math.round(Math.min(1, Math.max(0, values[(y - 1) * W + x])) * 65535) : 0;
      const o = y * (stride + 1) + 1 + x * 2;
      raw[o] = ((v >> 8) - (pv >> 8)) & 255; raw[o + 1] = ((v & 255) - (pv & 255)) & 255;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 16; ihdr[9] = 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
}
function pngSize(file) { const b = fs.readFileSync(file); if (b.readUInt32BE(0) !== 0x89504e47) return null; return [b.readUInt32BE(16), b.readUInt32BE(20)]; }
function toPNG(src, dst) { // any image ffmpeg can read -> 8-bit RGB PNG
  const r = spawnSync(fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg', ['-v', 'error', '-y', '-i', src, '-frames:v', '1', '-pix_fmt', 'rgb24', dst]);
  if (r.status !== 0) die(`cannot convert ${src} to PNG: ${r.stderr}`);
}

// ---------- PLY (MoGe's point cloud: x, y, z per pixel in camera space) ----------
function readPLY(buf) {
  const end = buf.indexOf('end_header');
  if (end < 0) throw new Error('not a PLY');
  const head = buf.toString('ascii', 0, end).split(/\r?\n/);
  const fmt = (head.find((l) => l.startsWith('format')) || '').split(/\s+/)[1];
  if (fmt !== 'binary_little_endian') throw new Error('PLY format ' + fmt + ' not supported');
  const SZ = { char: 1, uchar: 1, int8: 1, uint8: 1, short: 2, ushort: 2, int16: 2, uint16: 2, int: 4, uint: 4, int32: 4, uint32: 4, float: 4, float32: 4, double: 8, float64: 8 };
  const els = []; let cur = null;
  for (const l of head) {
    const p = l.trim().split(/\s+/);
    if (p[0] === 'element') { cur = { name: p[1], count: +p[2], props: [] }; els.push(cur); }
    else if (p[0] === 'property' && cur) { if (p[1] === 'list') { if (cur.name === 'vertex') throw new Error('PLY vertex lists are not supported'); continue; } cur.props.push({ type: p[1], name: p[2] }); }
  }
  const v = els.find((e) => e.name === 'vertex'); if (!v || els[0] !== v) throw new Error('PLY has no leading vertex element');
  let off = 0; for (const p of v.props) { p.off = off; off += SZ[p.type]; }
  const rec = off, body = buf.indexOf('\n', end) + 1, n = v.count;
  const get = (name) => {
    const p = v.props.find((q) => q.name === name); if (!p) return null;
    const a = new Float32Array(n);
    for (let i = 0, o = body + p.off; i < n; i++, o += rec) a[i] = p.type.startsWith('float') && SZ[p.type] === 4 ? buf.readFloatLE(o) : SZ[p.type] === 8 ? buf.readDoubleLE(o) : p.type.includes('u') ? (SZ[p.type] === 1 ? buf[o] : SZ[p.type] === 2 ? buf.readUInt16LE(o) : buf.readUInt32LE(o)) : (SZ[p.type] === 1 ? buf.readInt8(o) : SZ[p.type] === 2 ? buf.readInt16LE(o) : buf.readInt32LE(o));
    return a;
  };
  return { n, x: get('x'), y: get('y'), z: get('z') };
}

// Fill holes (NaN) in a W x H float map by push-pull: average known neighbours at coarser and coarser scales, then
// paint them back in. Smooth, and it never invents values outside what is around the hole.
function fillHoles(W, H, a) {
  const levels = [{ W, H, v: a, w: Float32Array.from(a, (x) => (Number.isFinite(x) ? 1 : 0)) }];
  for (const L of levels) if (!L.v.every(Number.isFinite)) L.v = Float32Array.from(L.v, (x) => (Number.isFinite(x) ? x : 0));
  while (levels[levels.length - 1].W > 1 || levels[levels.length - 1].H > 1) {
    const P = levels[levels.length - 1], w2 = Math.max(1, (P.W + 1) >> 1), h2 = Math.max(1, (P.H + 1) >> 1);
    const v = new Float32Array(w2 * h2), w = new Float32Array(w2 * h2);
    for (let y = 0; y < P.H; y++) for (let x = 0; x < P.W; x++) { const i = y * P.W + x, j = (y >> 1) * w2 + (x >> 1); v[j] += P.v[i] * P.w[i]; w[j] += P.w[i]; }
    for (let j = 0; j < v.length; j++) { if (w[j] > 0) v[j] /= w[j]; w[j] = Math.min(1, w[j]); }
    levels.push({ W: w2, H: h2, v, w });
  }
  for (let l = levels.length - 2; l >= 0; l--) {
    const L = levels[l], C = levels[l + 1];
    for (let y = 0; y < L.H; y++) for (let x = 0; x < L.W; x++) { const i = y * L.W + x; if (L.w[i] >= 1) continue; const c = C.v[(y >> 1) * C.W + (x >> 1)]; L.v[i] = L.v[i] * L.w[i] + c * (1 - L.w[i]); L.w[i] = 1; }
  }
  return levels[0].v;
}

// ---------- depth ----------
// paid(row): log a paid call the moment its result arrives, so a failure afterwards still shows in costs.jsonl
let paid = () => {};
// Writes <name>-depth.png as normalised inverse distance (white = near) and returns { near, far, fovX, fovY, ... }.
async function depthMoGe(imgPath, outPath, rawDir) {
  // MoGe takes at most 2048 px on a side: send a scaled copy (intrinsics are normalised, so they still fit the still)
  const [W0, H0] = pngSize(imgPath), s = Math.min(1, 2048 / Math.max(W0, H0));
  const W = Math.round(W0 * s), H = Math.round(H0 * s);
  let send = imgPath;
  if (s < 1) {
    send = outPath + '.send.png';
    const r = spawnSync(fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg', ['-v', 'error', '-y', '-i', imgPath, '-vf', `scale=${W}:${H}:flags=lanczos`, '-pix_fmt', 'rgb24', send]);
    if (r.status !== 0) throw new Error('cannot scale the still for MoGe: ' + r.stderr);
  }
  const url = await upload(send);
  if (send !== imgPath) fs.rmSync(send, { force: true });
  const { res, secs } = await queue(DEPTH_MODELS.moge, { image_url: url, resolution_level: 9, num_refinement_steps: 3, apply_mask: false, export_glb: false, export_ply: true }, 'depth (MoGe-3)');
  paid({ step: 'depth', endpoint: DEPTH_MODELS.moge, out: path.relative(ROOT, outPath), usd: +((PRICE.moge * W * H) / 1e6).toFixed(3), secs: Math.round(secs) });
  const plyUrl = res.point_cloud?.url;
  if (!plyUrl) throw new Error('MoGe returned no point cloud: ' + JSON.stringify(res).slice(0, 400));
  const plyBuf = Buffer.from(await (await fetch(plyUrl)).arrayBuffer());
  if (rawDir) { fs.mkdirSync(rawDir, { recursive: true }); fs.writeFileSync(path.join(rawDir, path.basename(outPath, '.png') + '-moge.ply'), plyBuf); }
  const ply = readPLY(plyBuf);
  if (rawDir) { fs.mkdirSync(rawDir, { recursive: true }); for (const k of ['depth_map', 'normal_map', 'mask']) if (res[k]?.url) await download(res[k].url, path.join(rawDir, `${path.basename(outPath, '.png')}-moge-${k}.png`)); fs.writeFileSync(path.join(rawDir, path.basename(outPath, '.png') + '-moge.json'), JSON.stringify({ ...res, point_cloud: { ...res.point_cloud, points: ply.n } }, null, 1)); }
  const K = res.intrinsics; // normalised: fx, fy in image widths/heights, cx, cy in 0..1
  const fx = K[0][0], fy = K[1][1], cx = K[0][2], cy = K[1][2];
  // MoGe works in OpenCV camera space (x right, y down, z forward). Some exports flip to OpenGL (z backward).
  let neg = 0; for (let i = 0; i < ply.n; i += 97) if (ply.z[i] < 0) neg++;
  const sz = neg > ply.n / 97 / 2 ? -1 : 1, sy = sz;
  const z = new Float32Array(W * H).fill(NaN);
  if (ply.n === W * H) for (let i = 0; i < ply.n; i++) { const d = ply.z[i] * sz; z[i] = d > 0 && Number.isFinite(d) ? d : NaN; }
  else for (let i = 0; i < ply.n; i++) { // a masked cloud: put each point back on its pixel
    const d = ply.z[i] * sz; if (!(d > 0)) continue;
    const px = Math.round((fx * ply.x[i] / d + cx) * W - 0.5), py = Math.round((fy * (ply.y[i] * sy) / d + cy) * H - 0.5);
    if (px >= 0 && py >= 0 && px < W && py < H) z[py * W + px] = d;
  }
  return { ...encodeDepth(W, H, z, outPath), fovX: res.fov_x, fovY: res.fov_y, principal: [cx, cy], model: DEPTH_MODELS.moge, metric: true, secs, usd: PRICE.moge * (W * H) / 1e6 };
}
async function depthDAV2(imgPath, outPath, rawDir) {
  const [W, H] = pngSize(imgPath);
  const url = await upload(imgPath);
  const { res, secs } = await queue(DEPTH_MODELS.dav2, { image_url: url }, 'depth (Depth Anything V2)');
  paid({ step: 'depth', endpoint: DEPTH_MODELS.dav2, out: path.relative(ROOT, outPath), usd: PRICE.dav2, secs: Math.round(secs) });
  const tmp = outPath + '.dl.png';
  await download(res.image.url, tmp);
  const d = readPNG(fs.readFileSync(tmp));
  if (rawDir) { fs.mkdirSync(rawDir, { recursive: true }); fs.copyFileSync(tmp, path.join(rawDir, path.basename(outPath, '.png') + '-dav2.png')); }
  fs.rmSync(tmp);
  // relative inverse depth (white = near, affine-invariant): assume the scene spans 1..8 units from the camera
  const near = 1, far = 8, z = new Float32Array(d.width * d.height);
  let lo = Infinity, hi = -Infinity; for (const v of d.first) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  for (let i = 0; i < z.length; i++) { const v = (d.first[i] - lo) / Math.max(1e-6, hi - lo); z[i] = 1 / (1 / far + v * (1 / near - 1 / far)); }
  const enc = encodeDepth(d.width, d.height, z, outPath);
  if (d.width !== W) console.log(`  note: depth is ${d.width} x ${d.height}, the still is ${W} x ${H} (plates.js scales it)`);
  return { ...enc, fovY: 40, fovX: (2 * Math.atan(Math.tan((40 * Math.PI) / 360) * (W / H)) * 180) / Math.PI, principal: [0.5, 0.5], model: DEPTH_MODELS.dav2, metric: false, secs, usd: PRICE.dav2 };
}
function encodeDepth(W, H, z, outPath) {
  const filled = fillHoles(W, H, z);
  const sorted = Float32Array.from(filled).sort();
  const near = sorted[Math.floor(sorted.length * 0.0005)], far = sorted[Math.floor(sorted.length * 0.9995)];
  const v = new Float32Array(W * H), a = 1 / far, b = 1 / near - 1 / far;
  for (let i = 0; i < v.length; i++) v[i] = (1 / Math.min(far, Math.max(near, filled[i])) - a) / b;
  writePNG16(outPath, W, H, v);
  const med = sorted[sorted.length >> 1];
  return { near: +near.toPrecision(5), far: +far.toPrecision(5), median: +med.toPrecision(5), depthSize: [W, H] };
}

// ---------- main ----------
const { pos, opt } = parse(process.argv.slice(2));
if (!pos[0] || !opt.name) die('usage: bun plate.mjs <project> --name kitchen --prompt "..." [--ref img.png] [--aspect 9:16] [--res 2K] [--depth moge|dav2] [--image still.png] [--redepth] [--dry]');
if (!/^[a-z0-9][a-z0-9_-]*$/i.test(opt.name)) die('--name: letters, digits, - and _ only');
const ROOT = path.resolve(pos[0]);
const DIR = path.join(ROOT, 'assets', 'plates');
const img = path.join(DIR, opt.name + '.png'), dep = path.join(DIR, opt.name + '-depth.png'), metaFile = path.join(DIR, opt.name + '.json');
const project = fs.existsSync(path.join(ROOT, 'project.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'project.json'), 'utf8')) : {};
const prev = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : null;
const depthKind = opt.depth || 'moge';
if (!DEPTH_MODELS[depthKind]) die('--depth must be moge or dav2');
const res = String(opt.res || '2K').toUpperCase();
if (!['1K', '2K', '4K'].includes(res)) die('--res must be 1K, 2K or 4K');

const meta = { name: opt.name, ...(prev || {}) };
let spent = 0;
const log = (row) => { fs.mkdirSync(DIR, { recursive: true }); fs.appendFileSync(path.join(DIR, 'costs.jsonl'), JSON.stringify({ when: new Date().toISOString(), ...row }) + '\n'); spent += row.usd || 0; };

paid = log;

// 1. the still
let needImage = !opt.redepth && !opt.image;
const prompt = opt.prompt ? [opt.prompt.trim().replace(/\.?$/, '.'), ...(opt['no-style'] ? [] : [STYLE, LAYOUT, MOOD[project.palette] || ''])].filter(Boolean).join(' ') : null;
const refs = opt.ref.map((r) => path.resolve(r));
const request = prompt ? { endpoint: IMAGE_MODEL + (refs.length ? '/edit' : ''), prompt: crypto.createHash('sha256').update(prompt).digest('hex').slice(0, 16), aspect_ratio: opt.aspect || '9:16', resolution: res, seed: opt.seed != null ? +opt.seed : null, refs: refs.map((f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16)) } : null;
if (needImage) {
  if (!prompt) die('--prompt is required (or --image to bring your own still, or --redepth)');
  for (const f of refs) if (!fs.existsSync(f)) die('no such reference: ' + f);
  if (!opt.force && prev?.request && fs.existsSync(img) && JSON.stringify(prev.request) === JSON.stringify(request)) { console.log(`cached: ${path.relative(process.cwd(), img)} (same request; --force to make a new one)`); needImage = false; }
}
const imageCost = res === '4K' ? PRICE.image4k : PRICE.image;
if (opt.dry) {
  if (prompt) console.log('prompt:\n  ' + prompt + '\n');
  console.log(`would spend about $${((needImage ? imageCost : 0) + (depthKind === 'moge' ? PRICE.moge * 2.35 : PRICE.dav2)).toFixed(2)} (${needImage ? `image ${request.endpoint} ${res} + ` : ''}depth ${DEPTH_MODELS[depthKind]})`);
  process.exit(0);
}
KEY = findKey(ROOT, KIT);
fs.mkdirSync(DIR, { recursive: true });
if (opt.image) {
  const src = path.resolve(opt.image); if (!fs.existsSync(src)) die('no such image: ' + src);
  if (src !== img) { if (/\.png$/i.test(src)) fs.copyFileSync(src, img); else toPNG(src, img); }
  Object.assign(meta, { source: path.basename(src), request: null, prompt: null });
}
if (needImage) {
  console.log(`still: ${request.endpoint} ${res} ${request.aspect_ratio} (~$${imageCost.toFixed(2)})`);
  const payload = { prompt, aspect_ratio: request.aspect_ratio, resolution: res, output_format: 'png', num_images: 1 };
  if (request.seed != null) payload.seed = request.seed;
  if (refs.length) payload.image_urls = await Promise.all(refs.map(upload));
  const { res: out, secs } = await queue(request.endpoint, payload, 'still');
  const u = out.images?.[0]?.url; if (!u) die('no image in the result: ' + JSON.stringify(out).slice(0, 500));
  const tmp = img + '.dl';
  await download(u, tmp);
  if (pngSize(tmp)) fs.renameSync(tmp, img); else { toPNG(tmp, img); fs.rmSync(tmp); }
  log({ step: 'still', endpoint: request.endpoint, out: path.relative(ROOT, img), usd: imageCost, secs: Math.round(secs) });
  Object.assign(meta, { prompt, request, description: out.description || null, source: null, created: new Date().toISOString() });
  console.log(`  saved ${path.relative(process.cwd(), img)} (${pngSize(img).join(' x ')}, ${Math.round(secs)} s)`);
}
if (!fs.existsSync(img)) die('no still at ' + img + ' (give --prompt or --image)');

// 2. the depth map (always redone when the still changed)
const stillHash = crypto.createHash('sha256').update(fs.readFileSync(img)).digest('hex').slice(0, 16);
if (!opt.force && !opt.redepth && prev?.depth?.still === stillHash && prev.depth.model === DEPTH_MODELS[depthKind] && fs.existsSync(dep)) console.log(`cached: ${path.relative(process.cwd(), dep)}`);
else {
  const rawDir = opt['keep-raw'] ? path.join(DIR, '.raw') : null;
  let d;
  try { d = depthKind === 'moge' ? await depthMoGe(img, dep, rawDir) : await depthDAV2(img, dep, rawDir); }
  catch (e) {
    if (depthKind !== 'moge') throw e;
    console.log(`  MoGe-3 failed (${e.message.slice(0, 200)}); falling back to Depth Anything V2`);
    d = await depthDAV2(img, dep, rawDir);
  }
  const { secs, usd, ...keep } = d;
  meta.depth = { ...keep, still: stillHash, encoding: 'v = (1/z - 1/far) / (1/near - 1/far), 16-bit, white = near' };
  meta.fov = { x: +(+d.fovX).toFixed(3), y: +(+d.fovY).toFixed(3) };
  console.log(`  saved ${path.relative(process.cwd(), dep)} (near ${d.near}, far ${d.far}, fov ${meta.fov.x.toFixed(1)} x ${meta.fov.y.toFixed(1)} deg${d.metric ? ', metric' : ', relative'})`);
}
meta.size = pngSize(img);
fs.writeFileSync(metaFile, JSON.stringify(meta, null, 1));
console.log(`plate "${opt.name}" ready: ${path.relative(process.cwd(), DIR)}/${opt.name}{.png,-depth.png,.json}${spent ? `  (spent ~$${spent.toFixed(2)})` : ''}`);
