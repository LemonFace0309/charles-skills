// People: a mannequin head (with face anchors and a face-dot pattern for depth-sensing shots), an outer ear with a
// cutaway down the ear canal to the eardrum, a hand holding the kit's phone, and a pair of glasses. Shapes are
// generated GLBs baked into kit/models/ (see kit/models/NOTICE.md), wearing kit materials: the head and the ear are
// anatomical models in clay; the hand wears skin, because a person next to hard-surface renders must never read as a
// toy; none is a photoreal person, which keeps the explainer about the idea and never about whose face it is.
//
// SCALE  Like devices.js: give the natural size option (head height, hand height) or perMetre (world units per real
//        metre). REAL_PEOPLE lists the real sizes, so head({ perMetre: 10 }) and phone({ width: REAL.phone * 10 })
//        stand at true relative size.
// LEFT/RIGHT  L and R are the person's own left and right. The head faces +z, so its left is +x.
// head, ear and hand are async (they load a GLB once per page, then clone); glasses is synchronous.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { model, surfaceDots, modelMaterial, removeRegion, loadGLB } from './model.js';
import { phone } from './base.js';
import { withAnchors } from './base.js';
import { accentDefault, theme, mat } from '../look.js';
import { line } from '../glow.js';
import { clamp } from '../util.js';

const KIT_MODEL = (f) => new URL(`../../models/${f}`, import.meta.url).href;
// Real sizes in metres: head = the bust's height (base of the neck cut to the crown), hand = wrist cut to fingertip
// with the phone held upright, ear = the skin block around the ear.
export const REAL_PEOPLE = { head: 0.335, hand: 0.205, ear: 0.12, glasses: 0.14 };
const scaleOf = (o, key, real, def) => (o.perMetre != null ? o.perMetre * real : o[key] ?? def);

// Face landmarks of kit/models/head.glb as fractions of its bounding box [x, y, z] (x: 0 = the head's right side,
// 1 = its left; y: 0 = base of the bust, 1 = crown; z: 0 = back, 1 = nose tip), snapped onto the skin along +z.
const HEAD_MARKS = {
  noseTip: [0.5, 0.548, 1], eyeL: [0.643, 0.655, 1], eyeR: [0.357, 0.655, 1], cheekL: [0.69, 0.555, 1], cheekR: [0.31, 0.555, 1],
  chin: [0.5, 0.335, 1], mouth: [0.5, 0.445, 1], forehead: [0.5, 0.8, 1],
};
const HEAD_FACE = { cx: 0.5, cy: 0.585, rx: 0.205, ry: 0.255 }; // the face oval (box fractions) for faceDots
const HEAD_BASE = 0.09; // the fraction of the sculpt's height cut off at the bottom (its base is open and uneven)
// Move a model so the bottom of what is left after a crop sits on y = 0 (anchors and caps move with it).
function rebase(g) {
  const b = new THREE.Box3(); for (const m of [...g.meshes, ...(g.caps || [])]) { m.geometry.computeBoundingBox(); b.union(m.geometry.boundingBox); }
  const dy = -b.min.y; if (!dy) return g;
  for (const m of [...g.meshes, ...(g.caps || [])]) { m.geometry.translate(0, dy, 0); m.geometry.computeBoundingBox(); m.geometry.computeBoundingSphere(); }
  for (const a of Object.values(g.anchors)) a.position.y += dy;
  g.userData.center.y += dy; g.userData.box.translate(new THREE.Vector3(0, dy, 0)); g.userData.size[1] = b.max.y - b.min.y;
  const fr = g.frac; g.frac = (f) => fr(f).setY(fr(f).y + dy);
  g.userData.fromFile.premultiply(new THREE.Matrix4().makeTranslation(0, dy, 0));
  return g;
}

