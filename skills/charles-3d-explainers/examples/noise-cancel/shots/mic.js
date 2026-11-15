// "Microphones on your headphones catch it." (10.98 to 13.28 s). The zoom lands on the left cup: its outer shell and
// the microphone port in it. The hum arrives from the right; the mic ring lights on "Microphones" and a label names
// it; on "catch" the wave flattens into the port and is gone, the ring flashing as it takes it.
import { cabin, nightSky, HP_POS } from '../lib/cabin.js';
import { HUM, HUM_CORE } from '../lib/colors.js';

export default async function (k) {
  const { THREE, scene, camera, cam, glow, fx } = k;
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  k.env('night', 0.6);
  k.fog(0.5);
  scene.add(nightSky(k));
  const C = cabin(k, { rows: [-2, 1], windows: [-3, 3] });
  const hp = C.hp;
  k.rig({ keyPos: [-1.0, 2.1, 0.2], rimPos: [-2.4, 1.2, -1.4], target: HP_POS, keyScale: 0.12, rimScale: 1.0, fillScale: 0.25, soft: 0.6, shadowSize: 1.5 });
  k.look.productLight(scene, hp, { intensity: 4 });
  hp.updateMatrixWorld(true);
  const mic = hp.anchor('micL').getWorldPosition(V());
  const nrm = V(1, 0, 0).applyQuaternion(hp.quaternion);       // the cup's outward axis
  // the wave: a straight run from off the right of frame to the port, slanting in to the shell; glow.wave along the
  // chord (u = 0 off-frame, u = 1 at the port), rebuilt each frame so it travels
  const side = V().crossVectors(V(0, 1, 0), nrm).normalize();   // across the face (towards the right of frame)
  const start = mic.clone().addScaledVector(side, 0.13).addScaledVector(nrm, 0.035), end = mic.clone().addScaledVector(nrm, 0.0015);
  const chord = end.clone().sub(start), len = chord.length();
  const lam = 0.032, w = 2 * Math.PI * 0.8, A = 0.006;
  const line = glow.wave({ length: len, amp: A, wavelength: lam, radius: 0.0011, color: HUM, coreColor: HUM_CORE, intensity: 4 });
  line.position.copy(start).add(end).multiplyScalar(0.5);
  line.quaternion.setFromUnitVectors(V(1, 0, 0), chord.clone().normalize());
  scene.add(line);
  const ring = fx.glowSprite({ color: '#ffd28a', intensity: 0, size: 0.012 }); ring.position.copy(mic).addScaledVector(nrm, 0.002); scene.add(ring);

  const tM = k.word('Microphones'), tC = k.word('catch');
  k.ui.label('Microphone', { anchor: mic, side: 'above', offset: [0, 120], at: tM - 0.05, until: tC + 0.5 });
  // camera: square to the cup's face from a little in front of it, pushing in towards the port
  const look = mic.clone().addScaledVector(side, 0.03).add(V(0, 0.01, 0));
  const dirC = nrm.clone().multiplyScalar(0.8).addScaledVector(side, 0.35).add(V(0, 0.18, 0)).normalize();
  return (t) => {
    const d = 0.42 * Math.exp(-0.12 * (t + 0.3));
    cam.apply(camera, { pos: look.clone().addScaledVector(dirC, d), look, fov: 30 }, { t, drift: 0.45 });
    camera.near = 0.01;
    // the front travels in from the right; from "catch" it is swallowed: the line's end slides into the port
    const arrive = k.ramp(t, -0.3, tC - 0.1, 'outSine'), caught = k.ramp(t, tC - 0.05, tC + 0.35, 'inOutSine');
    const to = 0.25 + 0.75 * arrive;
    line.set({ phase: w * t, amp: A * (1 - caught), from: 0, to, envelope: (u) => Math.min(1, (1 - u) * 6) }); // flattens into the port
    line.setIntensity(4 * (1 - caught) + 0.01); line.visible = caught < 0.99;
    hp.setMics(0.5 + 1.2 * k.ramp(t, tM - 0.1, tM + 0.2) + 2.5 * k.pulse(t, tC + 0.05, 0.08, 0.15, 0.4));
    ring.setIntensity(2.5 * k.ramp(t, tM - 0.1, tM + 0.2) + 6 * k.pulse(t, tC + 0.05, 0.08, 0.15, 0.4));
    k.lens = { blur: 0.016, focus: mic };
  };
}
