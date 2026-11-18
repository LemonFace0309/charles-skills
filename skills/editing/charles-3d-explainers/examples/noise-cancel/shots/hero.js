// Hook, stage 1 (0 to 1.26 s, "Noise-cancelling"): frame 0 is the finished beauty shot. The viewer's headphones stand
// on the tray table in front of the window; the last of the sunset glows on the horizon behind them, cabin night
// light all round. The camera already pushes in (linear start). A glint sweeps the left cup (0.1 to 0.55 s); the
// noise cancelling switches on with its word (the mic rings and the LED light, amber rings leave both cups); from
// 0.9 s the camera dives at the left cup, and the zoom transition carries the dive inside it.
import { cabin, nightSky, HP_POS } from '../lib/cabin.js';
import { ANTI } from '../lib/colors.js';

export default async function (k) {
  const { THREE, scene, camera, cam, fx, glow } = k;
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  k.env('night', 0.55);
  k.fog(0.8);
  scene.add(nightSky(k));
  const C = cabin(k, { rows: [-3, 2], windows: [-4, 4] });
  const hp = C.hp;
  // light, in the night rig's units (illuminance at the headphones): a dim cool key from the ceiling (0.5), a cool rim
  // from the window side behind them (2), the product light (2.2), and the sunset's own warm light from just outside
  // the window (about 1 at the headphones; point lights are candela: E = I / d^2), which rims the cups from behind and
  // warms the window's reveal
  k.rig({ keyPos: [-1.0, 2.1, 0.6], rimPos: [-2.4, 1.2, -0.9], target: HP_POS, keyScale: 0.18, rimScale: 0.9, fillScale: 0.3, soft: 0.6, shadowSize: 1.5 });
  const pl = k.look.productLight(scene, hp, { intensity: 22 });
  k.softLight(pl.spot, 0.08);
  const sunset = new THREE.SpotLight('#ff8a45', 0.5, 1.6, 0.42, 0.8, 2); sunset.position.set(-1.9, 0.98, -0.32);
  sunset.target.position.set(...HP_POS); scene.add(sunset, sunset.target);
  const motes = fx.dust({ count: 260, center: [-1.2, 0.95, -0.3], size: [1.4, 0.7, 1.2], pointSize: 0.006, color: '#ffd8b0', intensity: 0.7, drift: [0.012, 0.004, 0.006] });
  scene.add(motes);

  // the left cup's outer face: the glint sweeps across it, the dive lands in it
  hp.updateMatrixWorld(true);
  const face = hp.localToWorld(V(0.128, 0.0, 0.0)), faceN = V(1, 0, 0).applyQuaternion(hp.quaternion);
  const glintLight = new THREE.PointLight('#fff0dc', 0, 0.3, 2); scene.add(glintLight);
  const flare = fx.glowSprite({ color: '#fff3e2', intensity: 0, size: 0.03 }); scene.add(flare);
  const streak = fx.glowSprite({ color: '#ffd9a8', intensity: 0 }); streak.scale.set(0.32, 0.006, 1); scene.add(streak);
  // the noise cancelling switching on: amber rings leave both cups, facing the camera
  const rings = [hp.anchor('cupL'), hp.anchor('cupR')].map((a) => {
    const f = glow.waveField({ radius: 0.11, color: ANTI, wavelength: 0.026, speed: 0.17, intensity: 2.4, falloff: 3.2 }); // gone before the rim: no clip at the tray's edge
    f.userData.anchor = a; scene.add(f); return f;
  });

  const tC = k.word('Noise-cancelling') + 0.3; // the stressed "can-"
  // camera: from the aisle side, level with the headphones, the window behind them (its horizon behind the band). A
  // 6%/s linear push and a slow orbit from frame 0; from 0.9 s the look slides onto the left cup and the push
  // accelerates into it (about 120%/s at the cut).
  const target = V(...HP_POS).add(V(0, 0.07, 0));
  const pose = (t) => {
    const d0 = 1.6, d = d0 * Math.exp(-0.06 * t - 2.2 * Math.pow(Math.max(0, t - 0.9), 2.2));
    const az = THREE.MathUtils.degToRad(-2 + 2.4 * t), el = THREE.MathUtils.degToRad(2.5);
    const s = k.ramp(t, 0.85, 1.35, 'inOutSine');
    const look = target.clone().lerp(face, s);
    const dir = V(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).lerp(faceN, s * 0.55).normalize();
    return { pos: look.clone().addScaledVector(dir, d), look, fov: 32 };
  };
  const toCam = V(), right = V(), up = V();
  return (t) => {
    const P = pose(t);
    cam.apply(camera, P, { t, drift: 0.45 });
    camera.near = Math.min(0.05, P.pos.distanceTo(P.look) * 0.2);
    // glint: a light slides across the cup's face plate, its highlight carried by a flare and a thin streak
    toCam.copy(camera.position).sub(face).normalize();
    right.set(0, 1, 0).cross(toCam).normalize(); up.copy(toCam).cross(right).normalize();
    const u = k.ramp(t, 0.08, 0.58, 'inOutSine'), g = k.pulse(t, 0.06, 0.16, 0.12, 0.3);
    const spot = face.clone().addScaledVector(right, k.lerp(-0.05, 0.05, u)).addScaledVector(up, k.lerp(0.035, -0.01, u));
    glintLight.position.copy(spot).addScaledVector(toCam, 0.06); glintLight.intensity = 0.035 * g; // about 10 at the cup, 6 cm away
    flare.position.copy(spot).addScaledVector(toCam, 0.02); flare.setIntensity(10 * g);
    streak.position.copy(flare.position); streak.setIntensity(6 * g);
    // noise cancelling on: mic rings, LED, and two or three rings out of each cup
    const on = k.ramp(t, tC - 0.12, tC + 0.15);
    hp.setMics(on * 1.2); hp.setLed(on);
    for (const f of rings) {
      f.userData.anchor.getWorldPosition(f.position);
      f.quaternion.copy(camera.quaternion);
      f.set({ time: t, start: tC - 0.05, stop: tC + 0.3 });
    }
    motes.at(t);
    k.lens = { blur: 0.02, focus: face.clone().lerp(target, 0.35) };
  };
}
