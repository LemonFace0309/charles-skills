/* The reel plan page. The player: the reel, laid out on the edit's 1080x1920 grid (charles-claude-editing's numbers) and
   scaled to fit, playing on the plan's timeline with its music, with a play bar (full screen at its end), the Safe area
   and Instagram UI toggles and the music under it, and nothing else around it. Beside it (under it on a phone): the script as he reads it, the caption options, every asset with its
   source and the references the video came from. Everything comes from window.VIDEO, which kit/build.py writes from the video's edit/plan.json and SCRIPT.md.
   The music keeps the time while it plays. Tap the reel or press space to play and pause, the arrow keys step through
   the lines, F goes full screen, and a script line or an asset's card jumps the reel there. */
(() => {
  const V = window.VIDEO;
  const beats = V.beats;
  const N = beats.length;
  const assets = V.assets || [];
  // A clip with a transparent background ships twice (kit/build.py): HEVC with alpha for Safari and every iOS browser,
  // which are all WebKit and can't show WebM's alpha, and VP9 with alpha in WebM for the rest.
  if (/AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium|Edg|OPR|Firefox/.test(navigator.userAgent)) {
    beats.forEach((b) => { if (b.visual && b.visual.alt) b.visual.src = b.visual.alt; });
    assets.forEach((a) => { if (a.plate && a.plate.alt) a.plate.src = a.plate.alt; });
  }
  // The media loader (below) keeps the page's own copies in memory, where a seek always works; a page opened from disk
  // has its files right there instead.
  const useMemory = location.protocol !== "file:" && typeof fetch === "function" && !!URL.createObjectURL;
  const R = V.reel;
  const HOLD = 1.2;                    // the last frame holds this long before the loop starts again
  // reel-spec.json's platform zones and text inset, which kit/build.py passes in
  const SAFE = R.safe || { top: 200, bottom: 1500, rail_x: 940, rail_y: 840, side: 60 };
  const SAFE_TOP = SAFE.top, SAFE_BOTTOM = SAFE.bottom;

  const $ = (sel, el = document) => el.querySelector(sel);
  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k === "style") Object.assign(el.style, v);
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
    return el;
  }
  const secs = (s) => s.toFixed(1);
  const px = (v) => `${v}px`;
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  for (const [family, url] of Object.entries(V.fonts || {})) {
    const face = new FontFace(family, `url(${url})`, { display: "block" });
    document.fonts.add(face);
    face.load().catch(() => {});
  }

  /* ---- the reel: fixed layers ----------------------------------------------------------------------------------- */
  const phone = $("#phone");
  const reel = $("#reel");
  new ResizeObserver(() => { reel.style.transform = `scale(${phone.clientWidth / 1080})`; }).observe(phone);

  const HK = R.hook || {};
  const title = $("#title"), sub = $("#sub"), hook = $("#hook");
  if (HK.style === "title") {
    // A list reel's fixed title and subtitle, as list_reel.py draws them.
    title.replaceChildren(...HK.lines.map((l) => h("div", { text: l })));
    Object.assign(title.style, { top: px(HK.y), fontSize: px(HK.size) });
    title.hidden = false;
    if (HK.sub) {
      sub.textContent = HK.sub;
      Object.assign(sub.style, { top: px(HK.y + HK.lines.length * Math.round(HK.size * 1.12) + HK.sub_gap), fontSize: px(HK.sub_size) });
      sub.hidden = false;
    }
  } else if (HK.lines && HK.lines.length) {
    hook.replaceChildren(drawHook(HK));
  }

  // TikTok's native text with a background, drawn as reelkit.make_hook draws it for the edit: black Helvetica Neue Bold,
  // each line in a white box sized to it, the boxes merged where they meet. The wider line's corner rounds out and the
  // narrower one flows into it with an inside curve, so two lines read as one shape (separately rounded boxes left a
  // notch at every join: "the text hook boxes aren't merging together properly", 16 Nov 2026).
  function drawHook(K) {
    const W = 1080, S = 2, size = K.size, pad = K.pad, lh = Math.round(size * 1.3), r = Math.round(lh * 0.24);
    const font = `700 ${size}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    const probe = document.createElement("canvas").getContext("2d");
    probe.font = font;
    let y = 0;
    const boxes = K.lines.map((ln) => {
      const tw = probe.measureText(ln).width;
      const b = [Math.floor((W - tw) / 2) - pad, y, Math.floor((W + tw) / 2) + pad, y + lh];
      y += lh;
      return b;
    });
    const cv = h("canvas", { width: W * S, height: y * S, style: { width: px(W), height: px(y) } });
    const c = cv.getContext("2d");
    c.scale(S, S);
    const paint = (keep, draw) => {
      c.globalCompositeOperation = keep ? "source-over" : "destination-out";
      c.fillStyle = "#fff";
      c.beginPath();
      draw();
      c.fill();
    };
    const rect = (x0, y0, x1, y1) => () => c.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    const disc = (ox, oy, rc) => () => c.arc(ox, oy, rc, 0, 2 * Math.PI);
    // the outer corner at (cx, cy) rounded; (dx, dy) points into the shape
    const convex = (cx, cy, dx, dy, rc) => {
      if (rc < 1) return;
      paint(false, rect(cx, cy, cx + dx * rc, cy + dy * rc));
      paint(true, disc(cx + dx * rc, cy + dy * rc, rc));
    };
    // the inside curve where a box's side (x = ex) meets the join y = jy; (dx, dy) points into the empty space
    const concave = (ex, jy, dx, dy, rc) => {
      if (rc < 1) return;
      paint(true, rect(ex, jy, ex + dx * rc, jy + dy * rc));
      paint(false, disc(ex + dx * rc, jy + dy * rc, rc));
    };
    boxes.forEach((b) => paint(true, rect(...b)));
    const first = boxes[0], last = boxes[boxes.length - 1];
    convex(first[0], first[1], 1, 1, r); convex(first[2], first[1], -1, 1, r);
    convex(last[0], last[3], 1, -1, r); convex(last[2], last[3], -1, -1, r);
    const joins = [];
    for (let k = 0; k + 1 < boxes.length; k += 1) {
      const a = boxes[k], b = boxes[k + 1];
      const step = Math.abs(a[0] - b[0]);                 // lines are centred, so both sides step by the same amount
      if (step < 2) continue;
      const rj = Math.min(r, step / 2), narrowTop = a[0] > b[0];
      const wide = narrowTop ? b : a, dy = narrowTop ? 1 : -1;
      convex(wide[0], b[1], 1, dy, rj); convex(wide[2], b[1], -1, dy, rj);
      joins.push([narrowTop ? a : b, b[1], rj, narrowTop ? -1 : 1]);
    }
    joins.forEach(([narrow, jy, rj, dy]) => { concave(narrow[0], jy, -1, dy, rj); concave(narrow[2], jy, 1, dy, rj); });
    c.globalCompositeOperation = "source-over";
    c.fillStyle = "#000";
    c.font = font;
    c.textAlign = "center";
    c.textBaseline = "middle";
    K.lines.forEach((ln, k) => c.fillText(ln, W / 2, (boxes[k][1] + boxes[k][3]) / 2));
    return cv;
  }

  const list = R.list;
  const rows = list ? list.rows.map((r, k) => {
    const col = Math.floor(k / list.per_col);
    const el = h("div", { class: "row", style: { left: px(list.colx[col]), top: px(list.row0 + (k % list.per_col) * list.pitch), fontSize: px(list.size) } },
      // item numbers take a full stop, as every list reel draws them ("1."); years don't ("2007")
      h("span", { class: "num ov", text: r.number < 100 ? `${r.number}.` : String(r.number), style: { width: px(list.numw - 10) } }),
      h("span", { class: "lab ov", text: r.label, style: { left: px(list.numw) } }));
    $("#list").append(el);
    return el;
  }) : [];
  const sw = $("#sw"), swOn = $("#sw-on");
  if (list && list.stopwatch) {
    Object.assign(sw.style, { left: px(list.stopwatch[0]), top: px(list.stopwatch[1]) });
    sw.hidden = false;
  }
  // A countdown to a later line (list.countdown), labelled over the plate ("Video tutorial in").
  const swLabel = $("#sw-label");
  if (list && list.stopwatch && list.countdown && list.countdown.label) {
    swLabel.textContent = list.countdown.label;
    Object.assign(swLabel.style, { left: px(list.stopwatch[0]), top: px(list.stopwatch[1] - Math.round(list.countdown.label_size * 1.35)), fontSize: px(list.countdown.label_size) });
    swLabel.hidden = false;
  }

  const visual = $("#visual");
  const footage = $("#footage");
  const person = $("#person");
  const cap = $("#cap");
  cap.style.fontSize = px(R.captions.size);
  $("#ig-handle").textContent = ((V.post && V.post.handle) || "").replace(/^@/, "");
  $("#ig-caption").textContent = V.post && V.post.caption ? `${V.post.caption.split("\n")[0]} … more` : "";

  /* ---- backdrops: what a line's layout does to everything behind its asset ----------------------------------------- */
  // charles-claude-editing's overlay with blur blurs everything behind the asset: his footage and the reel's own title,
  // list, stopwatch and hook. The page draws a backdrop as one pane (#backdrop) above all of those and under the asset
  // and the captions, so the mockup never shows a blurred face with crisp text still sitting on it. A layout takes its
  // backdrop from this table, or a visual sets its own ("backdrop": "blur"). When the editing skill's layouts change,
  // change this table, build.py's BACKDROP_BY_PLACE and, for a new kind, one rule in page.css: never a single beat.
  const BACKDROP_BY_PLACE = { spotlight: "blur" };
  const backdropOf = (v) => (v ? v.backdrop || BACKDROP_BY_PLACE[v.place] || "none" : "none");
  const backdrop = $("#backdrop");
  function setBackdrop(v) {
    const kind = backdropOf(v);
    backdrop.dataset.kind = kind;
    backdrop.hidden = kind === "none";
    visual.classList.toggle("over", kind !== "none");
  }

  /* ---- layouts: the five ways charles-claude-editing puts an asset on screen, plus the list reel's collage ---------- */
  function box(v) {
    const capY = R.captions.y, eye = R.eye_line;
    const zone = (z0, z1) => { const hh = Math.min(430, z1 - z0 - 60); return { x: 150, y: Math.round((z0 + z1) / 2 - hh / 2), w: 780, h: hh, fit: "contain", sticker: true }; };
    switch (v.place) {
      case "screen": return { x: 0, y: 0, w: 1080, h: 1920, fit: "cover" };
      case "split": { const seam = v.seam || 936; return v.side === "bottom" ? { x: 0, y: seam, w: 1080, h: 1920 - seam, fit: "cover", panel: true } : { x: 0, y: 0, w: 1080, h: seam, fit: "cover", panel: true }; }
      case "spotlight": return { x: 120, y: SAFE_TOP + 30, w: 840, h: capY - 90 - SAFE_TOP - 30, fit: "contain" };
      case "above": return zone(SAFE_TOP, eye);
      case "below": return zone(eye + (R.chin || 250), capY - 40);   // between his chin and the captions
      case "bottom": return zone(capY + 45, SAFE_BOTTOM);
      case "under-chin": { const [x, y, w, hh] = R.under_chin; return { x, y, w, h: hh, fit: "fill" }; }   // the collage canvas
      case "rect": return { x: v.rect[0], y: v.rect[1], w: v.rect[2], h: v.rect[3], fit: v.fit || "contain", sticker: true };
      default: throw new Error(`unknown place "${v.place}"`);
    }
  }
  const seamOf = (v) => (v && v.place === "split" ? v.seam || 936 : null);
  // His face sits where the plan says his eyes are: page.css draws him for eye_line 860, and build.py checks the captions
  // and assets against eye_line, so a stand-in left at 860 showed captions on his mouth whenever a plan set his eyes
  // higher. A split moves his face into the half it leaves him, as the edit reframes it.
  const eyeShift = (R.eye_line || 860) - 860;
  const faceShift = (v) => (!v || v.place !== "split" ? eyeShift : v.side === "bottom" ? (v.seam || 936) - 80 - 1110 : (v.seam || 936) + 80 - 640);

  /* ---- timeline ------------------------------------------------------------------------------------------------- */
  let t = 0;
  let playing = false;
  let lastTs = null;
  let shown = -1;
  let shownCard = null;
  const total = V.total;

  const indexAt = (time) => {
    let i = 0;
    while (i < N - 1 && time >= beats[i + 1].start) i += 1;
    return i;
  };
  // Each line is its own take, so the picture jumps a little at every cut, as hard cuts between takes do.
  const jump = (i) => [((i * 37) % 9 - 4) * 5, ((i * 53) % 7 - 3) * 5, 1 + ((i * 29) % 5 - 2) * 0.01];

  function show(i) {
    shown = i;
    const b = beats[i];
    if (rows.length) {
      const newest = beats.slice(0, i + 1).reduce((k, x) => (x.row != null ? x.row : k), -1);
      rows.forEach((row, k) => {
        row.classList.toggle("on", k <= newest);
        row.classList.toggle("new", k === newest);
      });
    }
    const v = b.visual;
    // the same clip on the next line carries on (its "from" says where that line starts in it) instead of reloading
    const same = !!(v && v.type === "video" && clip && clip.src === v.src);
    if (!same) {
      if (clip) { clip.vid.pause(); shelf.append(clip.vid); }   // back on the shelf, loaded, in case its line comes round again
      visual.replaceChildren();
    }
    if (v) {
      const bx = box(v);
      Object.assign(visual.style, { left: px(bx.x), top: px(bx.y), width: px(bx.w), height: px(bx.h) });
      visual.className = `visual fit-${bx.fit === "fill" ? "contain" : bx.fit}${bx.sticker ? " sticker" : ""}${bx.panel ? " panel" : ""}`;
      if (v.type === "video") {
        // The clip runs on the reel's clock from its line's start (syncClip), so it waits for play, pauses, seeks and
        // loops with the reel. "loop": false holds its last frame instead, for a clip timed to its line's words.
        if (same) Object.assign(clip, { start: b.start, from: v.from || 0 });
        else {
          const vid = clipEls.get(v.src);
          vid.loop = v.loop !== false;
          visual.append(vid);
          clip = { vid, src: v.src, start: b.start, from: v.from || 0 };
          syncClip(true);
        }
      } else {
        clip = null;
        // a still goes in once its file has arrived (the reel holds until then), so it never draws half-loaded
        const im = h("img", { alt: "" });
        if (ready.has(v.src) || !useMemory) im.src = want(v.src);
        else waitingImgs.set(v.src, im);
        if (!useMemory && !ready.has(v.src)) im.decode().then(() => ready.add(v.src), () => ready.add(v.src));
        visual.append(im);
      }
      visual.hidden = false;
    } else {
      clip = null;
      visual.hidden = true;
    }
    setBackdrop(v);
    footage.hidden = !!v && v.place === "screen";
    const [dx, dy, s] = jump(i);
    const end = list && i === N - 1 && b.row == null && N > 1; // a list reel's sign-off punches in 6%, as list_reel.py does; nothing else zooms
    person.style.transform = end ? `translate(-30px, ${20 + faceShift(v)}px) scale(1.06)` : `translate(${dx}px, ${dy + faceShift(v)}px) scale(${s})`;
    light(i);
  }

  let clip = null;                     // the line's video, if it has one: { vid, src, start, from }
  let buffering = false;               // the reel holding still for a file it shows (the media loader, below)
  // One element per clip, reused, so a line's clip is there when the line starts instead of its slot sitting empty
  // (the 20 design laws session saw that on a first play). The media loader gives each its file, in the reel's order.
  const shelf = h("div", { hidden: true });
  document.body.append(shelf);
  const clipEls = new Map();
  beats.forEach((b) => {
    const v = b.visual;
    if (!v || v.type !== "video" || clipEls.has(v.src)) return;
    const vid = h("video", { muted: true, playsinline: true, preload: "none" });
    vid.muted = true;
    vid.addEventListener("loadedmetadata", () => { if (clip && clip.vid === vid) syncClip(true); });
    shelf.append(vid);
    clipEls.set(v.src, vid);
  });
  function syncClip(force = false) {
    if (!clip) return;
    const { vid, start, from } = clip;
    const d = vid.duration;
    let want = Math.max(0, t - start + from);
    if (Number.isFinite(d) && d > 0) want = vid.loop ? want % d : Math.min(want, Math.max(0, d - 0.04));
    const run = playing && !buffering && waitingSince == null;   // still while the music starts or a file loads
    const off = Math.abs(vid.currentTime - want);
    // Seek only when the frame is clearly off, never on top of a seek still under way, and while it plays at most once
    // a second. Seeking a clip on every frame while it was still arriving restarted its download each time, so on a
    // computer without the files it never caught up (913 seeks in 22 s and frames 6 s off, 18 Nov 2026).
    const now = performance.now();
    if (vid.readyState >= 1 && !vid.seeking && off > (run && !force ? 0.25 : 0.05)
        && (!run || force || now - (vid.seekAt || 0) > 1000)) {
      vid.seekAt = now;
      try { vid.currentTime = want; } catch { /* not seekable until its metadata loads; loadedmetadata syncs again */ }
    }
    if (run && vid.paused && vid.readyState >= 3) vid.play().catch(() => {});
    if (!run && !vid.paused) vid.pause();
  }
  // The next line's clip waits on its first frame a second before its cut, so the cut lands on a frame that's already
  // decoded instead of a black one while it seeks.
  function prime(i) {
    const nx = beats[i + 1];
    const v = nx && nx.visual;
    if (!v || v.type !== "video" || nx.start - t > 1.2 || (clip && clip.src === v.src)) return;
    const vid = clipEls.get(v.src);
    if (!vid || vid.readyState < 1 || vid.seeking || vid.primed === i + 1) return;
    vid.primed = i + 1;
    if (!vid.paused) vid.pause();
    try { vid.currentTime = v.from || 0; } catch { /* its metadata isn't in yet */ }
  }

  function showCaption(b) {
    const card = b.cards.find((c) => t >= c.start && t < c.end) || null;
    if (card === shownCard) return;
    shownCard = card;
    if (!card) { cap.hidden = true; return; }
    cap.replaceChildren(...card.lines.map((l) => h("div", { text: l })));
    const seam = seamOf(b.visual);
    const y = seam != null ? seam : b.caption_y || R.captions.y;
    cap.style.top = px(y - (card.lines.length * R.captions.size * 1.12) / 2);
    cap.hidden = false;
  }

  function render() {
    const i = indexAt(t);
    if (i !== shown) show(i);
    syncClip();
    if (playing) prime(i);
    showCaption(beats[i]);
    // The hook: a list reel's title stays up; a TikTok hook stays for his first sentence, on the seam if it opens on a split.
    if (HK.style !== "title" && HK.lines && HK.lines.length) {
      const up = HK.until == null || t < HK.until;
      if (up && hook.hidden) {
        const seam = seamOf(beats[0].visual);
        hook.style.top = seam != null ? px(seam - (HK.lines.length * Math.round(HK.size * 1.3)) / 2) : px(HK.y);
      }
      hook.hidden = !up;
    }
    if (list && list.hide_from != null) {
      const gone = t >= list.hide_from;
      $("#list").hidden = gone; title.hidden = gone || HK.style !== "title"; sub.hidden = gone || !HK.sub; sw.hidden = gone;
      swLabel.hidden = gone || !(list.countdown && list.countdown.label);
    }
    if (list && list.stopwatch && list.countdown) {
      const cs = Math.ceil(Math.max(0, list.countdown.to - t) * 100 - 1e-6);
      swOn.textContent = `${String(Math.floor(cs / 100)).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
    } else if (list && list.stopwatch) {
      const cs = Math.floor(Math.min(t, list.stop_at) * 100 + 1e-6);
      swOn.textContent = `${String(Math.floor(cs / 100)).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
    }
    $("#t-now").textContent = secs(Math.min(t, total));
    const frac = Math.min(t, total) / total;
    fill.style.width = `${frac * 100}%`;
    head.style.left = `${frac * 100}%`;
    scrub.value = String(Math.min(t, total));
  }

  /* ---- music ---------------------------------------------------------------------------------------------------- */
  // A browser only starts sound from a tap or a key press, so the reel waits on its first frame until play is pressed.
  const track = V.music && V.music.tracks && V.music.tracks[0];
  const audio = track ? new Audio() : null;
  let waitingSince = null;             // when play asked the music to start; the reel holds still up to 1.5 s for it
  let musicCopy = null;                // the music in memory (the media loader), which can always seek
  let musicSeekAt = 0;
  let musicRetries = 0;
  // A host that can't serve byte ranges makes the browser start a file over from 0 when it's asked to seek, and play
  // after a pause always seeked the music, even to where it already was: "every time I click pause and then play
  // again, it restarted the video from the start" (18 Nov 2026). So the music seeks only when it's somewhere else, and
  // once its copy in memory has arrived, every seek is made on that.
  function syncAudio(force = false) {
    if (!audio) return;
    if (!playing) {
      if (!audio.paused) audio.pause();
      waitingSince = null;
      useMusicCopy();                  // a pause is when the copy in memory can go in without a gap
      return;
    }
    const want = track.at + t;
    if (Math.abs(audio.currentTime - want) > (force ? 0.08 : 0.25)) {
      if (musicCopy && audio.src !== musicCopy) { audio.pause(); useMusicCopy(); return; }   // loadedmetadata syncs it
      musicSeekAt = performance.now();
      try { audio.currentTime = want; } catch { /* not seekable until its metadata loads; loadedmetadata syncs again */ }
    }
    if (audio.paused) {
      waitingSince = performance.now();
      audio.play().catch(() => { waitingSince = null; });
    }
  }
  function useMusicCopy() {
    if (!musicCopy || audio.src === musicCopy || !audio.paused) return;
    audio.preload = "auto";
    audio.src = musicCopy;             // its loadedmetadata puts it where the reel is
  }
  if (audio) {
    audio.preload = useMemory ? "none" : "auto";   // in memory, the media loader fetches it once
    audio.hidden = true;
    document.body.append(audio);       // in the page, so its state can be read while checking it
    audio.src = track.src;
    audio.addEventListener("loadedmetadata", () => syncAudio(true));
    audio.addEventListener("playing", () => { waitingSince = null; });
    audio.addEventListener("error", () => { waitingSince = null; });
    // #check on the link adds a dot that turns orange only while the music is actually playing: nothing outside a
    // published page can see into its frame, so this is how a session proves the music works. Viewers never see it.
    if (location.hash === "#check") {
      const dot = h("span", { class: "heard-dot", title: "music" });
      $("#full").before(dot);          // before full screen, so the button stays where it always is
      audio.addEventListener("playing", () => dot.classList.add("on"));
      ["pause", "waiting", "ended", "emptied", "error"].forEach((ev) => audio.addEventListener(ev, () => dot.classList.remove("on")));
    }
  }

  /* ---- media: the files the reel shows, in its order, into memory ------------------------------------------------ */
  // On a computer that had never opened the page nothing was cached, and the reel's clock (the music's) didn't wait:
  // every clip and still started downloading at once, a clip that wasn't in yet at its line showed a stale or black
  // frame, and the music came in seconds late ("transitions don't work properly or the a-roll/b-roll doesn't load
  // properly", 18 Nov 2026). Now the music loads first, then each line's clip or still in the order the reel shows them,
  // two at a time and into memory (a blob: URL, where a seek is instant), with the line the reel is on always next. The
  // reel holds still, with a spinner, while what it shows hasn't arrived. Opened from disk, the files go straight in.
  const kindOf = new Map();            // each file the reel shows -> "image" or "video", in the order it shows them
  beats.forEach((b) => { const v = b.visual; if (v && v.src && !kindOf.has(v.src)) kindOf.set(v.src, v.type); });
  const mem = new Map();               // a file -> its copy in memory
  const ready = new Set();             // stills decoded, ready to draw
  const waitingImgs = new Map();       // a still a line shows before its file arrived
  const want = (src) => mem.get(src) || src;
  const loadingText = $("#loading-text");
  // #check also shows how many of the reel's files, the music included, came into memory: all of them means the host
  // let the page hold its own copies, and fewer means some play from the network (a frame that refuses blob:)
  const memNote = location.hash === "#check" && useMemory ? h("span", { class: "mem-note", title: "files in memory" }) : null;
  if (memNote) $("#full").before(memNote);
  const noteMem = () => {
    if (memNote) memNote.textContent = `${mem.size + (musicCopy ? 1 : 0)}/${kindOf.size + (audio ? 1 : 0)}`;
  };
  let holdSince = null;
  let audioBroken = false;
  if (audio) {
    audio.addEventListener("error", () => {
      if (audio.src.startsWith("blob:")) {   // a frame that refuses blob: plays the network copy
        musicCopy = null;
        noteMem();
        audio.preload = "auto";
        audio.src = track.src;
        return;
      }
      audioBroken = true;
    });
  }
  const musicReady = () => !audio || audioBroken || audio.readyState >= 3;
  function readyAt(time) {
    const v = beats[indexAt(time)].visual;
    if (!v || !v.src) return true;
    if (v.type !== "video") return ready.has(v.src);
    const vid = clipEls.get(v.src);
    return !vid || vid.failed === true || (vid.readyState >= 3 && !vid.seeking);
  }
  function setBuffering(on) {
    if (on === buffering) return;
    buffering = on;
    document.body.classList.toggle("buffering", on);
    if (on) {
      if (audio && !audio.paused) audio.pause();
      if (clip && !clip.vid.paused) clip.vid.pause();
    } else {
      lastTs = null;
      syncAudio(true);
      syncClip(true);
    }
  }
  function giveClip(src, url) {
    const vid = clipEls.get(src);
    vid.addEventListener("error", () => {
      if (vid.src.startsWith("blob:")) { mem.delete(src); noteMem(); vid.src = src; vid.load(); }   // a frame that refuses blob:
      else vid.failed = true;                                                                      // broken: never hold the reel for it
    });
    vid.preload = "auto";
    vid.src = url;
    vid.load();
  }
  async function stillIn(src, url) {
    const im = new Image();
    im.src = url;
    try { await im.decode(); } catch {
      if (url !== src) { mem.delete(src); noteMem(); const im2 = new Image(); im2.src = src; await im2.decode().catch(() => {}); }
    }
    ready.add(src);
    const el = waitingImgs.get(src);
    if (el) { el.src = want(src); waitingImgs.delete(src); }
  }
  const queue = [...kindOf.keys()];
  let arrived = 0;
  function nextFile() {
    if (!queue.length) return null;
    const from = Math.max(0, shown);
    const k = queue.findIndex((src) => beats.slice(from).some((b) => b.visual && b.visual.src === src));
    return queue.splice(k < 0 ? 0 : k, 1)[0];
  }
  async function fetchIn(src) {
    let url = src;
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error(String(res.status));
      url = URL.createObjectURL(await res.blob());
      mem.set(src, url);
    } catch { /* the network copy instead */ }
    noteMem();
    if (kindOf.get(src) === "video") giveClip(src, url);
    else await stillIn(src, url);
    arrived += 1;
    loadingText.textContent = arrived < kindOf.size ? `Loading ${arrived + 1} of ${kindOf.size}` : "Loading";
  }
  // The music comes first, into memory, and goes in as soon as the reel isn't playing. The reel's files wait for it,
  // up to 4 s.
  const musicFetched = !audio ? Promise.resolve()
    : !useMemory ? new Promise((resolve) => { ["canplaythrough", "error"].forEach((ev) => audio.addEventListener(ev, resolve, { once: true })); })
    : fetch(track.src).then((res) => { if (!res.ok) throw new Error(String(res.status)); return res.blob(); })
      .then((blob) => { musicCopy = URL.createObjectURL(blob); noteMem(); useMusicCopy(); })
      .catch(() => { audio.preload = "auto"; });
  const musicIn = Promise.race([musicFetched, new Promise((resolve) => { setTimeout(resolve, 4000); })]);
  async function worker(first) {
    if (!first) await musicIn;
    for (let src = nextFile(); src; src = nextFile()) {
      await fetchIn(src);
      await musicIn;                   // past the first file, the music goes before the rest
    }
  }
  // The sections' thumbnails wait for the reel's own files, so they don't take the connection the music needs
  let reelIn;
  const allIn = new Promise((resolve) => { reelIn = resolve; });
  const afterReel = (fn) => { allIn.then(fn); };
  if (useMemory) {
    loadingText.textContent = `Loading 1 of ${kindOf.size}`;
    Promise.all([worker(true), worker(false)]).then(reelIn, reelIn);
    setTimeout(reelIn, 15000);
  } else {
    kindOf.forEach((kind, src) => (kind === "video" ? giveClip(src, src) : stillIn(src, src)));
    reelIn();
  }

  function tick(ts) {
    if (!playing) return;
    const dt = lastTs == null ? 0 : Math.min(0.1, (ts - lastTs) / 1000);
    lastTs = ts;
    // Hold the reel, music and all, while what it shows now hasn't arrived. A gap under 150 ms (a clip settling after
    // its cut) doesn't stop the music; anything longer pauses both, and the spinner shows after 300 ms more.
    const need = !readyAt(t) || !musicReady();
    holdSince = need ? holdSince ?? ts : null;
    if (need && ts - holdSince > 150) setBuffering(true);
    else if (!need && buffering) setBuffering(false);
    if (buffering) {
      render();
      requestAnimationFrame(tick);
      return;
    }
    const heard = audio && !audio.paused && audio.readyState >= 3 ? audio.currentTime - track.at : null;
    if (heard != null && heard >= -0.05 && heard <= total + HOLD + 1) {
      // The music keeps the time while it plays, so the two can't drift apart. A restart that lands a touch early (an
      // MP3 seek isn't exact) slows the reel for a moment instead of sending it back a few frames.
      const gap = heard - t;
      if (gap < -0.4) {
        // The music is far behind the reel: a seek it didn't take started it over. The reel keeps its place, and the
        // music is sent back to it at most once a second, instead of the reel going back to the start with it.
        // Twice at most: on a host that can't seek and no copy in memory, each try would start the music over again.
        t += dt;
        if (musicRetries < 2 && performance.now() - musicSeekAt > 1000) { musicRetries += 1; syncAudio(true); }
      } else {
        musicRetries = 0;
        t = gap < 0 ? t + dt * 0.5 : heard;
      }
    } else if (!(waitingSince != null && ts - waitingSince < 1500)) {
      t += dt;
    }
    if (t >= total + HOLD) {
      t = 0;
      syncAudio(true);
    }
    render();
    requestAnimationFrame(tick);
  }

  function setPlaying(on) {
    playing = on;
    if (!on && buffering) { buffering = false; document.body.classList.remove("buffering"); }
    holdSince = null;
    document.body.classList.toggle("playing", on);
    if (on) document.body.classList.add("started");
    $("#play").setAttribute("aria-label", on ? "Pause" : "Play");
    lastTs = null;
    if (on && t >= total) t = 0;       // play at the end starts it over
    syncAudio(true);
    syncClip();                        // a clip stops with the reel (the 3D film ran on under a paused clock)
    if (on) requestAnimationFrame(tick);
  }

  function seek(time, { pause = false } = {}) {
    t = Math.max(0, Math.min(time, total));
    if (pause) setPlaying(false);
    else syncAudio(true);
    render();
  }
  // A jump lands a little into its line, so a card that builds in from blank has built (the design laws session saw empty
  // cards when it jumped while paused).
  const into = (i) => beats[i].start + Math.min(0.6, beats[i].dur * 0.45);
  const seekBeat = (i) => seek(into(i), { pause: true });

  /* ---- the play bar, full screen, the toggles and the music ------------------------------------------------------ */
  $("#t-total").textContent = `${secs(total)} s`;
  const scrub = $("#scrub");
  scrub.max = String(total);
  const fill = h("span", { class: "fill" });
  $("#track").append(fill);
  const head = h("span", { class: "head" });
  $(".scrub").append(head);

  $("#play").addEventListener("click", () => setPlaying(!playing));
  $("#big-play").addEventListener("click", (e) => { e.stopPropagation(); seek(0); setPlaying(true); });
  phone.addEventListener("click", () => setPlaying(!playing)); // tap the reel to pause, as on Instagram
  function prevBeat() {
    const i = indexAt(t);
    seekBeat(t - beats[i].start > 0.4 ? i : Math.max(0, i - 1));
  }
  const nextBeat = () => seekBeat(Math.min(N - 1, indexAt(t) + 1));
  scrub.addEventListener("input", () => seek(Number(scrub.value)));
  // the hatched safe area (what Instagram's header, caption and buttons cover, and the side margins) and Instagram's UI
  const optSafe = $("#opt-safe"), optIg = $("#opt-ig");
  {   // the Safe area toggle draws the same zones the build checks against
    const s = $("#safe");
    const set = (sel, st) => { const el = $(sel, s); if (el) Object.assign(el.style, st); };
    set(".safe-top", { height: px(SAFE.top) });
    set(".safe-bottom", { top: px(SAFE.bottom) });
    set(".safe-right", { left: px(SAFE.rail_x), top: px(SAFE.rail_y), height: px(SAFE.bottom - SAFE.rail_y) });
    s.querySelectorAll(".safe-margin").forEach((m) => Object.assign(m.style, { top: px(SAFE.top), height: px(SAFE.bottom - SAFE.top) }));
    set(".safe-margin-l", { left: px(SAFE.side) });
    set(".safe-margin-r", { left: px(1080 - SAFE.side - 2) });
  }
  optSafe.addEventListener("change", () => { $("#safe").hidden = !optSafe.checked; });
  optIg.addEventListener("change", () => { $("#ig").hidden = !optIg.checked; });

  // Full screen: the browser's own where the page may use it, and otherwise the player filling the page's window, which
  // is all an iPhone allows (it only puts a bare <video> full screen).
  const stage = $("#player"), fullBtn = $("#full");
  let realFull = false;
  function setFull(on) {
    stage.classList.toggle("full", on);
    document.body.classList.toggle("full-open", on);
    fullBtn.setAttribute("aria-pressed", String(on));
    fullBtn.setAttribute("aria-label", on ? "Exit full screen" : "Full screen");
  }
  async function toggleFull() {
    if (!stage.classList.contains("full")) {
      setFull(true);
      if (document.fullscreenEnabled && stage.requestFullscreen) {
        try { await stage.requestFullscreen({ navigationUI: "hide" }); realFull = true; } catch { /* the frame doesn't allow it */ }
      }
    } else {
      if (document.fullscreenElement) { try { await document.exitFullscreen(); } catch { /* already out */ } }
      realFull = false;
      setFull(false);
    }
  }
  fullBtn.addEventListener("click", toggleFull);
  document.addEventListener("fullscreenchange", () => {      // Esc out of the browser's full screen
    if (!document.fullscreenElement && realFull) { realFull = false; setFull(false); }
  });

  if (track) {
    const by = track.artist ? ` by ${track.artist}` : "";
    $("#music-line").append(h("span", { class: "mark", text: "Music" }), `${track.title}${by}, from ${mmss(track.from || 0)}`);
    $("#music-line").hidden = false;
  }

  /* ---- the sections: script, caption, assets --------------------------------------------------------------------- */
  $("#page-title").textContent = V.title;
  // what lights up while a line plays: its script lines and its asset's card
  const lit = new Map();
  const tie = (el, i) => { if (!lit.has(i)) lit.set(i, []); lit.get(i).push(el); };
  let litNow = [];
  function light(i) {
    litNow.forEach((el) => el.classList.remove("current"));
    litNow = lit.get(i) || [];
    litNow.forEach((el) => el.classList.add("current"));
  }
  // A script line or a card shows its moment in the reel, playing on if it was playing. On a phone the reel is up the
  // page, so it scrolls back to it.
  const narrow = matchMedia("(max-width: 980px)");
  function jumpTo(i) {
    document.body.classList.add("started");
    seek(into(i));
    if (narrow.matches) $("#player").scrollIntoView({ block: "start" });
  }
  const hideSection = (id) => {
    $(`#${id}`).hidden = true;
    const a = $(`.jump a[href="#${id}"]`);
    if (a) a.hidden = true;
  };

  // Copy puts the text on the clipboard (the script with its bold title, for his notes); where the frame blocks the
  // clipboard, it selects the text instead.
  async function copy(btn, target, plain, html) {
    try {
      if (html && window.ClipboardItem && navigator.clipboard.write) {
        await navigator.clipboard.write([new ClipboardItem({
          "text/plain": new Blob([plain], { type: "text/plain" }), "text/html": new Blob([html], { type: "text/html" }) })]);
      } else {
        await navigator.clipboard.writeText(plain);
      }
      btn.textContent = "Copied";
    } catch {
      const range = document.createRange();
      range.selectNodeContents(target);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
      btn.textContent = "Selected";
    }
    setTimeout(() => { btn.textContent = "Copy"; }, 1600);
  }

  // The script: SCRIPT.md line for line, as his notes lay it out (a bold title, "Text hook:", the lines he says).
  const S = V.script || [];
  const scriptBox = $("#script-lines");
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const plain = [], rich = [];
  S.forEach((ln) => {
    const t0 = ln.text.trim();
    const bold = /^\*\*(.+)\*\*$/.exec(t0);
    const ital = !bold && /^\*([^*].*)\*$/.exec(t0);
    const text = bold ? bold[1] : ital ? ital[1] : t0.replace(/\*\*(.+?)\*\*/g, "$1");
    plain.push(text);
    rich.push(`<div>${!t0 ? "<br>" : bold ? `<b>${esc(text)}</b>` : ital ? `<i>${esc(text)}</i>` : esc(text)}</div>`);
    if (!t0) { scriptBox.append(h("div", { class: "gap" })); return; }
    const el = h("p", { class: bold ? "s-title" : ital ? "s-label" : "s-line", text });
    if (ln.i != null) {
      el.classList.add("seekable");
      el.addEventListener("click", () => jumpTo(ln.i));
      for (let k = ln.i; k <= (ln.last ?? ln.i); k += 1) tie(el, k);   // lit through every beat of its sentence
    }
    scriptBox.append(el);
  });
  if (S.length) $("#copy-script").addEventListener("click", (e) => copy(e.currentTarget, scriptBox, plain.join("\n"), rich.join("")));
  else hideSection("script");

  // The caption options, each ready to paste.
  const P = V.post || {};
  const options = [["Caption", P.caption], ["Shorter alternative", P.caption_alt],
    ...(P.options || []).map((o) => [o.label, o.text]), ["First comment", P.comment]].filter(([, text]) => text);
  options.forEach(([label, text]) => {
    const pre = h("pre", { text });
    const btn = h("button", { class: "copy", type: "button", text: "Copy" });
    btn.addEventListener("click", () => copy(btn, pre, text));
    $("#captions").append(h("div", { class: "capbox" }, h("div", { class: "capbox-head" }, h("span", { text: label }), btn), pre));
  });
  if (!options.length) hideSection("caption");

  // The assets, in the order the reel shows them. Sources are web pages or paths in the repository; a published copy
  // has no repository next to it, so there only web pages are links.
  const hrefFor = (link) => (/^https?:/.test(link || "") ? link : V.site ? null : link || null);
  // sources.json's codes (references/sourcing.md) as the names he'd say
  const SOURCES = { wayback: "Wayback Machine", "live-capture": "Live site", commons: "Wikimedia Commons", enwiki: "Wikipedia",
    press: "Press image", own: "Own capture", other: "Source", "x-post": "X post" };
  const sourceName = (s) => SOURCES[s] || (s ? s[0].toUpperCase() + s.slice(1).replace(/-/g, " ") : "");
  const metaOf = (m) => {
    if (!m) return [];
    const href = hrefFor(m.link);
    const parts = [];
    const name = sourceName(m.source);
    if (name || href) parts.push(href ? h("a", { href, target: "_blank", rel: "noopener", text: name || "Source" }) : name);
    if (m.license) parts.push(m.license);
    return parts.flatMap((x, k) => (k ? [" · ", x] : [x]));
  };
  const viewer = $("#viewer");
  function view(item) {
    const media = $(".v-media", viewer);
    if (item.video) {
      const vid = h("video", { src: item.src, poster: item.poster || null, muted: true, autoplay: true, loop: true, playsinline: true });
      vid.muted = true;
      media.replaceChildren(vid);
      vid.play().catch(() => {});
    } else {
      media.replaceChildren(h("img", { src: item.src, alt: item.what || "" }));
    }
    $(".v-what", viewer).textContent = item.what || "";
    $(".v-meta", viewer).replaceChildren(...metaOf(item.meta));
    viewer.showModal();
  }
  viewer.addEventListener("click", (e) => { if (!e.target.closest("a")) viewer.close(); });
  viewer.addEventListener("close", () => { $(".v-media", viewer).replaceChildren(); });

  assets.forEach((a) => {
    const p = a.plate;
    const plate = p
      ? h("button", {
        class: "plate", type: "button", "aria-label": `See ${a.title} full size`,
        style: { aspectRatio: String(Math.min(2, Math.max(0.75, p.aspect || 1.6))) },
        onclick: (e) => { e.stopPropagation(); view({ src: p.src, video: p.type === "video", poster: p.poster, what: a.title, meta: a.meta }); },
      }, p.type === "video" && !p.poster
        ? (() => { const pv = h("video", { muted: true, playsinline: true, preload: "metadata" }); afterReel(() => { pv.src = p.src; }); return pv; })()
        : h("img", { src: p.type === "video" ? p.poster : p.src, alt: "", loading: "lazy" }))
      : h("div", { class: "plate pending" }, h("span", { text: "Pending" }));
    const mark = a.number != null ? (a.number < 100 ? `${a.number}.` : String(a.number)) : mmss(a.start);
    const pieces = (a.pieces || []).map((im) => {
      const thumb = h("button", {
        class: "thumb", type: "button", "aria-label": `See ${im.what || "this image"} full size`,
        onclick: (e) => { e.stopPropagation(); view({ src: im.large || im.src, video: im.video, what: im.what, meta: im }); },
      });
      afterReel(() => { thumb.style.backgroundImage = `url("${im.thumb || im.src}")`; });
      return h("li", { class: im.used ? null : "spare" }, thumb,
        h("span", {}, h("span", { class: "p-what", text: im.what || im.src.split("/").pop() }),
          h("span", { class: "p-meta meta" }, im.used ? null : "Spare · ", ...metaOf(im))));
    });
    const card = h("article", { class: "card", onclick: (e) => { if (!e.target.closest("a, button")) jumpTo(a.beats[0]); } },
      plate,
      h("h3", {}, h("span", { class: "mark", text: mark }), a.title),
      a.what && a.what !== a.title ? h("p", { class: "what", text: a.what }) : null,
      a.meta && (a.meta.source || a.meta.license) ? h("p", { class: "meta" }, ...metaOf(a.meta)) : null,
      pieces.length ? h("ul", { class: "pieces" }, pieces) : null);
    a.beats.forEach((i) => tie(card, i));
    $("#cards").append(card);
  });
  if (!assets.length) hideSection("assets");

  // The references: the posts, reels and pages the video came from, each with what it gave this one. A still of one
  // opens full size; on the local page, one of our own videos links to its folder.
  const refs = V.references || [];
  refs.forEach((r) => {
    const href = hrefFor(r.url) || hrefFor(r.local);
    const face = r.thumb || r.image
      ? h("button", {
        class: "ref-face ref-still", type: "button", "aria-label": `See ${r.title} full size`,
        onclick: () => view({ src: r.image, what: r.title, meta: r.url ? { source: r.kind, link: r.url } : null }),
      })
      : h("span", { class: "ref-face", "aria-hidden": "true", text: r.badge || "" });
    if (r.thumb || r.image) afterReel(() => { face.style.backgroundImage = `url("${r.thumb || r.image}")`; });
    $("#ref-list").append(h("li", { class: "ref" }, face,
      h("div", { class: "ref-text" },
        h("p", { class: "ref-kind meta", text: [r.kind, r.by].filter(Boolean).join(" · ") }),
        h("p", { class: "ref-title" }, href ? h("a", { href, target: "_blank", rel: "noopener", text: r.title }) : r.title),
        r.why ? h("p", { class: "ref-why", text: r.why }) : null,
        r.stats || r.folder ? h("p", { class: "ref-stats meta", text: [r.stats, r.folder].filter(Boolean).join(" · ") }) : null)));
  });
  if (!refs.length) hideSection("refs");

  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || viewer.open) return;
    if (e.key === "Escape" && stage.classList.contains("full") && !document.fullscreenElement) setFull(false);
    if ((e.key === "f" || e.key === "F") && !e.target.closest("input")) { e.preventDefault(); toggleFull(); }
    if (e.key === " " && !e.target.closest("button, a, input")) { e.preventDefault(); setPlaying(!playing); }
    if (e.key === "ArrowRight" && !e.target.closest("input")) { e.preventDefault(); nextBeat(); }
    if (e.key === "ArrowLeft" && !e.target.closest("input")) { e.preventDefault(); prevBeat(); }
  });

  /* ---- start ---------------------------------------------------------------------------------------------------- */
  // ?solo&t=12.3 shows just the reel at 1080x1920, paused at that time, for exporting a frame. &ig=1 and &safe=1 turn
  // the Instagram UI and the safe area on, for frame checks.
  const params = new URLSearchParams(location.search);
  if (params.get("ig") === "1") { optIg.checked = true; $("#ig").hidden = false; }
  if (params.get("safe") === "1") { optSafe.checked = true; $("#safe").hidden = false; }
  render();
  if (params.has("solo")) {
    document.body.classList.add("solo", "started");
    seek(Number(params.get("t") || 0), { pause: true });
  } else if (params.has("t")) {
    seek(Number(params.get("t")), { pause: true });
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden && playing) setPlaying(false); });
})();
