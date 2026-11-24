/* charles-studio-explainers: the card every builder sits in. The list-reel term-card slot of charles-explainers-assets:
   a transparent 1080x480 clip placed at reel y 1080, the 870x350 card at (80, 70) of it (reel x 80-950, y 1150-1500,
   inside the safe area), the black tab on the card's top-left edge with the line's "tab" text. The asset id picks the
   builder: "07-decoy-effect" -> STUDIO.cards['decoy-effect']. Change CARD for another slot. */
(() => {
  const { el, div, E, prog, push } = H$;
  const { L, cards } = window.STUDIO;
  const CARD = { x: 80, y: 70, w: 870, h: 350 };
  const TAB_H = 30 * 1.55;
  const TAB_FONT = `700 30px/${TAB_H}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  const st = {};
  H$.scene({
    build(stage, area, ctx) {
      const key = ctx.asset.id.replace(/^\d+-/, '');
      const build = cards[key];
      if (!build) throw new Error(`no builder for ${key}: add STUDIO.cards['${key}']`);
      const lines = ctx.ex.lines, i = lines.findIndex((l) => l.id === ctx.line.id), prev = i > 0 ? lines[i - 1] : null;
      const chrome = div(stage, { x: 0, y: 0, w: 1080, h: 480, style: { transformOrigin: `${CARD.x + CARD.w / 2}px ${CARD.y + CARD.h / 2}px` } });
      const card = L.B(chrome, CARD.x, CARD.y, CARD.w, CARD.h, { r: 30, style: { overflow: 'hidden', isolation: 'isolate', boxShadow: '0 24px 50px -24px rgb(0 0 0 / 0.55)' } });
      const inner = div(card, { x: 0, y: 0, w: CARD.w, h: CARD.h, style: { transformOrigin: '50% 50%' } });
      const draw = build(inner, CARD.w, CARD.h);
      const tabEl = el('div', { class: 'tab', style: { left: CARD.x + 22 + 'px', top: CARD.y - TAB_H + 'px', height: TAB_H + 'px', padding: '0 14px',
        font: TAB_FONT, zIndex: 45, overflow: 'hidden', boxSizing: 'border-box' } }, chrome);
      const tabTxt = el('span', { text: ctx.line.tab, style: { display: 'inline-block' } }, tabEl);
      Object.assign(st, { tabEl, tabTxt, text: ctx.line.tab, prevText: prev ? prev.tab : null });
      return (t) => {
        // the first card fades in from 97.5%; after that the card stays: its world cuts to the next one, the scene
        // settles in from 97.5% over 0.12 s, and the tab resizes from the previous line's width
        let s = push(t, 0.012);
        if (!prev) { const e = E.out(prog(t, 0, 0.15)); chrome.style.opacity = e; chrome.style.transform = `scale(${0.975 + 0.025 * e})`; }
        else s *= 0.975 + 0.025 * E.out(prog(t, 0, 0.12));
        if (st.wNew) tabEl.style.width = (prev ? st.wPrev + (st.wNew - st.wPrev) * E.out(prog(t, 0, 0.07)) : st.wNew) + 'px';
        tabTxt.style.opacity = prev ? prog(t, 0.07, 0.14) : 1;
        inner.style.transform = `scale(${s})`;
        draw(t);
      };
    },
    measure() {
      const m = el('span', { style: { position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap', font: TAB_FONT, letterSpacing: '-0.005em' } }, document.body);
      const wOf = (s) => { m.textContent = s; return m.getBoundingClientRect().width + 28; };
      st.wNew = wOf(st.text); st.wPrev = st.prevText ? wOf(st.prevText) : st.wNew; m.remove();
    },
  });
})();
