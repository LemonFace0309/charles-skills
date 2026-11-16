// Light as information: glowing tubes that draw on, pulses that travel along them, arrows, rings, arcs, waves, function
// plots, dimension lines, logic-gate symbols, SVG strokes, expanding wavefronts, field vectors and a sweeping sheet of
// light. Emissive colours above 1.0 are HDR, so the film stage blooms them; a white-hot core inside a coloured sheath
// is what makes a line read as light rather than paint. Colours default to the video's accent.
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { clamp, lerp, smooth } from './util.js';
import { accentDefault, mat } from './look.js';

const C = (c) => (c && c.isColor ? c.clone() : new THREE.Color(c));
const V = (a) => (a && a.isVector3 ? a.clone() : new THREE.Vector3(...a));
const Y = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;
// the prop contract's named anchors (props/base.js withAnchors), for the glow pieces that have parts worth pointing at
const anchored = (g, anchors) => {
  g.anchors = anchors;
  g.anchor = (n) => { if (anchors[n]?.isObject3D) return anchors[n]; throw new Error(`${g.name || 'glow'}.anchor("${n}"): no such anchor. Anchors: ${Object.keys(anchors).join(', ') || 'none'}`); };
  return g;
};
export const hot = (color, intensity = 4) => C(color).multiplyScalar(intensity);
// a colour mixed towards white by k, in sRGB (lighten('#ffb43c', 0.4) = '#ffd28a')
const lighten = (c, k) => { const s = C(c).getRGB({ r: 0, g: 0, b: 0 }, THREE.SRGBColorSpace); return new THREE.Color().setRGB(lerp(s.r, 1, k), lerp(s.g, 1, k), lerp(s.b, 1, k), THREE.SRGBColorSpace); };
const basic = (color, intensity, o = {}) => new THREE.MeshBasicMaterial({ color: hot(color, intensity), toneMapped: false, transparent: o.opacity != null && o.opacity < 1, opacity: o.opacity ?? 1, blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !o.additive, fog: o.fog ?? false });
// Unlit HDR colour whose faces turned to the camera run into a core colour: the middle of a tube's silhouette goes
// white-hot inside the coloured sheath, in one opaque mesh (a separate core tube inside an opaque sheath never shows).
function glowMat(color, intensity, o = {}) {
  const m = basic(color, intensity, o);
  if (!o.core) return m;
  const uCore = { value: hot(o.core, o.coreIntensity ?? intensity * 1.6) };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uCore = uCore;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGN; varying vec3 vGV;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvGN = normalize(normalMatrix * normal); vGV = -mvPosition.xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uCore; varying vec3 vGN; varying vec3 vGV;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, uCore, smoothstep(.78, .97, abs(dot(normalize(vGN), normalize(vGV)))));');
  };
  m.customProgramCacheKey = () => 'glow-core';
  m.userData.core = uCore;
  return m;
}

// A tube along a curve that can draw itself on: tube.draw(0..1) or tube.window(from, to) for a moving segment.
// coreColor defaults to the colour taken nearly to white (the amber accent gives '#fff5e1').
export function tube(curve, { radius = 0.02, color = accentDefault(), intensity = 4, segments = 240, radial = 10, core = true, coreColor = null, coreIntensity = null, opacity, additive = false, fog = false } = {}) {
  coreColor = coreColor ?? lighten(color, 0.85);
  const g = new THREE.Group();
  const geo = new THREE.TubeGeometry(curve, segments, radius, radial, false);
  const sheath = new THREE.Mesh(geo, glowMat(color, intensity, { opacity, additive, fog, core: core ? coreColor : null, coreIntensity }));
  g.add(sheath);
  const per = radial * 6;
  const setRange = (a, b) => {
    a = clamp(a); b = clamp(b);
    const s = Math.floor(a * segments), e = Math.ceil(b * segments);
    sheath.geometry.setDrawRange(s * per, Math.max(0, e - s) * per);
    g.visible = e > s;
  };
  g.userData = { curve, sheath };
  g.draw = (p) => setRange(0, p);
  g.window = (a, b) => setRange(a, b);
  // at intensity 0 the opaque sheath would be a black tube in front of the scene: it is hidden instead
  g.setIntensity = (i, ci) => { sheath.material.color.copy(hot(color, i)); sheath.material.visible = i > 1e-4; if (core) sheath.material.userData.core.value.copy(hot(coreColor, ci ?? i * 1.6)); };
  g.setColor = (c, i = intensity) => { color = c; sheath.material.color.copy(hot(c, i)); sheath.material.visible = i > 1e-4; };
  return g;
}

// A screen-crisp line (constant width in world units) for line art: circuit symbols, outlines, grids, dimension lines.
export function line(points, { width = 0.02, color = accentDefault(), intensity = 3, dashed = false, opacity = 1, worldUnits = true } = {}) {
  const pos = points.flatMap((p) => (p.isVector3 ? [p.x, p.y, p.z] : p));
  const geo = new LineGeometry(); geo.setPositions(pos);
  const m = new LineMaterial({ color: hot(color, intensity), linewidth: width, worldUnits, dashed, transparent: opacity < 1, opacity, toneMapped: false, alphaToCoverage: false });
  m.resolution.set(1080, 1920);
  const l = new Line2(geo, m); l.computeLineDistances();
  const n = points.length - 1;
  l.draw = (p) => { geo.instanceCount = Math.max(0, Math.round(clamp(p) * n)); l.visible = geo.instanceCount > 0; };
  l.setIntensity = (i) => { m.color.copy(hot(color, i)); m.visible = i > 1e-4; }; // 0 hides it (never a black line)
  return l;
}

// A curve moved `lift` along `up` (made square to the curve's tangent at every point): the line along the top of a
// tube that runs along the original curve.
class Lifted extends THREE.Curve {
  constructor(c, lift, up) {
    super(); this.c = c; this.lift = lift; this.up = V(up).normalize(); this.T = new THREE.Vector3(); this.N = new THREE.Vector3();
    this.arcLengthDivisions = Math.max(200, c.arcLengthDivisions || 0);
  }
  getPoint(t, out = new THREE.Vector3()) {
    this.c.getPoint(t, out); this.c.getTangent(t, this.T).normalize();
    this.N.copy(this.up).addScaledVector(this.T, -this.up.dot(this.T));
    if (this.N.lengthSq() < 1e-6) this.N.crossVectors(this.T, Math.abs(this.T.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1)); // up along the curve: any side
    return out.addScaledVector(this.N.normalize(), this.lift);
  }
}

