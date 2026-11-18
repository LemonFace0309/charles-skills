#!/usr/bin/env bun
/* Converts a TrueType-flavoured WOFF (the @fontsource files in the kit's node_modules) into a typeface JSON for
   kit/engine/props/type.js: glyph outlines in font units in three.js "typeface" form (m/l/q/b commands, so three's
   FontLoader can read it too), real GPOS pair kerning (including extension lookups, which opentype.js skips), the
   tabular-figure alternates (*.tf glyphs) and the metrics a layout needs (cap height, x-height, ascender...).

     bun kit/fonts/typeface.mjs <in.woff> <out.json> [--name "Inter 800"]
     e.g. bun kit/fonts/typeface.mjs kit/node_modules/@fontsource/inter/files/inter-latin-900-normal.woff kit/fonts/Inter-900.typeface.json

   Characters: every code point in the font's cmap except controls, combining marks and zero-width characters. */
import fs from 'node:fs';
import zlib from 'node:zlib';

const KIT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const opentype = (await import(KIT + '/node_modules/three/examples/jsm/libs/opentype.module.js')).default;

const [inFile, outFile] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const src = process.argv.includes('--source') ? process.argv[process.argv.indexOf('--source') + 1] : inFile;
const buf = fs.readFileSync(inFile);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const font = opentype.parse(ab);

// ---- raw table bytes from the WOFF container (opentype.js keeps them private) ----
function wofTables(b) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const sig = dv.getUint32(0);
  const out = {};
  if (sig === 0x774f4646) { // 'wOFF'
    const n = dv.getUint16(12);
    for (let i = 0; i < n; i++) {
      const e = 44 + i * 20;
      const tag = String.fromCharCode(dv.getUint8(e), dv.getUint8(e + 1), dv.getUint8(e + 2), dv.getUint8(e + 3));
      const off = dv.getUint32(e + 4), comp = dv.getUint32(e + 8), orig = dv.getUint32(e + 12);
      const raw = b.subarray(off, off + comp);
      out[tag] = comp < orig ? zlib.inflateSync(raw) : Buffer.from(raw);
    }
  } else { // plain sfnt
    const n = dv.getUint16(4);
    for (let i = 0; i < n; i++) {
      const e = 12 + i * 16;
      const tag = String.fromCharCode(dv.getUint8(e), dv.getUint8(e + 1), dv.getUint8(e + 2), dv.getUint8(e + 3));
      const off = dv.getUint32(e + 8), len = dv.getUint32(e + 12);
      out[tag] = Buffer.from(b.subarray(off, off + len));
    }
  }
  return out;
}
const tables = wofTables(buf);

