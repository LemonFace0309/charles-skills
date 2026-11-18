#!/usr/bin/env bun
/* Makes a 3D prop from a prompt: a clean reference image (a fal image model), image-to-3D (a fal 3D model), then a
   cleaned, compressed GLB that props.model() loads, plus a preview still rendered by the kit itself.

     bun <kit>/model.mjs <project> --name toaster --prompt "a retro chrome two-slice toaster"
     bun <kit>/model.mjs <project> --name head --prompt "a smooth mannequin head" --geometry --view front
     bun <kit>/model.mjs <project> --name tooth --image tooth.png          (your own reference image: 3D step only)
     bun <kit>/model.mjs <project> --name engine --glb downloaded.glb      (clean a GLB you already have: no fal)

   Options:
     --endpoint ID      image-to-3D model: hunyuan (default), trellis2, tripo, rodin, meshy, hunyuan-rapid, or any fal
                        endpoint id that takes image_url and returns a GLB
     --tris 60000       triangle target after simplification
     --tex 2048         largest texture side (base colour; normal and ORM maps get half); textures become JPEG
     --geometry         shape only: drop textures and UVs (for kit materials: clay, plastic, metal...). The reference is
                        rendered as matte clay, and endpoints with an untextured mode are cheaper
     --pbr              ask the endpoint for PBR maps (metal/rough/normal) where it offers them
     --view V           angle of the reference image: three-quarter (default), front, side, top
     --image-model M    pro = nano-banana-pro ($0.15, default), fast = nano-banana ($0.04), or a fal endpoint id
     --seed N           seed for the image and the 3D model
     --rotate x,y,z     degrees, baked into the GLB (for a model that faces the wrong way; front should face +z)
     --normals N        smooth (default: welded by position, so UV seams leave no shading seams), keep, or a crease
                        angle in degrees for hard-surface objects (e.g. 40)
     --solid            keep only the outer surface: generators often return a hollow shell (a second, inner wall a few
                        millimetres under the skin), which breaks cutaways and surface sampling
     --open-base        --solid for a bust or statue whose hollow is open at the bottom: plugs the base before deciding
                        what is inside (do not use it on objects with overhanging parts near the bottom)
     --largest          with --solid: keep only the largest connected piece (drops stray bits inside ears and nostrils)
     --no-preview       skip the preview render
     --force            redo every step (each step is cached by its input, so a re-run normally costs nothing)
     --dry              print the reference prompt and the cost estimate; spend nothing

   Writes <project>/assets/models/<name>.glb, <name>.png (preview in the kit's night look: its own materials, kit clay in
   profile, and clay under its wireframe),
   <name>-ref.png (the reference image) and <name>.json (prompt, endpoint, cost, triangles, size). Every paid call is
   appended to <project>/assets/models/costs.jsonl. FAL_KEY comes from the environment or the nearest .env file and
   is never printed. Load it with: const m = await k.props.model(k.asset('assets/models/<name>.glb'), { size: 1 }). */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { args } from './serve.mjs';
import { findKey, upload, submit, wait, download } from './fal.mjs';

const KIT = path.dirname(new URL(import.meta.url).pathname);
const CACHE = path.join(os.homedir(), '.cache', 'charles-3d-explainers', 'models');
const FF = fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';
const FFPROBE = fs.existsSync('/opt/homebrew/bin/ffprobe') ? '/opt/homebrew/bin/ffprobe' : 'ffprobe';
const BUN = process.execPath;
const clampI = (x, a, b) => Math.max(a, Math.min(b, Math.round(x)));
const sha = (x) => crypto.createHash('sha256').update(x).digest('hex');
const die = (m) => { console.error('model: ' + m); process.exit(1); };

// ---------- the models (fal list prices, Nov 2026) ----------
const IMAGE_MODELS = {
  pro: { id: 'fal-ai/nano-banana-pro', usd: 0.15, input: (prompt, seed) => ({ prompt, aspect_ratio: '1:1', resolution: '1K', output_format: 'png', num_images: 1, ...(seed != null ? { seed } : {}) }) },
  fast: { id: 'fal-ai/nano-banana', usd: 0.0398, input: (prompt, seed) => ({ prompt, aspect_ratio: '1:1', output_format: 'png', num_images: 1, ...(seed != null ? { seed } : {}) }) },
};
const firstGlb = (r) => (JSON.stringify(r).match(/https:\/\/[^"\s]+?\.glb(?=["?\s])/) || [])[0];
const ENDPOINTS = {
  // Hunyuan 3D v3.1 Pro: the crispest, most faithful shapes of the ones tested (500k faces before simplification).
  // It can return a hollow shell (busts: open at the base): add --solid or --open-base before cutting or sampling.
  hunyuan: {
    id: 'fal-ai/hunyuan-3d/v3.1/pro/image-to-3d',
    input: (img, o) => ({ input_image_url: img, generate_type: o.geometry ? 'Geometry' : 'Normal', enable_pbr: !o.geometry && !!o.pbr }),
    usd: (o) => 0.375 + (!o.geometry && o.pbr ? 0.15 : 0),
    glb: (r) => r.model_glb?.url || r.model_urls?.glb?.url,
  },
  'hunyuan-rapid': {
    id: 'fal-ai/hunyuan-3d/v3.1/rapid/image-to-3d',
    input: (img, o) => ({ input_image_url: img, enable_geometry: !!o.geometry, enable_pbr: !o.geometry && !!o.pbr }),
    usd: (o) => 0.225 + (!o.geometry && o.pbr ? 0.15 : 0),
    glb: (r) => r.model_glb?.url,
  },
  trellis2: {
    id: 'fal-ai/trellis-2',
    input: (img, o) => ({ image_url: img, resolution: 1024, texture_size: 2048, decimation_target: clampI(o.tris * 4, 5000, 2000000), remesh: true, ...(o.seed != null ? { seed: o.seed } : {}) }),
    usd: () => 0.3,
    glb: (r) => r.model_glb?.url,
  },
  tripo: {
    id: 'tripo3d/h3.1/image-to-3d',
    input: (img, o) => ({ image_url: img, texture: !o.geometry, pbr: !o.geometry && !!o.pbr, ...(o.seed != null ? { model_seed: o.seed, texture_seed: o.seed } : {}) }),
    usd: (o) => (o.geometry ? 0.2 : 0.3),
    glb: (r) => (/\.glb(\?|$)/i.test(r.model_mesh?.url || '') ? r.model_mesh.url : null),
  },
  rodin: {
    id: 'fal-ai/hyper3d/rodin/v2.5',
    input: (img, o) => ({ image_urls: [img], geometry_file_format: 'glb', material: o.geometry ? 'None' : 'PBR', quality_mesh_option: '150K Triangle', texture_delight: true, ...(o.seed != null ? { seed: o.seed % 65536 } : {}) }),
    usd: () => 0.4,
    glb: (r) => r.model_mesh?.url,
  },
  meshy: {
    id: 'meshy/v7.1/image-to-3d',
    input: (img, o) => ({ image_url: img, target_polycount: clampI(o.tris * 2, 100, 300000), should_texture: !o.geometry, enable_pbr: !o.geometry && !!o.pbr, symmetry_mode: 'auto' }),
    usd: (o) => (o.geometry ? 0.8 : 1.2),
    glb: (r) => r.model_glb?.url || r.model_urls?.glb?.url,
  },
};
const VIEWS = {
  'three-quarter': 'seen from a three-quarter front view, slightly from above',
  front: 'seen straight from the front at eye level',
  side: 'seen from the side, in profile',
  top: 'seen from above at about 45 degrees',
};
// What makes a reference image reconstruct well: one whole object, centred, an even mid-grey ground that separates
// from both light and dark objects, soft light (hard shadows and highlights get baked into the texture and the shape).
function refPrompt(p, view, geometry) {
  return [
    p.trim().replace(/[.\s]+$/, '') + '.',
    `A product-shot render of this one object on its own, ${VIEWS[view]}, the whole object in frame and centred with clear space around it.`,
    'Plain seamless mid-grey studio background, soft even lighting from the front and above, no cast shadows, no strong reflections, no floor line.',
    geometry ? 'Render it as a uniform matte light-grey clay sculpture with clean, crisp forms, so the shape reads from its shading alone.' : 'True-to-life materials and colours, clean surfaces, gentle highlights.',
    'No text, no labels, no logos, no watermark, nothing else in the frame.',
  ].join(' ');
}

