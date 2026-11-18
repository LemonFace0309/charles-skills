// Plates: an AI-generated still (made with kit/plate.mjs) turned into a 2.5D set the 3D camera can move through.
//
//   const set = await k.props.plate({ image: k.asset('assets/plates/kitchen.png'), width: 4, look: k.pal.post?.look });
//   k.scene.add(set);
//   const v = set.view();                        // the camera pose that sees exactly the still: start moves from here
//   const p = set.pointAt(0.43, 0.50);           // world position of that spot of the picture, on the surface
//   k.ui.label('Magnetron', { anchor: set.pin(0.70, 0.47) });
//
// How it works. Every vertex of a dense grid is pushed out along the ray of the camera that "took" the picture, to
// the distance the depth map gives. From that camera the mesh looks exactly like the still; from anywhere near it
// the mug slides past the microwave and the back wall falls away: real parallax, and real depth of field from the
// lens. Where depth jumps (the edge of the mug), the grid would stretch into a rubber sheet. Those triangles are cut
// (the near side's vertices slide to the true edge, so cuts do not staircase), and a second layer behind (the far
// side carried in under every near object, its colour painted in from around it) shows through the gap. The still
// also goes through the inverse of the film stage's tone curve, so after the AgX view transform it looks the way it
// was generated, and its brightest pixels come out as real HDR light that blooms.
//
// Coordinates: u runs 0..1 left to right and v runs 0..1 TOP to bottom, like pixels in the PNG divided by its size.
// The plate's own space: the picture plane (where `pivot` lands) is z = 0, centred on the origin, `width` wide; the
// reference camera (plate.eye) sits at (0, 0, distance) looking down -z with vertical field of view `fov`.
import * as THREE from 'three';
import { loadTexture, withAnchors } from './base.js';

