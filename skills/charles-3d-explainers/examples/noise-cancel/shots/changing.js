// "The hum keeps changing," (24.66 to 26.22 s). Chapter two opens on a light transition, back in the cabin over the
// viewer's row (lower than before; the shades round here are drawn, so no sunset line sits behind the caption): the
// hum (cool) travels down the cabin as before, then on "changing" it changes: its pitch rises and falls and it swells
// and fades, the way an engine's drone wanders through a flight.
import { cabin, nightSky } from '../lib/cabin.js';
import { HUM, HUM_CORE } from '../lib/colors.js';

export default async function (k) {
  const { THREE, scene, camera, cam, glow, fx } = k;
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  k.env('night', 0.55);
  k.fog(0.8);
  scene.add(nightSky(k));
  cabin(k, { rows: [-4, 3], windows: [-6, 6], shades: 0.62 }); // shades drawn: no bright horizon behind the caption
  k.rig({ keyPos: [-0.6, 2.1, 0.4], rimPos: [-2.4, 1.6, -1.4], target: [-1.0, 1.2, -0.3], keyScale: 0.2, rimScale: 0.6, fillScale: 0.45, soft: 0.6, shadowSize: 2 });
  const motes = fx.dust({ count: 260, center: [-1.0, 1.3, -0.3], size: [1.0, 0.6, 1.6], pointSize: 0.006, color: '#cfe0ff', intensity: 0.6, drift: [0.004, 0.002, 0.01] });
  scene.add(motes);

  const X = -1.08, Y = 1.3, z0 = -1.1, z1 = 0.5, L = z1 - z0;
  const line = glow.wave({ length: L, radius: 0.0034, color: HUM, coreColor: HUM_CORE, intensity: 4.2 });
  line.rotation.y = Math.PI / 2; line.position.set(X, Y, (z0 + z1) / 2); scene.add(line);
  const tC = k.word('changing,');
  // the change: wavenumber and amplitude wander from "changing" on (smooth, so crests never jump)
  const ch = (t) => k.ramp(t, tC - 0.25, tC + 0.25);
  const kOf = (t) => (2 * Math.PI) / 0.15 * (1 + ch(t) * (0.45 * Math.sin(2.2 * (t - tC)) + 0.25));
  const aOf = (t) => 0.03 * (1 + ch(t) * 0.6 * Math.sin(3.1 * (t - tC) + 0.8));
  return (t) => {
    const s = k.ramp(t, -0.4, k.dur + 0.4, 'linear');
    const look = V(X, Y - 0.03, k.lerp(-0.5, -0.24, s));
    cam.apply(camera, { pos: look.clone().add(V(1.15, -0.12, 0.05)), look, fov: 34 }, { t, drift: 0.45 });
    const kk = kOf(t), A = aOf(t), ph = 2 * Math.PI * 0.55 * t;
    line.set({ fn: (x) => A * Math.sin(kk * ((z0 + z1) / 2 - x) - ph), from: 0, to: 1 });
    motes.at(t);
    k.lens = { blur: 0.014, focus: look };
  };
}
