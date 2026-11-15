// Data props: explainers keep stating numbers, comparisons and growth. Bars on a plinth, a glowing line over a faint
// grid, a donut, a stack or wall of counted things, and an in-world scoreboard. Each one grows or draws on from one
// 0..1 parameter (pure: call it every update), takes the palette's accent for the one thing the story is about, has
// named anchors (g.anchor(name)) for labels, hero numbers and focus, and sets userData.radius for cam.frame.
//
//   const ch = k.props.bars([12, 18, 31, 64], { labels: ['2021', '2022', '2023', '2024'] });   // tallest = accent
//   scene.add(ch);
//   return (t, ft) => { ch.grow(k.ramp(t, t0, t0 + 1.2), k.ramp(ft, t0, t0 + 1.2)); };      // shape from t, text from ft
//
// Materials reflect the type studio (typeEnv) like the 3D type does, so metal reads as brushed metal in any world;
// pass reflect: 'scene' to use the scene's environment instead.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { accentDefault, theme } from '../look.js';
import { clamp, easeFn, hash1, rng, lerp, smooth } from '../util.js';
import { glowSprite } from '../fx.js';
import { tube } from '../glow.js';
import { slabGeometry } from './devices.js';
import { withAnchors, roundedRect } from './base.js';
import { extrude, measureText, typeEnv, bevelNormals } from './type.js';

// ---------- shared ----------
const V3 = THREE.Vector3;
const TAU = Math.PI * 2;
const C = (c) => (c && c.isColor ? c.clone() : new THREE.Color(c));
const accentOf = (o) => o.accent ?? o.pal?.accent ?? accentDefault();
const phys = (o) => new THREE.MeshPhysicalMaterial(o);
const studio = (m, o) => { if (o.reflect !== 'scene' && m?.isMeshStandardMaterial) m.envMap = typeEnv(); return m; };
const shadowed = (m, cast = true, receive = true) => { m.castShadow = cast; m.receiveShadow = receive; return m; };
function pin(g, name, x = 0, y = 0, z = 0, parent = g) { const a = new THREE.Object3D(); a.name = name; a.position.set(x, y, z); parent.add(a); g.anchors[name] = a; return a; }
function propGroup(name) { const g = new THREE.Group(); g.name = name; g.anchors = {}; withAnchors(g, g.anchors); return g; }
const sharedTex = new Map();
// A grain bump texture shared by every chart (micro-detail on large dark surfaces).
function grainTex(kind = 'grain', repeat = 3) {
  const key = kind + repeat;
  if (sharedTex.has(key) || typeof document === 'undefined') return sharedTex.get(key) ?? null;
  const N = 256, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const g = cv.getContext('2d'), img = g.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let v = 128;
    if (kind === 'grain') v = 128 + (hash1(x * 12.9898 + y * 78.233) - 0.5) * 70 + (hash1(Math.floor(x / 4) * 3.1 + Math.floor(y / 4) * 7.7) - 0.5) * 40;
    else if (kind === 'brushed') v = 128 + (hash1(y * 7.31) - 0.5) * 80 + (hash1(Math.floor(y / 3) * 3.7) - 0.5) * 40 + (hash1(x * 0.37 + y * 91.7) - 0.5) * 16;
    const i = (y * N + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.max(0, Math.min(255, v)); img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 8; t.userData.shared = true;
  sharedTex.set(key, t);
  return t;
}

// Neutral surfaces for chart bodies: dark anodised metal (default), frosted or clear glass, ceramic.
function bodyMaterial(kind, o, thickness = 0.3) {
  switch (kind) {
    case 'frosted': return studio(phys({ color: C(o.color ?? '#dbe6f4'), metalness: 0, roughness: 0.34, transmission: 1, thickness, ior: 1.42, envMapIntensity: 1.2, attenuationColor: C(o.color ?? '#c9dcf2'), attenuationDistance: thickness * 4, emissive: C(o.color ?? '#9fb4cf'), emissiveIntensity: o.glow ?? 0.12 }), o);
    case 'glass': return studio(phys({ color: C(o.color ?? '#f2f6ff'), metalness: 0, roughness: 0.05, transmission: 1, thickness, ior: 1.5, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.2 }), o);
    case 'ceramic': return studio(phys({ color: C(o.color ?? '#e8e5de'), metalness: 0, roughness: 0.38, clearcoat: 0.8, clearcoatRoughness: 0.12, envMapIntensity: 0.9 }), o);
    case 'metal': default: return studio(phys({ color: C(o.color ?? '#59606b'), metalness: 1, roughness: o.rough ?? 0.32, anisotropy: 0.6, envMapIntensity: 1.15, bumpMap: grainTex('brushed', 2), bumpScale: 0.15 }), o);
  }
}
// The one thing the story is about: anodised accent metal that also glows a little from inside.
const accentMaterial = (acc, o, glow = 0.22) => studio(phys({ color: C(acc), metalness: 0.75, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.12, emissive: C(acc), emissiveIntensity: glow, envMapIntensity: 1.1 }), o);
// Plinth: dark brushed metal body and a glossy black top.
const plinthBody = (o) => studio(phys({ color: C(o.plinthColor ?? '#1a1d23'), metalness: 0.9, roughness: 0.42, anisotropy: 0.5, envMapIntensity: 0.9, bumpMap: grainTex('brushed', 4), bumpScale: 0.2 }), o);
const plinthTop = (o) => studio(phys({ color: C('#060709'), metalness: 0, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.12, envMapIntensity: 0.4 }), o);

// A slab whose height can change without stretching its bevel: vertices above the template's middle move up.
function growSlab(w, d, { rc, top, bottom = 0, base = 0.5 }) {
  const H0 = Math.max(top, 1e-3) * 4 + bottom * 2 + 1e-3;
  const geo = slabGeometry(w, d, H0, { rc, top, bottom, capBottom: true });
  const pos = geo.attributes.position, Y = new Float32Array(pos.count), col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { Y[i] = pos.getY(i); const k = Y[i] > H0 / 2 ? 1 : base; col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); // light falls off towards the plinth (reads as occlusion)
  let last = -1;
  geo.setHeight = (h) => {
    if (h === last) return; last = h;
    const a = pos.array;
    if (h >= H0) for (let i = 0; i < pos.count; i++) a[i * 3 + 1] = Y[i] > H0 / 2 ? Y[i] + (h - H0) : Y[i];
    else for (let i = 0; i < pos.count; i++) a[i * 3 + 1] = Y[i] * (h / H0);
    pos.needsUpdate = true; geo.computeBoundingSphere();
  };
  return geo;
}
// A rounded-rectangle loop (closed curve) at height y, for glowing edges.
function rectLoop(w, d, r, y = 0, n = 12) {
  const pts = [], hx = w / 2 - r, hz = d / 2 - r;
  const corners = [[hx, hz, 0], [-hx, hz, Math.PI / 2], [-hx, -hz, Math.PI], [hx, -hz, Math.PI * 1.5]];
  for (const [cx, cz, a0] of corners) for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * (Math.PI / 2); pts.push(new V3(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r)); }
  return new THREE.CatmullRomCurve3(pts, true, 'centripetal');
}
// Flat printed type (labels) and in-world numbers share these defaults.
const ink = (str, size, o = {}) => extrude(str, { size, depth: 0, material: 'ink', weight: o.weight ?? 700, font: o.font ?? 'inter', color: o.color ?? '#ffffff', intensity: o.intensity ?? 0.82, align: o.align ?? 'center', valign: o.valign ?? 'middle', tracking: o.tracking, tabular: o.tabular ?? true, unit: o.unit, fog: o.fog });

