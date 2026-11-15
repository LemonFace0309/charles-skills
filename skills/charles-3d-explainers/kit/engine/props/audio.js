// Audio props: a loudspeaker driver (with a product cutaway and a cone that moves), over-ear noise-cancelling
// headphones (microphones, drivers, an optional cutaway cup) and a studio condenser microphone. All procedural:
// revolved profiles with filleted edges, real proportions in millimetres, two or three roughness levels per prop,
// fine grain on large surfaces, so they read as product renders. (Generated GLBs were tried for headphones and
// microphones; they melt thin parts such as sliders, grilles and seams, and cannot move a cone. See models/NOTICE.md.)
//
// SCALE   Pass the natural size option (speakerDriver({ width }), headphones({ width }), microphone({ height })) or
//         perMetre (world units per real metre); REAL_AUDIO lists the real sizes.
// MOTION  Setters are pure: call push(x), setGlow(v), setMics(v) from update(t) every frame.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat, accentDefault } from '../look.js';
import { clamp, rng } from '../util.js';
import { withAnchors } from './base.js';
import { smoothNormals, modelMaterial } from './model.js';

const TAU = Math.PI * 2;
const C = (c) => (c && c.isColor ? c.clone() : new THREE.Color(c));
const deg = THREE.MathUtils.degToRad;
export const REAL_AUDIO = { speakerDriver: 0.13, headphones: 0.262, microphone: 0.185 };
const scaleOf = (o, key, real, def) => (o.perMetre != null ? o.perMetre : (o[key] ?? def) / real);

// ---------- geometry helpers ----------
// Round every corner of a closed polygon [[x, y], ...] with a quadratic fillet (rad: one radius or one per corner).
function roundPoly(pts, rad, segs = 4) {
  const out = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n], R = Array.isArray(rad) ? rad[i] ?? 0 : rad;
    if (!R) { out.push(p); continue; }
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]), t = Math.min(R, la / 2.05, lb / 2.05);
    const s = [p[0] + ((a[0] - p[0]) / la) * t, p[1] + ((a[1] - p[1]) / la) * t], e = [p[0] + ((b[0] - p[0]) / lb) * t, p[1] + ((b[1] - p[1]) / lb) * t];
    for (let j = 0; j <= segs; j++) { const u = j / segs; out.push([(1 - u) * (1 - u) * s[0] + 2 * u * (1 - u) * p[0] + u * u * e[0], (1 - u) * (1 - u) * s[1] + 2 * u * (1 - u) * p[1] + u * u * e[1]]); }
  }
  return out;
}
const signedArea = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
function flipFaces(g) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i)); return g; }
const only = (g, keep = ['position', 'normal', 'uv']) => { for (const k of Object.keys(g.attributes)) if (!keep.includes(k)) g.deleteAttribute(k); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g.index ? g : g.setIndex([...Array(g.attributes.position.count).keys()]); };
const merge = (list) => mergeGeometries(list.map((g) => only(g)), false);

