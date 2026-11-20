/* Pixel work done in a headless Chrome page, so the kit needs no image library.
     trimBorder:   Topaz's upscaler pads its output with a dark frame (9 px seen on 2x); find it on each side, cut it,
                   and scale back to the size asked for.
     compositeBox: image edits redraw the whole frame; keep the original everywhere except one box, which takes the
                   edited pixels through a feathered edge. */
import fs from 'node:fs';
import path from 'node:path';

const mimeOf = (f) => ({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[path.extname(f).toLowerCase()] || 'image/png');
const uri = (f) => `data:${mimeOf(f)};base64,${fs.readFileSync(f).toString('base64')}`;

async function withPage(browser, fn) {
  const page = await browser.newPage();
  try { return await fn(page); } finally { await page.close(); }
}

function save(dataUrl, out) {
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
}

/* Returns { trimmed: {top,right,bottom,left}, size: [w,h] }. A side counts as padded when its outer rows are flat
   and far darker (or lighter) than the picture just inside them. */
export async function trimBorder(browser, file, out, [W, H], usual = 0) {
  const res = await withPage(browser, (page) => page.evaluate(async ({ src, W, H, usual }) => {
    const im = new Image(); im.src = src; await im.decode();
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0);
    const med = (d) => { const v = []; for (let i = 0; i < d.length; i += 4) v.push(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]); v.sort((p, q) => p - q); return v[v.length >> 1]; };
    const row = (y) => med(x.getImageData(0, y, c.width, 1).data), col = (xx) => med(x.getImageData(xx, 0, 1, c.height).data);
    const side = (get, len) => {   // rows from the edge whose median stays flat, then a clear jump into the picture
      const max = Math.min(48, Math.floor(len / 20)); const v = []; for (let i = 0; i <= max + 3; i++) v.push(get(i));
      for (let k = 2; k <= max; k++) {
        if (v.slice(0, k).every((m) => Math.abs(m - v[0]) <= 2) && Math.abs((v[k] + v[k + 1] + v[k + 2]) / 3 - v[0]) > 6) return k;
      }
      return 0;
    };
    let t = { top: side(row, c.height), bottom: side((i) => row(c.height - 1 - i), c.height),
      left: side(col, c.width), right: side((i) => col(c.width - 1 - i), c.width) };
    // the upscaler pads every side alike, and a dark picture hides the frame on some sides: a width found on any side
    // (near the usual one, when that's known) is cut on all four; none found, the usual width is cut anyway
    const found = Object.values(t).filter((k) => k > 0);
    const near = usual ? found.filter((k) => Math.abs(k - usual) <= 4) : found;
    if (near.length && (usual || near.length >= 2)) { const k = Math.max(...near); t = { top: k, bottom: k, left: k, right: k }; }
    else if (usual) t = { top: usual, bottom: usual, left: usual, right: usual, assumed: true };
    // the frame's inner edge is soft: cut two pixels past it so no dark hairline survives
    for (const k of ['top', 'bottom', 'left', 'right']) if (t[k]) t[k] += 2;
    const o = document.createElement('canvas'); o.width = W || c.width; o.height = H || c.height;
    const ox = o.getContext('2d'); ox.imageSmoothingQuality = 'high';
    ox.drawImage(c, t.left, t.top, c.width - t.left - t.right, c.height - t.top - t.bottom, 0, 0, o.width, o.height);
    return { t, w: o.width, h: o.height, data: o.toDataURL('image/png') };
  }, { src: uri(file), W, H, usual }));
  save(res.data, out);
  return { trimmed: res.t, size: [res.w, res.h] };
}

const load = async (s) => { const im = new Image(); im.src = s; await im.decode(); return im; };

