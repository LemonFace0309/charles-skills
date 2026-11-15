// Space props: a GPS-style satellite, the Moon, a star, a spiral galaxy (with an optional quasar), orbits, a satellite
// constellation, a swarm of thousands of satellites, range spheres and the circle where two of them cross, and an
// asteroid belt. All procedural and seeded: no downloads, the same frame every time.
// Anything that moves has .at(t) or a setter that is a pure function of its input, so the camera body can sample it
// at any sub-frame time. Sizes are in world units; userData.radius is the bounding radius to pass to cam.fit/frame,
// and props with parts have g.anchors (named Object3D markers) and g.anchor(name), which throws on a bad name.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat, noiseTexture, accentDefault } from '../look.js';
import { rng, clamp, smooth, lerp } from '../util.js';
import { glowSprite } from '../fx.js';
import { tube, line } from '../glow.js';
import { fit } from '../cam.js';
import { withAnchors } from './base.js';

const C = (c) => (c && c.isColor ? c.clone() : new THREE.Color(c));
const V3 = (a) => (a && a.isVector3 ? a.clone() : new THREE.Vector3(...a));
const TAU = Math.PI * 2;

// Generated textures are cached per module: building ten satellites makes the foil once. They are flagged shared, so
// evicting a shot never disposes them: another shot would upload (and prefilter) them again mid-render.
const _cache = new Map();
const share = (v) => { for (const x of v?.isTexture ? [v] : Object.values(v || {})) if (x?.isTexture) x.userData.shared = true; return v; };
const cached = (key, make) => { if (!_cache.has(key)) _cache.set(key, share(make())); return _cache.get(key); };
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const canvasTex = (c, { srgb = true, repeat = [1, 1] } = {}) => {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 8; return t;
};

// ---------- deterministic 3D value noise (JS side, for geometry) ----------
const hash3 = (x, y, z, s) => { const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + s * 19.19) * 43758.5453; return n - Math.floor(n); };
export function noise3(x, y, z, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const h = (a, b, c) => hash3(xi + a, yi + b, zi + c, seed);
  const x00 = lerp(h(0, 0, 0), h(1, 0, 0), u), x10 = lerp(h(0, 1, 0), h(1, 1, 0), u), x01 = lerp(h(0, 0, 1), h(1, 0, 1), u), x11 = lerp(h(0, 1, 1), h(1, 1, 1), u);
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w) * 2 - 1;
}
export const fbm3 = (x, y, z, { octaves = 4, seed = 0, lac = 2.03, gain = 0.5 } = {}) => {
  let a = 0.5, f = 1, s = 0, n = 0;
  for (let i = 0; i < octaves; i++) { s += noise3(x * f, y * f, z * f, seed + i * 7.3) * a; n += a; a *= gain; f *= lac; }
  return s / n;
};

// GLSL noise shared by the shader props (h13/h33 hashes, noised() value noise with derivatives, vnoise, fbm(p, oct)).
// Paste ${glslNoise} into a shader to use it.
export const glslNoise = /* glsl */ `
float h13(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
vec3 h33(vec3 p){ p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
// value noise with analytic derivatives: (value in -1..1, gradient)
vec4 noised(vec3 x){
  vec3 i = floor(x), f = fract(x);
  vec3 u = f * f * f * (f * (f * 6. - 15.) + 10.), du = 30. * f * f * (f * (f - 2.) + 1.);
  float a = h13(i), b = h13(i + vec3(1., 0., 0.)), c = h13(i + vec3(0., 1., 0.)), d = h13(i + vec3(1., 1., 0.));
  float e = h13(i + vec3(0., 0., 1.)), f1 = h13(i + vec3(1., 0., 1.)), g = h13(i + vec3(0., 1., 1.)), h = h13(i + vec3(1., 1., 1.));
  float k0 = a, k1 = b - a, k2 = c - a, k3 = e - a, k4 = a - b - c + d, k5 = a - c - e + g, k6 = a - b - e + f1, k7 = -a + b + c - d + e - f1 - g + h;
  float v = k0 + k1 * u.x + k2 * u.y + k3 * u.z + k4 * u.x * u.y + k5 * u.y * u.z + k6 * u.z * u.x + k7 * u.x * u.y * u.z;
  vec3 gr = du * vec3(k1 + k4 * u.y + k6 * u.z + k7 * u.y * u.z, k2 + k5 * u.z + k4 * u.x + k7 * u.z * u.x, k3 + k6 * u.x + k5 * u.y + k7 * u.x * u.y);
  return vec4(v * 2. - 1., gr * 2.);
}
float vnoise(vec3 x){ return noised(x).x; }
float fbm(vec3 p, int oct){ float a = .5, s = 0., n = 0.; for (int i = 0; i < 8; i++){ if (i >= oct) break; s += a * vnoise(p); n += a; p = p * 2.03 + vec3(1.7, -3.1, 2.3); a *= .5; } return s / n; }
`;

// =====================================================================================================================
// SATELLITE
// =====================================================================================================================

