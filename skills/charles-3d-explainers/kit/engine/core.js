// The camera body. Renders one shot at one instant as a real camera would expose it: many sub-frame renders averaged
// together, each with the shutter open at a slightly different time (motion blur), the lens at a different point of
// its aperture (true depth of field and round bokeh), a sub-pixel offset (anti-aliasing) and the key light at a
// different point of its area (soft shadows). Shots must therefore be pure functions of time: update(t) may be called
// many times per frame, at slightly different t, in any order.
import * as THREE from 'three';
import { halton, toDisk, hash1 } from './util.js';
import { hdrTarget, blit } from './post.js';

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const ADD = new THREE.ShaderMaterial({
  vertexShader: VERT,
  fragmentShader: `precision highp float; varying vec2 vUv; uniform sampler2D t; uniform float w; void main(){ gl_FragColor = vec4(texture2D(t, vUv).rgb * w, 1.0); }`,
  uniforms: { t: { value: null }, w: { value: 1 } },
  blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
  depthTest: false, depthWrite: false, transparent: true,
});

// Bokeh fill. N lens samples leave N sharp copies of every thin bright detail that is out of focus (glow lines, text,
// rims, highlights), spaced about CoC * sqrt(pi / N) apart. A gather blur of radius `fill` * CoC / sqrt(N), sized per
// pixel from the depth of the most central lens sample, closes the gaps between the copies. A tap is skipped when it is
// a sharper surface in front of the pixel, so in-focus edges never bleed into the blur behind them. Depth alone would
// also blur in-focus things that write no depth (text3d, additive glows) over a defocused background, so the fill only
// acts where the central sample and the average differ in contrast at the scale of the copy spacing: in focus they
// match, while one sharp copy against N copies at 1/N strength differs N-fold in variance (block stats from mipmaps).
const STATS = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: `precision highp float; varying vec2 vUv; uniform sampler2D t;
void main(){ float l = dot(texture2D(t, vUv).rgb, vec3(.2126, .7152, .0722)); gl_FragColor = vec4(l, l * l, 0., 1.); }`, uniforms: { t: { value: null } }, depthTest: false, depthWrite: false });
const FILL = new THREE.ShaderMaterial({
  vertexShader: VERT,
  fragmentShader: `precision highp float; varying vec2 vUv;
uniform sampler2D tColor, tDepth, tMipC, tMipZ, tGlow; uniform vec2 texel; uniform float near, far, focus, cocK, rhoK, spK, seed, evLo, evHi, debug;
float dist(vec2 uv){ return (near * far) / (far - (far - near) * texture2D(tDepth, uv).r); }
// glow light here, widened: a ring a little out of focus spreads its lens copies a few px beyond the sharp ring the
// mask draws, so an 8 x 8 block mean (lod 3 of the half-size mask, scaled up) covers the spread
float glowAt(vec2 uv){ vec3 w = vec3(.2126, .7152, .0722); return max(dot(texture2D(tGlow, uv).rgb, w), 6. * dot(textureLod(tGlow, uv, 3.).rgb, w)); }
float coc(float d){ return cocK * abs(1. / focus - 1. / d); }
float ev(vec2 uv, float lod){ // |log2| of the variance ratio, central sample vs average, over a block of 2^lod px
  vec2 mC = textureLod(tMipC, uv, lod).rg, mZ = textureLod(tMipZ, uv, lod).rg;
  return abs(log2((max(mZ.y - mZ.x * mZ.x, 0.) + 1e-5) / (max(mC.y - mC.x * mC.x, 0.) + 1e-5)));
}
void main(){
  vec3 c0 = texture2D(tColor, vUv).rgb;
  float d0 = dist(vUv), rho = rhoK * coc(d0);
  // additive glows (wavefront rings, halos, sheets) write no depth, so d0 there is the defocused world behind them and
  // rho came out large: the gather smeared in-focus rings into blocky steps. Over a glow the gather stays within 2 px.
  float g = glowAt(vUv);
  rho = mix(rho, min(rho, 2.), smoothstep(.05, .4, g));
  // copies under 1.5 px apart already read as one blur: filling them only adds the guard's block steps (thin glow
  // rings slightly out of focus showed 2 x 2 px steps along their length at fill 2.5)
  if (rho < 0.75 || spK * coc(d0) < 1.5) { gl_FragColor = vec4(c0, 1.); return; }
  // the guard looks at blocks of at most 32 px: 256 px blocks drew rectangles over in-focus parts behind a defocused
  // foreground object (glasses passing in front of earbuds)
  float lod = clamp(log2(2. * rho), 1., 5.), b = exp2(lod);
  float e = max(ev(vUv, lod), max(max(ev(vUv + vec2(b, 0.) * texel, lod), ev(vUv - vec2(b, 0.) * texel, lod)), max(ev(vUv + vec2(0., b) * texel, lod), ev(vUv - vec2(0., b) * texel, lod))));
  float mask = smoothstep(evLo, evHi, e);
  if (debug > 0.5) { gl_FragColor = vec4(mask, rho / 32., 0., 1.); return; }
  if (mask <= 0.) { gl_FragColor = vec4(c0, 1.); return; }
  float a0 = 6.2831853 * fract(52.9829189 * fract(dot(gl_FragCoord.xy + seed, vec2(0.06711056, 0.00583715))));
  vec3 sum = c0; float n = 1.;
  for (int i = 0; i < 32; i++) {
    float r = rho * sqrt((float(i) + 0.5) / 32.), a = a0 + float(i) * 2.39996323;
    vec2 uv = vUv + vec2(cos(a), sin(a)) * r * texel;
    float d = dist(uv), w = (d > d0 * 0.97 || rhoK * coc(d) >= r) ? 1. : 0.;
    // never gather an additive glow's light into its neighbours: it writes no depth, so it passes the depth test and
    // was smeared outward in the guard's blocks (jagged steps along in-focus rings)
    w *= 1. - smoothstep(.05, .4, glowAt(uv));
    sum += texture2D(tColor, uv).rgb * w; n += w;
  }
  gl_FragColor = vec4(mix(c0, sum / n, mask), 1.);
}`,
  uniforms: { tColor: { value: null }, tDepth: { value: null }, tMipC: { value: null }, tMipZ: { value: null }, tGlow: { value: null }, texel: { value: new THREE.Vector2() }, near: { value: 0.1 }, far: { value: 100 }, focus: { value: 8 }, cocK: { value: 0 }, rhoK: { value: 0 }, spK: { value: 0 }, seed: { value: 0 }, evLo: { value: 1 }, evHi: { value: 2 }, debug: { value: 0 } },
  depthTest: false, depthWrite: false,
});