// The pulse's halo: a camera-facing glow like fx.glowSprite, but drawn `pull` world units nearer the camera (and shrunk
// to keep its size on screen), so the floor or the tube under the head does not slice it off in a hard line.
function halo(color, intensity, size, pull) {
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uColor: { value: C(color) }, uI: { value: intensity }, uPull: { value: pull } },
    vertexShader: `uniform float uPull; varying vec2 vUv;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(0., 0., 0., 1.); float d = max(-mv.z, 1e-4), k = (d - min(uPull, d * .5)) / d;
        mv.xyz *= k; mv.xy += position.xy * vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz)) * k; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uI; varying vec2 vUv; void main(){ float r = length(vUv - .5) * 2.; float a = exp(-r * r * 4.) * (1. - smoothstep(.9, 1., r)); gl_FragColor = vec4(uColor * uI * a, a); }`,
  });
  const s = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m); s.scale.setScalar(size);
  s.setIntensity = (i) => { m.uniforms.uI.value = i; };
  return s;
}

// A bright head travelling along a curve, with an optional fading tail. Motion blur makes it streak by itself.
// pulse.place(u) puts it at arc-length fraction u (0..1; hidden outside), so pass a fraction, not a time:
// pulse.place(k.ramp(t, t0, t1, 'linear')), or for a loop pulse.place((t * speed) % 1). fade > 0 dims it in over the
// first `fade` of the curve and out over the last, so a loop never jumps from the end back to the start.
// Its halo is drawn nearer the camera than the head, so the floor or the cable under it does not slice it off in a hard
// line (from a camera within about 20 degrees of the floor a soft edge can remain in the halo's dim outer part).
// lift: a pulse on the centre line of an opaque tube (a cable, a wire) is hidden inside it and shows only its halo, a
// ring around the tube; lift moves the head and tail that far along `up` (world units, square to the curve), so set it
// to the tube's radius and the head rides on the tube's top with its core showing. pulse.curve is the curve it rides.
export function pulse(curve, { size = 0.06, color = null, intensity = 14, tail = 0.08, tailRadius = null, tailLength = null, segments = 240, fade = 0, fadeIn = null, fadeOut = null, lift = 0, up = [0, 1, 0] } = {}) {
  color = color ?? lighten(accentDefault(), 0.4);
  if (lift) curve = new Lifted(curve, lift, up);
  const g = new THREE.Group();
  g.curve = curve;
  const head = new THREE.Mesh(new THREE.SphereGeometry(size, 20, 14), basic('#ffffff', intensity));
  const glow = halo(color, intensity * 0.09, size * 9, size * 4.5);
  g.add(head, glow);
  // the tail: a fraction of the curve (tail), or a length in world units (tailLength) whatever the curve's length (on
  // a 144-unit cable the default 0.08 was an 11-unit bar)
  const tailU = tailLength != null ? tailLength / Math.max(1e-9, curve.getLength()) : tail;
  let tailTube = null;
  // a pulse that fades gets an additive tail: an opaque one dimmed to brown lay over its line as a dull bar
  const fades = (fade || fadeIn || fadeOut) > 0;
  if (tailU > 0) { tailTube = tube(curve, { radius: tailRadius ?? size * 0.45, color, intensity: intensity * 0.35, segments: tailLength != null ? Math.max(segments, Math.min(4000, Math.ceil(segments * 0.08 / Math.max(1e-6, tailU)))) : segments, core: false, additive: fades }); g.add(tailTube); }
  g.tailU = tailU;
  g.place = (u) => {
    const v = clamp(u);
    const p = curve.getPointAt(v);
    head.position.copy(p); glow.position.copy(p);
    if (tailTube) tailTube.window(Math.max(0, v - tailU), v);
    const fi = fadeIn ?? fade, fo = fadeOut ?? fade;
    const f = (fi > 0 ? smooth(clamp(v / fi)) : 1) * (fo > 0 ? smooth(clamp((1 - v) / fo)) : 1);
    // the head shrinks as it fades: an opaque head dimmed to grey read as a solid grey ball over the line (svgPath's
    // rune popped at the end of each stroke)
    head.scale.setScalar(Math.max(1e-3, Math.sqrt(f)));
    head.material.color.copy(hot('#ffffff', intensity * f)); glow.setIntensity(intensity * 0.09 * f);
    if (tailTube) tailTube.setIntensity(intensity * 0.35 * f);
    g.visible = u >= 0 && u <= 1.0001 && f > 0.001;
  };
  let warned = false;
  g.at = (u) => { if (u > 1.5 && !warned) { warned = true; console.warn(`pulse.at(${u}): takes a fraction of the curve (0..1), not a time; use pulse.place(u)`); } g.place(u); };
  return g;
}

// A curve that is the stretch u0..u1 (arc-length fractions) of another.
class Part extends THREE.Curve {
  constructor(c, u0, u1) { super(); this.c = c; this.u0 = u0; this.u1 = u1; }
  getPoint(t, out = new THREE.Vector3()) { return this.c.getPointAt(lerp(this.u0, this.u1, t), out); }
}

// An arrow from `from` to `to` that draws itself on: arrow.draw(p) grows the shaft and carries the cone head at its
// tip, landing on `to` at p = 1. bend lifts the middle by that fraction of the length towards `normal` (a curved
// arrow); curve: any Curve3 instead (it points along the curve's end). head / headRadius size the cone.
export function arrow(from, to, { radius = 0.02, color = accentDefault(), intensity = 4, head = null, headRadius = null, bend = 0, normal = [0, 1, 0], curve = null, segments = 160, core = true, coreColor = null, opacity, fog = false } = {}) {
  coreColor = coreColor ?? lighten(color, 0.85);
  const A = V(from), B = V(to), hl = head ?? radius * 7, hr = headRadius ?? radius * 2.8;
  let path = curve;
  if (!path) path = bend ? new THREE.QuadraticBezierCurve3(A, A.clone().add(B).multiplyScalar(0.5).addScaledVector(V(normal).normalize(), A.distanceTo(B) * bend), B) : new THREE.LineCurve3(A, B);
  const uEnd = clamp(1 - hl / path.getLength(), 0.02, 1); // the shaft stops where the head starts
  const g = new THREE.Group();
  const shaft = tube(new Part(path, 0, uEnd), { radius, color, intensity, segments, core, coreColor, opacity, fog });
  const tip = new THREE.Mesh(new THREE.ConeGeometry(hr, hl, 32, 1).translate(0, hl / 2, 0), glowMat(color, intensity, { opacity, fog, core: core ? coreColor : null }));
  g.add(shaft, tip);
  const P = new THREE.Vector3(), T = new THREE.Vector3();
  g.draw = (p) => {
    p = clamp(p); shaft.draw(p);
    path.getPointAt(p * uEnd, P); path.getTangentAt(p * uEnd, T);
    tip.position.copy(P); tip.quaternion.setFromUnitVectors(Y, T.normalize());
    tip.scale.setScalar(Math.max(1e-4, smooth(clamp(p / 0.12)))); tip.visible = p > 0.001;
  };
  g.setIntensity = (i) => { shaft.setIntensity(i); tip.material.color.copy(hot(color, i)); tip.material.visible = i > 1e-4; if (core) tip.material.userData.core.value.copy(hot(coreColor, i * 1.6)); };
  g.curve = path; g.shaft = shaft; g.head = tip;
  g.draw(1);
  return g;
}

