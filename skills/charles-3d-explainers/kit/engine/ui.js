// The type layer, drawn in the DOM over the 3D canvas in layout pixels (project.size, 1080 x 1920 for a reel).
// Every element is a pure function of time: update(t) sets its opacity, position and text for that instant.
// Defaults are the measured look (references/look.md) at 1080 x 1920. Other sizes scale them: type and x by
// u = W / 1080 (an asset is shown at reel width), y by v = H / 1920. Explicit sizes and positions are layout pixels.
import * as THREE from 'three';
import { clamp, ramp, easeFn, fmtNum, lerp, noise1 } from './util.js';

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9%$.]+/g, '').replace(/\.$/, '');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const plain = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d.textContent; };

// Enter/exit envelope shared by all elements: rise + fade + de-blur in, fade + lift out.
function envelope(t, at, until, inDur, outDur) {
  if (t < at || (until != null && t > until + outDur)) return { o: 0, y: 14, b: 6 };
  const a = at <= 0 ? 1 : ramp(t, at, at + inDur, 'outCubic'); // on frame 0 the hook is already there
  const z = until == null ? 0 : ramp(t, until, until + outDur, 'inCubic');
  return { o: a * (1 - z), y: (1 - a) * 16 - z * 10, b: (1 - a) * 6 + z * 3 };
}

// The screen box (layout px) of objects or world Box3s: the 8 corners of every visible mesh's or line's own bounding box
// (oriented with it, so a rotated wing stays tight, where one world box around a turning object balloons), or of each
// Box3. null when it is empty or a corner is behind the camera (the box would mean nothing).
const _corner = new THREE.Vector3();
function projectBox(list, project) {
  let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity, behind = false;
  const add = (bx, m) => {
    if (behind || bx.isEmpty()) return;
    for (let i = 0; i < 8; i++) {
      _corner.set(i & 1 ? bx.max.x : bx.min.x, i & 2 ? bx.max.y : bx.min.y, i & 4 ? bx.max.z : bx.min.z);
      const p = project(m ? _corner.applyMatrix4(m) : _corner);
      if (p.behind) { behind = true; return; }
      l = Math.min(l, p.x); r = Math.max(r, p.x); t = Math.min(t, p.y); b = Math.max(b, p.y);
    }
  };
  for (const o of list) {
    if (o.isBox3) { add(o, null); continue; }
    o.updateWorldMatrix(true, true);
    o.traverseVisible((m) => { // glows (sprites) and point clouds are left out: their boxes are not their silhouettes
      if (!(m.isMesh || m.isLine) || !m.geometry) return;
      const bb = m.isInstancedMesh ? (m.boundingBox || (m.computeBoundingBox(), m.boundingBox)) : (m.geometry.boundingBox || (m.geometry.computeBoundingBox(), m.geometry.boundingBox));
      add(bb, m.matrixWorld);
    });
  }
  return behind || l > r ? null : { l, r, t, b };
}

// Words: accepts ElevenLabs Scribe JSON ({words:[{text,start,end,type}]}) or a plain [{text,start,end}] list.
export function loadWords(json) {
  const list = Array.isArray(json) ? json : json.words || [];
  return list.filter((w) => !w.type || w.type === 'word').map((w) => ({ text: String(w.text).trim(), start: +w.start, end: +w.end, n: norm(w.text) })).filter((w) => w.text);
}

// Loose matching, tried when the exact words miss: a number spoken or written ("thirty thousand" = "30,000", "a million"
// = "1,000,000", "eighty percent" = "80%"), US or UK spelling (colour, cancelling, centre, optimise), accents, hyphens.
const SMALL = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ');
const TENS = 'twenty thirty forty fifty sixty seventy eighty ninety'.split(' ');
const MAG = { hundred: 100, thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12 };
const SPELL = [[/^grey$/, 'gray'], [/^aluminium$/, 'aluminum'], [/^percent$/, '%'], [/ll(ing|ed|er|ers)$/, 'l$1'],
  [/(\p{L}{2})our(s|ed|ing|ite|ites|able)?$/u, '$1or$2'], [/is(e|es|ed|ing|ation|ations)$/, 'iz$1'], [/yse(s|d)?$/, 'yze$1'],
  [/([^aeiou\d])re(s)?$/, '$1er$2'], [/ogue(s)?$/, 'og$1']];
const loose = (s) => SPELL.reduce((a, [re, to]) => a.replace(re, to), String(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}%$.]+/gu, '').replace(/\.$/, ''));
const small = (s) => (SMALL.includes(s) ? SMALL.indexOf(s) : TENS.includes(s) ? 20 + 10 * TENS.indexOf(s) : null);

// strings -> loose tokens { s, i0, i1 } (indices of the strings they came from); a spoken number becomes one token
function looseTokens(list) {
  const p = [];
  list.forEach((x, i) => String(x).split(/[-‐‑–—/]/).forEach((y) => { const s = loose(y); if (s) p.push({ s, i, stop: /[.!?;:,]$/.test(y) }); }));
  const out = [];
  for (let j = 0; j < p.length; ) {
    let total = 0, cur = 0, prev = '', k = j;
    for (; k < p.length; k++) {
      const s = p[k].s, v = small(s), m = MAG[s], nx = p[k + 1]?.s;
      if (v != null && prev !== 'unit' && !(prev === 'tens' && v >= 10)) { cur += v; prev = v < 20 ? 'unit' : 'tens'; }
      else if (m && prev) { if (m === 100) cur = (cur || 1) * 100; else { total += (cur || 1) * m; cur = 0; } prev = 'mag'; }
      else if (k === j && !p[k].stop && MAG[nx] && (s === 'a' || /^\d+(\.\d+)?$/.test(s))) { cur = s === 'a' ? 1 : +s; prev = 'num'; }
      else if (s === 'and' && prev === 'mag' && small(nx) != null) continue;
      else break;
      if (p[k].stop) { k++; break; } // a number ends with its sentence or clause
    }
    out.push(k > j ? { s: String(+(total + cur).toFixed(6)), i0: p[j].i, i1: p[k - 1].i } : { s: p[j].s, i0: p[j].i, i1: p[j].i });
    j = Math.max(k, j + 1);
  }
  return out;
}

