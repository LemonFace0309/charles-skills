// The art direction: palettes, light rigs, environments for reflections, backdrops, fog and material presets.
// A video picks ONE palette (project.json "palette") and every shot inherits it, so the whole piece reads as one world.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const C = (hex) => new THREE.Color(hex);

// bg: backdrop gradient [top, bottom] (sRGB hex); fog: colour + density per world unit; accent: the ONE warm colour
// for highlights, paths and caption pills; glow: the secondary emissive colour; ink: text drawn on the accent;
// haze (optional): the backdrop's soft glow behind the subject, when the secondary is too light for a big area.
export const PALETTES = {
  'night-amber': {
    bg: ['#0d1626', '#04060b'], fog: ['#0a1322', 0.035], accent: '#ffb43c', glow: '#5aa8ff', haze: '#7f8fb2', ink: '#16110a', text: '#ffffff',
    env: 'night', key: ['#ffd9a6', 2.6], rim: ['#6fa8ff', 2.2], fill: ['#1b2a44', 0.6],
    post: { exposure: 1.0, bloom: 0.07, grain: 0.035, vignette: 0.6, look: 0.35, shadowTint: [-0.01, 0.0, 0.025], highlightTint: [0.02, 0.008, -0.01] },
  },
  'ocean-blue': {
    bg: ['#0c1d4a', '#030716'], fog: ['#0a1840', 0.03], accent: '#ffd23f', glow: '#77d9fc', haze: '#58b4ff', ink: '#1a1404', text: '#ffffff',
    env: 'night', key: ['#bcd4ff', 2.2], rim: ['#58b4ff', 2.6], fill: ['#14275a', 0.8],
    post: { exposure: 1.05, bloom: 0.08, grain: 0.035, vignette: 0.6, look: 0.4, shadowTint: [-0.01, 0.0, 0.03], highlightTint: [0.0, 0.0, 0.0] },
  },
  space: {
    bg: ['#05060a', '#010102'], fog: ['#000000', 0.0], accent: '#f2be62', glow: '#f6e7c8', ink: '#17120a', text: '#ffffff',
    env: 'space', key: ['#fff1dc', 3.2], rim: ['#7f9cff', 0.8], fill: ['#0b0f1a', 0.25],
    post: { exposure: 1.0, bloom: 0.08, grain: 0.04, vignette: 0.7, look: 0.3, highlightTint: [0.015, 0.008, 0.0] },
  },
  'studio-cool': {
    bg: ['#6f87a3', '#2a3647'], fog: ['#53677f', 0.02], accent: '#ff9a3c', glow: '#ffb15c', ink: '#1d1206', text: '#ffffff',
    env: 'studio', key: ['#fff4e6', 3.0], rim: ['#cfe2ff', 1.6], fill: ['#8fa6c4', 0.9],
    post: { exposure: 1.0, bloom: 0.05, grain: 0.03, vignette: 0.45, look: 0.3, shadowTint: [-0.01, 0.0, 0.02] },
  },
  dusk: {
    bg: ['#3b2142', '#f08a4b'], fog: ['#b85a4a', 0.02], accent: '#ffb43c', glow: '#ffcf7a', ink: '#1d1206', text: '#ffffff',
    env: 'sunset', key: ['#ffb36b', 3.0], rim: ['#c58cff', 1.2], fill: ['#4a2b4f', 0.7],
    post: { exposure: 1.0, bloom: 0.07, grain: 0.035, vignette: 0.55, look: 0.35 },
  },
  // a warm brown-black interior where only the signal is green (look.md: never tint the whole world green)
  'emerald-night': {
    bg: ['#1a1410', '#050302'], fog: ['#120d0a', 0.03], accent: '#7dff9a', glow: '#f2d787', ink: '#06140b', text: '#ffffff',
    env: 'night', key: ['#ffe7cc', 2.2], rim: ['#deb989', 2.0], fill: ['#26221a', 0.6],
    post: { exposure: 1.0, bloom: 0.08, grain: 0.035, vignette: 0.6, look: 0.35 },
  },
  'studio-light': {
    bg: ['#eef1f5', '#c9d1dc'], fog: ['#dfe5ec', 0.015], accent: '#2f6bff', glow: '#7aa2ff', ink: '#ffffff', text: '#0e1116',
    env: 'studio', key: ['#ffffff', 2.4], rim: ['#ffffff', 1.0], fill: ['#dfe6f0', 1.0],
    post: { exposure: 1.0, bloom: 0.04, grain: 0.025, vignette: 0.25, look: 0.2 },
  },
};