// Crumpled multi-layer insulation: a normal map made of crease lines (ridges and valleys of many lengths at random
// angles) over a fine crinkle, so the foil breaks into facets with crisp folds the way real foil does. Tileable.
// Each fold is splatted over only the pixels its window reaches, in fold order (every pixel sums the same terms in the
// same order as a loop over all folds per pixel, so the bytes match), and along a row the window steps as a running
// product (its exponent is quadratic in x): about 0.1 s a map instead of 2.7 s.
function foilNormalMap(seed = 1, size = 768) {
  return cached('foil' + seed, () => {
    const R = rng(seed * 977 + 13);
    const folds = [];
    for (let i = 0; i < 300; i++) {
      const a = R() * Math.PI, L = 0.025 + Math.pow(R(), 2) * 0.14;
      folds.push([R(), R(), Math.cos(a), Math.sin(a), L, (R() < 0.5 ? -1 : 1) * (0.05 + R() * 0.09), 0.0015 + R() * 0.0025]);
    }
    const grid = 56, P = new Float64Array(grid * grid * 4);
    for (let j = 0; j < grid; j++) for (let i = 0; i < grid; i++) { const a = R() * TAU, m = Math.pow(R(), 0.5) * 0.09; P.set([(i + 0.1 + R() * 0.8) / grid, (j + 0.1 + R() * 0.8) / grid, Math.cos(a) * m, Math.sin(a) * m], (j * grid + i) * 4); }
    const GX = new Float64Array(size * size), GY = new Float64Array(size * size), du = 1 / size;
    for (const [cx, cy, dx, dy, L, amp, w] of folds) {
      const ea = L * 1.7, ec = L * 1.4, w2 = w * w, ka = 1.4 / (L * L), kc = 1.2 / (L * L), ax = amp * -dy, ay = amp * dx;
      const hx = ea * Math.abs(dx) + ec * dy, hy = ea * dy + ec * Math.abs(dx), narrow = hx < 0.49 && hy < 0.49;
      const x0 = Math.floor((cx - hx) * size) - 1, x1 = Math.ceil((cx + hx) * size) + 1, y0 = Math.floor((cy - hy) * size) - 1, y1 = Math.ceil((cy + hy) * size) + 1;
      const q = Math.exp(-2 * (ka * dx * dx + kc * dy * dy) * du * du);
      for (let yy = y0; yy <= y1; yy++) {
        const y = yy < 0 ? yy + size : yy >= size ? yy - size : yy;
        let oy = y / size - cy; if (oy >= 0.5) oy -= 1; else if (oy < -0.5) oy += 1;
        let xa = x0, xb = x1;
        if (narrow) { // this row's span inside the fold's rectangle, a pixel of slack each side (the tests decide)
          let lo = -1, hi = 1;
          if (Math.abs(dx) > 1e-6) { const p = (-ea - oy * dy) / dx, r = (ea - oy * dy) / dx; lo = Math.max(lo, Math.min(p, r)); hi = Math.min(hi, Math.max(p, r)); } else if (Math.abs(oy * dy) > ea) continue;
          if (dy > 1e-6) { lo = Math.max(lo, (oy * dx - ec) / dy); hi = Math.min(hi, (oy * dx + ec) / dy); } else if (Math.abs(oy * dx) > ec) continue;
          if (lo > hi) continue;
          xa = Math.max(x0, Math.floor((cx + lo) * size) - 1); xb = Math.min(x1, Math.ceil((cx + hi) * size) + 1);
        }
        const row = y * size;
        let win = -1, r = 0;
        for (let xx = xa; xx <= xb; xx++) {
          const x = xx < 0 ? xx + size : xx >= size ? xx - size : xx;
          let ox = x / size - cx; if (ox >= 0.5) ox -= 1; else if (ox < -0.5) ox += 1;
          const along = ox * dx + oy * dy; if (along > ea || along < -ea) { win = -1; continue; }
          const across = -ox * dy + oy * dx; if (across > ec || across < -ec) { win = -1; continue; }
          if (win < 0) { win = Math.exp(-ka * along * along - kc * across * across); const a1 = along + du * dx, c1 = across - du * dy; r = Math.exp(-ka * a1 * a1 - kc * c1 * c1) / win; }
          else { win *= r; r *= q; }
          const sg = across / Math.sqrt(across * across + w2), k = row + x;
          GX[k] += ax * win * sg; GY[k] += ay * win * sg;
        }
      }
    }
    // the fine crinkle: each pixel takes the tilt of its nearest jittered grid point
    const [c, g] = canvas(size, size); const img = g.createImageData(size, size), d = img.data;
    for (let y = 0; y < size; y++) {
      const v = y / size, cj = Math.floor(v * grid);
      for (let x = 0; x < size; x++) {
        const u = x / size, k = y * size + x, ci = Math.floor(u * grid);
        let best = 9, bx = 0, by = 0;
        for (let dj = -1; dj <= 1; dj++) {
          const jj = (cj + dj + grid) % grid;
          for (let di = -1; di <= 1; di++) {
            const o = (jj * grid + ((ci + di + grid) % grid)) * 4;
            let ex = P[o] - u, ey = P[o + 1] - v;
            if (ex >= 0.5) ex -= 1; else if (ex < -0.5) ex += 1;
            if (ey >= 0.5) ey -= 1; else if (ey < -0.5) ey += 1;
            const dd = ex * ex + ey * ey; if (dd < best) { best = dd; bx = P[o + 2]; by = P[o + 3]; }
          }
        }
        const nx = -GX[k] * 2.2 + bx, ny = -GY[k] * 2.2 + by, l = Math.sqrt(nx * nx + ny * ny + 1), i = k * 4;
        d[i] = (nx / l * 0.5 + 0.5) * 255; d[i + 1] = (ny / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return canvasTex(c, { srgb: false, repeat: [2.2, 2.2] });
  });
}

// What a satellite sees: black sky, the sun, and the bright day side of the Earth filling the sky below (with its
// blue atmosphere at the edge). Space has nothing else to reflect, so without this, metal and glass render black.
// Equirectangular, LDR; three.js prefilters it for roughness. earth: angular radius of the Earth disc in degrees.
export function orbitEnvironment({ sun = [1, 0.35, 0.55], earth = 62, seed = 3 } = {}) {
  const key = `orbitEnv${sun.join()}${earth}${seed}`;
  return cached(key, () => {
    const W = 512, H = 256, [c, g] = canvas(W, H), img = g.createImageData(W, H), d = img.data;
    const S = new THREE.Vector3(...sun).normalize(), a0 = Math.cos(THREE.MathUtils.degToRad(earth));
    const toS = (x) => 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W, v = 1 - (y + 0.5) / H;
      const lat = (v - 0.5) * Math.PI, lon = (u - 0.5) * TAU;
      const dx = Math.cos(lat) * Math.cos(lon), dy = Math.sin(lat), dz = Math.cos(lat) * Math.sin(lon);
      let r = 0.004, gg = 0.005, b = 0.008;
      const cosE = -dy; // angle from straight down
      if (cosE > a0) {
        const k = (cosE - a0) / (1 - a0); // 0 at the limb, 1 straight down
        const day = 0.35 + 0.65 * clamp(0.5 + 0.8 * (dx * S.x + dz * S.z));
        const cl = clamp(fbm3(dx * 3, dy * 3, dz * 3, { octaves: 5, seed }) * 1.8 + 0.4);
        r = (0.06 + 0.8 * cl) * day; gg = (0.17 + 0.74 * cl) * day; b = (0.4 + 0.56 * cl) * day;
        const haze = Math.exp(-k * 9); r = lerp(r, 0.35 * day, haze); gg = lerp(gg, 0.6 * day, haze); b = lerp(b, 1.0 * day, haze);
      } else {
        const above = (a0 - cosE); const glow = Math.exp(-above * 30) * 0.6 + Math.exp(-above * 5) * 0.12;
        r += glow * 0.3; gg += glow * 0.5; b += glow * 0.9;
      }
      const sd = dx * S.x + dy * S.y + dz * S.z;
      const sunK = Math.pow(clamp(sd), 900) * 1.0 + Math.pow(clamp(sd), 40) * 0.12;
      r += sunK; gg += sunK * 0.96; b += sunK * 0.9;
      const i = (y * W + x) * 4; d[i] = toS(clamp(r)); d[i + 1] = toS(clamp(gg)); d[i + 2] = toS(clamp(b)); d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.mapping = THREE.EquirectangularReflectionMapping;
    return t;
  });
}

// Solar cells: dark blue cells with cut corners on a pale backing, with fine fingers and two busbars.
function solarCellMap(cols = 8, rows = 11) {
  return cached(`cells${cols}x${rows}`, () => {
    const W = 1024, H = Math.round(1024 * (rows / cols) * 0.92);
    const [c, g] = canvas(W, H); const R = rng(41);
    g.fillStyle = '#4b5263'; g.fillRect(0, 0, W, H);
    const cw = W / cols, ch = H / rows, gap = 2.2, cut = cw * 0.075;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = i * cw + gap, y = j * ch + gap, w = cw - gap * 2, h = ch - gap * 2;
      const tint = R() * 0.08;
      const grd = g.createLinearGradient(x, y, x + w, y + h);
      grd.addColorStop(0, `rgb(${22 + tint * 60},${34 + tint * 70},${86 + tint * 90})`);
      grd.addColorStop(1, `rgb(${16 + tint * 40},${26 + tint * 50},${70 + tint * 70})`);
      g.fillStyle = grd; g.beginPath();
      g.moveTo(x + cut, y); g.lineTo(x + w - cut, y); g.lineTo(x + w, y + cut); g.lineTo(x + w, y + h - cut); g.lineTo(x + w - cut, y + h);
      g.lineTo(x + cut, y + h); g.lineTo(x, y + h - cut); g.lineTo(x, y + cut); g.closePath(); g.fill();
      g.fillStyle = '#7f8796'; for (const [cx, cy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) { g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + (cx === x ? cut : -cut), cy); g.lineTo(cx, cy + (cy === y ? cut : -cut)); g.closePath(); g.fill(); }
      g.strokeStyle = 'rgba(90,110,160,0.28)'; g.lineWidth = 1;
      for (let k = 1; k < 18; k++) { const yy = y + (h * k) / 18; g.beginPath(); g.moveTo(x + 2, yy); g.lineTo(x + w - 2, yy); g.stroke(); }
      g.strokeStyle = 'rgba(150,165,195,0.55)'; g.lineWidth = 2.2;
      for (const f of [0.33, 0.67]) { g.beginPath(); g.moveTo(x + w * f, y + 1); g.lineTo(x + w * f, y + h - 1); g.stroke(); }
    }
    return canvasTex(c);
  });
}
// Back of a solar panel: the cells' dark backs in the same grid as the front, on a slate substrate with the structural
// ribs over them. Close to the front in brightness, so a wing turning over as it unfolds does not flash white to blue.
function panelBackMap(cols = 8, rows = 11) {
  return cached(`panelBack${cols}x${rows}`, () => {
    const W = 512, H = Math.round(512 * (rows / cols) * 0.92), [c, g] = canvas(W, H), R = rng(43);
    g.fillStyle = '#5c6371'; g.fillRect(0, 0, W, H);
    const cw = W / cols, ch = H / rows, gap = 2.5;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const t = R() * 10; g.fillStyle = `rgb(${50 + t},${57 + t},${72 + t})`; g.fillRect(i * cw + gap, j * ch + gap, cw - gap * 2, ch - gap * 2); }
    g.strokeStyle = '#8a92a0'; g.lineWidth = 4;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo((i * W) / 4, 0); g.lineTo((i * W) / 4, H); g.stroke(); }
    for (let j = 0; j <= 3; j++) { g.beginPath(); g.moveTo(0, (j * H) / 3); g.lineTo(W, (j * H) / 3); g.stroke(); }
    return canvasTex(c);
  });
}
// Radiator: a grid of small mirror tiles (optical solar reflectors), each a slightly different roughness.
function radiatorMaps() {
  return cached('osr', () => {
    const [c, g] = canvas(512, 512), [r, gr] = canvas(512, 512); const R = rng(77), n = 16, s = 512 / n;
    g.fillStyle = '#20232a'; g.fillRect(0, 0, 512, 512); gr.fillStyle = '#ffffff'; gr.fillRect(0, 0, 512, 512);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const b = 205 + R() * 40; g.fillStyle = `rgb(${b},${b + 2},${b + 6})`; g.fillRect(i * s + 1.5, j * s + 1.5, s - 3, s - 3);
      const ro = 20 + R() * 50; gr.fillStyle = `rgb(${ro},${ro},${ro})`; gr.fillRect(i * s + 1.5, j * s + 1.5, s - 3, s - 3);
    }
    return { map: canvasTex(c), rough: canvasTex(r, { srgb: false }) };
  });
}
class Helix extends THREE.Curve {
  constructor(r, h, turns) { super(); this.r = r; this.h = h; this.turns = turns; }
  getPoint(t, out = new THREE.Vector3()) { const a = t * this.turns * TAU; return out.set(Math.cos(a) * this.r, -t * this.h, Math.sin(a) * this.r); }
}

