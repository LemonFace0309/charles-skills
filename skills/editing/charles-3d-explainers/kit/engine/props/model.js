// model(): any GLB as a kit prop. Loads it (meshopt and Draco supported), bakes every node transform into the
// geometry, turns it to face +z with +y up, centres it, scales it to `size` world units, repairs or smooths its
// normals, and (usually) swaps the AI materials for kit materials: generated textures carry baked-in light and
// shadow that fight the kit's own rig, while a uniform kit material lets the rig, the rim and the environment do the
// work. Then: anchors from named nodes or from bounding-box fractions (optionally snapped onto the surface),
// deterministic surface points (for dot patterns, sparks, labels), ray hits, and glowing dot fields.
//
//   const m = await k.props.model(k.asset('assets/models/toaster.glb'), { size: 1.2, material: 'plastic', color: '#d8d4cc' });
//   scene.add(m);  k.lens = { blur: 0.02, focus: m.anchor('top') };
//
// Everything here is built once in a shot's build; nothing changes per frame except what the caller sets.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mat, accentDefault } from '../look.js';
import { rng, clamp } from '../util.js';
import { withAnchors } from './base.js';

const C = (c) => (c && c.isColor ? c.clone() : new THREE.Color(c));
const deg = THREE.MathUtils.degToRad;

// ---------- loading ----------
let LOADER = null;
const FILES = new Map(); // url -> Promise<gltf>, so several props from one file parse it once
function loader() {
  if (LOADER) return LOADER;
  LOADER = new GLTFLoader();
  LOADER.setMeshoptDecoder(MeshoptDecoder);
  const draco = new DRACOLoader();
  draco.setDecoderPath(new URL('../../node_modules/three/examples/jsm/libs/draco/gltf/', import.meta.url).href);
  LOADER.setDRACOLoader(draco);
  return LOADER;
}
// Raw load (cached): { scene, animations, ... } exactly as GLTFLoader returns it. Do not modify what it returns.
export function loadGLB(url) {
  if (!FILES.has(url)) FILES.set(url, new Promise((res, rej) => loader().load(url, res, undefined, (e) => rej(new Error(`model: cannot load ${url}: ${e?.message || e}`)))));
  return FILES.get(url);
}

// A copy of a geometry with every attribute as plain Float32 (de-interleaved, de-quantised), so it can be transformed.
function floatGeometry(src) {
  const g = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(src.attributes)) {
    if (a.isInterleavedBufferAttribute || a.normalized || !(a.array instanceof Float32Array)) {
      const out = new Float32Array(a.count * a.itemSize);
      for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) out[i * a.itemSize + c] = a.getComponent(i, c);
      g.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
    } else g.setAttribute(name, new THREE.BufferAttribute(a.array.slice(0, a.count * a.itemSize), a.itemSize));
  }
  if (src.index) g.setIndex(new THREE.BufferAttribute(src.index.array.slice(), 1));
  for (const gr of src.groups) g.addGroup(gr.start, gr.count, gr.materialIndex);
  return g;
}

// Axis names to vectors: '+y', '-z', 'x' ...
const AXES = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
function axis(s) {
  const m = /^([+-]?)([xyz])$/i.exec(String(s).trim());
  if (!m) throw new Error(`model: axis must be like '+y' or '-z', got "${s}"`);
  return new THREE.Vector3(...AXES[m[2].toLowerCase()]).multiplyScalar(m[1] === '-' ? -1 : 1);
}
// Rotation taking the model's `up` to +y and its `front` to +z.
function orient(up, front) {
  const u = axis(up), f = axis(front);
  if (Math.abs(u.dot(f)) > 0.5) throw new Error(`model: up (${up}) and front (${front}) must be different axes`);
  const r = new THREE.Vector3().crossVectors(u, f); // the model's +x after the turn
  const from = new THREE.Matrix4().makeBasis(r, u, f); // columns: where +x, +y, +z of the target come from
  return from.transpose(); // orthonormal: the inverse maps model axes onto the world axes
}