// ---------- depth maps ----------
// decodeDepth(url) -> { width, height, data: Float32Array 0..1 (first channel, row 0 = top) }. Reads 16-bit PNGs at
// full precision (the browser's own decoder would cut them to 8 bits, which terraces the mesh); other formats go
// through the browser at 8 bits.
export async function decodeDepth(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`plate: cannot load depth map ${url} (HTTP ${r.status})`);
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    try { return await decodePNG(buf); } catch (e) { console.warn('plate: own PNG decoder failed (' + e.message + '), using the browser at 8 bits'); }
  }
  const bmp = await createImageBitmap(new Blob([buf]), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0);
  const px = g.getImageData(0, 0, c.width, c.height).data, data = new Float32Array(c.width * c.height);
  for (let i = 0; i < data.length; i++) data[i] = px[i * 4] / 255;
  return { width: c.width, height: c.height, data };
}
async function decodePNG(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let o = 8, W = 0, H = 0, bits = 8, type = 0, inter = 0, pal = null; const idat = [];
  while (o + 8 <= u8.length) {
    const len = dv.getUint32(o), kind = String.fromCharCode(u8[o + 4], u8[o + 5], u8[o + 6], u8[o + 7]), d = u8.subarray(o + 8, o + 8 + len);
    if (kind === 'IHDR') { W = dv.getUint32(o + 8); H = dv.getUint32(o + 12); bits = d[8]; type = d[9]; inter = d[12]; }
    else if (kind === 'PLTE') pal = d;
    else if (kind === 'IDAT') idat.push(d);
    else if (kind === 'IEND') break;
    o += 12 + len;
  }
  if (inter) throw new Error('interlaced');
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (!ch) throw new Error('colour type ' + type);
  const raw = new Uint8Array(await new Response(new Blob(idat).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
  const bpp = Math.max(1, (ch * bits) >> 3), stride = (W * ch * bits + 7) >> 3, out = new Uint8Array(stride * H);
  for (let y = 0; y < H; y++) {
    const f = raw[y * (stride + 1)], s = y * (stride + 1) + 1, t = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[t + x - bpp] : 0, b = y ? out[t - stride + x] : 0, c = x >= bpp && y ? out[t - stride + x - bpp] : 0;
      let v = raw[s + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[t + x] = v;
    }
  }
  const data = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (bits === 16) { const k = y * stride + x * ch * 2; data[i] = (out[k] * 256 + out[k + 1]) / 65535; }
    else if (bits === 8) data[i] = (type === 3 ? pal[out[y * stride + x] * 3] : out[y * stride + x * ch]) / 255;
    else { const per = 8 / bits, byte = out[y * stride + Math.floor(x / per)], v = (byte >> (8 - bits * (1 + (x % per)))) & ((1 << bits) - 1); data[i] = type === 3 ? pal[v * 3] / 255 : v / ((1 << bits) - 1); }
  }
  return { width: W, height: H, data };
}

// ---------- the inverse of the film stage's tone curve ----------
// Forward AgX exactly as engine/post.js applies it (inset, log2 encode, contrast curve, "punchy" look, outset), then
// solved backwards per colour into a 33^3 LUT of log2 scene light. Colours AgX cannot make (very bright, very
// saturated) come back as the nearest it can, which is how every other object in the kit renders too.
const AGX_MN = -12.47393, AGX_MX = 4.026069;
function agxForward(x, look, out) {
  let r = x[0], g = x[1], b = x[2];
  let R = 0.6274 * r + 0.3293 * g + 0.0433 * b, G = 0.0691 * r + 0.9195 * g + 0.0113 * b, B = 0.0164 * r + 0.088 * g + 0.8956 * b;
  r = 0.856627153315983 * R + 0.0951212405381588 * G + 0.0482516061458583 * B;
  g = 0.137318972929847 * R + 0.761241990602591 * G + 0.101439036467562 * B;
  b = 0.11189821299995 * R + 0.0767994186031903 * G + 0.811302368396859 * B;
  const enc = (v) => Math.min(1, Math.max(0, (Math.log2(Math.max(v, 1e-10)) - AGX_MN) / (AGX_MX - AGX_MN)));
  const con = (v) => { const v2 = v * v, v4 = v2 * v2; return 15.5 * v4 * v2 - 40.14 * v4 * v + 31.96 * v4 - 6.868 * v2 * v + 0.4298 * v2 + 0.1191 * v - 0.00232; };
  r = con(enc(r)); g = con(enc(g)); b = con(enc(b));
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b, pl = Math.pow(Math.max(l, 0), 1.35);
  const pr = Math.max(0, l + (Math.pow(Math.max(r, 0), 1.35) - pl) * 1.4), pg = Math.max(0, l + (Math.pow(Math.max(g, 0), 1.35) - pl) * 1.4), pb = Math.max(0, l + (Math.pow(Math.max(b, 0), 1.35) - pl) * 1.4);
  r += (pr - r) * look; g += (pg - g) * look; b += (pb - b) * look;
  R = 1.1271005818144368 * r - 0.11060664309660323 * g - 0.016493938717834573 * b;
  G = -0.1413297634984383 * r + 1.157823702216272 * g - 0.016493938717834257 * b;
  B = -0.14132976349843826 * r - 0.11060664309660294 * g + 1.2519364065950405 * b;
  R = Math.pow(Math.max(0, R), 2.2); G = Math.pow(Math.max(0, G), 2.2); B = Math.pow(Math.max(0, B), 2.2);
  r = 1.6605 * R - 0.5876 * G - 0.0728 * B; g = -0.1246 * R + 1.1329 * G - 0.0083 * B; b = -0.0182 * R - 0.1006 * G + 1.1187 * B;
  const s = (c) => { c = Math.min(1, Math.max(0, c)); return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; };
  out[0] = s(r); out[1] = s(g); out[2] = s(b);
  return out;
}
const lutCache = new Map();
export function inverseToneLUT({ look = 0.35, highlights = 8, size = 33 } = {}) {
  const key = `${look}:${highlights}:${size}`;
  if (lutCache.has(key)) return lutCache.get(key);
  const PLO = -14, PHI = Math.log2(Math.max(1, highlights)), NT = 512, tab = new Float32Array(NT), o = [0, 0, 0], o2 = [0, 0, 0];
  for (let i = 0; i < NT; i++) { const x = 2 ** (PLO + ((PHI + 2 - PLO) * i) / (NT - 1)); agxForward([x, x, x], look, o); tab[i] = (o[0] + o[1] + o[2]) / 3; }
  const guess = (s) => { let i = 0; while (i < NT - 1 && tab[i + 1] < s) i++; const a = tab[i], b = tab[Math.min(NT - 1, i + 1)], f = b > a ? Math.min(1, Math.max(0, (s - a) / (b - a))) : 0; return Math.min(PHI, PLO + ((PHI + 2 - PLO) * (i + f)) / (NT - 1)); };
  const N = size, data = new Uint16Array(N * N * N * 4), p = [0, 0, 0], x = [0, 0, 0], xs = [0, 0, 0], J = [0, 0, 0, 0, 0, 0, 0, 0, 0], A = [0, 0, 0, 0, 0, 0, 0, 0, 0], gv = [0, 0, 0], r = [0, 0, 0];
  const det3 = (m) => m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
  for (let bi = 0; bi < N; bi++) for (let gi = 0; gi < N; gi++) for (let ri = 0; ri < N; ri++) {
    const s = [ri / (N - 1), gi / (N - 1), bi / (N - 1)];
    p[0] = guess(s[0]); p[1] = guess(s[1]); p[2] = guess(s[2]);
    for (let it = 0; it < 16; it++) { // Levenberg-Marquardt in log2 space
      for (let c = 0; c < 3; c++) x[c] = 2 ** p[c];
      agxForward(x, look, o);
      r[0] = o[0] - s[0]; r[1] = o[1] - s[1]; r[2] = o[2] - s[2];
      if (Math.abs(r[0]) + Math.abs(r[1]) + Math.abs(r[2]) < 3e-5) break;
      for (let kk = 0; kk < 3; kk++) { xs[0] = x[0]; xs[1] = x[1]; xs[2] = x[2]; xs[kk] = 2 ** (p[kk] + 1e-3); agxForward(xs, look, o2); for (let c = 0; c < 3; c++) J[c * 3 + kk] = (o2[c] - o[c]) / 1e-3; }
      for (let i = 0; i < 3; i++) { for (let j = 0; j < 3; j++) A[i * 3 + j] = J[i] * J[j] + J[3 + i] * J[3 + j] + J[6 + i] * J[6 + j]; gv[i] = -(J[i] * r[0] + J[3 + i] * r[1] + J[6 + i] * r[2]); }
      for (let i = 0; i < 3; i++) A[i * 4] += 1e-7 + A[i * 4] * 1e-3;
      const d = det3(A); if (!Number.isFinite(d) || Math.abs(d) < 1e-30) break;
      const sol = (col) => det3(A.map((v, idx) => (idx % 3 === col ? gv[(idx / 3) | 0] : v))) / d;
      const d0 = sol(0), d1 = sol(1), d2 = sol(2), big = Math.max(Math.abs(d0), Math.abs(d1), Math.abs(d2)), k = big > 2 ? 2 / big : 1;
      p[0] = Math.min(PHI, Math.max(PLO, p[0] + d0 * k)); p[1] = Math.min(PHI, Math.max(PLO, p[1] + d1 * k)); p[2] = Math.min(PHI, Math.max(PLO, p[2] + d2 * k));
    }
    const j = ((bi * N + gi) * N + ri) * 4;
    data[j] = THREE.DataUtils.toHalfFloat(p[0]); data[j + 1] = THREE.DataUtils.toHalfFloat(p[1]); data[j + 2] = THREE.DataUtils.toHalfFloat(p[2]); data[j + 3] = THREE.DataUtils.toHalfFloat(1);
  }
  const tex = new THREE.Data3DTexture(data, N, N, N);
  tex.format = THREE.RGBAFormat; tex.type = THREE.HalfFloatType; tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.ClampToEdgeWrapping; tex.unpackAlignment = 1; tex.needsUpdate = true;
  tex.userData.shared = true; // cached: never disposed with a shot
  lutCache.set(key, tex);
  return tex;
}

function plateMaterial(map, lut, gain) {
  const N = lut ? lut.image.width : 2;
  const m = new THREE.ShaderMaterial({
    uniforms: { plateMap: { value: map }, plateLut: { value: lut }, plateGain: { value: gain }, plateLutOn: { value: lut ? 1 : 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `precision highp float; precision highp sampler3D;
      uniform sampler2D plateMap; uniform sampler3D plateLut; uniform float plateGain, plateLutOn; varying vec2 vUv;
      vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
      void main(){
        vec3 c = texture2D(plateMap, vUv).rgb;
        if (plateLutOn > .5) { vec3 s = clamp(toSRGB(clamp(c, 0., 1.)), 0., 1.); c = exp2(texture(plateLut, s * ${((N - 1) / N).toFixed(6)} + ${(0.5 / N).toFixed(6)}).rgb); }
        gl_FragColor = vec4(c * plateGain, 1.);
      }`,
    side: THREE.DoubleSide, fog: false, lights: false,
  });
  m.plateMap = map; // so the editor disposes it with the shot
  return m;
}

// ---------- small image filters (Float32 maps, row 0 = top) ----------
function bilinear(a, W, H, x, y) { // x, y in pixel units (0 = centre of the first pixel)
  x = Math.min(W - 1, Math.max(0, x)); y = Math.min(H - 1, Math.max(0, y));
  const x0 = Math.min(W - 2, Math.floor(x)), y0 = Math.min(H - 2, Math.floor(y)), fx = x - x0, fy = y - y0, i = y0 * W + x0;
  if (W < 2 || H < 2) return a[0];
  return (a[i] * (1 - fx) + a[i + 1] * fx) * (1 - fy) + (a[i + W] * (1 - fx) + a[i + W + 1] * fx) * fy;
}
function minFilter(src, W, H, R) { // separable square min filter of radius R
  const tmp = new Float32Array(W * H), out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let m = Infinity; for (let i = Math.max(0, x - R), e = Math.min(W - 1, x + R); i <= e; i++) { const v = src[y * W + i]; if (v < m) m = v; } tmp[y * W + x] = m; }
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) { let m = Infinity; for (let j = Math.max(0, y - R), e = Math.min(H - 1, y + R); j <= e; j++) { const v = tmp[j * W + x]; if (v < m) m = v; } out[y * W + x] = m; }
  return out;
}
function boxBlur(src, W, H, R, passes = 2) {
  let a = src, b = new Float32Array(W * H);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < H; y++) { let s = 0, n = 0; const row = y * W; for (let i = 0; i <= Math.min(W - 1, R); i++) { s += a[row + i]; n++; } for (let x = 0; x < W; x++) { b[row + x] = s / n; const add = x + R + 1, sub = x - R; if (add < W) { s += a[row + add]; n++; } if (sub >= 0) { s -= a[row + sub]; n--; } } }
    const c = new Float32Array(W * H);
    for (let x = 0; x < W; x++) { let s = 0, n = 0; for (let j = 0; j <= Math.min(H - 1, R); j++) { s += b[j * W + x]; n++; } for (let y = 0; y < H; y++) { c[y * W + x] = s / n; const add = y + R + 1, sub = y - R; if (add < H) { s += b[add * W + x]; n++; } if (sub >= 0) { s -= b[sub * W + x]; n--; } } }
    a = c;
  }
  return a;
}
// Push-pull fill: pixels with weight 0 take the value of the known pixels around them, smoothly, from coarser and
// coarser averages. val: Float32Array W*H*C, w: Float32Array W*H (1 known, 0 unknown). Fills val in place.
function pushPull(W, H, val, w, C = 3) {
  const L = [{ W, H, c: val, w: Float32Array.from(w) }];
  while (L[L.length - 1].W > 1 || L[L.length - 1].H > 1) {
    const P = L[L.length - 1], W2 = Math.max(1, (P.W + 1) >> 1), H2 = Math.max(1, (P.H + 1) >> 1), c = new Float32Array(W2 * H2 * C), ww = new Float32Array(W2 * H2);
    for (let y = 0; y < P.H; y++) for (let x = 0; x < P.W; x++) { const i = y * P.W + x, j = (y >> 1) * W2 + (x >> 1), wi = P.w[i]; if (!wi) continue; ww[j] += wi; for (let k = 0; k < C; k++) c[j * C + k] += P.c[i * C + k] * wi; }
    for (let j = 0; j < ww.length; j++) { if (ww[j] > 0) for (let k = 0; k < C; k++) c[j * C + k] /= ww[j]; ww[j] = Math.min(1, ww[j]); }
    L.push({ W: W2, H: H2, c, w: ww });
  }
  for (let l = L.length - 2; l >= 0; l--) {
    const F = L[l], Q = L[l + 1];
    for (let y = 0; y < F.H; y++) for (let x = 0; x < F.W; x++) {
      const i = y * F.W + x, wi = F.w[i]; if (wi >= 1) continue;
      const cx = Math.min(Q.W - 1, Math.max(0, (x + 0.5) / 2 - 0.5)), cy = Math.min(Q.H - 1, Math.max(0, (y + 0.5) / 2 - 0.5));
      const x0 = Math.floor(cx), y0 = Math.floor(cy), x1 = Math.min(Q.W - 1, x0 + 1), y1 = Math.min(Q.H - 1, y0 + 1), fx = cx - x0, fy = cy - y0;
      for (let k = 0; k < C; k++) {
        const up = (Q.c[(y0 * Q.W + x0) * C + k] * (1 - fx) + Q.c[(y0 * Q.W + x1) * C + k] * fx) * (1 - fy) + (Q.c[(y1 * Q.W + x0) * C + k] * (1 - fx) + Q.c[(y1 * Q.W + x1) * C + k] * fx) * fy;
        F.c[i * C + k] = F.c[i * C + k] * wi + up * (1 - wi);
      }
      F.w[i] = 1;
    }
  }
  return val;
}

