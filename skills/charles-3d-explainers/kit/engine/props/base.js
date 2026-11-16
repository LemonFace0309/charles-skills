// Ready-made hero props. Each is built from primitives and procedural textures so it renders crisply at any
// distance, and each returns a THREE.Group with helpers. Build what you need beyond these in your shot; good
// ones get promoted into this file.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, theme } from '../look.js';
import { rng } from '../util.js';

const C = (c) => new THREE.Color(c);
const kitURL = (p) => new URL('../../' + p, import.meta.url).href;
const loader = new THREE.TextureLoader();
export const loadTexture = (url, { srgb = true } = {}) => new Promise((res, rej) => loader.load(url, (t) => { if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; res(t); }, undefined, () => rej(new Error('cannot load ' + url))));

// A rounded rectangle Shape (for screens, cards, phone bodies).
export function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2; r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
// Planar UVs 0..1 over a geometry's bounding box (ShapeGeometry ships shape-space UVs).
export function planarUV(geo) {
  geo.computeBoundingBox(); const b = geo.boundingBox, p = geo.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) - b.min.x) / (b.max.x - b.min.x); uv[i * 2 + 1] = (p.getY(i) - b.min.y) / (b.max.y - b.min.y); }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return geo;
}

// ---------- the prop contract ----------
// Named anchors: g.anchors maps names to Object3D markers that move with their part (a lid, a wing, an atom). Hand one
// to k.ui.label({ anchor }), k.lens.focus or cam.frame(). g.anchor(name) returns it, and throws with the valid names
// on a typo instead of handing back undefined. Every kit prop calls this; call it on your own props too.
export function withAnchors(g, anchors = g.anchors || {}) {
  g.anchors = anchors;
  g.anchor = (name) => {
    const a = anchors[name];
    if (a?.isObject3D) return a;
    throw new Error(`${g.name || 'prop'}.anchor("${name}"): no such anchor. Anchors: ${Object.keys(anchors).join(', ') || 'none'}`);
  };
  return g;
}
// Bounding sphere for cam.fit / cam.frame: userData.radius (world units, at the scale the prop is built) and
// userData.center (its centre in the prop's own space; standing props are not centred on their origin). Measured
// once, in the pose the prop is in when this runs.
export function measureBounds(g) {
  g.updateMatrixWorld(true);
  const s = new THREE.Box3().setFromObject(g).getBoundingSphere(new THREE.Sphere());
  g.userData.radius = s.radius;
  g.userData.center = g.worldToLocal(s.center.clone());
  return g;
}

// ---------- x-ray ----------
// See inside a prop: xray(object, v) turns its shell to glass. As v goes 0 -> 1 every mesh under `object` (or in a
// list of meshes) fades to `floor` of its opacity and stops writing depth past v 0.5, except what is under `keep`
// (an Object3D or a list): put the parts inside there (a board and a chip in a phone) and they stay solid. `screen`
// (a mesh) fades only to `screenFloor`, so a playing screen stays readable over the parts. Pure: call it every update
// with the v for this frame; at v = 0 every material is exactly as it was built. Materials change in place, so one
// shared with something outside `object` fades there too.
const XRAY = new WeakMap(); // material -> its own opacity, transparent and depthWrite
export function xray(object, v, { keep = null, floor = 0.14, screen = null, screenFloor = 0.45 } = {}) {
  v = Math.min(1, Math.max(0, v));
  const kept = new Set();
  for (const o of [keep].flat()) if (o?.isObject3D) o.traverse((c) => kept.add(c));
  const meshes = [];
  for (const o of [object].flat()) if (o?.isObject3D) o.traverse((c) => { if (c.material && !kept.has(c)) meshes.push(c); });
  for (const o of meshes) {
    const f = o === screen ? 1 - (1 - screenFloor) * v : 1 - (1 - floor) * v;
    for (const m of [o.material].flat()) {
      if (!m) continue;
      let s = XRAY.get(m);
      if (!s) XRAY.set(m, (s = { opacity: m.opacity, transparent: m.transparent, depthWrite: m.depthWrite }));
      const tr = v > 0 ? true : s.transparent;
      if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; } // 'opaque' is part of the shader program
      m.opacity = s.opacity * (v > 0 ? f : 1);
      m.depthWrite = s.depthWrite && v < 0.5;
    }
  }
}