const cache = new WeakMap(), warned = new Set();
function search(words, phrase, from, to, nth) {
  const parts = String(phrase).split(/\s+/).map(norm).filter(Boolean);
  const target = looseTokens(String(phrase).split(/\s+/)).map((x) => x.s).join('');
  let c = cache.get(words);
  if (!c) { const toks = looseTokens(words.map((w) => w.text)), first = []; toks.forEach((x, a) => { first[x.i0] ??= a; }); cache.set(words, (c = { toks, first })); }
  let seen = 0;
  for (let i = 0; i < words.length; i++) {
    if (words[i].start < from - 1e-6 || words[i].start > to) continue;
    let hit = parts.length && parts.every((p, j) => words[i + j]?.n === p) ? words.slice(i, i + parts.length) : null;
    // loose: the phrase and a run of words starting here read the same once both are normalised and joined
    for (let a = c.first[i] ?? Infinity; !hit && target && a < c.toks.length && c.toks[a].i0 === i; a++) {
      for (let b = a, s = ''; b < c.toks.length && s.length < target.length; b++) { s += c.toks[b].s; if (s === target) hit = words.slice(i, c.toks[b].i1 + 1); }
    }
    if (hit && seen++ === nth) return hit;
  }
  return null;
}

// Find a word or phrase: the word objects of its nth occurrence starting in [from, to], or null. Case and punctuation
// never matter, and each word is tried exactly, then loosely (above). Warns once when it is nowhere in the words.
export function findPhrase(words, phrase, from = -1e9, to = 1e9, nth = 0) {
  const hit = search(words, phrase, from, to, nth);
  if (!hit && words.length && !warned.has(phrase) && !search(words, phrase, -1e9, 1e9, 0)) {
    warned.add(phrase);
    console.warn(`"${phrase}" is not in the words (also tried numbers in digits and in words, and US/UK spellings)`);
  }
  return hit;
}

// A chunk is on screen from 0.06 s before its first word until 0.06 s before the next chunk, or until 0.45 s after its
// last word when the next one is 0.7 s or more away.
const capEnd = (last, next) => (next && next.start - last.end < 0.7 ? next.start - 0.06 : last.end + 0.45);

// Words a chunk never ends on: each leans on the word after it ("a | grain", "towards | Los Angeles", "can | fit").
// this, these and those lean only as determiners ("these | waves"), not as pronouns ("of these | can fit").
const LEAN = new Set(('a an the of in on at to for from with by into onto as than per via about above across after against along among around ' +
  'before behind below beneath beside between beyond during inside near outside over through toward towards under until upon within without like ' +
  'and or but so nor yet if because while when where whether although though since unless that which who whom whose what how why ' +
  'your my our their its his her this these those some any each every no another such not ' +
  'is are was were be been am will would can could should shall may might must it we they i he she').split(' '));
