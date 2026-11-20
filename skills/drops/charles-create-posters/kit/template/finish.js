/* Runs in the poster page. Sizes logo masks, waits for fonts and pictures, runs the poster's own drawing steps,
   then lays the finish over everything and sets window.__posterReady.

   On <main class="poster">:
     data-grain="film"   grain at the strength measured on the NVIDIA poster (sigma ~4/255 in its blacks, ~2 px clumps)
     data-grain="paper"  paper fibre, a faint mottle and fine grain, as on the Nu poster (sigma ~3/255 on its paper)
     data-grain="none"   clean, as on the Tesla poster's pure black
     data-grain-amount   multiplies the grain evenly (0.5 to 2 is the useful range). Left out, film grain is 1 where
                         the picture is dark and eases to 0.6 on its bright or strongly coloured areas (it was measured
                         on black; on colour the same specks read as salt and pepper); render says when it eased it
     data-dust           0 to 1: specks and a few hairs, light on dark grounds and dark on light ones (default 0). Only on
                         pictures meant to look like scanned film; on a clean studio shot it reads as dirt
     data-seed           any integer, to repeat a render exactly; left out, it comes from the poster's words

   Logos: <span class="mark" data-logo="logo/company.svg"></span> becomes a flat silhouette in the text colour,
   its width taken from the file's aspect ratio. White in a logo file means paper (a white box behind it, white
   details), so it's knocked out rather than printed as solid ink. Add data-logo-color="original" to keep the file's
   own colours.

   Drawing steps: push async functions to window.posterSteps before this script runs; they run after fonts and
   images are ready and before the finish (see art.js). */