// A solid of revolution about +y from a closed profile [[r, y], ...] (any winding). round: fillet radius for every
// corner (or one per corner). cut [phiStart, phiLength] (radians, three's lathe angles: phi 0 points to +z) keeps
// only that range and caps both cut faces with the profile: a product cutaway. scale: [sx, sz] makes it oval.
function revolve(profile, { segs = 96, cut = null, crease = 38, round = 0, roundSegs = 4, scale = null } = {}) {
  let pts = round ? roundPoly(profile, round, roundSegs) : profile.map((p) => [...p]);
  if (signedArea(pts) < 0) pts = pts.reverse();
  const v2 = pts.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)); v2.push(v2[0].clone());
  const [p0, pl] = cut || [0, TAU];
  let g = smoothNormals(new THREE.LatheGeometry(v2, Math.max(6, Math.round((segs * pl) / TAU)), p0, pl), crease);
  if (cut) {
    const shape = new THREE.Shape(pts.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)));
    const cap = (phi, flip) => {
      const c = new THREE.ShapeGeometry(shape);
      c.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(Math.sin(phi), 0, Math.cos(phi)), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-Math.cos(phi), 0, Math.sin(phi))));
      return flip ? flipFaces(c) : c;
    };
    g = mergeGeometries([g, cap(p0, false), cap(p0 + pl, true)].map((x) => only(x)), true); // groups: 0 surface, 1-2 cut faces
  }
  if (scale) g.scale(scale[0], 1, scale[1]);
  return g;
}
// Sweep a closed 2D profile [[u, v], ...] along a list of frames { p, n, b } (u along n, v along b), capped.
function sweep(frames, profile, { crease = 40, caps = true } = {}) {
  let prof = profile; if (signedArea(prof) < 0) prof = [...prof].reverse();
  const P = [], I = [], m = prof.length;
  for (const f of frames) for (const [u, v] of prof) { const q = f.p.clone().addScaledVector(f.n, u).addScaledVector(f.b, v); P.push(q.x, q.y, q.z); }
  for (let i = 0; i + 1 < frames.length; i++) for (let j = 0; j < m; j++) { const a = i * m + j, b = i * m + ((j + 1) % m), c = a + m, d = b + m; I.push(a, c, b, b, c, d); }
  if (caps) for (const [k, flip] of [[0, true], [frames.length - 1, false]]) {
    const tris = THREE.ShapeUtils.triangulateShape(prof.map(([u, v]) => new THREE.Vector2(u, v)), []);
    for (const [a, b, c] of tris) flip ? I.push(k * m + a, k * m + c, k * m + b) : I.push(k * m + a, k * m + b, k * m + c);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I);
  // orientation check: the swept surface must face away from the path
  g.computeVertexNormals();
  const n0 = new THREE.Vector3().fromBufferAttribute(g.attributes.normal, 0), out0 = new THREE.Vector3(P[0], P[1], P[2]).sub(frames[0].p);
  if (n0.dot(out0) < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } }
  return smoothNormals(g, crease);
}
// Frames along a planar curve in the XY plane: n = in-plane normal (towards the curve's centre), b = +z.
function planarFrames(curve, n, flipN = false) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, p = curve.getPointAt(t), tg = curve.getTangentAt(t).normalize();
    let nn = new THREE.Vector3(-tg.y, tg.x, 0); if (flipN) nn.negate();
    out.push({ p, n: nn, b: new THREE.Vector3(0, 0, 1) });
  }
  return out;
}
const roundRect = (w, h, r, segs = 3) => roundPoly([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], r, segs);
function mesh(geo, material, { cast = true, receive = true } = {}) { const m = new THREE.Mesh(geo, material); m.castShadow = cast; m.receiveShadow = receive; return m; }
// a revolved part whose cut faces (if any) take their own material: a machined or foam section reads at a glance
function part(geo, surface, section = surface, o) { return mesh(geo, geo.groups.length ? [surface, section, section] : surface, o); }
function pin(parent, name, pos, store) { const a = new THREE.Object3D(); a.name = name; a.position.copy(pos); parent.add(a); store[name] = a; return a; }
const glowMat = (color, i = 0) => new THREE.MeshBasicMaterial({ color: C(color).multiplyScalar(i), toneMapped: false });

// fabric / leather / cast metal: kit materials with fine object-space grain (no UVs needed)
const leather = (color, unit) => modelMaterial('satin', { color, rough: 0.5, grain: 0.05, grainScale: 0.0015, unit, env: 0.7 });

