// The lesson player: one step per screen, predict-first questions, narration that highlights each word as it's read,
// and a speed control. Each step waits for the reader; Next moves on and keeps reading aloud if they were listening.
// Lesson data comes from window.LESSON, narration timings from window.NARRATION.
(() => {
  const L = window.LESSON, N = window.NARRATION || {};
  const { el } = window.learn;
  const $ = (s) => document.querySelector(s);
  const app = $('#app'), audio = $('#audio'), player = $('#player'), tip = $('#tip');
  const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
  const store = {
    get(k, d) { try { const v = localStorage.getItem('learn:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('learn:' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const steps = L.steps || [];
  const S = { i: -1, playing: false, speed: store.get('speed', 1), listen: false, answers: {}, view: null, widget: null, run: 0, raf: 0, current: null, voice: undefined };

  // ---------- key terms ----------
  const defs = new Map((L.terms || []).map((t) => [t.term.toLowerCase(), t]));
  function termFor(text) {
    const k = text.toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, '').trim();
    if (defs.has(k)) return defs.get(k);
    for (const [t, v] of defs) if (k === t + 's' || k === t + 'es' || (t.endsWith('y') && k === t.slice(0, -1) + 'ies')) return v;
    return null;
  }

  // ---------- text to words ----------
  // **bold** marks a key term, [[name]] fires cue "name" on the widget when the next word is read.
  // build.py splits narration the same way, so word i on screen is word i in the timings.
  function parse(text) {
    const words = [], paras = [], callouts = new Set();
    for (const raw of String(text || '').trim().split(/\n\s*\n/)) {
      let src = raw.replace(/\s+/g, ' ').trim();
      // A paragraph starting with "> " is a stand-out fact or a memory aid: read like the rest, shown as a callout.
      if (/^>\s?/.test(src)) { callouts.add(paras.length); src = src.replace(/^>\s?/, ''); }
      let p = '', boldAt = null; const bolds = [], cues = [];
      for (let j = 0; j < src.length;) {
        if (src.startsWith('**', j)) { if (boldAt == null) boldAt = p.length; else { bolds.push([boldAt, p.length]); boldAt = null; } j += 2; continue; }
        const m = src.slice(j).match(/^\[\[([\w-]+)\]\]\s?/);
        if (m) { cues.push([p.length, m[1]]); j += m[0].length; continue; }
        p += src[j]; j++;
      }
      const ids = []; const re = /\S+/g; let mm;
      while ((mm = re.exec(p))) {
        const s = mm.index, e = s + mm[0].length;
        const bi = bolds.findIndex(([a, z]) => s < z && e > a);
        const w = { t: mm[0], s, cues: [] };
        if (bi >= 0) { w.bid = `${paras.length}:${bi}`; w.btext = p.slice(bolds[bi][0], bolds[bi][1]); }
        ids.push(words.length); words.push(w);
      }
      for (const [at, name] of cues) { const id = ids.find((k) => words[k].s >= at) ?? ids[ids.length - 1]; if (id != null) words[id].cues.push(name); }
      paras.push(ids);
    }
    return { words, paras, callouts };
  }

  function renderWords(host, parsed, tag = 'p') {
    const spans = [];
    parsed.paras.forEach((ids, pi) => {
      const p = el(tag, parsed.callouts?.has(pi) ? 'callout' : null);
      for (let k = 0; k < ids.length;) {
        const w = parsed.words[ids[k]];
        if (w.bid) {
          const g = el('span', 'term'); g.tabIndex = 0;
          const t = termFor(w.btext); g.dataset.term = w.btext; if (t) g.dataset.def = t.def;
          let first = true;
          while (k < ids.length && parsed.words[ids[k]].bid === w.bid) {
            if (!first) g.appendChild(document.createTextNode(' '));
            const s = el('span', 'w', parsed.words[ids[k]].t); spans[ids[k]] = s; g.appendChild(s); first = false; k++;
          }
          p.append(g, ' ');
        } else { const s = el('span', 'w', w.t); spans[ids[k]] = s; p.append(s, ' '); k++; }
      }
      host.appendChild(p);
    });
    return { words: parsed.words, spans, cur: -1, readTo: -1, fired: new Set() };
  }

  function highlight(unit, idx) {
    if (!unit || unit.cur === idx) return;
    unit.spans[unit.cur]?.classList.remove('on');
    for (let k = unit.readTo + 1; k <= idx; k++) unit.spans[k]?.classList.add('read');
    unit.readTo = Math.max(unit.readTo, idx);
    unit.cur = idx;
    if (idx < 0) return;
    unit.spans[idx]?.classList.add('on');
    if (!unit.fired.has(idx)) { unit.fired.add(idx); for (const c of unit.words[idx]?.cues || []) S.widget?.cue?.(c); }
  }

  // ---------- narration ----------
  function pickVoice() {
    if (S.voice !== undefined) return S.voice;
    const vs = (window.speechSynthesis ? speechSynthesis.getVoices() : []).filter((v) => /^en([-_]|$)/i.test(v.lang));
    for (const p of [/premium/i, /enhanced/i, /^(ava|zoe|evan|nathan|joelle|noelle)\b/i, /^samantha/i, /^daniel/i]) {
      const v = vs.find((x) => p.test(x.name) && x.localService); if (v) return (S.voice = v);
    }
    return (S.voice = vs.find((x) => x.localService) || vs[0] || null);
  }
  if (window.speechSynthesis) speechSynthesis.addEventListener?.('voiceschanged', () => { S.voice = undefined; setVoiceLabel(); });

  function stopSpeech() {
    S.run++;
    cancelAnimationFrame(S.raf);
    audio.pause();
    if (window.speechSynthesis) speechSynthesis.cancel();
    if (S.current) { S.current.unit.host?.classList.remove('live'); clearInterval(S.current.est); }
    S.current = null;
  }

  function speak(key, unit, done) {
    stopSpeech();
    const run = S.run;
    unit.host?.classList.add('live');
    const finish = () => { if (run !== S.run) return; unit.host?.classList.remove('live'); highlight(unit, unit.words.length - 1); unit.spans[unit.cur]?.classList.remove('on'); S.current = null; done && done(); };
    const n = N[key];
    if (n && n.src) {
      S.current = { key, unit, mode: 'audio' };
      audio.src = n.src; audio.playbackRate = S.speed; audio.preservesPitch = true; audio.currentTime = 0;
      const tick = () => {
        if (run !== S.run) return;
        const t = audio.currentTime; let lo = 0, hi = n.words.length;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (n.words[mid][0] <= t) lo = mid + 1; else hi = mid; }
        highlight(unit, lo - 1);
        if (!audio.paused && !audio.ended) S.raf = requestAnimationFrame(tick);
      };
      audio.onplay = () => { cancelAnimationFrame(S.raf); S.raf = requestAnimationFrame(tick); };
      audio.onended = finish;
      audio.play().catch(() => setPlaying(false));
    } else if (window.speechSynthesis && pickVoice()) {
      S.current = { key, unit, mode: 'web' };
      webSpeak(unit, run, finish);
    } else {
      setPlaying(false);
    }
  }

  // The browser's own voice, one sentence at a time (long utterances stall in Chrome). Words light up from boundary
  // events; voices that don't send them get an estimate from the speaking rate.
  function webSpeak(unit, run, done) {
    const words = unit.words.map((w) => w.t);
    const sents = []; let a0 = 0;
    words.forEach((w, k) => { if (/[.!?]["')\]]*$/.test(w) || k === words.length - 1) { sents.push([a0, k + 1]); a0 = k + 1; } });
    let si = 0;
    const next = () => {
      clearInterval(S.current?.est);
      if (run !== S.run) return;
      if (si >= sents.length) return done();
      const [a, b] = sents[si];
      const offs = []; let c = 0; for (let k = a; k < b; k++) { offs.push(c); c += words[k].length + 1; }
      const u = new SpeechSynthesisUtterance(words.slice(a, b).join(' '));
      u.voice = pickVoice(); u.rate = S.speed;
      let heard = false;
      u.onboundary = (e) => {
        if (run !== S.run || (e.name && e.name !== 'word')) return;
        heard = true; clearInterval(S.current?.est);
        let k = 0; while (k + 1 < offs.length && offs[k + 1] <= e.charIndex) k++;
        highlight(unit, a + k);
      };
      u.onstart = () => {
        if (run !== S.run) return;
        highlight(unit, a);
        setTimeout(() => {
          if (heard || run !== S.run || !S.current) return;
          const t0 = performance.now();
          S.current.est = setInterval(() => highlight(unit, Math.min(b - 1, a + Math.floor(((performance.now() - t0) / 1000) * 2.6 * S.speed))), 100);
        }, 400);
      };
      u.onend = u.onerror = () => { si++; next(); };
      speechSynthesis.speak(u);
    };
    next();
  }

  function setPlaying(on) {
    S.playing = on;
    player.classList.toggle('playing', on);
    $('#play').setAttribute('aria-label', on ? 'Pause narration (Space)' : 'Play narration (Space)');
    if (!on) { if (S.current) { if (S.current.mode === 'audio') audio.pause(); else speechSynthesis.pause(); } }
  }

  // S.listen is whether they want the steps read aloud: play turns it on, pause turns it off.
  function play() {
    S.listen = true;
    if (S.i < 0 || S.i >= steps.length) { go(0, true); return; }
    if (S.current) { setPlaying(true); if (S.current.mode === 'audio') audio.play(); else speechSynthesis.resume(); return; }
    const st = steps[S.i];
    if (S.view?.checkShown && st.check && S.answers[st.id + '.c'] == null) return; // waiting for their answer
    if (S.view?.checkShown) { go(S.i + 1, true); return; }
    setPlaying(true);
    narrate();
  }

  function pause() { S.listen = false; setPlaying(false); }

  function narrate() {
    const st = steps[S.i], v = S.view;
    if (!st || !v) return;
    if (st.predict && S.answers[st.id + '.p'] == null) { speak(st.id + '.q', v.q, () => setPlaying(false)); return; }
    speak(st.id + '.say', v.say, afterSay);
  }

  // A step never moves on by itself: people look at the picture for different lengths of time, so the step waits
  // until they press Next.
  function afterSay() {
    const st = steps[S.i];
    if (st.check && S.answers[st.id + '.c'] == null) showCheck();
    setPlaying(false);
  }

  // ---------- questions ----------
  function questionCard(host, qd, label, key, onAnswer, narrateUnit) {
    const card = el('div', 'card'); card.appendChild(el('p', 'label', label));
    const qEl = el('div', 'q'); card.appendChild(qEl);
    const unit = narrateUnit ? renderWords(qEl, parse(qd.q), 'span') : (qEl.textContent = qd.q, null);
    if (unit) unit.host = qEl;
    const list = el('div', 'choices'); card.appendChild(list);
    const why = el('p', 'why'); why.hidden = true; card.appendChild(why);
    const btns = qd.choices.map((c, k) => { const b = el('button', 'choice', c); b.type = 'button'; b.addEventListener('click', () => answer(k)); list.appendChild(b); return b; });
    function show(k) {
      btns.forEach((b, j) => { b.disabled = true; if (j === qd.answer) b.classList.add('right'); else if (j === k) b.classList.add('wrong'); });
      why.hidden = false; why.innerHTML = '';
      why.append(el('b', null, k === qd.answer ? 'Right. ' : 'Not quite. '), document.createTextNode(qd.why || ''));
    }
    function answer(k) { if (S.answers[key] != null) return; S.answers[key] = k; show(k); onAnswer && onAnswer(k === qd.answer); }
    if (S.answers[key] != null) show(S.answers[key]);
    host.appendChild(card);
    return { card, unit };
  }

  function showCheck() {
    const st = steps[S.i], v = S.view;
    if (!st?.check || v.checkShown) return false;
    v.checkShown = true;
    questionCard(v.checkHost, st.check, 'Check yourself', st.id + '.c');
    v.checkHost.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return true;
  }

  // ---------- screens ----------
  function renderIntro() {
    const box = el('section', 'intro');
    const words = steps.reduce((n, s) => n + parse(s.say).words.length, 0);
    box.appendChild(el('p', 'kicker', `${steps.length} steps · about ${Math.max(1, Math.round(words / 150 + steps.length * 0.3))} min`));
    box.appendChild(el('h1', null, L.title));
    if (L.subtitle) box.appendChild(el('p', 'sub', L.subtitle));
    if (L.terms?.length) {
      box.appendChild(el('p', 'meta', 'Words you’ll meet'));
      const g = el('div', `terms c${L.terms.length === 4 || L.terms.length === 2 ? 2 : 3}`);
      for (const t of L.terms) { const d = el('div'); d.append(el('b', null, t.term), document.createTextNode(t.def)); g.appendChild(d); }
      box.appendChild(g);
    }
    box.appendChild(el('p', 'meta', 'What you’ll go through'));
    const ol = el('ol', 'outline'); for (const st of steps) ol.appendChild(el('li', null, st.title)); box.appendChild(ol);
    const go0 = el('button', 'go', 'Start'); go0.type = 'button';
    go0.addEventListener('click', () => { S.listen = true; go(0, true); });
    const read = el('button', 'go ghost', 'Read without sound'); read.type = 'button';
    read.addEventListener('click', () => { S.listen = false; go(0, false); });
    const row = el('div'); row.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap'; row.append(go0, read);
    box.appendChild(row);
    app.appendChild(box);
  }

  function renderStep(st, idx) {
    const sec = el('section', 'step');
    const hasVisual = !!(st.widget || st.image);
    if (!hasVisual) sec.classList.add('no-visual');
    const text = el('div', 'text');
    text.append(el('p', 'kicker', `Step ${idx + 1} of ${steps.length}`), el('h2', 'title', st.title));
    const v = { sec };
    if (st.predict) {
      const gated = S.answers[st.id + '.p'] == null;
      if (gated) sec.classList.add('gated');
      const q = questionCard(text, st.predict, 'Predict first', st.id + '.p', () => {
        sec.classList.remove('gated');
        if (S.listen) { setPlaying(true); speak(st.id + '.say', v.say, afterSay); }
      }, true);
      v.q = q.unit;
    }
    const sayHost = el('div', 'say'); text.appendChild(sayHost);
    v.say = renderWords(sayHost, parse(st.say)); v.say.host = sayHost;
    if (st.jots?.length) { // the step's dot jots: what they'd write in their notes, shown but not read aloud
      const jots = el('div', 'jots'); jots.appendChild(el('p', 'label', 'Key points'));
      const ul = el('ul'); for (const j of st.jots) ul.appendChild(el('li', null, j));
      jots.appendChild(ul); text.appendChild(jots);
    }
    v.checkHost = el('div'); text.appendChild(v.checkHost);
    if (st.check && S.answers[st.id + '.c'] != null) { v.checkShown = true; questionCard(v.checkHost, st.check, 'Check yourself', st.id + '.c'); }
    sec.appendChild(text);
    if (hasVisual) {
      const fig = el('figure', 'visual');
      if (st.image) { const img = el('img'); img.src = st.image; img.alt = st.alt || st.title; fig.appendChild(img); }
      if (st.widget) {
        const fn = window.learn.widgets[st.widget];
        if (fn) { try { S.widget = fn(fig, { step: st, options: st.widgetOptions || {} }) || null; } catch (e) { console.error(e); fig.appendChild(el('p', 'w-caption', `The ${st.widget} demo failed to load.`)); } }
        else fig.appendChild(el('p', 'w-caption', `No widget called ${st.widget}.`));
      }
      if (st.caption) fig.appendChild(el('figcaption', null, st.caption));
      sec.appendChild(fig);
    }
    app.appendChild(sec);
    S.view = v;
  }

  function renderEnd() {
    const box = el('section', 'end');
    box.appendChild(el('p', 'kicker', 'Recap'));
    box.appendChild(el('h2', null, L.recapTitle || 'What you now know'));
    const ul = el('ul', 'recap'); for (const r of L.recap || []) ul.appendChild(el('li', null, r)); box.appendChild(ul);
    if (L.quiz?.length) {
      box.appendChild(el('p', 'kicker', 'Quick quiz'));
      const score = el('p', 'score'); box.appendChild(score);
      const upd = () => { const done = L.quiz.filter((_, k) => S.answers['quiz.' + k] != null); const right = L.quiz.filter((q, k) => S.answers['quiz.' + k] === q.answer); score.textContent = done.length ? `${right.length} of ${done.length} right so far` : `${L.quiz.length} questions, no peeking back.`; };
      L.quiz.forEach((q, k) => questionCard(box, q, `Question ${k + 1}`, 'quiz.' + k, upd));
      upd();
    }
    // Where each stand-out fact and real-world number came from, in step order (build.py checks every one).
    const sources = steps.flatMap((st) => st.sources || []);
    if (sources.length) {
      box.appendChild(el('p', 'kicker', 'Sources'));
      const ul = el('ul', 'sources');
      for (const s of sources) {
        const li = el('li', null, `${s.claim}: `);
        const a = el('a', null, s.title); a.href = s.url; a.target = '_blank'; a.rel = 'noopener';
        li.appendChild(a); ul.appendChild(li);
      }
      box.appendChild(ul);
    }
    const again = el('button', 'go ghost', 'Start over'); again.type = 'button';
    again.addEventListener('click', () => { S.answers = {}; go(-1, false); });
    box.appendChild(again);
    app.appendChild(box);
  }

  function render() {
    app.innerHTML = ''; S.view = null;
    player.hidden = S.i < 0; // the intro's Start button is the only control it needs
    if (S.i < 0) renderIntro(); else if (S.i >= steps.length) renderEnd(); else renderStep(steps[S.i], S.i);
    const prog = $('#progress'); prog.innerHTML = '';
    steps.forEach((st, k) => { const b = el('button'); b.type = 'button'; b.title = `${k + 1}. ${st.title}`; b.setAttribute('aria-label', `Step ${k + 1}: ${st.title}`); if (k < S.i) b.classList.add('done'); if (k === S.i) b.classList.add('cur'); b.addEventListener('click', () => go(k, S.listen)); prog.appendChild(b); });
    updateCount();
  }

  function updateCount() {
    const left = steps.slice(Math.max(0, S.i)).reduce((n, s) => n + parse(s.say).words.length, 0);
    $('#count').textContent = S.i < 0 ? `${steps.length} steps` : S.i >= steps.length ? 'Done' : `${S.i + 1} / ${steps.length} · ${Math.max(1, Math.round(left / (150 * S.speed)))} min left`;
  }

  function go(i, readAloud) {
    stopSpeech();
    try { S.widget?.destroy?.(); } catch (e) { /* ignore */ }
    S.widget = null;
    S.i = Math.max(-1, Math.min(steps.length, i));
    render();
    window.scrollTo(0, 0);
    if (readAloud && S.i >= 0 && S.i < steps.length) { setPlaying(true); narrate(); }
    else setPlaying(false);
  }

  function next() {
    if (S.i >= 0 && S.i < steps.length && steps[S.i].check && S.answers[steps[S.i].id + '.c'] == null && !S.view.checkShown) { stopSpeech(); setPlaying(false); showCheck(); return; }
    go(S.i + 1, S.listen);
  }

  // ---------- controls ----------
  function setVoiceLabel() {
    const any = Object.values(N).find((n) => n && n.src);
    const v = any ? null : pickVoice();
    $('#voice').textContent = any ? (L.voiceLabel || 'Narrated') : v ? `Voice: ${v.name.replace(/\s*\(.*\)$/, '')}` : 'No voice';
  }
  // Above 1.5x, comprehension drops measurably, so those speeds are labelled for review.
  const speedLabel = (s) => (s > 1.5 ? `${s}× review` : `${s}×`);
  function setSpeed(s) { S.speed = s; store.set('speed', s); audio.playbackRate = s; $('#speed').textContent = speedLabel(s); updateCount(); }
  $('#play').addEventListener('click', () => (S.playing ? pause() : play()));
  $('#next').addEventListener('click', next);
  $('#prev').addEventListener('click', () => go(S.i - 1, S.listen));
  $('#home').addEventListener('click', () => go(-1, false));
  $('#speed').addEventListener('click', () => setSpeed(SPEEDS[(SPEEDS.indexOf(S.speed) + 1) % SPEEDS.length] || 1));
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === ' ') { if (e.target.closest('button')) return; e.preventDefault(); S.playing ? pause() : play(); }
    else if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') go(S.i - 1, S.listen);
    else if (e.key === ']' || e.key === '=' || e.key === '+') setSpeed(SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(S.speed) + 1)]);
    else if (e.key === '[' || e.key === '-') setSpeed(SPEEDS[Math.max(0, SPEEDS.indexOf(S.speed) - 1)]);
  });
  const showTip = (t) => {
    if (!t?.dataset.def) return;
    tip.innerHTML = ''; tip.append(el('b', null, t.dataset.term), document.createTextNode(t.dataset.def)); tip.hidden = false;
    const r = t.getBoundingClientRect(); const w = Math.min(300, window.innerWidth - 24);
    tip.style.left = `${Math.max(12, Math.min(r.left, window.innerWidth - w - 12))}px`;
    tip.style.top = `${r.bottom + 8}px`;
  };
  document.addEventListener('mouseover', (e) => { const t = e.target.closest('.term'); if (t) showTip(t); else tip.hidden = true; });
  document.addEventListener('focusin', (e) => { const t = e.target.closest('.term'); if (t) showTip(t); });
  document.addEventListener('focusout', () => { tip.hidden = true; });
  window.addEventListener('scroll', () => { tip.hidden = true; }, { passive: true });

  $('#speed').textContent = speedLabel(S.speed);
  setVoiceLabel();
  render();
})();
