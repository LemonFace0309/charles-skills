// Atmosphere: floating dust that turns into bokeh out of focus, starfields, volumetric beams and soft glows.
// These are what make an empty dark space feel like a place with air in it.
import * as THREE from 'three';
import { rng, ease } from './util.js';
import { accentDefault } from './look.js';

const SPRITE_V = `attribute float aSize; attribute float aSeed; uniform float uTime; uniform float uRes; uniform vec3 uDrift; uniform float uFocus; uniform float uAperture;
varying float vSeed; varying float vFade; varying float vGain;
void main(){
  vec3 p = position + uDrift * uTime * (0.6 + aSeed * 0.8) + vec3(sin(uTime * .37 + aSeed * 40.) , cos(uTime * .29 + aSeed * 17.), sin(uTime * .31 + aSeed * 9.)) * 0.06;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  float d = max(0.1, -mv.z);
  // grow each mote to its own circle of confusion so lens sampling blends into a smooth bokeh disc, not dots
  float coc = uAperture * abs(d - uFocus) / max(uFocus, 0.01);
  float r = max(aSize, coc * 2.0);
  // pixels from the live projection (the shot's fov, every sub-frame); uRes = render height / 1920
  gl_PointSize = min(r * projectionMatrix[1][1] * 960. * uRes / d, 220.0);
  vGain = (aSize * aSize) / (r * r);
  vSeed = aSeed; vFade = smoothstep(0.6, 1.6, d);
}`;
const SPRITE_F = `uniform vec3 uColor; uniform float uIntensity; varying float vSeed; varying float vFade; varying float vGain;
void main(){ vec2 d = gl_PointCoord - .5; float r = length(d) * 2.; float a = smoothstep(1., mix(.55, .86, 1. - vGain), r);
  if (a <= 0.001) discard; float e = uIntensity * vFade * (0.5 + vSeed) * max(vGain, 0.002) * 1.0; gl_FragColor = vec4(uColor * e * a, a * vFade); }`;

// Dust motes in a box around `center`. size is in world units at distance 1; out of focus they become bokeh discs.
export function dust({ count = 400, center = [0, 0, 0], size = [10, 6, 10], pointSize = 0.018, color = '#ffd9a0', intensity = 1.2, drift = [0.02, 0.03, 0], seed = 7 } = {}) {
  const R = rng(seed), pos = new Float32Array(count * 3), sz = new Float32Array(count), sd = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = center[0] + (R() - 0.5) * size[0]; pos[i * 3 + 1] = center[1] + (R() - 0.5) * size[1]; pos[i * 3 + 2] = center[2] + (R() - 0.5) * size[2];
    sz[i] = pointSize * (0.4 + R() * R() * 1.6); sd[i] = R();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1)); g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
  const m = new THREE.ShaderMaterial({ vertexShader: SPRITE_V, fragmentShader: SPRITE_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uFocus: { value: 10 }, uAperture: { value: 0 }, uTime: { value: 0 }, uRes: { value: 1 }, uDrift: { value: new THREE.Vector3(...drift) }, uColor: { value: new THREE.Color(color) }, uIntensity: { value: intensity } } });
  const p = new THREE.Points(g, m); p.frustumCulled = false;
  p.at = (t) => { m.uniforms.uTime.value = t; };
  p.setIntensity = (i) => { m.uniforms.uIntensity.value = i; }; // pure: call it in update to fade the motes
  return p;
}

// Sky layers (stars(), milkyWay()) sit at infinity, so the lens should not blur them. core.js shifts the projection per
// sub-frame for depth of field; it also sets uSkew = that shift for a point at infinity, which the vertex shader takes
// back off: every sub-frame lands each star on the same pixel (AA jitter kept), so stars stay sharp under any blur.
const SKY_V = (body) => `attribute float aSize; attribute vec3 color; uniform float uRes; uniform vec2 uSkew; varying vec3 vC;
${body.head || ''}
void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; gl_Position.xy -= uSkew * gl_Position.w;
  gl_PointSize = aSize * uRes; ${body.main || ''} }`;

