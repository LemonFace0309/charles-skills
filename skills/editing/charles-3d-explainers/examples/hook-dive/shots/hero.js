// Hook, stage 1 (0 to 1.26 s): frame 0 is the finished beauty shot. One pale quartz grain on a bed of dark sand,
// backlit by a warm horizon and lit from inside, the camera already pushing in. A glint sweeps across the grain on
// "sand" (0.87 s); then the camera dives into it, and the zoom transition carries the dive into the melt.
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export default async function (k) {
  const { THREE, scene, camera, props, fx, cam } = k;
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

  // A rounded, sub-angular sand grain: a sphere pushed out by low-frequency noise, squashed, with a few soft flats
  // (worn fracture faces). Smooth normals: crumpled high-frequency detail refracts into noise.
  const pebble = (seed, { detail = 48, lumps = 0.13, freq = 1.2, octaves = 3, fine = 0.02, scale = [1.08, 0.8, 0.94], flats = 3, soft = 0.08 } = {}) => {
    const R = k.rng(seed), planes = [];
    for (let i = 0; i < flats; i++) planes.push([V(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1).normalize(), 0.76 + R() * 0.12]);
    let g = new THREE.IcosahedronGeometry(1, detail); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g);
    const p = g.attributes.position, v = V();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).normalize();
      const h = 1 + lumps * props.fbm3(v.x * freq + seed, v.y * freq, v.z * freq, { octaves, seed }) + fine * props.fbm3(v.x * 4, v.y * 4, v.z * 4, { octaves: 2, seed: seed + 3 });
      v.multiplyScalar(h).multiply(V(...scale));
      for (const [n, d] of planes) { const s = v.dot(n); if (s > d - soft) { const x = (s - (d - soft)) / (2 * soft); v.addScaledVector(n, -2 * soft * (x > 1 ? x - 0.5 : x * x * 0.5)); } } // a flat with a soft edge
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  };

  // ---- light. The night rig stays dim; a cool rim from high behind; a warm horizon band behind the grain (screen-
  // locked at its height: transmission only shows what is behind a glass hero); a low warm backlight from that horizon
  // so the grains of the bed glisten on their tops.
  k.env('night', 0.5);
  k.post = { bloom: 0.11 }; // a touch more bloom than the palette's 0.07: the grain's inner light spills a soft halo
  k.backdrop({ glow: 0.04, glowPos: [0.5, 0.52], horizon: { strength: 0.55, y: 0.5, width: 0.075 } });
  k.rig({ keyPos: [-2.5, 7, -3], rimPos: [2.6, 3.2, -7], keyScale: 0.25, rimScale: 0.6, fillScale: 0.12, soft: 1.0, shadowSize: 6 });
  const sun = new THREE.DirectionalLight('#ff9b52', 1.3); sun.position.set(-3, 1.6, -12); scene.add(sun, sun.target);

  // ---- the hero: frosted translucent quartz (ior 1.54) around a small warm heart that it refracts and magnifies
  // (the glow from inside), and a point light inside that pools on the sand around it. No shadow: a glowing grain
  // throws light, not a dark shadow. A soft clearcoat: a razor-sharp one turns the backlit silhouette into a 1 px
  // HDR line that the bokeh fill smears into a dotted halo.
  const geo = pebble(5, { lumps: 0.16, freq: 1.0, octaves: 2, fine: 0.008, scale: [1.12, 0.8, 0.95], flats: 3, soft: 0.07 }).scale(0.5, 0.5, 0.5); geo.computeBoundingBox();
  const Gc = V(0, -geo.boundingBox.min.y - 0.04, 0); // the grain's centre, resting on the bed
  const grain = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({
    color: '#fffaf0', roughness: 0.32, metalness: 0, transmission: 1, thickness: 0.7, ior: 1.54,
    attenuationColor: '#ffe0b0', attenuationDistance: 2.5, clearcoat: 0.5, clearcoatRoughness: 0.15, specularIntensity: 0.7, envMapIntensity: 1.4,
    sheen: 0.35, sheenColor: '#ffe9c8', sheenRoughness: 0.4,
  }));
  grain.position.copy(Gc); grain.rotation.set(1.3, 0.4, 0.9); // its flats turned to the sides, where they catch light
  // the heart: an ember, white-hot where it faces the camera and amber at its edges (an unlit shader), so through the
  // frosted shell it blurs into a gradient, not one flat cream blob. A little off-centre: a centred one reads as an
  // egg yolk.
  const heart = new THREE.Mesh(pebble(9, { detail: 16, lumps: 0.3 }).scale(0.16, 0.12, 0.16), new THREE.ShaderMaterial({
    uniforms: { uHot: { value: new THREE.Color('#ffd9a0').multiplyScalar(6) }, uWarm: { value: new THREE.Color('#ff8a2a').multiplyScalar(1.1) } },
    vertexShader: 'varying vec3 vN, vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalMatrix * normal; vV = -mv.xyz; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uHot, uWarm; varying vec3 vN, vV; void main(){ float f = pow(max(dot(normalize(vN), normalize(vV)), 0.), 2.5); gl_FragColor = vec4(mix(uWarm, uHot, f), 1.); }',
  }));
  heart.rotation.copy(grain.rotation); heart.position.copy(Gc).add(V(-0.07, -0.05, 0.04).applyEuler(grain.rotation));
  const inner = new THREE.PointLight('#ffb15c', 6, 3.5, 2); inner.position.copy(Gc);
  scene.add(grain, heart, inner);

  // ---- the bed: black volcanic sand, angular glassy grains of the hero's own scale behind it (it is macro), small
  // ones in front (low enough to leave the line to the hero clear), a clearing under the hero. Glossy facets catch the
  // low warm backlight, so the far bed glitters into warm bokeh. A dark Lambert floor fills the gaps (no specular:
  // the low backlight would glare across it at a grazing angle).
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#1c1a19', bumpMap: k.look.noiseTexture({ kind: 'grain', repeat: 60, seed: 4 }), bumpScale: 1.2 }));
  floor.receiveShadow = true; scene.add(floor);
  const R = k.rng(11);
  const shapes = [1, 2, 3, 4, 6].map((s) => props.rockGeometry({ seed: 30 + s, detail: 4, roughness: 0.22, squash: 0.45, cuts: 6, dents: 2, crease: 35 }));
  // glossy behind the hero (the glitter), matte in front of it (out of focus, glints there blow up into milky discs)
  const glossy = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.32, envMapIntensity: 0.25, clearcoat: 0.25, clearcoatRoughness: 0.3 });
  const matte = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, envMapIntensity: 0.06 });
  const per = 500, mk = (mt) => shapes.map((g) => { const m = new THREE.InstancedMesh(g, mt, per); m.count = 0; m.castShadow = m.receiveShadow = true; scene.add(m); return m; });
  const far = mk(glossy), near = mk(matte);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
  const tones = ['#1b1b1d', '#232124', '#2a2622', '#1f1d1b', '#302a25'];
  for (let n = 0; n < 5 * per * 1.4; n++) {
    const z = 5.0 - Math.pow(R(), 1.15) * 36, D = 7.2 - z;
    const x = (R() * 2 - 1) * (0.19 * D + 0.4);
    let s = (0.1 + R() * R() * 0.26) * (1 + Math.max(0, -z) * 0.03);
    if (z > 0.5) s *= Math.abs(x) / D < 0.12 ? 0.35 : 0.6;                       // small and low in front of the hero
    if (Math.hypot(x, z) < 0.6 + s) continue;
    const mesh = (z > 0.5 ? near : far)[n % 5]; if (mesh.count >= per) continue;
    e.set(R() * 6.3, R() * 6.3, R() * 6.3); q.setFromEuler(e);
    m4.compose(V(x, s * (0.1 + R() * 0.2) - 0.02, z), q, V(s, s, s));
    mesh.setMatrixAt(mesh.count, m4);
    col.set(tones[Math.floor(R() * tones.length)]); if (R() < 0.04) col.set('#7d6f60');
    mesh.setColorAt(mesh.count, col.multiplyScalar(0.8 + R() * 0.4)); mesh.count++;
  }
  const motes = fx.dust({ count: 260, center: [0, 1.1, -0.5], size: [5, 2.2, 9], pointSize: 0.014, color: '#ffd7a6', intensity: 0.9, drift: [0.03, 0.012, 0] });
  scene.add(motes);

  // ---- the glint on "sand": a small light sweeps across the grain's face (its highlight travels over the clearcoat),
  // and a camera-facing flare with a thin anamorphic streak rides that highlight and blooms.
  const tG = k.word('sand,');
  const glintLight = new THREE.PointLight('#fff1d8', 0, 4, 2); scene.add(glintLight);
  const streak = fx.glowSprite({ color: '#ffd9a8', intensity: 0 }); streak.scale.set(1.9, 0.034, 1);
  const flare = fx.glowSprite({ color: '#fff4e2', intensity: 0, size: 0.2 });
  scene.add(streak, flare);

  // ---- the camera: eye level a little above the grain's centre (the horizon runs through the grain), moving on
  // frame 0 (a 6.5%/s push and a slow orbit, linear start: the background slides 25 to 38 px/s), then from 0.86 s an
  // accelerating dive straight at the grain's centre (130%/s by the cut), so the zoom transition rushes into it.
  const d0 = cam.fit(0.5, { fill: 0.46, fov: 30 });
  const pose = (t) => {
    const d = d0 * Math.exp(-0.065 * t - 1.9 * Math.pow(Math.max(0, t - 0.86), 2.4));
    const az = THREE.MathUtils.degToRad(-7 + 0.75 * t);
    const look = V(0, Gc.y + 0.07 * (1 - k.ramp(t, 0.86, 1.4)), 0);
    return { pos: V(Math.sin(az) * d, look.y, Math.cos(az) * d), look, fov: 30 };
  };
  const toCam = V(), right = V(), up = V(), n = V(), l = V();
  return (t) => {
    cam.apply(camera, pose(t), { t, drift: 0.45 });
    toCam.copy(camera.position).sub(Gc).normalize();
    right.set(0, 1, 0).cross(toCam).normalize(); up.copy(toCam).cross(right).normalize();
    // glint: the highlight's normal sweeps from upper left to right; the light sits on the mirror direction
    const u = k.ramp(t, tG - 0.17, tG + 0.3, 'inOutSine'), g = k.pulse(t, tG - 0.12, 0.12, 0.06, 0.32);
    n.copy(toCam).multiplyScalar(0.8).addScaledVector(right, k.lerp(-0.65, 0.65, u)).addScaledVector(up, k.lerp(0.42, 0.12, u)).normalize();
    l.copy(n).multiplyScalar(2 * n.dot(toCam)).sub(toCam).normalize();
    const pt = Gc.clone().addScaledVector(n, 0.44);
    glintLight.position.copy(pt).addScaledVector(l, 1.2); glintLight.intensity = 9 * g;
    streak.position.copy(pt).addScaledVector(toCam, 0.1); streak.setIntensity(9 * g);
    flare.position.copy(streak.position); flare.setIntensity(14 * g);
    motes.at(t);
    k.lens = { blur: 0.022, focus: Gc.clone().addScaledVector(toCam, 0.35) };
  };
}