// =====================================================================================================
// bars(values, { labels, highlight, spacing, height, width, depth, material, ... })
// Bevelled bars on a dark plinth. The highlighted bar is accent metal with a glowing top edge and a warm light on
// the plinth; the rest are dark metal (or frosted/glass/ceramic). grow(p[, textP]) grows them with a stagger.
// =====================================================================================================
export function bars(values = [3, 5, 8], o = {}) {
  values = values.length ? values.map((v) => +v || 0) : [0];
  const n = values.length;
  const acc = accentOf(o);
  const w = o.width ?? 0.3, d = o.depth ?? w, H = o.height ?? 1.6;
  const pitch = w * (1 + (o.spacing ?? 0.45));
  const vmax = o.max ?? Math.max(...values.map(Math.abs), 1e-9), vmin = o.min ?? 0;
  const hl0 = o.highlight === undefined || o.highlight === 'max' ? values.indexOf(Math.max(...values)) : o.highlight === null || o.highlight < 0 ? -1 : Math.round(o.highlight);
  const hl = hl0 < n ? hl0 : -1;
  const labels = o.labels || null;
  const labelSize = o.labelSize ?? w * 0.3;
  const valueSize = o.valueSize ?? w * 0.34;
  const plinth = o.plinth !== false;
  const pad = o.pad ?? w * 0.6;
  const PW = (n - 1) * pitch + w + 2 * pad, PD = d + 2 * pad, PH = plinth ? (o.plinthHeight ?? Math.max(w * 0.42, labels ? labelSize * 2.5 : 0)) : 0;
  const rc = w * 0.13, tb = w * 0.07;
  const E = easeFn(o.ease ?? 'outCubic');
  const stagger = o.stagger ?? Math.min(0.14, 0.55 / Math.max(1, n - 1));
  const span = Math.max(0.2, 1 - stagger * (n - 1));
  const order = o.order ?? 'index';
  const rank = values.map((v, i) => i);
  if (order === 'value') rank.sort((a, b) => values[a] - values[b]);
  else if (order === 'center') rank.sort((a, b) => Math.abs(a - (n - 1) / 2) - Math.abs(b - (n - 1) / 2));
  const slot = new Array(n); rank.forEach((i, r) => { slot[i] = r; });
  const fmt = o.format ?? ((v) => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-US') : String(Math.round(v * 10) / 10)));

  const g = propGroup('bars');
  if (plinth) {
    const body = shadowed(new THREE.Mesh(slabGeometry(PW, PD, PH, { rc: Math.min(PD, PW) * 0.1, top: PH * 0.16, bottom: PH * 0.05 }), plinthBody(o)));
    g.add(body);
    const inset = PH * 0.2;
    const topGeo = new THREE.ShapeGeometry(roundedRect(PW - 2 * inset, PD - 2 * inset, Math.max(0.001, Math.min(PD, PW) * 0.1 - inset)), 10);
    topGeo.rotateX(-Math.PI / 2);
    const top = shadowed(new THREE.Mesh(topGeo, plinthTop(o)), false, true);
    top.position.y = PH + w * 0.002; g.add(top);
  }
  const y0 = PH;
  const neutral = bodyMaterial(o.material ?? 'metal', o, w);
  const hot = accentMaterial(acc, o);
  neutral.vertexColors = true; hot.vertexColors = true;
  const barsM = [], geos = [];
  const xs = values.map((_, i) => (i - (n - 1) / 2) * pitch);
  values.forEach((v, i) => {
    const geo = growSlab(w, d, { rc, top: tb, base: i === hl ? 0.72 : (o.material ?? 'metal') === 'metal' ? 0.42 : 0.8 });
    const m = shadowed(new THREE.Mesh(geo, i === hl ? hot : neutral));
    m.position.set(xs[i], y0, 0);
    g.add(m); barsM.push(m); geos.push(geo);
    pin(g, 'bar' + i, xs[i], y0, 0);
  });
  // highlight: glowing top edge, a warm light, the accent value
  let ring = null, light = null, halo = null;
  const ringR = Math.max(0.002, rc - tb * 0.29);
  if (hl >= 0) {
    ring = tube(rectLoop(w - tb * 0.58, d - tb * 0.58, ringR, 0, 10), { radius: w * 0.018, color: acc, intensity: o.edge ?? 5, segments: 200, radial: 8, core: true });
    ring.position.set(xs[hl], y0, 0); g.add(ring);
    if (o.light !== false) {
      light = new THREE.PointLight(C(acc), 0, w * 5, 2);
      g.add(light);
    }
    halo = glowSprite({ color: acc, intensity: 0, size: w * 2.2 });
    g.add(halo);
  }
  // labels on the plinth front, values above the bars
  const labelMeshes = [];
  if (labels && plinth) labels.forEach((s, i) => {
    if (s == null || s === '') return;
    const L = ink(String(s), labelSize, { intensity: i === hl ? 0.95 : 0.7, tabular: false });
    L.position.set(xs[i], PH * 0.5, PD / 2 + w * 0.006); g.add(L); labelMeshes.push(L);
    pin(g, 'label' + i, xs[i], PH * 0.5, PD / 2);
  });
  const valueMeshes = [];
  if (o.values) values.forEach((v, i) => {
    const T = ink(fmt(v), valueSize, i === hl ? { color: acc, intensity: 3.2 } : { intensity: 0.85 });
    T.position.set(xs[i], y0, d / 2); g.add(T); valueMeshes.push(T);
  });
  pin(g, 'hero', hl >= 0 ? xs[hl] : 0, y0, 0);
  pin(g, 'top', 0, y0 + H + w, 0);
  pin(g, 'base', 0, PH * 0.5, PD / 2);
  pin(g, 'center', 0, (y0 + H) / 2, 0);
  g.userData = { radius: 0.5 * Math.hypot(PW, H + PH, PD), center: new V3(0, (PH + H) / 2, 0), size: [PW, PH + H, PD], plinth: [PW, PH, PD], pitch, barWidth: w };
  g.bars = barsM; g.labels = labelMeshes; g.values = valueMeshes;

  let hlv = hl >= 0 ? (o.highlightLevel ?? 1) : 0, lastP = 0;
  const heightOf = (i, p) => {
    const gi = E(clamp((p - slot[i] * stagger) / span));
    return { gi, h: gi * H * clamp((values[i] - vmin) / (vmax - vmin), 0, 4) };
  };
  g.grow = (p, textP = p) => {
    lastP = p;
    values.forEach((v, i) => {
      const { h } = heightOf(i, p);
      geos[i].setHeight(Math.max(h, 1e-5));
      barsM[i].visible = h > 1e-4;
      g.anchors['bar' + i].position.y = y0 + h;
      if (i === hl) {
        g.anchors.hero.position.y = y0 + h;
        if (ring) { ring.position.y = y0 + h - tb * 0.29; ring.visible = h > tb * 2 && hlv > 0.001; const f = smooth(clamp((h - tb * 2) / (tb * 6))); ring.setIntensity((o.edge ?? 5) * hlv * f, (o.edge ?? 5) * 1.6 * hlv * f); }
        if (light) light.position.set(xs[i], y0 + Math.max(h - w * 0.6, h * 0.5), 0);
        if (halo) halo.position.set(xs[i], y0 + h, 0);
      }
      const T = valueMeshes[i];
      if (T) {
        const { gi } = heightOf(i, textP);
        T.setText(fmt(v * gi));
        T.position.y = y0 + h + valueSize * 1.05;
        const sc = smooth(clamp(heightOf(i, p).gi * 5));   // grows in with its bar, no pop
        T.scale.setScalar(Math.max(1e-4, sc));
        T.visible = h > 1e-4;
      }
    });
    return g;
  };
  // highlight level 0..1 (the accent bar keeps its colour; its glow, edge and light follow v)
  g.highlight = (v) => {
    hlv = v;
    if (hl < 0) return g;
    hot.emissiveIntensity = 0.06 + 0.22 * v;
    if (light) light.intensity = (o.lightIntensity ?? 1) * 0.7 * (w / 0.3) ** 2 * v;
    if (halo) halo.setIntensity(0.35 * v);
    g.grow(lastP);
    return g;
  };
  g.highlight(hlv);
  g.grow(0);
  return g;
}

// =====================================================================================================
// lineChart(points, { width, height, min, max, grid, area, dots, head, labels, ... })
// A glowing line drawn left to right over a faint 3D grid (back wall and floor), an accent head on the newest point
// with a drop line to the floor, and an optional gradient area under the line. draw(p) is the x-progress 0..1.
// =====================================================================================================
function monotone(xs, ys, per = 24) {
  // Fritsch-Carlson monotone cubic through (xs, ys): no overshoot between data points.
  const n = xs.length, dx = [], m = [], s = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = xs[i + 1] - xs[i]; s[i] = (ys[i + 1] - ys[i]) / dx[i]; }
  m[0] = s[0]; m[n - 1] = s[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = s[i - 1] * s[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / s[i - 1] + (dx[i] + 2 * dx[i - 1]) / s[i]);
  const out = [];
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < per; j++) {
    const t = j / per, h = dx[i], t2 = t * t, t3 = t2 * t;
    const y = (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
    out.push([xs[i] + t * h, y]);
  }
  out.push([xs[n - 1], ys[n - 1]]);
  return out;
}
const niceStep = (range, target = 4) => { const raw = Math.max(range, 1e-9) / target, p = 10 ** Math.floor(Math.log10(raw)), f = raw / p; return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p; };

export function lineChart(points = [1, 3, 2, 5, 8], o = {}) {
  const acc = accentOf(o);
  let P = points.map((p, i) => (Array.isArray(p) ? [+p[0], +p[1]] : [i, +p]));
  P = P.filter((p, i) => i === 0 || p[0] > P[i - 1][0]);           // x must increase
  if (P.length < 2) P = [[0, P[0]?.[1] ?? 0], [1, P[0]?.[1] ?? 0]];
  const n = P.length;
  const Wd = o.width ?? 2.4, Ht = o.height ?? 1.4, Dp = o.depth ?? Wd * 0.5;
  const xMin = o.xMin ?? P[0][0], xMax = o.xMax ?? P[n - 1][0];
  const ys = P.map((p) => p[1]);
  const yMin = o.min ?? Math.min(0, ...ys);
  let yMax = o.max ?? (Math.max(...ys) + (Math.max(...ys) - yMin) * 0.08);
  if (!(yMax - yMin > 1e-9)) yMax = yMin + 1;
  const X = (x) => ((x - xMin) / (xMax - xMin) - 0.5) * Wd, Y = (y) => ((y - yMin) / (yMax - yMin)) * Ht;
  const radius = o.radius ?? Wd * 0.0065;
  const g = propGroup('lineChart');
  const fogOn = o.fog ?? true;

  // the curve: monotone through the data (or straight segments), sampled densely
  const samples = o.smooth === false ? P.map(([x, y]) => [x, y]) : monotone(P.map((p) => p[0]), ys, 24);
  const pts = samples.map(([x, y]) => new V3(X(x), Y(y), 0));
  const curve = o.smooth === false ? new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0) : new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  // x-progress -> arc-length fraction (lines are drawn by x, like time)
  const L = curve.getLengths(Math.max(200, pts.length * 4)), Ltot = L[L.length - 1];
  const xOf = [], uOf = [];
  for (let i = 0; i < L.length; i++) { const u = i / (L.length - 1), p = curve.getPoint(u); xOf.push((p.x + Wd / 2) / Wd); uOf.push(L[i] / Ltot); }
  const uAtX = (fx) => {
    fx = clamp(fx); let lo = 0, hi = xOf.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xOf[mid] < fx) lo = mid; else hi = mid; }
    const t = xOf[hi] === xOf[lo] ? 0 : (fx - xOf[lo]) / (xOf[hi] - xOf[lo]);
    return lerp(uOf[lo], uOf[hi], t);
  };
  const line = tube(curve, { radius, color: acc, intensity: o.intensity ?? 4.5, segments: Math.max(400, pts.length * 3), radial: 10, core: true, fog: false });
  g.add(line);

  // gradient area under the line (additive light, strongest under the line)
  let area = null;
  if (o.area !== false) {
    const N = pts.length, pos = new Float32Array(N * 2 * 3), a = new Float32Array(N * 2), idx = [];
    pts.forEach((p, i) => { pos.set([p.x, p.y, -0.001, p.x, 0, -0.001], i * 6); a[i * 2] = 1; a[i * 2 + 1] = 0; });
    for (let i = 0; i < N - 1; i++) { const t0 = i * 2, b0 = i * 2 + 1, t1 = i * 2 + 2, b1 = i * 2 + 3; idx.push(t0, b0, t1, t1, b0, b1); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('a', new THREE.BufferAttribute(a, 1)); geo.setIndex(idx);
    const m = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: C(acc) }, uK: { value: o.areaOpacity ?? 0.42 }, uTop: { value: Ht } },
      vertexShader: `attribute float a; varying float vA; varying float vY; void main(){ vA = a; vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: `uniform vec3 uColor; uniform float uK, uTop; varying float vA; varying float vY; void main(){ float k = pow(vA, 2.2) * (0.25 + 0.75 * smoothstep(0., uTop, vY)); gl_FragColor = vec4(uColor * uK * k, 1.); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    });
    area = new THREE.Mesh(geo, m); area.renderOrder = 2; area.frustumCulled = false; g.add(area);
    area.userData.N = N;
  }

  // the faint grid: a back wall (z = -Dp/2) and a floor (y = 0) of thin lines that fade with fog
  if (o.grid !== false) {
    const seg = [];
    const step = niceStep(yMax - yMin, o.yTicks ?? 4);
    const zb = -Dp / 2, zf = Dp / 2, yf = Wd * 0.0015;
    for (let v = Math.ceil(yMin / step) * step; v <= yMax + 1e-9; v += step) { const y = Y(v); seg.push(-Wd / 2, y, zb, Wd / 2, y, zb); }
    const xCount = o.xTicks ?? Math.min(n, 12);
    for (let i = 0; i < xCount; i++) { const x = -Wd / 2 + (i / Math.max(1, xCount - 1)) * Wd; seg.push(x, yf, zb, x, Ht, zb); seg.push(x, yf, zb, x, yf, zf); }
    for (let j = 0; j <= 4; j++) { const z = zb + (j / 4) * (zf - zb); seg.push(-Wd / 2, yf, z, Wd / 2, yf, z); }
    const geo = new LineSegmentsGeometry(); geo.setPositions(seg);
    // brighter worlds need brighter lines to stay visible (the backdrop's top colour sets it)
    const bgL = theme.pal?.bg ? C(theme.pal.bg[0]).getHSL({ h: 0, s: 0, l: 0 }).l : 0.1;
    const m = new LineMaterial({ color: C(o.gridColor ?? '#9fb6d4').multiplyScalar(o.gridIntensity ?? 0.3 + bgL * 0.9), linewidth: o.gridWidth ?? Wd * 0.0016, worldUnits: true, transparent: true, opacity: 1, toneMapped: false, depthWrite: false, fog: fogOn });
    m.resolution.set(1080, 1920);
    const grid = new LineSegments2(geo, m); grid.renderOrder = 1; g.add(grid);
    // the x axis, a little brighter
    const ax = new LineSegmentsGeometry(); ax.setPositions([-Wd / 2, yf * 1.5, 0, Wd / 2, yf * 1.5, 0]);
    const am = new LineMaterial({ color: C('#ffffff').multiplyScalar(0.55), linewidth: Wd * 0.0028, worldUnits: true, toneMapped: false, fog: fogOn });
    am.resolution.set(1080, 1920);
    g.add(new LineSegments2(ax, am));
    g.grid = grid;
  }

  // data dots (light up as the line passes), the head, its drop line and light
  const dots = [];
  const dotGeo = new THREE.SphereGeometry(radius * (o.dotSize ?? 2.0), 20, 14);
  if (o.dots !== false) P.forEach(([x, y], i) => {
    const m = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: C('#fff4e6').multiplyScalar(1.7), toneMapped: false }));
    m.position.set(X(x), Y(y), 0); m.visible = false; g.add(m); dots.push(m);
  });
  const head = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(radius * 3.2, 24, 16), new THREE.MeshBasicMaterial({ color: C('#fff6e8').multiplyScalar(o.headIntensity ?? 9), toneMapped: false }));
  const sheath = new THREE.Mesh(new THREE.SphereGeometry(radius * 5, 24, 16), new THREE.MeshBasicMaterial({ color: C(acc).multiplyScalar(2.2), toneMapped: false, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
  const halo = glowSprite({ color: acc, intensity: 0.9, size: radius * 26 });
  head.add(core, sheath, halo); g.add(head);
  let headLight = null;
  if (o.light) { headLight = new THREE.PointLight(C(acc), (o.lightIntensity ?? 1) * 0.25 * (Wd / 2.4) ** 2, Wd * 1.2, 2); head.add(headLight); }
  let drop = null;
  if (o.drop !== false) {
    const geo = new LineSegmentsGeometry(); geo.setPositions([0, 0, 0, 0, -1, 0]);
    const m = new LineMaterial({ color: C(acc).multiplyScalar(1.1), linewidth: radius * 0.5, worldUnits: true, transparent: true, opacity: 0.7, toneMapped: false, depthWrite: false });
    m.resolution.set(1080, 1920);
    drop = new LineSegments2(geo, m); head.add(drop);
  }
  // x labels, printed on the floor's front edge
  if (o.labels) o.labels.forEach((s, i) => {
    if (s == null || s === '') return;
    const x = P[Math.min(i, n - 1)][0];
    const T = ink(String(s), o.labelSize ?? Wd * 0.034, { intensity: 0.7, tabular: false });
    T.rotation.x = -Math.PI / 2 + (o.labelTilt ?? 0.9);
    T.position.set(X(x), Wd * 0.002, Dp / 2 + (o.labelSize ?? Wd * 0.034) * 1.4); g.add(T);
  });

  P.forEach(([x, y], i) => pin(g, 'p' + i, X(x), Y(y), 0));
  pin(g, 'head', X(P[0][0]), Y(P[0][1]), 0);
  pin(g, 'start', X(P[0][0]), Y(P[0][1]), 0);
  pin(g, 'end', X(P[n - 1][0]), Y(P[n - 1][1]), 0);
  pin(g, 'top', 0, Ht * 1.12, 0);
  pin(g, 'center', 0, Ht / 2, 0);
  g.userData = { radius: 0.5 * Math.hypot(Wd, Ht, Dp), center: new V3(0, Ht / 2, 0), size: [Wd, Ht, Dp] };
  g.curve = curve;
  g.pointAt = (i) => g.localToWorld(g.anchors['p' + clamp(i, 0, n - 1)].position.clone());
  const dotX = P.map(([x]) => (X(x) + Wd / 2) / Wd);
  const headScale = new V3();
  g.draw = (p) => {
    const fx = clamp(p), u = uAtX(fx);
    line.draw(u);
    line.visible = p > 0.0005;
    const hp = curve.getPointAt(clamp(u, 0, 1));
    head.position.copy(hp); head.visible = p > 0.0005 && (o.head !== false);
    g.anchors.head.position.copy(hp);
    // the head swells a little while drawing and settles when the line is done
    const inK = smooth(clamp(p / 0.035));               // the head grows in over the first few percent
    head.scale.setScalar(Math.max(1e-4, inK));
    const s = 1 + 0.25 * Math.sin(Math.PI * clamp(p)); headScale.setScalar(s); core.scale.copy(headScale);
    if (drop) { drop.scale.set(1, hp.y / Math.max(1e-4, inK), 1); drop.visible = hp.y > radius * 4; }
    if (area) { const N = area.userData.N; const k = Math.floor(clamp(fx) * (N - 1)); area.geometry.setDrawRange(0, Math.max(0, k) * 6); area.visible = k > 0; }
    dots.forEach((m, i) => { const pass = fx - dotX[i]; m.visible = pass > 0 && p > 0.0005; m.scale.setScalar(Math.max(1e-3, smooth(clamp(pass * 28)))); });
    return g;
  };
  g.draw(0);
  return g;
}

// =====================================================================================================
// donut(fractions, { radius, inner, thickness, highlight, gap, material, face, values, ... })
// Bevelled slices of a ring that sweep in clockwise from 12 o'clock; one is accent and can pop out. Fractions are
// normalised (pass values or fractions). face 'up' lies on the floor (default), 'front' faces the camera (+z).
// =====================================================================================================
function sliceGeometry(r0, r1, span, f, thick, b) {
  const shape = new THREE.Shape(), P = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
  const fo = Math.min(f, (r1 - r0) * 0.45, r1 * span * 0.3), fi = Math.min(f, (r1 - r0) * 0.45, r0 * span * 0.3);
  const ao0 = fo / r1, ao1 = span - fo / r1, ai0 = fi / r0, ai1 = span - fi / r0, step = (1.2 * Math.PI) / 180;
  let p = P(r1, ao0); shape.moveTo(p[0], p[1]);
  const No = Math.max(2, Math.ceil((ao1 - ao0) / step));
  for (let i = 1; i <= No; i++) { p = P(r1, ao0 + ((ao1 - ao0) * i) / No); shape.lineTo(p[0], p[1]); }
  let c = P(r1, span), e = P(r1 - fo, span); shape.quadraticCurveTo(c[0], c[1], e[0], e[1]);
  e = P(r0 + fi, span); shape.lineTo(e[0], e[1]);
  c = P(r0, span); e = P(r0, ai1); shape.quadraticCurveTo(c[0], c[1], e[0], e[1]);
  const Ni = Math.max(2, Math.ceil((ai1 - ai0) / step));
  for (let i = 1; i <= Ni; i++) { p = P(r0, ai1 - ((ai1 - ai0) * i) / Ni); shape.lineTo(p[0], p[1]); }
  c = P(r0, 0); e = P(r0 + fi, 0); shape.quadraticCurveTo(c[0], c[1], e[0], e[1]);
  e = P(r1 - fo, 0); shape.lineTo(e[0], e[1]);
  c = P(r1, 0); e = P(r1, ao0); shape.quadraticCurveTo(c[0], c[1], e[0], e[1]);
  b = Math.min(b, thick * 0.45);
  const depth = Math.max(0.001, thick - 2 * b);
  let geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: 4, curveSegments: 6, steps: 1 });
  geo.translate(0, 0, b);        // bottom at z = 0, top face at z = thick
  geo = bevelNormals(geo, 40, geo.groups[0]?.count ?? 0);
  // polar data for the sweep
  const pos = geo.attributes.position, nor = geo.attributes.normal, N = pos.count;
  const R = new Float32Array(N), A = new Float32Array(N), cA = new Float32Array(N), sA = new Float32Array(N);
  const P0 = Float32Array.from(pos.array), N0 = Float32Array.from(nor.array);
  for (let i = 0; i < N; i++) {
    const x = pos.getX(i), y = pos.getY(i); let a = Math.atan2(y, x); if (a < -1e-4) a += TAU;
    R[i] = Math.hypot(x, y); A[i] = a; cA[i] = Math.cos(a); sA[i] = Math.sin(a);
  }
  const Z = f + b * 1.5 + 1e-4;
  let last = span;
  geo.setSpan = (S) => {
    S = clamp(S, 0, span);
    if (S === last) return; last = S;
    const pa = pos.array, na = nor.array;
    for (let i = 0; i < N; i++) {
      const r = Math.max(R[i], 1e-6), s = A[i] * r, Lf = span * r, Lp = S * r, zf = Math.min(Z, Lf / 2), z = Math.min(zf, Lp / 2);
      let sp;
      if (s <= zf) sp = (s * z) / zf;
      else if (s >= Lf - zf) sp = Lp - ((Lf - s) * z) / zf;
      else sp = z + ((s - zf) * (Lp - 2 * z)) / Math.max(1e-9, Lf - 2 * zf);
      const a = sp / r, ca = Math.cos(a), sa = Math.sin(a);
      const cd = ca * cA[i] + sa * sA[i], sd = sa * cA[i] - ca * sA[i]; // rotation by a - A[i]
      const j = i * 3;
      pa[j] = r * ca; pa[j + 1] = r * sa; pa[j + 2] = P0[j + 2];
      const nx = N0[j], ny = N0[j + 1];
      na[j] = nx * cd - ny * sd; na[j + 1] = nx * sd + ny * cd; na[j + 2] = N0[j + 2];
    }
    pos.needsUpdate = true; nor.needsUpdate = true;
  };
  geo.boundingSphere = new THREE.Sphere(new V3(0, 0, thick / 2), r1 + thick);
  return geo;
}