// ---------- in-world text and signs ----------
// text3d('#0847', { size: 0.3 }) -> a plane with crisp text. bg/radius/pad make a tag or a scoreboard; glow > 0 makes
// it emissive (screens, LED boards). Height in world units = size; width follows the text.
export function text3d(text, { size = 0.3, font = 'Inter', weight = 800, color = '#ffffff', bg = null, pad = 0.35, radius = 0.25, glow = 0, px = 160, letterSpacing = -0.02, align = 'center', opacity = 1 } = {}) {
  const lines = String(text).split('\n');
  const c = document.createElement('canvas'), g = c.getContext('2d');
  const f = `${weight} ${px}px "${font}"`;
  g.font = f;
  const widths = lines.map((l) => g.measureText(l).width + Math.max(0, l.length - 1) * letterSpacing * px);
  const tw = Math.max(...widths), lh = px * 1.12, padPx = bg ? pad * px : px * 0.08;
  c.width = Math.ceil(tw + padPx * 2); c.height = Math.ceil(lh * lines.length + padPx * 2 - px * 0.12);
  g.font = f; g.textBaseline = 'middle'; g.letterSpacing = `${letterSpacing * px}px`;
  if (bg) { g.fillStyle = bg; const r = radius * px; g.beginPath(); g.roundRect(0, 0, c.width, c.height, r); g.fill(); }
  g.fillStyle = color; g.textAlign = align;
  lines.forEach((l, i) => g.fillText(l, align === 'center' ? c.width / 2 : align === 'right' ? c.width - padPx : padPx, padPx + lh * i + lh / 2 - px * 0.04));
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  const h = size * (c.height / px), w = h * (c.width / c.height);
  const m = glow > 0
    ? new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, color: new THREE.Color(1, 1, 1).multiplyScalar(glow), depthWrite: false, opacity })
    : new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.6, metalness: 0, depthWrite: false, opacity });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  mesh.userData.size = [w, h]; mesh.userData.radius = Math.hypot(w, h) / 2;
  mesh.setText = (t) => { const n = text3d(t, { size, font, weight, color, bg, pad, radius, glow, px, letterSpacing, align, opacity }); mesh.geometry.dispose(); mesh.geometry = n.geometry; m.map.dispose(); m.map = n.material.map; m.needsUpdate = true; mesh.userData.size = n.userData.size; mesh.userData.radius = n.userData.radius; };
  return mesh;
}

// An image on a plane (logos, photos, generated plates). width in world units; height follows the image.
// tonemap 'inverse': unlit, through the inverse of the film stage's AgX curve (as clipPlane and plate do), so after
// bloom, AgX and the grade the photo looks as it does in its file; glow is then a gain on that (1 = as in the file).
// Without it, glow > 0 sends the photo in as plain light x glow (AgX washes it out: flatter, paler) and glow 0 lights
// it like a print. look / highlights tune the inverse (default the palette's look, highlights 6).
export async function imagePlane(url, { width = 1, glow = 0, radius = 0, transparent = true, side = THREE.FrontSide, tonemap = 'none', look, highlights = 6 } = {}) {
  const tex = await loadTexture(url);
  const aspect = tex.image.width / tex.image.height;
  const geo = radius > 0 ? planarUV(new THREE.ShapeGeometry(roundedRect(width, width / aspect, radius), 12)) : new THREE.PlaneGeometry(width, width / aspect);
  let m;
  if (tonemap === 'inverse') {
    const { inverseToneLUT } = await import('./plates.js');
    const lut = inverseToneLUT({ look: look ?? theme.pal?.post?.look ?? 0.35, highlights }), N = lut.image.width;
    m = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, lut: { value: lut }, gain: { value: glow > 0 ? glow : 1 } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `precision highp float; precision highp sampler3D;
        uniform sampler2D map; uniform sampler3D lut; uniform float gain; varying vec2 vUv;
        vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
        void main(){ vec4 t = texture2D(map, vUv); vec3 s = clamp(toSRGB(clamp(t.rgb, 0., 1.)), 0., 1.);
          gl_FragColor = vec4(exp2(texture(lut, s * ${((N - 1) / N).toFixed(6)} + ${(0.5 / N).toFixed(6)}).rgb) * gain, t.a); }`,
      transparent, side, fog: false,
    });
    m.userData.setGain = (v) => { m.uniforms.gain.value = v; };
  } else m = glow > 0 ? new THREE.MeshBasicMaterial({ map: tex, transparent, toneMapped: false, color: new THREE.Color(1, 1, 1).multiplyScalar(glow), side }) : new THREE.MeshStandardMaterial({ map: tex, transparent, roughness: 0.55, side });
  const mesh = new THREE.Mesh(geo, m);
  mesh.userData.radius = Math.hypot(width, width / aspect) / 2;
  return mesh;
}