// Nearest-source fill: every pixel that is not a source takes the value of the closest source pixel (a two-pass
// "dead reckoning" distance transform). Next to an edge, that is the continuation of whatever sits just across it,
// which is exactly what a moving camera uncovers there. val: Float32Array W*H*C, src: 1 = source. Fills in place.
function nearestFill(W, H, val, src, C = 3) {
  const n = W * H, sx = new Int32Array(n).fill(-1), sy = new Int32Array(n), d2 = new Float64Array(n).fill(Infinity);
  for (let i = 0; i < n; i++) if (src[i] > 0.5) { sx[i] = i % W; sy[i] = (i / W) | 0; d2[i] = 0; }
  const relax = (x, y, x2, y2) => {
    if (x2 < 0 || y2 < 0 || x2 >= W || y2 >= H) return;
    const j = y2 * W + x2; if (sx[j] < 0) return;
    const dx = x - sx[j], dy = y - sy[j], dd = dx * dx + dy * dy, i = y * W + x;
    if (dd < d2[i]) { d2[i] = dd; sx[i] = sx[j]; sy[i] = sy[j]; }
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) { relax(x, y, x - 1, y); relax(x, y, x - 1, y - 1); relax(x, y, x, y - 1); relax(x, y, x + 1, y - 1); }
    for (let x = W - 1; x >= 0; x--) relax(x, y, x + 1, y);
  }
  for (let y = H - 1; y >= 0; y--) {
    for (let x = W - 1; x >= 0; x--) { relax(x, y, x + 1, y); relax(x, y, x + 1, y + 1); relax(x, y, x, y + 1); relax(x, y, x - 1, y + 1); }
    for (let x = 0; x < W; x++) relax(x, y, x - 1, y);
  }
  for (let i = 0; i < n; i++) { if (src[i] > 0.5 || sx[i] < 0) continue; const j = sy[i] * W + sx[i]; for (let k = 0; k < C; k++) val[i * C + k] = val[j * C + k]; }
  return val;
}
// Soften a filled region: box-blur the values, then keep the blur only where mask (0..1) says "filled".
function softenFill(W, H, val, mask, C, R) {
  for (let k = 0; k < C; k++) {
    const ch = new Float32Array(W * H); for (let i = 0; i < W * H; i++) ch[i] = val[i * C + k];
    const b = boxBlur(ch, W, H, R, 2);
    for (let i = 0; i < W * H; i++) val[i * C + k] = ch[i] + (b[i] - ch[i]) * mask[i];
  }
  return val;
}

