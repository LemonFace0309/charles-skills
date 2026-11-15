// 3D type: real glyph outlines from Inter (700, 800) and Barlow Condensed (700), extruded with a rounded bevel,
// kerned with the fonts' own GPOS pairs, with tabular figures for counters. Every letter is its own mesh, so words
// can reveal letter by letter. Fonts are typeface JSONs in kit/fonts/ (converted from the OFL fonts, licences next to
// them), loaded once when the kit starts, so extrude() is synchronous like the other props.
//
//   const n = k.props.extrude('200,000', { size: 0.6, material: 'metal' });   // size = cap height in world units
//   scene.add(n);
//   return (t, ft) => n.reveal(k.ramp(t, t0, t0 + 0.8));                       // letters rise in with a stagger
//
// Counting numbers: n.setText(fmtNum(v(ft)), ...) from the frame time ft (not t), so the digits stay crisp under
// motion blur; pass tabular: true so they do not jitter as they change. setText reuses cached glyph geometry.
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { accentDefault, theme } from '../look.js';
import { clamp, easeFn, hash1 } from '../util.js';
import { withAnchors } from './base.js';

// ---------- fonts ----------
const FILES = { 'inter-700': 'Inter-700.typeface.json', 'inter-800': 'Inter-800.typeface.json', 'condensed-700': 'BarlowCondensed-700.typeface.json' };
const FACES = {};
const fontURL = (f) => new URL('../../fonts/' + f, import.meta.url).href;
async function loadFaces() {
  if (typeof document === 'undefined' || typeof fetch !== 'function') return;
  await Promise.all(Object.entries(FILES).map(async ([key, file]) => {
    try {
      const r = await fetch(fontURL(file));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      FACES[key] = { key, json: j, upm: j.unitsPerEm, cap: j.capHeight, xh: j.xHeight, asc: j.ascender, desc: j.descender, glyphs: j.glyphs, tnum: j.tnum || {}, kern: j.kern || {}, shapes: new Map(), geos: new Map(), outlines: new Map() };
    } catch (e) { console.error(`type.js: cannot load fonts/${file}: ${e.message}`); }
  }));
}
await loadFaces();

// The face for a family and weight: font 'inter' (700 | 800) or 'condensed' (Barlow Condensed 700).
export function typeface(font = 'inter', weight = 800) {
  const fam = /cond|barlow/i.test(font) ? 'condensed' : 'inter';
  const have = Object.keys(FACES).filter((k) => k.startsWith(fam + '-')).map((k) => +k.split('-')[1]);
  if (!have.length) throw new Error(`type: font "${font}" is not loaded (kit/fonts/*.typeface.json missing?)`);
  const w = have.reduce((a, b) => (Math.abs(b - weight) < Math.abs(a - weight) ? b : a));
  return FACES[`${fam}-${w}`];
}

// Canonical glyph space: cap height = 100 units (geometry is cached there and scaled per letter).
const CAP = 100;
// Arrows the Latin subsets lack, made by turning the font's own up arrow (same weight and head shape).
const TURNED = { '\u2192': ['\u2191', -1], '\u2190': ['\u2191', 1] };
function turnedGlyph(face, ch) {
  const [srcCh, dir] = TURNED[ch] || [];
  const src = srcCh && face.glyphs[srcCh];
  if (!src || !src.o) return null;
  const t = src.o.split(' ');
  let ymin = Infinity, ymax = -Infinity;
  for (let i = 0; i < t.length;) { const a = t[i++]; const n = a === 'm' || a === 'l' ? 1 : a === 'q' ? 2 : a === 'b' ? 3 : 0; for (let j = 0; j < n; j++) { const y = +t[i + 1]; ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); i += 2; } }
  const cx = (src.x_min + src.x_max) / 2, cy = (ymin + ymax) / 2, ty = face.cap * 0.5, lsb = src.x_min, len = ymax - ymin;
  const out = [];
  for (let i = 0; i < t.length;) {
    const a = t[i++]; out.push(a);
    const n = a === 'm' || a === 'l' ? 1 : a === 'q' ? 2 : a === 'b' ? 3 : 0;
    for (let j = 0; j < n; j++) { const x = +t[i++] - cx, y = +t[i++] - cy; out.push(Math.round(-dir * y + lsb + len / 2), Math.round(dir * x + ty)); }
  }
  return { ha: Math.round(len + 2 * lsb), x_min: Math.round(lsb), x_max: Math.round(lsb + len), o: out.join(' ') };
}
const warned = new Set();
function glyphShapes(face, ch, tab) {
  const key = (tab ? 'T' : 'P') + ch;
  let s = face.shapes.get(key);
  if (s) return s;
  if (!face.glyphs[ch] && TURNED[ch]) { const tg = turnedGlyph(face, ch); if (tg) face.glyphs[ch] = tg; }
  if (!face.glyphs[ch] && !/\s/.test(ch) && !warned.has(face.key + ch)) { warned.add(face.key + ch); console.warn(`type: "${ch}" (U+${ch.codePointAt(0).toString(16).toUpperCase()}) is not in ${face.key}; drawn as "?"`); }
  const gl = (tab && face.tnum[ch]) || face.glyphs[ch] || face.glyphs['?'];
  const c = CAP / face.cap;
  const path = new THREE.ShapePath();
  const o = gl.o ? gl.o.split(' ') : [];
  for (let i = 0; i < o.length;) {
    const a = o[i++];
    if (a === 'm') { const x = +o[i++] * c, y = +o[i++] * c; path.moveTo(x, y); }
    else if (a === 'l') { const x = +o[i++] * c, y = +o[i++] * c; path.lineTo(x, y); }
    else if (a === 'q') { const x = +o[i++] * c, y = +o[i++] * c, cx = +o[i++] * c, cy = +o[i++] * c; path.quadraticCurveTo(cx, cy, x, y); }
    else if (a === 'b') { const x = +o[i++] * c, y = +o[i++] * c, ax = +o[i++] * c, ay = +o[i++] * c, bx = +o[i++] * c, by = +o[i++] * c; path.bezierCurveTo(ax, ay, bx, by, x, y); }
  }
  const shapes = path.toShapes();
  let ymin = Infinity, ymax = -Infinity;
  for (const sh of shapes) for (const p of sh.getPoints(4)) { ymin = Math.min(ymin, p.y); ymax = Math.max(ymax, p.y); }
  s = { shapes, adv: gl.ha * c, xmin: gl.x_min * c, xmax: gl.x_max * c, ymin: shapes.length ? ymin : 0, ymax: shapes.length ? ymax : 0, tab: !!(tab && face.tnum[ch]) };
  face.shapes.set(key, s);
  return s;
}

