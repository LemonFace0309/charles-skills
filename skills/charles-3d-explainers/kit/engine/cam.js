// Camera grammar. The camera is always moving a little (a premium shot never sits dead still) and every move eases
// in and out. Moves are functions of time so the engine can sample them at any sub-frame.
import * as THREE from 'three';
import { easeFn, invLerp, clamp, noise1, lerp, monotone } from './util.js';

const V = (a) => (a && a.isVector3 ? a.clone() : new THREE.Vector3(...a));

// A smooth camera move through key poses. keys: [{ t, pos:[x,y,z], look:[x,y,z], fov?, roll? }, ...] (t in shot-local s).
// Positions follow a centripetal Catmull-Rom spline (no kinks at keys); timing between keys is eased per segment, and
// `flow: true` makes the whole move one eased glide through the keys without stopping at them. In flow the ease runs
// over the whole move and the keys are passed at their times on that eased clock: the first and last keys exactly, a
// middle one a little later (ease in) or earlier (ease out) than its t; pass ease: 'linear' to pass each at its t.
// Flow travels each spline by arc length: a monotone curve through (key time, distance along the path at that key)
// sets how far along the camera is, so its speed changes smoothly through every key however unevenly the keys are
// spaced (by key index, a short stretch and a long one took the same time). The look point travels its own spline the
// same way (a pan in place still turns); fov and roll ease between keys on the same clock. A hold (two keys at one
// position) stops the camera, so a far key soon after it needs a dash: bluetooth's 11-fsk keys asked for 1.86 units in
// 0.5 s, which the whole-move ease squeezed into 0.32 s (1 unit in 0.1 s). path() warns about keys like that.
// A key may carry `up` ([x, y, z]): the camera's up eases between keys like roll (a key without one is world up), so a
// camera orbiting a planet keeps up away from its surface. With no `up` on any key the camera's up is left alone.
export function path(keys, { ease = 'inOutSine', flow = false, curve = 'centripetal', tension = 0.5 } = {}) {
  const anyUp = keys.some((k) => k.up != null);
  const ks = keys.map((k) => ({ ...k, pos: V(k.pos), look: V(k.look || [0, 0, 0]), up: anyUp ? V(k.up || [0, 1, 0]).normalize() : null }));
  const posC = ks.length > 1 ? new THREE.CatmullRomCurve3(ks.map((k) => k.pos), false, curve, tension) : null;
  const lookC = ks.length > 1 ? new THREE.CatmullRomCurve3(ks.map((k) => k.look), false, curve, tension) : null;
  const n = ks.length - 1;
  const E = easeFn(ease), T = ks.map((k) => k.t);
  // flow: key time -> arc-length fraction of a spline (null when the spline has no length: it stays at its first key)
  const byArc = (C, warn) => {
    const M = 64; C.arcLengthDivisions = n * M; // the same table getUtoTmapping reads, so a key lands exactly on its point
    const L = C.getLengths(n * M), tot = L[n * M];
    if (warn && tot > 1e-6) { // keys that demand a dash: a stretch crossed far faster than the move's average, after a stop
      const avg = tot / Math.max(1e-6, T[n] - T[0]), v = ks.slice(0, n).map((_, i) => (L[(i + 1) * M] - L[i * M]) / Math.max(1e-6, T[i + 1] - T[i]));
      const i = v.indexOf(Math.max(...v));
      if (v[i] > 3 * avg && v.some((x) => x < 0.25 * avg)) console.warn(`cam.path flow: keys ${i}-${i + 1} (t ${T[i].toFixed(2)}-${T[i + 1].toFixed(2)}) cover ${(L[(i + 1) * M] - L[i * M]).toFixed(2)} units, ${(v[i] / avg).toFixed(1)}x the move's average speed, next to a hold: the camera dashes there (the whole-move ease passes middle keys early, which makes it faster still). Spread those keys, drop the hold, or use flow: false.`);
    }
    return tot > 1e-6 ? monotone(T, ks.map((_, i) => L[i * M] / tot)) : null;
  };
  const posS = flow && n > 0 ? byArc(posC, true) : null, lookS = flow && n > 0 ? byArc(lookC) : null;
  const along = n > 0 ? monotone(T, ks.map((_, i) => i / n)) : null; // key time -> key index (fov, roll)
  const at = (t) => {
    if (n === 0) return { pos: ks[0].pos.clone(), look: ks[0].look.clone(), fov: ks[0].fov, roll: ks[0].roll || 0, ...(anyUp ? { up: ks[0].up.clone() } : {}) };
    let u, pos, look;
    if (flow) {
      const te = ks[0].t + E(invLerp(ks[0].t, ks[n].t, t)) * (ks[n].t - ks[0].t); // the eased clock
      u = clamp(along(te));
      pos = posS ? posC.getPointAt(clamp(posS(te))) : ks[0].pos.clone();
      look = lookS ? lookC.getPointAt(clamp(lookS(te))) : ks[0].look.clone();
    } else {
      let i = 0; while (i < n - 1 && t > ks[i + 1].t) i++;
      const local = E(invLerp(ks[i].t, ks[i + 1].t, t));
      u = clamp((i + local) / n);
      pos = posC.getPoint(u); look = lookC.getPoint(u);
    }
    const seg = Math.min(n - 1, Math.floor(u * n)), f = u * n - seg;
    const fov = ks[seg].fov != null && ks[seg + 1].fov != null ? lerp(ks[seg].fov, ks[seg + 1].fov, f) : ks[seg].fov ?? ks[seg + 1]?.fov;
    const roll = lerp(ks[seg].roll || 0, ks[seg + 1].roll || 0, f);
    if (!anyUp) return { pos, look, fov, roll };
    const up = ks[seg].up.clone().lerp(ks[seg + 1].up, f); if (up.lengthSq() < 1e-8) up.copy(ks[f < 0.5 ? seg : seg + 1].up);
    return { pos, look, fov, roll, up: up.normalize() };
  };
  return { at, apply: (camera, t, o = {}) => apply(camera, at(t), { t, ...o }) };
}