// ---------- arguments ----------
const { pos, opt } = args(process.argv.slice(2), ['name', 'prompt', 'image', 'glb', 'endpoint', 'tris', 'tex', 'view', 'image-model', 'seed', 'rotate', 'normals']);
if (!pos[0] || !opt.name) die('usage: bun model.mjs <project> --name <n> (--prompt "..." | --image ref.png | --glb file.glb) [--endpoint hunyuan] [--tris 60000] [--geometry] [--force] [--dry]');
if (!/^[a-z0-9][a-z0-9_-]*$/i.test(opt.name)) die('--name: letters, digits, - and _ only');
const ROOT = path.resolve(pos[0]);
const DIR = path.join(ROOT, 'assets', 'models');
const NAME = opt.name;
const O = {
  tris: Number(opt.tris || 60000), tex: Number(opt.tex || 2048), geometry: !!opt.geometry, pbr: !!opt.pbr,
  view: opt.view || 'three-quarter', seed: opt.seed != null ? Number(opt.seed) : null,
  rotate: opt.rotate ? String(opt.rotate).split(',').map(Number) : null, normals: String(opt.normals || 'smooth'), solid: !!opt.solid || !!opt['open-base'], openBase: !!opt['open-base'], largest: !!opt.largest,
};
if (!VIEWS[O.view]) die(`--view must be one of ${Object.keys(VIEWS).join(', ')}`);
if (O.rotate && (O.rotate.length !== 3 || O.rotate.some((x) => !Number.isFinite(x)))) die('--rotate takes x,y,z in degrees');
if (!(O.tris >= 500)) die('--tris must be 500 or more');
if (!['smooth', 'keep'].includes(O.normals) && !(Number(O.normals) > 0)) die('--normals: smooth, keep or a crease angle in degrees');
const EP = ENDPOINTS[opt.endpoint || 'hunyuan'] || (opt.endpoint ? { id: opt.endpoint, input: (img) => ({ image_url: img }), usd: () => null, glb: firstGlb } : null);
const IM = IMAGE_MODELS[opt['image-model'] || 'pro'] || { id: opt['image-model'], usd: null, input: (prompt, seed) => ({ prompt, ...(seed != null ? { seed } : {}) }) };
const force = !!opt.force;
const out = { glb: path.join(DIR, NAME + '.glb'), png: path.join(DIR, NAME + '.png'), ref: path.join(DIR, NAME + '-ref.png'), json: path.join(DIR, NAME + '.json') };
const prev = fs.existsSync(out.json) ? JSON.parse(fs.readFileSync(out.json, 'utf8')) : {};
fs.mkdirSync(CACHE, { recursive: true });

let spent = 0;
const logCost = (row) => { fs.mkdirSync(DIR, { recursive: true }); fs.appendFileSync(path.join(DIR, 'costs.jsonl'), JSON.stringify({ when: new Date().toISOString(), name: NAME, ...row }) + '\n'); spent += row.usd || 0; };
const ffmpeg = (a) => { const r = spawnSync(FF, ['-v', 'error', '-y', ...a]); if (r.status !== 0) throw new Error('ffmpeg: ' + String(r.stderr).trim()); };
function imageSize(file) {
  const r = spawnSync(FFPROBE, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file]);
  const [w, h] = String(r.stdout).trim().split(',').map(Number);
  return w && h ? [w, h] : null;
}