// The palette of the video being rendered (set by seq.js before any shot is built). Props default to theme.pal.accent.
export const theme = { pal: null };
export const accentDefault = () => theme.pal?.accent ?? '#ffb43c';

export function palette(name) {
  const p = PALETTES[name] || PALETTES['night-amber'];
  return { name, ...p };
}

// Procedural environments for reflections (no HDRI files needed). Softboxes make metal and glass look expensive.
// 'orbit' is space seen from low orbit: black sky with faint stars, a sun disc, and a blue planet filling one side,
// so metal, foil and glass have something to reflect (the 'space' kind is nearly black: polished parts read as holes).
function envScene(kind, pal, o = {}) {
  const s = new THREE.Scene();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: C(pal.bg[0]) }, bot: { value: C(pal.bg[1]) }, k: { value: kind === 'space' ? 0.15 : 0.6 } },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform vec3 top, bot; uniform float k; varying vec3 vP; void main(){ gl_FragColor = vec4(mix(bot, top, smoothstep(-.4, .8, vP.y)) * k, 1.); }`,
  }));
  s.add(dome);
  const box = (w, h, pos, look, intensity, color = '#ffffff') => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: C(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(...look); s.add(m);
  };
  if (kind === 'studio') {
    box(14, 6, [0, 12, 0], [0, 0, 0], 3.2);
    box(3, 14, [-12, 4, 2], [0, 2, 0], 2.0);
    box(3, 14, [12, 4, -2], [0, 2, 0], 1.6);
    box(20, 2, [0, 2, -14], [0, 2, 0], 0.8);
  } else if (kind === 'night') {
    box(18, 3, [0, 10, -6], [0, 0, 0], 1.2, pal.rim[0]);
    box(3, 12, [-12, 3, 4], [0, 2, 0], 1.0, pal.key[0]);
    box(24, 1.2, [0, 0.5, -16], [0, 1, 0], 0.7, pal.glow);
  } else if (kind === 'sunset') {
    box(30, 6, [0, 2, -16], [0, 2, 0], 2.4, '#ffb070');
    box(10, 10, [0, 14, 0], [0, 0, 0], 0.7, '#c99cff');
  } else if (kind === 'space') {
    box(4, 4, [14, 6, 8], [0, 0, 0], 8.0, '#fff1dc');
  } else if (kind === 'orbit') {
    dome.material = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { sun: { value: new THREE.Vector3(...(o.sun || [6, 9, 7])).normalize() }, earth: { value: new THREE.Vector3(...(o.earth || [-0.55, -0.75, -0.35])).normalize() } },
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
      fragmentShader: `uniform vec3 sun, earth; varying vec3 vP;
        float h(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        void main(){
          vec3 d = normalize(vP), c = vec3(.002, .0025, .004);
          vec3 g = floor(d * 160.); float st = h(g); c += step(.996, st) * mix(.25, 2.5, pow(h(g + 7.), 4.)) * vec3(.9, .95, 1.);
          float ce = dot(d, earth), a0 = cos(radians(62.)), sd = max(dot(d, sun), 0.);
          if (ce > a0) { // the planet: night side away from the sun, a blue day side and a bright limb
            float k = (ce - a0) / (1. - a0), day = .25 + .75 * smoothstep(-.3, .6, dot(d - earth * ce, sun));
            c = mix(vec3(.05, .16, .42), vec3(.16, .34, .7), smoothstep(0., .8, k)) * day + vec3(.35, .6, 1.) * exp(-k * 14.) * 1.6 * day;
          } else c += vec3(.25, .5, 1.) * (exp(-(a0 - ce) * 40.) * .9 + exp(-(a0 - ce) * 6.) * .08); // atmosphere glow
          c += vec3(1., .96, .9) * (smoothstep(cos(radians(1.6)), cos(radians(1.1)), sd) * 60. + pow(sd, 400.) * 2. + pow(sd, 24.) * .06);
          gl_FragColor = vec4(c, 1.);
        }`,
    });
  }
  return s;
}

// Cached per kind, palette and options, and flagged shared so evicting one shot never disposes another's reflections.
// o (orbit only): { sun: [x, y, z], earth: [x, y, z] } directions; the sun defaults to the k.rig() key light's.
const envCache = new Map();
export function environment(renderer, kind, pal, o = {}) {
  const key = kind + pal.name + JSON.stringify(o);
  if (envCache.has(key)) return envCache.get(key);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = kind === 'room' ? pm.fromScene(new RoomEnvironment(), 0.04).texture : pm.fromScene(envScene(kind, pal, o), 0.04).texture;
  pm.dispose();
  tex.userData.shared = true;
  envCache.set(key, tex);
  return tex;
}

// A backdrop that stays behind everything: a huge sphere with a vertical gradient, an optional soft glow behind the
// subject, and an optional warm horizon: a glowing band across the frame at screen height y (0 bottom, 1 top), the
// light every diving hook puts behind its hero, in any palette (glass and liquid heroes need something lit behind them:
// transmission only shows what is behind). Both are screen-locked, so they stay behind the hero. Not affected by fog.
//   horizon: a strength (0.3 to 0.5 behind a hero in a night palette) or { strength .4, color '#ff8a3c', y .6, width .1 }
//   b.setGlow(v) and b.setHorizon(v) change the strengths in update (pure setters).
export function backdrop(pal, { glow = 0.0, glowColor, glowPos = [0.5, 0.55], radius = 400, horizon = 0 } = {}) {
  const hz = typeof horizon === 'number' ? { strength: horizon } : { strength: 0.4, ...horizon };
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: C(pal.bg[0]) }, bot: { value: C(pal.bg[1]) },
      gcol: { value: C(glowColor || pal.haze || pal.glow) }, g: { value: glow }, gpos: { value: new THREE.Vector2(...glowPos) }, res: { value: new THREE.Vector2(1080, 1920) },
      hcol: { value: C(hz.color || '#ff8a3c') }, h: { value: hz.strength ?? 0 }, hy: { value: hz.y ?? 0.6 }, hw: { value: hz.width ?? 0.1 },
    },
    vertexShader: `varying vec3 vW; varying vec4 vC; void main(){ vW = normalize((modelMatrix * vec4(position, 1.)).xyz - cameraPosition); vC = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position = vC; }`,
    fragmentShader: `uniform vec3 top, bot, gcol, hcol; uniform float g, h, hy, hw; uniform vec2 gpos, res; varying vec3 vW; varying vec4 vC;
      void main(){ vec2 s = (vC.xy / vC.w) * .5 + .5; float t = smoothstep(-.35, .75, vW.y);
        vec3 c = mix(bot, top, t); vec2 d = (s - gpos) * vec2(res.x/res.y, 1.); c += gcol * g * exp(-dot(d,d) * 9.);
        c += hcol * h * exp(-pow((s.y - hy) / hw, 2.));
        gl_FragColor = vec4(c, 1.); }`,
  }));
  m.renderOrder = -1000; m.frustumCulled = false;
  const u = m.material.uniforms;
  m.setGlow = (v) => { u.g.value = v; };
  m.setHorizon = (v) => { u.h.value = v; };
  return m;
}

// A product light for a night world: a narrow, soft-edged cool spot from high above and a little behind the product
// (it lights the top and rims the back edge; it casts the product's shadow, so its cone never lands on the floor in
// front of it) plus a narrow soft fill from the camera side, only as wide as the product, for the faces the camera
// sees: white plastic and glass read white without lifting the room (a wide light floods the desk). target: an Object3D (aimed at its bounding
// centre and radius: userData.center, userData.radius) or a point (pass radius). The light that reaches the target
// does not depend on the scale: `intensity` 30 gives an illuminance of 3 there (the night rig's key is 2.6 at keyScale
// 1). It registers nothing with the camera body: k.softLight(pl.spot, r) softens its shadow.
//   o: { color '#dfe8ff', intensity 30, angle .18 (cone half-angle, rad), penumbra .9, pos (world; default high above
//        and a little behind, far enough for the cone to cover the target), fill .8 (the fill's share of the
//        intensity; it is what lights the faces the camera sees), shadow true, radius }
//   -> { spot, fill, set(v) (multiplies both, pure), follow() (re-aims at a target that moved; call it in update) }
export function productLight(scene, target, o = {}) {
  const { color = '#dfe8ff', intensity = 30, angle = 0.18, penumbra = 0.9, fill: fillK = 0.8, shadow = true } = o;
  const aim = new THREE.Object3D(), aimF = new THREE.Object3D();
  const spot = new THREE.SpotLight(C(color), 0, 0, angle, penumbra, 2);
  const fill = new THREE.SpotLight(C(color), 0, 0, angle, 1, 2);
  spot.target = aim; fill.target = aimF;
  if (shadow) { spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0004; spot.shadow.normalBias = 0.02; spot.shadow.radius = 3; }
  scene.add(spot, fill, aim, aimF);
  const ctr = new THREE.Vector3(), up = new THREE.Vector3(-0.25, 1.4, -0.4).normalize(), front = new THREE.Vector3(0.4, 0.9, 1).normalize();
  let k = 1;
  const place = () => {
    let r = o.radius ?? 1;
    if (target?.isObject3D) {
      target.updateWorldMatrix(true, false);
      ctr.copy(target.userData?.center || new THREE.Vector3()); target.localToWorld(ctr);
      if (o.radius == null && target.userData?.radius) r = target.userData.radius * target.getWorldScale(new THREE.Vector3()).x;
    } else ctr.set(...(target?.isVector3 ? target.toArray() : target || [0, 0, 0]));
    const D = (1.2 * r) / Math.tan(angle); // far enough that the cone covers the target
    if (o.pos) spot.position.set(...(o.pos.isVector3 ? o.pos.toArray() : o.pos)); else spot.position.copy(ctr).addScaledVector(up, D);
    fill.position.copy(ctr).addScaledVector(front, D); fill.angle = Math.atan((1.4 * r) / D); // about as wide as the product
    aim.position.copy(ctr); aimF.position.copy(ctr);
    // inverse-square falloff: scale the candela by the distance squared, so the illuminance at the target is intensity / 10
    const d = spot.position.distanceTo(ctr);
    spot.intensity = (k * intensity * d * d) / 10; spot.distance = d * 2.5;
    fill.intensity = (k * intensity * fillK * D * D) / 10; fill.distance = D * 2.5;
    if (shadow) { spot.shadow.camera.near = Math.max(0.01, d - 3 * r); spot.shadow.camera.far = d + 6 * r; }
  };
  place();
  return { spot, fill, set: (v) => { k = v; place(); }, follow: () => place() };
}

// Light rigs. key = soft shadow-casting key light (k.softLight registers it for area sampling),
// rim = cool edge light from behind, fill = hemisphere ambience. Returns the lights so a shot can animate them.
export function rig(scene, pal, { keyPos = [6, 9, 7], rimPos = [-7, 5, -8], target = [0, 0, 0], shadows = true, shadowSize = 12, keyScale = 1, rimScale = 1, fillScale = 1 } = {}) {
  const key = new THREE.DirectionalLight(C(pal.key[0]), pal.key[1] * keyScale);
  key.position.set(...keyPos); key.target.position.set(...target);
  if (shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const s = shadowSize; Object.assign(key.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 0.1, far: 80 });
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 2;
  }
  const rim = new THREE.DirectionalLight(C(pal.rim[0]), pal.rim[1] * rimScale);
  rim.position.set(...rimPos); rim.target.position.set(...target);
  const fill = new THREE.HemisphereLight(C(pal.fill[0]), C(pal.bg[1]), pal.fill[1] * fillScale);
  scene.add(key, key.target, rim, rim.target, fill);
  return { key, rim, fill };
}

// Incandescent liquid (molten silicon, glass, metal): white-hot where the surface faces the camera, deep orange at the
// silhouette, slow convection cells with thin darker veins of cooling skin drifting over them, under a glossy wet coat.
// A uniform emissive reads as a glowing soap egg; the facing ramp and the churn are what read as liquid heat.
// m.set(heat 0..1, t) in every update (pure). fade (default true) fades the surface in with the heat, so it can lie
// over a solid object's own mesh (same geometry, renderOrder 2); fade: false keeps it opaque (a dark crust when cold).
// scale: feature size of the churn in the object's own units (1 suits an object about 1 across).
function molten({ rim = [0.9, 0.12, 0.01], mid = [1.0, 0.42, 0.06], core = [1.0, 0.8, 0.45], gain = 1, scale = 1, crust = 0.5, fade = true, rough = 0.12 } = {}) {
  const col = (c) => (Array.isArray(c) ? new THREE.Color(...c) : C(c)); // arrays are linear RGB, strings sRGB hex
  const U = { uHeat: { value: 0 }, uT: { value: 0 }, uRim: { value: col(rim) }, uMid: { value: col(mid) }, uCore: { value: col(core) }, uGain: { value: gain }, uScale: { value: scale }, uCrust: { value: crust } };
  const m = new THREE.MeshPhysicalMaterial({ color: C('#0b0604'), roughness: rough, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.8, transparent: fade, opacity: fade ? 0 : 1, fog: false });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMoltenP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvMoltenP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vMoltenP; uniform float uHeat, uT, uGain, uScale, uCrust; uniform vec3 uRim, uMid, uCore;
float mHash(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float mNoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(mix(mHash(i), mHash(i + vec3(1,0,0)), f.x), mix(mHash(i + vec3(0,1,0)), mHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(mHash(i + vec3(0,0,1)), mHash(i + vec3(1,0,1)), f.x), mix(mHash(i + vec3(0,1,1)), mHash(i + vec3(1,1,1)), f.x), f.y), f.z); }
float mFbm(vec3 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++){ s += a * mNoise(p); p = p * 2.03 + vec3(1.7, -3.1, 2.3); a *= .5; } return s / .9375; }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{ vec3 p = vMoltenP / uScale;
  float f = pow(max(dot(normalize(normal), normalize(vViewPosition)), 0.), 1.4);
  float w = mFbm(p * 1.3 + vec3(0., uT * .08, 0.));
  float cell = smoothstep(.3, .75, mFbm(p * 2.4 + w * 1.6 + vec3(uT * .12, -uT * .09, uT * .05)));
  // local heat: the hot cells, a little hotter where the surface faces the camera; the colour runs rim > mid > core
  // with it, and the brightness rises steeply, so only the hottest cells go white (above 4 the tone map desaturates)
  float hl = clamp(cell * (.55 + .45 * f) + .12 * f, 0., 1.);
  vec3 c = mix(uRim, uMid, smoothstep(.05, .5, hl)); c = mix(c, uCore, smoothstep(.55, .98, hl));
  float vein = smoothstep(.03, 0., abs(mFbm(p * 3.1 - w + vec3(0., uT * .05, uT * .07)) - .5));
  totalEmissiveRadiance += c * (.55 + 5.5 * hl * hl) * (1. - uCrust * vein) * uHeat * uGain; }`);
  };
  m.customProgramCacheKey = () => 'molten';
  m.userData.molten = U;
  m.set = (heat, t = 0) => { U.uHeat.value = heat; U.uT.value = t; if (fade) m.opacity = Math.min(1, Math.max(0, heat * 1.2)); };
  return m;
}