// A circle in a plane (normal = axis), drawn as a tube so it can draw on from an angle.
export function ring(radius = 1, { axis = [0, 1, 0], center = [0, 0, 0], tubeRadius = 0.012, color = accentDefault(), intensity = 3, segments = 256, core = true, start = 0 } = {}) {
  const n = new THREE.Vector3(...axis).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  const pts = [];
  for (let i = 0; i <= segments; i++) { const a = start + (i / segments) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0).applyQuaternion(q).add(new THREE.Vector3(...center))); }
  const curve = new THREE.CatmullRomCurve3(pts, true);
  return tube(curve, { radius: tubeRadius, color, intensity, segments, core });
}

// An arc between two points that lifts off the surface (height as a fraction of the chord), or a great-circle arc
// over a sphere when `sphere` = { center, radius, lift }.
export function arcCurve(a, b, { height = 0.3, sphere = null, samples = 64 } = {}) {
  const A = new THREE.Vector3(...(a.isVector3 ? a.toArray() : a)), B = new THREE.Vector3(...(b.isVector3 ? b.toArray() : b));
  if (sphere) {
    const c = new THREE.Vector3(...(sphere.center || [0, 0, 0])), R = sphere.radius;
    const ua = A.clone().sub(c).normalize(), ub = B.clone().sub(c).normalize();
    const ang = ua.angleTo(ub);
    const pts = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const s = Math.sin(ang) || 1e-6;
      const dir = ua.clone().multiplyScalar(Math.sin((1 - t) * ang) / s).add(ub.clone().multiplyScalar(Math.sin(t * ang) / s)).normalize();
      const lift = (sphere.lift ?? 0.15) * Math.sin(Math.PI * t) * (ang / Math.PI + 0.25);
      pts.push(c.clone().add(dir.multiplyScalar(R * (1 + lift))));
    }
    return new THREE.CatmullRomCurve3(pts);
  }
  const mid = A.clone().add(B).multiplyScalar(0.5);
  mid.y += A.distanceTo(B) * height;
  return new THREE.QuadraticBezierCurve3(A, mid, B);
}

// A wave along a line, as a glowing tube you re-shape every frame. wave.set({ phase, amp, wavelength, length, from,
// to, envelope, fn }) rebuilds it from the construction options plus what you pass, so a field you leave out goes back
// to its default (each call stands alone; pass every field that changes, each update). envelope: (u) => k scales the
// height along it (u 0..1). fn: (x, u) => y draws any curve instead of the sine (x in world units from the middle;
// e.g. the sum of two waves), still under the envelope. colors: [c0, c1, ...] spread evenly along the wave (u 0..1),
// or (u) => colour, instead of one colour (a spectrum, or a 1 amber and a 0 blue on one wave); the core stays white.
// wave.setColor(c, intensity?) changes the colour; setIntensity(0) hides it (never a black tube).
export function wave({ length = 4, amp = 0.25, wavelength = 1, radius = 0.018, color = accentDefault(), intensity = 4, segments = 300, radial = 8, axis = 'x', plane = 'y', core = true, coreColor = null, envelope = null, fn = null, colors = null } = {}) {
  const g = new THREE.Group();
  const stops = Array.isArray(colors) ? colors.map(C) : null;
  const colorAt = !colors ? null : typeof colors === 'function' ? (u) => C(colors(u)) : (u) => {
    if (stops.length === 1) return stops[0].clone();
    const x = clamp(u) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x));
    return stops[i].clone().lerp(stops[i + 1], x - i);
  };
  if (colorAt) color = '#ffffff';                     // the vertex colours carry the hue; the material carries intensity
  const coreC = coreColor ?? lighten(color, 0.85);
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array((segments + 1) * radial * 3), nor = new Float32Array(pos.length), idx = [];
  for (let j = 0; j < segments; j++) for (let i = 0; i < radial; i++) {
    const a = j * radial + i, b = (j + 1) * radial + i, c = (j + 1) * radial + ((i + 1) % radial), d = j * radial + ((i + 1) % radial);
    idx.push(a, b, d, b, c, d);
  }
  geo.setIndex(idx); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  const col = colorAt ? new Float32Array(pos.length) : null;
  if (col) geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(geo, glowMat(color, intensity, { core: core ? coreC : null })); mesh.frustumCulled = false; g.add(mesh);
  if (col) mesh.material.vertexColors = true;
  const defaults = { phase: 0, amp, wavelength, length, from: 0, to: 1, envelope, fn };
  const cs = Array.from({ length: radial }, (_, i) => [Math.cos((i / radial) * Math.PI * 2), Math.sin((i / radial) * Math.PI * 2)]);
  const fill = (st) => {
    const k = (Math.PI * 2) / st.wavelength, h = st.length * 1e-3;
    for (let j = 0; j <= segments; j++) {
      const u = st.from + (st.to - st.from) * (j / segments), x = (u - 0.5) * st.length, env = st.envelope ? st.envelope(u) : 1;
      let y, dy;
      if (st.fn) { y = st.fn(x, u) * env; dy = ((st.fn(x + h, u) - st.fn(x - h, u)) / (2 * h)) * env; }
      else { y = Math.sin(k * x - st.phase) * st.amp * env; dy = Math.cos(k * x - st.phase) * st.amp * env * k; }
      const tl = Math.hypot(1, dy), nx = -dy / tl, ny = 1 / tl; // in-plane normal; the other axis is +z
      if (col) { const cc = colorAt(u); for (let i = 0; i < radial; i++) { const o = (j * radial + i) * 3; col[o] = cc.r; col[o + 1] = cc.g; col[o + 2] = cc.b; } }
      for (let i = 0; i < radial; i++) {
        const [c, s] = cs[i], o = (j * radial + i) * 3;
        nor[o] = nx * c; nor[o + 1] = ny * c; nor[o + 2] = s;
        pos[o] = x + nor[o] * radius; pos[o + 1] = y + nor[o + 1] * radius; pos[o + 2] = nor[o + 2] * radius;
      }
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.normal.needsUpdate = true;
    if (col) geo.attributes.color.needsUpdate = true;
  };
  g.set = (o = {}) => fill({ ...defaults, ...o });
  let level = intensity;
  g.setIntensity = (i) => { level = i; mesh.material.color.copy(hot(color, i)); mesh.material.visible = i > 1e-4; if (core) mesh.material.userData.core.value.copy(hot(coreC, i * 1.6)); };
  g.setColor = (c, i = level) => { color = c; level = i; mesh.material.color.copy(hot(c, i)); mesh.material.visible = i > 1e-4; if (core && !coreColor) mesh.material.userData.core.value.copy(hot(lighten(c, 0.85), i * 1.6)); };
  g.set();
  if (axis === 'y') g.rotation.z = Math.PI / 2; else if (axis === 'z') g.rotation.y = -Math.PI / 2;
  if (plane === 'z') g.rotation.x = Math.PI / 2;
  return g;
}

