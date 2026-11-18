// "On a plane, the cabin hums at about 80 decibels." (3.88 to 7.52 s). The zoom steps back out of the ear onto the
// hero's own angle (the headphones on the tray before the window), then the camera cranes up and round to the whole
// cabin at night: rows of seats, the bins, the windows with their sunset line. On "hums" the hum shows itself: cool
// rings spreading over the seat backs from the wall by the wing. On "80" the number lands over the scene that makes it.
import { cabin, nightSky, HP_POS } from '../lib/cabin.js';
import { HUM } from '../lib/colors.js';

export default async function (k) {
  const { THREE, scene, camera, cam, glow, fx } = k;
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  k.env('night', 0.45);
  k.fog(1.0);
  scene.add(nightSky(k));
  const C = cabin(k, { rows: [-9, 3], windows: [-14, 6] });
  k.rig({ keyPos: [0, 2.15, -2], rimPos: [-1.6, 1.4, -9], target: [-0.8, 0.9, -3], keyScale: 0.25, rimScale: 0.5, fillScale: 1.0, soft: 0.8, shadowSize: 6 });
  k.look.productLight(scene, C.hp, { intensity: 16 });
  // the hum: rings of a steady source by the wall at the wing, flat at shoulder height, spreading over the seat backs
  const hum = glow.waveField({ radius: 3.4, color: HUM, wavelength: 0.55, width: 0.05, speed: 0.9, intensity: 1.8, falloff: 1.6 });
  hum.position.set(-1.7, 1.18, -2.6); scene.add(hum);
  const motes = fx.dust({ count: 500, center: [-0.6, 1.3, -3.5], size: [3.2, 1.4, 8], pointSize: 0.01, color: '#cdd9ff', intensity: 0.5, drift: [0.01, 0.004, 0.02] });
  scene.add(motes);

  const tHum = k.word('hums'), t80 = k.word('80');
  k.ui.hero('', { at: t80 - 0.15, until: k.dur - 0.25, y: 300, unit: 'dB', sub: 'of engine drone, all flight', count: { range: [0, 80], dur: 0.25, ease: 'outCubic' } });
  // camera: a crane. It lands from the zoom out in the aisle on the hero's own angle (the headphones on the tray, the
  // window behind), then rises and turns to look down the cabin, so the headphones slide out low left as the rows
  // appear; the rings and the number get the last two seconds. (Above y 1.6 the bins fill x < -0.88: keep clear.)
  const hpAt = V(...HP_POS).add(V(0, 0.08, 0));
  const move = cam.path([
    { t: -0.3, pos: [0.0, 0.98, -0.28], look: hpAt.clone(), fov: 34 },
    { t: 1.0, pos: [-0.08, 1.5, 0.2], look: [-1.1, 1.0, -0.95], fov: 38 },
    { t: k.dur + 0.3, pos: [-0.18, 1.85, 1.05], look: [-0.85, 1.05, -3.3], fov: 42 },
  ], { flow: true, ease: 'inOutSine' });
  return (t) => {
    move.apply(camera, t, { t, drift: 0.4 });
    hum.set({ time: t, start: tHum - 0.15 });
    motes.at(t);
    k.lens = { blur: 0.006, focus: move.at(t).look };
  };
}
