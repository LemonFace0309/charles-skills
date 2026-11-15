// Live HTML as a texture: design an app screen, a scoreboard or a web page in HTML/CSS, then put it on a phone,
// a laptop or a sign in the 3D scene, where it is lit, focused and motion-blurred like everything else.
// Uses Chrome's HTML-in-canvas (drawElementImage, enabled by render.mjs with --enable-features=CanvasDrawElement).
// The DOM is updated once per output frame (screen.render(t)), before the sub-frames are rendered.
import * as THREE from 'three';

// The screens must be laid out and painted for Chrome to keep a paint record, so they sit at the page origin
// behind the opaque 3D canvas (z-index -1) instead of off-screen.
const host = (() => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:0;top:0;z-index:-1;pointer-events:none;'; document.body.insertBefore(d, document.body.firstChild); return d; })();

export const supported = () => typeof CanvasRenderingContext2D !== 'undefined' && typeof CanvasRenderingContext2D.prototype.drawElementImage === 'function';

// screen({ w, h, html, css, file }) -> { root, texture, canvas, render(t), update, dispose }
//   w, h: pixel size of the screen. Match the pixels it covers in the frame: 1179 x 2556 (a phone at 3x) for a phone
//         that fills the frame height, 1600 x 1032 for a laptop, 1920 x 1080 for a monitor. Size barely changes speed
//         (measured on an M4: the redraw is under 1 ms up to 2048 x 4437; heavy CSS such as big blur filters adds about
//         1.3 ms a frame per megapixel); it costs about 10 bytes a pixel of memory; the GPU limit is 16384 a side.
//   html/css: markup and styles (scoped to this screen); file: a project-relative .html to fetch instead
//   update(t, root): your function that changes the DOM for time t (set it after creating the screen)
export async function screen({ w = 1080, h = 2340, html = '', css = '', file = null, base = '', background = '#000' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.setAttribute('layoutsubtree', ''); canvas.setAttribute('content', 'drawable');
  // every screen sits at the host origin: in block flow a second canvas lands below the viewport (y >= 1920), Chrome
  // never paints it and drawElementImage draws nothing (a black phone screen in every shot built after another screen)
  canvas.style.cssText = `width:${w}px;height:${h}px;display:block;position:absolute;left:0;top:0;`;
  host.appendChild(canvas);
  const root = document.createElement('div');
  root.setAttribute('drawable', '');
  root.style.cssText = `width:${w}px;height:${h}px;overflow:hidden;position:relative;background:${background};`;
  canvas.appendChild(root);
  if (file) html = await (await fetch(base + file)).text();
  // scope CSS to this screen with a shadow root so many screens can share class names
  const shadow = root.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>:host{all:initial} *{box-sizing:border-box} ${css}</style><div class="screen" style="width:${w}px;height:${h}px;position:relative;overflow:hidden">${html}</div>`;
  const content = shadow.querySelector('.screen');
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const S = { root: content, shadow, canvas, texture, w, h, update: null, ok: supported() };
  let painted = null;
  canvas.addEventListener('paint', () => { if (painted) { const r = painted; painted = null; r(); } });
  S.render = async (t) => {
    if (S.update) S.update(t, content);
    if (!S.ok) return;
    await document.fonts.ready;
    await new Promise((r) => { painted = r; canvas.requestPaint ? canvas.requestPaint() : r(); setTimeout(() => { if (painted === r) { painted = null; r(); } }, 120); });
    ctx.clearRect(0, 0, w, h);
    try { ctx.drawElementImage(root, 0, 0); } catch (e) { console.warn('screen draw failed: ' + e.message); }
    texture.needsUpdate = true;
  };
  S.dispose = () => { canvas.remove(); texture.dispose(); }; // the engine calls this when it evicts the shot
  return S;
}