// Smooth normals across bevel steps and along curves, crisp at real corners; the first capCount vertices (an
// ExtrudeGeometry's caps, group 0) stay perfectly flat. For any non-indexed geometry; positions are hashed at 1/256
// of a unit, so build small things at a larger scale and scale the mesh. (three's toCreasedNormals hashes to 0.01
// units and averages unweighted, which breaks on small bevels.)
export function bevelNormals(geo, angle = 40, capCount = 0) {
  if (geo.index) geo = geo.toNonIndexed();
  const P = geo.attributes.position.array, n = P.length / 3, N = new Float32Array(n * 3);
  // face normals, unnormalised (their length is twice the triangle's area, so the average is area weighted)
  const tri = n / 3, fx = new Float32Array(tri), fy = new Float32Array(tri), fz = new Float32Array(tri), fl = new Float32Array(tri);
  for (let t = 0; t < tri; t++) {
    const a = t * 9;
    const ux = P[a + 3] - P[a], uy = P[a + 4] - P[a + 1], uz = P[a + 5] - P[a + 2], vx = P[a + 6] - P[a], vy = P[a + 7] - P[a + 1], vz = P[a + 8] - P[a + 2];
    const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
    fx[t] = x; fy[t] = y; fz[t] = z; fl[t] = Math.hypot(x, y, z) || 1e-12;
  }
  const map = new Map(), q = (v) => Math.round(v * 256);
  for (let i = 0; i < n; i++) { const k = q(P[i * 3]) + ',' + q(P[i * 3 + 1]) + ',' + q(P[i * 3 + 2]); let l = map.get(k); if (!l) map.set(k, (l = [])); l.push(i); }
  const cosA = Math.cos((angle * Math.PI) / 180);
  for (const list of map.values()) {
    for (const i of list) {
      const t = (i / 3) | 0;
      if (i < capCount) { N[i * 3 + 2] = fz[t] >= 0 ? 1 : -1; continue; }
      let x = 0, y = 0, z = 0;
      const ax = fx[t] / fl[t], ay = fy[t] / fl[t], az = fz[t] / fl[t];
      for (const j of list) {
        const u = (j / 3) | 0;
        if ((fx[u] * ax + fy[u] * ay + fz[u] * az) / fl[u] < cosA) continue;
        x += fx[u]; y += fy[u]; z += fz[u];
      }
      const l = Math.hypot(x, y, z) || 1;
      N[i * 3] = x / l; N[i * 3 + 1] = y / l; N[i * 3 + 2] = z / l;
    }
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  return geo;
}

// A glyph's geometry in canonical units: z from -d/2 (back) to +d/2 (front face). d = 0: flat, facing +z.
// Groups: 0 = front and back faces, 1 = bevel and sides.
function glyphGeometry(face, ch, tab, d, b, segs, curve) {
  const key = `${tab ? 'T' : 'P'}${ch}|${d.toFixed(2)}|${b.toFixed(2)}|${segs}|${curve}`;
  if (face.geos.has(key)) return face.geos.get(key);
  const { shapes } = glyphShapes(face, ch, tab);
  let geo = null;
  if (shapes.length && d <= 0) geo = new THREE.ShapeGeometry(shapes, curve);
  else if (shapes.length) {
    b = Math.min(b, d * 0.45);
    const depth = Math.max(0.01, d - 2 * b);
    geo = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: b > 0 ? segs : 1, curveSegments: curve, steps: 1 });
    geo.translate(0, 0, -depth / 2);
    bevelNormals(geo, 40, geo.groups[0]?.count ?? 0);
    // world-ish uvs: 1 unit per cap height on the faces, around the sides (brushed and bump textures follow them)
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / CAP, uv.getY(i) / CAP);
  }
  if (geo) geo.userData.shared = true; // a module cache: other shots reuse it (seq.js leaves shared resources alone)
  face.geos.set(key, geo);
  return geo;
}