/* Zoom out on a plain ground (paper, a studio sweep, a wall, sky) with no model: the picture shrinks onto a canvas of
   the same size and the ground grows outward from its own edges, with grain measured on the picture and the picture
   feathered in. Free, exact in the middle, no seam. At the picture's edge the ground takes the edge's own colours;
   within ~2% of the frame they ease into the edge's broad light (a running mean over 40% of it), so a shadow or an
   object crossing the edge fades instead of streaking to the frame. An edge that differs from its broad light by more
   than a little is reported as busy: look at it, and anchor that side to the frame or use the model instead.
   Returns { box, busy: [sides], grain }. */
export async function growGround(browser, file, out, { scale = 0.8, anchor = 'center' } = {}) {
  const res = await withPage(browser, (page) => page.evaluate(async ({ src, scale, anchor, loadSrc }) => {
    const load = new Function(`return ${loadSrc}`)();
    const im = await load(src);
    const W = im.naturalWidth, H = im.naturalHeight, w = Math.round(W * scale), h = Math.round(H * scale);
    const x = Math.round((W - w) / 2), y = anchor === 'bottom' ? H - h : anchor === 'top' ? 0 : Math.round((H - h) / 2);
    const canvas = (cw, ch) => { const c = document.createElement('canvas'); c.width = cw; c.height = ch; const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; return [c, g]; };
    const [P, pg] = canvas(w, h); pg.drawImage(im, 0, 0, w, h);
    const pd = pg.getImageData(0, 0, w, h).data;
    // each edge as a line of colours: a band 1-4% in from the edge, averaged across its depth
    const band = Math.max(4, Math.round(0.03 * Math.min(w, h))), inset = Math.max(2, Math.round(0.01 * Math.min(w, h)));
    const edgeLine = (side) => {
      const vert = side === 'left' || side === 'right', n = vert ? h : w, out = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) for (let k = 0; k < band; k++) {
        const xx = side === 'left' ? inset + k : side === 'right' ? w - 1 - inset - k : i, yy = side === 'top' ? inset + k : side === 'bottom' ? h - 1 - inset - k : i;
        const o = (yy * w + xx) * 4; for (let ch = 0; ch < 3; ch++) out[i * 3 + ch] += pd[o + ch] / band;
      }
      return out;
    };
    const sides = ['left', 'right', 'top', 'bottom'].filter((s) => (s === 'left' ? x : s === 'right' ? W - x - w : s === 'top' ? y : H - y - h) > 0);
    const lines = Object.fromEntries(['left', 'right', 'top', 'bottom'].map((s) => [s, edgeLine(s)]));
    // each edge's broad light: a running mean over 40% of its length (ends clamped)
    const wideLine = (L, share = 0.2) => {
      const n = L.length / 3, r = Math.max(8, Math.round(n * share)), out = new Float32Array(n * 3), cum = new Float64Array((n + 1) * 3);
      for (let i = 0; i < n; i++) for (let ch = 0; ch < 3; ch++) cum[(i + 1) * 3 + ch] = cum[i * 3 + ch] + L[i * 3 + ch];
      for (let i = 0; i < n; i++) { const a = Math.max(0, i - r), b = Math.min(n, i + r + 1); for (let ch = 0; ch < 3; ch++) out[i * 3 + ch] = (cum[b * 3 + ch] - cum[a * 3 + ch]) / (b - a); }
      return out;
    };
    const wide = Object.fromEntries(Object.entries(lines).map(([s, L]) => [s, wideLine(L)]));
    // a busy edge: one that differs from its broad light (light, a shadow or an object crossing it), or whose light
    // curves along it (a vignette or a pool of light, which growing outward carries on past the old corners). Light
    // that only drifts from one end to the other is fine: it carries on as a gradient
    const busy = [];
    for (const s of sides) {
      const L = lines[s], Wd = wide[s], Md = wideLine(L, 0.05), n = L.length / 3, dev = [], lum = [];
      for (let i = 0; i < n; i++) {
        dev.push((Math.abs(L[i * 3] - Wd[i * 3]) + Math.abs(L[i * 3 + 1] - Wd[i * 3 + 1]) + Math.abs(L[i * 3 + 2] - Wd[i * 3 + 2])) / 3);
        lum.push(0.2126 * Md[i * 3] + 0.7152 * Md[i * 3 + 1] + 0.0722 * Md[i * 3 + 2]);
      }
      const xm = (n - 1) / 2, ym = lum.reduce((a, b) => a + b, 0) / n;
      let sxx = 0, sxy = 0; lum.forEach((v, i) => { sxx += (i - xm) ** 2; sxy += (i - xm) * (v - ym); });
      const res = lum.map((v, i) => Math.abs(v - (ym + (sxy / sxx) * (i - xm)))).sort((a, b) => a - b);
      dev.sort((a, b) => a - b);
      const jumps = dev[Math.floor(dev.length * 0.995)] > 12, uneven = res[Math.floor(res.length * 0.995)] > 5;
      if (jumps || uneven) busy.push(s);
    }
    const lam = Math.max(8, 0.02 * Math.min(W, H));      // how far out the edge's own colours carry, px
    // the ground: every margin pixel takes the colour of the nearest edge point, the four sides blended by distance,
    // worked out on a coarse grid and smoothed, so it drifts the way the light does and never streaks
    const G = 8, gw = Math.ceil(W / G) + 1, gh = Math.ceil(H / G) + 1, grid = new Float32Array(gw * gh * 3);
    const sample = (s, t, d) => {
      const L = lines[s], Wd = wide[s], n = L.length / 3, i = Math.max(0, Math.min(n - 1, Math.round(t))), k = Math.exp(-Math.max(0, d) / lam);
      return [0, 1, 2].map((ch) => Wd[i * 3 + ch] + (L[i * 3 + ch] - Wd[i * 3 + ch]) * k);
    };
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
      const px = gx * G, py = gy * G; let ws = 0; const c = [0, 0, 0];
      for (const s of ['left', 'right', 'top', 'bottom']) {
        const vert = s === 'left' || s === 'right';
        const t = vert ? Math.max(0, Math.min(h - 1, py - y)) : Math.max(0, Math.min(w - 1, px - x));
        const ex = s === 'left' ? x : s === 'right' ? x + w : x + t, ey = s === 'top' ? y : s === 'bottom' ? y + h : y + t;
        const dd = (px - ex) ** 2 + (py - ey) ** 2 + 1, wgt = 1 / (dd * dd); const v = sample(s, t, Math.sqrt(dd));
        ws += wgt; for (let ch = 0; ch < 3; ch++) c[ch] += wgt * v[ch];
      }
      for (let ch = 0; ch < 3; ch++) grid[(gy * gw + gx) * 3 + ch] = c[ch] / ws;
    }
    // soften the grid (box blur, edges clamped), then draw it at full size with bilinear sampling
    for (let pass = 0; pass < 3; pass++) for (const horiz of [true, false]) {
      const R = 3, src2 = grid.slice();
      for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) for (let ch = 0; ch < 3; ch++) {
        let s2 = 0, c2 = 0;
        for (let k = -R; k <= R; k++) { const xx = horiz ? Math.max(0, Math.min(gw - 1, gx + k)) : gx, yy = horiz ? gy : Math.max(0, Math.min(gh - 1, gy + k)); s2 += src2[(yy * gw + xx) * 3 + ch]; c2++; }
        grid[(gy * gw + gx) * 3 + ch] = s2 / c2;
      }
    }
    // grain to match the picture: fine texture measured on the edge bands (pixel minus its 5x5 neighbourhood)
    let gs = 0, gn = 0;
    for (const s of sides) for (let i = 2; i < (s === 'left' || s === 'right' ? h : w) - 2; i += 3) for (let k = 2; k < band - 2; k += 2) {
      const xx = s === 'left' ? inset + k : s === 'right' ? w - 1 - inset - k : i, yy = s === 'top' ? inset + k : s === 'bottom' ? h - 1 - inset - k : i;
      let m = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const o = ((yy + dy) * w + xx + dx) * 4; m += 0.2126 * pd[o] + 0.7152 * pd[o + 1] + 0.0722 * pd[o + 2]; }
      const o = (yy * w + xx) * 4, v = 0.2126 * pd[o] + 0.7152 * pd[o + 1] + 0.0722 * pd[o + 2]; gs += (v - m / 25) ** 2; gn++;
    }
    const sigma = gn ? Math.sqrt(gs / gn) * 1.05 : 0;
    let seed = 12345; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const gauss = () => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
    const [C, cg] = canvas(W, H); const img = cg.createImageData(W, H), d = img.data;
    const fe = Math.max(6, Math.round(0.012 * Math.min(W, H)));            // the picture's feather, px
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
      const gx = px / G, gy = py / G, x0 = Math.min(gw - 2, gx | 0), y0 = Math.min(gh - 2, gy | 0), fx = gx - x0, fy = gy - y0;
      const o = (py * W + px) * 4, n = gauss() * sigma;
      for (let ch = 0; ch < 3; ch++) {
        const i00 = (y0 * gw + x0) * 3 + ch, i10 = i00 + 3, i01 = i00 + gw * 3, i11 = i01 + 3;
        const v = (grid[i00] * (1 - fx) + grid[i10] * fx) * (1 - fy) + (grid[i01] * (1 - fx) + grid[i11] * fx) * fy;
        d[o + ch] = Math.max(0, Math.min(255, v + n));
      }
      d[o + 3] = 255;
    }
    cg.putImageData(img, 0, 0);
    // the picture through a feathered mask (no feather on a side that sits on the frame's edge)
    const [M, mg] = canvas(W, H);
    const l = sides.includes('left') ? x + fe : -fe * 4, t = sides.includes('top') ? y + fe : -fe * 4;
    const r = sides.includes('right') ? x + w - fe : W + fe * 4, b = sides.includes('bottom') ? y + h - fe : H + fe * 4;
    mg.filter = `blur(${fe / 2}px)`; mg.fillStyle = '#fff'; mg.fillRect(l, t, r - l, b - t);
    mg.filter = 'none'; mg.globalCompositeOperation = 'source-in'; mg.drawImage(P, x, y);
    cg.drawImage(M, 0, 0);
    return { data: C.toDataURL('image/png'), box: [x, y, w, h], busy, grain: Math.round(sigma * 10) / 10 };
  }, { src: uri(file), scale, anchor, loadSrc: load.toString() }));
  save(res.data, out);
  return { box: res.box, busy: res.busy, grain: res.grain };
}