// A GPS-style navigation satellite: foil-wrapped bus, mirror radiators, an L-band helix array on the Earth face, two
// solar wings. size = bus height in world units (deployed span is ~5.7 x size with 2 panels per wing).
// sat.setPanels(0..1) folds/unfolds the wings (0 = stowed, 1 = deployed); sat.setWing(rad) turns them to the sun.
// sat.antenna is an Object3D at the centre of the Earth-facing array (beam origin); the Earth face looks down -Y.
// env: 'orbit' (default) gives its metal, foil and glass the orbit environment (Earth below, sun at `sun`) so they
// read in empty space; env: null leaves them to the scene's environment (k.env).
export function satellite({ size = 1, panels = 1, wing = 0, foil = 'gold', wingPanels = 2, seed = 1, env = 'orbit', sun = [1, 0.35, 0.55], envIntensity = 1 } = {}) {
  const g = new THREE.Group(); g.name = 'satellite';
  const s = 1 / 1.2; // build with a 1.2-unit bus, scale so `size` is the bus height
  const root = new THREE.Group(); root.scale.setScalar(size * s); g.add(root);
  const shadow = (m) => { m.castShadow = m.receiveShadow = true; return m; };
  const foilCol = { gold: '#d9a347', silver: '#c7ccd4', black: '#26282d' }[foil] || foil;
  const M = {
    foil: mat.metal(foilCol, { rough: 0.3, env: 1.7, extra: { normalMap: foilNormalMap(seed), normalScale: new THREE.Vector2(0.65, 0.65) } }),
    foil2: mat.metal(foil === 'gold' ? '#b9802c' : '#aeb3bb', { rough: 0.34, env: 1.5, extra: { normalMap: foilNormalMap(seed + 1), normalScale: new THREE.Vector2(0.5, 0.5) } }),
    white: mat.plastic('#e7e5e0', { rough: 0.45, clearcoat: 0.2 }),
    dark: mat.plastic('#17191e', { rough: 0.5, clearcoat: 0.3 }),
    metal: mat.metal('#a9adb5', { rough: 0.3 }),
    black: mat.metal('#2a2c31', { rough: 0.35 }),
  };
  const osr = radiatorMaps();
  M.osr = mat.metal('#d8dbe0', { rough: 1, env: 1.3, extra: { map: osr.map, roughnessMap: osr.rough } });
  const add = (parent, geo, m, x = 0, y = 0, z = 0) => { const o = shadow(new THREE.Mesh(geo, m)); o.position.set(x, y, z); parent.add(o); return o; };

  // bus
  const BX = 1.0, BY = 1.2, BZ = 1.0;
  add(root, new RoundedBoxGeometry(BX, BY, BZ, 3, 0.025), M.foil);
  // radiators on the +-Z faces, a darker foil band around the top
  for (const sz of [1, -1]) add(root, new RoundedBoxGeometry(0.8, 0.86, 0.016, 2, 0.006), M.osr, 0, -0.04, sz * (BZ / 2 + 0.006));
  add(root, new RoundedBoxGeometry(BX + 0.012, 0.16, BZ + 0.012, 2, 0.02), M.foil2, 0, BY / 2 - 0.12, 0);
  // Earth face: antenna deck, helix array, two dishes
  const nadirY = -BY / 2;
  add(root, new THREE.CylinderGeometry(0.44, 0.46, 0.04, 64), M.white, 0, nadirY - 0.02, 0);
  add(root, new THREE.CylinderGeometry(0.47, 0.47, 0.012, 64), M.metal, 0, nadirY - 0.045, 0);
  const helixGeo = new THREE.TubeGeometry(new Helix(0.036, 0.16, 4.5), 200, 0.0065, 6, false);
  const cupGeo = new THREE.CylinderGeometry(0.055, 0.05, 0.02, 24);
  const ring = [[0, 0]]; for (let i = 0; i < 4; i++) ring.push([Math.cos((i / 4) * TAU + 0.4) * 0.14, Math.sin((i / 4) * TAU + 0.4) * 0.14]);
  for (let i = 0; i < 8; i++) ring.push([Math.cos((i / 8) * TAU) * 0.31, Math.sin((i / 8) * TAU) * 0.31]);
  for (const [x, z] of ring) { add(root, cupGeo, M.dark, x, nadirY - 0.06, z); add(root, helixGeo, M.white, x, nadirY - 0.07, z); }
  const dish = (x, z, r) => {
    const pts = []; for (let i = 0; i <= 16; i++) { const u = i / 16; pts.push(new THREE.Vector2(u * r, (u * u) * r * 0.32)); }
    const d = add(root, new THREE.LatheGeometry(pts, 40), new THREE.MeshPhysicalMaterial({ color: C('#efede8'), roughness: 0.5, side: THREE.DoubleSide, clearcoat: 0.3 }), x, nadirY - 0.16, z);
    d.rotation.x = Math.PI; add(root, new THREE.CylinderGeometry(0.008, 0.008, 0.12, 8), M.metal, x, nadirY - 0.11, z);
    add(root, new THREE.CylinderGeometry(0.018, 0.012, 0.03, 12), M.dark, x, nadirY - 0.16, z);
  };
  dish(0.38, 0.38, 0.12); dish(-0.4, -0.36, 0.09);
  const antenna = new THREE.Object3D(); antenna.position.set(0, nadirY - 0.3, 0); root.add(antenna);
  // top: thrusters, star trackers, a mast
  for (const [x, z] of [[0.36, 0.36], [-0.36, 0.36], [0.36, -0.36], [-0.36, -0.36]]) {
    const n = add(root, new THREE.CylinderGeometry(0.018, 0.045, 0.07, 20, 1, true), M.metal, x, BY / 2 + 0.035, z); n.material = n.material.clone(); n.material.side = THREE.DoubleSide;
  }
  const tracker = new THREE.Group(); tracker.position.set(-0.22, BY / 2, -0.12); tracker.rotation.z = 0.35; root.add(tracker);
  add(tracker, new RoundedBoxGeometry(0.14, 0.12, 0.14, 2, 0.015), M.dark, 0, 0.06, 0);
  add(tracker, new THREE.CylinderGeometry(0.045, 0.05, 0.14, 24, 1, true), M.black, 0, 0.18, 0).material.side = THREE.DoubleSide;
  add(root, new THREE.CylinderGeometry(0.012, 0.012, 0.42, 8), M.metal, 0.18, BY / 2 + 0.21, 0.1);
  add(root, new THREE.SphereGeometry(0.03, 16, 10), M.white, 0.18, BY / 2 + 0.43, 0.1);

  // solar wings. Each wing: drive shaft, a V yoke, then an accordion of panels hinged about Y.
  const PW = 1.0, PH = 1.36, PT = 0.022;
  const cellMat = new THREE.MeshPhysicalMaterial({ map: solarCellMap(), roughness: 0.42, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.12, iridescence: 0.5, iridescenceIOR: 1.7, iridescenceThicknessRange: [200, 480], envMapIntensity: 1.1 });
  const backMat = mat.matte('#ffffff', { rough: 0.7, extra: { map: panelBackMap() } });
  const edgeMat = M.metal;
  const panelGeo = new THREE.BoxGeometry(PW, PH, PT);
  const wings = [];
  for (const side of [1, -1]) {
    const w = new THREE.Group(); w.position.x = side * (BX / 2); if (side < 0) w.rotation.z = Math.PI; root.add(w);
    add(w, new THREE.CylinderGeometry(0.07, 0.07, 0.06, 24), M.dark, 0.03, 0, 0).rotation.z = Math.PI / 2;
    const shaft = add(w, new THREE.CylinderGeometry(0.028, 0.028, 0.24, 16), M.metal, 0.15, 0, 0); shaft.rotation.z = Math.PI / 2;
    const yoke = new THREE.Group(); w.add(yoke);
    const rodGeo = new THREE.CylinderGeometry(0.014, 0.014, 1, 10); rodGeo.translate(0, 0.5, 0);
    const rods = [add(yoke, rodGeo, M.metal), add(yoke, rodGeo, M.metal)];
    const bar = add(yoke, new THREE.BoxGeometry(0.04, PH * 0.96, 0.03), M.metal);
    const chain = [];
    for (let i = 0; i < wingPanels; i++) {
      const pivot = new THREE.Group(); w.add(pivot);
      const p = shadow(new THREE.Mesh(panelGeo, [edgeMat, edgeMat, edgeMat, edgeMat, cellMat, backMat])); p.position.x = PW / 2; pivot.add(p);
      chain.push(pivot);
    }
    // a marker in the middle of the wing, on the cell side: it rides along as the wing unfolds
    const mid = new THREE.Object3D(); mid.name = side > 0 ? 'wingR' : 'wingL';
    mid.position.set(wingPanels % 2 ? PW / 2 : 0, 0, PT / 2); chain[Math.floor(wingPanels / 2)].add(mid);
    wings.push({ w, yoke, rods, bar, chain, mid });
  }
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  const placeRod = (rod, a, b) => { rod.position.copy(a); _b.copy(b).sub(a); rod.scale.set(1, _b.length(), 1); rod.quaternion.setFromUnitVectors(_up, _b.normalize()); };
  g.setPanels = (p) => {
    p = clamp(p);
    const pa = smooth(clamp(p / 0.4)), pb = smooth(clamp((p - 0.25) / 0.75));
    const yokeLen = lerp(0.12, 0.62, pa), fold = lerp(THREE.MathUtils.degToRad(84), 0, pb);
    for (const W of wings) {
      const root0 = new THREE.Vector3(0.27 + yokeLen, 0, (1 - pb) * PW * 0.5);
      placeRod(W.rods[0], _a.set(0.27, 0, 0), new THREE.Vector3(root0.x, PH * 0.42, root0.z));
      placeRod(W.rods[1], _a.set(0.27, 0, 0), new THREE.Vector3(root0.x, -PH * 0.42, root0.z));
      W.bar.position.copy(root0);
      const h = root0.clone();
      W.chain.forEach((pv, i) => {
        const phi = (i % 2 === 0 ? 1 : -1) * fold;
        pv.position.copy(h); pv.rotation.set(0, phi, 0);
        h.x += Math.cos(phi) * PW + (fold > 0.01 ? 0.03 : 0.004); h.z += -Math.sin(phi) * PW;
      });
    }
  };
  g.setWing = (a) => { for (const W of wings) W.w.rotation.x = a; };
  g.setPanels(panels); g.setWing(wing);
  if (env === 'orbit') {
    const e = orbitEnvironment({ sun });
    g.traverse((o) => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) if (m.isMeshStandardMaterial) { m.envMap = e; m.envMapIntensity = (m.envMapIntensity ?? 1) * envIntensity; } });
  }
  g.antenna = antenna; antenna.name = 'antenna';
  const bus = new THREE.Object3D(); bus.name = 'bus'; root.add(bus);
  const span = BX / 2 + 0.27 + 0.62 + wingPanels * PW;
  g.userData = { radius: span * size * s, size, nadir: new THREE.Vector3(0, -1, 0) };
  return withAnchors(g, { bus, antenna, wingL: wings[1].mid, wingR: wings[0].mid });
}

// =====================================================================================================================
// MOON
// =====================================================================================================================

