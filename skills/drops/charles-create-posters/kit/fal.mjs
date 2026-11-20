/* fal.ai queue client: submit, wait, download. Reads FAL_KEY from the environment or from a .env in or above the
   working folder, or ~/.env. Local images go up as data URIs, so nothing else needs uploading. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function falKey() {
  if (process.env.FAL_KEY) return process.env.FAL_KEY;
  const dirs = [];
  for (let d = process.cwd(); ; d = path.dirname(d)) { dirs.push(d); if (d === path.dirname(d)) break; }
  dirs.push(os.homedir());
  for (const d of dirs) {
    const f = path.join(d, '.env');
    if (!fs.existsSync(f)) continue;
    const m = fs.readFileSync(f, 'utf8').match(/^\s*(?:export\s+)?FAL_KEY\s*=\s*["']?([^"'\s#]+)/m);
    if (m) return m[1];
  }
  throw new Error('FAL_KEY not found: set it in the environment or in a .env file in or above this folder');
}

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

export function dataUri(file) {
  if (/^(https?:|data:)/.test(file)) return file;
  const mime = MIME[path.extname(file).toLowerCase()] || 'image/png';
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

async function call(method, url, key, body) {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(url, {
        method,
        headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await r.text();
      if (!r.ok) {
        const err = new Error(`fal ${r.status}: ${text.slice(0, 600)}`);
        err.status = r.status;
        throw err;
      }
      return text ? JSON.parse(text) : {};
    } catch (e) {
      const transient = !e.status || e.status >= 500 || e.status === 429;
      if (!transient || attempt >= 4) throw e;
      await new Promise((res) => setTimeout(res, 1500 * attempt));
    }
  }
}

/* Runs one request on the queue and returns { result, seconds }. */
export async function falRun(endpoint, input, { timeoutSec = 900 } = {}) {
  const key = falKey();
  const t0 = Date.now();
  const sub = await call('POST', `https://queue.fal.run/${endpoint}`, key, input);
  for (;;) {
    const st = await call('GET', sub.status_url, key);
    if (st.status === 'COMPLETED') break;
    if (Date.now() - t0 > timeoutSec * 1000) throw new Error(`${endpoint} timed out after ${timeoutSec}s`);
    await new Promise((res) => setTimeout(res, 2000));
  }
  const result = await call('GET', sub.response_url, key);
  return { result, seconds: (Date.now() - t0) / 1000 };
}

export async function download(url, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (url.startsWith('data:')) {
    fs.writeFileSync(dest, Buffer.from(url.split(',')[1], 'base64'));
    return dest;
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status} ${url}`);
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
  return dest;
}

export function imagesOf(result) {
  if (Array.isArray(result.images)) return result.images;
  if (result.image) return [result.image];
  return [];
}
