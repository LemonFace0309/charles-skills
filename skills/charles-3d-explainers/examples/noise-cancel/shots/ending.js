// "Voices are higher. Their waves are shorter, so the tiniest delay ruins the match." (32.28 s to the end). The
// payoff, over the opening image: the headphones on the tray before the window. Two lanes hang over the dark wall
// above the window: the hum (cool, a long wave) and, on "Voices", the voice (pale), which squeezes on "higher" until
// its waves are short. On "waves" a dimension line spans one wave of each. On "tiniest" the headphones' inverted
// copies (amber) draw on, and on "delay" they settle, both late by the same tiny delay; on "ruins" each pair adds up:
// the hum's to an almost flat line, the voice's to a wave as big as before. The lanes settle above the headphones as
// the camera eases back to the exact framing of frame 0, so the reel loops.
import { cabin, nightSky, HP_POS } from '../lib/cabin.js';
import { HUM, HUM_CORE, ANTI, FLAT, VOICE } from '../lib/colors.js';

export default async function (k) {
  const { THREE, scene, camera, cam, glow, fx } = k;
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  k.env('night', 0.55);
  k.fog(0.8);
  k.post = { captionShade: 0.75 };                              // the headband passes behind the caption on the way home
  const sky = nightSky(k); scene.add(sky);
  const C = cabin(k, { rows: [-3, 2], windows: [-4, 4] });
  const hp = C.hp;
  // the hero shot's light, so the last frame matches the first
  k.rig({ keyPos: [-1.0, 2.1, 0.6], rimPos: [-2.4, 1.2, -0.9], target: HP_POS, keyScale: 0.18, rimScale: 0.9, fillScale: 0.3, soft: 0.6, shadowSize: 1.5 });
  const pl = k.look.productLight(scene, hp, { intensity: 22 }); k.softLight(pl.spot, 0.08);
  const sunset = new THREE.SpotLight('#ff8a45', 0.5, 1.6, 0.42, 0.8, 2); sunset.position.set(-1.9, 0.98, -0.32); sunset.target.position.set(...HP_POS); scene.add(sunset, sunset.target);
  const motes = fx.dust({ count: 260, center: [-1.2, 0.95, -0.3], size: [1.4, 0.7, 1.2], pointSize: 0.006, color: '#ffd8b0', intensity: 0.7, drift: [0.012, 0.004, 0.006] });
  scene.add(motes);

  // frame 0's camera (hero.js, t = 0), where this shot ends
  const target = V(...HP_POS).add(V(0, 0.07, 0));
  const az0 = THREE.MathUtils.degToRad(-2), el0 = THREE.MathUtils.degToRad(2.5);
  const home = { pos: target.clone().add(V(Math.cos(az0) * Math.cos(el0), Math.sin(el0), Math.sin(az0) * Math.cos(el0)).multiplyScalar(1.6)), look: target.clone(), fov: 32 };

  // the lanes: a group facing that camera, above the headphones. Lengths in metres: the hum's wave 0.30 long, the
  // voice's 0.03; one delay of 6 mm is 2% of the hum's wave (it still cancels: 13% left) and 20% of the voice's (a
  // wave 1.2 times as big is left). The sum of A sin(kx) and -A sin(k(x - d)) is 2A sin(kd/2) cos(k(x - d/2)).
  // the lanes hang over the dark wall above the window while they are read (camera level with them: through the window
  // it then sees only the cloud deck, no sunset line behind them), and settle above the headphones as the camera
  // returns home, where the sunset line sits low behind the headband
  const yRead = 1.42, yHome = target.y + 0.255;
  const lanes = new THREE.Group(); lanes.position.copy(target).setY(yHome); lanes.lookAt(home.pos.clone().setY(yHome)); scene.add(lanes); lanes.updateMatrixWorld(true); // upright, facing home
  const L = 0.34, yH = 0.06, yV = -0.06, Ah = 0.02, Av = 0.015, lamH = 0.3, lamV = 0.03, dly = 0.006;
  const mk = (color, core, i, r = 0.0021) => { const w = glow.wave({ length: L, radius: r, color, coreColor: core, intensity: i, segments: 500 }); lanes.add(w); return w; };
  const hum = mk(HUM, HUM_CORE, 4), humAnti = mk(ANTI, null, 4.5), humSum = mk(FLAT, null, 3.4);
  const voice = mk(VOICE, null, 4), voiceAnti = mk(ANTI, null, 4.5), voiceSum = mk(VOICE, null, 4);
  for (const w of [hum, humAnti, humSum]) w.position.y = yH;
  for (const w of [voice, voiceAnti, voiceSum]) w.position.y = yV;
  humSum.position.z = voiceSum.position.z = 0.002;           // the sums in front while the pairs fade into them
  // one wavelength of each, measured in the gap between the lanes (the labels sit outside them)
  const dimH = glow.dimension([-lamH / 2, yH - Ah - 0.013, 0], [lamH / 2, yH - Ah - 0.013, 0], { tick: 0.008, width: 0.0014, intensity: 2.4 }); lanes.add(dimH);
  const dimV = glow.dimension([-lamV / 2, yV + Av + 0.013, 0], [lamV / 2, yV + Av + 0.013, 0], { tick: 0.008, width: 0.0014, intensity: 2.4 }); lanes.add(dimV);

  const tVo = k.word('Voices'), tHi = k.word('higher.'), tWv = k.word('waves are'), tSh = k.word('shorter,'), tTi = k.word('tiniest'), tDe = k.word('delay'), tRu = k.word('ruins');
  const at = (x, y) => lanes.localToWorld(V(x, y, 0)).setY(yRead + y);   // a lane point while the lanes are up
  k.ui.label('hum', { anchor: at(-L * 0.4, yH + Ah), side: 'above', offset: [0, 40], at: -0.2, until: tRu - 0.2, dot: false });
  k.ui.label('voice', { anchor: at(-L * 0.4, yV - Av), side: 'below', offset: [0, 40], at: tVo - 0.05, until: tRu - 0.2, dot: false });

  // camera: level with the lanes while they are read (1.35 m back: they fill 78% of the width), a slow truck; then
  // from "ruins" one blend back to frame 0's framing, landing on the last frame
  const toHome = home.pos.clone().sub(lanes.position).setY(0).normalize(), side = V(-toHome.z, 0, toHome.x);
  const read = (t) => {
    const s = k.ramp(t, -0.4, k.dur + 0.4, 'linear');             // one steady truck to the end: no kink as the blend home starts
    const look = lanes.position.clone().setY(yRead - 0.01).addScaledVector(side, 0.04 - 0.08 * s);
    return { pos: look.clone().addScaledVector(toHome, 1.35 - 0.1 * s).add(V(0, -0.04, 0)), look, fov: 32 };
  };
  return (t) => {
    const w = k.ramp(t, tRu - 0.15, k.dur - 0.03, 'inOutSine');     // the way home: 1.5 s, eased
    // the sunset line comes up as the camera comes down (it would otherwise pop out from behind the deep window frame
    // in two frames); full strength on the last frame, as on frame 0
    sky.material.uniforms.uWarm.value = 7 * k.lerp(0.15, 1, k.ramp(t, tRu, k.dur - 0.1, 'inOutSine'));
    sunset.intensity = 0.5 * k.lerp(0.3, 1, k.ramp(t, tRu, k.dur - 0.1));
    lanes.position.y = k.lerp(yRead, yHome, w);
    const R = read(t), P = { pos: R.pos.clone().lerp(home.pos, w), look: R.look.clone().lerp(home.look, w), fov: 32 };
    cam.apply(camera, P, { t, drift: 0.45 * (1 - w) });             // no drift on the last frame: it is frame 0's pose
    const ph = 2 * Math.PI * 0.5 * t;
    // the voice: drawn on at "Voices" with the hum's wavelength, squeezed to its own on "higher"
    const vOn = k.ramp(t, tVo - 0.1, tVo + 0.35), hi = k.ramp(t, tHi - 0.12, tHi + 0.13, 'inOutSine'); // a quick squeeze: it lands as an event
    const kv = (2 * Math.PI) / (lamH * Math.pow(lamV / lamH, hi)), kh = (2 * Math.PI) / lamH;
    // the pairs fade into their sums on "ruins"
    // the copies draw on from the right on "tiniest", then slide to their place on "delay": late by dly
    const aOn = k.ramp(t, tTi - 0.1, tTi + 0.25), an = k.ramp(t, tDe - 0.1, tDe + 0.3), sum = k.ramp(t, tRu - 0.05, tRu + 0.35);
    const slide = 0.04 * (1 - an);
    hum.set({ fn: (x) => Ah * Math.sin(kh * x - ph) });
    voice.set({ fn: (x) => Av * Math.sin(kv * x - ph * 3), from: 0, to: Math.max(0.002, vOn) });
    humAnti.set({ fn: (x) => -Ah * Math.sin(kh * (x - dly - slide) - ph), from: 1 - aOn, to: 1 });
    voiceAnti.set({ fn: (x) => -Av * Math.sin(kv * (x - dly - slide) - ph * 3), from: 1 - aOn, to: 1 });
    humSum.set({ fn: (x) => Ah * Math.sin(kh * x - ph) - Ah * Math.sin(kh * (x - dly) - ph) });
    voiceSum.set({ fn: (x) => Av * Math.sin(kv * x - ph * 3) - Av * Math.sin(kv * (x - dly) - ph * 3) });
    const fl = 1 + 0.6 * k.pulse(t, tSh - 0.05, 0.08, 0.12, 0.3); // both flare on "shorter"
    hum.setIntensity(4 * fl * (1 - sum) + 0.01); voice.setIntensity(4 * fl * (1 - sum) + 0.01);
    humAnti.setIntensity(4.5 * (1 - sum) + 0.01); voiceAnti.setIntensity(4.5 * (1 - sum) + 0.01);
    humSum.setIntensity(3.4 * sum + 0.01); voiceSum.setIntensity(4.2 * sum + 0.01);
    hum.visible = voice.visible = sum < 0.99; voice.visible = voice.visible && vOn > 0.002;
    humAnti.visible = voiceAnti.visible = aOn > 0.01 && sum < 0.99; humSum.visible = voiceSum.visible = sum > 0.01;
    const dm = k.ramp(t, tWv - 0.1, tWv + 0.15) * (1 - k.ramp(t, tRu - 0.2, tRu + 0.2)); // one wave of each, drawn on "waves"
    dimH.draw(dm); dimV.draw(dm); dimH.visible = dimV.visible = dm > 0.01;
    hp.setMics(0.8); hp.setLed(1);
    pl.set(k.lerp(0.35, 1, k.ramp(t, tRu + 0.8, k.dur)));          // the headphones stay dim while the lanes are read
    motes.at(t);
    k.lens = { blur: 0.016, focus: P.look.clone().lerp(target, w * 0.5) };
  };
}
