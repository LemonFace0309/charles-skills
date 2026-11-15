// The lens and film stage. Input: an accumulated HDR frame (linear, scene-referred). Output: the display frame.
// Order matters and mirrors a real camera: lens (chromatic aberration) -> bloom/glow -> exposure -> AgX (Blender's
// view transform) -> grade (lift/gamma/gain, split tone) -> vignette -> grain -> dither.
import * as THREE from 'three';

const VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// The caption shade (post.captionShade): a graduated filter in front of the lens that darkens the scene light under the
// caption band, in linear light before the bloom and the tone map, so it grades like a soft exposure drop (never a
// flat grey bar) and the bloom comes from the shaded picture. capBand: y from the top as fractions of the frame
// (fade-in start, full start, full end, fade-out end); the fades are smoothstep in light, smootherstep in shape.
const CAPSHADE = /* glsl */ `
uniform float capShade; uniform vec4 capBand;
float capMask(float yTop){
  float a = clamp((yTop - capBand.x) / max(capBand.y - capBand.x, 1e-4), 0., 1.), b = clamp((capBand.w - yTop) / max(capBand.w - capBand.z, 1e-4), 0., 1.);
  a = a * a * a * (a * (a * 6. - 15.) + 10.); b = b * b * b * (b * (b * 6. - 15.) + 10.);
  return a * b;
}
float capShadeAt(vec2 uv){ return capShade > 0. ? 1. - capShade * capMask(1. - uv.y) : 1.; }`;

const DOWN = /* glsl */ `
precision highp float; varying vec2 vUv; uniform sampler2D src; uniform vec2 texel; uniform float karis;
${CAPSHADE}
vec3 s(vec2 o){ return texture2D(src, vUv + o * texel).rgb; }
float w(vec3 c){ return 1.0 / (1.0 + dot(c, vec3(0.2126, 0.7152, 0.0722))); }
void main(){
  vec3 a=s(vec2(-2.,2.)), b=s(vec2(0.,2.)), c=s(vec2(2.,2.));
  vec3 d=s(vec2(-2.,0.)), e=s(vec2(0.,0.)), f=s(vec2(2.,0.));
  vec3 g=s(vec2(-2.,-2.)), h=s(vec2(0.,-2.)), i=s(vec2(2.,-2.));
  vec3 j=s(vec2(-1.,1.)), k=s(vec2(1.,1.)), l=s(vec2(-1.,-1.)), m=s(vec2(1.,-1.));
  vec3 col;
  if (karis > 0.5) {
    vec3 g0=(a+b+d+e)*.25, g1=(b+c+e+f)*.25, g2=(d+e+g+h)*.25, g3=(e+f+h+i)*.25, g4=(j+k+l+m)*.25;
    float w0=w(g0)*.125, w1=w(g1)*.125, w2=w(g2)*.125, w3=w(g3)*.125, w4=w(g4)*.5;
    col = (g0*w0 + g1*w1 + g2*w2 + g3*w3 + g4*w4) / (w0+w1+w2+w3+w4);
    col *= capShadeAt(vUv); // the first level reads the HDR frame: the bloom comes from the shaded picture
  } else {
    col = e*.125 + (a+c+g+i)*.03125 + (b+d+f+h)*.0625 + (j+k+l+m)*.125;
  }
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}`;

const UP = /* glsl */ `
precision highp float; varying vec2 vUv; uniform sampler2D src; uniform vec2 texel; uniform float radius; uniform float weight;
void main(){
  vec2 r = texel * radius;
  vec3 c = texture2D(src, vUv).rgb * 4.0;
  c += (texture2D(src, vUv + vec2(0., r.y)).rgb + texture2D(src, vUv - vec2(0., r.y)).rgb
      + texture2D(src, vUv + vec2(r.x, 0.)).rgb + texture2D(src, vUv - vec2(r.x, 0.)).rgb) * 2.0;
  c += texture2D(src, vUv + r).rgb + texture2D(src, vUv - r).rgb
     + texture2D(src, vUv + vec2(r.x, -r.y)).rgb + texture2D(src, vUv + vec2(-r.x, r.y)).rgb;
  gl_FragColor = vec4(c / 16.0 * weight, 1.0);
}`;