// ---------- speaker driver ----------
// speakerDriver({ width 1 (basket diameter) | perMetre, cutaway false | degrees (90), cutAngle 45, color 'graphite' |
// 'silver' | hex (basket), cone '#16181c', cap 'silver' | 'black', accent }) -> Group. A 5-inch cone driver: cast
// basket with six spokes, foam gasket, rubber surround, paper cone, dust cap, voice coil and former, spider, steel top
// plate, ferrite magnet and T-yoke with a vent, gold terminals. Its axis is +z (the cone faces +z); the front of the
// basket rim is at z = 0. cutaway: a wedge (default 90 degrees) removed at cutAngle (degrees, counter-clockwise from +x
// as you face the driver), showing the motor in section.
// driver.push(x): moves the cone, cap and coil along the axis (x -1..1 of the maximum excursion, 5 mm); the surround
// and spider stretch. driver.setGlow(v): the voice coil glows in the accent (current through it), 0 = off.
// Anchors: front (on the axis just ahead of the dust cap: where the sound leaves), dustCap, cone, surround, coil,
// magnet, spider, basket. With a cutaway, coil, magnet and spider sit on the visible cut face.
export function speakerDriver(o = {}) {
  const s = scaleOf(o, 'width', REAL_AUDIO.speakerDriver, 1) / 1000; // world units per millimetre
  const g = new THREE.Group(); g.name = 'speakerDriver';
  const inner = new THREE.Group(); inner.rotation.x = Math.PI / 2; inner.scale.setScalar(s); g.add(inner); // lathe +y -> +z
  const unit = 130 * s;
  const cutDeg = o.cutaway === true ? 90 : o.cutaway || 0;
  const phiC = deg((o.cutAngle ?? 45) + 90), w = deg(cutDeg);
  const cut = cutDeg ? [phiC + w / 2, TAU - w] : null;
  const R = (profile, opt = {}) => revolve(profile, { cut, ...opt });
  const baseCol = { graphite: '#3a3e45', silver: '#a9aeb6', black: '#1d1f23' }[o.color ?? 'graphite'] || o.color;
  const M = {
    basket: mat.metal(baseCol, { rough: 0.38, env: 1.1 }), steel: mat.metal('#a4a9b1', { rough: 0.3, env: 1.2 }),
    magnet: modelMaterial('matte', { color: '#26282c', rough: 0.72, unit, grain: 0.04, grainScale: 0.002 }),
    cone: modelMaterial('matte', { color: o.cone ?? '#16181c', rough: 0.8, unit, grain: 0.05, grainScale: 0.0018 }),
    surround: modelMaterial('satin', { color: '#121316', rough: 0.55, unit, grain: 0.02 }),
    cap: o.cap === 'black' ? modelMaterial('satin', { color: '#1a1c20', rough: 0.3, unit }) : mat.brushed('#c3c8cf', { rough: 0.3 }),
    spider: modelMaterial('matte', { color: '#c7b38c', rough: 0.92, unit, grain: 0.06, grainScale: 0.0012 }),
    former: mat.plastic('#b98c3a', { rough: 0.35, clearcoat: 0.3 }),
    copper: new THREE.MeshPhysicalMaterial({ color: C('#c6703a'), metalness: 1, roughness: 0.32, emissive: C(o.accent ?? accentDefault()), emissiveIntensity: 0, envMapIntensity: 1.2 }),
    gasket: modelMaterial('matte', { color: '#0e0f11', rough: 0.95, unit, grain: 0.08, grainScale: 0.002 }),
    gold: mat.gold({ rough: 0.25 }),
    cutMetal: mat.metal('#e2e6ec', { rough: 0.3, env: 1.5 }), cutFerrite: modelMaterial('matte', { color: '#55585e', rough: 0.6, unit }),
    cutPaper: modelMaterial('matte', { color: '#3a3b3e', rough: 0.85, unit }),
  };
  // fixed parts (mm, y = 0 at the front of the rim, back is negative)
  inner.add(part(R([[56.5, -4.5], [65, -4.5], [65, 0], [56.5, 0]], { round: [1, 1.2, 1.2, 0.6] }), M.basket, M.cutMetal));
  inner.add(part(R([[57.5, 0], [64, 0], [64, 1.6], [57.5, 1.6]], { round: 0.6 }), M.gasket));
  inner.add(part(R([[34, -43], [44.5, -43], [44.5, -39.5], [34, -39.5]], { round: 0.8 }), M.basket, M.cutMetal)); // seat ring
  const spokes = 6;
  for (let k = 0; k < spokes; k++) {
    const phi = (k / spokes) * TAU + deg(15), half = deg(7.5);
    if (cut) { const rel = (((phi - cut[0]) % TAU) + TAU) % TAU; if (rel + half > cut[1] || rel - half < 0) continue; }
    inner.add(part(revolve([[57, -4.5], [60, -4.5], [44, -40], [41, -40]], { cut: [phi - half, 2 * half], round: 1.2, segs: 120 }), M.basket));
  }
  inner.add(part(R([[15, -50.5], [45, -50.5], [45, -42.5], [15, -42.5]], { round: [0.8, 1.2, 1.2, 0.8] }), M.steel, M.cutMetal)); // top plate
  inner.add(part(R([[24, -66], [44.5, -66], [44.5, -50.5], [24, -50.5]], { round: 1 }), M.magnet, M.cutFerrite));
  inner.add(part(R([[4, -72], [45, -72], [45, -66], [12, -66], [12, -42.5], [4, -42.5]], { round: [0.8, 1.2, 1, 0.6, 0.8, 0.8] }), M.steel, M.cutMetal)); // T-yoke, vent
  // moving parts: cone, cap, former, coil (translate); surround and spider (stretch)
  const moving = new THREE.Group(); inner.add(moving);
  const coneProf = [];
  for (let i = 0; i <= 16; i++) { const u = i / 16; coneProf.push([13.6 + (47.5 - 13.6) * u, -27 + 24.2 * Math.pow(u, 0.82)]); }
  for (let i = 16; i >= 0; i--) { const u = i / 16; coneProf.push([13.6 + (47.5 - 13.6) * u + 0.15, -27 + 24.2 * Math.pow(u, 0.82) - 0.9]); }
  moving.add(part(R(coneProf, { crease: 60 }), M.cone, M.cutPaper));
  const capProf = []; for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI / 2; capProf.push([17.5 * Math.cos(a), -22.6 + 6.8 * Math.sin(a)]); }
  for (let i = 12; i >= 0; i--) { const a = (i / 12) * Math.PI / 2; capProf.push([16.9 * Math.cos(a), -22.6 + 6.2 * Math.sin(a)]); }
  moving.add(part(R(capProf, { crease: 70 }), M.cap, M.cutMetal));
  moving.add(part(R([[12.7, -50], [13.3, -50], [13.3, -26.5], [12.7, -26.5]], { round: 0.2 }), M.former));
  const coil = part(R([[13.3, -49.5], [14.4, -49.5], [14.4, -41], [13.3, -41]], { round: 0.4 }), M.copper);
  moving.add(coil);
  // surround: a half roll, front-facing
  const sur = []; for (let i = 0; i <= 20; i++) { const a = (i / 20) * Math.PI; sur.push([52.3 + 5 * Math.cos(a), -3.2 + 4.6 * Math.sin(a)]); }
  for (let i = 20; i >= 0; i--) { const a = (i / 20) * Math.PI; sur.push([52.3 + 4.2 * Math.cos(a), -3.2 + 3.8 * Math.sin(a)]); }
  const surround = part(R(sur, { crease: 70 }), M.surround); inner.add(surround);
  // spider: a corrugated disc from the former to the seat ring
  const spi = []; for (let i = 0; i <= 40; i++) { const u = i / 40; spi.push([13.3 + (35 - 13.3) * u, -29.5 - 10.5 * u + 1.1 * Math.sin(u * Math.PI * 6)]); }
  for (let i = 40; i >= 0; i--) { const u = i / 40; spi.push([13.3 + (35 - 13.3) * u, -29.5 - 10.5 * u + 1.1 * Math.sin(u * Math.PI * 6) - 0.55]); }
  const spider = part(R(spi, { crease: 70 }), M.spider); inner.add(spider);
  // terminals on the basket's back, at the bottom as you face the driver
  if (!cut || (((-cut[0] % TAU) + TAU) % TAU) < cut[1]) for (const dx of [-6.5, 6.5]) {
    const tab = mesh(new THREE.BoxGeometry(4, 9, 1.1).translate(dx, -24, 50.5), M.gold); inner.add(tab);
    const post = mesh(new THREE.CylinderGeometry(1.1, 1.1, 3, 12).rotateX(Math.PI / 2).translate(dx, -21, 52), M.gold); inner.add(post);
  }
  // stretchable parts remember where they started
  const stretch = (m, rIn, rOut) => { const P = m.geometry.attributes.position; return { m, base: P.array.slice(), rIn, rOut }; };
  const S = [stretch(surround, 47.5, 57.3), stretch(spider, 13.3, 35)];
  const xmax = 5;
  g.push = (x) => {
    const dy = clamp(x, -1, 1) * xmax;
    moving.position.y = dy;
    for (const { m, base, rIn, rOut } of S) {
      const P = m.geometry.attributes.position, a = P.array;
      for (let i = 0; i < P.count; i++) { const r = Math.hypot(base[i * 3], base[i * 3 + 2]), wgt = clamp((rOut - r) / (rOut - rIn)); a[i * 3 + 1] = base[i * 3 + 1] + dy * wgt * wgt * (3 - 2 * wgt); }
      P.needsUpdate = true;
    }
  };
  g.setGlow = (v) => { M.copper.emissiveIntensity = Math.max(0, v) * 3; };
  // anchors (in the lathe frame; the cut face when there is a cutaway)
  const A = {};
  const at = (r, y, phi = cut ? cut[0] + 0.001 : deg(90)) => new THREE.Vector3(r * Math.sin(phi), y, r * Math.cos(phi));
  pin(inner, 'front', new THREE.Vector3(0, 12, 0), A);
  pin(moving, 'dustCap', new THREE.Vector3(0, -15.8, 0), A);
  pin(moving, 'cone', at(32, -12, cut ? cut[0] + cut[1] / 2 : deg(90)), A);
  pin(inner, 'surround', at(52.3, 1.4, cut ? cut[0] + cut[1] / 2 : deg(90)), A);
  pin(moving, 'coil', at(13.9, -45), A);
  pin(inner, 'magnet', at(34, -58), A);
  pin(inner, 'spider', at(24, -35), A);
  pin(inner, 'basket', at(50, -22, cut ? cut[0] + cut[1] / 2 : deg(90)), A);
  for (const m of [...inner.children, ...moving.children]) if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
  g.userData = { perMetre: s * 1000, size: [130 * s, 130 * s, 73.6 * s], center: new THREE.Vector3(0, 0, -34 * s), radius: 76 * s, cutaway: cutDeg };
  g.push(0);
  return withAnchors(g, A);
}