export function donut(fractions = [0.5, 0.3, 0.2], o = {}) {
  const acc = accentOf(o);
  const tot = fractions.reduce((a, b) => a + Math.max(0, b), 0) || 1;
  const fr = fractions.map((v) => Math.max(0, v) / tot);
  const n = fr.length;
  const R1 = o.radius ?? 1, R0 = R1 * (o.inner ?? 0.6), T = o.thickness ?? R1 * 0.2;
  const hl0 = o.highlight === undefined ? fr.indexOf(Math.max(...fr)) : o.highlight === null ? -1 : o.highlight;
  const hl = hl0 >= 0 && hl0 < n && fr[hl0] > 0 ? hl0 : -1;
  const gap = o.gap ?? R1 * 0.022;
  const bevel = o.bevel ?? Math.min(T * 0.22, (R1 - R0) * 0.12);
  const fillet = o.fillet ?? (R1 - R0) * 0.14;
  const cw = o.clockwise !== false;
  const shades = ['#4b525d', '#3a4049', '#30353d', '#272b32', '#555c67', '#2c3037'];
  const g = propGroup('donut');
  const ring = new THREE.Group(); g.add(ring);
  if ((o.face ?? 'up') === 'up') ring.rotation.x = -Math.PI / 2;
  const sliceMs = [];
  let acc0 = 0;
  const rMid = (R0 + R1) / 2;
  fr.forEach((f, i) => {
    if (!(f > 0)) { const a = Math.PI / 2 + (cw ? -1 : 1) * acc0 * TAU; pin(g, 'slice' + i, rMid * Math.cos(a), rMid * Math.sin(a), T, ring); sliceMs[i] = null; return; }
    const gapA = Math.min(gap / rMid, f * TAU * 0.5);
    const span = Math.max(1e-3, f * TAU - gapA);
    const startA = acc0 * TAU + gapA / 2;   // angle from 12 o'clock, in the sweep direction
    acc0 += f;
    const geo = sliceGeometry(R0, R1, span, fillet, T, bevel);
    const isHl = i === hl;
    const top = isHl ? accentMaterial(acc, o, 0.25) : studio(phys({ color: C(o.colors?.[i] ?? shades[i % shades.length]), metalness: 1, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.1, envMapIntensity: 1.1 }), o);
    const side = isHl ? accentMaterial(acc, o, 0.18) : bodyMaterial(o.material ?? 'metal', { ...o, color: o.colors?.[i] ?? shades[i % shades.length] }, T);
    const mats = o.material && o.material !== 'metal' && !isHl ? [bodyMaterial(o.material, o, T), bodyMaterial(o.material, o, T)] : [top, side];
    const pivot = new THREE.Group(); ring.add(pivot);
    const m = shadowed(new THREE.Mesh(geo, mats));
    // place: the slice's own angle 0 sits at its start; clockwise mirrors it
    const a12 = Math.PI / 2;
    if (cw) { m.scale.x = -1; m.rotation.z = -a12 - startA; } else m.rotation.z = a12 + startA;
    pivot.add(m);
    const mid = cw ? a12 - startA - span / 2 : a12 + startA + span / 2;
    sliceMs[i] = { m, geo, pivot, span, startA, mid, f };
    pin(g, 'slice' + i, rMid * Math.cos(mid), rMid * Math.sin(mid), T, ring);
    if (isHl) pin(g, 'hero', rMid * Math.cos(mid), rMid * Math.sin(mid), T, ring);
  });
  // highlight: a glowing outer rim on the accent slice, and a warm light
  let rim = null, light = null;
  if (hl >= 0) {
    const S = sliceMs[hl], pts = [];
    const rr = R1 - bevel * 0.29;
    for (let i = 0; i <= 96; i++) { const a = S.mid + S.span / 2 - (i / 96) * S.span; pts.push(new V3(rr * Math.cos(a), rr * Math.sin(a), T - bevel * 0.29)); }
    if (!cw) pts.reverse();
    const curve = new THREE.CatmullRomCurve3(pts);
    rim = tube(curve, { radius: (R1 - R0) * 0.012, color: acc, intensity: o.edge ?? 4.5, segments: 192, radial: 8 });
    S.pivot.add(rim);
    if (o.light !== false) { light = new THREE.PointLight(C(acc), 0, R1 * 1.6, 2); light.position.set(rMid * Math.cos(S.mid), rMid * Math.sin(S.mid), T * 0.5); S.pivot.add(light); }
  }
  // printed values lying on each slice ("62%")
  const valueMeshes = [];
  if (o.values) {
    const fmt = typeof o.values === 'function' ? o.values : (f) => `${Math.round(f * 100)}%`;
    fr.forEach((f, i) => {
      const S = sliceMs[i];
      if (!S) return;
      const size = o.valueSize ?? (R1 - R0) * 0.2;
      const Tx = ink(fmt(f, i), size, i === hl ? { color: o.valueColor ?? '#141414', intensity: 1, weight: 800 } : { intensity: 0.85, weight: 800 });
      Tx.position.set(rMid * Math.cos(S.mid), rMid * Math.sin(S.mid), T + R1 * 0.0015);   // lies on the top face
      S.pivot.add(Tx); valueMeshes[i] = Tx;
    });
  }
  pin(g, 'center', 0, (o.face ?? 'up') === 'up' ? T : 0, (o.face ?? 'up') === 'up' ? 0 : T);
  pin(g, 'top', 0, (o.face ?? 'up') === 'up' ? T + R1 * 0.5 : R1 * 1.15, 0);
  g.userData = { radius: Math.hypot(R1, T), center: new V3(0, (o.face ?? 'up') === 'up' ? T / 2 : 0, 0), size: [2 * R1, T, 2 * R1] };
  g.slices = sliceMs;
  const E = easeFn(o.ease ?? 'linear');
  let popV = 0, lightK = 1;
  const setLight = () => { if (light) light.intensity = (o.lightIntensity ?? 1) * 0.07 * R1 * R1 * (0.4 + 0.6 * popV) * lightK; };
  g.grow = (p) => {
    const sweep = E(clamp(p)) * TAU;
    sliceMs.forEach((S, i) => {
      if (!S) return;
      const shown = clamp(sweep - S.startA, 0, S.span);
      S.geo.setSpan(shown);
      S.m.visible = shown > 1e-4;
      if (i === hl && rim) rim.draw(clamp((sweep - S.startA) / S.span));
      if (i === hl) lightK = smooth(clamp((shown / S.span - 0.5) * 2));   // on once the sweep has passed the light
      if (valueMeshes[i]) { const k2 = smooth(clamp((shown / S.span - 0.8) / 0.2)); valueMeshes[i].scale.setScalar(Math.max(1e-4, k2)); valueMeshes[i].visible = k2 > 0.001; }
    });
    setLight();
    return g;
  };
  // pop(v): the accent slice slides out and lifts (0..1)
  g.pop = (v) => {
    popV = v;
    if (hl < 0) return g;
    const S = sliceMs[hl], d = (o.popDistance ?? (R1 - R0) * 0.28) * v;
    S.pivot.position.set(Math.cos(S.mid) * d, Math.sin(S.mid) * d, (o.popLift ?? T * 0.5) * v);
    setLight();
    return g;
  };
  g.pop(0);
  g.grow(1);
  return g;
}