// The Moon: highlands and maria, seven layers of craters (fresh and worn, flat floors and central peaks on the big
// ones, bright ejecta on young ones), and crater shadows that fall the right way near the terminator. All computed
// per pixel on the GPU, so it stays crisp from a full disc down to a skim over the surface; layers smaller than a
// pixel switch themselves off.
// The Moon only has relief along the terminator: lit from the front it is a flat beige disc. So by default (sun:
// 'view') it lights itself from beside the camera, `phase` degrees round from it (0 = full moon, 90 = half) and from
// `sunAngle` on screen (0 = right, 90 = top): the terminator stays in frame wherever the camera goes, but it turns
// with the camera. sun: [x, y, z] is a fixed world direction to the sun (for orbits and anything that must agree
// with other lit props); sun: 'scene' uses the scene's key light (first directional, else first point light) with
// its shadows. The light's colour and strength come from the scene's first directional light (else sunColor x
// sunIntensity, or set those to override it). Anchors: north, south; moon.pin(lat, lon, alt, name) adds more.
export function moon({ radius = 1, seed = 4, maria = 1, craters = 1, color = '#cdc8bf', mareColor = '#85817b', segments = 192, sun = 'view', phase = 70, sunAngle = 25, sunColor = null, sunIntensity = 3 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: C('#ffffff'), roughness: 0.97, metalness: 0, envMapIntensity: 0.25 });
  const mode = sun === 'scene' ? 0 : Array.isArray(sun) || sun?.isVector3 ? 2 : 1;
  const uni = {
    uSeed: { value: seed * 1.37 }, uMaria: { value: maria }, uCraters: { value: craters }, uHigh: { value: C(color) }, uMare: { value: C(mareColor) },
    uSunMode: { value: mode }, uSunW: { value: mode === 2 ? V3(sun).normalize() : new THREE.Vector3(1, 0, 0) }, uPhase: { value: THREE.MathUtils.degToRad(phase) }, uSunAng: { value: THREE.MathUtils.degToRad(sunAngle) },
    uSunCol: { value: C(sunColor || '#fff1dc').multiplyScalar(sunIntensity) }, uSunKey: { value: sunColor ? 0 : 1 },
  };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMP; varying vec3 vMX; varying vec3 vMY; varying vec3 vMZ; varying vec3 vMC;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMP = position; vMX = normalize(normalMatrix * vec3(1.,0.,0.)); vMY = normalize(normalMatrix * vec3(0.,1.,0.)); vMZ = normalize(normalMatrix * vec3(0.,0.,1.)); vMC = (modelViewMatrix * vec4(0., 0., 0., 1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uSeed, uMaria, uCraters, uSunMode, uPhase, uSunAng, uSunKey; uniform vec3 uHigh, uMare, uSunW, uSunCol;
varying vec3 vMP; varying vec3 vMX; varying vec3 vMY; varying vec3 vMZ; varying vec3 vMC;
${glslNoise}
float smin(float a, float b, float k){ float h = clamp(.5 + .5 * (b - a) / k, 0., 1.); return mix(b, a, h) - k * h * (1. - h); }
// crater profile in units of the crater radius: parabolic bowl (optionally flat-floored), raised rim, ejecta skirt,
// central peak. age 1 = fresh and crisp, lower = worn shallow and soft.
float crater(float x, float flr, float peak, float age){
  float D = x < 1. ? (1. - x * x) * .42 : 0.;
  float bowl = -smin(D, flr * .42, .04);
  float w = x < 1. ? .12 + .14 * (1. - age) : .45;
  float rim = .075 * exp(-pow((x - 1.) / w, 2.));
  float pk = peak * .16 * exp(-pow(x / .16, 2.));
  return (bowl + rim + pk) * age;
}
struct MoonS { vec3 grad; float shade; float alb; float mare; };
void craterLayer(vec3 p, vec3 L, float scale, float density, float flr, float peak, float fw, float seed, float wMare, inout MoonS S){
  float Robj = .36 / scale; // typical crater radius in object units
  float wgt = smoothstep(1., 3., Robj / max(fw, 1e-6)) * uCraters;
  if (wgt <= 0.) return;
  vec3 q = p * scale, ip = floor(q);
  vec3 n = normalize(p);
  float sinE = dot(L, n); vec3 Lt = L - n * sinE; float lt = length(Lt);
  vec3 tA = normalize(cross(n, abs(n.y) < .9 ? vec3(0., 1., 0.) : vec3(1., 0., 0.))), tB = cross(n, tA);
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) for (int k = -1; k <= 1; k++) {
    vec3 cell = ip + vec3(float(i), float(j), float(k));
    vec3 r = h33(cell + seed);
    if (r.z > density) continue;
    vec3 c = cell + .5 + (h33(cell + seed + 17.3) - .5) * .7;
    float R = mix(.12, .48, r.x * r.x);
    vec3 d = q - c; float dist = length(d); float x = dist / R;
    if (x > 2.3) continue;
    float age = mix(.2, 1., r.y * r.y);
    float e = .01;
    float h0 = crater(x, flr, peak, age);
    float dh = (crater(x + e, flr, peak, age) - crater(max(x - e, 0.), flr, peak, age)) / (2. * e);
    float ww = wgt * mix(1., wMare, S.mare);
    S.grad += dh * (d / max(dist, 1e-5)) * ww;
    // young craters: bright ejecta and rays; worn ones a touch darker inside
    float fresh = step(.9, r.y);
    float ang = atan(dot(d, tA), dot(d, tB));
    float rays = pow(max(0., sin(ang * 7. + r.x * 40.) * sin(ang * 4. + r.y * 20.)), 1.5);
    S.alb += ww * (fresh * (.22 * exp(-pow(x - 1., 2.) * 3.) + .35 * rays * exp(-(x - 1.) * 1.) * step(1., x)) - .05 * (1. - fresh) * (1. - smoothstep(.3, 1., x)));
    // shadow cast by the rim into the bowl when the sun is low
    if (x < 1. && lt > 1e-3 && sinE > 0.) {
      vec3 dl = d / R; dl -= n * dot(dl, n);
      vec3 Lh = Lt / lt; float b = dot(dl, Lh), cc = dot(dl, dl) - 1.;
      float s = -b + sqrt(max(b * b - cc, 0.));
      float need = .075 * age - h0;
      float sh = smoothstep(-.03, .03, s * (sinE / lt) - need);
      S.shade = min(S.shade, mix(1., sh, ww));
    }
  }
}
`)
      .replace('#include <map_fragment>', `#include <map_fragment>
  vec3 Lv = vec3(0., 0., 1.);
  #if NUM_DIR_LIGHTS > 0
    Lv = directionalLights[0].direction;
  #elif NUM_POINT_LIGHTS > 0
    Lv = normalize(pointLights[0].position + vViewPosition);
  #endif
  if (uSunMode > 1.5) Lv = normalize((viewMatrix * vec4(uSunW, 0.)).xyz);
  else if (uSunMode > .5) { // beside the camera: V towards the camera, R screen right, U screen up (all square to V)
    vec3 V = normalize(-vMC), Rr = normalize(vec3(1., 0., 0.) - V * V.x), Uu = cross(V, Rr);
    Lv = normalize(V * cos(uPhase) + (Rr * cos(uSunAng) + Uu * sin(uSunAng)) * sin(uPhase));
  }
  vec3 Lo = normalize(vec3(dot(Lv, vMX), dot(Lv, vMY), dot(Lv, vMZ)));
  vec3 P = normalize(vMP);
  float fwP = length(fwidth(vMP));
  MoonS S; S.grad = vec3(0.); S.shade = 1.; S.alb = 0.;
  // maria: large smooth dark plains with ragged edges, mostly on the +Z hemisphere
  vec3 wp = P * 1.1 + uSeed + .5 * vec3(fbm(P * 2.6 + 7.1, 4), fbm(P * 2.6 + 1.3, 4), fbm(P * 2.6 + 4.7, 4));
  float mn = fbm(wp, 7) + .2 * P.z - .1 + .08 * fbm(P * 9. + 3.3, 3);
  S.mare = smoothstep(-.02, .2, mn) * uMaria;
  craterLayer(P, Lo, 2.2, .35, .55, 1., fwP, uSeed + 1., .15, S);
  craterLayer(P, Lo, 5.2, .55, .7, .6, fwP, uSeed + 2., .2, S);
  craterLayer(P, Lo, 12., .65, 1., 0., fwP, uSeed + 3., .3, S);
  craterLayer(P, Lo, 28., .7, 1., 0., fwP, uSeed + 4., .45, S);
  craterLayer(P, Lo, 66., .6, 1., 0., fwP, uSeed + 5., .65, S);
  craterLayer(P, Lo, 150., .5, 1., 0., fwP, uSeed + 6., .8, S);
  craterLayer(P, Lo, 360., .45, 1., 0., fwP, uSeed + 7., .95, S);
  // regolith: fine bumps down to grains, each octave fading out before it can alias
  vec3 bump = vec3(0.); float fa = .034, ff = 20.;
  for (int o = 0; o < 9; o++) { float wo = 1. - smoothstep(.25, .8, ff * fwP); if (wo <= 0.) break; bump += noised(P * ff + uSeed * 3.).yzw * fa * wo; fa *= .9; ff *= 2.15; }
  S.grad += bump;
  float tone = .5 + .5 * fbm(P * 7. + uSeed * 5., 5), tone2 = .5 + .5 * fbm(P * 2.5 + uSeed * 2., 4);
  vec3 alb = mix(uHigh, uMare, S.mare) * (.78 + .26 * tone + .18 * tone2) * (1. + S.alb);
  diffuseColor.rgb *= alb;
`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  vec3 Gv = S.grad.x * vMX + S.grad.y * vMY + S.grad.z * vMZ;
  normal = normalize(normal - (Gv - normal * dot(Gv, normal)));
`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
  if (uSunMode > .5) { // its own sun replaces the scene's direct light
    vec3 sunC = uSunCol;
    #if NUM_DIR_LIGHTS > 0
      if (uSunKey > .5) sunC = directionalLights[0].color;
    #endif
    reflectedLight.directDiffuse = sunC * max(dot(normal, Lv), 0.) * BRDF_Lambert(material.diffuseColor);
    reflectedLight.directSpecular = vec3(0.);
  }
  reflectedLight.directDiffuse *= S.shade; reflectedLight.directSpecular *= S.shade;
`);
  };
  m.customProgramCacheKey = () => 'moon-v3';
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, segments, segments / 2), m);
  mesh.castShadow = mesh.receiveShadow = true;
  const g = new THREE.Group(); g.name = 'moon'; g.add(mesh); g.scale.setScalar(radius);
  g.surface = mesh;
  g.userData = { radius };
  // a point on the surface at lat/lon (degrees), local to the moon group (unit sphere; the group carries the radius)
  g.latLon = (lat, lon, alt = 0) => { const phi = THREE.MathUtils.degToRad(90 - lat), th = THREE.MathUtils.degToRad(lon + 180); const R = 1 + alt; return new THREE.Vector3(-R * Math.sin(phi) * Math.cos(th), R * Math.cos(phi), R * Math.sin(phi) * Math.sin(th)); };
  // pin(lat, lon, alt, name) -> an Object3D on the surface that turns with the moon; named pins join the anchors
  g.pin = (lat, lon, alt = 0.002, name = null) => { const a = new THREE.Object3D(); a.position.copy(g.latLon(lat, lon, alt)); g.add(a); if (name) { a.name = name; g.anchors[name] = a; } return a; };
  withAnchors(g, {});
  g.pin(90, 0, 0.002, 'north'); g.pin(-90, 0, 0.002, 'south');
  return g;
}

// =====================================================================================================================
// SUN
// =====================================================================================================================

// A star: a boiling, limb-darkened photosphere, a hot limb glow, slow corona streamers and a wide soft halo, all HDR
// so the film stage blooms it. sun.at(t) animates the surface and corona; sun.setIntensity(i) dims it.
// light > 0 adds a PointLight (no falloff) at its centre to light planets around it (sun.light).
export function sun({ radius = 1, intensity = 1, color = '#ff6410', core = '#ffc24a', corona = 1, light = 0, seed = 2 } = {}) {
  const g = new THREE.Group();
  const u = { uTime: { value: 0 }, uI: { value: intensity }, uCol: { value: C(color) }, uCore: { value: C(core) }, uSeed: { value: seed * 3.1 }, uK: { value: corona } };
  const surf = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: `varying vec3 vN; varying vec3 vP; varying vec3 vV; void main(){ vP = position; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uTime, uI, uSeed; uniform vec3 uCol, uCore; varying vec3 vN; varying vec3 vP; varying vec3 vV;
${glslNoise}
      vec3 vor(vec3 p){ vec3 ip = floor(p); float f1 = 9., f2 = 9., id = 0.;
        for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) for (int k = -1; k <= 1; k++) { vec3 c = ip + vec3(float(i), float(j), float(k)); vec3 o = h33(c); o = .5 + .42 * sin(uTime * .3 + 6.2831 * o); float d = length(c + o - p); if (d < f1) { f2 = f1; f1 = d; id = h13(c + 7.7); } else if (d < f2) f2 = d; }
        return vec3(f1, f2, id); }
      void main(){
        float mu = clamp(dot(normalize(vN), normalize(vV)), 0., 1.);
        vec3 p = normalize(vP);
        float fw = length(fwidth(p));
        vec3 wq = p * 34. + uSeed + .35 * vec3(vnoise(p * 60.), vnoise(p * 60. + 3.), vnoise(p * 60. + 7.));
        vec3 w = vor(wq);
        float lanes = smoothstep(0., .3, w.y - w.x);
        float cellB = .85 + .3 * w.z;
        float centre = 1. - .35 * smoothstep(.1, .7, w.x);
        float gd = 1. - smoothstep(.2, .5, fw * 34.);
        float gran = mix(.82, (.55 + .45 * lanes) * cellB * centre, gd);
        float big = fbm(p * 3.2 + vec3(uSeed, uTime * .012, 0.), 4);
        float fac = smoothstep(.15, .6, fbm(p * 14. + uSeed + 4., 3)) * pow(1. - mu, 3.) * .5;
        float limb = .3 + .7 * pow(mu, .5);
        vec3 c = mix(uCol, uCore, pow(mu, 1.2) * .85) * limb * gran * (.9 + .25 * big) * (1. + fac);
        gl_FragColor = vec4(c * 1.6 * uI, 1.);
      }`,
  });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(radius, 128, 64), surf);
  g.add(ball);
  // corona: one camera-facing plane, computed in units of the radius so the glow meets the limb with no seam
  const coronaMat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(0., 0., 0., 1.); mv.xy += position.xy * vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz)); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uTime, uI, uK, uSeed; uniform vec3 uCol, uCore; varying vec2 vUv;
${glslNoise}
      void main(){ vec2 d = (vUv - .5) * 2.; float r = length(d) * 8.; float a = atan(d.y, d.x);
        if (r < .985) discard;
        float x = r - 1.;
        float st = .5 + .5 * fbm(vec3(cos(a) * 2.6, sin(a) * 2.6, uTime * .05 + uSeed), 4);
        st = pow(st, 3.) * 2.2;
        float inner = exp(-x / .04) * .45;
        float streamers = st * exp(-x / .35) * .2;
        float halo = exp(-x / .7) * .03 + exp(-x / .18) * .1;
        vec3 c = mix(uCol, uCore, exp(-x * 7.)) * (inner + streamers + halo) * (1. - smoothstep(5., 8., r));
        gl_FragColor = vec4(c * uI * uK, 1.); }`,
  });
  const cor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), coronaMat); cor.scale.setScalar(radius * 16); cor.renderOrder = 2; g.add(cor);
  if (light > 0) { const L = new THREE.PointLight(C(core), light, 0, 0); g.add(L); g.light = L; }
  g.at = (t) => { u.uTime.value = t; };
  g.setIntensity = (i) => { u.uI.value = i; };
  g.surface = ball; g.name = 'sun';
  g.userData = { radius };
  return withAnchors(g, {});
}

