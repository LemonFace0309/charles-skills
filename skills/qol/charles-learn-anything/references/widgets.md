# Writing a demo

A lesson's demos live in its `widgets.js`. Each one is registered by name and drawn into the step's visual panel:

```js
learn.widget('pixels', (host, { step, options }) => {
  const st = { mode: options.mode || 'aliased', cols: options.cols || 18 };
  const cv = learn.canvas(host, { width: 560, height: 380, draw: (ctx, w, h) => { /* draw from st */ } });
  const row = learn.controls(host);
  const aa = learn.toggle(row, { label: 'Anti-aliasing', value: false, onChange: (v) => { st.mode = v ? 'coverage' : 'aliased'; cv.redraw(); } });
  learn.slider(row, { label: 'Pixels across', min: 8, max: 48, step: 1, value: st.cols, onInput: (v) => { st.cols = v; cv.redraw(); } });
  return {
    cue(name) { if (name === 'aa') aa.set(true); },   // [[aa]] in the narration lands here
    destroy() {},                                      // stop anything that keeps running
  };
});
```

`options` is the step's `widgetOptions`, so one demo can serve several steps with different starting states and controls.

## Helpers

| Helper | What it gives you |
| --- | --- |
| `learn.canvas(host, { width, height, draw })` | A canvas that stays sharp on any screen. `draw(ctx, w, h)` runs on every `redraw()`, in CSS pixels. `point(event)` converts a pointer event to canvas coordinates. |
| `learn.controls(host)` | The row the controls go in, under the picture. |
| `learn.slider(row, { label, min, max, step, value, format, onInput })` | A labelled slider with its value shown. `set(v)` moves it. |
| `learn.toggle(row, { label, value, onChange })` | An on/off switch. `set(v)` flips it and calls `onChange`. |
| `learn.segmented(row, { label, options: [{ label, value }], value, onChange })` | A few exclusive choices. |
| `learn.caption(host, text)` | A line of small text in the panel. |
| `learn.animate(frame)` | `start()` and `stop()` a loop; `frame(t, dt)` gets seconds. |
| `learn.tween(from, to, ms, set)` | Ease a number over time, for a change a cue triggers. |
| `learn.el(tag, className, text)` | Make an element. |

## Rules

- **Its starting state already shows the point.** Most readers never touch a control, so the first frame has to teach.
- **At most 2 controls.** Every extra control is one more thing to understand before the idea.
- **A cue sets state through the control** (`aa.set(true)`, not `st.mode = …`), so the switch on screen always matches the picture.
- **Labels sit on the parts they name**, drawn in the canvas next to the part. Never a legend.
- **Draw in a fixed palette**: white paper, near-black ink and one accent colour (`#2F55F4`), whatever the page's theme. The narration says "black on white", so the picture has to match it in dark mode too.
- **No libraries and no network.** The page has to work opened from disk, offline.
- **Keep a redraw under about 16 ms.** Work out once what doesn't change between redraws, and let animations stop in `destroy()`.
- **Draw the real thing, simplified, never a metaphor of it.** A demo of anti-aliasing draws pixels; a demo of interest compounding draws the balance growing.

`examples/anti-aliasing/widgets.js` is a full example: one demo (`pixels`) that four steps configure differently, and one animation (`motion`).