// "Nice" tick values (1, 2, 2.5 or 5 times a power of ten) across a range, about n of them, without 0 (the axis).
function niceTicks(a, b, n) {
  const raw = Math.abs(b - a) / Math.max(1, n), p = Math.pow(10, Math.floor(Math.log10(raw))), step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw * 0.999);
  const out = [];
  for (let v = Math.ceil(Math.min(a, b) / step) * step; v <= Math.max(a, b) + step * 1e-6; v += step) if (Math.abs(v) > step * 1e-6) out.push(+v.toFixed(10));
  return out;
}

// A function graph: y = fn(x) for x in x0..x1 as a glowing line over thin axes, in the group's XY plane (facing +z),
// centred on the origin, width x height world units. y0 / y1 default to fn's range (padded); values outside clamp.
// plot.draw(p) traces the graph on (arc length, like a pen), plot.axes.draw(p) the axes; plot.curve is the graph as
// a Curve3 in the plot's space (add a glow.pulse to the plot to run one along it); plot.point(x) and
// plot.toLocal(x, y) give points in the plot's space; plot.ticks.x / .y = [{ value, anchor }] for k.ui labels.
// ticks: about that many per axis, or { x: [values], y: [values] }; 0 hides them. arrows: heads on the axes.
export function plot(fn, { x0 = -1, x1 = 1, y0 = null, y1 = null, width = 2.4, height = 1.4, samples = 240, radius = 0.014, color = accentDefault(), intensity = 4, core = true, axes = true, axisColor = '#ffffff', axisIntensity = 1.2, axisWidth = 0.007, ticks = 5, tickSize = 0.035, arrows = true } = {}) {
  if (y0 == null || y1 == null) {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i <= samples; i++) { const y = fn(lerp(x0, x1, i / samples)); if (Number.isFinite(y)) { lo = Math.min(lo, y); hi = Math.max(hi, y); } }
    if (!(hi > lo)) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.1;
    y0 = y0 ?? Math.min(lo - pad, 0); y1 = y1 ?? Math.max(hi + pad, 0);
  }
  const X = (x) => ((x - x0) / (x1 - x0) - 0.5) * width, Yv = (y) => ((clamp(y, y0, y1) - y0) / (y1 - y0) - 0.5) * height;
  const g = new THREE.Group();
  g.toLocal = (x, y, out = new THREE.Vector3()) => out.set(X(x), Yv(y), 0);
  g.point = (x, out) => g.toLocal(x, fn(x), out);
  const curve = new (class extends THREE.Curve { getPoint(t, out = new THREE.Vector3()) { return g.point(lerp(x0, x1, t), out); } })();
  curve.arcLengthDivisions = samples * 2;
  const graph = tube(curve, { radius, color, intensity, segments: samples, core });
  g.add(graph);
  // axes through the origin (or along the edge the origin is beyond)
  const ax = new THREE.Group(), ox = X(clamp(0, Math.min(x0, x1), Math.max(x0, x1))), oy = Yv(0), parts = [];
  if (axes) {
    const r = axisWidth / 2, hl = axisWidth * 6;
    const axis = (a, b) => { const t = tube(new THREE.LineCurve3(a, b), { radius: r, color: axisColor, intensity: axisIntensity, segments: 64, radial: 6, core: false }); ax.add(t); return t; };
    const xa = axis(new THREE.Vector3(-width / 2, oy, 0), new THREE.Vector3(width / 2 + (arrows ? hl * 0.2 : 0), oy, 0)), ya = axis(new THREE.Vector3(ox, -height / 2, 0), new THREE.Vector3(ox, height / 2 + (arrows ? hl * 0.2 : 0), 0));
    parts.push({ t: xa }, { t: ya });
    if (arrows) for (const [p, dir] of [[[width / 2, oy, 0], [1, 0, 0]], [[ox, height / 2, 0], [0, 1, 0]]]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(axisWidth * 2.2, hl, 20).translate(0, hl / 2, 0), basic(axisColor, axisIntensity));
      cone.position.set(...p); cone.quaternion.setFromUnitVectors(Y, V(dir)); ax.add(cone); parts.push({ head: cone });
    }
  }
  const tk = { x: [], y: [] };
  const tv = typeof ticks === 'number' ? (ticks > 0 ? { x: niceTicks(x0, x1, ticks), y: niceTicks(y0, y1, ticks) } : { x: [], y: [] }) : { x: ticks.x || [], y: ticks.y || [] };
  for (const v of tv.x) { const x = X(v), a = new THREE.Object3D(); a.position.set(x, oy - tickSize * 2.2, 0); ax.add(a); const l = axes ? line([[x, oy - tickSize, 0], [x, oy + tickSize, 0]], { width: axisWidth * 0.8, color: axisColor, intensity: axisIntensity }) : null; if (l) ax.add(l); tk.x.push({ value: v, anchor: a, f: (x + width / 2) / width, l }); }
  for (const v of tv.y) { const y = Yv(v), a = new THREE.Object3D(); a.position.set(ox - tickSize * 2.2, y, 0); ax.add(a); const l = axes ? line([[ox - tickSize, y, 0], [ox + tickSize, y, 0]], { width: axisWidth * 0.8, color: axisColor, intensity: axisIntensity }) : null; if (l) ax.add(l); tk.y.push({ value: v, anchor: a, f: (y + height / 2) / height, l }); }
  ax.draw = (p) => {
    p = clamp(p);
    for (const q of parts) { if (q.t) q.t.draw(p); if (q.head) { q.head.scale.setScalar(Math.max(1e-4, smooth(clamp((p - 0.85) / 0.15)))); q.head.visible = p > 0.85; } }
    for (const t of [...tk.x, ...tk.y]) if (t.l) t.l.visible = p >= t.f;
  };
  g.add(ax);
  g.axes = ax; g.graph = graph; g.curve = curve; g.ticks = { x: tk.x.map(({ value, anchor }) => ({ value, anchor })), y: tk.y.map(({ value, anchor }) => ({ value, anchor })) };
  g.range = { x0, x1, y0, y1 };
  g.draw = (p) => graph.draw(p);
  g.setIntensity = (i) => graph.setIntensity(i);
  ax.draw(1); g.draw(1);
  return g;
}

