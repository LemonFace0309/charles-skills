#!/usr/bin/env bun
// Bakes kit/models/hand.glb from the raw sculpt (hand-sculpt.glb): finger lengths and thicknesses that vary like a
// real hand, the nail grooves smoothed, mask channels for the skin shader (nail plate, free edge, flush) and the
// thumb's press rig (per-vertex joint weights plus the joints in the mesh's extras), so props.hand() can bend the
// thumb onto the screen. Everything is in file units (after the sculpt's node transform; the hand stands on its wrist
// cut at y = 0, 1.087 tall, the phone box centred at (-0.002, 0.7335, 0.0467)).
//
//   bun kit/models/bake-hand.mjs [src.glb] [out.glb]
//   Looks: --debug (COLOR_0 = which finger owns each vertex, centerlines in <out>.debug.json), --masks (COLOR_0 = the
//   skin masks), --pose=0.5 (bake the thumb pressed that far). Tuning: --no-shape, --only-d, --only-k, --no-nailsmooth,
//   --no-press, --groove=0.3, --reach=0.035 (the pad's target, file units in from the phone's edge), --maxroll=deg,
//   --w1a / --w1b (where the thumb's turn fades out over the thenar, geodesic from its tip). View a --debug or --masks
//   file with props.model(url, { material: () => new THREE.MeshStandardMaterial({ vertexColors: true }) }).
import fs from 'node:fs';
import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const KIT = process.env.KIT || path.resolve(HERE, '..');
const THREE = await import(KIT + '/node_modules/three/build/three.module.js');
const { GLTFLoader } = await import(KIT + '/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
const { MeshoptDecoder: MD3 } = await import(KIT + '/node_modules/three/examples/jsm/libs/meshopt_decoder.module.js');
const argv = process.argv.slice(2), flags = new Set(argv.filter((a) => a.startsWith('--'))), files = argv.filter((a) => !a.startsWith('--'));
const SRC = files[0] || path.join(KIT, 'models/hand-sculpt.glb'), OUT = files[1] || path.join(KIT, 'models/hand.glb');
const DEBUG = flags.has('--debug');
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- 1. load (float positions in file units) ----------
const buf = fs.readFileSync(SRC);
const L = new GLTFLoader(); L.setMeshoptDecoder(MD3);
const gltf = await new Promise((res, rej) => L.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej));
gltf.scene.updateMatrixWorld(true);
let srcMesh; gltf.scene.traverse((o) => { if (o.isMesh) srcMesh = o; });
const fl = (a) => { const out = new Float32Array(a.count * a.itemSize); for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) out[i * a.itemSize + c] = a.getComponent(i, c); return out; };
let geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(fl(srcMesh.geometry.attributes.position), 3));
geo.setIndex(new THREE.BufferAttribute(Uint32Array.from(srcMesh.geometry.index.array), 1));
geo.applyMatrix4(srcMesh.matrixWorld);
geo.computeBoundingBox();
const srcBox = geo.boundingBox.clone(); // the sculpt's box (its top is the removed phone's top edge): the prop's size and centre