// head({ height 1 | perMetre, material 'clay', color, rough, grain, shadows }) -> Promise<Group>
// A smooth, sculpted bust (head, neck, shoulders): neutral expression, realistic proportions, no hair. Stands on
// y = 0, faces +z. material: any props.model() material ('clay' default, 'skin', 'satin', 'ceramic', 'xray', ...).
// Anchors: noseTip, eyeL, eyeR, cheekL, cheekR, chin, mouth, forehead (all on the skin), earL, earR, top, center.
// head.faceDots(n = 3000, seed = 7, { spread 1, even true }) -> [{ position, normal }] evenly spread over the face
// (forehead to chin, cheek to cheek), in the head's own space: the dot projector's pattern.
// head.dots(n, { size, color, intensity 5, from 'noseTip' | Vector3 | 'random', seed }) -> surfaceDots mesh to add to
// the head (head.add(d)): .reveal(p) grows the dots in from `from`, .setIntensity(i), .setColor(c).
// head.look(material, o) -> a second skin over the same shape (e.g. 'xray', 'wire') to add and fade with .set(v).
export async function head(o = {}) {
  const height = scaleOf(o, 'height', REAL_PEOPLE.head, 1);
  const anchors = Object.fromEntries(Object.entries(HEAD_MARKS).map(([k, f]) => [k, { at: f, snap: '+z' }]));
  anchors.earL = { at: [1, 0.64, 0.43], snap: '+x' };
  anchors.earR = { at: [0, 0.64, 0.43], snap: '-x' };
  // the sculpt is cut flat a little above its ragged base, and the cut is capped: a solid bust that stands on y = 0
  const g = await model(KIT_MODEL('head.glb'), { size: height / (1 - HEAD_BASE), fit: 'height', material: o.material ?? 'clay', color: o.color, rough: o.rough, grain: o.grain, env: o.env, shadows: o.shadows ?? true, smooth: false, anchors, crop: { normal: [0, -1, 0], at: HEAD_BASE, name: 'base' }, capColor: o.color });
  rebase(g);
  g.name = 'head';
  g.userData.perMetre = height / REAL_PEOPLE.head;
  const F = HEAD_FACE;
  const lo = g.frac([F.cx - F.rx, F.cy - F.ry, 0]), hi = g.frac([F.cx + F.rx, F.cy + F.ry, 1]);
  const c = lo.clone().add(hi).multiplyScalar(0.5), rx = (hi.x - lo.x) / 2, ry = (hi.y - lo.y) / 2;
  g.faceDots = (n = 3000, seed = 7, fo = {}) => {
    const s = fo.spread ?? 1;
    return g.surfacePoints(n, seed, { even: fo.even ?? true, facing: [0, 0, 1], minDot: 0.12, filter: (p) => ((p.x - c.x) / (rx * s)) ** 2 + ((p.y - c.y) / (ry * s)) ** 2 < 1 });
  };
  g.dots = (n = 3000, d = {}) => {
    const pts = g.faceDots(n, d.seed ?? 7, d);
    const from = d.from === 'random' ? 'random' : d.from?.isVector3 ? d.from : g.anchor(d.from ?? 'noseTip').position.clone();
    return surfaceDots(pts, { size: height * 0.0045, ...d, from });
  };
  g.look = (kind, lo2 = {}) => overlay(g, kind, lo2);
  return withAnchors(g, g.anchors);
}