// A measurement line between two points with end ticks (pair it with k.ui.label for the value).
export function dimension(a, b, { tick = 0.08, width = 0.012, color = '#ffffff', intensity = 1.6, normal = [0, 1, 0] } = {}) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), n = new THREE.Vector3(...normal).normalize().multiplyScalar(tick);
  const g = new THREE.Group();
  const main = line([A, B], { width, color, intensity });
  const t1 = line([A.clone().add(n), A.clone().sub(n)], { width, color, intensity });
  const t2 = line([B.clone().add(n), B.clone().sub(n)], { width, color, intensity });
  g.add(main, t1, t2);
  g.draw = (p) => { main.draw(p); t1.visible = p > 0.02; t2.visible = p > 0.98; };
  return g;
}

// Draw tubes one after another by length: p 0..1 runs over all of them in order.
function drawInOrder(tubes, lengths, p) {
  const total = lengths.reduce((a, b) => a + b, 0), d = clamp(p) * total;
  let acc = 0;
  tubes.forEach((t, i) => { t.draw(lengths[i] > 0 ? clamp((d - acc) / lengths[i]) : d > acc ? 1 : 0); acc += lengths[i]; });
}

// ---------- logic gates ----------
// A circular arc in the XY plane, as a Curve3 so it joins lines and Béziers in one CurvePath.
class Arc extends THREE.Curve {
  constructor(cx, cy, r, a0, a1) { super(); Object.assign(this, { cx, cy, r, a0, a1 }); }
  getPoint(t, out = new THREE.Vector3()) { const a = lerp(this.a0, this.a1, t); return out.set(this.cx + Math.cos(a) * this.r, this.cy + Math.sin(a) * this.r, 0); }
}
const xy = (x, y) => new THREE.Vector3(x, y, 0);

// The standard (distinctive-shape) logic-gate symbols in light: 'and' (flat back, round front), 'or' (curved back,
// pointed front), 'not' (a triangle and a bubble), and 'nand', 'nor' (with the bubble) and 'xor' (a second back
// curve). In the XY plane facing +z, centred on its body: height x width world units (width defaults to the classic
// proportions), so size and place it to stand around, or just behind, the parts that make the gate. inputs: leads on
// the back (2; 'not' has 1), each `lead` long (0.35 x height), and one output lead from the front; leads: false draws
// the outline alone. gate.draw(p) traces the outline, then the inputs flow in and the output flows out. Anchors: in0,
// in1, ... (outer ends of the inputs), out (end of the output), center. gate.inputs[i] (outer end -> gate) and
// gate.output (gate -> out) are the lead curves, for a glow.pulse that carries a signal through it.
export function gate(type = 'and', { height = 1, width = null, inputs = 2, leads = true, lead = null, radius = null, color = accentDefault(), intensity = 5, core = true, segments = 400 } = {}) {
  const kind = String(type).toLowerCase(), T = { and: 'and', nand: 'and', or: 'or', nor: 'or', xor: 'or', not: 'not' }[kind];
  if (!T) throw new Error(`glow.gate("${type}"): use 'and', 'or', 'not', 'nand', 'nor' or 'xor'`);
  const h = height, w = width ?? h * (T === 'not' ? 0.95 : T === 'or' ? 1.3 : 1.2);
  const rb = ['not', 'nand', 'nor'].includes(kind) ? h * 0.085 : 0; // the inverting bubble
  const r = radius ?? h * 0.015, L = lead ?? h * 0.35, n = T === 'not' ? 1 : Math.max(1, Math.round(inputs));
  const x0 = -w / 2, x1 = w / 2 - 2 * rb; // the back, and the front tip of the body (the bubble sits beyond it)
  const body = new THREE.CurvePath(), strokes = [body];
  let backAt = () => x0; // where an input meets the back, at height y
  if (T === 'and') {
    const xa = Math.max(x0, x1 - h / 2);
    body.add(new THREE.LineCurve3(xy(x0, h / 2), xy(x0, -h / 2)));
    body.add(new THREE.LineCurve3(xy(x0, -h / 2), xy(xa, -h / 2)));
    body.add(new Arc(xa, 0, h / 2, -Math.PI / 2, Math.PI / 2));
    body.add(new THREE.LineCurve3(xy(xa, h / 2), xy(x0, h / 2)));
  } else if (T === 'or') {
    const bb = h * 0.2, f = (u) => x0 + (x1 - x0) * u; // bb: how far the back curves in
    body.add(new THREE.QuadraticBezierCurve3(xy(x0, h / 2), xy(x0 + 2 * bb, 0), xy(x0, -h / 2)));
    body.add(new THREE.CubicBezierCurve3(xy(x0, -h / 2), xy(f(0.45), -h / 2), xy(f(0.82), -h * 0.3), xy(x1, 0)));
    body.add(new THREE.CubicBezierCurve3(xy(x1, 0), xy(f(0.82), h * 0.3), xy(f(0.45), h / 2), xy(x0, h / 2)));
    const g0 = kind === 'xor' ? h * 0.13 : 0; // the second back curve of the XOR, and the inputs end on it
    if (g0) strokes.push(new THREE.QuadraticBezierCurve3(xy(x0 - g0, h / 2), xy(x0 - g0 + 2 * bb, 0), xy(x0 - g0, -h / 2)));
    backAt = (y) => { const s = (1 - (2 * y) / h) / 2; return x0 - g0 + 4 * bb * s * (1 - s); };
  } else {
    body.add(new THREE.LineCurve3(xy(x0, h / 2), xy(x0, -h / 2)));
    body.add(new THREE.LineCurve3(xy(x0, -h / 2), xy(x1, 0)));
    body.add(new THREE.LineCurve3(xy(x1, 0), xy(x0, h / 2)));
  }
  if (rb) strokes.push(new Arc(x1 + rb, 0, rb, Math.PI, Math.PI + TAU));
  const g = new THREE.Group(); g.name = 'gate';
  const opt = { radius: r, color, intensity, core };
  const tubes = strokes.map((c, i) => { const t = tube(c, { ...opt, segments: i ? 96 : segments }); g.add(t); return t; });
  const lengths = strokes.map((c) => c.getLength());
  const ys = Array.from({ length: n }, (_, i) => (n === 1 ? 0 : h / 2 - ((i + 0.5) * h) / n));
  const ins = ys.map((y) => new THREE.LineCurve3(xy(x0 - L, y), xy(backAt(y) + r * 0.5, y)));
  const out = new THREE.LineCurve3(xy(x1 + 2 * rb - r * 0.5, 0), xy(x1 + 2 * rb + L, 0));
  const leadTubes = leads ? [...ins, out].map((c) => { const t = tube(c, { ...opt, segments: 48 }); g.add(t); return t; }) : [];
  const anchors = { center: new THREE.Object3D() };
  ins.forEach((c, i) => { anchors['in' + i] = new THREE.Object3D(); anchors['in' + i].position.copy(c.v1); });
  anchors.out = new THREE.Object3D(); anchors.out.position.copy(out.v2);
  for (const [name, a] of Object.entries(anchors)) { a.name = name; g.add(a); }
  g.draw = (p) => { drawInOrder(tubes, lengths, clamp(p / 0.75)); const q = clamp((p - 0.5) / 0.5); for (const t of leadTubes) t.draw(q); };
  g.setIntensity = (i, ci) => { for (const t of [...tubes, ...leadTubes]) t.setIntensity(i, ci); };
  g.setColor = (c, i = intensity) => { for (const t of [...tubes, ...leadTubes]) t.setColor(c, i); };
  g.curve = body; g.strokes = tubes; g.leads = leadTubes; g.inputs = ins; g.output = out;
  g.userData = { radius: Math.hypot(w + 2 * L, h) / 2, size: [w + (leads ? 2 * L : 0), h] };
  g.draw(1);
  return anchored(g, anchors);
}