// ---------- phone ----------
// A modern flagship phone, screen facing +z, centred on itself. width in world units (height = 2.065 x width); like
// the devices it also takes perMetre (a real phone is 0.0715 m wide). The screen is off (black glass) until
// setScreen(texture) puts a k.screen() or image on it; setScreen(null) turns it off again.
// phone.setXray(v, o) turns the phone's own body to glass (xray above, the screen kept readable) and leaves anything
// you add to it solid: phone.add(board); phone.setXray(k.ramp(t, t0, t1)).
// Anchors: screen (centre of the display), camera (the rear camera block), faceId (the front sensors in the island).
export function phone(o = {}) {
  const { color = 'titanium', screen = null, glow = 1.15 } = o;
  const perMetre = o.perMetre ?? (o.width ?? 1) / 0.0715;
  const w = 0.0715 * perMetre, h = w * 2.065, d = w * 0.118, r = w * 0.17;
  const g = new THREE.Group(); g.name = 'phone';
  const body = new THREE.ExtrudeGeometry(roundedRect(w, h, r), { depth: d * 0.6, bevelEnabled: true, bevelThickness: d * 0.2, bevelSize: d * 0.2, bevelSegments: 6, curveSegments: 24 });
  body.translate(0, 0, -d * 0.3);
  const frameCol = { titanium: '#8f9194', black: '#2a2b2e', silver: '#d9dadc', gold: '#d8c3a5', blue: '#3c4a5e' }[color] || color;
  const frame = new THREE.Mesh(body, mat.brushed(frameCol, { rough: 0.32 }));
  frame.castShadow = frame.receiveShadow = true; g.add(frame);
  // back glass
  const back = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(w * 0.985, h * 0.992, r * 0.97), 24), mat.plastic(frameCol === '#2a2b2e' ? '#1b1c1f' : '#5f6266', { rough: 0.42, clearcoat: 0.8 }));
  back.position.z = -d * 0.51; back.rotation.y = Math.PI; g.add(back);
  // camera plateau
  const cam = new THREE.Group(); cam.position.set(-w * 0.24, h * 0.36, -d * 0.53); g.add(cam);
  const plate = new THREE.Mesh(new RoundedBoxGeometry(w * 0.42, w * 0.42, d * 0.12, 4, w * 0.08), mat.plastic('#3a3c40', { rough: 0.3, clearcoat: 1 })); cam.add(plate);
  [[-0.1, 0.1], [-0.1, -0.1], [0.1, 0]].forEach(([x, y]) => {
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.075, w * 0.08, d * 0.25, 40), mat.metal('#2b2d31', { rough: 0.2 }));
    lens.rotation.x = Math.PI / 2; lens.position.set(x * w, y * w, -d * 0.12); cam.add(lens);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(w * 0.055, 40), mat.glass({ color: '#0a0c12', rough: 0.02 }));
    glass.position.set(x * w, y * w, -d * 0.26); glass.rotation.y = Math.PI; cam.add(glass);
  });
  // screen: black glass with the display under it
  const bezel = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(w * 0.985, h * 0.992, r * 0.97), 24), mat.plastic('#030304', { rough: 0.08, clearcoat: 1, ccRough: 0.03 }));
  bezel.position.z = d * 0.505; g.add(bezel);
  const sw = w * 0.925, sh = h * 0.964;
  const screenGeo = planarUV(new THREE.ShapeGeometry(roundedRect(sw, sh, r * 0.82), 24));
  const screenMat = new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.1, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, emissive: 0x000000, emissiveIntensity: glow, emissiveMap: null });
  const scr = new THREE.Mesh(screenGeo, screenMat); scr.position.z = d * 0.51; g.add(scr);
  // dynamic island
  const islandY = sh / 2 - w * 0.075;
  const island = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(w * 0.3, w * 0.085, w * 0.0425), 16), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  island.position.set(0, islandY, d * 0.512); g.add(island);
  const pin = (name, x, y, z) => { const a = new THREE.Object3D(); a.name = name; a.position.set(x, y, z); g.add(a); return a; };
  withAnchors(g, { screen: pin('screen', 0, 0, d * 0.52), camera: pin('camera', -w * 0.24, h * 0.36, -d * 0.8), faceId: pin('faceId', 0, islandY, d * 0.53) });
  g.userData = { width: w, height: h, depth: d, screenSize: [sw, sh], perMetre, size: [w, h, d], radius: Math.hypot(w, h, d) / 2, center: new THREE.Vector3() };
  g.screen = scr;
  g.setScreen = (tex) => { screenMat.emissiveMap = tex || null; screenMat.emissive.set(tex ? 0xffffff : 0x000000); screenMat.needsUpdate = true; };
  g.setGlow = (v) => { screenMat.emissiveIntensity = v; };
  const own = []; g.traverse((o) => { if (o.material) own.push(o); }); // the phone's own parts: what setXray fades
  g.setXray = (v, o = {}) => xray(own, v, { screen: scr, ...o });
  if (screen) g.setScreen(screen);
  return g;
}