/* After a model extends a picture: find the original in the extension (it comes back within a few px of where it was
   put), paste it back exactly, then match the margin to it. The model repaints the picture's outer rim along with the
   margin, so the seam it leaves sits ~1% inside the old edge, a faint tint step; pasting the original moves the step
   to a line we know, where it is measured (medians over the side's flat rows, a few px clear of the line, so objects
   and the edge itself don't count) and the margin shifted to match, each side's correction blending into the corners.
   box: [x, y, w, h], fractions of the frame where the original was put.
   Returns { matched, score, box: [x, y, w, h] px, sides: { left: { step, rows, line } ... } }. */
export async function healExtension(browser, file, original, out, box) {
  const res = await withPage(browser, (page) => page.evaluate(async ({ src, orig, box, loadSrc }) => {
    const load = new Function(`return ${loadSrc}`)();
    const A = await load(src), O = await load(orig);
    const W = A.naturalWidth, H = A.naturalHeight;
    const pixels = (im, w, h, blur = 0) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; if (blur) g.filter = `blur(${blur}px)`;
      g.drawImage(im, 0, 0, w, h); return { c, g, img: g.getImageData(0, 0, w, h) };
    };
    const lum = (data) => { const n = data.length / 4, L = new Float32Array(n); for (let i = 0; i < n; i++) L[i] = 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]; return L; };
    const med = (a) => { const s = Float32Array.from(a).sort(); return s.length ? s[s.length >> 1] : 0; };
    const ew = box[2] * W, eh = box[3] * H, ecx = box[0] * W + ew / 2, ecy = box[1] * H + eh / 2, ow = Math.round(ew), oh = Math.round(eh);

    // 1. find the original: resized to where it was put, slid and scaled over the extension (normalised correlation)
    const Ls = [lum(pixels(A, W, H, 2).img.data), lum(pixels(A, W, H).img.data)];
    const Os = [lum(pixels(O, ow, oh, 2).img.data), lum(pixels(O, ow, oh).img.data)];
    const pts = [], st = Math.max(4, Math.round(Math.sqrt(ow * oh / 6000)));
    for (let v = Math.round(oh * 0.05); v < oh * 0.95; v += st) for (let u = Math.round(ow * 0.05); u < ow * 0.95; u += st) {
      const i = v * ow + u, gx = Os[1][i + 1] - Os[1][i - 1], gy = Os[1][i + ow] - Os[1][i - ow]; pts.push([u, v, gx * gx + gy * gy]);
    }
    const gmed = med(pts.map((p) => p[2])), tex = pts.filter((p) => p[2] > gmed);
    const ncc = (L, Ov, dx, dy, s, P) => {
      let s1 = 0, s2 = 0, so = 0, so2 = 0, sod = 0; const cx = ecx + dx, cy = ecy + dy;
      for (const [u, v] of P) {
        const x = cx + (u - ow / 2) * s, y = cy + (v - oh / 2) * s, x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0;
        if (x0 < 0 || y0 < 0 || x0 >= W - 1 || y0 >= H - 1) continue;
        const i = y0 * W + x0, a = L[i] + (L[i + 1] - L[i]) * fx, b = L[i + W] + (L[i + W + 1] - L[i + W]) * fx, dv = a + (b - a) * fy, o = Ov[v * ow + u];
        s1 += dv; s2 += dv * dv; so += o; so2 += o * o; sod += o * dv;
      }
      const n = P.length, cov = sod / n - (so / n) * (s1 / n), vd = s2 / n - (s1 / n) ** 2, vo = so2 / n - (so / n) ** 2;
      return cov / Math.sqrt(Math.max(1e-9, vd * vo));
    };
    if (tex.length < 200) return { matched: false, why: 'the picture is too plain to find' };
    const P1 = tex.filter((_, i) => i % Math.ceil(tex.length / 1500) === 0), P2 = tex.filter((_, i) => i % Math.ceil(tex.length / 4000) === 0);
    const Rx = Math.round(0.035 * W), Ry = Math.round(0.035 * H);
    let best = { c: -2 };
    for (let s = 0.95; s <= 1.0201; s += 0.004) for (let dy = -Ry; dy <= Ry; dy += 3) for (let dx = -Rx; dx <= Rx; dx += 3) {
      const c = ncc(Ls[0], Os[0], dx, dy, s, P1); if (c > best.c) best = { c, dx, dy, s };
    }
    let fine = { c: -2 };
    for (let s = best.s - 0.004; s <= best.s + 0.0041; s += 0.001) for (let dy = best.dy - 3; dy <= best.dy + 3; dy += 0.5) for (let dx = best.dx - 3; dx <= best.dx + 3; dx += 0.5) {
      const c = ncc(Ls[1], Os[1], dx, dy, s, P2); if (c > fine.c) fine = { c, dx, dy, s };
    }
    if (fine.c < 0.8) return { matched: false, why: `the picture didn't come back recognisably (match ${fine.c.toFixed(2)})` };

    // 2. paste the original back exactly where it came back, keeping the model's version to compare with
    const bw = ow * fine.s, bh = oh * fine.s, bx = ecx + fine.dx - bw / 2, by = ecy + fine.dy - bh / 2;
    const base = pixels(A, W, H), raw = base.img.data.slice();
    base.g.drawImage(O, bx, by, bw, bh);
    const img = base.g.getImageData(0, 0, W, H), d = img.data;
    const L = Math.ceil(bx), T = Math.ceil(by), Rr = Math.floor(bx + bw) - 1, B = Math.floor(by + bh) - 1;   // whole pixels of the original

    // 3. how far the model moved the colours at each edge: the original minus the model's version in the 6 px just
    //    inside it (the rim the model repainted along with the margin), as a median across those px and a running
    //    median along the side, so objects and small redraws don't count. The margin takes that shift at the edge,
    //    easing within ~50 px to the side's overall shift (so a light pool on the edge isn't carried out as a beam),
    //    each side's blending into the corners.
    const edge = { left: L, top: T, right: Rr, bottom: B };
    const vert = (s) => s === 'left' || s === 'right', into = (s) => (s === 'left' || s === 'top' ? 1 : -1), len = (s) => (vert(s) ? W : H);
    const at = (s, k, t) => (vert(s) ? (t * W + edge[s] + into(s) * k) * 4 : ((edge[s] + into(s) * k) * W + t) * 4);
    const sides = Object.keys(edge).filter((s) => (into(s) > 0 ? edge[s] : len(s) - 1 - edge[s]) >= 16);
    const span = (s) => (vert(s) ? [Math.max(0, T), Math.min(H - 1, B)] : [Math.max(0, L), Math.min(W - 1, Rr)]);
    const shift = {}, info = {};
    for (const s of sides) {
      const [a0, a1] = span(s), n = a1 - a0 + 1, per = [0, 1, 2].map(() => new Float32Array(n));
      for (let t = a0; t <= a1; t++) for (let ch = 0; ch < 3; ch++) {
        const v = []; for (let k = 1; k <= 6; k++) { const o = at(s, k, t) + ch; v.push(d[o] - raw[o]); }
        v.sort((p, q) => p - q); per[ch][t - a0] = (v[2] + v[3]) / 2;
      }
      const R = 40, sm = per.map(() => new Float32Array(n));
      for (let i = 0; i < n; i++) for (let ch = 0; ch < 3; ch++) {
        const v = []; for (let j = Math.max(0, i - R); j <= Math.min(n - 1, i + R); j += 2) v.push(per[ch][j]);
        v.sort((p, q) => p - q); sm[ch][i] = v[v.length >> 1];
      }
      const whole = sm.map((c) => med(c));
      shift[s] = { a0, a1, sm, whole };
      info[s] = { shift: whole.map((v) => Math.round(v * 10) / 10) };
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (x >= L && x <= Rr && y >= T && y <= B) continue;
      let ws = 0; const cc = [0, 0, 0];
      for (const s of sides) {
        const { a0, a1, sm } = shift[s], t = Math.max(a0, Math.min(a1, vert(s) ? y : x));
        const lx = vert(s) ? edge[s] - into(s) * 0.5 : t, ly = vert(s) ? t : edge[s] - into(s) * 0.5;
        const dd = (x - lx) ** 2 + (y - ly) ** 2, w = 1 / ((dd + 1) * (dd + 1)), near = Math.exp(-Math.sqrt(dd) / 48); ws += w;
        for (let ch = 0; ch < 3; ch++) cc[ch] += w * (shift[s].whole[ch] + (sm[ch][t - a0] - shift[s].whole[ch]) * near);
      }
      const o = (y * W + x) * 4; for (let ch = 0; ch < 3; ch++) d[o + ch] = Math.max(0, Math.min(255, d[o + ch] + cc[ch] / ws));
    }
    // 4. what is left on the line itself (the pasted edge's half pixel, a faint line): its median profile across the
    //    side against a straight ramp from 5 px out to 5 px in, flattened all along the side
    for (const s of sides) {
      const [a0, a1] = span(s), ts = []; for (let t = a0 + 8; t <= a1 - 8; t += 2) ts.push(t);
      const fix = [];
      for (let k = -4; k <= 4; k++) {
        const dev = [0, 1, 2].map((ch) => med(ts.map((t) => { const lo = d[at(s, -5, t) + ch], hi = d[at(s, 5, t) + ch]; return d[at(s, k, t) + ch] - (lo + (hi - lo) * (k + 5) / 10); })));
        if (Math.max(...dev.map(Math.abs)) >= 1) fix.push([k, dev]);
      }
      for (const [k, dev] of fix) for (let t = a0; t <= a1; t++) { const o = at(s, k, t); for (let ch = 0; ch < 3; ch++) d[o + ch] = Math.max(0, Math.min(255, d[o + ch] - dev[ch])); }
      info[s].line = fix.length ? Math.round(Math.max(...fix.map(([, v]) => Math.max(...v.map(Math.abs))))) : 0;
    }
    base.g.putImageData(img, 0, 0);
    return { matched: true, score: Math.round(fine.c * 1000) / 1000, data: base.c.toDataURL('image/png'), box: [L, T, Rr - L + 1, B - T + 1], put: [Math.round(ecx - ew / 2), Math.round(ecy - eh / 2), ow, oh], sides: info };
  }, { src: uri(file), orig: uri(original), box, loadSrc: load.toString() }));
  if (res.matched) save(res.data, out);
  delete res.data; return res;
}