// Orbit around a centre: angles in degrees, eased from a0 to a1 between t0 and t1.
export function orbit({ center = [0, 0, 0], radius = 6, height = 1.5, a0 = -20, a1 = 20, t0 = 0, t1 = 5, ease = 'inOutSine', fov } = {}) {
  const c = V(center), E = easeFn(ease);
  const at = (t) => {
    const a = THREE.MathUtils.degToRad(lerp(a0, a1, E(invLerp(t0, t1, t))));
    return { pos: new THREE.Vector3(c.x + Math.sin(a) * radius, c.y + height, c.z + Math.cos(a) * radius), look: c.clone(), fov };
  };
  return { at, apply: (camera, t, o = {}) => apply(camera, at(t), { t, ...o }) };
}

// Zoom through scales: distance changes exponentially, so going from 10,000 to 0.01 feels like constant speed.
// dir is the direction from target to camera.
export function logZoom({ target = [0, 0, 0], dir = [0, 0.25, 1], from = 20, to = 1, t0 = 0, t1 = 3, ease = 'inOutCubic', lookOffset = [0, 0, 0], fov } = {}) {
  const c = V(target), d = V(dir).normalize(), E = easeFn(ease), lo = V(lookOffset);
  const at = (t) => {
    const u = E(invLerp(t0, t1, t));
    const dist = from * Math.pow(to / from, u);
    return { pos: c.clone().addScaledVector(d, dist), look: c.clone().add(lo), fov, dist };
  };
  return { at, apply: (camera, t, o = {}) => apply(camera, at(t), { t, ...o }) };
}