// ---------- globe ----------
// Earth with day/night, city lights, clouds and an atmosphere rim. Lit by its own sun direction (sun: [x,y,z]).
// globe.latLon(lat, lon, alt) -> local position on the surface; use globe.localToWorld for world space.
export async function globe({ radius = 1, sun = [1, 0.25, 0.6], night = 1.0, clouds = 0.9, atmosphere = 1.0, rimColor = '#5ba8ff', segments = 128, dayBoost = 1.0, lights = 1.0, earthshine = 0.06 } = {}) {
  const [day, nightT, brc] = await Promise.all([
    loadTexture(kitURL('textures/earth/earth_day_4096.jpg')),
    loadTexture(kitURL('textures/earth/earth_night_4096.jpg')),
    loadTexture(kitURL('textures/earth/earth_bump_roughness_clouds_4096.jpg'), { srgb: false }),
  ]);
  const g = new THREE.Group();
  const sunDir = new THREE.Vector3(...sun).normalize();
  const u = { day: { value: day }, night: { value: nightT }, brc: { value: brc }, sun: { value: sunDir }, nightK: { value: night }, cloudsK: { value: clouds }, dayK: { value: dayBoost }, lightsK: { value: lights }, shineK: { value: earthshine }, rim: { value: C(rimColor) }, atm: { value: atmosphere } };
  const surface = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vW; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform sampler2D day, night, brc; uniform vec3 sun, rim; uniform float nightK, cloudsK, dayK, lightsK, shineK, atm; varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
      void main(){
        vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW); float sd = dot(N, sun);
        float dayMix = smoothstep(-0.18, 0.28, sd);
        vec4 b = texture2D(brc, vUv); float cloud = smoothstep(0.15, 0.9, b.b) * cloudsK;
        vec3 d = texture2D(day, vUv).rgb * dayK; vec3 n = texture2D(night, vUv).rgb;
        vec3 dayCol = mix(d, vec3(1.0), cloud * 0.9) * (0.08 + 0.92 * max(sd, 0.0));
        vec3 nightCol = n * 3.2 * lightsK * (1.0 - cloud * 0.7) * nightK;
        // earthshine: the night side keeps a faint, cool copy of the day side's albedo (clouds included), brightest
        // facing the camera, so with lights: 0 the planet still reads as a ball and never as a hole
        nightCol += mix(d, vec3(1.0), cloud * 0.9) * shineK * vec3(0.72, 0.84, 1.0) * (0.35 + 0.65 * max(dot(N, V), 0.0));
        // ocean glint
        float ocean = 1.0 - smoothstep(0.2, 0.4, b.g);
        vec3 H = normalize(sun + V); float spec = pow(max(dot(N, H), 0.0), 60.0) * ocean * 0.8 * dayMix;
        vec3 col = mix(nightCol, dayCol, dayMix) + spec * vec3(1.0, 0.95, 0.85);
        // atmosphere: thin blue at the limb, warm on the terminator
        float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        col += rim * fres * (0.25 + 0.75 * smoothstep(-0.3, 0.6, sd)) * 1.6 * atm;
        // a faint warm band only right at the limb on the terminator (sunset seen from orbit)
        col += vec3(1.0, 0.5, 0.25) * pow(1.0 - abs(sd), 24.0) * fres * 0.6 * atm;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(radius, segments, segments / 2), surface);
  g.add(ball);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.045, 96, 48), new THREE.ShaderMaterial({
    uniforms: { rim: u.rim, sun: u.sun, atm: u.atm }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
    vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 rim, sun; uniform float atm; varying vec3 vN; varying vec3 vW; void main(){ vec3 V = normalize(cameraPosition - vW); float f = pow(max(0.0, 1.0 - abs(dot(normalize(vN), V)) * 1.05), 6.0); float lit = 0.3 + 0.7 * smoothstep(-0.4, 0.6, dot(normalize(vN), sun)); gl_FragColor = vec4(rim * f * lit * 2.2 * atm, f); }`,
  }));
  g.add(halo);
  g.name = 'globe';
  g.userData.radius = radius;
  g.surface = ball;
  g.latLon = (lat, lon, alt = 0) => {
    const phi = THREE.MathUtils.degToRad(90 - lat), th = THREE.MathUtils.degToRad(lon + 180);
    const R = radius * (1 + alt);
    return new THREE.Vector3(-R * Math.sin(phi) * Math.cos(th), R * Math.cos(phi), R * Math.sin(phi) * Math.sin(th));
  };
  // pin(lat, lon, alt, name) -> an Object3D on the surface that turns with the globe; named pins join the anchors
  g.pin = (lat, lon, alt = 0.004, name = null) => { const a = new THREE.Object3D(); a.position.copy(g.latLon(lat, lon, alt)); g.add(a); if (name) { a.name = name; g.anchors[name] = a; } return a; };
  withAnchors(g, {});
  g.pin(90, 0, 0.004, 'north'); g.pin(-90, 0, 0.004, 'south');
  for (const [name, [lat, lon]] of Object.entries(CITIES)) g.pin(lat, lon, 0.004, name);
  g.setSun = (v) => { u.sun.value.set(...v).normalize(); };
  g.setEarthshine = (v) => { u.shineK.value = v; }; // the night side's faint fill (pure)
  g.setLights = (v) => { u.lightsK.value = v; }; // the night side's city lights, 0 to 1 and up (pure): cities that light on a word
  // globe.lightDots(count, o): receivers, people or devices as glowing dots where the city lights are (sampled from the
  // night texture: brighter places get more, at an even density per area), just above the surface, turning with the
  // globe. dots.reveal(t, { from, t0, speed }) lights them in a wave spreading from `from` (a local point such as
  // globe.latLon(lat, lon), or [lat, lon]) at `speed` radians a second from t0 (unrevealed they are all on);
  // dots.ping(v) swells and brightens them; dots.setGain(v). size: a dot's diameter in world units.
  let nightPx = null;
  g.lightDots = (count = 3500, { threshold = 0.3, size = null, color = '#ffe8c6', intensity = 1, seed = 3, alt = 0.004 } = {}) => {
    if (!nightPx) { const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const x = c.getContext('2d'); x.drawImage(nightT.image, 0, 0, 1024, 512); nightPx = x.getImageData(0, 0, 1024, 512).data; }
    const R = rng(seed), pos = [], rnd = [];
    for (let tries = 0; pos.length / 3 < count && tries < count * 400; tries++) {
      const x = Math.floor(R() * 1024), y = Math.floor(R() * 512), i = (y * 1024 + x) * 4;
      const l = (nightPx[i] * 0.3 + nightPx[i + 1] * 0.59 + nightPx[i + 2] * 0.11) / 255, lat = 90 - ((y + R()) / 512) * 180;
      if (l < threshold * (0.6 + R() * 0.8) || R() > Math.cos(THREE.MathUtils.degToRad(lat))) continue; // the map's rows crowd towards the poles
      const p = g.latLon(lat, ((x + R()) / 1024) * 360 - 180, alt); pos.push(p.x, p.y, p.z); rnd.push(R());
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aRnd', new THREE.Float32BufferAttribute(rnd, 1));
    const U = { uColor: { value: C(color) }, uSize: { value: size ?? radius * 0.003 }, uRes: { value: 1 }, uTime: { value: 0 }, uFrom: { value: new THREE.Vector3(0, 1, 0) }, uT0: { value: -1e9 }, uSpeed: { value: 1e9 }, uPing: { value: 0 }, uGain: { value: intensity } };
    const m = new THREE.ShaderMaterial({
      uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      // uRes (set by the engine to render height / 1920) keeps the dots one size at any render scale
      vertexShader: `uniform float uSize, uRes, uTime, uT0, uSpeed, uPing; uniform vec3 uFrom; attribute float aRnd; varying float vA;
        void main(){
          float ang = acos(clamp(dot(normalize(position), normalize(uFrom)), -1., 1.)); // angular distance from the source
          vA = smoothstep(0., .18, uTime - uT0 - ang / uSpeed - aRnd * .25) * (.55 + .45 * aRnd) * (1. + uPing);
          vec4 mv = modelViewMatrix * vec4(position, 1.);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(uSize * projectionMatrix[1][1] * 960. * uRes / -mv.z * (.7 + .6 * aRnd) * (1. + .6 * uPing), 1., 16. * uRes);
        }`,
      fragmentShader: `uniform vec3 uColor; uniform float uGain; varying float vA;
        void main(){ vec2 d = gl_PointCoord - .5; float r = length(d) * 2.; float a = exp(-r * r * 5.) * vA; if (a < .004) discard; gl_FragColor = vec4(uColor * a * uGain, 1.); }`,
    });
    const pts = new THREE.Points(geo, m); pts.frustumCulled = false; pts.renderOrder = 3; pts.name = 'lightDots';
    g.add(pts);
    pts.reveal = (t, { from = null, t0 = 0, speed = 1.2 } = {}) => {
      U.uTime.value = t; U.uT0.value = t0; U.uSpeed.value = speed;
      if (from) U.uFrom.value.copy(Array.isArray(from) && from.length === 2 ? g.latLon(from[0], from[1]) : from.isVector3 ? from : new THREE.Vector3(...from));
    };
    pts.ping = (v) => { U.uPing.value = v; };
    pts.setGain = (v) => { U.uGain.value = v; };
    pts.count = pos.length / 3;
    return pts;
  };
  return g;
}

// A few city coordinates for globe shots (lat, lon).
export const CITIES = {
  'Los Angeles': [34.05, -118.24], 'San Francisco': [37.77, -122.42], 'New York': [40.71, -74.0], 'London': [51.51, -0.13], 'Paris': [48.86, 2.35],
  'Shanghai': [31.23, 121.47], 'Tokyo': [35.68, 139.69], 'Seoul': [37.57, 126.98], 'Singapore': [1.35, 103.82], 'Sydney': [-33.87, 151.21],
  'Mumbai': [19.08, 72.88], 'Dubai': [25.2, 55.27], 'Sao Paulo': [-23.55, -46.63], 'Toronto': [43.65, -79.38], 'Berlin': [52.52, 13.4],
  'Vandenberg': [34.74, -120.57], 'Ireland': [53.35, -6.26], 'Newfoundland': [47.56, -52.71], 'Hong Kong': [22.32, 114.17], 'Lagos': [6.52, 3.38],
};
