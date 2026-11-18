// Helpers for a lesson's interactive pieces. A lesson's widgets.js registers each piece with learn.widget(name, fn);
// fn(host, api) builds it inside host and may return { cue(name), destroy() }. See references/widgets.md.
window.learn = (() => {
  const widgets = {};
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  // A crisp canvas at any screen density. draw(ctx, w, h) runs on every redraw(), in CSS pixels.
  function canvas(host, { width = 640, height = 400, draw }) {
    const c = el('canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    c.width = Math.round(width * dpr); c.height = Math.round(height * dpr);
    c.style.aspectRatio = `${width} / ${height}`;
    host.appendChild(c);
    const ctx = c.getContext('2d');
    const api = {
      el: c, ctx, width, height,
      redraw() { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height); draw(ctx, width, height); },
      // pointer position in canvas pixels
      point(ev) { const r = c.getBoundingClientRect(); return { x: (ev.clientX - r.left) * width / r.width, y: (ev.clientY - r.top) * height / r.height }; },
    };
    api.redraw();
    return api;
  }

  function controls(host) { const row = el('div', 'controls'); host.appendChild(row); return row; }

  function slider(host, { label, min = 0, max = 1, step = 0.01, value = min, format = (v) => v, onInput }) {
    const wrap = el('label', 'ctl'); const name = el('span', null, label);
    const input = el('input'); Object.assign(input, { type: 'range', min, max, step, value });
    const out = el('output', null, format(+value));
    input.addEventListener('input', () => { out.textContent = format(+input.value); onInput && onInput(+input.value); });
    wrap.append(name, input, out); host.appendChild(wrap);
    return { el: input, set(v) { input.value = v; out.textContent = format(+v); onInput && onInput(+v); } };
  }

  function toggle(host, { label, value = false, onChange }) {
    const b = el('button', 'switch'); b.type = 'button'; b.setAttribute('role', 'switch');
    const knob = el('span', 'knob'); b.append(knob, el('span', null, label));
    let on = !!value; b.setAttribute('aria-checked', on);
    const set = (v) => { on = !!v; b.setAttribute('aria-checked', on); onChange && onChange(on); };
    b.addEventListener('click', () => set(!on));
    host.appendChild(b);
    return { el: b, set, get: () => on };
  }

  function segmented(host, { label, options, value, onChange }) {
    const wrap = el('div', 'ctl'); if (label) wrap.appendChild(el('span', null, label));
    const seg = el('div', 'seg'); seg.setAttribute('role', 'group');
    let cur = value ?? options[0].value; const btns = [];
    const set = (v) => { cur = v; btns.forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === String(v))); onChange && onChange(v); };
    for (const o of options) { const b = el('button', null, o.label); b.type = 'button'; b.dataset.v = String(o.value); b.addEventListener('click', () => set(o.value)); btns.push(b); seg.appendChild(b); }
    btns.forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === String(cur)));
    wrap.appendChild(seg); host.appendChild(wrap);
    return { el: seg, set, get: () => cur };
  }

  function caption(host, text) { const p = el('p', 'w-caption', text); host.appendChild(p); return p; }

  // A looping animation: frame(t, dt) gets seconds since start. Stops itself when the widget is destroyed.
  function animate(frame) {
    let raf = 0, t0 = 0, last = 0;
    const tick = (now) => { if (!t0) t0 = last = now; frame((now - t0) / 1000, (now - last) / 1000); last = now; raf = requestAnimationFrame(tick); };
    return { start() { if (!raf) { t0 = 0; raf = requestAnimationFrame(tick); } }, stop() { cancelAnimationFrame(raf); raf = 0; } };
  }

  // Tween a number from a to b over ms, calling set(v) each frame (ease-out).
  function tween(a, b, ms, set) {
    const t0 = performance.now();
    return new Promise((done) => { const step = (now) => { const k = Math.min(1, (now - t0) / ms); set(a + (b - a) * (1 - Math.pow(1 - k, 3))); k < 1 ? requestAnimationFrame(step) : done(); }; requestAnimationFrame(step); });
  }

  return { widget: (name, fn) => { widgets[name] = fn; }, widgets, el, css, canvas, controls, slider, toggle, segmented, caption, animate, tween };
})();