// =====================================================================================================================
// GALAXY (+ quasar jet)
// =====================================================================================================================

const STAR_V = /* glsl */ `
attribute float aSize; attribute vec3 aColor; attribute float aR;
uniform float uTime, uSpin, uRes, uFocus, uAperture, uI, uMinPx;
varying vec3 vC; varying float vK;
void main(){
  float ang = uTime * uSpin / (.25 + aR);
  float c = cos(ang), s = sin(ang);
  vec3 p = vec3(c * position.x + s * position.z, position.y, -s * position.x + c * position.z);
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  float d = max(1e-3, -mv.z);
  float sz = aSize * length(modelMatrix[0].xyz);
  float coc = uAperture * abs(d - uFocus) / max(uFocus, 1e-3);
  float r = max(sz, coc * 2.);
  float px = r * projectionMatrix[1][1] * 960. * uRes / d;
  float shown = max(px, uMinPx);
  gl_PointSize = min(shown, 256.);
  // energy: a star drawn bigger than it is (bokeh or the 1.5 px floor) spreads the same light thinner
  vK = (sz * sz) / (r * r) * min(1., (px * px) / (shown * shown));
  vC = aColor * uI;
}`;
const STAR_F = /* glsl */ `varying vec3 vC; varying float vK; uniform float uDust;
void main(){ vec2 d = gl_PointCoord - .5; float r2 = dot(d, d) * 4.; float a = exp(-r2 * 3.5) * (1. - smoothstep(.85, 1., r2)); if (a < .003) discard;
  if (uDust > .5) gl_FragColor = vec4(0., 0., 0., clamp(a * vC.r * min(1., vK * 1.5), 0., 1.)); else gl_FragColor = vec4(vC * vK * a, 1.); }`;

function starMaterial({ dust = false, spin, intensity, minPx = 1.6 }) {
  return new THREE.ShaderMaterial({
    vertexShader: STAR_V, fragmentShader: STAR_F, transparent: true, depthWrite: false,
    blending: dust ? THREE.CustomBlending : THREE.AdditiveBlending,
    ...(dust ? { blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.OneMinusSrcAlphaFactor } : {}),
    uniforms: { uTime: { value: 0 }, uSpin: { value: spin }, uRes: { value: 1 }, uFocus: { value: 10 }, uAperture: { value: 0 }, uI: { value: intensity }, uMinPx: { value: minPx }, uDust: { value: dust ? 1 : 0 } },
  });
}

// The quasar's lens flare, in screen space: a blinding point, a halo `halo` x the frame width across, a wide soft skirt
// and a thin horizontal streak, centred on the projected core. Bloom and glare are lens effects: their size on screen
// does not change with distance, so the core reads as the brightest thing at any framing. Depth-tested (a planet in
// front hides it) and lens-aware (out of focus, the lens samples smear it like any point).
function lensFlare({ core = 40, halo = 0.025, haloI = 3, streak = 0.22, streakI = 1.2, color = '#d6e4ff' } = {}) {
  const u = { uK: { value: 1 }, uCore: { value: core }, uHalo: { value: halo }, uHaloI: { value: haloI }, uStreak: { value: streak }, uStreakI: { value: streakI }, uCol: { value: C(color) } };
  const m = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false,
    // the quad spans +-streak/2 of the frame width across and +-3 halos up and down, in clip space around the core
    vertexShader: `uniform float uHalo, uStreak; varying vec2 vD;
      void main(){ vec4 c = projectionMatrix * modelViewMatrix * vec4(0., 0., 0., 1.); float aspect = projectionMatrix[1][1] / projectionMatrix[0][0];
        vec2 hs = vec2(max(uStreak * .5, uHalo * 3.), uHalo * 3.); vD = position.xy * hs;
        gl_Position = c + vec4(position.xy * hs * vec2(2., 2. * aspect) * c.w, 0., 0.); }`,
    // vD is in frame widths both ways. The streak is about 3 px thick at 1080 x 1920 (a Gaussian 1.8 px wide plus a
    // soft skirt): at 0.0011 it was a 1 px line no one saw at phone size. Everything fades to 0 at the quad's edge:
    // the halo's long tail was still 0.04 there, a lighter rectangle round the core on a dark sky.
    fragmentShader: `uniform float uK, uCore, uHalo, uHaloI, uStreak, uStreakI; uniform vec3 uCol; varying vec2 vD;
      void main(){ float r = length(vD);
        float core = exp(-r * r / (2. * .0035 * .0035)) * uCore;
        float halo = exp(-r * r / (2. * pow(uHalo * .5, 2.))) * uHaloI + exp(-r / (uHalo * 1.4)) * uHaloI * .12;
        float ay = abs(vD.y);
        float streak = (exp(-pow(ay / .0017, 2.)) + .22 * exp(-ay / .0045)) * exp(-abs(vD.x) / (uStreak * .22)) * uStreakI;
        vec2 qHalf = vec2(max(uStreak * .5, uHalo * 3.), uHalo * 3.), qEdge = abs(vD) / qHalf; // (names a project's own shader patch will not clash with)
        halo *= 1. - smoothstep(.45, 1., r / (uHalo * 3.));                        // round, gone before the quad's edge
        streak *= (1. - smoothstep(.6, 1., qEdge.x)) * (1. - smoothstep(.45, 1., qEdge.y)); // the streak keeps its length
        vec3 c = vec3(1.) * core + uCol * (halo + streak);
        gl_FragColor = vec4(c * uK, 1.); }`,
  });
  const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m); q.frustumCulled = false; q.renderOrder = 5;
  q.set = (v) => { u.uK.value = Math.max(0, v); q.visible = v > 0.001; };
  return q;
}

