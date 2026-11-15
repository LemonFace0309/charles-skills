// Hook, stage 3 (2.10 to 3.88 s, "sound by adding more sound."): the first thing the voice explains, square-on to
// the cup and the ear in section. The hum (cool) runs from the cup into the canal and shakes the eardrum. On "adding"
// the driver sends its own wave (amber) after it; on "sound." the two fall flat behind the amber front, all the way
// to the drum, which stops. The camera lands from the zoom and keeps a slow push.
import { section, curveWave } from '../lib/section.js';
import { HUM, HUM_CORE, ANTI, FLAT } from '../lib/colors.js';

export default async function (k) {
  const { THREE, scene, camera, cam, fx } = k;
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  k.env('night', 0.5);
  k.backdrop({ glow: 0.1, glowPos: [0.5, 0.5] });
  k.fog(0.3);
  k.post = { captionShade: 0.65 };                               // the lit cut faces reach the caption band
  const { mm, O, D, mid, path, ear, hp, driver } = await section(k);
  k.rig({ keyPos: [O.x - 0.5, O.y + 0.9, O.z + 0.6], rimPos: [O.x - 0.6, O.y + 0.5, O.z - 1.2], target: mid.toArray(), keyScale: 0.34, rimScale: 0.9, fillScale: 0.35, soft: 0.6, shadowSize: 1 });
  const pool = new THREE.PointLight('#ffd9b8', 0.045, 0.6, 2); pool.position.copy(path.getPointAt(0.5)).add(V(0, 0, 10 * mm)); scene.add(pool);
  const hum = curveWave(k, path, { color: HUM, coreColor: HUM_CORE, intensity: 4, radius: 0.4 * mm });
  const anti = curveWave(k, path, { color: ANTI, intensity: 5, radius: 0.4 * mm });
  const flat = curveWave(k, path, { color: FLAT, intensity: 3.2, radius: 0.4 * mm });
  for (const w of [hum, anti, flat]) { w.position.z = 0.6 * mm; scene.add(w); }
  flat.position.z = 0.75 * mm; // just in front where they meet
  const motes = fx.dust({ count: 160, center: [mid.x + 8 * mm, mid.y, O.z + 6 * mm], size: [90 * mm, 70 * mm, 30 * mm], pointSize: 0.0013, color: '#cfe2ff', intensity: 0.5, drift: [0.0004, 0.0002, 0] });
  scene.add(motes);

  const tA = k.word('adding'), tS = k.word('sound.');
  const A = 2.4 * mm, lam = 10 * mm, kk = (2 * Math.PI) / lam, len = path.getLength();
  const front = (t) => k.ramp(t, tA - 0.08, tS + 0.05, 'inOutSine');          // the amber front, 0..1 along the path
  const flatFront = (t) => k.ramp(t, tA + 0.2, tS + 0.3, 'inOutSine');        // the silence behind it
  // camera: square-on to the section, the whole path from the driver (right) to the drum (left) across 75% of the
  // width; landing from the zoom with a slow push
  const c0 = D.clone().lerp(driver, 0.5).add(V(0, -1 * mm, 0)), d0 = cam.fit(driver.distanceTo(D) / 2, { fill: 0.74, fov: 30 });
  return (t) => {
    const d = d0 * (1.12 - 0.07 * (t + 0.25));
    cam.apply(camera, { pos: c0.clone().add(V(1.5 * mm * (1 - t / 2), 0, d)), look: c0, fov: 30 }, { t, drift: 0.4 });
    camera.near = 0.005;
    const ph = 2 * Math.PI * 1.6 * (t + 2.1), u = front(t), uf = flatFront(t);
    const taper = (s) => Math.min(1, Math.max(0, (u * len - s) / (lam * 0.6)));
    const quiet = (s) => 1 - Math.min(1, Math.max(0, (uf * len - s) / (lam * 0.5)) );   // 0 where it has gone flat
    // ahead of the silence: the hum, and the amber wave up to its front; behind it: one flat line
    hum.set({ f: (s) => A * quiet(s) * Math.sin(kk * s - ph), from: uf, to: 1 });
    anti.set({ f: (s) => -A * quiet(s) * taper(s) * Math.sin(kk * s - ph), from: uf, to: Math.max(uf + 0.002, u) });
    anti.visible = u > uf + 0.002; hum.visible = uf < 0.998;
    flat.set({ f: () => 0, from: 0, to: Math.max(0.002, uf) }); flat.visible = uf > 0.01;
    hp.push(Math.sin(ph) * 0.9 * k.ramp(t, tA - 0.15, tA + 0.1));
    ear.setDrum(Math.sin(ph) * (1 - k.ramp(t, tS, tS + 0.3)), { glow: 0.15 });
    motes.at(t);
    k.lens = { blur: 0.008, focus: c0 };
  };
}