// Sampling quality. fill: bokeh fill strength (0 = off). The fill radius is fill x CoC / sqrt(N) while the lens copies
// sit about 1.8 x CoC / sqrt(N) apart, so below about 1.8 gaps stay open: at 1.0, out-of-focus highlights read as a
// waffle or zebra stripes (microwave's molecules, chip's hook); 2.5 closes them and leaves in-focus subjects unchanged.
// Automatic sample floor: N lens samples leave copies about R * sqrt(pi / N) apart, R = the CoC radius at infinity in
// px (h / 2 * projection[5] * aperture / focus); they stay invisible at phone size up to `spacing` px apart with the
// fill (half that without), so N >= pi * (R / spacing)^2, at most maxAuto. Motion floor: N shutter samples leave
// copies D / N apart where something crosses D px while the shutter is open, so N >= D / motionSpacing, at most
// maxMotion (0 = off). The copies merge only when they are no further apart than a thin glowing line is wide: on
// internet's falling padlock (D about 148 px) its keyhole ring still showed separate rings 6 px apart (25 samples),
// faint stripes at 3 (50) and a smear at 2 (75). evLo / evHi: the fill's guard (log2 variance ratio, central sample
// vs average). debug: true paints the guard's mask red and the fill radius green wherever the fill could act.
// fill 2.0 with the guard at evLo 2 / evHi 3 (log2 variance ratio) and its blocks capped at 32 px: tested against the
// artifacts test judges saw, it removes the molecule waffle and the gravel zebra bokeh (both gone from 2.0 up) while thin
// additive glow rings near focus keep only faint 1 px steps (at 2.5 with the old guard they showed blocky steps and a
// defocused foreground smeared rectangles over the in-focus subject).
export const DOF = { fill: 2.0, spacing: 20, maxAuto: 64, maxMotion: 96, motionSpacing: 2, evLo: 2.0, evHi: 3.0, debug: false };

const _right = new THREE.Vector3(), _up = new THREE.Vector3(), _fwd = new THREE.Vector3(), _tmp = new THREE.Vector3();
// a world point from a focus subject or a motion probe: an Object3D (its world position), a Vector3 or [x, y, z]
const pointOf = (x) => (x?.isObject3D ? x.getWorldPosition(new THREE.Vector3()) : x?.isVector3 ? x.clone() : Array.isArray(x) && x.length === 3 ? new THREE.Vector3(...x) : null);

