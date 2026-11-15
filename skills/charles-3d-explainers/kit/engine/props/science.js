// Science and data props: molecules and atoms, a transistor (and a field of them), a chip die, a circuit board, a
// fibre-optic cable cutaway, and instanced data fields (packets, bits, image tiles) whose labels are composed from a
// glyph atlas in the shader, so thousands of numbered objects cost one draw call.
//
// Animated props are pure functions of time: call their at(t) / set...(v) / layout(...) from the shot's update(t)
// every time it runs. Nothing accumulates between calls, so the camera body can sample sub-frames in any order.
// Pass { pal: k.pal } (or { accent }) so a prop's light matches the video's one warm accent, and call k.env() in the
// shot: glossy and metal surfaces get most of their look from reflections. Every prop returns an Object3D; add it to
// the scene (or to another prop) and move it like any group. userData.radius is its bounding radius for cam.frame;
// props with parts have g.anchors (named Object3D markers) and g.anchor(name), which throws on a bad name.
//
// Exports (all reach shots as k.props.*):
//   molecule, water, co2, methane, ammonia, moleculeCloud, dottedBond, MOLECULES,   chemistry
//   ELEMENTS
//   atom                                                                            Bohr-model atom
//   transistor, transistorArray                                                    one switch / a field of them
//   chipDie, wafer, boule, waferStack, DIE_BLOCKS                                   silicon
//   pcb                                                                             circuit board with routable traces
//   fiberCable, FIBER_LAYERS                                                        subsea cable cutaway
//   glyphField, packetField, bitField, dataTiles, glyphAtlas                        labelled instanced data
//   productEnv                                                                      studio reflections for one material
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat, accentDefault, noiseTexture } from '../look.js';
import { rng, clamp, ramp, easeFn, hash1 } from '../util.js';
import { glowSprite } from '../fx.js';
import { tube, line, hot } from '../glow.js';
import { withAnchors } from './base.js';

// ---------- shared helpers ----------
const V3 = THREE.Vector3;
const C = (c) => (c && c.isColor ? c.clone() : new THREE.Color(c));
const accentOf = (o) => o.accent || o.pal?.accent || accentDefault();
const coolOf = (o) => o.cool || o.pal?.glow || '#5aa8ff';
const rbox = (w, h, d, r = 0.04, seg = 4) => new RoundedBoxGeometry(w, h, d, seg, Math.max(1e-4, Math.min(r, w / 2, h / 2, d / 2) * 0.98));
const cyl = (r, h, seg = 40) => new THREE.CylinderGeometry(r, r, h, seg);
const flat = (geo) => (geo.index ? geo.toNonIndexed() : geo); // mergeGeometries needs all-indexed or all-not
const merge = (geos) => mergeGeometries(geos.map(flat));
const shade = (m, cast = true, receive = true) => { m.castShadow = cast; m.receiveShadow = receive; return m; };
const makeCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
const frac = (x) => x - Math.floor(x);
const hashN = (i, s = 0) => hash1(i * 0.7548776662 + s * 17.17 + 0.5);
const FONT_STACK = (font) => `"${font}", "Helvetica Neue", Helvetica, Arial, sans-serif`;
function canvasTexture(c, { srgb = true, flipY = true, repeat = null } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.flipY = flipY; t.anisotropy = 16;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
// An empty Object3D at a local position: hand it to k.ui.label({ anchor }) or aim the camera at it.
function pin(parent, pos, name = '') { const a = new THREE.Object3D(); a.position.set(...pos); a.name = name; parent.add(a); return a; }

// Text on a camera-facing sprite (charge signs, tiny tags). HDR white so it stays crisp against bloom.
function textSprite(text, { size = 0.25, color = '#ffffff', font = 'Inter', weight = 700, px = 128, intensity = 1.25 } = {}) {
  const c = makeCanvas(8, 8), g = c.getContext('2d'), f = `${weight} ${px}px ${FONT_STACK(font)}`;
  g.font = f;
  const w = Math.ceil(g.measureText(text).width + px * 0.4), h = Math.ceil(px * 1.35);
  c.width = w; c.height = h;
  g.font = f; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color; g.fillText(text, w / 2, h / 2 + px * 0.03);
  const tex = canvasTexture(c);
  const m = new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(1, 1, 1).multiplyScalar(intensity), transparent: true, depthWrite: false, toneMapped: false, fog: false });
  const s = new THREE.Sprite(m); s.scale.set((size * w) / h, size, 1);
  s.setOpacity = (v) => { m.opacity = v; s.visible = v > 0.002; };
  return s;
}

