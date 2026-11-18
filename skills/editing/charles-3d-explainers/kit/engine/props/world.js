// World props: a night city, rolling terrain (with an optional glowing grid), the ocean floor, a desk, a room lit by
// a window, a road, trees and a bowl of noodles. All procedural and seeded (no downloads), instanced where counts are high, and every
// animated part is a pure function of time (.at(t)). Surfaces that the camera can get close to (wood, windows, road
// paint, caustics) are computed per pixel, so they stay crisp at any distance and fade to their average before they
// can shimmer. Each returns a THREE.Group; userData.radius is its bounding radius for cam.fit/frame, and props with
// parts have g.anchors (named Object3D markers) and g.anchor(name), which throws on a bad name.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { noiseTexture, accentDefault, mat } from '../look.js';
import { rng, clamp, smooth, lerp } from '../util.js';
import { dust } from '../fx.js';
import { rockGeometry, glslNoise, fbm3 } from './space.js';
import { withAnchors } from './base.js';
import { contactShadow } from './devices.js';

const C = (c) => (c && c.isColor ? c.clone() : new THREE.Color(c));
const V3 = (a) => (a && a.isVector3 ? a.clone() : new THREE.Vector3(...a));
const TAU = Math.PI * 2;
const _cache = new Map(); // flagged shared: evicting a shot never disposes what other shots reuse
const share = (v) => { for (const x of v?.isTexture ? [v] : Object.values(v || {})) if (x?.isTexture) x.userData.shared = true; return v; };
const cached = (key, make) => { if (!_cache.has(key)) _cache.set(key, share(make())); return _cache.get(key); };
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };

// ---------- deterministic 2D value noise (JS side, for heights) ----------
const hash2 = (x, y, s) => { const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n); };
export function noise2(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10), v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
export function fbm2(x, y, { octaves = 5, seed = 0, lac = 2.03, gain = 0.5 } = {}) {
  let a = 0.5, f = 1, s = 0, n = 0;
  for (let i = 0; i < octaves; i++) { s += noise2(x * f + i * 17.3, y * f - i * 9.1, seed) * a; n += a; a *= gain; f *= lac; }
  return s / n;
}

// Add GLSL to a built-in material: vertex/fragment snippets keyed by the #include they follow ('pre:<chunk>' goes
// before it). Keeps the lighting, shadows and fog of MeshStandardMaterial.
function patch(material, { uniforms = {}, vertexHead = '', fragmentHead = '', vertex = {}, fragment = {}, key }) {
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\n${vertexHead}`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n${glslNoise}\n${fragmentHead}`);
    for (const [k, code] of Object.entries(vertex)) sh.vertexShader = k.startsWith('pre:') ? sh.vertexShader.replace(`#include <${k.slice(4)}>`, `${code}\n#include <${k.slice(4)}>`) : sh.vertexShader.replace(`#include <${k}>`, `#include <${k}>\n${code}`);
    for (const [k, code] of Object.entries(fragment)) sh.fragmentShader = k.startsWith('pre:') ? sh.fragmentShader.replace(`#include <${k.slice(4)}>`, `${code}\n#include <${k.slice(4)}>`) : sh.fragmentShader.replace(`#include <${k}>`, `#include <${k}>\n${code}`);
  };
  material.customProgramCacheKey = () => key;
  return material;
}

// Height bump from a scalar computed in the fragment shader (three.js' screen-space derivative bump).
const GLSL_BUMP = /* glsl */ `
vec3 bumpNormal(vec3 n, float h, float k){
  vec3 dpdx = dFdx(-vViewPosition), dpdy = dFdy(-vViewPosition);
  float hx = dFdx(h) * k, hy = dFdy(h) * k;
  vec3 r1 = cross(dpdy, n), r2 = cross(n, dpdx);
  float det = dot(dpdx, r1);
  vec3 grad = sign(det) * (hx * r1 + hy * r2);
  return normalize(abs(det) * n - grad);
}`;

// heightAt in world units for a ground that has been moved, turned or scaled: (x, z) world -> the surface's world y
// there (exact for any move, turn about y and scale; a tilted ground is read at its y = 0 plane).
const atWorld = (g, heightAt) => { const p = new THREE.Vector3(); return (x, z) => { g.updateWorldMatrix(true, false); g.worldToLocal(p.set(x, 0, z)); p.y = heightAt(p.x, p.z); return g.localToWorld(p).y; }; };

// ---------- glowing points (traffic, beacons, lamp halos) ----------
// One Points shader for small light sources: static, moving along a line (aMove = dir.xyz, length), or blinking
// (aAnim = speed, phase, blink period, duty). Lens-aware (grows into a soft disc out of focus), fogged towards black.
const LIGHT_V = /* glsl */ `
attribute vec3 aColor; attribute float aSize; attribute vec4 aMove; attribute vec4 aAnim;
uniform float uTime, uRes, uFocus, uAperture, uI, uMinPx;
varying vec3 vC; varying float vK; varying float vD;
void main(){
  vec3 p = position;
  if (aMove.w > 0.) p += aMove.xyz * fract(aAnim.y + aAnim.x * uTime / aMove.w) * aMove.w;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  float d = max(1e-3, -mv.z); vD = d;
  float sz = aSize * length(modelMatrix[0].xyz);
  float coc = uAperture * abs(d - uFocus) / max(uFocus, 1e-3);
  float r = max(sz, coc * 2.);
  float px = r * projectionMatrix[1][1] * 960. * uRes / d;
  float shown = max(px, uMinPx);
  gl_PointSize = min(shown, 120.);
  vK = (sz * sz) / (r * r) * min(1., (px * px) / (shown * shown));
  float blink = aAnim.z > 0. ? step(fract(uTime / aAnim.z + aAnim.y), aAnim.w) : 1.;
  vC = aColor * uI * blink;
}`;
const LIGHT_F = /* glsl */ `
varying vec3 vC; varying float vK; varying float vD;
#ifdef USE_FOG
uniform float fogDensity; uniform float fogNear; uniform float fogFar;
#endif
void main(){ vec2 d = gl_PointCoord - .5; float r2 = dot(d, d) * 4.; float a = exp(-r2 * 5.) + .18 * exp(-r2 * 1.3); a *= 1. - smoothstep(.75, 1., r2); if (a < .002) discard;
  vec3 c = vC * vK * a;
  #ifdef USE_FOG
    #ifdef FOG_EXP2
      c *= exp(-fogDensity * fogDensity * vD * vD);
    #else
      c *= 1. - smoothstep(fogNear, fogFar, vD);
    #endif
  #endif
  gl_FragColor = vec4(c, 1.); }`;
function lightPoints(list, { intensity = 1, minPx = 1.5 } = {}) {
  const n = list.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), move = new Float32Array(n * 4), anim = new Float32Array(n * 4);
  list.forEach((L, i) => {
    pos.set(L.p, i * 3); const c = C(L.color || '#ffffff').multiplyScalar(L.i ?? 1); col.set([c.r, c.g, c.b], i * 3); size[i] = L.size;
    move.set(L.move || [0, 0, 0, 0], i * 4); anim.set(L.anim || [0, 0, 0, 1], i * 4);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3)); geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aMove', new THREE.BufferAttribute(move, 4)); geo.setAttribute('aAnim', new THREE.BufferAttribute(anim, 4));
  const m = new THREE.ShaderMaterial({
    vertexShader: LIGHT_V, fragmentShader: LIGHT_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uRes: { value: 1 }, uFocus: { value: 10 }, uAperture: { value: 0 }, uI: { value: intensity }, uMinPx: { value: minPx } }]),
  });
  const p = new THREE.Points(geo, m); p.frustumCulled = false;
  p.at = (t) => { m.uniforms.uTime.value = t; };
  return p;
}

// =====================================================================================================================
// CITY
// =====================================================================================================================