// A spiral galaxy built from stars: a warm bulge, open blue arms with pink star-forming knots, an older yellow disc
// that crowds towards the arms, soft glow under it all and dust lanes on the inner edge of each arm. Lies in the XZ
// plane (tilt the group). radius in world units. galaxy.at(t) turns it (inner parts faster, arms trailing).
// jet: true adds an accretion disc, a bright core and two jets along +-Y: soft additive cones with bright knots riding
// out along them. galaxy.setJet(p, intensity = jetIntensity) grows them (p clamps at 1; the intensity has no cap).
// quasar: true is the hook's version: the jets, plus a blinding core whose point reaches 240 to 255 after the tone map,
// a halo 2 to 3% of the frame width and a thin horizontal streak (galaxy.setFlare(v) scales it: 1.5 on the word).
// dust 0.45: at 1 the lanes read as black holes when the disc fills the frame.
export function galaxy({ radius = 5, arms = 2, count = 90000, pitch = 19, thickness = 0.05, spin = 0.02, seed = 11, intensity = 1, core = 1, dust = 0.45, quasar = false, jet = quasar, jetLength = 0.7, jetIntensity = quasar ? 1.6 : 1, armColor = '#9fbcff', coreColor = '#ffcf8f', knotColor = '#ff6f9f' } = {}) {
  const g = new THREE.Group();
  const R = rng(seed), gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += R(); return (u - 2) * 0.866; };
  const P = THREE.MathUtils.degToRad(pitch), tanP = Math.tan(P), sinP = Math.sin(P), r0 = 0.12;
  const armAt = (k, r) => (k / arms) * TAU + Math.log(Math.max(r, 0.02) / r0) / tanP; // arm k's angle at radius r
  const wrap = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  const armDist = (r, th) => { let best = 9; for (let k = 0; k < arms; k++) best = Math.min(best, Math.abs(wrap(th - armAt(k, r))) * r * sinP); return best; };
  const expR = (scale, max) => -scale * Math.log(1 - R() * (1 - Math.exp(-max / scale)));
  const cArm = C(armColor), cCore = C(coreColor), cKnot = C(knotColor), cOld = C('#ffe2bd'), cWhite = C('#f4f6ff'), tmp = new THREE.Color();
  const S = { pos: [], col: [], size: [], rad: [] };
  const push = (L, x, y, z, c, b, s) => { L.pos.push(x * radius, y * radius, z * radius); L.col.push(c.r * b, c.g * b, c.b * b); L.size.push(s * radius); L.rad.push(Math.hypot(x, z)); };
  const nB = Math.round(count * 0.16), nA = Math.round(count * 0.5), nF = count - nB - nA;
  for (let i = 0; i < nB; i++) { // bulge: a flattened, centrally concentrated ball of old stars
    const r = Math.pow(R(), 1.8) * 0.2 + Math.abs(gauss()) * 0.02, th = R() * TAU, ph = Math.acos(2 * R() - 1);
    push(S, r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.55, r * Math.sin(ph) * Math.sin(th), tmp.copy(cCore).lerp(cOld, R() * 0.6), 0.45 + Math.pow(R(), 5) * 2.5, 0.0014 + R() * 0.0016);
  }
  const knots = []; for (let i = 0; i < 90; i++) { const k = i % arms, r = 0.2 + R() * 0.75; knots.push([k, r, (gauss() * 0.03) / (r * sinP)]); }
  for (let i = 0; i < nA; i++) { // arms: young stars scattered about each log spiral
    const k = i % arms;
    let r = Math.min(1, 0.1 + expR(0.34, 0.95));
    const sig = 0.035 + 0.06 * r;
    let th = armAt(k, r) + clamp((gauss() * sig) / (r * sinP), -1.2, 1.2);
    let c = tmp.copy(cArm).lerp(cWhite, R() * 0.55), b = 0.35 + Math.pow(R(), 7) * 4.5, s = 0.0012 + R() * 0.0017;
    if (R() < 0.06) { // a star-forming knot
      const kn = knots[Math.floor(R() * knots.length)]; r = kn[1] + gauss() * 0.01; th = armAt(kn[0], kn[1]) + kn[2] + (gauss() * 0.012) / kn[1]; c = tmp.copy(cKnot).lerp(cWhite, R() * 0.3); b = 0.7 + R() * 1.4; s = 0.0016 + R() * 0.0018;
    }
    push(S, Math.cos(th) * r, gauss() * thickness * 0.45 * (1 - 0.5 * r), Math.sin(th) * r, c, b, s);
  }
  for (let i = 0, tries = 0; i < nF && tries < nF * 8; tries++) { // old disc, denser near the arms
    const r = Math.min(1.05, 0.06 + expR(0.3, 1.0)), th = R() * TAU;
    if (R() > 0.3 + 0.7 * Math.exp(-((armDist(r, th) / 0.09) ** 2))) continue;
    push(S, Math.cos(th) * r, gauss() * thickness * 0.6, Math.sin(th) * r, tmp.copy(cOld).lerp(cWhite, R() * 0.35), 0.25 + Math.pow(R(), 6) * 1.6, 0.0012 + R() * 0.0013);
    i++;
  }
  const mkPoints = (L, m) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(L.pos, 3)); geo.setAttribute('aColor', new THREE.Float32BufferAttribute(L.col, 3));
    geo.setAttribute('aSize', new THREE.Float32BufferAttribute(L.size, 1)); geo.setAttribute('aR', new THREE.Float32BufferAttribute(L.rad, 1));
    const pts = new THREE.Points(geo, m); pts.frustumCulled = false; return pts;
  };
  const starMat = starMaterial({ spin, intensity });
  const stars = mkPoints(S, starMat); g.add(stars);
  // glow: big soft puffs along the arms, an exponential disc, and the bulge's haze
  const G = { pos: [], col: [], size: [], rad: [] };
  const nG = Math.round(count * 0.05);
  for (let i = 0; i < nG; i++) {
    const k = i % arms, r = Math.min(1, 0.08 + expR(0.36, 0.95)), th = armAt(k, r) + clamp((gauss() * (0.05 + 0.07 * r)) / (r * sinP), -1.3, 1.3);
    const c = R() < 0.1 ? cKnot : tmp.copy(cArm).lerp(cCore, clamp(0.45 - r)), b = 0.018 + R() * 0.022;
    push(G, Math.cos(th) * r, gauss() * thickness * 0.3, Math.sin(th) * r, c, b, 0.04 + R() * 0.05);
  }
  const glowMat = starMaterial({ spin, intensity: intensity * 0.45, minPx: 2 });
  g.add(mkPoints(G, glowMat));
  // the smooth light of the disc and bulge: one plane in the galaxy's plane, arms computed per pixel
  const du = { uTime: { value: 0 }, uSpin: { value: spin }, uI: { value: intensity }, uArms: { value: arms }, uTanP: { value: tanP }, uSinP: { value: sinP }, uR0: { value: r0 }, uCore: { value: cCore }, uArm: { value: cArm } };
  const discMatG = new THREE.ShaderMaterial({
    uniforms: du, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform float uTime, uSpin, uI, uArms, uTanP, uSinP, uR0; uniform vec3 uCore, uArm; varying vec2 vP;
      void main(){ vec2 q = vP / ${radius.toFixed(4)}; float r = length(q); if (r > 1.2) discard;
        float th = atan(-q.y, q.x) + uTime * uSpin / (.25 + r);
        float arm = 0.;
        for (int k = 0; k < 6; k++) { if (float(k) >= uArms) break; float a = float(k) / uArms * 6.28318 + log(max(r, .02) / uR0) / uTanP; float d = abs(mod(th - a + 3.14159, 6.28318) - 3.14159) * r * uSinP; arm += exp(-pow(d / (.045 + .06 * r), 2.)); }
        float disc = exp(-r / .2), bulge = exp(-pow(r / .075, 2.));
        vec3 col = uCore * (bulge * .5 + disc * .16) + uArm * arm * .05 * smoothstep(.06, .2, r) * exp(-r / .7);
        col *= 1. - smoothstep(.85, 1.15, r);
        gl_FragColor = vec4(col * uI, 1.); }`,
  });
  const discPlane = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2.4, radius * 2.4), discMatG); discPlane.rotation.x = -Math.PI / 2; g.add(discPlane);
  // dust lanes: dark, soft puffs on the inner (concave) side of each arm, drawn after the light so they eat it
  let dustMat = null;
  if (dust > 0) {
    const D = { pos: [], col: [], size: [], rad: [] };
    const nD = Math.round(count * 0.05);
    for (let i = 0; i < nD; i++) {
      const k = i % arms, r = Math.min(0.9, 0.13 + expR(0.3, 0.8));
      const th = armAt(k, r) + (0.03 + 0.012 * r + gauss() * 0.02) / (r * sinP);
      const x = Math.cos(th) * r, z = Math.sin(th) * r, clump = clamp(0.15 + 2.2 * (fbm3(x * 5 + seed, 0.5, z * 5, { octaves: 3, seed }) + 0.1));
      const a = (0.04 + R() * 0.08) * clump * dust * smooth(clamp((r - 0.1) / 0.15)) * (1 - smooth(clamp((r - 0.6) / 0.3)));
      push(D, x, gauss() * thickness * 0.2, z, new THREE.Color(1, 0, 0), a, 0.03 + R() * 0.04);
    }
    dustMat = starMaterial({ dust: true, spin, intensity: 1, minPx: 2 });
    const dp = mkPoints(D, dustMat); dp.renderOrder = 2; g.add(dp);
  }
  const coreGlow = glowSprite({ color: coreColor, intensity: 0.35 * core * intensity, size: radius * 0.6 }); g.add(coreGlow);
  const coreHot = glowSprite({ color: '#fff1dc', intensity: 1.2 * core * intensity, size: radius * 0.1 }); g.add(coreHot);
  // the jets (and the quasar)
  let jetG = null, flare = null;
  if (jet) {
    jetG = new THREE.Group(); g.add(jetG);
    const ju = { uTime: { value: 0 }, uLen: { value: 1 }, uI: { value: 1 }, uD: { value: 1 } };
    // a soft cone of light with a hot spine; knots: bright blobs riding outwards, brightest near the core
    const jetMat = (sheath) => new THREE.ShaderMaterial({
      uniforms: { ...ju, uSheath: { value: sheath } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); vY = uv.y; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform float uTime, uLen, uI, uSheath; varying vec3 vN; varying vec3 vV; varying float vY;
        void main(){ float along = vY; if (along > uLen) discard;
          float f = abs(dot(normalize(vN), normalize(vV)));
          float body = pow(f, 1.6), spine = pow(f, 14.) * (1. - uSheath);
          float kn = 0.;
          for (int i = 0; i < 7; i++) { float c = fract(float(i) / 7. + uTime * .07 + .11 * sin(float(i) * 3.7)) * uLen; kn += exp(-pow((along - c) / (.01 + .022 * c), 2.)) * (1. - .55 * c); }
          float tip = 1. - smoothstep(max(uLen - .1, 0.), uLen, along), fade = exp(-along * 4.5) * smoothstep(0., .015, along) * tip;
          vec3 col = mix(vec3(.42, .62, 1.), vec3(.92, .96, 1.), spine);
          // the knots fade outwards too (more slowly than the jet), so the jet is brightest at the core, never at its tip
          float k = uSheath > .5 ? body * .16 * fade * (1. + kn) : (body * .45 + spine * 1.3) * fade + kn * (body * 1.2 + spine * 3.) * exp(-along * 2.6) * (1. - smoothstep(uLen * .5, uLen, along));
          gl_FragColor = vec4(col * k * 1.8 * uI, 1.); }`,
    });
    const L = radius * jetLength, mats = [jetMat(0), jetMat(1)]; // both share ju's uniform objects (the spread copies references)
    for (const dir of [1, -1]) for (const [w, m] of [[1, mats[0]], [3, mats[1]]]) { // the jet (collimated: it barely widens, or it reads as a skewer), and a faint sheath
      const geo = new THREE.CylinderGeometry(radius * 0.014 * w, radius * 0.005 * w, L, 32, 80, true); geo.translate(0, L / 2, 0);
      const mesh = new THREE.Mesh(geo, m); if (dir < 0) mesh.rotation.z = Math.PI; jetG.add(mesh);
    }
    const discMat = new THREE.ShaderMaterial({
      uniforms: ju, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: `uniform float uTime, uD; varying vec2 vUv; void main(){ vec2 d = vUv - .5; float r = length(d) * 2.; float a = atan(d.y, d.x);
        float ring = smoothstep(.16, .24, r) * (1. - smoothstep(.3, 1., r));
        float sw = .7 + .3 * sin(a * 3. - uTime * 2. + r * 16.);
        vec3 c = mix(vec3(1., .5, .2), vec3(1., .93, .82), 1. - smoothstep(.25, .7, r));
        gl_FragColor = vec4(c * ring * sw * 2.6 * uD, 1.); }`,
    });
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(radius * 0.14, radius * 0.14), discMat); disc.rotation.x = -Math.PI / 2; jetG.add(disc);
    const qCore = glowSprite({ color: '#d6e4ff', intensity: 5, size: radius * 0.06 }); jetG.add(qCore);
    const qGlow = glowSprite({ color: '#8fb6ff', intensity: 0.7, size: radius * 0.4 }); jetG.add(qGlow);
    if (quasar) { flare = lensFlare(); jetG.add(flare); }
    jetG.userData = { ju, qCore, qGlow, flare };
    let fk = 1;
    g.setJet = (p, ji = jetIntensity) => {
      p = clamp(p); const on = smooth(clamp(p * 4)), c = smooth(clamp(p * 5));
      ju.uLen.value = Math.max(0.0001, p); ju.uI.value = ji * on; ju.uD.value = (quasar ? 1.6 : 1) * on;
      qCore.setIntensity(5 * c); qGlow.setIntensity((quasar ? 1.1 : 0.7) * c);
      if (flare) flare.set(fk * c);
    };
    g.setFlare = (v) => { fk = v; if (flare) flare.set(v * smooth(clamp(ju.uLen.value * 5))); };
    g.setJet(1);
  } else { g.setJet = () => {}; g.setFlare = () => {}; }
  g.at = (t) => {
    for (const m of [starMat, glowMat, dustMat, discMatG]) if (m) m.uniforms.uTime.value = t;
    if (jetG) jetG.userData.ju.uTime.value = t;
  };
  g.stars = stars; g.jet = jetG; g.flare = flare; g.name = 'galaxy';
  g.userData = { radius };
  const coreA = new THREE.Object3D(); coreA.name = 'core'; g.add(coreA);
  return withAnchors(g, { core: coreA });
}

