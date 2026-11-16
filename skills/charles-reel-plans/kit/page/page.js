/* The reel plan page: a moving mockup of the reel, the script to read, the caption and every asset with its source.
   Everything comes from window.VIDEO, which kit/build.py writes from the video's edit/plan.json. The reel is a 1080x1920
   element laid out on the edit's grid (charles-claude-editing's numbers) and scaled to the phone, so what the mockup shows
   is where the edit will put it. The music keeps the time while it plays. Space plays and pauses, the arrow keys step
   through the lines. */
(() => {
  const V = window.VIDEO;
  const beats = V.beats;
  const N = beats.length;
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
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
    return el;
  }
  const secs = (s) => s.toFixed(1);
  const px = (v) => `${v}px`;
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  // A line's mark: its list number or year, "End" for a list reel's sign-off, otherwise where it starts.
  const mark = (b) => (b.number != null ? String(b.number) : V.reel.list && b === beats[N - 1] ? "End" : mmss(b.start));

  for (const [family, url] of Object.entries(V.fonts || {})) {
    const face = new FontFace(family, `url(${url})`, { display: "block" });
    document.fonts.add(face);
    face.load().catch(() => {});
  }

  /* ---- header ---------------------------------------------------------------------------------------------------- */
  const REF = V.reference || {};
  $("#page-title").textContent = V.title;
  const lede = $("#lede");
  lede.append(`A ${Math.round(V.total)} s ${V.format_name}: the script to read, the caption, the assets and a moving mockup with its music.`);
  if (REF.structure) lede.append(" Structure from ", h("a", { href: REF.structure, target: "_blank", rel: "noopener", text: REF.structure_title || "the reference reel" }));
  if (REF.idea) lede.append(REF.structure ? ", idea from " : " Idea from ", REF.idea_author ? `${REF.idea_author}'s ` : "", h("a", { href: REF.idea, target: "_blank", rel: "noopener", text: REF.idea_title || "the reference" }));
  if (REF.structure || REF.idea) lede.append(".");

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
      h("span", { class: "num ov", text: String(r.number), style: { width: px(list.numw - 10) } }),
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
  const jump = (i) => {
    const dx = ((i * 37) % 9 - 4) * 5;
    const dy = ((i * 53) % 7 - 3) * 5;
    const s = 1 + ((i * 29) % 5 - 2) * 0.01;
    return [dx, dy, s];
  };

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
    visual.replaceChildren();
    if (v) {
      const bx = box(v);
      Object.assign(visual.style, { left: px(bx.x), top: px(bx.y), width: px(bx.w), height: px(bx.h) });
      visual.className = `visual fit-${bx.fit === "fill" ? "contain" : bx.fit}${bx.sticker ? " sticker" : ""}${bx.panel ? " panel" : ""}`;
      visual.append(v.type === "video"
        ? h("video", { src: v.src, muted: true, loop: true, playsinline: true, autoplay: true })
        : h("img", { src: v.src, alt: "" }));
      if (v.type === "video") { const vid = $("video", visual); vid.muted = true; vid.play().catch(() => {}); }
      visual.hidden = false;
    } else {
      visual.hidden = true;
    }
    footage.classList.toggle("spotlight", !!v && v.place === "spotlight");
    footage.hidden = !!v && v.place === "screen";
    const [dx, dy, s] = jump(i);
    const end = list && i === N - 1 && b.row == null && N > 1; // a list reel's sign-off punches in 6%, as list_reel.py does; nothing else zooms
    person.style.transform = end ? `translate(-30px, ${20 + faceShift(v)}px) scale(1.06)` : `translate(${dx}px, ${dy + faceShift(v)}px) scale(${s})`;
    document.querySelectorAll(".current").forEach((el) => el.classList.remove("current"));
    document.querySelectorAll(`[data-i="${i}"]`).forEach((el) => el.classList.add("current"));
    if (b.group != null) document.querySelectorAll(`[data-group="${CSS.escape(String(b.group))}"]`).forEach((el) => el.classList.add("current"));
    renderNow(i);
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
    showCaption(beats[i]);
    // The hook: a list reel's title stays up; a TikTok hook stays for its first sentence, on the seam if it opens on a split.
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
  const tracks = (V.music && V.music.tracks) || [];
  const audio = tracks.length ? new Audio() : null;
  let track = tracks.length ? 0 : -1;  // -1 is no music
  let soundOn = true;
  let waitingSince = null;             // when play asked the music to start; the reel holds still up to 1.5 s for it
  const soundBtn = $("#sound");
  const musicNote = $("#music-note");

  const musicOn = () => audio && track >= 0 && soundOn;
  function syncAudio(force = false) {
    if (!audio) return;
    if (!playing || !musicOn()) {
      if (!audio.paused) audio.pause();
      waitingSince = null;
      return;
    }
    const want = tracks[track].at + t;
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
    audio.src = tracks[0].src;
    audio.addEventListener("loadedmetadata", () => syncAudio(true));
    // The speaker turns orange only while music is actually coming out, and a note says so if a track can't load.
    audio.addEventListener("playing", () => { waitingSince = null; soundBtn.classList.add("heard"); musicNote.hidden = true; });
    ["pause", "waiting", "ended", "emptied"].forEach((ev) => audio.addEventListener(ev, () => soundBtn.classList.remove("heard")));
    audio.addEventListener("error", () => { waitingSince = null; musicNote.hidden = false; });
  }

  function tick(ts) {
    if (!playing) return;
    const dt = lastTs == null ? 0 : Math.min(0.1, (ts - lastTs) / 1000);
    lastTs = ts;
    const heard = musicOn() && !audio.paused && audio.readyState >= 3 ? audio.currentTime - tracks[track].at : null;
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

  /* ---- transport ------------------------------------------------------------------------------------------------ */
  $("#t-total").textContent = `${secs(total)} s`;
  const scrub = $("#scrub");
  scrub.max = String(total);
  const ticks = $("#ticks");
  const fill = h("span", { class: "fill" });
  ticks.append(fill);
  beats.slice(1).forEach((b) => ticks.append(h("span", { style: { left: `${(b.start / total) * 100}%` } })));
  const head = h("span", { class: "head" });
  $(".scrub").append(head);

  $("#play").addEventListener("click", () => setPlaying(!playing));
  $("#big-play").addEventListener("click", (e) => { e.stopPropagation(); seek(0); setPlaying(true); });
  phone.addEventListener("click", () => setPlaying(!playing)); // tap the reel to pause, as on Instagram
  // Back goes to the start of the current line, or to the one before if it's already at the start, like a player does.
  function prevBeat() {
    const i = indexAt(t);
    seekBeat(t - beats[i].start > 0.4 ? i : Math.max(0, i - 1));
  }
  const nextBeat = () => seekBeat(Math.min(N - 1, indexAt(t) + 1));
  $("#prev").addEventListener("click", prevBeat);
  $("#next").addEventListener("click", nextBeat);
  scrub.addEventListener("input", () => seek(Number(scrub.value)));
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input[type=text], textarea, select") || e.metaKey || e.ctrlKey || e.altKey) return;
    if ($("#viewer").open) return;
    if (e.key === " " && !e.target.closest("button, a, input")) { e.preventDefault(); setPlaying(!playing); }
    if (e.key === "ArrowRight" && !e.target.closest("input")) { e.preventDefault(); nextBeat(); }
    if (e.key === "ArrowLeft" && !e.target.closest("input")) { e.preventDefault(); prevBeat(); }
  });
  $("#opt-ig").addEventListener("change", (e) => { $("#ig").hidden = !e.target.checked; });
  $("#opt-safe").addEventListener("change", (e) => { $("#safe").hidden = !e.target.checked; });

  const musicPick = $("#opt-music");
  if (!audio) {
    soundBtn.hidden = true;
    musicPick.closest("label").hidden = true;
  } else {
    tracks.forEach((tr, k) => musicPick.append(h("option", { value: String(k), text: `${tr.title}, from ${mmss(tr.from ?? tr.at)}` })));
    musicPick.append(h("option", { value: "-1", text: "No music" }));
    musicPick.addEventListener("change", () => {
      track = Number(musicPick.value);
      if (track >= 0) {
        audio.src = tracks[track].src;
        soundOn = true;
        soundBtn.setAttribute("aria-pressed", "true");
      }
      syncAudio(true);
    });
    soundBtn.addEventListener("click", () => {
      soundOn = !soundOn;
      soundBtn.setAttribute("aria-pressed", String(soundOn));
      soundBtn.setAttribute("aria-label", soundOn ? "Mute the music" : "Play the music");
      syncAudio(true);
    });
  }

  const short = (what) => {
    const s = (what || "").split(/[:;(]/)[0].trim();
    return s.length > 48 ? `${s.slice(0, 46).trimEnd()}…` : s;
  };
  const groupById = new Map((V.groups || []).map((g) => [String(g.id), g]));

  function renderNow(i) {
    const b = beats[i];
    const now = $("#now");
    now.replaceChildren(h("strong", {}, h("span", { class: "mark", text: mark(b) }), b.label || short(b.say)),
      `Say: “${b.say}”, about ${secs(b.dur)} s.`);
    const g = b.group != null ? groupById.get(String(b.group)) : null;
    const used = g ? g.images.filter((im) => im.used) : [];
    if (b.visual && b.visual.place === "under-chin") now.append(used.length ? ` Under the chin: ${used.map((im) => short(im.what)).join("; ")}.` : " Collage pending.");
    else if (b.visual) now.append(` On screen (${b.visual.place}): ${b.visual.what || short(used[0] && used[0].what) || "the asset"}.`);
    if (b.sfx) now.append(` Sound: ${b.sfx}.`);
    if (b.note) now.append(` ${b.note}`);
  }

  /* ---- script --------------------------------------------------------------------------------------------------- */
  $("#script-intro").textContent = [V.reading,
    `Times are ${V.timed === "cut" ? "from the cut" : "estimated until there's a cut"}: the reel runs ${secs(total)} s${list ? `, and the list ends at ${secs(list.stop_at)} s` : ""}.`,
  ].filter(Boolean).join(" ");
  const reads = $("#reads");
  const same = (a, b) => a.replace(/\W/g, "").toLowerCase() === b.replace(/\W/g, "").toLowerCase();
  beats.forEach((b, i) => {
    const shownText = b.cards.length ? b.cards.map((c) => c.lines.join(" ")).join(" / ") : null;
    reads.append(h("li", { "data-i": i, onclick: () => seekBeat(i) },
      h("span", { class: "y", text: mark(b) }),
      h("span", { class: "s" }, b.say,
        b.label && !same(b.label, b.say) && b.row != null ? h("span", { class: "label", text: `On screen: ${b.label}` }) : null,
        shownText && b.caption_explicit ? h("span", { class: "label", text: `Caption: ${shownText}` }) : null,
        b.visual && b.visual.place !== "under-chin" && b.visual.what ? h("span", { class: "label", text: `Shows: ${b.visual.what}` }) : null,
        b.sfx ? h("span", { class: "label", text: `Sound: ${b.sfx}` }) : null),
      h("span", { class: "d", text: `${secs(b.dur)} s` })));
  });
  (V.filming || []).forEach((line) => $("#filming").append(h("li", { text: line })));
  // What kit/build.py found against charles-claude-editing's rules (captions, hook, timing, safe area, music, sound).
  const checks = V.checks || [];
  $("#checks").append(h("h3", { text: checks.length ? `${checks.length} ${checks.length === 1 ? "check fails" : "checks fail"} against the editing rules` : "Every check against the editing rules passes" }),
    checks.length ? h("ul", {}, checks.map((c) => h("li", { text: c }))) : null);
  if (tracks.length) {
    $("#filming").append(h("li", { text: `Music: ${tracks.map((tr) => `${tr.title}${tr.artist ? ` (${tr.artist})` : ""} from ${mmss(tr.from ?? tr.at)}`).join(", or ")}, about ${V.music.under} dB under your voice in the edit.` }));
  }

  /* ---- caption -------------------------------------------------------------------------------------------------- */
  const captionBox = (label, text) => {
    const pre = h("pre", { text });
    const btn = h("button", { class: "copy", type: "button", text: "Copy" });
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = "Copied";
      } catch {
        const range = document.createRange();
        range.selectNodeContents(pre);
        getSelection().removeAllRanges();
        getSelection().addRange(range);
        btn.textContent = "Selected";
      }
      setTimeout(() => { btn.textContent = "Copy"; }, 1600);
    });
    return h("div", { class: "capbox" }, h("div", { class: "capbox-head" }, h("span", { text: label }), btn), pre);
  };
  const P = V.post || {};
  if (P.caption) $("#captions").append(captionBox("Caption", P.caption));
  if (P.caption_alt) $("#captions").append(captionBox("Shorter alternative", P.caption_alt));
  if (P.comment) $("#captions").append(captionBox("First comment, optional", P.comment));
  if (P.credit) $("#caption").append(h("p", { class: "credit", text: `Credit: ${P.credit}.` }));

  /* ---- assets --------------------------------------------------------------------------------------------------- */
  // Sources are web pages or paths in the repository. A published copy has no repository next to it, so there only web
  // pages are links.
  const hrefFor = (link) => (/^https?:/.test(link) ? link : V.site ? null : link);
  const meta = (im) => [
    im.used ? "" : "Spare. ",
    im.link && hrefFor(im.link) ? h("a", { href: hrefFor(im.link), target: "_blank", rel: "noopener", text: im.source || "source" }) : (im.source || ""),
    im.license ? `, ${im.license}` : "",
    im.size ? `, ${im.size[0]}×${im.size[1]}` : "",
  ];
  const viewer = $("#viewer");
  function openViewer(im) {
    const img = $("img", viewer);
    img.src = im.large || im.src;
    img.alt = im.what || "";
    $(".v-what", viewer).textContent = im.what || im.src.split("/").pop();
    $(".v-meta", viewer).replaceChildren(...meta(im));
    viewer.showModal();
  }
  viewer.addEventListener("click", (e) => { if (!e.target.closest("a")) viewer.close(); });

  const groups = V.groups || [];
  $("#assets-intro").textContent = groups.length
    ? `${list ? "Each item's collage as it sits under your chin" : "Each line's asset"}, then the real images with where they came from. Click a card to see it in the mockup, or a thumbnail to see the image.`
    : "No assets yet.";
  groups.forEach((g) => {
    const plateSrc = g.composite || (beats[g.beat] && beats[g.beat].visual && beats[g.beat].visual.src);
    const isVideo = !g.composite && beats[g.beat] && beats[g.beat].visual && beats[g.beat].visual.type === "video";
    const plate = h("div", { class: "plate" },
      plateSrc ? (isVideo ? h("video", { src: plateSrc, muted: true, playsinline: true, preload: "metadata" }) : h("img", { src: plateSrc, alt: `${g.title}`, loading: "lazy" }))
        : h("span", { class: "pending", text: "Pending" }));
    const items = h("ul", { class: "srcs" }, g.images.map((im) => h("li", { class: im.used ? null : "spare" },
      h("button", {
        class: "thumb", type: "button", style: { backgroundImage: `url("${im.thumb || im.src}")` },
        "aria-label": `View ${short(im.what || im.src.split("/").pop())}`,
        onclick: (e) => { e.stopPropagation(); openViewer(im); },
      }),
      h("span", {},
        h("span", { class: "what", text: im.what || im.src.split("/").pop() }),
        h("span", { class: "meta" }, ...meta(im))))));
    $("#groups").append(h("article", { class: "grp", "data-group": String(g.id), onclick: (e) => { if (!e.target.closest("a, button")) { seekBeat(g.beat); if (innerWidth <= 980) $("#mockup").scrollIntoView(); } } },
      plate, h("h3", {}, g.number != null ? h("span", { class: "y", text: String(g.number) }) : null, g.title), items));
  });

  /* ---- files ---------------------------------------------------------------------------------------------------- */
  const F = V.files || {};
  if (F.folder) {
    $("#files").append(
      h("h2", { text: "Files" }),
      h("p", {}, "Everything is in ", h("code", { text: `${F.folder}/` }), ". ",
        ...(F.list || []).flatMap(([path, what], k) => [h("code", { text: path }), ` ${what}${k < F.list.length - 1 ? ", " : "."}`])),
      F.rebuild ? h("p", {}, "Rebuild after changing the plan or the images: ", h("code", { text: F.rebuild }), ".") : null,
    );
  }

  /* ---- start ---------------------------------------------------------------------------------------------------- */
  // ?solo&t=12.3 shows just the reel at 1080x1920, paused at that time, for exporting a frame (&ig=0 hides Instagram's UI,
  // &safe=1 shows the safe area). Otherwise it waits on the first frame with a play button, since sound needs a tap.
  const params = new URLSearchParams(location.search);
  if (params.get("ig") === "0") { $("#opt-ig").checked = false; $("#ig").hidden = true; }
  if (params.get("safe") === "1") { $("#opt-safe").checked = true; $("#safe").hidden = false; }
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
