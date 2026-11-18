// The running example's world: a narrow-body cabin at night, the viewer's window seat, the tray table and the
// headphones standing on it. Every cabin shot builds it with cabin(k, o) and frames its own part of it.
// Units are metres; the floor is y = 0, the plane flies towards -z, the windows are on the left (-x). The viewer's
// row sits at z = 0; the tray table hangs off the seat in front, so the headphones stand at HP_POS.
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const PITCH = 0.8;                     // seat pitch
export const SEAT_X = [-1.485, -1.0, -0.515]; // window, middle and aisle seat centres (left block; the right block mirrors)
export const WIN_Z = -0.32;                   // the window beside the viewer's tray table
export const WIN_PITCH = 0.53;                // window frame pitch
export const WIN = { w: 0.27, h: 0.42, y: 1.02 };
export const TRAY = { x: -1.485, y: 0.72, z: -0.3, w: 0.4, d: 0.36 };
export const HP_POS = [-1.47, TRAY.y + 0.05, -0.31]; // the headphones' origin (between the cushions) when they stand on the tray

// the wall's profile: x of the left sidewall at height y (it leans in towards the bins)
export const wallX = (y) => -1.8 + 0.05 * Math.max(0, y - 0.55) ** 1.0 + 0.32 * Math.max(0, y - 1.15) ** 2;