// A night city on a street grid: instanced buildings whose windows are drawn per pixel (offices with whole floors
// lit, flats with scattered warm windows, glowing shop fronts at street level), setbacks on the towers, rooftop
// plant, sodium street lights pooling on the asphalt, traffic streaming along the streets and red beacons blinking
// on the tallest roofs. The street grid keeps going past the buildings as suburbs, so aerial shots reach the horizon.
// size = width of the built-up core in world units; blocks per side; lit = fraction of windows on; height scales the
// skyline; downtown = how much taller the centre is; sprawl = how far the lit suburbs run, in core half-widths;
// windows = window brightness. city.at(t) moves traffic and blinks beacons.
// userData: { radius, pitch (block spacing), street (street width), floor (storey height), tallest (Vector3 roof) }.
// Anchors: center (ground at the middle), tallest (the top of the tallest tower), street (mid-block on the street
// nearest the middle).
export function city({ size = 24, blocks = 10, seed = 1, lit = 0.3, height = 1, downtown = 1, traffic = 500, lamps = true, beacons = true, sprawl = 2.5, windows = 1.5, glass = 0.6, windowColor = '#ffc27a', coolColor = '#dce8ff', lampColor = '#ffb466', wallColor = '#2b3039', groundColor = '#15171c' } = {}) {
  const g = new THREE.Group(); g.name = 'city'; const R = rng(seed);
  const P = size / blocks, SW = P * 0.2, SIDE = P * 0.035, half = size / 2, FH = P * 0.034, CW = P * 0.03;
  const inst = []; let tallest = null; const roofs = [];
  for (let bi = 0; bi < blocks; bi++) for (let bj = 0; bj < blocks; bj++) {
    const x0 = -half + bi * P + SW / 2 + SIDE, z0 = -half + bj * P + SW / 2 + SIDE, inner = P - SW - 2 * SIDE;
    const cx = x0 + inner / 2, cz = z0 + inner / 2, dc = Math.hypot(cx, cz) / half;
    const f = downtown * Math.exp(-((dc / 0.5) ** 2));
    if (R() < 0.05 && dc > 0.35) continue; // a plaza
    const nx = 1 + Math.floor(R() * (f > 0.5 ? 2 : 3)), nz = 1 + Math.floor(R() * (f > 0.5 ? 2 : 3));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const m = P * 0.014, w = inner / nx - m * 2, d = inner / nz - m * 2;
      const x = x0 + ((i + 0.5) * inner) / nx, z = z0 + ((j + 0.5) * inner) / nz;
      let h = P * (0.16 + 0.28 * R() + f * (0.5 + 2.8 * Math.pow(R(), 1.7))) * height;
      if (R() < 0.04 + 0.16 * f) h *= 1.5;
      h = Math.max(FH * 3, Math.round(h / FH) * FH);
      const style = f > 0.3 && R() < 0.7 ? 0 : R() < 0.55 ? 1 : 2; // 0 glass offices, 1 flats, 2 mixed
      const b = { seed: R(), lit: clamp(lit * (0.45 + R() * 1.1), 0, 1), style, glass: style === 0 ? glass : glass * 0.25 };
      if (h > P * 1.1 && R() < 0.75) {
        const h1 = Math.round((h * (0.45 + R() * 0.2)) / FH) * FH, s2 = 0.72 + R() * 0.12, h2 = Math.round((h * (0.8 + R() * 0.08)) / FH) * FH;
        inst.push({ ...b, x, z, w, d, y0: 0, h: h1 }, { ...b, x, z, w: w * s2, d: d * s2, y0: h1, h: h2 - h1 }, { ...b, x, z, w: w * s2 * 0.7, d: d * s2 * 0.7, y0: h2, h: h - h2 });
        roofs.push({ x, z, w: w * s2 * 0.7, d: d * s2 * 0.7, y: h, tall: true });
      } else { inst.push({ ...b, x, z, w, d, y0: 0, h }); roofs.push({ x, z, w, d, y: h, tall: h > P * 0.9 }); }
      if (!tallest || h > tallest.h) tallest = { x, z, h };
    }
  }
  // buildings
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
  const aB = new Float32Array(inst.length * 4); inst.forEach((b, i) => aB.set([b.seed, b.lit, b.style, b.glass], i * 4));
  geo.setAttribute('aB', new THREE.InstancedBufferAttribute(aB, 4));
  const bu = { uFloor: { value: FH }, uCol: { value: CW }, uWin: { value: windows }, uWarm: { value: C(windowColor) }, uCool: { value: C(coolColor) } };
  const bm = patch(new THREE.MeshStandardMaterial({ color: C(wallColor), roughness: 0.78, metalness: 0.08 }), {
    uniforms: bu, key: 'city-bldg-v1',
    vertexHead: 'attribute vec4 aB; varying vec4 vB; varying vec3 vLP; varying vec3 vLN;',
    vertex: { begin_vertex: `vB = aB; vLN = normal;\n#ifdef USE_INSTANCING\n vLP = (instanceMatrix * vec4(transformed, 1.)).xyz;\n#else\n vLP = transformed;\n#endif` },
    fragmentHead: `uniform float uFloor, uCol, uWin; uniform vec3 uWarm, uCool; varying vec4 vB; varying vec3 vLP; varying vec3 vLN;
      float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`,
    fragment: {
      color_fragment: `
        float isWall = 1. - step(.5, abs(vLN.y));
        float sideX = step(.5, abs(vLN.x));
        float fu = mix(vLP.x, vLP.z, sideX);
        float face = sideX > .5 ? (vLN.x > 0. ? 1. : 2.) : (vLN.z > 0. ? 3. : 4.);
        float sty = vB.z;
        float cw = uCol * (sty > 1.5 ? 1.15 : sty > .5 ? 1.35 : 1.);
        vec2 cell = vec2(fu / cw, vLP.y / uFloor);
        vec2 wid = floor(cell), wf = fract(cell), wfw = max(fwidth(cell), vec2(1e-4));
        vec2 wsz = sty < .5 ? vec2(.9, .72) : (sty < 1.5 ? vec2(.44, .5) : vec2(.56, .56));
        vec2 wc0 = vec2(.5, sty < .5 ? .58 : .52);
        vec2 lo = wc0 - wsz * .5, hi = wc0 + wsz * .5;
        vec2 m2 = smoothstep(lo - wfw, lo + wfw, wf) * (1. - smoothstep(hi - wfw, hi + wfw, wf));
        float wFar = smoothstep(.3, .8, max(wfw.x, wfw.y));
        float gnd = step(vLP.y, uFloor * 1.3) * isWall;
        float win = m2.x * m2.y * isWall * (1. - wFar) * (1. - gnd);
        vec2 sc = vec2(fu / (cw * 2.6), vLP.y / (uFloor * 1.3)), sid = floor(sc), sf = fract(sc), sfw = max(fwidth(sc), vec2(1e-4));
        vec2 sm2 = smoothstep(vec2(.06, .08) - sfw, vec2(.06, .08) + sfw, sf) * (1. - smoothstep(vec2(.94, .72) - sfw, vec2(.94, .72) + sfw, sf));
        float shopWin = sm2.x * sm2.y * gnd * (1. - smoothstep(.3, .8, max(sfw.x, sfw.y)));
        float glassK = max(win, shopWin);
        float tint = .65 + .7 * hh(vec2(vB.x * 13., 1.));
        diffuseColor.rgb *= tint * (1. - .45 * step(.5, vLN.y));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.01, .012, .016), glassK);`,
      roughnessmap_fragment: 'roughnessFactor = mix(roughnessFactor, .08, glassK * (.45 + .55 * vB.w));',
      metalnessmap_fragment: 'metalnessFactor = mix(metalnessFactor, .6, glassK * vB.w);',
      emissivemap_fragment: `
        float hs = hh(wid + vB.x * 173. + face * 31.);
        float floorOn = hh(vec2(wid.y, vB.x * 91. + face * 1.7));
        float litP = vB.y * (sty < .5 ? (floorOn < .45 ? 1.7 : .08) : 1.);
        float on = step(hs, litP);
        float bright = .2 + 1.3 * pow(hh(wid + 3.3 + vB.x), 2.2);
        float cool = sty < .5 ? step(.3, hh(vec2(wid.y, vB.x))) : step(.86, hh(wid * 1.3 + vB.x * 7.));
        vec3 wcol = mix(uWarm, uCool, cool) * bright;
        float vy = clamp((wf.y - lo.y) / wsz.y, 0., 1.), vx = clamp((wf.x - lo.x) / wsz.x, 0., 1.);
        float ceil = sty < .5 ? (.3 + 1.7 * smoothstep(.72, .96, vy)) : (.6 + .55 * vy);
        float curtain = sty < .5 ? 1. : mix(1., .2, step(hh(wid + 9.1 + vB.x), .45) * step(vx, .25 + .55 * hh(wid + 2.2)));
        vec3 em = wcol * on * win * ceil * curtain;
        vec3 avg = mix(uWarm, uCool, sty < .5 ? .55 : .15) * .5 * litP * wsz.x * wsz.y;
        em += avg * wFar * isWall * (1. - gnd);
        em += vec3(.012, .016, .024) * win * (1. - on);
        float shopOn = step(hh(sid + vB.x * 5. + face), .68);
        vec3 shopC = mix(uWarm, uCool, step(.78, hh(sid * 1.7 + vB.x))) * (.5 + 1.3 * hh(sid + 4.4)) * (.7 + .5 * (1. - sf.y / .72));
        em += shopC * shopOn * shopWin * 1.3;
        float sgn = smoothstep(.76, .775, sf.y) * (1. - smoothstep(.855, .87, sf.y)) * gnd * step(.72, hh(sid + 8.8 + vB.x)) * sm2.x;
        vec3 signC = .55 + .45 * cos(6.2831 * (hh(sid + 1.3) + vec3(0., .33, .67)));
        em += signC * sgn * 1.4;
        totalEmissiveRadiance += em * uWin;`,
    },
  });
  const bmesh = new THREE.InstancedMesh(geo, bm, inst.length); bmesh.castShadow = bmesh.receiveShadow = true;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  inst.forEach((b, i) => { m4.compose(v.set(b.x, b.y0, b.z), q, sc.set(b.w, b.h, b.d)); bmesh.setMatrixAt(i, m4); });
  bmesh.computeBoundingSphere(); g.add(bmesh);
  // rooftop plant: lift housings and chillers
  const plant = []; for (const r of roofs) { const n = r.tall ? 2 : Math.floor(R() * 3); for (let i = 0; i < n; i++) { const w = r.w * (0.15 + R() * 0.25), d = r.d * (0.15 + R() * 0.25), h = FH * (0.6 + R() * 1.4); plant.push([r.x + (R() - 0.5) * (r.w - w) * 0.8, r.y, r.z + (R() - 0.5) * (r.d - d) * 0.8, w, h, d]); } }
  if (plant.length) {
    const pm = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: C('#30353d'), roughness: 0.7, metalness: 0.2 }), plant.length); pm.castShadow = pm.receiveShadow = true;
    plant.forEach(([x, y, z, w, h, d], i) => { m4.compose(v.set(x, y, z), q, sc.set(w, h, d)); pm.setMatrixAt(i, m4); }); pm.computeBoundingSphere(); g.add(pm);
  }
  // ground: asphalt streets, sidewalks, lamp pools, centre lines; the grid keeps going as dimmer suburbs
  const ext = half * (1 + sprawl);
  const gu = { uP: { value: P }, uSW: { value: SW }, uSide: { value: SIDE }, uHalf: { value: half }, uExt: { value: ext }, uLamp: { value: lamps ? 1 : 0 }, uLampCol: { value: C(lampColor) } };
  const gm = patch(new THREE.MeshStandardMaterial({ color: C(groundColor), roughness: 0.82, metalness: 0 }), {
    uniforms: gu, key: 'city-ground-v1',
    vertexHead: 'varying vec3 vGP;', vertex: { begin_vertex: 'vGP = vec3(transformed.x, 0., -transformed.y);' },
    fragmentHead: `uniform float uP, uSW, uSide, uHalf, uExt, uLamp; uniform vec3 uLampCol; varying vec3 vGP;
      float gh(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }
      float lampDist(vec2 lq){
        float sp = uP * .25, off = uSW * .5 + uSide * .5;
        float zb = floor(lq.y / uP + .5) * uP, xl = (floor(lq.x / sp) + .5) * sp;
        float d1 = min(length(vec2(lq.x - xl, lq.y - zb + off)), length(vec2(lq.x - xl, lq.y - zb - off)));
        float xb = floor(lq.x / uP + .5) * uP, zl = (floor(lq.y / sp) + .5) * sp;
        float d2 = min(length(vec2(lq.x - xb + off, lq.y - zl)), length(vec2(lq.x - xb - off, lq.y - zl)));
        return min(d1, d2);
      }`,
    fragment: {
      color_fragment: `
        vec2 lq = vGP.xz + uHalf;
        vec2 bf = fract(lq / uP), dd = min(bf, 1. - bf) * uP;
        float dmin = min(dd.x, dd.y), aa = fwidth(dmin) + 1e-4;
        float street = 1. - smoothstep(uSW * .5 - aa, uSW * .5 + aa, dmin);
        float walk = (1. - smoothstep(uSW * .5 + uSide - aa, uSW * .5 + uSide + aa, dmin)) - street;
        float core = step(max(abs(vGP.x), abs(vGP.z)), uHalf);
        float farOut = clamp((max(abs(vGP.x), abs(vGP.z)) - uHalf) / max(uExt - uHalf, 1e-3), 0., 1.);
        float alive = core > .5 ? 1. : step(gh(floor(lq / uP)), .62 - .4 * farOut) * (1. - farOut);
        float n = vnoise(vec3(vGP.xz * 3. / uP, 1.)) * .5 + .5;
        vec3 base = mix(diffuseColor.rgb * (.7 + .3 * n), diffuseColor.rgb * 1.9, walk);
        base = mix(base, diffuseColor.rgb * .55, street);
        diffuseColor.rgb = base;
        float lineD = min(dd.x, dd.y);
        float alongX = step(dd.y, dd.x);
        float dash = step(.5, fract((alongX > .5 ? lq.x : lq.y) / (uP * .08)));
        float lwc = uP * .0016, lwe = max(lwc, aa * .75);
        float cl = (1. - smoothstep(lwe - aa * .5, lwe + aa * .5, lineD)) * (lwc / lwe) * dash * street * step(uSW * .3, max(dd.x, dd.y));`,
      roughnessmap_fragment: 'roughnessFactor = mix(roughnessFactor, .34, street);',
      emissivemap_fragment: `
        float ld = lampDist(lq);
        float pool = exp(-ld * ld / (uP * uP * .0022)) + .18 * exp(-ld * ld / (uP * uP * .012));
        totalEmissiveRadiance += uLampCol * pool * uLamp * alive * (.3 + .7 * (street + walk)) * (core > .5 ? .2 : .32);
        // suburbs: minor streets at half the block pitch and scattered house lights, fading out with distance
        float subK = (1. - core) * (1. - farOut);
        float ld2 = lampDist(lq * 2. + uP * .5) * .5;
        float pool2 = exp(-ld2 * ld2 / (uP * uP * .0012));
        vec2 hq = lq / (uP * .09), hid = floor(hq), hf = fract(hq) - .5;
        vec2 ho = (vec2(gh(hid + 1.3), gh(hid + 7.1)) - .5) * .6;
        float hon = step(gh(hid + 4.2), .3) * step(.25, gh(floor(lq / uP) + 9.7));
        float dotL = exp(-dot(hf - ho, hf - ho) / .004) * hon;
        float house = mix(dotL, .0035, smoothstep(.3, 1., length(fwidth(hq))));
        totalEmissiveRadiance += (uLampCol * pool2 * .1 * uLamp + vec3(1., .8, .52) * house * 2.4) * subK * (1. - street);
        totalEmissiveRadiance += vec3(.9, .85, .7) * cl * .25 * core;`,
    },
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(ext * 2, ext * 2, 1, 1), gm); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; g.add(ground);
  // lights: lamp heads (3D) and halos, beacons, traffic
  const lights = []; const lampPos = [];
  if (lamps) {
    const sp = P * 0.25, off = SW * 0.5 + SIDE * 0.5, lh = P * 0.09;
    for (let b = 0; b <= blocks; b++) {
      const c = -half + b * P;
      for (let k = 0; k < blocks * 4; k++) {
        const s = -half + (k + 0.5) * sp;
        for (const o of [-off, off]) { lampPos.push([s, lh, c + o]); lampPos.push([c + o, lh, s]); }
      }
    }
    const pole = new THREE.CylinderGeometry(P * 0.0025, P * 0.003, lh, 6); pole.translate(0, lh / 2, 0);
    const poles = new THREE.InstancedMesh(pole, new THREE.MeshStandardMaterial({ color: C('#3a3f47'), roughness: 0.5, metalness: 0.6 }), lampPos.length);
    lampPos.forEach(([x, , z], i) => { m4.compose(v.set(x, 0, z), q, sc.set(1, 1, 1)); poles.setMatrixAt(i, m4); }); poles.computeBoundingSphere(); g.add(poles);
    for (const [x, y, z] of lampPos) lights.push({ p: [x, y, z], color: lampColor, i: 2.4, size: P * 0.009 });
  }
  if (beacons) {
    const tops = roofs.filter((r) => r.tall).sort((a, b) => b.y - a.y).slice(0, Math.max(3, Math.round(roofs.length * 0.05)));
    for (const r of tops) lights.push({ p: [r.x, r.y + FH * 0.6, r.z], color: '#ff2a1e', i: 7, size: P * 0.012, anim: [0, R(), 1.4 + R() * 0.4, 0.22] });
  }
  for (let i = 0; i < traffic; i++) {
    const alongX = R() < 0.5, b = Math.floor(R() * (blocks + 1)), c = -half + b * P, dir = R() < 0.5 ? 1 : -1, lane = SW * (0.13 + R() * 0.12) * dir;
    const L = size + SW, start = -L / 2, speed = P * (0.25 + R() * 0.35), ph = R();
    const p = alongX ? [dir > 0 ? start : -start, P * 0.006, c + lane] : [c - lane, P * 0.006, dir > 0 ? start : -start];
    const mv = alongX ? [dir, 0, 0, L] : [0, 0, dir, L];
    lights.push({ p, move: mv, anim: [speed, ph, 0, 1], color: dir > 0 ? '#fff0d4' : '#ff3b22', i: dir > 0 ? 4 : 3, size: P * 0.008 });
  }
  const pts = lights.length ? lightPoints(lights) : null; if (pts) g.add(pts);
  g.at = (t) => { if (pts) pts.at(t); };
  g.buildings = bmesh; g.ground = ground;
  g.userData = { radius: half * 1.42, pitch: P, street: SW, floor: FH, tallest: tallest ? new THREE.Vector3(tallest.x, tallest.h, tallest.z) : new THREE.Vector3() };
  const pin = (name, v) => { const a = new THREE.Object3D(); a.name = name; a.position.copy(v); g.add(a); return a; };
  const sx = -half + Math.round(blocks / 2) * P;
  return withAnchors(g, { center: pin('center', new THREE.Vector3()), tallest: pin('tallest', g.userData.tallest), street: pin('street', new THREE.Vector3(sx, 0, sx + P / 2)) });
}