// ---- GPOS pair kerning ----
function gposKerning(bytes) {
  if (!bytes) return () => 0;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (o) => dv.getUint16(o), i16 = (o) => dv.getInt16(o), u32 = (o) => dv.getUint32(o);
  const tag = (o) => String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
  const scriptList = u16(4), featureList = u16(6), lookupList = u16(8);
  const langSys = {};
  for (let i = 0, n = u16(scriptList); i < n; i++) {
    const t = tag(scriptList + 2 + i * 6), st = scriptList + u16(scriptList + 2 + i * 6 + 4), def = u16(st);
    if (!def) continue;
    const ls = st + def, cnt = u16(ls + 4);
    langSys[t] = [...Array(cnt)].map((_, j) => u16(ls + 6 + j * 2));
  }
  const feats = langSys.latn || langSys.DFLT || [];
  const lookups = new Set();
  for (const fi of feats) {
    const rec = featureList + 2 + fi * 6;
    if (tag(rec) !== 'kern') continue;
    const f = featureList + u16(rec + 4);
    for (let j = 0, n = u16(f + 2); j < n; j++) lookups.add(u16(f + 4 + j * 2));
  }
  const pop = (v) => { let c = 0; while (v) { c += v & 1; v >>= 1; } return c; };
  const xadvAt = (vf) => (vf & 4 ? pop(vf & 3) * 2 : -1);
  const coverage = (cov) => {
    const fmt = u16(cov), m = new Map();
    if (fmt === 1) for (let i = 0, n = u16(cov + 2); i < n; i++) m.set(u16(cov + 4 + i * 2), i);
    else for (let i = 0, n = u16(cov + 2); i < n; i++) { const r = cov + 4 + i * 6, s = u16(r), e = u16(r + 2), si = u16(r + 4); for (let gid = s; gid <= e; gid++) m.set(gid, si + gid - s); }
    return m;
  };
  const classDef = (cd) => {
    const fmt = u16(cd), m = new Map();
    if (fmt === 1) { const s = u16(cd + 2); for (let i = 0, n = u16(cd + 4); i < n; i++) m.set(s + i, u16(cd + 6 + i * 2)); }
    else for (let i = 0, n = u16(cd + 2); i < n; i++) { const r = cd + 4 + i * 6, s = u16(r), e = u16(r + 2), c = u16(r + 4); for (let gid = s; gid <= e; gid++) m.set(gid, c); }
    return m;
  };
  const subs = []; // per lookup: list of parsed PairPos subtables
  for (const li of [...lookups].sort((a, b) => a - b)) {
    const L = lookupList + u16(lookupList + 2 + li * 2);
    let type = u16(L);
    const list = [];
    for (let s = 0, n = u16(L + 4); s < n; s++) {
      let st = L + u16(L + 6 + s * 2), t = type;
      if (t === 9) { t = u16(st + 2); st = st + u32(st + 4); }
      if (t !== 2) continue;
      const fmt = u16(st), cov = coverage(st + u16(st + 2)), vf1 = u16(st + 4), vf2 = u16(st + 6);
      const s1 = pop(vf1) * 2, s2 = pop(vf2) * 2, xa = xadvAt(vf1);
      if (fmt === 1) {
        const sets = [];
        for (let i = 0, n2 = u16(st + 8); i < n2; i++) {
          const ps = st + u16(st + 10 + i * 2), m = new Map();
          for (let j = 0, n3 = u16(ps); j < n3; j++) { const r = ps + 2 + j * (2 + s1 + s2); m.set(u16(r), xa >= 0 ? i16(r + 2 + xa) : 0); }
          sets.push(m);
        }
        list.push({ fmt, cov, sets });
      } else if (fmt === 2) {
        const cd1 = classDef(st + u16(st + 8)), cd2 = classDef(st + u16(st + 10)), c1n = u16(st + 12), c2n = u16(st + 14);
        list.push({ fmt, cov, cd1, cd2, c1n, c2n, val: (c1, c2) => (xa >= 0 ? i16(st + 16 + (c1 * c2n + c2) * (s1 + s2) + xa) : 0) });
      }
    }
    subs.push(list);
  }
  return (a, b) => {
    let v = 0;
    for (const list of subs) for (const s of list) {
      const ci = s.cov.get(a); if (ci == null) continue;
      if (s.fmt === 1) { const x = s.sets[ci]?.get(b); if (x == null) continue; v += x; break; }
      const c1 = s.cd1.get(a) ?? 0, c2 = s.cd2.get(b) ?? 0;
      if (c1 >= s.c1n || c2 >= s.c2n) break;
      v += s.val(c1, c2); break;
    }
    return v;
  };
}
const kernOf = gposKerning(tables.GPOS);

