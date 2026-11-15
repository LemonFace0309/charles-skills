# noise-cancel: a complete 37 s reel, one running example

How noise-cancelling headphones work, carried on the viewer's headphones on a night flight. Our own script; it ships silent and `words.json` drives every timing. Colours: the hum is the cool secondary, the headphones' inverted wave the amber accent, silence white, also in the caption pills (`lib/colors.js`).
Final check: hook 6.5 (first event 0.80 s), 1.81 events a second, no static run, no lull, no dark frame, no dangling chunk, layout audit clean.

| s | shot (in) | on which words, what happens | the rule it shows |
|---|---|---|---|
| 0 | `hero` | frame 0: headphones on the tray, sunset line behind; glint; "cancelling": mic rings, LED, amber rings | hook: lit beauty shot, paradox headline, camera moving, event by 1 s |
| 1.26 | `cup` (zoom), `hook` (zoom out) | into the cup cut open over the ear; "adding more sound": the amber wave flattens the hum | 3-stage dive by 2 s, then the claim square-on |
| 3.88 | `cabin` (zoom out) | crane from the tray to the cabin; "hums": rings over the seats; "80": 80 dB | stay in the world; a hero number over the scene that makes it |
| 7.52 | `air` (whip), `mic` (zoom) | "squeezing", "stretching": air parcels bunch and spread; "catch": the wave goes into the mic | literal first; one change per word; a label on the part named |
| 13.28 | `chip` (zoom) | "flips": the copy turns over, amber; "squeeze becomes a stretch": crest over trough | teaching frame: two states, square-on, held 1.5 s, real camera move |
| 17.60 | `ear` (whip) | follow the amber front from the driver to the drum; "cancel": one white line, the drum stops | follow move; the mechanism's clearest frame; arrivals keep a hold alive |
| 24.66 | `changing` (light), `adjust` (zoom) | chapter two; "adjust": the copy becomes steps rewritten by sweeps; "50,000" /s | light for a chapter; a sub-label that adds meaning |
| 29.70 | `voice` (zoom out) | "flight attendant's": the call-button figure lights; "voice": it travels down through the headphones | a real in-world object for a person; whip-tilt follow |
| 32.28 | `ending` (whip) | hum vs voice; "waves": one wave each; "delay": late amber copies; "ruins": flat vs not; home to frame 0 | two states; payoff on the running example; the reel loops |

Files: `project.json`, `words.json`, `plan.md` (beats, and the fixes review made: keep them), `lib/cabin.js` (cabin, world-anchored night sky, call panel), `lib/section.js` (ear and cup in one section plane, `curveWave` for a wave along any curve), `lib/chip.js`, `lib/colors.js`, `shots/*.js` (one per row), `out/final.sheet-p1.jpg` and `-p2.jpg` (the final, one frame a second).