export class Engine {
  constructor(canvas, { width, height, samples = 16, shutter = 0.5, fps = 30 }) {
    this.W = width; this.H = height; this.samples = Math.max(1, samples); this.shutter = shutter; this.fps = fps;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance', stencil: false });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // the post stage writes display values itself
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const msaa = this.samples < 4 ? 4 : 0;
    // with lens sampling the scene's depth is kept as a texture for the bokeh fill
    this.sceneRT = hdrTarget(width, height, { depthBuffer: true, samples: msaa, depthTexture: msaa ? null : new THREE.DepthTexture(width, height, THREE.FloatType) });
    this.accRT = [hdrTarget(width, height), hdrTarget(width, height)];
    this.fillRT = [hdrTarget(width, height), hdrTarget(width, height)];
    const mip = { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter };
    this.mipC = hdrTarget(width, height, mip); this.mipZ = hdrTarget(width, height, mip); // block means for the fill's guard
    this.frameIndex = 0;
  }

  // Focus distance along the view axis to a point (Vector3 or [x, y, z]), an object (its world position) or a number.
  focusDistance(cam, focus) {
    if (focus == null) return 10;
    if (typeof focus === 'number') return Math.max(1e-3, focus);
    const p = focus.isVector3 ? focus : Array.isArray(focus) ? _tmp.fromArray(focus) : focus.getWorldPosition(_tmp);
    cam.getWorldDirection(_fwd);
    return Math.max(1e-3, _tmp.copy(p).sub(cam.getWorldPosition(new THREE.Vector3())).dot(_fwd));
  }

  // Lens of shot S as its last update left it: focus distance, aperture (world units), CoC radius at infinity in px.
  lensOf(S, ts) {
    const cam = S.camera, lens = S.lens || {};
    const f = this.focusDistance(cam, typeof lens.focus === 'function' ? lens.focus(ts) : lens.focus);
    // lens.blur is the aperture as a fraction of the focus distance (0.01 subtle, 0.02 cinematic, 0.04 macro);
    // lens.aperture is the same in world units. blur keeps the look constant when the camera moves in or out.
    const aperture = lens.blur != null ? lens.blur * f : (lens.aperture || 0);
    const R = cam.isPerspectiveCamera ? 0.5 * this.H * cam.projectionMatrix.elements[5] * aperture / f : 0;
    return { f, aperture, R };
  }

  // Sub-frames for shot S this frame: the shot's own k.samples (or the project's), raised when the defocus is strong.
  sampleCount(S, R) {
    if (this.samples === 1) return 1;
    const base = Math.max(1, Math.round(S.samples || this.samples));
    const spacing = DOF.spacing * ((S.lens?.fill ?? DOF.fill) && this.sceneRT.depthTexture ? 1 : 0.5);
    const auto = Math.min(DOF.maxAuto, Math.ceil(Math.PI * (R / spacing) ** 2));
    return S.lens?.autoSamples === false ? base : Math.max(base, auto);
  }

  // Largest screen path in px that the focus point, a world point on the view axis at the focus distance (the camera's
  // own motion) or a k.motionProbes object travels while the shutter is open. The shot is evaluated at five instants
  // across the shutter (update is pure) and the path summed, so a fast swing that comes back inside the shutter (a
  // molecule twisting at 60 Hz) counts its whole travel, not the near-zero gap between its ends. The scene is left at
  // the later end. Call it with the scene at lt.
  motionPx(S, lt) {
    const half = 0.5 * (this.shutter / this.fps) * (S.motionBlur ?? 1), cam = S.camera;
    if (!(half > 0) || !cam.isPerspectiveCamera) return 0;
    const P0 = cam.getWorldPosition(new THREE.Vector3()).addScaledVector(cam.getWorldDirection(_fwd), this.lensOf(S, lt).f);
    // four world points near the frame corners at the focus distance: a dolly-in or -out leaves the centre where it is
    // and moves everything else outward (a diving hook was left at 2 samples while its frame edges moved 100+ px)
    const pz = P0.clone().project(cam).z;
    const fixed = [P0, ...[[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]].map(([x, y]) => new THREE.Vector3(x, y, pz).unproject(cam))];
    const ends = [0, 0.25, 0.5, 0.75, 1].map((f) => lt - half + 2 * half * f).map((ts) => {
      S.update(ts, lt); cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
      const focus = typeof S.lens?.focus === 'function' ? S.lens.focus(ts) : S.lens?.focus;
      return [...fixed, focus, ...(S.motionProbes || [])].map((x) => {
        const p = fixed.includes(x) ? x.clone() : pointOf(x); if (!p) return null;
        p.project(cam); return p.z > 1 || p.z < -1 ? null : [(p.x + 1) * 0.5 * this.W, (1 - p.y) * 0.5 * this.H];
      });
    });
    let D = 0;
    ends[0].forEach((_, i) => {
      let L = 0;
      for (let j = 1; j < ends.length; j++) { const a = ends[j - 1][i], b = ends[j][i]; if (!a || !b) return; L += Math.hypot(a[0] - b[0], a[1] - b[1]); }
      D = Math.max(D, L);
    });
    return D;
  }

