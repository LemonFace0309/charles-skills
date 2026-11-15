#!/usr/bin/env bun
/* Static server for one project: /kit/* is this kit, /p/* is the project folder. Used by render.mjs; run it alone
   to open a project in a normal browser: bun <kit>/serve.mjs <project> [--port 4870]
   then visit http://127.0.0.1:4870/kit/engine/index.html?p=/p/&scale=0.5&samples=1 and call __seek(t) in the console. */
import fs from 'node:fs';
import path from 'node:path';

const KIT = path.dirname(new URL(import.meta.url).pathname);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.hdr': 'application/octet-stream', '.exr': 'application/octet-stream', '.ktx2': 'application/octet-stream', '.bin': 'application/octet-stream', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };

export function args(argv, valued = []) {
  const pos = [], opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); if (valued.includes(k) && i + 1 < argv.length && !argv[i + 1].startsWith('--')) opt[k] = argv[++i]; else opt[k] = true; }
    else pos.push(a);
  }
  return { pos, opt };
}

export function serve(projectDir, port = 0) {
  const root = path.resolve(projectDir);
  const server = Bun.serve({
    port, hostname: '127.0.0.1',
    async fetch(req) {
      const u = new URL(req.url);
      let p = decodeURIComponent(u.pathname), base;
      if (p.startsWith('/kit/')) { base = KIT; p = p.slice(5); }
      else if (p.startsWith('/p/')) { base = root; p = p.slice(3); }
      else return new Response('not found', { status: 404 });
      const file = path.resolve(base, p);
      if (!file.startsWith(base)) return new Response('forbidden', { status: 403 });
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return new Response('not found: ' + p, { status: 404 });
      return new Response(Bun.file(file), { headers: { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' } });
    },
  });
  return { port: server.port, stop: () => server.stop(true), url: `http://127.0.0.1:${server.port}` };
}

if (import.meta.main) {
  const { pos, opt } = args(process.argv.slice(2), ['port']);
  if (!pos[0]) { console.error('usage: bun serve.mjs <project> [--port 4870]'); process.exit(1); }
  const s = serve(pos[0], Number(opt.port || 4870));
  console.log(`${s.url}/kit/engine/index.html?p=/p/&scale=0.5&samples=1`);
}