// A paid fal call, cached by its own key: the result JSON and every file we need are kept under CACHE, so a re-run
// (or a different project asking for the same thing) costs nothing.
async function paid(step, endpoint, input, key, usd) {
  const file = path.join(CACHE, `${step}-${sha(JSON.stringify({ endpoint, key })).slice(0, 24)}.json`);
  if (!force && fs.existsSync(file)) { console.log(`  ${step}: cached (${endpoint})`); return { ...JSON.parse(fs.readFileSync(file, 'utf8')), cached: true }; }
  findKey();
  const real = { ...input };
  for (const [k, v] of Object.entries(real)) {
    if (typeof v === 'string' && fs.existsSync(v)) real[k] = await upload(v, { quiet: true });
    else if (Array.isArray(v)) real[k] = await Promise.all(v.map((x) => (typeof x === 'string' && fs.existsSync(x) ? upload(x, { quiet: true }) : x)));
  }
  console.log(`  ${step}: ${endpoint}${usd != null ? ` (~$${usd.toFixed(2)})` : ''}`);
  const t0 = Date.now();
  const result = await wait(await submit(endpoint, real), { timeout: 1800, quiet: true });
  const secs = (Date.now() - t0) / 1000;
  logCost({ step, endpoint, usd, secs: Math.round(secs) });
  const rec = { endpoint, at: new Date().toISOString(), secs, usd, result };
  fs.writeFileSync(file, JSON.stringify(rec, null, 1));
  console.log(`  ${step}: done in ${secs.toFixed(0)} s`);
  return rec;
}
// Download once into the cache (fal media URLs expire; the cache copy does not).
async function fetchCached(url, ext) {
  const f = path.join(CACHE, `dl-${sha(url).slice(0, 24)}${ext}`);
  if (!fs.existsSync(f)) await download(url, f);
  return f;
}

// ---------- 1. the reference image ----------
async function reference() {
  if (opt.glb) return null;
  if (opt.image) {
    const src = path.resolve(opt.image);
    if (!fs.existsSync(src)) die('no such image: ' + src);
    fs.mkdirSync(DIR, { recursive: true });
    if (src !== out.ref) ffmpeg(['-i', src, '-frames:v', '1', '-pix_fmt', 'rgb24', out.ref]);
    return { file: out.ref, prompt: null, model: null, source: path.basename(src) };
  }
  if (!opt.prompt) die('give --prompt "...", --image ref.png or --glb model.glb');
  const prompt = refPrompt(opt.prompt, O.view, O.geometry);
  const input = IM.input(prompt, O.seed);
  if (opt.dry) return { prompt, model: IM.id, usd: IM.usd };
  const rec = await paid('image', IM.id, input, input, IM.usd);
  const url = rec.result.images?.[0]?.url;
  if (!url) die('no image in the result: ' + JSON.stringify(rec.result).slice(0, 400));
  const dl = await fetchCached(url, '.img');
  fs.mkdirSync(DIR, { recursive: true });
  ffmpeg(['-i', dl, '-frames:v', '1', '-pix_fmt', 'rgb24', out.ref]);
  return { file: out.ref, prompt, model: IM.id, usd: rec.cached ? 0 : IM.usd, secs: rec.secs };
}

// ---------- 2. image to 3D ----------
async function generate(ref) {
  if (opt.glb) {
    const src = path.resolve(opt.glb);
    if (!fs.existsSync(src)) die('no such GLB: ' + src);
    return { raw: src, endpoint: null };
  }
  const input = EP.input(ref.file, { ...O, prompt: opt.prompt });
  const key = { ...input, ...Object.fromEntries(Object.entries(input).filter(([, v]) => v === ref.file).map(([k]) => [k, 'sha256:' + sha(fs.readFileSync(ref.file))])) };
  for (const [k, v] of Object.entries(key)) if (Array.isArray(v)) key[k] = v.map((x) => (x === ref.file ? 'sha256:' + sha(fs.readFileSync(ref.file)) : x));
  const rec = await paid('3d', EP.id, input, key, EP.usd(O));
  const url = EP.glb(rec.result) || firstGlb(rec.result);
  if (!url) die('no GLB in the result: ' + JSON.stringify(rec.result).slice(0, 600));
  const raw = await fetchCached(url, '.glb');
  return { raw, endpoint: EP.id, usd: rec.cached ? 0 : EP.usd(O), secs: rec.secs };
}

