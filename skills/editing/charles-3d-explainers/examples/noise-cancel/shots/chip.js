// Teaching frame (13.28 to 17.60 s, "A chip flips the wave upside down, so every squeeze becomes a stretch."): the
// chip inside the cup, the mic's copy of the hum (cool) floating over it. On "flips" a copy peels off and turns over
// about its own axis, going amber as it passes edge-on; it lands below the original, upside down, with a flare and a
// label. Then the squeeze (a crest of the hum) and the stretch under it (a trough of the copy) light up on their
// words. The camera orbits 32 degrees with a push: a teaching frame still needs a real move.
import { chipSet } from '../lib/chip.js';
import { HUM, HUM_CORE, ANTI } from '../lib/colors.js';

export default async function (k) {
  const { THREE, scene, camera, cam, glow, fx } = k;
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  k.env('night', 1.0);
  k.backdrop({ glow: 0.05 });
  k.fog(0.2);
  const { chipTop } = chipSet(k);
  k.rig({ keyPos: [-2, 9, 4], rimPos: [3, 4, -9], target: chipTop.toArray(), keyScale: 0.35, rimScale: 1.0, fillScale: 0.45, soft: 0.8, shadowSize: 6 });
  k.look.productLight(scene, chipTop, { radius: 1.2, intensity: 14 });

  // the lanes: a group facing the camera's mean position, above the chip; the hum in the top lane, the flipped copy
  // turning down into the bottom one
  const L = 3.3, A = 0.3, lam = 1.3, top = 1.0, bot = 0.0;
  const lanes = new THREE.Group(); lanes.position.copy(chipTop).add(V(0, 0.95, 0)); scene.add(lanes);
  // camera: a 32 degree orbit with a push across the shot
  const camAt = (t) => { const az = THREE.MathUtils.degToRad(-16 + 7.5 * t), el = THREE.MathUtils.degToRad(31 - 1.5 * t), d = 16.2 - 0.55 * t; return V(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d).add(lanes.position); };
  lanes.lookAt(camAt(2));
  const mk = (color, core, i = 5) => { const w = glow.wave({ length: L, amp: A, wavelength: lam, radius: 0.028, color, coreColor: core, intensity: i }); lanes.add(w); return w; };
  const hum = mk(HUM, HUM_CORE, 4), copyCool = mk(HUM, HUM_CORE, 4), copyAnti = mk(ANTI, null, 5);
  hum.position.y = top;
  // the light the waves throw on the chip: cool from the hum, amber once the copy exists
  const coolPool = new THREE.PointLight(HUM, 0, 4, 2), warmPool = new THREE.PointLight(ANTI, 0, 4, 2);
  coolPool.position.copy(lanes.position).add(V(0, 0.9, 0.4)); warmPool.position.copy(lanes.position).add(V(0, 0.1, 0.4)); scene.add(coolPool, warmPool);
  // the chip's top glows while it works
  const chipGlow = fx.glowSprite({ color: ANTI, intensity: 0, size: 1.0 }); chipGlow.position.copy(chipTop).add(V(0, 0.05, 0)); scene.add(chipGlow);
  // markers: a crest of the hum and the trough under it
  const dotS = fx.glowSprite({ color: '#bfe4ff', intensity: 0, size: 0.28 }), dotT = fx.glowSprite({ color: '#ffd9a0', intensity: 0, size: 0.28 });
  lanes.add(dotS, dotT);
  const tie = glow.line([[0, top, 0], [0, bot, 0]], { width: 0.012, color: '#ffffff', intensity: 1.2, dashed: true }); lanes.add(tie);

  const tChip = k.word('chip'), tF = k.word('flips'), tU = k.word('upside'), tSo = k.word('so every'), tSq = k.word('squeeze'), tSt = k.word('stretch.');
  const ph = (t) => 0.9 + 0.45 * t;                     // the waves keep travelling slowly, the markers riding a crest
  const xc = (t) => (lam * (Math.PI / 2 + ph(t))) / (2 * Math.PI);  // the crest nearest the middle: kx - ph = pi/2
  const crest = (t) => lanes.localToWorld(V(xc(t), top + A, 0));
  const trough = (t) => lanes.localToWorld(V(xc(t), bot - A, 0));
  k.ui.label('<span style="color:#ffc46a">flipped</span>', { anchor: (t) => lanes.localToWorld(V(-L / 2 + 0.05, bot, 0)), side: 'left', offset: [40, 0], at: tU + 0.25, until: tSq - 0.2, dot: false });
  k.ui.label('<span style="color:#9ed4ff">squeeze</span>', { anchor: crest, side: 'above', offset: [0, 40], at: tSq - 0.1, until: k.dur + 0.2, dot: false });
  k.ui.label('<span style="color:#ffc46a">stretch</span>', { anchor: trough, side: 'below', offset: [0, 40], at: tSt - 0.1, until: k.dur + 0.2, dot: false });

  const look = lanes.position.clone().add(V(0, -0.2, 0));
  return (t) => {
    cam.apply(camera, { pos: camAt(t), look, fov: 30 }, { t, drift: 0.45 });
    const p = ph(t);
    hum.set({ phase: p });
    // the flip: the copy drops from the top lane to the bottom one and turns over its long axis
    const f = k.ramp(t, tF - 0.08, tU + 0.1, 'inOutCubic');
    const ang = Math.PI * f, y = k.lerp(top, bot, f);
    for (const w of [copyCool, copyAnti]) { w.set({ phase: p }); w.position.y = y; w.rotation.x = ang; }
    copyCool.visible = f > 0.001 && ang < Math.PI / 2; copyAnti.visible = ang >= Math.PI / 2;
    copyAnti.setIntensity(5 + 9 * k.pulse(t, tU + 0.05, 0.06, 0.1, 0.45));   // it lands upside down with a flare
    coolPool.intensity = 0.5; warmPool.intensity = 0.7 * k.ramp(t, tF + 0.2, tU);
    chipGlow.setIntensity(1.4 * k.pulse(t, tChip - 0.1, 0.15, 0.25, 0.5) + 0.9 * k.pulse(t, tF - 0.1, 0.15, 0.4, 0.6) + 1.2 * k.pulse(t, tSo - 0.1, 0.12, 0.2, 0.5));
    // squeeze and stretch
    const sq = k.ramp(t, tSq - 0.1, tSq + 0.15), st = k.ramp(t, tSt - 0.1, tSt + 0.15);
    dotS.position.set(xc(t), top + A, 0.03); dotS.setIntensity(5 * sq);
    dotT.position.set(xc(t), bot - A, 0.03); dotT.setIntensity(5 * st);
    tie.position.x = xc(t); tie.draw(st); tie.visible = st > 0.01;
    k.lens = { blur: 0.016, focus: look };
  };
}