// Smooth normals welded by position (UV seams leave no shading seam). crease < 180 keeps hard edges: a corner only
// averages faces within that angle of its own face. Works on indexed or non-indexed geometry; returns new geometry.
export function smoothNormals(geo, crease = 180) {
  const P = geo.attributes.position, n = P.count;
  const idx = geo.index ? geo.index.array : Uint32Array.from({ length: n }, (_, i) => i), T = Math.floor(idx.length / 3);
  geo.computeBoundingBox();
  const q = geo.boundingBox.getSize(new THREE.Vector3()).length() * 1e-6 || 1e-9;
  const groups = new Map(), gid = new Uint32Array(n);
  for (let i = 0; i < n; i++) { const key = `${Math.round(P.getX(i) / q)},${Math.round(P.getY(i) / q)},${Math.round(P.getZ(i) / q)}`; let g = groups.get(key); if (g === undefined) { g = groups.size; groups.set(key, g); } gid[i] = g; }
  const fn = new Float32Array(T * 3), cw = new Float32Array(T * 3), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  for (let t = 0; t < T; t++) {
    a.fromBufferAttribute(P, idx[t * 3]); b.fromBufferAttribute(P, idx[t * 3 + 1]); c.fromBufferAttribute(P, idx[t * 3 + 2]);
    e1.subVectors(b, a); e2.subVectors(c, a); const nn = new THREE.Vector3().crossVectors(e1, e2).normalize();
    fn[t * 3] = nn.x; fn[t * 3 + 1] = nn.y; fn[t * 3 + 2] = nn.z;
    cw[t * 3] = e1.angleTo(e2) || 0; cw[t * 3 + 1] = e1.subVectors(c, b).angleTo(e2.subVectors(a, b)) || 0; cw[t * 3 + 2] = Math.max(0, Math.PI - cw[t * 3] - cw[t * 3 + 1]);
  }
  const G = groups.size;
  if (crease >= 180) {
    const acc = new Float32Array(G * 3);
    for (let t = 0; t < T; t++) for (let k = 0; k < 3; k++) { const g = gid[idx[t * 3 + k]] * 3, w = cw[t * 3 + k]; acc[g] += fn[t * 3] * w; acc[g + 1] += fn[t * 3 + 1] * w; acc[g + 2] += fn[t * 3 + 2] * w; }
    const N = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const g = gid[i] * 3, l = Math.hypot(acc[g], acc[g + 1], acc[g + 2]) || 1; N[i * 3] = acc[g] / l; N[i * 3 + 1] = acc[g + 1] / l; N[i * 3 + 2] = acc[g + 2] / l; }
    geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    return geo;
  }
  // creased: per-corner normals, then one vertex per distinct (vertex, normal)
  const cosC = Math.cos(deg(crease)), start = new Uint32Array(G + 1), list = new Uint32Array(T * 3);
  for (let k = 0; k < T * 3; k++) start[gid[idx[k]] + 1]++;
  for (let g = 0; g < G; g++) start[g + 1] += start[g];
  const fill = start.slice(0, G);
  for (let k = 0; k < T * 3; k++) list[fill[gid[idx[k]]]++] = k;
  const names = Object.keys(geo.attributes).filter((s) => s !== 'normal');
  const cols = names.map(() => []), N = [], vmap = new Map(), out = new Uint32Array(T * 3);
  for (let k = 0; k < T * 3; k++) {
    const t = (k / 3) | 0, g = gid[idx[k]]; let x = 0, y = 0, z = 0;
    for (let j = start[g]; j < start[g + 1]; j++) { const k2 = list[j], t2 = (k2 / 3) | 0; if (fn[t * 3] * fn[t2 * 3] + fn[t * 3 + 1] * fn[t2 * 3 + 1] + fn[t * 3 + 2] * fn[t2 * 3 + 2] >= cosC) { x += fn[t2 * 3] * cw[k2]; y += fn[t2 * 3 + 1] * cw[k2]; z += fn[t2 * 3 + 2] * cw[k2]; } }
    const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
    const i = idx[k], key = `${i}|${Math.round(x * 1000)},${Math.round(y * 1000)},${Math.round(z * 1000)}`;
    let j = vmap.get(key);
    if (j === undefined) { j = N.length / 3; vmap.set(key, j); N.push(x, y, z); names.forEach((s, m) => { const at = geo.attributes[s]; for (let cc = 0; cc < at.itemSize; cc++) cols[m].push(at.getComponent(i, cc)); }); }
    out[k] = j;
  }
  const g2 = new THREE.BufferGeometry();
  names.forEach((s, m) => g2.setAttribute(s, new THREE.BufferAttribute(new Float32Array(cols[m]), geo.attributes[s].itemSize)));
  g2.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N), 3));
  g2.setIndex(new THREE.BufferAttribute(out, 1));
  return g2;
}
// Normals that are missing, not unit length, or mostly pointing into the surface count as broken.
function normalsBroken(geo) {
  const N = geo.attributes.normal; if (!N) return true;
  const P = geo.attributes.position, idx = geo.index ? geo.index.array : null, T = Math.floor((idx ? idx.length : P.count) / 3);
  let bad = 0, inward = 0, tested = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), f = new THREE.Vector3(), v = new THREE.Vector3();
  const step = Math.max(1, Math.floor(T / 4000));
  for (let t = 0; t < T; t += step) {
    const i0 = idx ? idx[t * 3] : t * 3, i1 = idx ? idx[t * 3 + 1] : t * 3 + 1, i2 = idx ? idx[t * 3 + 2] : t * 3 + 2;
    a.fromBufferAttribute(P, i0); b.fromBufferAttribute(P, i1); c.fromBufferAttribute(P, i2);
    f.subVectors(b, a).cross(c.sub(a)); if (f.lengthSq() < 1e-30) continue; f.normalize();
    v.fromBufferAttribute(N, i0); const L = v.length();
    if (!(Math.abs(L - 1) < 0.1)) bad++; else if (v.dot(f) < -0.2) inward++;
    tested++;
  }
  return tested > 0 && (bad / tested > 0.05 || inward / tested > 0.3);
}