// =====================================================================================================================
// TERRAIN
// =====================================================================================================================

// Rolling ground from warped noise with optional ridges, coloured by height and slope, with fine bump. grid > 0 lays
// a glowing grid over it (gridSize apart, gridWidth wide, in world units); wire > 0 adds a glowing triangle mesh
// (wireSize apart); scan > 0 sends a bright ring out from the centre over the grid every few seconds.
// terrain.heightAt(x, z) gives the ground height for placing things (in its own space; heightAtWorld(x, z) in world
// units, wherever the terrain is moved); terrain.at(t) runs the scan.
// Thin glowing lines far from the focus plane break into ghost copies under strong lens blur (16 lens samples), so
// keep k.lens.blur at 0.004 or below when a grid or wire runs to the horizon.
export function terrain({ size = 40, height = 3, seed = 1, segments = 256, scale = 1, ridge = 0.35, warp = 0.6, flat = 0, color = '#1b2330', color2 = '#3b4655', grid = 0, gridSize = 1, gridColor = accentDefault(), gridWidth = 0.02, wire = 0, wireColor = null, wireSize = null, scan = 0, scanSpeed = 4 } = {}) {
  const k = scale / (size * 0.18);
  const heightAt = (x, z) => {
    let px = x * k, pz = z * k;
    const wx = fbm2(px * 0.6 + 11, pz * 0.6, { octaves: 3, seed }) * warp, wz = fbm2(px * 0.6, pz * 0.6 + 7, { octaves: 3, seed: seed + 1 }) * warp;
    px += wx; pz += wz;
    const base = fbm2(px, pz, { octaves: 6, seed }) * 0.5 + 0.5;
    const rid = 1 - Math.abs(fbm2(px * 1.3 + 3, pz * 1.3, { octaves: 5, seed: seed + 2 }));
    let h = base * (1 - ridge) + rid * rid * ridge;
    if (flat > 0) h *= smooth(clamp((Math.hypot(x, z) - flat) / flat));
    return h * height;
  };
  const geo = new THREE.PlaneGeometry(size, size, segments, segments); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  const n = geo.attributes.normal, cols = new Float32Array(p.count * 3), c1 = C(color), c2 = C(color2), tmp = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const hN = clamp(p.getY(i) / Math.max(height, 1e-3)), slope = 1 - n.getY(i);
    tmp.copy(c1).lerp(c2, smooth(hN)).multiplyScalar(1 - 0.35 * clamp(slope * 2.5) + 0.12 * noise2(p.getX(i) * 0.7, p.getZ(i) * 0.7, seed + 9));
    cols.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const tu = { uGrid: { value: grid }, uGridSize: { value: gridSize }, uGridW: { value: gridWidth }, uGridCol: { value: C(gridColor) }, uWire: { value: wire }, uWireSize: { value: wireSize || size / 64 }, uWireCol: { value: C(wireColor || gridColor) }, uScan: { value: scan }, uScanSpeed: { value: scanSpeed }, uTime: { value: 0 }, uSize: { value: size } };
  const m = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0, bumpMap: cached('terrBump', () => noiseTexture({ kind: 'fbm', scale: 8, repeat: 10, seed: 5, size: 512 })), bumpScale: 1.2 }), {
    uniforms: tu, key: 'terrain-v1',
    vertexHead: 'varying vec3 vTP;', vertex: { begin_vertex: 'vTP = transformed;' },
    fragmentHead: `uniform float uGrid, uGridSize, uGridW, uWire, uWireSize, uScan, uScanSpeed, uTime, uSize; uniform vec3 uGridCol, uWireCol; varying vec3 vTP;
      float gridLines(vec2 q, float w){ vec2 gw = fwidth(q); vec2 gf = abs(fract(q - .5) - .5); vec2 lw = vec2(w); vec2 lwe = max(lw, gw * .75);
        vec2 l = (1. - smoothstep(lwe - gw * .5, lwe + gw * .5, gf)) * (lw / lwe); return max(l.x, l.y); }
      float line1(float x, float w){ float gw = fwidth(x), gf = abs(fract(x - .5) - .5), lwe = max(w, gw * .75);
        return (1. - smoothstep(lwe - gw * .5, lwe + gw * .5, gf)) * (w / lwe); }`,
    fragment: {
      emissivemap_fragment: `
        float r = length(vTP.xz);
        float scanR = mod(uTime * uScanSpeed, uSize * .75);
        float scanK = 1. + uScan * 5. * exp(-pow((r - scanR) / (uGridSize * 1.2), 2.));
        if (uGrid > 0.) totalEmissiveRadiance += uGridCol * gridLines(vTP.xz / uGridSize, uGridW / uGridSize) * uGrid * scanK;
        if (uWire > 0.) { vec2 wq = vTP.xz / uWireSize; float wl = max(gridLines(wq, .012), line1(wq.x + wq.y, .012 * 1.4142));
          totalEmissiveRadiance += uWireCol * wl * uWire * scanK; }`,
    },
  });
  m.vertexColors = true;
  const mesh = new THREE.Mesh(geo, m); mesh.receiveShadow = true; mesh.castShadow = true;
  const g = new THREE.Group(); g.add(mesh);
  g.heightAt = heightAt; g.heightAtWorld = atWorld(g, heightAt); g.surface = mesh; g.name = 'terrain';
  g.at = (t) => { tu.uTime.value = t; };
  g.userData = { radius: size * 0.71 };
  return withAnchors(g, {});
}

// =====================================================================================================================
// OCEAN FLOOR
// =====================================================================================================================

// Sand ripples: crests that wander and fork, over fine grain. Tileable bump map.
function sandRippleMap(seed = 3, size = 1024) {
  return cached('sand' + seed, () => {
    const [c, g] = canvas(size, size), img = g.createImageData(size, size), d = img.data;
    const per = 8; // noise lattice period in cells (tileable)
    const pn = (x, y, s) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const h = (a, b) => hash2(((xi + a) % per + per) % per, ((yi + b) % per + per) % per, s);
      return (h(0, 0) + (h(1, 0) - h(0, 0)) * u + (h(0, 1) - h(0, 0)) * v + (h(0, 0) - h(1, 0) - h(0, 1) + h(1, 1)) * u * v) * 2 - 1; };
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = (x / size) * per, v = (y / size) * per;
      const w = pn(u, v, seed) * 1.6 + pn(u * 2, v * 2, seed + 1) * 0.5;
      const ph = (y / size) * 14 * TAU + w * 2.2;
      const sw = ph + 0.55 * Math.sin(ph); // steep lee side, long stoss side (asymmetric ripples)
      const r = Math.sin(sw), crest = Math.pow(1 - Math.abs(Math.cos(sw * 0.5)), 2);
      const grain = hash2(x, y, seed + 4) * 0.5 + pn(u * 8, v * 8, seed + 2) * 0.25;
      const val = 0.5 + 0.34 * r + 0.1 * crest + 0.08 * grain;
      const i = (y * size + x) * 4; d[i] = d[i + 1] = d[i + 2] = clamp(val) * 255; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(12, 12); t.anisotropy = 8; return t;
  });
}

const rotatedTex = (t, deg) => { if (!deg) return t; const c = t.clone(); c.center.set(0.5, 0.5); c.rotation = THREE.MathUtils.degToRad(deg); c.needsUpdate = true; return c; };

