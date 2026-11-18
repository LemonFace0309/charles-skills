// The editor: loads project.json, builds each shot when it is needed, finds which shot(s) are on screen at time t,
// renders them through the camera body and the film stage, then lays the type layer on top. window.__seek(t) is the
// only entry point the renderer uses.
import * as THREE from 'three';
import { gsap } from 'gsap';
import { Engine, DOF } from './core.js';
import { Post, DEFAULT_POST, CAPTION_BAND } from './post.js';
import { UI, loadWords, findPhrase } from './ui.js';
import * as look from './look.js';
import * as U from './util.js';
import * as glow from './glow.js';
import * as fx from './fx.js';
import * as cam from './cam.js';
import * as props from './props/index.js';
import * as screens from './screens.js';

const q = new URLSearchParams(location.search);
const PROJ = q.get('p') || '/p/';
const kitUrl = (p) => new URL('../' + p, import.meta.url).href;
const errors = [];
window.__errors = errors;
addEventListener('error', (e) => errors.push(String(e.message || e)));
addEventListener('unhandledrejection', (e) => errors.push(String(e.reason?.stack || e.reason)));

// __audit's type-over-3D thresholds: the share of a box above a luma in the 3D picture. Captions: more than 2% above
// 120 (on test stills it flagged every caption a judge called unreadable, 3.9 to 31.4% of the box, and passed the clean
// ones at 0%; 4% above 150 missed three of them). Heroes and titles: more than 10% above 150. Labels: more than 20% (a
// label beside a lit city or on a lit panel always had 10% of its box over 150 from the light around its subject, so
// designers dropped useful labels).
export const AUDIT = { cap: 0.02, capLuma: 120, subject: 0.10, label: 0.20, subjectLuma: 150 };

const fetchJSON = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`${u}: HTTP ${r.status}`); return r.json(); };

// Every geometry, material and texture (material maps and shader uniforms) a scene uses, except what is flagged
// userData.shared: module-level caches (props, look.environment) that other shots reuse.
function resources(scene, out = new Set()) {
  const own = (x) => x?.userData?.shared !== true;
  const add = (v) => { if (v?.isTexture && own(v)) out.add(v); };
  [scene.background, scene.environment].forEach(add);
  scene.traverse((o) => {
    if (o.geometry && own(o.geometry)) out.add(o.geometry);
    for (const m of [o.material].flat()) {
      if (!m || !own(m)) continue;
      out.add(m);
      Object.values(m).forEach(add);
      for (const u of Object.values(m.uniforms || {})) add(u?.value);
    }
  });
  return out;
}
// Frees an evicted shot's GPU memory, keeping what a live shot still uses (disposing it would re-upload mid-render).
function disposeScene(scene, live = []) {
  const keep = new Set(); for (const s of live) resources(s, keep);
  for (const x of resources(scene)) if (!keep.has(x)) x.dispose();
}