// =====================================================================================================
// stack(count, { item: 'card' | 'coin' | 'brick', perStack, cols, size, hero, ... })
// An instanced pile that fills with a count (one item every 1/count of p, each dropping into place), with one hero
// item that single(v) lifts out, turns to the camera and lights in the accent, for a tag.
// =====================================================================================================
function filletPath(pts, r, segs = 5) {
  const out = [new THREE.Vector2(...pts[0])];
  for (let i = 1; i < pts.length - 1; i++) {
    const R = Array.isArray(r) ? r[i] || 0 : r, [px, py] = pts[i];
    if (!R) { out.push(new THREE.Vector2(px, py)); continue; }
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i + 1];
    const la = Math.hypot(ax - px, ay - py), lb = Math.hypot(bx - px, by - py), t = Math.min(R, la / 2, lb / 2);
    const sx = px + ((ax - px) / la) * t, sy = py + ((ay - py) / la) * t, ex = px + ((bx - px) / lb) * t, ey = py + ((by - py) / lb) * t;
    for (let j = 0; j <= segs; j++) { const u = j / segs, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u; out.push(new THREE.Vector2(a * sx + b * px + c * ex, a * sy + b * py + c * ey)); }
  }
  out.push(new THREE.Vector2(...pts[pts.length - 1]));
  return out;
}
function reedTex(edgeV0, edgeV1, count = 150) {
  const key = `reed${edgeV0.toFixed(3)}${edgeV1.toFixed(3)}${count}`;
  if (sharedTex.has(key)) return sharedTex.get(key);
  const W = 2048, H = 128, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, W, H);
  // concentric fine rings on the faces (v outside the edge band), reeding on the edge
  const y0 = Math.floor((1 - edgeV1) * H), y1 = Math.ceil((1 - edgeV0) * H);
  for (let x = 0; x < W; x++) { const v = 128 + 70 * Math.sin((x / W) * count * TAU); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y0, 1, y1 - y0); }
  for (let y = 0; y < H; y++) if (y < y0 || y > y1) { const v = 128 + 26 * Math.sin(y * 1.9); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, y, W, 1); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8; t.userData.shared = true;
  sharedTex.set(key, t);
  return t;
}
function itemKit(item, size, o, acc) {
  if (item === 'coin') {
    const R = size / 2, t = size * 0.13, rim = R * 0.1, e = t * 0.22, dip = t * 0.12;
    const prof = [[0, dip], [R - rim, dip], [R - rim * 0.55, 0], [R, 0], [R, t], [R - rim * 0.55, t], [R - rim, t - dip], [0, t - dip]];
    const pts = filletPath(prof, [0, rim * 0.3, rim * 0.25, e, e, rim * 0.25, rim * 0.3, 0], 4);
    const geo = new THREE.LatheGeometry(pts, 72);
    // which v the edge occupies (lathe v runs along the profile by point index)
    let i0 = 0, i1 = pts.length - 1; for (let i = 0; i < pts.length; i++) { if (pts[i].x >= R - 1e-6 && i0 === 0) i0 = i; if (pts[i].x >= R - 1e-6) i1 = i; }
    const tex = reedTex(i0 / (pts.length - 1), i1 / (pts.length - 1));
    const col = o.color ?? '#c8ccd3';
    const mat = studio(phys({ color: C(col), metalness: 1, roughness: 0.26, bumpMap: tex, bumpScale: 0.6, envMapIntensity: 1.25, clearcoat: 0.3, clearcoatRoughness: 0.2 }), o);
    const heroM = studio(phys({ color: C(acc), metalness: 1, roughness: 0.24, bumpMap: tex, bumpScale: 0.6, envMapIntensity: 1.25, emissive: C(acc), emissiveIntensity: 0 }), o);
    const edge = () => { const pts2 = []; for (let i = 0; i <= 96; i++) { const a = (i / 96) * TAU; pts2.push(new V3(Math.cos(a) * R * 1.002, t / 2, Math.sin(a) * R * 1.002)); } return new THREE.CatmullRomCurve3(pts2, true); };
    return { geo, mats: mat, heroMats: heroM, h: t, w: R * 2, d: R * 2, edge, edgeR: t * 0.09, faceUp: true, perStack: 14, spin: true, tagAt: { pos: [0, t - dip + size * 0.002, 0], rotX: -Math.PI / 2, size: R * 0.42, width: (R - rim) * 1.6 } };
  }
  if (item === 'brick') {
    const Lb = size, Hb = size * 0.31, Wb = size * 0.48;
    const geo = new RoundedBoxGeometry(Lb, Hb, Wb, 3, Math.min(Hb, Wb) * 0.12);
    geo.translate(0, Hb / 2, 0);
    const col = o.color ?? '#62656b';
    const mat = studio(phys({ color: C(col), metalness: 0, roughness: 0.66, bumpMap: grainTex('grain', 2), bumpScale: 1.4, envMapIntensity: 0.8, clearcoat: 0.2, clearcoatRoughness: 0.45 }), o);
    const heroM = studio(phys({ color: C(acc), metalness: 0.2, roughness: 0.4, bumpMap: grainTex('grain', 2), bumpScale: 0.6, clearcoat: 0.8, clearcoatRoughness: 0.12, emissive: C(acc), emissiveIntensity: 0, envMapIntensity: 1 }), o);
    const edge = () => rectLoop(Lb * 0.985, Wb * 0.985, Math.min(Hb, Wb) * 0.12, Hb * 0.97, 8);
    return { geo, mats: mat, heroMats: heroM, h: Hb, w: Lb, d: Wb, edge, edgeR: Hb * 0.035, faceUp: false, wall: true, tagAt: { pos: [0, Hb / 2, Wb / 2 + size * 0.002], rotX: 0, size: Hb * 0.42, width: Lb * 0.8 } };
  }
  // card (default): a thin bevelled slab, a glossy dark face and brushed metal edges
  const cw = size, ch = size * 0.63, ct = size * 0.035, b = ct * 0.32;
  let geo = new THREE.ExtrudeGeometry(roundedRect(cw, ch, size * 0.07), { depth: Math.max(1e-4, ct - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: 3, curveSegments: 8 });
  geo = bevelNormals(geo, 40, geo.groups[0]?.count ?? 0);
  geo.rotateX(-Math.PI / 2); geo.translate(0, b, 0);   // face up, bottom at y = 0
  const face = studio(phys({ color: C(o.color ?? '#14171c'), metalness: 0.2, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.1 }), o);
  const side = studio(phys({ color: C(o.edgeColor ?? '#363b43'), metalness: 1, roughness: 0.3, anisotropy: 0.6, envMapIntensity: 1.2 }), o);
  const heroFace = studio(phys({ color: C(acc), metalness: 0.6, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06, emissive: C(acc), emissiveIntensity: 0, envMapIntensity: 1.1 }), o);
  const heroSide = studio(phys({ color: C(acc), metalness: 1, roughness: 0.3, envMapIntensity: 1.1, emissive: C(acc), emissiveIntensity: 0 }), o);
  const edge = () => rectLoop(cw * 0.995, ch * 0.995, size * 0.068, ct * 0.5, 10);
  return { geo, mats: [face, side], heroMats: [heroFace, heroSide], h: ct, w: cw, d: ch, edge, edgeR: ct * 0.16, faceUp: true, perStack: 24, tagAt: { pos: [0, ct + size * 0.002, 0], rotX: -Math.PI / 2, size: ch * 0.26, width: cw * 0.82 } };
}

export function stack(count = 100, o = {}) {
  count = Math.max(1, Math.round(count));
  const acc = accentOf(o);
  const item = o.item ?? 'card';
  const size = o.size ?? 0.5;
  const K = itemKit(item, size, o, acc);
  const R = rng(o.seed ?? 7);
  const jit = o.jitter ?? 1;
  const hero = clamp(o.hero ?? count - 1, 0, count - 1);
  const homes = [], rots = [], tilts = [];
  let extent = [0, 0, 0];
  if (K.wall || o.layout === 'wall') {
    const cols = o.cols ?? Math.max(3, Math.round(Math.sqrt(count * 0.5)));
    const gapX = K.w * 0.04, pitchX = K.w + gapX, pitchY = K.h * 1.0;
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols), col = i % cols, off = row % 2 ? pitchX / 2 : 0;
      homes.push(new V3((col - (cols - 1) / 2) * pitchX + off - pitchX / 4, row * pitchY, (R() - 0.5) * 0.02 * K.d * jit));
      rots.push((R() - 0.5) * 0.03 * jit); tilts.push([0, 0]);
    }
    extent = [cols * pitchX, Math.ceil(count / cols) * pitchY, K.d];
  } else {
    const per = o.perStack ?? K.perStack ?? 20;
    const nStacks = Math.ceil(count / per);
    const cols = o.cols ?? Math.ceil(Math.sqrt(nStacks * 1.6));
    const rows = Math.ceil(nStacks / cols);
    const pitchX = K.w * (o.stackGap ?? 1.22), pitchZ = K.d * (o.stackGap ?? 1.22);
    for (let i = 0; i < count; i++) {
      const s = Math.floor(i / per), k = i % per, c = s % cols, r = Math.floor(s / cols);
      const x = (c - (cols - 1) / 2) * pitchX, z = (r - (rows - 1) / 2) * pitchZ;
      homes.push(new V3(x + (R() - 0.5) * K.w * 0.05 * jit, k * K.h * 1.002, z + (R() - 0.5) * K.d * 0.05 * jit));
      rots.push(K.spin ? R() * TAU : (R() - 0.5) * 0.12 * jit);
      tilts.push([(R() - 0.5) * 0.012 * jit, (R() - 0.5) * 0.012 * jit]);
    }
    extent = [cols * pitchX, Math.min(per, count) * K.h, rows * pitchZ];
  }
  const g = propGroup('stack');
  const mesh = new THREE.InstancedMesh(K.geo, K.mats, count);
  mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false;
  const tint = new THREE.Color();
  for (let i = 0; i < count; i++) { const v = 0.82 + R() * 0.3; mesh.setColorAt(i, tint.setRGB(v, v, v)); }
  g.add(mesh);
  const heroMesh = shadowed(new THREE.Mesh(K.geo, K.heroMats)); g.add(heroMesh);
  const edge = tube(K.edge(), { radius: K.edgeR, color: acc, intensity: 0, segments: 160, radial: 8, core: true });
  heroMesh.add(edge);
  const heroLight = o.light !== false ? new THREE.PointLight(C(acc), 0, size * 2.2, 2) : null;
  if (heroLight) { heroLight.position.set(0, K.h * 0.5, 0); heroMesh.add(heroLight); }
  // tag: printed on the hero's face (dark ink on the accent, so it appears as the hero lights up)
  let tagMesh = null;
  if (o.tag != null && K.tagAt) {
    const A = K.tagAt;
    let ts = A.size;
    const wNeed = measureText(String(o.tag), { size: ts, weight: 800 }).width; if (wNeed > A.width) ts *= A.width / wNeed;
    tagMesh = extrude(String(o.tag), { size: ts, depth: 0, material: 'ink', color: o.tagColor ?? '#15120c', intensity: 1, weight: 800, tabular: false, fog: true });
    tagMesh.position.set(...A.pos); tagMesh.rotation.x = A.rotX;
    heroMesh.add(tagMesh);
  }
  const top = extent[1];
  pin(g, 'hero', homes[hero].x, homes[hero].y + K.h, homes[hero].z);
  pin(g, 'top', 0, top + size * 0.4, 0);
  pin(g, 'base', 0, 0, extent[2] / 2);
  pin(g, 'center', 0, top / 2, 0);
  g.userData = { radius: 0.5 * Math.hypot(...extent), center: new V3(0, top / 2, 0), size: extent, count, item };
  g.item = mesh; g.heroMesh = heroMesh;

  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new V3(), Pv = new V3();
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  const fall = o.fall ?? Math.max(4, Math.min(30, count * 0.08));     // items in flight at once
  const dropH = o.drop ?? size * 1.6;
  let lastFill = 0, singleV = 0;
  const pose = (i, p, out) => {
    const a = clamp((p * (count + fall) - i) / fall);
    if (a <= 0) return false;
    const e = 1 - (1 - a) * (1 - a);           // decelerate into place
    const h = homes[i];
    out.pos.set(h.x, h.y + dropH * (1 - e) * (1 - e), h.z);
    out.rot.set(tilts[i][0] + (1 - e) * 0.35 * (hash1(i) - 0.5), rots[i] + (1 - e) * 0.6 * (hash1(i * 3.1) - 0.5), tilts[i][1]);
    out.scale = smooth(clamp(a * 4));            // appears from nothing as it starts to fall (no pop)
    return true;
  };
  const tmp = { pos: new V3(), rot: new THREE.Euler(), scale: 1 };
  // fill(p): 0..1 of the count are in place (p * count items)
  g.fill = (p) => {
    lastFill = p;
    for (let i = 0; i < count; i++) {
      if (i === hero || !pose(i, p, tmp)) { mesh.setMatrixAt(i, ZERO); continue; }
      Q.setFromEuler(tmp.rot); S.setScalar(tmp.scale);
      mesh.setMatrixAt(i, M.compose(tmp.pos, Q, S));
    }
    mesh.instanceMatrix.needsUpdate = true;
    g.single(singleV);
    return g;
  };
  // single(v): the hero lifts out of the pile, turns its face to the camera and lights up (0..1)
  // default: out of the pile, towards the camera (+z) and the middle, above the pile's top
  const hh = homes[hero];
  const isWall = !!(K.wall || o.layout === 'wall');
  const lift = o.lift ?? (isWall ? [-hh.x * 0.7, extent[1] * 0.5 - hh.y, extent[2] / 2 - hh.z + size * 1.1] : [-hh.x * 0.6, Math.max(0, extent[1] * 0.55 - hh.y) + size * 0.45, extent[2] / 2 - hh.z + size * 0.9]);
  const heroMs = [K.heroMats].flat(), baseCols = [K.mats].flat().map((m) => m.color.clone()), accC = C(acc);
  const heroRot = new THREE.Quaternion(), faceCam = new THREE.Quaternion().setFromEuler(new THREE.Euler(K.faceUp ? Math.PI / 2 : 0, 0, 0));
  g.single = (v) => {
    singleV = v;
    const seen = pose(hero, lastFill, tmp);
    heroMesh.visible = seen;
    if (!seen) { const h = homes[hero]; g.anchors.hero.position.set(h.x, h.y + K.h / 2, h.z); return g; } // where it will land
    const e = easeFn('inOutCubic')(clamp(v));
    Q.setFromEuler(tmp.rot); heroRot.copy(Q).slerp(faceCam, e);
    heroMesh.quaternion.copy(heroRot);
    // turn about the item's centre, not its base: pos = centre - R (s c)
    const sc = tmp.scale * (1 + (o.heroScale ?? 0.35) * e);
    heroMesh.scale.setScalar(sc);
    Pv.set(0, (K.h / 2) * sc, 0).applyQuaternion(heroRot);
    const cx = tmp.pos.x + lift[0] * e, cy = tmp.pos.y + K.h / 2 + lift[1] * e, cz = tmp.pos.z + lift[2] * e;
    heroMesh.position.set(cx - Pv.x, cy - Pv.y, cz - Pv.z);
    const k = clamp(v * 1.4);
    heroMs.forEach((m, j) => { m.emissiveIntensity = 0.28 * k; m.color.copy(baseCols[j]).lerp(accC, k); });
    edge.setIntensity(4.5 * k, 7 * k); edge.visible = k > 0.002;
    if (tagMesh) tagMesh.visible = k > 0.25;
    if (heroLight) heroLight.intensity = (o.lightIntensity ?? 1) * 0.07 * (size / 0.5) ** 2 * k;
    g.anchors.hero.position.set(cx, cy, cz);
    return g;
  };
  g.fill(1);
  return g;
}