// ear({ height 1 | perMetre, side 'left', cutaway false, material 'clay', color, capColor, canalColor, drumColor })
// -> Promise<Group>. An anatomical ear model: a block of the side of the head (cut from kit/models/head.glb, with
// clean section faces) carrying the outer ear, standing on its bottom face with the ear facing +x (side 'right':
// facing -x). height is the block's height. cutaway: true removes the front half along a vertical plane through the
// ear canal (the section faces +z, towards a camera in front), showing the canal as a channel into the head and the
// eardrum at its end; ear.setDrum(x) pushes the drum in and out (x -1..1, pure: call it every update).
// Anchors: pinna (the outer ear), opening (the canal's entrance), canal (half-way in), drum, center.
export async function ear(o = {}) {
  const height = scaleOf(o, 'height', REAL_PEOPLE.ear, 1);
  const right = o.side === 'right', X = (f) => (right ? 1 - f : f), sx = right ? -1 : 1;
  // the block, as fractions of the head's box (the head's left ear is at +x)
  const B = { x: [0.6, 1], y: [0.47, 0.83], z: [0.23, 0.67] }, zc = 0.455, yc = 0.625;
  const headH = height / (B.y[1] - B.y[0]);
  const plain = await model(KIT_MODEL('head.glb'), { size: headH, fit: 'height', center: 'none', material: 'clay', shadows: false });
  const fr = plain.frac;
  const P = (f) => fr([X(f[0]), f[1], f[2]]);
  // crops apply in order: the bottom one first, through the neck, where the sculpt's surface is closed
  const planes = [
    { normal: [0, -1, 0], point: P([0.5, B.y[0], 0.5]), name: 'bottom' }, { normal: [0, 1, 0], point: P([0.5, B.y[1], 0.5]), name: 'top' },
    { normal: [-sx, 0, 0], point: P([B.x[0], 0.5, 0.5]), name: 'inner' },
    { normal: [0, 0, -1], point: P([0.5, 0.5, B.z[0]]), name: 'back' }, { normal: [0, 0, 1], point: P([0.5, 0.5, B.z[1]]), name: 'front' },
  ];
  // the canal: from the opening in the concha, about 25 mm inward with a gentle S, in the plane of the section
  const mm = headH / (REAL_PEOPLE.head * 1000);
  const cz = P([0.5, 0.5, zc]).z;
  // the opening: where the canal's axis leaves the head, found from inside (a ray outwards from deep in the block)
  const hitO = plain.hit(P([0.72, yc, zc]).setZ(cz), new THREE.Vector3(sx, 0, 0));
  const O = hitO ? hitO.point.clone() : P([0.83, yc, zc]);
  O.z = cz;
  const r = 3.7 * mm, len = 25 * mm, N = 24;
  const center = [];
  for (let i = 0; i <= N; i++) { const u = i / N; center.push(new THREE.Vector3(O.x - sx * len * u, O.y + mm * (2.2 * Math.sin(u * Math.PI) - 1.0 * u), cz)); }
  const canalOut = center[0].clone().add(new THREE.Vector3(sx * 2.5 * mm, 0, 0));
  const pts = [canalOut, ...center]; // the channel opens just past the skin; the canal's own skin starts at the opening
  const sideAt = (i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; const t = b.clone().sub(a).normalize(); return new THREE.Vector3().crossVectors(new THREE.Vector3(0, 0, 1), t).normalize(); };
  // the channel the canal leaves in the section: its outline (one side out, the other side back, round at the drum)
  const sideA = pts.map((p, i) => p.clone().addScaledVector(sideAt(i), r)), sideB = pts.map((p, i) => p.clone().addScaledVector(sideAt(i), -r));
  const holes = [[...sideA, ...sideB.reverse()]];
  const cut = o.cutaway ? [{ normal: [0, 0, 1], point: new THREE.Vector3(0, 0, cz), holes, name: 'section' }] : null;
  const g = await model(KIT_MODEL('head.glb'), { size: headH, fit: 'height', center: 'none', material: o.material ?? 'clay', color: o.color, rough: o.rough, grain: o.grain, shadows: o.shadows ?? true, smooth: false, crop: planes, cut, capColor: o.capColor ?? '#' + new THREE.Color(o.color ?? '#c9c2b8').multiplyScalar(0.86).getHexString() });
  g.name = 'ear';
  // re-seat the block: standing on its bottom face (y = 0), centred on x and z
  const box = new THREE.Box3(); for (const m of [...g.meshes, ...(g.caps || [])]) { m.geometry.computeBoundingBox(); box.union(m.geometry.boundingBox); }
  const shift = new THREE.Vector3(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  const inner = new THREE.Group(); inner.position.copy(shift);
  for (const m of [...g.meshes, ...(g.caps || [])]) { g.remove(m); inner.add(m); }
  g.add(inner);
  const anchorsIn = {};
  const pin = (name, p) => { const a = new THREE.Object3D(); a.name = name; a.position.copy(p); inner.add(a); anchorsIn[name] = a; return a; };
  const D = center[N].clone();
  pin('opening', O); pin('canal', center[Math.round(N / 2)]); pin('drum', D);
  const pinnaHit = plain.hit(P([1.3, 0.64, 0.43]), new THREE.Vector3(-sx, 0, 0));
  pin('pinna', pinnaHit ? pinnaHit.point : P([0.88, 0.64, 0.43]));
  if (o.cutaway) {
    // the canal's skin: a half pipe behind the section plane
    const pos = [], nor = [], idx = [], R = 16;
    for (let i = 1; i < pts.length; i++) {
      const s = sideAt(i), rr = r * (1 - 0.12 * (i - 1) / N);
      for (let j = 0; j <= R; j++) { const th = (j / R) * Math.PI, dir = s.clone().multiplyScalar(Math.cos(th)).add(new THREE.Vector3(0, 0, -Math.sin(th))); const p = pts[i].clone().addScaledVector(dir, rr); pos.push(p.x, p.y, p.z); nor.push(-dir.x, -dir.y, -dir.z); }
    }
    for (let i = 0; i + 2 < pts.length; i++) for (let j = 0; j < R; j++) { const a = i * (R + 1) + j, b = a + R + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); cg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); cg.setIndex(idx);
    const canal = new THREE.Mesh(cg, modelMaterial('skin', { color: o.canalColor ?? '#b0675c', rough: 0.5, unit: headH, grain: 0.02 })); canal.receiveShadow = true; inner.add(canal);
    // the eardrum: a thin, slightly coned membrane, tilted (its top edge further out), cut by the section
    const td = THREE.MathUtils.degToRad(42), nd = new THREE.Vector3(sx * Math.cos(td), -Math.sin(td), 0);
    // a thin lens (0.7 mm at the middle) so the membrane reads in the section as a pearly slanted line
    const disc = new THREE.CylinderGeometry(r * 1.45, r * 1.45, 0.8 * mm, 48, 1).rotateX(Math.PI / 2);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), nd);
    disc.applyQuaternion(q).translate(D.x, D.y, D.z);
    const half = removeHalf(disc, cz);
    const P0 = half.attributes.position.array.slice();
    const drumMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(o.drumColor ?? '#d9cbbf'), roughness: 0.32, sheen: 0.6, sheenColor: new THREE.Color('#ffd9c4'), clearcoat: 0.4, clearcoatRoughness: 0.2, side: THREE.DoubleSide, emissive: new THREE.Color(o.accent ?? accentDefault()), emissiveIntensity: 0 });
    const drum = new THREE.Mesh(half, drumMat); drum.castShadow = drum.receiveShadow = true; inner.add(drum);
    g.drum = drum;
    g.setDrum = (x, { glow = 0 } = {}) => {
      const a = half.attributes.position, rd = r * 1.45, amp = 1.2 * mm * clamp(x, -1, 1);
      for (let i = 0; i < a.count; i++) { const px = P0[i * 3] - D.x, py = P0[i * 3 + 1] - D.y, pz = P0[i * 3 + 2] - D.z; const rho = Math.min(1, Math.hypot(px, py, pz) / rd); const k = amp * (1 - rho * rho); a.setXYZ(i, P0[i * 3] - nd.x * k, P0[i * 3 + 1] - nd.y * k, P0[i * 3 + 2] - nd.z * k); }
      a.needsUpdate = true; drumMat.emissiveIntensity = glow * 2;
    };
  } else g.setDrum = () => {};
  const bc = box.getCenter(new THREE.Vector3()).add(shift);
  pin('center', bc.clone().sub(shift));
  g.anchors = anchorsIn;
  const sz = box.getSize(new THREE.Vector3());
  g.userData = { ...g.userData, size: sz.toArray(), center: bc, radius: sz.length() / 2, footprint: [sz.x, sz.z], perMetre: headH / REAL_PEOPLE.head };
  return withAnchors(g, anchorsIn);
}
// keep the part of a (flat) geometry behind the plane z = zc
function removeHalf(geo, zc) {
  const g = removeRegion(geo.index ? geo.toNonIndexed() : geo, [{ n: new THREE.Vector3(0, 0, 1), pt: new THREE.Vector3(0, 0, zc) }]);
  g.computeVertexNormals();
  return g;
}

