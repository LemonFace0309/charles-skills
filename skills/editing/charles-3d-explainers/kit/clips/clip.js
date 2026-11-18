// A clip made by clip.mjs --frames, as a texture inside a shot: on a phone screen, a laptop, a sign, or as a
// full-frame plate under the kit's overlays. Time-pure: the texture shows frame floor((t - at) * fps * speed) of the
// clip for the output frame's time t. The frame is loaded before the frame's sub-renders, so all of them see the same
// picture (the clip's own motion blur is already in its frames).
//
//   import { clip, clipPlane } from '<kit url>/clips/clip.js'      // in a shot: await import(k.kit('clips/clip.js'))
//   const c = await clip(k, 'assets/clips/plane', { at: 0.2 });     // the folder clip.mjs --frames wrote
//   phone.setScreen(c.texture);                                     // on a device: lit like any screen
//   const plate = clipPlane(k, c);                                  // full frame, under captions and labels
//
// clip(k, rel, o) options: at 0 (shot-local second at which the clip's first frame shows), speed 1, loop false
// (false: hold the first frame before `at` and the last after the end), from 0 (seconds into the clip to start at),
// keep 12 (decoded frames kept in memory).
// Returns { texture, info, frames, duration, aspect, index(t), time(t), render(t) }. render(t) must run once per output
// frame before the sub-renders: k.clip (seq.js) registers it with the shot's screens, which the editor already awaits
// per frame; called directly (as here, before seq.js has k.clip) it rides on a 2 x 2 k.screen whose render is replaced.
import * as THREE from 'three';

export async function clip(k, rel, { at = 0, speed = 1, loop = false, from = 0, keep = 12, register = null } = {}) {
  const base = (/^(https?:|\/)/.test(rel) ? rel : k.asset(rel)).replace(/\/?$/, '/');
  const res = await fetch(base + 'frames.json');
  if (!res.ok) throw new Error(`clip: no frames.json in ${rel} (make it with clip.mjs --frames)`);
  const info = await res.json();
  const n = info.count, fps = info.fps;
  const file = (i) => base + info.pattern.replace(/%0(\d)d/, (_, w) => String(i + 1).padStart(+w, '0'));
  const index = (t) => {
    let i = Math.floor((t - at) * fps * speed + from * fps + 1e-6);
    if (loop) i = ((i % n) + n) % n; else i = Math.min(n - 1, Math.max(0, i));
    return i;
  };
  const cache = new Map(); // index -> Promise<ImageBitmap>, least recently used first
  const get = (i) => {
    if (cache.has(i)) { const p = cache.get(i); cache.delete(i); cache.set(i, p); return p; }
    const p = fetch(file(i)).then((r) => { if (!r.ok) throw new Error(`clip: ${file(i)}: HTTP ${r.status}`); return r.blob(); })
      .then((b) => createImageBitmap(b, { imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' }));
    cache.set(i, p);
    while (cache.size > keep) { const [old, op] = cache.entries().next().value; cache.delete(old); op.then((bm) => bm.close?.()).catch(() => {}); }
    return p;
  };
  const texture = new THREE.Texture();
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false; // the bitmaps are decoded flipped
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = 8;
  let shown = -1;
  const C = {
    texture, info, frames: n, duration: n / fps, aspect: info.width / info.height, index,
    time: (t) => index(t) / fps, // seconds into the clip shown at shot time t
    async render(t) {
      const i = index(t);
      if (i !== shown) { texture.image = await get(i); texture.needsUpdate = true; shown = i; }
      for (let j = 1; j <= 3; j++) { const nx = index(t + j / (k.fps || 30)); if (nx !== i && !cache.has(nx)) get(nx).catch(() => {}); } // read ahead
    },
    // seq.js evicts old shots by calling dispose() on every entry of their screens (a clip registered by k.clip is one)
    dispose() {
      for (const p of cache.values()) p.then((bm) => bm.close?.()).catch(() => {});
      cache.clear(); texture.dispose(); shown = -1;
    },
  };
  await C.render(0); // a picture from the start, so build-time code (and the GPU compile) sees a real texture
  if (register) register(C); // k.clip in seq.js passes (c) => S.screens.push(c)
  else {
    // Prototype hook until seq.js has k.clip: seq.js awaits screen.render(t) for every k.screen before each output
    // frame, so a 2 x 2 screen whose render() is this clip's render() loads the right frame at the right time.
    const hook = await k.screen({ w: 2, h: 2 });
    hook.render = (t) => C.render(t);
  }
  return C;
}

// A full-frame plate: the clip on a camera-locked quad that fills the frame (cover), behind everything else. With
// tonemap 'inverse' (default) it goes through the inverse of the film stage's AgX curve, so after bloom, AgX and the
// grade it looks as it did in the file; 'none' sends it in as plain light (flatter and dimmer).
// Set k.lens = { blur: 0 } in the shot: the clip has its own depth of field, and a camera-locked quad would be blurred
// by the lens jitter at any focus distance.
export function clipPlane(k, C, { dist = 50, tonemap = 'inverse', look, highlights = 6, gain = 1, fit = 'cover' } = {}) {
  const lut = tonemap === 'inverse' ? k.props.inverseToneLUT({ look: look ?? k.pal.post?.look ?? 0.35, highlights }) : null;
  const N = lut ? lut.image.width : 2;
  const mat = new THREE.ShaderMaterial({
    uniforms: { clipMap: { value: C.texture }, clipLut: { value: lut }, clipGain: { value: gain }, clipLutOn: { value: lut ? 1 : 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `precision highp float; precision highp sampler3D;
      uniform sampler2D clipMap; uniform sampler3D clipLut; uniform float clipGain, clipLutOn; varying vec2 vUv;
      vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
      void main(){
        vec3 c = texture2D(clipMap, vUv).rgb;
        if (clipLutOn > .5) { vec3 s = clamp(toSRGB(clamp(c, 0., 1.)), 0., 1.); c = exp2(texture(clipLut, s * ${((N - 1) / N).toFixed(6)} + ${(0.5 / N).toFixed(6)}).rgb); }
        gl_FragColor = vec4(c * clipGain, 1.);
      }`,
    depthWrite: false, depthTest: false, fog: false, lights: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  quad.renderOrder = -1000; quad.frustumCulled = false;
  const cam = k.camera;
  const size = () => { // cover (or contain) the camera's view at `dist`
    const h = 2 * dist * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2), w = h * cam.aspect;
    const s = fit === 'cover' ? Math.max(w / C.aspect, h) : Math.min(w / C.aspect, h);
    quad.scale.set(s * C.aspect, s, 1); quad.position.set(0, 0, -dist);
  };
  size();
  quad.onBeforeRender = size; // follows fov changes
  cam.add(quad);
  if (!cam.parent) k.scene.add(cam);
  cam.far = Math.max(cam.far, dist * 2);
  return quad;
}