// Blends two accumulated shots for a transition before the lens stage, so bloom and grade stay continuous. It runs
// once per output frame, after accumulation, so its taps get no sub-frame averaging: every smear is jittered per pixel
// (interleaved gradient noise) into fine grain, never into copies. Edges mirror instead of wrapping, so a smear never
// drags the frame's far side in.
const MIX = /* glsl */ `
precision highp float; varying vec2 vUv; uniform sampler2D A; uniform sampler2D B; uniform float p; uniform float kind;
uniform vec2 dir; uniform vec3 dipColor; uniform vec2 at; uniform vec3 flare; uniform float aspect; uniform float zout;
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
vec2 mir(vec2 u){ return 1. - abs(1. - mod(u, 2.)); }
// radial smear about the centre: 40 jittered taps (12 even taps left rings of copies)
vec3 zoomTap(sampler2D t, vec2 uv, float scale, float blur){
  vec3 acc = vec3(0.); vec2 c = vec2(.5); float j = ign(gl_FragCoord.xy);
  for (int i = 0; i < 40; i++) { float f = (float(i) + j) / 40.; vec2 q = c + (uv - c) / (scale * (1. + blur * f)); acc += texture2D(t, mir(q)).rgb; }
  return acc / 40.;
}
// linear smear along d: 64 jittered taps. 12 fixed taps over half the frame left copies 49 px apart (87 px vertically)
vec3 whipTap(sampler2D t, vec2 uv, vec2 d){
  vec3 acc = vec3(0.); float j = ign(gl_FragCoord.xy);
  for (int i = 0; i < 64; i++) { float f = (float(i) + j) / 64. - .5; acc += texture2D(t, mir(uv + d * f)).rgb; }
  return acc / 64.;
}
void main(){
  float q = clamp(p, 0., 1.);
  vec3 a, b, col;
  if (kind < 0.5) { // fade: crossfade in linear light
    col = mix(texture2D(A, vUv).rgb, texture2D(B, vUv).rgb, q);
  } else if (kind < 1.5) { // dip through a colour
    float k = q < .5 ? q * 2. : (1. - q) * 2.;
    vec3 src = q < .5 ? texture2D(A, vUv).rgb : texture2D(B, vUv).rgb;
    col = mix(src, dipColor, smoothstep(0., 1., k));
  } else if (kind < 2.5) {
    if (zout > .5) { // zoom out: A shrinks away into the distance, B lands from slightly large
      a = zoomTap(A, vUv, 1. / (1. + q * q * 1.2), q * .3);
      b = zoomTap(B, vUv, 1. + .3 * (1. - q) * (1. - q), (1. - q) * .25);
    } else { // zoom through: A rushes towards the camera, B lands from slightly small
      a = zoomTap(A, vUv, 1. + q * q * 1.6, q * .35);
      b = zoomTap(B, vUv, .82 + .18 * (1. - (1. - q) * (1. - q)), (1. - q) * .25);
    }
    col = mix(a, b, smoothstep(.25, .75, q));
  } else if (kind < 3.5) { // whip pan
    float s = sin(q * 3.14159);
    a = whipTap(A, vUv + dir * q * .6, dir * s * .3);
    b = whipTap(B, vUv - dir * (1. - q) * .6, dir * s * .3);
    col = mix(a, b, smoothstep(.4, .6, q));
  } else { // light: a flare in the accent bursts from the source's screen point and carries the cut. Nothing is added
    // evenly: a flat lift is what the tone map turns into grey fog (YAVG 84, SATAVG 2), so the corners stay dark. The
    // flare's own halo stays tight (r2 / .035): at .10 it lit internet's corners to 92/255 (frame mean 170) at the peak;
    // tight, they stay at 20 (the picture's own corners), mean 123
    float k = sin(q * 3.14159);
    vec3 base = mix(texture2D(A, vUv).rgb, texture2D(B, vUv).rgb, smoothstep(.45, .55, q));
    vec2 d = (vUv - at) * vec2(aspect, 1.);
    float r2 = dot(d, d), core = exp(-r2 / .015), halo = exp(-r2 / .10), tight = exp(-r2 / .035);
    float streak = exp(-pow((vUv.y - at.y) * 45., 2.)) * exp(-d.x * d.x * 2.5); // a thin horizontal anamorphic streak
    col = base * (1. + k * 5. * halo) + flare * k * k * (8. * core + 1.5 * tight + 2.5 * streak);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const FINAL = /* glsl */ `