// A glyph's contours as line geometries on its front face (the 'draw' reveal traces them like a neon tube).
function glyphOutlines(face, ch, tab, z, curve) {
  const key = `${tab ? 'T' : 'P'}${ch}|${z.toFixed(2)}|${curve}`;
  if (face.outlines.has(key)) return face.outlines.get(key);
  const { shapes } = glyphShapes(face, ch, tab);
  const out = [];
  for (const sh of shapes) for (const path of [sh, ...sh.holes]) {
    const pts = path.getPoints(curve);
    if (pts.length < 2) continue;
    if (!pts[0].equals(pts[pts.length - 1])) pts.push(pts[0].clone());
    const geo = new LineGeometry(); geo.setPositions(pts.flatMap((p) => [p.x, p.y, z]));
    geo.userData.shared = true;
    out.push({ geo, segs: pts.length - 1 });
  }
  face.outlines.set(key, out);
  return out;
}

// ---------- materials ----------
const C = (c) => (c && c.isColor ? c.clone() : new THREE.Color(c));
const shade = (c, k) => '#' + C(c).multiplyScalar(k).getHexString();
let brushedTex = null;
function brushedMap() {
  if (brushedTex || typeof document === 'undefined') return brushedTex;
  const W = 512, H = 512, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const row = hash1(y * 7.31) * 0.6 + hash1(Math.floor(y / 3) * 3.7) * 0.4; // streaks along x
    for (let x = 0; x < W; x++) { const v = 150 + (row - 0.5) * 90 + (hash1(x * 0.37 + y * 91.7) - 0.5) * 18; const i = (y * W + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.max(0, Math.min(255, v)); img.data[i + 3] = 255; }
  }
  g.putImageData(img, 0, 0);
  brushedTex = new THREE.CanvasTexture(cv); brushedTex.wrapS = brushedTex.wrapT = THREE.RepeatWrapping; brushedTex.repeat.set(1.5, 1.5); brushedTex.anisotropy = 8; brushedTex.userData.shared = true;
  return brushedTex;
}
const phys = (o) => new THREE.MeshPhysicalMaterial(o);

// A studio reflection map for type, tinted by the palette: a big soft box above and in front, a soft horizon band
// and coloured side strips. A polished face that points at the camera reflects what is behind the camera, which in a
// night world is black; this gives faces a long top-to-bottom gradient and bevels bright, coloured rims, whatever
// the scene's own environment is. Equirectangular float data (three prefilters it), cached per palette.
const envCache = new Map();
export function typeEnv(pal = theme.pal) {
  const key = pal?.name || 'default';
  if (envCache.has(key)) return envCache.get(key);
  const lin = (c) => C(c);
  const bgT = lin(pal?.bg?.[0] ?? '#0d1626'), bgB = lin(pal?.bg?.[1] ?? '#04060b');
  const keyC = lin(pal?.key?.[0] ?? '#ffd9a6'), rimC = lin(pal?.rim?.[0] ?? '#6fa8ff');
  const white = new THREE.Color(1, 1, 1), top = white.clone().lerp(rimC, 0.3), warm = white.clone().lerp(keyC, 0.55), cool = white.clone().lerp(rimC, 0.6);
  const w = 512, h = 256, data = new Float32Array(w * h * 4);
  const sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  // soft rectangle in (azimuth, elevation) degrees
  const box = (az, el, az0, az1, el0, el1, f) => { const da = ((az - az0 + 540) % 360) - 180, db = ((az - az1 + 540) % 360) - 180; return sm(-f, f, da) * (1 - sm(-f, f, db)) * sm(el0 - f, el0 + f, el) * (1 - sm(el1 - f, el1 + f, el)); };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = (x + 0.5) / w, v = (y + 0.5) / h;
    const az = (u - 0.75) * 360, el = (v - 0.5) * 180;        // az 0 = +z (towards the camera side), el 90 = up
    const sky = el > 0 ? bgB.clone().lerp(bgT, sm(0, 70, el)).multiplyScalar(0.9) : bgB.clone().multiplyScalar(0.22);
    const c = sky;
    c.add(top.clone().multiplyScalar(3.2 * box(az, el, -42, 42, 32, 74, 10)));             // soft box above, in front
    c.add(white.clone().multiplyScalar(1.1 * box(az, el, -70, 70, 3, 9, 5)));               // horizon band
    const ramp = sm(-26, 1, el);
    c.add(warm.clone().lerp(white, 0.5).multiplyScalar(0.75 * box(az, el, -55, 55, -40, 2, 10) * (0.18 + 0.82 * ramp * ramp))); // low front card: faces read light, brighter at the top
    c.add(warm.clone().multiplyScalar(2.4 * box(az, el, 58, 78, -6, 52, 6)));               // warm strip, right
    c.add(cool.clone().multiplyScalar(2.0 * box(az, el, -78, -60, -6, 52, 6)));             // cool strip, left
    c.add(cool.clone().multiplyScalar(1.4 * box(az, el, 150, 210, 10, 40, 12)));            // back light (rims seen from behind)
    const i = (y * w + x) * 4; data[i] = c.r; data[i + 1] = c.g; data[i + 2] = c.b; data[i + 3] = 1;
  }
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.FloatType);
  t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.LinearSRGBColorSpace;
  t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true; t.userData.shared = true;
  envCache.set(key, t);
  return t;
}