// ---------- 3. clean ----------
// Weld, (geometry mode) drop everything but positions, simplify to the triangle target, smooth normals welded by
// position, textures to <= --tex as JPEG, no cameras or lights, meshopt compression (three's GLTFLoader decodes it
// with setMeshoptDecoder, which props.model() does).
async function clean(raw) {
  const opts = { tris: O.tris, tex: O.tex, geometry: O.geometry, rotate: O.rotate, normals: O.normals, solid: O.solid, openBase: O.openBase, largest: O.largest, v: 14 };
  const cached = path.join(CACHE, `clean-${sha(sha(fs.readFileSync(raw)) + JSON.stringify(opts)).slice(0, 24)}.glb`);
  if (!force && fs.existsSync(cached)) { console.log('  clean: cached'); return { file: cached, stats: JSON.parse(fs.readFileSync(cached + '.json', 'utf8')) }; }
  const { NodeIO } = await import('@gltf-transform/core');
  const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
  const F = await import('@gltf-transform/functions');
  const { MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder } = await import('meshoptimizer');
  await Promise.all([MeshoptSimplifier.ready, MeshoptEncoder.ready, MeshoptDecoder.ready]);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  let doc;
  try { doc = await io.read(raw); }
  catch (e) { throw new Error(`cannot read ${path.basename(raw)}: ${e.message}${/draco/i.test(e.message) ? ' (Draco-compressed input: decompress it first, e.g. with gltf-transform\'s CLI)' : ''}`); }
  const root = doc.getRoot();
  const triCount = () => root.listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((a, p) => a + (p.getMode() === 4 ? (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3 : 0), 0), 0);
  const rawTris = triCount();

  // no cameras, no lights: the kit lights every shot itself
  for (const n of root.listNodes()) { n.setCamera(null); if (n.getExtension('KHR_lights_punctual')) n.setExtension('KHR_lights_punctual', null); }
  for (const c of root.listCameras()) c.dispose();
  for (const e of root.listExtensionsUsed()) if (e.extensionName === 'KHR_lights_punctual') e.dispose();
  // point clouds and lines are not props: keep triangles only
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) if (p.getMode() !== 4) p.dispose();

  // one level of nodes, transforms baked into the vertices (and an optional fix-up rotation)
  await doc.transform(F.dedup(), F.flatten());
  for (const n of root.listNodes()) if (n.getMesh()) F.clearNodeTransform(n);
  if (O.rotate) {
    const [rx, ry, rz] = O.rotate.map((d) => (d * Math.PI) / 180);
    const m = rotationMatrix(rx, ry, rz);
    for (const mesh of root.listMeshes()) F.transformMesh(mesh, m);
  }

  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
    for (const sem of prim.listSemantics()) {
      const keep = O.geometry ? sem === 'POSITION' : ['POSITION', 'TEXCOORD_0', 'COLOR_0', 'JOINTS_0', 'WEIGHTS_0'].includes(sem) || (sem === 'NORMAL' && O.normals === 'keep');
      if (!keep) prim.setAttribute(sem, null);
    }
    if (O.geometry) { prim.setMaterial(null); weldByPosition(doc, prim); }
  }
  if (O.geometry) for (const t of root.listTextures()) t.dispose();
  await doc.transform(F.dedup(), F.weld(), F.join({ keepMeshes: false, keepNamed: false }), F.prune({ keepAttributes: true }));

  // hollow shells (an inner wall under the skin, open at the base) -> just the outer surface
  if (O.solid) for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) { const r = outerOnly(doc, prim); console.log(`  solid: removed ${r.removed.toLocaleString()} inner-wall triangles of ${r.total.toLocaleString()}, closed ${r.holes} holes`); }
  await doc.transform(F.prune({ keepAttributes: true }));

  // simplify towards the triangle target (vertex ratio ~ triangle ratio); error cap 1% of the mesh radius
  const before = triCount();
  if (before > O.tris) {
    const ratio = O.tris / before;
    await doc.transform(F.simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.01 }));
    // seams in textured meshes stop the simplifier early: allow more error until the target is met
    for (const err of [0.02, 0.04]) if (triCount() > O.tris * 1.15) await doc.transform(F.simplify({ simplifier: MeshoptSimplifier, ratio: O.tris / triCount(), error: err }));
  }

  // normals: welded by position, so UV seams leave no shading seams; or a crease angle for hard-surface objects
  if (O.normals !== 'keep') for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) smoothNormals(doc, prim, O.normals === 'smooth' ? 180 : Number(O.normals));

  // textures: <= --tex, JPEG for anything opaque (base colour at full size, data maps at half)
  const texStats = [];
  for (const tex of root.listTextures()) {
    const slots = F.listTextureSlots(tex);
    const isColor = slots.some((s) => /baseColor|emissive|diffuse/i.test(s));
    const usesAlpha = root.listMaterials().some((m) => m.getBaseColorTexture() === tex && m.getAlphaMode() !== 'OPAQUE');
    const max = isColor ? O.tex : Math.max(256, O.tex / 2);
    const img = tex.getImage();
    if (!img) continue;
    const tmpIn = path.join(os.tmpdir(), `model-tex-${process.pid}-${texStats.length}${tex.getMimeType() === 'image/png' ? '.png' : '.jpg'}`);
    fs.writeFileSync(tmpIn, img);
    const [w, h] = imageSize(tmpIn) || [0, 0];
    const s = Math.min(1, max / Math.max(w, h));
    const W = Math.max(1, Math.round(w * s)), H = Math.max(1, Math.round(h * s));
    const asJpeg = !usesAlpha;
    if (s < 1 || asJpeg !== (tex.getMimeType() === 'image/jpeg')) {
      const tmpOut = tmpIn.replace(/\.\w+$/, asJpeg ? '.out.jpg' : '.out.png');
      ffmpeg(['-i', tmpIn, '-vf', `scale=${W}:${H}:flags=lanczos`, ...(asJpeg ? ['-q:v', isColor ? '2' : '3', '-pix_fmt', 'yuvj444p'] : ['-pix_fmt', 'rgba']), tmpOut]);
      tex.setImage(new Uint8Array(fs.readFileSync(tmpOut))).setMimeType(asJpeg ? 'image/jpeg' : 'image/png').setURI('');
      fs.rmSync(tmpOut, { force: true });
    }
    fs.rmSync(tmpIn, { force: true });
    texStats.push({ slots, size: [W, H], kb: Math.round(tex.getImage().byteLength / 1024) });
  }

  await doc.transform(F.prune(), F.dedup(), F.meshopt({ encoder: MeshoptEncoder, level: 'high', quantizeNormal: 12, quantizeTexcoord: 14 }));
  const finalTris = triCount();
  fs.writeFileSync(cached, await io.writeBinary(doc));
  const stats = { rawTris, tris: finalTris, textures: texStats, meshes: root.listMeshes().length, materials: root.listMaterials().length, bytes: fs.statSync(cached).size };
  fs.writeFileSync(cached + '.json', JSON.stringify(stats));
  console.log(`  clean: ${rawTris.toLocaleString()} -> ${finalTris.toLocaleString()} triangles, ${texStats.length} textures, ${(stats.bytes / 1e6).toFixed(2)} MB`);
  return { file: cached, stats };
}
// Remove the inner wall of a hollow shell. Voxelise the surface, seal the bottom layer (busts and statues are open at
// the base), flood-fill the air from outside, then keep a triangle only if the air on its outward side is that
// outside air: an inner wall faces the sealed cavity instead.
function outerOnly(doc, prim) {
  const P = prim.getAttribute('POSITION'), n = P.getCount(), v = [0, 0, 0];
  const pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { P.getElement(i, v); pos.set(v, i * 3); }
  const idx = prim.getIndices() ? prim.getIndices().getArray() : Uint32Array.from({ length: n }, (_, i) => i), T = idx.length / 3;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], pos[i * 3 + k]); hi[k] = Math.max(hi[k], pos[i * 3 + k]); }
  const R = 256, h = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / R, pad = 6;
  const dim = [0, 1, 2].map((k) => Math.ceil((hi[k] - lo[k]) / h) + 2 * pad + 1), [DX, DY, DZ] = dim;
  const at = (x, y, z) => (z * DY + y) * DX + x, vox = (p, k) => Math.floor((p - lo[k]) / h) + pad;
  const grid = new Uint8Array(DX * DY * DZ); // 1 wall, 2 outside air
  for (let t = 0; t < T; t++) { // mark every voxel the triangle passes through (sampled at a third of a voxel)
    const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3;
    const L = Math.max(Math.hypot(pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]), Math.hypot(pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]), Math.hypot(pos[c] - pos[b], pos[c + 1] - pos[b + 1], pos[c + 2] - pos[b + 2]));
    const m = Math.max(1, Math.ceil((L / h) * 3));
    for (let i = 0; i <= m; i++) for (let j = 0; j <= m - i; j++) {
      const u = i / m, w = j / m, s = 1 - u - w;
      grid[at(vox(pos[a] * s + pos[b] * u + pos[c] * w, 0), vox(pos[a + 1] * s + pos[b + 1] * u + pos[c + 1] * w, 1), vox(pos[a + 2] * s + pos[b + 2] * u + pos[c + 2] * w, 2))] = 1;
    }
  }
  // seal the base from below. A hollow bust or statue is open at its base (and often up the sides of its shoulders):
  // inside its footprint (the convex hull, seen from below, of what lies in the lowest 15% of its height) the air under
  // the lowest surface becomes wall. That plugs the opening and fills the cavity, and leaves the air under overhangs
  // outside the footprint alone (a chin, an ear, a handle).
  const foot = new Uint8Array(DX * DZ), yb = lo[1] + (hi[1] - lo[1]) * 0.15, P2 = [];
  for (let i = 0; i < n; i++) if (pos[i * 3 + 1] <= yb) P2.push([pos[i * 3], pos[i * 3 + 2]]);
  P2.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o2, a, b) => (a[0] - o2[0]) * (b[1] - o2[1]) - (a[1] - o2[1]) * (b[0] - o2[0]);
  const lower = [], upper = [];
  for (const p of P2) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  for (let i = P2.length - 1; i >= 0; i--) { const p = P2[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  if (hull.length >= 3) for (let z = 0; z < DZ; z++) for (let x = 0; x < DX; x++) {
    const p = [lo[0] + (x - pad + 0.5) * h, lo[2] + (z - pad + 0.5) * h];
    if (hull.every((a, i) => cross(a, hull[(i + 1) % hull.length], p) >= 0)) foot[z * DX + x] = 1;
  }
  if (O.openBase) for (let z = 0; z < DZ; z++) for (let x = 0; x < DX; x++) {
    if (!foot[z * DX + x]) continue;
    let y = 0; while (y < DY && grid[at(x, y, z)] !== 1) y++;
    if (y < DY) for (let yy = Math.max(0, pad - 1); yy < y; yy++) grid[at(x, yy, z)] = 1;
  }
  // close small holes (nostrils, ear canals that open into the cavity): dilate the walls by K voxels, flood the air
  // from outside, then grow that air back K steps through the real (undilated) air so crevices on the outer surface
  // count as outside again while the sealed cavity stays enclosed
  const K = O.close ?? 3, N = DX * DY * DZ, wall = new Uint8Array(N);
  for (let i = 0; i < N; i++) wall[i] = grid[i] === 1 ? 1 : 0;
  let dil = wall.slice();
  for (let r = 0; r < K; r++) {
    const nx = dil.slice();
    for (let z = 1; z < DZ - 1; z++) for (let y = 1; y < DY - 1; y++) for (let x = 1; x < DX - 1; x++) {
      const i = at(x, y, z); if (dil[i]) continue;
      if (dil[i - 1] || dil[i + 1] || dil[i - DX] || dil[i + DX] || dil[i - DX * DY] || dil[i + DX * DY]) nx[i] = 1;
    }
    dil = nx;
  }
  const outside = new Uint8Array(N), q = new Int32Array(N); let qh = 0, qt = 0;
  const push = (x, y, z, blocked) => { if (x < 0 || y < 0 || z < 0 || x >= DX || y >= DY || z >= DZ) return; const i = at(x, y, z); if (blocked[i] || outside[i]) return; outside[i] = 1; q[qt++] = i; };
  for (let z = 0; z < DZ; z++) for (let y = 0; y < DY; y++) { push(0, y, z, dil); push(DX - 1, y, z, dil); }
  for (let z = 0; z < DZ; z++) for (let x = 0; x < DX; x++) { push(x, 0, z, dil); push(x, DY - 1, z, dil); }
  for (let y = 0; y < DY; y++) for (let x = 0; x < DX; x++) { push(x, y, 0, dil); push(x, y, DZ - 1, dil); }
  const spread = (blocked) => { while (qh < qt) { const i = q[qh++], x = i % DX, y = ((i / DX) | 0) % DY, z = (i / (DX * DY)) | 0; push(x + 1, y, z, blocked); push(x - 1, y, z, blocked); push(x, y + 1, z, blocked); push(x, y - 1, z, blocked); push(x, y, z + 1, blocked); push(x, y, z - 1, blocked); } };
  spread(dil);
  for (let r = 0; r <= 4 * K + 2; r++) { // geodesic growth, one ring at a time (deep enough to reach the bottom of creases)
    const ring = []; for (let i = 0; i < N; i++) if (outside[i]) { const x = i % DX, y = ((i / DX) | 0) % DY, z = (i / (DX * DY)) | 0; for (const j of [x > 0 ? i - 1 : -1, x < DX - 1 ? i + 1 : -1, y > 0 ? i - DX : -1, y < DY - 1 ? i + DX : -1, z > 0 ? i - DX * DY : -1, z < DZ - 1 ? i + DX * DY : -1]) if (j >= 0 && !outside[j] && !wall[j]) ring.push(j); }
    for (const j of ring) outside[j] = 1;
  }
  for (let i = 0; i < N; i++) if (outside[i]) grid[i] = 2;
  const keep = [];
  for (let t = 0; t < T; t++) {
    const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], wx = pos[c] - pos[a], wy = pos[c + 1] - pos[a + 1], wz = pos[c + 2] - pos[a + 2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const cx = (pos[a] + pos[b] + pos[c]) / 3, cy = (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3, cz = (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3;
    let out = false;
    const tx = Math.abs(nx) < 0.9 ? [0, -nz, ny] : [-nz, 0, nx], tl = Math.hypot(...tx); tx[0] /= tl; tx[1] /= tl; tx[2] /= tl;
    const ty = [ny * tx[2] - nz * tx[1], nz * tx[0] - nx * tx[2], nx * tx[1] - ny * tx[0]];
    const dirs = [[nx, ny, nz], ...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([p, r]) => [0, 1, 2].map((k) => (([nx, ny, nz][k] + p * tx[k] + r * ty[k]) / Math.SQRT2)))];
    for (const [dx, dy, dz] of dirs) { for (const d of [1.5, 2.5, 4, 6]) { const X = vox(cx + dx * d * h, 0), Y = vox(cy + dy * d * h, 1), Z = vox(cz + dz * d * h, 2); if (X < 0 || Y < 0 || Z < 0 || X >= DX || Y >= DY || Z >= DZ || grid[at(X, Y, Z)] === 2) { out = true; break; } } if (out) break; }
    if (out) keep.push(idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]);
  }
  // where an inner wall met the outer skin (inside nostrils, ear canals, the mouth, an open base) the skin now has
  // holes: close every boundary loop with a fan from its centre, so sections through the solid stay closed
  const filled = dropInside(fillLoops(pos, keep));
  const filledPos = new Float32Array(filled.pos.length); filledPos.set(filled.pos);
  prim.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(filledPos).setBuffer(P.getBuffer()));
  prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(filled.idx)).setBuffer(P.getBuffer()));
  return { removed: T - keep.length / 3, total: T, holes: filled.loops };
}
// Drop pieces that sit inside the main surface (leftovers of tunnels into the old cavity): split into connected
// pieces, and remove every piece whose centre is inside the largest one (odd number of crossings along +x).
function dropInside({ pos, idx, loops }) {
  const nv = pos.length / 3, par = Int32Array.from({ length: nv }, (_, i) => i);
  const find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  for (let t = 0; t < idx.length; t += 3) { const a = find(idx[t]); par[find(idx[t + 1])] = a; par[find(idx[t + 2])] = a; }
  const comp = new Map(); for (let t = 0; t < idx.length; t += 3) { const r = find(idx[t]); (comp.get(r) || comp.set(r, []).get(r)).push(t); }
  if (comp.size < 2) return { pos, idx, loops };
  const list = [...comp.values()].sort((a, b) => b.length - a.length), main = list[0];
  const inside = (p) => { let c = 0;
    for (const t of main) { const a = idx[t] * 3, b = idx[t + 1] * 3, d = idx[t + 2] * 3;
      // ray from p along +x: intersect the triangle's (y, z) projection, then check the hit is ahead
      const ay = pos[a + 1] - p[1], az = pos[a + 2] - p[2], by = pos[b + 1] - p[1], bz = pos[b + 2] - p[2], cy = pos[d + 1] - p[1], cz = pos[d + 2] - p[2];
      const w0 = by * cz - bz * cy, w1 = cy * az - cz * ay, w2 = ay * bz - az * by;
      if ((w0 < 0 || w1 < 0 || w2 < 0) && (w0 > 0 || w1 > 0 || w2 > 0)) continue;
      const sw = w0 + w1 + w2; if (!sw) continue;
      const x = (w0 * pos[a] + w1 * pos[b] + w2 * pos[d]) / sw; if (x > p[0]) c++; }
    return c % 2 === 1; };
  const keepT = [...main];
  if (!O.largest) for (const piece of list.slice(1)) {
    const c = [0, 0, 0]; let n = 0; for (const t of piece) for (let j = 0; j < 3; j++) { for (let k = 0; k < 3; k++) c[k] += pos[idx[t + j] * 3 + k]; n++; }
    for (let k = 0; k < 3; k++) c[k] /= n;
    if (!inside(c)) keepT.push(...piece);
  }
  const out = []; for (const t of keepT) out.push(idx[t], idx[t + 1], idx[t + 2]);
  return { pos, idx: out, loops };
}
// Close the boundary loops of an indexed triangle set (positions welded): each loop gets a centre vertex and a fan.
function fillLoops(pos0, idx) {
  const pos = Array.from(pos0), out = idx.slice(), next = new Map(), count = new Map();
  const ek = (a, b) => a + '_' + b;
  for (let t = 0; t < idx.length; t += 3) for (let e = 0; e < 3; e++) { const a = idx[t + e], b = idx[t + (e + 1) % 3]; count.set(ek(a, b), (count.get(ek(a, b)) || 0) + 1); }
  // a directed edge a->b is on the boundary when no triangle has b->a; the hole runs b->a
  for (const k of count.keys()) { const [a, b] = k.split('_').map(Number); if (!count.has(ek(b, a))) { if (!next.has(b)) next.set(b, []); next.get(b).push(a); } }
  let loops = 0;
  const usedE = new Set();
  for (const [s0, list] of next) for (const t0 of list) {
    if (usedE.has(s0 + '>' + t0)) continue;
    usedE.add(s0 + '>' + t0);
    const loop = [s0]; let cur = t0;
    for (let guard = 0; guard < 200000; guard++) {
      if (cur === s0) {
        if (loop.length >= 3) { loops++;
          const c = [0, 0, 0]; for (const i of loop) for (let k = 0; k < 3; k++) c[k] += pos[i * 3 + k] / loop.length;
          const ci = pos.length / 3; pos.push(...c);
          for (let j = 0; j < loop.length; j++) out.push(loop[j], loop[(j + 1) % loop.length], ci); }
        break;
      }
      loop.push(cur);
      const nx = (next.get(cur) || []).find((x) => !usedE.has(cur + '>' + x));
      if (nx === undefined) break; // a dangling edge chain, not a hole
      usedE.add(cur + '>' + nx); cur = nx;
    }
  }
  return { pos, idx: out, loops };
}
function rotationMatrix(rx, ry, rz) { // column-major 4x4 for R = Rz * Ry * Rx (three's 'XYZ' Euler order)
  const a = Math.cos(rx), b = Math.sin(rx), c = Math.cos(ry), d = Math.sin(ry), e = Math.cos(rz), f = Math.sin(rz);
  const ae = a * e, af = a * f, be = b * e, bf = b * f;
  return [c * e, af + be * d, bf - ae * d, 0, -c * f, ae - bf * d, be + af * d, 0, d, -b * c, a * c, 0, 0, 0, 0, 1];
}
// Merge vertices that share a position (to 1e-6 of the mesh size), so simplification and normals see one surface.
function weldByPosition(doc, prim) {
  const P = prim.getAttribute('POSITION'), n = P.getCount(), v = [0, 0, 0];
  const idx = prim.getIndices() ? prim.getIndices().getArray() : Uint32Array.from({ length: n }, (_, i) => i);
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) { P.getElement(i, v); for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]); } }
  const q = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) * 1e-6 || 1e-9;
  const map = new Map(), remap = new Uint32Array(n), pos = [];
  for (let i = 0; i < n; i++) {
    P.getElement(i, v);
    const key = `${Math.round(v[0] / q)},${Math.round(v[1] / q)},${Math.round(v[2] / q)}`;
    let j = map.get(key);
    if (j === undefined) { j = pos.length / 3; map.set(key, j); pos.push(v[0], v[1], v[2]); }
    remap[i] = j;
  }
  const out = [];
  for (let t = 0; t < idx.length; t += 3) {
    const a = remap[idx[t]], b = remap[idx[t + 1]], c = remap[idx[t + 2]];
    if (a !== b && b !== c && a !== c) out.push(a, b, c); // drop degenerate triangles
  }
  const buf = doc.getRoot().listBuffers()[0] || doc.createBuffer();
  prim.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buf));
  prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(pos.length / 3 > 65535 ? new Uint32Array(out) : new Uint16Array(out)).setBuffer(buf));
}
// Angle-weighted vertex normals, averaged over every vertex at the same position (so UV seams are invisible). With a
// crease angle below 180, a corner only averages faces within that angle of its own face, and vertices are split
// where the normals differ (hard edges stay hard).
function smoothNormals(doc, prim, crease) {
  const P = prim.getAttribute('POSITION'); if (!P || !prim.getIndices()) return;
  const n = P.getCount(), pos = new Float32Array(n * 3), v = [0, 0, 0];
  for (let i = 0; i < n; i++) { P.getElement(i, v); pos.set(v, i * 3); }
  const idx = prim.getIndices().getArray(), T = idx.length / 3;
  let lo = Infinity, hi = -Infinity; for (let i = 0; i < pos.length; i++) { lo = Math.min(lo, pos[i]); hi = Math.max(hi, pos[i]); }
  const q = (hi - lo) * 1e-6 || 1e-9, groups = new Map(), gid = new Uint32Array(n);
  for (let i = 0; i < n; i++) { const key = `${Math.round(pos[i * 3] / q)},${Math.round(pos[i * 3 + 1] / q)},${Math.round(pos[i * 3 + 2] / q)}`; let g = groups.get(key); if (g === undefined) { g = groups.size; groups.set(key, g); } gid[i] = g; }
  const fn = new Float32Array(T * 3), cw = new Float32Array(T * 3); // face normals, corner angles
  for (let t = 0; t < T; t++) {
    const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    let x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx; const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
    fn[t * 3] = x; fn[t * 3 + 1] = y; fn[t * 3 + 2] = z;
    const ang = (p, q1, r) => { const e1 = [pos[q1] - pos[p], pos[q1 + 1] - pos[p + 1], pos[q1 + 2] - pos[p + 2]], e2 = [pos[r] - pos[p], pos[r + 1] - pos[p + 1], pos[r + 2] - pos[p + 2]]; const d = (e1[0] * e2[0] + e1[1] * e2[1] + e1[2] * e2[2]) / ((Math.hypot(...e1) * Math.hypot(...e2)) || 1); return Math.acos(Math.max(-1, Math.min(1, d))); };
    cw[t * 3] = ang(a, b, c); cw[t * 3 + 1] = ang(b, c, a); cw[t * 3 + 2] = ang(c, a, b);
  }
  const G = groups.size;
  if (crease >= 180) {
    const acc = new Float32Array(G * 3);
    for (let t = 0; t < T; t++) for (let k = 0; k < 3; k++) { const g = gid[idx[t * 3 + k]] * 3, w = cw[t * 3 + k]; acc[g] += fn[t * 3] * w; acc[g + 1] += fn[t * 3 + 1] * w; acc[g + 2] += fn[t * 3 + 2] * w; }
    const N = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const g = gid[i] * 3, l = Math.hypot(acc[g], acc[g + 1], acc[g + 2]) || 1; N[i * 3] = acc[g] / l; N[i * 3 + 1] = acc[g + 1] / l; N[i * 3 + 2] = acc[g + 2] / l; }
    prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(N).setBuffer(P.getBuffer()));
    return;
  }
  // creased: faces around each position group, then a normal per corner from the faces within the angle
  const cosC = Math.cos((crease * Math.PI) / 180), start = new Uint32Array(G + 1), list = new Uint32Array(T * 3);
  for (let t = 0; t < T * 3; t++) start[gid[idx[t]] + 1]++;
  for (let g = 0; g < G; g++) start[g + 1] += start[g];
  const fill = start.slice(0, G);
  for (let t = 0; t < T * 3; t++) list[fill[gid[idx[t]]]++] = t;
  const cn = new Float32Array(T * 9);
  for (let c = 0; c < T * 3; c++) {
    const t = (c / 3) | 0, g = gid[idx[c]]; let x = 0, y = 0, z = 0;
    for (let j = start[g]; j < start[g + 1]; j++) { const c2 = list[j], t2 = (c2 / 3) | 0; if (fn[t * 3] * fn[t2 * 3] + fn[t * 3 + 1] * fn[t2 * 3 + 1] + fn[t * 3 + 2] * fn[t2 * 3 + 2] >= cosC) { x += fn[t2 * 3] * cw[c2]; y += fn[t2 * 3 + 1] * cw[c2]; z += fn[t2 * 3 + 2] * cw[c2]; } }
    const l = Math.hypot(x, y, z) || 1; cn[c * 3] = x / l; cn[c * 3 + 1] = y / l; cn[c * 3 + 2] = z / l;
  }
  // split vertices whose corners disagree: one output vertex per (vertex, quantised normal)
  const sems = prim.listSemantics().filter((s) => s !== 'NORMAL'), attrs = sems.map((s) => prim.getAttribute(s));
  const vmap = new Map(), outIdx = new Uint32Array(T * 3), cols = sems.map(() => []), N = [], tmp = [];
  for (let c = 0; c < T * 3; c++) {
    const i = idx[c], key = `${i}|${Math.round(cn[c * 3] * 1000)},${Math.round(cn[c * 3 + 1] * 1000)},${Math.round(cn[c * 3 + 2] * 1000)}`;
    let j = vmap.get(key);
    if (j === undefined) { j = N.length / 3; vmap.set(key, j); N.push(cn[c * 3], cn[c * 3 + 1], cn[c * 3 + 2]); attrs.forEach((a, k) => { a.getElement(i, tmp); cols[k].push(...tmp); }); }
    outIdx[c] = j;
  }
  const buf = P.getBuffer();
  sems.forEach((s, k) => { const a = attrs[k]; prim.setAttribute(s, doc.createAccessor().setType(a.getType()).setArray(new Float32Array(cols[k])).setBuffer(buf)); });
  prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(N)).setBuffer(buf));
  prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(N.length / 3 > 65535 ? outIdx : Uint16Array.from(outIdx)).setBuffer(buf));
}