// ---------- materials ----------
// A fine procedural grain in object space (no UVs needed): the surface reads as clay, satin paint or skin instead of
// CG plastic. Injected into any standard/physical material; amp in normal-tilt units, scale = feature size in world units.
// rough > 0 also varies the roughness at a low frequency (patches 12 x the grain): one roughness everywhere is a CG tell.
// scatter (a colour) adds a warm emissive rim, k at grazing angles: light that seems to come through the edges (skin).
// mottle > 0 varies the albedo in soft patches (redder and paler), so a large even surface stops reading as paint.
function addGrain(m, { amp = 0.25, scale = 0.012, rough = 0, scatter = null, scatterK = 0.12, mottle = 0 } = {}) {
  if (!amp && !rough && !scatter && !mottle) return m;
  const extra = [];
  if (mottle) extra.push(['#include <color_fragment>', 'diffuseColor.rgb *= mix(vec3(1.0), vec3(1.06, 0.93, 0.92), uMottle * gNoise(vGrainP * uGrainFreq / 9.0 + 2.7)) * (1.0 - 0.07 * uMottle * gNoise(vGrainP * uGrainFreq / 2.5 + 8.1));']);
  if (rough) extra.push(['#include <roughnessmap_fragment>', 'roughnessFactor = clamp(roughnessFactor * (1.0 + uGrainRough * (gNoise(vGrainP * uGrainFreq / 12.0 + 5.2) * 2.0 - 1.0)), 0.04, 1.0);']);
  if (scatter) extra.push(['#include <emissivemap_fragment>', 'totalEmissiveRadiance += uScatter * pow(1. - abs(dot(normal, normalize(vViewPosition))), 2.5) * uScatterK;']);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uGrainAmp = { value: amp }; sh.uniforms.uGrainFreq = { value: 1 / scale }; sh.uniforms.uGrainRough = { value: rough };
    sh.uniforms.uScatter = { value: C(scatter || '#000000') }; sh.uniforms.uScatterK = { value: scatterK }; sh.uniforms.uMottle = { value: mottle };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGrainP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGrainP = transformed;');
    for (const [hook, code] of extra) sh.fragmentShader = sh.fragmentShader.replace(hook, hook + '\n' + code);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vGrainP; uniform float uGrainAmp, uGrainFreq, uGrainRough, uScatterK, uMottle; uniform vec3 uScatter;
float gHash(vec3 p){ p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float gNoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(gHash(i), gHash(i + vec3(1,0,0)), f.x), mix(gHash(i + vec3(0,1,0)), gHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(gHash(i + vec3(0,0,1)), gHash(i + vec3(1,0,1)), f.x), mix(gHash(i + vec3(0,1,1)), gHash(i + vec3(1,1,1)), f.x), f.y), f.z); }
vec3 grainNormal(vec3 n, vec3 pos){
  vec3 p = vGrainP * uGrainFreq;
  float h = (gNoise(p) * 0.6 + gNoise(p * 2.7 + 7.3) * 0.3 + gNoise(p * 0.37 + 3.1) * 0.6) * uGrainAmp / uGrainFreq;
  vec3 dpx = dFdx(pos), dpy = dFdy(pos); float dhx = dFdx(h), dhy = dFdy(h);
  vec3 r1 = cross(dpy, n), r2 = cross(n, dpx); float det = dot(dpx, r1);
  vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
  return normalize(abs(det) * n - grad);
}`).replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = grainNormal(normal, -vViewPosition);');
  };
  m.customProgramCacheKey = () => `grain${amp}_${scale}${rough ? '_r' : ''}${scatter ? '_s' : ''}${mottle ? '_m' : ''}`;
  return m;
}
// Kit presets for models. clay: sculptor's matte clay; skin: skin, not paint (two-scale grain, a warm sheen, a thin
// soft coat and a warm scatter rim at the edges); satin: smooth painted shell (a mannequin); wire: glowing wireframe in
// the accent; xray: a fresnel glass shell that glows at its edges; everything else comes from look.mat (plastic, matte,
// metal, brushed, ceramic, glass, frosted, gold, rubber, molten).
const PRESET_COLOR = { clay: '#c9c2b8', skin: '#a8735e', satin: '#2b3038', plastic: '#d9d6cf', matte: '#8a8f99', metal: '#c9ccd2', brushed: '#b9bec7', ceramic: '#f2f0ea', rubber: '#16181d' };
export function modelMaterial(kind = 'clay', o = {}) {
  const color = o.color ?? PRESET_COLOR[kind];
  const grain = (m, amp, sc, x = {}) => addGrain(m, { amp: o.grain ?? amp, scale: (o.grainScale ?? sc) * (o.unit ?? 1), ...x });
  switch (kind) {
    case 'clay': return grain(new THREE.MeshPhysicalMaterial({ color: C(color), roughness: o.rough ?? 0.6, metalness: 0, sheen: 0.35, sheenRoughness: 0.6, sheenColor: C('#ffffff'), envMapIntensity: o.env ?? 0.9 }), 0.05, 0.004);
    // skin: the scatter rim (o.scatter: a colour, or false) makes the edges glow warm like skin instead of painted plastic
    case 'skin': return grain(new THREE.MeshPhysicalMaterial({ color: C(color), roughness: o.rough ?? 0.5, metalness: 0, sheen: o.sheen ?? 0.5, sheenRoughness: 0.45, sheenColor: C(o.sheenColor ?? '#ff9a80'), clearcoat: o.clearcoat ?? 0.2, clearcoatRoughness: 0.45, envMapIntensity: o.env ?? 0.8 }), 0.035, 0.003, { rough: o.roughVar ?? 0.3, scatter: o.scatter === false ? null : o.scatter ?? '#d0503c', scatterK: o.scatterK ?? 0.12, mottle: o.mottle ?? 1 });
    case 'satin': return grain(new THREE.MeshPhysicalMaterial({ color: C(color), roughness: o.rough ?? 0.36, metalness: o.metal ?? 0, clearcoat: 0.45, clearcoatRoughness: 0.28, envMapIntensity: o.env ?? 1.1 }), 0.02, 0.004);
    case 'wire': return new THREE.MeshBasicMaterial({ color: C(o.color ?? accentDefault()).multiplyScalar(o.intensity ?? 2.2), wireframe: true, toneMapped: false, transparent: true, opacity: o.opacity ?? 0.55, depthWrite: false, fog: false });
    case 'xray': return xray(o);
    case 'glass': return mat.glass({ color: o.color, rough: o.rough, thickness: o.thickness });
    case 'frosted': return mat.frosted({ color: o.color, rough: o.rough });
    case 'gold': return mat.gold({ rough: o.rough });
    default: {
      if (!mat[kind]) throw new Error(`model: unknown material "${kind}" (keep, clay, skin, satin, wire, xray, ${Object.keys(mat).join(', ')})`);
      const m = mat[kind](color, { rough: o.rough, env: o.env });
      return ['plastic', 'matte', 'ceramic', 'rubber'].includes(kind) ? grain(m, 0.02, 0.004) : m;
    }
  }
}
// A see-through shell: dark in the middle, glowing along the silhouette (fresnel), additive. For "inside" shots.
function xray(o = {}) {
  const col = C(o.color ?? '#7fc4ff').multiplyScalar(o.intensity ?? 1.6);
  return new THREE.ShaderMaterial({
    uniforms: { uCol: { value: col }, uPow: { value: o.power ?? 2.4 }, uBase: { value: o.base ?? 0.04 }, uOpacity: { value: o.opacity ?? 1 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uCol; uniform float uPow, uBase, uOpacity; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPow); gl_FragColor = vec4(uCol * (uBase + f) * uOpacity, 1.0); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, fog: false,
  });
}
// The file's own materials, made to sit in the kit's light: env reflections on, optional roughness/metal overrides.
function keepMaterial(m, o) {
  const x = m.clone();
  if ('envMapIntensity' in x) x.envMapIntensity = o.env ?? 1;
  if (o.rough != null && 'roughness' in x) { x.roughness = o.rough; x.roughnessMap = null; }
  if (o.metal != null && 'metalness' in x) { x.metalness = o.metal; x.metalnessMap = null; }
  if (o.color != null && x.color) x.color = C(o.color);
  if (x.map) x.map.anisotropy = 8;
  x.side = o.doubleSide ? THREE.DoubleSide : x.side;
  return x;
}

// ---------- the prop ----------
// model(url, o) -> Promise<Group>. Options:
//   size 1                world units for the dimension named by fit
//   fit 'max'             'max' (largest side), 'height', 'width', 'depth'
//   up '+y', front '+z'   which axes of the file are up and front (most generated GLBs: +y and +z)
//   rotate [0, 0, 0]      extra turn in degrees (x, y, z) after up/front;  mirror: 'x' (or 'y', 'z') flips the model
//   center 'bottom'       'bottom' (stands on y = 0, centred on x and z), 'center' (box centre at the origin), 'none'
//   material 'keep'       'keep' | 'clay' | 'skin' | 'satin' | 'plastic' | 'matte' | 'metal' | 'brushed' | 'ceramic' |
//                         'glass' | 'frosted' | 'gold' | 'rubber' | 'wire' | 'xray' | a THREE.Material | (mesh) => Material
//   color, rough, metal, env, opacity, intensity (wire/xray), grain (micro-bump strength, 0 = off), grainScale (bump
//                         feature size as a fraction of the model's largest side)
//   smooth 'auto'         'auto' (repair broken or missing normals), true (smooth, welded), a crease angle in degrees,
//                         false (keep the file's)
//   shadows true          cast and receive
//   anchors {}            { name: [fx, fy, fz] (box fractions, 0..1) | { at: [fx, fy, fz], snap: '+z' } (moved onto the
//                         surface along that axis, from outside) | 'NodeName' | THREE.Vector3 (final local units) }
//   crop                  plane or [planes] { normal, at (box fraction along that axis) | point, name }: keep what is
//                         behind every plane, cap each cut face. Applied in order; the first must cross the model where
//                         its surface is closed.
//   cut                   plane or [planes] (same form, plus holes: [[Vector3 on the plane]] channels to leave open):
//                         remove the wedge in front of all of them at once (a product cutaway), cap its faces
//   capColor, capMaterial the section faces' look (default: the model's material, a little darker)
// Returns a Group with: meshes, caps (section meshes), anchors (built-in center, top, bottom, front, back, left, right
// plus yours), anchor(name) (throws on a bad name), addAnchor(name, pos), frac([fx, fy, fz]) (box fractions to a
// point), surfacePoints(n, seed, o), hit(origin, dir), dots(points, o), capStats, and userData { radius, size [w, h, d],
// center (box centre), footprint, box, triangles, scale (world units per file unit), fromFile (Matrix4), src }.
export async function model(src, o = {}) {
  const { size = 1, fit = 'max', up = '+y', front = '+z', rotate = [0, 0, 0], center = 'bottom', material = 'keep', smooth = 'auto', shadows = true } = o;
  const gltf = await loadGLB(src);
  const root = gltf.scene;
  root.updateMatrixWorld(true);

  // 1. bake every mesh into one space, as plain float geometry
  const parts = [], named = new Map();
  root.traverse((ob) => {
    if (ob.name) named.set(ob.name, new THREE.Vector3().setFromMatrixPosition(ob.matrixWorld));
    if (!ob.isMesh || !ob.geometry?.attributes?.position) return;
    const geo = floatGeometry(ob.geometry).applyMatrix4(ob.matrixWorld);
    if (ob.matrixWorld.determinant() < 0) flipWinding(geo);
    parts.push({ name: ob.name, geo, material: ob.material });
  });
  if (!parts.length) throw new Error(`model: no meshes in ${src}`);

  // 2. orient (and mirror), then fit and centre
  const turn = orient(up, front).premultiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(deg(rotate[0]), deg(rotate[1]), deg(rotate[2]))));
  if (o.mirror) turn.premultiply(new THREE.Matrix4().makeScale(/x/i.test(o.mirror) ? -1 : 1, /y/i.test(o.mirror) ? -1 : 1, /z/i.test(o.mirror) ? -1 : 1));
  const box = new THREE.Box3();
  for (const p of parts) { p.geo.applyMatrix4(turn); if (turn.determinant() < 0) flipWinding(p.geo); p.geo.computeBoundingBox(); box.union(p.geo.boundingBox); }
  const dims = box.getSize(new THREE.Vector3());
  const ref = fit === 'height' ? dims.y : fit === 'width' ? dims.x : fit === 'depth' ? dims.z : Math.max(dims.x, dims.y, dims.z);
  const s = size / (ref || 1);
  const c = box.getCenter(new THREE.Vector3());
  const shift = center === 'bottom' ? new THREE.Vector3(-c.x, -box.min.y, -c.z) : center === 'center' ? c.clone().negate() : new THREE.Vector3();
  const place = new THREE.Matrix4().makeScale(s, s, s).multiply(new THREE.Matrix4().makeTranslation(shift.x, shift.y, shift.z));
  const toLocal = place.clone().multiply(turn); // file space -> prop space
  for (const p of parts) {
    p.geo.applyMatrix4(place);
    if (smooth === true || typeof smooth === 'number') p.geo = smoothNormals(p.geo, smooth === true ? 180 : smooth);
    else if (smooth === 'auto' && normalsBroken(p.geo)) p.geo = smoothNormals(p.geo, 180);
    else if (!p.geo.attributes.normal) p.geo.computeVertexNormals();
    p.geo.computeBoundingBox(); p.geo.computeBoundingSphere();
  }
  const fbox = new THREE.Box3(); for (const p of parts) fbox.union(p.geo.boundingBox);
  const frac = (f) => new THREE.Vector3(THREE.MathUtils.lerp(fbox.min.x, fbox.max.x, f[0]), THREE.MathUtils.lerp(fbox.min.y, fbox.max.y, f[1]), THREE.MathUtils.lerp(fbox.min.z, fbox.max.z, f[2]));
  const g0 = new THREE.Group();

  // 2b. crop (keep the inside of a convex block) and cut (remove a convex wedge), capping every face with the solid's
  //     cross-section, so an AI mesh becomes a cutaway model with clean section faces
  let caps = [];
  if (o.cut || o.crop) {
    const size3 = fbox.getSize(new THREE.Vector3());
    const plane = (q) => {
      const n = (q.normal?.isVector3 ? q.normal.clone() : new THREE.Vector3(...(q.normal || [0, 1, 0]))).normalize();
      // point, or at: a box fraction (0..1) along the box diagonal, which for an axis-aligned plane is simply its position on that axis
      const pt = q.point ? (q.point.isVector3 ? q.point.clone() : new THREE.Vector3(...q.point)) : frac([q.at ?? 0.5, q.at ?? 0.5, q.at ?? 0.5]);
      return { n, pt, holes: q.holes || [], name: q.name };
    };
    const list = (x) => (!x ? [] : Array.isArray(x) ? x : x.planes || [x]);
    const crops = list(o.crop).map(plane), cuts = list(o.cut).map(plane);
    const tol = size3.length() * 2e-5, stats = [];
    // crops one plane at a time, so each section is taken from a closed solid (the mesh plus the caps so far)
    for (const C of crops) {
      const cap = capGeometry([...parts.map((p) => p.geo), ...caps.map((c) => c.geo)], C, {}, tol);
      stats.push({ name: C.name || 'crop', ...capGeometry.last, tris: cap ? cap.attributes.position.count / 3 : 0 });
      for (const p of parts) p.geo = removeRegion(p.geo, [C]);
      for (const c of caps) c.geo = removeRegion(c.geo, [C]);
      if (cap) caps.push({ geo: cap, name: C.name || 'crop' + caps.length });
    }
    // then the wedge: every cut plane's section is trimmed to the faces of the removed region
    if (cuts.length) {
      const src = [...parts.map((p) => p.geo), ...caps.map((c) => c.geo)];
      const cutCaps = cuts.map((P, i) => { const cap = capGeometry(src, P, { front: cuts.filter((_, j) => j !== i) }, tol); stats.push({ name: P.name || 'cut' + i, ...capGeometry.last, tris: cap ? cap.attributes.position.count / 3 : 0 }); return cap ? { geo: cap, name: P.name || 'cut' + i } : null; });
      for (const p of parts) p.geo = removeRegion(p.geo, cuts);
      for (const c of caps) c.geo = removeRegion(c.geo, cuts);
      caps.push(...cutCaps.filter(Boolean));
    }
    caps = caps.filter((c) => c.geo.attributes.position.count > 0);
    for (const p of parts) { p.geo.computeBoundingBox(); p.geo.computeBoundingSphere(); }
    g0.capStats = stats;
    g0.planes = { crops, cuts };
  }
  // 3. materials and meshes
  const g = g0; g.name = o.name || 'model';
  const unit = Math.max(...fbox.getSize(new THREE.Vector3()).toArray());
  const made = new Map();
  const pick = (m, mesh) => {
    if (material && material.isMaterial) return material;
    if (typeof material === 'function') return material(mesh);
    if (material === 'keep') { if (!made.has(m)) made.set(m, keepMaterial(m, o)); return made.get(m); }
    if (!made.has('kit')) made.set('kit', modelMaterial(material, { ...o, unit: unit / 1.0 }));
    return made.get('kit');
  };
  g.meshes = parts.map((p) => {
    const mesh = new THREE.Mesh(p.geo, null); mesh.name = p.name;
    mesh.material = Array.isArray(p.material) ? p.material.map((m) => pick(m, mesh)) : pick(p.material, mesh);
    mesh.castShadow = mesh.receiveShadow = !!shadows && material !== 'wire' && material !== 'xray';
    g.add(mesh);
    return mesh;
  });
  if (caps.length) {
    const kind = typeof material === 'string' && !['keep', 'wire', 'xray'].includes(material) ? material : 'clay';
    const cm = o.capMaterial || modelMaterial(kind, { ...o, unit, color: o.capColor ?? '#' + C(o.color ?? PRESET_COLOR[kind] ?? '#c9c2b8').multiplyScalar(0.8).getHexString() });
    g.caps = caps.map(({ geo, name }) => { geo.computeBoundingBox(); geo.computeBoundingSphere(); const m = new THREE.Mesh(geo, cm); m.name = name; m.castShadow = m.receiveShadow = !!shadows; g.add(m); return m; });
  }

  // 4. size, framing and anchors
  const size3 = fbox.getSize(new THREE.Vector3()), bc = fbox.getCenter(new THREE.Vector3());
  let rad = 0; const v = new THREE.Vector3();
  for (const p of parts) { const P = p.geo.attributes.position; for (let i = 0; i < P.count; i += 3) rad = Math.max(rad, v.fromBufferAttribute(P, i).distanceTo(bc)); }
  const triangles = parts.reduce((n, p) => n + (p.geo.index ? p.geo.index.count : p.geo.attributes.position.count) / 3, 0);
  g.userData = { radius: rad, size: size3.toArray(), center: bc.clone(), footprint: [size3.x, size3.z], box: fbox.clone(), triangles, scale: s, fromFile: toLocal.clone(), src };

  g.anchors = {};
  const addAnchor = (name, pos) => { const a = new THREE.Object3D(); a.name = name; a.position.copy(pos); g.add(a); g.anchors[name] = a; return a; };
  // ray hits in prop space (uses the meshes' geometry directly, so it works before the prop is added to a scene)
  const ray = new THREE.Raycaster();
  g.hit = (origin, dir, { far = Infinity } = {}) => {
    ray.set(origin.isVector3 ? origin.clone() : new THREE.Vector3(...origin), (dir.isVector3 ? dir.clone() : new THREE.Vector3(...dir)).normalize());
    ray.far = far;
    let best = null;
    for (const m of g.meshes) {
      const saved = m.matrixWorld.clone(); m.matrixWorld.identity();
      const hits = ray.intersectObject(m, false); m.matrixWorld.copy(saved);
      const h = hits.find((x) => x.face);
      if (h && (!best || h.distance < best.distance)) best = { point: h.point.clone(), normal: h.face.normal.clone(), distance: h.distance, mesh: m };
    }
    return best;
  };
  const snapTo = (p, ax) => {
    const d = axis(ax), o2 = p.clone().addScaledVector(d, rad * 3);
    const h = g.hit(o2, d.clone().negate());
    return h ? h.point : p;
  };
  const builtin = { center: [0.5, 0.5, 0.5], top: [0.5, 1, 0.5], bottom: [0.5, 0, 0.5], front: [0.5, 0.5, 1], back: [0.5, 0.5, 0], left: [0, 0.5, 0.5], right: [1, 0.5, 0.5] };
  for (const [name, f] of Object.entries(builtin)) addAnchor(name, frac(f));
  for (const [name, a] of Object.entries(o.anchors || {})) {
    if (a && a.isVector3) addAnchor(name, a);
    else if (typeof a === 'string') { if (!named.has(a)) throw new Error(`model: anchor "${name}": no node named "${a}" in ${src} (nodes: ${[...named.keys()].slice(0, 20).join(', ')})`); addAnchor(name, named.get(a).clone().applyMatrix4(toLocal)); }
    else if (Array.isArray(a)) addAnchor(name, frac(a));
    else if (a && a.at) addAnchor(name, a.snap ? snapTo(frac(a.at), a.snap) : frac(a.at));
    else throw new Error(`model: anchor "${name}" must be [fx, fy, fz], { at, snap }, a node name or a Vector3`);
  }
  withAnchors(g, g.anchors); // g.anchor(name): throws with the valid names on a typo
  g.addAnchor = (name, pos) => addAnchor(name, pos);
  g.frac = frac; // box fractions -> prop-space point

  // 5. surface points: area-weighted, deterministic, evenly spread (blue-noise-like) unless even: false
  g.surfacePoints = (n, seed = 1, so = {}) => surfacePoints(g.meshes.filter((m) => !so.mesh || m.name === so.mesh).map((m) => m.geometry), n, seed, { ...so, frac });
  g.dots = (points, d = {}) => surfaceDots(points, { size: unit * 0.006, ...d });
  return g;
}

// ---------- cutaways ----------
function flipWinding(geo) {
  if (geo.index) { const ix = geo.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } return geo; }
  for (const a of Object.values(geo.attributes)) { const s = a.itemSize, arr = a.array; for (let t = 0; t + 2 < a.count; t += 3) for (let c = 0; c < s; c++) { const x = arr[(t + 1) * s + c]; arr[(t + 1) * s + c] = arr[(t + 2) * s + c]; arr[(t + 2) * s + c] = x; } }
  return geo;
}
const distTo = (v, P) => (v[0] - P.pt.x) * P.n.x + (v[1] - P.pt.y) * P.n.y + (v[2] - P.pt.z) * P.n.z;
// Clip a convex polygon (vertices = flat arrays, position first) to one side of a plane: front (d > 0) or back.
function clipPoly(poly, P, front) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], da = distTo(a, P), db = distTo(b, P);
    const ia = front ? da > 0 : da <= 0, ib = front ? db > 0 : db <= 0;
    if (ia) out.push(a);
    if (ia !== ib) { const t = da / (da - db); out.push(a.map((x, k) => x + (b[k] - x) * t)); }
  }
  return out;
}
// Remove the convex region in front of every plane (the intersection of the half-spaces d > 0) from a geometry:
// T - R = union over i of (T behind plane i, in front of planes 1..i-1). Returns non-indexed geometry.
export function removeRegion(geo, planes) {
  const names = ['position', ...Object.keys(geo.attributes).filter((k) => k !== 'position')];
  const A = names.map((k) => geo.attributes[k]), sizes = A.map((a) => a.itemSize), W = sizes.reduce((x, y) => x + y, 0);
  const idx = geo.index ? geo.index.array : null, T = Math.floor((idx ? idx.length : A[0].count) / 3);
  const vert = (i) => { const v = new Array(W); let o = 0; for (let k = 0; k < A.length; k++) for (let c = 0; c < sizes[k]; c++) v[o++] = A[k].getComponent(i, c); return v; };
  const out = [];
  for (let t = 0; t < T; t++) {
    const tri = [0, 1, 2].map((j) => vert(idx ? idx[t * 3 + j] : t * 3 + j));
    let keepAll = false, dropAll = true;
    for (const P of planes) { const d = tri.map((v) => distTo(v, P)); if (d.every((x) => x <= 0)) { keepAll = true; break; } if (!d.every((x) => x > 0)) dropAll = false; }
    if (keepAll) { for (const v of tri) out.push(...v); continue; }
    if (dropAll) continue;
    let rest = tri;
    for (const P of planes) {
      const piece = clipPoly(rest, P, false);
      for (let j = 1; j + 1 < piece.length; j++) out.push(...piece[0], ...piece[j], ...piece[j + 1]);
      rest = clipPoly(rest, P, true);
      if (rest.length < 3) break;
    }
  }
  const g = new THREE.BufferGeometry(), N = out.length / W;
  let o = 0;
  names.forEach((name, k) => {
    const arr = new Float32Array(N * sizes[k]);
    for (let i = 0; i < N; i++) for (let c = 0; c < sizes[k]; c++) arr[i * sizes[k] + c] = out[i * W + o + c];
    if (name === 'normal') for (let i = 0; i < N; i++) { const l = Math.hypot(arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]) || 1; arr[i * 3] /= l; arr[i * 3 + 1] /= l; arr[i * 3 + 2] /= l; }
    g.setAttribute(name, new THREE.BufferAttribute(arr, sizes[k]));
    o += sizes[k];
  });
  return g;
}
// Outline C minus a channel H that crosses C's boundary exactly twice (both CCW, Vector2s): walk C outside H, then
// back along H's boundary (reversed) through the part of H inside C. Returns the new outline, or null.
function spliceOut(C, H, inside) {
  const X = [];
  for (let i = 0; i < C.length; i++) {
    const a = C[i], b = C[(i + 1) % C.length];
    for (let j = 0; j < H.length; j++) {
      const c = H[j], d = H[(j + 1) % H.length];
      const r1x = b.x - a.x, r1y = b.y - a.y, r2x = d.x - c.x, r2y = d.y - c.y, den = r1x * r2y - r1y * r2x;
      if (Math.abs(den) < 1e-18) continue;
      const t = ((c.x - a.x) * r2y - (c.y - a.y) * r2x) / den, w = ((c.x - a.x) * r1y - (c.y - a.y) * r1x) / den;
      if (t >= 0 && t < 1 && w >= 0 && w < 1) X.push({ i, j, tc: t, p: new THREE.Vector2(a.x + r1x * t, a.y + r1y * t) });
    }
  }
  if (X.length !== 2) return null;
  X.sort((p, q) => p.i + p.tc - (q.i + q.tc));
  let [s0, e0] = X;
  if (inside(C[(s0.i + 1) % C.length], H)) [s0, e0] = [e0, s0]; // walk C from s0 to e0 on the part outside H
  const out = [s0.p];
  for (let k = (s0.i + 1) % C.length, guard = 0; guard <= C.length; k = (k + 1) % C.length, guard++) { out.push(C[k]); if (k === e0.i) break; }
  out.push(e0.p);
  if (!inside(H[e0.j], C)) return null;
  for (let k = e0.j, guard = 0; guard <= H.length; k = (k - 1 + H.length) % H.length, guard++) { out.push(H[k]); if (k === (s0.j + 1) % H.length) break; }
  return out;
}
// The cap where plane P crosses closed geometries: the cross-section loops, nested into outlines and holes,
// triangulated, trimmed to the front side of the planes in `front` and the back side of those in `back`, minus any
// convex `holes` (arrays of 3D points on the plane: a channel cut into the section). Faces +P.n.
export function capGeometry(geos, P, { front = [], back = [] } = {}, tol = 1e-5) {
  const n = P.n, u = new THREE.Vector3().crossVectors(n, Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize(), v = new THREE.Vector3().crossVectors(n, u);
  const nodes = [], adj = [], grid = new Map();
  const nodeAt = (x, y) => {
    const gx = Math.round(x / tol), gy = Math.round(y / tol);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const l = grid.get(`${gx + dx},${gy + dy}`); if (l) for (const i of l) if (Math.abs(nodes[i].x - x) <= tol && Math.abs(nodes[i].y - y) <= tol) return i; }
    const i = nodes.length; nodes.push(new THREE.Vector2(x, y)); adj.push([]);
    const k = `${gx},${gy}`; (grid.get(k) || grid.set(k, []).get(k)).push(i);
    return i;
  };
  const pa = new THREE.Vector3(), pb = new THREE.Vector3(), q = new THREE.Vector3();
  for (const geo of geos) {
    const Pp = geo.attributes.position, idx = geo.index ? geo.index.array : null, T = Math.floor((idx ? idx.length : Pp.count) / 3);
    const d = [0, 0, 0], id = [0, 0, 0];
    for (let t = 0; t < T; t++) {
      for (let j = 0; j < 3; j++) { id[j] = idx ? idx[t * 3 + j] : t * 3 + j; d[j] = (Pp.getX(id[j]) - P.pt.x) * n.x + (Pp.getY(id[j]) - P.pt.y) * n.y + (Pp.getZ(id[j]) - P.pt.z) * n.z; }
      const pts = [];
      for (let j = 0; j < 3; j++) {
        const k = (j + 1) % 3; if ((d[j] <= 0) === (d[k] <= 0)) continue;
        const tt = d[j] / (d[j] - d[k]);
        pa.fromBufferAttribute(Pp, id[j]); pb.fromBufferAttribute(Pp, id[k]); q.copy(pa).lerp(pb, tt).sub(P.pt);
        pts.push(nodeAt(q.dot(u), q.dot(v)));
      }
      if (pts.length === 2 && pts[0] !== pts[1]) { adj[pts[0]].push(pts[1]); adj[pts[1]].push(pts[0]); }
    }
  }
  // chain the segments: open chains first (from the ends of holes in the surface), then closed loops
  const used = new Set(), ek = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`), loops = [], chains = [];
  const walk = (s0, nb) => { const path = [s0]; used.add(ek(s0, nb)); let cur = nb;
    for (let guard = 0; guard < 1e6; guard++) { if (cur === s0) return { path, closed: true }; path.push(cur); const next = adj[cur].find((x) => !used.has(ek(cur, x))); if (next === undefined) return { path, closed: false }; used.add(ek(cur, next)); cur = next; }
    return { path, closed: false }; };
  for (let s0 = 0; s0 < nodes.length; s0++) if (adj[s0].length % 2) for (const nb of adj[s0]) if (!used.has(ek(s0, nb))) { const w = walk(s0, nb); if (w.path.length > 1) chains.push(w.path); }
  for (let s0 = 0; s0 < nodes.length; s0++) for (const nb of adj[s0]) {
    if (used.has(ek(s0, nb))) continue;
    const w = walk(s0, nb);
    if (w.closed && w.path.length >= 3) loops.push(w.path.map((i) => nodes[i])); else if (w.path.length > 1) chains.push(w.path);
  }
  // a cut just past a hole in the mesh leaves open chains: join them end to end across the shortest gaps
  if (chains.length) {
    let span = 0; for (const n2 of nodes) span = Math.max(span, Math.abs(n2.x), Math.abs(n2.y));
    const maxGap = span * 0.35, left = chains.map((c) => c.map((i) => nodes[i]));
    while (left.length) {
      let cur = left.shift();
      for (let guard = 0; guard < 1000; guard++) {
        const end = cur[cur.length - 1];
        let best = { d: end.distanceTo(cur[0]), k: -1, rev: false };
        left.forEach((c, k) => { const d0 = end.distanceTo(c[0]), d1 = end.distanceTo(c[c.length - 1]); if (d0 < best.d) best = { d: d0, k, rev: false }; if (d1 < best.d) best = { d: d1, k, rev: true }; });
        if (best.k < 0) { if (best.d <= maxGap && cur.length >= 3) loops.push(cur); break; }
        if (best.d > maxGap) break;
        const c = left.splice(best.k, 1)[0];
        cur = cur.concat(best.rev ? c.reverse() : c);
      }
    }
  }
  capGeometry.last = { nodes: nodes.length, loops: loops.length, open: adj.filter((a) => a.length % 2).length, chains: chains.length };
  if (!loops.length) return null;
  const area = (L) => { let a = 0; for (let i = 0; i < L.length; i++) { const p = L[i], r = L[(i + 1) % L.length]; a += p.x * r.y - r.x * p.y; } return a / 2; };
  const inside = (pt, L) => { let c = false; for (let i = 0, j = L.length - 1; i < L.length; j = i++) { const a = L[i], b = L[j]; if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) c = !c; } return c; };
  const Ar = loops.map(area);
  const depth = loops.map((L, i) => loops.reduce((m, M, j) => m + (j !== i && Math.abs(Ar[j]) > Math.abs(Ar[i]) && inside(L[0], M) ? 1 : 0), 0));
  Object.assign(capGeometry.last, { areas: Ar.map((a) => +a.toFixed(5)), depth, sizes: loops.map((L) => L.length) });
  const to3 = (p) => { const w = P.pt.clone().addScaledVector(u, p.x).addScaledVector(v, p.y); return [w.x, w.y, w.z, n.x, n.y, n.z, p.x, p.y]; };
  // channels (P.holes, polygons of 3D points on the plane): a channel inside an outline becomes a hole in it; one
  // that runs out through the outline (a canal opening to the outside) is spliced into it
  const channels = (P.holes || []).map((hole) => { const L = hole.map((x) => { const w = (x.isVector3 ? x.clone() : new THREE.Vector3(...x)).sub(P.pt); return new THREE.Vector2(w.dot(u), w.dot(v)); }); return area(L) < 0 ? L.reverse() : L; });
  const tris = [];
  loops.forEach((L, i) => {
    if (depth[i] % 2) return;
    let contour = Ar[i] < 0 ? [...L].reverse() : L;
    const holes = loops.filter((M, j) => depth[j] === depth[i] + 1 && inside(M[0], L)).map((M) => (area(M) > 0 ? [...M].reverse() : M));
    for (const H of channels) {
      const spliced = spliceOut(contour, H, inside);
      if (spliced) contour = spliced;
      else if (inside(H[0], contour)) holes.push([...H].reverse());
    }
    const all = [...contour, ...holes.flat()];
    for (const f of THREE.ShapeUtils.triangulateShape(contour, holes)) tris.push([to3(all[f[0]]), to3(all[f[1]]), to3(all[f[2]])]);
  });
  // keep the part of the section that bounds the removed region, then cut the channels
  const flat = [];
  for (const t of tris) {
    let poly = t;
    for (const Q of front) { poly = clipPoly(poly, Q, true); if (poly.length < 3) break; }
    if (poly.length >= 3) for (const Q of back) { poly = clipPoly(poly, Q, false); if (poly.length < 3) break; }
    for (let j = 1; j + 1 < poly.length; j++) flat.push(...poly[0], ...poly[j], ...poly[j + 1]);
  }
  const make = (arr) => {
    const g = new THREE.BufferGeometry(), N = arr.length / 8, pos = new Float32Array(N * 3), nor = new Float32Array(N * 3), uv = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) { pos.set(arr.slice(i * 8, i * 8 + 3), i * 3); nor.set(arr.slice(i * 8 + 3, i * 8 + 6), i * 3); uv.set(arr.slice(i * 8 + 6, i * 8 + 8), i * 2); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return g;
  };
  const geo = make(flat);
  return geo.attributes.position.count ? geo : null;
}