// Material presets for letters: { face, side } (face = front and back caps, side = bevel and walls).
// Two roughness levels on every preset: a sharper face and a softer, brushed side (look.md section 5).
export const TYPE_MATERIALS = ['metal', 'chrome', 'brushed', 'emissive', 'lit', 'glass', 'frosted', 'plastic', 'ceramic', 'ink'];
function typeMaterials(kind, o) {
  const acc = o.accent ?? accentDefault();
  const env = o.envIntensity ?? 1.2;
  switch (kind) {
    case 'chrome': { const c = o.color ?? '#e8ebf0'; return { face: phys({ color: C(c), metalness: 1, roughness: o.rough ?? 0.06, envMapIntensity: env * 1.2 }), side: phys({ color: C(o.sideColor ?? c), metalness: 1, roughness: 0.16, envMapIntensity: env }) }; }
    case 'brushed': { const c = o.color ?? '#cfd3da'; return { face: phys({ color: C(c), metalness: 1, roughness: o.rough ?? 0.34, anisotropy: 0.75, anisotropyMap: null, bumpMap: brushedMap(), bumpScale: 0.25, envMapIntensity: env }), side: phys({ color: C(o.sideColor ?? shade(c, 0.85)), metalness: 1, roughness: 0.26, envMapIntensity: env }) }; }
    case 'emissive': { // channel letters: a glowing face in a dark brushed-metal return
      const c = o.color ?? acc;
      return { face: new THREE.MeshBasicMaterial({ color: C(c).multiplyScalar(o.intensity ?? 4), toneMapped: false }), side: phys({ color: C(o.sideColor ?? '#2a2e35'), metalness: 1, roughness: 0.34, anisotropy: 0.5, envMapIntensity: env }), emissive: true, base: C(c), intensity: o.intensity ?? 4 };
    }
    case 'lit': { // frosted acrylic lit from inside: a soft glow that still takes light
      const c = o.color ?? acc;
      return { face: phys({ color: C(c), roughness: o.rough ?? 0.42, metalness: 0, emissive: C(c), emissiveIntensity: o.intensity ?? 1.6, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: env }), side: phys({ color: C(shade(c, 0.7)), roughness: 0.55, metalness: 0, emissive: C(c), emissiveIntensity: (o.intensity ?? 1.6) * 0.55, clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: env }), lit: true, base: C(c), intensity: o.intensity ?? 1.6 };
    }
    case 'glass': { // clear glass: reads through its reflections and what is behind it; best over a lit backdrop
      const c = o.color ?? '#eef4ff';
      const m = phys({ color: C(c), metalness: 0, roughness: o.rough ?? 0.05, transmission: 1, thickness: o.thickness ?? 0.5, ior: 1.5, attenuationColor: C(o.tint ?? c), attenuationDistance: o.attenuation ?? 1.5, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: env * 1.6, specularIntensity: 1, dispersion: o.dispersion ?? 0.4 });
      return { face: m, side: m, glass: true };
    }
    case 'frosted': { // frosted acrylic with a little light inside, so it reads in a dark world (glow: 0 for none)
      const c = o.color ?? '#dfe8f5', gc = C(o.glowColor ?? c), gi = o.glow ?? 0.22;
      const m = phys({ color: C(c), metalness: 0, roughness: o.rough ?? 0.38, transmission: 1, thickness: o.thickness ?? 0.5, ior: 1.42, envMapIntensity: env * 1.15, emissive: gc, emissiveIntensity: gi });
      return { face: m, side: phys({ color: C(c), metalness: 0, roughness: 0.24, transmission: 1, thickness: o.thickness ?? 0.5, ior: 1.42, envMapIntensity: env * 1.15, emissive: gc, emissiveIntensity: gi * 0.7 }), glass: true };
    }
    case 'plastic': { const c = o.color ?? acc; return { face: phys({ color: C(c), roughness: o.rough ?? 0.4, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: env }), side: phys({ color: C(o.sideColor ?? c), roughness: 0.55, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.3, envMapIntensity: env }) }; }
    case 'ceramic': { const c = o.color ?? '#f1efe9'; return { face: phys({ color: C(c), roughness: o.rough ?? 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, sheen: 0.2, envMapIntensity: env }), side: phys({ color: C(o.sideColor ?? shade(c, 0.92)), roughness: 0.45, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.15, envMapIntensity: env }) }; }
    case 'ink': { const m = new THREE.MeshBasicMaterial({ color: C(o.color ?? '#ffffff').multiplyScalar(o.intensity ?? 0.9), toneMapped: false, transparent: (o.opacity ?? 1) < 1, opacity: o.opacity ?? 1, depthWrite: (o.opacity ?? 1) >= 1, fog: o.fog ?? true }); return { face: m, side: m, emissive: true, base: C(o.color ?? '#ffffff'), intensity: o.intensity ?? 0.9, ink: true }; }
    case 'metal': default: {
      const c = o.color ?? '#e2e5ea';
      return { face: phys({ color: C(c), metalness: 1, roughness: o.rough ?? 0.13, envMapIntensity: env }), side: phys({ color: C(o.sideColor ?? shade(c, 0.86)), metalness: 1, roughness: 0.4, anisotropy: 0.7, envMapIntensity: env }) };
    }
  }
}