precision highp float; varying vec2 vUv;
uniform sampler2D tHDR; uniform sampler2D tBloom; uniform vec2 res; uniform float frame;
uniform float exposure, bloom, bloomNorm, ca, vignette, grain, saturation, contrast, look;
uniform vec3 lift, gamma, gain, shadowTint, highlightTint, fadeColor; uniform float fade;
${CAPSHADE}

const mat3 LIN_SRGB_TO_REC2020 = mat3(vec3(0.6274, 0.0691, 0.0164), vec3(0.3293, 0.9195, 0.0880), vec3(0.0433, 0.0113, 0.8956));
const mat3 LIN_REC2020_TO_SRGB = mat3(vec3(1.6605, -0.1246, -0.0182), vec3(-0.5876, 1.1329, -0.1006), vec3(-0.0728, -0.0083, 1.1187));
vec3 agxContrast(vec3 x){ vec3 x2=x*x, x4=x2*x2; return 15.5*x4*x2 - 40.14*x4*x + 31.96*x4 - 6.868*x2*x + 0.4298*x2 + 0.1191*x - 0.00232; }
vec3 agx(vec3 color){
  const mat3 ins = mat3(vec3(0.856627153315983, 0.137318972929847, 0.11189821299995), vec3(0.0951212405381588, 0.761241990602591, 0.0767994186031903), vec3(0.0482516061458583, 0.101439036467562, 0.811302368396859));
  const mat3 outs = mat3(vec3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826), vec3(-0.11060664309660323, 1.157823702216272, -0.11060664309660294), vec3(-0.016493938717834573, -0.016493938717834257, 1.2519364065950405));
  const float mn = -12.47393, mx = 4.026069;
  color = LIN_SRGB_TO_REC2020 * color; color = ins * color;
  color = clamp((log2(max(color, 1e-10)) - mn) / (mx - mn), 0., 1.);
  color = agxContrast(color);
  // "punchy" look blend: a touch more saturation and contrast, like Blender's AgX Punchy
  float l = dot(color, vec3(0.2126, 0.7152, 0.0722));
  vec3 punchy = l + (pow(max(color,0.), vec3(1.35)) * 1.0 - pow(max(l,0.), 1.35)) * 1.4;
  color = mix(color, max(punchy, 0.), look);
  color = outs * color; color = pow(max(vec3(0.), color), vec3(2.2));
  color = LIN_REC2020_TO_SRGB * color;
  return clamp(color, 0., 1.);
}
vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){
  vec2 uv = vUv;
  vec2 d = uv - .5; float r2 = dot(d * vec2(res.x / res.y, 1.), d * vec2(res.x / res.y, 1.));
  vec3 hdr;
  if (ca > 0.) { vec2 o = d * ca * (0.4 + r2 * 2.0); hdr = vec3(texture2D(tHDR, uv - o).r, texture2D(tHDR, uv).g, texture2D(tHDR, uv + o).b); }
  else hdr = texture2D(tHDR, uv).rgb;
  hdr *= capShadeAt(uv); // the caption shade (the bloom texture is already shaded)
  // the upsampled chain sums every mip level; bloomNorm (1/levels) makes "bloom 0.06" mean 6% of light spread out
  vec3 c = mix(hdr, texture2D(tBloom, uv).rgb * bloomNorm, bloom);
  c *= exposure;
  c *= mix(1., smoothstep(1.15, 0.15, r2 * 2.2), vignette);
  c = agx(c);
  vec3 s = toSRGB(c);
  // grade (display referred, like a colourist's wheels)
  s = pow(max(s * gain + lift * (1. - s), 0.), 1. / max(gamma, vec3(.01)));
  float L = dot(s, vec3(0.2126, 0.7152, 0.0722));
  s += shadowTint * (1. - smoothstep(0., .55, L)) + highlightTint * smoothstep(.45, 1., L);
  s = mix(vec3(L), s, saturation);
  s = (s - .5) * contrast + .5;
  s = mix(s, fadeColor, fade);
  // film grain: luminance only, strongest in the mids, re-seeded every frame
  float g = (h12(gl_FragCoord.xy + frame * 17.31) + h12(gl_FragCoord.xy * 1.37 + frame * 9.13) - 1.);
  s += g * grain * (0.35 + 0.65 * (1. - abs(L * 2. - 1.)));
  // triangular dither kills banding in dark gradients before 8-bit (and H.264) quantise it
  s += (h12(gl_FragCoord.xy + frame) - h12(gl_FragCoord.yx + frame * 3.1)) / 255.;
  gl_FragColor = vec4(clamp(s, 0., 1.), 1.);
}`;

const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
const qscene = new THREE.Scene(); qscene.add(quad);
const qcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const mk = (frag, uniforms, extra = {}) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, ...extra });

export function blit(renderer, material, target) {
  quad.material = material;
  renderer.setRenderTarget(target);
  renderer.render(qscene, qcam);
}

export const hdrTarget = (w, h, opts = {}) => new THREE.WebGLRenderTarget(w, h, {
  type: THREE.HalfFloatType, format: THREE.RGBAFormat, colorSpace: THREE.LinearSRGBColorSpace,
  minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, ...opts,
});

// Default film stage. Every value can be changed per shot (k.post.*) or per project (project.json "post").
// captionShade: the fraction of light taken out under the caption band (0 off; 0.5 is one stop at full strength),
// full from y 1300 to 1500 of 1920 and fading out to 1150 above and 1650 below (setCaptionBand moves it with the
// captions' `bottom`). Applied before the bloom and the tone map, so it grades like a soft exposure drop.
export const DEFAULT_POST = {
  exposure: 1.0, bloom: 0.06, bloomRadius: 1.0, ca: 0.0025, vignette: 0.55, grain: 0.035, saturation: 1.0, contrast: 1.0, look: 0.35,
  lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1], shadowTint: [0, 0, 0], highlightTint: [0, 0, 0], fade: 0, fadeColor: [0, 0, 0],
  captionShade: 0,
};
// The caption shade's band in layout px of a 1080 x 1920 frame: fade-in start, full start, full end, fade-out end.
export const CAPTION_BAND = [1150, 1300, 1500, 1650];

export class Post {
  constructor(renderer, w, h) {
    this.r = renderer; this.w = w; this.h = h;
    this.levels = 6;
    this.mips = [];
    let mw = w, mh = h;
    for (let i = 0; i < this.levels; i++) { mw = Math.max(1, mw >> 1); mh = Math.max(1, mh >> 1); this.mips.push(hdrTarget(mw, mh)); }
    this.capBand = new THREE.Vector4(...CAPTION_BAND.map((y) => y / 1920));
    this.down = mk(DOWN, { src: { value: null }, texel: { value: new THREE.Vector2() }, karis: { value: 0 }, capShade: { value: 0 }, capBand: { value: this.capBand } });
    this.up = mk(UP, { src: { value: null }, texel: { value: new THREE.Vector2() }, radius: { value: 1 }, weight: { value: 1 } }, { blending: THREE.AdditiveBlending, transparent: true });
    this.mixMat = mk(MIX, { A: { value: null }, B: { value: null }, p: { value: 0 }, kind: { value: 0 }, dir: { value: new THREE.Vector2(1, 0) }, dipColor: { value: new THREE.Color(0, 0, 0) },
      at: { value: new THREE.Vector2(0.5, 0.55) }, flare: { value: new THREE.Color(1, 0.75, 0.4) }, aspect: { value: w / h }, zout: { value: 0 } });
    this.mixRT = hdrTarget(w, h);
    this.final = mk(FINAL, {
      tHDR: { value: null }, tBloom: { value: null }, res: { value: new THREE.Vector2(w, h) }, frame: { value: 0 },
      exposure: { value: 1 }, bloom: { value: 0.06 }, bloomNorm: { value: 1 / 6 }, ca: { value: 0 }, vignette: { value: 0 }, grain: { value: 0 }, saturation: { value: 1 }, contrast: { value: 1 }, look: { value: 0.35 },
      lift: { value: new THREE.Vector3() }, gamma: { value: new THREE.Vector3(1, 1, 1) }, gain: { value: new THREE.Vector3(1, 1, 1) },
      shadowTint: { value: new THREE.Vector3() }, highlightTint: { value: new THREE.Vector3() }, fade: { value: 0 }, fadeColor: { value: new THREE.Vector3() },
      capShade: { value: 0 }, capBand: { value: this.capBand },
    });
  }
  // The caption shade's band as y from the top in fractions of the frame: [fade-in start, full start, full end,
  // fade-out end] (seq.js moves CAPTION_BAND with the captions' `bottom`).
  setCaptionBand(ys) { this.capBand.set(...ys); }
  // opts: dir [x, y] (whip); color (dip: the colour dipped through, default black; light: the flare, default warm
  // white, seq.js passes the accent lightened 30%), [r, g, b] in linear scene light or a hex / CSS colour (sRGB, made
  // linear); at [x, y] (light: the source's screen point as fractions of the frame, y from the top, default
  // [0.5, 0.45]); out: true (zoom: pull back out instead of diving in).
  transition(texA, texB, p, kind = 'fade', opts = {}) {
    const K = { fade: 0, dip: 1, zoom: 2, whip: 3, light: 4 };
    const u = this.mixMat.uniforms;
    u.A.value = texA; u.B.value = texB; u.p.value = p; u.kind.value = K[kind] ?? 0;
    // reset every call, so one transition's dir, colour, point or direction never carries over to the next
    u.dir.value.set(...(opts.dir || [1, 0]));
    const setC = (col, c) => (Array.isArray(c) ? col.setRGB(...c) : col.set(c));
    setC(u.dipColor.value, kind === 'dip' ? opts.color ?? [0, 0, 0] : [0, 0, 0]);
    setC(u.flare.value, kind === 'light' ? opts.color ?? [1, 0.75, 0.4] : [1, 0.75, 0.4]);
    const [ax, ay] = opts.at || [0.5, 0.45];
    u.at.value.set(ax, 1 - ay); // layout fractions (y down) -> texture space (y up)
    u.zout.value = opts.out ? 1 : 0;
    blit(this.r, this.mixMat, this.mixRT);
    return this.mixRT.texture;
  }
  bloomChain(tex, radius = 1) {
    let src = tex, sw = this.w, sh = this.h;
    for (let i = 0; i < this.levels; i++) {
      this.down.uniforms.src.value = src; this.down.uniforms.texel.value.set(1 / sw, 1 / sh); this.down.uniforms.karis.value = i === 0 ? 1 : 0;
      blit(this.r, this.down, this.mips[i]);
      src = this.mips[i].texture; sw = this.mips[i].width; sh = this.mips[i].height;
    }
    for (let i = this.levels - 1; i > 0; i--) {
      const s = this.mips[i];
      this.up.uniforms.src.value = s.texture; this.up.uniforms.texel.value.set(1 / s.width, 1 / s.height);
      this.up.uniforms.radius.value = radius; this.up.uniforms.weight.value = 1;
      this.r.autoClear = false; blit(this.r, this.up, this.mips[i - 1]); this.r.autoClear = true;
    }
    return this.mips[0].texture;
  }
  present(tex, P, frame) {
    const shade = Math.min(0.95, Math.max(0, P.captionShade || 0)); // 1 would black the band out: a letterbox bar
    this.down.uniforms.capShade.value = shade; this.final.uniforms.capShade.value = shade;
    const bloomTex = this.bloomChain(tex, P.bloomRadius ?? 1);
    const u = this.final.uniforms;
    u.tHDR.value = tex; u.tBloom.value = bloomTex; u.frame.value = frame % 997;
    // the summed mip chain carries ~levels x the energy; normalise so "bloom" reads as a fraction of light spilled
    u.bloom.value = Math.min(1, (P.bloom ?? 0.06));
    u.exposure.value = P.exposure ?? 1; u.ca.value = P.ca ?? 0; u.vignette.value = P.vignette ?? 0; u.grain.value = P.grain ?? 0;
    u.saturation.value = P.saturation ?? 1; u.contrast.value = P.contrast ?? 1; u.look.value = P.look ?? 0.35;
    u.lift.value.set(...(P.lift || [0, 0, 0])); u.gamma.value.set(...(P.gamma || [1, 1, 1])); u.gain.value.set(...(P.gain || [1, 1, 1]));
    u.shadowTint.value.set(...(P.shadowTint || [0, 0, 0])); u.highlightTint.value.set(...(P.highlightTint || [0, 0, 0]));
    u.fade.value = P.fade || 0; u.fadeColor.value.set(...(P.fadeColor || [0, 0, 0]));
    u.bloomNorm.value = 1 / this.levels;
    blit(this.r, this.final, null);
  }
}