// ---------- SVG paths ----------
// A 2D path from an SVG (its units, y down) as a curve in the XY plane, y up, scaled by s about (cx, cy).
class Flat extends THREE.Curve {
  constructor(p, s, cx, cy) { super(); Object.assign(this, { p, s, cx, cy }); this.q = new THREE.Vector2(); this.arcLengthDivisions = Math.max(200, p.curves.length * 50); }
  getPoint(t, out = new THREE.Vector3()) { const q = this.p.getPoint(clamp(t), this.q) || this.p.getPoint(1, this.q); return out.set((q.x - this.cx) * this.s, -(q.y - this.cy) * this.s, 0); }
}

// Any SVG path drawn in light, with a bright head travelling at the tip as it draws: a logo stroke, a rune, a hand-drawn
// arrow. d: a path's "d" attribute (every command, arcs included; each M starts a new stroke, Z closes one), fitted
// so its larger side (fit: 'width' | 'height') is `size` world units, centred on the origin in the XY plane facing
// +z, y up. svg.draw(p) draws the strokes on one after another by length, the head riding the tip (head: false for
// none; it fades in and out over 12% of each stroke). svg.setIntensity(i), svg.strokes (tubes), svg.curves (Curve3s
// for your own pulses), svg.width / .height. Anchor tip (the point being drawn).
//   const bt = glow.svgPath('M6.5 6.5 L17.5 17.5 L12 23 L12 1 L17.5 6.5 L6.5 17.5', { size: 0.5 }); // the Bluetooth rune
export function svgPath(d, { size = 1, fit = 'max', radius = null, color = accentDefault(), intensity = 5, core = true, head = true, headSize = null, headIntensity = 22, tail = 0.1, segments = 400 } = {}) {
  const data = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`);
  const subs = data.paths.flatMap((p) => p.subPaths).filter((s) => s.curves.length);
  if (!subs.length) throw new Error(`glow.svgPath: no strokes in "${String(d).slice(0, 40)}"`);
  for (const s of subs) if (s.autoClose) s.closePath();
  const box = new THREE.Box2();
  for (const s of subs) for (const q of s.getPoints(64)) box.expandByPoint(q);
  const bw = box.max.x - box.min.x, bh = box.max.y - box.min.y;
  const s = size / Math.max(1e-9, fit === 'width' ? bw : fit === 'height' ? bh : Math.max(bw, bh));
  const curves = subs.map((p) => new Flat(p, s, (box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2));
  const lens = curves.map((c) => c.getLength()), total = lens.reduce((a, b) => a + b, 0);
  const R = radius ?? size * 0.02;
  const g = new THREE.Group(); g.name = 'svgPath';
  const strokes = curves.map((c, i) => { const t = tube(c, { radius: R, color, intensity, core, segments: Math.max(48, Math.round((segments * lens[i]) / total)) }); g.add(t); return t; });
  // the head fades in over the first 12% of a stroke and out over the last 6% (shrinking as it goes)
  const heads = head ? curves.map((c) => { const p = pulse(c, { size: headSize ?? R * 3.2, color: lighten(color, 0.4), intensity: headIntensity, tail, fadeIn: 0.12, fadeOut: 0.06 }); g.add(p); return p; }) : [];
  const tip = new THREE.Object3D(); tip.name = 'tip'; g.add(tip);
  g.draw = (p) => {
    const dd = clamp(p) * total;
    let acc = 0, placed = false;
    strokes.forEach((t, i) => {
      const q = clamp((dd - acc) / lens[i]);
      t.draw(q);
      if (heads[i]) heads[i].place(q > 0 && q < 1 ? q : -1);
      if (!placed && (dd <= acc + lens[i] || i === strokes.length - 1)) { curves[i].getPointAt(q, tip.position); placed = true; }
      acc += lens[i];
    });
  };
  g.setIntensity = (i, ci) => { for (const t of strokes) t.setIntensity(i, ci); };
  g.strokes = strokes; g.curves = curves; g.heads = heads; g.width = bw * s; g.height = bh * s;
  g.userData = { radius: Math.hypot(bw, bh) * s / 2, size: [bw * s, bh * s] };
  g.draw(1);
  return anchored(g, { tip });
}

// ---------- waves ----------
// Expanding wavefronts on a disc: radio, sound or a ripple leaving a source, as thin rings of light travelling out and
// fading with distance, in one additive shader (any number of fronts costs the same; never scale a glow.ring for
// this). It lies flat (axis [0, 1, 0], like glow.ring); field.quaternion.copy(camera.quaternion) turns it to face the
// camera. field.set({ time, start, stop, intensity }) every update (each call stands alone, pure): the source emits
// from `start` to `stop` (seconds on the same clock as time; both open by default), the first crest leaving at start
// and travelling at `speed` units a second, so set({ time: t }) is a steady source, set({ time: t, start: t0 }) one
// that switches on at t0 and set({ time: t, start: t0, stop: t0 + 0.4 }) a burst. falloff: e-folds of brightness from
// the centre to the rim (1.8: the rim at 17%). wavelength (0.13 x radius) and width (0.06 x wavelength) are in world
// units; lines never get thinner than a pixel, so far-off fronts do not shimmer.
export function waveField({ radius = 3, color = accentDefault(), wavelength = null, width = null, speed = 1.2, intensity = 2.5, falloff = 1.8, axis = [0, 1, 0], segments = 160 } = {}) {
  const wl0 = wavelength ?? radius * 0.13;
  const U = { uColor: { value: C(color) }, uTime: { value: 0 }, uT0: { value: 0 }, uWl: { value: wl0 }, uSpeed: { value: speed }, uWidth: { value: width ?? wl0 * 0.06 }, uInt: { value: intensity }, uFront: { value: 1e6 }, uBack: { value: -1e6 }, uFall: { value: falloff }, uR: { value: radius } };
  const m = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, fog: false,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform vec3 uColor; uniform float uTime, uT0, uWl, uSpeed, uWidth, uInt, uFront, uBack, uFall, uR; varying vec2 vP;
      void main(){
        float r = length(vP);
        float d = abs(fract((r - uSpeed * (uTime - uT0)) / uWl + .5) - .5) * uWl; // distance to the nearest crest (one on the front)
        float w = max(uWidth, fwidth(r) * .8);
        float line = exp(-d * d / (w * w) * 3.) * (uWidth / w);                 // widened to a pixel, same light
        float env = exp(-uFall * r / uR) * (1. - smoothstep(uR * .75, uR, r)) * smoothstep(0., uWl * .35, r);
        float on = (1. - smoothstep(uFront + uWl * .1, uFront + uWl * .4, r)) * smoothstep(uBack - uWl * .4, uBack - uWl * .1, r);
        gl_FragColor = vec4(uColor * uInt * line * env * on, 1.);
      }`,
  });
  const f = new THREE.Mesh(new THREE.CircleGeometry(radius, segments), m);
  f.name = 'waveField'; f.frustumCulled = false; f.renderOrder = 2;
  f.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), V(axis).normalize());
  f.set = ({ time = 0, start = -Infinity, stop = Infinity, intensity: i = intensity, wavelength: wl = wl0, speed: sp = speed, front = null, back = null } = {}) => {
    U.uTime.value = time; U.uT0.value = Number.isFinite(start) ? start : 0; U.uWl.value = wl; U.uSpeed.value = sp; U.uInt.value = i;
    U.uFront.value = front ?? (Number.isFinite(start) ? sp * (time - start) : 1e6);
    U.uBack.value = back ?? (Number.isFinite(stop) ? sp * (time - stop) : -1e6);
    f.visible = i > 0 && U.uFront.value > -wl && U.uBack.value < radius;
  };
  f.setIntensity = (i) => { U.uInt.value = i; };
  f.userData.radius = radius;
  f.set();
  return f;
}