// Stars on a big sphere, sized and tinted like a real sky: most faint, a few bright and warm or blue, 6% bright with a
// halo. pointSize is px at 1920 high: 7 keeps a faint star 1.5 to 3 px at phone width (at 3.2, most stars fell under a
// pixel there, and space read empty: 0 to 8 stars per clear patch against about 90 in a reference). A frame at fov 30
// sees 1.2% of the sphere and about 70% of those stars clear luma 60 at 390 px wide: 20000 stars put about 170 there
// (5000 put 42).
export function stars({ count = 20000, radius = 300, pointSize = 7, intensity = 1.0, seed = 3 } = {}) {
  const R = rng(seed), pos = new Float32Array(count * 3), col = new Float32Array(count * 3), sz = new Float32Array(count), halo = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const u = R() * 2 - 1, a = R() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    pos.set([Math.cos(a) * s * radius, u * radius, Math.sin(a) * s * radius], i * 3);
    const b = 0.35 + Math.pow(R(), 4) * 2.6, warm = R();
    col.set(warm < 0.15 ? [b, b * 0.85, b * 0.7] : warm > 0.9 ? [b * 0.8, b * 0.9, b] : [b, b, b], i * 3);
    const big = R() < 0.06;
    sz[i] = pointSize * (0.6 + Math.pow(R(), 3) * 1.6) * (big ? 2.2 : 1); halo[i] = big ? 1 : 0;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1)); g.setAttribute('aHalo', new THREE.BufferAttribute(halo, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uIntensity: { value: intensity }, uRes: { value: 1 }, uSkew: { value: new THREE.Vector2() } },
    vertexShader: SKY_V({ head: 'attribute float aHalo; varying float vHalo;', main: 'vHalo = aHalo;' }),
    fragmentShader: `uniform float uIntensity; varying vec3 vC; varying float vHalo;
      void main(){ float r = length(gl_PointCoord - .5) * 2.; float a = vHalo > .5 ? exp(-r * r * 9.) + .18 * exp(-r * r * 2.2) : exp(-r * r * 5.);
        if (a < .01) discard; gl_FragColor = vec4(vC * uIntensity * a, a); }`,
  });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = -999;
  return p;
}

// GLSL value noise and fbm on a direction, shared by the Milky Way's glow (per pixel) and its stars (per vertex), so
// the dust lanes that dim the glow are the ones that thin the stars.
const MW_NOISE = `uniform vec3 uN; uniform float uW, uSeed;
float mwH(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7)) + uSeed * 13.17) * 43758.5453); }
float mwV(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(mix(mwH(i), mwH(i + vec3(1,0,0)), f.x), mix(mwH(i + vec3(0,1,0)), mwH(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(mwH(i + vec3(0,0,1)), mwH(i + vec3(1,0,1)), f.x), mix(mwH(i + vec3(0,1,1)), mwH(i + vec3(1,1,1)), f.x), f.y), f.z); }
float mwF(vec3 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++) { s += a * mwV(p); p = p * 2.03 + 1.7; a *= .5; } return s; }
// 1 = clear sky, 0 = thick dust: a rift wandering along the band's middle, broken into filaments, plus small dark
// knots. The edges are crisp (narrow smoothsteps): soft-edged lanes are what read as smoke
float mwLanes(vec3 d){
  float lat = dot(d, uN);
  float rift = exp(-pow((lat - .3 * uW * (mwF(d * 3. + 7.) - .5)) / (uW * .3), 4.)) * smoothstep(.44, .54, mwF(d * 9. + 2.));
  float knots = smoothstep(.62, .7, mwF(d * 30. + 5.)) * exp(-pow(lat / (uW * 1.2), 2.)); // small, and only in the band
  return clamp(1. - .95 * rift - .35 * knots, 0., 1.);
}`;