// The sea bed: dunes of rippled sand, half-buried rocks, marine snow drifting through the light, and optional
// sunlight caustics (0 for the deep ocean, ~1 for shallow water). oceanFloor.heightAt(x, z) gives the sand height in
// the floor's own space; oceanFloor.heightAtWorld(x, z) takes and returns world units, wherever the floor is moved,
// turned or scaled (lay a cable on it); oceanFloor.at(t) drifts the snow and moves the caustics. .snow is the fx.dust.
// rippleAngle turns the ripple crests (degrees): light that runs along the crests hides them, so aim the key across.
export function oceanFloor({ size = 60, seed = 3, dunes = 0.25, ripples = 1, rippleAngle = 35, rocks = 140, snow = 900, caustics = 0, color = '#222c46', rockColor = '#0c1222', snowColor = '#b9d4ff', causticColor = '#a8dcff', segments = 240 } = {}) {
  const g = new THREE.Group(); const R = rng(seed);
  const heightAt = (x, z) => dunes * (Math.sin(x * 0.35 + z * 0.12) * 0.7 + Math.sin(x * 1.3 - z * 0.7) * 0.2 + Math.sin(z * 2.1 + x * 0.3) * 0.08 + fbm2(x * 0.08, z * 0.08, { octaves: 4, seed }) * 1.4);
  const geo = new THREE.PlaneGeometry(size, size, segments, segments); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  const cu = { uC: { value: caustics }, uCC: { value: C(causticColor) }, uTime: { value: 0 } };
  const sand = patch(new THREE.MeshStandardMaterial({ color: C(color), roughness: 0.96, metalness: 0, bumpMap: rotatedTex(sandRippleMap(seed), rippleAngle), bumpScale: 3.6 * ripples }), {
    uniforms: cu, key: 'ocean-floor-v1',
    vertexHead: 'varying vec3 vSP;', vertex: { begin_vertex: 'vSP = transformed;' },
    fragmentHead: `uniform float uC, uTime; uniform vec3 uCC; varying vec3 vSP;
      // caustics from optics: the moving water surface (a sum of travelling waves) focuses light where it is concave;
      // the brightness on the floor is 1 / |det(I + depth * Hessian(h))|, which folds into bright curved lines.
      // A slightly different depth per channel gives the faint colour fringes real caustics have.
      vec3 causticRGB(vec2 p, float t){
        float hxx = 0., hyy = 0., hxy = 0.;
        for (int i = 0; i < 9; i++) {
          float fi = float(i), ang = fi * 2.39996 + .7, kl = mix(3.5, 9., fract(fi * .618034 + .13));
          vec2 kv = vec2(cos(ang), sin(ang)) * kl;
          float s = -(.11 / (kl * kl)) * sin(dot(kv, p) - t * sqrt(kl) * 1.1 + fi * 1.7);
          hxx += s * kv.x * kv.x; hyy += s * kv.y * kv.y; hxy += s * kv.x * kv.y;
        }
        vec3 o;
        for (int i = 0; i < 3; i++) { float kk = 6.5 * (.97 + .03 * float(i)); float det = (1. + kk * hxx) * (1. + kk * hyy) - kk * kk * hxy * hxy; o[i] = 1. / max(abs(det), .045); }
        return clamp(o - .9, 0., 12.) * .5;
      }`,
    fragment: {
      color_fragment: 'diffuseColor.rgb *= (.78 + .44 * (fbm(vec3(vSP.xz * .3, 2.), 4) * .5 + .5)) * (.9 + .2 * (vnoise(vec3(vSP.xz * 6., 4.)) * .5 + .5));',
      emissivemap_fragment: `if (uC > 0.) { vec2 cp = vSP.xz * 1.1;
        float fw = length(fwidth(cp)); vec3 cs = causticRGB(cp, uTime * .5); cs = mix(cs, vec3(.6), smoothstep(.1, .4, fw));
        totalEmissiveRadiance += uCC * cs * uC * diffuseColor.rgb * .9; }`,
    },
  });
  const floor = new THREE.Mesh(geo, sand); floor.receiveShadow = true; g.add(floor);
  if (rocks > 0) {
    const variants = 4, geos = Array.from({ length: variants }, (_, i) => rockGeometry({ seed: seed * 7 + i, detail: 8, roughness: 0.25 }));
    const rm = new THREE.MeshStandardMaterial({ color: C('#ffffff'), roughness: 0.9, bumpMap: cached('rockGrain', () => noiseTexture({ kind: 'grain', scale: 8, seed: 9, repeat: 3, size: 512 })), bumpScale: 2 });
    const meshes = geos.map((gg) => { const m = new THREE.InstancedMesh(gg, rm, Math.ceil(rocks / variants) + 1); m.count = 0; m.castShadow = m.receiveShadow = true; g.add(m); return m; });
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), base = C(rockColor), tint = new THREE.Color();
    for (let i = 0; i < rocks; i++) {
      const x = (R() - 0.5) * size * 0.8, z = (R() - 0.5) * size * 0.8, s = 0.05 + Math.pow(R(), 3) * 0.6;
      const mesh = meshes[i % variants], slot = mesh.count++;
      e.set(R() * TAU, R() * TAU, R() * TAU); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(x, heightAt(x, z) - s * 0.35, z), q, new THREE.Vector3(s * (1 + R() * 0.6), s * (0.5 + R() * 0.4), s * (1 + R() * 0.6)));
      mesh.setMatrixAt(slot, m4); mesh.setColorAt(slot, tint.copy(base).multiplyScalar(0.7 + R() * 0.6));
    }
    for (const m of meshes) m.computeBoundingSphere();
  }
  let snowPts = null;
  if (snow > 0) { snowPts = dust({ count: snow, center: [0, 2.2, 0], size: [size * 0.4, 4.5, size * 0.4], pointSize: 0.012, intensity: 1.0, color: snowColor, drift: [0.01, -0.035, 0.015], seed: seed + 3 }); g.add(snowPts); }
  g.heightAt = heightAt; g.heightAtWorld = atWorld(g, heightAt); g.surface = floor; g.snow = snowPts;
  g.at = (t) => { cu.uTime.value = t; if (snowPts) snowPts.at(t); };
  g.name = 'oceanFloor'; g.userData = { radius: size * 0.71 };
  return withAnchors(g, {});
}

// =====================================================================================================================
// WOOD (desk tops and floors)
// =====================================================================================================================

const WOODS = {
  walnut: ['#7a5235', '#3a2415', 0.5], oak: ['#c79c6a', '#8c6440', 0.55], ash: ['#dcc6a2', '#ab8f69', 0.55], maple: ['#e4caa0', '#c4a47a', 0.5], teak: ['#a2703f', '#5e3c1e', 0.5],
};
// Flat-sawn boards glued side by side, grain along x: growth rings cut at a slant so they sweep into cathedral
// arches, fibres, pores, a little colour drift per board. p in world units; grain = rings per unit (roughly).
const GLSL_WOOD = /* glsl */ `
float wh11(float x){ return fract(sin(x * 78.233) * 43758.5453); }
vec3 woodAt(vec2 p, vec3 light, vec3 dark, float seed, float grain, out float hgt){
  float bw = 1.6 / grain;                      // board width
  float bid = floor(p.y / bw), bs = seed + bid * 13.7;
  vec2 q = vec2(p.x + wh11(bs) * 7., p.y - bid * bw);
  float cy = bw * (.2 + .6 * wh11(bs + 1.)), depth = bw * (.25 + .5 * wh11(bs + 2.));
  float dd = depth + bw * .35 * sin(q.x * grain * .09 + wh11(bs + 3.) * 6.) + bw * .5 * fbm(vec3(q.x * grain * .04, bs, 1.), 3);
  float rr = length(vec2((q.y - cy) * (1. + .15 * fbm(vec3(q * grain * .1, bs), 2)), dd));
  float rings = rr * grain * 4.5 + fbm(vec3(q * vec2(.5, 3.) * grain * .1, bs + 3.), 3) * .5;
  float r = fract(rings);
  float late = smoothstep(.0, .1, r) * (1. - smoothstep(.35, .9, r));
  float fib = vnoise(vec3(q * vec2(3., 140.) * grain * .1, bs + 2.)) * .5 + .5;
  float pore = smoothstep(.74, .96, vnoise(vec3(q * vec2(18., 300.) * grain * .1, bs + 5.)) * .5 + .5);
  vec3 c = mix(light, dark, clamp(late * .62 + fib * .2 - .04, 0., 1.));
  c *= (1. - pore * .2) * (.88 + .24 * wh11(bs + 4.)) * (.94 + .12 * (fbm(vec3(q * .6, bs + 9.), 3) * .5 + .5));
  float seam = 1. - smoothstep(0., .0015, min(q.y, bw - q.y));
  c *= 1. - seam * .35;
  hgt = late * .5 + fib * .35 - pore * .8 - seam;
  return c;
}`;

// A desk or table top with a soft satin finish. The top surface sits at y = 0 (put things on it at y = 0); it is
// `width` (x) by `depth` (z). wood: 'walnut' | 'oak' | 'ash' | 'maple' | 'teak' (procedural grain, crisp at any
// distance) or 'white' | 'black' | any colour (plain laminate). legs: true adds slim black steel legs of `legHeight`.
// tone: a brightness multiplier on the wood or laminate colour (0.25 is a dark walnut nightstand); rough: the base
// roughness; sheen: the clear coat. The walnut defaults (tone .5, rough .78, sheen .15) are a dark oiled walnut: a
// low cool rim behind the desk then lights its grain instead of glaring mid-blue off a lacquer coat (the other woods
// keep tone 1, their own roughness and sheen .35).
export function desk({ width = 3.2, depth = 1.6, thickness = 0.07, wood = 'walnut', legs = false, legHeight = 1.4, radius = 0.012, grain = 10, seed = 1, sheen = null, tone = null, rough = null } = {}) {
  const g = new THREE.Group();
  const top = new RoundedBoxGeometry(width, thickness, depth, 3, Math.min(radius, thickness * 0.45)); top.translate(0, -thickness / 2, 0);
  const W = WOODS[wood], walnut = wood === 'walnut';
  sheen = sheen ?? (walnut ? 0.15 : 0.35); tone = tone ?? (walnut ? 0.5 : 1);
  let m;
  if (W) {
    m = patch(new THREE.MeshPhysicalMaterial({ color: C('#ffffff').multiplyScalar(tone), roughness: rough ?? (walnut ? 0.78 : W[2]), metalness: 0, clearcoat: sheen, clearcoatRoughness: walnut ? 0.38 : 0.28 }), {
      uniforms: { uL: { value: C(W[0]) }, uD: { value: C(W[1]) }, uSeed: { value: seed * 3.7 }, uGrain: { value: grain } }, key: 'wood-desk-v1',
      vertexHead: 'varying vec3 vWdP;', vertex: { begin_vertex: 'vWdP = transformed;' },
      fragmentHead: `uniform vec3 uL, uD; uniform float uSeed, uGrain; varying vec3 vWdP;\n${GLSL_WOOD}\n${GLSL_BUMP}`,
      fragment: {
        color_fragment: 'float wh; vec3 wc = woodAt(vWdP.xz, uL, uD, uSeed, uGrain, wh); diffuseColor.rgb *= wc;',
        roughnessmap_fragment: 'roughnessFactor = clamp(roughnessFactor + wh * .08, .05, 1.);',
        normal_fragment_maps: 'normal = bumpNormal(normal, wh, .0012);',
      },
    });
  } else {
    const col = wood === 'white' ? '#e7e5e0' : wood === 'black' ? '#141518' : wood;
    m = new THREE.MeshPhysicalMaterial({ color: C(col).multiplyScalar(tone), roughness: rough ?? 0.42, clearcoat: sheen * 0.6, clearcoatRoughness: 0.35, bumpMap: cached('laminate', () => noiseTexture({ kind: 'grain', scale: 8, seed: 2, repeat: 6, size: 512 })), bumpScale: 0.15 });
  }
  const slab = new THREE.Mesh(top, m); slab.castShadow = slab.receiveShadow = true; g.add(slab);
  if (legs) {
    const lm = new THREE.MeshPhysicalMaterial({ color: C('#16171a'), roughness: 0.38, metalness: 0.7, clearcoat: 0.3 });
    const lg = new RoundedBoxGeometry(0.05, legHeight, 0.05, 2, 0.008); lg.translate(0, -thickness - legHeight / 2, 0);
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { const l = new THREE.Mesh(lg, lm); l.position.set(sx * (width / 2 - 0.1), 0, sz * (depth / 2 - 0.1)); l.castShadow = l.receiveShadow = true; g.add(l); }
    const apron = new RoundedBoxGeometry(width - 0.24, 0.05, 0.03, 2, 0.008); apron.translate(0, -thickness - 0.04, 0);
    for (const sz of [1, -1]) { const a = new THREE.Mesh(apron, lm); a.position.z = sz * (depth / 2 - 0.1); a.castShadow = true; g.add(a); }
  }
  g.surface = slab; g.name = 'desk';
  g.userData = { radius: Math.hypot(width, depth) / 2, top: 0, size: [width, depth] };
  const topA = new THREE.Object3D(); topA.name = 'top'; g.add(topA);
  return withAnchors(g, { top: topA });
}

