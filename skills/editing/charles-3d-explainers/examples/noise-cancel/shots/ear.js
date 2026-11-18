// One follow move (17.60 to 24.66 s): "The speaker plays this inverted wave into your ear. The two waves cancel out.
// That's destructive interference." The cup and the ear in section. The cabin's hum (cool) already runs through the
// cup and down the canal, shaking the eardrum. On "plays" the driver pushes the inverted wave (amber) out; the camera
// rides its front across the cup and into the canal, and lands square-on to it as the front reaches the drum on
// "ear". The teaching frame: the two waves, mirror images in the canal, named in their colours on "two waves"; on
// "cancel" they collapse into one flat white line and the drum stops; on "out" a bead of light runs the line to the
// drum. Held 1.5 s; the term lands as a label; then the camera pulls back to show the cup.
import { section, curveWave } from '../lib/section.js';
import { HUM, HUM_CORE, ANTI, FLAT } from '../lib/colors.js';

export default async function (k) {
  const { THREE, scene, camera, cam, fx, glow } = k;
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  k.env('night', 0.25);
  k.backdrop({ glow: 0.1, glowPos: [0.5, 0.5] });
  k.fog(0.3);
  k.post = { vignette: 0.95, captionShade: 0.75 };                                    // dark corners round a frame the section fills
  const { mm, O, D, mid, path, ear, hp, driver } = await section(k);
  // light grazing the section from above-front (a flat face lit head-on reads as a pale wall), a cool rim behind,
  // and the pool of light the waves throw on the section round them
  k.rig({ keyPos: [O.x - 0.5, O.y + 0.9, O.z + 0.6], rimPos: [O.x - 0.6, O.y + 0.5, O.z - 1.2], target: mid.toArray(), keyScale: 0.22, rimScale: 0.9, fillScale: 0.18, soft: 0.6, shadowSize: 1 });
  const pool = new THREE.PointLight('#ffd9b8', 0, 0.6, 2); scene.add(pool);

  const hum = curveWave(k, path, { color: HUM, coreColor: HUM_CORE, intensity: 4, radius: 0.32 * mm });
  const anti = curveWave(k, path, { color: ANTI, intensity: 5, radius: 0.32 * mm });
  const flat = curveWave(k, path, { color: FLAT, intensity: 3.2, radius: 0.32 * mm });
  for (const w of [hum, anti, flat]) { w.position.z = 0.6 * mm; scene.add(w); }
  flat.position.z = 0.75 * mm; // in front of the two while they fade into it
  // on "out" a bright bead runs the flat line from the cup to the drum: the silence arriving
  const bead = glow.pulse(path, { size: 0.9 * mm, intensity: 16, tailLength: 6 * mm, color: '#ffffff', fade: 0.1 }); bead.position.z = 0.9 * mm; scene.add(bead);
  const motes = fx.dust({ count: 160, center: [mid.x + 8 * mm, mid.y, O.z + 5 * mm], size: [80 * mm, 60 * mm, 24 * mm], pointSize: 0.0012, color: '#cfe2ff', intensity: 0.5, drift: [0.0004, 0.0002, 0] });
  scene.add(motes);

  const tPlay = k.word('plays'), tEar = k.word('ear.'), tTwo = k.word('two waves'), tC = k.word('cancel') + 0.05, tOut = k.word('out.'), tI = k.word('destructive');
  const A = 2.4 * mm, lam = 10 * mm, w = 2 * Math.PI * 1.6, kk = (2 * Math.PI) / lam; // schematic: 2.5 crests in the canal
  const front = (t) => k.ramp(t, tPlay - 0.05, tEar + 0.05, 'inOutSine');               // the amber wave's front, 0..1 along the path
  k.ui.label('Speaker', { anchor: hp.anchor('driverL'), side: 'right', offset: [150, -40], at: k.word('speaker') - 0.1, until: tPlay + 0.9 });
  k.ui.label('Eardrum', { anchor: D.clone().add(V(0, -2.5 * mm, 0.6 * mm)), side: 'below', offset: [0, 90], at: tEar - 0.15, until: tTwo - 0.15 });
  // "The two waves": name them, in their own colours, above and below the canal; they go when the waves cancel
  const cm = path.getPointAt(0.66);
  k.ui.label('<span style="color:#8fd0ff">hum</span>', { anchor: cm.clone().add(V(0, 4.2 * mm, 0.6 * mm)), side: 'above', offset: [0, 40], at: tTwo - 0.05, until: tC + 0.15, dot: false });
  k.ui.label('<span style="color:#ffc46a">inverted copy</span>', { anchor: cm.clone().add(V(0, -4.2 * mm, 0.6 * mm)), side: 'below', offset: [0, 40], at: tTwo + 0.25, until: tC + 0.15, dot: false });
  k.ui.label('Destructive<br>interference', { anchor: path.getPointAt(0.62).add(V(0, 0, 0.6 * mm)), side: 'above', offset: [0, 110], at: tI - 0.05, until: k.dur - 0.5, dot: false });

  // camera: starts wide on the cup (the driver at the right of frame), rides the amber front along the path (in
  // front of the section plane, looking at the front), lands square-on to the canal, drifts with the waves, then
  // pulls back from "interference" to show the cup that made the second wave
  const c0 = D.clone().lerp(O, 0.56).add(V(0, -0.5 * mm, 0)), d0 = cam.fit(O.distanceTo(D) / 2, { fill: 0.7, fov: 30 });
  const ride = (t) => {
    const u = front(t), P = path.getPointAt(Math.min(0.999, u));
    const look = P.clone().lerp(c0, k.ramp(t, tEar - 0.6, tEar + 0.3, 'inOutSine'));
    const d = k.lerp(d0 * 1.9, d0, k.ramp(t, -0.4, tEar + 0.2, 'inOutSine'));
    const side = V(14 * mm, 4 * mm, 0).multiplyScalar(1 - k.ramp(t, -0.4, tEar, 'inOutSine')); // starts a little right of and above it
    return { pos: look.clone().add(side).add(V(0, 0, d)), look, fov: 30 };
  };
  const hold = cam.path([
    { t: tEar + 0.3, pos: c0.clone().add(V(0, 0, d0)), look: c0.clone(), fov: 30 },
    { t: tI + 0.25, pos: c0.clone().add(V(-1.5 * mm, 0.3 * mm, d0 * 0.95)), look: c0.clone().add(V(-1.5 * mm, 0.3 * mm, 0)), fov: 30 },
    { t: k.dur + 0.4, pos: c0.clone().add(V(10 * mm, 2.5 * mm, d0 * 1.8)), look: c0.clone().add(V(10 * mm, 1.5 * mm, 0)), fov: 30 },
  ], { flow: true });
  return (t) => {
    const P = t < tEar + 0.3 ? ride(t) : hold.at(t);
    cam.apply(camera, P, { t, drift: 0.4 });
    camera.near = 0.005;
    const ph = w * t, u = front(t);
    const c = k.ramp(t, tC - 0.05, tC + 0.3, 'inOutSine');                           // the collapse
    const amp = A * (1 - c);
    hum.set({ f: (s) => amp * Math.sin(kk * s - ph), from: 0, to: 1 });
    // the inverted wave: out of the driver up to its front, its leading crest tapering in
    const taper = (s) => Math.min(1, Math.max(0, (u * path.getLength() - s) / (lam * 0.6)));
    anti.set({ f: (s) => -amp * Math.sin(kk * s - ph) * taper(s), from: 0, to: Math.max(0.002, u) });
    anti.visible = u > 0.002 && c < 0.99; hum.visible = c < 0.99;
    const two = 1 + 0.9 * k.pulse(t, tTwo - 0.05, 0.08, 0.15, 0.35);                  // both flare on "two waves"
    hum.setIntensity(4 * two * (1 - c) + 0.01); anti.setIntensity(5 * two * (1 - c) + 0.01);
    flat.set({ f: () => 0, from: 0, to: 1 }); flat.setIntensity(4 * k.ramp(t, tC + 0.1, tC + 0.45)); flat.visible = t > tC + 0.1;
    pool.position.copy(path.getPointAt(Math.min(0.999, Math.max(u, 0.55)))).add(V(0, 0, 9 * mm));
    pool.intensity = 0.03 * (1 - 0.25 * c);
    const b = k.ramp(t, tOut - 0.2, tOut + 0.45, 'inOutSine'); bead.place(b > 0 && b < 1 ? b : -1);
    ear.setDrum(Math.sin(ph) * (1 - c), { glow: 0.2 * (1 - c) + 0.5 * k.pulse(t, tOut + 0.5, 0.08, 0.1, 0.4) }); // the drum glows once as the silence reaches it
    hp.push(Math.sin(ph) * 0.9 * k.ramp(t, tPlay - 0.15, tPlay + 0.1));
    motes.at(t);
    k.lens = { blur: 0.01, focus: P.look };
  };
}