// ---------- headphones ----------
// headphones({ width 1 (outside of one cup to the other) | perMetre, color 'black' | 'silver' | 'sand' | 'navy' | hex,
// cutaway false (true: the left cup cut in half through its axis, front half removed, showing the driver and mics),
// accent }) -> Group. Over-ear noise-cancelling headphones as worn: centred between the ear cushions at the height of
// the ear canal, band over +y, the wearer facing +z. L is the wearer's left (+x). Each cup carries a feed-forward
// microphone on its outer shell (towards the front), a feedback microphone inside by the driver, a 40 mm driver behind
// a fabric scrim, and a small status LED. headphones.setMics(v) lights the mic rings in the accent (they are
// listening), headphones.push(x) moves both diaphragms (x -1..1), headphones.setLed(v).
// Anchors: cupL, cupR (cushion centres, where the ears sit), driverL, driverR, micL, micR (feed-forward mics),
// feedbackL, feedbackR, band (top of the headband).
export function headphones(o = {}) {
  const s = scaleOf(o, 'width', REAL_AUDIO.headphones, 1) / 1000;
  const g = new THREE.Group(); g.name = 'headphones';
  const root = new THREE.Group(); root.scale.setScalar(s); g.add(root);
  const unit = 262 * s;
  const COL = { black: ['#1b1c1f', '#2a2c30', '#3a3d42'], silver: ['#c9ccd1', '#8e939b', '#b9bdc4'], sand: ['#d8cdbd', '#b9ad9b', '#c9c1b4'], navy: ['#1f2a3c', '#2c3a52', '#59657a'] };
  const [body, trim, metal] = COL[o.color ?? 'black'] || [o.color, o.color, '#b9bec7'];
  const accent = o.accent ?? accentDefault();
  const M = {
    shell: modelMaterial('satin', { color: body, rough: 0.42, unit, grain: 0.025, grainScale: 0.002 }),
    cushion: leather(o.color === 'sand' ? '#d6d2cb' : '#151619', unit),
    band: modelMaterial('satin', { color: body, rough: 0.48, unit, grain: 0.03, grainScale: 0.002 }),
    pad: leather(o.color === 'sand' ? '#cfcac2' : '#17181b', unit),
    foam: modelMaterial('matte', { color: '#d9c9a3', rough: 0.95, unit, grain: 0.14, grainScale: 0.0015 }),
    cutShell: modelMaterial('matte', { color: '#8d939c', rough: 0.55, unit }),
    arm: mat.metal(metal, { rough: 0.3, env: 1.2 }),
    plate: modelMaterial('satin', { color: trim, rough: 0.3, unit, grain: 0.015 }),
    scrim: modelMaterial('matte', { color: '#0d0e10', rough: 0.95, unit, grain: 0.12, grainScale: 0.0012 }),
    dome: new THREE.MeshPhysicalMaterial({ color: C('#2b2e34'), metalness: 0.2, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, iridescence: 0.25, envMapIntensity: 1.2 }),
    frame: modelMaterial('satin', { color: '#202226', rough: 0.4, unit }),
    magnet: mat.metal('#9ea3ab', { rough: 0.32 }),
    port: new THREE.MeshStandardMaterial({ color: C('#050506'), roughness: 0.9 }),
    ring: new THREE.MeshPhysicalMaterial({ color: C('#7d828a'), metalness: 1, roughness: 0.3, emissive: C(accent), emissiveIntensity: 0 }),
    led: glowMat(accent, 0),
  };
  const A = {};
  const HX = 78, Y1 = 24, Y2 = 52; // half the distance between the cushion faces; cushion and shell depth (mm)
  const cut = o.cutaway ? [Math.PI, Math.PI] : null; // keep the back half of the left cup (lathe phi 180..360 is world z < 0)
  const diaphragms = [];
  for (const side of ['L', 'R']) {
    const sx = side === 'L' ? 1 : -1;
    const cup = new THREE.Group(); cup.name = 'cup' + side; root.add(cup);
    // lathe frame: +y outwards from the head, lathe z -> world +y (tall axis), lathe x -> world z (towards the face)
    cup.matrixAutoUpdate = false;
    cup.matrix.makeBasis(new THREE.Vector3(0, 0, sx), new THREE.Vector3(sx, 0, 0), new THREE.Vector3(0, 1, 0)).setPosition(sx * HX, 0, 0);
    const thisCut = side === 'L' ? cut : null;
    const ov = [0.8, 1];
    const R = (prof, opt = {}) => revolve(prof, { cut: thisCut, scale: ov, segs: 128, ...opt });
    // cushion (Y1 thick), scrim over the driver, shell to Y2, an inset face plate
    cup.add(part(R([[27, 0.5], [50, 0.5], [50, Y1], [27, Y1]], { round: [9, 9.5, 2.5, 2], roundSegs: 7 }), M.cushion, M.foam));
    cup.add(part(R([[0, 6], [27.5, 6], [27.5, 8], [0, 8]], { round: [0, 0.5, 0.5, 0] }), M.scrim));
    cup.add(part(R([[0, Y1], [48.5, Y1], [48.5, Y2 - 9], [46, Y2 - 2], [0, Y2]], { round: [0, 1.5, 7, 6, 0], roundSegs: 7 }), M.shell, M.cutShell));
    cup.add(part(R([[0, Y2 - 0.4], [33, Y2 - 0.4], [33, Y2 + 0.9], [0, Y2 + 0.9]], { round: [0, 1, 1, 0] }), M.plate, M.cutShell));
    // the driver behind the scrim: frame ring, magnet, and a domed diaphragm that moves
    cup.add(part(R([[17, 9], [21.5, 9], [21.5, 15], [17, 15]], { round: 0.6 }), M.frame, M.cutShell));
    cup.add(part(R([[0, 13], [9, 13], [9, 19], [0, 19]], { round: 0.8 }), M.magnet));
    const dia = new THREE.Group(); cup.add(dia); diaphragms.push(dia);
    const dp = []; for (let i = 0; i <= 14; i++) { const a = (i / 14) * Math.PI / 2; dp.push([17.2 * Math.cos(a), 10.5 - 2.4 * Math.sin(a)]); }
    for (let i = 14; i >= 0; i--) { const a = (i / 14) * Math.PI / 2; dp.push([16.8 * Math.cos(a), 10.9 - 2.4 * Math.sin(a)]); }
    dia.add(part(R(dp, { crease: 70 }), M.dome));
    // microphones: feed-forward on the outer shell towards the front and low; feedback inside by the driver
    const ffPhi = deg(60), ffR = 40, ff = new THREE.Vector3(ffR * Math.sin(ffPhi) * ov[0], Y2 - 3.2, ffR * Math.cos(ffPhi) * ov[1]);
    const nrm = new THREE.Vector3(0.35 * Math.sin(ffPhi), 1, 0.35 * Math.cos(ffPhi)).normalize();
    const hole = mesh(new THREE.CylinderGeometry(1.25, 1.25, 1.2, 24), M.port); hole.position.copy(ff); hole.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), nrm); cup.add(hole);
    const ring = mesh(new THREE.TorusGeometry(1.7, 0.42, 10, 32).rotateX(Math.PI / 2), M.ring); ring.position.copy(ff).addScaledVector(nrm, 0.4); ring.quaternion.copy(hole.quaternion); cup.add(ring);
    pin(cup, 'mic' + side, ff.clone().addScaledVector(nrm, 0.8), A);
    pin(cup, 'feedback' + side, new THREE.Vector3(12 * Math.sin(deg(120)), 9.5, 12 * Math.cos(deg(120))), A);
    const fb = mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.4, 20), M.ring); fb.position.copy(A['feedback' + side].position); cup.add(fb);
    const led = mesh(new THREE.SphereGeometry(0.9, 16, 10), M.led, { cast: false }); led.position.set(48.4 * Math.sin(deg(140)) * ov[0], Y1 + 10, 48.4 * Math.cos(deg(140)) * ov[1]); cup.add(led);
    pin(cup, 'cup' + side, new THREE.Vector3(0, 0.5, 0), A);
    pin(cup, 'driver' + side, new THREE.Vector3(0, 10.5, 0), A);
  }
  // headband: an arc over the head, with a padded underside; sliders down to the cups
  const bandPts = [[121, 62], [120, 98], [114, 126], [99, 150], [72, 167], [37, 177], [0, 180]];
  const band = new THREE.CatmullRomCurve3([...bandPts.map(([x, y]) => new THREE.Vector3(x, y, 0)), ...bandPts.slice(0, -1).reverse().map(([x, y]) => new THREE.Vector3(-x, y, 0))], false, 'centripetal');
  const frames = planarFrames(band, 220, true);
  root.add(mesh(sweep(frames, roundRect(11, 38, 4.8, 5), { crease: 50 }), M.band));
  const padCurve = new THREE.CatmullRomCurve3(band.getSpacedPoints(400).filter((p) => p.y > 138), false, 'centripetal');
  const padFrames = planarFrames(padCurve, 120, true).map((f) => ({ ...f, p: f.p.clone().addScaledVector(f.n, -12) }));
  root.add(mesh(sweep(padFrames, roundRect(14, 31, 6.5, 6), { crease: 60 }), M.pad));
  for (const sx of [1, -1]) {
    // slider: from inside the band's end down to the yoke, which arcs over the cup to pivots on its front and back
    const xm = sx * (HX + (Y1 + Y2) / 2);
    const arm = new THREE.CatmullRomCurve3([new THREE.Vector3(sx * 119.5, 98, 0), new THREE.Vector3(sx * 119, 80, 0), new THREE.Vector3(xm, 64, 0)]);
    root.add(mesh(sweep(planarFrames(arm, 24), roundRect(3.6, 13, 1.6)), M.arm));
    const yk = [];
    for (let i = 0; i <= 40; i++) { const a = Math.PI * (i / 40); yk.push(new THREE.Vector3(xm, 57.5 * Math.sin(a) - 1, 44.5 * Math.cos(a))); }
    const yoke = new THREE.CatmullRomCurve3(yk);
    const yf = []; for (let i = 0; i <= 80; i++) { const t = i / 80, p = yoke.getPointAt(t), tg = yoke.getTangentAt(t); const b = new THREE.Vector3(1, 0, 0), n = new THREE.Vector3().crossVectors(b, tg).normalize(); yf.push({ p, n, b }); }
    root.add(mesh(sweep(yf, roundRect(4.6, 8, 1.8)), M.arm));
    for (const z of [-44.5, 44.5]) { const boss = mesh(new THREE.CylinderGeometry(5, 5, 6.5, 28).rotateX(Math.PI / 2), M.arm); boss.position.set(xm, -1, z * 0.94); root.add(boss); }
    const block = mesh(new THREE.BoxGeometry(10, 11, 15), M.arm); block.position.set(xm, 61.5, 0); root.add(block);
  }
  pin(root, 'band', new THREE.Vector3(0, 185.5, 0), A);
  g.setMics = (v) => { M.ring.emissiveIntensity = Math.max(0, v) * 4; };
  g.setLed = (v) => { M.led.color.copy(C(accent).multiplyScalar(Math.max(0, v) * 6)); };
  g.push = (x) => { for (const d of diaphragms) d.position.y = clamp(x, -1, 1) * 1.2; };
  for (const c of root.children) c.updateMatrixWorld?.(true);
  g.userData = { perMetre: s * 1000, size: [2 * (HX + Y2 + 1) * s, 236 * s, 100 * s], center: new THREE.Vector3(0, 62 * s, 0), radius: 145 * s, ears: HX * 2 * s };
  return withAnchors(g, A);
}

