#!/usr/bin/env bun
/* Makes a character beat: a short AI video clip of a person doing something (scrolling in bed, a thumb swiping, a
   passenger wincing), started from a first frame in the kit's look and graded to the video's palette, so it cuts
   next to the kit's own renders. See references/characters.md for when to use one and how to prompt it.

     bun <kit>/clip.mjs <project> --name bed --prompt "He scrolls slowly with his thumb, then blinks"
         --first-frame out/stills/t0.00.png            animate a still: a kit render, a plate, any image
     bun <kit>/clip.mjs <project> --name bed --prompt "..." --frame "A young man lies in bed at night ..." [--ref hero.png]
                                                        make the first frame too (Nano Banana Pro, in the house style;
                                                        --ref keeps the same character across beats)
     bun <kit>/clip.mjs <project> --name hero --frame "Character portrait: ..." --still-only
                                                        just the still (a character reference, or a frame to check first)
     bun <kit>/clip.mjs <project> --name bed --video take.mp4    bring your own clip: grade, conform, strip, frames only

   Options:
     --dur 5               seconds to generate (the model's limits apply; 3 is enough for one quick action)
     --endpoint id         fal video model (default kling/v4/image-to-video); see MODELS below for the tested ones
     --res 720p            the model's resolution option (default: the model's cheapest good one)
     --last-frame end.png  end on this frame (models that take one): end on the next shot's first frame to match-cut
     --ref img.png         reference image for the first frame (repeatable): the character sheet keeps one person
     --ref-prop img.png    reference image of an object in the shot (repeatable): a photo on a phone, a product; the
                           prompt says it is an object, so the model does not copy it as the character
     --take N              a new take of the same request (take 1 is the cached one)
     --trim a,b            keep only a..b seconds of the generated clip (default: all of it)
     --grade auto|none     auto (default): tone, saturation, black level, vignette and grain to the palette's targets
     --fps N               output frame rate (default: project.json fps; the models make 24 fps)
     --frames [width]      also extract JPEG frames to assets/clips/<name>/ for k.clip / kit/clips/clip.js in a shot
     --keep-audio          keep the model's soundtrack (Kling 4, Gemini and H3 Max files carry one; listen first)
     --look photoreal      the house look of a generated first frame: photoreal (default: macro, real skin) or
                           stylised (the soft-clay animated-film look; use it only for a deliberately stylised reel)
     --no-style            send --frame as written, without the house style
     --force               run the paid calls again even if the same request is cached
     --dry                 print the prompts, the request and the cost estimate; spend nothing

   Writes to <project>/assets/clips/: <name>.mp4 (graded, project size and fps, no audio), <name>.strip.jpg (a frame
   every 0.25 s with times, to pick the window to cut), <name>.json (prompts, model, cost, timings, tone before and
   after), <name>-first.png (the first frame), raw/<name>[-tN].mp4 (the model's file, with its audio), and every paid
   call in costs.jsonl. Results are cached by input (fal.mjs), so a re-run costs nothing. FAL_KEY as for fal.mjs. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { run, download } from './fal.mjs';

const KIT = path.dirname(new URL(import.meta.url).pathname);
const FF = fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';
const FP = fs.existsSync('/opt/homebrew/bin/ffprobe') ? '/opt/homebrew/bin/ffprobe' : 'ffprobe';
const IMAGE_MODEL = 'fal-ai/nano-banana-pro';
const IMAGE_USD = 0.15;

// Video models, tested on the three reference beats (Nov 2026). usd = list price per second of output by resolution.
// faces:false = the model's provider rejects first frames that show a human face, even a stylised 3D one.
export const MODELS = {
  'kling/v4/image-to-video': { image: 'start_image_url', end: 'end_image_url', dur: [3, 30, 'int'], res: '720p', usd: { '720p': 0.157, '1080p': 0.235 }, note: 'best: holds the character and the look, clean hands, the action lands early; 3 to 5 min' },
  'kling/v4/flash/image-to-video': { image: 'start_image_url', end: null, dur: [3, 20, 'int'], res: '720p', usd: { '720p': 0.094 }, note: 'cheap and quick (about 80 s), same identity, milder acting' },
  'google/gemini-omni-flash/v1.2/image-to-video': { image: 'image_url', end: 'end_image_url', dur: [3, 15, 'int'], res: '720p', usd: { '360p': 0.0273, '720p': 0.0819, '1080p': 0.1229, '4k': 0.2457 }, extra: { aspect_ratio: '9:16' }, note: 'most expressive, but adds its own push-ins and cuts and drifts towards realism; about 1 min' },
  'minimax/h3-max/image-to-video': { image: 'image_url', end: 'end_image_url', dur: [1, 15, 'num'], res: '768P', usd: { '480P': 0.05, '768P': 0.08, '1080P': 0.16 }, extra: { prompt_expansion_mode: 'disabled' }, note: 'fastest (30 s) and cheap, but invents story details (an engine on fire) and jumps the camera' },
  'bytedance/seedance-2.0/fast/image-to-video': { image: 'image_url', end: 'end_image_url', dur: [4, 15, 'str'], res: '720p', usd: { '480p': 0.1076, '720p': 0.2419 }, extra: { aspect_ratio: '9:16', generate_audio: false }, faces: false, note: 'refuses any frame with a face; hands-only shots, slow to start' },
};
const DEFAULT_MODEL = 'kling/v4/image-to-video';

// The house look for characters: the same words that made the tested beats, matching references/look.md.
// House looks for first frames (--look): photoreal macro is the default: in testing the stylised look gave a
// Pixar kid and a cartoon hand that both judges called style breaks in a hard-surface world
const LOOKS = {
  photoreal: 'Photoreal macro cinematography for a premium 3D product film: real skin with fine texture and a soft subsurface glow, true-to-life proportions, a 100 mm macro lens at f/2.8. Lit like a high-end product shot at night: a dark world fading to near black, a soft dim cool key from above, a strong cool rim tracing every silhouette, and exactly one warm light source, the story object. Shallow depth of field with soft round bokeh, gentle film contrast. No text, no letters, no numbers, no logos, no watermark, no UI labels.',
  stylised: 'Rendered like a premium stylised 3D animated film: smooth matte skin like soft clay with a gentle subsurface glow, simplified sculpted features, hair as clean sculpted shapes, fabric with subtle knit texture, no pores, no fine wrinkles. Lit like a high-end product shot at night: a dark world fading to near black, a soft dim cool key light from above, a strong cool rim light tracing every silhouette, and exactly one warm light source, the story object. Shallow depth of field with soft round bokeh, gentle film contrast, calm and cinematic. No text, no letters, no numbers, no logos, no watermark, no UI labels.',
};
const LAYOUT = 'Vertical 9:16 frame: the face or the hands in the middle third, calm dark space in the top third, nothing important in the bottom fifth.';
const MOOD = {
  'night-amber': 'Colour: deep navy-blue night tones, a cool blue rim light, and one warm amber light source.',
  'ocean-blue': 'Colour: deep ocean-blue tones with one warm yellow light source.',
  space: 'Colour: near-black neutral tones, one warm golden light, faint cool fill.',
  'studio-cool': 'Colour: cool blue-grey tones, a brighter mid-key studio, one warm orange accent light.',
  dusk: 'Colour: violet-to-orange dusk tones with warm amber highlights.',
  'emerald-night': 'Colour: a warm brown-black interior at night; the one light source is mint green.',
  'studio-light': 'Colour: bright, airy off-white studio tones with one cobalt-blue accent.',
};
// Tone targets per palette (look.md section 10) and the shadow tint that pulls a clip into the palette's darks.
const NIGHT = { yavg: [30, 50], target: 40, ylow: 12, sat: 18, tint: [-0.03, -0.01, 0.04] };
const GRADE = {
  'night-amber': NIGHT, 'ocean-blue': { ...NIGHT, tint: [-0.04, -0.01, 0.06] }, space: { ...NIGHT, tint: [0.0, 0.0, 0.0] },
  'emerald-night': { ...NIGHT, tint: [0.02, 0.0, -0.02] }, dusk: { yavg: [45, 80], target: 62, ylow: 15, sat: 30, tint: [0.03, 0, -0.02] },
  'studio-cool': { yavg: [60, 90], target: 72, ylow: 20, sat: 28, tint: [-0.02, 0, 0.03] }, 'studio-light': null,
};

// ---------- small helpers ----------
const die = (m, code = 1) => { console.error('clip: ' + m); process.exit(code); };
function parse(argv) {
  const valued = new Set(['name', 'prompt', 'frame', 'first-frame', 'last-frame', 'ref', 'ref-prop', 'character', 'look', 'dur', 'endpoint', 'res', 'take', 'trim', 'grade', 'fps', 'video', 'seed']);
  const pos = [], opt = { ref: [], 'ref-prop': [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { pos.push(a); continue; }
    const k = a.slice(2);
    if (k === 'frames') { const v = argv[i + 1]; if (v && /^\d+$/.test(v)) { opt.frames = +v; i++; } else opt.frames = true; continue; }
    if (valued.has(k)) { const v = argv[++i]; if (v == null) die(`--${k} needs a value`); if (k === 'ref' || k === 'ref-prop') opt[k].push(v); else opt[k] = v; }
    else opt[k] = true;
  }
  return { pos, opt };
}
const sha = (x) => crypto.createHash('sha256').update(x).digest('hex');
const fileSha = (f) => sha(fs.readFileSync(f)).slice(0, 16);
function ff(args, what) { const r = spawnSync(FF, ['-v', 'error', '-y', ...args], { encoding: 'utf8', maxBuffer: 1 << 26 }); if (r.status !== 0) die(`${what}: ${r.stderr.trim().slice(0, 800)}`); return r; }
function probe(file) {
  const r = spawnSync(FP, ['-v', 'error', '-show_entries', 'stream=codec_type,width,height,avg_frame_rate,nb_frames:format=duration', '-of', 'json', file], { encoding: 'utf8' });
  if (r.status !== 0) die(`cannot read ${file}: ${r.stderr.trim()}`);
  const j = JSON.parse(r.stdout), v = j.streams.find((s) => s.codec_type === 'video');
  if (!v) die(`${file} has no video`);
  const [a, b] = String(v.avg_frame_rate || '24/1').split('/').map(Number);
  return { width: v.width, height: v.height, fps: b ? a / b : a, duration: Number(j.format?.duration || 0), audio: j.streams.some((s) => s.codec_type === 'audio') };
}
// Tone of a clip (or an image) as look.md measures it: median over frames sampled every `every` seconds.
function tone(file, { vf = '', every = 0.5, from = 0, to = null } = {}) {
  const sel = `select='isnan(prev_selected_t)+gte(t-prev_selected_t\\,${every})'`;
  const chain = [vf, sel, 'scale=270:480:out_range=pc', 'format=yuvj444p', 'signalstats', 'metadata=mode=print'].filter(Boolean).join(',');
  const args = ['-hide_banner', ...(from ? ['-ss', String(from)] : []), ...(to != null ? ['-to', String(to)] : []), '-i', file, '-vf', chain, '-f', 'null', '-'];
  const r = spawnSync(FF, args, { encoding: 'utf8', maxBuffer: 1 << 26 });
  const rows = { YLOW: [], YAVG: [], YHIGH: [], SATAVG: [] };
  for (const m of String(r.stderr).matchAll(/lavfi\.signalstats\.(YLOW|YAVG|YHIGH|SATAVG)=([0-9.]+)/g)) rows[m[1]].push(+m[2]);
  const med = (a) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
  return { YLOW: med(rows.YLOW), YAVG: med(rows.YAVG), YHIGH: med(rows.YHIGH), SATAVG: med(rows.SATAVG), n: rows.YAVG.length };
}
// Mean luminance of a corner patch relative to the centre (vignette strength) on one frame.
function cornerRatio(file, t) {
  const grab = (crop) => { const r = spawnSync(FF, ['-v', 'error', '-ss', String(t), '-i', file, '-frames:v', '1', '-vf', `scale=270:480,${crop}`, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 1 << 24 }); const b = r.stdout; let s = 0; for (const v of b) s += v; return b.length ? s / b.length : 0; };
  const c = (grab('crop=40:40:0:0') + grab('crop=40:40:230:0') + grab('crop=40:40:0:440') + grab('crop=40:40:230:440')) / 4;
  return c / Math.max(1, grab('crop=90:120:90:180'));
}
const fmt = (s) => `YAVG ${s.YAVG?.toFixed(0)}  YLOW ${s.YLOW?.toFixed(0)}  YHIGH ${s.YHIGH?.toFixed(0)}  SATAVG ${s.SATAVG?.toFixed(1)}`;
function readJSON(f, d) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } }
function logCost(dir, o) { fs.appendFileSync(path.join(dir, 'costs.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...o }) + '\n'); }
function falError(e, endpoint) {
  const msg = String(e.message || e);
  if (/content_policy|likeness|partner_validation|moderat/i.test(msg)) {
    const faces = MODELS[endpoint]?.faces === false;
    die(`${endpoint} refused the input (content check${faces ? ': this model rejects any frame with a human face, even a stylised 3D one' : ''}).\n  Use --endpoint ${DEFAULT_MODEL} (or kling/v4/flash/image-to-video), or reframe without a face.\n  ${msg.slice(0, 300)}`, 2);
  }
  die(`${endpoint}: ${msg.slice(0, 900)}`);
}

// ---------- the request ----------
function videoInput(endpoint, { image, last, prompt, dur, res }) {
  const M = MODELS[endpoint];
  if (!M) { // an untested endpoint: the common field names; check its schema on fal.ai/models/<id> if it complains
    const t2v = /text-to-video/.test(endpoint);
    return { input: { prompt, ...(t2v ? { aspect_ratio: '9:16' } : { image_url: image }), duration: dur, ...(res ? { resolution: res } : {}), ...(last ? { end_image_url: last } : {}) }, usd: null, dur };
  }
  const [lo, hi, kind] = M.dur;
  const d = Math.min(hi, Math.max(lo, dur));
  if (d !== dur) console.log(`  ${endpoint} takes ${lo} to ${hi} s: generating ${d} s`);
  const r = res || M.res;
  if (!(r in M.usd)) die(`${endpoint} resolutions: ${Object.keys(M.usd).join(', ')}`);
  if (last && !M.end) die(`${endpoint} does not take a last frame; use kling/v4/image-to-video, gemini-omni-flash or h3-max`);
  const input = { prompt, [M.image]: image, duration: kind === 'int' ? Math.round(d) : kind === 'str' ? String(Math.round(d)) : d, resolution: r, ...(M.extra || {}) };
  if (last) input[M.end] = last;
  return { input, usd: M.usd[r] * d, dur: d };
}

// ---------- main ----------
const { pos, opt } = parse(process.argv.slice(2));
if (!pos[0] || !opt.name) die('usage: bun clip.mjs <project> --name <n> --prompt "what happens" [--first-frame still.png | --frame "the still" [--ref img.png]] [--dur 5] [--endpoint id] [--still-only] [--video file.mp4] [--frames] [--dry]');
const ROOT = path.resolve(pos[0]);
const project = readJSON(path.join(ROOT, 'project.json'), null);
if (!project) die(`no project.json in ${ROOT}`);
const [W, H] = project.size || [1080, 1920];
const FPS = Number(opt.fps || project.fps || 30);
const palette = project.palette || 'night-amber';
const name = String(opt.name).replace(/[^\w.-]+/g, '-');
const DIR = path.join(ROOT, 'assets', 'clips');
fs.mkdirSync(path.join(DIR, 'raw'), { recursive: true });
const endpoint = opt.endpoint || DEFAULT_MODEL;
const take = Math.max(1, Number(opt.take || 1));
const dur = Number(opt.dur || 5);
const meta = { name, at: new Date().toISOString(), palette, cost: [] };
const metaFile = path.join(DIR, name + '.json');
const old = readJSON(metaFile, {});
const t0 = Date.now();
const relRoot = (f) => path.relative(ROOT, f);

// 1. the first frame
let first = null;
const firstFile = path.join(DIR, `${name}-first.png`);
if (opt.video) {
  if (!fs.existsSync(opt.video)) die(`no such video: ${opt.video}`);
} else if (opt['first-frame']) {
  const src = path.resolve(opt['first-frame']);
  if (!fs.existsSync(src)) die(`no such image: ${opt['first-frame']}`);
  // crop to the project's aspect (a kit still already is); PNG, at most 2K on the long side. The still --still-only made
  // is this same file: ffmpeg cannot write over its input, so read a copy
  const same = path.resolve(src) === path.resolve(firstFile);
  if (same) fs.copyFileSync(src, firstFile + '.src.png');
  ff(['-i', same ? firstFile + '.src.png' : src, '-frames:v', '1', '-vf', `crop='min(iw,ih*${W}/${H})':'min(ih,iw*${H}/${W})',scale='if(gt(ih,2752),-2,iw)':'if(gt(ih,2752),2752,ih)':flags=lanczos`, firstFile], 'first frame');
  if (same) fs.rmSync(firstFile + '.src.png', { force: true });
  first = firstFile;
  meta.first = { from: relRoot(src) };
} else if (!/text-to-video/.test(endpoint)) {
  const chars = [...opt.ref, ...(opt.character ? [path.join(ROOT, 'assets', 'characters', opt.character + '.png')] : [])].map((f) => path.resolve(f));
  const propRefs = opt['ref-prop'].map((f) => path.resolve(f)); // objects to show (a photo on a screen, a product), not the character
  const refs = [...chars, ...propRefs];
  for (const f of refs) if (!fs.existsSync(f)) die(`no such reference image: ${f}`);
  const desc = (opt.frame || `The opening frame of this shot, a moment before the action starts: ${opt.prompt || die('give --prompt, --frame or --first-frame')}`).trim().replace(/([^.!?])$/, '$1.');
  const nth = (i) => ['first', 'second', 'third', 'fourth', 'fifth'][i] || `${i + 1}th`;
  const refLine = (chars.length ? `The same character as in the ${chars.length > 1 ? chars.map((_, i) => nth(i)).join(' and ') + ' reference images' : refs.length > 1 ? 'first reference image' : 'reference image'} (same face, hair, skin tone and clothes). ` : '')
    + propRefs.map((_, i) => `The ${nth(chars.length + i)} reference image is an object in the scene, exactly as it looks there (not a person to copy). `).join('');
  const framePrompt = opt['no-style'] ? desc : `${refLine}${desc} ${LOOKS[opt.look || 'photoreal'] || die(`--look photoreal|stylised`)} ${MOOD[palette] || ''} ${LAYOUT}`;
  const req = { prompt: framePrompt, aspect_ratio: '9:16', resolution: '2K', output_format: 'png', num_images: 1, ...(opt.seed != null ? { seed: +opt.seed } : {}), ...(refs.length ? { image_urls: refs } : {}) };
  const ep = IMAGE_MODEL + (refs.length ? '/edit' : '');
  meta.first = { endpoint: ep, prompt: framePrompt, refs: refs.map(relRoot) };
  if (opt.dry) { console.log(`first frame: ${ep} (~$${IMAGE_USD.toFixed(2)})\n${framePrompt}\n`); }
  else {
    const key = sha(JSON.stringify({ ep, req: { ...req, image_urls: refs.map(fileSha) } }));
    if (!opt.force && old.first?.key === key && fs.existsSync(firstFile)) console.log(`first frame: ${relRoot(firstFile)} (same request, kept)`);
    else {
      console.log(`first frame: ${ep} 2K 9:16 (~$${IMAGE_USD.toFixed(2)})`);
      const s0 = Date.now();
      let res; try { res = await run(ep, req, { force: !!opt.force, timeout: 600 }); } catch (e) { falError(e, ep); }
      const secs = (Date.now() - s0) / 1000;
      const url = res.images?.[0]?.url; if (!url) die(`no image in the reply: ${JSON.stringify(res).slice(0, 300)}`);
      await download(url, firstFile);
      if (secs > 3) { logCost(DIR, { what: `${name} first frame`, endpoint: ep, usd: IMAGE_USD, secs: +secs.toFixed(1) }); meta.cost.push({ what: 'first frame', usd: IMAGE_USD }); }
    }
    meta.first.key = key;
    first = firstFile;
  }
}
if (opt['still-only']) {
  if (!opt.dry) { fs.writeFileSync(metaFile, JSON.stringify({ ...old, ...meta }, null, 1)); console.log(relRoot(firstFile)); }
  process.exit(0);
}

// 2. the video
const rawFile = path.join(DIR, 'raw', `${name}${take > 1 ? '-t' + take : ''}.mp4`);
let gen = null;
if (opt.video) {
  if (path.resolve(opt.video) !== rawFile) fs.copyFileSync(path.resolve(opt.video), rawFile);
  meta.video = { from: path.resolve(opt.video) };
} else {
  const prompt = opt.prompt || die('give --prompt: what happens in the shot');
  const motion = `${prompt} Keep the subject, the ${opt.look === 'stylised' ? 'stylised 3D render look' : 'photoreal look'} and the lighting exactly as in the image; no cuts, no text.`;
  const last = opt['last-frame'] ? path.resolve(opt['last-frame']) : null;
  if (last && !fs.existsSync(last)) die(`no such image: ${opt['last-frame']}`);
  gen = videoInput(endpoint, { image: first || (opt.dry && !/text-to-video/.test(endpoint) ? firstFile : undefined), last, prompt: /text-to-video/.test(endpoint) ? `${prompt} ${LOOKS[opt.look || 'photoreal'] || die(`--look photoreal|stylised`)}` : motion, dur, res: opt.res });
  const shown = { ...gen.input }; for (const k of Object.keys(shown)) if (shown[k] && (shown[k] === first || shown[k] === last || shown[k] === firstFile)) shown[k] = '<' + path.basename(shown[k]) + '>';
  const est = gen.usd != null ? `~$${gen.usd.toFixed(2)}` : 'price unknown: see fal.ai/models/' + endpoint;
  if (opt.dry) { console.log(`video: ${endpoint} ${gen.dur} s (${est})\n${JSON.stringify(shown, null, 1)}`); process.exit(0); }
  if (MODELS[endpoint]?.faces === false) console.log(`  note: ${endpoint} rejects frames that show a face`);
  const cacheKey = { endpoint, input: { ...gen.input, ...(first ? { [MODELS[endpoint]?.image || 'image_url']: 'sha:' + fileSha(first) } : {}), ...(last ? { [MODELS[endpoint]?.end || 'end_image_url']: 'sha:' + fileSha(last) } : {}) }, take };
  const key = sha(JSON.stringify(cacheKey));
  meta.video = { endpoint, request: shown, take, key, est_usd: gen.usd };
  if (!opt.force && old.video?.key === key && fs.existsSync(rawFile)) console.log(`video: ${relRoot(rawFile)} (same request, kept)`);
  else {
    console.log(`video: ${endpoint} ${gen.dur} s (${est}); this takes 1 to 5 minutes`);
    const s0 = Date.now();
    let res; try { res = await run(endpoint, gen.input, { force: !!opt.force, cacheKey, timeout: 1800 }); } catch (e) { falError(e, endpoint); }
    const secs = (Date.now() - s0) / 1000;
    const url = res.video?.url || res.videos?.[0]?.url || res.output?.url;
    if (!url) die(`no video in the reply: ${JSON.stringify(res).slice(0, 400)}`);
    await download(url, rawFile);
    meta.video.secs = +secs.toFixed(1);
    if (secs > 3) { logCost(DIR, { what: `${name} video${take > 1 ? ' take ' + take : ''}`, endpoint, usd: gen.usd != null ? +gen.usd.toFixed(3) : null, secs: +secs.toFixed(1) }); meta.cost.push({ what: 'video', usd: gen.usd }); }
  }
}

// 3. grade and conform: tone into the palette's range, the kit's vignette and grain, project size and frame rate
const P = probe(rawFile);
const [ta, tb] = opt.trim ? String(opt.trim).split(',').map(Number) : [0, P.duration];
const before = tone(rawFile, { from: ta, to: tb });
const G = opt.grade === 'none' ? null : GRADE[palette];
const filters = [];
if (G) {
  // exposure: a gamma that moves the median YAVG to the target when it is outside the palette's range (one correction
  // pass, then measured again); saturation capped; blacks pulled down; shadows tinted towards the palette's darks
  let gamma = 1;
  const outside = before.YAVG > G.yavg[1] || before.YAVG < G.yavg[0];
  if (outside) {
    gamma = Math.log(before.YAVG / 255) / Math.log(G.target / 255);
    gamma = Math.min(1.35, Math.max(0.55, gamma));
    const probeTone = tone(rawFile, { vf: `eq=gamma=${gamma.toFixed(3)}`, from: ta, to: tb, every: 1 });
    if (probeTone.YAVG > 0) gamma = Math.min(1.35, Math.max(0.55, gamma * Math.log(probeTone.YAVG / 255) / Math.log(G.target / 255)));
  }
  const sat = before.SATAVG > G.sat ? Math.max(0.65, G.sat / before.SATAVG) : 1;
  if (gamma !== 1 || sat !== 1) filters.push(`eq=gamma=${gamma.toFixed(3)}:saturation=${sat.toFixed(3)}`);
  if (before.YLOW > G.ylow) { const b = Math.min(0.12, (before.YLOW - G.ylow * 0.6) / 255); filters.push(`colorlevels=rimin=${b.toFixed(3)}:gimin=${b.toFixed(3)}:bimin=${b.toFixed(3)}`); }
  const [rs, gs, bs] = G.tint; if (rs || gs || bs) filters.push(`colorbalance=rs=${rs}:gs=${gs}:bs=${bs}`);
  if (cornerRatio(rawFile, (ta + tb) / 2) > 0.68) filters.push('vignette=angle=PI/6');
}
filters.push(`scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos`, `crop=${W}:${H}`, `fps=${FPS}`);
if (G) filters.push('noise=c0s=5:c0f=t'); // the kit's film grain (post.grain 0.035), so the clip does not look smoother than the renders
filters.push('format=yuv420p');
const out = path.join(DIR, name + '.mp4');
const audio = opt['keep-audio'] && P.audio;
ff(['-ss', String(ta), '-to', String(tb), '-i', rawFile, '-vf', filters.join(','), ...(audio ? ['-c:a', 'aac', '-b:a', '192k'] : ['-an']),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-tune', 'grain', '-profile:v', 'high', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', out], 'grade');
const after = tone(out);
console.log(`tone: raw ${fmt(before)}  ->  graded ${fmt(after)}`);
const Pout = probe(out);

// 4. contact strip (a frame every 0.25 s with its time) to choose the window to cut
const strip = path.join(DIR, name + '.strip.jpg');
const sh = spawnSync(process.execPath, [path.join(KIT, 'sheet.mjs'), out, '--every', '0.25', '--no-project', '--no-words', '--cols', '10', '--width', '180', '--rows', '4', '--out', strip], { encoding: 'utf8' });
if (sh.status !== 0 || !fs.existsSync(strip)) ff(['-i', out, '-vf', `fps=4,scale=180:-2,tile=10x${Math.ceil(Pout.duration * 4 / 10)}`, '-frames:v', '1', strip], 'strip');

// 5. frames for a shot (k.clip / kit/clips/clip.js): time-pure lookup of frame floor(t * fps)
if (opt.frames) {
  const fdir = path.join(DIR, name);
  fs.rmSync(fdir, { recursive: true, force: true }); fs.mkdirSync(fdir, { recursive: true });
  const fw = opt.frames === true ? W : Number(opt.frames);
  ff(['-i', out, '-vf', `scale=${fw}:-2:flags=lanczos`, '-q:v', '3', path.join(fdir, 'f%04d.jpg')], 'frames');
  const count = fs.readdirSync(fdir).filter((f) => f.endsWith('.jpg')).length;
  const fh = Math.round(fw * H / W / 2) * 2;
  fs.writeFileSync(path.join(fdir, 'frames.json'), JSON.stringify({ fps: FPS, count, width: fw, height: fh, duration: count / FPS, pattern: 'f%04d.jpg', source: name + '.mp4' }, null, 1));
  meta.frames = { dir: relRoot(fdir), count, fps: FPS, width: fw };
  console.log(`frames: ${relRoot(fdir)}/ (${count} at ${FPS} fps, ${fw} px wide)`);
}

Object.assign(meta, { prompt: opt.prompt || null, raw: { file: relRoot(rawFile), ...P }, trim: [ta, tb], grade: { filters, before, after }, out: { file: relRoot(out), width: Pout.width, height: Pout.height, fps: FPS, duration: +Pout.duration.toFixed(3) }, strip: relRoot(strip), seconds: +((Date.now() - t0) / 1000).toFixed(1) });
if (!meta.cost.length && old.cost?.length && old.video?.key === meta.video?.key) meta.cost = old.cost;
fs.writeFileSync(metaFile, JSON.stringify(meta, null, 1));
const spent = meta.cost.reduce((s, c) => s + (c.usd || 0), 0);
console.log(`${relRoot(out)}  (${Pout.duration.toFixed(2)} s, ${W}x${H} ${FPS} fps${spent ? `, ~$${spent.toFixed(2)}` : ''})\n${relRoot(strip)}`);
