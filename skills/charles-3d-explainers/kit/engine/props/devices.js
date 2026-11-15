// Tech props: laptop, monitor, server racks, router, cell tower, padlock, stopwatch, magnifier, microwave oven and
// earbuds in their case. Built from primitives, procedural textures and real measurements, with every edge rounded
// or chamfered and small emissive details (LEDs, displays, status lights) that bloom in the film stage.
//
// SCALE   Each prop is modelled from real measurements in metres and then scaled by one factor, perMetre (world units
//         per real metre). Pass the prop's natural size (laptop({ width }), cellTower({ height }), ...) and perMetre
//         follows, or pass perMetre yourself. Defaults are hero scale, about 1-2 world units across, the same scale
//         as phone({ width: 1 }); k.rig(), k.fog() and fx.dust() defaults are tuned for that. To stage props together
//         at true relative size, give them all the same perMetre. REAL lists the real sizes in metres, so a phone at
//         the same scale is phone({ width: REAL.phone * perMetre }).
// ORIGIN  Props stand on y = 0, centred on x and z, front facing +z. Things you hold are centred instead: the
//         stopwatch on its dial, the magnifier on its lens (handle pointing down), earbud() on its head.
// API     Each factory returns a THREE.Group. g.userData = { perMetre, size: [w, h, d] in world units }. g.anchors
//         holds named Object3D markers that move with their part (a lid, a door): use them for labels and focus,
//         e.g. k.ui.label('Screen', { anchor: lap.anchor('screen') }) and k.lens = { blur: 0.02, focus: lap.anchor('screen') };
//         g.anchor(name) throws on a bad name. userData.radius / userData.center: bounding sphere for cam.frame(g).
//         Animated state is set, never accumulated: call setOpen(p), at(t), setTime(s) from update(t) every frame.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat, accentDefault, noiseTexture } from '../look.js';
import { clamp, smooth, hash1, invLerp, ease, rng, ramp, pulse as upulse } from '../util.js';
import { glowSprite } from '../fx.js';
import { roundedRect, planarUV, withAnchors, measureBounds } from './base.js';

const TAU = Math.PI * 2;
const C = (c) => (c && c.isColor ? c.clone() : new THREE.Color(c));
const hot = (c, i) => C(c).multiplyScalar(i);
const deg = THREE.MathUtils.degToRad;

// Real sizes in metres (the dimension each factory's size option refers to).
export const REAL = {
  phone: 0.0715, laptop: 0.304, monitor: 0.623, rackUnit: 0.04445, rack: 2.0, router: 0.24,
  cellTower: 30, padlock: 0.05, stopwatch: 0.055, magnifier: 0.083, microwave: 0.52, earbuds: 0.0606, earbud: 0.0196,
};
// perMetre from the options: explicit perMetre wins, else the size option over the real size, else the default size.
const scaleOf = (o, key, real, def) => (o.perMetre != null ? o.perMetre : (o[key] ?? def) / real);

// ---------- geometry helpers ----------

// A rounded-rectangle slab: plan w (x) by d (z) with corner radius rc, height h along +y from 0, and its top and
// bottom edges rounded ('round') or cut ('chamfer') by their own radius. Normals are analytic, so rounded edges shade
// smoothly and chamfers stay crisp. capTop/capBottom false leaves that end open. uv: caps are planar over the plan;
// sides run u around the perimeter and v up the height (so bump, brushed and anisotropic materials work on them).
export function slabGeometry(w, d, h, { rc = 0, top = 0, bottom = 0, topKind = 'round', bottomKind = 'round', cs = 6, es = 4, capTop = true, capBottom = true } = {}) {
  rc = Math.max(0, Math.min(rc, w / 2, d / 2));
  if (top + bottom > h) { const f = h / (top + bottom); top *= f; bottom *= f; }
  const lim = Math.min(w / 2, d / 2) * 0.999;
  top = Math.min(top, lim); bottom = Math.min(bottom, lim);
  const P = [], N = [], U = [], I = [], n = 4 * (cs + 1);
  // perimeter fraction of each outline point (at inset 0), for side uvs
  const per = [0];
  { let acc = 0; const pts = [];
    for (let c = 0; c < 4; c++) for (let j = 0; j <= cs; j++) { const a = ((c + j / cs) * Math.PI) / 2, hx = w / 2 - rc, hz = d / 2 - rc; pts.push([(c === 0 || c === 3 ? hx : -hx) + Math.cos(a) * rc, (c < 2 ? hz : -hz) + Math.sin(a) * rc]); }
    pts.push(pts[0]);
    for (let i = 1; i < pts.length; i++) { acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); per.push(acc); }
    for (let i = 0; i < per.length; i++) per[i] /= acc || 1; }
  const ring = (e, y, nr, ny, side = true) => {
    const s = P.length / 3, r = Math.max(rc - e, 0), hx = w / 2 - Math.max(rc, e), hz = d / 2 - Math.max(rc, e), L = Math.hypot(nr, ny) || 1;
    for (let i = 0; i <= n; i++) {
      const c = Math.floor((i % n) / (cs + 1)), j = (i % n) % (cs + 1);
      const a = ((c + j / cs) * Math.PI) / 2, ca = Math.cos(a), sa = Math.sin(a);
      const x = (c === 0 || c === 3 ? hx : -hx) + ca * r, z = (c < 2 ? hz : -hz) + sa * r;
      P.push(x, y, z); N.push((ca * nr) / L, ny / L, (sa * nr) / L);
      if (side) U.push(per[i], y / h); else U.push(x / w + 0.5, 0.5 - z / d);
    }
    return s;
  };
  const tri = (a, b, c) => {
    const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
    const ux = P[b * 3] - ax, uy = P[b * 3 + 1] - ay, uz = P[b * 3 + 2] - az, vx = P[c * 3] - ax, vy = P[c * 3 + 1] - ay, vz = P[c * 3 + 2] - az;
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    const dn = cx * (N[a * 3] + N[b * 3] + N[c * 3]) + cy * (N[a * 3 + 1] + N[b * 3 + 1] + N[c * 3 + 1]) + cz * (N[a * 3 + 2] + N[b * 3 + 2] + N[c * 3 + 2]);
    if (dn < 0) I.push(a, c, b); else I.push(a, b, c);
  };
  const band = (a, b) => { for (let i = 0; i < n; i++) { tri(a + i, b + i, a + i + 1); tri(a + i + 1, b + i, b + i + 1); } };
  const cap = (e, y, ny) => {
    const r0 = ring(e, y, 0, ny, false), c0 = P.length / 3;
    P.push(0, y, 0); N.push(0, ny, 0); U.push(0.5, 0.5);
    for (let i = 0; i < n; i++) tri(c0, r0 + i, r0 + i + 1);
  };
  if (capBottom) cap(bottom, 0, -1);
  if (bottom > 0) {
    if (bottomKind === 'chamfer') band(ring(bottom, 0, 1, -1), ring(0, bottom, 1, -1));
    else { let p = -1; for (let i = 0; i <= es; i++) { const f = ((1 - i / es) * Math.PI) / 2; const r = ring(bottom * (1 - Math.cos(f)), bottom * (1 - Math.sin(f)), Math.cos(f), -Math.sin(f)); if (p >= 0) band(p, r); p = r; } }
  }
  if (h - top - bottom > 1e-9) band(ring(0, bottom, 1, 0), ring(0, h - top, 1, 0));
  if (top > 0) {
    if (topKind === 'chamfer') band(ring(0, h - top, 1, 1), ring(top, h, 1, 1));
    else { let p = -1; for (let i = 0; i <= es; i++) { const f = ((i / es) * Math.PI) / 2; const r = ring(top * (1 - Math.cos(f)), h - top + top * Math.sin(f), Math.cos(f), Math.sin(f)); if (p >= 0) band(p, r); p = r; } }
  }
  if (capTop) cap(top, h, 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  geo.setIndex(I);
  return geo;
}
// A slab turned to face +z: plan w x d becomes width x height, h becomes the thickness (centred on z = 0, top = front).
const standUp = (geo, h) => geo.rotateX(Math.PI / 2).translate(0, 0, -h / 2);

// Round off the corners of a 2D polyline (quadratic fillets). For lathe profiles. r: one radius or one per point.
function fillet(pts, r, segs = 5) {
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
// A lathe around y from a profile [[r, y], ...] traversed with the solid on its left (outer surface going up).
const lathe = (pts, r = 0, segs = 64, fs = 5) => new THREE.LatheGeometry(fillet(pts, r, fs), segs);

// Merge geometries that share a material into one draw call (position/normal/uv only).
function merge(list) {
  return mergeGeometries(list.map((g) => {
    const x = g.index ? g.toNonIndexed() : g.clone();
    for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(k)) x.deleteAttribute(k);
    if (!x.attributes.uv) x.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2));
    x.clearGroups();
    return x;
  }), false);
}
function mesh(geo, material, { cast = true, receive = true } = {}) { const m = new THREE.Mesh(geo, material); m.castShadow = cast; m.receiveShadow = receive; return m; }
// a decal: drawn over the surface it sits on without z-fighting
function decal(m) { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -4; return m; }
function anchor(parent, name, pos, store) { const o = new THREE.Object3D(); o.name = name; o.position.copy(pos); parent.add(o); store[name] = o; return o; }
// Thin glass: reflections only (adds light, hides nothing), so it needs no transmission pass. Pair with a tint layer.
const glassSkin = ({ env = 1.4, rough = 0.03 } = {}) => new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: rough, metalness: 0, envMapIntensity: env, clearcoat: 0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
const tint = (color = '#000000', opacity = 0.35) => new THREE.MeshBasicMaterial({ color: C(color), transparent: true, opacity, depthWrite: false });
const ledMat = (color, intensity) => new THREE.MeshBasicMaterial({ color: hot(color, intensity), toneMapped: false });
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const canvasTex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

// A painter that draws the same shapes into albedo, roughness/metalness (g/b), bump and emission canvases at once,
// so one drawing routine makes a full PBR face (server bezels, router tops, panels).
function painter(W, H) {
  const L = {}; for (const k of ['albedo', 'rm', 'bump', 'emit']) L[k] = canvas(W, H);
  const grey = (v) => { const x = Math.round(clamp(v) * 255); return `rgb(${x},${x},${x})`; };
  const P = {
    W, H,
    fill(path, m) {
      for (const k in L) {
        const g = L[k][1];
        g.beginPath(); path(g);
        g.fillStyle = k === 'albedo' ? m.color : k === 'rm' ? `rgb(0,${Math.round(clamp(m.rough ?? 0.5) * 255)},${Math.round(clamp(m.metal ?? 0) * 255)})` : k === 'bump' ? grey(m.height ?? 0.5) : grey(m.emit ?? 0);
        g.fill(m.rule || 'nonzero');
      }
    },
    rect(x, y, w, h, m, r = 0) { P.fill((g) => (r ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h)), m); },
    circle(x, y, r, m) { P.fill((g) => g.arc(x, y, r, 0, TAU), m); },
    // a honeycomb of hex holes (cell = hole spacing in px) clipped to a rect
    hex(x, y, w, h, cell, m, hole = 0.78) {
      P.fill((g) => {
        const rr = (cell / Math.sqrt(3)) * hole, dy = cell * 0.866;
        for (let j = 0, yy = y + rr; yy < y + h - rr * 0.8; j++, yy += dy) for (let xx = x + rr + (j % 2 ? cell / 2 : 0); xx < x + w - rr * 0.8; xx += cell) {
          for (let a = 0; a < 6; a++) { const t = (a / 6) * TAU + Math.PI / 6, px = xx + Math.cos(t) * rr, py = yy + Math.sin(t) * rr; a ? g.lineTo(px, py) : g.moveTo(px, py); }
          g.closePath();
        }
      }, m);
    },
    dots(x, y, w, h, pitch, r, m) { P.fill((g) => { for (let yy = y + pitch / 2; yy < y + h; yy += pitch) for (let xx = x + pitch / 2; xx < x + w; xx += pitch) { g.moveTo(xx + r, yy); g.arc(xx, yy, r, 0, TAU); } }, m); },
    text(str, x, y, font, m, align = 'center') { for (const k in L) { const g = L[k][1]; g.font = font; g.textAlign = align; g.textBaseline = 'middle'; g.fillStyle = k === 'albedo' ? m.color : k === 'rm' ? `rgb(0,${Math.round((m.rough ?? 0.5) * 255)},${Math.round((m.metal ?? 0) * 255)})` : k === 'bump' ? grey(m.height ?? 0.5) : grey(m.emit ?? 0); g.fillText(str, x, y); } },
    material({ bump = 1, emissive = '#000000', emissiveIntensity = 0, clearcoat = 0, env = 1 } = {}) {
      const map = canvasTex(L.albedo[0]), rm = canvasTex(L.rm[0], false), bm = canvasTex(L.bump[0], false), em = canvasTex(L.emit[0]);
      return new THREE.MeshPhysicalMaterial({ map, roughnessMap: rm, metalnessMap: rm, roughness: 1, metalness: 1, bumpMap: bm, bumpScale: bump, emissiveMap: em, emissive: C(emissive), emissiveIntensity, clearcoat, clearcoatRoughness: 0.1, envMapIntensity: env });
    },
  };
  return P;
}

// A generic desktop wallpaper (soft light ribbons, optional menu bar and dock, no logos). Default screen for the
// laptop and monitor; also good on phone.setScreen(). Returns a CanvasTexture.
export function wallpaper({ w = 1600, h = 1034, accent = accentDefault(), glow = '#5aa8ff', bg = ['#13213d', '#05070d'], ui = true } = {}) {
  const [c, g] = canvas(w, h);
  const lg = g.createLinearGradient(0, 0, w * 0.35, h); lg.addColorStop(0, bg[0]); lg.addColorStop(1, bg[1]); g.fillStyle = lg; g.fillRect(0, 0, w, h);
  g.filter = `blur(${Math.round(h * 0.035)}px)`;
  const ribbon = (y0, amp, freq, col, alpha, width) => {
    g.strokeStyle = col; g.globalAlpha = alpha; g.lineWidth = width; g.lineCap = 'round'; g.beginPath();
    for (let i = 0; i <= 80; i++) { const x = (i / 80) * w * 1.3 - w * 0.15, y = y0 + Math.sin(i * freq + y0 * 0.003) * amp + Math.sin(i * freq * 2.7) * amp * 0.25; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  };
  const deep = '#' + C(accent).offsetHSL(-0.045, 0.05, -0.13).getHexString(); // a deeper shade of the accent
  ribbon(h * 0.66, h * 0.13, 0.075, accent, 0.75, h * 0.16);
  ribbon(h * 0.74, h * 0.1, 0.06, deep, 0.5, h * 0.07);
  ribbon(h * 0.36, h * 0.09, 0.05, glow, 0.45, h * 0.18);
  g.filter = 'none'; g.globalAlpha = 1;
  if (ui) {
    g.fillStyle = 'rgba(8,10,16,0.55)'; g.fillRect(0, 0, w, h * 0.03);
    g.fillStyle = 'rgba(255,255,255,0.75)'; for (let i = 0; i < 5; i++) g.fillRect(w * 0.02 + i * w * 0.05, h * 0.011, w * 0.03, h * 0.008);
    const n = 8, s = h * 0.07, gap = s * 0.26, dw = n * s + (n + 1) * gap, dx = (w - dw) / 2, dy = h - s - gap * 2.4;
    g.fillStyle = 'rgba(255,255,255,0.14)'; g.beginPath(); g.roundRect(dx, dy - gap, dw, s + gap * 2, s * 0.36); g.fill();
    const cols = [[accent, deep], ['#6cb6ff', '#2f5bff'], ['#8dffbf', '#16a85e'], ['#f4f4f4', '#9aa0a8'], ['#ff7b95', '#c4365a'], ['#ffd77a', '#ff9a2c'], ['#a597ff', '#5a44d6'], ['#5fe0ff', '#1689b8']];
    cols.forEach(([a, b], i) => { const x = dx + gap + i * (s + gap); const gg = g.createLinearGradient(x, dy, x, dy + s); gg.addColorStop(0, a); gg.addColorStop(1, b); g.fillStyle = gg; g.beginPath(); g.roundRect(x, dy, s, s, s * 0.24); g.fill(); });
  }
  return canvasTex(c);
}

// A soft contact shadow to put under a prop resting on a floor (shadow maps alone leave props looking light).
// contactShadow({ width, depth }) sized to the prop's footprint (g.userData.footprint); add it at the prop's x/z.
// shape: 'box' (a rounded box, for cases, phones, ovens) or 'round' (an ellipse width x depth, for bowls, cups, cans,
// and anything on glass, which takes no shadow map).
export function contactShadow({ width = 1, depth = 1, opacity = 0.55, spread = 0.35, shape = 'box' } = {}) {
  const [c, g] = canvas(256, 256);
  const img = g.createImageData(256, 256), round = shape === 'round';
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    // solid in the middle, soft towards the edge of the spread: a rounded-box falloff, or a radial one
    const u = Math.abs(x / 255 - 0.5) * 2, v = Math.abs(y / 255 - 0.5) * 2, k = 1 / (1 + spread);
    let a;
    if (round) { const q = Math.hypot(u, v), r = clamp((q - k * 0.7) / (1 - k * 0.7)); a = Math.pow(1 - r, 2.2) * (0.6 + 0.4 * (1 - clamp(q))); }
    else { const du = Math.max(0, u - k) / (1 - k), dv = Math.max(0, v - k) / (1 - k), r = Math.min(1, Math.hypot(du, dv)); a = Math.pow(1 - r, 2.2) * (0.55 + 0.45 * (1 - Math.max(u, v))); }
    img.data.set([255, 255, 255, Math.round(a * 255)], (y * 256 + x) * 4);
  }
  g.putImageData(img, 0, 0);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width * (1 + spread), depth * (1 + spread)), new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: canvasTex(c, false), transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.0005; m.renderOrder = -1;
  return m;
}

