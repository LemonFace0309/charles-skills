/* The reel plan's player: the reel, laid out on the edit's 1080x1920 grid (charles-claude-editing's numbers) and scaled
   to fit, playing on the plan's timeline with its music. Everything comes from window.VIDEO, which kit/build.py writes
   from the video's edit/plan.json. The music keeps the time while it plays. Tap the reel or press space to play and
   pause; the arrow keys step through the lines. */
(() => {
  const V = window.VIDEO;
  const beats = V.beats;
  const N = beats.length;
  // A clip with a transparent background ships twice (kit/build.py): HEVC with alpha for Safari and every iOS browser,
  // which are all WebKit and can't show WebM's alpha, and VP9 with alpha in WebM for the rest.
  if (/AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium|Edg|OPR|Firefox/.test(navigator.userAgent)) {
    beats.forEach((b) => { if (b.visual && b.visual.alt) b.visual.src = b.visual.alt; });
  }
  const R = V.reel;
  const HOLD = 1.2;                     // the last frame holds this long before the loop starts again
  const SAFE_TOP = 250, SAFE_BOTTOM = 1500;

  const $ = (sel, el = document) => el.querySelector(sel);
  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k === "style") Object.assign(el.style, v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
    return el;
  }
  const secs = (s) => s.toFixed(1);
  const px = (v) => `${v}px`;

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
    // TikTok's native text: each line in its own white box, stacked edge to edge (reelkit.make_hook's sizes).
    const lh = Math.round(HK.size * 1.3);
    hook.replaceChildren(...HK.lines.map((l) => h("span", { text: l, style: { fontSize: px(HK.size), lineHeight: px(lh), padding: `0 ${HK.pad}px`, borderRadius: px(Math.round(lh * 0.24)) } })));
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

  const visual = $("#visual");
  const footage = $("#footage");
  const person = $("#person");
  const cap = $("#cap");
  cap.style.fontSize = px(R.captions.size);
  $("#ig-handle").textContent = (V.post && V.post.handle) || "";
  $("#ig-caption").textContent = V.post && V.post.caption ? `${V.post.caption.split("\n")[0]} … more` : "";
  const preload = beats.filter((b) => b.visual && b.visual.type === "image").map((b) => Object.assign(new Image(), { src: b.visual.src }));

  /* ---- layouts: the five ways charles-claude-editing puts an asset on screen, plus the list reel's collage ---------- */
  function box(v) {
    const capY = R.captions.y, eye = R.eye_line;
    const zone = (z0, z1) => { const hh = Math.min(430, z1 - z0 - 60); return { x: 150, y: Math.round((z0 + z1) / 2 - hh / 2), w: 780, h: hh, fit: "contain", sticker: true }; };
    switch (v.place) {
      case "screen": return { x: 0, y: 0, w: 1080, h: 1920, fit: "cover" };
      case "split": { const seam = v.seam || 936; return v.side === "bottom" ? { x: 0, y: seam, w: 1080, h: 1920 - seam, fit: "cover", panel: true } : { x: 0, y: 0, w: 1080, h: seam, fit: "cover", panel: true }; }
      case "spotlight": return { x: 120, y: SAFE_TOP + 30, w: 840, h: capY - 90 - SAFE_TOP - 30, fit: "contain" };
      case "above": return zone(SAFE_TOP, eye);
      case "below": return zone(eye + 150, capY - 40);
      case "bottom": return zone(capY + 45, SAFE_BOTTOM);
      case "under-chin": { const [x, y, w, hh] = R.under_chin; return { x, y, w, h: hh, fit: "fill" }; }   // the collage canvas
      case "rect": return { x: v.rect[0], y: v.rect[1], w: v.rect[2], h: v.rect[3], fit: v.fit || "contain", sticker: true };
      default: throw new Error(`unknown place "${v.place}"`);
    }
  }
  const seamOf = (v) => (v && v.place === "split" ? v.seam || 936 : null);
  // His face moves into the half a split leaves him, as the edit reframes it.
  const faceShift = (v) => (!v || v.place !== "split" ? 0 : v.side === "bottom" ? (v.seam || 936) - 80 - 1110 : (v.seam || 936) + 80 - 640);

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
        visual.append(h("img", { src: v.src, alt: "" }));
      }
      visual.hidden = false;
    } else {
      clip = null;
      visual.hidden = true;
    }
    footage.classList.toggle("spotlight", !!v && v.place === "spotlight");
    footage.hidden = !!v && v.place === "screen";
    const [dx, dy, s] = jump(i);
    const end = list && i === N - 1 && b.row == null && N > 1; // a list reel's sign-off punches in 6%, as list_reel.py does; nothing else zooms
    person.style.transform = end ? `translate(-30px, ${20 + faceShift(v)}px) scale(1.06)` : `translate(${dx}px, ${dy + faceShift(v)}px) scale(${s})`;
  }

  let clip = null;                     // the line's video, if it has one: { vid, src, start, from }
  // Every clip starts loading with the page and its element is reused, so a line's card is already there when the line
  // starts instead of its slot sitting empty while it loads (the 20 design laws session saw that on a first play).
  const shelf = h("div", { hidden: true });
  document.body.append(shelf);
  const clipEls = new Map();
  beats.forEach((b) => {
    const v = b.visual;
    if (!v || v.type !== "video" || clipEls.has(v.src)) return;
    const vid = h("video", { src: v.src, muted: true, playsinline: true, preload: "auto" });
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
    const run = playing && waitingSince == null;   // still while the music is starting, as the reel is
    const off = Math.abs(vid.currentTime - want);
    if (force || off > (run ? 0.2 : 0.04)) {
      try { vid.currentTime = want; } catch { /* not seekable until its metadata loads; loadedmetadata syncs again */ }
    }
    if (run && vid.paused) vid.play().catch(() => {});
    if (!run && !vid.paused) vid.pause();
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
    if (list && list.stopwatch) {
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
  function syncAudio(force = false) {
    if (!audio) return;
    if (!playing) {
      if (!audio.paused) audio.pause();
      waitingSince = null;
      return;
    }
    const want = track.at + t;
    if (force || Math.abs(audio.currentTime - want) > 0.25) {
      try { audio.currentTime = want; } catch { /* not seekable until its metadata loads; loadedmetadata syncs again */ }
    }
    if (audio.paused) {
      waitingSince = performance.now();
      audio.play().catch(() => { waitingSince = null; });
    }
  }
  if (audio) {
    audio.preload = "auto";
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
      $(".bar").append(dot);
      audio.addEventListener("playing", () => dot.classList.add("on"));
      ["pause", "waiting", "ended", "emptied", "error"].forEach((ev) => audio.addEventListener(ev, () => dot.classList.remove("on")));
    }
  }

  function tick(ts) {
    if (!playing) return;
    const dt = lastTs == null ? 0 : Math.min(0.1, (ts - lastTs) / 1000);
    lastTs = ts;
    const heard = audio && !audio.paused && audio.readyState >= 3 ? audio.currentTime - track.at : null;
    if (heard != null && heard >= -0.05 && heard <= total + HOLD + 1) {
      t = Math.max(0, heard);          // the music keeps the time while it plays, so the two can't drift apart
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
    document.body.classList.toggle("playing", on);
    if (on) document.body.classList.add("started");
    $("#play").setAttribute("aria-label", on ? "Pause" : "Play");
    lastTs = null;
    if (on && t >= total) t = 0;       // play at the end starts it over
    syncAudio(true);
    if (on) requestAnimationFrame(tick);
  }

  function seek(time, { pause = false } = {}) {
    t = Math.max(0, Math.min(time, total));
    if (pause) setPlaying(false);
    else syncAudio(true);
    render();
  }
  const seekBeat = (i) => seek(beats[i].start + 0.01, { pause: true });

  /* ---- the play bar --------------------------------------------------------------------------------------------- */
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
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === " " && !e.target.closest("button")) { e.preventDefault(); setPlaying(!playing); }
    if (e.key === "ArrowRight" && !e.target.closest("input")) { e.preventDefault(); nextBeat(); }
    if (e.key === "ArrowLeft" && !e.target.closest("input")) { e.preventDefault(); prevBeat(); }
  });

  /* ---- start ---------------------------------------------------------------------------------------------------- */
  // ?solo&t=12.3 shows just the reel at 1080x1920, paused at that time, for exporting a frame. For checking a plan,
  // &ig=1 draws Instagram's UI over it and &safe=1 the safe area; the page itself shows neither.
  const params = new URLSearchParams(location.search);
  if (params.get("ig") === "1") $("#ig").hidden = false;
  if (params.get("safe") === "1") $("#safe").hidden = false;
  render();
  if (params.has("solo")) {
    document.body.classList.add("solo", "started");
    seek(Number(params.get("t") || 0), { pause: true });
  } else if (params.has("t")) {
    seek(Number(params.get("t")), { pause: true });
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden && playing) setPlaying(false); });
  void preload;
})();