// ---------- 2. drop what the phone's removal left: strips lying flat on the phone's faces, and 103 loose slivers ----------
{
  // a strip on the phone's side face ran up from the thumb's tip: once the thumb rolls (press) it showed as a thin loop
  const P = geo.attributes.position, I0 = geo.index.array, keep = [];
  const pc = [-0.002, 0.7335, 0.0467], ph = [0.175, 0.3532, 0.0353];
  const face = (x, y, z) => { const d = [Math.abs(x - pc[0]) - ph[0], Math.abs(y - pc[1]) - ph[1], Math.abs(z - pc[2]) - ph[2]]; const a = d.indexOf(Math.max(...d)); return { dist: Math.max(...d), axis: a }; };
  const tA = new THREE.Vector3(), tB = new THREE.Vector3(), tC = new THREE.Vector3(), tn = new THREE.Vector3();
  let dropped = 0;
  for (let t = 0; t < I0.length; t += 3) {
    tA.fromBufferAttribute(P, I0[t]); tB.fromBufferAttribute(P, I0[t + 1]); tC.fromBufferAttribute(P, I0[t + 2]);
    const fa = face(tA.x, tA.y, tA.z), fb = face(tB.x, tB.y, tB.z), fc = face(tC.x, tC.y, tC.z);
    tn.subVectors(tB, tA).cross(tC.clone().sub(tA)).normalize();
    const flat = Math.abs(fa.dist) < 0.0015 && Math.abs(fb.dist) < 0.0015 && Math.abs(fc.dist) < 0.0015 && fa.axis === fb.axis && fb.axis === fc.axis && Math.abs(tn.getComponent(fa.axis)) > 0.9;
    // needles near the phone's surface (the strips' triangles are thin and twisted, so their normals say nothing)
    const e1 = tA.distanceTo(tB), e2 = tB.distanceTo(tC), e3 = tC.distanceTo(tA), area = 0.5 * tB.clone().sub(tA).cross(tC.clone().sub(tA)).length();
    const needle = Math.max(e1, e2, e3) ** 2 / Math.max(1e-12, 2 * area) > 12 && Math.max(Math.abs(fa.dist), Math.abs(fb.dist), Math.abs(fc.dist)) < 0.004;
    if (flat || needle) dropped++; else keep.push(I0[t], I0[t + 1], I0[t + 2]);
  }
  // then peel the strips from their ends: a triangle against the phone with a corner that two or fewer triangles share
  let kept = keep, peeled = 0;
  for (let pass = 0; pass < 60; pass++) {
    const val = new Uint16Array(P.count); for (const i of kept) val[i]++;
    const next = [];
    for (let t = 0; t < kept.length; t += 3) {
      const a = kept[t], b = kept[t + 1], c = kept[t + 2];
      const onIt = [a, b, c].every((i) => Math.abs(face(P.getX(i), P.getY(i), P.getZ(i)).dist) < 0.004);
      if (onIt && Math.min(val[a], val[b], val[c]) <= 2) peeled++; else next.push(a, b, c);
    }
    if (next.length === kept.length) break; kept = next;
  }
  geo.setIndex(new THREE.BufferAttribute(Uint32Array.from(kept), 1));
  console.log(`dropped ${dropped} triangles lying flat on the phone's faces or needle-thin against it, peeled ${peeled} strip triangles`);
}
{
  const P = geo.attributes.position, n = P.count, I = geo.index.array;
  const parent = Int32Array.from({ length: n }, (_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  for (let t = 0; t < I.length; t += 3) { const a = find(I[t]), b = find(I[t + 1]), c = find(I[t + 2]); parent[b] = a; parent[find(c)] = a; }
  const count = new Map(); for (let v = 0; v < n; v++) { const r = find(v); count.set(r, (count.get(r) || 0) + 1); }
  const main = [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const keepV = new Int32Array(n).fill(-1); let m = 0;
  for (let v = 0; v < n; v++) if (find(v) === main) keepV[v] = m++;
  const pos = new Float32Array(m * 3); for (let v = 0; v < n; v++) if (keepV[v] >= 0) { pos[keepV[v] * 3] = P.getX(v); pos[keepV[v] * 3 + 1] = P.getY(v); pos[keepV[v] * 3 + 2] = P.getZ(v); }
  const idx = []; for (let t = 0; t < I.length; t += 3) if (keepV[I[t]] >= 0) idx.push(keepV[I[t]], keepV[I[t + 1]], keepV[I[t + 2]]);
  geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(new THREE.BufferAttribute(Uint32Array.from(idx), 1));
  console.log(`main piece: ${m} of ${n} vertices, ${idx.length / 3} triangles`);
  // vertices no triangle uses any more are dropped above (they are not in the main piece)
}
const pos = geo.attributes.position.array, N = geo.attributes.position.count, IDX = geo.index.array;
const rest = pos.slice();
const adj = Array.from({ length: N }, () => new Set());
for (let t = 0; t < IDX.length; t += 3) { const a = IDX[t], b = IDX[t + 1], c = IDX[t + 2]; adj[a].add(b); adj[a].add(c); adj[b].add(a); adj[b].add(c); adj[c].add(a); adj[c].add(b); }
const adjA = adj.map((s) => [...s]);
const PV = (v, arr = pos) => V(arr[v * 3], arr[v * 3 + 1], arr[v * 3 + 2]);
const d3 = (a, b) => Math.hypot(rest[a * 3] - rest[b * 3], rest[a * 3 + 1] - rest[b * 3 + 1], rest[a * 3 + 2] - rest[b * 3 + 2]);
function dijkstra(srcs) {
  const d = new Float64Array(N).fill(Infinity), heap = [];
  const push = (v, k) => { heap.push([k, v]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let s = i; if (l < heap.length && heap[l][0] < heap[s][0]) s = l; if (r < heap.length && heap[r][0] < heap[s][0]) s = r; if (s === i) break; [heap[s], heap[i]] = [heap[i], heap[s]]; i = s; } } return top; };
  for (const s of srcs) { d[s] = 0; push(s, 0); }
  while (heap.length) { const [k, v] = pop(); if (k > d[v]) continue; for (const u of adjA[v]) { const nk = k + d3(v, u); if (nk < d[u]) { d[u] = nk; push(u, nk); } } }
  return d;
}
const nearest = (p) => { let best = -1, bd = Infinity; for (let v = 0; v < N; v++) { const d = (rest[v * 3] - p[0]) ** 2 + (rest[v * 3 + 1] - p[1]) ** 2 + (rest[v * 3 + 2] - p[2]) ** 2; if (d < bd) { bd = d; best = v; } } return best; };

// the phone box the sculpt held (NOTICE.md): vertices on its surface are slivers left by its removal
const PC = V(-0.002, 0.7335, 0.0467), PH = V(0.175, 0.3532, 0.0353);
const boxDist = (p) => { const dx = Math.abs(p.x - PC.x) - PH.x, dy = Math.abs(p.y - PC.y) - PH.y, dz = Math.abs(p.z - PC.z) - PH.z; return Math.max(dx, dy, dz); };
const onPhone = (v) => Math.abs(boxDist(PV(v, rest))) < 0.004;

// ---------- 3. fingers: tips, geodesic distance, centerlines ----------
// tips found as the geodesic maxima from the wrist cut (bake once, kept by position so a re-bake is stable)
const FINGERS = {
  thumb: { tip: [-0.190, 0.788, 0.083], base: 0.30 },
  index: { tip: [0.189, 0.814, 0.151], base: 0.44 },
  middle: { tip: [0.186, 0.696, 0.150], base: 0.44 },
  ring: { tip: [0.176, 0.586, 0.151], base: 0.38 },
  pinky: { tip: [0.163, 0.495, 0.152], base: 0.35 },
};
const names = Object.keys(FINGERS);
for (const nm of names) { const F = FINGERS[nm]; F.v = nearest(F.tip); F.d = dijkstra([F.v]); }
// owner: the finger whose tip is geodesically nearest, within its base length (+ a margin for the blend)
const owner = new Int8Array(N).fill(-1);
for (let v = 0; v < N; v++) { let best = -1, bd = Infinity; names.forEach((nm, i) => { const F = FINGERS[nm], d = F.d[v]; if (d < F.base + 0.06 && d < bd) { bd = d; best = i; } }); owner[v] = best; }
// centerline: ring centroids along the geodesic distance s from the tip (rings of equal s), smoothed. Indexed by s
// itself, so neighbouring vertices (whose s differ little) always get neighbouring frames: a closest-point
// parameter jumps across the inside of a tight curl and crumpled the tips.
function centerline(nm) {
  const F = FINGERS[nm], fi = names.indexOf(nm), H = 0.01, pts = [];
  const M = Math.ceil((F.base + 0.06) / H);
  for (let i = 0; i <= M; i++) {
    const s = i * H, c = V(); let n = 0;
    for (let v = 0; v < N; v++) if (owner[v] === fi && Math.abs(F.d[v] - s) < 0.007 && !onPhone(v)) { c.x += rest[v * 3]; c.y += rest[v * 3 + 1]; c.z += rest[v * 3 + 2]; n++; }
    pts.push(n ? c.multiplyScalar(1 / n) : null);
  }
  for (let i = 0; i < pts.length; i++) if (!pts[i]) pts[i] = (pts[i - 1] || pts.find(Boolean)).clone();
  let P = pts;
  for (let it = 0; it < 4; it++) P = P.map((p, i) => (i === 0 || i === P.length - 1 ? p.clone() : P[i - 1].clone().add(p.clone().multiplyScalar(2)).add(P[i + 1]).multiplyScalar(0.25)));
  const at = (s) => { const x = Math.min(P.length - 1, Math.max(0, s / H)), i = Math.min(P.length - 2, Math.floor(x)), f = x - i; return P[i].clone().lerp(P[i + 1], f); };
  const tan = (s) => at(Math.min(M * H, s + 0.02)).sub(at(Math.max(0, s - 0.02))).normalize();
  // parallel-transport frames from the base end to the tip (no twist), sampled every H
  const T = P.map((_, i) => tan(i * H)), Nn = new Array(P.length);
  { const t = T[P.length - 1], a = Math.abs(t.x) < 0.9 ? V(1, 0, 0) : V(0, 1, 0); Nn[P.length - 1] = a.sub(t.clone().multiplyScalar(a.dot(t))).normalize(); }
  for (let i = P.length - 2; i >= 0; i--) { const q = new THREE.Quaternion().setFromUnitVectors(T[i + 1], T[i]); Nn[i] = Nn[i + 1].clone().applyQuaternion(q); Nn[i].sub(T[i].clone().multiplyScalar(Nn[i].dot(T[i]))).normalize(); }
  const frame = (s) => { const x = Math.min(P.length - 1, Math.max(0, s / H)), i = Math.min(P.length - 2, Math.floor(x)), f = x - i; const t = T[i].clone().lerp(T[i + 1], f).normalize(); const n = Nn[i].clone().lerp(Nn[i + 1], f); n.sub(t.clone().multiplyScalar(n.dot(t))).normalize(); return { c: at(s), t, n, b: t.clone().cross(n) }; };
  return { pts: P, len: M * H, at, tan, frame };
}
for (const nm of names) FINGERS[nm].c = centerline(nm);
// each finger vertex's parameter: its geodesic distance from the tip
const U = new Float64Array(N).fill(-1);
for (let v = 0; v < N; v++) if (owner[v] >= 0) U[v] = FINGERS[names[owner[v]]].d[v];
console.log('finger lengths (centerline):', names.map((nm) => `${nm} ${FINGERS[nm].c.len.toFixed(3)}`).join(', '));

// ---------- 4. finger shapes: retract along the curl, thickness per finger, a taper to the tip ----------
// D: how far the tip slides back along the finger's own curve (file units; the pinky ends shortest, the middle
// longest); k: thickness (cross-section scale; the sculpt's fingers were all about 0.045 thick, sausages); taper:
// the distal phalanx's extra scale (a real finger narrows to the tip).
const SHAPE = {
  thumb: { D: 0.0, k: 0.97, taper: 0.94 },
  index: { D: 0.03, k: 1.0, taper: 0.9 },
  middle: { D: 0.0, k: 0.92, taper: 0.9 },
  ring: { D: 0.025, k: 0.86, taper: 0.9 },
  pinky: { D: 0.06, k: 0.77, taper: 0.9 },
};
if (flags.has('--only-d')) for (const nm of names) { SHAPE[nm].k = 1; SHAPE[nm].taper = 1; }
if (flags.has('--only-k')) for (const nm of names) SHAPE[nm].D = 0;
if (!flags.has('--no-shape')) {
  for (const nm of names) {
    const F = FINGERS[nm], C = F.c, S = SHAPE[nm], base = F.base, fi = names.indexOf(nm);
    const uR = 0.05;                                                 // the tip cap is measured from this frame
    const uA = 0.11, uB = 0.82 * base;                               // the distal part slides rigidly; uA..uB stretches
    const dAt = (u) => S.D * (1 - smooth(uA, uB, u));
    const fA = C.frame(uA), fA2 = C.frame(uA + S.D);
    for (let v = 0; v < N; v++) {
      if (owner[v] !== fi) continue;
      const u = U[v], p = PV(v, rest);
      const wk = 1 - smooth(0.55 * base, 0.88 * base, u);
      const taper = THREE.MathUtils.lerp(S.taper, 1, smooth(0.03, 0.18, u));
      const k = 1 + (S.k * taper - 1) * wk;
      // the offset in the finger's frame at u (the cap in the frame at uR), thinner across the finger
      const f = C.frame(Math.max(u, uR)), o = p.clone().sub(f.c);
      let a = o.dot(f.t), b = o.dot(f.n), c = o.dot(f.b);
      b *= k; c *= k; if (u < uR) a *= k;
      // the distal part keeps its shape and slides as one along the curl; behind it each slice moves to u + d(u)
      const g = u < uA ? null : C.frame(Math.min(C.len, Math.max(u, uR) + dAt(u)));
      let out;
      if (!g) { // rigid: express in the frame at uA, rebuild in the frame at uA + D
        const q = f.c.clone().add(f.t.clone().multiplyScalar(a)).add(f.n.clone().multiplyScalar(b)).add(f.b.clone().multiplyScalar(c)).sub(fA.c);
        const A = q.dot(fA.t), B = q.dot(fA.n), Cc = q.dot(fA.b);
        out = fA2.c.clone().add(fA2.t.clone().multiplyScalar(A)).add(fA2.n.clone().multiplyScalar(B)).add(fA2.b.clone().multiplyScalar(Cc));
      } else out = g.c.clone().add(g.t.clone().multiplyScalar(a)).add(g.n.clone().multiplyScalar(b)).add(g.b.clone().multiplyScalar(c));
      pos[v * 3] = out.x; pos[v * 3 + 1] = out.y; pos[v * 3 + 2] = out.z;
    }
  }
}

// ---------- 5. nails: the side away from the phone, a rounded plate with a free edge; the sculpt's groove smoothed ----------
// palmar: from the finger's distal frame towards the nearest point of the phone box (a gripping pad faces the phone)
const boxClosest = (p) => V(Math.min(PC.x + PH.x, Math.max(PC.x - PH.x, p.x)), Math.min(PC.y + PH.y, Math.max(PC.y - PH.y, p.y)), Math.min(PC.z + PH.z, Math.max(PC.z - PH.z, p.z)));
const NAIL = { thumb: { L: 0.085, R: 0.042 }, index: { L: 0.075, R: 0.034 }, middle: { L: 0.075, R: 0.036 }, ring: { L: 0.07, R: 0.034 }, pinky: { L: 0.06, R: 0.03 } };
const nailMask = new Float32Array(N), edgeMask = new Float32Array(N), nailNear = new Float32Array(N);
// the sculpt's own nail plates: a region of the fingertip bounded by the groove cut round it. Concavity (the Laplacian
// along the normal, on the raw sculpt) marks the groove; a flood fill from the most dorsal point near the tip stops at it.
const restN = (() => { const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.BufferAttribute(rest, 3)); g2.setIndex(new THREE.BufferAttribute(IDX, 1)); g2.computeVertexNormals(); return g2.attributes.normal.array; })();
const concave = new Float32Array(N);
for (let v = 0; v < N; v++) {
  let x = 0, y = 0, z = 0, e = 0; const nb = adjA[v];
  for (const u of nb) { x += rest[u * 3]; y += rest[u * 3 + 1]; z += rest[u * 3 + 2]; e += d3(u, v); }
  x = x / nb.length - rest[v * 3]; y = y / nb.length - rest[v * 3 + 1]; z = z / nb.length - rest[v * 3 + 2]; e /= nb.length;
  concave[v] = (x * restN[v * 3] + y * restN[v * 3 + 1] + z * restN[v * 3 + 2]) / (e * e + 1e-12) * 0.004;
}
const GROOVE = +(argv.find((a) => a.startsWith('--groove='))?.split('=')[1] ?? 0.3), DORSAL = +(argv.find((a) => a.startsWith('--dorsal='))?.split('=')[1] ?? 0.3);
for (const nm of names) {
  const F = FINGERS[nm], C = F.c, fi = names.indexOf(nm), uR = 0.05, nl = NAIL[nm];
  const f0 = C.frame(uR);
  const palm = boxClosest(f0.c).sub(f0.c); palm.sub(f0.t.clone().multiplyScalar(palm.dot(f0.t))).normalize();
  F.palmar = palm.clone(); F.dorsal = palm.clone().negate();
  // seed: the vertex nearest the centroid of the groove (a U open at the free edge, so its centroid lies under the plate)
  const gc = V(); let gn = 0;
  for (let v = 0; v < N; v++) if (owner[v] === fi && U[v] < nl.L + 0.015 && concave[v] > 0.8) { gc.add(PV(v, rest)); gn++; }
  gc.multiplyScalar(1 / Math.max(1, gn));
  let seed = -1, sd = Infinity;
  for (let v = 0; v < N; v++) { if (owner[v] !== fi || U[v] > nl.L) continue; const d = PV(v, rest).distanceToSquared(gc); if (d < sd) { sd = d; seed = v; } }
  // flood fill to the groove, never further than the plate's size from the seed (the free edge has no groove to stop at)
  const inPlate = new Uint8Array(N), gd = new Float64Array(N).fill(Infinity); const q = [seed]; inPlate[seed] = 1; gd[seed] = 0; let n = 0;
  while (q.length) { const v = q.shift(); n++; for (const u of adjA[v]) { const du = gd[v] + d3(u, v); if (!inPlate[u] && owner[u] === fi && concave[u] < GROOVE && du < nl.R) { inPlate[u] = 1; gd[u] = du; q.push(u); } } }
  // soften the region's edge by one ring and mark the groove round it
  for (let v = 0; v < N; v++) if (inPlate[v]) nailMask[v] = 1;
  for (let it = 0; it < 2; it++) { const m2 = nailMask.slice(); for (let v = 0; v < N; v++) { if (owner[v] !== fi || U[v] > nl.L + 0.02) continue; let s = m2[v], c = 1; for (const u of adjA[v]) { s += m2[u]; c++; } nailMask[v] = Math.max(nailMask[v] * 0.6, s / c); } }
  // the groove (and a margin): what the smoothing pass works on
  const dist = new Float64Array(N).fill(Infinity), qq = []; for (let v = 0; v < N; v++) if (inPlate[v]) { dist[v] = 0; qq.push(v); }
  for (let i = 0; i < qq.length; i++) { const v = qq[i]; for (const u of adjA[v]) if (owner[u] === fi && dist[u] === Infinity && dist[v] + d3(u, v) < 0.02) { dist[u] = dist[v] + d3(u, v); qq.push(u); } }
  for (let v = 0; v < N; v++) if (isFinite(dist[v])) nailNear[v] = dist[v] === 0 ? 0.35 : 1 - smooth(0.012, 0.02, dist[v]);
  // the free edge: the plate's end at the tip
  for (let v = 0; v < N; v++) if (owner[v] === fi && nailMask[v] > 0) edgeMask[v] = nailMask[v] * (1 - smooth(0.004, 0.014, U[v]));
  console.log(`  nail ${nm}: ${n} vertices${n < 30 || n > 1500 ? ' (check the groove threshold)' : ''}`);
}
if (!flags.has('--no-nailsmooth')) {
  // Taubin smoothing (no shrink) over each nail and its rim: the sculpt cut a deep groove round the plate that read
  // as a dark claw at phone size; the plate is painted by the mask instead
  const tmp = new Float32Array(pos.length);
  const step = (lam) => {
    tmp.set(pos);
    for (let v = 0; v < N; v++) {
      const w = nailNear[v]; if (w <= 0) continue;
      let x = 0, y = 0, z = 0; const nb = adjA[v]; for (const u of nb) { x += tmp[u * 3]; y += tmp[u * 3 + 1]; z += tmp[u * 3 + 2]; }
      x /= nb.length; y /= nb.length; z /= nb.length;
      const k = lam * w;
      pos[v * 3] += k * (x - tmp[v * 3]); pos[v * 3 + 1] += k * (y - tmp[v * 3 + 1]); pos[v * 3 + 2] += k * (z - tmp[v * 3 + 2]);
    }
  };
  for (let it = 0; it < 30; it++) { step(0.55); step(-0.58); }
}

// ---------- 6. flush and creases (the skin shader's colour variation) ----------
const flush = new Float32Array(N), crease = new Float32Array(N);
for (let v = 0; v < N; v++) if (owner[v] >= 0) flush[v] = 1 - smooth(0.012, 0.11, U[v]);
{
  const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g2.setIndex(new THREE.BufferAttribute(IDX, 1)); g2.computeVertexNormals();
  const nrm = g2.attributes.normal.array, raw = new Float32Array(N);
  for (let v = 0; v < N; v++) {
    let x = 0, y = 0, z = 0, e = 0; const nb = adjA[v];
    for (const u of nb) { x += pos[u * 3]; y += pos[u * 3 + 1]; z += pos[u * 3 + 2]; e += Math.hypot(pos[u * 3] - pos[v * 3], pos[u * 3 + 1] - pos[v * 3 + 1], pos[u * 3 + 2] - pos[v * 3 + 2]); }
    x = x / nb.length - pos[v * 3]; y = y / nb.length - pos[v * 3 + 1]; z = z / nb.length - pos[v * 3 + 2]; e /= nb.length;
    raw[v] = (x * nrm[v * 3] + y * nrm[v * 3 + 1] + z * nrm[v * 3 + 2]) / (e * e + 1e-12) * 0.004; // ~ mean curvature x 0.004
  }
  let c = raw;
  for (let it = 0; it < 6; it++) { const nc = new Float32Array(N); for (let v = 0; v < N; v++) { let sum = c[v]; for (const u of adjA[v]) sum += c[u]; nc[v] = sum / (adjA[v].length + 1); } c = nc; }
  for (let v = 0; v < N; v++) crease[v] = smooth(0.15, 1.2, c[v]);
}

// ---------- 7. the thumb's press: the thumb rolls over the screen's edge onto the glass ----------
// The sculpt's thumb grips the phone's side, its pad on the edge. A press turns the thumb about one axis (found here,
// near the phone's edge, so the thumb rolls over the edge like a log and its pad comes down on the glass) and flexes
// its tip at the IP joint. Each vertex turns by the angle times its weight (1 on the thumb, easing to 0 over the
// thenar), a bend rather than a linear blend, so nothing collapses.
const TH = FINGERS.thumb, THC = TH.c, thumbI = names.indexOf('thumb');
const W1 = new Float32Array(N), W2 = new Float32Array(N);
const uIP = 0.12;
const W1A = +(argv.find((a) => a.startsWith('--w1a='))?.split('=')[1] ?? 0.27), W1B = +(argv.find((a) => a.startsWith('--w1b='))?.split('=')[1] ?? 0.47);
for (let v = 0; v < N; v++) {
  if (owner[v] > 0) continue;                                // never the fingers
  const d = TH.d[v]; if (d >= W1B) continue;
  W1[v] = 1 - smooth(W1A, W1B, d); if (owner[v] === thumbI) W2[v] = 1 - smooth(0.085, 0.155, U[v]);
}
const fIP = THC.frame(uIP);
const P2 = fIP.c.clone();
const A2 = fIP.t.clone().cross(TH.palmar).normalize();      // flexion: positive bends the tip towards the pad side
const thumbV = []; for (let v = 0; v < N; v++) if (W1[v] > 0) thumbV.push(v);
const zs = PC.z + PH.z;                                      // the screen's glass
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
// X = { ax: unit axis, q: pivot, th: angle, a2: IP flex }
const pressAt = (v, X, p, out) => {
  const x = (out || V()).copy(PV(v));
  if (W2[v] > 0) { qb.setFromAxisAngle(A2, X.a2 * p * W2[v]); x.sub(P2).applyQuaternion(qb).add(P2); }
  if (W1[v] > 0) { qa.setFromAxisAngle(X.ax, X.th * p * W1[v]); x.sub(X.q).applyQuaternion(qa).add(X.q); }
  return x;
};
const restIn = new Float32Array(N); for (const v of thumbV) restIn[v] = Math.min(0, boxDist(PV(v)));   // already touching the phone at rest
const xTarget = PC.x - PH.x + (+(argv.find((a) => a.startsWith('--reach='))?.split('=')[1] ?? 0.035));
const TH_MAX = THREE.MathUtils.degToRad(+(argv.find((a) => a.startsWith('--maxroll='))?.split('=')[1] ?? 180));
function cost(X, sample = 3, report = false) {
  let pen = 0, zmin = Infinity, cx = 0, cy = 0;
  const tmpv = V();
  for (const p of [1, 0.8, 0.6, 0.4, 0.2]) {
    for (let i = 0; i < thumbV.length; i += sample) {
      const v = thumbV[i]; pressAt(v, X, p, tmpv);
      const d = boxDist(tmpv) - restIn[v]; if (d < -0.0004) pen += ((d + 0.0004) / 0.002) ** 2 * (p === 1 ? 1 : 0.7);
      if (p === 1 && owner[v] === thumbI && U[v] < 0.1 && tmpv.x > PC.x - PH.x + 0.006 && Math.abs(tmpv.y - PC.y) < PH.y && tmpv.z < zmin) { zmin = tmpv.z; cx = tmpv.x; cy = tmpv.y; }
    }
  }
  pen *= sample / 3;
  const touch = ((zmin - (zs + 0.0012)) / 0.002) ** 2 * 4, reach = ((cx - xTarget) / 0.01) ** 2, reg = X.th * X.th * 0.05 + X.a2 * X.a2 * 0.1;
  if (report) console.log(`  cost: penetration ${pen.toFixed(2)}, touch ${touch.toFixed(2)}, reach ${reach.toFixed(2)}, size ${reg.toFixed(2)}`);
  return { c: pen + touch + reach + reg, zmin, cx, cy };
}
const mk = (ax, q, th, a2) => ({ ax: ax.clone().normalize(), q: q.clone(), th, a2 });
let best = { c: Infinity };
if (!flags.has('--no-press')) {
  // start: a roll about the thumb's own direction through a point by the edge (the pad turns from the phone's side to the glass)
  const dir = THC.at(0.03).sub(THC.at(0.3)).normalize();
  const R = (() => { let s = 12345; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const tries = [];
  for (let i = 0; i < 4000; i++) {
    const ax = dir.clone().add(V(R() - 0.5, R() - 0.5, R() - 0.5).multiplyScalar(0.9)).normalize();
    const q = V(PC.x - PH.x + (R() - 0.3) * 0.08, THC.at(0.2).y, zs + (R() - 0.7) * 0.08);
    const X = mk(ax, q, (0.2 + R() * Math.min(1.6, TH_MAX)) * (R() < 0.5 ? 1 : -1), (R() - 0.2) * 1.2);
    tries.push({ ...cost(X, 8), X });
  }
  // and the roll found before (103 deg about the phone's long axis by its left edge), so a re-bake lands on the same press
  tries.push({ ...cost(mk(V(0.07, 0.99, 0.1), V(-0.16, THC.at(0.2).y, 0.069), 1.8, -0.21), 8), X: mk(V(0.07, 0.99, 0.1), V(-0.16, THC.at(0.2).y, 0.069), 1.8, -0.21) });
  tries.sort((a, b) => a.c - b.c);
  // refine: coordinate descent on (axis tilt x/z, pivot x/z, angle, flex) with shrinking steps
  const nudge = (X, d, h) => { const Y = mk(X.ax, X.q, X.th, X.a2); if (d === 0) Y.ax.x += h * 0.1; else if (d === 1) Y.ax.z += h * 0.1; else if (d === 2) Y.ax.y += h * 0.1; else if (d === 3) Y.q.x += h * 0.01; else if (d === 4) Y.q.z += h * 0.01; else if (d === 5) Y.th += h * 0.1; else Y.a2 += h * 0.1; Y.ax.normalize(); return Y; };
  for (const start of [...tries.slice(0, 4), tries.find((t) => Math.abs(t.X.th) > 1.5) || tries[0]]) { // refine the best few
    let cur = { ...cost(start.X, 3), X: start.X }, st = 1;
    for (let it = 0; it < 200 && st > 0.01; it++) {
      let improved = false;
      for (let d = 0; d < 7; d++) for (const sg of [1, -1]) { const Y = nudge(cur.X, d, sg * st), r = cost(Y, 3); if (r.c < cur.c) { cur = { ...r, X: Y }; improved = true; } }
      if (!improved) st *= 0.6;
    }
    if (cur.c < best.c) best = cur;
  }
  const fin = cost(best.X, 1, true), X = best.X;
  console.log(`thumb press: ${THREE.MathUtils.radToDeg(X.th).toFixed(1)} deg about [${X.ax.toArray().map((x) => x.toFixed(2))}] through (${X.q.toArray().map((x) => x.toFixed(3))}), IP ${THREE.MathUtils.radToDeg(X.a2).toFixed(1)} deg; pad z ${fin.zmin.toFixed(4)} (glass ${zs.toFixed(4)}), contact x ${fin.cx.toFixed(3)} y ${fin.cy.toFixed(3)}, cost ${fin.c.toFixed(3)}`);
  best = { ...best, ...fin };
}

// ---------- 9. normals and the file ----------
function writeOut(extraAttrs, extras) {
  const g2 = new THREE.BufferGeometry();
  g2.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g2.setIndex(new THREE.BufferAttribute(IDX, 1));
  g2.computeVertexNormals();
  return { normal: g2.attributes.normal.array, extraAttrs, extras };
}
async function save({ normal, extraAttrs, extras }) {
  const core = await import(KIT + '/node_modules/@gltf-transform/core');
  const F = await import(KIT + '/node_modules/@gltf-transform/functions');
  const { MeshoptEncoder, MeshoptDecoder } = await import(KIT + '/node_modules/meshoptimizer');
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
  const { EXTMeshoptCompression, KHRMeshQuantization } = await import(KIT + '/node_modules/@gltf-transform/extensions');
  const doc = new core.Document(), buffer = doc.createBuffer();
  const acc = (arr, type) => doc.createAccessor().setArray(arr).setType(type).setBuffer(buffer);
  // two zero-area triangles at the sculpt's box corners keep the prop's box (so height 1 and the centring are what they
  // were before the bake: the sculpt's box reached the removed phone's top edge); they draw nothing
  const corner = [srcBox.min, srcBox.max], NV = N + 6;
  const P2a = new Float32Array(NV * 3); P2a.set(pos); corner.forEach((c, i) => { for (let j = 0; j < 3; j++) P2a.set([c.x, c.y, c.z], (N + i * 3 + j) * 3); });
  const N2a = new Float32Array(NV * 3); N2a.set(normal); for (let i = N; i < NV; i++) N2a.set([0, 1, 0], i * 3);
  const I2a = new Uint32Array(IDX.length + 6); I2a.set(IDX); for (let i = 0; i < 6; i++) I2a[IDX.length + i] = N + i;
  const pad = (arr, size) => { const o = new Float32Array(NV * size); o.set(arr); return o; };
  const prim = doc.createPrimitive().setAttribute('POSITION', acc(P2a, 'VEC3')).setAttribute('NORMAL', acc(N2a, 'VEC3')).setIndices(acc(I2a, 'SCALAR'));
  for (const [name, [arr, type]] of Object.entries(extraAttrs)) prim.setAttribute(name, acc(pad(arr, { VEC2: 2, VEC3: 3, VEC4: 4 }[type]), type));
  const mesh = doc.createMesh('hand').addPrimitive(prim).setExtras(extras || {});
  const node = doc.createNode('hand').setMesh(mesh);
  doc.createScene('scene').addChild(node);
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const io = new core.NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  await doc.transform(F.meshopt({ encoder: MeshoptEncoder, level: 'high', quantizeNormal: 12, quantizeGeneric: 12, quantizeColor: 8 }));
  fs.writeFileSync(OUT, await io.writeBinary(doc));
  console.log(`wrote ${OUT} (${(fs.statSync(OUT).size / 1e6).toFixed(2)} MB, ${N} vertices, ${IDX.length / 3} triangles)`);
}

const poseArg = argv.find((a) => a.startsWith('--pose='));
if (poseArg && best.X) { const p = +poseArg.split('=')[1], out = V(), moved = []; for (const v of thumbV) { pressAt(v, best.X, p, out); moved.push([v, out.x, out.y, out.z]); } for (const [v, x, y, z] of moved) { pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z; } }
if (DEBUG) {
  const col = new Float32Array(N * 3);
  const C = [[0.9, 0.2, 0.2], [0.2, 0.9, 0.2], [0.2, 0.4, 1], [0.9, 0.9, 0.2], [0.9, 0.3, 0.9]];
  for (let v = 0; v < N; v++) { const o = owner[v]; const c = o < 0 ? [0.6, 0.6, 0.6] : C[o]; const k = o < 0 ? 1 : 0.35 + 0.65 * ((U[v] * 20) % 1 < 0.5 ? 1 : 0.6); col.set([c[0] * k, c[1] * k, c[2] * k], v * 3); }
  const info = { fingers: Object.fromEntries(names.map((nm) => [nm, { len: FINGERS[nm].c.len, pts: FINGERS[nm].c.pts.filter((_, i) => i % 3 === 0).map((p) => p.toArray().map((x) => +x.toFixed(4))) }])) };
  fs.writeFileSync(OUT.replace(/\.glb$/, '.debug.json'), JSON.stringify(info));
  await save({ ...writeOut({ COLOR_0: [col, 'VEC3'] }), extras: {} });
  process.exit(0);
}

// ---------- 10. the baked hand: masks for the skin shader, the thumb's weights, the rig in the mesh's extras ----------
const masks = new Float32Array(N * 4), thumbW = new Float32Array(N * 2);
for (let v = 0; v < N; v++) { masks.set([nailMask[v], edgeMask[v], flush[v], crease[v]], v * 4); thumbW.set([W1[v], W2[v]], v * 2); }
if (flags.has('--masks')) { // a look at the masks: nail red, free edge white, flush green, crease blue
  const col = new Float32Array(N * 3);
  for (let v = 0; v < N; v++) col.set([0.25 + 0.75 * Math.max(nailMask[v], edgeMask[v]), 0.25 + 0.6 * flush[v] + 0.75 * edgeMask[v], 0.25 + 0.75 * crease[v] + 0.75 * edgeMask[v]], v * 3);
  await save({ ...writeOut({ COLOR_0: [col, 'VEC3'] }), extras: {} });
  process.exit(0);
}
const r4 = (a) => a.toArray().map((x) => +x.toFixed(5));
const X = best.X;
const tipV = FINGERS.thumb.v;
// the pad's contact vertex at a full press: its rest position and weights go in the extras (hand.thumbUV turns it)
const contactV = (() => { let zmin = Infinity, c = -1; const t = V(); for (const v of thumbV) { if (owner[v] !== thumbI || U[v] > 0.1) continue; pressAt(v, X, 1, t); if (t.x > PC.x - PH.x + 0.006 && t.z < zmin) { zmin = t.z; c = v; } } return c; })();
const extras = {
  bake: { from: path.basename(SRC), shape: SHAPE, nails: NAIL },
  phone: { center: r4(PC), half: r4(PH) },
  thumb: {
    // press(p): every vertex turns by IP flex x p x weight.y about (ip, ipAxis), then by angle x p x weight.x about (pivot, axis)
    pivot: r4(X.q), axis: r4(X.ax), angle: +X.th.toFixed(5), ip: r4(P2), ipAxis: r4(A2), ipAngle: +X.a2.toFixed(5),
    tip: r4(PV(tipV)), contact: r4(PV(contactV)), contactWeights: [+W1[contactV].toFixed(4), +W2[contactV].toFixed(4)], contactPressed: r4(pressAt(contactV, X, 1)),
  },
};
console.log('extras.thumb', JSON.stringify(extras.thumb));
await save({ ...writeOut({ _MASKS: [masks, 'VEC4'], _THUMB: [thumbW, 'VEC2'] }), extras });
