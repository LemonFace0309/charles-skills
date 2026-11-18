// Hook, stage 2 (1.26 to 2.10 s, "headphones erase"): through the cup. The zoom lands inside the left cup, cut open
// over the ear: foam, shell and the driver in section, the cabin's hum (cool) already running through the cup's air
// into the canal. The camera keeps diving at the air in front of the driver; on "erase" the driver kicks and glows
// (it is about to answer), and the next zoom carries the dive on to the waves.
import { section, curveWave } from '../lib/section.js';
import { HUM, HUM_CORE, ANTI } from '../lib/colors.js';

export default async function (k) {
  const { THREE, scene, camera, cam, fx } = k;
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  k.env('night', 0.55);
  k.backdrop({ glow: 0.12, glowPos: [0.55, 0.5] });
  k.fog(0.3);
  k.post = { captionShade: 0.65 };                               // the lit cut faces reach the caption band
  const { mm, O, path, ear, hp, driver } = await section(k);
  k.rig({ keyPos: [O.x + 0.4, O.y + 0.9, O.z + 0.8], rimPos: [O.x - 0.6, O.y + 0.6, O.z - 1.2], target: driver.toArray(), keyScale: 0.55, rimScale: 1.2, fillScale: 0.45, soft: 0.6, shadowSize: 1 });
  const hum = curveWave(k, path, { color: HUM, coreColor: HUM_CORE, intensity: 4, radius: 0.4 * mm });
  hum.position.z = 0.6 * mm; scene.add(hum);
  const dGlow = fx.glowSprite({ color: ANTI, intensity: 0, size: 26 * mm }); dGlow.position.copy(driver).add(V(-1 * mm, 0, 1.5 * mm)); scene.add(dGlow);
  const motes = fx.dust({ count: 160, center: [driver.x, driver.y, O.z + 10 * mm], size: [90 * mm, 70 * mm, 40 * mm], pointSize: 0.0014, color: '#cfe2ff', intensity: 0.5, drift: [0.0005, 0.0003, 0] });
  scene.add(motes);

  const tE = k.word('erase');
  // the dive: from above-right and in front of the cut (the cup about 110 mm across the frame; 1 unit is 120 mm
  // here), accelerating at the air in front of the driver (about 150%/s by the next zoom)
  const aim = driver.clone().lerp(O, 0.45);
  const dir = V(0.5, 0.32, 1).normalize(), d0 = 3.0;
  return (t) => {
    const s = Math.max(0, t + 0.25), d = d0 * Math.exp(-0.7 * s - 0.35 * s * s);
    const pos = aim.clone().addScaledVector(dir, d);
    cam.apply(camera, { pos, look: aim, fov: 30 }, { t, drift: 0.4 });
    camera.near = Math.max(0.0005, d * 0.05);
    const ph = 2 * Math.PI * 1.6 * (t + 1.26);
    hum.set({ f: (s) => 2.4 * mm * Math.sin(((2 * Math.PI) / (10 * mm)) * s - ph), from: 0, to: 1 });
    const kick = k.pulse(t, tE - 0.1, 0.1, 0.15, 0.35);
    hp.push(Math.sin(ph * 1.3) * 0.4 + kick);
    dGlow.setIntensity(2.5 * kick);
    ear.setDrum(Math.sin(ph), { glow: 0.15 });
    motes.at(t);
    k.lens = { blur: 0.014, focus: aim };
  };
}
