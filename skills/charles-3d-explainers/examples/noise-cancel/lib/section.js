// The inside of the running example: the viewer's left ear in section (props.ear, cutaway) with the left cup of the
// headphones over it, also cut open (props.headphones, cutaway). Both sections lie in one plane facing +z, so a camera
// on +z sees the whole path the sound takes: the driver in the cup, the air in the cup, the ear canal, the eardrum.
// The waves of every section shot run along `path` (driver -> drum), in that plane.
import { ANTI } from './colors.js';

export async function section(k, { hpColor = 'silver' } = {}) {
  const { THREE, scene, props } = k;
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  // the ear block, 1 unit tall (0.12 m: about 8.3 units a metre). A darker clay than the default: the section is the
  // biggest surface in these frames and a pale one lifts the whole night frame (look.md section 9)
  const ear = await props.ear({ height: 1, cutaway: true, color: '#7a6359', capColor: '#5e4a41', canalColor: '#7a3c35', drumColor: '#e6d2c2', accent: ANTI });
  scene.add(ear);
  ear.updateMatrixWorld(true);
  // the cut faces get a fine tissue bump, so they read as a section through something, not as a painted wall
  const tissue = k.look.noiseTexture({ kind: 'fbm', scale: 10, repeat: 3, seed: 6 });
  for (const m of ear.caps || []) { m.material = m.material.clone(); m.material.bumpMap = tissue; m.material.bumpScale = 0.6; m.material.roughness = 0.75; }
  const pm = ear.userData.perMetre, mm = pm / 1000;
  const W = (name) => ear.anchor(name).getWorldPosition(V());
  const O = W('opening'), mid = W('canal'), D = W('drum');
  // the headphones at the ear's scale, the cushion resting on the side of the head round the ear; the cup's section in
  // the ear's section plane (z = O.z). Their foam section is darkened for the same reason as the ear's.
  const hp = props.headphones({ perMetre: pm, color: hpColor, cutaway: true, accent: ANTI });
  hp.position.set(O.x - 74 * mm, O.y + 3 * mm, O.z);
  scene.add(hp);
  // the cutaway opens only the cup: the yoke and the band still arc in front of the section and hide it, so a
  // clipping plane removes everything of the headphones in front of the section plane
  k.renderer.localClippingEnabled = true;
  const clip = [new THREE.Plane(new THREE.Vector3(0, 0, -1), O.z + 0.3 * mm)];
  hp.traverse((m) => {
    if (!m.isMesh) return;
    for (const mt of Array.isArray(m.material) ? m.material : [m.material]) {
      const hex = mt.color?.getHexString?.();
      if (hex === 'd9c9a3') mt.color.set('#3d4148');      // the cushion's foam, cut: cool grey, so the headphones never read as the ear
      if (hex === '8d939c') mt.color.set('#7c838d');      // the shell, cut
      mt.clippingPlanes = clip;
    }
  });
  hp.updateMatrixWorld(true);
  const driver = hp.anchor('driverL').getWorldPosition(V()); driver.z = O.z;
  // the path the sound takes in the section plane: off the driver's face, across the cup's air, into the canal at
  // the opening, along the canal to the drum
  const path = new THREE.CatmullRomCurve3([driver.clone().add(V(-1.2 * mm, 0, 0)), V((driver.x + O.x) / 2, (driver.y + O.y) / 2, O.z), O.clone(), mid.clone(), D.clone().add(V(1.0 * mm, 0, 0))], false, 'centripetal');
  return { ear, hp, pm, mm, O, mid, D, driver, path };
}

// A wave drawn along a curve in the plane z = const: the curve's centre line pushed sideways (in the plane) by
// f(s, u), s = arc length from the curve's start (world units), u = 0..1. glow.tube-like look (white-hot core), rebuilt
// on every set() like glow.wave: set({ f, from, to }) draws u in from..to. Pure: call it every update.
export function curveWave(k, curve, { color = ANTI, coreColor = null, intensity = 5, radius = 0.004, segments = 260, radial = 8 } = {}) {
  const { THREE } = k;
  const len = curve.getLength(), pts = curve.getSpacedPoints(segments), tan = [], nrm = [];
  for (let i = 0; i <= segments; i++) { const t = curve.getTangentAt(i / segments); tan.push(t); nrm.push(new THREE.Vector3(-t.y, t.x, 0).normalize()); }
  // reuse glow.wave's material and core by building a wave and swapping its geometry update
  const w = k.glow.wave({ length: 1, segments, radius, color, coreColor, intensity, radial });
  const mesh = w.children[0], geo = mesh.geometry, pos = geo.attributes.position, nor = geo.attributes.normal;
  w.rotation.set(0, 0, 0);
  const cs = Array.from({ length: radial }, (_, i) => [Math.cos((i / radial) * Math.PI * 2), Math.sin((i / radial) * Math.PI * 2)]);
  const c = new THREE.Vector3(), tt = new THREE.Vector3(), n = new THREE.Vector3(), b = new THREE.Vector3(0, 0, 1);
  w.set = ({ f = () => 0, from = 0, to = 1 } = {}) => {
    const h = len * 1e-3;
    for (let j = 0; j <= segments; j++) {
      const u = from + (to - from) * (j / segments), s = u * len;
      const i = Math.min(segments - 1, Math.floor(u * segments)), a = u * segments - i;
      c.copy(pts[i]).lerp(pts[i + 1], a); tt.copy(tan[i]).lerp(tan[i + 1], a).normalize(); n.copy(nrm[i]).lerp(nrm[i + 1], a).normalize();
      const y = f(s, u), dy = (f(s + h, u) - f(s - h, u)) / (2 * h);
      c.addScaledVector(n, y);
      // the line's own tangent and in-plane normal, for the tube's ring
      const tx = tt.x + n.x * dy, ty = tt.y + n.y * dy, tl = Math.hypot(tx, ty), nx = -ty / tl, ny = tx / tl;
      for (let r = 0; r < radial; r++) {
        const [cc, ss] = cs[r], o = (j * radial + r) * 3;
        const ox = nx * cc, oy = ny * cc, oz = ss;
        nor.array[o] = ox; nor.array[o + 1] = oy; nor.array[o + 2] = oz;
        pos.array[o] = c.x + ox * radius; pos.array[o + 1] = c.y + oy * radius; pos.array[o + 2] = c.z + oz * radius;
      }
    }
    pos.needsUpdate = true; nor.needsUpdate = true;
  };
  w.len = len;
  w.set({ to: 0 });
  return w;
}