/* Scale and centre-crop a picture to exactly [W, H] (an edit model may hand back its own size). */
export async function fitTo(browser, file, out, [W, H]) {
  const res = await withPage(browser, (page) => page.evaluate(async ({ src, W, H }) => {
    const im = new Image(); im.src = src; await im.decode();
    if (im.naturalWidth === W && im.naturalHeight === H) return null;
    const k = Math.max(W / im.naturalWidth, H / im.naturalHeight), w = im.naturalWidth * k, h = im.naturalHeight * k;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
    g.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
    return { data: c.toDataURL('image/png'), from: [im.naturalWidth, im.naturalHeight] };
  }, { src: uri(file), W, H }));
  if (res) save(res.data, out);
  return res && res.from;
}

/* The blind row's files: each cropped by a share of its own height top and bottom, resized to one width and
   re-encoded, so size, shape, metadata and the lockup give nothing away. */
export async function blindTiles(browser, files, outs, { crop = 0.12, width = 720 } = {}) {
  await withPage(browser, async (page) => {
    for (let i = 0; i < files.length; i++) {
      const data = await page.evaluate(async ({ src, crop, width }) => {
        const im = new Image(); im.src = src; await im.decode();
        const sy = Math.round(im.naturalHeight * crop), sh = im.naturalHeight - 2 * sy, h = Math.round(sh * width / im.naturalWidth);
        const c = document.createElement('canvas'); c.width = width; c.height = h; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
        g.drawImage(im, 0, sy, im.naturalWidth, sh, 0, 0, width, h);
        return c.toDataURL('image/jpeg', 0.88);
      }, { src: uri(files[i]), crop, width });
      save(data, outs[i]);
    }
  });
}