(() => {
  const poster = document.querySelector('.poster');
  const DPR = 2;
  const notes = (window.__posterNotes = window.__posterNotes || []);
  // Without data-seed, the seed comes from the poster's own words, so two posters never share grain or dust specks
  // (identical specks across a series are a template tell).
  const words = [...document.querySelectorAll('.copy, .title, .wordmark')].map((e) => e.textContent).join('|') + location.pathname;
  let h = 2166136261; for (let i = 0; i < words.length; i++) { h ^= words.charCodeAt(i); h = Math.imul(h, 16777619); }
  const seed = poster.dataset.seed ? Number(poster.dataset.seed) : (h >>> 0) % 100000;

  function rng(s) {               // mulberry32
    let a = s >>> 0;
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  async function sizeLogos() {
    for (const el of document.querySelectorAll('[data-logo]')) {
      const src = new URL(el.dataset.logo, location.href).href;   // absolute: CSS would resolve it against system.css
      let ratio = 0;
      try {
        if (/\.svg($|\?)/i.test(src)) {
          const txt = await (await fetch(src)).text();
          const vb = txt.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
          const w = txt.match(/<svg[^>]*\swidth\s*=\s*["']([\d.]+)/i), h = txt.match(/<svg[^>]*\sheight\s*=\s*["']([\d.]+)/i);
          if (vb) ratio = parseFloat(vb[1]) / parseFloat(vb[2]); else if (w && h) ratio = parseFloat(w[1]) / parseFloat(h[1]);
        }
        if (!ratio) { const im = new Image(); im.src = src; await im.decode(); ratio = im.naturalWidth / im.naturalHeight; }
      } catch (e) { console.warn('logo failed', src, e); ratio = 3; }
      const h = el.getBoundingClientRect().height || parseFloat(getComputedStyle(el).height) || 28;
      el.style.width = `${(h * ratio).toFixed(2)}px`;
      if (el.dataset.logoColor === 'original') {
        el.style.background = `url("${src}") center / contain no-repeat`;
        el.style.webkitMask = 'none'; el.style.mask = 'none';
      } else {
        const knockout = (el.dataset.logoKnockout || '').split(',').map((x) => x.trim().replace('#', '')).filter((x) => /^[0-9a-f]{6}$/i.test(x)).map((x) => [0, 2, 4].map((j) => parseInt(x.slice(j, j + 2), 16)));
        const k = await prepareLogo(src, h, ratio, el.dataset.logoKeepMarks !== undefined, knockout).catch(() => null);
        el.style.setProperty('--src', `url("${k ? k.url : src}")`);
        if (k) {
          el.style.width = `${(h * k.ratio).toFixed(2)}px`;
          notes.push(`logo ${el.dataset.logo}: ${[k.knocked && `${el.dataset.logoKnockout ? 'white and ' + el.dataset.logoKnockout : 'white'} parts knocked out (${k.knocked}% of it; they read as paper)`, k.mark && 'a ® or ™ taken off its top right', k.trimmed && 'trimmed to its ink'].filter(Boolean).join(', ')}; check the lockup at 100%`);
        }
      }
    }
  }

  /* The mask prints every opaque pixel as ink, so a white box or white details would come out solid. Draw the logo
     at 4x and make near-white transparent, unless the logo is white all over (a reversed logo, fine as it is); then
     trim empty margins (from the box, or padding in the file), so --logo-h is the height of the ink itself. Returns
     null when the file needs neither. */
  async function prepareLogo(src, h, ratio, keepMarks, knockout = []) {
    const im = new Image(); im.src = src; await im.decode();
    // how much a pixel reads as paper: near-white always, and any colour named in data-logo-knockout
    const paperness = (r, g2, b) => {
      const mn = Math.min(r, g2, b), mx = Math.max(r, g2, b);
      let p = mx - mn < 30 ? Math.max(0, Math.min(1, (mn - 200) / 40)) : 0;
      for (const [kr, kg, kb] of knockout) p = Math.max(p, Math.max(0, Math.min(1, (70 - Math.hypot(r - kr, g2 - kg, b - kb)) / 30)));
      return p;
    };
    const H = Math.max(96, Math.round(h * DPR * 4)), W = Math.max(1, Math.round(H * ratio));
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, W, H);
    const id = g.getImageData(0, 0, W, H), d = id.data; let white = 0, ink = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8) continue;
      if (paperness(d[i], d[i + 1], d[i + 2]) > 0.5) white++; else ink++;
    }
    const total = W * H, knock = (knockout.length > 0 || white >= total * 0.002) && ink >= total * 0.02;
    if (knock) for (let i = 0; i < d.length; i += 4) {
      const p = paperness(d[i], d[i + 1], d[i + 2]);
      if (p) d[i + 3] = Math.round(d[i + 3] * (1 - p));
    }
    if (knock) g.putImageData(id, 0, 0);
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < x0) { console.warn(`logo ${src.split('/').pop()} draws nothing (an icon sheet of <symbol>s? take one with logo --url <file> --symbol <id>)`); return null; }
    // a ® or ™: small marks up at the top right, beside or over the last letter. They print as specks at lockup size,
    // so they come off: a ring with a hole (®), or two thin marks side by side (™). One solid dot stays, since it may
    // be the dot of an i. data-logo-keep-marks keeps them all
    let mark = false;
    if (!keepMarks) {
      const inkH = y1 - y0 + 1, inkW = x1 - x0 + 1, lab = new Int32Array(W * H).fill(-1), comps = [];
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i0 = y * W + x; if (lab[i0] >= 0 || d[i0 * 4 + 3] <= 8) continue;
        const c = { n: 0, bx0: x, bx1: x, by0: y, by1: y, px: [] }, st = [i0]; lab[i0] = comps.length;
        while (st.length) {
          const j = st.pop(), jx = j % W, jy = (j / W) | 0; c.n++; c.px.push(j);
          if (jx < c.bx0) c.bx0 = jx; if (jx > c.bx1) c.bx1 = jx; if (jy < c.by0) c.by0 = jy; if (jy > c.by1) c.by1 = jy;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const nx = jx + dx, ny = jy + dy; if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;
            const k = ny * W + nx; if (lab[k] < 0 && d[k * 4 + 3] > 8) { lab[k] = comps.length; st.push(k); }
          }
        }
        comps.push(c);
      }
      const total = comps.reduce((t, c) => t + c.n, 0);
      const small = comps.filter((c) => c.by1 - c.by0 + 1 <= inkH * 0.35 && c.bx1 - c.bx0 + 1 <= inkW * 0.12 && c.by1 <= y0 + inkH * 0.6 && c.bx1 >= x1 - inkW * 0.14 && c.n <= total * 0.03);
      const ringed = (c) => {   // background inside its box that the outside can't reach
        const w = c.bx1 - c.bx0 + 3, h = c.by1 - c.by0 + 3, own = new Set(c.px), seen = new Uint8Array(w * h), st = [0];
        const ink = (x, y) => own.has((y + c.by0 - 1) * W + (x + c.bx0 - 1)); let out = 1; seen[0] = 1;
        while (st.length) { const j = st.pop(), x = j % w, y = (j / w) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const k = ny * w + nx; if (!seen[k] && !ink(nx, ny)) { seen[k] = 1; out++; st.push(k); } } }
        return out + c.n < w * h - 4;
      };
      const thin = (c) => c.n / ((c.bx1 - c.bx0 + 1) * (c.by1 - c.by0 + 1)) < 0.7;   // a dot fills ~79% of its box, a letter stroke less
      const ring = small.find(ringed);
      const hit = ring ? small.filter((c) => c.bx0 >= ring.bx0 - 2 && c.bx1 <= ring.bx1 + 2 && c.by0 >= ring.by0 - 2 && c.by1 <= ring.by1 + 2)
        : small.filter(thin).length >= 2 ? small.filter(thin) : [];
      if (hit.length) {
        for (const c of hit) for (const j of c.px) d[j * 4 + 3] = 0;
        mark = true;
        x0 = W; y0 = H; x1 = -1; y1 = -1;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        g.putImageData(id, 0, 0);
      }
    }
    const padded = y0 > H * 0.03 || H - 1 - y1 > H * 0.03 || x0 > W * 0.03 || W - 1 - x1 > W * 0.03;
    if (!knock && !padded && !mark) return null;
    const t = document.createElement('canvas'); t.width = x1 - x0 + 1; t.height = y1 - y0 + 1;
    t.getContext('2d').drawImage(c, x0, y0, t.width, t.height, 0, 0, t.width, t.height);
    return { url: t.toDataURL('image/png'), knocked: knock ? Math.round((100 * white) / (white + ink)) : 0, trimmed: padded, mark, ratio: t.width / t.height };
  }

  /* Film grain was measured on black. On bright or strongly coloured areas the same specks read as salt and pepper,
     so its strength eases area by area: 1 on near-black and grey, down to 0.55 on bright, saturated colour (a dusk
     navy sky takes ~0.66, a red sweep 0.55). The map is the pictures drawn small where they sit, over the ground. */
  function grainMap(cols = 48) {
    const P = poster.getBoundingClientRect(), rows = Math.max(2, Math.round((cols * P.height) / P.width));
    const c = document.createElement('canvas'); c.width = cols; c.height = rows; const g = c.getContext('2d', { willReadFrequently: true });
    g.fillStyle = getComputedStyle(poster).backgroundColor; g.fillRect(0, 0, cols, rows);
    const sx = cols / P.width, sy = rows / P.height;
    for (const el of poster.querySelectorAll('.picture img, .picture canvas')) {
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      try {
        const X = (r.left - P.left) * sx, Y = (r.top - P.top) * sy, Wd = r.width * sx, Hd = r.height * sy;
        if (el.tagName === 'IMG' && getComputedStyle(el).objectFit === 'cover' && el.naturalWidth) {
          const k = Math.max(r.width / el.naturalWidth, r.height / el.naturalHeight), w = el.naturalWidth * k * sx, h = el.naturalHeight * k * sy;
          g.save(); g.beginPath(); g.rect(X, Y, Wd, Hd); g.clip(); g.drawImage(el, X + (Wd - w) / 2, Y + (Hd - h) / 2, w, h); g.restore();
        } else g.drawImage(el, X, Y, Wd, Hd);
      } catch { /* a picture the canvas can't read counts as ground */ }
    }
    const d = g.getImageData(0, 0, cols, rows).data, kk = new Float32Array(cols * rows); let eased = 0;
    for (let i = 0; i < kk.length; i++) {
      const mx = Math.max(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) / 255, mn = Math.min(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) / 255;
      const lit = Math.max(0, Math.min(1, (mx - 0.2) / 0.35)), col = Math.max(0, Math.min(1, (mx - mn - 0.15) / 0.3));
      kk[i] = Math.max(0.55, 1 - 0.4 * lit - 0.15 * col); if (kk[i] < 0.97) eased++;
    }
    return { k: kk, cols, rows, eased: eased / kk.length };
  }

  /* How bright and colourful the poster is, 0-1: the mean of each pixel's strongest channel over the pictures (the
     three biggest) and the ground. Dark grounds score under 0.25; a red, a sky or paper scores 0.6 or more. */
  function brightness() {
    const P = poster.getBoundingClientRect(), area = P.width * P.height;
    let covered = 0, sum = 0;
    const els = [...poster.querySelectorAll('.picture img, .picture canvas')].map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width * r.height > 0).sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height).slice(0, 3);
    for (const { el, r } of els) {
      const w = Math.max(0, Math.min(r.right, P.right) - Math.max(r.left, P.left)), h = Math.max(0, Math.min(r.bottom, P.bottom) - Math.max(r.top, P.top));
      const a = Math.min(w * h, area - covered); if (a <= 0) break;
      try {
        const c = document.createElement('canvas'); c.width = 48; c.height = 48; const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(el, 0, 0, 48, 48); const d = g.getImageData(0, 0, 48, 48).data; let s = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { s += Math.max(d[i], d[i + 1], d[i + 2]) / 255; n++; }
        if (n) { sum += (a * s) / n; covered += a; }
      } catch { /* a picture the canvas can't read counts as ground */ }
    }
    const bg = document.createElement('canvas').getContext('2d'); bg.fillStyle = getComputedStyle(poster).backgroundColor; bg.fillRect(0, 0, 1, 1);
    const [r, g2, b] = bg.getImageData(0, 0, 1, 1).data;
    return (sum + (area - covered) * (Math.max(r, g2, b) / 255)) / area;
  }

  function luminanceOf(color) {
    const c = document.createElement('canvas').getContext('2d');
    c.fillStyle = color; c.fillRect(0, 0, 1, 1);
    const [r, g, b] = c.getImageData(0, 0, 1, 1).data;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }

  function layer() {
    let f = poster.querySelector(':scope > .finish');
    if (!f) { f = document.createElement('div'); f.className = 'finish'; poster.appendChild(f); }
    return f;
  }

  function canvasLayer(blend, opacity = 1) {
    const W = poster.clientWidth, H = poster.clientHeight;
    const c = document.createElement('canvas');
    c.width = W * DPR; c.height = H * DPR;
    c.style.mixBlendMode = blend; c.style.opacity = opacity;
    layer().appendChild(c);
    return c;
  }

  /* Light and dark specks with alpha proportional to |noise|: on black it lifts, on paper it darkens, the way a
     print's grain reads. A bilinear "clump" octave plus a 1 px fine octave, normalised to unit variance, so k sets
     the strength. The defaults match the NVIDIA poster's blacks: sigma ~4/255, lag-1 correlation ~0.65. */
  function grain(amount, clump = 2.4, k = 0.029, fine = 0.26, map = null) {
    const c = canvasLayer('normal');
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height, r = rng(seed);
    const cw = Math.ceil(W / clump) + 2, ch = Math.ceil(H / clump) + 2;
    const C = new Float32Array(cw * ch);
    for (let i = 0; i < C.length; i++) C[i] = gauss(r);
    const wc = Math.sqrt(1 - fine * fine) / 0.67, wf = fine;      // 0.67: the std of a bilinear blend of unit noise
    const img = ctx.createImageData(W, H), d = img.data;
    for (let y = 0; y < H; y++) {
      const fy = y / clump, y0 = fy | 0, ty = fy - y0, row0 = y0 * cw, row1 = row0 + cw;
      for (let x = 0; x < W; x++) {
        const fx = x / clump, x0 = fx | 0, tx = fx - x0;
        const a0 = C[row0 + x0] + (C[row0 + x0 + 1] - C[row0 + x0]) * tx;
        const a1 = C[row1 + x0] + (C[row1 + x0 + 1] - C[row1 + x0]) * tx;
        const n = wc * (a0 + (a1 - a0) * ty) + wf * gauss(r);
        let m = 1;
        if (map) {   // bilinear in the strength map
          const gx = Math.min(map.cols - 1.001, (x / W) * map.cols - 0.5), gy = Math.min(map.rows - 1.001, (y / H) * map.rows - 0.5);
          const cx = Math.max(0, gx), cy = Math.max(0, gy), ix = cx | 0, iy = cy | 0, fx = cx - ix, fy = cy - iy, K = map.k, C = map.cols;
          m = (K[iy * C + ix] * (1 - fx) + K[iy * C + ix + 1] * fx) * (1 - fy) + (K[(iy + 1) * C + ix] * (1 - fx) + K[(iy + 1) * C + ix + 1] * fx) * fy;
        }
        const a = Math.min(1, Math.abs(n) * k * amount * m);
        const o = (y * W + x) * 4, v = n > 0 ? 255 : 0;
        d[o] = d[o + 1] = d[o + 2] = v; d[o + 3] = a * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  /* Paper tooth: fractal noise lit from the upper left (an embossed relief, like a scanned sheet), remapped so the
     flats stay white and only the valleys darken, plus a faint mottle and a fine grain. Defaults match the Nu
     poster's paper: sigma ~3/255, lag-1 correlation ~0.6; the multiply darkens the sheet ~6 levels, so set --field a
     touch lighter. */
  function paper(amount, freq = 0.42, relief = 1.6, depth = 0.05) {
    const W = poster.clientWidth, H = poster.clientHeight;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.innerHTML = `
      <filter id="tooth" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="4" seed="${seed}" result="n"/>
        <feDiffuseLighting in="n" surfaceScale="${relief}" lighting-color="#ffffff" result="lit"><feDistantLight azimuth="225" elevation="52"/></feDiffuseLighting>
        <feComponentTransfer><feFuncR type="linear" slope="1.32" intercept="-0.06"/><feFuncG type="linear" slope="1.32" intercept="-0.06"/><feFuncB type="linear" slope="1.32" intercept="-0.06"/></feComponentTransfer>
      </filter>
      <filter id="ridge" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="${(freq / 3.6).toFixed(4)}" numOctaves="3" seed="${seed + 7}" result="n"/>
        <feDiffuseLighting in="n" surfaceScale="${relief * 1.4}" lighting-color="#ffffff"><feDistantLight azimuth="225" elevation="52"/></feDiffuseLighting>
        <feComponentTransfer><feFuncR type="linear" slope="1.32" intercept="-0.06"/><feFuncG type="linear" slope="1.32" intercept="-0.06"/><feFuncB type="linear" slope="1.32" intercept="-0.06"/></feComponentTransfer>
      </filter>
      <filter id="mottle" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.0032" numOctaves="2" seed="${seed + 3}"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2 0 0 0 -0.8"/></filter>
      <rect width="${W}" height="${H}" filter="url(#tooth)" opacity="${Math.min(1, depth * amount).toFixed(3)}"/>
      <rect width="${W}" height="${H}" filter="url(#ridge)" opacity="${Math.min(1, depth * 0.5 * amount).toFixed(3)}"/>
      <rect width="${W}" height="${H}" filter="url(#mottle)" opacity="${(0.035 * amount).toFixed(3)}"/>`;
    svg.style.mixBlendMode = 'multiply';
    layer().appendChild(svg);
    grain(amount, 1.6, 0.007, 0.5);
  }

  function dust(amount, light) {
    const c = canvasLayer('normal');
    const ctx = c.getContext('2d'), r = rng(seed + 11), W = c.width, H = c.height;
    const col = light ? '255,255,255' : '20,16,12';
    const specks = Math.round(140 * amount), hairs = Math.round(7 * amount);
    for (let i = 0; i < specks; i++) {
      const x = r() * W, y = r() * H, rad = 0.6 + Math.pow(r(), 3) * 3.2;
      ctx.fillStyle = `rgba(${col},${(0.18 + r() * 0.5).toFixed(2)})`;
      ctx.beginPath(); ctx.ellipse(x, y, rad, rad * (0.6 + r() * 0.6), r() * Math.PI, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < hairs; i++) {
      const x = r() * W, y = r() * H, len = 18 + r() * 70, ang = r() * Math.PI * 2;
      ctx.strokeStyle = `rgba(${col},${(0.25 + r() * 0.35).toFixed(2)})`; ctx.lineWidth = 0.9 + r() * 0.8;
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + Math.cos(ang) * len * 0.4 + (r() - 0.5) * 30, y + Math.sin(ang) * len * 0.4 + (r() - 0.5) * 30,
        x + Math.cos(ang) * len * 0.8 + (r() - 0.5) * 30, y + Math.sin(ang) * len * 0.8 + (r() - 0.5) * 30,
        x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }
  }

  async function run() {
    await sizeLogos();
    await document.fonts.ready;
    // load every declared face, not only those already on screen, so drawing steps measure and draw with the real fonts
    await Promise.all([...document.fonts].map((f) => f.load().catch(() => {})));
    await Promise.all([...document.images].map((im) => (im.complete ? Promise.resolve() : im.decode()).catch(() => console.warn('image failed', im.src))));
    for (const step of window.posterSteps || []) await step();
    const kind = poster.dataset.grain || 'film';
    const amount = Number(poster.dataset.grainAmount || 1);
    let map = null;
    if (kind === 'film' && poster.dataset.grainAmount === undefined) {
      map = grainMap();
      if (map.eased > 0.02) notes.push(`film grain eased on the bright or colourful ${Math.round(map.eased * 100)}% of the poster (down to ${Math.min(...map.k).toFixed(2)}); set data-grain-amount for one even strength`);
      else map = null;
    }
    const num = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v !== undefined ? Number(v) : d);
    if (kind === 'film') grain(amount, num(poster.dataset.grainClump, 2.4), 0.029, num(poster.dataset.grainFine, 0.26), map);
    if (kind === 'paper') paper(amount, num(poster.dataset.paperFreq, 0.42), num(poster.dataset.paperRelief, 1.6), num(poster.dataset.paperDepth, 0.05));
    const d = Number(poster.dataset.dust || 0);
    if (d > 0) dust(d, luminanceOf(getComputedStyle(poster).backgroundColor) < 0.5);
    window.__posterReady = true;
  }
  run().catch((e) => { console.error('poster failed', e); window.__posterError = String(e && e.stack || e); window.__posterReady = true; });
})();