// A night sky outside the windows, anchored to the world (the horizon stays level whatever the camera does): deep
// navy above, a thin warm band at the horizon (the last of the sunset, a little above eye level so it shows through a
// window seen from a seat), dark cloud tops below it, faint stars. HDR, unlit, not fogged.
export function nightSky(k, { radius = 300, band = 0.03, bandWidth = 0.009, warm = 7, seed = 3 } = {}) {
  const { THREE } = k;
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 32), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uBand: { value: band }, uW: { value: bandWidth }, uWarm: { value: warm }, uSeed: { value: seed } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize((modelMatrix * vec4(position, 1.)).xyz - cameraPosition); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform float uBand, uW, uWarm, uSeed; varying vec3 vD;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        float e = vD.y - uBand;                              // elevation above the horizon line (sine)
        vec3 c = mix(vec3(.012, .02, .05), vec3(.002, .004, .014), smoothstep(.0, .45, e));  // navy, darker overhead
        c += vec3(.4, .14, .04) * exp(-e / .025) * step(0., e);                             // dusk glow just above the line
        c += vec3(1., .5, .18) * uWarm * exp(-pow(e / uW, 2.));                              // the hot line itself
        // below the line: the tops of a cloud deck, dark, catching a little of the glow at their edge
        vec2 q = vD.xz / max(.04, -vD.y + uBand + .06) * 2.5;
        float cl = n(q) * .55 + n(q * 2.3) * .3 + n(q * 5.1) * .15;
        vec3 deck = vec3(.016, .018, .026) * (.5 + cl) + vec3(.3, .1, .03) * exp(e / .03) * cl;
        c = mix(c, deck, 1. - smoothstep(-uW * 2.5, -uW * .4, e));
        float s = step(.9975, h(floor(vD.xz / (vD.y + 1.2) * 420.))) * smoothstep(.08, .3, e);  // sparse faint stars
        c += vec3(.5, .55, .7) * s;
        gl_FragColor = vec4(c, 1.); }`,
  }));
  m.renderOrder = -1000; m.frustumCulled = false;
  return m;
}

// Build the cabin into k.scene. o: { rows: [first, last] (seat rows, z = row * PITCH), windows: [first, last] (window
// indices around WIN_Z), hp: true (the headphones on the tray), color (headphones), hpYaw, cove 1 (ceiling light),
// shades (how far the shades round the viewer's window are drawn, 0..1; default up) }.
// Returns { hp (the headphones), tray, M (the materials), windows, win (the hero window's centre), lights, zMin, zMax }.
export function cabin(k, o = {}) {
  const { THREE, scene, props } = k;
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const [r0, r1] = o.rows ?? [-6, 3];
  const [w0, w1] = o.windows ?? [-9, 5];
  const zMin = r0 * PITCH - 1.2, zMax = r1 * PITCH + 1.2, L = zMax - zMin, zMid = (zMin + zMax) / 2;
  const R = k.rng(o.seed ?? 21);

  // ---- materials: two roughness levels at least, fine bump on everything big (look.md section 5)
  const weave = k.look.noiseTexture({ kind: 'grain', repeat: 40, seed: 2 });
  const stipple = k.look.noiseTexture({ kind: 'fbm', scale: 40, repeat: 6, seed: 5 });
  const M = {
    fabric: new THREE.MeshPhysicalMaterial({ color: '#2a3243', roughness: 0.92, sheen: 0.6, sheenColor: new THREE.Color('#5d6b86'), sheenRoughness: 0.5, bumpMap: weave, bumpScale: 0.6, envMapIntensity: 0.25 }),
    leather: new THREE.MeshPhysicalMaterial({ color: '#6a6e78', roughness: 0.7, sheen: 0.4, sheenColor: new THREE.Color('#9aa3b8'), bumpMap: weave, bumpScale: 0.4, envMapIntensity: 0.3 }), // headrest covers
    screen: new THREE.MeshPhysicalMaterial({ color: '#05070b', roughness: 0.12, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.9 }),
    shell: k.mat.plastic('#3d4048', { rough: 0.45, clearcoat: 0.25, ccRough: 0.3, env: 0.5 }),
    trim: k.mat.metal('#6b7079', { rough: 0.35, env: 0.6 }),
    wall: k.mat.matte('#9a9894', { rough: 0.7, env: 0.25, extra: { bumpMap: stipple, bumpScale: 0.15 } }),
    bezel: k.mat.plastic('#a9a7a2', { rough: 0.5, clearcoat: 0.15, ccRough: 0.35, env: 0.35 }),
    reveal: k.mat.matte('#5d5c5a', { rough: 0.8, env: 0.15 }),
    shade: k.mat.matte('#b8b6b0', { rough: 0.75, env: 0.2 }),
    bin: k.mat.plastic('#aeaca6', { rough: 0.55, clearcoat: 0.12, ccRough: 0.4, env: 0.3 }),
    seam: new THREE.MeshStandardMaterial({ color: '#141518', roughness: 0.9 }),
    carpet: new THREE.MeshLambertMaterial({ color: '#191c24', bumpMap: k.look.noiseTexture({ kind: 'grain', repeat: 90, seed: 8 }), bumpScale: 1.5 }),
    tray: k.mat.plastic('#45484f', { rough: 0.42, clearcoat: 0.3, ccRough: 0.3, env: 0.5 }),
  };

  // ---- the floor, and the aisle's path lights (two thin cool strips)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(4, L).rotateX(-Math.PI / 2), M.carpet);
  floor.position.z = zMid; floor.receiveShadow = true; scene.add(floor);
  for (const sx of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.006, L), k.mat.emissive('#9fb6ff', 1.6));
    strip.position.set(sx * 0.27, 0.003, zMid); scene.add(strip);
  }

  // ---- the sidewalls (both sides), with window holes on the band between y 0.72 and 1.34. The band is a flat shape
  // with holes bent onto the wall's profile; below and above it plain strips follow the curve.
  const winShape = (cx, cy, w, h, r) => {
    const s = new THREE.Path(); const x0 = cx - w / 2, y0 = cy - h / 2;
    s.moveTo(x0 + r, y0); s.lineTo(x0 + w - r, y0); s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r); s.lineTo(x0 + w, y0 + h - r);
    s.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h); s.lineTo(x0 + r, y0 + h); s.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r);
    s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0); return s;
  };
  const bandY = [0.7, 1.36];
  const winZ = []; for (let i = w0; i <= w1; i++) winZ.push(WIN_Z + i * WIN_PITCH);
  const band = new THREE.Shape(); band.moveTo(zMin, bandY[0]); band.lineTo(zMax, bandY[0]); band.lineTo(zMax, bandY[1]); band.lineTo(zMin, bandY[1]); band.lineTo(zMin, bandY[0]);
  for (const z of winZ) band.holes.push(winShape(z, WIN.y, WIN.w + 0.07, WIN.h + 0.07, 0.1));
  const bendBand = (geo, sx) => { // the flat shape (u = z, v = y) laid onto the wall's profile
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const u = p.getX(i), v = p.getY(i); p.setXYZ(i, -sx * wallX(v), v, u); }
    geo.computeVertexNormals(); return geo;
  };
  const strip = (ya, yb, sx, n = 24) => { // a curved strip of wall from ya to yb
    const g = new THREE.PlaneGeometry(L, 1, 1, n); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const u = p.getX(i), y = ya + (yb - ya) * (p.getY(i) + 0.5); p.setXYZ(i, -sx * wallX(y), y, zMid + u); }
    g.computeVertexNormals(); return g;
  };
  for (const sx of [-1, 1]) {
    const parts = [bendBand(new THREE.ShapeGeometry(band, 12), sx), strip(0, bandY[0], sx), strip(bandY[1], 1.62, sx)];
    const wall = new THREE.Mesh(mergeGeometries(parts.map((g) => g.toNonIndexed())), M.wall);
    wall.material.side = THREE.DoubleSide; wall.receiveShadow = true; scene.add(wall);
  }

  // ---- each window: a bevelled bezel frame, the reveal (a short tunnel out through the hull), a half-drawn shade on
  // some, and the sky behind. The hero window keeps its shade up.
  const bezelShape = new THREE.Shape(); { const w = WIN.w + 0.11, h = WIN.h + 0.11, r = 0.12, x0 = -w / 2, y0 = -h / 2;
    bezelShape.moveTo(x0 + r, y0); bezelShape.lineTo(x0 + w - r, y0); bezelShape.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r); bezelShape.lineTo(x0 + w, y0 + h - r);
    bezelShape.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h); bezelShape.lineTo(x0 + r, y0 + h); bezelShape.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r);
    bezelShape.lineTo(x0, y0 + r); bezelShape.quadraticCurveTo(x0, y0, x0 + r, y0); }
  bezelShape.holes.push(winShape(0, 0, WIN.w, WIN.h, 0.095));
  const bezelGeo = new THREE.ExtrudeGeometry(bezelShape, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 4, curveSegments: 16 });
  // the reveal: the window's outline swept 0.09 m outwards, narrowing a little
  const revealGeo = (() => {
    const pts = winShape(0, 0, WIN.w, WIN.h, 0.095).getSpacedPoints(96); const pos = [], idx = [];
    for (let j = 0; j < 2; j++) for (const p of pts) { const s = j ? 0.9 : 1; pos.push(p.x * s, p.y * s, -0.09 * j); }
    const n = pts.length; for (let i = 0; i < n - 1; i++) idx.push(i, i + 1, n + i, i + 1, n + i + 1, n + i);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  })();
  const shadeGeo = new RoundedBoxGeometry(WIN.w * 0.92, WIN.h * 0.95, 0.006, 2, 0.003);
  const windows = [];
  for (const sx of [-1, 1]) for (const z of winZ) {
    const g = new THREE.Group();
    const lean = Math.atan(0.05);  // the wall's lean at the window band
    g.position.set(-sx * wallX(WIN.y) - sx * 0.002, WIN.y, z);
    g.rotation.set(0, sx < 0 ? Math.PI / 2 : -Math.PI / 2, 0); g.rotateX(lean); // local +z faces into the cabin
    const bz = new THREE.Mesh(bezelGeo, M.bezel); bz.position.z = -0.006; bz.castShadow = bz.receiveShadow = true; g.add(bz);
    const rv = new THREE.Mesh(revealGeo, M.reveal); rv.material.side = THREE.DoubleSide; g.add(rv);
    const hero = sx < 0 && Math.abs(z - WIN_Z) < 1e-6, nearHero = sx < 0 && Math.abs(z - WIN_Z) < 2.5 * WIN_PITCH;
    const r1 = R(), r2 = R();
    const drawn = nearHero ? (o.shades ?? 0.02) : r1 < 0.45 ? 0.35 + r2 * 0.6 : r2 * 0.15; // how far each shade is pulled down (up round the viewer's, unless o.shades)
    if (drawn > 0.04) { const sh = new THREE.Mesh(shadeGeo, M.shade); sh.scale.y = drawn; sh.position.set(0, WIN.h * 0.475 * (1 - drawn), -0.03); g.add(sh); } // hangs from the top
    scene.add(g); windows.push({ g, z, sx, hero });
  }

  // ---- overhead bins over both seat blocks: one extruded profile, door seams, latches; the service panel (PSU)
  // under them with a reading light, a call button and the seat-belt sign per row (a canvas texture)
  const binProfile = new THREE.Shape();
  binProfile.moveTo(-1.66, 1.6); binProfile.lineTo(-1.02, 1.6); binProfile.quadraticCurveTo(-0.92, 1.6, -0.91, 1.7);
  binProfile.lineTo(-0.88, 1.98); binProfile.quadraticCurveTo(-0.875, 2.05, -0.95, 2.06); binProfile.lineTo(-1.5, 2.0); binProfile.lineTo(-1.66, 1.6);
  const binGeo = new THREE.ExtrudeGeometry(binProfile, { depth: L, bevelEnabled: false, curveSegments: 10 });
  const psuTex = psuTexture(k);
  for (const sx of [-1, 1]) {
    const bin = new THREE.Mesh(binGeo, M.bin); bin.position.z = zMin; bin.scale.x = -sx; bin.castShadow = bin.receiveShadow = true; scene.add(bin); // the right one mirrored
    for (let z = zMin + 0.35; z < zMax; z += 1.06) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.4, 0.006), M.seam); s.position.set(sx * 0.894, 1.83, z); s.rotation.z = sx * 0.1; scene.add(s);
      const latch = new THREE.Mesh(new RoundedBoxGeometry(0.012, 0.035, 0.16, 2, 0.004), M.seam); latch.position.set(sx * 0.897, 1.93, z + 0.53); latch.rotation.z = sx * 0.1; scene.add(latch);
    }
    // the PSU: a strip under the bin, textured per row
    const psu = new THREE.Mesh(new THREE.PlaneGeometry(0.58, L).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#ffffff', map: psuTex.map, emissiveMap: psuTex.emit, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1, roughness: 0.6, envMapIntensity: 0.3 }));
    psu.material.map.repeat.set(1, L / PITCH); psu.material.emissiveMap.repeat.set(1, L / PITCH);
    psu.material.map.offset.set(0, (zMin / PITCH) % 1); psu.material.emissiveMap.offset.copy(psu.material.map.offset);
    psu.position.set(sx * 1.33, 1.597, zMid); if (sx > 0) psu.scale.x = -1; scene.add(psu);
  }
  // ceiling: a shallow vault between the bins, and the cove light strips that wash it (cool, dim: night mode)
  const ceil = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, L, 64, 1, true, -0.36, 0.72).rotateX(-Math.PI / 2), M.wall.clone());
  ceil.material.side = THREE.BackSide; ceil.position.set(0, 2.227 - 2.6, zMid); scene.add(ceil); // edges at y 2.06 over the bins
  const cove = o.cove ?? 1;
  for (const sx of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.01, L), k.mat.emissive('#8c9cff', 2.2 * cove)); c.position.set(sx * 0.93, 2.07, zMid); scene.add(c);
  }
  // bulkheads at both ends (the front one with a dim galley curtain glow), so no end of the tube shows the sky
  for (const [z, front] of [[zMin, true], [zMax, false]]) {
    const bh = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.4), M.wall.clone()); bh.material.side = THREE.DoubleSide;
    bh.position.set(0, 1.2, z); scene.add(bh);
    if (front) { const cur = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.85), k.mat.emissive('#9aa6d6', 0.35)); cur.position.set(0, 0.93, z + 0.01); scene.add(cur); }
  }
  const lights = [];
  for (let z = zMin + 1; z < zMax; z += 2.2) {
    const pl = new THREE.PointLight('#8a97ff', 1.6 * cove, 3.6, 1.6); pl.position.set(0, 2.0, z); scene.add(pl); lights.push(pl);
  }

  // ---- seats: one seat built from rounded boxes, merged per material, instanced across the rows (6 abreast)
  const RB = (w, h, d, r, x, y, z, rx = 0) => { const g = new RoundedBoxGeometry(w, h, d, 3, r); g.rotateX(rx); g.translate(x, y, z); return g; };
  const seatParts = {
    fabric: [RB(0.44, 0.11, 0.46, 0.04, 0, 0.46, -0.02), RB(0.43, 0.6, 0.12, 0.045, 0, 0.8, 0.22, 0.12)],
    leather: [RB(0.32, 0.16, 0.1, 0.04, 0, 1.08, 0.27, 0.12)],
    shell: [RB(0.45, 0.66, 0.05, 0.02, 0, 0.8, 0.3, 0.12), RB(0.45, 0.06, 0.48, 0.02, 0, 0.375, 0.0)],
    // the back of the seat, which the row behind looks at: the stowed tray table and its latch, the screen
    tray: [RB(0.37, 0.27, 0.014, 0.012, 0, 0.78, 0.33, 0.12), RB(0.06, 0.02, 0.016, 0.006, 0, 0.935, 0.346, 0.12)],
    screen: [RB(0.23, 0.14, 0.01, 0.006, 0, 1.0, 0.352, 0.12)],
    trim: [RB(0.04, 0.32, 0.04, 0.012, 0, 0.18, 0.12)],
  };
  const seatGeo = Object.fromEntries(Object.entries(seatParts).map(([m, gs]) => [m, mergeGeometries(gs.map((g) => g.toNonIndexed()))]));
  const seatMats = []; // the left block at SEAT_X, the right block mirrored
  for (let r = r0; r <= r1; r++) for (const sx of [-1, 1]) for (const x of SEAT_X) seatMats.push(new THREE.Matrix4().makeTranslation(sx < 0 ? x : -x, 0, r * PITCH));
  for (const [m, geo] of Object.entries(seatGeo)) {
    const im = new THREE.InstancedMesh(geo, M[m], seatMats.length);
    seatMats.forEach((mx, i) => im.setMatrixAt(i, mx));
    im.castShadow = im.receiveShadow = true; scene.add(im);
  }
  // armrests: four per block of three, between and outside the seats
  const armGeo = mergeGeometries([RB(0.05, 0.05, 0.44, 0.02, 0, 0.64, 0.0), RB(0.035, 0.24, 0.05, 0.012, 0, 0.5, 0.17)].map((g) => g.toNonIndexed()));
  const arms = new THREE.InstancedMesh(armGeo, M.shell, (r1 - r0 + 1) * 8); let ai = 0;
  for (let r = r0; r <= r1; r++) for (const sx of [-1, 1]) for (const x of [-1.742, -1.2425, -0.7575, -0.2725]) arms.setMatrixAt(ai++, new THREE.Matrix4().makeTranslation(sx < 0 ? x : -x, 0, r * PITCH));
  arms.castShadow = arms.receiveShadow = true; scene.add(arms);

  // ---- the viewer's tray table, folded down off the seat in front, and the headphones standing on it
  const tray = new THREE.Mesh(props.slabGeometry(TRAY.w, TRAY.d, 0.022, { rc: 0.035, top: 0.008, bottom: 0.006 }), M.tray);
  tray.position.set(TRAY.x, TRAY.y - 0.022, TRAY.z); tray.castShadow = tray.receiveShadow = true; scene.add(tray);
  for (const s of [-1, 1]) { const arm = new THREE.Mesh(new RoundedBoxGeometry(0.02, 0.03, 0.34, 2, 0.008), M.trim); arm.position.set(TRAY.x + s * 0.205, TRAY.y - 0.03, TRAY.z - 0.02); scene.add(arm); }
  let hp = null;
  if (o.hp !== false) {
    hp = props.headphones({ perMetre: 1, color: o.color ?? 'silver' });
    hp.position.set(...HP_POS);
    hp.rotation.y = o.hpYaw ?? -0.96; // the left cup's outer face (and its mic) turned to the aisle and the back, where cameras fit
    scene.add(hp);
    const cs = props.contactShadow({ width: 0.32, depth: 0.12, opacity: 0.6, shape: 'round' }); cs.position.set(HP_POS[0], TRAY.y + 0.0006, HP_POS[2]); cs.rotation.z = hp.rotation.y; scene.add(cs);
  }
  return { hp, tray, M, windows, win: V(wallX(WIN.y), WIN.y, WIN_Z), lights, zMin, zMax };
}

// The passenger service unit under the bins, one row per texture repeat: reading lights with faintly lit rims, the
// seat-belt sign and a speaker grille (the viewer's own panel is the 3D callPanel below). map + emissive map.
export function psuTexture(k) {
  const { THREE } = k;
  const W = 256, H = 352; // 0.58 m wide by one seat pitch (0.8 m)
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const a = mk(), e = mk(); const g = a.getContext('2d'), ge = e.getContext('2d');
  g.fillStyle = '#9c9a95'; g.fillRect(0, 0, W, H); ge.fillStyle = '#0c0e14'; ge.fillRect(0, 0, W, H); // a faint glow: night mode spill
  ge.fillStyle = '#3a4258'; for (let i = 0; i < 3; i++) { ge.beginPath(); ge.arc(60 + i * 62, 120, 15, 0, 7); ge.fill(); } // lit reading-light rims
  g.fillStyle = '#86847f'; g.fillRect(0, 0, W, 3); // panel joint
  const dot = (x, y, r, c) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = c; g.fill(); };
  for (let i = 0; i < 3; i++) { dot(60 + i * 62, 120, 15, '#4e4d4a'); dot(60 + i * 62, 120, 9, '#2a2a29'); dot(60 + i * 62, 200, 12, '#d9d6cf'); }
  // the seat-belt sign (unlit at cruise) and the speaker grille
  g.fillStyle = '#2f2e2c'; g.fillRect(40, 250, 70, 34); g.fillStyle = '#4a4946'; for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { g.beginPath(); g.arc(150 + i * 13, 258 + j * 11, 3.2, 0, 7); g.fill(); }
  const tex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };
  return { map: tex(a), emit: tex(e) };
}

// The viewer's own service panel, under the bin over the window seat (the voice shot looks up at it): a rounded panel
// with the reading light, the call button with its flight attendant pictogram (lit by set(v)) and the speaker grille
// the cabin announcements come out of. Returns { group, set(v), speaker, button, lamp } (the last three world points).
export function callPanel(k, { z = 0.02 } = {}) {
  const { THREE, scene, props } = k;
  const g = new THREE.Group(); g.position.set(-1.33, 1.594, z); scene.add(g);
  const plate = new THREE.Mesh(props.slabGeometry(0.34, 0.2, 0.01, { rc: 0.03, top: 0.004 }), k.mat.plastic('#8f8d88', { rough: 0.55, env: 0.3 }));
  plate.rotation.x = Math.PI; g.add(plate); // hangs down from the bin, its face looking at the floor
  // the pictogram: a person in a circle, drawn once into a canvas (white on dark), lit through an emissive map
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#1b1c1f'; x.fillRect(0, 0, 256, 256); x.strokeStyle = x.fillStyle = '#ffffff'; x.lineWidth = 10;
  x.beginPath(); x.arc(128, 128, 108, 0, 7); x.stroke();
  // a standing figure, the call-button pictogram: head, a body widening to the shoulders, arms down, legs
  x.beginPath(); x.arc(128, 58, 19, 0, 7); x.fill();
  x.beginPath(); x.moveTo(104, 88); x.lineTo(152, 88); x.quadraticCurveTo(160, 88, 160, 96); x.lineTo(160, 146); x.lineTo(148, 146); x.lineTo(148, 206);
  x.lineTo(132, 206); x.lineTo(132, 154); x.lineTo(124, 154); x.lineTo(124, 206); x.lineTo(108, 206); x.lineTo(108, 146); x.lineTo(96, 146); x.lineTo(96, 96);
  x.quadraticCurveTo(96, 88, 104, 88); x.closePath(); x.fill();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const btnMat = new THREE.MeshStandardMaterial({ color: '#2a2b2f', map: tex, emissiveMap: tex, emissive: new THREE.Color('#cfe2ff'), emissiveIntensity: 0, roughness: 0.45 });
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.008, 48), btnMat);
  btn.position.set(0.06, -0.013, -0.02); g.add(btn);
  btn.geometry.rotateY(Math.PI); // the pictogram upright for a seated viewer looking up and forward
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.012, 40), k.mat.metal('#a7abb2', { rough: 0.3 }));
  lamp.position.set(-0.07, -0.014, -0.03); g.add(lamp);
  const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.016, 32).rotateX(Math.PI / 2), k.mat.emissive('#eef2ff', 1.6)); // the reading light, on
  bulb.position.set(-0.07, -0.0205, -0.03); g.add(bulb);
  const grille = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.006, 48), new THREE.MeshStandardMaterial({ color: '#1a1b1e', roughness: 0.8, bumpMap: k.look.noiseTexture({ kind: 'grain', repeat: 3, seed: 9 }), bumpScale: 2 }));
  grille.position.set(0.0, -0.012, 0.055); g.add(grille);
  const glowS = k.fx.glowSprite({ color: '#cfe2ff', intensity: 0, size: 0.09 }); glowS.position.set(0.06, -0.03, -0.02); glowS.frustumCulled = false; g.add(glowS); // never culled: its halo would pop off at the frame edge
  g.updateMatrixWorld(true);
  return {
    group: g,
    set: (v) => { btnMat.emissiveIntensity = 0.9 * v; glowS.setIntensity(0.5 * v); }, // soft: the pictogram must stay a pictogram
    speaker: grille.getWorldPosition(new THREE.Vector3()),
    button: btn.getWorldPosition(new THREE.Vector3()),
    lamp: bulb.getWorldPosition(new THREE.Vector3()),
  };
}
