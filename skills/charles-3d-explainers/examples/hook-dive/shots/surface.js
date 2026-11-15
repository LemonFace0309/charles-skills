// Hook, stage 2 (1.26 to 2.04 s, "melted down"): through the grain's surface into the melt. A molten surface fills
// the frame above the crucible's dark lip; the camera keeps diving, down the line through the lip, so the melt rushes
// up at the lens while the lip holds its place under the subject band (it keeps the caption band dark).
export default async function (k) {
  const { THREE, scene, camera, fx, cam } = k;
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  k.env('night', 0.4);
  k.backdrop({ glow: 0 });
  k.rig({ keyPos: [-3, 8, -4], rimPos: [3, 3, -8], keyScale: 0.12, rimScale: 0, fillScale: 0.02, soft: 0 }); // no rim: it glares blue across the lip
  k.post = { vignette: 0.85 };

  // the melt: a disc with interior vertices (RingGeometry from ~0), a gentle swell and a meniscus climbing the wall
  const RIN = 2.44;
  const geo = new THREE.RingGeometry(0.0001, RIN, 220, 80).rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z);
    p.setY(i, 0.018 * Math.sin(x * 2.1 + z * 1.3) + 0.012 * Math.sin(x * 4.7 - z * 3.9) + 0.06 * Math.pow(r / RIN, 12));
  }
  geo.computeVertexNormals();
  const melt = k.mat.molten({ scale: 0.5, fade: false, crust: 0.2, rim: [0.55, 0.05, 0.0], mid: [1.0, 0.3, 0.02], core: [1.0, 0.66, 0.2] });
  melt.envMapIntensity = 0.25; // a faint wet sheen; a strong one reflects the env's boxes as milky smears
  scene.add(new THREE.Mesh(geo, melt));

  // the crucible: a thick-walled lathe in dark graphite (profile up the outside, over the lip, down the inside, so the
  // lathe's normals face out and in). Its near lip and wall fill the bottom of the frame: the caption band stays dark
  const prof = [[RIN + 0.19, -2.4], [RIN + 0.19, 0.3], [RIN + 0.16, 0.33], [RIN + 0.03, 0.33], [RIN, 0.3], [RIN, -1.2]];
  const crucible = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 256), k.mat.matte('#1d1a18', { rough: 0.6, env: 0.08, extra: { side: THREE.DoubleSide } }));
  scene.add(crucible);
  // lights near the walls (their reflections in the melt fall at its edges, not across the middle)
  for (const a of [0.6, 2.55]) { const L = new THREE.PointLight('#ff8c3a', 4, 3, 2); L.position.set(Math.cos(a) * -2.1, 0.25, Math.sin(a) * -2.1); scene.add(L); }
  const embers = fx.dust({ count: 160, center: [0, 0.8, 0.4], size: [4.5, 1.6, 4.5], pointSize: 0.01, color: '#ffb36b', intensity: 2.2, drift: [0, 0.35, 0] });
  scene.add(embers);

  // camera: 28 degrees down at the melt, sliding at 0.9 units/s along the line through the near lip (so the lip holds
  // its screen height while the melt rushes up: 37%/s at the start, 70%/s by the end), into the next transition
  const lip = V(0, 0.33, RIN + 0.09), P0 = V(0, 1.4, 4.1);
  const along = P0.clone().sub(lip).normalize().negate();          // from the camera towards the lip
  const fwd = V(0, -Math.sin(THREE.MathUtils.degToRad(28)), -Math.cos(THREE.MathUtils.degToRad(28)));
  return (t) => {
    const s = 0.9 * (t + 0.25);
    const pos = P0.clone().addScaledVector(along, s);
    cam.apply(camera, { pos, look: pos.clone().add(fwd), fov: 40 }, { t, drift: 0.4 });
    melt.set(0.47, 1.6 * t); // churning fast: the surface itself moves under the dive
    embers.at(t);
    k.lens = { blur: 0.01, focus: pos.clone().addScaledVector(fwd, (pos.y - 0.02) / Math.sin(THREE.MathUtils.degToRad(28))) };
  };
}
