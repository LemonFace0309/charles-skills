// "That hum is a pressure wave, air squeezing and stretching." (7.52 to 10.98 s). Above the viewer's row, square-on
// to the window wall: the hum (cool) travels down the cabin over the headrests, towards the back of the plane and the
// viewer's seat (right to left). On "air" the air itself lights up: a loose grid of motes that bunches into squeezes
// where the wave crests and spreads into stretches where it dips (each mote moves back and forth along the way the
// wave travels: the textbook picture). The two words land as labels on a squeeze and a stretch. The camera trucks
// slowly with the wave.
import { cabin, nightSky } from '../lib/cabin.js';
import { HUM, HUM_CORE } from '../lib/colors.js';

export default async function (k) {
  const { THREE, scene, camera, cam, glow, fx } = k;
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  k.env('night', 0.55);
  k.fog(0.8);
  scene.add(nightSky(k));
  cabin(k, { rows: [-4, 3], windows: [-6, 6] });
  k.rig({ keyPos: [-0.6, 2.1, 0.4], rimPos: [-2.4, 1.6, -1.4], target: [-1.0, 1.2, -0.3], keyScale: 0.2, rimScale: 0.6, fillScale: 0.45, soft: 0.6, shadowSize: 2 });

  // the wave runs along +z over the middle seats' headrests; theta = kz - wt, the line is the pressure A sin(theta)
  const X = -1.02, Y = 1.36, z0 = -1.05, z1 = 0.45, L = z1 - z0, lam = 0.15, kk = (2 * Math.PI) / lam, w = 2 * Math.PI * 0.5, A = 0.03;
  const line = glow.wave({ length: L, amp: A, wavelength: lam, radius: 0.0032, color: HUM, coreColor: HUM_CORE, intensity: 4 });
  line.rotation.y = Math.PI / 2;                     // local x along world -z: z = mid - x
  line.position.set(X, Y, (z0 + z1) / 2); scene.add(line);
  // the air: motes on a loosely jittered grid round the line (columns 1 cm apart along z, 9 rows, 2 layers deep),
  // each displaced along z by a cos(theta): the columns bunch where the line crests and spread where it dips, the
  // textbook picture of a sound wave
  const cols = Math.round(L / 0.01), rows = 9, N = cols * rows * 2, R = k.rng(5);
  const air = fx.dust({ count: N, center: [X, Y, (z0 + z1) / 2], size: [0.01, 0.01, 0.01], pointSize: 0.0046, color: '#d6e9ff', intensity: 0.9, drift: [0, 0, 0] });
  const home = air.geometry.attributes.position.array;
  for (let i = 0; i < N; i++) {
    const c = i % cols, r = Math.floor(i / cols) % rows, l = Math.floor(i / (cols * rows));
    home[i * 3] = X + (l - 0.5) * 0.03 + (R() - 0.5) * 0.008;
    home[i * 3 + 1] = Y + (r - (rows - 1) / 2) * 0.016 + (R() - 0.5) * 0.004;
    home[i * 3 + 2] = z0 + (c + 0.5) * 0.01 + (R() - 0.5) * 0.003;
  }
  // fx.dust's shader adds a fixed wobble of 0.06 units per mote (sin(t * .37 + seed * 40) ...), 6 cm at this scale:
  // its clock stays at 0 (air.at is never called) and that static offset is taken off each mote's position
  const seed = air.geometry.attributes.aSeed.array;
  const wob = (i) => [Math.sin(seed[i] * 40) * 0.06, Math.cos(seed[i] * 17) * 0.06, Math.sin(seed[i] * 9) * 0.06];
  const base = home.slice();
  for (let i = 0; i < N; i++) { const [wx, wy] = wob(i); home[i * 3] -= wx; home[i * 3 + 1] -= wy; }
  scene.add(air);
  const tW = k.word('pressure'), tAir = k.word('air'), tSq = k.word('squeezing'), tSt = k.word('stretching.');
  const th = (z, t) => kk * z - w * t;
  // the crest and the trough nearest the middle of the frame, as anchors for the labels (they ride the wave)
  const zc = (t) => -0.33 + 0.12 * k.ramp(t, -0.3, k.dur + 0.3);
  const near = (t, phase) => { const n = Math.round((kk * zc(t) - w * t - phase) / (2 * Math.PI)); return (phase + 2 * Math.PI * n + w * t) / kk; };
  k.ui.label('squeeze', { anchor: (t) => V(X, Y + A, near(t, Math.PI / 2)), side: 'above', offset: [0, 60], at: tSq - 0.08, until: k.dur + 0.2, dot: false });
  k.ui.label('stretch', { anchor: (t) => V(X, Y - A, near(t, -Math.PI / 2) + lam), side: 'below', offset: [0, 60], at: tSt - 0.08, until: k.dur + 0.2, dot: false });

  return (t) => {
    const look = V(X, Y - 0.02, zc(t));
    cam.apply(camera, { pos: look.clone().add(V(1.2, 0.04, 0)), look, fov: 32 }, { t, drift: 0.45 });
    // the line: draws on from the front (right of frame) along the way it travels, then keeps travelling
    const on = k.ramp(t, -0.3, 0.6);
    line.set({ fn: (x) => A * Math.sin(th((z0 + z1) / 2 - x, t)), from: 1 - on, to: 1 });
    line.setIntensity(3 + 2.5 * k.pulse(t, tW - 0.1, 0.2, 0.5, 0.6));
    // the air, faint until "air", then lit
    const p = air.geometry.attributes.position, a = 0.016; // a k = 0.67: squeezes 3x denser than stretches
    for (let i = 0; i < N; i++) { const z = base[i * 3 + 2]; p.array[i * 3 + 2] = z + a * Math.cos(th(z, t)) - wob(i)[2]; }
    p.needsUpdate = true;
    air.material.uniforms.uIntensity.value = 0.3 + 1.1 * k.ramp(t, tAir - 0.15, tAir + 0.3);
    k.lens = { blur: 0.014, focus: look };
  };
}