// =====================================================================================================================
// ROOM
// =====================================================================================================================

// An interior: floor (oak planks, or concrete), back and side walls, ceiling, skirting, and a window with mullions.
// Sunlight comes through the window as a real shadow-casting light (room.sun; call k.softLight(room.sun, 0.15) for
// soft edges) plus a raymarched light shaft with the mullions' shadows in it, and dust motes that only show inside
// the beam. The open side faces +Z (put the camera there). Floor at y = 0.
// win: { wall: 'left' | 'right' | 'back', width, height, sill, offset (along the wall), panes: [cols, rows] }.
// sunAngle: [elevation, azimuth] in degrees relative to the window (azimuth turns the light along the wall), or
// sun: [x, y, z] direction the light travels. shaft: brightness of the beam (0 = off). motes: count.
// room.at(t) drifts the haze and motes. room.window gives { center, normal, width, height } in room space.
// bounce: strength of the soft fill inside (a hemisphere light, room.bounce); keep the shot's own rig dim.
export function room({ width = 7, depth = 6, height = 3.2, win = {}, floor = 'oak', wallColor = '#cdc6ba', sun = null, sunAngle = [34, -28], sunColor = '#ffd2a0', sunIntensity = 7, sky = 2.6, shaft = 1, motes = 500, bounce = 0.35, ceiling = true, seed = 4 } = {}) {
  const g = new THREE.Group(); const R = rng(seed);
  const W = { wall: 'left', width: 2.2, height: 2.0, sill: 0.8, offset: -0.6, panes: [3, 2], mullion: 0.05, ...win };
  const T = 0.18, hw = width / 2, hd = depth / 2;
  const wallMat = patch(new THREE.MeshStandardMaterial({ color: C(wallColor), roughness: 0.92, metalness: 0 }), {
    key: 'room-wall-v1', vertexHead: 'varying vec3 vRW;', vertex: { worldpos_vertex: 'vRW = (modelMatrix * vec4(transformed, 1.)).xyz;' },
    fragmentHead: `varying vec3 vRW;\n${GLSL_BUMP}`,
    fragment: { color_fragment: 'float pl = fbm(vRW * 3.1, 4); diffuseColor.rgb *= .95 + .07 * pl;', normal_fragment_maps: 'normal = bumpNormal(normal, fbm(vRW * 22., 3), .0009);' },
  });
  const trimMat = new THREE.MeshStandardMaterial({ color: C('#e9e4da'), roughness: 0.6 });
  const box = (w, h, d, x, y, z, m = wallMat) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  // floor
  let floorMat;
  if (WOODS[floor]) {
    const F = WOODS[floor];
    floorMat = patch(new THREE.MeshPhysicalMaterial({ color: C('#ffffff'), roughness: F[2] + 0.05, clearcoat: 0.25, clearcoatRoughness: 0.35 }), {
      uniforms: { uL: { value: C(F[0]) }, uD: { value: C(F[1]) }, uSeed: { value: seed * 1.3 } }, key: 'room-floor-v1',
      vertexHead: 'varying vec3 vFP;', vertex: { begin_vertex: 'vFP = vec3(transformed.x, 0., -transformed.y);' },
      fragmentHead: `uniform vec3 uL, uD; uniform float uSeed; varying vec3 vFP;\n${GLSL_WOOD}\n${GLSL_BUMP}
        float h11(float x){ return fract(sin(x * 91.7) * 43758.5453); }`,
      fragment: {
        color_fragment: `
          float PW = .2, row = floor(vFP.z / PW), PL = 1.4 + 1.2 * h11(row * 1.7), off = h11(row + 3.1) * PL;
          float col = floor((vFP.x + off) / PL);
          vec2 lp = vec2(vFP.x + off - col * PL, vFP.z - row * PW);
          float seam = min(min(lp.x, PL - lp.x), min(lp.y, PW - lp.y));
          float sfw = fwidth(seam) + 1e-4;
          float groove = 1. - smoothstep(.0015, .0015 + sfw * 1.5, seam);
          float pid = h11(row * 7.3 + col * 3.9);
          float wh; vec3 wc = woodAt(lp + vec2(pid * 13.1, 0.), uL * (.86 + .28 * pid), uD * (.9 + .2 * pid), uSeed + pid * 40., 7., wh);
          wh -= groove * 2.; diffuseColor.rgb *= wc * (1. - groove * .55);`,
        roughnessmap_fragment: 'roughnessFactor = clamp(roughnessFactor + wh * .06, .05, 1.);',
        normal_fragment_maps: 'normal = bumpNormal(normal, wh, .0012);',
      },
    });
  } else floorMat = new THREE.MeshStandardMaterial({ color: C(floor === 'concrete' ? '#8d8a85' : floor), roughness: 0.85, bumpMap: cached('concrete', () => noiseTexture({ kind: 'fbm', scale: 10, seed: 6, repeat: 4, size: 512 })), bumpScale: 0.6 });
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), floorMat); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; g.add(fl);
  // walls; the window wall is built around its opening
  const sill = W.sill, wh = W.height, ww = W.width, top = sill + wh;
  const wallSpec = { back: { len: width, pos: (u, y, d) => [u, y, -hd - T / 2 + d], axis: 'x' }, left: { len: depth + T, pos: (u, y, d) => [-hw - T / 2 + d, y, u - T / 2], axis: 'z' }, right: { len: depth + T, pos: (u, y, d) => [hw + T / 2 - d, y, u - T / 2], axis: 'z' } };
  const wallBox = (name, u0, u1, y0, y1) => { const S = wallSpec[name], L = u1 - u0, H = y1 - y0; if (L <= 1e-3 || H <= 1e-3) return; const [x, y, z] = S.pos((u0 + u1) / 2, (y0 + y1) / 2, 0); return S.axis === 'x' ? box(L, H, T, x, y, z) : box(T, H, L, x, y, z); };
  for (const name of ['back', 'left', 'right']) {
    const S = wallSpec[name], a = -S.len / 2, b = S.len / 2;
    if (name !== W.wall) { wallBox(name, a, b, 0, height); continue; }
    const c0 = W.offset - ww / 2, c1 = W.offset + ww / 2;
    wallBox(name, a, c0, 0, height); wallBox(name, c1, b, 0, height); wallBox(name, c0, c1, 0, sill); wallBox(name, c0, c1, top, height);
  }
  if (ceiling) box(width + T * 2, T, depth + T, 0, height + T / 2, -T / 2);
  // skirting
  for (const name of ['back', 'left', 'right']) { const S = wallSpec[name]; const [x, , z] = S.pos(T / 2, 0, T / 2 + 0.008); if (S.axis === 'x') box(width, 0.09, 0.016, x, 0.045, z, trimMat); else box(0.016, 0.09, depth, x, 0.045, 0, trimMat); }
  // window frame and mullions (they cast the shadow pattern)
  const S = wallSpec[W.wall]; const up0 = new THREE.Vector3(0, 1, 0);
  const along = S.axis === 'x' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
  const inward = W.wall === 'back' ? new THREE.Vector3(0, 0, 1) : W.wall === 'left' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(-1, 0, 0);
  const wc = new THREE.Vector3(...S.pos(W.offset, sill + wh / 2, T / 2));
  const frameMat = new THREE.MeshStandardMaterial({ color: C('#efebe4'), roughness: 0.5 });
  const fw = W.mullion * 1.4, md = 0.07;
  const piece = (u, y, lw, lh) => { const p = wc.clone().addScaledVector(along, u).setY(y); const o = S.axis === 'x' ? box(lw, lh, md, p.x, p.y, p.z, frameMat) : box(md, lh, lw, p.x, p.y, p.z, frameMat); return o; };
  piece(0, sill + fw / 2, ww, fw); piece(0, top - fw / 2, ww, fw); piece(-ww / 2 + fw / 2, sill + wh / 2, fw, wh); piece(ww / 2 - fw / 2, sill + wh / 2, fw, wh);
  for (let i = 1; i < W.panes[0]; i++) piece(-ww / 2 + (i * ww) / W.panes[0], sill + wh / 2, W.mullion, wh);
  for (let j = 1; j < W.panes[1]; j++) piece(0, sill + (j * wh) / W.panes[1], ww, W.mullion);
  // the bright world outside
  const skyMat = new THREE.MeshBasicMaterial({ color: C('#fff1de').multiplyScalar(sky), toneMapped: false, fog: false });
  const skyPlane = new THREE.Mesh(new THREE.PlaneGeometry(ww * 3, wh * 3), skyMat); skyPlane.position.copy(wc).addScaledVector(inward, -1.2); skyPlane.lookAt(wc); g.add(skyPlane);
  // the sun
  let D;
  if (sun) { D = new THREE.Vector3(...sun).normalize(); const dn = D.dot(inward); if (dn < 0.05) D.addScaledVector(inward, 0.05 - 2 * dn).normalize(); }
  else { const el = THREE.MathUtils.degToRad(sunAngle[0]), az = THREE.MathUtils.degToRad(sunAngle[1]); D = inward.clone().applyAxisAngle(up0, az).multiplyScalar(Math.cos(el)).setY(-Math.sin(el)).normalize(); }
  const light = new THREE.DirectionalLight(C(sunColor), sunIntensity);
  const target = new THREE.Object3D(); target.position.copy(wc).addScaledVector(D, 4); g.add(target);
  light.target = target; light.position.copy(target.position).addScaledVector(D, -14);
  light.castShadow = true; light.shadow.mapSize.set(2048, 2048);
  const ss = Math.max(width, depth, height) * 0.8; Object.assign(light.shadow.camera, { left: -ss, right: ss, top: ss, bottom: -ss, near: 1, far: 40 });
  light.shadow.bias = -0.0003; light.shadow.normalBias = 0.02; g.add(light);
  if (bounce > 0) { const hemi = new THREE.HemisphereLight(C('#fff1e0'), C('#7a6a58'), bounce); g.add(hemi); g.bounce = hemi; }
  // the light shaft: raymarched in the room volume, lit where a point sees the window opening between the mullions
  const up = new THREE.Vector3(0, 1, 0);
  const su = {
    uWc: { value: wc.clone() }, uA1: { value: along.clone() }, uA2: { value: up.clone() }, uN: { value: inward.clone() }, uD: { value: D.clone() },
    uHalf: { value: new THREE.Vector2(ww / 2 - fw, wh / 2 - fw) }, uFull: { value: new THREE.Vector2(ww / 2, wh / 2) }, uPanes: { value: new THREE.Vector2(...W.panes) }, uMull: { value: W.mullion }, uOff: { value: new THREE.Vector3(0, height / 2, 0.01) },
    uI: { value: shaft }, uCol: { value: C(sunColor) }, uTime: { value: 0 }, uCam: { value: new THREE.Vector3() },
    uMin: { value: new THREE.Vector3(-hw + 0.02, 0.02, -hd + 0.02) }, uMax: { value: new THREE.Vector3(hw - 0.02, height - 0.02, hd) },
  };
  const LIT = /* glsl */ `
    uniform vec3 uWc, uA1, uA2, uN, uD; uniform vec2 uHalf, uFull, uPanes; uniform float uMull;
    float litAt(vec3 X){
      float tt = dot(X - uWc, uN) / dot(uD, uN); if (tt < 0.) return 0.;
      vec3 Xp = X - uD * tt; vec2 st = vec2(dot(Xp - uWc, uA1), dot(Xp - uWc, uA2));
      vec2 a = abs(st) - uHalf; if (max(a.x, a.y) > 0.) return 0.;
      vec2 cs = 2. * uFull / uPanes, gq = (st + uFull) / cs, kq = floor(gq + .5), dl = abs(gq - kq) * cs;
      float mx = (kq.x > 0. && kq.x < uPanes.x && dl.x < uMull * .5) ? 0. : 1.;
      float my = (kq.y > 0. && kq.y < uPanes.y && dl.y < uMull * .5) ? 0. : 1.;
      return mx * my * smoothstep(0., .04, -max(a.x, a.y));
    }`;
  let shaftMesh = null;
  if (shaft > 0) {
    const sm = new THREE.ShaderMaterial({
      uniforms: su, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
      vertexShader: `uniform vec3 uOff; varying vec3 vLP; void main(){ vLP = position + uOff; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: `${glslNoise}\n${LIT}\nuniform vec3 uMin, uMax, uCam, uCol; uniform float uI, uTime; varying vec3 vLP;
        void main(){
          vec3 ro = uCam, rd = normalize(vLP - ro);
          vec3 inv = 1. / rd, ta = (uMin - ro) * inv, tb = (uMax - ro) * inv, tmn = min(ta, tb), tmx = max(ta, tb);
          float t0 = max(max(tmn.x, tmn.y), max(tmn.z, 0.)), t1 = min(min(tmx.x, tmx.y), tmx.z);
          t1 = min(t1, length(vLP - ro)); if (t1 <= t0) discard;
          float dt = (t1 - t0) / 40.; float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715))));
          float acc = 0.;
          for (int i = 0; i < 40; i++) { vec3 X = ro + rd * (t0 + (float(i) + j) * dt); float l = litAt(X); if (l > 0.) acc += l * (.55 + .45 * (fbm(X * 1.3 + vec3(0., uTime * .04, uTime * .02), 3) * .5 + .5)); }
          gl_FragColor = vec4(uCol * acc * dt * uI * .3, 1.); }`,
    });
    shaftMesh = new THREE.Mesh(new THREE.BoxGeometry(width - 0.04, height - 0.04, depth - 0.02), sm);
    shaftMesh.position.copy(su.uOff.value); shaftMesh.renderOrder = 5; shaftMesh.frustumCulled = false;
    const tmp = new THREE.Vector3();
    shaftMesh.onBeforeRender = (r, sc, cam) => { su.uCam.value.copy(cam.getWorldPosition(tmp)); g.updateMatrixWorld(); g.worldToLocal(su.uCam.value); };
    g.add(shaftMesh);
  }
  // dust motes that glow only inside the beam
  let motePts = null;
  if (motes > 0) {
    const n = motes, pos = new Float32Array(n * 3), sz = new Float32Array(n), sd = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const tt = 0.4 + R() * 5; const p0 = wc.clone().addScaledVector(along, (R() - 0.5) * ww).addScaledVector(up, (R() - 0.5) * wh).addScaledVector(D, tt);
      pos.set([clamp(p0.x, -hw, hw), clamp(p0.y, 0.05, height - 0.05), clamp(p0.z, -hd, hd)], i * 3); sz[i] = 0.004 + R() * R() * 0.01; sd[i] = R();
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1)); geo.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
    const mm = new THREE.ShaderMaterial({
      uniforms: { ...su, uRes: { value: 1 }, uFocus: { value: 5 }, uAperture: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `${LIT}\nattribute float aSize; attribute float aSeed; uniform float uTime, uRes, uFocus, uAperture; uniform vec3 uCol; varying vec3 vC; varying float vK;
        void main(){ vec3 p = position + vec3(sin(uTime * .21 + aSeed * 40.), sin(uTime * .17 + aSeed * 17.) * .6 - uTime * .004, cos(uTime * .19 + aSeed * 9.)) * .08;
          vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv; float d = max(1e-3, -mv.z);
          float coc = uAperture * abs(d - uFocus) / max(uFocus, 1e-3); float r = max(aSize, coc * 2.);
          float px = r * projectionMatrix[1][1] * 960. * uRes / d; float shown = max(px, 1.5); gl_PointSize = min(shown, 160.);
          vK = (aSize * aSize) / (r * r) * min(1., px * px / (shown * shown)); vC = uCol * litAt(p) * (.6 + aSeed) * 6.; }`,
      fragmentShader: `varying vec3 vC; varying float vK; void main(){ float r2 = dot(gl_PointCoord - .5, gl_PointCoord - .5) * 4.; float a = exp(-r2 * 4.) * (1. - smoothstep(.8, 1., r2)); if (a < .003) discard; gl_FragColor = vec4(vC * vK * a, 1.); }`,
    });
    motePts = new THREE.Points(geo, mm); motePts.frustumCulled = false; g.add(motePts);
  }
  g.sun = light; g.floor = fl;
  g.window = { center: wc.clone(), normal: inward.clone(), width: ww, height: wh };
  g.at = (t) => { su.uTime.value = t; };
  g.name = 'room';
  g.userData = { radius: Math.hypot(width, depth, height) / 2, size: [width, height, depth] };
  const winA = new THREE.Object3D(); winA.name = 'window'; winA.position.copy(wc); g.add(winA);
  const floorA = new THREE.Object3D(); floorA.name = 'floor'; g.add(floorA);
  return withAnchors(g, { window: winA, floor: floorA });
}

// =====================================================================================================================
// ROAD
// =====================================================================================================================

// A road along a path (array of [x, y, z] points; default: straight down -Z for `length`). Asphalt with aggregate
// and wet patches (wet 0..1 makes it reflect), lane markings (dashed lane lines, solid edges, a double yellow centre
// when `center: 'double'`), street lamps every `lamps` world units (0 = none) whose light pools and glossy
// reflections are computed in the road shader, and optional traffic (headlights one way, tail lights the other).
// road.pointAt(u, lateral) -> world point at fraction u along the road, `lateral` world units to the right;
// road.frameAt(u) -> { pos, tangent, right }; road.at(t) moves the traffic; road.curve is the centreline. All in
// the road's own space. The road shader lights itself from the first 48 lamps; more lamps still get posts and halos.
export function road({ length = 60, path = null, lanes = 2, laneWidth = 0.9, shoulder = 0.3, center = 'dashed', wet = 0.35, lamps = 0, lampSide = 'both', lampHeight = 1.7, lampColor = '#ffaf5a', lampIntensity = 1, traffic = 0, speed = 3, seed = 2, color = '#1d1f23' } = {}) {
  const g = new THREE.Group(); const R = rng(seed);
  const curve = path ? new THREE.CatmullRomCurve3(path.map(V3), false, 'centripetal') : new THREE.LineCurve3(new THREE.Vector3(0, 0, length / 2), new THREE.Vector3(0, 0, -length / 2));
  const L = curve.getLength(), N = Math.max(2, Math.ceil(L * 3)), Wd = lanes * laneWidth, HW = Wd / 2 + shoulder;
  const upV = new THREE.Vector3(0, 1, 0);
  const frameAt = (u) => { const pos = curve.getPointAt(clamp(u)), tangent = curve.getTangentAt(clamp(u)).normalize(), right = new THREE.Vector3().crossVectors(tangent, upV).normalize(); return { pos, tangent, right }; };
  const across = [-HW, -Wd / 2, -Wd / 4, 0, Wd / 4, Wd / 2, HW];
  const pos = [], rd = [], idx = [];
  for (let i = 0; i <= N; i++) { const f = frameAt(i / N); for (const a of across) { const p = f.pos.clone().addScaledVector(f.right, a); pos.push(p.x, p.y + 0.002, p.z); rd.push(a, (i / N) * L); } }
  const cn = across.length;
  for (let i = 0; i < N; i++) for (let j = 0; j < cn - 1; j++) { const a = i * cn + j, b = a + cn; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('aRoad', new THREE.Float32BufferAttribute(rd, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  // lamp positions (heads), alternating sides when both
  const heads = [];
  if (lamps > 0) {
    const n = Math.floor(L / lamps);
    for (let i = 0; i <= n; i++) {
      const u = (i * lamps + lamps * 0.5) / L; if (u > 1) break;
      const sides = lampSide === 'both' ? [i % 2 ? 1 : -1] : [lampSide === 'left' ? -1 : 1];
      for (const sd of sides) { const f = frameAt(u); const base = f.pos.clone().addScaledVector(f.right, sd * (HW + 0.15)); heads.push({ base, head: base.clone().addScaledVector(f.right, -sd * 0.55).setY(base.y + lampHeight), side: sd, f }); }
    }
  }
  const MAXL = 48, lampArr = Array.from({ length: MAXL }, (_, i) => (heads[i] ? heads[i].head.clone() : new THREE.Vector3(0, -1000, 0)));
  // markings
  let paint = `float m = 0., my = 0.; float x = vRoad.x, y = vRoad.y; float aa = fwidth(x) * .8 + 1e-4;
    #define LN(c, w) (1. - smoothstep((w) * .5 - aa, (w) * .5 + aa, abs(x - (c))))
    m += LN(${(-Wd / 2 + 0.09).toFixed(3)}, .07) + LN(${(Wd / 2 - 0.09).toFixed(3)}, .07);\n`;
  for (let k = 1; k < lanes; k++) {
    const c = -Wd / 2 + k * laneWidth;
    if (center === 'double' && k === lanes / 2) paint += `my += LN(${(c - 0.06).toFixed(3)}, .05) + LN(${(c + 0.06).toFixed(3)}, .05);\n`;
    else if (center === 'solid' && k === lanes / 2) paint += `m += LN(${c.toFixed(3)}, .07);\n`;
    else paint += `m += LN(${c.toFixed(3)}, .07) * step(fract(y / 4.5), .42);\n`;
  }
  const ru = { uWet: { value: wet }, uLamps: { value: lampArr }, uNL: { value: Math.min(heads.length, MAXL) }, uLampCol: { value: C(lampColor) }, uLampI: { value: lampIntensity } };
  const rm = patch(new THREE.MeshStandardMaterial({ color: C(color), roughness: 0.82, metalness: 0 }), {
    uniforms: ru, key: `road-v1-${lanes}-${center}-${laneWidth}-${shoulder}`,
    vertexHead: 'attribute vec2 aRoad; varying vec2 vRoad; varying vec3 vRP;', vertex: { begin_vertex: 'vRoad = aRoad; vRP = (modelMatrix * vec4(transformed, 1.)).xyz;' },
    fragmentHead: `uniform float uWet, uNL, uLampI; uniform vec3 uLamps[${MAXL}]; uniform vec3 uLampCol; varying vec2 vRoad; varying vec3 vRP;`,
    fragment: {
      color_fragment: `${paint}
        float agg = vnoise(vec3(vRoad * 9., 3.)) * .5 + .5, patchy = fbm(vec3(vRoad * .35, 7.), 4) * .5 + .5;
        float puddle = smoothstep(.55, .7, fbm(vec3(vRoad * .22, 11.), 5) * .5 + .5);
        float wetK = clamp(uWet * (.55 + .45 * puddle * 1.6), 0., 1.);
        float shoulderK = smoothstep(${(Wd / 2).toFixed(3)}, ${(Wd / 2 + 0.05).toFixed(3)}, abs(vRoad.x));
        diffuseColor.rgb *= (.75 + .35 * agg) * (.85 + .3 * patchy) * mix(1., .55, wetK) * mix(1., 1.25, shoulderK);
        float wear = .75 + .25 * (vnoise(vec3(vRoad * vec2(3., .4), 5.)) * .5 + .5);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.78) * wear, clamp(m, 0., 1.));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.85, .62, .12) * wear, clamp(my, 0., 1.));`,
      roughnessmap_fragment: 'roughnessFactor = mix(roughnessFactor, .08 + .1 * (1. - puddle), wetK) ; roughnessFactor = mix(roughnessFactor, .55, clamp(m + my, 0., 1.));',
      emissivemap_fragment: `
        vec3 Vw = normalize(cameraPosition - vRP); vec3 pools = vec3(0.), spec = vec3(0.);
        float sh = mix(30., 900., wetK);
        for (int i = 0; i < ${MAXL}; i++) { if (float(i) >= uNL) break; vec3 Lp = uLamps[i] - vRP; float d2 = dot(Lp, Lp); vec3 Ld = Lp * inversesqrt(d2);
          float nl = max(Ld.y, 0.);
          pools += nl / (1. + d2 * .9) * 1.6;
          vec3 H = normalize(Ld + Vw); spec += pow(max(H.y, 0.), sh) * (sh * .012 + .3) / (1. + d2 * .08) * wetK; }
        totalEmissiveRadiance += uLampCol * uLampI * (pools * diffuseColor.rgb * 2.2 + spec * .6);
        totalEmissiveRadiance += vec3(.9, .9, .82) * clamp(m, 0., 1.) * .06;`,
    },
  });
  const surface = new THREE.Mesh(geo, rm); surface.receiveShadow = true; g.add(surface);
  // lamp posts + halos
  const glows = [];
  if (heads.length) {
    const pm = new THREE.MeshStandardMaterial({ color: C('#2e3238'), roughness: 0.45, metalness: 0.7 });
    const headM = new THREE.MeshBasicMaterial({ color: C(lampColor).multiplyScalar(6), toneMapped: false });
    for (const h of heads) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, lampHeight, 8), pm); pole.position.copy(h.base).setY(h.base.y + lampHeight / 2); pole.castShadow = true; g.add(pole);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.6, 6), pm); arm.position.copy(h.base).lerp(h.head, 0.5).setY(h.head.y + 0.05); arm.quaternion.setFromUnitVectors(upV, h.head.clone().sub(h.base).setY(0).normalize()); g.add(arm);
      const lampHead = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.05, 0.12, 2, 0.02), pm); lampHead.position.copy(h.head).setY(h.head.y + 0.03); lampHead.lookAt(h.base.clone().setY(lampHead.position.y)); g.add(lampHead);
      const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.09), headM); lens.rotation.x = Math.PI / 2; lens.position.copy(h.head); g.add(lens);
      glows.push({ p: h.head.toArray(), color: lampColor, i: 9 * lampIntensity, size: 0.09 });
    }
  }
  // traffic: pairs of lights per car
  const cars = [];
  for (let i = 0; i < traffic; i++) { const lane = Math.floor(R() * lanes), dir = lane < lanes / 2 ? -1 : 1; cars.push({ lane, dir, ph: R(), v: speed * (0.8 + R() * 0.4) }); }
  let carPts = null;
  if (cars.length) {
    const list = []; for (const c of cars) for (const s of [-1, 1]) list.push({ p: [0, 0, 0], color: c.dir > 0 ? '#ff3420' : '#fff1d8', i: c.dir > 0 ? 4 : 7, size: 0.03 });
    carPts = lightPoints(list); g.add(carPts);
  }
  const halo = glows.length ? lightPoints(glows) : null; if (halo) g.add(halo);
  g.curve = curve; g.surface = surface;
  g.frameAt = frameAt;
  g.pointAt = (u, lateral = 0) => { const f = frameAt(u); return f.pos.addScaledVector(f.right, lateral); };
  g.at = (t) => {
    if (halo) halo.at(t);
    if (carPts) {
      const arr = carPts.geometry.attributes.position.array;
      cars.forEach((c, i) => {
        const u = ((((c.ph + (c.dir * c.v * t) / L) % 1) + 1) % 1), f = frameAt(u), lat = -Wd / 2 + (c.lane + 0.5) * laneWidth;
        for (let s = 0; s < 2; s++) { const p = f.pos.clone().addScaledVector(f.right, lat + (s ? 0.16 : -0.16)).setY(f.pos.y + 0.12); arr.set([p.x, p.y, p.z], (i * 2 + s) * 3); }
      });
      carPts.geometry.attributes.position.needsUpdate = true;
    }
  };
  g.at(0);
  g.name = 'road'; g.userData = { radius: L / 2, length: L, width: HW * 2, lamps: heads.map((h) => h.head) };
  return withAnchors(g, {});
}

// =====================================================================================================================
// TREES
// =====================================================================================================================

function colorize(geo, fn) {
  const p = geo.attributes.position, c = new Float32Array(p.count * 3), col = new THREE.Color();
  for (let i = 0; i < p.count; i++) { fn(col, p.getX(i), p.getY(i), p.getZ(i)); c.set([col.r, col.g, col.b], i * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo;
}
// One part of a tree, welded so it shades smoothly: vertex colours from fn, and aLeaf (1 = foliage gets the leaf bump).
function treePart(geo, fn, leaf) {
  geo.deleteAttribute('normal'); geo.deleteAttribute('uv');
  const g = mergeVertices(geo); g.computeVertexNormals(); colorize(g, fn);
  g.setAttribute('aLeaf', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(leaf), 1));
  return g;
}
// One tree as a single geometry with vertex colours (canopy shaded darker underneath, a touch of hue variation): soft
// lumpy canopy puffs ('round', 'birch') or drooping tiers of branch clusters ('pine'), a leaning, tapering trunk.
// detail: subdivision of the canopy (3 for crowds, 5 for a hero tree).
function treeGeometry({ height = 1.6, seed = 1, style = 'round', color, trunkColor, detail = 4 }) {
  const R = rng(seed * 13 + 1), parts = [];
  const leaf = C(color || (style === 'pine' ? '#2f5a3c' : style === 'birch' ? '#7f9a45' : '#4f7a3a')), bark = C(trunkColor || (style === 'birch' ? '#e6e1d6' : '#5b4331'));
  const lean = new THREE.Vector3((R() - 0.5) * 0.12, 1, (R() - 0.5) * 0.12).normalize();
  const trunkH = height * (style === 'pine' ? 0.3 : 0.48), tr = height * (style === 'pine' ? 0.035 : 0.045);
  const trunk = new THREE.CylinderGeometry(tr * 0.6, tr, trunkH, 14, 12); trunk.translate(0, trunkH / 2, 0);
  const tp = trunk.attributes.position; for (let i = 0; i < tp.count; i++) { const y = tp.getY(i); tp.setX(i, tp.getX(i) + lean.x * y * 0.8 + Math.sin(y * 6 + seed) * tr * 0.3); tp.setZ(i, tp.getZ(i) + lean.z * y * 0.8); }
  parts.push(treePart(trunk, (c, x, y) => c.copy(bark).multiplyScalar(style === 'birch' ? (Math.sin(y * 40 + x * 30) > 0.85 ? 0.25 : 1) : 0.85 + 0.15 * Math.sin(y * 9)), 0));
  const top = new THREE.Vector3(lean.x * trunkH * 0.8, trunkH, lean.z * trunkH * 0.8);
  const sd = seed * 7.13;
  if (style === 'pine') {
    const tiers = 4 + Math.floor(R() * 2), seg = 8 * (detail + 1);
    for (let i = 0; i < tiers; i++) {
      const f = i / tiers, r = height * (0.32 - f * 0.22) * (0.9 + R() * 0.2), h = height * (0.36 - f * 0.12), spin = R() * TAU, k = 7 + Math.floor(R() * 3);
      // a drooping skirt: a short underside out from the trunk, then concave up to the tip (bottom to top, so the
      // lathe's faces point outwards)
      const prof = [[0.0001, h * 0.16], [r * 0.4, h * 0.08], [r * 0.82, -h * 0.04], [r, -h * 0.02], [r * 0.9, h * 0.06], [r * 0.62, h * 0.32], [r * 0.3, h * 0.66], [0, h]];
      const tier = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), seg);
      const pp = tier.attributes.position;
      for (let j = 0; j < pp.count; j++) { // branch clusters: the rim scallops out into k soft points, more towards the edge
        const x = pp.getX(j), y = pp.getY(j), z = pp.getZ(j), rad = Math.hypot(x, z), a = Math.atan2(z, x) + spin;
        const cl = 1 - 0.2 * (rad / r) * (1 - Math.pow(Math.abs(Math.cos((a * k) / 2)), 0.7)) + fbm3(x * 9 + sd, y * 9, z * 9, { octaves: 2 }) * 0.08;
        pp.setXYZ(j, x * cl + top.x * (1 + f * 0.3), y + trunkH * 0.55 + f * height * 0.62, z * cl + top.z * (1 + f * 0.3));
      }
      parts.push(treePart(tier, (c, x, y) => c.copy(leaf).multiplyScalar(0.55 + 0.6 * clamp((y - trunkH * 0.5) / height)).offsetHSL((hash2(i, 3, seed) - 0.5) * 0.02, 0, 0), 1));
    }
  } else {
    const puffs = style === 'birch' ? 5 : 7, crown = height * (style === 'birch' ? 0.3 : 0.36);
    const centre = top.clone().setY(trunkH + crown * 0.55);
    for (let i = 0; i < puffs; i++) {
      const a = (i / puffs) * TAU + R() * 0.6, rr = i === 0 ? 0 : crown * (0.45 + R() * 0.35), y = i === 0 ? crown * 0.25 : (R() - 0.3) * crown * 0.7;
      const pc = centre.clone().add(new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr)), s = crown * (i === 0 ? 0.75 : 0.42 + R() * 0.22);
      const puff = new THREE.IcosahedronGeometry(1, detail); const pp = puff.attributes.position;
      for (let k = 0; k < pp.count; k++) { // soft lumps (big) and leaf clumps (small), smooth so the outline stays round
        const vx = pp.getX(k), vy = pp.getY(k), vz = pp.getZ(k);
        const n = 1 + fbm3(vx * 1.6 + sd + i * 3.1, vy * 1.6, vz * 1.6, { octaves: 2 }) * 0.22 + fbm3(vx * 4.5 + sd, vy * 4.5 + i, vz * 4.5, { octaves: 2 }) * 0.09;
        pp.setXYZ(k, vx * n * s + pc.x, vy * n * s * 0.85 + pc.y, vz * n * s + pc.z);
      }
      const hue = (R() - 0.5) * 0.03, lum = 0.9 + R() * 0.2;
      parts.push(treePart(puff, (c, x, y) => c.copy(leaf).multiplyScalar(lum * (0.45 + 0.75 * clamp((y - trunkH * 0.75) / (crown * 1.6)))).offsetHSL(hue, 0, 0), 1));
      if (i > 0 && i < 4) { // a branch to the puff
        const br = new THREE.CylinderGeometry(tr * 0.25, tr * 0.4, 1, 8); br.translate(0, 0.5, 0);
        const from = top.clone().multiplyScalar(0.85), dir = pc.clone().sub(from), len = dir.length() * 0.8;
        br.scale(1, len, 1); br.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())); br.translate(from.x, from.y, from.z);
        parts.push(treePart(br, (c) => c.copy(bark).multiplyScalar(0.8), 0));
      }
    }
  }
  return mergeGeometries(parts);
}
// Smooth shading with a per-pixel leaf bump on the foliage (aLeaf), so canopies read as masses of leaves, not facets.
const treeMaterial = (h = 1) => patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }), {
  uniforms: { uLeaf: { value: 22 / h } }, key: 'tree-v2',
  vertexHead: 'attribute float aLeaf; varying float vLeaf; varying vec3 vTP;', vertex: { begin_vertex: 'vLeaf = aLeaf; vTP = transformed;' },
  fragmentHead: `uniform float uLeaf; varying float vLeaf; varying vec3 vTP;\n${GLSL_BUMP}`,
  fragment: { normal_fragment_maps: 'if (vLeaf > .5) normal = bumpNormal(normal, fbm(vTP * uLeaf, 3), .35 / uLeaf);' },
});

// A stylised tree, smooth-shaded to match the rest of the kit: soft canopy puffs (style 'round' or 'birch') or
// drooping tiers of branch clusters ('pine') with a leafy bump, on a leaning, tapering trunk. height in world units;
// base at the origin. detail: canopy subdivision (5 default here; forest uses 3).
export function tree({ height = 1.6, seed = 1, style = 'round', color, trunkColor, detail = 5 } = {}) {
  const mesh = new THREE.Mesh(treeGeometry({ height, seed, style, color, trunkColor, detail }), treeMaterial(height));
  mesh.castShadow = mesh.receiveShadow = true;
  const g = new THREE.Group(); g.name = 'tree'; g.add(mesh); g.userData = { radius: height * 0.6, center: new THREE.Vector3(0, height * 0.5, 0) };
  return withAnchors(g, {});
}

// Many trees, instanced: `count` trees scattered over `area` ([width, depth], centred on the origin), heights
// varying around `height`. heightAt(x, z) puts them on a terrain; clear = radius kept empty around `center`.
export function forest({ count = 200, area = [30, 30], height = 1.6, seed = 7, styles = ['round', 'pine'], heightAt = null, clear = 0, center = [0, 0], variants = 6, color, trunkColor, detail = 3 } = {}) {
  const g = new THREE.Group(); g.name = 'forest'; const R = rng(seed), mat = treeMaterial(1);
  const kinds = []; for (let i = 0; i < variants; i++) kinds.push(treeGeometry({ height: 1, seed: seed * 100 + i, style: styles[i % styles.length], color, trunkColor, detail }));
  const meshes = kinds.map((geo) => { const m = new THREE.InstancedMesh(geo, mat, Math.ceil(count / variants) + 2); m.count = 0; m.castShadow = m.receiveShadow = true; g.add(m); return m; });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
  for (let i = 0, tries = 0; i < count && tries < count * 20; tries++) {
    const x = (R() - 0.5) * area[0], z = (R() - 0.5) * area[1];
    if (clear > 0 && Math.hypot(x - center[0], z - center[1]) < clear * (0.85 + R() * 0.3)) continue;
    const mesh = meshes[i % variants], h = height * (0.7 + R() * 0.6);
    q.setFromAxisAngle(v.set(0, 1, 0), R() * TAU);
    m4.compose(v.set(x, heightAt ? heightAt(x, z) - 0.02 : 0, z), q, s.set(h, h * (0.9 + R() * 0.2), h)); mesh.setMatrixAt(mesh.count++, m4); i++;
  }
  for (const m of meshes) m.computeBoundingSphere();
  g.userData = { radius: Math.hypot(...area) / 2 };
  return withAnchors(g, {});
}

// =====================================================================================================================
// NOODLE BOWL
// =====================================================================================================================

// noodleBowl(o): a dark stoneware bowl of crimped instant noodles in broth, the hero of a kitchen or microwave story.
// It stands on y = 0 (on a table, or added to microwaveOven().plate so it turns). radius: the rim (0.7); height (0.62);
// strands (64) piled into a mound over the broth, whose height is `level` of the bowl's; the last strand lies across
// the crown: the hero noodle a camera can dive into. glaze (the bowl), noodle, broth, noodleRadius (0.024 x radius),
// shadow: a round contact shadow under it (true; it shows on glass, which takes no shadow map). bowl.setHeat(v) 0..1
// warms the noodles (a faint glow from inside) for "it heats up"; bowl.heroCurve is a Curve3 along the hero noodle
// (bowl space); bowl.noodleMat. Anchors: top (the crown of the mound), hero (the middle of the hero noodle), broth.
export function noodleBowl({ radius: Rr = 0.7, height: H = 0.62, strands = 64, seed = 4, glaze = '#17171a', noodle = '#e4b462', broth = '#5e2e0e', level = 0.62, noodleRadius = 0.024, shadow = true } = {}) {
  const R = rng(seed), g = new THREE.Group(); g.name = 'noodleBowl';
  const th = Rr * 0.055;
  // the bowl, one lathe: the inner wall up, a round rim, the outer wall down, a foot ring
  const fIn = (s) => Math.sqrt(1 - (1 - s) * (1 - s) * 0.86), fOut = (s) => Math.sqrt(1 - (1 - s) * (1 - s) * 0.8);
  const prof = [new THREE.Vector2(0.0005, H * 0.1)];
  for (let i = 0; i <= 24; i++) { const s = i / 24; prof.push(new THREE.Vector2((Rr - th) * fIn(s), H * 0.1 + s * H * 0.875)); }
  for (let i = 1; i < 10; i++) { const a = Math.PI - (i / 10) * Math.PI; prof.push(new THREE.Vector2(Rr - th / 2 + (Math.cos(a) * th) / 2, H * 0.975 + Math.sin(a) * th * 0.6)); }
  for (let i = 24; i >= 0; i--) { const s = i / 24; prof.push(new THREE.Vector2(Rr * fOut(s), H * 0.06 + s * H * 0.915)); }
  prof.push(new THREE.Vector2(Rr * 0.43, H * 0.035), new THREE.Vector2(Rr * 0.42, 0), new THREE.Vector2(Rr * 0.35, 0), new THREE.Vector2(Rr * 0.34, H * 0.05), new THREE.Vector2(0.0005, H * 0.06));
  const speck = cached('bowlSpeck', () => noiseTexture({ kind: 'grain', repeat: 3, seed: 9 }));
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(prof, 128), mat.ceramic(glaze, { rough: 0.24, extra: { bumpMap: speck, bumpScale: 0.6, side: THREE.DoubleSide } }));
  bowl.castShadow = bowl.receiveShadow = true; g.add(bowl);
  if (shadow) g.add(contactShadow({ width: Rr * 1.5, depth: Rr * 1.5, spread: 0.5, opacity: 0.8, shape: 'round' }));
  // the broth: a glossy surface with fine ripples and a few drops of oil
  const yB = H * level, sB = (yB - H * 0.1) / (H * 0.875), rB = (Rr - th) * fIn(sB);
  const brothMat = new THREE.MeshPhysicalMaterial({ color: C(broth), roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.3, bumpMap: cached('brothRipples', () => noiseTexture({ kind: 'ripples', repeat: 2, seed: 2 })), bumpScale: 0.25 });
  const surf = new THREE.Mesh(new THREE.CircleGeometry(rB, 96).rotateX(-Math.PI / 2), brothMat); surf.position.y = yB; surf.receiveShadow = true; g.add(surf);
  const oil = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: C('#c98a34'), roughness: 0.05, clearcoat: 1, envMapIntensity: 1.6 }), 40);
  const M4 = new THREE.Matrix4();
  for (let i = 0; i < 40; i++) { const a = R() * TAU, r = rB * Math.sqrt(R()) * 0.92, s = rB * (0.012 + R() * R() * 0.05); M4.compose(new THREE.Vector3(Math.cos(a) * r, yB + 0.003 * Rr, Math.sin(a) * r), new THREE.Quaternion(), new THREE.Vector3(s, 1, s * (0.8 + R() * 0.4))); oil.setMatrixAt(i, M4); }
  g.add(oil);
  // the noodles: crimped strands (a wave along each one, as instant noodles are) on loops over a dome above the broth
  const Rin = rB * 0.94, mound = H * 0.24, nr = Rr * noodleRadius, crimpA = Rr * 0.03, crimpL = Rr * 0.2;
  const geos = [], T = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  let hero = null;
  for (let i = 0; i < strands; i++) {
    const top = i === strands - 1;
    const a0 = R() * TAU, span = (2.6 + R() * 2.6) * (i % 2 ? -1 : 1), r0 = top ? 0.32 : 0.2 + R() * 0.68, f = 0.35 + R() * 0.6, p0 = R() * TAU, depth = top ? 0 : R() * R() * 0.8;
    const ctrl = [];
    for (let j = 0; j <= 18; j++) {
      const s = j / 18, a = a0 + s * span * (top ? 0.45 : 1);
      const r = THREE.MathUtils.clamp((r0 + 0.16 * Math.sin(TAU * s * f + p0)) * Rin, 0.043 * Rr, 0.93 * Rin);
      const dome = mound * Math.pow(Math.max(0, 1 - (r / Rin) ** 2), 0.7);
      ctrl.push(new THREE.Vector3(Math.cos(a) * r, yB + dome * (1 - depth) - nr * 1.5 + (top ? nr * 3 : 0) + Rr * 0.012 * Math.sin(s * 7 + p0), Math.sin(a) * r));
    }
    const base = new THREE.CatmullRomCurve3(ctrl), len = base.getLength(), N = Math.max(60, Math.round((len / crimpL) * 14)), pts = [];
    for (let j = 0; j <= N; j++) {
      const u = j / N, p = base.getPointAt(u), ph = ((u * len) / crimpL) * TAU;
      base.getTangentAt(u, T); side.crossVectors(T, up).normalize();
      pts.push(p.addScaledVector(side, Math.sin(ph) * crimpA).addScaledVector(up, Math.cos(ph * 0.5) * crimpA * 0.35));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    geos.push(new THREE.TubeGeometry(curve, N * 2, nr * (0.92 + R() * 0.16), 7, false));
    if (top) hero = curve;
  }
  const noodleMat = new THREE.MeshPhysicalMaterial({ color: C(noodle), roughness: 0.36, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.22, sheen: 0.5, sheenColor: C('#fff2cf'), sheenRoughness: 0.4, emissive: C('#8a4a10'), emissiveIntensity: 0.06, envMapIntensity: 0.9 });
  const noodles = new THREE.Mesh(mergeGeometries(geos), noodleMat); noodles.castShadow = noodles.receiveShadow = true; g.add(noodles);
  geos.forEach((x) => x.dispose());
  const anchors = {};
  const mk = (name, p) => { const a = new THREE.Object3D(); a.position.copy(p); a.name = name; g.add(a); anchors[name] = a; };
  mk('top', new THREE.Vector3(0, yB + mound, 0)); mk('hero', hero.getPointAt(0.5)); mk('broth', new THREE.Vector3(0, yB, 0));
  g.setHeat = (v) => { noodleMat.emissiveIntensity = 0.06 + 0.16 * clamp(v); };
  g.noodleMat = noodleMat; g.heroCurve = hero;
  g.userData = { radius: Math.hypot(Rr, H / 2), center: new THREE.Vector3(0, H / 2, 0), size: [2 * Rr, H, 2 * Rr] };
  return withAnchors(g, anchors);
}