// A wave of light running from a to b (a phone to an earbud, an antenna to a tower): a glow.wave laid along a -> b,
// oscillating towards `up`, its ends tapered over `taper` of the length so it leaves and arrives softly. a and b are
// points, or Object3Ds read in world space every set() (add the wave to the scene, not to a moving parent).
// wb.set({ time, speed, to, from, amp, wavelength, fn, a, b }) every update (each call stands alone): the crests travel
// from a to b at `speed` (world units a second, default 2.5 wavelengths), `to` draws it out of a (0..1, the front
// tapered), fn: (x, u) => y any shape instead of the sine (x from the middle; glow.fsk(bits) for bits). amp, wavelength
// and radius default to 4.5%, 13% and 0.65% of the length. colors: as glow.wave's, from a (u 0) to b (u 1).
// wb.setIntensity(i), wb.setColor(c, i?), wb.wave, wb.len.
export function waveBetween(a, b, { up = [0, 1, 0], amp = null, wavelength = null, radius = null, speed = null, taper = 0.08, intensity = 5, color = accentDefault(), colors = null, core = true, segments = 400 } = {}) {
  const read = (p, out) => (p?.isObject3D ? p.getWorldPosition(out) : out.copy(V(p)));
  const A = read(a, new THREE.Vector3()), B = read(b, new THREE.Vector3());
  let len = Math.max(1e-6, A.distanceTo(B));
  const amp0 = amp ?? len * 0.045, wl0 = wavelength ?? len * 0.13, sp0 = speed ?? wl0 * 2.5;
  const w = wave({ length: len, amp: amp0, wavelength: wl0, radius: radius ?? len * 0.0065, intensity, segments, color, colors, core });
  const g = new THREE.Group(); g.name = 'waveBetween'; g.add(w);
  const UP = V(up), X = new THREE.Vector3(), Yb = new THREE.Vector3(), Zb = new THREE.Vector3(), M = new THREE.Matrix4();
  const place = () => {
    len = Math.max(1e-6, A.distanceTo(B));
    X.subVectors(B, A).normalize(); Zb.crossVectors(X, UP);
    if (Zb.lengthSq() < 1e-8) Zb.crossVectors(X, new THREE.Vector3(0, 0, 1));
    Zb.normalize(); Yb.crossVectors(Zb, X);
    g.quaternion.setFromRotationMatrix(M.makeBasis(X, Yb, Zb)); g.position.addVectors(A, B).multiplyScalar(0.5);
  };
  place();
  const ends = (u) => (taper > 0 ? smooth(clamp(u / taper)) * smooth(clamp((1 - u) / taper)) : 1);
  g.set = ({ time = 0, phase = null, speed: sp = sp0, from = 0, to = 1, amp: am = amp0, wavelength: wl = wl0, fn = null, a: na = null, b: nb = null } = {}) => {
    if (na) a = na; if (nb) b = nb;
    if (na || nb || a?.isObject3D || b?.isObject3D) { read(a, A); read(b, B); place(); }
    const front = taper > 0 && to < 1 ? (u) => smooth(clamp((to - u) / taper)) : () => 1;
    w.set({ phase: phase ?? (TAU / wl) * sp * time, amp: am, wavelength: wl, length: len, from, to: Math.max(from + 1e-4, to), fn, envelope: (u) => ends(u) * front(u) });
    g.visible = to - from > 1e-3;
  };
  g.setIntensity = (i) => w.setIntensity(i);
  g.setColor = (c, i) => w.setColor(c, i);
  g.wave = w;
  Object.defineProperty(g, 'len', { get: () => len });
  g.userData.radius = len / 2;
  g.set();
  return g;
}

// Frequency-shift keying: bits sent as a wave whose frequency changes per bit (a 1 at `one` cycles per unit, a 0 at
// `zero`), with the phase carried across each change so the wave never jumps. bits: '1011', [1, 0, 1, 1], or
// [{ f, len }] for any frequencies. Returns fn(x) for glow.wave({ fn }) or waveBetween's set({ fn }), with x in world
// units from the wave's middle: glow.wave({ length: fn.total, fn }) fits the bits exactly (x0 moves the first bit's
// start; default -total / 2). fn.total = the length, fn.bits = [{ bit, f, x0, x1, mid }] (stand a "1" over fn.bits[0].mid).
// To scroll the bits along, draw fn(x - speed * t).
export function fsk(bits, { one = 4, zero = 2, len = 1, amp = 0.2, x0 = null } = {}) {
  const list = (typeof bits === 'string' ? [...bits].filter((c) => c === '0' || c === '1') : bits)
    .map((b) => (typeof b === 'object' ? { bit: b.bit ?? null, f: b.f, len: b.len ?? len } : { bit: +b, f: +b ? one : zero, len }));
  const total = list.reduce((a, b) => a + b.len, 0);
  let x = x0 ?? -total / 2, ph = 0;
  const segs = list.map((b) => { const s = { ...b, x0: x, x1: x + b.len, mid: x + b.len / 2, ph }; ph += TAU * b.f * b.len; x += b.len; return s; });
  const fn = (xx) => { let s = segs[0]; for (const q of segs) if (xx >= q.x0) s = q; return Math.sin(s.ph + TAU * s.f * (xx - s.x0)) * amp; };
  fn.total = total;
  fn.bits = segs.map(({ bit, f, x0: a, x1: b, mid }) => ({ bit, f, x0: a, x1: b, mid }));
  return fn;
}