// Letter clipping for the masked rise: fragments outside two planes (in the letter's own space) are dropped, and
// back faces seen through the cut are drawn as a flat dark section, so a letter rising through the mask reads solid.
const CLIP_KEY = 'charles-type-clip-1';
function clipInject(m, U, { cut = true } = {}) {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.uClipLo = U.lo; sh.uniforms.uClipHi = U.hi; sh.uniforms.uCut = U.cut;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vClipL;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvClipL = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vClipL; uniform vec4 uClipLo; uniform vec4 uClipHi; uniform vec3 uCut;')
      .replace(/void main\(\) \{/, 'void main() {\nif (dot(vec4(vClipL, 1.0), uClipLo) < 0.0 || dot(vec4(vClipL, 1.0), uClipHi) < 0.0) discard;');
    if (cut) sh.fragmentShader = sh.fragmentShader.replace(/\}\s*$/, 'if (!gl_FrontFacing) gl_FragColor = vec4(uCut, 1.0);\n}');
  };
  m.customProgramCacheKey = () => CLIP_KEY + (cut ? 'c' : '') + (prev ? 'p' : '');
  return m;
}

// ---------- extrude ----------
// extrude(text, { size, depth, bevel, weight, font, material, color, align, ... }) -> Group of letter meshes.
export function extrude(text = '', o = {}) {
  const {
    size = 0.5, weight = 800, font = 'inter', align = 'center', valign = 'middle', tracking = null, lineHeight = 1.08,
    tabular = false, unit = null, unitScale = 0.4, unitGap = 0.1, bevelSegments = 4, curveSegments = 8,
    reveal: style = 'rise', stagger = null, ease = 'outCubic', order = 'start', shadows = true,
  } = o;
  const face = typeface(font, weight);
  const depth = o.depth ?? size * 0.3, flat = depth <= 0;
  const bevel = flat ? 0 : Math.min(o.bevel ?? size * 0.045, depth * 0.45);
  const track = tracking ?? (/cond/.test(face.key) ? 0 : -0.01);
  const s = size / CAP;                                  // canonical -> world
  const d = (depth / size) * CAP, b = (bevel / size) * CAP;
  const kind = typeof o.material === 'string' ? o.material : (flat ? 'ink' : 'metal');
  // glass thickness is in the letter's own (canonical) units
  const M = o.material && typeof o.material === 'object' ? (o.material.isMaterial ? { face: o.material, side: o.material } : { ...o.material, side: o.material.side ?? o.material.face }) : typeMaterials(kind, { ...o, thickness: o.thickness != null ? o.thickness / s : Math.max(d, 8) });
  // reflections: the type studio (default) or the scene's environment (reflect: 'scene')
  if (o.reflect !== 'scene') for (const m of [M.face, M.side]) if (m?.isMeshStandardMaterial && !m.envMap) m.envMap = typeEnv();
  const em = (face.upm * CAP) / face.cap;                // 1 em in canonical units
  const g = new THREE.Group();
  g.name = 'extrude';
  g.letters = [];
  const pool = [];
  const cutCol = C(M.side.color ?? '#202228').multiplyScalar(0.12);

  function letterMesh() {
    const U = { lo: { value: new THREE.Vector4(0, 0, 0, 1) }, hi: { value: new THREE.Vector4(0, 0, 0, 1) }, cut: { value: cutCol } };
    const solid = !flat && !M.glass;   // solid letters show a dark section where the mask cuts them
    const fm = M.face.clone(), sm = M.side.clone();
    for (const m of [fm, sm]) { if (solid) { m.side = THREE.DoubleSide; m.shadowSide = THREE.BackSide; } clipInject(m, U, { cut: solid }); }
    const mesh = new THREE.Mesh(undefined, flat ? fm : [fm, sm]);
    mesh.castShadow = shadows && !flat && !M.ink; mesh.receiveShadow = !flat && !M.emissive;
    mesh.customDepthMaterial = clipInject(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), U, { cut: false });
    mesh.userData.U = U; mesh.userData.mats = [fm, sm];
    const ol = new THREE.Group(); ol.visible = false; mesh.add(ol);
    const olMat = new LineMaterial({ color: C(o.lineColor ?? M.base ?? accentDefault()).multiplyScalar(o.lineIntensity ?? 5), linewidth: size * 0.022, worldUnits: true, transparent: true, depthWrite: false, toneMapped: false, fog: false });
    olMat.resolution.set(1080, 1920);
    mesh.userData.outline = ol; mesh.userData.olMat = olMat;
    return mesh;
  }

  // ---- layout ----
  const fixMinus = (str) => String(str).replace(/(^|[\s(])-(?=[\d.])/g, '$1−');
  let items = [], box = { x0: 0, x1: 0, y0: 0, y1: 0 }, lastRevealArgs = null;
  function layout(str, unitStr) {
    const lines = fixMinus(str).split('\n');
    const out = [];
    lines.forEach((line, li) => {
      const chars = Array.from(line);
      let x = 0, prev = null, prevTab = false, ink0 = Infinity, ink1 = -Infinity;
      const row = [];
      const add = (ch, k) => {
        const tab = tabular && !!face.tnum[ch];
        if (prev != null && !(tab && prevTab)) x += (face.kern[prev + ch] || 0) * (CAP / face.cap) * k;
        const gs = glyphShapes(face, ch, tab);
        row.push({ ch, tab, x, y: -li * lineHeight * em, k, gs });
        if (gs.shapes.length) { ink0 = Math.min(ink0, x + gs.xmin * k); ink1 = Math.max(ink1, x + gs.xmax * k); }
        x += gs.adv * k + track * em * k;
        prev = ch; prevTab = tab;
      };
      for (const ch of chars) add(ch, 1);
      if (unitStr && li === lines.length - 1) { x += unitGap * em - track * em; prev = null; for (const ch of Array.from(fixMinus(unitStr))) add(ch, unitScale); }
      if (!isFinite(ink0)) { ink0 = 0; ink1 = 0; }
      const w = ink1 - ink0, off = align === 'left' ? -ink0 : align === 'right' ? -ink1 : -(ink0 + w / 2);
      for (const it of row) { it.x += off; out.push(it); }
    });
    // vertical: middle = centre of the cap height block
    const top = 0 + CAP, bottom = -(lines.length - 1) * lineHeight * em;
    const dy = valign === 'baseline' ? 0 : valign === 'top' ? -top : valign === 'bottom' ? -bottom : -(top + bottom) / 2;
    for (const it of out) it.y += dy;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const it of out) { if (!it.gs.shapes.length) continue; x0 = Math.min(x0, it.x + it.gs.xmin * it.k); x1 = Math.max(x1, it.x + it.gs.xmax * it.k); y0 = Math.min(y0, it.y + it.gs.ymin * it.k); y1 = Math.max(y1, it.y + it.gs.ymax * it.k); }
    if (!isFinite(x0)) { x0 = x1 = y0 = y1 = 0; }
    return { items: out, box: { x0: x0 * s, x1: x1 * s, y0: y0 * s, y1: y1 * s, cap0: (bottom + dy) * s, cap1: (top + dy) * s } };
  }

  // anchors (positions follow the layout)
  const anchors = {};
  for (const n of ['center', 'top', 'bottom', 'left', 'right', 'baseline', 'front']) { const a = new THREE.Object3D(); a.name = n; g.add(a); anchors[n] = a; }
  withAnchors(g, anchors);

  function place() {
    const B = box, cx = (B.x0 + B.x1) / 2, cy = (B.cap0 + B.cap1) / 2, dd = (d * s) / 2;
    g.anchors.center.position.set(cx, cy, 0);
    g.anchors.front.position.set(cx, cy, dd);
    g.anchors.top.position.set(cx, B.y1 + size * 0.25, 0);
    g.anchors.bottom.position.set(cx, B.y0 - size * 0.25, 0);
    g.anchors.left.position.set(B.x0 - size * 0.15, cy, 0);
    g.anchors.right.position.set(B.x1 + size * 0.15, cy, 0);
    g.anchors.baseline.position.set(cx, B.cap0, 0);
    const w = B.x1 - B.x0, h = B.y1 - B.y0;
    g.userData.size = [w, h, d * s];
    g.userData.radius = 0.5 * Math.hypot(w, h, d * s);
    g.userData.box = { ...B };
    g.width = w; g.height = h;
  }

  function setText(str, unitStr = unit) {
    str = String(str);
    if (str === g.text && unitStr === g.unit) return g;
    g.text = str; g.unit = unitStr;
    const L = layout(str, unitStr);
    items = L.items.filter((it) => it.gs.shapes.length);
    box = L.box;
    while (pool.length < items.length) { const m = letterMesh(); pool.push(m); g.add(m); }
    g.letters = [];
    pool.forEach((m, i) => {
      const it = items[i];
      if (!it) { m.visible = false; return; }
      m.geometry = glyphGeometry(face, it.ch, it.tab, d, b, bevelSegments, curveSegments);
      m.visible = true;
      const k = s * it.k;
      m.userData.home = new THREE.Vector3(it.x * s, it.y * s, 0);
      m.userData.base = it.y * s;                     // this letter's line baseline (masks are per line)
      m.userData.k = k;
      m.userData.pivot = new THREE.Vector3(((it.gs.xmin + it.gs.xmax) / 2) * k, ((it.gs.ymin + it.gs.ymax) / 2) * k, 0);
      m.userData.ch = it.ch; m.userData.tab = it.tab;
      m.userData.ylo = it.gs.ymin * k; m.userData.yhi = it.gs.ymax * k;
      m.position.copy(m.userData.home); m.quaternion.identity(); m.scale.setScalar(k);
      g.letters.push(m);
    });
    place();
    if (lastRevealArgs) g.reveal(...lastRevealArgs);
    return g;
  }

  // ---- reveal ----
  const perms = new Map();
  const perm = (n) => { if (!perms.has(n)) perms.set(n, [...Array(n).keys()].sort((a, b) => hash1(a * 7.31 + n) - hash1(b * 7.31 + n))); return perms.get(n); };
  const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _e = new THREE.Euler();
  const OPEN = new THREE.Vector4(0, 0, 0, 1);
  const setClip = (m, lo, hi) => {
    // planes in group space -> the letter's own space (row 1 of its matrix gives its group-space y)
    m.updateMatrix(); const e = m.matrix.elements;
    const U = m.userData.U;
    if (lo == null) U.lo.value.copy(OPEN); else U.lo.value.set(e[1], e[5], e[9], e[13] - lo);
    if (hi == null) U.hi.value.copy(OPEN); else U.hi.value.set(-e[1], -e[5], -e[9], hi - e[13]);
  };
  // the letter's contour lines, built the first time a 'draw' reveal needs them (cached per glyph)
  const ensureOutline = (m) => {
    const key = (m.userData.tab ? 'T' : 'P') + m.userData.ch;
    if (m.userData.olKey === key) return;
    const ol = m.userData.outline;
    while (ol.children.length) ol.remove(ol.children[0]);
    for (const { geo, segs } of glyphOutlines(face, m.userData.ch, m.userData.tab, flat ? 0.4 : d / 2 + 0.4, curveSegments)) {
      const L = new Line2(geo, m.userData.olMat); L.userData.segs = segs; L.renderOrder = 3; ol.add(L);
    }
    m.userData.olKey = key;
  };
  // p 0..1 over the whole word; each letter takes `span` of it, starting `stagger` apart.
  g.reveal = (p, st = style) => {
    lastRevealArgs = [p, st];
    const n = g.letters.length;
    const stg = stagger ?? Math.min(0.12, 0.6 / Math.max(1, n - 1));
    const span = Math.max(0.05, 1 - stg * (n - 1));
    const E = easeFn(ease);
    g.letters.forEach((m, i) => {
      const idx = order === 'end' ? n - 1 - i : order === 'center' ? Math.abs(i - (n - 1) / 2) * 2 : order === 'random' ? perm(n)[i] : i;
      const raw = clamp((p - idx * stg) / span);
      const u = E(raw);
      const H = m.userData.home, k = m.userData.k, P = m.userData.pivot;
      m.visible = true;
      m.quaternion.identity(); m.scale.setScalar(k); m.position.copy(H);
      let lo = null, hi = null;
      // travel far enough that ascenders ($, d, l) and descenders (, g y) start fully behind the mask
      if (st === 'rise') { m.position.y = H.y - (1 - u) * size * 1.55; lo = m.userData.base - size * 0.32; m.visible = raw > 0; }
      else if (st === 'drop') { m.position.y = H.y + (1 - u) * size * 1.75; hi = m.userData.base + size * 1.32; m.visible = raw > 0; }
      else if (st === 'flip') {
        _q.setFromEuler(_e.set((-Math.PI / 2) * (1 - u), 0, 0)); m.quaternion.copy(_q);
        // rotate about the letter's baseline point under its centre
        _v.set(P.x, 0, 0); const r = _v.clone().applyQuaternion(_q); m.position.set(H.x + _v.x - r.x, H.y + _v.y - r.y, H.z + _v.z - r.z);
        m.visible = raw > 0;
      } else if (st === 'pop') {
        const sc = Math.max(1e-4, u); m.scale.setScalar(k * sc);
        m.position.set(H.x + P.x * (1 - sc), H.y + P.y * (1 - sc), H.z); m.visible = raw > 0;
      } else if (st === 'draw') {
        // the outline traces on (first 60%), then the letter fills with light from the bottom up, and the outline fades
        ensureOutline(m);
        const tl = easeFn('inOutSine')(clamp(raw / 0.6)), fl = clamp((raw - 0.35) / 0.65), fe = easeFn('inOutCubic')(fl);
        const ol = m.userData.outline;
        ol.visible = raw > 0 && fl < 1;
        for (const L of ol.children) L.geometry.instanceCount = Math.max(0, Math.round(tl * L.userData.segs));
        m.userData.olMat.opacity = 1 - clamp((fl - 0.6) / 0.4);
        const y0 = m.userData.base + m.userData.ylo, y1 = m.userData.base + m.userData.yhi;   // the glyph's ink, bottom to top
        hi = fl <= 0 ? y0 - size : y0 - size * 0.05 + (y1 - y0 + size * 0.1) * fe;
        if (M.emissive || M.lit) paint(m, fe * (1 + 0.25 * Math.sin(Math.PI * fl)));
        m.visible = raw > 0;
      } else if (st === 'glow') {
        // the letter switches on: a short overshoot, then its resting glow (non-glowing presets pop instead)
        if (M.emissive || M.lit) paint(m, clamp(raw * 1.4) * (1 + 0.35 * Math.sin(Math.PI * clamp(raw * 1.4))));
        else { const sc = Math.max(1e-4, u); m.scale.setScalar(k * sc); m.position.set(H.x + P.x * (1 - sc), H.y + P.y * (1 - sc), H.z); m.visible = raw > 0; }
      }
      if (st !== 'glow' && st !== 'draw') paint(m, 1);   // a style switch never leaves a letter half lit
      if (st !== 'draw' && m.userData.outline) m.userData.outline.visible = false;
      setClip(m, lo, hi);
    });
    return g;
  };
  // Lit and emissive presets: overall glow (0..1 of the preset intensity, can go above 1). Kept as a level that
  // reveal() multiplies, so either can be called first.
  let glowLevel = 1;
  const paint = (m, f) => {
    const [fm, sm] = m.userData.mats;
    if (M.emissive) fm.color.copy(M.base).multiplyScalar(M.intensity * f * glowLevel);
    else if (M.lit) { fm.emissiveIntensity = M.intensity * f * glowLevel; sm.emissiveIntensity = M.intensity * 0.55 * f * glowLevel; }
  };
  g.setGlow = (v) => {
    glowLevel = v;
    for (const m of pool) paint(m, 1);
    if (lastRevealArgs) g.reveal(...lastRevealArgs);
    return g;
  };
  g.setText = setText;
  g.materials = M;
  setText(text, unit);
  return g;
}

// Layout metrics without building geometry: width/height in world units of a string at a size (cap height).
export function measureText(text, { size = 0.5, font = 'inter', weight = 800, tracking = null, tabular = false } = {}) {
  const face = typeface(font, weight);
  const track = tracking ?? (/cond/.test(face.key) ? 0 : -0.01);
  const em = (face.upm * CAP) / face.cap;
  let x = 0, prev = null, ink0 = Infinity, ink1 = -Infinity;
  let prevTab = false;
  for (const ch of Array.from(String(text))) {
    const tab = tabular && !!face.tnum[ch];
    if (prev != null && !(tab && prevTab)) x += (face.kern[prev + ch] || 0) * (CAP / face.cap);
    const gs = glyphShapes(face, ch, tab);
    if (gs.shapes.length) { ink0 = Math.min(ink0, x + gs.xmin); ink1 = Math.max(ink1, x + gs.xmax); }
    x += gs.adv + track * em; prev = ch; prevTab = tab;
  }
  const s = size / CAP;
  return { width: isFinite(ink0) ? (ink1 - ink0) * s : 0, advance: x * s, em: em * s };
}