async function boot() {
  const project = await fetchJSON(PROJ + 'project.json');
  const [W, H] = project.size || [1080, 1920];
  const scale = +(q.get('scale') || 1);
  const samples = +(q.get('samples') || project.samples || 16);
  const fps = +(q.get('fps') || project.fps || 30);
  const captionsOn = q.get('captions') !== '0' && project.captions?.enabled !== false;
  const w = Math.round(W * scale), h = Math.round(H * scale);
  const stage = document.getElementById('stage');
  const canvas = document.createElement('canvas'); canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; stage.appendChild(canvas);
  const engine = new Engine(canvas, { width: w, height: h, samples, fps, shutter: project.shutter ?? 0.5 });
  // sampling quality (core.js DOF): project.json "dof": { fill, spacing, maxAuto, maxMotion, motionSpacing }; URL ?fill=0&autosamples=0 for A/B
  Object.assign(DOF, project.dof || {});
  if (q.has('fill')) DOF.fill = +q.get('fill');
  if (q.get('autosamples') === '0') { DOF.maxAuto = 0; DOF.maxMotion = 0; } // no automatic sample floors (defocus and motion)
  const post = new Post(engine.renderer, w, h);
  // the caption shade (post.captionShade) follows the captions: CAPTION_BAND is for the default bottom (450 of 1920)
  const capShift = Math.round(450 * H / 1920) - (project.captions?.bottom ?? Math.round(450 * H / 1920));
  post.setCaptionBand(CAPTION_BAND.map((y) => (y * H / 1920 + capShift) / H));
  const uiRoot = document.getElementById('ui');
  uiRoot.style.width = W + 'px'; uiRoot.style.height = H + 'px'; uiRoot.style.transform = `scale(${scale})`;
  const ui = new UI(uiRoot, { W, H });
  const pal = look.palette(project.palette);
  if (project.accent) pal.accent = project.accent;
  look.theme.pal = pal;
  ui.setPalette(pal);
  const words = project.words ? loadWords(await fetchJSON(PROJ + project.words)) : [];
  if (captionsOn) ui.captions(words, project.captions || {});
  const duration = project.duration ?? (words.length ? words[words.length - 1].end + 0.6 : 10);

  // shots, in time order; a shot ends where the next begins
  const defs = (project.shots || []).map((d) => ({ ...d })).sort((a, b) => a.start - b.start);
  const TDUR = { cut: 0, fade: 0.4, dip: 0.4, zoom: 0.6, whip: 0.4, light: 0.5 };
  defs.forEach((d, i) => {
    if (d.end == null) d.end = defs[i + 1] ? defs[i + 1].start : duration;
    const tin = typeof d.in === 'string' ? { type: d.in } : { ...(d.in || { type: 'cut' }) };
    if (!(tin.type in TDUR)) errors.push(`shot ${d.id}: unknown transition "${tin.type}" (cut, fade, dip, zoom, whip, light)`);
    tin.dur = tin.type === 'cut' ? 0 : tin.dur ?? TDUR[tin.type] ?? 0.5;
    d.in = tin;
  });
  const shots = defs.map((def, index) => ({ def, index, start: def.start, end: def.end, built: false, building: null, lastUsed: 0 }));
  let clock = 0;

  const wordsIn = (S) => words.filter((x) => x.start >= S.start - 0.05 && x.start < S.end + 0.05);
  // the nth occurrence (0-based) whose words match the phrase exactly, case and punctuation included
  const exactHit = (phrase, from, to, nth) => {
    const parts = String(phrase).trim().split(/\s+/);
    for (let i = 0, seen = 0; i < words.length; i++) {
      if (words[i].start < from - 1e-6 || words[i].start > to) continue;
      if (parts.every((p, j) => words[i + j]?.text === p) && seen++ === nth) return words.slice(i, i + parts.length);
    }
    return null;
  };
  // Every word timing a shot or globals.js asked for, once each: { shot, phrase, nth, t (global s), text }. render.mjs
  // writes it to log.json as `words`, and check.mjs lists a pop on one of these times as planned. Lookups are cached
  // (words never change), so a k.word called inside update costs nothing and warns once.
  const wordLog = (window.__wordLog = []), wordMemo = new Map();
  const resolved = (key, shot, phrase, nth, which, find) => {
    if (wordMemo.has(key)) return wordMemo.get(key);
    const hit = find();
    const t = hit ? (which === 'end' ? hit[hit.length - 1].end : hit[0].start) : null;
    if (hit) wordLog.push({ shot, phrase: String(phrase), nth, t: +t.toFixed(3), text: hit.map((x) => x.text).join(' '), ...(which === 'end' ? { which } : {}) });
    wordMemo.set(key, t);
    return t;
  };
  // k.word: inside the shot first (exact spelling, then case- and punctuation-blind), then 1 s either side of it.
  // A hit outside the shot is logged, so 'and' picking up the 'and' before the cut shows in the render log.
  const findLocal = (S, phrase, nth = 0, which = 'start') => {
    const a = S.start - 0.05, b = S.end;
    const t = resolved(`${S.index}|${phrase}|${nth}|${which}`, S.def.id, phrase, nth, which, () => {
      const hit = exactHit(phrase, a, b, nth) || findPhrase(words, phrase, a, b, nth) || exactHit(phrase, S.start - 1.0, S.end + 1.0, nth) || findPhrase(words, phrase, S.start - 1.0, S.end + 1.0, nth);
      if (!hit) {
        const msg = `word "${phrase}"${nth ? ` (occurrence ${nth + 1})` : ''} not found near shot ${S.def.id} (${S.start.toFixed(2)}-${S.end.toFixed(2)} s); for a word said in another shot use k.gword`;
        errors.push(msg); console.warn(msg);
      } else if (hit[0].start < a || hit[0].start > b) {
        const off = hit[0].start < a ? `${(S.start - hit[0].start).toFixed(2)} s before the shot` : `${(hit[0].start - S.end).toFixed(2)} s after the shot`;
        const ex = exactHit(phrase, -1e9, 1e9, 0);
        console.warn(`k.word("${phrase}") in shot ${S.def.id} matched "${hit.map((x) => x.text).join(' ')}" at ${hit[0].start.toFixed(2)} s, ${off} (${S.start.toFixed(2)}-${S.end.toFixed(2)} s)${ex && ex[0] !== hit[0] ? `; exact "${phrase}" at ${ex[0].start.toFixed(2)} s` : ''}: use k.gword(phrase, nth) for a word said in another shot`);
      }
      return hit;
    });
    return t == null ? 0 : t - S.start;
  };
  // k.gword / k.wordGlobal: the whole voiceover, for a world that spans several shots (shot-local seconds, negative
  // before the shot)
  const findAny = (S, phrase, nth = 0, which = 'start') => {
    const t = resolved(`g${S.index}|${phrase}|${nth}|${which}`, S.def.id, phrase, nth, which, () => {
      const hit = exactHit(phrase, -1e9, 1e9, nth) || findPhrase(words, phrase, -1e9, 1e9, nth);
      if (!hit) { const msg = `word "${phrase}"${nth ? ` (occurrence ${nth + 1})` : ''} not in the voiceover (shot ${S.def.id})`; errors.push(msg); console.warn(msg); }
      return hit;
    });
    return t == null ? 0 : t - S.start;
  };

  async function build(S) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, W / H, 0.05, 3000);
    camera.position.set(0, 1, 8); camera.lookAt(0, 0, 0);
    S.scene = scene; S.camera = camera; S.lens = { aperture: 0, focus: 8 }; S.post = {}; S.softLights = []; S.motionBlur = 1; S.screens = []; S.motionProbes = []; S.labels = [];
    const tl = gsap.timeline({ paused: true });
    const owned = (o = {}) => ({ ...o, owner: S, at: (o.at ?? 0) + S.start, until: o.until != null ? o.until + S.start : null });
    const k = {
      THREE, gsap, U, ...U, look, glow, fx, cam, props, mat: look.mat,
      W, H, aspect: W / H, fps, pal, scene, camera, tl,
      start: S.start, end: S.end, dur: S.end - S.start, id: S.def.id, params: S.def.params || {},
      // shot time when the shot is last seen: its end, or a cutaway's out point (project.json cutOut) when that comes first
      // (the handles after it never show). A move that ends on a hard cut lands by k.out - 0.2
      out: Math.min(S.end, Number.isFinite(project.cutOut) ? project.cutOut : Infinity) - S.start,
      renderer: engine.renderer,
      get lens() { return S.lens; }, set lens(v) { S.lens = v; },
      get post() { return S.post; }, set post(v) { S.post = v; },
      get motionBlur() { return S.motionBlur; }, set motionBlur(v) { S.motionBlur = v; },
      get samples() { return S.samples || samples; }, set samples(v) { S.samples = v; }, // e.g. k.samples = 48 for a shot with strong defocus
      // objects whose screen speed sets the motion sample floor besides the focus point (core.js): k.motionProbes.push(lock)
      get motionProbes() { return S.motionProbes; }, set motionProbes(v) { S.motionProbes = [v].flat().filter(Boolean); },
      word: (p, nth = 0) => findLocal(S, p, nth, 'start'),
      wordEnd: (p, nth = 0) => findLocal(S, p, nth, 'end'),
      wordGlobal: (p, nth = 0) => findAny(S, p, nth, 'start'),
      wordEndGlobal: (p, nth = 0) => findAny(S, p, nth, 'end'),
      gword: (p, nth = 0) => findAny(S, p, nth, 'start'),
      gwordEnd: (p, nth = 0) => findAny(S, p, nth, 'end'),
      words: () => wordsIn(S).map((x) => ({ ...x, start: x.start - S.start, end: x.end - S.start })),
      asset: (rel) => PROJ + rel,
      image: (rel, o) => props.loadTexture(/^(https?:|data:|\/)/.test(rel) ? rel : PROJ + rel, o),
      imagePlane: (rel, o) => props.imagePlane(/^(https?:|data:|\/)/.test(rel) ? rel : PROJ + rel, o),
      // live HTML on a 3D surface: const s = await k.screen({ w, h, html, css }); s.update = (t, root) => {...}
      screen: async (o = {}) => { const sc = await screens.screen({ base: PROJ, ...o }); S.screens.push(sc); return sc; },
      // a clip made by clip.mjs --frames: a texture showing frame floor((t - at) * fps) for each output frame (clips/clip.js)
      clip: async (rel, o = {}) => (await import(kitUrl('clips/clip.js'))).clip(k, rel, { ...o, register: (c) => S.screens.push(c) }),
      // load a face the kit does not preload before drawing canvas text with it: await k.font('italic 400 40px Inter')
      font: (spec, text = 'Aδ') => document.fonts.load(spec, text),
      kit: (rel) => kitUrl(rel),
      env: (kind = pal.env, intensity = 1, o) => { scene.environment = look.environment(engine.renderer, kind, pal, o); scene.environmentIntensity = intensity; return scene.environment; },
      backdrop: (o = {}) => { const b = look.backdrop(pal, o); b.material.uniforms.res.value.set(W, H); scene.add(b); return b; },
      fog: (s = 1) => look.applyFog(scene, pal, s),
      rig: (o = {}) => { const r = look.rig(scene, pal, o); if (o.soft !== 0) S.softLights.push({ light: r.key, radius: o.soft ?? 0.6 }); return r; },
      softLight: (light, radius = 0.5) => S.softLights.push({ light, radius }),
      ui: {
        title: (html, o) => ui.title(html, owned(o)),
        hero: (c, o) => ui.hero(typeof c === 'function' ? (t) => c(t - S.start) : c, { ...owned(o), count: o?.count ? { ...o.count, at: o.count.at != null ? o.count.at + S.start : undefined } : null }),
        hud: (o = {}) => ui.hud({ ...owned(o), value: (t) => (o.value || (() => 0))(t - S.start) }),
        label: (text, o = {}) => {
          const oo = { ...owned(o), anchor: typeof o.anchor === 'function' ? (t) => o.anchor(t - S.start) : o.anchor };
          S.labels.push({ text: String(text).replace(/<[^>]+>/g, ''), anchor: oo.anchor, at: oo.at, until: oo.until }); // for __audit
          return ui.label(text, oo);
        },
        text: (html, o) => ui.text(html, owned(o)),
        doodle: (svg, o) => ui.doodle(svg, owned(o)),
        // a scale bar stepping down an order of magnitude per zoom word: steps [[t, '1 mm', px], ...] in shot time
        scaleBar: (o = {}) => ui.scaleBar({ ...owned(o), steps: (o.steps || []).map(([t, ...r]) => [t + S.start, ...r]) }),
      },
      // project a world point to overlay pixels (1080 x 1920 layout space)
      project: (v) => { const p = (v.isVector3 ? v.clone() : new THREE.Vector3(...v)).project(camera); return { x: (p.x * 0.5 + 0.5) * W, y: (-p.y * 0.5 + 0.5) * H, behind: p.z > 1 }; },
    };
    let mod;
    try { mod = await import(PROJ + S.def.file + (S.def.file.includes('?') ? '' : `?v=${Date.now()}`)); }
    catch (e) { throw new Error(`shot ${S.def.id}: cannot import ${S.def.file}: ${e.message}`); }
    const fn = mod.default;
    if (typeof fn !== 'function') throw new Error(`shot ${S.def.id}: default export must be async (k) => update(t)`);
    const update = await fn(k);
    if (typeof update !== 'function') throw new Error(`shot ${S.def.id}: build must return update(t)`);
    S.update = (t, ft = t) => { tl.seek(Math.max(0, t), false); update(t, ft); }; // ft: the output frame's time (steps once per frame: use it for text and counters)
    S.project = k.project;
    // resolution-dependent materials
    scene.traverse((o) => {
      const m = o.material; if (!m) return;
      for (const mm of Array.isArray(m) ? m : [m]) {
        if (mm.isLineMaterial) mm.resolution.set(w, h);
        if (mm.uniforms?.uRes) mm.uniforms.uRes.value = h / 1920; // point sprites: size = r * projectionMatrix[1][1] * 960 * uRes / depth
        if (mm.uniforms?.uFocus && mm.uniforms?.uAperture) (S.lensMats ||= new Set()).add(mm);
        if (mm.uniforms?.uSkew) (S.skyMats ||= new Set()).add(mm); // sky layers (stars): core.js cancels the lens offset per sub-frame
      }
    });
    // make every texture as sharp as the GPU allows at grazing angles
    const aniso = engine.renderer.capabilities.getMaxAnisotropy();
    scene.traverse((o) => { const m = o.material; if (!m) return; for (const mm of Array.isArray(m) ? m : [m]) for (const v of Object.values(mm)) if (v && v.isTexture) v.anisotropy = aniso; });
    engine.renderer.compile(scene, camera);
    S.built = true;
  }
  async function ensure(S) {
    S.lastUsed = ++clock;
    if (S.built) return;
    if (!S.building) S.building = build(S).catch((e) => { errors.push(String(e.stack || e)); throw e; });
    await S.building;
    // keep at most 6 shots alive on the GPU
    const live = shots.filter((x) => x.built);
    if (live.length > 6) {
      const old = live.sort((a, b) => a.lastUsed - b.lastUsed)[0];
      if (old !== S) { disposeScene(old.scene, shots.filter((x) => x.built && x !== old).map((x) => x.scene)); for (const sc of old.screens) sc.dispose?.(); ui.items = ui.items.filter((it) => { if (it.owner === old) { it.update(-1e9, 0, null); return false; } return true; }); old.built = false; old.building = null; }
    }
  }

  // Which shots are on screen at t, and how far through a transition.
  function activeAt(t) {
    if (!shots.length) return [];
    let i = shots.findIndex((S) => t < S.end);
    if (i < 0) i = shots.length - 1;
    const cur = shots[i], next = shots[i + 1];
    const tin = cur.def.in;
    if (i > 0 && tin.dur > 0 && t < cur.start + tin.dur / 2) {
      const p = (t - (cur.start - tin.dur / 2)) / tin.dur;
      return [{ S: shots[i - 1], w: 1 - p }, { S: cur, w: p, p, kind: tin.type, opts: tin }];
    }
    if (next && next.def.in.dur > 0 && t >= next.start - next.def.in.dur / 2) {
      const p = (t - (next.start - next.def.in.dur / 2)) / next.def.in.dur;
      return [{ S: cur, w: 1 - p }, { S: next, w: p, p, kind: next.def.in.type, opts: next.def.in }];
    }
    return [{ S: cur, w: 1 }];
  }

  const postFor = (S) => ({ ...DEFAULT_POST, ...(pal.post || {}), ...(project.post || {}), ...(S.post || {}) });
  const mixPost = (A, B, p) => { const out = {}; for (const key of Object.keys(A)) { const a = A[key], b = B[key] ?? a; out[key] = Array.isArray(a) ? a.map((x, j) => U.lerp(x, b[j], p)) : typeof a === 'number' ? U.lerp(a, b, p) : p < 0.5 ? a : b; } return out; };

  // globals.js (optional): overlays that span shots, e.g. a running clock. export default (g) => {}
  if (project.globals) {
    const findGlobal = (phrase, nth, which) => resolved(`globals|${phrase}|${nth}|${which}`, 'globals', phrase, nth, which, () => {
      const hit = exactHit(phrase, -1e9, 1e9, nth) || findPhrase(words, phrase, -1e9, 1e9, nth);
      if (!hit) { const msg = `word "${phrase}"${nth ? ` (occurrence ${nth + 1})` : ''} not found (globals.js)`; errors.push(msg); console.warn(msg); }
      return hit;
    }) ?? 0;
    const g = { ui: { title: (h, o) => ui.title(h, o), hero: (c, o) => ui.hero(c, o), hud: (o) => ui.hud(o), text: (h, o) => ui.text(h, o), scaleBar: (o) => ui.scaleBar(o) }, words, word: (p, nth = 0) => findGlobal(p, nth, 'start'), wordEnd: (p, nth = 0) => findGlobal(p, nth, 'end'), gword: (p, nth = 0) => findGlobal(p, nth, 'start'), U, ...U, pal };
    const mod = await import(PROJ + project.globals);
    await mod.default(g);
  }
  // every other key of project.json's title (y, size, style: 'cond', ...) goes through to ui.title as written
  if (project.title) { const { html, ...o } = project.title; ui.title(html, { ...o, at: o.at ?? 0, until: o.until ?? 3 }); }

  // Props draw canvas text once, at build time, and a face that is not loaded by then silently falls back to a system
  // font: load every declared face first (Inter 400-900 with its Greek subset, Barlow Condensed 500-800). The sample
  // text is Latin and Greek so faces split by unicode-range load too.
  await document.fonts.ready;
  const faces = [...[400, 500, 600, 700, 800, 900].map((wt) => `${wt} 40px Inter`), ...[500, 600, 700, 800].map((wt) => `${wt} 40px "Barlow Condensed"`)];
  await Promise.all([...faces.map((f) => document.fonts.load(f, 'Aδ')), ...[...document.fonts].map((f) => f.load())].map((p) => p.catch(() => {})));
  for (const f of document.fonts) if (f.status === 'error') errors.push(`font ${f.family} ${f.weight} ${f.unicodeRange} failed to load: its text falls back to a system font`);

  // Overlay visibility per shot. A fade or a dip blends both shots' overlays with the picture; a whip, zoom or light
  // moves the picture too fast for type to ride it, so the outgoing shot's heroes and labels leave in its first third
  // and the incoming ones arrive in its last third (they ghosted through the smear: gps's clock).
  const SPLIT = new Set(['whip', 'zoom', 'light']);
  const visFn = (t, act) => (S) => {
    const a = act.find((x) => x.S === S); if (!a) return 0;
    if (act.length === 1) return 1;
    const B = act[1];
    if (SPLIT.has(B.kind)) return a === B ? U.smooth(U.clamp((B.p - 0.65) / 0.35)) : 1 - U.smooth(U.clamp(B.p / 0.35));
    return U.smooth(U.clamp(a.w));
  };
  const ctxFn = (S) => ({ project: S.project || (() => ({ x: 0, y: 0, behind: true })) });

  // the light transition's default flare: the accent taken 30% towards white (in sRGB), as linear scene light
  const fc = new THREE.Color(pal.accent).convertLinearToSRGB().lerp(new THREE.Color(1, 1, 1), 0.3).convertSRGBToLinear();
  const flareColor = [fc.r, fc.g, fc.b];
  // The shot row's `tone` at t (night, space, screen, warm or midkey; null when the row has none): render.mjs picks the
  // tone range for each still from it. During a transition, the shot with the larger weight.
  window.__toneOf = (t) => { const act = activeAt(t); if (!act.length) return null; const a = act.length > 1 && act[1].w >= 0.5 ? act[1] : act[0]; return a.S.def.tone ?? null; };
  window.__samples = () => Object.fromEntries(shots.filter((S) => S.maxSamples).map((S) => [S.def.id, S.maxSamples])); // most sub-frames a shot used
  // per shot: the largest screen motion while the shutter was open (px) and the sub-frames the motion floor asked for
  window.__motion = () => Object.fromEntries(shots.filter((S) => S.maxMotionPx > 0).map((S) => [S.def.id, { px: Math.round(S.maxMotionPx), n: S.maxMotionN || 0 }]));
  window.__info = { duration, fps, W, H, w, h, scale, samples, shots: defs.map((d) => ({ id: d.id, start: d.start, end: d.end, in: d.in, tone: d.tone ?? null })), words: words.length };
  const camLog = (window.__camLog = []);
  window.__seek = async (t, frameIndex = Math.round(t * fps)) => {
    const act = activeAt(t);
    let fade = null; // fadeIn / fadeOut: the picture and the type fade together
    if (t < (project.fadeIn ?? 0)) fade = 1 - t / project.fadeIn;
    if (project.fadeOut && t > duration - project.fadeOut) fade = U.clamp((t - (duration - project.fadeOut)) / project.fadeOut);
    uiRoot.style.opacity = String(1 - (fade ?? 0));
    if (!act.length) { // no shots yet (a fresh project): black, so the captions and the title can be previewed
      const r = engine.renderer; r.setRenderTarget(null); r.setClearColor(0x000000, 1); r.clear();
      ui.update(t, visFn(t, act), ctxFn);
      await new Promise((r) => requestAnimationFrame(() => r()));
      return errors.length;
    }
    for (const a of act) await ensure(a.S);
    // the camera's own speed this frame, per active shot (render.mjs writes it to the log; check.mjs reads it)
    for (const a of act) camLog.push({ i: frameIndex, shot: a.S.def.id, px: +engine.cameraPx(a.S, t - a.S.start, 1 / fps).toFixed(2) });
    for (const a of act) for (const sc of a.S.screens) await sc.render(t - a.S.start);
    let tex, P;
    if (act.length === 1) {
      tex = engine.accumulate(act[0].S, t - act[0].S.start, 0, frameIndex);
      P = postFor(act[0].S);
    } else {
      const [A, B] = act;
      const ta = engine.accumulate(A.S, t - A.S.start, 0, frameIndex);
      const tb = engine.accumulate(B.S, t - B.S.start, 1, frameIndex);
      // a light flares in the accent unless the row names its colour; at, out and dir go through as written
      tex = post.transition(ta, tb, B.p, B.kind, B.kind === 'light' && B.opts.color == null ? { ...B.opts, color: flareColor } : B.opts);
      P = mixPost(postFor(A.S), postFor(B.S), U.smooth(U.clamp(B.p)));
      if (B.kind === 'light') P.bloom = (P.bloom ?? 0.06) + 0.2 * Math.sin(Math.PI * U.clamp(B.p)); // the flare blooms out
    }
    post.present(tex, fade == null ? P : { ...P, fade }, frameIndex);
    ui.update(t, visFn(t, act), ctxFn);
    await new Promise((r) => requestAnimationFrame(() => r()));
    return errors.length;
  };
  // Layout audit at time t: overlay boxes that leave the safe area or collide. A reel (1080 x 1920) keeps clear of the
  // platform's UI (status bar above y 200, caption band below H - 380); any other size keeps 60 px inside every edge.
  const probe = document.createElement('canvas'), pctx = probe.getContext('2d', { willReadFrequently: true });
  window.__audit = (t) => {
    const sc = scale, issues = [], reel = W === 1080 && H === 1920, edge = reel ? 40 : 60;
    // ink: a box less 0.1 em of empty leading at top and bottom, so stacked type at a 1.0 line pitch does not "overlap";
    // a title line is as wide as its own text (its block is as wide as the longest line)
    const box = (el) => {
      const r = el.getBoundingClientRect(), e = 0.1 * parseFloat(getComputedStyle(el).fontSize);
      let { left, width } = r;
      if (el.classList.contains('ln')) { const g = document.createRange(); g.selectNodeContents(el); ({ left, width } = g.getBoundingClientRect()); }
      return { x: left / sc, y: r.top / sc, w: width / sc, h: r.height / sc, e };
    };
    const op = (el) => parseFloat(getComputedStyle(el).opacity);
    const vis = (el) => el.offsetParent !== null && getComputedStyle(el).display !== 'none' && op(el) > 0.05;
    // a title is checked line by line (each fades on its own)
    const els = [...uiRoot.querySelectorAll('.cap, .title, .hero, .hud, .lbl, .txt')].filter(vis)
      .flatMap((el) => (el.classList.contains('title') ? [...el.querySelectorAll('.ln')].filter((l) => op(l) > 0.05) : [el]).map((p) => ({ el, kind: el.classList[0], text: p.textContent.trim().slice(0, 40), b: box(p) })));
    for (const e of els) {
      const { x, y, w: bw, h: bh } = e.b;
      if (x < edge || x + bw > W - edge) issues.push(`${e.kind} "${e.text}" runs off the side (x ${x.toFixed(0)}-${(x + bw).toFixed(0)})`);
      if (reel ? y < 200 && e.kind !== 'hud' : y < edge) issues.push(`${e.kind} "${e.text}" ${reel ? 'sits under the status bar / top UI' : `sits within ${edge} px of the top`} (y ${y.toFixed(0)})`);
      const floor = reel ? H - 380 : H - edge;
      if (y + bh > floor) issues.push(`${e.kind} "${e.text}" ${reel ? 'sits in the Reels caption band' : `sits within ${edge} px of the bottom`} (bottom ${(y + bh).toFixed(0)} > ${floor})`);
    }
    // Type over bright 3D. The 3D canvas (no UI in it; preserveDrawingBuffer) is drawn once into a quarter-size probe
    // (layout px / 4, whatever the render scale), and each visible box counts its share of bright pixels (AUDIT): a
    // caption over a glowing line or subject in the caption band, or a label, hero or title sitting on the subject.
    const QW = Math.round(W / 4), QH = Math.round(H / 4);
    probe.width = QW; probe.height = QH; pctx.drawImage(canvas, 0, 0, QW, QH);
    const img = pctx.getImageData(0, 0, QW, QH).data;
    const hot = (b, thr = 150) => {
      const x0 = Math.max(0, Math.floor(b.x / 4)), x1 = Math.min(QW, Math.ceil((b.x + b.w) / 4));
      const y0 = Math.max(0, Math.floor((b.y + b.e) / 4)), y1 = Math.min(QH, Math.ceil((b.y + b.h - b.e) / 4));
      if (x1 - x0 < 1 || y1 - y0 < 1) return 0;
      let n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * QW + x) * 4; if (0.2126 * img[i] + 0.7152 * img[i + 1] + 0.0722 * img[i + 2] > thr) n++; }
      return n / ((x1 - x0) * (y1 - y0));
    };
    for (const e of els) {
      const at = `y ${Math.round(e.b.y)}-${Math.round(e.b.y + e.b.h)}`;
      if (window.__auditDebug) issues.push(`debug ${e.kind} "${e.text}" ${(hot(e.b, 150) * 100).toFixed(1)}% above 150, ${(hot(e.b, 120) * 100).toFixed(1)}% above 120`);
      if (e.kind === 'cap') { const f = hot(e.b, AUDIT.capLuma); if (f > AUDIT.cap) issues.push(`cap "${e.text}" sits on bright 3D (${(f * 100).toFixed(0)}% of its box above luma ${AUDIT.capLuma}, over the ${(AUDIT.cap * 100).toFixed(0)}% allowed a caption): keep the caption band (${at}) to dark, defocused world while a caption is up, or shade it (post.captionShade)`); }
      else if (['lbl', 'hero', 'title'].includes(e.kind)) { const lim = e.kind === 'lbl' ? AUDIT.label : AUDIT.subject, f = hot(e.b, AUDIT.subjectLuma); if (f > lim) issues.push(`${e.kind} "${e.text}" sits on the subject (${(f * 100).toFixed(0)}% of its box above luma ${AUDIT.subjectLuma}, over the ${(lim * 100).toFixed(0)}% allowed ${e.kind === 'lbl' ? 'a label' : `a ${e.kind}`}): move it beside the subject${e.kind === 'lbl' ? ' (label({ avoid }))' : ''}`); }
    }
    // a label that is due while its anchor is off-screen or behind the camera (it shows nowhere, or flies off the side)
    for (const a of activeAt(t)) {
      if (!a.S.built || visFn(t, activeAt(t))(a.S) < 0.05) continue;
      for (const L of a.S.labels || []) {
        if (t < L.at || (L.until != null && t > L.until)) continue;
        let p;
        try { p = typeof L.anchor === 'function' ? L.anchor(t) : L.anchor.isVector3 ? L.anchor : L.anchor.getWorldPosition(new THREE.Vector3()); } catch { continue; }
        const s = a.S.project(p);
        if (s.behind || s.x < 0 || s.x > W || s.y < 0 || s.y > H) issues.push(`lbl "${L.text.slice(0, 40)}" is due but its anchor is off-screen (${s.behind ? 'behind the camera' : `x ${s.x.toFixed(0)}, y ${s.y.toFixed(0)}`}): end it with until, or frame its anchor`);
      }
    }
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
      const a = els[i].b, b = els[j].b;
      if (els[i].el !== els[j].el && a.x < b.x + b.w && b.x < a.x + a.w && a.y + a.e < b.y + b.h - b.e && b.y + b.e < a.y + a.h - a.e) issues.push(`${els[i].kind} "${els[i].text}" overlaps ${els[j].kind} "${els[j].text}"`);
    }
    return [...new Set(issues)];
  };
  window.__ready = true;
}

boot().catch((e) => { errors.push(String(e.stack || e)); window.__ready = 'error'; console.error(e); });