// ---------- the plate ----------
// plate(opts) -> THREE.Group (async). Options:
//   image        URL of the still (k.asset('assets/plates/kitchen.png')). depth and meta default to <name>-depth.png
//                and <name>.json next to it, as plate.mjs writes them.
//   width        width of the picture plane in world units (default 4)
//   depthScale   relief: 1 = the estimated geometry, 0.5 = half as deep (safer, less parallax), 0 = a flat card
//   segments     grid columns (default 512; rows follow the aspect). Fewer = faster to build, blockier edges.
//   pivot        [u, v] of the spot that sits on the picture plane z = 0 (default: the median depth)
//   fov          vertical field of view of the still in degrees (default: from the .json, else 40)
//   near, far    depth range of the depth PNG when there is no .json (white = near)
//   edge         how steep a depth jump must be to cut the mesh there (default 25; lower cuts more)
//   layers       2 = cut edges + a filled background layer behind them (default), 1 = one mesh, nothing cut
//   reach        the biggest sideways camera move you plan, as a fraction of the camera distance (default 0.12): sets
//                how far behind each edge the background is painted in (strong jumps reveal more when the camera moves)
//   band         cap on that, as a fraction of the picture width (default 0.15)
//   skirt        rim around the picture, stretched from its edge pixels, as a fraction of the width (default 0.25)
//   look         the film stage's AgX look the plate is graded against (k.pal.post.look; default 0.35)
//   tonemap      'inverse' (default: the still survives the film stage as generated) or 'none'
//   highlights   brightest scene light a white pixel may become (default 8; lower = less bloom from the still)
//   brightness   multiplies the plate's light (dim it to let overlays carry the frame; set.setBrightness(v) animates it)
//   sharpen      how far (fraction of the width) a vertex looks for a depth jump to snap to (default 0.002)
//   maxDepth     farthest the set reaches, in camera distances (default 12; skies and far walls are clamped there)
export async function plate({
  image, depth = null, meta = null, width = 4, depthScale = 1, segments = 512, pivot = null, fov = null, near = null, far = null,
  edge = 25, sharpen = 0.002, layers = 2, reach = 0.12, band = 0.15, skirt = 0.25, maxDepth = 12, look = 0.35, tonemap = 'inverse', highlights = 8, brightness = 1,
} = {}) {
  if (!image) throw new Error('plate: image is required');
  const base = image.replace(/(-depth)?\.(png|jpe?g|webp)(\?.*)?$/i, '');
  const [tex, dep, info] = await Promise.all([
    loadTexture(image),
    decodeDepth(depth || base + '-depth.png'),
    fetch(meta || base + '.json').then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);
  tex.anisotropy = 16;
  const iw = tex.image.width, ih = tex.image.height, A = iw / ih;
  const zNear = near ?? info?.depth?.near ?? 1, zFar = far ?? info?.depth?.far ?? 8;
  const fovY = fov ?? info?.fov?.y ?? 40;
  const tanY = Math.tan((fovY * Math.PI) / 360), tanX = tanY * A;
  const D = width / 2 / tanX, height = width / A;
  const dw = dep.width, dh = dep.height, ia = 1 / zFar, ib = 1 / zNear - 1 / zFar;
  const inv = new Float32Array(dw * dh); // inverse distance, in the depth source's units
  for (let i = 0; i < inv.length; i++) inv[i] = ia + dep.data[i] * ib;
  const invAt = (u, v) => bilinear(inv, dw, dh, u * dw - 0.5, v * dh - 0.5);
  let zp;
  if (pivot) zp = 1 / invAt(pivot[0], pivot[1]);
  else { const s = []; for (let i = 0; i < inv.length; i += 97) s.push(inv[i]); s.sort((a, b) => a - b); zp = 1 / s[s.length >> 1]; }
  const toWorld = (zm) => Math.min(D * maxDepth, Math.max(D * 0.03, D * Math.pow(zm / zp, depthScale)));

  // grid: segX x segY cells over the picture, plus a skirt: KS cells on every side that grow outwards to `skirt` of
  // the width, stretching the picture's edge pixels so near things can slide sideways without opening a void
  const segX = Math.max(8, Math.round(segments)), segY = Math.max(8, Math.round(segments / A));
  const KS = skirt > 0 ? 10 : 0;
  const along = (k, s, ext) => (k < KS ? -ext * Math.pow((KS - k) / KS, 1.6) : k > KS + s ? 1 + ext * Math.pow((k - KS - s) / KS, 1.6) : (k - KS) / s);
  const ray = (u, v, zw, out, o) => { out[o] = (2 * u - 1) * tanX * zw; out[o + 1] = (1 - 2 * v) * tanY * zw; out[o + 2] = D - zw; };
  const grid = (sx, sy, sample) => {
    const ks = KS, cols = sx + 1 + 2 * ks, rows = sy + 1 + 2 * ks, n = cols * rows;
    const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), Z = new Float32Array(n), I = new Float32Array(n);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const u = along(i, sx, skirt), v = along(j, sy, skirt * A), k = j * cols + i;
      const zm = sample(Math.min(1, Math.max(0, u)), Math.min(1, Math.max(0, v))), zw = toWorld(zm);
      Z[k] = zw; I[k] = 1 / zm;
      ray(u, v, zw, pos, k * 3);
      uv[k * 2] = u; uv[k * 2 + 1] = 1 - v;
    }
    return { sx, sy, ks, cols, rows, pos, uv, Z, I };
  };
  // Silhouettes: a cut follows the grid, which would leave a staircase along every edge. Each vertex on the near side
  // of a cut slides towards its far neighbours, to where the full-resolution depth map actually crosses from near to
  // far, so the edge of the mug is the edge of the mug, not of the grid.
  const refine = (G) => {
    const { cols, rows, Z, I, ks, sx, sy } = G, lim = edge / sx, moved = [];
    const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (let j = ks; j <= ks + sy; j++) for (let i = ks; i <= ks + sx; i++) {
      const k = j * cols + i, u0 = (i - ks) / sx, v0 = (j - ks) / sy;
      let du = 0, dv = 0, n = 0;
      for (const [di, dj] of N8) {
        const i2 = i + di, j2 = j + dj; if (i2 < ks || j2 < ks || i2 > ks + sx || j2 > ks + sy) continue;
        const k2 = j2 * cols + i2; if (Math.log(Z[k2] / Z[k]) <= lim) continue; // only towards a farther neighbour across a jump
        const u1 = (i2 - ks) / sx, v1 = (j2 - ks) / sy, mid = Math.sqrt(I[k] * I[k2]);
        let t = 1;
        for (let q = 1; q <= 12; q++) { const f = q / 12; if (invAt(u0 + (u1 - u0) * f, v0 + (v1 - v0) * f) < mid) { t = f - 0.5 / 12; break; } }
        du += (u1 - u0) * t; dv += (v1 - v0) * t; n++;
      }
      if (n) moved.push(k, u0 + du / n, v0 + dv / n);
    }
    for (let m = 0; m < moved.length; m += 3) { const k = moved[m], u = moved[m + 1], v = moved[m + 2]; ray(u, v, Z[k], G.pos, k * 3); G.uv[k * 2] = u; G.uv[k * 2 + 1] = 1 - v; }
    return moved.length / 3;
  };
  const mesh = (G, map, cut) => {
    const idx = new Uint32Array((G.cols - 1) * (G.rows - 1) * 6), lim = edge / G.sx, Z = G.Z;
    let n = 0;
    const tri = (p, q, r) => { if (cut) { const hi = Math.max(Z[p], Z[q], Z[r]), lo = Math.min(Z[p], Z[q], Z[r]); if (Math.log(hi / lo) > lim) return; } idx[n++] = p; idx[n++] = q; idx[n++] = r; };
    for (let j = 0; j < G.rows - 1; j++) for (let i = 0; i < G.cols - 1; i++) { const a = j * G.cols + i, b = a + 1, c = a + G.cols, d = c + 1; tri(a, c, b); tri(b, c, d); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(G.pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(G.uv, 2));
    geo.setIndex(new THREE.BufferAttribute(G.pos.length / 3 > 65535 ? idx.slice(0, n) : Uint16Array.from(idx.subarray(0, n)), 1));
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, plateMaterial(map, lut, brightness));
    m.frustumCulled = false;
    m.userData.triangles = n / 3; m.userData.cutTriangles = (G.cols - 1) * (G.rows - 1) * 2 - n / 3;
    return m;
  };
  const lut = tonemap === 'inverse' ? inverseToneLUT({ look, highlights }) : null;

  // front layer: sample with edge snapping, so a vertex is either on the near or the far side of a jump, never
  // floating between them (soft depth edges would otherwise smear into a curtain)
  const rp = Math.max(0.5 * (dw / segX), sharpen * dw);
  const snapped = (u, v) => {
    const px = u * dw - 0.5, py = v * dh - 0.5, c = bilinear(inv, dw, dh, px, py);
    let mn = Infinity, mx = -Infinity;
    for (let y = Math.max(0, Math.floor(py - rp)), ye = Math.min(dh - 1, Math.ceil(py + rp)); y <= ye; y++)
      for (let x = Math.max(0, Math.floor(px - rp)), xe = Math.min(dw - 1, Math.ceil(px + rp)); x <= xe; x++) { const q = inv[y * dw + x]; if (q < mn) mn = q; if (q > mx) mx = q; }
    const id = (mx - mn) / mx > 0.06 ? (c - mn < mx - c ? mn : mx) : c;
    return 1 / id;
  };
  const FG = grid(segX, segY, snapped);
  const refined = layers > 1 ? refine(FG) : 0;
  const front = mesh(FG, tex, layers > 1);
  front.name = 'plate-front';
  const g = new THREE.Group();
  g.add(front);

  // back layer: what is behind the near side of every depth jump. Jumps are found on a small work copy of the depth;
  // from the near side of each, a flood fill spreads over the near object without crossing its own edges, out to
  // `band` of the width (a mug is covered whole; a long counter edge only along a strip). Those pixels are painted
  // over: depth and colour filled in from the pixels around them (push-pull), which are the far side. Everywhere else
  // the back layer is the still itself, a hair behind the front layer, so it only shows through cuts.
  let back = null;
  if (layers > 1) {
    const ww = Math.min(dw, 400), wh = Math.max(2, Math.round((dh * ww) / dw)), n = ww * wh;
    const s = new Float32Array(n);
    for (let y = 0; y < wh; y++) for (let x = 0; x < ww; x++) s[y * ww + x] = invAt((x + 0.5) / ww, (y + 0.5) / wh);
    // seeds: the near side of every jump. Each gets its own reach: the strip a sideways camera move of `reach` x the
    // camera distance would uncover behind it (parallax grows with the jump), capped at `band` of the width
    const J = 1.06, JF = Math.log(1.035), Bmax = Math.max(2, Math.round(band * ww));
    const budgetFor = (near, far) => Math.round(Math.min(Bmax, Math.max(2, (reach * (Math.pow(zp * near, depthScale) - Math.pow(zp * far, depthScale)) / (2 * tanX)) * ww)));
    const rem = new Int16Array(n).fill(-1), buckets = Array.from({ length: Bmax + 1 }, () => []);
    for (let y = 0; y < wh; y++) for (let x = 0; x < ww; x++) {
      const p = y * ww + x; let far = Infinity;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy; if ((!dx && !dy) || xx < 0 || yy < 0 || xx >= ww || yy >= wh) continue;
        const q = s[yy * ww + xx]; if (s[p] > q * J && q < far) far = q;
      }
      if (far < Infinity) { const bud = budgetFor(s[p], far); if (bud > rem[p]) { rem[p] = bud; buckets[bud].push(p); } }
    }
    // flood over the near object (never across its own edges), widest budgets first; 8- and 4-neighbour steps
    // alternate so the reach is an octagon, close to a circle
    const N8 = [-1, 1, -ww, ww, -ww - 1, -ww + 1, ww - 1, ww + 1];
    for (let bud = Bmax; bud > 0; bud--) for (const p of buckets[bud]) {
      if (rem[p] !== bud) continue;
      const x = p % ww, nn = bud % 2 ? 8 : 4;
      for (let m = 0; m < nn; m++) {
        const r = p + N8[m], rx = r % ww; if (r < 0 || r >= n || Math.abs(rx - x) > 1) continue;
        if (rem[r] >= bud - 1 || Math.abs(Math.log(s[r] / s[p])) > JF) continue;
        rem[r] = bud - 1; buckets[bud - 1].push(r);
      }
    }
    let qt = 0; const dist = rem; for (let i = 0; i < n; i++) if (rem[i] >= 0) qt++;
    // fill only from what is behind: a source pixel counts as much as it is farther than the near object next to it
    // (the counter top in front of a mug, or beyond the band, must not paint into the hole; the wall behind it must)
    const knownW = new Float32Array(n), refW = new Float32Array(n);
    for (let i = 0; i < n; i++) { knownW[i] = dist[i] < 0 ? 1 : 0; refW[i] = 1 - knownW[i]; }
    const hidden = qt;
    const sRef = pushPull(ww, wh, Float32Array.from(s, (v, i) => (refW[i] ? v : 0)), refW, 1);
    const srcW = new Float32Array(n);
    for (let i = 0; i < n; i++) { if (!knownW[i]) continue; const f = Math.min(1, Math.max(0, (sRef[i] / s[i] - 1) / (J - 1))); srcW[i] = Math.max(1e-4, f * f * (3 - 2 * f)); }
    const backInv = nearestFill(ww, wh, Float32Array.from(s), srcW, 1);
    softenFill(ww, wh, backInv, refW, 1, 2);
    for (let i = 0; i < n; i++) backInv[i] = knownW[i] ? s[i] * 0.985 : Math.min(backInv[i], s[i]) * 0.985;
    const backAt = (u, v) => bilinear(backInv, ww, wh, u * ww - 0.5, v * wh - 0.5);
    // colour at up to 768 px wide
    const cw = Math.min(iw, 768), chh = Math.max(2, Math.round(cw / A));
    const cnv = document.createElement('canvas'); cnv.width = cw; cnv.height = chh;
    const cx = cnv.getContext('2d', { willReadFrequently: true }); cx.drawImage(tex.image, 0, 0, cw, chh);
    const px = cx.getImageData(0, 0, cw, chh).data, rgb = new Float32Array(cw * chh * 3), known = new Float32Array(cw * chh), wsrc = new Float32Array(cw * chh);
    for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) {
      const i = y * cw + x, wx = ((x + 0.5) / cw) * ww - 0.5, wy = ((y + 0.5) / chh) * wh - 0.5;
      known[i] = bilinear(knownW, ww, wh, wx, wy) > 0.999 ? 1 : 0;
      wsrc[i] = bilinear(srcW, ww, wh, wx, wy);
      rgb[i * 3] = px[i * 4]; rgb[i * 3 + 1] = px[i * 4 + 1]; rgb[i * 3 + 2] = px[i * 4 + 2];
    }
    const keep = minFilter(known, cw, chh, 2); // the blended pixels right at each edge are not a source either
    const orig = rgb.slice();
    nearestFill(cw, chh, rgb, keep.map((k, i) => k * wsrc[i]), 3);
    for (let i = 0; i < keep.length; i++) if (keep[i]) { rgb[i * 3] = orig[i * 3]; rgb[i * 3 + 1] = orig[i * 3 + 1]; rgb[i * 3 + 2] = orig[i * 3 + 2]; }
    softenFill(cw, chh, rgb, keep.map((k) => 1 - k), 3, 3);
    const out = new Uint8Array(cw * chh * 4);
    for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) { const i = y * cw + x, o = ((chh - 1 - y) * cw + x) * 4; out[o] = rgb[i * 3] + 0.5; out[o + 1] = rgb[i * 3 + 1] + 0.5; out[o + 2] = rgb[i * 3 + 2] + 0.5; out[o + 3] = 255; }
    const btex = new THREE.DataTexture(out, cw, chh, THREE.RGBAFormat, THREE.UnsignedByteType);
    btex.colorSpace = THREE.SRGBColorSpace; btex.generateMipmaps = true; btex.minFilter = THREE.LinearMipmapLinearFilter; btex.magFilter = THREE.LinearFilter; btex.anisotropy = 16; btex.needsUpdate = true;
    const BG = grid(Math.max(16, Math.round(segX / 2)), Math.max(16, Math.round(segY / 2)), (u, v) => 1 / backAt(u, v));
    back = mesh(BG, btex, false);
    back.name = 'plate-back';
    back.material.polygonOffset = true; back.material.polygonOffsetFactor = 1; back.material.polygonOffsetUnits = 2;
    back.userData.hiddenFraction = hidden / knownW.length;
    back.userData.mask = { width: ww, height: wh, known: knownW };
    g.add(back);
  }

  // ---------- helpers ----------
  const v3 = (u, v, zw) => new THREE.Vector3((2 * u - 1) * tanX * zw, (1 - 2 * v) * tanY * zw, D - zw);
  // depthAt(u, v): distance from the reference camera along its view axis, in world units, as the mesh has it
  const depthAt = (u, v) => {
    const G = FG, gx = Math.min(G.cols - 1.001, Math.max(0, u * G.sx + G.ks)), gy = Math.min(G.rows - 1.001, Math.max(0, v * G.sy + G.ks));
    const i = Math.floor(gx), j = Math.floor(gy), fx = gx - i, fy = gy - j, k = j * G.cols + i;
    const z00 = G.Z[k], z10 = G.Z[k + 1], z01 = G.Z[k + G.cols], z11 = G.Z[k + G.cols + 1];
    const hi = Math.max(z00, z10, z01, z11), lo = Math.min(z00, z10, z01, z11);
    if (Math.log(hi / lo) > edge / G.sx) return [[z00, z10], [z01, z11]][fy < 0.5 ? 0 : 1][fx < 0.5 ? 0 : 1]; // on a cut: the nearest corner
    return (z00 * (1 - fx) + z10 * fx) * (1 - fy) + (z01 * (1 - fx) + z11 * fx) * fy;
  };
  // localAt(u, v, lift): the surface point at that spot of the picture, in the plate's own space (for overlays you
  // parent to the plate). lift moves it towards the reference camera along its ray, in world units, so it stays over
  // the same spot of the picture but floats just in front of the surface (lines need ~0.02 so they do not sink in).
  const localAt = (u, v, lift = 0) => v3(u, v, Math.max(D * 0.01, depthAt(u, v) - lift));
  const W = (p) => { g.updateWorldMatrix(true, false); return p.applyMatrix4(g.matrixWorld); };
  Object.assign(g, {
    front, back, image: tex, fov: fovY, aspect: A, width, height, distance: D,
    eye: new THREE.Vector3(0, 0, D), // the reference camera, in the plate's own space
    depthAt, localAt,
    // pointAt(u, v, lift) -> world position of that spot of the picture, on the surface
    pointAt: (u, v, lift = 0) => W(localAt(u, v, lift)),
    // normalAt(u, v, radius) -> world direction facing out of the surface there, averaged over `radius` of the width
    normalAt: (u, v, r = 0.01) => {
      const ry = r * A, a = localAt(u - r, v), b = localAt(u + r, v), c = localAt(u, v + ry), d = localAt(u, v - ry);
      const n = new THREE.Vector3().crossVectors(b.sub(a), d.sub(c)).normalize();
      if (n.dot(new THREE.Vector3(0, 0, D).sub(localAt(u, v))) < 0) n.negate();
      g.updateWorldMatrix(true, false);
      return n.transformDirection(g.matrixWorld);
    },
    // pin(u, v, lift, name) -> an empty Object3D on the surface, parented to the plate: an anchor for k.ui.label.
    // Named pins join set.anchors (set.anchor(name) finds them again).
    pin: (u, v, lift = 0, name = null) => { const o = new THREE.Object3D(); o.position.copy(localAt(u, v, lift)); g.add(o); if (name) { o.name = name; g.anchors[name] = o; } return o; },
    // curve([[u, v], ...], { lift, samples }) -> a smooth world-space curve that hugs the surface through those spots
    // (for glow.tube / glow.pulse; keep it on one continuous surface, a curve across a cut jumps)
    curve: (pts, { lift = 0.02, samples = 96, closed = false } = {}) => {
      const s2 = new THREE.SplineCurve(pts.map(([u, v]) => new THREE.Vector2(u, v)));
      return new THREE.CatmullRomCurve3(s2.getSpacedPoints(Math.max(2, samples)).map((q) => W(localAt(q.x, q.y, lift))), closed, 'centripetal');
    },
    // toUV(worldPoint) -> [u, v]: where a 3D point lands in the still (to check that an overlay lines up)
    toUV: (p) => { const l = g.worldToLocal(p.clone()), zw = D - l.z; return [(l.x / (tanX * zw) + 1) / 2, (1 - l.y / (tanY * zw)) / 2]; },
    // view({ margin, aspect }) -> { pos, look, fov } in world space: the reference camera, its field of view narrowed
    // so the still covers a frame of that aspect with `margin` to spare (camera moves need the slack)
    // setBrightness(v): dims or lifts the whole plate; call it from update(t) to fade the set under an explanation
    setBrightness: (v) => { for (const m of [front, back]) if (m) m.material.uniforms.plateGain.value = v; },
    view: ({ margin = 0.04, aspect = 9 / 16 } = {}) => {
      g.updateWorldMatrix(true, false);
      const t = Math.min(tanY, tanX / aspect) * (1 - margin);
      return { pos: W(new THREE.Vector3(0, 0, D)), look: W(new THREE.Vector3(0, 0, 0)), fov: (2 * Math.atan(t) * 180) / Math.PI };
    },
  });
  g.userData = { plate: true, image, segments: segX, depthRange: [zNear, zFar], pivotDepth: zp, triangles: front.userData.triangles, cutTriangles: front.userData.cutTriangles, refinedVertices: refined, radius: Math.hypot(width, height) / 2 };
  g.name = 'plate';
  return withAnchors(g, {});
}