const DEMO = new Set(['this', 'these', 'those']);
const NUMWORD = new Set([...SMALL, ...TENS, ...Object.keys(MAG), 'hundreds', 'thousands', 'millions', 'billions', 'trillions', 'dozen']);
const bareOf = (s) => String(s ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const stopOf = (s) => (/[.!?]["'”’)]*$/.test(s) ? 2 : /[,;:—–…]["'”’)]*$/.test(s) ? 1 : 0); // 2 ends a sentence, 1 a clause
// True when a caption chunk ending on the word `text` (followed by `next`) leaves it dangling: a word in LEAN, or a
// contraction or possessive ("let's", "doesn't", "they're", "mom's"). check.mjs's `dangling` line uses it, so it flags
// exactly what the chunker avoids.
export const leans = (text, next) => {
  const b = bareOf(text);
  return !stopOf(text) && ((LEAN.has(b) && !(DEMO.has(b) && LEAN.has(bareOf(next)))) || /\p{L}['’](s|re|ve|ll|d|m)$|n['’]t$/iu.test(text));
};

// Split the voiceover into caption chunks: of all the ways to split it, the one with the lowest total cost (found exactly,
// by dynamic programming), so the rules are weighed against each other instead of patched one after another.
// - never: a highlighted phrase split (`keep`: each word of it after its first stays with the word before it)
// - only when nothing else works (100): a chunk that ends on a word that leans on the next (LEAN), a break inside a
//   capitalised run that does not start a sentence ("Los Angeles") or between a number and its word ("200,000
//   kilometers", "one hundred billion"), a chunk across a sentence end, more than maxWords + 2 words or maxChars + 10
//   characters (+ 12 with a highlight in it: two balanced lines at most)
// - strongly avoided (30 and up): a chunk on screen under minDur s; it merges with a neighbour whenever the caps allow
// - avoided: more than maxWords words (2 each) or maxChars characters (0.25 each), a comma inside (6, plus 20 when the
//   chunk starts mid-clause and 2 a word when it ends mid-clause: "On is a one, off | is a zero, and this" loses to a
//   short "On is a one,"), a pause over gap s inside, one word alone (3), an acronym cut from its noun ("GPS |
//   satellite", 3), two highlights (5), sizes far from (maxWords + 3) / 2 (so a 5-word sentence goes 3 + 2, never 4 + 1),
//   a break before "of" (1.5, it cuts a noun from its tail) or before a word that does not lean (0.6)
export function chunkWords(words, { maxWords = 4, maxChars = 24, gap = 0.32, minDur = 0.7, keep = null, marks = null, replace = null } = {}) {
  const n = words.length;
  if (!n) return [];
  const rep = replace || {};
  const shown = words.map((w) => String(rep[w.text] ?? rep[w.text.toLowerCase()] ?? rep[w.n] ?? w.text)); // what the caption prints
  const bare = words.map((w) => bareOf(w.text)), stop = words.map((w) => stopOf(w.text));
  const lean = words.map((w, i) => leans(w.text, words[i + 1]?.text));
  const num = (i) => /\d/.test(words[i].text) || NUMWORD.has(bare[i]);
  const caps = (i) => /^\p{Lu}/u.test(words[i].text);
  const bound = words.map((w, i) => i < n - 1 && !stop[i] && ((caps(i) && caps(i + 1) && i > 0 && stop[i - 1] !== 2) || (num(i) && !LEAN.has(bare[i + 1]))));
  // an acronym holds on softly to the noun after it ("GPS satellite", "AND gate")
  const acro = words.map((w, i) => i < n - 1 && !stop[i] && /^\p{Lu}[\p{Lu}\p{N}]+$/u.test(w.text.replace(/[^\p{L}\p{N}]+/gu, '')) && !LEAN.has(bare[i + 1]));
  const ideal = (maxWords + 3) / 2;
  const cost = (i, k) => { // the chunk words[i..k], and the break before it
    let c = 1, nw = 0, len = -1, hl = 0, held = false, comma = 0;
    for (let x = i; x <= k; x++) {
      if (shown[x]) { nw++; len += shown[x].length + 1; }
      if (marks?.get(words[x])?.first) hl++;
      if (x > i && keep?.has(words[x])) held = true;
      if (x === k) break;
      if (stop[x] === 1) { c += 6; comma = nw; } else if (stop[x] === 2) c += 100;
      const p = words[x + 1].start - words[x].end;
      if (p > gap) c += 1.5 + 6 * (p - gap);
    }
    // across a comma, a chunk takes whole clauses: one that starts mid-clause carries the tail of the clause before (20),
    // and one that ends mid-clause cuts the next clause after its first words (2 for each word before the comma)
    if (comma) c += (i > 0 && !stop[i - 1] ? 20 : 0) + (k < n - 1 && !stop[k] ? 2 * comma : 0);
    if (nw > 1) c += 2 * Math.max(0, nw - maxWords) + 0.25 * Math.max(0, len - maxChars) + 100 * Math.max(0, nw - maxWords - 2) + 100 * Math.max(0, len - maxChars - (held ? 12 : 10));
    c += 0.5 * (nw - ideal) ** 2 + (nw === 1 && !((i === 0 || stop[i - 1] === 2) && stop[k] === 2) ? 3 : 0) + 5 * Math.max(0, hl - 1);
    const d = capEnd(words[k], words[k + 1]) - (words[i].start - 0.06);
    if (d < minDur) c += 30 + 50 * (minDur - d);
    if (i > 0) {
      if (keep?.has(words[i])) c += 1e6;
      if (bound[i - 1]) c += 100;
      if (acro[i - 1]) c += 3;
      if (!stop[i - 1]) c += lean[i - 1] ? 100 : bare[i] === 'of' ? 1.5 : LEAN.has(bare[i]) ? 0 : 0.6;
    }
    return c;
  };
  const best = new Float64Array(n + 1).fill(Infinity), from = new Int32Array(n + 1);
  best[0] = 0;
  for (let j = 1; j <= n; j++) for (let i = j - 1; i >= Math.max(0, j - maxWords - 10); i--) {
    const c = best[i] + cost(i, j - 1);
    if (c < best[j]) { best[j] = c; from[j] = i; }
  }
  const chunks = [];
  for (let j = n; j > 0; j = from[j]) chunks.unshift(words.slice(from[j], j));
  return chunks;
}

// The ink that reads on a highlight colour: near-black on a light fill, white on a dark one (whichever contrasts more).
// null when the colour cannot be read here (the palette's ink then applies).
export function inkOn(color) {
  let c = String(color).trim();
  if (!/^(#|rgba?\()/i.test(c) && typeof document !== 'undefined') { const x = document.createElement('canvas').getContext('2d'); x.fillStyle = '#000'; x.fillStyle = c; c = String(x.fillStyle); }
  let rgb;
  const h = c.match(/^#([0-9a-f]{3,8})$/i);
  if (h) { const s = h[1].length <= 4 ? [...h[1]].map((d) => d + d).join('') : h[1]; rgb = [0, 2, 4].map((k) => parseInt(s.slice(k, k + 2), 16)); }
  else { const m = c.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i); if (!m) return null; rgb = m.slice(1, 4).map(Number); }
  const [r, g, b] = rgb.map((v) => (v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.19 ? '#121311' : '#ffffff';
}

// Caption chunks exactly as captions() shows them, and the highlighted words (word -> { style, first, color, ink }).
// Each highlight marks every occurrence unless all: false; its words after the first are kept in its chunk. sheet.mjs
// and check.mjs use it.
export function captionChunks(words, cfg = {}) {
  const marks = new Map(), keep = new Set();
  for (const h of (cfg.highlight || []).map((x) => (typeof x === 'string' ? { match: x, style: 'pill' } : x))) {
    let from = -1e9;
    const ink = h.ink || (h.color ? inkOn(h.color) : null);
    for (let n = 0; n < (h.all === false ? 1 : 99); n++) {
      const hit = findPhrase(words, h.match, from);
      if (!hit) break;
      hit.forEach((w, i) => { marks.set(w, { style: h.style || 'pill', first: i === 0, color: h.color || null, ink }); if (i) keep.add(w); });
      from = hit[hit.length - 1].start + 0.01;
    }
  }
  if (cfg.numbers) for (const w of words) if (/\d/.test(w.text) && !marks.has(w)) marks.set(w, { style: cfg.numbers, first: true });
  // a chunk whose every word `replace` turns into '' shows nothing: drop it, so no empty caption flickers or dangles
  const rep = cfg.replace || {};
  const shown = (w) => String(rep[w.text] ?? rep[w.text.toLowerCase()] ?? rep[w.n] ?? w.text).trim();
  return { chunks: chunkWords(words, { ...cfg, keep, marks }).filter((c) => c.some(shown)), marks };
}

// When each chunk is on screen, [start, end] in seconds (see capEnd). The first chunk is up from frame 0 when its first
// word starts within leadIn s (default 0.8), so the hook frame has its caption.
export function captionTimes(chunks, cfg = {}) {
  return chunks.map((c, i) => [i === 0 && c[0].start < (cfg.leadIn ?? 0.8) ? -1 : c[0].start - 0.06, capEnd(c[c.length - 1], chunks[i + 1]?.[0])]);
}

const SVG = 'http://www.w3.org/2000/svg';
const GEOM = new Set(['d', 'x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'x1', 'y1', 'x2', 'y2', 'points', 'pathLength']);

export class UI {
  constructor(root, { W = 1080, H = 1920 } = {}) {
    this.root = root; this.W = W; this.H = H;
    this.u = W / 1080; this.v = H / 1920;
    this.m = W === 1080 && H === 1920 ? 40 : Math.max(60, Math.round(40 * this.u)); // side margin: 60 px inside a slot asset (SKILL.md)
    root.style.setProperty('--u', String(this.u));
    this.layers = {};
    for (const name of ['back', 'labels', 'hero', 'title', 'hud', 'caps']) { // 'layer-hero', not 'hero': .hero styles the elements
      const d = document.createElement('div'); d.className = 'layer layer-' + name; root.appendChild(d); this.layers[name] = d;
    }
    this.svg = document.createElementNS(SVG, 'svg');
    this.svg.setAttribute('class', 'leaders'); this.svg.setAttribute('viewBox', `0 0 ${W} ${H}`); this.svg.style.width = W + 'px'; this.svg.style.height = H + 'px';
    this.layers.labels.appendChild(this.svg);
    this.items = [];
    this.caps = [];
  }

  setPalette(pal) {
    const s = this.root.style;
    s.setProperty('--accent', pal.accent); s.setProperty('--ink', pal.ink); s.setProperty('--text', pal.text); s.setProperty('--glow', pal.glow);
    if (pal.hud) s.setProperty('--hud', pal.hud);
  }

  // ---------- captions (global, from the words) ----------
  captions(words, cfg = {}) {
    if (cfg.enabled === false) return;
    const { chunks, marks } = captionChunks(words, cfg), times = captionTimes(chunks, cfg);
    const bottom = cfg.bottom ?? Math.round(450 * this.v); // px from the bottom: one line centred at y ~1430 of 1920, clear of the Reels UI
    chunks.forEach((c, i) => {
      const el = document.createElement('div'); el.className = 'cap'; el.style.bottom = bottom + 'px';
      if (cfg.size) el.style.fontSize = cfg.size + 'px';
      // group consecutive highlighted words into one span so a phrase gets one pill
      const parts = [];
      for (const w of c) {
        const m = marks.get(w);
        const last = parts[parts.length - 1];
        if (m && last && last.m && !m.first) { last.words.push(w); continue; }
        parts.push({ m, words: [w] });
      }
      const rep = cfg.replace || {};
      const show = (w) => esc(rep[w.text] ?? rep[w.text.toLowerCase()] ?? rep[w.n] ?? w.text);
      el.innerHTML = parts.map((p, j) => {
        const txt = p.words.map(show).join(' ');
        const sep = j < parts.length - 1 ? ' ' : '';
        // color: the highlight takes the colour its thing has in the world (look.md), e.g. { match: '200 ms', color: '#7fd8ff' };
        // ink: its letters on the pill (default near-black on a light colour, white on a dark one)
        const vars = (p.m?.color ? `--accent:${esc(p.m.color)};` : '') + (p.m?.ink ? `--ink:${esc(p.m.ink)};` : '');
        if (p.m) return `<span class="w hl${p.m.style === 'text' ? ' text' : ''}"${vars ? ` style="${vars}"` : ''} data-t="${p.words[0].start}" data-txt="${txt}">${txt}</span>${sep}`;
        return p.words.map((w) => `<span class="w" data-t="${w.start}">${show(w)}</span>`).join(' ') + sep;
      }).join('');
      this.layers.caps.appendChild(el);
      const [start, end] = times[i]; // the first chunk is fully up on frame 0 when the voice starts within leadIn s
      this.caps.push({ el, start, end, spans: [...el.querySelectorAll('.w')], mode: cfg.mode || 'chunk' });
    });
  }

  // ---------- element factories (t in global seconds; shots pass shot-local times through k.ui) ----------
  _add(item) { this.items.push(item); return item; }

  // style 'cond': the condensed headline (look.md): Barlow Condensed 800 capitals in the accent with a glow, a white
  // ((sub-line)) at 0.32 x; inside it {{accent}} turns white, since everything else is already the accent
  title(html, { at = 0, until = null, y = Math.round(250 * this.v), size = null, style = null, inDur = 0.45, outDur = 0.35, owner = null } = {}) {
    const cond = style === 'cond';
    if (style && !cond) console.warn(`title style "${style}" is not a style (only 'cond'): drawn in the default Inter style`);
    const el = document.createElement('div'); el.className = 'title' + (cond ? ' cond' : ''); el.style.top = y + 'px';
    if (size) el.style.fontSize = size + 'px';
    // [[word]] -> pill, {{word}} -> accent text, \n -> line, ((sub)) -> small line
    // a pill never breaks: one that crosses a line break moves whole to the start of a new line; an accent splits per line
    const src = String(html).replace(/\[\[([\s\S]+?)\]\]/g, (m, x) => (x.includes('\n') ? `\n[[${x.replace(/\s*\n\s*/g, ' ')}]]` : m)).replace(/\{\{([\s\S]+?)\}\}/g, (m, x) => x.split('\n').map((p) => `{{${p}}}`).join('\n'));
    el.innerHTML = src.split('\n').filter((ln) => ln.trim()).map((ln) => `<span class="ln">${ln
      .replace(/\[\[(.+?)\]\]/g, '<span class="pill">$1</span>').replace(/\{\{(.+?)\}\}/g, '<span class="acc">$1</span>')
      .replace(/\(\((.+?)\)\)/g, '<span class="sub">$1</span>')}</span>`).join('');
    this.layers.title.appendChild(el);
    const lines = [...el.querySelectorAll('.ln')];
    lines.forEach((ln, i) => (ln.style.zIndex = lines.length - i)); // a pill (1.25 em on a 1.0 pitch) slides under the descenders above it
    // no size: the longest headline line fills 880 px (look.md: 810 to 960) at 64 to 140 px, or 900 px at 90 to 160 px
    // condensed; measured once the fonts are in. Sub-lines are left out of the measure: the headline sets the size.
    let fitted = !!size;
    const [face, fill, lo0, hi0] = cond ? ['800 100px "Barlow Condensed"', 900, 90, 160] : ['800 100px Inter', 880, 64, 140];
    const fit = () => {
      if (fitted || !document.fonts.check(face, el.textContent)) return;
      const s = el.style, lo = lo0 * this.u, hi = Math.max(lo, hi0 * Math.min(this.u, this.v)); // a short frame lowers the cap, never below lo
      const subs = [...el.querySelectorAll('.sub')];
      subs.forEach((x) => (x.style.display = 'none'));
      s.fontSize = '100px'; s.maxWidth = 'none'; s.width = 'max-content';
      const w = el.offsetWidth; // layout px: unaffected by the draft scale
      s.maxWidth = s.width = ''; subs.forEach((x) => (x.style.display = ''));
      s.fontSize = clamp((fill * 100 * this.u) / w, lo, hi).toFixed(1) + 'px';
      fitted = true;
    };
    fit();
    return this._add({ owner, at, until, update: (t, vis) => {
      fit();
      lines.forEach((ln, i) => {
        const e = envelope(t, at > 0 ? at + i * 0.07 : at, until, inDur, outDur);
        ln.style.opacity = e.o * vis; ln.style.transform = `translateY(${e.y}px)`; ln.style.filter = e.b > 0.05 ? `blur(${e.b}px)` : 'none';
      });
    } });
  }

  // look.md, Inter 800: size = min(300, 900 / (0.6 * digits + 0.3 * separators)). Every glyph that is not a separator
  // counts as a digit, the unit at its 0.4 em, Barlow Condensed at 0.8. A short frame lowers the 300 px cap, but not
  // below a 75 px cap height (103 px).
  _heroSize(content, { count, unit, cond, at, until }) {
    let txt = '';
    if (count) {
      const f = (v) => (count.prefix || '') + fmtNum(v, { decimals: count.decimals || 0, pad: count.pad || 0, comma: count.comma !== false }) + (count.suffix || '');
      txt = (count.range || [count.from ?? 0, count.to]).map(f).sort((a, b) => b.length - a.length)[0];
    } else if (typeof content === 'function') {
      const t1 = until ?? at + 4; // longest text it shows
      for (let i = 0; i <= 8; i++) { try { const s = plain(content(lerp(at, t1, i / 8))); if (s.length > txt.length) txt = s; } catch {} }
    } else txt = plain(content);
    const em = (s) => [...String(s)].reduce((a, c) => a + (/[\s,.:;'’]/.test(c) ? 0.3 : 0.6), 0);
    const w = (em(txt) + (unit ? 0.4 * em(unit) + 0.1 : 0)) * (cond ? 0.8 : 1);
    return Math.round(Math.min(Math.max(300 * Math.min(this.u, this.v), 103 * this.u), w ? (900 * this.u) / w : Infinity));
  }

  // hero('100,000,000,000') | hero('', { count: { range: [0, 1e11] }, unit: 'km/s', sub: 'transistors' }); no size: sized by length
  hero(content, { at = 0, until = null, y = Math.round(300 * this.v), size = null, sub = null, unit = null, count = null, cond = false, color = null, inDur = 0.4, outDur = 0.3, owner = null, align = 'center', x = null } = {}) {
    const el = document.createElement('div'); el.className = 'hero' + (cond ? ' cond' : ''); el.style.top = y + 'px';
    el.style.fontSize = (size ?? this._heroSize(content, { count, unit, cond, at, until })) + 'px';
    if (color) el.style.color = color;
    if (x != null || align !== 'center') { // x: the left edge; else 40 px in from the side it is aligned to (60 in an asset)
      const m = this.m;
      Object.assign(el.style, { margin: '0', textAlign: align, left: x != null || align === 'left' ? (x ?? m) + 'px' : 'auto', right: x == null && align === 'right' ? m + 'px' : 'auto' });
    }
    const main = document.createElement('span'); el.appendChild(main);
    if (unit) { const u = document.createElement('span'); u.className = 'unit'; u.textContent = unit; el.appendChild(u); }
    if (sub) { const s = document.createElement('span'); s.className = 'sub'; s.innerHTML = sub; el.appendChild(s); }
    this.layers.hero.appendChild(el);
    const isFn = typeof content === 'function';
    if (!isFn && !count) main.innerHTML = content;
    return this._add({ owner, at, until, el, update: (t, vis) => {
      const e = envelope(t, at, until, inDur, outDur);
      el.style.opacity = e.o * vis; el.style.transform = `translateY(${e.y}px)`; el.style.filter = e.b > 0.05 ? `blur(${e.b}px)` : 'none';
      if (count) {
        const [from, to] = count.range || [count.from ?? 0, count.to];
        const d = count.dur ?? 1.1;
        const u = easeFn(count.ease || 'outExpo')(clamp((t - (count.at ?? at)) / d));
        main.textContent = (count.prefix || '') + fmtNum(lerp(from, to, u), { decimals: count.decimals || 0, pad: count.pad || 0, comma: count.comma !== false }) + (count.suffix || '');
      } else if (isFn) main.innerHTML = content(t);
    } });
  }

  // x: the right edge of the whole counter, unit included (align 'right'), or its left edge (align 'left')
  hud({ at = 0, until = null, x = null, y = Math.round(250 * this.v), align = 'right', value = () => 0, format = (v) => fmtNum(v), unit = null, sub = null, size = null, color = null, owner = null } = {}) {
    const el = document.createElement('div'); el.className = 'hud'; el.style.top = y + 'px';
    if (size) el.style.fontSize = size + 'px';
    const m = this.m;
    if (align === 'right') { el.style.right = (this.W - (x ?? this.W - m)) + 'px'; el.style.textAlign = 'right'; } else if (align === 'center') { el.style.left = '0'; el.style.right = '0'; el.style.textAlign = 'center'; } else el.style.left = (x ?? m) + 'px';
    if (color) el.style.setProperty('--hud', color);
    const main = document.createElement('span'); el.appendChild(main);
    if (unit) { const u = document.createElement('span'); u.className = 'unit'; u.textContent = unit; el.appendChild(u); }
    if (sub) { const s = document.createElement('span'); s.className = 'sub'; s.textContent = sub; el.appendChild(s); }
    this.layers.hud.appendChild(el);
    return this._add({ owner, at, until, update: (t, vis) => {
      const e = envelope(t, at, until, 0.35, 0.3);
      el.style.opacity = e.o * vis;
      main.textContent = format(value(t));
    } });
  }

  // A label pinned to a 3D anchor (Object3D, Vector3 or (t) => Vector3): a dot on the point and the text beside it.
  // offset: px from the anchor to the text's near edge (to the end of the leader line when `line` is on).
  // side ('right', 'left', 'above', 'below' or 'auto') puts the text on that side of the anchor, or of `avoid` (an
  // Object3D or a world Box3, or a list of them), whose parts' boxes are projected every frame so the text never covers
  // the object: `gap` px outside it, level with the anchor, kept 60 px inside the frame (a reel: y 200 to 1300, clear of
  // the caption band). 'auto', the default with avoid, takes the first of right, left, above that has room and covers no
  // type on screen (hero, title, HUD, text), then below; else the first with room; else the roomiest. It decides every
  // frame (overlays are pure functions of time), so the side can flip when the type around it changes. The dot stays on
  // the anchor. Without side or avoid, a text too wide for its side of the offset slides back inside the frame.
  label(text, { anchor, offset = null, side = null, avoid = null, gap = null, at = 0, until = null, sub = null, style = 'plain', size = null, owner = null, dot = true, line = false } = {}) {
    if (!(typeof anchor === 'function' || anchor?.isVector3 || anchor?.isObject3D)) throw new Error(`label "${String(text).replace(/<[^>]+>/g, '')}": anchor must be an Object3D, a Vector3 or (t) => Vector3, got ${anchor}`);
    const el = document.createElement('div'); el.className = 'lbl' + (style !== 'plain' ? ' ' + style : '');
    if (size) el.style.fontSize = size + 'px';
    el.innerHTML = text + (sub ? `<span class="sub">${sub}</span>` : '');
    this.layers.labels.appendChild(el);
    const ln = document.createElementNS(SVG, 'line');
    const dt = document.createElementNS(SVG, 'circle'); dt.setAttribute('r', (4 * this.u).toFixed(1));
    if (line) this.svg.appendChild(ln);
    if (dot) this.svg.appendChild(dt);
    const off = offset || (line ? [120, -90] : [36, -36]).map((a) => a * this.u), lgap = line ? 10 * this.u : 0;
    const v = new THREE.Vector3(), avoids = avoid ? [avoid].flat() : [];
    const placed = side || avoids.length ? (side || 'auto') : null;
    if (placed && !['right', 'left', 'above', 'below', 'auto'].includes(placed)) throw new Error(`label side "${placed}": use 'right', 'left', 'above', 'below' or 'auto'`);
    const M = Math.max(60 * this.u, this.m), reel = this.W === 1080 && this.H === 1920, top = reel ? 200 : M, floor = reel ? 1300 : this.H - M;
    return this._add({ owner, at, until, update: (t, vis, ctx) => {
      if (!ctx || !ctx.project) { el.style.opacity = 0; ln.style.opacity = 0; dt.style.opacity = 0; return; }
      const p = typeof anchor === 'function' ? anchor(t) : anchor.isVector3 ? anchor : anchor.getWorldPosition(v);
      const s = ctx.project(p);
      const a = (at <= 0 ? 1 : ramp(t, at, at + 0.35, 'outCubic')) * (until == null ? 1 : 1 - ramp(t, until, until + 0.25));
      const lineP = at <= 0 ? 1 : ramp(t, at, at + 0.3, 'outCubic');
      const w = el.offsetWidth, h = el.offsetHeight;
      let lx, ly, tx, ty;
      if (!placed) { // the offset point is the line's end; the text's nearest edge meets it, centred on it (layout px)
        tx = s.x + off[0]; ty = s.y + off[1];
        lx = off[0] >= 0 ? tx + lgap : tx - w - lgap; ly = ty - h / 2;
        // never off the side: a text too wide for its side slides back in (the line's end follows it)
        const cl = clamp(lx, this.m, this.W - this.m - w - 1); // offsetWidth is rounded: 1 px to spare
        if (cl !== lx) { tx += cl - lx; lx = cl; }
      } else {
        const b = (avoids.length && projectBox(avoids, ctx.project)) || { l: s.x, r: s.x, t: s.y, b: s.y };
        // beside a box: `gap` px out, level with the anchor; from a bare anchor: the offset's distances (36 out, 36 up)
        const near = gap ?? 30 * this.u;
        const gx = (avoids.length ? near : Math.abs(off[0])) + lgap, gy = (avoids.length ? near : Math.abs(off[1])) + lgap;
        const cx = clamp(s.x, b.l, b.r), cy = clamp(s.y, b.t, b.b) + (avoids.length ? 0 : off[1]);
        const room = { right: this.W - M - (b.r + gx + w), left: b.l - gx - w - M, above: b.t - gy - h - top, below: floor - (b.b + gy + h) };
        const spot = (k) => [clamp(k === 'right' ? b.r + gx : k === 'left' ? b.l - gx - w : cx - w / 2, M, this.W - M - w),
          clamp(k === 'above' ? b.t - gy - h : k === 'below' ? b.b + gy : cy - h / 2, top, floor - h)];
        let pick = placed;
        if (placed === 'auto') { // the first side with room whose text covers no type on screen (hero, title, HUD); 'below' only then
          const busy = this._busy(), pad = 24 * this.u;
          const clear = (k) => { const [x, y] = spot(k); return !busy.some((q) => x < q.r + pad && x + w > q.l - pad && y < q.b + pad && y + h > q.t - pad); };
          const sides = ['right', 'left', 'above'];
          pick = [...sides, 'below'].find((k) => room[k] >= 0 && clear(k)) || sides.find((k) => room[k] >= 0) || sides.sort((p, q) => room[q] - room[p])[0];
        }
        [lx, ly] = spot(pick);
        // the leader line ends lgap short of the text's near edge
        tx = pick === 'right' ? lx - lgap : pick === 'left' ? lx + w + lgap : lx + w / 2;
        ty = pick === 'above' ? ly + h + lgap : pick === 'below' ? ly - lgap : ly + h / 2;
      }
      ln.setAttribute('x1', s.x); ln.setAttribute('y1', s.y);
      ln.setAttribute('x2', lerp(s.x, tx, lineP)); ln.setAttribute('y2', lerp(s.y, ty, lineP));
      dt.setAttribute('cx', s.x); dt.setAttribute('cy', s.y);
      const o = s.behind ? 0 : a * vis;
      ln.style.opacity = o; dt.style.opacity = o;
      el.style.left = lx + 'px'; el.style.top = ly + 'px';
      const la = (at <= 0 ? 1 : ramp(t, at + 0.12, at + 0.42, 'outCubic')) * (until == null ? 1 : 1 - ramp(t, until, until + 0.25));
      el.style.opacity = s.behind ? 0 : la * vis;
      el.style.transform = `translateY(${(1 - la) * 8}px)`;
    }, late: true }); // after the other type, so side 'auto' sees where it is this frame
  }

  // The boxes (layout px) of the type on screen that a label with side 'auto' keeps off: hero, free text, doodles,
  // scale bars, HUD and title lines.
  _busy() {
    const sc = this.root.getBoundingClientRect().width / this.W || 1, out = [];
    for (const el of [...this.layers.hero.children, ...this.layers.hud.children, ...this.layers.title.querySelectorAll('.ln')]) {
      if (!(+el.style.opacity > 0.05)) continue;
      const r = el.getBoundingClientRect();
      out.push({ l: r.left / sc, r: r.right / sc, t: r.top / sc, b: r.bottom / sc });
    }
    return out;
  }

  text(html, { at = 0, until = null, x = this.W / 2, y = this.H / 2, size = Math.round(48 * this.u), weight = 700, align = 'center', cls = '', color = null, owner = null, width = Math.round(900 * this.u) } = {}) {
    const el = document.createElement('div'); el.className = 'txt ' + cls; el.innerHTML = html;
    Object.assign(el.style, { top: y + 'px', fontSize: size + 'px', fontWeight: weight, textAlign: align, width: width + 'px' });
    el.style.left = (align === 'center' ? x - width / 2 : align === 'right' ? x - width : x) + 'px';
    if (color) el.style.color = color;
    this.layers.hero.appendChild(el);
    return this._add({ owner, at, until, el, update: (t, vis) => {
      const e = envelope(t, at, until, 0.35, 0.3);
      el.style.opacity = e.o * vis; el.style.transform = `translateY(${e.y}px)`;
    } });
  }

  // A line drawing that draws itself on (abstract ideas, icons, arrows): svg markup with paths/lines/circles/rects.
  // Strokes draw in document order over `dur` seconds from `at`, warm off-white, `stroke` px wide, round caps, with a
  // slight hand-drawn wobble (fixed by `seed`, so every frame agrees; wobble: 0 for clean lines). Fills are removed.
  doodle(svg, { at = 0, until = null, dur = 0.6, x = this.W / 2, y = Math.round(760 * this.v), width = Math.round(520 * this.u), color = '#d6d5ca', stroke = 5, wobble = 1, seed = 1, owner = null, glow = true } = {}) {
    const wrap = document.createElement('div'); wrap.className = 'txt';
    wrap.style.cssText = `left:${x - width / 2}px;top:${y}px;width:${width}px;`;
    wrap.innerHTML = svg;
    this.layers.hero.appendChild(wrap); // must be in the document before lengths can be measured
    const el = wrap.querySelector('svg'); el.setAttribute('width', width); el.removeAttribute('height'); el.style.overflow = 'visible';
    if (glow) el.style.filter = `drop-shadow(0 0 10px ${color}66)`;
    const px = width / (el.viewBox.baseVal?.width || width); // screen px per svg unit
    const strokes = [...el.querySelectorAll('path, line, polyline, polygon, circle, rect, ellipse')].filter((p) => !p.closest('defs, clipPath, mask, marker, pattern, symbol')).map((p, i) => {
      if (wobble) {
        // resample as a path pushed sideways by smooth seeded noise, about 1.5 px either way in waves about 90 px long
        const L = p.getTotalLength(), n = Math.max(8, Math.ceil((L * px) / 4)), f = px / 90, a = (1.5 * wobble) / px;
        const closed = /^(polygon|circle|rect|ellipse)$/.test(p.tagName) || /z\s*$/i.test(p.getAttribute('d') || '');
        const off = (s, c) => { const o = noise1(s * f, seed * 31 + i * 2 + c); return closed && L ? lerp(o, noise1((s - L) * f, seed * 31 + i * 2 + c), s / L) : o; }; // closed: the ends meet
        let d = '';
        for (let j = 0; j <= n; j++) { const s = (L * j) / n, q = p.getPointAtLength(s); d += `${j ? 'L' : 'M'}${(q.x + a * off(s, 0)).toFixed(2)} ${(q.y + a * off(s, 1)).toFixed(2)}`; }
        if (p.tagName !== 'path') { const np = document.createElementNS(SVG, 'path'); for (const { name, value } of [...p.attributes]) if (!GEOM.has(name)) np.setAttribute(name, value); p.replaceWith(np); p = np; }
        p.setAttribute('d', d);
      }
      p.setAttribute('fill', 'none'); p.setAttribute('stroke', p.getAttribute('stroke') || color); p.setAttribute('stroke-width', p.getAttribute('stroke-width') || stroke / px); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
      return p;
    });
    const lens = strokes.map((p) => { const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; return L; });
    const total = lens.reduce((a, b) => a + b, 0) || 1;
    return this._add({ owner, at, until, update: (t, vis) => {
      const e = envelope(t, at, until, 0.15, 0.3);
      wrap.style.opacity = (until == null || t < until ? Math.min(1, e.o + 1) * (t >= at ? 1 : 0) : e.o) * vis;
      let done = easeFn('inOutSine')(clamp((t - at) / dur)) * total;
      strokes.forEach((p, i) => { const L = lens[i]; const d = clamp(done / L); p.style.strokeDashoffset = L * (1 - d); done -= L; });
    } });
  }

  // A scale bar for a zoom journey: a white bar with end ticks and its length written above it, stepping down an order of
  // magnitude on each zoom word. steps: [[t, label, px], ...] in global seconds (k.ui shifts shot-local ones); from each
  // step's t the bar eases to px wide and its label crossfades, over 0.25 s. x: the bar's centre (default 540), or with
  // align 'left' its left end (default 150: the microscope corner); y: the bar's centre line. It draws on from its first
  // step (or `at`, if later).
  scaleBar({ steps = [], x = null, y = Math.round(1200 * this.v), align = 'center', at = null, until = null, size = null, stroke = null, owner = null } = {}) {
    if (!steps.length) throw new Error('scaleBar: steps must be a list of [t, label, px], e.g. [[2.1, "1 mm", 240], [3.4, "10 µm", 240]]');
    const st = steps.map(([t, label, px]) => ({ t: +t, label: String(label), px: +px })).sort((p, q) => p.t - q.t);
    const t0 = Math.max(at ?? -Infinity, st[0].t), sw = stroke ?? 4 * this.u, ease = easeFn('outCubic');
    const el = document.createElement('div'); el.className = 'sbar txt' + (align === 'left' ? ' left' : '');
    el.innerHTML = '<div class="sb-l"><span></span><span></span></div><div class="sb-b"></div>';
    Object.assign(el.style, { left: (x ?? (align === 'left' ? Math.round(150 * this.u) : this.W / 2)) + 'px', top: y + sw / 2 + 'px' }); // the box's bottom is the bar's
    el.style.setProperty('--sw', sw + 'px');
    if (size) el.style.fontSize = size + 'px';
    const [was, now] = el.querySelectorAll('.sb-l span'), bar = el.querySelector('.sb-b');
    this.layers.hero.appendChild(el);
    return this._add({ owner, at: t0, until, el, update: (t, vis) => {
      let i = 0;
      while (i + 1 < st.length && t >= st[i + 1].t) i++;
      const p = i ? ease(clamp((t - st[i].t) / 0.25)) : 1, prev = st[Math.max(0, i - 1)];
      const draw = t0 <= 0 ? 1 : ease(clamp((t - t0) / 0.35));
      bar.style.width = (lerp(prev.px, st[i].px, p) * draw).toFixed(1) + 'px';
      if (was.textContent !== prev.label) was.textContent = prev.label;
      if (now.textContent !== st[i].label) now.textContent = st[i].label;
      // the old label lifts out as the new one rises in, like a counter's digit
      was.style.opacity = i ? 1 - p : 0; was.style.transform = `translateY(${-0.35 * p}em)`;
      now.style.opacity = p; now.style.transform = `translateY(${0.35 * (1 - p)}em)`;
      const e = envelope(t, t0, until, 0.3, 0.3);
      el.style.opacity = e.o * vis;
      el.style.transform = `translate(${align === 'left' ? 0 : -50}%, -100%) translateY(${e.y}px)`;
    } });
  }

  update(t, vis, ctxFor) {
    for (const c of this.caps) {
      const on = t >= c.start && t < c.end;
      c.el.style.display = on ? '' : 'none';
      if (!on) continue;
      c.el.style.opacity = ramp(t, c.start, c.start + 0.12, 'outCubic'); // a 0.1 s fade, no slide
      for (const s of c.spans) {
        const ws = +s.dataset.t;
        if (c.mode === 'build') s.classList.toggle('off', t < ws - 0.02);
        if (s.classList.contains('hl')) s.style.setProperty('--p', ramp(t, ws - 0.04, ws + 0.16, 'outCubic').toFixed(3)); // the pill's edge; the ink follows it
      }
    }
    for (const late of [false, true]) for (const it of this.items) { // labels last: they read where the rest of the type is
      if (!!it.late !== late) continue;
      const v = it.owner ? vis(it.owner) : 1;
      it.update(t, v, it.owner ? ctxFor(it.owner) : null);
    }
  }
}