// A second material over the same geometry, drawn on top (polygon offset), with .set(v) for its strength (0 hides it).
function overlay(g, kind, o = {}) {
  const grp = new THREE.Group(); grp.name = 'look:' + kind;
  const m = typeof kind === 'string' ? modelMaterial(kind, o) : kind;
  m.transparent = true; m.depthWrite = false; m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -1;
  const base = m.opacity ?? 1, uBase = m.uniforms?.uOpacity?.value ?? 1;
  for (const mesh of g.meshes) { const x = new THREE.Mesh(mesh.geometry, m); x.renderOrder = 2; x.castShadow = false; grp.add(x); }
  grp.set = (v) => { grp.visible = v > 0.001; if (m.uniforms?.uOpacity) m.uniforms.uOpacity.value = uBase * v; else m.opacity = base * v; };
  return grp;
}

// Skin by tone: 'day' is the material's own colour; 'night' is a little deeper and less glossy, because under a cool
// night key a day skin goes orange where the warm story light lands on it ('orange wood'). Both keep the warmth of
// real skin: an earlier night tone (#86675e, greyed) read grey-blue under the night rig. What makes the hand read as
// skin and not clay or wax is in handSkin() below (light that wraps past the terminator, warm fingertips, darker
// creases, nails), not in a glossier coat or a brighter rim: the old scatter rim (0.12) glowed at every edge like wax.
const SKIN_TONE = {
  day: { color: '#a8735e', sheen: 0.32, sheenColor: '#f2a38e', scatter: '#c8503c', scatterK: 0.035, clearcoat: 0.1, rough: 0.52, roughVar: 0.35 },
  night: { color: '#9a6656', sheen: 0.28, sheenColor: '#e0a090', scatter: '#b84c3e', scatterK: 0.03, clearcoat: 0.08, rough: 0.55, roughVar: 0.35 },
};
const toneOf = (o) => o.tone ?? (['night', 'space'].includes(theme.pal?.env) ? 'night' : 'day');
// The hand's skin on top of the 'skin' preset, from the baked masks (attribute _masks: nail plate, free edge, flush,
// crease; kit/models/bake-hand.mjs): the nail plate is the nail bed seen through a glossy plate (pink, lighter than the
// skin, a pale free edge), never a dark recess; fingertips are redder; creases darker and redder (the kit has no
// ambient occlusion); and light wraps a little past the terminator in red, as it does through skin.
const NAIL_TONE = { day: { nail: '#d9a596', edge: '#f1e4d8' }, night: { nail: '#c99a8e', edge: '#e2d6cc' } };
function handSkin(m, tone, o = {}) {
  const T = NAIL_TONE[tone] || NAIL_TONE.day;
  const lin = (c) => new THREE.Color(c); // three converts hex to linear on set
  const U = {
    uNail: { value: lin(o.nailColor ?? T.nail) }, uNailEdge: { value: lin(T.edge) }, uFlushTint: { value: new THREE.Vector3(1.04, 0.86, 0.84) },
    uCrease: { value: o.crease ?? 0.55 }, uWrap: { value: o.wrap ?? 0.45 }, uWrapTint: { value: new THREE.Vector3(1.0, 0.42, 0.3) },
  };
  const base = m.onBeforeCompile, baseKey = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, r) => {
    base?.(sh, r);
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 _masks; varying vec4 vHandM;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHandM = _masks;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vHandM; uniform vec3 uNail, uNailEdge, uFlushTint, uWrapTint; uniform float uCrease, uWrap;')
      .replace('#include <color_fragment>', `#include <color_fragment>
  diffuseColor.rgb *= mix(vec3(1.0), uFlushTint, clamp(vHandM.z, 0.0, 1.0));
  diffuseColor.rgb *= 1.0 - clamp(vHandM.w, 0.0, 1.0) * uCrease * vec3(0.32, 0.46, 0.46);
  diffuseColor.rgb = mix(diffuseColor.rgb, uNail, clamp(vHandM.x, 0.0, 1.0));
  diffuseColor.rgb = mix(diffuseColor.rgb, uNailEdge, clamp(vHandM.y, 0.0, 1.0));`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 0.3, clamp(vHandM.x + vHandM.y, 0.0, 1.0));')
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
  #ifdef USE_CLEARCOAT
  material.clearcoat = mix(material.clearcoat, 0.55, clamp(vHandM.x, 0.0, 1.0)); material.clearcoatRoughness = mix(material.clearcoatRoughness, 0.18, clamp(vHandM.x, 0.0, 1.0));
  #endif`)
      .replace('#include <lights_physical_pars_fragment>', THREE.ShaderChunk.lights_physical_pars_fragment.replace(
        'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
        `reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	float hWrap = saturate( ( dot( geometryNormal, directLight.direction ) + uWrap ) / ( 1.0 + uWrap ) );
	reflectedLight.directDiffuse += max( hWrap - dotNL, 0.0 ) * directLight.color * BRDF_Lambert( material.diffuseColor ) * uWrapTint;`));
  };
  m.customProgramCacheKey = () => (baseKey ? baseKey() : '') + '_handskin';
  m.userData.handSkin = U;
  return m;
}

