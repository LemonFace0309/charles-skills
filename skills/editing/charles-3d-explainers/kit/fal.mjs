#!/usr/bin/env bun
/* A small fal.ai client for Bun: finds FAL_KEY, uploads local files to fal storage, runs a queue job and returns its JSON.

     bun <kit>/fal.mjs scribe <audio|video> <out.json>          word timings (ElevenLabs Scribe, English)
     bun <kit>/fal.mjs run <endpoint> <input.json> <out.json>    any fal endpoint; local file paths in the input are uploaded
         --dry             print the endpoint, the input and the price estimate; spend nothing (no upload, no job)
         --project <dir>   append the paid call to <dir>/assets/costs.jsonl (a cached result is not a paid call)
     bun <kit>/fal.mjs upload <file>                             print a fal storage URL for a local file

   Options: --force (ignore the result cache), --save <dir> (run: also download every file URL in the result),
            --lang eng (scribe language), --events (scribe: keep audio events like "(laughs)"), --quiet.

   As a module:
     import { findKey, upload, submit, wait, run, scribe, download } from '<kit>/fal.mjs';
     const words = await scribe('audio.m4a');                       // Scribe JSON: { text, words: [{ text, start, end, type }] }
     const out = await run('fal-ai/some/model', { image_url: 'art/a.png', prompt: '...' });
     const est = await estimate('fal-ai/nano-banana-pro', { num_images: 1 });  // { usd, unit, unitPrice, qty, source } or null

   FAL_KEY comes from the environment, else from the nearest .env walking up from the working directory, else from the
   nearest .env walking up from this kit. Results are cached by input under ~/.cache/charles-3d-explainers/, so running
   the same job twice costs nothing; pass --force (or { force: true }) to run it again. The key is never printed. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { args } from './serve.mjs';

const KIT = path.dirname(new URL(import.meta.url).pathname);
const CACHE = path.join(os.homedir(), '.cache', 'charles-3d-explainers');
const FF = fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';
const UPLOAD_TTL = 3 * 24 * 3600 * 1000; // re-upload after 3 days so a stale storage URL never reaches a job
const MIME = { '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.aac': 'audio/aac', '.flac': 'audio/flac', '.ogg': 'audio/ogg', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.json': 'application/json', '.txt': 'text/plain', '.glb': 'model/gltf-binary', '.obj': 'text/plain', '.zip': 'application/zip' };
const VIDEO_EXT = new Set(['.mp4', '.mov', '.m4v', '.webm', '.mkv']);

export const SCRIBE = 'fal-ai/elevenlabs/speech-to-text';

// ---------- key ----------
function keyFromEnvFile(file) {
  try {
    const m = fs.readFileSync(file, 'utf8').match(/^\s*(?:export\s+)?FAL_KEY\s*=\s*(.+?)\s*$/m);
    return m ? m[1].replace(/^(['"])(.*)\1$/, '$2').trim() || null : null;
  } catch { return null; }
}
function walkUp(start) { const out = []; let d = path.resolve(start); for (;;) { out.push(d); const p = path.dirname(d); if (p === d) break; d = p; } return out; }

let KEY = null;
export function findKey() {
  if (KEY) return KEY;
  if (process.env.FAL_KEY) return (KEY = process.env.FAL_KEY.trim());
  for (const start of [process.cwd(), KIT]) for (const d of walkUp(start)) {
    const k = keyFromEnvFile(path.join(d, '.env'));
    if (k) return (KEY = k);
  }
  throw new Error('FAL_KEY not found: set it in the environment or in a .env file in this folder or a parent');
}

// ---------- http ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (o, ...m) => { if (!o.quiet) console.error(...m); };

// JSON request with the fal key. Retries GETs on network errors and 5xx; retries POSTs only when fal clearly did not
// take the request (429/502/503/504), so a job is never submitted twice.
async function http(url, { body, method, auth = true, tries = 4, timeout = 120000 } = {}) {
  const m = method || (body !== undefined ? 'POST' : 'GET');
  const headers = auth ? { Authorization: `Key ${findKey()}` } : {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let last;
  for (let i = 0; i < tries; i++) {
    let res;
    try { res = await fetch(url, { method: m, headers, body: body !== undefined ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeout) }); }
    catch (e) { last = e; if (m !== 'GET') throw new Error(`${m} ${url}: ${e.message}`); await sleep(1000 * 2 ** i); continue; }
    if (res.ok) return res.status === 204 ? {} : res.json();
    const text = (await res.text()).slice(0, 1500);
    last = new Error(`HTTP ${res.status} from ${url}: ${text}`);
    last.status = res.status; last.body = text;
    const retry = m === 'GET' ? res.status >= 500 || res.status === 429 : [429, 502, 503, 504].includes(res.status);
    if (!retry) throw last;
    await sleep(1000 * 2 ** i);
  }
  throw last;
}

// ---------- cache ----------
const sha = (x) => crypto.createHash('sha256').update(x).digest('hex');
const fileHash = (file) => sha(fs.readFileSync(file));
function readJSON(f, d) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } }
function writeJSON(f, v) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 1)); }

// ---------- storage ----------
// Upload a local file to fal storage and return its public URL. Same REST flow as the Python client: initiate, then PUT.
export async function upload(file, o = {}) {
  const abs = path.resolve(file);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) throw new Error(`upload: no such file: ${file}`);
  const digest = fileHash(abs);
  const cacheFile = path.join(CACHE, 'fal-uploads.json');
  const known = readJSON(cacheFile, {});
  const hit = known[digest];
  if (hit && Date.now() - hit.at < UPLOAD_TTL && !o.force) return hit.url;
  const type = MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream';
  const name = path.basename(abs);
  const init = await http('https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3', { body: { content_type: type, file_name: name } });
  const put = await fetch(init.upload_url, { method: 'PUT', headers: { 'Content-Type': type }, body: Bun.file(abs), signal: AbortSignal.timeout(600000) });
  if (!put.ok) throw new Error(`upload of ${name} failed: HTTP ${put.status} ${(await put.text()).slice(0, 400)}`);
  say(o, `uploaded ${name} (${(fs.statSync(abs).size / 1e6).toFixed(1)} MB)`);
  known[digest] = { url: init.file_url, at: Date.now(), name };
  writeJSON(cacheFile, known);
  return init.file_url;
}

// Walk the input and find every string that names an existing local file (relative paths are read from `base`).
// key: the input with each file replaced by its content hash, a cache key that survives re-uploads.
// upload(): the input with each file replaced by its uploaded URL.
function localFiles(value, base) {
  const files = [];
  const walk = (v) => {
    if (typeof v === 'string') {
      if (/^(https?:|data:)/.test(v) || v.length > 1024 || v.includes('\n')) return v;
      const p = path.resolve(base, v.replace(/^~(?=\/)/, os.homedir()));
      if (fs.existsSync(p) && fs.statSync(p).isFile()) { files.push(p); return { __file: p }; }
      return v;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  const tree = walk(value);
  const map = (v, f) => (v && v.__file ? f(v.__file) : Array.isArray(v) ? v.map((x) => map(x, f)) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, map(x, f)])) : v);
  return {
    files,
    key: () => map(tree, (p) => 'sha256:' + fileHash(p)),
    upload: async (o) => { const urls = new Map(); for (const p of files) if (!urls.has(p)) urls.set(p, await upload(p, o)); return map(tree, (p) => urls.get(p)); },
  };
}

// ---------- queue ----------
export async function submit(endpoint, input) {
  const job = await http(`https://queue.fal.run/${endpoint}`, { body: input });
  if (!job.status_url || !job.response_url) throw new Error(`unexpected queue reply from ${endpoint}: ${JSON.stringify(job).slice(0, 400)}`);
  return job;
}

// Poll a submitted job until it completes, then return its result JSON.
export async function wait(job, o = {}) {
  const t0 = Date.now(), limit = (o.timeout ?? 1800) * 1000;
  let lastStatus = '';
  for (let i = 0; ; i++) {
    const st = await http(job.status_url);
    const s = st.status + (st.queue_position != null ? ` (queue position ${st.queue_position})` : '');
    if (s !== lastStatus) { say(o, `  ${s}`); lastStatus = s; }
    if (st.status === 'COMPLETED') break;
    if (st.status === 'FAILED' || st.status === 'ERROR') throw new Error(`job failed: ${JSON.stringify(st).slice(0, 800)}`);
    if (Date.now() - t0 > limit) throw new Error(`timed out after ${o.timeout ?? 1800} s (last status ${st.status})`);
    await sleep(i < 10 ? 700 : 2500);
  }
  try { return await http(job.response_url); }
  catch (e) { throw new Error(`job finished with an error: ${e.body || e.message}`); }
}

// Run an endpoint: upload local files named in the input, submit, poll, return the result JSON (cached by input).
// o: { force, base (folder that relative file paths are read from), cacheKey, timeout, quiet, onPaid({ endpoint,
// secs, requestId }): called once when a job really ran (not for a cached result), e.g. to log its cost }
export async function run(endpoint, input, o = {}) {
  const lf = localFiles(input, o.base || process.cwd());
  const cacheFile = path.join(CACHE, 'fal-results', sha(JSON.stringify({ endpoint, key: o.cacheKey ?? lf.key() })) + '.json');
  if (!o.force && fs.existsSync(cacheFile)) { say(o, `cached result for ${endpoint} (use --force to run it again)`); return readJSON(cacheFile).result; }
  const real = await lf.upload(o);
  const t0 = Date.now();
  say(o, `fal: ${endpoint}`);
  const job = await submit(endpoint, real);
  const result = await wait(job, o);
  const secs = (Date.now() - t0) / 1000;
  say(o, `  done in ${secs.toFixed(1)} s`);
  writeJSON(cacheFile, { endpoint, at: new Date().toISOString(), result });
  await o.onPaid?.({ endpoint, secs, requestId: job.request_id ?? null });
  return result;
}

// ---------- price ----------
// List prices of the endpoints this kit uses (Nov 2026; clip.mjs, plate.mjs and model.mjs keep their own), per unit.
const PRICES = {
  'fal-ai/nano-banana-pro': [0.15, 'image'], 'fal-ai/nano-banana': [0.0398, 'image'],
  'fal-ai/hunyuan-3d/v3.1/pro/image-to-3d': [0.375, 'call'], 'fal-ai/hunyuan-3d/v3.1/rapid/image-to-3d': [0.225, 'call'],
  'fal-ai/trellis-2': [0.3, 'call'], 'fal-ai/hyper3d/rodin/v2.5': [0.4, 'call'],
  'kling/v4/image-to-video': [0.157, 'second'], 'kling/v4/flash/image-to-video': [0.094, 'second'],
  'google/gemini-omni-flash/v1.2/image-to-video': [0.0819, 'second'], 'minimax/h3-max/image-to-video': [0.08, 'second'],
  'bytedance/seedance-2.0/fast/image-to-video': [0.2419, 'second'],
};
// How many units an input asks for: images (num_images), seconds of video (duration), else one.
const units = (unit, input) => {
  if (/image/i.test(unit)) return Number(input.num_images ?? input.n ?? 1) || 1;
  if (/second/i.test(unit)) return Number(String(input.duration ?? input.seconds ?? 5).replace(/[^0-9.]/g, '')) || 5;
  return 1;
};
// Price estimate for a call: fal's pricing API when it answers (a free GET), else the list above, else null.
export async function estimate(endpoint, input = {}) {
  let unitPrice = null, unit = null, source = null;
  try {
    const r = await http(`https://api.fal.ai/v1/models/pricing?endpoint_id=${encodeURIComponent(endpoint)}`, { tries: 1, timeout: 10000 });
    const p = (r.prices || []).find((x) => x.endpoint_id === endpoint) || r.prices?.[0];
    if (p && Number.isFinite(+p.unit_price)) { unitPrice = +p.unit_price; unit = String(p.unit || "call").replace(/s$/, ""); source = "fal pricing API"; }
  } catch {}
  if (unitPrice == null && PRICES[endpoint]) { [unitPrice, unit] = PRICES[endpoint]; source = "the kit's list price"; }
  if (unitPrice == null) return null;
  const qty = units(unit, input);
  return { usd: +(unitPrice * qty).toFixed(4), unitPrice, unit, qty, source };
}
const fmtEst = (e, endpoint) => (e ? `about $${e.usd.toFixed(2)} ($${e.unitPrice} per ${e.unit}${e.qty !== 1 ? ` x ${e.qty}` : ''}, ${e.source})` : `price unknown: see https://fal.ai/models/${endpoint}`);

// Download a URL to a local file.
export async function download(url, file) {
  const r = await fetch(url, { signal: AbortSignal.timeout(600000) });
  if (!r.ok) throw new Error(`download ${url}: HTTP ${r.status}`);
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  await Bun.write(file, r);
  return file;
}

// ElevenLabs Scribe word timings for an audio file (a video's first audio track is extracted first).
// Returns Scribe JSON: { text, language_code, words: [{ text, start, end, type: 'word' | 'spacing' | 'audio_event' }] }.
export async function scribe(file, o = {}) {
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) throw new Error(`scribe: no such file: ${file}`);
  let audio = abs, tmp = null;
  if (VIDEO_EXT.has(path.extname(abs).toLowerCase())) {
    tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'scribe-')), path.basename(abs, path.extname(abs)) + '.m4a');
    const r = spawnSync(FF, ['-v', 'error', '-y', '-i', abs, '-map', '0:a:0', '-vn', '-c:a', 'aac', '-b:a', '160k', tmp]);
    if (r.status !== 0) throw new Error(`scribe: could not read the audio of ${file}: ${String(r.stderr).trim()}`);
    audio = tmp;
  }
  try {
    const params = { language_code: o.lang || 'eng', tag_audio_events: !!o.events, diarize: !!o.diarize };
    return await run(SCRIBE, { audio_url: audio, ...params }, { ...o, cacheKey: { audio: fileHash(audio), ...params } });
  } finally { if (tmp) fs.rmSync(path.dirname(tmp), { recursive: true, force: true }); }
}

// ---------- CLI ----------
if (import.meta.main) {
  const { pos, opt } = args(process.argv.slice(2), ['save', 'lang', 'timeout', 'project']);
  const o = { force: !!opt.force, quiet: !!opt.quiet, timeout: opt.timeout ? Number(opt.timeout) : undefined };
  const usage = 'usage:\n  bun fal.mjs scribe <audio|video> <out.json> [--lang eng] [--events] [--force]\n  bun fal.mjs run <endpoint> <input.json> <out.json> [--save <dir>] [--force] [--dry] [--project <dir>]\n  bun fal.mjs upload <file>';
  try {
    const [cmd, a, b, c] = pos;
    if (cmd === 'scribe' && a && b) {
      const res = await scribe(a, { ...o, lang: opt.lang, events: !!opt.events });
      writeJSON(b, res);
      const words = (res.words || []).filter((w) => !w.type || w.type === 'word');
      console.log(`${b}  (${words.length} words, ${words.length ? words[words.length - 1].end.toFixed(2) : 0} s)`);
    } else if (cmd === 'run' && a && b && (c || opt.dry)) {
      const input = JSON.parse(fs.readFileSync(b, 'utf8'));
      if (opt.dry) { // what would be sent and what it would cost; nothing uploaded, nothing submitted
        const lf = localFiles(input, path.dirname(path.resolve(b)));
        const cached = !opt.force && fs.existsSync(path.join(CACHE, 'fal-results', sha(JSON.stringify({ endpoint: a, key: lf.key() })) + '.json'));
        const est = fmtEst(await estimate(a, input), a);
        console.log(`endpoint  ${a}`);
        console.log(`input     ${JSON.stringify(input, null, 1).split('\n').join('\n          ')}`);
        if (lf.files.length) console.log(`uploads   ${lf.files.map((f) => path.relative(process.cwd(), f)).join(', ')}`);
        console.log(`price     ${cached ? `nothing: the result is cached (with --force: ${est})` : est}`);
        process.exit(0);
      }
      // --project <dir>: log the paid call to <dir>/assets/costs.jsonl, as plate.mjs, clip.mjs and model.mjs do
      const proj = opt.project ? path.resolve(String(opt.project)) : null;
      const onPaid = proj ? async ({ endpoint, secs, requestId }) => {
        const est = await estimate(endpoint, input).catch(() => null), dir = path.join(proj, 'assets');
        fs.mkdirSync(dir, { recursive: true });
        fs.appendFileSync(path.join(dir, 'costs.jsonl'), JSON.stringify({ when: new Date().toISOString(), what: 'fal.mjs run', endpoint, out: path.relative(proj, path.resolve(c)), usd: est ? est.usd : null, secs: Math.round(secs), requestId }) + '\n');
        say(o, `  logged to ${path.relative(process.cwd(), path.join(dir, 'costs.jsonl'))}${est ? ` ($${est.usd.toFixed(2)})` : ' (price unknown)'}`);
      } : undefined;
      const res = await run(a, input, { ...o, base: path.dirname(path.resolve(b)), onPaid });
      writeJSON(c, res);
      console.log(c);
      if (opt.save) {
        const urls = [...new Set(JSON.stringify(res).match(/https:\/\/[^"\s]+/g) || [])].filter((u) => /\.(png|jpe?g|webp|gif|mp4|mov|webm|mp3|wav|m4a|glb|gltf|obj|zip|json)(\?|$)/i.test(u));
        for (const [i, u] of urls.entries()) {
          const ext = (u.match(/\.([a-z0-9]+)(?:\?|$)/i) || [, 'bin'])[1];
          const f = path.join(opt.save, `${path.basename(c, path.extname(c))}${urls.length > 1 ? '_' + i : ''}.${ext}`);
          await download(u, f); console.log(f);
        }
      }
    } else if (cmd === 'upload' && a) {
      console.log(await upload(a, { ...o, force: !!opt.force }));
    } else { console.error(usage); process.exit(1); }
  } catch (e) { console.error(String(e.message || e)); process.exit(1); }
}