// Material presets. Physically based; the right roughness is most of what makes a render read as "expensive".
// Clearcoats default to a little roughness (ccRough 0.15 to 0.18): a mirror-sharp coat (0) makes pinpoint highlights
// that break into dot grids out of focus.
export const mat = {
  molten,
  plastic: (color = '#1d2a3f', o = {}) => new THREE.MeshPhysicalMaterial({ color: C(color), roughness: o.rough ?? 0.32, metalness: 0, clearcoat: o.clearcoat ?? 0.6, clearcoatRoughness: o.ccRough ?? 0.18, envMapIntensity: o.env ?? 1, ...o.extra }),
  matte: (color = '#2a3446', o = {}) => new THREE.MeshStandardMaterial({ color: C(color), roughness: o.rough ?? 0.85, metalness: 0, envMapIntensity: o.env ?? 0.6, ...o.extra }),
  metal: (color = '#c9ccd2', o = {}) => new THREE.MeshPhysicalMaterial({ color: C(color), roughness: o.rough ?? 0.28, metalness: 1, envMapIntensity: o.env ?? 1.2, ...o.extra }),
  // Anisotropy stretches highlights along the surface's u direction (anisoRot: Math.PI / 2 for v), so it needs UVs
  // that vary across the face: with constant UVs (merged or extruded geometry that never got real ones) the tangent is
  // undefined and the face renders as a flat blown-out sheet. On a cylinder, u runs around it: 0.8 flattens the sides.
  brushed: (color = '#b9bec7', o = {}) => new THREE.MeshPhysicalMaterial({ color: C(color), roughness: o.rough ?? 0.38, metalness: 1, anisotropy: o.aniso ?? 0.4, anisotropyRotation: o.anisoRot ?? 0, envMapIntensity: o.env ?? 1.2, ...o.extra }),
  gold: (o = {}) => new THREE.MeshPhysicalMaterial({ color: C('#e9b45a'), roughness: o.rough ?? 0.25, metalness: 1, envMapIntensity: o.env ?? 1.3, ...o.extra }),
  glass: (o = {}) => new THREE.MeshPhysicalMaterial({ color: C(o.color || '#ffffff'), roughness: o.rough ?? 0.04, metalness: 0, transmission: o.transmission ?? 1, thickness: o.thickness ?? 0.6, ior: o.ior ?? 1.45, envMapIntensity: o.env ?? 1.2, clearcoat: o.clearcoat ?? 1, clearcoatRoughness: o.ccRough ?? 0.15, transparent: false, ...o.extra }),
  frosted: (o = {}) => new THREE.MeshPhysicalMaterial({ color: C(o.color || '#dfe8f5'), roughness: o.rough ?? 0.35, metalness: 0, transmission: 1, thickness: o.thickness ?? 1, ior: 1.4, envMapIntensity: 1, ...o.extra }),
  ceramic: (color = '#f2f0ea', o = {}) => new THREE.MeshPhysicalMaterial({ color: C(color), roughness: o.rough ?? 0.22, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.1, sheen: 0.2, ...o.extra }),
  rubber: (color = '#111318', o = {}) => new THREE.MeshStandardMaterial({ color: C(color), roughness: 0.9, metalness: 0, ...o.extra }),
  // Emissive light sources: values above 1 are HDR and bloom. intensity 2-6 reads as a glowing line, 10+ as a hot core.
  emissive: (color = accentDefault(), intensity = 4, o = {}) => new THREE.MeshBasicMaterial({ color: C(color).multiplyScalar(intensity), toneMapped: false, fog: o.fog ?? true, transparent: !!o.opacity, opacity: o.opacity ?? 1, depthWrite: o.depthWrite ?? true, blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending }),
  // A surface that is lit AND glows (screens, LEDs on a part).
  lit: (color = '#1d2a3f', glow = accentDefault(), glowIntensity = 2, o = {}) => new THREE.MeshPhysicalMaterial({ color: C(color), roughness: o.rough ?? 0.35, metalness: o.metal ?? 0, emissive: C(glow), emissiveIntensity: glowIntensity, clearcoat: o.clearcoat ?? 0.4, clearcoatRoughness: o.ccRough ?? 0.15, ...o.extra }),
};

