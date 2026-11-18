// "so some headphones adjust 50,000 times a second." (26.22 to 29.70 s). The zoom lands back on the chip. The hum
// (cool) above it keeps changing; under it the chip's inverted copy (amber) is a staircase of samples, rewritten in
// sweeps that run along it, so it keeps catching up with the hum's new shape. On "adjust" the sweeps start; the number
// lands on "50,000" and the sweeps blur into a shimmer as they speed up.
import { chipSet } from '../lib/chip.js';
import { HUM, HUM_CORE, ANTI } from '../lib/colors.js';

export default async function (k) {
  const { THREE, scene, camera, cam, glow, fx } = k;
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  k.env('night', 0.8);
  k.backdrop({ glow: 0.05 });
  k.fog(0.2);
  const { chipTop } = chipSet(k);
  k.rig({ keyPos: [-2, 9, 4], rimPos: [3, 4, -9], target: chipTop.toArray(), keyScale: 0.35, rimScale: 1.0, fillScale: 0.45, soft: 0.8, shadowSize: 6 });
  k.look.productLight(scene, chipTop, { radius: 1.2, intensity: 14 });

  const L = 3.3, top = 1.0, bot = 0.0;
  const lanes = new THREE.Group(); lanes.position.copy(chipTop).add(V(0, 0.95, 0)); scene.add(lanes);
  // camera: a 30 degree orbit with a push
  const camAt = (t) => { const az = THREE.MathUtils.degToRad(16 - 9 * t), el = THREE.MathUtils.degToRad(27 + 2 * t), d = 17.5 - 1.1 * t; return V(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d).add(lanes.position); };
  lanes.lookAt(camAt(1.6));
  const hum = glow.wave({ length: L, radius: 0.028, color: HUM, coreColor: HUM_CORE, intensity: 4 }); hum.position.y = top; lanes.add(hum);
  const anti = glow.wave({ length: L, radius: 0.026, color: ANTI, intensity: 5, segments: 600 }); anti.position.y = bot; lanes.add(anti);
  const sweepDot = fx.glowSprite({ color: '#ffe2b0', intensity: 0, size: 0.3 }); lanes.add(sweepDot);
  const chipGlow = fx.glowSprite({ color: ANTI, intensity: 0, size: 1.0 }); chipGlow.position.copy(chipTop).add(V(0, 0.05, 0)); scene.add(chipGlow);
  const warm = new THREE.PointLight(ANTI, 0.7, 4, 2); warm.position.copy(lanes.position).add(V(0, 0.1, 0.4)); scene.add(warm);

  const tAdj = k.word('adjust'), t50 = k.word('50,000');
  k.ui.hero('', { at: t50 - 0.18, until: k.dur - 0.25, y: 300, unit: '/s', sub: 'new inverted waves', count: { range: [0, 50000], dur: 0.25, ease: 'outCubic' } });
  // the hum: its shape wanders (wavenumber and amplitude), smooth in time
  const kOf = (t) => (2 * Math.PI) / 1.3 * (1 + 0.1 * Math.sin(1.2 * t + 0.4));    // subtle: a wavenumber drift moves the far steps a lot
  const aOf = (t) => 0.3 * (1 + 0.3 * Math.sin(2.3 * t + 1.2));
  const humY = (x, t) => aOf(t) * Math.sin(kOf(t) * x - 0.35 * t);
  // the staircase: 44 samples; a sweep runs along it again and again, each sweep taking T seconds (T shrinking from 0.9
  // on "adjust" to 0.12 by "50,000"), and each step holds the inverted hum as it was when a sweep last passed it. The
  // sweeps' phase is the integral of 1 / T (tabulated once at build, so update stays pure): phase n + f is the moment
  // sweep n passes the fraction f of the lane.
  const n = 44, dx = L / n;
  const T = (t) => k.lerp(0.6, 0.12, k.ramp(t, tAdj, t50 + 0.2, 'outCubic'));   // fast early: slow sweeps leave big steps
  const ts0 = tAdj - 0.3, step = 0.002, ph = [0];
  for (let t = ts0 + step; t <= k.dur + 0.6; t += step) ph.push(ph[ph.length - 1] + step / T(t - step / 2));
  const phaseAt = (t) => { const x = Math.max(0, (t - ts0) / step), i = Math.min(ph.length - 2, Math.floor(x)); return k.lerp(ph[i], ph[i + 1], Math.min(1, x - i)); };
  const timeAt = (p) => { let lo = 0, hi = ph.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ph[m] <= p) lo = m; else hi = m; } return ts0 + (lo + (p - ph[lo]) / Math.max(1e-9, ph[hi] - ph[lo])) * step; };
  const vals = new Float32Array(n);
  return (t) => {
    cam.apply(camera, { pos: camAt(t), look: lanes.position.clone().add(V(0, -0.2, 0)), fov: 30 }, { t, drift: 0.45 });
    hum.set({ fn: (x) => humY(x, t) });
    const live = k.ramp(t, tAdj - 0.15, tAdj + 0.1);
    // each step: the inverted hum as it was when the last sweep passed it, eased in from the sweep before (0.1 s)
    const p = phaseAt(t);
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n, xs = -L / 2 + (i + 0.5) * dx, last = Math.floor(p - f);
      const tNow = Math.min(t, timeAt(last + f)), tPrev = timeAt(Math.max(0, last - 1 + f));
      vals[i] = k.lerp(-humY(xs, tPrev), -humY(xs, tNow), k.ramp(t - tNow, 0, 0.1));
    }
    anti.set({ fn: (x) => {                                           // before "adjust": a smooth copy, no steps yet
      const i = Math.min(n - 1, Math.max(0, Math.floor((x + L / 2) / dx)));
      return k.lerp(-humY(x, t), vals[i], live);
    } });
    const xf = ((p % 1) + 1) % 1;                                     // where the current sweep is
    sweepDot.position.set(-L / 2 + xf * L, bot + 0.0, 0.03); sweepDot.setIntensity(4 * live * Math.sin(Math.PI * xf) * k.clamp((T(t) - 0.25) / 0.25)); // fades at both ends, and out once the sweeps blur
    chipGlow.setIntensity(0.5 + 1.0 * live * (0.7 + 0.3 * Math.sin(t * 14)));
    k.lens = { blur: 0.016, focus: lanes.position };
  };
}