// =====================================================================================================================
// ORBITS
// =====================================================================================================================

class Circle3 extends THREE.Curve {
  constructor(radius, q, center) { super(); this.r = radius; this.q = q; this.c = center; }
  getPoint(t, out = new THREE.Vector3()) { const a = t * TAU; return out.set(Math.cos(a) * this.r, 0, -Math.sin(a) * this.r).applyQuaternion(this.q).add(this.c); }
  getPointAt(u, out) { return this.getPoint(u, out); }
}
// The rotation that takes the XZ plane to an orbit plane: inclination (deg) about X, then the ascending node (deg)
// about Y. Use it to place anything in that orbit's frame.
export function orbitQuaternion(inclination = 0, node = 0) {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(0, THREE.MathUtils.degToRad(node), 0)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(inclination)));
}

// An orbit: a circle of `radius` around `center`, tilted by `inclination` (deg, from the XZ equator) and turned by
// `node` (deg, about Y). Returns a group holding a glowing ring that draws on (orbit.draw(p), orbit.window(a, b)),
// plus orbit.curve and orbit.pointAt(u) (u 0..1 around the orbit, counter-clockwise seen from above when
// inclination is 0). ghost > 0 adds a faint full circle under the bright one so the path reads before it draws.
export function orbit({ radius = 3, inclination = 0, node = 0, center = [0, 0, 0], segments = 256, color = accentDefault(), intensity = 3, width = 0.008, ghost = 0, ghostColor, core = true, start = 0 } = {}) {
  const q = orbitQuaternion(inclination, node), c = V3(center);
  const curve = new Circle3(radius, q, c);
  const shifted = start ? new Circle3(radius, q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), start * TAU)), c) : curve;
  const g = new THREE.Group();
  const ring = tube(shifted, { radius: width, color, intensity, segments, radial: 8, core }); g.add(ring);
  if (ghost > 0) {
    const pts = []; for (let i = 0; i <= segments; i++) pts.push(curve.getPoint(i / segments));
    const gl = line(pts, { width: width * 0.7, color: ghostColor || color, intensity: ghost, opacity: Math.min(1, ghost) }); g.add(gl); g.ghost = gl;
  }
  g.curve = curve; g.ring = ring;
  g.draw = (p) => ring.draw(p);
  g.window = (a, b) => ring.window(a, b);
  g.pointAt = (u, out = new THREE.Vector3()) => curve.getPoint(((u % 1) + 1) % 1, out);
  g.normal = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  g.setIntensity = (i) => ring.setIntensity(i);
  g.name = 'orbit'; g.userData = { radius };
  return withAnchors(g, {});
}

// A small satellite for use at a distance (a bus and two panels in one mesh, with vertex colours).
function miniSatGeometry() {
  const parts = [];
  const box = (w, h, d, x, col) => { const b = new THREE.BoxGeometry(w, h, d); b.translate(x, 0, 0); const c = C(col), n = b.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); b.setAttribute('color', new THREE.BufferAttribute(a, 3)); parts.push(b); };
  box(0.5, 0.6, 0.5, 0, '#d9a347'); box(1.1, 0.5, 0.03, 1.05, '#1b2b55'); box(1.1, 0.5, 0.03, -1.05, '#1b2b55'); box(0.6, 0.04, 0.04, 0, '#b0b4bb');
  const m = new THREE.BufferGeometry();
  const merged = parts.reduce((acc, p) => { acc.pos.push(...p.attributes.position.array); acc.nor.push(...p.attributes.normal.array); acc.col.push(...p.attributes.color.array); const off = acc.n; for (const i of p.index.array) acc.idx.push(i + off); acc.n += p.attributes.position.count; return acc; }, { pos: [], nor: [], col: [], idx: [], n: 0 });
  m.setAttribute('position', new THREE.Float32BufferAttribute(merged.pos, 3)); m.setAttribute('normal', new THREE.Float32BufferAttribute(merged.nor, 3)); m.setAttribute('color', new THREE.Float32BufferAttribute(merged.col, 3)); m.setIndex(merged.idx);
  return m;
}

// A constellation (GPS by default: 6 planes at 55 degrees, 4 satellites each, ~4.2 Earth radii when the Earth has
// radius 1). Returns rings + small satellites with a glint each. constellation.at(t) moves them (period seconds per
// orbit), constellation.positionOf(i, t, out) gives satellite i's position in the group's space.
export function constellation({ planes = 6, perPlane = 4, radius = 4.2, inclination = 55, period = 40, size = 0.07, color = accentDefault(), ringIntensity = 0.4, ringWidth = 0.0035, glint = 1.2, seed = 5 } = {}) {
  const g = new THREE.Group(); const R = rng(seed);
  const orbits = [];
  for (let p = 0; p < planes; p++) { const o = orbit({ radius, inclination, node: (p / planes) * 360, color, intensity: ringIntensity, width: ringWidth, core: false }); g.add(o); orbits.push(o); }
  const n = planes * perPlane;
  const sats = new THREE.InstancedMesh(miniSatGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.6 }), n);
  sats.castShadow = true; g.add(sats);
  const phase = []; for (let i = 0; i < n; i++) phase.push(((i % perPlane) / perPlane) + Math.floor(i / perPlane) * (0.5 / perPlane) + (R() - 0.5) * 0.04);
  const gl = new THREE.BufferGeometry(); gl.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const glintMat = new THREE.PointsMaterial({ color: C('#fff2d6').multiplyScalar(glint * 3), size: size * 6, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, map: cached('dot', () => { const [c, x] = canvas(64, 64); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }) });
  const glints = new THREE.Points(gl, glintMat); glints.frustumCulled = false; g.add(glints);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(size, size, size), p = new THREE.Vector3(), look = new THREE.Matrix4(), up = new THREE.Vector3(0, 1, 0);
  g.positionOf = (i, t, out = new THREE.Vector3()) => orbits[Math.floor(i / perPlane)].pointAt(phase[i] + t / period, out);
  g.at = (t) => {
    const arr = gl.attributes.position.array;
    for (let i = 0; i < n; i++) {
      g.positionOf(i, t, p);
      look.lookAt(p, new THREE.Vector3(0, 0, 0), up); q.setFromRotationMatrix(look);
      m4.compose(p, q, sc); sats.setMatrixAt(i, m4); arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z;
    }
    sats.instanceMatrix.needsUpdate = true; gl.attributes.position.needsUpdate = true;
  };
  g.at(0);
  g.orbits = orbits; g.satellites = sats; g.count = n;
  g.name = 'constellation'; g.userData = { radius };
  return withAnchors(g, {});
}

// swarm({ count 2600, rMin 1.08, rMax 1.7, mid .12, rMid 4.17, size .03, color '#dfe6f5', seed 8, period 30 }) -> Points:
// thousands of satellites as specks on circular orbits of random inclination round the origin (an Earth of radius 1):
// most in low orbit between rMin and rMax (crowded towards rMin), `mid` of them in a shell at rMid (where GPS flies).
// Inner ones move faster (Kepler: angular speed ~ r^-1.5; an orbit at r = 1.1 takes `period` s). The orbits run on
// the GPU from uTime, so thousands cost nothing per sub-frame. swarm.at(t) moves them; swarm.reveal(p) fades them in,
// staggered (0..1); swarm.setGain(v). size is in world units (specks keep at least 1 px and dim instead of vanishing).
export function swarm({ count = 2600, rMin = 1.08, rMax = 1.7, mid = 0.12, rMid = 4.17, size = 0.03, color = '#dfe6f5', seed = 8, period = 30 } = {}) {
  const R = rng(seed), e1 = new Float32Array(count * 3), e2 = new Float32Array(count * 3), ph = new Float32Array(count * 3);
  const q = new THREE.Quaternion(), v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const r = R() < mid ? rMid * (0.97 + R() * 0.06) : rMin + (rMax - rMin) * Math.pow(R(), 1.6);
    q.setFromEuler(new THREE.Euler(R() * Math.PI, R() * TAU, 0, 'YXZ'));
    v.set(r, 0, 0).applyQuaternion(q); e1.set([v.x, v.y, v.z], i * 3);
    v.set(0, 0, r).applyQuaternion(q); e2.set([v.x, v.y, v.z], i * 3);
    ph.set([R() * TAU, (TAU / period) * Math.pow(1.1 / r, 1.5), R()], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(e1.slice(), 3)); geo.setAttribute('aE1', new THREE.BufferAttribute(e1, 3));
  geo.setAttribute('aE2', new THREE.BufferAttribute(e2, 3)); geo.setAttribute('aPh', new THREE.BufferAttribute(ph, 3));
  const m = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: C(color) }, uSize: { value: size }, uP: { value: 1 }, uGain: { value: 1 }, uTime: { value: 0 }, uRes: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `uniform float uSize, uP, uTime, uRes; attribute vec3 aE1, aE2, aPh; varying float vA;
      void main(){ float a = aPh.x + aPh.y * uTime, rnd = aPh.z; vec3 p = aE1 * cos(a) + aE2 * sin(a);
        vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
        float px = uSize * (.6 + .8 * rnd) * projectionMatrix[1][1] * 960. * uRes / max(-mv.z, 1e-3), lo = max(1., 1.4 * uRes);
        gl_PointSize = clamp(px, lo, 6. * uRes);
        vA = smoothstep(rnd * .7, rnd * .7 + .3, uP) * (.35 + .65 * rnd) * min(1., (px * px) / (lo * lo)); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uGain; varying float vA; void main(){ vec2 d = gl_PointCoord - .5; float a = exp(-dot(d, d) * 18.) * vA; if (a < .004) discard; gl_FragColor = vec4(uColor * a * uGain, 1.); }`,
  });
  const pts = new THREE.Points(geo, m); pts.frustumCulled = false; pts.name = 'swarm';
  pts.at = (t) => { m.uniforms.uTime.value = t; };
  pts.reveal = (p) => { m.uniforms.uP.value = p; };
  pts.setGain = (gv) => { m.uniforms.uGain.value = gv; };
  pts.userData = { radius: Math.max(rMax, mid > 0 ? rMid * 1.03 : 0) };
  return pts;
}

