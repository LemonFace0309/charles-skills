// "But the flight attendant's voice still gets through." (29.70 to 32.28 s). One follow move. From the viewer's seat
// the camera looks up at the service panel over it (reading light on, shades drawn); the call button's figure lights
// on her word; on "voice" her announcement leaves the speaker grille, a short, quick wave (pale), and the camera
// whip-tilts down after it to the headphones on the tray, where it goes on through the cup. The tilt ends before the
// wave arrives, so the wave never crosses the caption band.
import { cabin, nightSky, callPanel, HP_POS } from '../lib/cabin.js';
import { curveWave } from '../lib/section.js';
import { VOICE } from '../lib/colors.js';

export default async function (k) {
  const { THREE, scene, camera, cam, fx } = k;
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  k.env('night', 0.55);
  k.fog(0.7);
  k.post = { captionShade: 0.8 };                               // the tilt brings the lit tray up through the caption band
  scene.add(nightSky(k));
  const C = cabin(k, { rows: [-3, 2], windows: [-4, 4], shades: 0.8 }); // shades drawn: the tilt passes the windows
  const hp = C.hp;
  const panel = callPanel(k);
  k.rig({ keyPos: [-1.0, 2.1, 0.4], rimPos: [-2.4, 1.3, -1.2], target: [-1.35, 1.1, -0.2], keyScale: 0.22, rimScale: 0.8, fillScale: 0.55, soft: 0.6, shadowSize: 2 });
  k.look.productLight(scene, hp, { intensity: 1.5 });
  // the viewer's reading light is on: a cool spot from the panel onto the tray, which also lifts the panel round it
  const reading = new THREE.SpotLight('#e8eeff', 0.16, 2.2, 0.38, 0.7, 2); reading.position.copy(panel.lamp).add(V(0, -0.02, 0));
  reading.target.position.copy(V(...HP_POS)); scene.add(reading, reading.target);
  const bounce = new THREE.PointLight('#aab8ff', 0.05, 0.8, 2); bounce.position.copy(panel.button).add(V(0.05, -0.25, 0.15)); scene.add(bounce);
  hp.updateMatrixWorld(true);
  const cup = hp.localToWorld(V(0.12, 0.02, 0));                 // the left cup's outer face
  // the voice's path: out of the grille, down past the window to the cup, on through it into the tray
  const path = new THREE.CatmullRomCurve3([panel.speaker.clone().add(V(0, -0.01, 0)), V(-1.33, 1.25, -0.1), cup.clone().add(V(0.05, 0.12, 0.05)), cup.clone(), cup.clone().add(V(-0.12, -0.06, -0.06))], false, 'centripetal');
  const len = path.getLength(), lam = 0.03, kk = (2 * Math.PI) / lam, A = 0.011;
  // a wave laid along a curve, rebuilt each frame (curveWave, the section shots' helper)
  const wave = curveWave(k, path, { color: VOICE, intensity: 4.5, radius: 0.0022, segments: 500 });
  scene.add(wave);
  const motes = fx.dust({ count: 220, center: [-1.3, 1.15, -0.1], size: [0.8, 0.9, 1.0], pointSize: 0.006, color: '#d8e4ff', intensity: 0.6, drift: [0.004, -0.002, 0.006] });
  scene.add(motes);

  const tFA = k.word('flight attendant\'s'), tV = k.word('voice'), tG = k.word('gets');
  const front = (t) => k.ramp(t, tV - 0.08, tG + 0.85, 'inOutSine');                     // the voice's front, 0..1 along its path
  // the label names her at the call button, then rides her voice's front down to the headphones
  k.ui.label('Flight attendant', { anchor: panel.button, side: 'left', offset: [200, 0], at: tFA - 0.16, until: tV + 0.22 }); // clear of the button's ring; gone before the tilt takes the button off-screen
  // camera: from the seat looking up at the panel, then tilting down with the front to the headphones
  const eye = V(-1.05, 1.1, 0.06);                               // the middle seat's eyes, in front of its headrest
  return (t) => {
    const u = front(t);
    // one smooth tilt from the panel down to the headphones, starting as the voice leaves the grille
    const tilt = k.ramp(t, tV + 0.12, tG + 0.7, 'inOutSine');                  // after the voice leaves the grille; done before its front reaches the cup
    const look = panel.button.clone().lerp(panel.lamp, 0.4).add(V(0, -0.1, 0.02)).lerp(V(...HP_POS).add(V(0.02, -0.04, 0)), tilt); // the panel in the upper half; the headphones end above the caption band
    const pos = eye.clone().add(V(0.05 * t, -0.06 * tilt, -0.03 * t));
    cam.apply(camera, { pos, look, fov: 38 }, { t, drift: 0.4 });
    panel.set(k.ramp(t, tFA - 0.1, tFA + 0.15));
    wave.set({ f: (s) => A * Math.sin(kk * s - 2 * Math.PI * 3 * t) * Math.min(1, s / 0.04) * Math.min(1, Math.max(0, (u * len - s) / 0.05)), from: 0, to: Math.max(0.002, u) });
    wave.visible = u > 0.002;
    motes.at(t);
    k.lens = { blur: 0.012, focus: look };
  };
}