// ---------- field vectors ----------
// A field arrow (an electric field, a force, a velocity) whose signed length you set every frame: vec.set(len, alpha)
// points it along `dir` (default +x) for len > 0 and the other way for len < 0. The head keeps its size and shrinks
// only when the arrow is shorter than 1.6 heads, so a field oscillating through zero reads as one arrow turning over.
// Unlit HDR with a white-hot core, like glow.arrow. head / headRadius default to 7.5 and 2.9 x radius.
export function vector({ color = accentDefault(), intensity = 2, radius = 0.012, head = null, headRadius = null, dir = [1, 0, 0], core = true, coreColor = null } = {}) {
  const hl = head ?? radius * 7.5, hr = headRadius ?? radius * 2.9, cc = coreColor ?? lighten(color, 0.85);
  const g = new THREE.Group(); g.name = 'vector';
  const turn = new THREE.Group(); turn.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), V(dir).normalize()); g.add(turn);
  const flip = new THREE.Group(); turn.add(flip);
  const m = glowMat(color, intensity, { core: core ? cc : null });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 12, 1).rotateZ(-Math.PI / 2).translate(0.5, 0, 0), m);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(hr, hl, 24).rotateZ(-Math.PI / 2).translate(hl / 2, 0, 0), m);
  flip.add(shaft, tip);
  g.set = (len, alpha = 1) => {
    const L = Math.abs(len), hs = clamp(L / (hl * 1.6)), sl = Math.max(1e-4, L - hl * hs), a = clamp(alpha);
    shaft.scale.set(sl, 1, 1); tip.position.x = sl; tip.scale.setScalar(Math.max(1e-4, hs));
    flip.rotation.y = len < 0 ? Math.PI : 0;
    m.color.copy(hot(color, intensity * a)); if (core) m.userData.core.value.copy(hot(cc, intensity * 1.6 * a));
    g.visible = L > 1e-3 && a > 0.002;
  };
  g.material = m;
  g.set(1);
  return g;
}

// ---------- a sweep of light ----------
let sheetTexture = null;
const sheetTex = () => {
  if (sheetTexture) return sheetTexture;
  const c = document.createElement('canvas'); c.width = 8; c.height = 256;
  const x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.75, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
  x.fillStyle = gr; x.fillRect(0, 0, 8, 256);
  sheetTexture = new THREE.CanvasTexture(c); sheetTexture.userData.shared = true; // cached across shots: never disposed with one
  return sheetTexture;
};

// "Carve it with light": a sheet of light sweeps across a disc lying at height y (a wafer, a plate, a die) and leaves
// the surface's pattern behind it. Ahead of the sheet a plain cover disc hides the surface (cover: a colour, a
// Material, or false for the light alone); behind it the cover is clipped away. sweep.set(p, on = 1) every update: p
// 0..1 carries the sheet across (0 before the near edge, 1 past the far one), on is its strength. It travels along its
// own +x: move and turn the group like any other (the clip plane follows it in world space). Turns on
// k.renderer.localClippingEnabled. Parts: sweep.cover, .sheet, .edge (the glowing line on the surface), .lamp (a
// warm point light riding the line). Anchor edge (the middle of the line, for focus).
export function sweep(k, { radius = 1.5, y = 0, color = accentDefault(), cover = '#7d8492', height = null, intensity = 7, light = null } = {}) {
  k.renderer.localClippingEnabled = true;
  const H = height ?? radius * 1.5, lampI = light ?? 4 * Math.pow(radius / 1.5, 1.5);
  const g = new THREE.Group(); g.name = 'sweep';
  const clip = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
  let lid = null;
  if (cover) {
    const m = cover.isMaterial ? cover : mat.metal(cover, { rough: 0.25, env: 0.9 });
    m.clippingPlanes = [clip];
    lid = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.999, 160).rotateX(-Math.PI / 2), m);
    lid.position.y = y + radius * 0.0008; lid.receiveShadow = true; g.add(lid);
  }
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(2.24 * radius, H).rotateY(Math.PI / 2), new THREE.MeshBasicMaterial({ map: sheetTex(), color: C(color).multiplyScalar(1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }));
  sheet.position.y = y + H / 2; g.add(sheet);
  const edge = tube(new THREE.LineCurve3(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 1)), { radius: radius * 0.0067, color, intensity, segments: 8 });
  g.add(edge);
  const lamp = new THREE.PointLight(C(color), 0, 2 * radius, 1.5); g.add(lamp);
  const mid = new THREE.Object3D(); mid.name = 'edge'; g.add(mid);
  const P = new THREE.Vector3(), N = new THREE.Vector3(), Q = new THREE.Quaternion();
  g.set = (p, on = 1) => {
    const x = lerp(-1.05 * radius, 1.05 * radius, clamp(p)), chord = Math.sqrt(Math.max(0, radius * radius - x * x)), o = clamp(on);
    g.updateWorldMatrix(true, false);
    N.set(1, 0, 0).applyQuaternion(g.getWorldQuaternion(Q)).normalize(); P.set(x, y, 0).applyMatrix4(g.matrixWorld);
    clip.setFromNormalAndCoplanarPoint(N, P); // the cover stays only ahead of the sheet
    const vis = chord > radius * 0.005 && o > 0;
    sheet.position.x = x; sheet.scale.z = Math.max(1e-3, chord / (1.12 * radius)); sheet.visible = vis; sheet.material.opacity = 0.6 * o;
    edge.position.set(x, y + radius * 0.004, 0); edge.scale.z = Math.max(1e-3, chord); edge.visible = vis; edge.setIntensity(intensity * o);
    lamp.position.set(x, y + radius / 3, 0); lamp.intensity = lampI * o;
    mid.position.set(x, y, 0);
  };
  g.cover = lid; g.sheet = sheet; g.edge = edge; g.lamp = lamp;
  g.userData.radius = Math.hypot(radius, H / 2);
  g.set(0, 0);
  return anchored(g, { edge: mid });
}