// ---- glyphs ----
const outline = (g) => {
  let o = '', px = null, py = null;
  for (const c of g.path.commands) {
    const r = (v) => Math.round(v);
    if (c.type === 'L' && r(c.x) === px && r(c.y) === py) continue; // zero-length segment (contour starts)
    if (c.x != null) { px = r(c.x); py = r(c.y); }
    if (c.type === 'M') o += `m ${r(c.x)} ${r(c.y)} `;
    else if (c.type === 'L') o += `l ${r(c.x)} ${r(c.y)} `;
    else if (c.type === 'Q') o += `q ${r(c.x)} ${r(c.y)} ${r(c.x1)} ${r(c.y1)} `;
    else if (c.type === 'C') o += `b ${r(c.x)} ${r(c.y)} ${r(c.x1)} ${r(c.y1)} ${r(c.x2)} ${r(c.y2)} `;
    else if (c.type === 'Z') o += 'z ';
  }
  return o.trim();
};
const token = (g) => { const bb = g.getBoundingBox(); return { ha: g.advanceWidth, x_min: Math.round(bb.x1), x_max: Math.round(bb.x2), o: outline(g) }; };
const cmap = font.encoding.cmap.glyphIndexMap;
const skip = (cp) => cp < 0x20 || (cp >= 0x7f && cp < 0xa0) || (cp >= 0x300 && cp < 0x370) || cp === 0x200b || cp === 0xfeff || cp === 0xad;
const codes = Object.keys(cmap).map(Number).filter((c) => !skip(c)).sort((a, b) => a - b);
const glyphs = {}, gidOf = {};
for (const cp of codes) { const ch = String.fromCodePoint(cp), gid = cmap[cp]; glyphs[ch] = token(font.glyphs.get(gid)); gidOf[ch] = gid; }
// tabular alternates by glyph name (zero.tf, comma.tf, ...)
const byName = new Map(); for (let i = 0; i < font.glyphs.length; i++) { const g = font.glyphs.get(i); if (g.name) byName.set(g.name, g); }
const tnum = {};
for (const ch of Object.keys(glyphs)) { const g = font.glyphs.get(gidOf[ch]); const alt = g.name && byName.get(g.name + '.tf'); if (alt) tnum[ch] = token(alt); }
// kerning between every pair of included characters (non-zero only)
const kern = {};
const chars = Object.keys(glyphs);
let pairs = 0;
for (const a of chars) for (const b of chars) { const v = kernOf(gidOf[a], gidOf[b]); if (v) { kern[a + b] = v; pairs++; } }

const os2 = font.tables.os2, hhea = font.tables.hhea, head = font.tables.head, post = font.tables.post;
const name = (k) => font.names?.[k]?.en || '';
const out = {
  format: 'charles-3d-explainers typeface 1 (three.js typeface JSON: glyph outlines in font units; plus kern, tnum, metrics)',
  familyName: name('fontFamily'), fullName: name('fullName'), style: name('fontSubfamily'), weight: os2.usWeightClass,
  copyright: name('copyright'), license: 'SIL Open Font License 1.1 (see the OFL-*.txt file next to this one). No Reserved Font Name.',
  source: src, converted: 'outlines, GPOS kern and *.tf alternates copied unchanged in font units; no other modification',
  unitsPerEm: font.unitsPerEm, resolution: font.unitsPerEm,
  ascender: hhea.ascender, descender: hhea.descender, lineGap: hhea.lineGap,
  capHeight: os2.sCapHeight, xHeight: os2.sxHeight,
  underlinePosition: post.underlinePosition, underlineThickness: post.underlineThickness,
  boundingBox: { xMin: head.xMin, xMax: head.xMax, yMin: head.yMin, yMax: head.yMax },
  glyphs, tnum, kern,
};
fs.writeFileSync(outFile, JSON.stringify(out));
const k2 = (s) => kern[s] ?? 0;
console.log(`${outFile}: ${chars.length} glyphs, ${Object.keys(tnum).length} tabular, ${pairs} kern pairs, ${(fs.statSync(outFile).size / 1024).toFixed(0)} KB`);
console.log('  AV', k2('AV'), 'To', k2('To'), 'Te', k2('Te'), 'LT', k2('LT'), '1,', k2('1,'), '7.', k2('7.'), 'Yo', k2('Yo'), 'dB?', k2('dB'), '0%', k2('0%'));