// The Milky Way: `stars` tiny stars (pointSize 2.2 px at 1920 high, 1.5 to 3 px) crowding a great circle whose pole is
// `normal` (half-width `width`, radians), denser towards the bulge (`center`, a direction), thinned by fbm dust lanes,
// over a faint unresolved glow: `glow` is the band's brightest glow as a fraction of a typical band star (0.1), so it
// reads as haze between the stars, never as an fbm smoke band. Same lens compensation as stars(). Static.
export function milkyWay({ normal = [0.3, 1, 0.25], width = 0.16, stars: count = 30000, glow = 0.1, center = [-0.6, 0.1, -1], radius = 320, pointSize = 2.2, intensity = 1, color = '#e8d6bd', glowColor = '#a8927a', seed = 5 } = {}) {
  const R = rng(seed), n = new THREE.Vector3(...normal).normalize();
  const c = new THREE.Vector3(...center); c.addScaledVector(n, -c.dot(n)).normalize(); // the bulge lies in the band
  const e2 = new THREE.Vector3().crossVectors(n, c).normalize();
  const gauss = () => Math.sqrt(-2 * Math.log(1 - R())) * Math.cos(2 * Math.PI * R());
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), sz = new Float32Array(count), keep = new Float32Array(count);
  const tint = new THREE.Color(color), d = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const bulge = R() < 0.35; // a third of the stars crowd the bulge
    const phi = bulge ? gauss() * 0.45 : R() * Math.PI * 2, lat = gauss() * (width / Math.SQRT2) * (bulge ? 1.5 : 1);
    d.copy(c).multiplyScalar(Math.cos(phi)).addScaledVector(e2, Math.sin(phi)).multiplyScalar(Math.cos(lat)).addScaledVector(n, Math.sin(lat)).normalize();
    pos.set([d.x * radius, d.y * radius, d.z * radius], i * 3);
    const b = 0.3 + Math.pow(R(), 4) * 1.6, w = R();
    col.set(w < 0.25 ? [b * tint.r, b * tint.g, b * tint.b] : w > 0.92 ? [b * 0.8, b * 0.88, b] : [b, b, b], i * 3);
    sz[i] = pointSize * (0.7 + Math.pow(R(), 3) * 0.7); keep[i] = R();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1)); g.setAttribute('aKeep', new THREE.BufferAttribute(keep, 1));
  const U = { uN: { value: n }, uW: { value: width }, uSeed: { value: seed }, uRes: { value: 1 }, uIntensity: { value: intensity } };
  const sm = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { ...U, uSkew: { value: new THREE.Vector2() } },
    vertexShader: SKY_V({ head: `attribute float aKeep; ${MW_NOISE}`, main: 'if (aKeep > mwLanes(normalize(position))) { gl_PointSize = 0.; gl_Position = vec4(2., 2., 2., 1.); }' }),
    fragmentShader: `uniform float uIntensity; varying vec3 vC; void main(){ float r = length(gl_PointCoord - .5) * 2.; float a = exp(-r * r * 5.); if (a < .01) discard; gl_FragColor = vec4(vC * uIntensity * a, a); }`,
  });
  const pts = new THREE.Points(g, sm); pts.frustumCulled = false; pts.renderOrder = -999;
  // the glow: the same band and lanes per pixel, smooth along the band (fbm clouds in it read as smoke), on a sphere
  // just outside the stars; its peak is glow x a typical band star (0.35)
  const gm = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.BackSide,
    uniforms: { ...U, uSkew: { value: new THREE.Vector2() }, uC: { value: c }, uGlow: { value: glow * 0.35 }, uColor: { value: new THREE.Color(glowColor) } },
    vertexShader: `uniform vec2 uSkew; varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position.xy -= uSkew * gl_Position.w; }`,
    fragmentShader: `${MW_NOISE} uniform vec3 uC, uColor; uniform float uGlow, uIntensity; varying vec3 vD;
      void main(){ vec3 d = normalize(vD); float lat = dot(d, uN);
        float bulge = exp(-pow(acos(clamp(dot(normalize(d - uN * lat), uC), -1., 1.)) / .6, 2.));
        float band = exp(-pow(lat / (uW * (1. + .6 * bulge)), 2.)) * (.45 + .55 * bulge);
        gl_FragColor = vec4(uColor * uGlow * uIntensity * band * mwLanes(d), 1.); }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.02, 96, 48), gm); sky.frustumCulled = false; sky.renderOrder = -1000;
  const grp = new THREE.Group(); grp.add(sky, pts);
  grp.stars = pts; grp.glow = sky;
  return grp;
}

// A volumetric beam (spotlight cone, laser, signal) as a soft additive cone. Looks like light scattering in haze.
export function beam({ from = [0, 5, 0], to = [0, 0, 0], radiusTop = 0.05, radiusBottom = 1.2, color = '#ffe2b0', intensity = 0.6, softness = 1.6 } = {}) {
  const A = new THREE.Vector3(...from), B = new THREE.Vector3(...to), len = A.distanceTo(B);
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, len, 64, 32, true);
  geo.translate(0, -len / 2, 0);
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uColor: { value: new THREE.Color(color) }, uI: { value: intensity }, uLen: { value: len }, uSoft: { value: softness } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 w = modelMatrix * vec4(position,1.); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); vY = position.y; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uI, uLen, uSoft; varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), uSoft); float along = 1. - clamp(-vY / uLen, 0., 1.);
        float a = f * pow(along, 1.4) * smoothstep(0., .08, along); gl_FragColor = vec4(uColor * uI * a, a); }`,
  });
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.copy(A);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), B.clone().sub(A).normalize());
  mesh.setIntensity = (i) => { m.uniforms.uI.value = i; };
  return mesh;
}