// A soft glow cloud around a sphere: brightest at the sphere's edge, fading to nothing at `radius`. Reads as an
// electron cloud or a charge halo. BackSide + depth test, so the sphere it surrounds hides its middle.
function haloShell(radius, color, { intensity = 1, power = 2.2 } = {}) {
  const u = { uColor: { value: C(color) }, uI: { value: intensity }, uP: { value: power } };
  const m = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide, fog: false,
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uI, uP; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), uP); gl_FragColor = vec4(uColor * uI * f, f); }`,
  });
  const s = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), m);
  s.renderOrder = 2;
  s.setIntensity = (v) => { u.uI.value = intensity * v; s.visible = v > 0.001; };
  return s;
}

// An exact circle (or several turns of one) as a curve, so tubes and tails along it are evenly spaced.
class CircleCurve extends THREE.Curve {
  constructor(radius, e1, e2, turns = 1, phase = 0) { super(); this.r = radius; this.e1 = e1.clone(); this.e2 = e2.clone(); this.turns = turns; this.phase = phase; }
  getPoint(s, target = new V3()) { const a = this.phase + s * this.turns * Math.PI * 2; return target.copy(this.e1).multiplyScalar(this.r * Math.cos(a)).addScaledVector(this.e2, this.r * Math.sin(a)); }
}
// A comet tail along a curve: bright at the head, fading over `len` (in curve units 0..1). setHead(u, len).
function tailTube(curve, { radius = 0.012, color = '#ffffff', intensity = 3, segments = 512, radial = 8, geometry = null } = {}) {
  const u = { uColor: { value: C(color) }, uI: { value: intensity }, uHead: { value: 0 }, uLen: { value: 0.1 } };
  const m = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false,
    vertexShader: `varying float vU; void main(){ vU = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uI, uHead, uLen; varying float vU; void main(){ float d = uHead - vU; if (d < 0.0 || d > uLen) discard; float a = pow(1.0 - d / uLen, 1.8); gl_FragColor = vec4(uColor * uI * a, a); }`,
  });
  const mesh = new THREE.Mesh(geometry || new THREE.TubeGeometry(curve, segments, radius, radial, false), m);
  mesh.frustumCulled = false;
  mesh.setHead = (head, len) => { u.uHead.value = head; u.uLen.value = Math.max(1e-4, len); };
  mesh.setIntensity = (v) => { u.uI.value = intensity * v; mesh.visible = v > 0.001; };
  return mesh;
}

// A studio light environment for one prop's materials (material.envMap), so metal and polished silicon read as
// shiny even inside a dark night palette: a big warm softbox behind and above the subject, a cool strip on each side,
// a soft top fill. Float (HDR) values, so its reflections bloom. Built once and shared.
let productEnvTex = null;
export function productEnv() {
  if (productEnvTex) return productEnvTex;
  const w = 512, h = 256, d = new Float32Array(w * h * 4);
  const sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const box = (u, v, u0, u1, v0, v1, f = 0.015) => sm(u0 - f, u0 + f, u) * (1 - sm(u1 - f, u1 + f, u)) * sm(v0 - f, v0 + f, v) * (1 - sm(v1 - f, v1 + f, v));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = (x + 0.5) / w, v = (y + 0.5) / h; // v = 1 is straight up; u = 0.25 faces -z, 0.75 faces +z
    const sky = 0.025 + 0.05 * sm(0.4, 1, v);
    const key = 4.2 * box(u, v, 0.12, 0.38, 0.6, 0.84, 0.03);
    const top = 1.1 * sm(0.88, 0.97, v);
    const right = 2.4 * box(u, v, 0.475, 0.525, 0.45, 0.78), left = 1.6 * (box(u, v, 0.965, 1.02, 0.45, 0.78) + box(u, v, -0.02, 0.035, 0.45, 0.78));
    const front = 0.7 * box(u, v, 0.6, 0.9, 0.52, 0.58);
    const i = (y * w + x) * 4;
    d[i] = sky * 0.8 + key * 1.0 + top + right * 0.82 + left * 0.85 + front; d[i + 1] = sky * 0.9 + key * 0.95 + top + right * 0.9 + left * 0.92 + front; d[i + 2] = sky * 1.2 + key * 0.86 + top + right * 1.0 + left * 1.0 + front; d[i + 3] = 1;
  }
  productEnvTex = new THREE.DataTexture(d, w, h, THREE.RGBAFormat, THREE.FloatType);
  productEnvTex.mapping = THREE.EquirectangularReflectionMapping; productEnvTex.colorSpace = THREE.LinearSRGBColorSpace;
  productEnvTex.minFilter = productEnvTex.magFilter = THREE.LinearFilter; productEnvTex.needsUpdate = true;
  productEnvTex.userData.shared = true; // never disposed with a shot (seq.js)
  return productEnvTex;
}

// A smooth thin-film thickness map (sweeping bands plus soft rings), so iridescence shifts colour across a surface
// the way a polished wafer throws rainbows, instead of one flat tint. Uses the G channel, as three.js expects.
function filmMap(seed = 1, size = 256) {
  const c = makeCanvas(size, size), g = c.getContext('2d'), img = g.createImageData(size, size), R = rng(seed);
  const a = R() * 6.283, f1 = 0.45 + R() * 0.35, f2 = 0.8 + R() * 0.6, ph = R() * 6.283;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size - 0.5, v = y / size - 0.5, r = Math.hypot(u, v);
    const t = 0.5 + 0.32 * Math.sin((u * Math.cos(a) + v * Math.sin(a)) * f1 * 6.283 + ph) + 0.18 * Math.sin(r * f2 * 6.283);
    const i = (y * size + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(255 * clamp(t)); img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return canvasTexture(c, { srgb: false });
}

// Glass-like atom surface without the cost or the flat look of real transmission: a clearcoat shell with light that
// seems to come from inside (bright, saturated core fading to a darker body, a coloured rim), like a lit marble.
function gemMaterial(col, { core = 0.75, rim = 0.5, glow = 0, envI = 1.2 } = {}) {
  const c = C(col), white = new THREE.Color(1, 1, 1);
  const m = new THREE.MeshPhysicalMaterial({ color: c.clone().multiplyScalar(0.5), roughness: 0.3, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.3, sheen: 0.6, sheenColor: c.clone().lerp(white, 0.35), sheenRoughness: 0.45, envMapIntensity: envI, emissive: c, emissiveIntensity: glow });
  const U = { gemCol: { value: c.clone() }, gemCore: { value: core }, gemRim: { value: rim } };
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U);
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 gemCol; uniform float gemCore; uniform float gemRim;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ float nv = clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0); totalEmissiveRadiance += gemCol * (gemCore * pow(nv, 2.2) + gemRim * pow(1.0 - nv, 3.0)); }');
  };
  m.customProgramCacheKey = () => 'gem';
  return m;
}

// =====================================================================================================================
// MOLECULES
// =====================================================================================================================
// Element look-up: colour (CPK-inspired, toned for dark cinematic scenes), covalent and van der Waals radii in angstrom.
export const ELEMENTS = {
  H: { color: '#eef2f8', cov: 0.31, vdw: 1.10 }, He: { color: '#d8fbff', cov: 0.28, vdw: 1.40 },
  C: { color: '#3d434f', cov: 0.76, vdw: 1.70 }, N: { color: '#4d7bff', cov: 0.71, vdw: 1.55 },
  O: { color: '#ff4a40', cov: 0.66, vdw: 1.52 }, F: { color: '#8fe27c', cov: 0.57, vdw: 1.47 },
  Na: { color: '#a77bff', cov: 1.66, vdw: 2.27 }, Mg: { color: '#6ad893', cov: 1.41, vdw: 1.73 },
  Si: { color: '#d8b47a', cov: 1.11, vdw: 2.10 }, P: { color: '#ff9b3d', cov: 1.07, vdw: 1.80 },
  S: { color: '#ffd23f', cov: 1.05, vdw: 1.80 }, Cl: { color: '#46d47e', cov: 1.02, vdw: 1.75 },
  K: { color: '#8f5cff', cov: 2.03, vdw: 2.75 }, Ca: { color: '#7fd36b', cov: 1.76, vdw: 2.31 },
  Fe: { color: '#d8743c', cov: 1.32, vdw: 2.00 }, Cu: { color: '#d88a52', cov: 1.32, vdw: 1.40 },
  Au: { color: '#f2c14e', cov: 1.36, vdw: 1.66 },
};

const tet = (i, L) => { const th = 109.47 * (Math.PI / 180), ph = (i * 2 * Math.PI) / 3; return [Math.sin(th) * Math.cos(ph) * L, Math.cos(th) * L, Math.sin(th) * Math.sin(ph) * L]; };
const pyr = (i, L) => { const ph = Math.PI / 2 + (i * 2 * Math.PI) / 3; return [0.933 * Math.cos(ph) * L, -0.36 * L, 0.933 * Math.sin(ph) * L]; };
// Real geometry in angstrom (1 unit = 1 A at scale 1). q: partial charge sign for the charge markers.
export const MOLECULES = {
  water: { atoms: [{ el: 'O', pos: [0, -0.2933, 0], q: -1 }, { el: 'H', pos: [-0.7577, 0.2933, 0], q: 1 }, { el: 'H', pos: [0.7577, 0.2933, 0], q: 1 }], bonds: [[0, 1, 1], [0, 2, 1]] },
  co2: { atoms: [{ el: 'C', pos: [0, 0, 0], q: 1 }, { el: 'O', pos: [-1.16, 0, 0], q: -1 }, { el: 'O', pos: [1.16, 0, 0], q: -1 }], bonds: [[0, 1, 2], [0, 2, 2]] },
  methane: { atoms: [{ el: 'C', pos: [0, 0, 0] }, { el: 'H', pos: [0, 1.09, 0] }, { el: 'H', pos: tet(0, 1.09) }, { el: 'H', pos: tet(1, 1.09) }, { el: 'H', pos: tet(2, 1.09) }], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]] },
  ammonia: { atoms: [{ el: 'N', pos: [0, 0.12, 0], q: -1 }, { el: 'H', pos: pyr(0, 1.01).map((v, j) => v + (j === 1 ? 0.12 : 0)), q: 1 }, { el: 'H', pos: pyr(1, 1.01).map((v, j) => v + (j === 1 ? 0.12 : 0)), q: 1 }, { el: 'H', pos: pyr(2, 1.01).map((v, j) => v + (j === 1 ? 0.12 : 0)), q: 1 }], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1]] },
  oxygen: { atoms: [{ el: 'O', pos: [-0.605, 0, 0] }, { el: 'O', pos: [0.605, 0, 0] }], bonds: [[0, 1, 2]] },
  nitrogen: { atoms: [{ el: 'N', pos: [-0.55, 0, 0] }, { el: 'N', pos: [0.55, 0, 0] }], bonds: [[0, 1, 3]] },
  hydrogen: { atoms: [{ el: 'H', pos: [-0.37, 0, 0] }, { el: 'H', pos: [0.37, 0, 0] }], bonds: [[0, 1, 1]] },
};

const atomRadius = (el, model, scale, k = 1) => { const e = ELEMENTS[el] || ELEMENTS.C; return (model === 'space' ? e.vdw * 0.68 : e.vdw * 0.26) * scale * k; };

// Light from within a shell: an emissive term brightest where the surface faces the camera (inner, the glow of the core
// diffused through the shell) plus a faint lit rim (rim). It never goes dark at the silhouette, so no black ring.
function shellGlow(m, col, inner, rim) {
  const U = { uSGC: { value: col.clone() }, uSGIn: { value: inner }, uSGRim: { value: rim } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uSGC; uniform float uSGIn, uSGRim;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ float nv = clamp(dot(normalize(normal), normalize(vViewPosition)), 0., 1.); totalEmissiveRadiance += uSGC * (uSGIn * pow(nv, 1.6) + uSGRim * pow(1. - nv, 2.5)); }');
  };
  m.customProgramCacheKey = () => 'shellGlow';
  return m;
}

// Atom materials. 'pearl' (default): a frosted translucent pearl lit from inside (a soft transmissive shell in the
// element's colour around a glowing core): the premium hero look. 'glass': a clear glass shell around a glossy coloured
// core. 'soft': a clearcoat marble lit from within (cheaper). 'matte': no clearcoat and broad highlights, for crowds out
// of focus (pinpoint highlights multiply into lattices there). 'glossy': candy plastic. r: the atom's radius (pearl's
// depth and absorption follow it). env 'product' (default): pearl and glass shells reflect the product studio, so in a
// dark world their silhouettes catch light instead of mirroring the dark into a black ring ('scene': the shot's env).
function atomMaterials(el, { style = 'pearl', glow = 0, colors = null, scale = 1, r = 0.4 * scale, envI = 1.2, env = 'product' } = {}) {
  const col = C((colors && colors[el]) || (ELEMENTS[el] || ELEMENTS.C).color);
  const white = new THREE.Color(1, 1, 1), light = col.clone().lerp(white, 0.55), PE = env === 'scene' ? null : productEnv();
  if (style === 'soft') { const m = gemMaterial(col, { glow, envI, core: el === 'H' ? 0.42 : el === 'C' ? 0.5 : 0.7 }); return { shell: m, core: m }; }
  if (style === 'matte') { const m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.55, metalness: 0, envMapIntensity: 0.5, emissive: col, emissiveIntensity: glow }); return { shell: m, core: m }; }
  if (style === 'pearl') {
    return {
      shell: shellGlow(new THREE.MeshPhysicalMaterial({ color: col.clone().lerp(white, 0.15), roughness: 0.32, metalness: 0, transmission: 0.4, thickness: 0.6 * r, ior: 1.3, attenuationColor: col.clone().lerp(white, 0.55), attenuationDistance: 2.5 * r, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.6, sheenColor: col.clone().lerp(white, 0.6), sheenRoughness: 0.4, envMap: PE, envMapIntensity: PE ? 0.4 : envI }), col, 0.3, 0.1),
      core: new THREE.MeshStandardMaterial({ color: col, roughness: 0.6, metalness: 0, emissive: col, emissiveIntensity: 0.7 + glow, envMapIntensity: envI }),
    };
  }
  if (style === 'glass') {
    // a long attenuation, the studio's reflections and a faint lit rim keep the silhouette from going black
    return {
      shell: shellGlow(new THREE.MeshPhysicalMaterial({ color: col.clone().lerp(white, 0.78), roughness: 0.04, metalness: 0, transmission: 1, thickness: 0.3 * scale, ior: 1.22, attenuationColor: col.clone().lerp(white, 0.35), attenuationDistance: 8 * scale, clearcoat: 1, clearcoatRoughness: 0.08, specularIntensity: 1, sheen: 1, sheenColor: col.clone().lerp(white, 0.6).multiplyScalar(0.7), sheenRoughness: 0.3, envMap: PE, envMapIntensity: PE ? 1.0 : envI * (2.0 / 1.2) }), col.clone().lerp(white, 0.5), 0, 0.35),
      core: new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.26, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.14, sheen: 0.5, sheenColor: light, sheenRoughness: 0.4, emissive: col, emissiveIntensity: (el === 'H' ? 0.12 : 0.3) + glow, envMapIntensity: envI }),
    };
  }
  const m = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.2, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.8, sheenColor: light, sheenRoughness: 0.35, envMapIntensity: envI, emissive: col, emissiveIntensity: glow });
  return { shell: m, core: m };
}

// molecule({ atoms: [{ el: 'O', pos: [x,y,z], q: -1 }, ...], bonds: [[i, j, order], ...] }) -> Group
//   model: 'ball' (ball-and-stick) | 'space' (space-filling); style: 'pearl' (default) | 'glass' | 'soft' | 'matte' |
//   'glossy'; scale: units per angstrom; env 'product' (default) | 'scene': what pearl and glass shells reflect
//   bonds: omit to connect every pair closer than their covalent radii; bondStyle: 'neutral' | 'split' (half per atom)
//   charges: true shows the partial-charge clouds and the delta signs (atoms with q); setCharges(0..1) fades them all,
//   setCharge(i, 0..1) one atom's (an index or an anchor name: setCharge('O', 1) lands the minus on its word);
//   signOffset: how far past its atom's surface a delta sign sits (0.29 x scale)
// mol.at(t, { vibrate: 0.06, freq: 1.5 }) stretches the bonds as a pure function of time. mol.atoms[i] are the atom
// meshes; they are also the anchors, named by element and numbered when an element repeats (water: O, H1, H2), and
// mol.anchor(i) still takes an index. mol.userData.radius is the bounding radius for cam.fit / cam.frame.
export function molecule(o = {}) {
  const { atoms = [], style = 'pearl', model = 'ball', scale = 1, bondRadius = 0.075, bondColor = '#dde3ec', bondStyle = 'neutral', segments = 64, center = true, glow = 0 } = o;
  const accent = accentOf(o), cool = coolOf(o);
  const g = new THREE.Group(); g.name = 'molecule';
  const P = atoms.map((a) => new V3(...a.pos).multiplyScalar(scale));
  if (center && P.length) { const c = new THREE.Box3().setFromPoints(P).getCenter(new V3()); P.forEach((p) => p.sub(c)); }
  let bonds = o.bonds;
  if (!bonds) {
    bonds = [];
    for (let i = 0; i < atoms.length; i++) for (let j = i + 1; j < atoms.length; j++) {
      const ci = (ELEMENTS[atoms[i].el] || ELEMENTS.C).cov, cj = (ELEMENTS[atoms[j].el] || ELEMENTS.C).cov;
      if (P[i].distanceTo(P[j]) < (ci + cj) * 1.25 * scale) bonds.push([i, j, 1]);
    }
  }
  const mats = new Map();
  const matsOf = (el) => { if (!mats.has(el)) mats.set(el, atomMaterials(el, { style, glow, colors: o.colors, scale, r: atomRadius(el, model, scale, o.atomScale ?? 1), env: o.env })); return mats.get(el); };
  const atomMeshes = atoms.map((a, i) => {
    const r = atomRadius(a.el, model, scale, o.atomScale ?? 1), M = matsOf(a.el);
    const m = shade(new THREE.Mesh(new THREE.SphereGeometry(r, segments, Math.round(segments * 0.75)), M.shell));
    m.position.copy(P[i]);
    if (style === 'glass') { const core = new THREE.Mesh(new THREE.SphereGeometry(r * 0.56, 48, 36), M.core); m.add(core); m.castShadow = false; core.castShadow = true; }
    // pearl: the shell casts the shadow and the glowing core never receives one (its own shell would put it out)
    if (style === 'pearl') { const core = new THREE.Mesh(new THREE.SphereGeometry(r * 0.55, 40, 30), M.core); core.castShadow = core.receiveShadow = false; m.add(core); }
    m.userData = { el: a.el, r, index: i, home: P[i].clone(), q: a.q || 0 };
    g.add(m);
    return m;
  });
  // the molecule's plane (double bonds sit side by side in it)
  const planeN = new V3(0, 0, 1);
  if (o.bondPlane) planeN.set(...o.bondPlane).normalize();
  else for (let i = 2; i < P.length; i++) { const n = new V3().subVectors(P[1], P[0]).cross(new V3().subVectors(P[i], P[0])); if (n.lengthSq() > 1e-6) { planeN.copy(n.normalize()); break; } }
  const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 28, 1, true);
  const neutral = new THREE.MeshPhysicalMaterial({ color: C(bondColor), roughness: 0.24, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.14, envMapIntensity: 1.1 });
  const bondMeshes = [];
  for (const [i, j, order = 1] of bonds) {
    const offs = order === 2 ? [-0.5, 0.5] : order === 3 ? [-1, 0, 1] : [0];
    const r = bondRadius * scale * (order > 1 ? 0.7 : 1), spacing = bondRadius * scale * (order === 3 ? 1.75 : 2.3);
    for (const k of offs) {
      const halves = bondStyle === 'split' ? [[i, 0, 0.5], [j, 0.5, 1]] : [[null, 0, 1]];
      for (const [ai, f0, f1] of halves) {
        const m = shade(new THREE.Mesh(unitCyl, ai == null ? neutral : matsOf(atoms[ai].el).core));
        g.add(m);
        bondMeshes.push({ m, i, j, k: k * spacing, f0, f1, r });
      }
    }
  }
  const _d = new V3(), _p = new V3(), _a = new V3(), _b = new V3(), Y = new V3(0, 1, 0);
  const placeBonds = () => {
    for (const b of bondMeshes) {
      const A = atomMeshes[b.i].position, B = atomMeshes[b.j].position;
      _d.subVectors(B, A); const L = _d.length(); _d.normalize();
      _p.crossVectors(_d, planeN); if (_p.lengthSq() < 1e-6) _p.crossVectors(_d, new V3(0, 1, 0)); if (_p.lengthSq() < 1e-6) _p.set(0, 0, 1); _p.normalize();
      _a.copy(A).addScaledVector(_d, L * b.f0).addScaledVector(_p, b.k); _b.copy(A).addScaledVector(_d, L * b.f1).addScaledVector(_p, b.k);
      b.m.position.addVectors(_a, _b).multiplyScalar(0.5);
      b.m.quaternion.setFromUnitVectors(Y, _d);
      b.m.scale.set(b.r, L * (b.f1 - b.f0), b.r);
    }
  };
  placeBonds();
  // partial charges: a soft coloured cloud and a delta sign beside each charged atom
  const chargeFx = new Map(); // atom index -> { halo, s }
  atomMeshes.forEach((m, i) => {
    const q = m.userData.q; if (!q) return;
    const r = m.userData.r, col = q < 0 ? (o.negColor || cool) : (o.posColor || accent);
    const halo = haloShell(r * (model === 'space' ? 1.35 : 1.9), col, { intensity: 0.55, power: 1.6 });
    m.add(halo);
    const dir = m.userData.home.clone(); if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0); dir.normalize();
    dir.set(dir.x * 0.45, dir.y + (dir.y < 0 ? -0.9 : 0.9), dir.z * 0.45).normalize(); // lean vertical: portrait frames are narrow
    const s = textSprite(q < 0 ? 'δ−' : 'δ+', { size: (o.chargeSize ?? 0.32) * scale, color: '#ffffff' });
    s.position.copy(dir).multiplyScalar(r + (o.signOffset ?? 0.29 * scale)); // close in, so the sign stays near its atom in a tight frame
    m.add(s);
    chargeFx.set(i, { halo, s });
  });
  const atomIndex = (i) => (typeof i === 'number' ? i : atomMeshes.findIndex((m) => m.name === i));
  g.setCharge = (i, v) => { const c = chargeFx.get(atomIndex(i)); if (c) { c.halo.setIntensity(v); c.s.setOpacity(v); } };
  g.setCharges = (v) => { for (const c of chargeFx.values()) { c.halo.setIntensity(v); c.s.setOpacity(v); } };
  g.setCharges(o.charges ? 1 : 0);
  g.at = (t, { vibrate = 0, freq = 1.5, mode = 'stretch' } = {}) => {
    atomMeshes.forEach((m, i) => {
      m.position.copy(m.userData.home);
      if (!vibrate) return;
      const L = m.userData.home.length(); if (L < 1e-4) return;
      const ph = mode === 'asym' ? (i % 2) * Math.PI : 0;
      m.position.addScaledVector(m.userData.home, (vibrate * scale * Math.sin(2 * Math.PI * freq * t + ph)) / L);
    });
    placeBonds();
  };
  let R0 = 0; atomMeshes.forEach((m) => { R0 = Math.max(R0, m.position.length() + m.userData.r); });
  g.atoms = atomMeshes; g.bonds = bondMeshes.map((b) => b.m);
  const anchors = {}, seen = {};
  atoms.forEach((a) => { seen[a.el] = (seen[a.el] || 0) + 1; });
  const nth = {};
  atomMeshes.forEach((m, i) => { const el = atoms[i].el; nth[el] = (nth[el] || 0) + 1; m.name = seen[el] > 1 ? el + nth[el] : el; anchors[m.name] = m; });
  withAnchors(g, anchors);
  const byName = g.anchor;
  g.anchor = (n) => { if (typeof n !== 'number') return byName(n); if (atomMeshes[n]) return atomMeshes[n]; throw new Error(`molecule.anchor(${n}): it has ${atomMeshes.length} atoms (0..${atomMeshes.length - 1})`); };
  g.userData.radius = R0;
  return g;
}
export const water = (o = {}) => molecule({ ...MOLECULES.water, ...o });
export const co2 = (o = {}) => molecule({ ...MOLECULES.co2, ...o });
export const methane = (o = {}) => molecule({ ...MOLECULES.methane, ...o });
export const ammonia = (o = {}) => molecule({ ...MOLECULES.ammonia, ...o });

// Per-instance tint (rgb, amount) and glow (linear rgb x intensity) on an instanced material, from the geometry's aTint
// and aGlow attributes; it wraps any shader hook the material already has (the 'soft' gem).
function instanceLook(m) {
  const prev = m.onBeforeCompile, key = m.customProgramCacheKey();
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aTint; attribute vec3 aGlow; varying vec4 vITint; varying vec3 vIGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvITint = aTint; vIGlow = aGlow;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec4 vITint; varying vec3 vIGlow;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vITint.rgb, vITint.a);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vIGlow;');
  };
  m.customProgramCacheKey = () => key + '+inst';
  return m;
}

// moleculeCloud({ kind: 'water', count: 300, size: [8, 5, 6] }): many molecules as a few instanced meshes (one per
// element, plus bonds when model: 'ball'), each twisting about `axis` as a pure function of time. For "billions of
// molecules twisting in the field" shots. cloud.at(t, { twist: 0.6, freq: 2, axis, jitter: 0.02, drift: [x,y,z] }).
// Defaults to space-filling 'matte' atoms: crowds are mostly out of focus, where glass and pinpoint highlights multiply
// into lattices. shell: [rMin, rMax] fills a spherical shell around `center` instead of the box `size`, so a camera
// orbiting a hero inside rMin sees molecules in every direction. Per molecule (set in update, pure: they overwrite):
// cloud.setTint(i, color, k = 1) mixes its atoms towards a colour; cloud.setGlow(i, v, color = accent) makes them glow.
export function moleculeCloud(o = {}) {
  const { kind = 'water', count = 300, size = [8, 5, 6], scale = 0.35, seed = 11, model = 'space', bondRadius = 0.075, bondColor = '#dde3ec', shell = null, center = [0, 0, 0] } = o;
  const spec = typeof kind === 'string' ? MOLECULES[kind] : kind;
  const R = rng(seed);
  const P = spec.atoms.map((a) => new V3(...a.pos).multiplyScalar(scale));
  const c0 = new THREE.Box3().setFromPoints(P).getCenter(new V3()); P.forEach((p) => p.sub(c0));
  const C0 = new V3(...center);
  const place = () => {
    if (!shell) return new V3((R() - 0.5) * size[0], (R() - 0.5) * size[1], (R() - 0.5) * size[2]).add(C0);
    const [a, b] = shell, r = Math.cbrt(a ** 3 + R() * (b ** 3 - a ** 3)), u = R() * 2 - 1, ph = R() * 6.283, w = Math.sqrt(1 - u * u); // even in volume
    return new V3(Math.cos(ph) * w * r, u * r, Math.sin(ph) * w * r).add(C0);
  };
  const mols = Array.from({ length: count }, () => ({
    pos: place(),
    q: new THREE.Quaternion().setFromEuler(new THREE.Euler(R() * 6.283, R() * 6.283, R() * 6.283)), ph: R() * 6.283, s: 0.85 + R() * 0.3,
  }));
  const g = new THREE.Group();
  const byEl = {};
  spec.atoms.forEach((a, i) => (byEl[a.el] ||= []).push(i));
  const sphere = new THREE.SphereGeometry(1, 40, 28);
  const atomIMs = Object.entries(byEl).map(([el, idx]) => {
    const M = atomMaterials(el, { style: o.style || 'matte', glow: o.glow ?? 0, colors: o.colors, scale, r: atomRadius(el, model, scale) });
    const n = count * idx.length, geo = sphere.clone();
    const tint = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4), glowA = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    geo.setAttribute('aTint', tint); geo.setAttribute('aGlow', glowA);
    const im = shade(new THREE.InstancedMesh(geo, instanceLook(M.shell), n)); im.frustumCulled = false; g.add(im);
    return { im, idx, r: atomRadius(el, model, scale), tint, glowA };
  });
  const bondList = []; if (model !== 'space') for (const [i, j, order = 1] of spec.bonds || []) for (let k = 0; k < (order > 1 ? 2 : 1); k++) bondList.push([i, j, order > 1 ? (k - 0.5) * 2.3 * bondRadius * scale : 0, order > 1 ? 0.7 : 1]);
  const bondIM = bondList.length ? shade(new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 20, 1, true), new THREE.MeshPhysicalMaterial({ color: C(bondColor), roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 }), count * bondList.length)) : null;
  if (bondIM) { bondIM.frustumCulled = false; g.add(bondIM); }
  const ax = new V3(), dv = new V3(), jv = new V3(), _q = new THREE.Quaternion(), _qt = new THREE.Quaternion(), _m = new THREE.Matrix4(), _p = new V3(), _s = new V3(), W = P.map(() => new V3()), _d = new V3(), _n = new V3(), Y = new V3(0, 1, 0);
  g.at = (t, { twist = 0, freq = 2, axis = [0, 0, 1], jitter = 0, drift = [0, 0, 0] } = {}) => {
    ax.set(...axis).normalize(); dv.set(...drift);
    mols.forEach((M, mi) => {
      _qt.setFromAxisAngle(ax, twist * Math.sin(2 * Math.PI * freq * t + M.ph));
      _q.copy(_qt).multiply(M.q);
      _p.copy(M.pos).addScaledVector(dv, t);
      if (jitter) _p.add(jv.set(Math.sin(t * 7.1 + M.ph * 3), Math.sin(t * 6.3 + M.ph * 5), Math.sin(t * 5.7 + M.ph * 7)).multiplyScalar(jitter));
      P.forEach((a, ai) => W[ai].copy(a).multiplyScalar(M.s).applyQuaternion(_q).add(_p));
      for (const A of atomIMs) A.idx.forEach((ai, k) => { _s.setScalar(A.r * M.s); _m.compose(W[ai], _qt.identity(), _s); A.im.setMatrixAt(mi * A.idx.length + k, _m); });
      if (bondIM) bondList.forEach(([i, j, off, rk], bi) => {
        _d.subVectors(W[j], W[i]); const L = _d.length(); _d.normalize();
        _n.set(0, 0, 1).applyQuaternion(_q).cross(_d).normalize();
        _qt.setFromUnitVectors(Y, _d);
        _s.set(bondRadius * scale * rk * M.s, L, bondRadius * scale * rk * M.s);
        _m.compose(_p.copy(W[i]).add(W[j]).multiplyScalar(0.5).addScaledVector(_n, off * M.s), _qt, _s);
        bondIM.setMatrixAt(mi * bondList.length + bi, _m);
      });
    });
    for (const A of atomIMs) A.im.instanceMatrix.needsUpdate = true;
    if (bondIM) bondIM.instanceMatrix.needsUpdate = true;
  };
  g.at(0);
  const _tc = new THREE.Color(), acc = C(accentOf(o));
  g.setTint = (i, color, k = 1) => { _tc.set(color); for (const A of atomIMs) { for (let j = 0; j < A.idx.length; j++) A.tint.array.set([_tc.r, _tc.g, _tc.b, clamp(k)], (i * A.idx.length + j) * 4); A.tint.needsUpdate = true; } };
  g.setGlow = (i, v, color = acc) => { _tc.set(color).multiplyScalar(Math.max(0, v)); for (const A of atomIMs) { for (let j = 0; j < A.idx.length; j++) A.glowA.array.set([_tc.r, _tc.g, _tc.b], (i * A.idx.length + j) * 3); A.glowA.needsUpdate = true; } };
  g.molecules = mols; g.name = 'moleculeCloud';
  const extent = shell ? shell[1] : Math.hypot(...size) / 2;
  g.userData.radius = extent + P.reduce((r, p) => Math.max(r, p.length()), 0) + atomRadius('O', model, scale);
  g.userData.center = C0.clone();
  return withAnchors(g, {});
}

// dottedBond({ count 5, size .05, color '#ffffff', intensity 3, inset .18 }) -> InstancedMesh: a hydrogen bond (or any
// weak link) as a row of glowing dots between two points that can move. bond.set(A, B, p = 1, glow = 1) in every
// update: A and B are Vector3s in the bond's parent space, p draws the dots on in order, glow scales the brightness;
// inset keeps that fraction of the distance clear at each end (the atoms' own radius).
export function dottedBond({ count = 5, size = 0.05, color = '#ffffff', intensity = 3, inset = 0.18 } = {}) {
  const base = C(color).multiplyScalar(intensity);
  const m = new THREE.MeshBasicMaterial({ color: base.clone(), toneMapped: false, fog: false });
  const im = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), m, count);
  im.frustumCulled = false; im.name = 'dottedBond';
  const M = new THREE.Matrix4(), P = new V3(), Q = new THREE.Quaternion(), S = new V3();
  im.set = (A, B, p = 1, glow = 1) => {
    for (let i = 0; i < count; i++) {
      const f = count === 1 ? 0.5 : i / (count - 1);
      P.lerpVectors(A, B, inset + (1 - 2 * inset) * f);
      S.setScalar(Math.max(1e-5, size * clamp(p * count - i))); M.compose(P, Q, S); im.setMatrixAt(i, M);
    }
    im.instanceMatrix.needsUpdate = true;
    m.color.copy(base).multiplyScalar(Math.max(0, glow));
    im.visible = p > 0.001 && glow > 0.002;
  };
  return im;
}

// =====================================================================================================================
// ATOM (Bohr model)
// =====================================================================================================================
const fillShells = (n) => { const caps = [2, 8, 8, 18, 18, 32], s = []; for (const c of caps) { if (n <= 0) break; s.push(Math.min(c, n)); n -= c; } return s.length ? s : [1]; };
// Nucleons packed in a ball: golden-spiral start, then deterministic relaxation (no overlaps, no randomness).
function packBall(n, R) {
  const r = n === 1 ? R * 0.8 : R * Math.cbrt(0.58 / n), P = [], ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) { const rr = R * Math.cbrt((i + 0.5) / n) * 0.85, y = 1 - (2 * (i + 0.5)) / n, s = Math.sqrt(1 - y * y), th = ga * i; P.push(new V3(Math.cos(th) * s * rr, y * rr, Math.sin(th) * s * rr)); }
  const d = new V3();
  for (let it = 0; it < 80; it++) {
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { d.subVectors(P[i], P[j]); const L = d.length() || 1e-4; if (L < 2 * r) { d.multiplyScalar((2 * r - L) / L / 2); P[i].add(d); P[j].sub(d); } }
    for (const p of P) p.multiplyScalar(0.985);
  }
  return { P, r };
}

// atom({ shells: [2, 8, 1] } | { electrons: 11 }) -> Group. A glossy nucleus of protons (accent) and neutrons, faint
// orbit rings and electrons with comet tails. atom.at(t) moves the electrons (pure); tilt 0 lays every shell flat.
//   anchors: nucleus, shell0, shell1, ... (a point on each ring; anchors.shells[k] is the same list);
//   atom.electrons[i] are meshes for labels.
export function atom(o = {}) {
  const { radius = 1.5, nucleusRadius = 0.26, tilt = 1, speed = 1, trail = 0.22, ringIntensity = 0.55, electronSize = 0.042, glow = 1 } = o;
  const accent = accentOf(o), cool = coolOf(o);
  const shells = o.shells || fillShells(o.electrons ?? 6);
  const Z = shells.reduce((a, b) => a + b, 0);
  const protons = o.protons ?? Z, neutrons = o.neutrons ?? Math.max(0, Math.round(protons * 1.08));
  const g = new THREE.Group(); g.name = 'atom';
  // nucleus
  const nucleus = new THREE.Group(); g.add(nucleus);
  const N = Math.max(1, Math.min(90, protons + neutrons)), np = Math.max(1, Math.round((N * protons) / Math.max(1, protons + neutrons)));
  const { P, r } = packBall(N, nucleusRadius);
  const R = rng(o.seed ?? 2), order = P.map((_, i) => i).sort(() => R() - 0.5);
  const ball = new THREE.SphereGeometry(1, 36, 24);
  const pCol = C(o.protonColor || accent), nCol = C(o.neutronColor || '#c9d0dc');
  const pMat = new THREE.MeshPhysicalMaterial({ color: pCol, roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.06, sheen: 0.6, sheenColor: pCol.clone().lerp(new THREE.Color(1, 1, 1), 0.5), emissive: pCol, emissiveIntensity: 0.12 * glow });
  const nMat = new THREE.MeshPhysicalMaterial({ color: nCol, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.06 });
  const pIM = shade(new THREE.InstancedMesh(ball, pMat, np)), nIM = shade(new THREE.InstancedMesh(ball, nMat, Math.max(1, N - np)));
  const _m = new THREE.Matrix4();
  order.forEach((pi, k) => { _m.makeScale(r, r, r).setPosition(P[pi]); if (k < np) pIM.setMatrixAt(k, _m); else nIM.setMatrixAt(k - np, _m); });
  if (N - np <= 0) nIM.visible = false;
  nucleus.add(pIM, nIM);
  const nGlow = glowSprite({ color: accent, intensity: 0.35 * glow, size: nucleusRadius * 7 }); nucleus.add(nGlow);
  // shells
  const ringGroup = new THREE.Group(); g.add(ringGroup);
  const anchors = { nucleus: pin(g, [0, 0, 0], 'nucleus') }, shellAnchors = [];
  Object.defineProperty(anchors, 'shells', { value: shellAnchors, enumerable: false });
  const electrons = [], tails = [], halos = [], specs = [];
  const eGeo = new THREE.SphereGeometry(electronSize, 20, 14);
  const eMat = new THREE.MeshBasicMaterial({ color: hot('#ffffff', 6 * glow), toneMapped: false });
  shells.forEach((n, k) => {
    const rk = nucleusRadius * 2.2 + ((radius - nucleusRadius * 2.2) * (k + 1)) / shells.length;
    const axis = new V3(Math.cos(k * 1.17), 0, Math.sin(k * 1.17)).normalize();
    const q = new THREE.Quaternion().setFromAxisAngle(axis, THREE.MathUtils.degToRad(tilt * (16 + 21 * k) * (k % 2 ? -1 : 1)));
    const e1 = new V3(1, 0, 0).applyQuaternion(q), e2 = new V3(0, 0, -1).applyQuaternion(q);
    const ringCurve = new CircleCurve(rk, e1, e2, 1);
    const ring = tube(ringCurve, { radius: o.ringWidth ?? 0.0055, color: o.ringColor || cool, intensity: ringIntensity, segments: 360, radial: 6, core: false });
    ringGroup.add(ring);
    shellAnchors.push(anchors['shell' + k] = pin(g, ringCurve.getPoint(0.25).toArray(), 'shell' + k));
    const tailGeo = new THREE.TubeGeometry(new CircleCurve(rk, e1, e2, 2), 720, electronSize * 0.55, 8, false);
    const w = (speed * 2 * Math.PI * 0.42) / (1 + 0.55 * k);
    for (let j = 0; j < n; j++) {
      const e = new THREE.Mesh(eGeo, eMat); g.add(e); electrons.push(e);
      const h = glowSprite({ color: o.electronColor || cool, intensity: 0.9 * glow, size: electronSize * 9 }); g.add(h); halos.push(h);
      const tl = tailTube(null, { geometry: tailGeo, color: o.electronColor || cool, intensity: 2.2 * glow }); g.add(tl); tails.push(tl);
      specs.push({ e1, e2, rk, th0: k * 0.9 + (j / n) * Math.PI * 2, w, trail: Math.min(trail, 0.7 / n) });
    }
  });
  const _p = new V3();
  g.at = (t) => {
    specs.forEach((s, i) => {
      const th = s.th0 + s.w * t, a = ((th % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      _p.copy(s.e1).multiplyScalar(s.rk * Math.cos(a)).addScaledVector(s.e2, s.rk * Math.sin(a));
      electrons[i].position.copy(_p); halos[i].position.copy(_p);
      tails[i].setHead((2 * Math.PI + a) / (4 * Math.PI), s.trail / 2);
    });
    nucleus.rotation.set(t * 0.11, t * 0.23, 0);
  };
  g.setGlow = (v) => { eMat.color.copy(hot('#ffffff', 6 * v)); halos.forEach((h) => h.setIntensity(0.9 * v)); tails.forEach((tl) => tl.setIntensity(v)); };
  g.at(0);
  g.electrons = electrons; g.nucleus = nucleus; g.rings = ringGroup.children;
  g.userData.radius = radius + 0.1;
  return withAnchors(g, anchors);
}

// =====================================================================================================================
// TRANSISTOR
// =====================================================================================================================
// Metal greys: a transistor reads as a machined part, and the accent stays for the one thing that is active (the
// channel when it conducts, the gate contact when it gets its voltage). Blue plastic read as a toy.
const TR_COLORS = { base: '#14171c', oxide: '#2b2f37', fin: '#8b94a3', body: '#353a44', gate: '#b8bdc6', spacer: '#5d636e', metal: '#d2b48a' };
// The parts of one stylised transistor, 1.36 x 1.04 footprint, ~1.5 tall. kind 'finfet' (vertical fins through the
// gate) or 'sheets' (gate-all-around: stacked horizontal nanosheets, reads best from the front).
function transistorSpec({ kind = 'finfet', fins = 3 } = {}) {
  const parts = [], finY = [], finZ = [];
  const add = (part, geo, x, y, z) => parts.push({ part, geo, pos: [x, y, z] });
  const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 6, 28);
  add('base', rbox(1.36, 0.16, 1.04, 0.05), 0, 0.08, 0);
  add('oxide', rbox(1.3, 0.05, 0.98, 0.02), 0, 0.185, 0);
  if (kind === 'sheets') for (let i = 0; i < fins; i++) { const y = 0.3 + i * 0.135; add('fin', rbox(1.22, 0.07, 0.66, 0.034), 0, y, 0); finY.push(y); }
  else for (let i = 0; i < fins; i++) { const z = (i - (fins - 1) / 2) * 0.25; add('fin', rbox(1.22, 0.3, 0.09, 0.04), 0, 0.36, z); finZ.push(z); }
  add('body', rbox(0.3, 0.5, 0.92, 0.07), -0.5, 0.46, 0);
  add('body', rbox(0.3, 0.5, 0.92, 0.07), 0.5, 0.46, 0);
  add('gate', rbox(0.24, 0.66, 1.0, 0.07), 0, 0.54, 0);
  add('spacer', rbox(0.03, 0.62, 0.99, 0.012), -0.136, 0.52, 0);
  add('spacer', rbox(0.03, 0.62, 0.99, 0.012), 0.136, 0.52, 0);
  for (const x of [-0.5, 0.5]) add('metal', capsule(0.05, 0.2), x, 0.84, 0);
  add('pin', capsule(0.06, 0.42), 0, 1.11, 0);
  return { parts, finY, finZ, kind };
}
// Materials: a dark substrate, a satin oxide, silicon fins (semi-metal; they glow when the channel conducts), etched
// source and drain blocks, a brushed metal gate, dielectric spacers and copper-warm contacts. Two or more roughness
// levels on every part, so the metals separate under one light. env 'product' (default) reflects the product studio,
// so the metals read as grey metal in a night world (in the night env they mirror its navy and read as blue plastic).
function transistorMaterials(col, accent, xray = false, { env = 'product', envIntensity = 0.6 } = {}) {
  const glass = (c) => new THREE.MeshPhysicalMaterial({ color: C(c).lerp(new THREE.Color(1, 1, 1), 0.7), roughness: 0.5, transmission: 1, thickness: 0.5, ior: 1.15, specularIntensity: 0.35, attenuationColor: C(c).lerp(new THREE.Color(1, 1, 1), 0.4), attenuationDistance: 1.6, envMapIntensity: 0.5 });
  const gate = mat.brushed(col.gate, { rough: 0.32, aniso: 0.5, extra: { emissive: C(accent), emissiveIntensity: 0 } });
  const M = {
    base: mat.plastic(col.base, { rough: 0.5, clearcoat: 0.25, ccRough: 0.3 }),
    oxide: mat.plastic(col.oxide, { rough: 0.6, clearcoat: 0.15, ccRough: 0.3 }),
    fin: mat.lit(col.fin, accent, 0, { rough: 0.3, metal: 0.55, clearcoat: 0.6, extra: { clearcoatRoughness: 0.2 } }),
    body: xray ? glass(col.body) : new THREE.MeshPhysicalMaterial({ color: C(col.body), roughness: 0.42, metalness: 0.75, clearcoat: 0.3, clearcoatRoughness: 0.3, envMapIntensity: 1.1 }),
    gate: xray ? glass(col.gate) : gate,
    spacer: mat.plastic(col.spacer, { rough: 0.45, clearcoat: 0.2, ccRough: 0.3 }),
    metal: mat.metal(col.metal, { rough: 0.3 }),
    pin: mat.lit(col.metal, accent, 0, { rough: 0.3, metal: 1, clearcoat: 0 }),
  };
  if (env !== 'scene') for (const [k, m] of Object.entries(M)) if (!(xray && (k === 'body' || k === 'gate'))) { m.envMap = productEnv(); m.envMapIntensity = envIntensity * (m.metalness > 0.5 ? 1 : 0.6); }
  return M;
}
// Electrons racing source -> drain along the fin surfaces (visible in the gaps between gate and source/drain).
function electronSwarm(spec, { count = 120, accent, seed = 21 }) {
  const geo = rbox(0.075, 0.013, 0.013, 0.0064, 2);
  const m = new THREE.MeshBasicMaterial({ color: hot(C('#fff3dc').lerp(C(accent), 0.35), 9), toneMapped: false });
  const mesh = new THREE.InstancedMesh(geo, m, count); mesh.frustumCulled = false;
  const R = rng(seed), lanes = [];
  if (spec.kind === 'sheets') for (const y of spec.finY) lanes.push((e) => { e.y = y + 0.047; e.z = (R() - 0.5) * 0.6; }, (e) => { e.y = y - 0.047; e.z = (R() - 0.5) * 0.6; }, (e) => { e.y = y + (R() - 0.5) * 0.05; e.z = 0.345; });
  else for (const z of spec.finZ) lanes.push((e) => { e.y = 0.24 + R() * 0.25; e.z = z + 0.058; }, (e) => { e.y = 0.24 + R() * 0.25; e.z = z - 0.058; }, (e) => { e.y = 0.522; e.z = z + (R() - 0.5) * 0.06; });
  const E = Array.from({ length: count }, () => { const e = { s0: R(), v: 0.35 + R() * 0.55, w: 0.6 + R() * 0.8 }; lanes[Math.floor(R() * lanes.length)](e); return e; });
  const _m = new THREE.Matrix4(), _p = new V3(), _q = new THREE.Quaternion(), _s = new V3();
  const S = { mesh, level: 0 };
  S.place = (t) => {
    for (let i = 0; i < count; i++) {
      const e = E[i], x = -0.64 + 1.28 * frac(e.s0 + t * e.v), s = S.level * clamp((0.64 - Math.abs(x)) / 0.12);
      if (s <= 0.01) _m.makeScale(0, 0, 0); else _m.compose(_p.set(x, e.y, e.z), _q, _s.set(e.w, s, s));
      mesh.setMatrixAt(i, _m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  return S;
}

// transistor({ kind: 'finfet' | 'sheets', fins: 3, pal }) -> Group. setOn(0..1) lights the gate contact and the
// channel (fins glow, electrons stream source -> drain); setGate / setChannel drive them separately so the voltage can
// arrive first. tr.at(t) moves the electrons (pure). xray: true makes gate and source/drain frosted glass so the
// channel shows through. From the front (camera on +z) 'sheets' reads best: stacked glowing bars either side of the
// gate; 'finfet' shows its fins from a raised three-quarter view.
//   anchors: tr.anchors.gate / source / drain / channel. colors: override any of base, oxide, fin, body, gate,
//   spacer, metal (defaults: metal greys, copper-warm contacts). env 'product' | 'scene', envIntensity .6.
//   Size: 1.36 wide, 1.04 deep, 1.45 tall.
export function transistor(o = {}) {
  const spec = transistorSpec(o), accent = accentOf(o);
  const M = transistorMaterials({ ...TR_COLORS, ...(o.colors || {}) }, accent, o.xray, o);
  const g = new THREE.Group(), parts = {}; g.name = 'transistor';
  for (const p of spec.parts) { const m = shade(new THREE.Mesh(p.geo, M[p.part])); m.position.set(...p.pos); g.add(m); (parts[p.part] ||= []).push(m); }
  const halo = glowSprite({ color: accent, intensity: 0, size: 1.6, position: [0, 0.42, 0] }); g.add(halo);
  const pinGlow = glowSprite({ color: accent, intensity: 0, size: 0.8, position: [0, 1.4, 0] }); g.add(pinGlow);
  const E = electronSwarm(spec, { count: o.electrons ?? 140, accent, seed: o.seed ?? 21 }); g.add(E.mesh);
  // the gate's voltage: the contact on top glows; the brushed gate only warms (the accent belongs to the active part)
  g.setGate = (v) => { M.pin.emissiveIntensity = v * 7; if (M.gate.emissive) M.gate.emissiveIntensity = v * 0.12; pinGlow.setIntensity(v * 0.7); };
  g.setChannel = (v) => { M.fin.emissiveIntensity = v * 2.0; halo.setIntensity(v * 0.45); E.level = v; };
  g.setOn = (v) => { g.setGate(v); g.setChannel(v); };
  g.at = (t) => E.place(t);
  g.anchors = { gate: pin(g, [0, 1.44, 0], 'gate'), source: pin(g, [-0.5, 1.0, 0], 'source'), drain: pin(g, [0.5, 1.0, 0], 'drain'), channel: pin(g, [0, 0.4, 0.52], 'channel') };
  g.parts = parts; g.materials = M; g.spec = spec;
  g.setOn(o.on ?? 0); g.at(0);
  g.userData.radius = 0.95; g.userData.center = new V3(0, 0.72, 0);
  return withAnchors(g);
}

// transistorArray({ cols: 15, rows: 15, spacing: 1.75, skip: (c, r) => bool }) -> Group of instanced transistors (one
// draw call per material), for the "billions of them" wide shot. arr.setOn(i, v), arr.on((i, c, r) => v),
// arr.index(c, r), arr.pos(i). Leave a cell empty with skip and put a hero transistor() there.
export function transistorArray(o = {}) {
  const { cols = 15, rows = 15, spacing = 1.75, skip = null } = o;
  const spec = transistorSpec(o), accent = accentOf(o);
  const M = transistorMaterials({ ...TR_COLORS, ...(o.colors || {}) }, accent, false, o);
  for (const m of Object.values(M)) { if (m.clearcoat) { m.clearcoat *= 0.5; m.clearcoatRoughness = Math.max(m.clearcoatRoughness, 0.3); } m.roughness = Math.max(m.roughness, 0.38); }
  const cells = []; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (!skip || !skip(c, r)) cells.push([c, r]);
  const n = cells.length, g = new THREE.Group();
  const posOf = (c, r, v = new V3()) => v.set((c - (cols - 1) / 2) * spacing, 0, (r - (rows - 1) / 2) * spacing);
  const _m = new THREE.Matrix4(), _v = new V3();
  const groups = {};
  for (const p of spec.parts) (groups[p.part] ||= []).push(p.geo.clone().translate(...p.pos));
  for (const [part, geos] of Object.entries(groups)) {
    const im = shade(new THREE.InstancedMesh(merge(geos), M[part], n));
    cells.forEach(([c, r], i) => { _m.makeTranslation(posOf(c, r, _v)); im.setMatrixAt(i, _m); });
    im.computeBoundingSphere(); g.add(im);
  }
  const finGeo = merge(spec.parts.filter((p) => p.part === 'fin').map((p) => p.geo.clone().scale(1.015, 1.04, 1.12).translate(...p.pos)));
  const glowIM = new THREE.InstancedMesh(finGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), n);
  glowIM.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  glowIM.frustumCulled = false; g.add(glowIM);
  const acc = C(accent);
  g.setOn = (i, v) => {
    if (v <= 0.001) _m.makeScale(0, 0, 0); else _m.makeTranslation(posOf(cells[i][0], cells[i][1], _v));
    glowIM.setMatrixAt(i, _m); glowIM.setColorAt(i, _v.set(acc.r, acc.g, acc.b).multiplyScalar(v * 2.2));
    glowIM.instanceMatrix.needsUpdate = true; glowIM.instanceColor.needsUpdate = true;
  };
  g.on = (fn) => cells.forEach(([c, r], i) => g.setOn(i, fn(i, c, r)));
  g.index = (c, r) => cells.findIndex(([cc, rr]) => cc === c && rr === r);
  g.pos = (i, v = new V3()) => posOf(cells[i][0], cells[i][1], v);
  g.on(() => 0);
  g.count = n; g.cells = cells; g.name = 'transistorArray';
  g.userData.radius = Math.hypot(cols * spacing, rows * spacing) / 2;
  return withAnchors(g, {});
}

// =====================================================================================================================
// CHIP DIE
// =====================================================================================================================
// Floorplan in die fractions [x, y, w, h], y measured from the far edge. kinds: cpu, gpu, sram, npu, logic, io, analog.
export const DIE_BLOCKS = [
  { name: 'CPU', kind: 'cpu', rect: [0.06, 0.065, 0.4, 0.37] },
  { name: 'GPU', kind: 'gpu', rect: [0.5, 0.065, 0.44, 0.43] },
  { name: 'Cache', kind: 'sram', rect: [0.06, 0.47, 0.25, 0.25] },
  { name: 'NPU', kind: 'npu', rect: [0.34, 0.47, 0.3, 0.25] },
  { name: 'Memory', kind: 'sram', rect: [0.67, 0.535, 0.27, 0.185] },
  { name: 'Media', kind: 'logic', rect: [0.06, 0.755, 0.3, 0.18] },
  { name: 'Radio', kind: 'analog', rect: [0.39, 0.755, 0.22, 0.18] },
  { name: 'I/O', kind: 'io', rect: [0.64, 0.755, 0.3, 0.18] },
];
const DIE_PAL = {
  cpu: { base: '#1b2231', a: '#2b3447', b: '#3b465c', line: '#7e8ba4' },
  logic: { base: '#1d2129', a: '#2c323d', b: '#3a414e', line: '#76829a' },
  gpu: { base: '#201f2e', a: '#302f45', b: '#403f5c', line: '#8584aa' },
  sram: { base: '#15242b', a: '#23363f', b: '#304852', line: '#79a0ae' },
  npu: { base: '#241f1b', a: '#382e27', b: '#4b3e33', line: '#a88f78' },
  io: { base: '#1a1c21', a: '#2a2d34', b: '#3a3e47', line: '#939bab' },
  analog: { base: '#1c1f24', a: '#2a2e35', b: '#363b44', line: '#c8915d' },
};
const MR = (rough, metal) => `rgb(0,${Math.round(rough * 255)},${Math.round(metal * 255)})`;

// Draws the die's albedo and metal/rough maps: seal ring, bond pads, each block's characteristic texture (standard
// cell rows, SRAM arrays, repeated GPU cores, MAC grids, PHY stripes, spiral inductors) and the top power mesh.
function drawDie(blocks, { res = 2048, aspect = 1, seed = 3 } = {}) {
  const W = res, H = Math.round(res / aspect), R = rng(seed);
  const A = makeCanvas(W, H), Mc = makeCanvas(W, H), a = A.getContext('2d'), m = Mc.getContext('2d');
  const k = W / 2048; // patterns are tuned at 2048 px
  const fill = (ctx, x, y, w, h, s) => { ctx.fillStyle = s; ctx.fillRect(x, y, w, h); };
  const both = (x, y, w, h, sa, sm) => { fill(a, x, y, w, h, sa); fill(m, x, y, w, h, sm); };
  fill(a, 0, 0, W, H, '#0b0f15'); fill(m, 0, 0, W, H, MR(0.46, 0.3));
  // seal ring and scribe frame
  for (let i = 0; i < 5; i++) { const o = (8 + i * 4) * k; a.strokeStyle = i % 2 ? '#323b49' : '#5a6578'; a.lineWidth = 1.6 * k; a.strokeRect(o, o, W - 2 * o, H - 2 * o); m.strokeStyle = MR(0.22, 0.95); m.lineWidth = 1.6 * k; m.strokeRect(o, o, W - 2 * o, H - 2 * o); }
  // bond pads around the edge
  const pad = 22 * k, step = 38 * k, inset = 40 * k;
  const padAt = (x, y) => { both(x, y, pad, pad, '#7f8896', MR(0.2, 1)); fill(a, x + pad * 0.18, y + pad * 0.18, pad * 0.64, pad * 0.64, '#a3abb8'); fill(a, x + pad * 0.3, y + pad + 2 * k, pad * 0.4, 10 * k, '#3d4553'); };
  for (let x = inset + step; x < W - inset - step; x += step) { padAt(x, inset * 0.55); padAt(x, H - inset * 0.55 - pad); }
  for (let y = inset + step; y < H - inset - step; y += step) { padAt(inset * 0.55, y); padAt(W - inset * 0.55 - pad, y); }
  // pattern helpers
  const tile = (w, h, draw) => { const c = makeCanvas(w, h); draw(c.getContext('2d'), w, h); return c; };
  const logic = (ca, cm, x, y, w, h, P, rowH = 3 * k) => {
    fill(ca, x, y, w, h, P.base); fill(cm, x, y, w, h, MR(0.4, 0.55));
    for (let yy = y; yy < y + h; yy += rowH) {
      let xx = x;
      while (xx < x + w) { const cw = (2 + Math.floor(R() * R() * 14)) * k, r = R(); ca.fillStyle = r < 0.45 ? P.a : r < 0.8 ? P.b : P.base; ca.fillRect(xx, yy, Math.min(cw - k, x + w - xx), rowH - k); xx += cw; }
    }
    ca.globalAlpha = 0.4; ca.fillStyle = P.line; cm.fillStyle = MR(0.2, 0.95);
    const n = Math.round((w * h) / (700 * k * k));
    for (let i = 0; i < n; i++) {
      if (R() < 0.55) { const ly = y + Math.floor(R() * h), lx = x + R() * w * 0.8, L = Math.min(x + w - lx, (10 + R() * 140) * k); ca.fillRect(lx, ly, L, k); cm.fillRect(lx, ly, L, k); }
      else { const lx = x + Math.floor(R() * w), ly = y + R() * h * 0.8, L = Math.min(y + h - ly, (10 + R() * 120) * k); ca.fillRect(lx, ly, k, L); cm.fillRect(lx, ly, k, L); }
    }
    ca.globalAlpha = 1;
  };
  const sram = (ca, cm, x, y, w, h, P) => {
    fill(ca, x, y, w, h, P.base); fill(cm, x, y, w, h, MR(0.3, 0.7));
    const tw = Math.max(3, Math.round(6 * k)), th = Math.max(2, Math.round(4 * k));
    const pat = ca.createPattern(tile(tw, th, (t) => { t.fillStyle = P.a; t.fillRect(0, 0, tw, th); t.fillStyle = P.b; t.fillRect(0, 0, tw / 2, th / 2); t.fillRect(tw / 2, th / 2, tw / 2, th / 2); t.fillStyle = P.line; t.globalAlpha = 0.5; t.fillRect(tw - 1, 0, 1, th); }), 'repeat');
    const nx = Math.max(1, Math.round(w / (95 * k))), ny = Math.max(1, Math.round(h / (70 * k))), gap = 5 * k;
    const sw = (w - gap * (nx + 1)) / nx, sh = (h - gap * (ny + 1)) / ny;
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const sx = x + gap + i * (sw + gap), sy = y + gap + j * (sh + gap);
      ca.fillStyle = pat; ca.fillRect(sx, sy, sw, sh); fill(cm, sx, sy, sw, sh, MR(0.24, 0.88));
      fill(ca, sx, sy + sh * 0.5 - k, sw, 2 * k, P.line); // the sense-amp strip across the middle
    }
  };
  const stamp = (ca, cm, x, y, w, h, nx, ny, gap, draw) => {
    const cw = (w - gap * (nx + 1)) / nx, chh = (h - gap * (ny + 1)) / ny;
    const ta = makeCanvas(cw, chh), tm = makeCanvas(cw, chh);
    draw(ta.getContext('2d'), tm.getContext('2d'), cw, chh);
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const sx = x + gap + i * (cw + gap), sy = y + gap + j * (chh + gap); ca.drawImage(ta, sx, sy); cm.drawImage(tm, sx, sy); }
  };
  const draw = {
    cpu: (x, y, w, h, P) => {
      fill(a, x, y, w, h, P.base);
      const l2 = w * 0.2; // shared L2 between two big cores
      sram(a, m, x + (w - l2) / 2, y, l2, h, DIE_PAL.sram);
      for (const cx of [x, x + (w + l2) / 2]) {
        const cw = (w - l2) / 2 - 4 * k;
        logic(a, m, cx, y + h * 0.22, cw, h * 0.78, P);
        sram(a, m, cx, y, cw * 0.48, h * 0.2, DIE_PAL.sram);
        sram(a, m, cx + cw * 0.52, y, cw * 0.48, h * 0.2, DIE_PAL.sram);
      }
    },
    gpu: (x, y, w, h, P) => {
      fill(a, x, y, w, h, P.base); fill(m, x, y, w, h, MR(0.36, 0.6));
      stamp(a, m, x, y, w, h, w > h ? 3 : 2, w > h ? 2 : 3, 7 * k, (ta, tm, cw, chh) => {
        logic(ta, tm, 0, chh * 0.3, cw, chh * 0.7, P);
        sram(ta, tm, 0, 0, cw * 0.6, chh * 0.28, DIE_PAL.sram);
        logic(ta, tm, cw * 0.62, 0, cw * 0.38, chh * 0.28, DIE_PAL.logic);
      });
    },
    npu: (x, y, w, h, P) => {
      fill(a, x, y, w, h, P.base); fill(m, x, y, w, h, MR(0.36, 0.6));
      stamp(a, m, x, y, w, h, 4, 4, 5 * k, (ta, tm, cw, chh) => {
        sram(ta, tm, 0, 0, cw, chh, P);
        fill(ta, cw * 0.3, chh * 0.3, cw * 0.4, chh * 0.4, P.base); fill(ta, cw * 0.36, chh * 0.36, cw * 0.28, chh * 0.28, P.b); fill(tm, cw * 0.3, chh * 0.3, cw * 0.4, chh * 0.4, MR(0.3, 0.8));
      });
    },
    sram: (x, y, w, h, P) => { sram(a, m, x, y, w, h, P); fill(a, x, y, 10 * k, h, P.b); },
    logic: (x, y, w, h, P) => logic(a, m, x, y, w, h, P),
    io: (x, y, w, h, P) => {
      fill(a, x, y, w, h, P.base); fill(m, x, y, w, h, MR(0.32, 0.7));
      const lane = 14 * k;
      for (let xx = x + 4 * k; xx < x + w - lane; xx += lane) {
        fill(a, xx, y + 4 * k, lane * 0.55, h * 0.62, R() < 0.5 ? P.a : P.b); fill(m, xx, y + 4 * k, lane * 0.55, h * 0.62, MR(0.22, 0.95));
        fill(a, xx + lane * 0.12, y + h * 0.7, lane * 0.3, h * 0.25, P.line);
      }
    },
    analog: (x, y, w, h, P) => {
      logic(a, m, x, y, w, h, DIE_PAL.logic);
      const s = Math.min(w, h) * 0.42;
      for (const [cx, cy] of [[x + w * 0.28, y + h * 0.5], [x + w * 0.72, y + h * 0.5]]) {
        fill(a, cx - s / 2 - 4 * k, cy - s / 2 - 4 * k, s + 8 * k, s + 8 * k, P.base);
        a.strokeStyle = P.line; m.strokeStyle = MR(0.18, 1); a.lineWidth = m.lineWidth = 3.2 * k;
        a.beginPath(); m.beginPath();
        let half = s / 2; let px = cx - half, py = cy - half; a.moveTo(px, py); m.moveTo(px, py);
        for (let turn = 0; turn < 5 && half > 6 * k; turn++) { const pts = [[cx + half, cy - half], [cx + half, cy + half], [cx - half + 7 * k, cy + half], [cx - half + 7 * k, cy - half + 7 * k]]; for (const [qx, qy] of pts) { a.lineTo(qx, qy); m.lineTo(qx, qy); } half -= 7 * k; }
        a.stroke(); m.stroke();
      }
    },
  };
  const rects = {};
  for (const b of blocks) {
    const [x, y, w, h] = [b.rect[0] * W, b.rect[1] * H, b.rect[2] * W, b.rect[3] * H], P = DIE_PAL[b.kind] || DIE_PAL.logic;
    a.save(); m.save(); a.beginPath(); a.rect(x, y, w, h); a.clip(); m.beginPath(); m.rect(x, y, w, h); m.clip();
    (draw[b.kind] || draw.logic)(x, y, w, h, P);
    a.restore(); m.restore();
    a.strokeStyle = P.line; a.globalAlpha = 0.55; a.lineWidth = 1.5 * k; a.strokeRect(x + 0.75 * k, y + 0.75 * k, w - 1.5 * k, h - 1.5 * k); a.globalAlpha = 1;
    rects[b.name] = { x, y, w, h };
  }
  // top-metal power mesh across the core area
  a.globalAlpha = 0.09; a.fillStyle = '#c9d4e6'; m.fillStyle = MR(0.2, 1);
  for (let y = inset * 1.5; y < H - inset * 1.5; y += 64 * k) { a.fillRect(inset * 1.5, y, W - inset * 3, 3 * k); m.fillRect(inset * 1.5, y, W - inset * 3, 3 * k); }
  for (let x = inset * 1.5; x < W - inset * 1.5; x += 64 * k) { a.fillRect(x, inset * 1.5, 3 * k, H - inset * 3); m.fillRect(x, inset * 1.5, 3 * k, H - inset * 3); }
  a.globalAlpha = 1;
  // glow mask for highlights: the bright wiring and cell edges only, plus a faint wash
  const G = makeCanvas(W, H), gg = G.getContext('2d'), src = a.getImageData(0, 0, W, H), dst = gg.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    const l = (src.data[i * 4] * 0.3 + src.data[i * 4 + 1] * 0.59 + src.data[i * 4 + 2] * 0.11) / 255;
    const t = clamp((l - 0.16) / 0.22), v = Math.round(255 * (0.05 + 0.95 * t * t * (3 - 2 * t)));
    dst.data[i * 4] = dst.data[i * 4 + 1] = dst.data[i * 4 + 2] = v; dst.data[i * 4 + 3] = 255;
  }
  gg.putImageData(dst, 0, 0);
  return { A, Mc, G, W, H, rects };
}

// chipDie({ size: 2, blocks: DIE_BLOCKS, accent }) -> Group: a silicon die (thin-film sheen, metal layers that catch
// the light) on an optional package substrate. die.highlight('GPU', 0..1) lights that block's circuitry and outline in
// the accent; die.anchor('GPU') is an Object3D on the block's centre (die.anchors has every block); die.blocks lists
// every block in local units. Every depth follows the size (the die is 0.025 x size thick, the substrate 0.035 x
// size), so a fingernail-sized die is a thin plate, not a cube.
export function chipDie(o = {}) {
  const { size = 2, aspect = 1, res = 2048, seed = 3, iridescence = 0.35, substrate = true, blocks = DIE_BLOCKS } = o;
  const thickness = o.thickness ?? 0.025 * size, k = size / 2, subH = 0.035 * size; // k: the old absolute sizes were tuned at size 2
  const accent = accentOf(o);
  const W = size, D = size / aspect;
  const { A, Mc, G, W: pw, H: ph, rects } = drawDie(blocks, { res, aspect, seed });
  const albedo = canvasTexture(A), mr = canvasTexture(Mc, { srgb: false }), glowMask = canvasTexture(G, { srgb: false });
  const g = new THREE.Group(); g.name = 'chipDie';
  const baseY = substrate ? subH : 0, top = baseY + thickness;
  const envMap = o.env === 'scene' ? null : productEnv();
  const topMat = new THREE.MeshPhysicalMaterial({ map: albedo, roughnessMap: mr, metalnessMap: mr, roughness: 0.9, metalness: 1, bumpMap: albedo, bumpScale: o.bump ?? 0.6, iridescence, iridescenceIOR: 1.35, iridescenceThicknessRange: [240, 460], iridescenceThicknessMap: filmMap(seed + 5), clearcoat: 0.3, clearcoatRoughness: 0.22, envMap, envMapIntensity: o.envIntensity ?? 0.55 });
  const sideMat = mat.metal('#48505e', { rough: 0.22, extra: { envMap, envMapIntensity: 0.5 } });
  const die = shade(new THREE.Mesh(new THREE.BoxGeometry(W, thickness, D), [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]));
  die.position.y = baseY + thickness / 2; g.add(die);
  if (substrate) {
    const sub = shade(new THREE.Mesh(rbox(W * 1.42, subH, D * 1.42, 0.025 * k), mat.plastic('#0f1715', { rough: 0.5, clearcoat: 0.3 }))); sub.position.y = subH / 2; g.add(sub);
    const fillet = shade(new THREE.Mesh(rbox(W * 1.025, thickness * 0.55, D * 1.025, thickness * 0.25), mat.plastic('#14171c', { rough: 0.6 }))); fillet.position.y = baseY + thickness * 0.27; g.add(fillet);
    // decoupling capacitors around the die and solder balls under the substrate (sized with the die: k = size / 2)
    const R = rng(seed + 7), caps = [];
    for (let i = 0; i < 28; i++) { const side = i % 4, f = (Math.floor(i / 4) + 0.5) / 7 - 0.5, off = (W * 1.42) / 2 - 0.09 * k; const x = side < 2 ? f * W * 1.2 : (side === 2 ? -1 : 1) * off, z = side < 2 ? (side ? -1 : 1) * off * (D / W) : f * D * 1.2; caps.push([x, z, side < 2 ? 0 : Math.PI / 2, R()]); }
    const capBody = new THREE.InstancedMesh(rbox(0.07 * k, 0.035 * k, 0.035 * k, 0.008 * k), mat.plastic('#a9814f', { rough: 0.45 }), caps.length);
    const capEnds = new THREE.InstancedMesh(rbox(0.016 * k, 0.037 * k, 0.037 * k, 0.006 * k), mat.metal('#cfd3da', { rough: 0.3 }), caps.length * 2);
    const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new V3(), _s = new V3(1, 1, 1), _o = new V3(), capY = subH + 0.0175 * k;
    caps.forEach(([x, z, rot], i) => {
      _q.setFromAxisAngle(new V3(0, 1, 0), rot); capBody.setMatrixAt(i, _m.compose(_p.set(x, capY, z), _q, _s));
      for (const s of [-1, 1]) { _o.set(s * 0.035 * k, 0, 0).applyQuaternion(_q); capEnds.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), _m.compose(_p.set(x + _o.x, capY, z + _o.z), _q, _s)); }
    });
    shade(capBody); shade(capEnds); g.add(capBody, capEnds);
    const nb = 14, balls = new THREE.InstancedMesh(new THREE.SphereGeometry(0.022 * k, 16, 10), mat.metal('#c7ccd3', { rough: 0.25 }), nb * nb);
    for (let i = 0; i < nb * nb; i++) balls.setMatrixAt(i, _m.makeTranslation((((i % nb) + 0.5) / nb - 0.5) * W * 1.3, -0.012 * k, ((Math.floor(i / nb) + 0.5) / nb - 0.5) * D * 1.3));
    g.add(balls);
  }
  // per-block highlight: the block's own circuitry, additive in the accent, plus a glowing outline
  const blockInfo = {}, overlays = {};
  const toLocal = (x, y) => [(x / pw - 0.5) * W, (y / ph - 0.5) * D];
  for (const b of blocks) {
    const r = rects[b.name]; const [x0, z0] = toLocal(r.x, r.y), [x1, z1] = toLocal(r.x + r.w, r.y + r.h);
    const bw = x1 - x0, bd = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    blockInfo[b.name] = { name: b.name, kind: b.kind, x: cx, z: cz, w: bw, d: bd };
    const geo = new THREE.PlaneGeometry(bw, bd).rotateX(-Math.PI / 2);
    const uv = geo.attributes.uv; const u0 = r.x / pw, u1 = (r.x + r.w) / pw, v0 = 1 - (r.y + r.h) / ph, v1 = 1 - r.y / ph;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
    const ov = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: glowMask, color: 0x000000, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }));
    ov.position.set(cx, top + 0.0015 * k, cz); ov.visible = false; ov.renderOrder = 3; g.add(ov);
    const e = 0.004 * k, y = top + 0.002 * k;
    const outline = line([[x0 + e, y, z0 + e], [x1 - e, y, z0 + e], [x1 - e, y, z1 - e], [x0 + e, y, z1 - e], [x0 + e, y, z0 + e]], { width: o.outlineWidth ?? 0.008 * size, color: accent, intensity: 0 });
    outline.visible = false; g.add(outline);
    overlays[b.name] = { ov, outline, anchor: pin(g, [cx, top + 0.003 * k, cz], b.name) };
  }
  g.highlight = (name, v, { fill = 1, edge = 1 } = {}) => {
    const h = overlays[name]; if (!h) return;
    h.ov.visible = v * fill > 0.001; h.ov.material.color.copy(hot(accent, 2.2 * v * fill));
    h.outline.visible = v * edge > 0.001; h.outline.setIntensity(5 * v * edge);
  };
  g.blocks = blockInfo; g.top = top; g.texture = albedo;
  g.userData.radius = Math.hypot(W, D) * (substrate ? 0.72 : 0.5);
  return withAnchors(g, Object.fromEntries(Object.entries(overlays).map(([n, h]) => [n, h.anchor])));
}

// wafer({ radius: 1.5, dies: 13 }) -> Group: a mirror-polished silicon wafer with a notch, patterned with a grid of dies
// (the die texture, small) that throw a thin-film rainbow as the camera moves. Light it with a bright env (k.env('studio')).
export function wafer(o = {}) {
  const { radius = 1.5, thickness = 0.03, dies = 13, seed = 3, res = 1024 } = o;
  const { A, Mc } = drawDie(o.blocks || DIE_BLOCKS, { res, seed });
  const al = canvasTexture(A), mr = canvasTexture(Mc, { srgb: false });
  const pitch = (2 * radius) / dies;
  for (const t of [al, mr]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / pitch, 1 / pitch); t.offset.set(0.5, 0.5); }
  const shape = new THREE.Shape(), notch = radius * 0.025, na = Math.asin(notch / radius);
  shape.absarc(0, 0, radius, -Math.PI / 2 + na, Math.PI * 1.5 - na, false);
  shape.absarc(0, -radius, notch, Math.PI - 0.01, 0.01, true);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness * 0.6, bevelEnabled: true, bevelThickness: thickness * 0.2, bevelSize: thickness * 0.2, bevelSegments: 3, curveSegments: 160 });
  geo.rotateX(-Math.PI / 2); geo.translate(0, thickness * 0.2, 0);
  const envMap = o.env === 'scene' ? null : productEnv();
  const film = filmMap(seed + 11); film.repeat.set(1 / (2 * radius), 1 / (2 * radius)); film.offset.set(0.5, 0.5);
  const face = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(2.4, 2.4, 2.4), map: al, roughnessMap: mr, metalnessMap: mr, roughness: 0.2, metalness: 1, iridescence: o.iridescence ?? 1, iridescenceIOR: 1.4, iridescenceThicknessRange: [260, 640], iridescenceThicknessMap: film, envMap, envMapIntensity: o.envIntensity ?? 0.6 });
  const edge = mat.metal('#6a7280', { rough: 0.12, extra: { envMap, envMapIntensity: 0.8 } });
  const body = shade(new THREE.Mesh(geo, [face, edge]));
  // a bare polished ring at the rim, where no dies are printed
  const rim = new THREE.Mesh(new THREE.RingGeometry(radius * 0.965, radius * 0.999, 160).rotateX(-Math.PI / 2), mat.metal('#7d8592', { rough: 0.08, extra: { envMap, envMapIntensity: 0.8 } }));
  rim.position.y = thickness + 0.0004;
  const g = new THREE.Group(); g.name = 'wafer'; g.add(body, rim);
  g.userData.radius = radius; g.pitch = pitch; g.top = thickness;
  return withAnchors(g, {});
}

// Polished silicon: grey metal with growth striations running round it (a brushed bump along the lathe's u), lit by
// the product studio so it reads as a mirror crystal in any palette. Shared by boule() and waferStack().
let striations = null;
const siliconMat = (o, extra = {}) => {
  striations ||= Object.assign(noiseTexture({ kind: 'brushed', scale: 6, repeat: 1, seed: 6 }), { userData: { shared: true } });
  const envMap = o.env === 'scene' ? null : productEnv();
  return mat.metal(o.color ?? '#c6cbd4', { rough: o.rough ?? 0.24, extra: { envMap, envMapIntensity: o.envIntensity ?? (envMap ? 0.9 : 2.2), bumpMap: striations, bumpScale: 0.15, ...extra } });
};

// boule({ radius .62, length 2.6 }) -> Group: a Czochralski silicon crystal standing on its cut end at y = 0: the
// cylindrical body with faint growth ridges down it, the shoulder (crown) and the thin neck up to the seed rod. Those
// three features are what make it nameable from a still. crown: false gives a trimmed ingot with bevelled ends, ready
// to slice (lay it down with rotation.z). seed: the rod's length above the neck, in radii (3.7); ridges: 4 (height
// ridge .007 radii); tail: true ends the body in a rounded tail cone instead of a flat cut; color, rough,
// env 'product' | 'scene', envIntensity, segments 256. Anchors: bottom, body, shoulder, neck, seed (body, shoulder and
// neck on the +z surface, for labels). userData { radius, center, length, height }.
export function boule(o = {}) {
  const { radius: R0 = 0.62, length: L = 2.6, crown = true, ridges = 4, segments = 256, tail = false } = o;
  const b = 0.065 * R0, rh = (o.ridge ?? 0.007) * R0, rod = (o.seed ?? 3.7) * R0;
  const prof = tail ? [[0, 0], [R0 * 0.18, 0.02 * R0], [R0 * 0.62, 0.22 * R0], [R0 * 0.93, 0.45 * R0], [R0, 0.6 * R0]] : [[0, 0], [R0 - b, 0], [R0, b]];
  if (crown) prof.push([R0, L], [R0 * 0.93, L + 0.29 * R0], [R0 * 0.62, L + 0.68 * R0], [R0 * 0.32, L + 0.97 * R0], [R0 * 0.097, L + 1.13 * R0], [R0 * 0.073, L + 1.16 * R0], [R0 * 0.073, L + 1.16 * R0 + rod], [0, L + 1.16 * R0 + rod]);
  else prof.push([R0, L - b], [R0 - b, L], [0, L]);
  const height = prof[prof.length - 1][1];
  const geo = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), segments);
  // growth ridges: the surface pushed out along `ridges` lines (45 degrees off the lathe's seam), fading out on the neck
  const pos = geo.attributes.position, n = prof.length;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), r = Math.hypot(x, z); if (r < 0.3 * R0 || !ridges) continue;
    const ph = Math.atan2(x, z), step = (2 * Math.PI) / ridges, d = Math.abs(((((ph - Math.PI / 4) % step) + step * 1.5) % step) - step / 2);
    const k = 1 + (rh * Math.exp(-((d / 0.025) ** 2)) * (r / R0)) / r;
    pos.setX(i, x * k); pos.setZ(i, z * k);
  }
  geo.computeVertexNormals();
  const nor = geo.attributes.normal, uv = geo.attributes.uv; // weld the seam's normals; v by arc length for the striations
  for (let j = 0; j < n; j++) { const a = j, c = segments * n + j; const v = new V3().fromBufferAttribute(nor, a).add(new V3().fromBufferAttribute(nor, c)).normalize(); nor.setXYZ(a, v.x, v.y, v.z); nor.setXYZ(c, v.x, v.y, v.z); }
  const arc = [0]; for (let j = 1; j < n; j++) arc.push(arc[j - 1] + Math.hypot(prof[j][0] - prof[j - 1][0], prof[j][1] - prof[j - 1][1]));
  for (let i = 0; i <= segments; i++) for (let j = 0; j < n; j++) uv.setXY(i * n + j, i / segments, (arc[j] / arc[n - 1]) * 40);
  const g = new THREE.Group(); g.name = 'boule';
  const body = shade(new THREE.Mesh(geo, siliconMat(o))); g.add(body); g.body = body;
  const anchors = { bottom: pin(g, [0, 0, 0], 'bottom'), body: pin(g, [0, L * 0.5, R0], 'body'), shoulder: pin(g, [0, crown ? L + 0.3 * R0 : L, crown ? R0 * 0.92 : 0], 'shoulder') };
  if (crown) { anchors.neck = pin(g, [0, L + 1.15 * R0, R0 * 0.09], 'neck'); anchors.seed = pin(g, [0, height, 0], 'seed'); }
  g.userData = { radius: Math.hypot(R0, height / 2), center: new V3(0, height / 2, 0), length: L, height };
  return withAnchors(g, anchors);
}

// waferStack({ count 10, radius .62, thickness .02, gap .05, axis 'y' | 'x' }) -> Group: polished wafers, piled up
// (axis 'y', from y = 0) or standing in a row like slices off a boule (axis 'x', from x = 0, on their edges at y = 0).
// A wafer is nameable from a still by its bright thin edge and a stack of them. stack.spread(p) opens the gaps
// (0 touching, 1 the full gap; pure); stack.wafers[i]; dies: true prints the die grid on the faces (one texture for
// every wafer). Faces in mirror silicon, edges in bright polished metal. Anchors: top, edge (on the middle wafer's
// rim, facing +z), center.
export function waferStack(o = {}) {
  const { count = 10, radius = 0.62, thickness = 0.02, gap = 0.05, axis = 'y', dies = false, seed = 3 } = o;
  const g = new THREE.Group(); g.name = 'waferStack';
  const envMap = o.env === 'scene' ? null : productEnv();
  let faceMap = null, faceMR = null;
  if (dies) { const N = dies === true ? 13 : dies, { A, Mc } = drawDie(o.blocks || DIE_BLOCKS, { res: 1024, seed }); faceMap = canvasTexture(A); faceMR = canvasTexture(Mc, { srgb: false }); for (const t of [faceMap, faceMR]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(N, N); } } // cap UVs span the diameter: N dies across
  const face = dies ? new THREE.MeshPhysicalMaterial({ color: new THREE.Color(2.2, 2.2, 2.2), map: faceMap, roughnessMap: faceMR, metalnessMap: faceMR, roughness: 0.2, metalness: 1, iridescence: 0.6, iridescenceIOR: 1.4, iridescenceThicknessRange: [260, 640], envMap, envMapIntensity: 0.6 }) : siliconMat(o, { bumpMap: null, roughness: 0.14 });
  const edge = mat.metal(o.edgeColor ?? '#e8ecf2', { rough: 0.08, extra: { envMap, envMapIntensity: envMap ? 1.6 : 2.5 } });
  const geo = new THREE.CylinderGeometry(radius, radius, thickness, 160, 1); // groups: side, top, bottom
  const wafers = [];
  for (let i = 0; i < count; i++) { const w = shade(new THREE.Mesh(geo, [edge, face, face])); if (axis === 'x') w.rotation.z = Math.PI / 2; g.add(w); wafers.push(w); }
  const anchors = { top: pin(g, [0, 0, 0], 'top'), edge: pin(g, [0, 0, 0], 'edge'), center: pin(g, [0, 0, 0], 'center') }, mid = Math.floor(count / 2);
  const at = (c, v, h = 0, f = 0) => (axis === 'x' ? v.set(c, radius + h, f) : v.set(0, c + h, f)); // a point c along the stack
  g.spread = (p) => {
    const step = thickness + gap * clamp(p), len = count * thickness + (count - 1) * gap * clamp(p);
    wafers.forEach((w, i) => at(thickness / 2 + i * step, w.position));
    at(axis === 'x' ? thickness / 2 + mid * step : len, anchors.top.position, axis === 'x' ? radius : 0);
    at(thickness / 2 + mid * step, anchors.edge.position, 0, radius); at(len / 2, anchors.center.position);
  };
  g.spread(o.spread ?? 1);
  const len = count * thickness + (count - 1) * gap;
  g.wafers = wafers;
  g.userData = { radius: Math.hypot(radius, len / 2), center: axis === 'x' ? new V3(len / 2, radius, 0) : new V3(0, len / 2, 0) };
  return withAnchors(g, anchors);
}

// =====================================================================================================================
// CIRCUIT BOARD
// =====================================================================================================================
const PCB_COLORS = {
  green: { mask: '#0d4a31', trace: '#1c7048', silk: '#eef0e6', edge: '#8d7f57' },
  black: { mask: '#0b0d10', trace: '#1c2126', silk: '#e6e6e1', edge: '#5f5847' },
  blue: { mask: '#0b2b66', trace: '#1b4a92', silk: '#eef1f7', edge: '#7d7558' },
  red: { mask: '#5c0f14', trace: '#84222a', silk: '#f2eee8', edge: '#8a7b58' },
};
// Offsets a polyline sideways with mitred corners, so a bus of parallel traces keeps its spacing through 45-degree bends.
function offsetLine(pts, d) {
  const out = [], n = pts.length;
  const nrm = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; return [-dy / L, dx / L]; };
  for (let i = 0; i < n; i++) {
    const n0 = i > 0 ? nrm(pts[i - 1], pts[i]) : nrm(pts[0], pts[1]), n1 = i < n - 1 ? nrm(pts[i], pts[i + 1]) : n0;
    let mx = n0[0] + n1[0], my = n0[1] + n1[1]; const L = Math.hypot(mx, my) || 1; mx /= L; my /= L;
    const s = d / Math.max(0.3, mx * n1[0] + my * n1[1]);
    out.push([pts[i][0] + mx * s, pts[i][1] + my * s]);
  }
  return out;
}
const DIRS = [[1, 0], [Math.SQRT1_2, Math.SQRT1_2], [0, 1], [-Math.SQRT1_2, Math.SQRT1_2], [-1, 0], [-Math.SQRT1_2, -Math.SQRT1_2], [0, -1], [Math.SQRT1_2, -Math.SQRT1_2]];
// A curve through a polyline with small rounded corners (tubes and pulses follow it without kinks).
function polyCurve(points, radius = 0.01) {
  const path = new THREE.CurvePath();
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const start = i === 0 ? a.clone() : a.clone().lerp(b, Math.min(0.45, radius / a.distanceTo(b)));
    const end = i === points.length - 2 ? b.clone() : b.clone().lerp(a, Math.min(0.45, radius / a.distanceTo(b)));
    if (i > 0) { const prev = path.curves[path.curves.length - 1]; path.add(new THREE.QuadraticBezierCurve3(prev.v2 || prev.v1, a.clone(), start)); }
    path.add(new THREE.LineCurve3(start, end));
  }
  return path;
}

// pcb({ size: [4, 2.6], color: 'green' | 'black' | 'blue' | 'red' }) -> Group: a circuit board with procedurally
// routed traces (buses that bend together at 45 degrees), gold pads and vias, silkscreen, a central chip and small
// components. pcb.traces[i].curve (longest first) is in the board's local space: pcb.lightTrace(i, { color }) adds a
// glowing tube along it (draw it on with .draw(p)), or run glow.pulse(pcb.traces[i].curve) and add it to the board.
// Depths follow the width (board 0.015 x size[0], chip body 0.0175 x size[0], parts likewise), so a board inside a
// phone is a thin sheet. chip: true (a packaged chip), 'footprint' (its pad ring and silk outline, no body: seat a
// chipDie there, at pcb.footprint.center, size pcb.footprint.size) or false. pcb.chipTraces() lists the traces that
// leave the chip's pad ring, each ordered from the chip outwards (a pulse placed 0 -> 1 runs out of the chip).
export function pcb(o = {}) {
  const { size = [4, 2.6], res = 2048, seed = 5, density = 1, chip = true, parts = true } = o;
  const thickness = o.thickness ?? 0.015 * size[0], kz = size[0] / 4; // kz: the old absolute heights were tuned at size 4
  const accent = accentOf(o);
  const pal = typeof o.color === 'object' ? o.color : PCB_COLORS[o.color || 'green'] || PCB_COLORS.green;
  const [BW, BD] = size, W = res, H = Math.round((res * BD) / BW), k = W / 2048, R = rng(seed);
  const A = makeCanvas(W, H), Mc = makeCanvas(W, H), B = makeCanvas(W, H);
  const a = A.getContext('2d'), m = Mc.getContext('2d'), b = B.getContext('2d');
  const fill = (ctx, x, y, w, h, s) => { ctx.fillStyle = s; ctx.fillRect(x, y, w, h); };
  fill(a, 0, 0, W, H, pal.mask); fill(m, 0, 0, W, H, MR(0.3, 0)); fill(b, 0, 0, W, H, '#808080');
  // occupancy grid so buses never cross
  const cell = 6 * k, gw = Math.ceil(W / cell), gh = Math.ceil(H / cell), occ = new Uint8Array(gw * gh);
  const occAt = (x, y) => { const i = Math.floor(x / cell), j = Math.floor(y / cell); return i < 0 || j < 0 || i >= gw || j >= gh ? 1 : occ[j * gw + i]; };
  const mark = (x, y, r) => { for (let j = Math.floor((y - r) / cell); j <= Math.floor((y + r) / cell); j++) for (let i = Math.floor((x - r) / cell); i <= Math.floor((x + r) / cell); i++) if (i >= 0 && j >= 0 && i < gw && j < gh) occ[j * gw + i] = 1; };
  const markRect = (x, y, w, h, pad = 0) => { for (let yy = y - pad; yy <= y + h + pad; yy += cell * 0.5) for (let xx = x - pad; xx <= x + w + pad; xx += cell * 0.5) mark(xx, yy, 0); };
  const freeRect = (x, y, w, h) => { if (x < 30 * k || y < 30 * k || x + w > W - 30 * k || y + h > H - 30 * k) return false; for (let yy = y; yy <= y + h; yy += cell * 0.5) for (let xx = x; xx <= x + w; xx += cell * 0.5) if (occAt(xx, yy)) return false; return true; };
  const freeLine = (pts, r) => { for (let i = 0; i < pts.length - 1; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], L = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(L / (cell * 0.5)); for (let s = 0; s <= n; s++) { const x = x0 + ((x1 - x0) * s) / n, y = y0 + ((y1 - y0) * s) / n; for (const [ox, oy] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) if (occAt(x + ox, y + oy)) return false; } } return true; };
  const markLine = (pts, r) => { for (let i = 0; i < pts.length - 1; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], L = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(L / (cell * 0.5)); for (let s = 0; s <= n; s++) mark(x0 + ((x1 - x0) * s) / n, y0 + ((y1 - y0) * s) / n, r); } };
  const tw = 4.5 * k, pitch = tw * 2.6;
  const traces = [];
  const silk = (ctx) => { ctx.strokeStyle = pal.silk; ctx.fillStyle = pal.silk; };
  const goldPad = (x, y, w, h, round = false) => {
    a.fillStyle = '#d7a64e'; m.fillStyle = MR(0.22, 1); b.fillStyle = '#d8d8d8';
    for (const c of [a, m, b]) { c.beginPath(); if (round) c.arc(x, y, w / 2, 0, Math.PI * 2); else c.roundRect(x - w / 2, y - h / 2, w, h, Math.min(w, h) * 0.18); c.fill(); }
  };
  const via = (x, y, r = 4.6 * k) => { goldPad(x, y, r * 2, r * 2, true); for (const [c, s] of [[a, '#07090b'], [m, MR(0.9, 0)], [b, '#000000']]) { c.fillStyle = s; c.beginPath(); c.arc(x, y, r * 0.45, 0, Math.PI * 2); c.fill(); } };
  const drawTrace = (pts, w) => {
    for (const [c, s] of [[a, pal.trace], [m, MR(0.24, 0)], [b, '#c4c4c4']]) { c.strokeStyle = s; c.lineWidth = w; c.lineJoin = 'round'; c.lineCap = 'round'; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); }
  };
  // a bus: a random centre line of long straight runs and short 45-degree jogs, offset into k parallel traces
  const bus = (x, y, d, nTr, { minRun = 60, maxRun = 300, segs = 6, startPads = false, pitch: bp = pitch } = {}) => {
    const pts = [[x, y]]; let dir = d, px = x, py = y;
    for (let s = 0; s < segs; s++) {
      const diag = dir % 2 === 1, L = (diag ? 18 + R() * 70 : minRun + R() * (maxRun - minRun)) * k;
      const nx = px + DIRS[dir][0] * L, ny = py + DIRS[dir][1] * L;
      if (nx < 60 * k || ny < 60 * k || nx > W - 60 * k || ny > H - 60 * k) break;
      px = nx; py = ny; pts.push([px, py]);
      dir = R() < 0.5 ? (dir + 1) % 8 : (dir + 7) % 8; // orthogonal runs and 45-degree jogs alternate
    }
    if (pts.length < 2) return false;
    const lines = []; for (let j = 0; j < nTr; j++) lines.push(offsetLine(pts, (j - (nTr - 1) / 2) * bp));
    if (!lines.every((l) => freeLine(startPads ? l.slice(1) : l, tw * 0.5 + 2.5 * k))) return false;
    for (const l of lines) {
      markLine(l, bp * 0.62); drawTrace(l, tw);
      const e = l[l.length - 1];
      if (R() < 0.75) via(e[0], e[1]); else goldPad(e[0], e[1], 12 * k, 12 * k);
      if (!startPads) via(l[0][0], l[0][1]);
      l.fromChip = startPads; // the chip's fan-out starts at its pads
      traces.push(l);
    }
    return true;
  };
  // central chip footprint with buses fanning out of all four sides
  const chipS = Math.round(Math.min(W, H) * 0.2), cx = W / 2 - chipS / 2, cy = H / 2 - chipS / 2;
  const chipPads = 14, padP = chipS / chipPads;
  if (chip) {
    markRect(cx, cy, chipS, chipS, 10 * k);
    silk(a); a.lineWidth = 2.5 * k; a.strokeRect(cx - 16 * k, cy - 16 * k, chipS + 32 * k, chipS + 32 * k);
    a.beginPath(); a.arc(cx - 26 * k, cy - 26 * k, 5 * k, 0, Math.PI * 2); a.fill();
    for (let side = 0; side < 4; side++) {
      for (let g0 = 1; g0 < chipPads - 1; g0 += 4) {
        const nTr = Math.min(3 + Math.floor(R() * 2), chipPads - 1 - g0), mid = g0 + (nTr - 1) / 2 + 0.5;
        const along = mid * padP;
        const [sx, sy, d] = side === 0 ? [cx + chipS + 14 * k, cy + along, 0] : side === 1 ? [cx + along, cy + chipS + 14 * k, 2] : side === 2 ? [cx - 14 * k, cy + chipS - along, 4] : [cx + chipS - along, cy - 14 * k, 6];
        bus(sx, sy, d, nTr, { minRun: 40, maxRun: 260, segs: 5 + Math.floor(R() * 3), startPads: true, pitch: padP });
      }
      for (let i = 0; i < chipPads; i++) {
        const along = (i + 0.5) * padP;
        const [px, py, w, h] = side === 0 ? [cx + chipS + 4 * k, cy + along, 18 * k, padP * 0.55] : side === 1 ? [cx + along, cy + chipS + 4 * k, padP * 0.55, 18 * k] : side === 2 ? [cx - 4 * k, cy + chipS - along, 18 * k, padP * 0.55] : [cx + chipS - along, cy - 4 * k, padP * 0.55, 18 * k];
        goldPad(px, py, w, h);
      }
    }
  }
  // free-standing buses across the board
  const target = Math.round(70 * density * (W * H) / (2048 * 1330));
  for (let tries = 0, made = 0; tries < target * 12 && made < target; tries++) {
    const x = (80 + R() * (W / k - 160)) * k, y = (80 + R() * (H / k - 160)) * k;
    if (bus(x, y, Math.floor(R() * 4) * 2, 1 + Math.floor(R() * R() * 6), { segs: 3 + Math.floor(R() * 5) })) made++;
  }
  // components: two-pad passives and a few eight-pin chips, pads on the board, bodies in 3D
  const comps = [];
  if (parts) {
    let ri = 1, ci = 1, ui = 2;
    for (let tries = 0, made = 0; tries < 900 && made < 34 * density; tries++) {
      const big = made % 9 === 4, rot = R() < 0.5;
      const w = (big ? 70 : 34) * k, h = (big ? 56 : 16) * k, cw = rot ? h : w, chh = rot ? w : h;
      const x = R() * (W - cw), y = R() * (H - chh);
      if (!freeRect(x - 12 * k, y - 12 * k, cw + 24 * k, chh + 24 * k)) continue;
      markRect(x, y, cw, chh, 10 * k); made++;
      const ccx = x + cw / 2, ccy = y + chh / 2;
      if (big) {
        for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { const off = (i - 1.5) * 15 * k; if (rot) goldPad(ccx + off, ccy + s * 30 * k, 8 * k, 14 * k); else goldPad(ccx + s * 30 * k, ccy + off, 14 * k, 8 * k); }
        silk(a); a.lineWidth = 2 * k; a.strokeRect(x - 4 * k, y - 4 * k, cw + 8 * k, chh + 8 * k);
        a.font = `600 ${15 * k}px ${FONT_STACK('Inter')}`; a.fillText('U' + ui++, x, y - 9 * k);
        comps.push({ kind: 'ic', x: ccx, y: ccy, rot });
      } else {
        for (const s of [-1, 1]) { if (rot) goldPad(ccx, ccy + s * 13 * k, 14 * k, 10 * k); else goldPad(ccx + s * 13 * k, ccy, 10 * k, 14 * k); }
        const cap = R() < 0.5;
        silk(a); a.font = `600 ${13 * k}px ${FONT_STACK('Inter')}`; a.fillText((cap ? 'C' : 'R') + (cap ? ci++ : ri++), x + cw + 5 * k, y + chh * 0.5 + 4 * k);
        comps.push({ kind: cap ? 'cap' : 'res', x: ccx, y: ccy, rot });
      }
    }
  }
  // mounting holes and a little board text
  for (const [hx, hy] of [[44, 44], [W / k - 44, 44], [44, H / k - 44], [W / k - 44, H / k - 44]]) {
    via(hx * k, hy * k, 24 * k);
    silk(a); a.lineWidth = 2 * k; a.beginPath(); a.arc(hx * k, hy * k, 34 * k, 0, Math.PI * 2); a.stroke();
  }
  silk(a); a.font = `700 ${18 * k}px ${FONT_STACK('Inter')}`; a.fillText('REV 2.1', W - 160 * k, H - 30 * k);
  // the board
  const albedo = canvasTexture(A), mr = canvasTexture(Mc, { srgb: false }), bump = canvasTexture(B, { srgb: false });
  const topMat = new THREE.MeshPhysicalMaterial({ map: albedo, roughnessMap: mr, metalnessMap: mr, roughness: 1, metalness: 1, bumpMap: bump, bumpScale: o.bump ?? 1.4, clearcoat: 0.55, clearcoatRoughness: 0.22, envMapIntensity: o.env ?? 1.1 });
  const edgeMat = mat.plastic(pal.edge, { rough: 0.6, clearcoat: 0 });
  const board = shade(new THREE.Mesh(new THREE.BoxGeometry(BW, thickness, BD), [edgeMat, edgeMat, topMat, edgeMat, edgeMat, edgeMat]));
  board.position.y = thickness / 2;
  const g = new THREE.Group(); g.name = 'pcb'; g.add(board);
  const top = thickness, toLocal = (x, y, lift = 0.0025 * kz) => new V3((x / W - 0.5) * BW, top + lift, (y / H - 0.5) * BD);
  const s = BW / W; // world units per pixel
  const chipH = 0.0175 * BW; // the chip body's height
  if (chip === 'footprint') g.footprint = { center: toLocal(cx + chipS / 2, cy + chipS / 2, 0), size: chipS * s };
  else if (chip) {
    const cs = chipS * s;
    const body = shade(new THREE.Mesh(rbox(cs * 0.96, chipH, cs * 0.96, Math.min(0.012 * kz, chipH * 0.4)), mat.plastic('#141518', { rough: 0.5, clearcoat: 0.25, extra: { bumpMap: o.chipBump ?? null } })));
    body.position.copy(toLocal(cx + chipS / 2, cy + chipS / 2, chipH / 2)); g.add(body);
    const mk = makeCanvas(512, 512), mg = mk.getContext('2d');
    mg.fillStyle = '#131417'; mg.fillRect(0, 0, 512, 512); mg.fillStyle = '#3a3d44'; mg.textAlign = 'left';
    mg.font = `600 54px ${FONT_STACK('Inter')}`; mg.fillText(o.chipText || 'SC-2207', 70, 250);
    mg.font = `500 36px ${FONT_STACK('Inter')}`; mg.fillText(o.chipSub || 'A1B3  2245', 70, 310);
    mg.fillStyle = '#0b0c0e'; mg.beginPath(); mg.arc(70, 70, 22, 0, Math.PI * 2); mg.fill();
    const label = new THREE.Mesh(new THREE.PlaneGeometry(cs * 0.94, cs * 0.94).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ map: canvasTexture(mk), roughness: 0.55, clearcoat: 0.2 }));
    label.position.copy(toLocal(cx + chipS / 2, cy + chipS / 2, chipH * 1.003)); g.add(label);
    g.chip = body;
    g.footprint = { center: toLocal(cx + chipS / 2, cy + chipS / 2, 0), size: cs };
  }
  if (comps.length) {
    const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new V3(), _s = new V3(1, 1, 1), _o = new V3(), Y = new V3(0, 1, 0);
    const passives = comps.filter((c) => c.kind !== 'ic'), ics = comps.filter((c) => c.kind === 'ic');
    const L = 26 * k * s, Hh = 0.022 * kz, Wd = 12 * k * s;
    const bodyR = new THREE.InstancedMesh(rbox(L * 0.62, Hh, Wd, 0.004 * kz), mat.plastic('#17181b', { rough: 0.5 }), Math.max(1, passives.length));
    const bodyC = new THREE.InstancedMesh(rbox(L * 0.62, Hh, Wd, 0.004 * kz), mat.plastic('#a17a4b', { rough: 0.45 }), Math.max(1, passives.length));
    const ends = new THREE.InstancedMesh(rbox(L * 0.2, Hh * 1.04, Wd * 1.02, 0.003 * kz), mat.metal('#cdd1d8', { rough: 0.3 }), Math.max(1, passives.length * 2));
    let nr = 0, nc = 0, ne = 0;
    for (const c of passives) {
      _q.setFromAxisAngle(Y, c.rot ? Math.PI / 2 : 0); _p.copy(toLocal(c.x, c.y, Hh / 2));
      (c.kind === 'cap' ? bodyC : bodyR).setMatrixAt(c.kind === 'cap' ? nc++ : nr++, _m.compose(_p, _q, _s));
      for (const sgn of [-1, 1]) { _o.set(sgn * L * 0.4, 0, 0).applyQuaternion(_q); ends.setMatrixAt(ne++, _m.compose(_p.clone().add(_o), _q, _s)); }
    }
    bodyR.count = nr; bodyC.count = nc; ends.count = ne;
    for (const im of [bodyR, bodyC, ends]) { shade(im); g.add(im); }
    if (ics.length) {
      const icBody = new THREE.InstancedMesh(rbox(48 * k * s, 0.035 * kz, 40 * k * s, 0.006 * kz), mat.plastic('#121316', { rough: 0.55 }), ics.length);
      const legs = new THREE.InstancedMesh(rbox(12 * k * s, 0.01 * kz, 4 * k * s, 0.002 * kz), mat.metal('#c9ced6', { rough: 0.3 }), ics.length * 8);
      let nl = 0;
      ics.forEach((c, i) => {
        _q.setFromAxisAngle(Y, c.rot ? Math.PI / 2 : 0); _p.copy(toLocal(c.x, c.y, 0.022 * kz));
        icBody.setMatrixAt(i, _m.compose(_p, _q, _s));
        for (let j = 0; j < 4; j++) for (const sgn of [-1, 1]) { _o.set(sgn * 29 * k * s, -0.012 * kz, (j - 1.5) * 15 * k * s).applyQuaternion(_q); legs.setMatrixAt(nl++, _m.compose(_p.clone().add(_o), _q, _s)); }
      });
      shade(icBody); shade(legs); g.add(icBody, legs);
    }
  }
  // traces as curves in board space, longest first
  const tr = traces.map((l) => { const pts = l.map(([x, y]) => toLocal(x, y, 0.004 * kz)); let L = 0; for (let i = 1; i < pts.length; i++) L += pts[i].distanceTo(pts[i - 1]); return { points: pts, length: L, curve: polyCurve(pts, tw * s * 2.5), fromChip: !!l.fromChip }; }).sort((p, q) => q.length - p.length);
  g.traces = tr;
  g.traceWidth = tw * s;
  g.chipTraces = () => tr.filter((x) => x.fromChip);
  // lightTrace(i | trace, o): a glowing tube along traces[i] (or a trace from chipTraces()), added to the board
  g.lightTrace = (i, { color = accent, intensity = 5, radius = tw * s * 0.6, core = true } = {}) => { const T = typeof i === 'number' ? tr[i] : i; const t = tube(T.curve, { radius, color, intensity, segments: Math.max(60, Math.round(T.length * 160 / kz)), radial: 8, core }); g.add(t); return t; };
  g.toLocal = (u, v) => toLocal(u * W, v * H); // board fractions (0..1, from the far-left corner) -> local position
  g.top = top;
  g.userData.radius = Math.hypot(BW, BD) / 2;
  // anchor 'chip': the top of the chip body, or the board surface at the footprint's centre
  return withAnchors(g, chip ? { chip: pin(g, toLocal(cx + chipS / 2, cy + chipS / 2, chip === 'footprint' ? 0 : chipH * 1.03).toArray(), 'chip') } : {});
}

// =====================================================================================================================
// FIBRE-OPTIC CABLE (cutaway)
// =====================================================================================================================
// A tube shell from z0 to z1 (axis +z) with rounded cut edges at z1: outer wall, bevel, flat end ring, bevel, inner wall.
function shellGeo(r0, r1, z0, z1, bev, seg = 96) {
  const b = Math.min(bev, (r1 - r0) * 0.35), parts = [], len = z1 - b - z0;
  const wall = (r, inner) => { const c = new THREE.CylinderGeometry(r, r, len, seg, 1, true); c.translate(0, z0 + len / 2, 0); if (inner) flipNormals(c); return c; };
  const arc = (cx, cy, a0, a1, inner) => { const pts = []; for (let i = 0; i <= 6; i++) { const t = a0 + ((a1 - a0) * i) / 6; pts.push(new THREE.Vector2(cx + Math.cos(t) * b, cy + Math.sin(t) * b)); } if (inner) pts.reverse(); return new THREE.LatheGeometry(pts, seg); };
  parts.push(wall(r1, false));
  parts.push(arc(r1 - b, z1 - b, 0, Math.PI / 2, false));
  const ring = new THREE.RingGeometry(Math.max(r0 + b, 1e-4), r1 - b, seg, 1).rotateX(-Math.PI / 2); ring.translate(0, z1, 0); parts.push(ring);
  if (r0 > 1e-4) { parts.push(arc(r0 + b, z1 - b, Math.PI / 2, Math.PI, false)); parts.push(wall(r0, true)); }
  const geo = merge(parts);
  geo.rotateX(Math.PI / 2); // lathe/cylinder axis y -> cable axis z
  return geo;
}
function flipNormals(geo) { const n = geo.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i)); const idx = geo.index; if (idx) for (let i = 0; i < idx.count; i += 3) { const t = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, t); } }
class Helix extends THREE.Curve {
  constructor(rc, phase, pitch, z0, z1) { super(); Object.assign(this, { rc, phase, pitch, z0, z1 }); }
  getPoint(s, target = new V3()) { const z = this.z0 + (this.z1 - this.z0) * s, a = this.phase + (z / this.pitch) * Math.PI * 2; return target.set(this.rc * Math.cos(a), this.rc * Math.sin(a), z); }
}
const FIBER_COLORS = ['#3b7dd8', '#f08a24', '#3fae5a', '#8b5a2b', '#8f9aa6', '#f2f2f2', '#d64545', '#2b2b2b', '#f2d03b', '#8e5cc9', '#f29fb5', '#4fc6c9'];
export const FIBER_LAYERS = [
  { name: 'jacket', kind: 'shell', r: [0.86, 1.0], color: '#15171c', finish: 'plastic', rough: 0.36 },
  { name: 'armour', kind: 'wires', r: [0.7, 0.86], color: '#b3bcc7', finish: 'metal', rough: 0.3 },
  { name: 'copper', kind: 'shell', r: [0.57, 0.7], color: '#d88b55', finish: 'metal', rough: 0.3 },
  { name: 'insulation', kind: 'shell', r: [0.37, 0.57], color: '#e4e9f0', finish: 'plastic', rough: 0.3 },
  { name: 'core', kind: 'fibers', r: [0, 0.37] },
];

// fiberCable({ radius: 0.6, length: 8, layers: FIBER_LAYERS, fibers: 8 }) -> Group: a subsea cable cut back in steps
// along +z so every layer shows: jacket, helical steel armour, copper, insulation, and a gel tube of glass fibres
// that run out past the end with bare glass and a light core. cable.setLight(0..1) lights the cores and the tips;
// cable.at(t) runs light pulses down the bare glass (pure). cable.anchor('armour') sits on that layer's cut face.
export function fiberCable(o = {}) {
  const { length = 8, radius = 0.6, step = 0.42, fibers = 8, bevel = 0.02, segments = 96, layers = FIBER_LAYERS, pulseSpeed = 1.6 } = o;
  const accent = accentOf(o);
  const g = new THREE.Group(), anchors = {}; g.name = 'fiberCable';
  const finish = (L) => (L.finish === 'metal' ? mat.metal(L.color, { rough: L.rough ?? 0.25 }) : L.finish === 'glass' ? mat.glass({ color: L.color }) : mat.plastic(L.color, { rough: L.rough ?? 0.35, clearcoat: 0.5 }));
  const cores = [], tips = [], dashTexes = [];
  layers.forEach((L, li) => {
    const zEnd = li * step, r0 = L.r[0] * radius, r1 = L.r[1] * radius;
    if (L.kind === 'shell') {
      const m = shade(new THREE.Mesh(shellGeo(r0, r1, -length, zEnd, bevel * radius * 2, segments), finish(L)));
      m.material.side = THREE.DoubleSide; g.add(m);
      anchors[L.name] = pin(g, [0, (r0 + r1) / 2, zEnd], L.name);
    } else if (L.kind === 'wires') {
      const wr = ((r1 - r0) / 2) * 0.96, rc = (r0 + r1) / 2, n = L.count || Math.floor((2 * Math.PI * rc) / (2 * wr * 1.03));
      const pitch = (L.pitch ?? 7) * radius, geos = [];
      for (let i = 0; i < n; i++) {
        const h = new Helix(rc, (i / n) * Math.PI * 2, pitch, -length, zEnd - wr);
        geos.push(new THREE.TubeGeometry(h, Math.ceil(((length + zEnd) / pitch) * 64), wr, 10, false));
        const cap = new THREE.SphereGeometry(wr, 12, 8); const e = h.getPoint(1); cap.translate(e.x, e.y, e.z); geos.push(cap);
      }
      const merged = merge(geos);
      g.add(shade(new THREE.Mesh(merged, finish(L))));
      anchors[L.name] = pin(g, [0, rc, zEnd], L.name);
    } else if (L.kind === 'fibers') {
      // gel tube
      const tubeM = new THREE.MeshPhysicalMaterial({ color: C('#dfe9f2'), roughness: 0.35, transmission: 1, thickness: 0.05, ior: 1.4, clearcoat: 1, clearcoatRoughness: 0.1 });
      const gel = new THREE.Mesh(shellGeo(r1 * 0.86, r1, -length, zEnd, bevel * radius, segments), tubeM); gel.material.side = THREE.DoubleSide; g.add(gel);
      // central strength member
      const sm = shade(new THREE.Mesh(cyl(r1 * 0.16, length + zEnd + 0.02, 24).rotateX(Math.PI / 2), mat.metal('#9aa3ae', { rough: 0.3 }))); sm.position.z = (zEnd - length) / 2 + 0.01; g.add(sm);
      const fr = Math.min(r1 * 0.17, ((2 * Math.PI * r1 * 0.5) / fibers) * 0.42), rf = r1 * 0.5;
      const zCoat = zEnd + step * 0.55, zTip = zEnd + step * (o.reach ?? 2.2);
      const dash = makeCanvas(4, 256), dg = dash.getContext('2d');
      for (let y = 0; y < 256; y++) { const u = y / 256, v = Math.exp(-Math.pow((u - 0.5) / 0.09, 2)) + 0.12; dg.fillStyle = `rgb(${Math.round(255 * Math.min(1, v))},${Math.round(255 * Math.min(1, v))},${Math.round(255 * Math.min(1, v))})`; dg.fillRect(0, y, 4, 1); }
      const dashBase = canvasTexture(dash, { srgb: false }); dashBase.wrapS = dashBase.wrapT = THREE.RepeatWrapping;
      for (let i = 0; i < fibers; i++) {
        const a = (i / fibers) * Math.PI * 2 + 0.3, x = Math.cos(a) * rf, y = Math.sin(a) * rf;
        const coatLen = zCoat + length;
        const coat = shade(new THREE.Mesh(cyl(fr, coatLen, 24).rotateX(Math.PI / 2), mat.plastic(FIBER_COLORS[i % FIBER_COLORS.length], { rough: 0.3, clearcoat: 0.8 })));
        coat.position.set(x, y, zCoat - coatLen / 2); g.add(coat);
        const bareLen = zTip - zCoat + 0.002;
        const glass = new THREE.Mesh(cyl(fr * 0.55, bareLen, 20).rotateX(Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: C('#eef6ff'), roughness: 0.04, transmission: 1, thickness: fr, ior: 1.46, clearcoat: 1, envMapIntensity: 1.4 }));
        glass.position.set(x, y, zCoat + bareLen / 2 - 0.001); g.add(glass);
        const tex = dashBase.clone(); tex.repeat.set(1, Math.max(1, bareLen / 0.35)); dashTexes.push(tex);
        const core = new THREE.Mesh(cyl(fr * 0.2, bareLen + 0.004, 10).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, color: 0x000000, toneMapped: false }));
        core.position.copy(glass.position); g.add(core); cores.push(core);
        const tip = new THREE.Mesh(new THREE.SphereGeometry(fr * 0.42, 16, 12), new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false }));
        tip.position.set(x, y, zTip + 0.002); g.add(tip);
        const halo = glowSprite({ color: accent, intensity: 0, size: fr * 16, position: [x, y, zTip + 0.01] }); g.add(halo);
        tips.push({ tip, halo, ph: hashN(i, 3) });
      }
      anchors[L.name] = pin(g, [0, rf, zTip], L.name);
      anchors.tips = pin(g, [0, 0, zTip], 'tips');
    }
  });
  g.setLight = (v) => {
    for (const c of cores) c.material.color.copy(hot(accent, 7 * v));
    for (const t of tips) { t.tip.material.color.copy(hot(C('#fff4dc').lerp(C(accent), 0.3), 14 * v)); t.halo.setIntensity(0.55 * v); }
  };
  g.at = (t) => { dashTexes.forEach((tex, i) => { tex.offset.y = frac(-t * pulseSpeed / 0.35 + tips[i].ph); }); };
  g.setLight(o.light ?? 0); g.at(0);
  g.userData.radius = radius * 1.4; // frames the cut end, not the whole length
  return withAnchors(g, anchors);
}

// =====================================================================================================================
// INSTANCED DATA FIELDS WITH GLYPH LABELS
// =====================================================================================================================
// A glyph atlas: each character drawn once, white on black, in a grid of equal cells. Labels are composed per instance
// in the shader from up to 12 character codes, so every instance can show a different, changing number.
const atlasCache = new Map();
export function glyphAtlas({ chars = '0123456789', font = 'Barlow Condensed', weight = 700, px = 160 } = {}) {
  const set = [' ', ...[...new Set([...String(chars)])].filter((c) => c !== ' ')];
  const key = [font, weight, px, set.join('')].join('|');
  if (atlasCache.has(key)) return atlasCache.get(key);
  const f = `${weight} ${px}px ${FONT_STACK(font)}`;
  if (typeof document !== 'undefined' && document.fonts && !document.fonts.check(`${weight} ${px}px "${font}"`)) console.warn(`glyphAtlas: ${weight} "${font}" is not loaded yet, labels will use a fallback face; load it before building the shot`);
  const probe = makeCanvas(8, 8).getContext('2d'); probe.font = f;
  const widths = set.map((ch) => probe.measureText(ch).width);
  const m0 = probe.measureText('0'), cap = m0.actualBoundingBoxAscent + m0.actualBoundingBoxDescent;
  const cw = Math.ceil(Math.max(...widths) + px * 0.16), chh = Math.ceil(px * 1.2);
  const cols = Math.max(1, Math.min(set.length, Math.floor(4096 / cw))), rows = Math.ceil(set.length / cols);
  const c = makeCanvas(cols * cw, rows * chh), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  g.font = f; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  const index = new Map();
  set.forEach((s, i) => { index.set(s, i); if (i) g.fillText(s, (i % cols) * cw + cw / 2, Math.floor(i / cols) * chh + chh / 2 + (m0.actualBoundingBoxAscent - m0.actualBoundingBoxDescent) / 2); });
  const tex = canvasTexture(c, { srgb: false, flipY: false });
  // each glyph's advance as a fraction of the cell width, so labels are set proportionally, not monospaced
  const adv = new THREE.DataTexture(new Float32Array(widths.map((w) => w / cw)), set.length, 1, THREE.RedFormat, THREE.FloatType);
  adv.needsUpdate = true; adv.minFilter = adv.magFilter = THREE.NearestFilter; adv.generateMipmaps = false;
  const A = { tex, adv, cols, rows, index, aspect: cw / chh, capRatio: chh / Math.max(1, cap), chars: set.join(''), key };
  tex.userData.shared = adv.userData.shared = true; // cached: never disposed with a shot
  atlasCache.set(key, A);
  return A;
}

const GLYPH_VERT_PARS = /* glsl */ `attribute vec4 aC0; attribute vec4 aC1; attribute vec4 aC2; attribute vec4 aMisc; attribute vec4 aInk;
varying vec3 vGPos; varying vec3 vGN; flat varying vec4 vC0; flat varying vec4 vC1; flat varying vec4 vC2; flat varying vec4 vMisc; flat varying vec4 vInk;`;
const GLYPH_VERT = /* glsl */ `vGPos = position; vGN = normal; vC0 = aC0; vC1 = aC1; vC2 = aC2; vMisc = aMisc; vInk = aInk;`;
const GLYPH_FRAG_PARS = /* glsl */ `uniform sampler2D gAtlas; uniform sampler2D gAdv; uniform vec2 gGrid; uniform float gAspect; uniform float gFace; uniform float gBoth; uniform float gCell; uniform float gMaxW; uniform vec2 gOff; uniform vec3 gGlow; uniform float gInkRough; uniform float gTrack; uniform float gSelf;
varying vec3 vGPos; varying vec3 vGN; flat varying vec4 vC0; flat varying vec4 vC1; flat varying vec4 vC2; flat varying vec4 vMisc; flat varying vec4 vInk;
float gCode(int i){ vec4 c = i < 4 ? vC0 : (i < 8 ? vC1 : vC2); int k = i - 4 * (i / 4); return floor((k == 0 ? c.x : (k == 1 ? c.y : (k == 2 ? c.z : c.w))) + 0.5); }
float gAdvOf(float code){ return texelFetch(gAdv, ivec2(int(code), 0), 0).r; }
float glyphMask(){
  vec3 n = normalize(vGN);
  float side = gFace < 0.5 ? n.y : n.z;
  if (!gl_FrontFacing) side = -side;
  vec2 q = gFace < 0.5 ? vec2(vGPos.x, -vGPos.z) : vGPos.xy;
  if (side < 0.0) q.y = -q.y;
  int len = int(vMisc.z + 0.5);
  float total = 0.0;
  for (int j = 0; j < 12; j++) { if (j >= len) break; total += gAdvOf(gCode(j)) + (j > 0 ? gTrack : 0.0); }
  total = max(total, 0.05);
  float cw = gCell * gAspect;
  float fit = min(1.0, gMaxW / (total * cw));
  vec2 p = (q - gOff) / (vec2(cw, gCell) * fit);
  float x = p.x + total * 0.5, y = 0.5 - p.y;
  vec2 gx = dFdx(vec2(x, y)) / gGrid, gy = dFdy(vec2(x, y)) / gGrid;
  float face = smoothstep(0.55, 0.8, abs(side)) * (side > 0.0 ? 1.0 : gBoth);
  if (face <= 0.0 || len < 1 || x < 0.0 || x >= total || y < 0.0 || y > 1.0) return 0.0;
  float acc = 0.0, code = -1.0, lx = 0.0, a = 1.0;
  for (int j = 0; j < 12; j++) {
    if (j >= len) break;
    float c = gCode(j), w = gAdvOf(c);
    if (x < acc + w) { code = c; lx = x - acc; a = w; break; }
    acc += w + gTrack;
  }
  if (code < 0.5) return 0.0;
  vec2 cell = vec2(mod(code, gGrid.x), floor(code / gGrid.x + 0.001));
  return textureGrad(gAtlas, (cell + vec2(0.5 - a * 0.5 + lx, y)) / gGrid, gx, gy).r * face;
}`;
function hookGlyphs(m, U, fragMain) {
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\n' + GLYPH_VERT_PARS).replace('#include <begin_vertex>', '#include <begin_vertex>\n' + GLYPH_VERT);
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\n' + GLYPH_FRAG_PARS);
    for (const [hook, code] of fragMain) s.fragmentShader = s.fragmentShader.replace(hook, hook + '\n' + code);
  };
  m.customProgramCacheKey = () => 'glyphs:' + fragMain.map((x) => x[0]).join();
  return m;
}

// glyphField({ count, geometry, label: (i) => '#0042', face: 'top' | 'front', ... }) -> InstancedMesh with labels.
// The building block under packetField / bitField / dataTiles; use it directly for any labelled instanced object.
//   material 'physical' (lit tiles, ink printed on the face) or 'basic' (glowing glyphs only, additive)
//   textSize: cap height of the label in the instance's local units; maxWidth: long labels shrink to fit this width
//   chars: extra characters the atlas must hold for labels you set later (labels given up front are added for you)
// field.set(i, { label, color, glow, ink, inkGlow, labelAlpha }), setLabel(i, s), setColor(i, c), setGlow(i, v),
// field.layout((i, o) => { o.pos / o.rot / o.q / o.scale / o.s / o.hide ... }) places every instance from its home
// (field.home(i)); call it from update(t) with a closure over t. field.worldPos(i) for label anchors.
//   tracking: extra space between characters (fraction of a cell; labels are set proportionally from glyph widths)
//   selfLit: 0..1 makes tile colours glow like a screen (dataTiles defaults to 0.55 so photo pixels keep their colour)
//   font / weight: any face the page has loaded (Barlow Condensed 700 and Inter 400-800 are preloaded by the engine)
export function glyphField(o = {}) {
  const { count = 100, geometry, material: kind = 'physical', face = 'top', both = false, textSize = 0.1, maxWidth = 0.9, offset = [0, 0], font = 'Barlow Condensed', weight = 700, px = 160, maxChars = 12, label = null } = o;
  const accent = accentOf(o);
  const labelFn = typeof label === 'function' ? label : label != null ? () => String(label) : null;
  const charset = new Set([...String(o.chars ?? '0123456789')]);
  if (labelFn) for (let i = 0; i < count; i++) for (const ch of String(labelFn(i) ?? '')) charset.add(ch);
  const A = glyphAtlas({ chars: [...charset].join(''), font, weight, px });
  const geo = geometry.clone();
  const mk = (n) => { const at = new THREE.InstancedBufferAttribute(new Float32Array(count * n), n); at.setUsage(THREE.DynamicDrawUsage); return at; };
  const aC = [mk(4), mk(4), mk(4)], aMisc = mk(4), aInk = mk(4);
  geo.setAttribute('aC0', aC[0]); geo.setAttribute('aC1', aC[1]); geo.setAttribute('aC2', aC[2]); geo.setAttribute('aMisc', aMisc); geo.setAttribute('aInk', aInk);
  const U = {
    gAtlas: { value: A.tex }, gAdv: { value: A.adv }, gTrack: { value: o.tracking ?? 0.02 }, gSelf: { value: o.selfLit ?? 0 }, gGrid: { value: new THREE.Vector2(A.cols, A.rows) }, gAspect: { value: A.aspect }, gFace: { value: face === 'front' ? 1 : 0 }, gBoth: { value: both ? 1 : 0 },
    gCell: { value: textSize * A.capRatio }, gMaxW: { value: maxWidth }, gOff: { value: new THREE.Vector2(...offset) }, gGlow: { value: hot(o.glowColor || accent, 1) }, gInkRough: { value: o.inkRough ?? 0.6 },
  };
  let material;
  if (kind === 'basic') {
    material = hookGlyphs(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false, side: THREE.DoubleSide }), U,
      [['#include <color_fragment>', 'float gA = glyphMask() * vMisc.y; if (gA < 0.003) discard; diffuseColor = vec4(vInk.rgb * vInk.a * diffuseColor.rgb + gGlow * vMisc.x, gA);']]);
  } else {
    material = hookGlyphs(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: o.rough ?? 0.32, metalness: o.metal ?? 0, clearcoat: o.clearcoat ?? 0.6, clearcoatRoughness: 0.12, envMapIntensity: o.env ?? 1, ...(o.extra || {}) }), U, [
      ['#include <metalnessmap_fragment>', 'float gA = glyphMask() * vMisc.y; diffuseColor.rgb = mix(diffuseColor.rgb, vInk.rgb, gA); roughnessFactor = mix(roughnessFactor, gInkRough, gA); metalnessFactor = mix(metalnessFactor, 0.0, gA);'],
      ['#include <emissivemap_fragment>', 'totalEmissiveRadiance += gGlow * vMisc.x + vInk.rgb * vInk.a * gA + diffuseColor.rgb * gSelf;'],
    ]);
  }
  const mesh = new THREE.InstancedMesh(geo, material, count);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.castShadow = kind !== 'basic' && o.shadows !== false; mesh.receiveShadow = kind !== 'basic';
  const labels = new Array(count).fill(null), _c = new THREE.Color(), missing = new Set();
  mesh.atlas = A;
  mesh.setLabel = (i, s) => {
    s = s == null ? '' : String(s);
    if (labels[i] === s) return;
    labels[i] = s;
    const chars = Array.from(s), n = Math.min(chars.length, maxChars, 12);
    for (let j = 0; j < 12; j++) {
      let code = 0;
      if (j < n) { code = A.index.get(chars[j]); if (code == null) { code = 0; if (!missing.has(chars[j])) { missing.add(chars[j]); console.warn(`glyphField: "${chars[j]}" is not in the atlas; pass it in chars`); } } }
      aC[j >> 2].array[i * 4 + (j & 3)] = code;
    }
    aMisc.array[i * 4 + 2] = n;
    aC[0].needsUpdate = aC[1].needsUpdate = aC[2].needsUpdate = aMisc.needsUpdate = true;
  };
  mesh.label = (i) => labels[i];
  mesh.setColor = (i, c) => { mesh.setColorAt(i, c && c.isColor ? c : _c.set(c)); mesh.instanceColor.needsUpdate = true; };
  mesh.setGlow = (i, v) => { aMisc.array[i * 4] = v; aMisc.needsUpdate = true; };
  mesh.setLabelAlpha = (i, v) => { aMisc.array[i * 4 + 1] = v; aMisc.needsUpdate = true; };
  mesh.setInk = (i, c, glow) => { if (c != null) { _c.set(c); aInk.array[i * 4] = _c.r; aInk.array[i * 4 + 1] = _c.g; aInk.array[i * 4 + 2] = _c.b; } if (glow != null) aInk.array[i * 4 + 3] = glow; aInk.needsUpdate = true; };
  mesh.set = (i, s = {}) => {
    if (s.label !== undefined) mesh.setLabel(i, s.label);
    if (s.color != null) mesh.setColor(i, s.color);
    if (s.glow != null) mesh.setGlow(i, s.glow);
    if (s.labelAlpha != null) mesh.setLabelAlpha(i, s.labelAlpha);
    if (s.ink != null || s.inkGlow != null) mesh.setInk(i, s.ink, s.inkGlow);
  };
  // defaults
  const baseColor = C(o.color ?? '#ffffff'), inkC = C(o.ink ?? '#16110a');
  for (let i = 0; i < count; i++) {
    mesh.setColorAt(i, baseColor);
    aMisc.array[i * 4 + 1] = 1;
    aInk.array.set([inkC.r, inkC.g, inkC.b, o.inkGlow ?? 0], i * 4);
    if (labelFn) mesh.setLabel(i, labelFn(i));
  }
  mesh.instanceColor.needsUpdate = true; aInk.needsUpdate = true; aMisc.needsUpdate = true;
  // layout
  const home = o.home || ((i, v) => v.set(0, 0, 0));
  const L = { pos: new V3(), rot: new THREE.Euler(), q: null, scale: new V3(1, 1, 1), s: 1, hide: false };
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new V3(), _m2 = new THREE.Matrix4();
  mesh.home = (i, v = new V3()) => home(i, v);
  mesh.layout = (fn) => {
    for (let i = 0; i < count; i++) {
      home(i, L.pos); L.rot.set(0, 0, 0); L.q = null; L.scale.set(1, 1, 1); L.s = 1; L.hide = false;
      if (fn) fn(i, L);
      if (L.hide || L.s <= 0) _m.makeScale(0, 0, 0);
      else { if (L.q) _q.copy(L.q); else _q.setFromEuler(L.rot); _m.compose(L.pos, _q, _s.copy(L.scale).multiplyScalar(L.s)); }
      mesh.setMatrixAt(i, _m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    base.set(mesh.instanceMatrix.array); // helpers that move single instances (pluck) start from this, never from their own output
  };
  const base = new Float32Array(count * 16);
  mesh.baseMatrixAt = (i, m) => m.fromArray(base, i * 16);
  mesh.worldPos = (i, v = new V3()) => { mesh.updateWorldMatrix(true, false); mesh.getMatrixAt(i, _m2); return v.setFromMatrixPosition(_m2).applyMatrix4(mesh.matrixWorld); };
  mesh.layout();
  const box = new THREE.Box3(), _hv = new V3();
  for (let i = 0; i < count; i++) { home(i, _hv); box.expandByPoint(_hv); }
  if (!geo.boundingSphere) geo.computeBoundingSphere();
  const sph = box.getBoundingSphere(new THREE.Sphere());
  mesh.userData.radius = sph.radius + geo.boundingSphere.radius; mesh.userData.center = sph.center;
  return mesh;
}

// packetField({ count: 1500, cols: 50, label: (i) => '#' + ... }) -> InstancedMesh of rounded bricks numbered on top.
// look 'solid' (accent plastic, dark ink) or 'dark' (dark glossy, glowing accent numbers). Helpers, all pure in t:
//   field.burst(t, { t0, dur, from, spread, lift, stagger }): every packet flies out of one point to its grid slot
//   field.fromBlock(t, { t0, dur, wave, lift }): the packets start packed into one solid block and split into the
//     grid in a wave from the block's centre, nearest first ("it splits into 1,500 packets"); before t0 it is a block
//   field.stream(t, { curve, speed, spacing }): packets travel single file along a curve (world units; loops)
//   field.ripple(i, t, { t0, center, speed, width }) -> 0..1, a wave across the grid to lift or light packets with
// layout 'grid' (default) | 'block': the resting layout (field.gridPos / field.blockPos give either). block: [nx, nz,
// ny] packets per side of the block (default about square in plan, ny layers), standing on y = 0 at the origin.
// heroSlot / hero: packet number `hero` (as labelled, 1-based) sits in instance `heroSlot` and the packet that was
// there takes its number, so the hero can rise from the slot nearest the camera: field.pluck(t, field.heroSlot, ...).
export function packetField(o = {}) {
  const { count = 1500, cols = 50, size = [0.5, 0.16, 0.3], gap = [0.1, 0.1], radius = 0.04, look = 'solid', seed = 9 } = o;
  const accent = accentOf(o), solid = look !== 'dark', rows = Math.ceil(count / cols);
  const pitch = [size[0] + gap[0], size[2] + gap[1]];
  const gridPos = o.home || ((i, v) => v.set(((i % cols) - (cols - 1) / 2) * pitch[0], 0, (Math.floor(i / cols) - (rows - 1) / 2) * pitch[1]));
  // the block: packets packed almost touching, x fastest, then z, then layer by layer upwards
  const ny = o.block?.[2] ?? Math.max(1, Math.round(Math.cbrt(count) * 0.85)), per = Math.ceil(count / ny);
  const nx = o.block?.[0] ?? Math.max(1, Math.round(Math.sqrt((per * size[2]) / size[0]))), nz = o.block?.[1] ?? Math.ceil(per / nx);
  const bg = 0.012 * Math.max(...size), bp = [size[0] + bg, size[1] + bg, size[2] + bg];
  const blockPos = (i, v) => v.set(((i % nx) - (nx - 1) / 2) * bp[0], Math.floor(i / (nx * nz)) * bp[1], ((Math.floor(i / nx) % nz) - (nz - 1) / 2) * bp[2]);
  const heroSlot = o.heroSlot ?? null, heroN = o.hero ?? (heroSlot != null ? heroSlot + 1 : null);
  const swap = (i) => (heroSlot == null ? i : i === heroSlot ? heroN - 1 : i === heroN - 1 ? heroSlot : i);
  const baseLabel = o.label ?? ((i) => '#' + String(i + 1).padStart(4, '0'));
  const F = glyphField({
    ...o, count, geometry: rbox(size[0], size[1], size[2], radius, 3), face: o.face || 'top',
    label: typeof baseLabel === 'function' ? (i) => baseLabel(swap(i)) : baseLabel, chars: '#0123456789' + (o.chars || ''),
    textSize: o.textSize ?? size[2] * 0.36, maxWidth: o.maxWidth ?? size[0] * 0.84,
    color: o.color ?? (solid ? accent : '#1a2232'), ink: o.ink ?? (solid ? '#2a1b06' : accent), inkGlow: o.inkGlow ?? (solid ? 0 : 2.5),
    rough: o.rough ?? 0.34, clearcoat: o.clearcoat ?? 0.55,
    home: o.layout === 'block' ? blockPos : gridPos,
  });
  F.gridPos = (i, v = new V3()) => gridPos(i, v); F.blockPos = (i, v = new V3()) => blockPos(i, v);
  F.block = [nx, nz, ny]; F.heroSlot = heroSlot;
  // the hero's number glows (emissive ink: cream on the accent plastic, the accent on a dark packet), so it reads when
  // it is plucked up to the camera with no light on its face (a test reel needed a point light on it); F.set(heroSlot, {
  // ink, inkGlow }) overrides it, and heroInkGlow: 0 prints it like the rest
  if (heroSlot != null) F.set(heroSlot, { ink: o.heroInk ?? (solid ? '#fff2dc' : accent), inkGlow: o.heroInkGlow ?? (solid ? 1.6 : 2.5) });
  const bc = new V3(0, ((Math.ceil(count / (nx * nz)) - 1) * bp[1]) / 2, 0), bDist = Array.from({ length: count }, (_, i) => blockPos(i, new V3()).distanceTo(bc));
  const R = rng(seed), S = Array.from({ length: count }, () => [R(), R(), R(), R()]);
  const _h = new V3(), _t = new V3(), _up = new V3(0, 1, 0), _o = new V3(), _mm = new THREE.Matrix4(), _sq = new THREE.Quaternion(), _turn = new THREE.Quaternion().setFromAxisAngle(_up, -Math.PI / 2), _turnBack = new THREE.Quaternion().setFromAxisAngle(_up, Math.PI / 2);
  Object.assign(F, { cols, rows, pitch, size });
  F.seed = (i) => S[i];
  F.burst = (t, { t0 = 0, dur = 0.9, from = [0, 0.3, 0], spread = 0.6, lift = 0.8, spin = 3, stagger = 0.6, ease = 'outCubic' } = {}) => F.layout((i, L) => {
    const s = S[i], u = ramp(t, t0 + s[0] * stagger, t0 + s[0] * stagger + dur, ease);
    F.home(i, _h);
    L.pos.set(from[0] + (s[1] - 0.5) * spread, from[1], from[2] + (s[2] - 0.5) * spread).lerp(_h, u);
    L.pos.y += Math.sin(u * Math.PI) * lift * (0.4 + s[2]);
    L.rot.set((1 - u) * s[1] * spin, (1 - u) * s[2] * spin, 0);
    L.s = 0.3 + 0.7 * clamp(u * 3);
  });
  // stream: speed in world units per second along the curve, spacing in world units between packet centres. Labels
  // read along the direction of travel; flip: true turns them to read against it (for paths that run right to left).
  F.stream = (t, { curve, speed = 1, spacing = size[0] * 1.5, offset = 0, loop = true, align = true, flip = false } = {}) => {
    const L = curve.getLength();
    F.layout((i, P) => {
      if (loop && i * spacing >= L) { P.hide = true; return; } // a loop holds only as many packets as fit along it
      let u = (offset + t * speed - i * spacing) / L;
      if (loop) u = frac(u); else if (u < 0 || u > 1) { P.hide = true; return; }
      curve.getPointAt(u, P.pos);
      if (align) { curve.getTangentAt(u, _t); _mm.lookAt(_t, _o, _up); P.q = _sq.setFromRotationMatrix(_mm).multiply(flip ? _turnBack : _turn); }
    });
  };
  // pluck(t, i, { t0, dur, to, scale, spin }): one packet leaves its slot (where the last layout put it) for a point in
  // the field's space, e.g. the hero packet coming to camera. Call it after this frame's burst / stream / layout.
  const _pm = new THREE.Matrix4(), _pp = new V3(), _pq = new THREE.Quaternion(), _ps = new V3(), _pq2 = new THREE.Quaternion();
  F.pluck = (t, i, { t0 = 0, dur = 1.2, to = [0, 1, 2], scale = 1.4, spin = [0.5, 0.25, 0], ease = 'inOutCubic' } = {}) => {
    const u = ramp(t, t0, t0 + dur, ease);
    F.baseMatrixAt(i, _pm); _pm.decompose(_pp, _pq, _ps);
    _pp.lerp(_h.set(...to), u); _pq.slerp(_pq2.setFromEuler(new THREE.Euler(...spin)), u); _ps.lerp(_h.set(scale, scale, scale), u);
    F.setMatrixAt(i, _pm.compose(_pp, _pq, _ps)); F.instanceMatrix.needsUpdate = true;
    return u;
  };
  // fromBlock: each packet leaves the block wave x its distance from the block's centre (plus a little jitter) after
  // t0 and arcs to its grid slot over dur; offset moves the block (it can slide, jam and recoil before the split)
  const _b = new V3(), _g = new V3();
  F.fromBlock = (t, { t0 = 0, dur = 0.6, wave = 0.085, jitter = 0.08, lift = 0.6, spin = 1.2, offset = [0, 0, 0], ease = 'inOutCubic' } = {}) => F.layout((i, L) => {
    const s = S[i], a = t0 + bDist[i] * wave + s[0] * jitter, u = ramp(t, a, a + dur, ease);
    blockPos(i, _b).add(_h.set(...offset)); gridPos(i, _g);
    L.pos.copy(_b).lerp(_g, u);
    L.pos.y += Math.sin(u * Math.PI) * lift * (0.6 + 0.8 * s[1]);
    L.rot.set(Math.sin(u * Math.PI) * (s[2] - 0.5) * spin, Math.sin(u * Math.PI) * (s[1] - 0.5) * spin * 0.7, 0);
  });
  F.ripple = (i, t, { t0 = 0, center = [0, 0, 0], speed = 4, width = 0.8 } = {}) => {
    F.home(i, _h); const d = _h.distanceTo(_t.set(...center)), front = (t - t0) * speed;
    return Math.exp(-Math.pow((d - front) / width, 2)) * (t >= t0 ? 1 : 0);
  };
  return F;
}

// bitField({ rows: 12, cols: 20 }) -> InstancedMesh of tiles showing 0/1 (or any short text). style 'tiles' (glossy
// tiles, printed digits) or 'glyphs' (just glowing digits floating in space); face 'front' (a wall facing +z) or 'top'.
//   value: (i) => '0' | '1' | '42' (default: seeded random bits). Helpers, all pure in t:
//   bits.flipAt(t, { t0, dur, delay: (i) => s, to: (i) => '1' }): tiles flip over, the new value on the back
//   bits.scramble(t, { rate, chars, len, amount }): values churn like encrypted data
//   bits.pop(t, { t0, dur, delay: (i) => s }): tiles scale in with a little overshoot
export function bitField(o = {}) {
  const { rows = 12, cols = 20, cell = 0.2, gap = 0.035, depth = 0.05, style = 'tiles', face = 'front', seed = 7 } = o;
  const accent = accentOf(o), count = rows * cols, pitch = cell + gap, glyphs = style === 'glyphs', front = face !== 'top';
  const R = rng(seed);
  const vals = Array.from({ length: count }, (_, i) => (o.value ? String(o.value(i)) : R() < 0.5 ? '0' : '1'));
  const geo = glyphs ? (front ? new THREE.PlaneGeometry(cell, cell) : new THREE.PlaneGeometry(cell, cell).rotateX(-Math.PI / 2)) : front ? rbox(cell, cell, depth, Math.min(cell * 0.16, depth * 0.49), 3) : rbox(cell, depth, cell, Math.min(cell * 0.16, depth * 0.49), 3);
  const F = glyphField({
    ...o, count, geometry: geo, material: glyphs ? 'basic' : 'physical', face: front ? 'front' : 'top', both: true,
    label: (i) => vals[i], chars: '0123456789ABCDEF' + (o.chars || ''),
    textSize: o.textSize ?? cell * (glyphs ? 0.62 : 0.46), maxWidth: o.maxWidth ?? cell * 0.84,
    color: o.color ?? (glyphs ? '#ffffff' : '#131a27'), ink: o.ink ?? (glyphs ? accent : '#e2e8f2'), inkGlow: o.inkGlow ?? (glyphs ? 3 : 0),
    rough: o.rough ?? 0.3, clearcoat: o.clearcoat ?? 0.8,
    home: o.home || ((i, v) => { const c = i % cols, r = Math.floor(i / cols); return front ? v.set((c - (cols - 1) / 2) * pitch, ((rows - 1) / 2 - r) * pitch, 0) : v.set((c - (cols - 1) / 2) * pitch, 0, (r - (rows - 1) / 2) * pitch); }),
  });
  Object.assign(F, { rows, cols, pitch, cell, values: vals });
  F.flipAt = (t, { t0 = 0, dur = 0.45, delay = () => 0, to = (i) => (vals[i] === '1' ? '0' : '1'), from = (i) => vals[i], ease = 'inOutCubic', lift = 0 } = {}) => {
    const E = easeFn(ease);
    F.layout((i, L) => {
      const p = E(clamp((t - t0 - delay(i)) / dur));
      L.rot.x = p * Math.PI;
      if (lift) { if (front) L.pos.z += Math.sin(p * Math.PI) * lift; else L.pos.y += Math.sin(p * Math.PI) * lift; }
      F.setLabel(i, p < 0.5 ? from(i) : to(i));
    });
  };
  F.scramble = (t, { rate = 12, chars = '0123456789', len = 1, amount = 1, seed: s2 = 3 } = {}) => {
    for (let i = 0; i < count; i++) {
      if (hashN(i, s2 + 9) > amount) { F.setLabel(i, vals[i]); continue; }
      const step = Math.floor(t * rate + hashN(i, s2) * 7);
      let s = ''; for (let j = 0; j < len; j++) s += chars[Math.floor(hashN(i * 31 + j * 7 + step * 131, s2) * chars.length) % chars.length];
      F.setLabel(i, s);
    }
  };
  F.pop = (t, { t0 = 0, dur = 0.35, delay = () => 0 } = {}) => F.layout((i, L) => { const u = clamp((t - t0 - delay(i)) / dur); L.s = u <= 0 ? 0 : easeFn('outBack')(u); });
  F.reset = () => { for (let i = 0; i < count; i++) F.setLabel(i, vals[i]); F.layout(); };
  if (o.hot != null) { // tiles showing this value glow in the accent ('1' = current flowing)
    const base = F.setLabel, hotC = C(o.hotColor || accent), inkC = C(o.ink ?? (glyphs ? accent : '#e2e8f2')), inkG = o.inkGlow ?? (glyphs ? 3 : 0);
    F.setLabel = (i, s) => { const str = s == null ? '' : String(s); if (F.label(i) === str) return; base(i, str); const h = str === String(o.hot); F.setInk(i, h ? hotC : inkC, h ? (o.hotGlow ?? 2.6) : inkG); };
    for (let i = 0; i < count; i++) { const h = vals[i] === String(o.hot); F.setInk(i, h ? hotC : inkC, h ? (o.hotGlow ?? 2.6) : inkG); }
  }
  return F;
}

// dataTiles({ image, cols: 48 }) -> Promise<InstancedMesh>: an image sampled into a grid of tiles, each tile coloured
// by its pixel. label: 'none' | 'lum' (0-255) | 'hex' (RRGGBB) | 'bits' (8-bit brightness) | 'bit' (0/1) | (px, i) => str.
// image: a URL (use k.asset('photo.jpg')), a texture (await k.image('photo.jpg')), an <img>, a canvas or an ImageBitmap.
//   tiles.pixels[i] = { r, g, b, l, x, y } (0..1 sRGB); tiles.mix(v): 0 = the photo, 1 = neutral data tiles;
//   tiles.layout(...) like every field, e.g. lift each tile by tiles.pixels[i].l for a 3D relief.
export async function dataTiles(o = {}) {
  const { image, cols = 48, width = 4, gap = 0.1, depth = 0.05, face = 'front', label = 'none' } = o;
  const img = await loadImageish(image);
  const iw = img.naturalWidth || img.videoWidth || img.width, ih = img.naturalHeight || img.videoHeight || img.height;
  const rows = o.rows || Math.max(1, Math.round((cols * ih) / iw));
  // two-step downscale so each tile is the average of its pixels
  const mid = makeCanvas(Math.min(iw, cols * 8), Math.min(ih, rows * 8)), mg = mid.getContext('2d'); mg.imageSmoothingQuality = 'high'; mg.drawImage(img, 0, 0, mid.width, mid.height);
  const sm = makeCanvas(cols, rows), sg = sm.getContext('2d', { willReadFrequently: true }); sg.imageSmoothingQuality = 'high'; sg.drawImage(mid, 0, 0, cols, rows);
  const data = sg.getImageData(0, 0, cols, rows).data;
  const count = cols * rows, cell = width / cols, size = cell * (1 - gap), front = face !== 'top';
  const px = Array.from({ length: count }, (_, i) => { const r = data[i * 4] / 255, g = data[i * 4 + 1] / 255, b = data[i * 4 + 2] / 255; return { r, g, b, l: 0.2126 * r + 0.7152 * g + 0.0722 * b, x: i % cols, y: Math.floor(i / cols) }; });
  const hx = (v) => Math.round(v * 255).toString(16).padStart(2, '0').toUpperCase();
  const modes = { none: () => '', lum: (i) => String(Math.round(px[i].l * 255)), hex: (i) => hx(px[i].r) + hx(px[i].g) + hx(px[i].b), bits: (i) => Math.round(px[i].l * 255).toString(2).padStart(8, '0'), bit: (i) => (px[i].l > 0.5 ? '1' : '0') };
  const labelOf = typeof label === 'function' ? (i) => label(px[i], i) : modes[label] || modes.none;
  const geo = front ? rbox(size, size, depth, Math.min(size * 0.12, depth * 0.49), 2) : rbox(size, depth, size, Math.min(size * 0.12, depth * 0.49), 2);
  const F = glyphField({
    ...o, count, geometry: geo, face: front ? 'front' : 'top', label: labelOf, chars: '0123456789ABCDEF' + (o.chars || ''),
    textSize: o.textSize ?? size * (label === 'bits' ? 0.15 : label === 'hex' ? 0.17 : 0.3), maxWidth: o.maxWidth ?? size * 0.86,
    rough: o.rough ?? 0.4, clearcoat: o.clearcoat ?? 0.4, selfLit: o.selfLit ?? 0.55,
    home: o.home || ((i, v) => { const c = i % cols, r = Math.floor(i / cols); return front ? v.set((c - (cols - 1) / 2) * cell, ((rows - 1) / 2 - r) * cell, 0) : v.set((c - (cols - 1) / 2) * cell, 0, (r - (rows - 1) / 2) * cell); }),
  });
  const base = px.map((p) => new THREE.Color().setRGB(p.r, p.g, p.b, THREE.SRGBColorSpace));
  const neutral = C(o.neutral || '#1a2231'), _c = new THREE.Color();
  F.mix = (v, to = neutral) => { const tc = to.isColor ? to : C(to); for (let i = 0; i < count; i++) F.setColor(i, _c.copy(base[i]).lerp(tc, clamp(v))); };
  F.autoInk = (dark = '#15110b', light = '#f4f6fa', glow = 0) => { for (let i = 0; i < count; i++) F.setInk(i, px[i].l > 0.55 ? dark : light, glow); };
  F.mix(0); F.autoInk();
  Object.assign(F, { pixels: px, cols, rows, cell, baseColors: base });
  return F;
}
async function loadImageish(src) {
  if (!src) throw new Error('dataTiles: pass { image }');
  if (src.isTexture) return src.image;
  if (typeof src === 'string') { const im = new Image(); im.crossOrigin = 'anonymous'; im.src = src; await im.decode(); return im; }
  return src;
}