// ---------- phone screens: HTML templates for k.screen ----------
// Each returns { w, h, html, css, background, set(root, state) }: k.screen(it) builds the screen, and set() turns one
// frame's state (numbers 0..1 you work out from t with k.ramp) into the DOM, so the screen stays a pure function of t.
// Both are laid out for a phone at 3x (1179 x 2556) and scaled to w x h.
const rgbOf = (c) => { const x = C(c).getHex(); return `${(x >> 16) & 255},${(x >> 8) & 255},${x & 255}`; };
const lcg = (seed) => { let v = seed >>> 0 || 1; return () => ((v = (v * 1664525 + 1013904223) >>> 0) / 4294967296); };
const fitCss = (w, h) => `.fit{position:absolute;left:0;top:0;width:1179px;height:2556px;transform-origin:0 0;transform:scale(${w / 1179},${h / 2556})}`;

// mapScreen(o): a night-mode street map: your location dot in the accent with its accuracy circle, a ping ring, other
// receivers (cars, phones) around you and a location card.
//   const map = props.mapScreen({ seed: 3 });
//   const scr = await k.screen(map);
//   scr.update = (t, root) => map.set(root, { accuracy: k.ramp(t, t1 - 0.1, t1 + 0.45, 'inOutCubic'), card: k.ramp(t, t2, t2 + 0.3) });
//   phone.setScreen(scr.texture);
// set(root, { accuracy 0..1: the circle shrinks from 900 to 150 px onto your dot; ping 0..1: a ring leaves the dot
// (hidden at 0 and 1); card 0..1: the card rises in; scale: the map's zoom (1; 0.42 shows the receivers around you);
// dots 0..1: the receivers appear, staggered }). Options: w, h, seed (the streets), accent, dots (90), spread (how far
// out they lie, in screen widths), title ('My Location'), place (the card's value, HTML), background.
export function mapScreen({ w = 1179, h = 2556, seed = 3, accent = accentDefault(), dots = 90, spread = 2.4, title = 'My Location', place = '40.71283&deg; N<br>74.00602&deg; W', background = '#0d0f13' } = {}) {
  const R = lcg(seed), W = 1179, H = 2556, sc = 2.4, MW = W * sc, MH = H * sc, ox = -(MW - W) / 2, oy = -(MH - H) / 2, a = rgbOf(accent);
  // the map, drawn 2.4 times the screen so it can zoom out: a river, parks, a street grid turned a little, arterials
  const parts = [`<rect x="${ox}" y="${oy}" width="${MW}" height="${MH}" fill="#101318"/>`];
  let d = `M ${ox} ${oy + MH * 0.68}`;
  for (let i = 1; i <= 8; i++) d += ` S ${ox + (MW * i) / 8 - MW / 16} ${oy + MH * (0.64 + 0.05 * Math.sin(i * 1.3))} ${ox + (MW * i) / 8} ${oy + MH * (0.66 + 0.04 * Math.sin(i * 0.9 + 1))}`;
  parts.push(`<path d="${d}" stroke="#0d2236" stroke-width="150" fill="none"/>`);
  for (let i = 0; i < 7; i++) parts.push(`<rect x="${ox + R() * MW}" y="${oy + R() * MH}" width="${180 + R() * 320}" height="${140 + R() * 260}" rx="26" fill="#11201a"/>`);
  const grid = [];
  for (let x = -MW; x < MW * 2; x += 150) grid.push(`<line x1="${x}" y1="${-MH}" x2="${x}" y2="${MH * 2}" stroke="#262b33" stroke-width="${R() < 0.15 ? 26 : 12}"/>`);
  for (let y = -MH; y < MH * 2; y += 172.5) grid.push(`<line x1="${-MW}" y1="${y}" x2="${MW * 2}" y2="${y}" stroke="#262b33" stroke-width="${R() < 0.15 ? 26 : 12}"/>`);
  parts.push(`<g transform="rotate(-18 ${W / 2} ${H / 2})">${grid.join('')}</g>`);
  parts.push(`<path d="M ${ox} ${oy + MH * 0.2} L ${ox + MW} ${oy + MH * 0.48}" stroke="#3b4250" stroke-width="34" fill="none"/>`, `<path d="M ${ox + MW * 0.3} ${oy} L ${ox + MW * 0.62} ${oy + MH}" stroke="#3b4250" stroke-width="30" fill="none"/>`, `<path d="M ${ox + MW * 0.85} ${oy} C ${ox + MW * 0.7} ${oy + MH * 0.4} ${ox + MW * 0.95} ${oy + MH * 0.6} ${ox + MW * 0.78} ${oy + MH}" stroke="#3b4250" stroke-width="26" fill="none"/>`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="position:absolute;left:0;top:0;overflow:visible">${parts.join('')}</svg>`;
  const rx = Array.from({ length: dots }, () => { const an = R() * TAU, r = (0.12 + 0.88 * Math.sqrt(R())) * 0.5 * spread; return { x: W / 2 + Math.cos(an) * r * W, y: H / 2 + Math.sin(an) * r * W * 1.4, d: R() }; });
  const css = `${fitCss(w, h)} .app{position:absolute;inset:0;background:${background};overflow:hidden;font-family:Inter;color:#fff}
    .map{position:absolute;inset:0;transform-origin:50% 50%}
    .o{position:absolute;left:50%;top:50%;border-radius:50%;transform:translate(-50%,-50%)}
    .acc{background:rgba(${a},.16);border:5px solid rgba(${a},.55)}
    .me{width:74px;height:74px;background:${accent};box-shadow:0 0 0 12px #fff,0 0 70px 26px rgba(${a},.55)}
    .ping{border:8px solid ${accent}}
    .rx{position:absolute;width:24px;height:24px;border-radius:50%;background:#e8e2d6;box-shadow:0 0 22px 6px rgba(232,226,214,.35);transform:translate(-50%,-50%)}
    .bar{position:absolute;left:0;right:0;top:0;height:150px;background:linear-gradient(${background},rgba(13,15,19,0))}
    .sb{position:absolute;top:58px;left:110px;right:110px;display:flex;justify-content:space-between;font:600 48px Inter;color:#f4efe8}
    .card{position:absolute;left:46px;right:46px;top:200px;padding:44px 52px;border-radius:56px;background:#1a1d24;box-shadow:0 20px 60px rgba(0,0,0,.6)}
    .card .k{font:600 46px Inter;color:#9aa1ad;letter-spacing:.02em}
    .card .v{font:700 76px/1.15 Inter;margin-top:12px;font-variant-numeric:tabular-nums;letter-spacing:-.01em}`;
  const html = `<div class="fit"><div class="app"><div class="map">${svg}
      ${rx.map((p) => `<div class="rx" style="left:${p.x.toFixed(1)}px;top:${p.y.toFixed(1)}px;opacity:0"></div>`).join('')}
      <div class="o acc" style="width:900px;height:900px"></div><div class="o ping" style="width:74px;height:74px;opacity:0"></div><div class="o me"></div></div>
    <div class="bar"></div><div class="sb"><span>9:41</span><span>&#9679;&#9679;&#9679;</span></div>
    <div class="card" style="opacity:0"><div class="k">${title}</div><div class="v">${place}</div></div></div></div>`;
  const set = (root, { accuracy = 0, ping = 0, card = 0, scale = 1, dots: dv = 0 } = {}) => {
    root.querySelector('.map').style.transform = `scale(${scale})`;
    const acc = root.querySelector('.acc'), ac = clamp(accuracy), sz = 900 - 750 * ac;
    acc.style.width = acc.style.height = `${sz}px`; acc.style.opacity = 1 - 0.55 * ac;
    const pg = root.querySelector('.ping'), pp = clamp(ping);
    pg.style.width = pg.style.height = `${74 + 420 * pp}px`; pg.style.opacity = pp > 0 && pp < 1 ? 1 - pp : 0;
    const cd = root.querySelector('.card'), c = clamp(card);
    cd.style.opacity = c; cd.style.transform = `translateY(${(1 - c) * 60}px)`;
    root.querySelectorAll('.rx').forEach((el, i) => { el.style.opacity = clamp((dv - 0.75 * rx[i].d) / 0.25).toFixed(3); });
  };
  return { w, h, html, css, background, set, receivers: rx };
}

// nowPlayingScreen(o): a music player's Now Playing screen: generic sunset-road cover art, a live waveform in the
// accent, progress, controls, and a "Connected" card for earbuds that rises from the bottom.
//   const np = props.nowPlayingScreen({ title: 'Night Drive', artist: 'Neon Coast' });
//   const scr = await k.screen(np);
//   scr.update = np.timeline({ play: k.word('play'), connect: k.word('connect') });  // or (t, root) => np.set(root, { t, ... })
// set(root, { t (shot time; moves the waveform), playing 0..1 (play icon -> pause, the art grows), press 0..1 (the
// button dips), ring 0..1 (a ring leaves the button), wave 0..1 (waveform height; default = playing), bits 0..1 (every
// other bar fades: "turned into bits"), card 0..1 (the connected card), elapsed (seconds into the song) }).
// timeline({ play, connect, wave, bits }) returns an update(t, root) that runs those beats at those shot times (omit
// any): the press and ring on play, the card up 0.3 s from connect and away 1.1 s later. Options: w, h, title, artist,
// device ('Earbuds': the card's title), accent, seed (the waveform), elapsed (42 s), length (213 s), background.
export function nowPlayingScreen({ w = 1179, h = 2556, title = 'Night Drive', artist = 'Neon Coast', device = 'Earbuds', accent = accentDefault(), seed = 11, elapsed = 42, length = 213, background = '#060608' } = {}) {
  const a = rgbOf(accent), R = rng(seed), seeds = Array.from({ length: 34 }, () => [0.25 + R() * 0.75, 1 + R() * 3, R() * TAU]);
  const mmss = (v) => `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}`;
  const css = `${fitCss(w, h)} .app{position:absolute;inset:0;background:radial-gradient(120% 70% at 50% 18%,#2a1d14 0%,#0d0b0c 55%,${background} 100%);font-family:Inter;color:#f4efe8;overflow:hidden}
    .sb{position:absolute;top:58px;left:110px;right:110px;display:flex;justify-content:space-between;font:600 48px Inter;color:#f4efe8}
    .art{position:absolute;left:150px;top:300px;width:879px;height:879px;border-radius:44px;overflow:hidden;transform-origin:50% 50%;
      background:linear-gradient(180deg,#120f1f 0%,#2b1830 38%,#7a3a2a 58%,#e08a3a 66%,#2a1410 66.4%,#120b0a 100%);box-shadow:0 40px 90px rgba(0,0,0,.6)}
    .sun{position:absolute;left:50%;top:44%;width:420px;height:420px;margin-left:-210px;border-radius:50%;background:radial-gradient(circle,#fff1c9 0%,#ffcf7a 35%,#ffb43c 62%,rgba(255,140,40,0) 72%)}
    .cut{position:absolute;left:0;right:0;height:16px;background:#2b1830}
    .road{position:absolute;left:50%;bottom:0;width:0;height:0;border-left:300px solid transparent;border-right:300px solid transparent;border-bottom:300px solid #1d1110;margin-left:-300px}
    .lane{position:absolute;left:50%;bottom:0;width:10px;height:290px;margin-left:-5px;background:linear-gradient(#ffb43c00,#ffcf7a);clip-path:polygon(45% 0,55% 0,100% 100%,0 100%)}
    .meta{position:absolute;left:150px;right:150px;top:1260px} .tt{font:800 74px/1.1 Inter;letter-spacing:-1px} .ar{font:500 52px/1.3 Inter;color:#a59d95;margin-top:10px}
    .wave{position:absolute;left:150px;right:150px;top:1480px;height:230px;display:flex;align-items:center;justify-content:space-between}
    .wave i{display:block;width:14px;border-radius:7px;background:${accent};opacity:.95}
    .prog{position:absolute;left:150px;right:150px;top:1780px;height:14px;border-radius:7px;background:#3a3532;overflow:hidden}
    .fill{position:absolute;left:0;top:0;bottom:0;background:#f4efe8;border-radius:7px}
    .times{position:absolute;left:150px;right:150px;top:1820px;display:flex;justify-content:space-between;font:600 38px Inter;color:#8d8580}
    .ctl{position:absolute;left:150px;right:150px;top:1960px;height:220px;display:flex;align-items:center;justify-content:space-between}
    .pp{position:relative;width:220px;height:220px} .pp svg{position:absolute;inset:0}
    .ring{position:absolute;inset:-30px;border-radius:50%;border:8px solid ${accent};opacity:0}
    .card{position:absolute;left:46px;right:46px;bottom:46px;height:900px;border-radius:90px;background:#1e1c1f;opacity:0;transform:translateY(120px);display:flex;flex-direction:column;align-items:center;padding-top:70px;box-shadow:0 -20px 80px rgba(0,0,0,.5)}
    .cardT{font:700 64px Inter;color:#f4efe8} .pods{position:relative;width:420px;height:420px;margin-top:40px}
    .bud{position:absolute;top:40px;width:130px;height:330px} .bud b{position:absolute;left:0;top:0;width:130px;height:130px;border-radius:60px;background:#f5f5f2}
    .bud s{position:absolute;left:40px;top:90px;width:50px;height:240px;border-radius:25px;background:#f5f5f2;text-decoration:none}
    .cardS{font:600 52px Inter;color:#9a938d;margin-top:20px;display:flex;align-items:center;gap:18px}
    .chk{width:56px;height:56px;border-radius:50%;background:${accent};display:flex;align-items:center;justify-content:center;box-shadow:0 0 30px rgba(${a},.5)}`;
  const play = `<svg width="220" height="220" viewBox="0 0 220 220"><circle cx="110" cy="110" r="106" fill="#f4efe8"/><g class="pl"><path d="M88 66 L156 110 L88 154 Z" fill="#141210"/></g>
    <g class="pa" opacity="0"><rect x="76" y="68" width="24" height="84" rx="6" fill="#141210"/><rect x="120" y="68" width="24" height="84" rx="6" fill="#141210"/></g></svg>`;
  const skip = (dir) => `<svg width="140" height="100" viewBox="0 0 140 100" style="transform:scaleX(${dir})"><path d="M10 10 L65 50 L10 90Z M70 10 L125 50 L70 90Z" fill="#f4efe8"/></svg>`;
  const html = `<div class="fit"><div class="app"><div class="sb"><span>9:41</span><span>&#9679;&#9679;&#9679;</span></div>
    <div class="art"><div class="sun"></div><div class="cut" style="top:52%"></div><div class="cut" style="top:56%;height:12px"></div><div class="cut" style="top:59.5%;height:9px"></div><div class="cut" style="top:62.5%;height:6px"></div><div class="road"></div><div class="lane"></div></div>
    <div class="meta"><div class="tt">${title}</div><div class="ar">${artist}</div></div>
    <div class="wave">${seeds.map(() => '<i></i>').join('')}</div>
    <div class="prog"><div class="fill"></div></div><div class="times"><span class="t0"></span><span class="t1"></span></div>
    <div class="ctl">${skip(-1)}<div class="pp"><div class="ring"></div>${play}</div>${skip(1)}</div>
    <div class="card"><div class="cardT">${device}</div><div class="pods"><div class="bud" style="left:80px"><b></b><s></s></div><div class="bud" style="left:210px;transform:scaleX(-1)"><b></b><s></s></div></div>
      <div class="cardS"><span class="chk"><svg width="34" height="34" viewBox="0 0 34 34"><path d="M7 18 L14 25 L28 9" stroke="#141210" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>Connected</div></div></div></div>`;
  const set = (root, { t = 0, playing = 1, press = 0, ring = 0, wave = null, bits = 0, card = 0, elapsed: el = elapsed } = {}) => {
    const cd = root.querySelector('.card'), c = clamp(card);
    cd.style.opacity = c; cd.style.transform = `translateY(${(1 - c) * 120}px)`;
    root.querySelector('.pp').style.transform = `scale(${1 - 0.12 * clamp(press)})`;
    root.querySelector('.pl').setAttribute('opacity', 1 - playing); root.querySelector('.pa').setAttribute('opacity', playing);
    const rg = root.querySelector('.ring'); rg.style.opacity = ring > 0 && ring < 1 ? (1 - ring) * 0.9 : 0; rg.style.transform = `scale(${1 + 0.5 * ring})`;
    root.querySelector('.art').style.transform = `scale(${0.86 + 0.14 * playing})`;
    const e = clamp(el, 0, length);
    root.querySelector('.fill').style.width = `${(100 * e) / length}%`;
    root.querySelector('.t0').textContent = mmss(e); root.querySelector('.t1').textContent = '-' + mmss(length - e);
    const amp = wave ?? playing;
    root.querySelectorAll('.wave i').forEach((b, i) => {
      const [k, f, ph] = seeds[i];
      b.style.height = `${14 + (0.15 + 0.85 * k * (0.55 + 0.45 * Math.sin(t * f * 2.2 + ph))) * 210 * amp}px`;
      b.style.opacity = String(0.95 * (1 - bits * (i % 2 ? 0.8 : 0.55)));
    });
  };
  const timeline = ({ play = null, connect = null, wave = null, bits = null } = {}) => (t, root) => {
    const playing = play != null ? ramp(t, play, play + 0.12) : 1;
    set(root, {
      t, playing,
      press: play != null ? upulse(t, play - 0.08, 0.08, 0.02, 0.18) : 0,
      ring: play != null ? ramp(t, play, play + 0.6, 'outCubic') : 0,
      wave: wave != null ? ramp(t, wave - 0.15, wave + 0.35, 'outCubic') : null,
      bits: bits != null ? ramp(t, bits - 0.1, bits + 0.5) : 0,
      card: connect != null ? ramp(t, connect - 0.05, connect + 0.3, 'outCubic') * (1 - ramp(t, connect + 1.1, connect + 1.4, 'inCubic')) : 0,
      elapsed: elapsed + (play != null ? Math.max(0, t - play) : t + 10) * playing,
    });
  };
  return { w, h, html, css, background, set, timeline };
}

// ---------- laptop ----------
const ALU = { silver: '#d4d7db', space: '#80838a', midnight: '#363c4a', starlight: '#e3d8c4', black: '#2b2d31' };
const shade = (hex, k) => '#' + C(hex).multiplyScalar(k).getHexString();

// laptop({ width = 1.2, open = 1, color, screen, glow, angle = 112, backlight = 0 }): a thin aluminium laptop.
// width: across the base (real 0.304 m). color: silver | space | midnight | starlight | black | any hex.
// lap.setOpen(0..1) swings the lid (0 closed, 1 = angle degrees); the screen wakes as it opens (wake: false keeps it
// lit). lap.setScreen(texture) shows a k.screen() or image (aspect lap.userData.screenAspect, about 1.55:1);
// lap.setGlow(v), lap.setBacklight(v) (keyboard glow in accent). Anchors: screen, keyboard, trackpad, hinge.
export function laptop(o = {}) {
  const { open = 1, color = 'silver', screen = null, glow = 1.1, angle = 112, backlight = 0, accent = accentDefault(), wake = true } = o;
  const s = scaleOf(o, 'width', REAL.laptop, 1.2);
  const W = 0.304 * s, D = 0.215 * s, BH = 0.0072 * s, LH = 0.0042 * s, RC = 0.011 * s, FT = 0.0012 * s, deckY = FT + BH;
  const g = new THREE.Group(); g.name = 'laptop'; g.anchors = {};
  const alu = mat.metal(ALU[color] || color, { rough: 0.38, env: 1.6 });
  const base = mesh(slabGeometry(W, D, BH, { rc: RC, top: 0.0007 * s, topKind: 'chamfer', bottom: 0.0026 * s, cs: 8, es: 5 }), alu);
  base.position.y = FT; g.add(base);
  // keyboard: 78 keys merged into one mesh, in a dark well
  const u = 0.0185 * s, gap = 0.0028 * s, kh = 0.0009 * s, z0 = -D / 2 + 0.0135 * s, x0 = -7.25 * u;
  const rows = [[0.55, [1.5, ...Array(12).fill(1), 1]], [1, [...Array(13).fill(1), 1.5]], [1, [1.5, ...Array(12).fill(1), 1]], [1, [1.75, ...Array(11).fill(1), 1.75]], [1, [2.25, ...Array(10).fill(1), 2.25]], [1, [1, 1, 1, 1.25, 5, 1.25, 1]]];
  const keys = [];
  const key = (x, z, w, d) => keys.push(slabGeometry(w - gap, d - gap, kh, { rc: 0.0016 * s, top: kh * 0.55, cs: 3, es: 2, capBottom: false }).translate(x + w / 2, deckY + 0.00005 * s, z + d / 2));
  let z = z0;
  for (const [rh, ws] of rows) {
    let x = x0;
    for (const kw of ws) { key(x, z, kw * u, rh * u); x += kw * u; }
    if (rh === 1 && ws.length === 7) { // arrow cluster: half-height left/right, stacked up/down
      key(x, z + u / 2, u, u / 2); key(x + u, z, u, u / 2); key(x + u, z + u / 2, u, u / 2); key(x + 2 * u, z + u / 2, u, u / 2);
    }
    z += rh * u;
  }
  g.add(mesh(merge(keys), mat.plastic('#1d1e22', { rough: 0.36, clearcoat: 0.3, ccRough: 0.25 })));
  const wellMat = decal(new THREE.MeshStandardMaterial({ color: C('#030304'), roughness: 0.95, envMapIntensity: 0.2, emissive: C(accent), emissiveIntensity: backlight }));
  const well = mesh(new THREE.ShapeGeometry(roundedRect(14.5 * u + 0.004 * s, (z - z0) + 0.004 * s, 0.003 * s), 6).rotateX(-Math.PI / 2), wellMat, { cast: false });
  well.position.set(0, deckY + 0.00002 * s, (z0 + z) / 2); g.add(well);
  // trackpad: a smoother inset panel with a polished chamfer
  const tpZ = -D / 2 + 0.165 * s;
  const tp = mesh(slabGeometry(0.134 * s, 0.081 * s, 0.0003 * s, { rc: 0.0075 * s, top: 0.0003 * s, topKind: 'chamfer', capBottom: false }), mat.metal(shade(ALU[color] || color, 0.94), { rough: 0.26, env: 1.5 }), { cast: false });
  tp.position.set(0, deckY - 0.00012 * s, tpZ); g.add(tp);
  // hinge barrel and rubber feet
  const hinge = mesh(new THREE.CylinderGeometry(0.0034 * s, 0.0034 * s, 0.25 * s, 24).rotateZ(Math.PI / 2), mat.metal('#2c2e33', { rough: 0.4 }));
  hinge.position.set(0, deckY + 0.0006 * s, -D / 2 + 0.0034 * s); g.add(hinge);
  const feet = merge([-1, 1].flatMap((sx) => [-1, 1].map((sz) => new THREE.CylinderGeometry(0.0045 * s, 0.0045 * s, FT, 16).translate(sx * (W / 2 - 0.03 * s), FT / 2, sz * (D / 2 - 0.024 * s)))));
  g.add(mesh(feet, mat.rubber('#0c0d0f'), { cast: false }));
  // lid, pivoting on the hinge
  const lid = new THREE.Group(); lid.position.set(0, deckY, -D / 2 + LH * 0.55); g.add(lid);
  const shell = mesh(slabGeometry(W, D, LH, { rc: RC, top: LH * 0.45, bottom: 0.0005 * s, bottomKind: 'chamfer', cs: 8, es: 5 }), alu);
  shell.position.set(0, 0.0003 * s, D / 2 - LH * 0.55); lid.add(shell);
  const inner = new THREE.Group(); inner.position.set(0, 0.0003 * s, D / 2 - LH * 0.55); inner.rotation.x = Math.PI / 2; lid.add(inner); // shapes here face -y, shape +y = screen top
  const bezel = mesh(new THREE.ShapeGeometry(roundedRect(W - 0.0009 * s, D - 0.0009 * s, RC - 0.0005 * s), 16), decal(mat.plastic('#040405', { rough: 0.06, clearcoat: 1, ccRough: 0.03 })), { cast: false });
  bezel.position.z = 0.00004 * s; inner.add(bezel);
  const sw = 0.2885 * s, sh = 0.1865 * s, sy = 0.00845 * s;
  const screenMat = decal(new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, emissive: 0xffffff, emissiveIntensity: glow, emissiveMap: screen || wallpaper({ accent }) }));
  screenMat.polygonOffsetUnits = -6;
  const scr = mesh(planarUV(new THREE.ShapeGeometry(roundedRect(sw, sh, 0.006 * s), 12)), screenMat, { cast: false });
  scr.position.set(0, sy, 0.00008 * s); inner.add(scr);
  const notch = mesh(new THREE.ShapeGeometry(roundedRect(0.031 * s, 0.0085 * s, 0.0028 * s), 8), decal(new THREE.MeshBasicMaterial({ color: 0x000000 })), { cast: false });
  notch.material.polygonOffsetUnits = -8; notch.position.set(0, sy + sh / 2 - 0.0036 * s, 0.00012 * s); inner.add(notch);
  const camLens = mesh(new THREE.CircleGeometry(0.0011 * s, 20), decal(mat.plastic('#10141c', { rough: 0.05, clearcoat: 1 })), { cast: false });
  camLens.material.polygonOffsetUnits = -10; camLens.position.set(0, sy + sh / 2 - 0.0032 * s, 0.00016 * s); inner.add(camLens);
  anchor(inner, 'screen', new THREE.Vector3(0, sy, 0.0003 * s), g.anchors);
  anchor(g, 'keyboard', new THREE.Vector3(0, deckY + kh, (z0 + z) / 2), g.anchors);
  anchor(g, 'trackpad', new THREE.Vector3(0, deckY, tpZ), g.anchors);
  anchor(g, 'hinge', new THREE.Vector3(0, deckY, -D / 2), g.anchors);
  let glowMax = glow, openNow = open;
  const apply = () => { lid.rotation.x = -deg(angle) * openNow; screenMat.emissiveIntensity = glowMax * (wake ? smooth(clamp(invLerp(0.2, 0.65, openNow))) : 1); };
  g.setOpen = (p) => { openNow = clamp(p); apply(); };
  g.set = g.setOpen;
  g.setScreen = (tex) => { screenMat.emissiveMap = tex; screenMat.needsUpdate = true; };
  g.setGlow = (v) => { glowMax = v; apply(); };
  g.setBacklight = (v) => { wellMat.emissiveIntensity = v; };
  g.lid = lid; g.screen = scr; g.base = base;
  g.userData = { perMetre: s, size: [W, deckY + LH, D], footprint: [W, D], screenSize: [sw, sh], screenAspect: sw / sh };
  openNow = 1; apply(); measureBounds(g); openNow = open; apply(); // framed open, the way it is usually shown
  return withAnchors(g);
}

// ---------- monitor ----------
// monitor({ width = 1.6, color, screen, glow }): a thin 27-inch display on a bent aluminium stand.
// width: across the panel (real 0.623 m). mon.setScreen(texture) (16:9: k.screen({ w: 1920, h: 1080 })), setGlow(v).
// Anchors: screen, stand.
export function monitor(o = {}) {
  const { color = 'silver', screen = null, glow = 1.1, accent = accentDefault() } = o;
  const s = scaleOf(o, 'width', REAL.monitor, 1.6);
  const PW = 0.623 * s, PH = 0.362 * s, PD = 0.016 * s, RC = 0.011 * s, yC = 0.112 * s + PH / 2;
  const g = new THREE.Group(); g.name = 'monitor'; g.anchors = {};
  const alu = mat.metal(ALU[color] || color, { rough: 0.38, env: 1.6 });
  const panel = new THREE.Group(); panel.position.y = yC; g.add(panel);
  panel.add(mesh(standUp(slabGeometry(PW, PH, PD, { rc: RC, top: 0.0007 * s, topKind: 'chamfer', bottom: PD * 0.42, cs: 8, es: 5 }), PD), alu));
  const bezel = mesh(new THREE.ShapeGeometry(roundedRect(PW - 0.0014 * s, PH - 0.0014 * s, RC - 0.0007 * s), 16), decal(mat.plastic('#040405', { rough: 0.06, clearcoat: 1, ccRough: 0.03 })), { cast: false });
  bezel.position.z = PD / 2 + 0.00004 * s; panel.add(bezel);
  const SW = 0.5975 * s, SH = 0.3361 * s;
  const screenMat = decal(new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04, emissive: 0xffffff, emissiveIntensity: glow, emissiveMap: screen || wallpaper({ w: 1920, h: 1080, accent }) }));
  screenMat.polygonOffsetUnits = -6;
  const scr = mesh(planarUV(new THREE.ShapeGeometry(roundedRect(SW, SH, 0.004 * s), 10)), screenMat, { cast: false });
  scr.position.z = PD / 2 + 0.00008 * s; panel.add(scr);
  // the stand: one bent sheet, foot forward, arm leaning up to the back of the panel
  const t = 0.009 * s, sw = 0.165 * s, ya = yC - 0.06 * s, za = -PD / 2 - 0.016 * s;
  const cl = fillet([[0.1 * s, t / 2], [-0.118 * s, t / 2], [za - 0.004 * s, ya]], [0, 0.05 * s, 0], 10);
  const nrm = cl.map((p, i) => { const a = cl[Math.max(0, i - 1)], b = cl[Math.min(cl.length - 1, i + 1)]; const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; return new THREE.Vector2(-dy / l, dx / l); });
  const shp = new THREE.Shape([...cl.map((p, i) => p.clone().addScaledVector(nrm[i], t / 2)), ...cl.map((p, i) => p.clone().addScaledVector(nrm[i], -t / 2)).reverse()]);
  const bv = 0.0018 * s;
  const stand = mesh(new THREE.ExtrudeGeometry(shp, { depth: sw - 2 * bv, bevelEnabled: true, bevelThickness: bv, bevelSize: bv * 0.6, bevelSegments: 3, curveSegments: 8 }).rotateY(-Math.PI / 2).translate(sw / 2 - bv, 0, 0), alu);
  g.add(stand);
  const block = mesh(new THREE.BoxGeometry(0.07 * s, 0.05 * s, 0.018 * s), mat.metal('#2c2e33', { rough: 0.4 }));
  block.position.set(0, ya, -PD / 2 - 0.008 * s); g.add(block);
  anchor(panel, 'screen', new THREE.Vector3(0, 0, PD / 2 + 0.0002 * s), g.anchors);
  anchor(g, 'stand', new THREE.Vector3(0, 0.02 * s, 0), g.anchors);
  g.setScreen = (tex) => { screenMat.emissiveMap = tex; screenMat.needsUpdate = true; };
  g.setGlow = (v) => { screenMat.emissiveIntensity = v; };
  g.panel = panel; g.screen = scr;
  g.userData = { perMetre: s, size: [PW, yC + PH / 2, 0.22 * s], footprint: [sw, 0.22 * s], screenSize: [SW, SH], screenAspect: SW / SH };
  return withAnchors(measureBounds(g));
}

// ---------- server racks ----------
// Face plates are painted once per device type (vents, drive bays, ports) and instanced; LEDs are one instanced mesh
// whose colours are set from time, so a whole row of racks is a dozen draw calls.
const RU = 0.04445, PLATE_W = 0.4826, PXMM = 4, FACES = new Map();
const DEVICE_U = { switch: 1, patch: 1, server1: 1, server2: 2, gpu: 4, blank: 1, storage: 2 };
function rackFace(type, accent) {
  const u = DEVICE_U[type], hmm = u * 44.45 - 0.9, P = painter(Math.round(482.6 * PXMM), Math.round(hmm * PXMM)), k = PXMM;
  const plate = { color: '#1c1e23', rough: 0.42, metal: 0.25, height: 0.6 }, ear = { color: '#2a2d33', rough: 0.36, metal: 0.55, height: 0.62 };
  const hole = { color: '#020203', rough: 0.95, metal: 0, height: 0.0, emit: 1 }, slot = { color: '#060708', rough: 0.9, height: 0.25 };
  const caddy = { color: '#30343c', rough: 0.34, metal: 0.45, height: 0.72 }, port = { color: '#040405', rough: 0.85, height: 0.1 };
  const pin = { color: '#a8894a', rough: 0.3, metal: 1, height: 0.15 }, tab = { color: '#b9bdc3', rough: 0.5, metal: 0, height: 0.7 }, edge = { color: '#3a3e46', rough: 0.3, metal: 0.7, height: 0.66 };
  const leds = [], led = (x, y, kind, w = 3.0, h = 2.0) => leds.push({ x, y, kind, w, h });
  P.rect(0, 0, P.W, P.H, plate);
  P.rect(0, 0, 21 * k, P.H, ear); P.rect(P.W - 21 * k, 0, 21 * k, P.H, ear);
  P.rect(0, 0, P.W, 1.2 * k, edge); P.rect(0, P.H - 1.2 * k, P.W, 1.2 * k, edge);
  [5, 477.6].forEach((x) => [hmm / 2].forEach((y) => P.circle(x * k, y * k, 2.4 * k, { color: '#55595f', rough: 0.3, metal: 1, height: 0.8 })));
  if (type === 'server1') {
    P.hex(26 * k, 5 * k, 118 * k, hmm * k - 10 * k, 3.4 * k, hole);
    P.hex(338 * k, 5 * k, 118 * k, hmm * k - 10 * k, 3.4 * k, hole);
    for (let i = 0; i < 8; i++) {
      const x = 150 + i * 23.4;
      P.rect(x * k, 3 * k, 21.6 * k, (hmm - 6) * k, caddy, 1.5 * k);
      P.rect((x + 3) * k, 11 * k, 15.6 * k, (hmm - 22) * k, slot, 1 * k);
      led(x + 10.8, 7, 'act');
    }
    P.rect(4 * k, hmm * 0.3 * k, 10 * k, hmm * 0.4 * k, tab, 1 * k);
    led(469, 10, 'power'); led(469, 22, 'status'); led(469, 34, 'id');
  } else if (type === 'server2' || type === 'storage') {
    const cols = 4, rows = 3, cw = 100.5, ch = (hmm - 8) / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = 39 + c * (cw + 1.6), y = 4 + r * ch;
      P.rect(x * k, (y + 0.4) * k, cw * k, (ch - 0.8) * k, caddy, 1.6 * k);
      P.hex((x + 4) * k, (y + 3) * k, (cw - 26) * k, (ch - 6) * k, 2.6 * k, hole);
      P.rect((x + cw - 20) * k, (y + 4) * k, 16 * k, (ch - 8) * k, slot, 1 * k);
      led(x + cw - 12, y + ch / 2 - 3.5, 'act'); led(x + cw - 12, y + ch / 2 + 3.5, 'status');
    }
    led(470, 14, 'power'); led(470, 26, 'status'); led(470, 38, 'id');
  } else if (type === 'switch') {
    for (let grp = 0; grp < 4; grp++) for (let c = 0; c < 6; c++) for (let r = 0; r < 2; r++) {
      const x = 46 + grp * 82 + c * 12.6, y = 7 + r * 16;
      P.rect(x * k, y * k, 11.2 * k, 11 * k, { color: '#2b2e34', rough: 0.4, metal: 0.4, height: 0.6 }, 0.6 * k);
      P.rect((x + 1) * k, (y + 1.2) * k, 9.2 * k, 8 * k, port);
      for (let p = 0; p < 4; p++) P.rect((x + 2 + p * 2) * k, (y + (r ? 7.4 : 1.6)) * k, 0.9 * k, 1.2 * k, pin);
      led(x + 5.6, r ? y + 13.4 : y - 2.2, 'link', 2.2, 1.2);
    }
    for (let i = 0; i < 4; i++) { P.rect((384 + i * 15) * k, 10 * k, 13.4 * k, 16 * k, { color: '#565b63', rough: 0.3, metal: 0.9, height: 0.7 }, 0.6 * k); P.rect((385.5 + i * 15) * k, 12 * k, 10.4 * k, 12 * k, port); led(390.7 + i * 15, 31, 'link', 2.2, 1.2); }
    P.hex(26 * k, 6 * k, 14 * k, (hmm - 12) * k, 2.8 * k, hole);
    led(456, 12, 'power'); led(456, 24, 'status');
  } else if (type === 'patch') {
    for (let i = 0; i < 24; i++) {
      const x = 40 + i * 16.8 + Math.floor(i / 6) * 3;
      P.rect(x * k, 13 * k, 12.4 * k, 11 * k, { color: '#2b2e34', rough: 0.4, metal: 0.3, height: 0.6 }, 0.6 * k);
      P.rect((x + 1.2) * k, 14.4 * k, 10 * k, 8 * k, port);
      P.text(String(i + 1), (x + 6.2) * k, 31 * k, `600 ${5.2 * k}px Inter`, { color: '#8b9098', rough: 0.5, height: 0.55 });
    }
  } else if (type === 'gpu') {
    P.rect(26 * k, 4 * k, 430.6 * k, (hmm - 32) * k, { color: '#16181c', rough: 0.4, metal: 0.4, height: 0.55 }, 3 * k);
    P.hex(30 * k, 8 * k, 422.6 * k, (hmm - 40) * k, 4.2 * k, hole, 0.84);
    P.rect(26 * k, (hmm - 24) * k, 430.6 * k, 20 * k, { color: '#23262c', rough: 0.3, metal: 0.6, height: 0.62 }, 2 * k);
    led(241.3, hmm - 14, 'bar', 300, 2.2);
    led(470, 20, 'power'); led(470, 34, 'status'); led(12, 20, 'act'); led(12, 34, 'act');
  } else {
    P.dots(24 * k, 4 * k, 434.6 * k, (hmm - 8) * k, 4.6 * k, 1.3 * k, { ...hole, emit: 0.35 });
  }
  return { P, leds, hmm: hmm / 1000, handles: u >= 2 };
}

// serverRack({ units = 42, racks = 1, gap = 0, height, seed, busy = 0.6, glow = 0.05 }): cabinets of servers,
// switches and GPU boxes with LEDs. height: of one cabinet (real 2.0 m for 42U; the default is 1 world unit per metre,
// so a 42U rack is 2 units tall). racks > 1 builds a row side by side, still one set of draw calls for the whole row.
// rack.at(t, busy?) blinks every LED from time (busy 0..1 = disk and network activity). rack.slide(i, 0..1) pulls
// device i out of its cabinet. rack.highlight(i, 0..1) turns device i's LEDs a steady accent (call it before at(t)).
// rack.devices = [{ type, rack, u, size, anchor }], types: switch, patch, server1, server2, storage, gpu, blank;
// pick one with rack.devices.findIndex((d) => d.type === 'gpu'). glow: light leaking through the vents. Anchors: top.
export function serverRack(o = {}) {
  const { units = 42, racks = 1, gap = 0, seed = 7, busy = 0.6, glow = 0.05, glowColor = '#5aa8ff', accent = accentDefault(), ledIntensity = 9, frameColor = '#0e1013' } = o;
  const realH = units * RU + 0.135;
  const s = o.perMetre != null ? o.perMetre : o.height != null ? o.height / realH : 1;
  const RW = 0.6 * s, RD = 1.07 * s, H = realH * s, plinth = 0.07 * s, pitch = RW + gap * s;
  const g = new THREE.Group(); g.name = 'serverRack'; g.anchors = {};
  const R = rng(seed);
  // layout: switch + patch panel on top, then a seeded mix of servers, storage, GPU boxes and blanks
  const devices = [];
  for (let r = 0; r < racks; r++) {
    const list = [];
    let top = units;
    const put = (type) => { const u = DEVICE_U[type]; if (top - u < 0) return false; top -= u; list.push({ type, rack: r, u: top, size: u }); return true; };
    put('patch'); put('switch');
    if (units > 20) { if (R() < 0.3) top -= 1; put('switch'); }
    while (top > 0) {
      const x = R();
      const type = x < 0.3 ? 'server1' : x < 0.55 ? 'server2' : x < 0.68 ? 'storage' : x < 0.8 ? 'gpu' : x < 0.9 ? 'blank' : 'gap';
      if (type === 'gap') { top -= 1; continue; }
      if (!put(type)) put('server1') || (top -= 1);
    }
    devices.push(...list);
  }
  // plates, chassis, handles, LEDs
  const faces = {}, ledSpecs = [];
  const plateZ = RD / 2 - 0.035 * s;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const batches = new Map();
  const batch = (key, make) => { if (!batches.has(key)) batches.set(key, { ...make(), list: [] }); return batches.get(key); };
  const handleGeo = (hh) => {
    const sOff = 0.011 * s, r = 0.0032 * s, L = hh * 0.72;
    const path = new THREE.CatmullRomCurve3([[0, -L / 2, 0], [0, -L / 2, sOff * 0.7], [0, -L / 2 + sOff * 0.3, sOff], [0, L / 2 - sOff * 0.3, sOff], [0, L / 2, sOff * 0.7], [0, L / 2, 0]].map((p) => new THREE.Vector3(...p)), false, 'centripetal');
    return new THREE.TubeGeometry(path, 32, r, 10, false);
  };
  const handleMat = mat.metal('#b4b9c1', { rough: 0.28 });
  const chassisGeo = new THREE.BoxGeometry(1, 1, 1), chassisMat = mat.metal('#3a3e45', { rough: 0.45 });
  devices.forEach((d, i) => {
    if (!faces[d.type]) {
      const key = [d.type, accent, glowColor, glow].join('|');
      if (!FACES.has(key)) { const f = rackFace(d.type, accent), fm = f.P.material({ bump: 1.2, emissive: glowColor, emissiveIntensity: glow }); fm.userData.shared = true; FACES.set(key, { leds: f.leds, hmm: f.hmm, handles: f.handles, mat: fm }); }
      const f = FACES.get(key);
      faces[d.type] = { ...f, geo: new THREE.BoxGeometry(PLATE_W * s, f.hmm * s, 0.004 * s) };
    }
    const f = faces[d.type];
    const x = (d.rack - (racks - 1) / 2) * pitch, y = plinth + (d.u + d.size / 2) * RU * s;
    d.base = new THREE.Vector3(x, y, plateZ);
    d.parts = [];
    const add = (key, make, pos, scl = one) => { const b = batch(key, make); b.list.push(m4.compose(pos, q, scl).clone()); d.parts.push({ key, index: b.list.length - 1, offset: pos.clone().sub(d.base), scale: scl.clone() }); };
    add('face:' + d.type, () => ({ geo: f.geo, mat: f.mat }), d.base.clone());
    add('chassis', () => ({ geo: chassisGeo, mat: chassisMat }), v.set(x, y, plateZ - 0.36 * s), new THREE.Vector3(0.43 * s, f.hmm * s, 0.72 * s));
    if (f.handles) for (const sx of [-1, 1]) add('handle:' + d.size, () => ({ geo: handleGeo(f.hmm * s), mat: handleMat }), v.set(x + sx * (PLATE_W / 2 - 0.0105) * s, y, plateZ + 0.002 * s));
    d.leds = [];
    for (const L of f.leds) {
      const pos = new THREE.Vector3(x + (L.x / 1000 - PLATE_W / 2) * s, y + (f.hmm / 2 - L.y / 1000) * s, plateZ + 0.0026 * s);
      const scl = new THREE.Vector3(L.w / 1000 * s, L.h / 1000 * s, 0.0012 * s);
      d.leds.push(ledSpecs.length);
      ledSpecs.push({ pos, scl, kind: L.kind, dev: i, seed: hash1(i * 17.3 + L.x * 0.37 + L.y * 1.7), warn: R() < 0.012 });
    }
    d.anchor = new THREE.Object3D(); d.anchor.position.copy(d.base).add(v.set(0, 0, 0.004 * s)); g.add(d.anchor);
  });
  const meshes = {};
  for (const [key, b] of batches) {
    const im = new THREE.InstancedMesh(b.geo, b.mat, b.list.length);
    b.list.forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = !key.startsWith('chassis'); im.receiveShadow = true;
    meshes[key] = im; g.add(im);
  }
  // LEDs: one instanced mesh, colour per instance set from time
  const ledGeo = new THREE.BoxGeometry(1, 1, 1);
  const leds = new THREE.InstancedMesh(ledGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), Math.max(1, ledSpecs.length));
  ledSpecs.forEach((L, i) => { leds.setMatrixAt(i, m4.compose(L.pos, q, L.scl)); leds.setColorAt(i, new THREE.Color(0, 0, 0)); });
  leds.count = ledSpecs.length; g.add(leds);
  const COL = { act: C('#9fd6ff'), link: C('#4dff8a'), status: C('#4dff8a'), power: C('#5aa8ff'), id: C('#5aa8ff'), bar: C(accent), warn: C(accent) };
  // cabinet: side panels, top, plinth, front frame, rails and a dark back, merged per material
  const frame = [], rails = [];
  for (let r = 0; r < racks; r++) {
    const x = (r - (racks - 1) / 2) * pitch;
    const side = (sx) => standUp(slabGeometry(RD, H, 0.018 * s, { rc: 0.006 * s, top: 0.004 * s, bottom: 0.004 * s, cs: 4, es: 3 }), 0.018 * s).rotateY(Math.PI / 2).translate(x + sx * (RW / 2 - 0.009 * s), H / 2, 0);
    frame.push(side(-1), side(1));
    frame.push(slabGeometry(RW, RD, 0.03 * s, { rc: 0.006 * s, top: 0.005 * s, bottom: 0.002 * s, cs: 4, es: 3 }).translate(x, H - 0.03 * s, 0));
    frame.push(new THREE.BoxGeometry(RW - 0.04 * s, plinth, RD - 0.08 * s).translate(x, plinth / 2, -0.02 * s));
    const bandY = plinth + units * RU * s, bandH = H - 0.03 * s - bandY;
    frame.push(slabGeometry(RW - 0.03 * s, 0.03 * s, bandH, { rc: 0.002 * s, top: 0.002 * s, bottom: 0.002 * s, cs: 2, es: 2 }).translate(x, bandY, RD / 2 - 0.02 * s));
    for (const sx of [-1, 1]) frame.push(slabGeometry(0.04 * s, 0.03 * s, H - plinth - 0.03 * s, { rc: 0.002 * s, top: 0, bottom: 0, cs: 2 }).translate(x + sx * (RW / 2 - 0.03 * s), plinth, RD / 2 - 0.02 * s));
    frame.push(new THREE.PlaneGeometry(RW - 0.04 * s, H - plinth - 0.04 * s).translate(x, (H + plinth) / 2, -RD / 2 + 0.06 * s));
    for (const sx of [-1, 1]) rails.push(new THREE.BoxGeometry(0.016 * s, units * RU * s, 0.003 * s).translate(x + sx * 0.2325 * s, plinth + (units * RU * s) / 2, plateZ - 0.003 * s));
  }
  g.add(mesh(merge(frame), mat.plastic(frameColor, { rough: 0.48, clearcoat: 0.25 })));
  const [rc, rg] = canvas(32, 96);
  rg.fillStyle = '#3b3f46'; rg.fillRect(0, 0, 32, 96); rg.fillStyle = '#050506'; for (let i = 0; i < 3; i++) rg.fillRect(10, 8 + i * 32, 12, 14);
  const railTex = canvasTex(rc); railTex.wrapT = THREE.RepeatWrapping; railTex.repeat.set(1, units);
  g.add(mesh(merge(rails), mat.metal('#ffffff', { rough: 0.4, extra: { map: railTex } }), { cast: false }));
  const slide = new Map(), lit = new Map(), acc = C(accent);
  const place = (i) => {
    const d = devices[i], dz = (slide.get(i) || 0) * 0.66 * s;
    for (const p of d.parts) { meshes[p.key].setMatrixAt(p.index, m4.compose(v.copy(d.base).add(p.offset).setZ(d.base.z + p.offset.z + dz), q, p.scale)); meshes[p.key].instanceMatrix.needsUpdate = true; }
    for (const li of d.leds) { const L = ledSpecs[li]; leds.setMatrixAt(li, m4.compose(v.copy(L.pos).setZ(L.pos.z + dz), q, L.scl)); }
    leds.instanceMatrix.needsUpdate = true;
    d.anchor.position.set(d.base.x, d.base.y, d.base.z + 0.004 * s + dz);
  };
  g.slide = (i, p) => { if (!devices[i]) return; slide.set(i, clamp(p)); place(i); };
  g.highlight = (i, v) => { lit.set(i, clamp(v)); };
  g.at = (t, b = busy) => {
    const arr = leds.instanceColor.array;
    for (let i = 0; i < ledSpecs.length; i++) {
      const L = ledSpecs[i], sd = L.seed;
      let on = 1, c = COL[L.kind] || COL.status;
      if (L.kind === 'act') on = hash1(sd * 91.7 + Math.floor(t * (7 + sd * 9))) < b ? 1 : 0.03;
      else if (L.kind === 'link') on = hash1(sd * 53.1 + Math.floor(t * (5 + sd * 8))) < 0.35 + b * 0.6 ? 1 : 0.06;
      else if (L.kind === 'id') on = 0.03;
      else if (L.kind === 'bar') on = 0.7 + 0.3 * Math.sin(t * 1.4 + sd * 6);
      if (L.warn) { c = COL.warn; on = Math.sin(t * 4 + sd * 10) > 0 ? 1 : 0.05; }
      const hl = lit.get(L.dev) || 0;
      const k = Math.max(on, hl) * ledIntensity * (L.kind === 'bar' ? 0.8 : 1) * (1 + hl * 0.6);
      arr[i * 3] = (c.r + (acc.r - c.r) * hl) * k; arr[i * 3 + 1] = (c.g + (acc.g - c.g) * hl) * k; arr[i * 3 + 2] = (c.b + (acc.b - c.b) * hl) * k;
    }
    leds.instanceColor.needsUpdate = true;
  };
  anchor(g, 'top', new THREE.Vector3(0, H, RD / 2), g.anchors);
  for (const d of devices) if (!g.anchors[d.type]) { d.anchor.name = d.type; g.anchors[d.type] = d.anchor; } // the top-most of each kind
  g.devices = devices; g.leds = leds;
  g.userData = { perMetre: s, size: [racks * pitch - gap * s, H, RD], footprint: [racks * pitch, RD], units };
  g.at(0);
  return withAnchors(measureBounds(g));
}

// ---------- router ----------
// router({ width = 1, antennas = 4, color, busy }): a Wi-Fi router with four fold-up antennas and status LEDs.
// width: across the body (real 0.24 m). router.at(t, busy?) blinks the LEDs; router.setFold(0..1) folds the antennas
// back. Anchors: signal (just above the top, where waves start), leds.
export function router(o = {}) {
  const { antennas = 4, color = '#141518', accent = accentDefault(), ledColor = '#e6f3ff', busy = 0.6, fold = 0, ledIntensity = 4 } = o;
  const s = scaleOf(o, 'width', REAL.router, 1);
  const W = 0.24 * s, D = 0.165 * s, H = 0.034 * s, FT = 0.005 * s;
  const g = new THREE.Group(); g.name = 'router'; g.anchors = {};
  const shell = mat.plastic(color, { rough: 0.5, clearcoat: 0.25, ccRough: 0.3 });
  const body = mesh(slabGeometry(W, D, H, { rc: 0.026 * s, top: 0.0035 * s, topKind: 'chamfer', bottom: 0.011 * s, cs: 10, es: 5 }), shell);
  body.position.y = FT; g.add(body);
  // top: a gloss panel with a vent field and a light bar
  const P = painter(1024, 704);
  P.rect(0, 0, 1024, 704, { color: '#0b0c0e', rough: 0.12, metal: 0, height: 0.6 });
  P.fill((x) => { for (let j = 0; j < 9; j++) for (let i = 0; i < 26; i++) { const cx = 120 + i * 30.5 + (j % 2) * 15, cy = 80 + j * 34; x.roundRect(cx - 4, cy - 12, 8, 24, 4); } }, { color: '#020203', rough: 0.9, height: 0.05 });
  P.rect(362, 560, 300, 14, { color: '#2a2a2a', rough: 0.3, height: 0.55 }, 7);
  const topMat = P.material({ bump: 0.6, clearcoat: 0.6 });
  const top = mesh(slabGeometry(0.2 * s, 0.1375 * s, 0.0008 * s, { rc: 0.017 * s, top: 0.0006 * s, cs: 8, es: 3, capBottom: false }), topMat, { cast: false });
  top.position.y = FT + H - 0.0004 * s; g.add(top);
  const bar = mesh(new THREE.BoxGeometry(0.058 * s, 0.0008 * s, 0.0026 * s), ledMat(accent, 3), { cast: false });
  bar.position.set(0, FT + H + 0.0005 * s, (567 / 704 - 0.5) * 0.1375 * s); g.add(bar); // over the painted bar slot
  // front LEDs
  const ledMeshes = [];
  for (let i = 0; i < 5; i++) {
    const m = mesh(new THREE.BoxGeometry(0.0055 * s, 0.0018 * s, 0.0012 * s), new THREE.MeshBasicMaterial({ color: hot(ledColor, ledIntensity), toneMapped: false }), { cast: false });
    m.position.set((i - 2) * 0.014 * s, FT + H * 0.5, D / 2 + 0.0002 * s); g.add(m); ledMeshes.push(m);
  }
  // ports on the back
  for (let i = 0; i < 5; i++) {
    const p = mesh(new THREE.ShapeGeometry(roundedRect(0.0128 * s, 0.0105 * s, 0.0012 * s), 4), decal(new THREE.MeshStandardMaterial({ color: C(i === 0 ? '#1f4a8f' : '#050506'), roughness: 0.8 })), { cast: false });
    p.rotation.y = Math.PI; p.position.set((i - 2) * 0.019 * s - 0.02 * s, FT + H * 0.48, -D / 2 - 0.0002 * s); g.add(p);
  }
  // antennas on hinge knuckles along the back
  const ant = [], xs = antennas === 2 ? [-0.075, 0.075] : antennas === 3 ? [-0.08, 0, 0.08] : [-0.098, -0.036, 0.036, 0.098];
  const paddle = slabGeometry(0.021 * s, 0.0088 * s, 0.168 * s, { rc: 0.0044 * s, top: 0.0044 * s, bottom: 0.0012 * s, cs: 6, es: 4 }).translate(0, 0.006 * s, 0);
  const knuckle = new THREE.CylinderGeometry(0.0062 * s, 0.0062 * s, 0.017 * s, 24).rotateZ(Math.PI / 2);
  for (const x of xs.slice(0, antennas)) {
    const a = new THREE.Group(); a.position.set(x * s, FT + H * 0.7, -D / 2 + 0.002 * s);
    a.add(mesh(knuckle, shell));
    const arm = new THREE.Group(); arm.add(mesh(paddle, shell)); a.add(arm);
    a.userData.splay = Math.sign(x) * (Math.abs(x) > 0.05 ? 0.13 : 0.045);
    ant.push({ a, arm }); g.add(a);
  }
  const feet = merge([-1, 1].flatMap((sx) => [-1, 1].map((sz) => new THREE.CylinderGeometry(0.006 * s, 0.007 * s, FT, 16).translate(sx * (W / 2 - 0.03 * s), FT / 2, sz * (D / 2 - 0.03 * s)))));
  g.add(mesh(feet, mat.rubber('#0a0a0b'), { cast: false }));
  g.setFold = (p) => { for (const { a, arm } of ant) { arm.rotation.set(-0.06 - clamp(p) * (Math.PI / 2 - 0.06), 0, 0); a.rotation.z = -a.userData.splay * (1 - clamp(p)); } };
  g.at = (t, b = busy) => {
    ledMeshes.forEach((m, i) => {
      const on = i < 2 ? 1 : hash1(i * 31.7 + Math.floor(t * (6 + i * 2.3))) < 0.25 + b * 0.7 ? 1 : 0.05;
      m.material.color.copy(hot(ledColor, ledIntensity * on));
    });
  };
  anchor(g, 'signal', new THREE.Vector3(0, FT + H + 0.04 * s, 0), g.anchors);
  anchor(g, 'leds', new THREE.Vector3(0, FT + H * 0.5, D / 2), g.anchors);
  g.antennas = ant.map((x) => x.a);
  g.userData = { perMetre: s, size: [W, FT + H + 0.17 * s, D], footprint: [W, D] };
  g.setFold(0); measureBounds(g); g.setFold(fold); g.at(0);
  return withAnchors(g);
}

// ---------- cell tower ----------
// cellTower({ height = 4, sectors = 3, perSector = 3, dishes = 2 }): a tapered three-legged lattice mast with
// sector panel antennas, radio units, microwave dishes and a red beacon. height: real 30 m. tower.at(t) blinks the
// beacon. Anchors: top (beacon), sectors[k] (front of each antenna sector; its +z points outward, so a ring or wave
// added to it travels away from the tower). thickness scales the steel so it reads at phone size.
export function cellTower(o = {}) {
  const { sectors = 3, perSector = 3, dishes = 2, beacon = true, color = '#a7afb8', antennaColor = '#e8eaed', thickness = 1.6, pads = true } = o;
  const s = scaleOf(o, 'height', REAL.cellTower, 4);
  const top = 26.2, Rb = 3.3 / Math.sqrt(3), Rt = 1.15 / Math.sqrt(3), nSec = 11;
  const g = new THREE.Group(); g.name = 'cellTower'; g.anchors = {};
  const R = (y) => Rb + (Rt - Rb) * Math.pow(y / top, 0.85);
  const legAng = [30, 150, 270].map(deg);
  const P3 = (a, y, r = R(y)) => new THREE.Vector3(Math.cos(a) * r * s, y * s, Math.sin(a) * r * s);
  const members = [];
  const bar = (A, B, r) => members.push([A, B, r * thickness * s]);
  const lv = Array.from({ length: nSec + 1 }, (_, i) => top * (1 - Math.pow(1 - i / nSec, 1.12)));
  for (let i = 0; i < nSec; i++) {
    const y0 = lv[i], y1 = lv[i + 1];
    for (let k = 0; k < 3; k++) {
      const a = legAng[k], b = legAng[(k + 1) % 3];
      bar(P3(a, y0), P3(a, y1), 0.075 - 0.03 * (i / nSec));
      bar(P3(a, y0), P3(b, y0), 0.032);
      bar(P3(a, y0), P3(b, y1), 0.026); bar(P3(b, y0), P3(a, y1), 0.026);
    }
  }
  for (let k = 0; k < 3; k++) bar(P3(legAng[k], top), P3(legAng[(k + 1) % 3], top), 0.034);
  // a pole above the lattice for the beacon
  bar(new THREE.Vector3(0, (top - 1.5) * s, 0), new THREE.Vector3(0, 30 * s, 0), 0.1);
  for (let k = 0; k < 3; k++) bar(P3(legAng[k], top - 1.5), new THREE.Vector3(0, (top - 0.4) * s, 0), 0.03);
  // sector frames: two face pipes per sector, arms back to the legs, antennas and radio units on them
  const yA = 27.3, Rm = Rt + 0.85, steel = mat.metal(color, { rough: 0.42 });
  const panelGeo = slabGeometry(0.3 * s, 0.12 * s, 2.0 * s, { rc: 0.04 * s, top: 0.035 * s, bottom: 0.035 * s, cs: 4, es: 3 }).translate(0, -1.0 * s, 0);
  const rruGeo = slabGeometry(0.28 * s, 0.13 * s, 0.42 * s, { rc: 0.02 * s, top: 0.015 * s, bottom: 0.015 * s, cs: 3, es: 2 }).translate(0, -0.21 * s, 0);
  const panels = [], rrus = [];
  const sectorAnchors = [];
  for (let k = 0; k < sectors; k++) {
    const az = deg(90 + (360 / sectors) * k), dir = new THREE.Vector3(Math.cos(az), 0, Math.sin(az)), side = new THREE.Vector3(-dir.z, 0, dir.x);
    const L = Math.max(1.6, perSector * 0.75);
    for (const y of [yA - 0.75, yA + 0.75]) {
      const c = dir.clone().multiplyScalar(Rm).setY(y);
      bar(c.clone().addScaledVector(side, -L / 2).multiplyScalar(s), c.clone().addScaledVector(side, L / 2).multiplyScalar(s), 0.04);
      bar(dir.clone().multiplyScalar(Rt * 0.9).setY(y).multiplyScalar(s), c.clone().multiplyScalar(s), 0.045);
    }
    for (let j = 0; j < perSector; j++) {
      const off = (j - (perSector - 1) / 2) * (L / Math.max(1, perSector)) * 1.0;
      const c = dir.clone().multiplyScalar(Rm + 0.16).addScaledVector(side, off).setY(yA).multiplyScalar(s);
      const m4 = new THREE.Matrix4().compose(c, new THREE.Quaternion().setFromEuler(new THREE.Euler(deg(-3), -az + Math.PI / 2, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
      panels.push(panelGeo.clone().applyMatrix4(m4));
      const c2 = dir.clone().multiplyScalar(Rm - 0.12).addScaledVector(side, off).setY(yA + 0.1).multiplyScalar(s);
      rrus.push(rruGeo.clone().applyMatrix4(new THREE.Matrix4().compose(c2, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -az + Math.PI / 2, 0)), new THREE.Vector3(1, 1, 1))));
    }
    const sa = new THREE.Object3D(); sa.position.copy(dir.clone().multiplyScalar(Rm + 0.3).setY(yA).multiplyScalar(s)); sa.lookAt(sa.position.clone().add(dir)); sa.name = 'sector' + k; g.add(sa); g.anchors[sa.name] = sa; sectorAnchors.push(sa);
  }
  g.add(mesh(merge(panels), mat.plastic(antennaColor, { rough: 0.42, clearcoat: 0.3 })));
  g.add(mesh(merge(rrus), mat.metal('#555b64', { rough: 0.5 })));
  // microwave backhaul dishes
  const dishParts = [], radome = [];
  for (let k = 0; k < dishes; k++) {
    const y = 17 + k * 3.2, az = deg(k % 2 ? 205 : 335), dir = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
    const at = dir.clone().multiplyScalar(R(y) + 0.55).setY(y).multiplyScalar(s);
    const qd = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    const mk = (geo) => geo.applyMatrix4(new THREE.Matrix4().compose(at, qd, new THREE.Vector3(1, 1, 1)));
    dishParts.push(mk(new THREE.CylinderGeometry(0.42 * s, 0.42 * s, 0.32 * s, 40, 1, true).rotateX(Math.PI / 2)));
    dishParts.push(mk(new THREE.CircleGeometry(0.42 * s, 40).rotateY(Math.PI).translate(0, 0, -0.16 * s)));
    dishParts.push(mk(new THREE.BoxGeometry(0.12 * s, 0.5 * s, 0.4 * s).translate(0, 0, -0.35 * s)));
    radome.push(mk(new THREE.SphereGeometry(0.75 * s, 40, 12, 0, TAU, 0, 0.6).rotateX(Math.PI / 2).translate(0, 0, (0.16 - 0.75 * Math.cos(0.6)) * s)));
    bar(dir.clone().multiplyScalar(R(y) * 0.95).setY(y).multiplyScalar(s), at.clone().addScaledVector(dir, -0.35 * s), 0.04);
  }
  if (dishParts.length) { g.add(mesh(merge(dishParts), mat.metal('#6c727b', { rough: 0.45, extra: { side: THREE.DoubleSide } }))); g.add(mesh(merge(radome), mat.plastic('#eef0f2', { rough: 0.5 }))); }
  // the steel, instanced
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 8, 1, false);
  const steelMesh = new THREE.InstancedMesh(cyl, steel, members.length);
  const m4 = new THREE.Matrix4(), up = new THREE.Vector3(0, 1, 0);
  members.forEach(([A, B, r], i) => { const d = B.clone().sub(A), L = d.length(); m4.compose(A.clone().add(B).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(up, d.normalize()), new THREE.Vector3(r, L, r)); steelMesh.setMatrixAt(i, m4); });
  steelMesh.castShadow = steelMesh.receiveShadow = true; g.add(steelMesh);
  // feeder cables down the back leg
  const cab = [];
  for (let y = top; y >= 0; y -= 1.3) cab.push(P3(legAng[2], y, R(y) - 0.22).add(new THREE.Vector3(0.12 * s, 0, 0)));
  g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([P3(legAng[2], yA, Rm - 0.2), ...cab]), 120, 0.07 * s, 8), mat.rubber('#0c0d0f')));
  if (pads) g.add(mesh(merge(legAng.map((a) => slabGeometry(1.1 * s, 1.1 * s, 0.3 * s, { rc: 0.05 * s, top: 0.03 * s, cs: 3, es: 2 }).translate(Math.cos(a) * Rb * s, 0, Math.sin(a) * Rb * s))), mat.matte('#8c9097', { rough: 0.95 })));
  // beacon
  const bulb = mesh(new THREE.SphereGeometry(0.16 * s, 20, 12), ledMat('#ff2a1a', 8), { cast: false });
  bulb.position.set(0, 30.15 * s, 0);
  const halo = glowSprite({ color: '#ff3a22', intensity: 1.2, size: 2.2 * s }); halo.position.copy(bulb.position);
  if (beacon) g.add(bulb, halo);
  anchor(g, 'top', bulb.position.clone(), g.anchors);
  g.at = (t) => { const ph = (t % 1.6) / 1.6, on = smooth(clamp(ph / 0.06)) * (1 - smooth(clamp((ph - 0.32) / 0.08))); bulb.material.color.copy(hot('#ff2a1a', 0.4 + on * 9)); halo.setIntensity(on * 1.4); };
  Object.defineProperty(g.anchors, 'sectors', { value: sectorAnchors, enumerable: false }); // older shots use anchors.sectors[k]
  g.userData = { perMetre: s, size: [2 * Rb * s, 30.3 * s, 2 * Rb * s], footprint: [2 * Rb * s, 2 * Rb * s] };
  g.at(0);
  return withAnchors(measureBounds(g));
}

// ---------- padlock ----------
// padlock({ width = 1, open = 0, finish = 'brass', glow = 0 }): a solid padlock with a keyhole on its face.
// width: across the body (real 0.05 m). lock.set(0..1): the shackle lifts out (first 45%) then swings towards the
// camera. finish: brass | steel | black. lock.setGlow(v) lights the keyhole ring in the accent colour.
// Anchors: keyhole, shackle (top of the shackle).
export function padlock(o = {}) {
  const { open = 0, finish = 'brass', glow = 0, accent = accentDefault(), swing = 35 } = o;
  const s = scaleOf(o, 'width', REAL.padlock, 1);
  const W = 0.05 * s, H = 0.044 * s, D = 0.024 * s, a = 0.0135 * s, rs = 0.0041 * s, yc = H + 0.0165 * s;
  const g = new THREE.Group(); g.name = 'padlock'; g.anchors = {};
  const bodyMat = finish === 'steel' ? mat.metal('#c9cdd3', { rough: 0.22 }) : finish === 'black' ? mat.plastic('#141518', { rough: 0.38, clearcoat: 0.5 }) : mat.metal('#e2bb6e', { rough: 0.34, env: 2.0 });
  const chrome = mat.metal('#eef0f3', { rough: 0.14, env: 1.6 });
  const body = mesh(standUp(slabGeometry(W, H, D, { rc: 0.0075 * s, top: 0.0042 * s, bottom: 0.0042 * s, cs: 10, es: 6 }), D).translate(0, H / 2, 0), bodyMat);
  g.add(body);
  // keyway: a chrome plug with a keyhole, ringed by an accent glow when lit
  const ky = H * 0.4;
  const plug = mesh(lathe([[0, 0], [0.0068 * s, 0], [0.0068 * s, 0.0012 * s], [0, 0.0012 * s]], [0, 0.0006 * s, 0.0005 * s, 0], 48).rotateX(Math.PI / 2), mat.metal('#eceef2', { rough: 0.34, env: 2.4 }));
  plug.position.set(0, ky, D / 2 - 0.0004 * s); g.add(plug);
  const kh = new THREE.Shape(); kh.absarc(0, 0.0012 * s, 0.0022 * s, deg(-60), deg(240), false); kh.lineTo(-0.0016 * s, -0.0042 * s); kh.lineTo(0.0016 * s, -0.0042 * s); kh.closePath();
  const hole = mesh(new THREE.ShapeGeometry(kh, 16), decal(new THREE.MeshBasicMaterial({ color: 0x000000 })), { cast: false });
  hole.position.set(0, ky, D / 2 + 0.0008 * s + 0.00005 * s); g.add(hole);
  const ringMat = ledMat(accent, glow * 4);
  const ring = mesh(new THREE.TorusGeometry(0.0074 * s, 0.00045 * s, 8, 64), ringMat, { cast: false });
  ring.position.set(0, ky, D / 2 + 0.0002 * s); ring.visible = glow > 0; g.add(ring);
  // the shackle: a U of round bar, pivoting on its long (right) leg
  const pts = [];
  for (let y = H - 0.006 * s; y < yc - 0.001 * s; y += 0.002 * s) pts.push(new THREE.Vector3(-a, y, 0));
  for (let i = 0; i <= 24; i++) { const t = Math.PI - (i / 24) * Math.PI; pts.push(new THREE.Vector3(Math.cos(t) * a, yc + Math.sin(t) * a, 0)); }
  for (let y = yc - 0.002 * s; y >= H - 0.02 * s; y -= 0.002 * s) pts.push(new THREE.Vector3(a, y, 0));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const shackle = new THREE.Group(); shackle.position.set(a, 0, 0); g.add(shackle);
  const tube = mesh(new THREE.TubeGeometry(curve, 160, rs, 20, false).translate(-a, 0, 0), chrome);
  shackle.add(tube);
  const tip = mesh(new THREE.SphereGeometry(rs, 20, 10), chrome); tip.position.set(-2 * a, H - 0.006 * s, 0); shackle.add(tip);
  anchor(g, 'keyhole', new THREE.Vector3(0, ky, D / 2 + 0.001 * s), g.anchors);
  anchor(shackle, 'shackle', new THREE.Vector3(-a, yc + a + rs, 0), g.anchors);
  g.set = (p) => {
    p = clamp(p);
    shackle.position.y = 0.0125 * s * ease.inOutCubic(clamp(p / 0.45));
    shackle.rotation.y = deg(swing) * ease.inOutCubic(clamp((p - 0.45) / 0.55));
  };
  g.setOpen = g.set;
  g.setGlow = (v) => { ringMat.color.copy(hot(accent, v * 4)); ring.visible = v > 0; };
  g.shackle = shackle; g.body = body;
  g.userData = { perMetre: s, size: [W, yc + a + rs, D], footprint: [W, D] };
  g.set(0); measureBounds(g); g.set(open);
  return withAnchors(g);
}

// ---------- stopwatch ----------
// stopwatch({ width = 1, dial = 'black', time = 0, tick = 0, sweep = false }): a steel stopwatch, dial facing +z,
// crown up, centred on the dial. width: case diameter (real 0.055 m). sw.setTime(seconds) moves the seconds hand
// (one turn a minute) and the 30-minute register; tick = steps per second (0 sweeps smoothly, 5 = mechanical).
// sweep: true shows the elapsed time since 12 o'clock as a glowing accent ring inside the ticks over a faint wash,
// brightest at the hand; sw.setSweep(0..1) fades it. dial: black | white. Anchors: dial, crown, hand (its tip).
export function stopwatch(o = {}) {
  const { dial = 'black', time = 0, tick = 0, sweep = false, accent = accentDefault(), hand = null } = o;
  const s = scaleOf(o, 'width', REAL.stopwatch, 1);
  const g = new THREE.Group(); g.name = 'stopwatch'; g.anchors = {};
  const steel = mat.metal('#dfe3e8', { rough: 0.2, env: 1.7 }), brushed = mat.metal('#c9ced4', { rough: 0.32, env: 1.6 });
  // case: one lathe profile, back to bezel, axis along z
  const m = (v) => v * s;
  const prof = [[0, -0.0078], [0.019, -0.0076], [0.0262, -0.0062], [0.0275, -0.004], [0.0275, 0.0028], [0.027, 0.0049], [0.0254, 0.0058], [0.0241, 0.0057], [0.0237, 0.0038], [0.0232, 0.0036]].map(([r, y]) => [m(r), m(y)]);
  g.add(mesh(lathe(prof, [0, m(0.004), m(0.002), m(0.0012), m(0.001), m(0.0012), m(0.0006), m(0.0003), m(0.0002), 0], 96).rotateX(Math.PI / 2), steel));
  // dial
  const R = m(0.0233), DR = 1024;
  const [dc, dg] = canvas(2 * DR, 2 * DR);
  const bg = dial === 'white' ? ['#f4f2ed', '#e4e1da'] : ['#1a1d22', '#0c0d10'], ink = dial === 'white' ? '#15161a' : '#f1f0ec', dim = dial === 'white' ? '#6b6d72' : '#8d9198';
  const rg = dg.createRadialGradient(DR, DR * 0.8, 0, DR, DR, DR); rg.addColorStop(0, bg[0]); rg.addColorStop(1, bg[1]); dg.fillStyle = rg; dg.fillRect(0, 0, 2 * DR, 2 * DR);
  dg.globalAlpha = 0.05; for (let i = 0; i < 360; i++) { dg.strokeStyle = i % 2 ? '#ffffff' : '#000000'; dg.lineWidth = 3; dg.beginPath(); dg.moveTo(DR, DR); dg.lineTo(DR + Math.sin((i / 360) * TAU) * DR, DR - Math.cos((i / 360) * TAU) * DR); dg.stroke(); } dg.globalAlpha = 1;
  const tickAt = (f, r0, r1, w, col) => { const t = f * TAU; dg.strokeStyle = col; dg.lineWidth = w; dg.lineCap = 'butt'; dg.beginPath(); dg.moveTo(DR + Math.sin(t) * r0, DR - Math.cos(t) * r0); dg.lineTo(DR + Math.sin(t) * r1, DR - Math.cos(t) * r1); dg.stroke(); };
  for (let i = 0; i < 300; i++) { if (i % 5) tickAt(i / 300, DR * 0.93, DR * 0.975, 4, dim); }
  for (let i = 0; i < 60; i++) tickAt(i / 60, i % 5 ? DR * 0.9 : DR * 0.84, DR * 0.975, i % 5 ? 7 : 16, i === 0 ? accent : ink);
  dg.fillStyle = ink; dg.textAlign = 'center'; dg.textBaseline = 'middle'; dg.font = `700 ${DR * 0.15}px "Barlow Condensed", Inter`;
  for (let i = 1; i <= 12; i++) { const t = (i / 12) * TAU, r = DR * 0.7; dg.fillStyle = i === 12 ? accent : ink; dg.fillText(String(i * 5), DR + Math.sin(t) * r, DR - Math.cos(t) * r + DR * 0.008); }
  const sdx = DR, sdy = DR + DR * 0.36, sdr = DR * 0.2;
  dg.strokeStyle = dim; dg.lineWidth = 4; dg.beginPath(); dg.arc(sdx, sdy, sdr, 0, TAU); dg.stroke();
  for (let i = 0; i < 30; i++) { const t = (i / 30) * TAU, r0 = sdr * (i % 5 ? 0.86 : 0.76); dg.strokeStyle = i % 5 ? dim : ink; dg.lineWidth = i % 5 ? 3 : 6; dg.beginPath(); dg.moveTo(sdx + Math.sin(t) * r0, sdy - Math.cos(t) * r0); dg.lineTo(sdx + Math.sin(t) * sdr, sdy - Math.cos(t) * sdr); dg.stroke(); }
  dg.font = `700 ${DR * 0.07}px "Barlow Condensed", Inter`; dg.fillStyle = ink; [10, 20, 30].forEach((n) => { const t = (n / 30) * TAU, r = sdr * 0.55; dg.fillText(String(n), sdx + Math.sin(t) * r, sdy - Math.cos(t) * r); });
  const dialTex = canvasTex(dc);
  const face = mesh(new THREE.CircleGeometry(R, 96), new THREE.MeshPhysicalMaterial({ map: dialTex, roughness: 0.42, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.2 }), { cast: false });
  face.position.z = m(0.0036); g.add(face);
  // elapsed-time arc (optional)
  const arcU = { uA: { value: 0 }, uR: { value: 1 }, uCol: { value: hot(accent, 1.25) }, uOn: { value: sweep ? 1 : 0 } };
  const arc = new THREE.Mesh(new THREE.RingGeometry(R * 0.12, R * 0.96, 128, 1), new THREE.ShaderMaterial({ uniforms: arcU, transparent: true, depthWrite: false, toneMapped: false,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform float uA, uOn, uR; uniform vec3 uCol; varying vec2 vP; void main(){ float a = atan(vP.x, vP.y); if (a < 0.) a += 6.2831853; if (a > uA) discard; float r = length(vP) / uR; float trail = exp(-(uA - a) * 1.2); float band = smoothstep(0.785, 0.795, r) * (1. - smoothstep(0.825, 0.835, r)); gl_FragColor = vec4(uCol * (0.7 + band * 0.9), (0.025 + 0.045 * trail + band * (0.5 + 0.45 * trail)) * uOn); }` }));
  arcU.uR.value = R; arc.position.z = m(0.0037); arc.renderOrder = 2; g.add(arc);
  // hands
  const handShape = (len, tail, w0, w1, cw) => { const n = new THREE.Shape(); n.moveTo(-w0 * 0.4, -tail); n.lineTo(-w0 / 2, 0); n.lineTo(-w1 / 2, len); n.lineTo(w1 / 2, len); n.lineTo(w0 / 2, 0); n.lineTo(w0 * 0.4, -tail); n.closePath(); const c = new THREE.Shape(); c.absarc(0, -tail, cw, 0, TAU, false); const hb = new THREE.Shape(); hb.absarc(0, 0, w0 * 1.25, 0, TAU, false); return [n, c, hb]; };
  const ext = (sh, d) => new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: true, bevelThickness: d * 0.3, bevelSize: d * 0.25, bevelSegments: 2, curveSegments: 16 });
  const secMat = mat.lit(hand || accent, hand || accent, 0.25, { rough: 0.3, metal: 0.2 });
  const sec = new THREE.Group(); sec.position.z = m(0.0042); g.add(sec);
  sec.add(mesh(ext(handShape(R * 0.94, R * 0.22, m(0.0011), m(0.00045), R * 0.07), m(0.00025)), secMat));
  const hub = mesh(new THREE.CylinderGeometry(m(0.0013), m(0.0013), m(0.0007), 32).rotateX(Math.PI / 2), steel); hub.position.z = m(0.0004); sec.add(hub);
  const minHand = new THREE.Group(); minHand.position.set(0, -(sdy - DR) / DR * R, m(0.0039)); g.add(minHand);
  minHand.add(mesh(ext(handShape(R * 0.17, R * 0.04, m(0.0008), m(0.0004), R * 0.015), m(0.0002)), mat.lit(ink, ink, 0.1, { rough: 0.35 })));
  const mhub = mesh(new THREE.CylinderGeometry(m(0.0007), m(0.0007), m(0.0004), 24).rotateX(Math.PI / 2), steel); mhub.position.z = m(0.0003); minHand.add(mhub);
  // crystal: a shallow dome of thin glass
  const DOME = 0.15, th0 = Math.asin(0.0242 / DOME);
  const dome = new THREE.SphereGeometry(m(DOME), 96, 12, 0, TAU, 0, th0).rotateX(Math.PI / 2).translate(0, 0, m(0.0058 - DOME * Math.cos(th0)));
  const crystal = new THREE.Mesh(dome, glassSkin({ env: 1.6 })); crystal.renderOrder = 3; g.add(crystal);
  // crown, bow and pusher
  const top = m(0.0275);
  const stem = mesh(new THREE.CylinderGeometry(m(0.0022), m(0.0024), m(0.004), 24).translate(0, top + m(0.0018), 0), steel); g.add(stem);
  const crownGeo = new THREE.CylinderGeometry(m(0.0043), m(0.0043), m(0.0052), 72, 1);
  { const p = crownGeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z); if (r > m(0.003)) { const t = Math.atan2(z, x), k = 1 + 0.06 * Math.max(0, Math.cos(t * 24)); p.setX(i, x * k); p.setZ(i, z * k); } } crownGeo.computeVertexNormals(); }
  const crown = mesh(crownGeo.translate(0, top + m(0.0062), 0), brushed); g.add(crown);
  const bow = mesh(new THREE.TorusGeometry(m(0.0078), m(0.0016), 16, 64).translate(0, top + m(0.0148), 0), steel); g.add(bow);
  const push = new THREE.Group(); push.rotation.z = deg(-38); g.add(push);
  push.add(mesh(new THREE.CylinderGeometry(m(0.0015), m(0.0015), m(0.004), 16).translate(0, top + m(0.0012), 0), steel));
  push.add(mesh(new THREE.CylinderGeometry(m(0.0027), m(0.0027), m(0.0028), 32).translate(0, top + m(0.0042), 0), brushed));
  anchor(g, 'dial', new THREE.Vector3(0, 0, m(0.006)), g.anchors);
  anchor(g, 'crown', new THREE.Vector3(0, top + m(0.016), 0), g.anchors);
  anchor(sec, 'hand', new THREE.Vector3(0, R * 0.94, m(0.0005)), g.anchors);
  g.setTime = (sec_) => {
    const t = tick > 0 ? Math.floor(sec_ * tick) / tick : sec_;
    const f = (((t % 60) + 60) % 60) / 60;
    sec.rotation.z = -f * TAU;
    minHand.rotation.z = -((((t / 60) % 30) + 30) % 30) / 30 * TAU;
    arcU.uA.value = f * TAU;
  };
  g.setSweep = (on) => { arcU.uOn.value = typeof on === 'number' ? on : on ? 1 : 0; };
  g.hand = sec;
  g.userData = { perMetre: s, size: [m(0.055), m(0.075), m(0.016)] };
  g.setTime(time);
  return withAnchors(measureBounds(g));
}

// ---------- magnifier ----------
// magnifier({ width = 1, finish = 'black', zoom = 2.2 }): a magnifying glass, lens facing +z, centred on the lens,
// handle down. width: across the rim (real 0.083 m). The glass magnifies what is behind it `zoom` times about the lens
// centre, with a little pincushion and colour fringing towards the rim: each sub-frame the scene is rendered again
// through the lens into a texture, so glows, text and transparent things magnify too. mag.setZoom(v) animates it
// (1 = plain glass; 1 -> 2.5 is the "zoom in" beat). Depth of field carries into the glass: focus k.lens on what is
// behind the lens and it stays sharp there while the rim softens. refract: false is a cheap reflective lens with no
// extra pass; res is the size of that pass. mag.lens is the glass mesh. Anchors: lens, handle.
let lensPass = false; const LENSES = new Set(); // in one lens's pass every lens is plain glass (no stale views)
export function magnifier(o = {}) {
  const { finish = 'black', refract = true, handleColor = '#121316', res = 1024, distortion = 0.22, fringe = 0.012 } = o;
  let zoom = o.zoom ?? 2.2;
  const s = scaleOf(o, 'width', REAL.magnifier, 1);
  const m = (v) => v * s;
  const g = new THREE.Group(); g.name = 'magnifier'; g.anchors = {};
  const rimMat = finish === 'brass' ? mat.metal('#d8b46a', { rough: 0.22 }) : finish === 'silver' ? mat.metal('#d9dde2', { rough: 0.18 }) : mat.metal('#2a2c30', { rough: 0.3 });
  const chrome = mat.metal('#e3e6ea', { rough: 0.12 });
  const ri = 0.0372, ro = 0.0415, hz = 0.0052;
  g.add(mesh(lathe([[ri, 0], [ri, -hz], [ro, -hz], [ro, hz], [ri, hz], [ri, 0]].map(([r, y]) => [m(r), m(y)]), [0, m(0.0012), m(0.0018), m(0.0018), m(0.0012), 0], 128).rotateX(Math.PI / 2), rimMat));
  const Rl = 0.0374, tc = 0.0062, te = 0.0016, lp = [];
  for (let i = 0; i <= 16; i++) { const r = (i / 16) * Rl; lp.push([m(r), m(-(te + (tc - te) * (1 - (r / Rl) ** 2)) / 2)]); }
  for (let i = 16; i >= 0; i--) { const r = (i / 16) * Rl; lp.push([m(r), m((te + (tc - te) * (1 - (r / Rl) ** 2)) / 2)]); }
  const lensGeo = new THREE.LatheGeometry(lp.map(([r, y]) => new THREE.Vector2(r, y)), 96).rotateX(Math.PI / 2);
  const skin = new THREE.Mesh(lensGeo, glassSkin({ env: 1.6 })); skin.renderOrder = 3; g.add(skin);
  let lens = skin;
  if (refract) {
    // the view through the glass: the scene from this camera, with the projection scaled about the lens centre so the
    // lens disc shows 1/zoom of what it covers; the lens looks it up by its own screen position
    const rt = new THREE.WebGLRenderTarget(res, res, { type: THREE.HalfFloatType, depthBuffer: true, samples: 4 });
    // uFocus / uAperture make this a lens-aware material: the engine sets them every sub-frame
    const U = { tView: { value: rt.texture }, uC: { value: new THREE.Vector2() }, uR: { value: new THREE.Vector2(1, 1) }, uK: { value: 0 }, uF: { value: fringe }, uFocus: { value: 10 }, uAperture: { value: 0 } };
    const viewMat = new THREE.ShaderMaterial({
      uniforms: U, transparent: true, toneMapped: false, fog: false,
      vertexShader: 'varying vec4 vClip; varying vec3 vN; varying vec3 vV; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - w.xyz; vClip = projectionMatrix * viewMatrix * w; gl_Position = vClip; }',
      fragmentShader: `uniform sampler2D tView; uniform vec2 uC, uR; uniform float uK, uF; varying vec4 vClip; varying vec3 vN; varying vec3 vV;
        void main(){
          vec2 q = (vClip.xy / vClip.w - uC) / uR; float r2 = dot(q, q) * 1.39; // r2 ~ 1 at the rim
          vec2 p = q * (1. - uK * r2);                                          // pincushion: more zoom towards the rim
          vec3 c = vec3(texture2D(tView, p * (1. + uF * r2) * .5 + .5).r, texture2D(tView, p * .5 + .5).g, texture2D(tView, p * (1. - uF * r2) * .5 + .5).b);
          float facing = abs(dot(normalize(vN), normalize(vV)));
          c *= mix(.6, 1., smoothstep(0., .45, facing)) * (1. - .28 * smoothstep(.55, 1., r2));
          gl_FragColor = vec4(c, 1.); }`,
    });
    lens = new THREE.Mesh(lensGeo, viewMat); lens.renderOrder = 2; g.add(lens); LENSES.add(lens);
    viewMat.addEventListener('dispose', () => { rt.dispose(); LENSES.delete(lens); });
    const vcam = new THREE.PerspectiveCamera(), rest = new THREE.PerspectiveCamera(); vcam.matrixAutoUpdate = false; vcam.matrixWorldAutoUpdate = false;
    const C0 = new THREE.Vector4(), wp = new THREE.Vector3(), ws = new THREE.Vector3(), cp = new THREE.Vector3(), fw = new THREE.Vector3(), ax = new THREE.Vector3(), M = new THREE.Matrix4();
    lens.onBeforeRender = (renderer, scene, camera) => {
      if (lensPass) return;
      lens.getWorldPosition(wp); C0.set(wp.x, wp.y, wp.z, 1).applyMatrix4(camera.matrixWorldInverse);
      const vz = -C0.z; if (vz <= 1e-4) return;
      const P = camera.projectionMatrix.elements, f = U.uFocus.value;
      if (U.uAperture.value > 0 && camera.isPerspectiveCamera) {
        // For depth of field the engine moves the camera across the aperture and tilts the projection (elements 8, 9)
        // to hold the focus plane still. Undo the move, then magnify about the point of the focus plane behind the
        // lens centre: that point does not jitter, so what is in focus stays sharp in the glass.
        rest.copy(camera, false); rest.updateProjectionMatrix(); const R0 = rest.projectionMatrix.elements;
        camera.getWorldPosition(cp);
        cp.addScaledVector(ax.setFromMatrixColumn(camera.matrixWorld, 0), ((P[8] - R0[8]) * f) / P[0]).addScaledVector(ax.setFromMatrixColumn(camera.matrixWorld, 1), ((P[9] - R0[9]) * f) / P[5]);
        camera.getWorldDirection(fw); const d = ax.copy(wp).sub(cp).dot(fw);
        if (d > 1e-4) C0.copy(ax.copy(wp).sub(cp).multiplyScalar(f / d).add(cp)).setW(1).applyMatrix4(camera.matrixWorldInverse);
      }
      C0.applyMatrix4(camera.projectionMatrix);
      const cx = C0.x / C0.w, cy = C0.y / C0.w;
      const Rw = m(Rl) * lens.getWorldScale(ws).x * 1.18; // margin: a tilted, off-centre disc projects a little wider
      const rx = (Rw * P[0]) / vz, ry = (Rw * P[5]) / vz, z = Math.max(1, zoom), sx = z / rx, sy = z / ry;
      U.uC.value.set(cx, cy); U.uR.value.set(rx, ry); U.uK.value = distortion * (1 - 1 / z);
      M.set(sx, 0, 0, -sx * cx, 0, sy, 0, -sy * cy, 0, 0, 1, 0, 0, 0, 0, 1);
      vcam.projectionMatrix.multiplyMatrices(M, camera.projectionMatrix); vcam.projectionMatrixInverse.copy(vcam.projectionMatrix).invert();
      vcam.matrixWorld.copy(camera.matrixWorld); vcam.matrixWorldInverse.copy(camera.matrixWorldInverse); vcam.layers.mask = camera.layers.mask;
      const prevRT = renderer.getRenderTarget(), prevShadow = renderer.shadowMap.autoUpdate, prevXR = renderer.xr.enabled;
      lensPass = true; g.visible = false; renderer.shadowMap.autoUpdate = false; renderer.xr.enabled = false;
      const shown = [...LENSES].filter((l) => l.visible); for (const l of shown) l.visible = false;
      renderer.setRenderTarget(rt); renderer.clear(true, true, true); renderer.render(scene, vcam);
      for (const l of shown) l.visible = true;
      renderer.setRenderTarget(prevRT); renderer.shadowMap.autoUpdate = prevShadow; renderer.xr.enabled = prevXR; g.visible = true; lensPass = false;
    };
  }
  // neck, collar and handle
  const nTop = -m(ro - 0.0005);
  g.add(mesh(new THREE.CylinderGeometry(m(0.0042), m(0.005), m(0.014), 32).translate(0, nTop - m(0.007), 0), chrome));
  const yc = nTop - m(0.013);
  g.add(mesh(lathe([[0, 0], [0.0098, 0], [0.0102, -0.002], [0.0102, -0.013], [0.0098, -0.015], [0, -0.015]].map(([r, y]) => [m(r), yc + m(y)]).reverse(), [0, m(0.0012), m(0.0008), m(0.0008), m(0.0012), 0], 64), chrome));
  const yh = yc - m(0.015);
  const hp = [[0, -0.112], [0.006, -0.1115], [0.0108, -0.108], [0.0118, -0.085], [0.0112, -0.04], [0.0095, -0.006], [0.0092, 0], [0, 0]].map(([r, y]) => [m(r), yh + m(y)]);
  g.add(mesh(lathe(hp, [0, m(0.003), m(0.004), m(0.03), m(0.03), m(0.004), 0, 0], 64, 8), mat.plastic(handleColor, { rough: 0.28, clearcoat: 0.8, ccRough: 0.12 })));
  anchor(g, 'lens', new THREE.Vector3(0, 0, m(0.004)), g.anchors);
  anchor(g, 'handle', new THREE.Vector3(0, yh - m(0.06), 0), g.anchors);
  g.lens = lens;
  g.setZoom = (v) => { zoom = v; };
  g.userData = { perMetre: s, size: [m(0.083), m(0.083) / 2 + m(0.042) + m(0.112) + m(0.028), m(0.0104)] };
  return withAnchors(measureBounds(g));
}

// ---------- microwave oven ----------
// Seven-segment digits drawn on a canvas (appliance displays read instantly in this style).
const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '' };
function sevenSeg(g, text, cx, cy, h, color, ghost) {
  const w = h * 0.52, th = h * 0.11, gap = h * 0.2, chars = [...String(text)];
  const width = chars.reduce((a, ch) => a + (ch === ':' || ch === '.' ? h * 0.22 : w + gap), -gap);
  let x = cx - width / 2;
  const P = { a: [[0, 0], [1, 0]], b: [[1, 0], [1, 1]], c: [[1, 1], [1, 2]], d: [[0, 2], [1, 2]], e: [[0, 1], [0, 2]], f: [[0, 0], [0, 1]], g: [[0, 1], [1, 1]] };
  g.save(); g.lineCap = 'round'; g.lineWidth = th;
  for (const ch of chars) {
    if (ch === ':' || ch === '.') { g.fillStyle = color; for (const yy of ch === ':' ? [0.62, 1.38] : [1.95]) { g.beginPath(); g.arc(x + h * 0.08 + (1 - yy / 2) * h * 0.1, cy - h / 2 + yy * (h / 2), th * 0.62, 0, TAU); g.fill(); } x += h * 0.22; continue; }
    const on = SEG[ch] ?? '';
    for (const k of 'abcdefg') {
      const [[x0, y0], [x1, y1]] = P[k], sh = 0.16, ox = (yy) => (1 - yy / 2) * h * 0.1;
      const ax = x + x0 * w + ox(y0), ay = cy - h / 2 + y0 * (h / 2), bx = x + x1 * w + ox(y1), by = cy - h / 2 + y1 * (h / 2);
      const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
      g.strokeStyle = on.includes(k) ? color : ghost; g.beginPath(); g.moveTo(ax + (dx / L) * L * sh, ay + (dy / L) * L * sh); g.lineTo(bx - (dx / L) * L * sh, by - (dy / L) * L * sh); g.stroke();
    }
    x += w + gap;
  }
  g.restore();
}

// microwaveOven({ width = 1.6, open = 0, on = 0, color = 'steel', display = '0:30', rpm = 6 }): a countertop
// microwave: steel body, black glass door with the perforated window screen, keypad, 7-segment display, a glass
// turntable on a roller ring, and a lamp inside. width: real 0.52 m. color: steel | black | white (steel is a mirror:
// a flat side flashes when it faces a bright part of the env; black is the moodier choice in dark worlds).
// The cavity is dark enamel (enamel '#2a2c30', enamelGlow .05 when on) lit by the lamp, a shadow-casting warm spot
// under the ceiling aimed at the plate, so food on it shades itself and the walls fall off into the corners: it reads
// as a lit box, not an evenly glowing one. lamp: a colour, or { color '#ffd9a0', intensity 1 (x the default),
// shadow true }; call k.softLight(mw.lamp, size * 0.04) for soft shadows. door: false leaves the door off (a
// cutaway: the camera can look straight in). The turntable is lit glass. mw.setOpen(0..1) swings the door (hinged
// left); mw.setOn(0..1) lamp and cavity glow; mw.at(t) turns the plate (t = seconds of cooking: pass t - start to
// start later); mw.setDisplay('1:25') (redraws only when it changes). mw.plate is a group on the turntable: add food
// to it and it turns. Anchors: display, window, plate, cavity, and cavityCam: a camera spot in front of the opening
// (0.7 m real from the plate, 24 degrees up), framing the food with the lit back wall behind it at fov 30
// (cam.apply(camera, { pos: cavityCam world, look: plate world, fov: 30 }); with the door shut, open it or use door: false).
export function microwaveOven(o = {}) {
  const { open = 0, on = 0, color = 'steel', display = '0:30', rpm = 6, accent = accentDefault(), displayColor = null, enamel: enamelColor = '#2a2c30', enamelGlow = 0.05, door: withDoor = true } = o;
  const L = typeof o.lamp === 'string' ? { color: o.lamp } : o.lamp || {};
  const lamp = L.color ?? '#ffd9a0', lampK = L.intensity ?? 1, lampShadow = L.shadow ?? true;
  const s = scaleOf(o, 'width', REAL.microwave, 1.6);
  const m = (v) => v * s;
  const W = m(0.52), H = m(0.305), D = m(0.42), FT = m(0.008), yM = FT + H / 2, fz = D / 2;
  const g = new THREE.Group(); g.name = 'microwaveOven'; g.anchors = {};
  const bodyMat = color === 'black' ? mat.plastic('#17181b', { rough: 0.4, clearcoat: 0.5 }) : color === 'white' ? mat.plastic('#e9eaec', { rough: 0.35, clearcoat: 0.5 }) : mat.metal('#aab0b7', { rough: 0.3, env: 0.8, extra: { anisotropy: 0.3 } });
  const e = m(0.006);
  const shell = mesh(standUp(slabGeometry(W, H, D, { rc: m(0.012), top: e, bottom: m(0.01), cs: 8, es: 4, capTop: false }), D), bodyMat);
  shell.position.y = yM; g.add(shell);
  // cavity: interior box seen from inside, dark enamel with a fine orange-peel bump, lit by the lamp
  const cw = m(0.335), ch = m(0.215), cd = m(0.33), cx = -W / 2 + m(0.035) + cw / 2, cy = FT + m(0.045) + ch / 2, cz = fz - m(0.004) - cd / 2;
  const fr = new THREE.Shape(roundedRect(W - 2 * e, H - 2 * e, m(0.012) - e).getPoints(12));
  fr.holes.push(new THREE.Path(roundedRect(cw, ch, m(0.006)).getPoints(6).map((p) => p.add(new THREE.Vector2(cx, cy - yM)))));
  const front = mesh(new THREE.ExtrudeGeometry(fr, { depth: m(0.004), bevelEnabled: false, curveSegments: 8 }), bodyMat);
  front.position.set(0, yM, fz - m(0.004)); g.add(front);
  const enamel = new THREE.MeshStandardMaterial({ color: C(enamelColor), roughness: 0.42, side: THREE.BackSide, emissive: C(lamp), emissiveIntensity: 0, bumpMap: noiseTexture({ kind: 'fbm', scale: 16, seed: 4, repeat: 3, size: 256 }), bumpScale: 0.35 });
  const cavity = mesh(new THREE.BoxGeometry(cw, ch, cd), enamel, { cast: false });
  cavity.position.set(cx, cy, cz); g.add(cavity);
  const wg = mesh(new THREE.PlaneGeometry(m(0.1), m(0.075)), decal(new THREE.MeshStandardMaterial({ color: C('#cbbf9f'), roughness: 0.7, emissive: C(lamp), emissiveIntensity: 0 })), { cast: false });
  wg.rotation.y = -Math.PI / 2; wg.position.set(cx + cw / 2 - m(0.0004), cy + m(0.04), cz + m(0.03)); g.add(wg);
  // a perforated vent on the back wall: the detail that says "inside a microwave"
  const [pc, pg] = canvas(512, 384);
  pg.fillStyle = '#000000'; pg.fillRect(0, 0, 512, 384); pg.fillStyle = '#ffffff';
  for (let y = 0; y < 16; y++) for (let x = 0; x < 22; x++) { pg.beginPath(); pg.arc(14 + x * 22.6 + (y % 2) * 11.3, 14 + y * 22.6, 5.2, 0, TAU); pg.fill(); }
  const vent = mesh(new THREE.PlaneGeometry(cw * 0.42, cw * 0.315), new THREE.MeshStandardMaterial({ color: C('#050505'), roughness: 0.9, alphaMap: canvasTex(pc, false), transparent: true, depthWrite: false }), { cast: false });
  vent.position.set(cx + cw * 0.12, cy + ch * 0.08, cz - cd / 2 + m(0.0004)); g.add(vent);
  // side vents: rows of slots on the right-hand side
  const [vc2, vg2] = canvas(512, 256);
  vg2.fillStyle = '#ffffff'; for (let r = 0; r < 6; r++) for (let c = 0; c < 9; c++) { vg2.beginPath(); vg2.roundRect(18 + c * 54, 22 + r * 38, 36, 12, 6); vg2.fill(); }
  const ventTex = canvasTex(vc2, false);
  const ventMat = decal(new THREE.MeshStandardMaterial({ color: C('#050506'), roughness: 0.9, alphaMap: ventTex, transparent: true, depthWrite: false }));
  const sideVent = mesh(new THREE.PlaneGeometry(m(0.16), m(0.08)), ventMat, { cast: false }); sideVent.rotation.y = Math.PI / 2; sideVent.position.set(W / 2 + m(0.0002), yM + m(0.06), -D / 2 + m(0.12)); g.add(sideVent);
  // turntable: lit glass on a roller ring (transmission: it shows the floor through it and catches the lamp's highlight)
  const tt = new THREE.Group(); tt.position.set(cx, cy - ch / 2, cz); g.add(tt);
  tt.add(mesh(new THREE.TorusGeometry(m(0.085), m(0.0028), 8, 64).rotateX(Math.PI / 2).translate(0, m(0.006), 0), mat.plastic('#3a3d42', { rough: 0.5 })));
  const spin = new THREE.Group(); tt.add(spin);
  const plateProf = [[0, 0.0095], [0.118, 0.0095], [0.127, 0.012], [0.132, 0.0205], [0.129, 0.022], [0.124, 0.0135], [0.112, 0.012], [0, 0.012]].map(([r, y]) => [m(r), m(y)]).reverse();
  const plateGeo = lathe(plateProf, [0, m(0.002), m(0.003), m(0.0015), m(0.002), m(0.002), m(0.002), 0], 96);
  const plateMat = new THREE.MeshPhysicalMaterial({ color: C('#eef6f2'), roughness: 0.05, metalness: 0, transmission: 1, thickness: m(0.004), ior: 1.5, attenuationColor: C('#a6cfc2'), attenuationDistance: m(0.08), clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.7 });
  spin.add(mesh(plateGeo, plateMat, { cast: false }));
  const plate = new THREE.Group(); plate.position.y = m(0.0122); spin.add(plate);
  // the lamp: a warm spot under the ceiling aimed at the plate, range-limited so it does not leak out of the cavity;
  // it casts shadows (food shades itself and the plate) and the dark enamel falls off into the corners
  const spot = new THREE.SpotLight(C(lamp), 0, ch * 1.6, 1.0, 0.7, 1.4);
  spot.position.set(cx + cw * 0.3, cy + ch / 2 - m(0.01), cz + cd * 0.15); spot.target.position.set(cx, cy - ch / 2 + m(0.03), cz); g.add(spot, spot.target);
  if (lampShadow) {
    spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0004; spot.shadow.normalBias = m(0.0006);
    Object.assign(spot.shadow.camera, { near: m(0.01), far: ch * 1.7 });
  }
  // door: black glass frame around the window, smoked glass, the perforated screen, a steel handle (door: false, none)
  const DW = m(0.388), DH = H - m(0.008), DT = m(0.028), b = m(0.0022), ww = m(0.262), wh = m(0.19), wx = DW / 2 - m(0.02), wy = m(0.004);
  const door = withDoor ? new THREE.Group() : null;
  const doorMat = mat.plastic('#0b0c0e', { rough: 0.16, clearcoat: 1, ccRough: 0.05 });
  if (door) {
    door.position.set(-W / 2 + m(0.003), yM, fz); g.add(door);
    const ds = new THREE.Shape(roundedRect(DW - 2 * b, DH - 2 * b, m(0.009)).getPoints(10).map((p) => p.add(new THREE.Vector2(DW / 2, 0))));
    ds.holes.push(new THREE.Path(roundedRect(ww, wh, m(0.012)).getPoints(10).map((p) => p.add(new THREE.Vector2(wx, wy)))));
    door.add(mesh(new THREE.ExtrudeGeometry(ds, { depth: DT - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 10 }).translate(0, 0, b), doorMat));
    const [dc, dg] = canvas(256, 256);
    dg.fillStyle = '#ffffff'; dg.fillRect(0, 0, 256, 256); dg.fillStyle = '#000000';
    for (let y = 0; y < 4; y++) for (let x = -1; x < 4; x++) { dg.beginPath(); dg.arc(32 + x * 64 + (y % 2) * 32, 32 + y * 64, 21, 0, TAU); dg.fill(); }
    const dots = canvasTex(dc, false); dots.wrapS = dots.wrapT = THREE.RepeatWrapping; dots.repeat.set(ww / m(0.0128), wh / m(0.0128));
    const winGeo = new THREE.ShapeGeometry(roundedRect(ww + m(0.004), wh + m(0.004), m(0.013)), 10).translate(wx, wy, 0);
    const screenM = new THREE.MeshStandardMaterial({ color: C('#16181b'), metalness: 0.5, roughness: 0.5, alphaMap: dots, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const scr = new THREE.Mesh(planarUV(winGeo.clone()), screenM); scr.position.z = DT * 0.45; scr.renderOrder = 1; door.add(scr);
    const smoke = new THREE.Mesh(winGeo, tint('#000000', 0.3)); smoke.position.z = DT - m(0.0015); smoke.renderOrder = 2; door.add(smoke);
    const shine = new THREE.Mesh(winGeo, glassSkin({ env: 1.2 })); shine.position.z = DT - m(0.0014); shine.renderOrder = 3; door.add(shine);
    const hx = DW - m(0.03);
    const handle = mesh(standUp(slabGeometry(m(0.014), m(0.2), m(0.011), { rc: m(0.005), top: m(0.004), bottom: m(0.002), cs: 6, es: 3 }), m(0.011)), mat.brushed('#c9cdd2', { rough: 0.26 }));
    handle.position.set(hx, 0, DT + m(0.017)); door.add(handle);
    for (const yy of [-1, 1]) { const st = mesh(new THREE.CylinderGeometry(m(0.0035), m(0.0035), m(0.014), 16).rotateX(Math.PI / 2), mat.brushed('#c9cdd2', { rough: 0.26 })); st.position.set(hx, yy * m(0.088), DT + m(0.008)); door.add(st); }
  }
  // control panel: black glass with a printed keypad and the display
  const px = -W / 2 + m(0.396), pw = W / 2 - m(0.006) - px, pcx = px + pw / 2;
  const panel = mesh(standUp(slabGeometry(pw, DH, DT, { rc: m(0.008), top: m(0.0016), topKind: 'chamfer', bottom: m(0.001), cs: 6, es: 2 }), DT), doorMat);
  panel.position.set(pcx, yM, fz + DT / 2); g.add(panel);
  const KW = 236, KH = Math.round((KW * DH) / pw), [kc, kg] = canvas(KW * 2, KH * 2), sc = (KW * 2) / pw;
  kg.scale(2, 2); kg.clearRect(0, 0, KW, KH);
  const mm = (v) => (m(v) * sc) / 2;
  kg.strokeStyle = 'rgba(205,210,218,0.55)'; kg.fillStyle = 'rgba(215,220,228,0.85)'; kg.lineWidth = 1.4; kg.textAlign = 'center'; kg.textBaseline = 'middle';
  const keysY = mm(0.085), kpX = [KW / 2 - mm(0.03), KW / 2, KW / 2 + mm(0.03)];
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', ''].forEach((t, i) => { if (!t) return; const x = kpX[i % 3], y = keysY + Math.floor(i / 3) * mm(0.027); kg.beginPath(); kg.arc(x, y, mm(0.0095), 0, TAU); kg.stroke(); kg.font = `500 ${mm(0.009)}px Inter`; kg.fillText(t, x, y + 0.5); });
  const by0 = keysY + 4 * mm(0.027) + mm(0.006);
  kg.beginPath(); kg.roundRect(KW / 2 - mm(0.042), by0, mm(0.084), mm(0.022), mm(0.011)); kg.stroke();
  kg.fillStyle = 'rgba(215,220,228,0.85)'; kg.beginPath(); kg.moveTo(KW / 2 - mm(0.004), by0 + mm(0.006)); kg.lineTo(KW / 2 + mm(0.006), by0 + mm(0.011)); kg.lineTo(KW / 2 - mm(0.004), by0 + mm(0.016)); kg.fill();
  kg.strokeStyle = accent; kg.lineWidth = 2; kg.beginPath(); kg.roundRect(KW / 2 - mm(0.042), by0 + mm(0.03), mm(0.084), mm(0.022), mm(0.011)); kg.stroke();
  kg.fillStyle = accent; kg.fillRect(KW / 2 - mm(0.005), by0 + mm(0.036), mm(0.01), mm(0.01));
  const print = mesh(new THREE.PlaneGeometry(pw, DH), decal(new THREE.MeshStandardMaterial({ map: canvasTex(kc), transparent: true, roughness: 0.4, depthWrite: false })), { cast: false });
  print.position.set(pcx, yM, fz + DT + m(0.0002)); g.add(print);
  // display: 7-segment digits on a black window
  const [vc, vg] = canvas(512, 168), dcol = displayColor || accent, dtex = canvasTex(vc);
  const ghost = `rgba(${C(dcol).toArray().map((v) => Math.round(v * 255)).join(',')},0.07)`; // unlit segments, a ghost of the lit colour
  let shown = null;
  const drawDisplay = (txt) => { if (txt === shown) return; shown = txt; vg.fillStyle = '#000000'; vg.fillRect(0, 0, 512, 168); vg.globalAlpha = 1; sevenSeg(vg, txt, 256, 84, 112, dcol, ghost); dtex.needsUpdate = true; };
  const dispMat = new THREE.MeshBasicMaterial({ map: dtex, toneMapped: false, color: new THREE.Color(2.2, 2.2, 2.2) });
  const disp = mesh(new THREE.ShapeGeometry(roundedRect(m(0.088), m(0.029), m(0.003)), 4), decal(dispMat), { cast: false });
  planarUV(disp.geometry); disp.position.set(pcx, yM + DH / 2 - m(0.04), fz + DT + m(0.0003)); g.add(disp);
  const feet = merge([-1, 1].flatMap((sx) => [-1, 1].map((sz) => new THREE.CylinderGeometry(m(0.012), m(0.013), FT, 20).translate(sx * (W / 2 - m(0.05)), FT / 2, sz * (D / 2 - m(0.05))))));
  g.add(mesh(feet, mat.rubber('#0b0b0c'), { cast: false }));
  anchor(g, 'display', disp.position.clone().setZ(fz + DT + m(0.001)), g.anchors);
  if (door) anchor(door, 'window', new THREE.Vector3(wx, wy, DT), g.anchors); else anchor(g, 'window', new THREE.Vector3(cx, cy, fz), g.anchors);
  anchor(g, 'cavity', new THREE.Vector3(cx, cy, cz), g.anchors);
  anchor(plate, 'plate', new THREE.Vector3(), g.anchors);
  // a camera spot 0.7 m (real) from the plate, 24 degrees above it: into the food, the lit back wall behind it and
  // the oven's dark frame across the top of the picture
  const ca = deg(24), cr = m(0.7);
  anchor(g, 'cavityCam', new THREE.Vector3(cx, cy - ch / 2 + m(0.03) + Math.sin(ca) * cr, cz + Math.cos(ca) * cr), g.anchors);
  let onNow = on;
  g.setOpen = (p) => { if (door) door.rotation.y = -deg(100) * ease.inOutSine(clamp(p)); };
  g.setOn = (v) => { onNow = clamp(v); wg.material.emissiveIntensity = onNow * enamelGlow * 1.2; spot.intensity = onNow * 9 * lampK * Math.pow(ch * 0.9, 1.4); spot.visible = onNow > 0; enamel.emissiveIntensity = onNow * enamelGlow; }; // off: no shadow pass
  g.at = (t) => { spin.rotation.y = (t * rpm * TAU) / 60; };
  g.setDisplay = (txt) => drawDisplay(String(txt));
  g.setDisplayGlow = (v) => { dispMat.color.setScalar(v); };
  g.plate = plate; g.door = door; g.lamp = spot;
  g.userData = { perMetre: s, size: [W, FT + H, D + DT], footprint: [W, D] };
  g.setOpen(0); measureBounds(g); g.setOpen(open); g.setOn(on); g.at(0); drawDisplay(display);
  return withAnchors(g);
}

// ---------- earbuds ----------
// The shell is glossy white polycarbonate: a satin base under a clear coat (two roughness levels, as the real one
// reads); the ear tips are matte silicone with a soft sheen; the grilles a dark acoustic mesh. White plastic reads
// mid-grey in a dark world unless a light falls on it: give the case its own narrow cool spot (look.productLight).
const budMat = (color) => mat.plastic(color, { rough: 0.3, clearcoat: 1, ccRough: 0.08 });
const tipMat = (color) => new THREE.MeshPhysicalMaterial({ color: C(color), roughness: 0.7, metalness: 0, sheen: 0.45, sheenRoughness: 0.55, sheenColor: C('#ffffff'), envMapIntensity: 0.6 });
// A fine perforated mesh (holes about 0.28 mm apart) over a grille of w x h real metres; on planar uvs. Not a
// polygon-offset decal: the parts sit a hair proud of the shell instead, since an offset decal seen edge-on pokes
// through the closed lid as a thin dark line.
function grilleMat(w, h) {
  const [c, x] = canvas(64, 64);
  x.fillStyle = '#2a2c30'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#050506';
  for (let j = 0; j < 4; j++) for (let i = -1; i < 5; i++) { x.beginPath(); x.arc(8 + i * 16 + (j % 2) * 8, 8 + j * 16, 4.8, 0, TAU); x.fill(); }
  const t = canvasTex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(w / 0.0011, h / 0.0011);
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0.35, bumpMap: t, bumpScale: 0.6 });
}
function budParts(s, side, color, tipColor) {
  const m = (v) => v * s, g = new THREE.Group(), sx = side === 'left' ? 1 : -1, white = budMat(color);
  // head: an egg, fuller towards the nozzle (+x for the left bud: the ear tip points at the other bud)
  const egg = (x, y, z) => { const k = 1 + 0.16 * x * sx; return new THREE.Vector3(x * m(0.0094), y * m(0.0086) * (1 + 0.05 * x * sx), z * m(0.0092) * k); };
  let hg = new THREE.SphereGeometry(1, 48, 32);
  hg.deleteAttribute('uv'); hg.deleteAttribute('normal'); hg = mergeVertices(hg);
  const hp = hg.attributes.position;
  for (let i = 0; i < hp.count; i++) hp.setXYZ(i, ...egg(hp.getX(i), hp.getY(i), hp.getZ(i)).toArray());
  hg.computeVertexNormals();
  g.add(mesh(hg, white));
  // put a flat part (a grille, the sensor) on the egg, facing out along the surface normal at direction d
  const onHead = (d, obj) => {
    const u = new THREE.Vector3(...d).normalize(), t1 = new THREE.Vector3().crossVectors(u, Math.abs(u.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize(), t2 = new THREE.Vector3().crossVectors(u, t1);
    const at = (v) => egg(...v.normalize().toArray()), p = at(u.clone()), a = at(u.clone().addScaledVector(t1, 1e-3)).sub(p), b = at(u.clone().addScaledVector(t2, 1e-3)).sub(p);
    const n = new THREE.Vector3().crossVectors(a, b).normalize(); if (n.dot(p) < 0) n.negate();
    obj.position.copy(p).addScaledVector(n, m(0.00005)); obj.lookAt(obj.position.clone().add(n)); g.add(obj);
  };
  // nozzle and silicone ear tip; the tip's opening shows the speaker's dark mesh
  const dir = new THREE.Vector3(sx, 0.12, -0.42).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const noz = mesh(new THREE.CylinderGeometry(m(0.0033), m(0.0039), m(0.0045), 32).translate(0, m(0.00225), 0), white);
  noz.quaternion.copy(q); noz.position.copy(dir).multiplyScalar(m(0.0068)); g.add(noz);
  const tipG = lathe([[0, 0], [0.004, 0], [0.0052, 0.0014], [0.0056, 0.003], [0.0047, 0.0049], [0.0026, 0.0058], [0, 0.0058]].map(([r, y]) => [m(r), m(y)]), [0, m(0.0008), m(0.0012), m(0.0015), m(0.0012), m(0.0005), 0], 40, 4);
  const tip = mesh(tipG, tipMat(tipColor));
  tip.quaternion.copy(q); tip.position.copy(dir).multiplyScalar(m(0.0103)); g.add(tip);
  const port = mesh(planarUV(new THREE.CircleGeometry(m(0.0019), 28)), grilleMat(0.0038, 0.0038), { cast: false });
  port.rotation.x = -Math.PI / 2; port.position.y = m(0.00585); tip.add(port);
  // stem, leaning slightly out
  const stem = mesh(new THREE.CapsuleGeometry(m(0.0028), m(0.015), 8, 20), white); stem.scale.set(1.05, 1, 0.85);
  stem.position.set(-sx * m(0.0016), -m(0.0145), m(0.001)); stem.rotation.z = -sx * deg(5); g.add(stem);
  // dark mesh grilles: a pill on the outer shoulder, one at the top of the stem; the optical sensor on the inner side
  onHead([-sx * 0.7, 0.62, 0.35], mesh(planarUV(new THREE.ShapeGeometry(roundedRect(m(0.0042), m(0.0017), m(0.00085)), 6)), grilleMat(0.0042, 0.0017), { cast: false }));
  const sv = mesh(planarUV(new THREE.ShapeGeometry(roundedRect(m(0.0032), m(0.0013), m(0.00065)), 6)), grilleMat(0.0032, 0.0013), { cast: false });
  sv.position.set(-sx * m(0.0021), -m(0.0102), m(0.001 + 0.0028 * 0.85 + 0.00005)); g.add(sv);
  onHead([sx * 0.5, -0.42, -0.76], mesh(new THREE.CircleGeometry(m(0.0011), 24), mat.plastic('#0b0c0e', { rough: 0.12, clearcoat: 1, ccRough: 0.05 }), { cast: false }));
  return g;
}
// earbud({ width = 0.4, side = 'left', color }): one earbud on its own, centred on its head, stem down, ear tip
// pointing sideways (+x for the left bud) and a little back. width: across the head (real 0.0196 m). Anchors: tip.
export function earbud(o = {}) {
  const { side = 'left', color = '#f5f5f2', tipColor = '#e4e6e8' } = o;
  const s = scaleOf(o, 'width', REAL.earbud, 0.4);
  const g = budParts(s, side, color, tipColor); g.name = 'earbud'; g.anchors = {};
  anchor(g, 'tip', new THREE.Vector3(side === 'left' ? 0.917 : -0.917, 0.11, -0.385).multiplyScalar(0.016 * s), g.anchors);
  g.userData = { perMetre: s, size: [0.0196 * s, 0.045 * s, 0.02 * s] };
  return withAnchors(measureBounds(g));
}
// earbuds({ width = 1, open = 0, led = 'green' }): a glossy charging case (no logos) with two earbuds in their wells:
// a grooved lid seam, a brushed steel hinge and the pairing button on the back, a status LED that glows softly through
// the front. width: real 0.0606 m. case.setOpen(0..1) lifts the lid (hinged at the back). case.setLed(color, k).
// case.buds = [left, right]: groups you can move (bud.userData.home = their resting transform), or let
// case.lift(p, t, { height, spread, bob, forward }) do it: the buds rise out of their wells (p 0 .. 1: `height` above
// them, `spread` apart, `forward` out, turned towards the front) and float once up (bob: 0 holds them still). Pure;
// returns the right bud's world position. Defaults scale with the case (height 1.02, spread 0.33, forward 0.1 x width).
// Anchors: led, lid (front of the lid), buds (between them, in the case), budL, budR (each bud's head; they follow lift).
export function earbuds(o = {}) {
  const { open = 0, color = '#f5f7fa', tipColor = '#dfe2e5', led = '#46ff7e', ledIntensity = 4, angle = 105 } = o;
  const s = scaleOf(o, 'width', REAL.earbuds, 1);
  const m = (v) => v * s;
  const W = m(0.0606), D = m(0.0217), Hb = m(0.031), Hl = m(0.0142), rc = m(0.0098), sr = m(0.0005); // sr: each side of the seam's round
  const g = new THREE.Group(); g.name = 'earbuds'; g.anchors = {};
  const white = budMat(color);
  g.add(mesh(slabGeometry(W, D, Hb, { rc, bottom: m(0.0085), top: sr, cs: 12, es: 6, capTop: false }), white));
  // the seam: the two rounded edges meet over a dark band set in from the surface, so the lid line reads as a groove
  const band = mesh(slabGeometry(W - m(0.0007), D - m(0.0007), m(0.0016), { rc: rc - m(0.00035), cs: 12, capTop: false, capBottom: false }), new THREE.MeshStandardMaterial({ color: C('#1b1c1f'), roughness: 0.6 }), { cast: false });
  band.position.y = Hb - m(0.0008); g.add(band);
  // the deck with the two wells
  const deck = new THREE.Shape(roundedRect(W - 2 * sr, D - 2 * sr, rc - sr).getPoints(16));
  const wells = [-1, 1].map((sx) => { const p = new THREE.Path(); p.absellipse(sx * m(0.0162), 0, m(0.0099), m(0.0084), 0, TAU, false); return p; });
  deck.holes.push(...wells);
  g.add(mesh(new THREE.ShapeGeometry(deck, 24).rotateX(-Math.PI / 2).translate(0, Hb, 0), white, { cast: false }));
  const wellGeo = merge(wells.map((p) => new THREE.ExtrudeGeometry(new THREE.Shape(p.getPoints(48)), { depth: m(0.027), bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, Hb - m(0.027), 0)));
  g.add(mesh(wellGeo, mat.plastic(shade(color, 0.92), { rough: 0.45, clearcoat: 0, extra: { side: THREE.BackSide } }), { cast: false }));
  // lid on its hinge
  const lid = new THREE.Group(); lid.position.set(0, Hb, -D / 2 + m(0.0026)); g.add(lid);
  const lidM = mesh(slabGeometry(W, D, Hl, { rc, top: m(0.0082), bottom: sr, cs: 12, es: 6 }), white);
  lidM.position.set(0, m(0.00012), D / 2 - m(0.0026)); lid.add(lidM);
  // on the back: the steel hinge in the seam, and the pairing button with a dark gap round it
  const hinge = mesh(new THREE.CapsuleGeometry(m(0.0011), m(0.011), 6, 24).rotateZ(Math.PI / 2), mat.brushed('#c9cdd3', { rough: 0.3, aniso: 0.5 }));
  hinge.position.set(0, Hb + m(0.0001), -D / 2 + m(0.0004)); g.add(hinge);
  const btn = mesh(new THREE.CylinderGeometry(m(0.0021), m(0.0021), m(0.0004), 40).rotateX(Math.PI / 2), white, { cast: false });
  btn.position.set(0, Hb * 0.42, -D / 2 - m(0.0001)); g.add(btn);
  const gap = mesh(new THREE.RingGeometry(m(0.0021), m(0.00245), 48), new THREE.MeshStandardMaterial({ color: C('#2a2c30'), roughness: 0.6 }), { cast: false });
  gap.rotation.y = Math.PI; gap.position.set(0, Hb * 0.42, -D / 2 - m(0.00005)); g.add(gap);
  // the buds, stems down in the wells
  const buds = ['left', 'right'].map((side, i) => {
    const b = budParts(s, side, color, tipColor), sx = i ? 1 : -1;
    b.position.set(sx * m(0.0162), Hb + m(0.005), m(0.0004));
    b.userData.home = { position: b.position.clone(), quaternion: b.quaternion.clone() };
    g.add(b); anchor(b, i ? 'budR' : 'budL', new THREE.Vector3(), g.anchors); return b;
  });
  // status LED on the front, under the seam: a hot point, a soft glow in the plastic round it, and a halo
  const ledM = ledMat(led, ledIntensity);
  const ledMesh = mesh(new THREE.CircleGeometry(m(0.00085), 20), ledM, { cast: false });
  ledMesh.position.set(0, Hb - m(0.0105), D / 2 + m(0.00003)); g.add(ledMesh);
  const [lc, lx] = canvas(64, 64), lg = lx.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (const [f, a] of [[0, 1], [0.12, 0.55], [0.3, 0.16], [0.55, 0.04], [1, 0]]) lg.addColorStop(f, `rgba(255,255,255,${a})`); // about exp(-r^2): light scattering in the plastic
  lx.fillStyle = lg; lx.fillRect(0, 0, 64, 64);
  const soft = mesh(new THREE.PlaneGeometry(m(0.006), m(0.006)), decal(new THREE.MeshBasicMaterial({ color: hot(led, ledIntensity * 0.2), alphaMap: canvasTex(lc, false), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })), { cast: false });
  soft.position.copy(ledMesh.position).add(new THREE.Vector3(0, 0, m(0.00001))); g.add(soft);
  const halo = glowSprite({ color: led, intensity: 0.35, size: m(0.008) }); halo.position.copy(ledMesh.position).add(new THREE.Vector3(0, 0, m(0.0005))); g.add(halo);
  anchor(g, 'led', ledMesh.position.clone(), g.anchors);
  anchor(lidM, 'lid', new THREE.Vector3(0, Hl * 0.6, D / 2), g.anchors);
  anchor(g, 'buds', new THREE.Vector3(0, Hb + m(0.006), 0), g.anchors);
  g.setOpen = (p) => { lid.rotation.x = -deg(angle) * ease.inOutSine(clamp(p)); };
  g.setLed = (col = led, k = ledIntensity) => { ledM.color.copy(hot(col, k)); soft.material.color.copy(hot(col, k * 0.2)); halo.material.uniforms.uColor.value.set(col); halo.setIntensity(0.09 * k); ledMesh.visible = soft.visible = halo.visible = k > 0; };
  const R = new THREE.Vector3();
  g.lift = (p, t = 0, { height = 1.02 * W, spread = 0.33 * W, forward = 0.1 * W, bob = 1 } = {}) => {
    const e = ease.outCubic(clamp(p));
    buds.forEach((b, i) => {
      const h = b.userData.home, sx = i ? 1 : -1, fl = bob * e * 0.04 * W * Math.sin(t * 1.3 + i * 1.7);
      b.position.set(h.position.x + sx * spread * e, h.position.y + height * e + fl, h.position.z + forward * e);
      b.quaternion.copy(h.quaternion);
      b.rotateZ(sx * 0.45 * e); b.rotateX(-0.5 * e); b.rotateY(sx * 0.3 * e + 0.05 * bob * e * Math.sin(t * 0.9 + i));
    });
    g.updateMatrixWorld(true);
    return buds[1].getWorldPosition(R.clone());
  };
  g.lid = lid; g.buds = buds;
  g.userData = { perMetre: s, size: [W, Hb + Hl, D], footprint: [W, D] };
  g.setOpen(0); measureBounds(g); g.setOpen(open); g.setLed(led, ledIntensity);
  return withAnchors(g);
}