// =====================================================================================================
// scoreboard({ digits, label, value, ... })
// An in-world counter: a bevelled housing, a glass display, digits in their own cells that glow in the accent,
// leading zeros dimmed. set(value) from the update's frame time ft (update(t, ft)) so digits stay crisp.
// =====================================================================================================
export function scoreboard(o = {}) {
  const acc = o.color ?? accentOf(o);
  const digits = Math.max(1, Math.round(o.digits ?? 6)), decimals = Math.max(0, Math.round(o.decimals ?? 0)), comma = o.comma ?? true;
  const W = o.width ?? 2;
  const font = o.font ?? 'condensed', weight = font === 'condensed' ? 700 : 800;
  const lead = o.leadingZeros ?? 'dim';
  // slot pattern, right to left: digits with group separators, then decimals
  const slots = [];
  for (let i = 0; i < digits; i++) { if (comma && i > 0 && i % 3 === 0) slots.unshift({ kind: 'sep' }); slots.unshift({ kind: 'd', place: i }); }
  if (decimals) { slots.push({ kind: 'dot' }); for (let i = 0; i < decimals; i++) slots.push({ kind: 'dec', place: i }); }
  // measure at size 1 (cap height 1): tabular digit advance, separator advance
  const dAdv = measureText('0', { size: 1, font, weight, tabular: true }).width * 1.62;
  const sAdv = (font === 'condensed' ? 0.42 : 0.38);
  const unitW = o.unit ? measureText(o.unit, { size: 0.42, font, weight }).width + 0.25 : 0;
  const totalU = slots.reduce((a, s) => a + (s.kind === 'sep' || s.kind === 'dot' ? sAdv : dAdv), 0) + unitW;
  const DW = W * 0.86;
  const ds = o.digitSize ?? DW / (totalU + 0.3);                      // digit cap height
  const DH = ds * 1.62;
  const labelSize = o.labelSize ?? ds * 0.26;
  const m = W * 0.07;
  const HH = DH + m * 2 + (o.label ? labelSize * 2.6 : 0), HD = o.depth ?? W * 0.13;
  const g = propGroup('scoreboard');
  const body = shadowed(new THREE.Mesh(new RoundedBoxGeometry(W, HH, HD, 5, Math.min(W * 0.04, HD * 0.45)), studio(phys({ color: C(o.housingColor ?? '#23272e'), metalness: 1, roughness: 0.38, anisotropy: 0.6, envMapIntensity: 1, bumpMap: grainTex('brushed', 3), bumpScale: 0.25 }), o)));
  body.position.y = HH / 2; g.add(body);
  const fz = HD / 2, ez = W * 0.0004;              // layer spacing on the front face
  const dispY = HH - m - DH / 2;
  // display window: a bezel lip, the black display, digit cells, glass
  const bezel = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(DW + m * 0.5, DH + m * 0.5, m * 0.45), 10), studio(phys({ color: C('#0b0c0f'), metalness: 0.6, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 }), o));
  bezel.position.set(0, dispY, fz + ez); g.add(bezel);
  const panel = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(DW, DH, m * 0.3), 10), new THREE.MeshStandardMaterial({ color: C('#020203'), roughness: 0.55, metalness: 0 }));
  panel.position.set(0, dispY, fz + ez * 2); g.add(panel);
  let x = -(totalU * ds) / 2 + 0.15 * ds;
  const cellGeo = new THREE.ShapeGeometry(roundedRect(dAdv * ds * 0.9, DH * 0.84, ds * 0.08), 8);
  const splitGeo = new THREE.PlaneGeometry(dAdv * ds * 0.9, DH * 0.012);
  const cellMat = new THREE.MeshStandardMaterial({ color: C('#0e1014'), roughness: 0.5, metalness: 0.2, emissive: C(acc), emissiveIntensity: 0.012 });
  const splitMat = new THREE.MeshBasicMaterial({ color: C('#000000') });
  const glyphs = [];
  slots.forEach((s) => {
    const adv = (s.kind === 'sep' || s.kind === 'dot' ? sAdv : dAdv) * ds;
    const cx = x + adv / 2;
    if (s.kind === 'd' || s.kind === 'dec') {
      const cell = new THREE.Mesh(cellGeo, cellMat); cell.position.set(cx, dispY, fz + ez * 3); g.add(cell);
      if (o.split !== false) { const sp = new THREE.Mesh(splitGeo, splitMat); sp.position.set(cx, dispY, fz + ez * 4.25); g.add(sp); }
    }
    const T = extrude(s.kind === 'sep' ? ',' : s.kind === 'dot' ? '.' : '0', { size: ds, depth: 0, material: 'ink', color: acc, intensity: o.intensity ?? 3.4, font, weight, tabular: true, valign: 'baseline', fog: false });
    T.position.set(cx, dispY - ds / 2, fz + ez * 3.75);
    g.add(T); glyphs.push({ s, T });
    x += adv;
  });
  if (o.unit) {
    const U = extrude(o.unit, { size: ds * 0.42, depth: 0, material: 'ink', color: acc, intensity: (o.intensity ?? 3.4) * 0.8, font, weight, align: 'left', valign: 'baseline', fog: false });
    U.position.set(x + ds * 0.12, dispY - ds / 2, fz + ez * 3.75); g.add(U);
  }
  // glass over the display: reflections only (adds light, hides nothing)
  const glass = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(DW, DH, m * 0.3), 10), studio(phys({ color: C('#000000'), roughness: 0.04, metalness: 0, envMapIntensity: 1.4, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), o));
  glass.position.set(0, dispY, fz + ez * 5.6); g.add(glass);
  if (o.label) {
    const L = extrude(String(o.label).toUpperCase(), { size: labelSize, depth: 0, material: 'ink', color: '#ffffff', intensity: 0.75, weight: 700, tracking: 0.12, valign: 'middle' });
    L.position.set(0, m + labelSize * 1.1, fz + ez * 2.5); g.add(L);
    pin(g, 'label', 0, m + labelSize * 1.1, fz);
  }
  // a small status light, top left
  if (o.led !== false) { const led = new THREE.Mesh(new THREE.CircleGeometry(W * 0.008, 20), new THREE.MeshBasicMaterial({ color: C(acc).multiplyScalar(5), toneMapped: false })); led.position.set(-W / 2 + m * 0.6, HH - m * 0.5, fz + ez * 1.25); g.add(led); g.led = led; }
  pin(g, 'display', 0, dispY, fz);
  pin(g, 'top', 0, HH + W * 0.08, 0);
  pin(g, 'center', 0, HH / 2, 0);
  g.userData = { radius: 0.5 * Math.hypot(W, HH, HD), center: new V3(0, HH / 2, 0), size: [W, HH, HD], digitSize: ds };
  let glow = 1;
  g.set = (value) => {
    const v = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.\-]/g, '')) || 0;
    const max = 10 ** digits - 10 ** -decimals;
    const s = clamp(Math.abs(v), 0, max).toFixed(decimals);
    let [ip, dp = ''] = s.split('.');
    ip = ip.padStart(digits, '0').slice(-digits);
    const firstSig = ip.search(/[1-9]/), litFrom = firstSig < 0 ? digits - 1 : firstSig;
    for (const { s: sl, T } of glyphs) {
      let ch = '0', lit = true;
      if (sl.kind === 'd') { const idx = digits - 1 - sl.place; ch = ip[idx]; lit = lead !== 'dim' && lead !== 'hide' ? true : idx >= litFrom; }
      else if (sl.kind === 'sep') ch = ',';
      else if (sl.kind === 'dot') ch = '.';
      else if (sl.kind === 'dec') ch = dp[sl.place] ?? '0';
      T.setText(ch);
      T.userData.lit = lit;
    }
    // separators: lit only when a lit digit sits to their left
    let seenLit = false;
    for (const { s: sl, T } of glyphs) {
      if (sl.kind === 'd') seenLit = seenLit || T.userData.lit;
      if (sl.kind === 'sep') T.userData.lit = seenLit;
      const on = T.userData.lit;
      T.visible = on || lead !== 'hide';
      T.setGlow((on ? 1 : (o.dim ?? 0.07)) * glow);
    }
    g.value = v;
    return g;
  };
  g.setGlow = (v) => { glow = v; g.set(g.value ?? 0); cellMat.emissiveIntensity = 0.012 * v; if (g.led) g.led.material.color.copy(C(acc)).multiplyScalar(5 * v); return g; };
  g.set(o.value ?? 0);
  return g;
}