  // The additive, depth-less glows alone (no backdrop, nothing opaque), at half size, for the bokeh fill's glow guard.
  // An object opts out with userData.noGlowMask; camera-locked quads (renderOrder <= -100) never count.
  renderGlow(S, cam) {
    if (!this.glowRT) this.glowRT = hdrTarget(Math.max(1, this.W >> 1), Math.max(1, this.H >> 1), { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    const r = this.renderer, hidden = [], bg = S.scene.background;
    const glowy = (m) => m && m.depthWrite === false && m.blending === THREE.AdditiveBlending;
    S.scene.traverse((o) => {
      if (!o.visible || !(o.isMesh || o.isPoints || o.isLine || o.isSprite)) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      // points (dust, stars) blur themselves and are everywhere: masking them would switch the fill off across the frame
      if (o.isPoints || o.renderOrder <= -100 || o.userData.noGlowMask || !ms.every(glowy)) { o.visible = false; hidden.push(o); }
    });
    S.scene.background = null;
    r.setRenderTarget(this.glowRT); r.setClearColor(0x000000, 1); r.clear(true, true, false);
    r.render(S.scene, cam);
    for (const o of hidden) o.visible = true;
    S.scene.background = bg;
  }

  // Render shot `S` at shot-local time `lt` into accumulation buffer `slot`. Returns the accumulated texture.
  accumulate(S, lt, slot = 0, frameIndex = 0) {
    const r = this.renderer, cam = S.camera, acc = this.accRT[slot];
    S.update(lt, lt); cam.updateMatrixWorld(true); cam.updateProjectionMatrix(); // this frame's lens and fov
    let N = this.sampleCount(S, this.lensOf(S, lt).R);
    // motion floor: a fast object (a drop, a snap) or a whip of the camera gets enough shutter samples to smear, not step
    if (N > 1 && DOF.maxMotion > 0 && S.lens?.autoSamples !== false && (S.motionBlur ?? 1) > 0) {
      const D = this.motionPx(S, lt);
      const Nm = Math.min(DOF.maxMotion, Math.ceil(D / DOF.motionSpacing));
      S.maxMotionPx = Math.max(S.maxMotionPx || 0, D); S.maxMotionN = Math.max(S.maxMotionN || 0, Nm); // render.mjs says which floor raised a shot
      N = Math.max(N, Nm);
    }
    S.lastSamples = N; S.maxSamples = Math.max(S.maxSamples || 0, N);
    r.setRenderTarget(acc); r.setClearColor(0x000000, 1); r.clear(true, false, false);
    const dtShutter = this.shutter / this.fps;
    // per-frame rotation of the sample pattern so residual noise reads as grain, not a fixed pattern
    const rot = hash1(frameIndex * 7.13 + 1.7);
    const K = (i) => i + 1 + Math.floor(rot * 64);
    // render the most central lens sample last: its depth stays in sceneRT for the bokeh fill
    const order = [...Array(N).keys()];
    if (N > 1) { let best = 0, bd = 9; for (const i of order) { const d = toDisk(halton(K(i), 5), halton(K(i), 7)); if (Math.hypot(d[0], d[1]) < bd) { bd = Math.hypot(d[0], d[1]); best = i; } } order.push(order.splice(best, 1)[0]); }
    let lens = null;
    for (const i of order) {
      const u = N === 1 ? 0.5 : (i + hash1(frameIndex * 31.7 + i * 3.1)) / N; // stratified shutter time
      const ts = lt + (N === 1 ? 0 : (u - 0.5) * dtShutter * (S.motionBlur ?? 1));
      S.update(ts, lt);
      cam.updateMatrixWorld(true);
      cam.updateProjectionMatrix();
      const saved = cam.position.clone();
      const k = K(i);
      let lx = 0, ly = 0, jx = 0, jy = 0;
      lens = this.lensOf(S, ts);
      const { f, aperture } = lens;
      if (N > 1) {
        jx = halton(k, 2) - 0.5; jy = halton(k, 3) - 0.5;
        if (aperture > 0) { const d = toDisk(halton(k, 5), halton(k, 7)); lx = d[0] * aperture; ly = d[1] * aperture; }
      }
      // lens-aware materials (bokeh sprites) need the focus and aperture to size their blur
      if (S.lensMats) for (const m of S.lensMats) { m.uniforms.uFocus.value = f; m.uniforms.uAperture.value = N > 1 ? aperture : 0; }
      // sky layers (stars): the lens offset below shifts a point at infinity by (P0 lx / f, P5 ly / f) in NDC; a shader
      // that subtracts uSkew stays sharp under any depth of field (it keeps the AA jitter)
      if (S.skyMats) { const E = cam.projectionMatrix.elements, persp = cam.isPerspectiveCamera; for (const m of S.skyMats) m.uniforms.uSkew.value.set(persp ? (E[0] * lx) / f : 0, persp ? (E[5] * ly) / f : 0); }
      if (lx || ly) {
        _right.setFromMatrixColumn(cam.matrixWorld, 0); _up.setFromMatrixColumn(cam.matrixWorld, 1);
        cam.position.addScaledVector(_right, lx).addScaledVector(_up, ly);
        cam.updateMatrixWorld(true);
      }
      const P = cam.projectionMatrix.elements;
      if (cam.isPerspectiveCamera) {
        P[8] += -P[0] * lx / f - (2 * jx) / this.W;
        P[9] += -P[5] * ly / f - (2 * jy) / this.H;
      } else {
        P[12] += (2 * jx) / this.W; P[13] += (2 * jy) / this.H;
      }
      cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
      // area lights: move each soft light across its disk
      const lights = S.softLights || [];
      const savedL = lights.map((L) => L.light.position.clone());
      if (N > 1) lights.forEach((L, j) => {
        const d = toDisk(halton(k + j * 17, 11), halton(k + j * 17, 13));
        const dir = _fwd.copy(L.light.position).sub(L.light.target ? L.light.target.position : new THREE.Vector3()).normalize();
        const a = new THREE.Vector3(0, 1, 0); if (Math.abs(dir.y) > 0.9) a.set(1, 0, 0);
        const t1 = new THREE.Vector3().crossVectors(dir, a).normalize(), t2 = new THREE.Vector3().crossVectors(dir, t1);
        L.light.position.addScaledVector(t1, d[0] * L.radius).addScaledVector(t2, d[1] * L.radius);
      });
      r.setRenderTarget(this.sceneRT);
      r.render(S.scene, cam);
      lights.forEach((L, j) => L.light.position.copy(savedL[j]));
      cam.position.copy(saved);
      cam.updateMatrixWorld(true);
      cam.updateProjectionMatrix();
      ADD.uniforms.t.value = this.sceneRT.texture; ADD.uniforms.w.value = 1 / N;
      r.autoClear = false; blit(r, ADD, acc); r.autoClear = true;
    }
    const near = cam.near, far = cam.far;
    S.update(lt, lt); // leave the scene at the exact frame time for overlays and label projection
    cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
    const fill = S.lens?.fill ?? DOF.fill;
    if (N === 1 || !fill || !(lens?.aperture > 0) || !cam.isPerspectiveCamera || !this.sceneRT.depthTexture) return acc.texture;
    this.renderGlow(S, cam);
    STATS.uniforms.t.value = acc.texture; blit(r, STATS, this.mipC);
    STATS.uniforms.t.value = this.sceneRT.texture; blit(r, STATS, this.mipZ); // the central sample, alone
    const u = FILL.uniforms;
    u.tColor.value = acc.texture; u.tDepth.value = this.sceneRT.depthTexture; u.texel.value.set(1 / this.W, 1 / this.H);
    u.tGlow.value = this.glowRT.texture;
    u.tMipC.value = this.mipC.texture; u.tMipZ.value = this.mipZ.texture; u.evLo.value = DOF.evLo; u.evHi.value = DOF.evHi; u.debug.value = DOF.debug ? 1 : 0;
    u.near.value = near; u.far.value = far; u.focus.value = lens.f; u.seed.value = (frameIndex * 7) % 61;
    u.cocK.value = lens.R * lens.f; // CoC radius in px = cocK * |1/f - 1/d|, with the central sample's fov
    u.rhoK.value = fill / Math.sqrt(N);
    u.spK.value = Math.sqrt(Math.PI / N); // the lens copies' spacing per px of circle of confusion
    blit(r, FILL, this.fillRT[slot]);
    return this.fillRT[slot].texture;
  }
}