/* A seam view: the picture with its colour differences from the median stretched x5, so a step of 2-5 levels (which
   reads at 100% on a plain ground but hides in a preview) shows as an edge. Ticks mark where the old picture was put. */
export async function seamView(browser, file, out, box) {
  const res = await withPage(browser, (page) => page.evaluate(async ({ src, box, loadSrc }) => {
    const load = new Function(`return ${loadSrc}`)();
    const im = await load(src); const W = 900, H = Math.round(900 * im.naturalHeight / im.naturalWidth);
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, W, H);
    const img = g.getImageData(0, 0, W, H), d = img.data, m = [0, 1, 2].map((ch) => { const v = []; for (let i = ch; i < d.length; i += 16) v.push(d[i]); v.sort((p, q) => p - q); return v[v.length >> 1]; });
    // busy 8 px blocks (the subject, texture) are muted towards grey, so the eye goes to the plain ground, where a
    // seam shows; a seam's own step is a few levels and never counts as busy
    const B = 8, bw = Math.ceil(W / B), busy = new Uint8Array(bw * Math.ceil(H / B));
    for (let by = 0; by < H; by += B) for (let bx = 0; bx < W; bx += B) {
      let s = 0, s2 = 0, n = 0;
      for (let y = by; y < Math.min(H, by + B); y++) for (let x = bx; x < Math.min(W, bx + B); x++) { const o = (y * W + x) * 4, l = 0.2126 * d[o] + 0.7152 * d[o + 1] + 0.0722 * d[o + 2]; s += l; s2 += l * l; n++; }
      busy[(by / B) * bw + bx / B] = Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2)) > 10 ? 1 : 0;
    }
    for (let i = 0; i < d.length; i += 4) {
      const p = i / 4, mute = busy[Math.floor(Math.floor(p / W) / B) * bw + Math.floor((p % W) / B)] ? 0.25 : 1;
      for (let ch = 0; ch < 3; ch++) d[i + ch] = Math.max(0, Math.min(255, 128 + (d[i + ch] - m[ch]) * 5 * mute));
    }
    g.putImageData(img, 0, 0);
    if (box) {
      const [x, y, w, h] = [box[0] * W, box[1] * H, box[2] * W, box[3] * H]; g.strokeStyle = '#ffd400'; g.lineWidth = 2;
      for (const [cx, cy, sx, sy] of [[x, y, -1, -1], [x + w, y, 1, -1], [x, y + h, -1, 1], [x + w, y + h, 1, 1]]) {
        g.beginPath(); g.moveTo(cx + sx * 4, cy + sy * 22); g.lineTo(cx + sx * 4, cy + sy * 4); g.lineTo(cx + sx * 22, cy + sy * 4); g.stroke();
      }
    }
    return c.toDataURL('image/png');
  }, { src: uri(file), box, loadSrc: load.toString() }));
  save(res, out);
}