// A camera-facing soft glow sprite (a light source, a hot spot, a lens bloom behind a hero).
export function glowSprite({ color = accentDefault(), intensity = 2, size = 1, position = [0, 0, 0] } = {}) {
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uColor: { value: new THREE.Color(color) }, uI: { value: intensity } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(0.,0.,0.,1.); mv.xy += position.xy * vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz)); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uI; varying vec2 vUv; void main(){ float r = length(vUv - .5) * 2.; float a = exp(-r * r * 4.) * (1. - smoothstep(.9, 1., r)); gl_FragColor = vec4(uColor * uI * a, a); }`,
  });
  const s = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m); s.scale.setScalar(size); s.position.set(...position);
  s.frustumCulled = false; // culled by its centre, the halo popped off at the frame edge
  s.setIntensity = (i) => { m.uniforms.uI.value = i; };
  return s;
}

// Steam: `count` soft wisps rising from a disc of `radius` at `center`, each a plane with a scrolling fbm plume
// (additive, warm white). Pure: call steam.at(t, camera, amount) every update; it sets the time, turns each plane to
// the camera (about the vertical) and scales the plume by amount (0 hides it).
export function steam({ count = 7, center = [0, 0, 0], radius = 0.5, height = 1.6, width = 0.7, color = '#fff1df', intensity = 0.5, seed = 3, speed = 0.25 } = {}) {
  const g = new THREE.Group(), c = new THREE.Vector3(...center), R = rng(seed);
  const U = { uT: { value: 0 }, uA: { value: 1 } }; // shared by every wisp
  const planes = [];
  for (let i = 0; i < count; i++) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...U, uSeed: { value: R() * 50 }, uC: { value: new THREE.Color(color).multiplyScalar(intensity) }, uSp: { value: speed * (0.8 + R() * 0.5) } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `uniform float uT, uA, uSeed, uSp; uniform vec3 uC; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
          return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
        float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++){ s += a * n(p); p = p * 2.03 + 17.1; a *= .5; } return s; }
        void main(){
          float y = vUv.y, sway = (fbm(vec2(y * 1.6 + uSeed, uT * .35)) - .5) * .55 * y; // the plume bends more as it rises
          float x = (vUv.x - .5 - sway) * 2., plume = exp(-x * x / (.09 + .5 * y * y));
          vec2 q = vec2(vUv.x * 2.2 + uSeed, y * 2.6 - uT * uSp * 3.);
          float d = fbm(q + vec2(fbm(q * 1.7 + uT * .2), 0.));
          float a = plume * smoothstep(.32, .78, d) * smoothstep(0., .18, y) * (1. - smoothstep(.55, 1., y));
          gl_FragColor = vec4(uC * a * uA, a * uA);
        }`,
    });
    const h = height * (0.8 + R() * 0.4), p = new THREE.Mesh(new THREE.PlaneGeometry(width * (0.8 + R() * 0.5), h), mat);
    p.geometry.translate(0, h / 2, 0); // grows up from its base
    const a = R() * Math.PI * 2, r = radius * Math.sqrt(R());
    p.position.set(c.x + Math.cos(a) * r, c.y, c.z + Math.sin(a) * r);
    p.renderOrder = 5;
    g.add(p); planes.push(p);
  }
  const _d = new THREE.Vector3(), _w = new THREE.Vector3(), _cp = new THREE.Vector3();
  g.at = (t, camera, amount = 1) => {
    U.uT.value = t; U.uA.value = amount;
    if (camera) { camera.getWorldPosition(_cp); g.updateWorldMatrix(true, false); for (const p of planes) { _d.subVectors(_cp, p.getWorldPosition(_w)); p.rotation.set(0, Math.atan2(_d.x, _d.z), 0); } }
    g.visible = amount > 0.002;
  };
  return g;
}

// Motes of light that converge from the air into a point (sound pulled out of thin air, energy gathering into a
// part): `count` HDR specks start on a sphere of about `radius` around the target, spiral in and shrink as they
// arrive. motes.set(t, target, t0, t1, life = 0.9) every update: each mote flies for `life` s, starting between t0 and
// t1 - life; target is a Vector3, [x, y, z] or an Object3D (followed as it moves).
export function converge({ count = 70, radius = 1.3, color = accentDefault(), size = 0.012, intensity = 9, seed = 3 } = {}) {
  const R = rng(seed);
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), m, count); mesh.frustumCulled = false;
  const items = Array.from({ length: count }, () => {
    const d = new THREE.Vector3(R() * 2 - 1, (R() * 2 - 1) * 0.7, R() * 2 - 1).normalize();
    return { d, r: radius * (0.6 + R() * 0.6), delay: R(), spin: (R() - 0.5) * 2.5, s: size * (0.5 + R()) };
  });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), tgt = new THREE.Vector3();
  mesh.set = (t, target, t0, t1, life = 0.9) => {
    if (target?.isObject3D) target.getWorldPosition(tgt); else if (target?.isVector3) tgt.copy(target); else tgt.set(...target);
    items.forEach((it, i) => {
      const u = (t - (t0 + it.delay * Math.max(0, t1 - t0 - life))) / life;
      if (u <= 0 || u >= 1) { m4.makeScale(0, 0, 0); mesh.setMatrixAt(i, m4); return; }
      const e = ease.inCubic(u); // slow at first, then rushing in
      v.copy(it.d).applyAxisAngle(Y, it.spin * e).multiplyScalar(it.r * (1 - e)).add(tgt);
      const s = it.s * Math.sin(Math.PI * Math.min(1, u * 1.4)) * (1 - 0.5 * e);
      m4.compose(v, q, sc.set(s, s, s)); mesh.setMatrixAt(i, m4);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  return mesh;
}