// ---------- surface sampling ----------
// surfacePoints(geometries, n, seed, { region: { min: [fx,fy,fz], max }, facing: [x,y,z], minDot 0.2, filter(p, nrm),
// even true, spacing }) -> [{ position, normal }] in the geometries' space. `region` is in box fractions (needs frac).
export function surfacePoints(geos, n, seed = 1, o = {}) {
  const R = rng(seed), tris = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nn = new THREE.Vector3(), cen = new THREE.Vector3();
  const lo = o.region && o.frac ? o.frac(o.region.min) : null, hi = o.region && o.frac ? o.frac(o.region.max) : null;
  const facing = o.facing ? new THREE.Vector3(...o.facing).normalize() : null, minDot = o.minDot ?? 0.2;
  let total = 0;
  for (const geo of geos) {
    const P = geo.attributes.position, N = geo.attributes.normal, idx = geo.index ? geo.index.array : null, T = Math.floor((idx ? idx.length : P.count) / 3);
    for (let t = 0; t < T; t++) {
      const i0 = idx ? idx[t * 3] : t * 3, i1 = idx ? idx[t * 3 + 1] : t * 3 + 1, i2 = idx ? idx[t * 3 + 2] : t * 3 + 2;
      a.fromBufferAttribute(P, i0); b.fromBufferAttribute(P, i1); c.fromBufferAttribute(P, i2);
      cen.copy(a).add(b).add(c).divideScalar(3);
      if (lo && (cen.x < lo.x || cen.y < lo.y || cen.z < lo.z || cen.x > hi.x || cen.y > hi.y || cen.z > hi.z)) continue;
      nn.subVectors(b, a).cross(c.clone().sub(a));
      const area = nn.length() / 2; if (!(area > 0)) continue;
      nn.normalize();
      if (facing && nn.dot(facing) < minDot) continue;
      total += area; tris.push({ geo, i0, i1, i2, cum: total, P, N });
    }
  }
  if (!tris.length) return [];
  const pickTri = (u) => { let lo2 = 0, hi2 = tris.length - 1; const x = u * total; while (lo2 < hi2) { const m = (lo2 + hi2) >> 1; if (tris[m].cum < x) lo2 = m + 1; else hi2 = m; } return tris[lo2]; };
  const sample = () => {
    const tr = pickTri(R()); let r1 = R(), r2 = R(); if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
    a.fromBufferAttribute(tr.P, tr.i0); b.fromBufferAttribute(tr.P, tr.i1); c.fromBufferAttribute(tr.P, tr.i2);
    const p = a.clone().multiplyScalar(1 - r1 - r2).addScaledVector(b, r1).addScaledVector(c, r2);
    let nrm;
    if (tr.N) { const na = new THREE.Vector3().fromBufferAttribute(tr.N, tr.i0), nb = new THREE.Vector3().fromBufferAttribute(tr.N, tr.i1), nc = new THREE.Vector3().fromBufferAttribute(tr.N, tr.i2); nrm = na.multiplyScalar(1 - r1 - r2).addScaledVector(nb, r1).addScaledVector(nc, r2).normalize(); }
    else nrm = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    return { position: p, normal: nrm };
  };
  const out = [];
  if (o.even === false) { while (out.length < n) { const s = sample(); if (!o.filter || o.filter(s.position, s.normal)) out.push(s); } return out; }
  // dart throwing on a hash grid: candidates are accepted only if no accepted point is closer than r
  let r = o.spacing ?? Math.sqrt(total / (n * Math.PI)) * 1.25;
  const tries = n * 30;
  for (let pass = 0; pass < 6 && out.length < n; pass++, r *= 0.82) {
    const cell = r, grid = new Map(), key = (x, y, z) => `${x},${y},${z}`;
    for (const q of out) { const k2 = key(Math.floor(q.position.x / cell), Math.floor(q.position.y / cell), Math.floor(q.position.z / cell)); (grid.get(k2) || grid.set(k2, []).get(k2)).push(q.position); }
    for (let i = 0; i < tries && out.length < n; i++) {
      const s = sample();
      if (o.filter && !o.filter(s.position, s.normal)) continue;
      const gx = Math.floor(s.position.x / cell), gy = Math.floor(s.position.y / cell), gz = Math.floor(s.position.z / cell);
      let ok = true;
      for (let dx = -1; dx <= 1 && ok; dx++) for (let dy = -1; dy <= 1 && ok; dy++) for (let dz = -1; dz <= 1 && ok; dz++) {
        const l = grid.get(key(gx + dx, gy + dy, gz + dz)); if (l) for (const q of l) if (q.distanceToSquared(s.position) < r * r) { ok = false; break; }
      }
      if (!ok) continue;
      out.push(s);
      const k2 = key(gx, gy, gz); (grid.get(k2) || grid.set(k2, []).get(k2)).push(s.position);
    }
  }
  return out;
}