/* box: [x, y, w, h] as fractions of the original (0..1) or pixels; feather in pixels of the original. */
export async function compositeBox(browser, original, edited, box, out, feather = 24) {
  const res = await withPage(browser, (page) => page.evaluate(async ({ a, b, box, feather }) => {
    const load = async (s) => { const im = new Image(); im.src = s; await im.decode(); return im; };
    const A = await load(a), B = await load(b), W = A.naturalWidth, H = A.naturalHeight;
    const px = box.every((v) => v <= 1) ? [box[0] * W, box[1] * H, box[2] * W, box[3] * H] : box;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    x.drawImage(A, 0, 0);
    const m = document.createElement('canvas'); m.width = W; m.height = H; const mx = m.getContext('2d');
    mx.filter = `blur(${feather}px)`; mx.fillStyle = '#fff';
    mx.fillRect(px[0] + feather, px[1] + feather, Math.max(1, px[2] - 2 * feather), Math.max(1, px[3] - 2 * feather));
    // the edit may come back at a slightly different shape: cover-fit it, centred, rather than stretch it
    const k = Math.max(W / B.naturalWidth, H / B.naturalHeight), bw = B.naturalWidth * k, bh = B.naturalHeight * k;
    mx.filter = 'none'; mx.globalCompositeOperation = 'source-in'; mx.drawImage(B, (W - bw) / 2, (H - bh) / 2, bw, bh);
    x.drawImage(m, 0, 0);
    return { data: c.toDataURL('image/png'), box: px.map(Math.round) };
  }, { a: uri(original), b: uri(edited), box, feather }));
  save(res.data, out);
  return res.box;
}