// Ride along a curve (a fly-through, or chasing a pulse down a wire): between t0 and t1 the camera travels the curve
// from fraction `from` to `to` (arc length, eased), moved by `offset` in the curve's own frame, [right, up, back]
// ([0, 0.3, 1.2] trails a little behind and above), looking `lookAhead` further along it (a fraction of the curve;
// past the end it keeps going straight) plus lookOffset, or at `look` (a point or an Object3D) when given. The frame
// is built from world `up`, so the horizon stays level. Match a pulse's speed with ease: 'linear'. Pass `up` ([x, y, z],
// or (point, t) => [x, y, z] for one that changes along the curve, e.g. away from a planet's centre) and the frame is
// built from it and the camera's up follows it too; without it the camera's up is left alone.
export function follow(curve, { t0 = 0, t1 = 5, from = 0, to = 1, offset = [0, 0, 0], lookAhead = 0.08, look = null, lookOffset = [0, 0, 0], ease = 'inOutSine', up = null, fov, roll } = {}) {
  const E = easeFn(ease), off = V(offset), lo = V(lookOffset), L = curve.getLength();
  const upAt = typeof up === 'function' ? (p, t) => V(up(p, t)).normalize() : ((u) => () => u.clone())(V(up || [0, 1, 0]).normalize());
  const T = new THREE.Vector3(), R = new THREE.Vector3(), Up = new THREE.Vector3();
  const pointOn = (u, out = new THREE.Vector3()) => { // arc-length point, extended straight past either end
    const c = clamp(u); curve.getPointAt(c, out);
    if (u !== c) out.addScaledVector(curve.getTangentAt(c, T).normalize(), (u - c) * L);
    return out;
  };
  const at = (t) => {
    const u = lerp(from, to, E(invLerp(t0, t1, t))), p = pointOn(u), U = upAt(p, t);
    curve.getTangentAt(clamp(u), T).normalize();
    R.crossVectors(T, U); if (R.lengthSq() < 1e-8) R.set(1, 0, 0); R.normalize();
    Up.crossVectors(R, T).normalize();
    const pos = p.clone().addScaledVector(R, off.x).addScaledVector(Up, off.y).addScaledVector(T, -off.z);
    const lk = look ? (look.isObject3D ? look.getWorldPosition(new THREE.Vector3()) : V(look)) : pointOn(u + lookAhead);
    return up ? { pos, look: lk.add(lo), fov, roll, up: Up.clone() } : { pos, look: lk.add(lo), fov, roll };
  };
  return { at, apply: (camera, t, o = {}) => apply(camera, at(t), { t, ...o }) };
}

// Rack focus: a k.lens.focus function that holds on one subject and pulls to the next at the given times, easing over
// `dur` seconds (0.3 to 0.6 reads as a deliberate pull). keys: [[t, subject, dur?], ...] in shot-local time, each pull
// starting at its t; a subject is an Object3D (followed as it moves), a Vector3 / [x, y, z], a distance, or a function
// (t) => any of these (a point riding a curve). Mixing distances with points needs { camera: k.camera }.
//   k.lens = { blur: 0.02, focus: cam.rack([[0, phone], [k.word('chip'), chip.anchor('GPU')]]) }
export function rack(keys, { dur = 0.45, ease = 'inOutCubic', camera = null } = {}) {
  const E = easeFn(ease), ks = keys.map(([t, s, d]) => ({ t, s, d: d ?? dur })).sort((a, b) => a.t - b.t);
  if (!ks.length) throw new Error('cam.rack: pass at least one [t, subject] key');
  const num = (s) => typeof s === 'number';
  if (!camera && ks.some((k) => num(k.s)) && !ks.every((k) => num(k.s))) throw new Error('cam.rack: mixing distances with points needs { camera: k.camera }');
  const A = new THREE.Vector3(), B = new THREE.Vector3(), F = new THREE.Vector3(), P = new THREE.Vector3();
  const pt = (s, out) => (s.isObject3D ? s.getWorldPosition(out) : s.isVector3 ? out.copy(s) : out.set(...s));
  const dist = (s) => (num(s) ? s : (camera.getWorldDirection(F), pt(s, A).sub(camera.getWorldPosition(P)).dot(F)));
  const at = (s, t) => (typeof s === 'function' ? s(t) : s); // a subject may be (t) => any of these, like k.lens.focus
  return (t) => {
    let i = 0; while (i < ks.length - 1 && t >= ks[i + 1].t) i++;
    const cur = ks[i], prev = ks[i - 1], k = prev && cur.d > 0 ? E(clamp((t - cur.t) / cur.d)) : 1;
    const cs = at(cur.s, t), ps = prev ? at(prev.s, t) : null;
    if (k >= 1 || !prev) return num(cs) ? cs : camera ? dist(cs) : pt(cs, new THREE.Vector3());
    if (camera || num(cs)) return lerp(dist(ps), dist(cs), k);
    return pt(ps, A).lerp(pt(cs, B), k).clone();
  };
}