// =====================================================================================================================
// RANGE SPHERES (GPS trilateration)
// =====================================================================================================================

// rangeSphere({ radius 1, color accent, intensity 1, opacity .18, segments 96 }) -> Mesh: every point one distance from
// a satellite, drawn as a fresnel rim only (additive): the outline of a soap bubble. No latitude grid (it reads as
// clutter), and keep opacity at 0.2 or less, so the Earth and the other spheres show through. Put it at the
// satellite's position. sphere.set({ radius, opacity }) in update (pure); userData.radius follows the radius.
export function rangeSphere({ radius = 1, color = accentDefault(), intensity = 1, opacity = 0.18, segments = 96 } = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: C(color) }, uI: { value: intensity }, uO: { value: opacity } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: `varying vec3 vN; varying vec3 vW; varying float vR; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vR = length(modelMatrix[0].xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
    // the shell fades where it comes near the lens (within 0.2 of its radius): a camera passing through it saw the
    // whole shell round it edge-on, one frame of bright rim filling the frame
    fragmentShader: `uniform vec3 uColor; uniform float uI, uO; varying vec3 vN; varying vec3 vW; varying float vR;
      void main(){ vec3 toCam = cameraPosition - vW; float f = 1. - abs(dot(normalize(vN), normalize(toCam)));
        float nearK = smoothstep(.02 * vR, .2 * vR, length(toCam));
        gl_FragColor = vec4(uColor * (pow(f, 4.) + .03) * uI * uO * nearK, 1.); }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, segments, segments / 2), m);
  mesh.scale.setScalar(radius); mesh.renderOrder = 4; mesh.name = 'rangeSphere';
  mesh.userData = { radius };
  mesh.set = ({ radius: r, opacity: op } = {}) => {
    if (r != null) { mesh.scale.setScalar(Math.max(r, 1e-4)); mesh.userData.radius = r; }
    if (op != null) { m.uniforms.uO.value = op; mesh.visible = op > 0.002; }
  };
  return mesh;
}

// crossingCircle(a, b, { color accent, intensity 5, width .008, segments 256 }) -> Group: the circle where two range
// spheres cross (a, b: rangeSpheres, or { position | center, radius }, in the circle's parent space), as a glowing ring.
// Seen at an angle it is a thin ellipse or a line: show it face-on, with the camera on its axis (cc.faceOn(dist, from)
// returns that pose: { pos, look, fov }; `from` picks the side, default the +z side). cc.update() re-reads the two
// spheres (call it in update while their radii animate; pure); cc.center, cc.radius, cc.normal, cc.exists (false, ring
// hidden, while they do not meet); cc.draw(p), cc.setIntensity(i), cc.pointAt(u).
export function crossingCircle(a, b, { color = accentDefault(), intensity = 5, width = 0.008, segments = 256 } = {}) {
  const g = new THREE.Group(); g.name = 'crossingCircle';
  const posOf = (s) => V3(s.center ?? s.position ?? [0, 0, 0]), radOf = (s) => s.userData?.radius ?? s.radius ?? 1;
  const solve = () => {
    const A = posOf(a), B = posOf(b), d = A.distanceTo(B), ra = radOf(a), rb = radOf(b);
    if (d < 1e-9) return null;
    const n = B.clone().sub(A).divideScalar(d), x = (d * d + ra * ra - rb * rb) / (2 * d), r2 = ra * ra - x * x;
    return r2 > 0 ? { center: A.addScaledVector(n, x), radius: Math.sqrt(r2), normal: n } : null;
  };
  const s0 = solve(), r0 = s0?.radius || 1;
  const curve = new THREE.EllipseCurve(0, 0, r0, r0, 0, TAU), pts = curve.getPoints(segments).map((p) => new THREE.Vector3(p.x, p.y, 0));
  const ring = tube(new THREE.CatmullRomCurve3(pts, true), { radius: width, color, intensity, segments, radial: 8 });
  const holder = new THREE.Group(); holder.add(ring); g.add(holder);
  const Z = new THREE.Vector3(0, 0, 1);
  g.update = () => {
    const S = solve(); g.exists = !!S; holder.visible = !!S;
    if (!S) return g;
    g.center = S.center; g.radius = S.radius; g.normal = S.normal;
    holder.position.copy(S.center); holder.quaternion.setFromUnitVectors(Z, S.normal); holder.scale.setScalar(S.radius / r0); holder.updateMatrix();
    return g;
  };
  g.draw = (p) => ring.draw(p);
  g.setIntensity = (i) => ring.setIntensity(i);
  g.pointAt = (u, out = new THREE.Vector3()) => out.set(Math.cos(u * TAU) * r0, Math.sin(u * TAU) * r0, 0).applyMatrix4(holder.matrix);
  g.faceOn = (dist, from = [0, 0, 10]) => {
    if (!g.exists) return null;
    const side = V3(from).sub(g.center).dot(g.normal) >= 0 ? 1 : -1, D = dist ?? fit(g.radius, { fill: 0.6 });
    return { pos: g.center.clone().addScaledVector(g.normal, side * D), look: g.center.clone(), fov: 30 };
  };
  g.ring = ring;
  g.update();
  return g;
}

// =====================================================================================================================
// ASTEROIDS
// =====================================================================================================================

// An irregular rock: a sphere pushed around by 3D noise, chipped flat by a few random planes and dented, with
// normals creased where the chips meet. Seeded. detail = subdivisions of the base icosahedron.
export function rockGeometry({ seed = 1, detail = 10, roughness = 0.2, squash = 0.35, cuts = 7, dents = 3, crease = 38 } = {}) {
  const R = rng(seed * 31 + 7);
  const geo = new THREE.IcosahedronGeometry(1, detail);
  const p = geo.attributes.position, v = new THREE.Vector3(), w = new THREE.Vector3();
  const sy = 1 - R() * squash, sz = 1 - R() * squash * 0.6;
  const dentList = []; for (let i = 0; i < dents; i++) { const d = new THREE.Vector3(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1).normalize(); dentList.push([d, 0.25 + R() * 0.3, 0.07 + R() * 0.08]); }
  const planes = []; for (let i = 0; i < cuts; i++) planes.push([new THREE.Vector3(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1).normalize(), 0.62 + R() * 0.28]);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    let h = 1 + fbm3(v.x * 1.3 + seed, v.y * 1.3, v.z * 1.3, { octaves: 4, seed }) * roughness * 1.4;
    h += (0.5 - Math.abs(fbm3(v.x * 3.5 + 9, v.y * 3.5, v.z * 3.5, { octaves: 3, seed: seed + 3 }))) * 0.07;
    h += fbm3(v.x * 9, v.y * 9, v.z * 9, { octaves: 2, seed: seed + 5 }) * 0.025;
    for (const [d, r, depth] of dentList) { const x = v.distanceTo(d) / r; if (x < 1) h -= depth * (1 - x * x) * (1 - x * x); }
    w.set(v.x * h, v.y * h * sy, v.z * h * sz);
    for (const [n, d] of planes) { const s = w.dot(n); if (s > d) w.addScaledVector(n, -(s - d) * 0.94); }
    p.setXYZ(i, w.x, w.y, w.z);
  }
  return toCreasedNormals(geo, THREE.MathUtils.degToRad(crease));
}

// An asteroid belt (shape 'belt': a ring of `radius` and `width`) or a field (shape 'field': a box of `extent`).
// Instanced rocks in `variants` shapes, power-law sizes (many pebbles, a few boulders), each tumbling.
// asteroids.at(t) tumbles them and, for a belt, carries them round (`orbitSpeed` radians per second at the ring).
export function asteroids({ count = 500, shape = 'belt', radius = 6, width = 1.6, thickness = 0.35, extent = [10, 4, 10], size = 0.09, seed = 5, variants = 5, detail = 10, color = '#4a4540', orbitSpeed = 0.01, tumble = 0.25 } = {}) {
  const g = new THREE.Group(); const R = rng(seed);
  const bump = cached('rockBump', () => noiseTexture({ kind: 'grain', scale: 8, seed: 9, repeat: 3, size: 512 }));
  const material = new THREE.MeshStandardMaterial({ color: C('#ffffff'), roughness: 0.95, metalness: 0.0, bumpMap: bump, bumpScale: 2.2 });
  const base = C(color), tint = new THREE.Color();
  const geos = Array.from({ length: variants }, (_, i) => rockGeometry({ seed: seed * 10 + i, detail }));
  const meshes = geos.map((geo) => { const m = new THREE.InstancedMesh(geo, material, Math.ceil(count / variants) + 1); m.castShadow = m.receiveShadow = true; m.count = 0; g.add(m); return m; });
  const items = [];
  for (let i = 0; i < count; i++) {
    const s = size * (0.25 + 2.6 * Math.pow(R(), 6)) * (R() < 0.01 ? 2.2 : 1);
    let x, y, z, ang = 0, rr = 0;
    if (shape === 'belt') { ang = R() * TAU; rr = radius + (R() + R() + R() - 1.5) * width * 0.66; y = (R() + R() - 1) * thickness; x = Math.cos(ang) * rr; z = Math.sin(ang) * rr; }
    else { x = (R() - 0.5) * extent[0]; y = (R() - 0.5) * extent[1]; z = (R() - 0.5) * extent[2]; }
    const axis = new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).normalize();
    const v = i % variants, mesh = meshes[v]; const slot = mesh.count++;
    const sq = [0.75 + R() * 0.5, 0.75 + R() * 0.5, 0.75 + R() * 0.5];
    mesh.setColorAt(slot, tint.copy(base).multiplyScalar(0.7 + R() * 0.55).offsetHSL((R() - 0.5) * 0.03, (R() - 0.5) * 0.1, 0));
    items.push({ mesh, slot, s, x, y, z, ang, rr, axis, spin: (R() - 0.5) * 2 * tumble / Math.max(0.4, s / size), phase: R() * TAU, sq });
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  g.at = (t) => {
    for (const it of items) {
      if (shape === 'belt') { const a = it.ang + t * orbitSpeed * (radius / it.rr) ** 1.5; p.set(Math.cos(a) * it.rr, it.y, Math.sin(a) * it.rr); } else p.set(it.x, it.y, it.z);
      q.setFromAxisAngle(it.axis, it.phase + it.spin * t);
      m4.compose(p, q, sc.set(it.s * it.sq[0], it.s * it.sq[1], it.s * it.sq[2])); it.mesh.setMatrixAt(it.slot, m4);
    }
    for (const m of meshes) m.instanceMatrix.needsUpdate = true;
  };
  g.at(0);
  for (const m of meshes) m.frustumCulled = false;
  g.name = 'asteroids'; g.userData = { radius: shape === 'belt' ? radius + width : Math.hypot(...extent) / 2 };
  return withAnchors(g, {});
}