// hand({ height 1 | perMetre, phone true, screen, phoneColor 'black', glow, material 'skin', tone, color, side 'left' | 'right' })
// -> Promise<Group>. A hand holding the kit's phone upright, screen facing +z (towards whoever the hand shows it to).
// The hand stands on its wrist cut at y = 0. side 'right' mirrors it (default 'left': the thumb is on the screen's
// left as you look at the screen). hand.phone is the kit phone (setScreen(tex), setGlow(v), anchors screen / faceId),
// hand.setScreen / hand.setGlow pass through. Anchors: screen, faceId, thumb (on the thumb's front), thumbTip (both
// follow press), wrist, top.
// material 'skin' (people are never clay figures next to hard-surface renders); tone 'night' | 'day' picks the skin's
// colour and sheen, and defaults from the palette ('night' in night and space palettes). color overrides the tone's.
// hand.press(p) (p 0..1, pure: call it every update): the thumb rolls off the phone's side and its pad comes down on
// the glass, about 11% of the screen's width in from that edge. hand.thumbUV(p = 1) -> [u, v]: the screen point under
// the thumb's pad at press p (u from the screen's left, v from its top, 0..1), where a k.screen layout puts the button
// the thumb presses: left = u * w, top = v * h in the screen's CSS px.
export async function hand(o = {}) {
  const height = scaleOf(o, 'height', REAL_PEOPLE.hand, 1);
  const right = o.side === 'right';
  const tone = toneOf(o), material = o.material ?? 'skin', T = SKIN_TONE[tone] || SKIN_TONE.day;
  const look = material === 'skin' ? { ...T, ...Object.fromEntries(['color', 'sheen', 'sheenColor', 'scatter', 'scatterK', 'roughVar', 'clearcoat', 'rough'].filter((key) => o[key] !== undefined).map((key) => [key, o[key]])) } : { color: o.color, rough: o.rough };
  const url = KIT_MODEL('hand.glb');
  const g = await model(url, { size: height, fit: 'height', material, ...look, grain: o.grain, shadows: o.shadows ?? true, smooth: false, mirror: right ? 'x' : null, anchors: { thumb: { at: [right ? 0.87 : 0.13, 0.53, 0.8], snap: '+z' }, wrist: [0.5, 0.05, 0.5] } });
  g.name = 'hand';
  g.userData.perMetre = height / REAL_PEOPLE.hand;
  // the rig baked with the file (mesh extras: kit/models/bake-hand.mjs), in file units
  let rig = null; (await loadGLB(url)).scene.traverse((x) => { if (x.userData?.thumb) rig = x.userData; });
  const mesh = g.meshes[0];
  if (material === 'skin' && mesh.geometry.attributes._masks) handSkin(mesh.material, tone, o);
  // the phone the sculpt held, measured in the file: centre and size in file units (see NOTICE.md)
  const M = g.userData.fromFile, s = g.userData.scale;
  const centre = new THREE.Vector3(-0.002, 0.7335, 0.0467).applyMatrix4(M);
  const pw = 0.344 * s, ph = 0.7064 * s, pd = 0.0705 * s;
  let p = null;
  if (o.phone !== false) {
    p = phone({ width: pw, color: o.phoneColor ?? 'black', screen: o.screen, glow: o.glow });
    p.scale.z = (pd * 0.85) / p.userData.depth; // the sculpt's phone is a little thicker than a real one: meet the fingers
    p.position.copy(centre);
    g.add(p); g.phone = p;
    g.setScreen = (t) => p.setScreen(t);
    g.setGlow = (v) => p.setGlow(v);
    for (const k of ['screen', 'faceId']) { const a = new THREE.Object3D(); a.name = k; a.position.copy(p.anchors[k].position).multiply(p.scale).add(p.position); g.add(a); g.anchors[k] = a; }
  }
  g.userData.phoneBox = { center: centre, size: [pw, ph, pd] };
  // ---- the thumb's press: every thumb vertex turns by the IP flex x p x weight.y about the IP joint, then by the
  // roll x p x weight.x about the roll axis (a bend, not a linear blend). Rotations conjugated into prop space (a
  // mirrored hand turns the other way about the mirrored axis).
  const thumbA = g.anchors.thumb, tipA = new THREE.Object3D(); tipA.name = 'thumbTip'; thumbA.parent.add(tipA); g.anchors.thumbTip = tipA;
  const R = rig?.thumb, W = mesh.geometry.attributes._thumb;
  const V3 = (a) => new THREE.Vector3(...a);
  if (R && W) {
    const L3 = new THREE.Matrix3().setFromMatrix4(M), sgn = Math.sign(L3.determinant());
    const pivot = V3(R.pivot).applyMatrix4(M), axis = V3(R.axis).applyMatrix3(L3).normalize(), ip = V3(R.ip).applyMatrix4(M), ipAxis = V3(R.ipAxis).applyMatrix3(L3).normalize();
    const ang = R.angle * sgn, ipAng = R.ipAngle * sgn;
    const P = mesh.geometry.attributes.position, Nn = mesh.geometry.attributes.normal;
    const idx = [], w1 = [], w2 = [];
    for (let i = 0; i < W.count; i++) if (W.getX(i) > 1e-4 || W.getY(i) > 1e-4) { idx.push(i); w1.push(W.getX(i)); w2.push(W.getY(i)); }
    const P0 = Float32Array.from(idx.flatMap((i) => [P.getX(i), P.getY(i), P.getZ(i)])), N0 = Float32Array.from(idx.flatMap((i) => [Nn.getX(i), Nn.getY(i), Nn.getZ(i)]));
    const tip0 = V3(R.tip).applyMatrix4(M), contact0 = V3(R.contact).applyMatrix4(M), cw = R.contactWeights || [1, 1], th0 = thumbA.position.clone();
    // the 'thumb' anchor (on the thumb's front, where it always was) turns with its nearest thumb vertex
    let near = 0, nd = Infinity; for (let j = 0; j < idx.length; j++) { const d = (P.getX(idx[j]) - th0.x) ** 2 + (P.getY(idx[j]) - th0.y) ** 2 + (P.getZ(idx[j]) - th0.z) ** 2; if (d < nd) { nd = d; near = j; } }
    const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), x = new THREE.Vector3(), n = new THREE.Vector3();
    const turn = (v, nv, k1, k2, pp) => {
      if (k2 > 0) { q2.setFromAxisAngle(ipAxis, ipAng * pp * k2); v.sub(ip).applyQuaternion(q2).add(ip); nv?.applyQuaternion(q2); }
      if (k1 > 0) { q1.setFromAxisAngle(axis, ang * pp * k1); v.sub(pivot).applyQuaternion(q1).add(pivot); nv?.applyQuaternion(q1); }
      return v;
    };
    let last = null;
    g.press = (pp) => {
      pp = clamp(pp ?? 0, 0, 1);
      if (pp === last) return g; last = pp;
      for (let j = 0; j < idx.length; j++) {
        x.fromArray(P0, j * 3); n.fromArray(N0, j * 3);
        turn(x, n, w1[j], w2[j], pp);
        P.setXYZ(idx[j], x.x, x.y, x.z); Nn.setXYZ(idx[j], n.x, n.y, n.z);
      }
      P.needsUpdate = true; Nn.needsUpdate = true;
      tipA.position.copy(turn(tip0.clone(), null, 1, 1, pp));
      thumbA.position.copy(turn(th0.clone(), null, w1[near], w2[near], pp));
      return g;
    };
    mesh.frustumCulled = false; // the thumb leaves the rest pose's bounds
    // the screen point under the pad: the pad's contact point at p, in the phone's own space, as screen fractions
    g.thumbUV = (pp = 1) => {
      if (!p) return [0.5, 0.5];
      const c = turn(contact0.clone(), null, cw[0], cw[1], clamp(pp, 0, 1)).sub(p.position).divide(p.scale);
      const [sw, sh] = p.userData.screenSize;
      return [clamp(c.x / sw + 0.5, 0, 1), clamp(0.5 - c.y / sh, 0, 1)];
    };
    g.press(0);
  } else {
    // a hand GLB without the baked rig: the thumb stays put
    tipA.position.copy(thumbA.position);
    g.press = () => g; g.thumbUV = () => [right ? 0.97 : 0.03, 0.42];
  }
  return withAnchors(g, g.anchors);
}