// Place the camera from a pose. drift adds a slow, organic float (handheld-on-a-gimbal) so frames never freeze.
// pose.up ([x, y, z] or a Vector3) sets the camera's up before it looks (a camera over a planet keeps up away from the
// surface); a pose without one goes back to world up if an earlier pose set it, and otherwise leaves camera.up alone
// (so a camera.up set by hand still works).
const _q = new THREE.Quaternion(), _z = new THREE.Vector3(0, 0, 1);
export function apply(camera, pose, { drift = 0.6, t = 0, seed = 0 } = {}) {
  if (!pose.pos?.isVector3 || !pose.look?.isVector3) pose = { ...pose, pos: V(pose.pos), look: V(pose.look || [0, 0, 0]) }; // [x, y, z] arrays work too
  if (pose.up != null) { camera.up.copy(V(pose.up)).normalize(); camera.userData.camUp = true; }
  else if (camera.userData.camUp) { camera.up.set(0, 1, 0); camera.userData.camUp = false; }
  camera.position.copy(pose.pos);
  if (drift > 0) {
    const s = drift * 0.01 * pose.pos.distanceTo(pose.look);
    camera.position.x += noise1(t * 0.23, seed + 1) * s; camera.position.y += noise1(t * 0.19, seed + 2) * s * 0.7; camera.position.z += noise1(t * 0.17, seed + 3) * s * 0.5;
  }
  camera.lookAt(pose.look);
  if (pose.roll || drift > 0) camera.rotateOnAxis(_z, THREE.MathUtils.degToRad((pose.roll || 0) + (drift > 0 ? noise1(t * 0.13, seed + 4) * drift * 0.25 : 0)));
  if (pose.fov && camera.fov !== pose.fov) { camera.fov = pose.fov; camera.updateProjectionMatrix(); }
  return camera;
}

// Convenience: a slow push-in (dolly) towards a target, the default "something is about to matter" move.
export function push({ target = [0, 0, 0], from = [0, 1, 8], to = [0, 0.8, 6], t0 = 0, t1 = 4, ease = 'inOutSine', fov } = {}) {
  return path([{ t: t0, pos: from, look: target, fov }, { t: t1, pos: to, look: target, fov }], { ease });
}

// Distance at which an object of bounding radius `radius` fills `fill` of the frame WIDTH (portrait frames are
// narrow: at fov 30 a 9:16 frame is only ~17 degrees wide, so think in width). Use it before placing the camera.
export function fit(radius, { fill = 0.6, fov = 30, aspect = 9 / 16 } = {}) {
  const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) * aspect);
  return radius / (fill * Math.tan(hfov / 2));
}
// A pose looking at `target` from azimuth/elevation (degrees) at a distance that frames `radius` (see fit). target can
// be a prop (any Object3D): it is framed by its bounding sphere (userData.center / userData.radius, measured when
// missing), so cam.frame(laptop, { az: 30 }) needs no radius; an anchor works too, with a radius.
export function frame(target, radius, o = {}) {
  if (radius != null && typeof radius === 'object') { o = radius; radius = null; }
  const { az = 25, el = 15, fill = 0.6, fov = 30, aspect = 9 / 16, lookOffset = [0, 0, 0] } = o;
  let c, R = radius;
  if (target?.isObject3D) {
    target.updateWorldMatrix(true, false);
    const ud = target.userData;
    if (R == null && ud.radius == null) { const s = new THREE.Box3().setFromObject(target).getBoundingSphere(new THREE.Sphere()); c = s.center; R = s.radius; }
    else { c = target.localToWorld(V(ud.center || [0, 0, 0])); R = R ?? ud.radius; }
  } else c = V(target);
  if (!(R > 0)) throw new Error('cam.frame: pass a radius, or a prop with userData.radius');
  const d = fit(R, { fill, fov, aspect });
  const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
  return { pos: new THREE.Vector3(c.x + Math.sin(a) * Math.cos(e) * d, c.y + Math.sin(e) * d, c.z + Math.cos(a) * Math.cos(e) * d), look: c.clone().add(V(lookOffset)), fov };
}
