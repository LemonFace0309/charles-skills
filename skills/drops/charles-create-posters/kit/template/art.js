/* Drawing helpers for posters whose picture is made in code: pixel mosaics (Nu, BlackRock), type textures that draw a
   shape (Palantir Q2 2026), halftone portraits (Alphabet Q4 2025, Meta Q4 2025) and dithering.
   Load before finish.js and register work in window.posterSteps:

     <canvas id="art" class="fill"></canvas>
     <script src="/kit/art.js"></script>
     <script>
       posterSteps.push(async () => {
         const c = Art.canvas('#art');                         // sized to its box at 2x
         const src = await Art.image('pic/mountain.png');
         Art.pixelate(c, src, { cols: 22, palette: ['#ff3b1f', '#ffffff', '#f2a7c3', '#7b4fc9', '#ffc61a', '#0f7a3c', '#0b0b0b'] });
       });
     </script>
     <script src="/kit/finish.js"></script>

   Every helper draws into a canvas you pass and returns it. Colours are any CSS colour strings. Sources are anything
   drawImage accepts (an <img>, a canvas, an ImageBitmap). */
window.posterSteps = window.posterSteps || [];
window.Art = (() => {
  const DPR = 2;

  function canvas(sel) {
    const c = typeof sel === 'string' ? document.querySelector(sel) : sel;
    const r = c.getBoundingClientRect();
    c.width = Math.round(r.width * DPR); c.height = Math.round(r.height * DPR);
    return c;
  }

  async function image(src) { const im = new Image(); im.src = src; await im.decode(); return im; }

  /* An SVG (a logo, a shape) as a bitmap at a given width, for masks. */
  async function svgImage(src, width) {
    const im = await image(src);
    const c = document.createElement('canvas');
    c.width = width; c.height = Math.round(width * im.naturalHeight / im.naturalWidth);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    return c;
  }

  function rgb(color) {
    const c = document.createElement('canvas').getContext('2d');
    c.fillStyle = color; c.fillRect(0, 0, 1, 1);
    const d = c.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]];
  }
  function lin(v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function oklab([r, g, b]) {
    r = lin(r); g = lin(g); b = lin(b);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
  }
  function nearest(px, pal) {
    const p = oklab(px); let best = 0, bd = Infinity;
    pal.forEach((q, i) => { const d = (p[0] - q.lab[0]) ** 2 + (p[1] - q.lab[1]) ** 2 + (p[2] - q.lab[2]) ** 2; if (d < bd) { bd = d; best = i; } });
    return pal[best];
  }
  function palette(colors) { return colors.map((c) => { const v = rgb(c); return { css: c, rgb: v, lab: oklab(v) }; }); }

  /* Sample a source into a cols x rows grid (cover-fit), one RGB per cell. */
  function sample(src, cols, rows, fit = 'cover') {
    const t = document.createElement('canvas'); t.width = cols; t.height = rows;
    const x = t.getContext('2d', { willReadFrequently: true });
    const sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height;
    const s = fit === 'cover' ? Math.max(cols / sw, rows / sh) : Math.min(cols / sw, rows / sh);
    x.imageSmoothingQuality = 'high';
    x.drawImage(src, (cols - sw * s) / 2, (rows - sh * s) / 2, sw * s, sh * s);
    return x.getImageData(0, 0, cols, rows).data;
  }

  /* Pixel mosaic in a fixed palette. cols sets the grid; rows follow the canvas shape. gap (px at 1x) leaves a seam
     between squares; transparent cells (alpha < 0.5 in the source) stay empty. */
  function pixelate(c, src, { cols = 24, palette: colors, gap = 0, fit = 'cover' } = {}) {
    const pal = palette(colors);
    const cell = c.width / cols, rows = Math.round(c.height / cell);
    const d = sample(src, cols, rows, fit), ctx = c.getContext('2d');
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const o = (y * cols + x) * 4; if (d[o + 3] < 128) continue;
      ctx.fillStyle = nearest([d[o], d[o + 1], d[o + 2]], pal).css;
      ctx.fillRect(Math.round(x * cell + gap), Math.round(y * cell + gap), Math.ceil(cell - 2 * gap), Math.ceil(cell - 2 * gap));
    }
    return c;
  }

  /* Text repeated in a monospace grid; each character cell draws only where the mask is dark (or light, with
     invert), so the words draw the shape. Use a logo SVG or a silhouette as the mask. */
  function typeTexture(c, mask, { text = 'TEXT ', font = '500 22px "Plex Mono"', cell = 26, lineHeight = 30, color = '#888',
      threshold = 0.5, invert = false, fade = 0, fit = 'contain' } = {}) {
    const ctx = c.getContext('2d');
    ctx.font = font.replace(/(\d+)px/, (_, n) => `${n * DPR}px`); ctx.fillStyle = color; ctx.textBaseline = 'top';
    const cw = cell * DPR, lh = lineHeight * DPR, cols = Math.floor(c.width / cw), rows = Math.floor(c.height / lh);
    const m = mask ? sample(mask, cols, rows, fit) : null; let k = 0;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++, k++) {
      const ch = text[k % text.length]; if (ch === ' ') continue;
      let on = true, a = 1;
      if (m) { const o = (y * cols + x) * 4; const lum = (m[o] * 0.2126 + m[o + 1] * 0.7152 + m[o + 2] * 0.0722) / 255 * (m[o + 3] / 255) + (1 - m[o + 3] / 255);
        const v = invert ? lum : 1 - lum; on = v >= threshold; if (fade) a = Math.max(0, Math.min(1, (v - threshold) / fade + 0.25)); }
      if (!on) continue;
      ctx.globalAlpha = a; ctx.fillText(ch, x * cw, y * lh);
    }
    ctx.globalAlpha = 1; return c;
  }

  /* Halftone: dots (or lines) whose size follows darkness, at an angle, in one ink on the canvas's ground. */
  function halftone(c, src, { cell = 9, angle = 45, ink = '#111', ground = null, shape = 'dot', gamma = 1, contrast = 1, fit = 'cover' } = {}) {
    const ctx = c.getContext('2d'); const W = c.width, H = c.height, step = cell * DPR;
    if (ground) { ctx.fillStyle = ground; ctx.fillRect(0, 0, W, H); }
    const t = document.createElement('canvas'); t.width = W / 4 | 0; t.height = H / 4 | 0;
    const tx = t.getContext('2d', { willReadFrequently: true });
    const sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height;
    const s = fit === 'cover' ? Math.max(t.width / sw, t.height / sh) : Math.min(t.width / sw, t.height / sh);
    tx.drawImage(src, (t.width - sw * s) / 2, (t.height - sh * s) / 2, sw * s, sh * s);
    const d = tx.getImageData(0, 0, t.width, t.height).data;
    const lumAt = (x, y) => { const xi = Math.max(0, Math.min(t.width - 1, x / 4 | 0)), yi = Math.max(0, Math.min(t.height - 1, y / 4 | 0));
      const o = (yi * t.width + xi) * 4; if (d[o + 3] < 20) return 1; return (d[o] * 0.2126 + d[o + 1] * 0.7152 + d[o + 2] * 0.0722) / 255; };
    const a = angle * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), R = Math.hypot(W, H);
    ctx.fillStyle = ink; ctx.strokeStyle = ink;
    for (let v = -R; v < R; v += step) for (let u = -R; u < R; u += step) {
      const x = W / 2 + u * ca - v * sa, y = H / 2 + u * sa + v * ca;
      if (x < -step || y < -step || x > W + step || y > H + step) continue;
      let dark = 1 - lumAt(x, y); dark = Math.max(0, Math.min(1, (dark - 0.5) * contrast + 0.5)); dark = Math.pow(dark, gamma);
      if (dark < 0.02) continue;
      if (shape === 'line') { ctx.lineWidth = dark * step * 0.95; ctx.beginPath(); ctx.moveTo(x - ca * step / 2, y - sa * step / 2); ctx.lineTo(x + ca * step / 2, y + sa * step / 2); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(x, y, Math.sqrt(dark) * step * 0.62, 0, Math.PI * 2); ctx.fill(); }
    }
    return c;
  }

  /* Error-diffusion (Atkinson) or ordered (Bayer 4x4) dither into a palette, drawn at `pixel` px per dot. */
  function dither(c, src, { palette: colors, pixel = 3, kind = 'atkinson', fit = 'cover' } = {}) {
    const pal = palette(colors), p = pixel * DPR, cols = Math.ceil(c.width / p), rows = Math.ceil(c.height / p);
    const d = sample(src, cols, rows, fit), buf = new Float32Array(cols * rows * 3);
    for (let i = 0; i < cols * rows; i++) { buf[i * 3] = d[i * 4]; buf[i * 3 + 1] = d[i * 4 + 1]; buf[i * 3 + 2] = d[i * 4 + 2]; }
    const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const ctx = c.getContext('2d');
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 3; let px = [buf[i], buf[i + 1], buf[i + 2]];
      if (kind === 'bayer') { const b = (bayer[(y % 4) * 4 + (x % 4)] / 16 - 0.5) * 64; px = px.map((v) => v + b); }
      const q = nearest(px.map((v) => Math.max(0, Math.min(255, v))), pal);
      ctx.fillStyle = q.css; ctx.fillRect(x * p, y * p, p, p);
      if (kind === 'atkinson') {
        const e = [0, 1, 2].map((k) => (px[k] - q.rgb[k]) / 8);
        for (const [dx, dy] of [[1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]]) {
          const xx = x + dx, yy = y + dy; if (xx < 0 || xx >= cols || yy >= rows) continue;
          const j = (yy * cols + xx) * 3; buf[j] += e[0]; buf[j + 1] += e[1]; buf[j + 2] += e[2];
        }
      }
    }
    return c;
  }

  /* Seeded random for hand-placed scatter (roaches, tags, confetti): Art.random(seed)() returns 0..1. */
  function random(s = 1) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  return { canvas, image, svgImage, pixelate, typeTexture, halftone, dither, random, palette };
})();
