// Hook, stage 3 (from 2.04 s, "grows one perfect crystal"): the first thing the voice explains. The zoom pulls back
// out of the melt to the crucible, where one silicon crystal (a Czochralski boule: seed rod, neck, shoulder, ridged
// body) rises out of the glowing melt, turning as it is pulled. A gleam runs up it on "perfect"; its label lands on
// "crystal". The camera keeps a slow push with a slow orbit.
export default async function (k) {
  const { THREE, scene, camera, props, glow, fx, cam } = k;
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  // Incandescence by world height: a material glows `color` at y = hot, fading to nothing by y = cold (either order),
  // `rim` of it only at grazing angles. World y, so the glow stays at the melt line while the object rises: pure.
  const heatGlow = (m, color, hot, cold, rim, key) => {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uHot = { value: new THREE.Color(color) };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vWy;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWy = (modelMatrix * vec4(transformed, 1.0)).y;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vWy; uniform vec3 uHot;').replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { float h = clamp((vWy - (${cold.toFixed(3)})) / (${(hot - cold).toFixed(3)}), 0., 1.); h = h * h * (3. - 2. * h);
          totalEmissiveRadiance += uHot * h * (${(1 - rim).toFixed(3)} + ${rim.toFixed(3)} * pow(1. - abs(dot(normal, normalize(vViewPosition))), 2.)); }`);
    };
    m.customProgramCacheKey = () => key;
    return m;
  };
  k.env('night', 0.45);
  k.backdrop(); // hidden behind the chamber drum below; a safety net
  k.fog(0.6);
  k.rig({ keyPos: [-3, 9, -2], rimPos: [3.5, 4, -7], keyScale: 0.3, rimScale: 1.4, fillScale: 0.1, soft: 0.8, shadowSize: 6 });

  // the crucible and its melt (the same build as surface.js at the crystal's scale: three times its diameter)
  const RIN = 1.9;
  const geo = new THREE.RingGeometry(0.0001, RIN, 200, 60).rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z); p.setY(i, 0.012 * Math.sin(x * 2.6 + z * 1.7) + 0.05 * Math.pow(r / RIN, 12)); }
  geo.computeVertexNormals();
  const melt = k.mat.molten({ scale: 0.45, fade: false, crust: 0.2, rim: [0.55, 0.05, 0.0], mid: [1.0, 0.3, 0.02], core: [1.0, 0.66, 0.2] });
  melt.envMapIntensity = 0.25;
  scene.add(new THREE.Mesh(geo, melt));
  // the crucible in two lathes: a dark outer wall (it fills the caption band) and the lip and inner wall, red-hot from
  // the melt, fading to dark 0.3 units down
  const lathe = (pts, m) => new THREE.Mesh(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 256), m);
  scene.add(lathe([[RIN + 0.17, -3.2], [RIN + 0.17, 0.27], [RIN + 0.14, 0.3]], k.mat.matte('#141110', { rough: 0.7, env: 0.04 })));
  scene.add(lathe([[RIN + 0.14, 0.3], [RIN + 0.03, 0.3], [RIN, 0.27], [RIN, -1.2]], heatGlow(k.mat.matte('#141110', { rough: 0.7, env: 0.04 }), new THREE.Color('#ff4a12').multiplyScalar(0.7), 0.3, 0.0, 0, 'crucible-hot')));

  // the puller's chamber behind it: a steel drum (BackSide, so from outside only its far wall shows, a cyclorama),
  // lit warm from below by the melt: a place, not a void, and a lighter region behind the crystal's base
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 6.5, 14, 96, 1, true), k.mat.metal('#4a4f58', { rough: 0.38, env: 0.2, extra: { side: THREE.BackSide } }));
  drum.position.y = 4; scene.add(drum);
  const glowLight = new THREE.PointLight('#ff7a2a', 88, 16, 2); glowLight.position.set(0, 0.2, 0); scene.add(glowLight);

  // the boule: polished silicon reflecting the product studio, rising out of the melt. Where it leaves the melt it is
  // still incandescent: a warm glow over the lowest 0.8 units of world height, stronger at grazing angles (the melt's
  // light caught along its sides).
  const boule = props.boule({ radius: 0.62, length: 2.6, seed: 2.4, rough: 0.12, envIntensity: 1.2 });
  scene.add(boule);
  heatGlow(boule.body.material, new THREE.Color('#ff8a2a').multiplyScalar(1.6), 0, 0.8, 0.75, 'boule-hot');
  k.look.productLight(k.scene, V(0, 1.1, 0), { radius: 1.1, intensity: 22 });
  // the meniscus: a bright ring where the crystal meets the melt
  const meniscus = glow.ring(0.655, { center: [0, 0.035, 0], tubeRadius: 0.022, intensity: 6 });
  scene.add(meniscus);
  const gleam = new THREE.PointLight('#fff2de', 0, 2.5, 2); scene.add(gleam);
  const embers = fx.dust({ count: 120, center: [0, 1.2, 0], size: [4, 2.4, 4], pointSize: 0.012, color: '#ffb36b', intensity: 1.6, drift: [0, 0.3, 0] });
  scene.add(embers);

  const tP = k.word('perfect'), tC = k.word('crystal.');
  k.ui.label('Silicon crystal', { anchor: boule.anchor('shoulder'), avoid: boule, side: 'right', gap: 44, at: tC - 0.1, sub: '99.9999999% pure' });

  // camera: low (6 degrees up), so the crucible's near wall hides the near melt and holds the caption band dark; it
  // lands from the zoom-out, then pushes slowly (6%/s) with a slow orbit. It looks a little right of the crystal, so
  // the crystal sits left of centre and its label has room on the right.
  const look = V(0, 0.85, 0), aim = V();
  return (t) => {
    const az = THREE.MathUtils.degToRad(18 + 9 * t), el = THREE.MathUtils.degToRad(6), d = 11 * Math.exp(-0.06 * (t + 0.25));
    const pos = V(Math.sin(az) * Math.cos(el) * d, look.y + Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d);
    aim.set(Math.cos(az), 0, -Math.sin(az)).multiplyScalar(0.42).add(look);   // 0.42 to the camera's right
    cam.apply(camera, { pos, look: aim, fov: 32 }, { t, drift: 0.4 });
    boule.position.y = -1.75 + 0.6 * (t + 0.25);
    boule.rotation.y = 0.6 * t;
    melt.set(0.6, t + 3);
    meniscus.setIntensity(6 + 2 * Math.sin(t * 9));
    // the gleam: a light runs up the front of the crystal on "perfect", its highlight sliding up the polished body
    const g = k.ramp(t, tP - 0.08, tP + 0.4, 'inOutSine');
    gleam.position.copy(camera.position).sub(look).setY(0).normalize().multiplyScalar(1.3).setY(k.lerp(0.1, 2.2, g));
    gleam.intensity = 9 * Math.sin(Math.PI * g);
    embers.at(t);
    k.lens = { blur: 0.016, focus: V(0, 0.8, 0) };
  };
}
