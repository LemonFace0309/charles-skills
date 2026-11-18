// Small deterministic helpers shared by the engine and by shots. Everything here is a pure function of its inputs:
// no Date, no Math.random, no requestAnimationFrame. A shot that uses only these renders the same frame every time.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => (b === a ? 0 : clamp((x - a) / (b - a)));
export const smooth = (x) => x * x * (3 - 2 * x);
export const smoother = (x) => x * x * x * (x * (x * 6 - 15) + 10);

// Easing curves. Names match GSAP's so a shot can use either. "inOut" curves are the default for camera moves.
// Every curve is exactly 0 at 0 and 1 at 1, with no step next to either end (the Expo curves are rescaled for that:
// the textbook versions jump 0.05 to 0.1% of the range on the first or last frame, a visible pop on a big count).
const E10 = Math.pow(2, -10);
export const ease = {
  linear: (x) => x,
  inSine: (x) => (x >= 1 ? 1 : 1 - Math.cos((x * Math.PI) / 2)),
  outSine: (x) => Math.sin((x * Math.PI) / 2),
  inOutSine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
  inQuad: (x) => x * x,
  outQuad: (x) => 1 - (1 - x) * (1 - x),
  inOutQuad: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
  inCubic: (x) => x * x * x,
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outQuart: (x) => 1 - Math.pow(1 - x, 4),
  inOutQuart: (x) => (x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2),
  outQuint: (x) => 1 - Math.pow(1 - x, 5),
  inOutQuint: (x) => (x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2),
  outExpo: (x) => (x >= 1 ? 1 : (1 - Math.pow(2, -10 * x)) / (1 - E10)),
  inExpo: (x) => (x <= 0 ? 0 : (Math.pow(2, 10 * x - 10) - E10) / (1 - E10)),
  inOutExpo: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? (Math.pow(2, 20 * x - 10) - E10) / (2 - 2 * E10) : 1 - (Math.pow(2, 10 - 20 * x) - E10) / (2 - 2 * E10)),
  outBack: (x) => { if (x <= 0) return 0; const c1 = 1.20158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  // A critically damped settle: fast start, long soft landing. Good for things that arrive and rest.
  settle: (x) => (1 - (1 + 8 * x) * Math.exp(-8 * x)) / (1 - 9 * Math.exp(-8)),
};
export const easeFn = (e) => (typeof e === 'function' ? e : ease[e || 'inOutSine'] || ease.inOutSine);

// ramp(t, t0, t1, ease): 0 before t0, 1 after t1, eased in between. The workhorse for "this happens on that word".
export function ramp(t, t0, t1, e = 'inOutSine') {
  if (t1 <= t0) return t >= t0 ? 1 : 0;
  return easeFn(e)(invLerp(t0, t1, t));
}
// pulse(t, t0, rise, hold, fall): 0 -> 1 -> 0 envelope.
export function pulse(t, t0, rise = 0.15, hold = 0.2, fall = 0.4, e = 'inOutSine') {
  return ramp(t, t0, t0 + rise, e) * (1 - ramp(t, t0 + rise + hold, t0 + rise + hold + fall, e));
}
// keys(t, [[t0, v0], [t1, v1, ease], ...]): piecewise-eased keyframes for numbers or arrays of numbers.
export function keys(t, list, defEase = 'inOutSine') {
  if (!list.length) return 0;
  if (t <= list[0][0]) return list[0][1];
  for (let i = 1; i < list.length; i++) {
    const [t1, v1, e] = list[i];
    const [t0, v0] = list[i - 1];
    if (t <= t1) {
      const u = easeFn(e || defEase)(invLerp(t0, t1, t));
      return Array.isArray(v0) ? v0.map((a, j) => lerp(a, v1[j], u)) : lerp(v0, v1, u);
    }
  }
  return list[list.length - 1][1];
}

// Monotone cubic (Fritsch-Carlson) through points (xs[i], ys[i]), xs increasing: passes through every point, never
// overshoots or runs backwards between them, and its slope is continuous. A phase that speeds up and slows down on
// cue without ever reversing; cam.path's flow clock. Flat outside the first and last points.
export function monotone(xs, ys) {
  const n = xs.length - 1, d = [], m = new Array(n + 1);
  if (n < 1) return () => ys[0];
  for (let i = 0; i < n; i++) d.push((ys[i + 1] - ys[i]) / Math.max(xs[i + 1] - xs[i], 1e-9));
  m[0] = d[0]; m[n] = d[n - 1];
  for (let i = 1; i < n; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (3 * (xs[i + 1] - xs[i - 1])) / ((2 * xs[i + 1] - xs[i] - xs[i - 1]) / d[i - 1] + (xs[i + 1] + xs[i] - 2 * xs[i - 1]) / d[i]);
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n]) return ys[n];
    let lo = 0, hi = n - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (x > xs[mid]) lo = mid; else hi = mid - 1; } const i = lo; // binary search: tables of thousands of points
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

// Seeded random numbers (mulberry32). rng(seed)() -> [0,1).
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hash1 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// Smooth value noise in 1D, for organic drift (camera breathing, floating props). noise1(t*freq) in [-1, 1].
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const a = hash1(i + seed * 57.0) * 2 - 1, b = hash1(i + 1 + seed * 57.0) * 2 - 1;
  return lerp(a, b, smoother(f));
}

// Low-discrepancy sequences for sub-frame sampling.
export function halton(i, base) {
  let f = 1, r = 0;
  while (i > 0) { f /= base; r += f * (i % base); i = Math.floor(i / base); }
  return r;
}
// Concentric square-to-disk mapping (Shirley): uniform samples on a unit disk without clumping.
export function toDisk(u, v) {
  const a = 2 * u - 1, b = 2 * v - 1;
  if (a === 0 && b === 0) return [0, 0];
  let r, phi;
  if (Math.abs(a) > Math.abs(b)) { r = a; phi = (Math.PI / 4) * (b / a); }
  else { r = b; phi = Math.PI / 2 - (Math.PI / 4) * (a / b); }
  return [r * Math.cos(phi), r * Math.sin(phi)];
}

// Count-up formatting: fmtNum(1234567, {decimals:0}) -> "1,234,567".
export function fmtNum(v, { decimals = 0, comma = true, pad = 0 } = {}) {
  const s = Math.abs(v).toFixed(decimals);
  let [i, d] = s.split('.');
  if (pad) i = i.padStart(pad, '0');
  if (comma) i = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (v < 0 ? '-' : '') + i + (d ? '.' + d : '');
}