// ---------- 4. preview: the GLB rendered by the kit in its night look: its own materials (or clay), kit clay in
// profile (depth errors show there), and clay with the wireframe over it (topology) ----------
async function preview(glb) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'model-preview-'));
  try {
    fs.mkdirSync(path.join(tmp, 'shots'), { recursive: true });
    fs.copyFileSync(glb, path.join(tmp, 'model.glb'));
    const views = [{ material: O.geometry ? 'clay' : 'keep', az: 28 }, { material: 'clay', az: 90 }, { material: 'clay', az: -32, wire: true }];
    fs.writeFileSync(path.join(tmp, 'project.json'), JSON.stringify({ size: [1080, 1920], fps: 30, samples: 16, palette: 'night-amber', duration: 3, captions: { enabled: false }, shots: views.map((v, i) => ({ id: 'v' + i, file: 'shots/p.js', start: i, params: v })) }));
    fs.writeFileSync(path.join(tmp, 'shots', 'p.js'), `export default async function (k) {
  const { THREE, scene, camera, cam, props, mat } = k, P = k.params;
  k.env('night', 0.7); k.backdrop({ glow: 0.16, glowPos: [0.5, 0.5] }); k.fog(0.5);
  k.rig({ keyPos: [3, 5, 4], rimPos: [-3.5, 2.5, -4], keyScale: 0.75, rimScale: 1.5, fillScale: 0.5, soft: 0.5, shadowSize: 3 });
  const m = await props.model(k.asset('model.glb'), { size: 1.4, material: P.material });
  scene.add(m);
  if (P.wire) { const w = await props.model(k.asset('model.glb'), { size: 1.4, material: 'wire', opacity: 0.3, intensity: 1.3 }); w.scale.setScalar(1.002); scene.add(w); }
  const f = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), mat.plastic('#070c16', { rough: 0.5, clearcoat: 0.3 }));
  f.rotation.x = -Math.PI / 2; f.receiveShadow = true; scene.add(f);
  const c = m.userData.center.clone();
  const A = cam.frame(c, m.userData.radius, { az: P.az, el: 8, fill: 0.95, fov: 28 });
  return (t) => { cam.apply(camera, A, { t: 0, drift: 0 }); k.lens = { blur: 0.006, focus: c }; };
}
`);
    const r = spawnSync(BUN, [path.join(KIT, 'render.mjs'), tmp, '--stills', '0.5,1.5,2.5', '--scale', '0.5', '--samples', '12'], { encoding: 'utf8' });
    const shots = ['t0.50.png', 't1.50.png', 't2.50.png'].map((f) => path.join(tmp, 'out', 'stills', f));
    if (r.status !== 0 || !shots.every((f) => fs.existsSync(f))) { console.log('  preview: render failed\n' + (r.stdout + r.stderr).split('\n').slice(-12).join('\n')); return false; }
    const errs = (r.stdout || '').split('\n').filter((l) => /^\s{2}\S/.test(l) && !/\.png$/.test(l) && !/^\s+tone /.test(l));
    if (errs.length) console.log('  preview: page messages\n' + errs.slice(0, 8).join('\n'));
    ffmpeg(['-i', shots[0], '-i', shots[1], '-i', shots[2], '-filter_complex', '[0:v]crop=540:760:0:100[a];[1:v]crop=540:760:0:100[b];[2:v]crop=540:760:0:100[c];[a][b][c]hstack=inputs=3', '-frames:v', '1', out.png]);
    return true;
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// ---------- main ----------
console.log(`model "${NAME}"`);
const ref = await reference();
if (opt.dry) {
  const usd3 = opt.glb ? 0 : EP.usd(O);
  if (ref?.prompt) console.log(`reference prompt (${ref.model}):\n  ${ref.prompt}\n`);
  console.log(`would spend about $${((ref?.usd || 0) + (usd3 || 0)).toFixed(2)}: ${ref?.prompt ? `image ${IM.id} $${IM.usd ?? '?'} + ` : ''}${opt.glb ? 'no 3D step' : `3D ${EP.id} $${usd3 ?? '?'}`}`);
  process.exit(0);
}
const gen = await generate(ref);
const cl = await clean(gen.raw);
fs.mkdirSync(DIR, { recursive: true });
fs.copyFileSync(cl.file, out.glb);
const meta = {
  name: NAME, prompt: opt.prompt || prev.prompt || null, reference: ref ? { prompt: ref.prompt || null, model: ref.model || null, source: ref.source || null } : null,
  endpoint: gen.endpoint, source: opt.glb ? path.basename(opt.glb) : null, options: O,
  triangles: cl.stats.tris, rawTriangles: cl.stats.rawTris, textures: cl.stats.textures, bytes: cl.stats.bytes,
  usd: +(((ref?.usd || 0) + (gen.usd || 0))).toFixed(3), created: new Date().toISOString(),
};
fs.writeFileSync(out.json, JSON.stringify(meta, null, 1));
if (!opt['no-preview']) { if (await preview(out.glb)) console.log(`  preview: ${path.relative(process.cwd(), out.png)}`); }
console.log(`${path.relative(process.cwd(), out.glb)}  (${cl.stats.tris.toLocaleString()} triangles, ${(cl.stats.bytes / 1e6).toFixed(2)} MB${spent ? `, spent ~$${spent.toFixed(2)}` : ', nothing spent'})`);
console.log(`load it with: await k.props.model(k.asset('assets/models/${NAME}.glb'), { size: 1 })`);