// ---------- microphone ----------
// microphone({ height 1 | perMetre, style 'handheld' | 'studio', finish 'black' | 'silver' | 'champagne', grille hex,
// accent }) -> Group. handheld: the classic stage microphone, a ball of woven wire over a dark foam windscreen on a
// tapered handle (the shape everyone reads as "microphone"). studio: a large-diaphragm condenser, machined body,
// polished collar, double mesh head with the gold diaphragm visible inside. Stands on y = 0, the capsule faces +z.
// mic.vibrate(x) moves the diaphragm (x -1..1), mic.setGlow(v) lights the capsule in the accent (it is picking up
// sound). Anchors: capsule (where sound is caught), grille (front of the head), body, base.
export function microphone(o = {}) {
  const style = o.style ?? 'handheld';
  const real = style === 'studio' ? 0.225 : 0.185;
  const s = (o.perMetre != null ? o.perMetre : (o.height ?? 1) / real) / 1000;
  const g = new THREE.Group(); g.name = 'microphone';
  const root = new THREE.Group(); root.scale.setScalar(s); g.add(root);
  const unit = real * 1000 * s;
  const FIN = { black: ['#1b1c1f', '#a9aeb6'], silver: ['#c5c9cf', '#8d9299'], champagne: ['#cdbb9a', '#a59377'] };
  const [bodyCol, trimCol] = FIN[o.finish ?? 'black'] || [o.finish, '#9aa0a8'];
  const accent = o.accent ?? accentDefault();
  const M = {
    body: (o.finish ?? 'black') === 'black' ? modelMaterial('satin', { color: bodyCol, rough: 0.36, unit, grain: 0.02 }) : mat.brushed(bodyCol, { rough: 0.3 }),
    trim: mat.metal(trimCol, { rough: 0.2, env: 1.3 }),
    mesh: meshMaterial(o.grille ?? '#b9bec6'),
    meshIn: meshMaterial('#26282d', 1.6),
    foam: modelMaterial('matte', { color: '#121315', rough: 0.98, unit, grain: 0.2, grainScale: 0.004 }),
    capsule: mat.metal('#3a3c41', { rough: 0.35 }),
    gold: new THREE.MeshPhysicalMaterial({ color: C('#e8bf6a'), metalness: 1, roughness: 0.18, emissive: C(accent), emissiveIntensity: 0, envMapIntensity: 1.4 }),
  };
  const R = (prof, opt = {}) => revolve(prof, { segs: 128, ...opt });
  const A = {};
  let dia, capY, capR;
  if (style === 'studio') {
    root.add(mesh(R([[0, 0], [21.5, 0], [23, 4], [25, 146], [0, 146]], { round: [0, 2.5, 3, 1.5, 0], roundSegs: 5 }), M.body));
    for (const y of [8, 118]) root.add(mesh(R([[24.2, y], [25.4, y], [25.4, y + 1.4], [24.2, y + 1.4]], { round: 0.3 }), M.trim));
    root.add(mesh(R([[0, 145], [28.5, 145], [28.5, 153], [0, 153]], { round: [0, 1.6, 1.6, 0] }), M.trim)); // collar
    const headProf = (r0) => { const p = [[0, 152], [r0, 152], [r0, 196]]; for (let i = 1; i <= 16; i++) { const a = (i / 16) * Math.PI / 2; p.push([r0 * Math.cos(a), 196 + r0 * 0.9 * Math.sin(a)]); } return p; };
    const shell = (r0) => [...headProf(r0), ...headProf(r0 - 0.6).reverse()];
    root.add(mesh(R(shell(29.5), { crease: 80 }), M.mesh, { cast: false }));
    root.add(mesh(R(shell(27), { crease: 80 }), M.meshIn, { cast: false }));
    for (const y of [152, 194.5]) root.add(mesh(R([[26.5, y], [30, y], [30, y + 3.5], [26.5, y + 3.5]], { round: 0.8 }), M.trim));
    for (let k = 0; k < 4; k++) { const rib = mesh(new THREE.BoxGeometry(2.2, 40, 2.2).translate(0, 175, 29.3), M.trim); rib.rotation.y = (k / 4) * TAU + Math.PI / 4; root.add(rib); }
    capY = 183; capR = 15;
    const cap = new THREE.Group(); cap.position.set(0, capY, 0); root.add(cap);
    cap.add(mesh(new THREE.TorusGeometry(capR + 1, 2.2, 16, 64), M.capsule));
    dia = mesh(new THREE.CylinderGeometry(capR, capR, 0.6, 64).rotateX(Math.PI / 2), M.gold); cap.add(dia);
    cap.add(mesh(new THREE.CylinderGeometry(3.5, 4.5, 26, 24).translate(0, -26, 0), M.capsule));
    pin(cap, 'capsule', new THREE.Vector3(0, 0, 1), A);
    pin(root, 'grille', new THREE.Vector3(0, 180, 30.5), A);
    pin(root, 'body', new THREE.Vector3(0, 80, 24.5), A);
    g.userData = { perMetre: s * 1000, size: [61 * s, 223 * s, 61 * s], center: new THREE.Vector3(0, 112 * s, 0), radius: 116 * s, style };
  } else {
    // handle: tapered, with a polished XLR end and a ring under the grille
    const handle = [[0, 0], [14.5, 0], [15.5, 3], [16, 10], [20, 110], [21.5, 126], [0, 126]];
    root.add(mesh(R(handle, { round: [0, 1.5, 1.5, 0, 6, 1.5, 0], roundSegs: 6 }), M.body));
    root.add(mesh(R([[0, -1], [15, -1], [15, 6], [0, 6]], { round: [0, 1.2, 1.2, 0] }), M.trim)); // XLR end
    root.add(mesh(R([[0, 124], [23.5, 124], [24.5, 129], [24.5, 135], [0, 135]], { round: [0, 1.2, 1.5, 1.5, 0] }), M.trim)); // grille base
    const ball = (r0, cy) => { const p = []; for (let i = 0; i <= 24; i++) { const a = -Math.PI / 2 + (i / 24) * Math.PI; p.push([Math.max(0, r0 * Math.cos(a)), cy + r0 * 1.04 * Math.sin(a)]); } return p; };
    const shellB = (r0, cy) => [...ball(r0, cy), ...ball(r0 - 0.6, cy).reverse()];
    const cy = 156;
    root.add(mesh(R(shellB(25.8, cy), { crease: 80 }), M.mesh, { cast: false }));
    root.add(mesh(R([[23.8, cy - 1.2], [26.2, cy - 1.2], [26.2, cy + 1.2], [23.8, cy + 1.2]], { round: 0.6 }), M.trim)); // equator band
    root.add(mesh(R(ball(23.4, cy).filter(([r]) => r >= 0)), M.foam));
    capY = cy; capR = 11;
    const cap = new THREE.Group(); cap.position.set(0, capY, 23.6); root.add(cap);
    dia = mesh(new THREE.CylinderGeometry(capR, capR, 0.4, 48).rotateX(Math.PI / 2), M.gold); dia.visible = false; cap.add(dia);
    pin(cap, 'capsule', new THREE.Vector3(0, 0, 0), A);
    pin(root, 'grille', new THREE.Vector3(0, cy, 26.5), A);
    pin(root, 'body', new THREE.Vector3(0, 70, 18.5), A);
    g.userData = { perMetre: s * 1000, size: [52 * s, 183 * s, 52 * s], center: new THREE.Vector3(0, 90 * s, 0), radius: 96 * s, style };
  }
  pin(root, 'base', new THREE.Vector3(0, 0, 0), A);
  g.vibrate = (x) => { dia.position.z = clamp(x, -1, 1) * 0.6; };
  g.setGlow = (v) => { M.gold.emissiveIntensity = Math.max(0, v) * 1.5; if (style !== 'studio') { M.foam.emissive = C(accent); M.foam.emissiveIntensity = Math.max(0, v) * 0.35; } };
  return withAnchors(g, A);
}
// A woven wire mesh as an alpha-tested metal (UV-mapped by the lathe: u around, v along the profile).
function meshMaterial(color, density = 1) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#fff';
  x.fillRect(0, 0, 64, 14); x.fillRect(0, 0, 14, 64);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(140 / density, 40 / density); t.anisotropy = 8;
  return new THREE.MeshPhysicalMaterial({ color: C(color), metalness: 0.9, roughness: 0.38, alphaMap: t, alphaTest: 0.5, side: THREE.DoubleSide, envMapIntensity: 1.1 });
}
