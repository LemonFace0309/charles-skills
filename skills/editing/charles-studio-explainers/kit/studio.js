/* charles-studio-explainers: the stage, light and motion helpers for studio cards, on charles-explainers-assets' kit.
   kit/bundle.sh joins this file, the project's scenes/src/*.js (one builder per card) and kit/studio-card.js into
   scenes/cards.js, the one scene every asset names ("scene": "cards").

   A builder is STUDIO.cards['<asset id without its number>'] = (card, W, H) => (t) => { ... }: it fills the 870x350
   card and returns the function that draws the frame at t. Everything is a pure function of t: no CSS transitions,
   no clock (charles-explainers-assets, kit.md). */
(() => {
  const { el, div, E, prog, clamp, lerp, mix } = H$;
  const L = {};
  window.STUDIO = { L, cards: {} };

  // Fonts the project ships in fonts/ (bundle.sh copies them from kit/fonts): Inter and Inter Tight as variable fonts,
  // and Doto, a dot-matrix face for numerals of 48 px or more.
  el('style', { text: `
    @font-face { font-family: InterV; src: url(/fonts/Inter.woff2) format('woff2'); font-weight: 100 900; }
    @font-face { font-family: InterTight; src: url(/fonts/InterTight.woff2) format('woff2'); font-weight: 100 900; }
    @font-face { font-family: Doto; src: url(/fonts/Doto.woff2) format('woff2'); font-weight: 100 900; }
  ` }, document.head);
  for (const f of ['300 40px InterV', '700 40px InterV', '800 40px InterTight', '700 40px Doto']) document.fonts.load(f);

  /* ---------- time ---------- */
  // progress from a to b through a curve. An unknown curve name (H$.E has out, inOut and quadIn, but no `in`) throws,
  // instead of quietly falling back to ease-out: that turned a stamp's slow lift into a two-frame yank.
  L.P = (t, a, b, ...c) => { if (c.length && typeof c[0] !== 'function') throw new Error('L.P: unknown easing curve'); return (c[0] || E.out)(prog(t, a, b)); };
  L.outBack = (x, s = 1.7) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 + (s + 1) * (x - 1) ** 3 + s * (x - 1) ** 2);
  // a spring from 0 to 1 starting at t0 (follow-through, settles)
  L.spring = (t, t0, { k = 260, c = 18 } = {}) => (t < t0 ? 0 : 1 - H$.springTo(t - t0, { k, c, x0: 1 }));
  // a smooth wobble for flicker and idle life, stable per seed
  L.wob = (t, seed = 1) => 0.5 * Math.sin(t * 11.3 + seed) + 0.3 * Math.sin(t * 23.7 + seed * 2.1) + 0.2 * Math.sin(t * 41.9 + seed * 3.7);
  // a gravity drop from y0 to y1 between t0 and t1, then a squash on landing: { y, sx, sy, landed }
  L.drop = (t, t0, t1, y0, y1, amt = 0.12) => {
    if (t < t0) return { y: y0, sx: 1, sy: 1, landed: false };
    if (t < t1) { const u = (t - t0) / (t1 - t0); return { y: y0 + (y1 - y0) * u * u, sx: 1 - 0.04 * u, sy: 1 + 0.06 * u, landed: false }; }
    const k = L.spring(t, t1, { k: 380, c: 16 });
    return { y: y1, sx: 1 + amt * (1 - k), sy: 1 - amt * 1.2 * (1 - k), landed: true };
  };
  L.fadeUp = (e, k, dy = 8) => { e.style.opacity = Number(k).toFixed(3); e.style.transform = `translateY(${(dy * (1 - k)).toFixed(2)}px)`; };

  /* ---------- drawing ---------- */
  // text: T(parent, x, y, 'copy', { size, weight, color, family, w, align, lh, ls, style })
  L.T = (p, x, y, text, o = {}) => {
    const { size = 20, weight = 500, color = '#fff', family = 'InterV', w, align, lh, ls, style = {} } = o;
    return div(p, { x, y, w, text, style: { font: `${weight} ${size}px/${lh || Math.round(size * 1.15)}px ${family}, Inter, sans-serif`, color,
      whiteSpace: 'nowrap', letterSpacing: ls ?? (size >= 60 ? '-0.045em' : size >= 28 ? '-0.025em' : '-0.01em'), textAlign: align || 'left',
      fontFeatureSettings: '"tnum" 1', ...style } });
  };
  // the principle's words: Inter Tight 800, tracked tight, with the word spaces kept open (at -0.045em and no word
  // spacing, round 3's critic read "Ipromise", "Bestvalue", "Pipmisses")
  L.big = (p, x, y, text, size = 56, color = '#fff', o = {}) => L.T(p, x, y, text, { size, weight: 800, family: 'InterTight', color, ls: '-0.032em', ...o, style: { wordSpacing: '0.06em', ...(o.style || {}) } });
  // a baseline row, for a number and its unit
  L.row = (p, x, y, w, h, gap = 8) => div(p, { x, y, w, h, style: { display: 'flex', alignItems: 'baseline', gap: gap + 'px' } });
  L.word = (p, text, font, color = '#fff', ls = '-0.03em') => el('div', { text, style: { font, letterSpacing: ls, wordSpacing: '0.06em', color, whiteSpace: 'nowrap' } }, p);
  L.B = (p, x, y, w, h, o = {}) => {
    const { bg = 'transparent', r = 0, border, shadow, style = {} } = o;
    return div(p, { x, y, w, h, style: { background: bg, borderRadius: r + 'px', boxSizing: 'border-box',
      ...(border ? { border } : {}), ...(shadow ? { boxShadow: shadow } : {}), ...style } });
  };
  // an object: a square box holding a transparent PNG from gen/ (the kit waits for every image before rendering)
  L.img = (p, x, y, w, src, style = {}) => {
    const box = div(p, { x, y, w, h: w, style: { ...style } });
    el('img', { src, style: { width: '100%', height: '100%', display: 'block', objectFit: 'contain' } }, box);
    return box;
  };
  const GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>`)}")`;
  L.grain = (p, w, h, o = 0.22, blend = 'overlay') => div(p, { x: 0, y: 0, w, h, style: { backgroundImage: GRAIN, backgroundSize: '220px 220px', opacity: o, mixBlendMode: blend, pointerEvents: 'none' } });
  L.glass = (p, x, y, w, h, o = {}) => L.B(p, x, y, w, h, { r: o.r ?? 18, bg: o.bg || 'rgb(255 255 255 / 0.16)',
    style: { backdropFilter: 'blur(14px) saturate(1.4)', boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.35), inset 0 0 0 1px rgb(255 255 255 / 0.14), 0 16px 34px -18px rgb(0 0 0 / 0.5)', ...(o.style || {}) } });
  const ICONS = {
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    lock: '<rect width="16" height="11" x="4" y="11" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    share: '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="m16 6-4-4-4 4"/><path d="M12 2v13"/>',
  };
  L.icon = (p, x, y, name, size = 24, color = '#fff', sw = 2) => div(p, { x, y, w: size, h: size,
    html: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" style="display:block">${ICONS[name]}</svg>` });

  /* ---------- the stage ---------- */
  // One colour family: a single saturated base (mid, mixed toward deep), lit softly on the object (light, at `at`, the
  // After's centre-left by default), with the deep colour falling in behind the type (deepAt), so white words keep
  // 4.5:1. A naturally bright family (mustard, chartreuse) passes { deepAt: null, ink: '<dark>' }: the words and the
  // After label turn dark instead. Never a two-blob mesh, never the violet-magenta-orange mix (round 2's critic).
  L.fam = (light, mid, deep, at = '46% 58%', { deepAt = '100% 92%', ink } = {}) => ({ light, mid, deep, at, ink,
    toString() {
      const glow = `radial-gradient(50% 78% at ${at}, ${light} 0%, transparent 70%)`;
      const fall = deepAt ? `radial-gradient(78% 125% at ${deepAt}, ${deep} 0%, transparent 72%), ` : '';
      return `${glow}, ${fall}color-mix(in oklch, ${mid} 64%, ${deep})`;
    } });
  // The neutral ground: warm cream lit at the centre, dark type and one loud colour per card. The reference puts one
  // loud hero on cream; round 3's critic found no neutral ground in a set of 20 colour worlds.
  L.cream = (inkc = '#1d1914') => ({ light: '#fffdf8', mid: '#ece3d3', deep: '#b9a888', at: '50% 50%', ink: inkc, cream: true,
    toString() { return 'radial-gradient(58% 85% at 50% 46%, #fffdf8 0%, transparent 72%), radial-gradient(80% 120% at 100% 100%, #d8cab0 0%, transparent 70%), #ebe2d2'; } });
  // Paper you can believe: warm stock, light grain, a soft curl shade along the bottom.
  L.paper = (p, x, y, w, h, o = {}) => {
    const e = L.B(p, x, y, w, h, { bg: o.bg || '#fbf4e6', r: o.r ?? 10, shadow: '0 2px 6px rgb(40 10 0 / 0.22), 0 30px 50px -22px rgb(40 10 0 / 0.6)', style: { overflow: 'hidden', ...(o.style || {}) } });
    L.grain(e, w, h, 0.16, 'soft-light');
    L.B(e, 0, h - 26, w, 26, { bg: 'linear-gradient(180deg, transparent, rgb(120 80 40 / 0.08))' });
    return e;
  };
  // The stage: the world (with an optional halftone screen away from the light, like the reference's SPOTTED page), the
  // Before as one flat tile in the card's own colour (dimming only to about 78% as the After plays), 24 px labels on one
  // line, and grain over everything, type and photos included, so the photos, paper and colour read as one print.
  // There is no moving light pool: it bleached the numbers it pointed at. Returns { b, bk (the Before's ink), tick(t) };
  // call tick(t) first in the draw function. Keep the After's content at y 76 or below near x 316-420, and every word
  // 40 px inside the card's edges.
  L.stage = (card, W, H, f, { beforeW = 270, halftone, htAt } = {}) => {
    Object.assign(card.style, { background: String(f) });
    if (halftone) {
      const m = `radial-gradient(64% 105% at ${htAt || f.at}, transparent 30%, #000 92%)`;
      div(card, { x: 0, y: 0, w: W, h: H, style: { backgroundImage: `radial-gradient(circle, ${halftone} 0 1.9px, transparent 2.4px)`, backgroundSize: '8px 8px', maskImage: m, webkitMaskImage: m } });
    }
    // dark on every card, cream included: viewers learn "dark box = Before" (round 5's critic)
    const tile = f.cream ? '#3b342c' : `color-mix(in oklch, ${f.deep} 62%, rgb(52 54 60))`;
    const b = L.B(card, 18, 18, beforeW, H - 36, { r: 24, bg: tile, style: { overflow: 'hidden', boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.1)' } });
    const bk = '#fff';
    const lab = (p, x, y, text, c) => L.T(p, x, y, text, { size: 24, weight: 650, color: c, style: c === '#fff' ? { textShadow: '0 1px 8px rgb(0 0 0 / 0.25)' } : {} });
    lab(b, 22, 18, 'Before', bk);
    // a soft shade behind the After label keeps white type readable however bright the world is; dark ink needs none
    if (!f.ink) div(card, { x: beforeW - 8, y: -10, w: 220, h: 110, style: { background: 'radial-gradient(closest-side, rgb(0 0 0 / 0.16), transparent)' } });
    lab(card, beforeW + 48, 36, 'After', f.ink || '#fff');
    const shade = L.B(b, 0, 0, beforeW, H - 36, { bg: 'rgb(0 0 0 / 0.22)', r: 24, style: { opacity: 0, zIndex: 3 } });
    L.grain(card, W, H, f.cream ? 0.26 : 0.34, 'overlay').style.zIndex = 30;
    return { b, bk, tick: (t) => { shade.style.opacity = L.P(t, 0.12, 0.34).toFixed(3); } };
  };
  // A lit object: the photo, the world's light spilling onto its lit side (upper right, where every prompt puts the key
  // light) and its deep colour on the far side, both masked to the object's own shape; a soft cast shadow on the backdrop,
  // down and to the left; and, for something standing on a floor, a contact shadow at `floor` (its base, as a fraction of
  // the box, from bbox.py). Returns the box, with box.contact to fade or scale as the object leaves the floor. Round 3's
  // critic, of photos without these: "nothing sits in light", a template with stock PNGs.
  L.obj = (p, x, y, w, src, f, o = {}) => {
    const { floor = null, sw = 0.6, sh = 0.11, spill = 0.5, shade = 0.3, cast = true, z = null, cx = 0.5 } = o;
    const zi = z != null ? { zIndex: z } : {};
    let contact = null;
    if (floor != null) contact = div(p, { x: x + w * (cx - sw / 2), y: y + w * floor - (w * sh) / 2, w: w * sw, h: w * sh,
      style: { background: `radial-gradient(closest-side, color-mix(in oklch, ${f.deep} 50%, black) 0%, color-mix(in oklch, ${f.deep} 45%, transparent) 55%, transparent 100%)`, opacity: 0.85, ...zi } });
    const box = div(p, { x, y, w, h: w, style: { ...(cast ? { filter: `drop-shadow(-12px 18px 16px color-mix(in oklch, ${f.deep} 62%, transparent))` } : {}), ...zi, ...(o.style || {}) } });
    el('img', { src, style: { width: '100%', height: '100%', display: 'block', objectFit: 'contain' } }, box);
    const m = { maskImage: `url(${src})`, webkitMaskImage: `url(${src})`, maskSize: '100% 100%', webkitMaskSize: '100% 100%', maskRepeat: 'no-repeat', webkitMaskRepeat: 'no-repeat' };
    if (spill) div(box, { x: 0, y: 0, w, h: w, style: { ...m, background: `linear-gradient(225deg, ${f.light} 0%, transparent 62%)`, mixBlendMode: 'soft-light', opacity: spill } });
    if (shade) div(box, { x: 0, y: 0, w, h: w, style: { ...m, background: `linear-gradient(225deg, transparent 38%, ${f.deep} 100%)`, mixBlendMode: 'multiply', opacity: shade } });
    box.contact = contact;
    return box;
  };
  // A flame's own light: a warm pool for the caller to flicker and dim with the flame (it may light type too: clip a
  // radial gradient centred on the flame to the glyphs, as the 20 Psychology Principles card 02 does with its 46).
  L.flameLight = (p, cx, cy, r, rgb = '255 176 96') => div(p, { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r,
    style: { background: `radial-gradient(closest-side, rgb(${rgb} / 0.62), rgb(${rgb} / 0.2) 42%, transparent)`, mixBlendMode: 'plus-lighter', pointerEvents: 'none' } });
  // A rubber-stamp imprint in ink: a ring and a tick with ragged edges and speckle, multiplied into the paper.
  let stampN = 0;
  L.inkStamp = (p, x, y, s, color = '#cf2639', rot = -8) => {
    const id = `ink${++stampN}`;
    const e = div(p, { x, y, w: s, h: s, style: { mixBlendMode: 'multiply', transformOrigin: '50% 50%' } });
    e.innerHTML = `<svg viewBox="0 0 64 64" width="${s}" height="${s}" style="display:block;overflow:visible;transform:rotate(${rot}deg)"><defs>
      <filter id="${id}" x="-15%" y="-15%" width="130%" height="130%"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="${stampN * 7}"/><feDisplacementMap in="SourceGraphic" scale="2.6"/></filter>
      <filter id="${id}s"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="${stampN * 3}"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -3 2.2"/></filter>
      <mask id="${id}m"><rect x="-8" y="-8" width="80" height="80" fill="#fff" filter="url(#${id}s)"/></mask></defs>
      <g filter="url(#${id})" mask="url(#${id}m)" fill="none" stroke="${color}" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.92">
      <circle cx="32" cy="32" r="26"/><circle cx="32" cy="32" r="20.5" stroke-width="1.6"/><path d="M21 33.5l7.5 7.5L44 25"/></g></svg>`;
    return e;
  };

  /* ---------- app moments (round 6) ---------- */
  // System type for recreated app screens, by name: in headless Chrome on macOS, -apple-system and ui-rounded fall back
  // to a serif.
  L.SFR = "'SF Pro Rounded', 'Arial Rounded MT Bold', sans-serif";
  L.SFT = "'SF Pro Text', 'Helvetica Neue', sans-serif";
  L.SFD = "'SF Pro Display', 'Helvetica Neue', sans-serif";
  // A value that changes in place: only the characters that change roll, the old one up and out, the new one up and
  // in. states have equal lengths; times[i] is when states[i + 1] arrives. Call box.draw(t) each frame.
  L.roller = (p, x, y, states, times, o = {}) => {
    const { size = 64, weight = 700, family = L.SFR, color = '#fff', dur = 0.2, ls = '0', style = {} } = o;
    const LH = Math.round(size * 1.18);
    const box = div(p, { x, y, w: o.w || 600, h: LH, style: { display: 'flex', whiteSpace: 'pre', font: `${weight} ${size}px/${LH}px ${family}`, color, letterSpacing: ls, fontFeatureSettings: '"tnum" 1', ...style } });
    const cells = Array.from({ length: states[0].length }, () => {
      const c = el('span', { style: { position: 'relative', display: 'inline-block', overflow: 'hidden', height: LH + 'px' } }, box);
      return { a: el('span', { style: { display: 'block' } }, c), b: el('span', { style: { position: 'absolute', left: '0', top: '0', display: 'block' } }, c) };
    });
    box.draw = (t) => {
      let k = 0; while (k < times.length && t >= times[k]) k++;
      const cur = states[k], prev = k ? states[k - 1] : cur, u = k ? L.P(t, times[k - 1], times[k - 1] + dur, E.out) : 1;
      cells.forEach(({ a, b }, i) => {
        a.textContent = cur[i];
        if (prev[i] !== cur[i] && u < 1) {
          b.textContent = prev[i];
          a.style.transform = `translateY(${(LH * 0.7 * (1 - u)).toFixed(2)}px)`; a.style.opacity = u.toFixed(3);
          b.style.transform = `translateY(${(-LH * 0.7 * u).toFixed(2)}px)`; b.style.opacity = (1 - u).toFixed(3);
        } else { b.textContent = ''; a.style.transform = 'none'; a.style.opacity = '1'; }
      });
    };
    return box;
  };
  // A casual game's button: a bright face over a darker lip, and white text with a dark outline so it reads.
  L.gameButton = (p, x, y, w, h, face, lip, text, o = {}) => {
    const b = L.B(p, x, y, w, h, { bg: face, r: o.r ?? 18, style: { boxShadow: `inset 0 -6px 0 ${lip}, 0 8px 16px -8px rgb(0 0 0 / 0.35)`, transformOrigin: '50% 50%' } });
    const ink = o.ink || lip;
    L.T(b, 0, (h - 6 - (o.size ?? 30) * 1.15) / 2, text, { size: o.size ?? 30, weight: 800, family: L.SFR, color: '#fff', w, align: 'center', style: { textShadow: `0 2px 0 ${ink}`, webkitTextStroke: `2px ${ink}`, paintOrder: 'stroke fill' } });
    return b;
  };
})();