// glasses({ width 1 | perMetre (real: 0.14 m), frame '#0d0d10', lens '#ffcf8a', lensOpacity .18, accent, fold 0 }) -> Group.
// Thick acetate frames with warm-tinted lenses (synchronous: no model file), centred on the bridge, lenses facing +z
// (the wearer looks along +z, so L is at +x). width is the frame front's width. glasses.setGlow(v) lights the rim
// edges in the accent ("put on these special glasses"); glasses.setFold(p) folds the temples flat behind the lenses
// (0 open, 1 folded; pure). Anchors: lensL, lensR, bridge, hingeL, hingeR. Glasses are thin and close to the lens:
// keep them at the focus distance (a defocused rim in front of the subject leaves stepped copies across it).
export function glasses(o = {}) {
  const width = scaleOf(o, 'width', REAL_PEOPLE.glasses, 1);
  const s = width / 1.52, accent = o.accent ?? accentDefault();
  const g = new THREE.Group(); g.name = 'glasses';
  const rimMat = mat.plastic(o.frame ?? '#0d0d10', { rough: 0.28, clearcoat: 1, ccRough: 0.12 });
  const lensMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(o.lens ?? '#ffcf8a'), roughness: 0.06, metalness: 0, transparent: true, opacity: o.lensOpacity ?? 0.18, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.4, side: THREE.DoubleSide, depthWrite: false });
  const rect = (w, h, r) => { const sh = new THREE.Shape(), x = -w / 2, y = -h / 2; sh.moveTo(x + r, y); sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r); sh.lineTo(x + w, y + h - r); sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h); sh.lineTo(x + r, y + h); sh.quadraticCurveTo(x, y + h, x, y + h - r); sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y); return sh; };
  const lw = 0.56 * s, lh = 0.42 * s, rr = 0.15 * s, t = 0.07 * s, cx = lw / 2 + t + 0.06 * s;
  const edges = [], temples = [], anchors = {};
  for (const sx of [1, -1]) { // +x is the wearer's left
    const side = sx > 0 ? 'L' : 'R';
    const outer = rect(lw + t * 2, lh + t * 2, rr + t), hole = rect(lw, lh, rr); outer.holes.push(hole);
    const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: 0.05 * s, bevelEnabled: true, bevelThickness: 0.015 * s, bevelSize: 0.015 * s, bevelSegments: 4, curveSegments: 24 }), rimMat);
    rim.position.set(sx * cx, 0, -0.025 * s); rim.castShadow = true; g.add(rim);
    for (const z of [0.042, -0.047]) { // the glow runs round the lens opening on the front face and on the back
      const pts = hole.getPoints(64).map((q) => new THREE.Vector3(q.x * 1.05 + sx * cx, q.y * 1.07, z * s)); pts.push(pts[0].clone());
      const edge = line(pts, { width: 0.012 * s, color: accent, intensity: 0 }); edge.visible = false; g.add(edge); edges.push(edge);
    }
    const lens = new THREE.Mesh(new THREE.ShapeGeometry(hole, 24), lensMat); lens.position.set(sx * cx, 0, 0); lens.renderOrder = 1; g.add(lens);
    // the temple swings about its hinge at the frame's outer edge
    const hinge = new THREE.Group(); hinge.position.set(sx * (cx + lw / 2 + t - 0.01 * s), 0.1 * s, -0.04 * s); g.add(hinge);
    const arm = new THREE.Mesh(new RoundedBoxGeometry(0.05 * s, 0.06 * s, 1.3 * s, 2, 0.012 * s), rimMat);
    arm.position.set(-sx * 0.01 * s, 0, -0.65 * s); arm.castShadow = true; hinge.add(arm);
    const tip = new THREE.Mesh(new RoundedBoxGeometry(0.05 * s, 0.26 * s, 0.07 * s, 2, 0.02 * s), rimMat); // the bend behind the ear
    tip.position.set(-sx * 0.01 * s, -0.1 * s, -1.28 * s); tip.rotation.x = 0.35; hinge.add(tip);
    temples.push({ hinge, sx });
    const a = new THREE.Object3D(); a.position.set(sx * cx, 0, 0); g.add(a); anchors['lens' + side] = a;
    anchors['hinge' + side] = hinge;
  }
  const bridge = new THREE.Mesh(new THREE.TorusGeometry(0.1 * s, 0.03 * s, 12, 24, Math.PI), rimMat);
  bridge.position.y = 0.05 * s; g.add(bridge);
  anchors.bridge = bridge;
  g.setGlow = (v) => edges.forEach((e) => { e.setIntensity(5 * v); e.visible = v > 0.01; });
  g.setFold = (p) => temples.forEach(({ hinge, sx }) => { hinge.rotation.y = -sx * clamp(p) * Math.PI * 0.5; });
  g.setFold(o.fold ?? 0); g.setGlow(0);
  g.userData = { radius: 0.78 * s, center: new THREE.Vector3(), size: [width, lh + 2 * t, 1.35 * s], perMetre: width / REAL_PEOPLE.glasses }; // radius frames the front
  return withAnchors(g, anchors);
}