// surfaceDots(points, o): glowing dots lying on a surface (one draw call). points: [{ position, normal }] (from
// surfacePoints) or Vector3s. o: { size .006 (world units), color (accent), intensity 5, lift .002, opacity 1, scale }.
// .reveal(p, { from: Vector3 | 'random', soft .15 }) grows the dots in (p 0..1; pure), .setIntensity(i), .setColor(c),
// .count, .points. Order for reveal: distance from `from` (default: the first point), or the seeded random order.
export function surfaceDots(points, o = {}) {
  const n = points.length, size = o.size ?? 0.006, lift = o.lift ?? size * 0.35;
  const geo = new THREE.CircleGeometry(0.5, 10);
  const col = C(o.color ?? accentDefault()).multiplyScalar(o.intensity ?? 5);
  const m = new THREE.MeshBasicMaterial({ color: col, toneMapped: false, transparent: (o.opacity ?? 1) < 1, opacity: o.opacity ?? 1, side: THREE.DoubleSide, depthWrite: (o.opacity ?? 1) >= 1, fog: o.fog ?? true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const order = new Float32Array(n);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uReveal = m.userData.uReveal; sh.uniforms.uSoft = m.userData.uSoft;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aOrder; uniform float uReveal, uSoft;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat kRev = clamp((uReveal * (1.0 + uSoft) - aOrder) / max(uSoft, 1e-4), 0.0, 1.0); transformed *= kRev * kRev * (3.0 - 2.0 * kRev);');
  };
  m.userData.uReveal = { value: 1 }; m.userData.uSoft = { value: 0.15 };
  m.customProgramCacheKey = () => 'surfaceDots';
  const mesh = new THREE.InstancedMesh(geo, m, Math.max(1, n));
  mesh.count = n; mesh.frustumCulled = false; mesh.castShadow = mesh.receiveShadow = false;
  const q = new THREE.Quaternion(), z = new THREE.Vector3(0, 0, 1), M = new THREE.Matrix4(), S = new THREE.Vector3(size, size, size), P = new THREE.Vector3();
  const pts = points.map((p) => (p.isVector3 ? { position: p, normal: new THREE.Vector3(0, 0, 1) } : p));
  pts.forEach((p, i) => { q.setFromUnitVectors(z, p.normal); P.copy(p.position).addScaledVector(p.normal, lift); M.compose(P, q, S); mesh.setMatrixAt(i, M); });
  mesh.instanceMatrix.needsUpdate = true;
  const setOrder = (from) => {
    if (from === 'random') { const R = rng(o.seed ?? 5); for (let i = 0; i < n; i++) order[i] = R(); }
    else { const f = from?.isVector3 ? from : pts[0]?.position || new THREE.Vector3(); let mx = 1e-9; for (let i = 0; i < n; i++) { order[i] = pts[i].position.distanceTo(f); mx = Math.max(mx, order[i]); } for (let i = 0; i < n; i++) order[i] /= mx; }
  };
  setOrder(o.from);
  geo.setAttribute('aOrder', new THREE.InstancedBufferAttribute(order, 1));
  let lastFrom = o.from;
  mesh.reveal = (p, { from, soft } = {}) => {
    if (from !== undefined && from !== lastFrom) { setOrder(from); geo.attributes.aOrder.needsUpdate = true; lastFrom = from; }
    m.userData.uReveal.value = clamp(p); if (soft != null) m.userData.uSoft.value = soft;
  };
  mesh.setIntensity = (i) => m.color.copy(C(o.color ?? accentDefault()).multiplyScalar(i));
  mesh.setColor = (c, i = o.intensity ?? 5) => m.color.copy(C(c).multiplyScalar(i));
  mesh.points = pts;
  return mesh;
}
