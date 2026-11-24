// Anti-aliasing demos. A shape is rendered at 16x the grid's resolution, then each pixel's colour comes from that:
// one check at its centre (aliased), an n x n grid of checks (supersampled), or the average of everything (coverage).
(() => {
  const W = 560, H = 380, SUB = 16;
  const PAPER = '#FFFFFF', INK = '17,19,24', ACCENT = '#2F55F4';

  function drawShape(ctx, shape, w, h, turn = 0) {
    ctx.save();
    if (shape === 'circle') {
      ctx.beginPath(); ctx.lineWidth = h * 0.075; ctx.arc(w / 2, h / 2, h * 0.31, 0, Math.PI * 2); ctx.stroke();
    } else if (shape === 'letter') {
      ctx.font = `700 ${h * 0.86}px -apple-system, "Helvetica Neue", Arial, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('a', w / 2, h * 0.47);
    } else if (shape === 'motion') {
      ctx.translate(w / 2, h / 2); ctx.rotate(-0.42 + turn);
      ctx.fillRect(-w * 0.44, -h * 0.13, w * 0.88, h * 0.075);       // a thick bar
      ctx.fillRect(-w * 0.44, h * 0.1, w * 0.88, h * 0.012);         // a wire thinner than a pixel
    } else {
      ctx.translate(w / 2, h / 2); ctx.rotate(-0.36 + turn); ctx.fillRect(-w * 0.43, -h * 0.045, w * 0.86, h * 0.09);
    }
    ctx.restore();
  }

  // The shape's alpha at SUB x SUB points inside every pixel of a cols x rows grid laid over a w x h picture.
  const off = document.createElement('canvas');
  function rasterize(shape, cols, rows, w, h, turn) {
    const cell = w / cols, ow = cols * SUB, oh = rows * SUB;
    off.width = ow; off.height = oh;
    const o = off.getContext('2d', { willReadFrequently: true });
    o.clearRect(0, 0, ow, oh); o.fillStyle = o.strokeStyle = '#000';
    o.save(); o.scale(SUB / cell, SUB / cell); drawShape(o, shape, w, h, turn); o.restore();
    return { a: o.getImageData(0, 0, ow, oh).data, ow };
  }
  const alphaAt = (g, cx, cy, x, y) => g.a[((cy * SUB + y) * g.ow + cx * SUB + x) * 4 + 3];
  const spots = (n) => Array.from({ length: n * n }, (_, k) => [((k % n) + 0.5) / n, (Math.floor(k / n) + 0.5) / n]);

  function value(g, cx, cy, mode, n) {
    if (mode === 'coverage') {
      let s = 0; for (let y = 0; y < SUB; y++) for (let x = 0; x < SUB; x++) s += alphaAt(g, cx, cy, x, y);
      return s / (255 * SUB * SUB);
    }
    const pts = spots(mode === 'aliased' ? 1 : n);
    let hit = 0; for (const [fx, fy] of pts) if (alphaAt(g, cx, cy, Math.floor(fx * SUB), Math.floor(fy * SUB)) > 127) hit++;
    return hit / pts.length;
  }

  function paint(ctx, w, h, st, turn = 0) {
    const cols = st.cols, cell = w / cols, rows = Math.ceil(h / cell);
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, w, h);
    if (st.mode === 'ideal') {
      ctx.fillStyle = ctx.strokeStyle = `rgb(${INK})`; drawShape(ctx, st.shape, w, h, turn);
      grid(ctx, w, h, cell, rows, 0.07);
      return null;
    }
    const g = rasterize(st.shape, cols, rows, w, h, turn);
    const vals = [];
    for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
      const v = value(g, cx, cy, st.mode, st.n); vals.push(v);
      if (v > 0) { ctx.fillStyle = `rgba(${INK},${v})`; ctx.fillRect(cx * cell, cy * cell, cell + 0.5, cell + 0.5); }
    }
    grid(ctx, w, h, cell, rows, cols > 32 ? 0.05 : 0.11);
    if (st.showEdge) { ctx.save(); ctx.strokeStyle = ACCENT; ctx.globalAlpha = 0.9; ctx.lineWidth = 1.5; outline(ctx, st.shape, w, h, turn); ctx.restore(); }
    if (st.showSamples && st.mode !== 'coverage') {
      const pts = spots(st.mode === 'aliased' ? 1 : st.n), r = Math.max(1.6, Math.min(4.5, cell / (st.mode === 'aliased' ? 6 : 3 * st.n)));
      for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) for (const [fx, fy] of pts) {
        const inside = alphaAt(g, cx, cy, Math.floor(fx * SUB), Math.floor(fy * SUB)) > 127;
        ctx.beginPath(); ctx.arc((cx + fx) * cell, (cy + fy) * cell, r, 0, Math.PI * 2);
        if (inside) { ctx.fillStyle = ACCENT; ctx.fill(); } else { ctx.strokeStyle = ACCENT; ctx.lineWidth = 1; ctx.globalAlpha = 0.28; ctx.stroke(); ctx.globalAlpha = 1; }
      }
    }
    return { vals, cols, rows };
  }

  function grid(ctx, w, h, cell, rows, alpha) {
    ctx.save(); ctx.strokeStyle = `rgba(${INK},${alpha})`; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= w + 0.5; x += cell) { ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, h); }
    for (let y = 0; y <= rows * cell; y += cell) { ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(w, Math.round(y) + 0.5); }
    ctx.stroke(); ctx.restore();
  }

  // The real edge as a thin outline: draw the shape into a mask and stroke its boundary approximately.
  function outline(ctx, shape, w, h, turn) {
    ctx.save();
    if (shape === 'circle') { ctx.beginPath(); ctx.arc(w / 2, h / 2, h * 0.31 - h * 0.0375, 0, Math.PI * 2); ctx.arc(w / 2, h / 2, h * 0.31 + h * 0.0375, 0, Math.PI * 2); ctx.stroke(); }
    else if (shape === 'letter') { ctx.font = `700 ${h * 0.86}px -apple-system, "Helvetica Neue", Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.strokeText('a', w / 2, h * 0.47); }
    else { ctx.translate(w / 2, h / 2); ctx.rotate(-0.36 + turn); ctx.strokeRect(-w * 0.43, -h * 0.045, w * 0.86, h * 0.09); }
    ctx.restore();
  }

  learn.widget('pixels', (host, { options: o }) => {
    const st = { mode: o.mode || 'aliased', cols: o.cols || 18, shape: o.shape || 'line', n: o.samples || 1, showSamples: !!o.showSamples, showEdge: !!o.showEdge };
    let preview = null, last = null;
    const cv = learn.canvas(host, { width: W, height: H, draw: (ctx, w, h) => { last = paint(ctx, w, h, st); drawPreview(); } });
    if (o.preview) {
      const box = learn.el('div', 'w-caption'); box.style.cssText = 'display:flex;align-items:center;gap:12px';
      preview = learn.el('canvas'); preview.style.cssText = 'width:auto;border:1px solid var(--line);border-radius:4px;image-rendering:auto';
      box.append(preview, learn.el('span', null, 'Near real size')); host.appendChild(box);
    }
    function drawPreview() {
      if (!preview || !last) return;
      const s = 3, dpr = Math.min(window.devicePixelRatio || 1, 3);
      preview.width = last.cols * s * dpr; preview.height = last.rows * s * dpr; preview.style.width = `${last.cols * s}px`;
      const p = preview.getContext('2d'); p.setTransform(dpr, 0, 0, dpr, 0, 0); p.fillStyle = PAPER; p.fillRect(0, 0, last.cols * s, last.rows * s);
      last.vals.forEach((v, k) => { if (v > 0) { p.fillStyle = `rgba(${INK},${v})`; p.fillRect((k % last.cols) * s, Math.floor(k / last.cols) * s, s, s); } });
    }
    const row = learn.controls(host), ctl = {};
    const want = new Set(o.controls || []);
    if (want.has('pixelate')) ctl.pixelate = learn.toggle(row, { label: 'Draw it with pixels', value: st.mode !== 'ideal', onChange: (v) => { st.mode = v ? 'aliased' : 'ideal'; cv.redraw(); } });
    if (want.has('aa-toggle')) ctl.aa = learn.toggle(row, { label: 'Anti-aliasing', value: st.mode === 'coverage', onChange: (v) => { st.mode = v ? 'coverage' : 'aliased'; cv.redraw(); } });
    if (want.has('samples-seg')) ctl.seg = learn.segmented(row, { label: 'Samples per pixel', options: [{ label: '1', value: 1 }, { label: '4', value: 2 }, { label: '16', value: 4 }], value: st.n, onChange: (v) => { st.n = v; cv.redraw(); } });
    if (want.has('samples-toggle')) ctl.samples = learn.toggle(row, { label: 'Show where it checks', value: st.showSamples, onChange: (v) => { st.showSamples = v; cv.redraw(); } });
    if (want.has('edge')) ctl.edge = learn.toggle(row, { label: 'Show the real edge', value: st.showEdge, onChange: (v) => { st.showEdge = v; cv.redraw(); } });
    if (want.has('cols')) learn.slider(row, { label: 'Pixels across', min: 8, max: 48, step: 1, value: st.cols, onInput: (v) => { st.cols = v; cv.redraw(); } });
    if (want.has('shape')) learn.segmented(row, { options: [{ label: 'Line', value: 'line' }, { label: 'Circle', value: 'circle' }, { label: 'Letter', value: 'letter' }], value: st.shape, onChange: (v) => { st.shape = v; cv.redraw(); } });
    return {
      cue(name) {
        if (name === 'pixels') ctl.pixelate ? ctl.pixelate.set(true) : ((st.mode = 'aliased'), cv.redraw());
        if (name === 'samples') ctl.samples ? ctl.samples.set(true) : ((st.showSamples = true), cv.redraw());
        if (name === 'aa') ctl.aa ? ctl.aa.set(true) : ((st.mode = 'coverage'), cv.redraw());
        if (name === 'ss4') ctl.seg ? ctl.seg.set(2) : ((st.n = 2), cv.redraw());
        if (name === 'ss16') ctl.seg ? ctl.seg.set(4) : ((st.n = 4), cv.redraw());
      },
    };
  });

  learn.widget('motion', (host) => {
    const wrap = learn.el('div'); wrap.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px';
    host.appendChild(wrap);
    const mk = (label, mode) => {
      const box = learn.el('div'); wrap.appendChild(box);
      const st = { mode, cols: 30, shape: 'motion', n: 1 };
      const cv = learn.canvas(box, { width: 280, height: 220, draw: (ctx, w, h) => paint(ctx, w, h, st, turn) });
      box.appendChild(learn.el('p', 'w-caption', label));
      return cv;
    };
    let turn = 0;
    const left = mk('One check per pixel', 'aliased'), right = mk('Shaded by coverage', 'coverage');
    const anim = learn.animate((t) => { turn = Math.sin(t * 0.55) * 0.22; left.redraw(); right.redraw(); });
    const row = learn.controls(host);
    learn.toggle(row, { label: 'Moving', value: true, onChange: (v) => (v ? anim.start() : anim.stop()) });
    anim.start();
    return { cue(name) { if (name === 'move') anim.start(); }, destroy() { anim.stop(); } };
  });
})();