export function applyFog(scene, pal, densityScale = 1) {
  const [col, d] = pal.fog;
  if (d > 0) scene.fog = new THREE.FogExp2(C(col), d * densityScale);
}

// Procedural, tileable noise as a texture: use as bumpMap (sand, concrete, brushed metal), roughnessMap (smudges)
// or alphaMap. Surfaces with no micro-detail read as plastic toys; a little bump is the cheapest realism there is.
// kind: 'fbm' (cloudy), 'grain' (fine sand), 'brushed' (streaks along x), 'ripples' (sand ripples along x).
export function noiseTexture({ size = 512, kind = 'fbm', scale = 6, seed = 1, repeat = 8 } = {}) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), img = g.createImageData(size, size);
  const h = (x, y) => { const n = Math.sin((x % scale) * 127.1 + (y % scale) * 311.7 + seed * 74.7) * 43758.5453; return n - Math.floor(n); };
  const sm = (t) => t * t * (3 - 2 * t);
  const vnoise = (x, y, per) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = h(((xi % per) + per) % per, ((yi % per) + per) % per), b = h((((xi + 1) % per) + per) % per, ((yi % per) + per) % per);
    const c2 = h(((xi % per) + per) % per, (((yi + 1) % per) + per) % per), d = h((((xi + 1) % per) + per) % per, (((yi + 1) % per) + per) % per);
    return a + (b - a) * sm(xf) + (c2 - a) * sm(yf) + (a - b - c2 + d) * sm(xf) * sm(yf); };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x / size) * scale, v = (y / size) * scale;
    let n = 0;
    if (kind === 'grain') { n = h(x * 13.1, y * 7.7) * 0.6 + vnoise(u * 4, v * 4, scale * 4) * 0.4; }
    else if (kind === 'brushed') { n = vnoise(u * 0.5, v * 24, scale * 24) * 0.7 + h(x * 3.1, y * 0.37) * 0.3; }
    else if (kind === 'ripples') { n = 0.5 + 0.5 * Math.sin(u * 6.283 * 2 + vnoise(u, v, scale) * 4) * 0.8 + vnoise(u * 4, v * 4, scale * 4) * 0.2; }
    else { let amp = 0.5, f = 1, tot = 0; for (let o = 0; o < 5; o++) { n += vnoise(u * f, v * f, scale * f) * amp; tot += amp; amp *= 0.5; f *= 2; } n /= tot; }
    const i = (y * size + x) * 4, val = Math.max(0, Math.min(255, n * 255));
    img.data[i] = img.data[i + 1] = img.data[i + 2] = val; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 8;
  return t;
}
