# Hill-climb

How to get from "much more interesting" to the reference: directions first, then rounds judged by fresh critics, each round logged.

## Explore before you build

- **Prototype three different directions on two or three lines.** Vary the stage, the material and the move, not just the colour. Render them side by side at 0.3 s and at the end pose, over a frame of my footage, with `kit/sheet.sh`.
- **Your own synthesis can be a fourth direction.** Name what each one does better than the others.
- **The 20 Psychology Principles run tested:**
  - d1, Night Widgets: a dark stage with glowing gradient tiles;
  - d2, Object Studio: a colour field, a giant number behind and 3D game objects;
  - d3, Lit Phones: two phones and a spotlight;
  - d4, my synthesis: a colour world per card, a graphite Before tile and an object doing the move.

  Round 1 rejected d3 as unreadable and d2's game objects. Round 2 compared d4, the critic's own proposal (d5, a cobalt stage with lit widgets) and d6, photographed objects, one colour family and a landing light. d6 became the system.

- **The scores across the 20 Psychology Principles rounds** (closeness to the reference, out of 10):
  - Round 1: d1 5, d2 4, d3 3.
  - Round 2: d4 3, d5 4, d6 5.
  - Round 3 (d6 with its critic's fixes, on all 20): 4.5.
  - Round 4 (lit objects, four layouts, cream grounds, three-word Afters): 4. Its sub-scores rose (instant read 5 → 6, principle clarity 6 → 6.5, system 6 → 7), while craft held at 4 and the moves fell from 5 to 4.
  - Round 5 (objects instead of UI widgets, thin, dot-matrix and mono type for numbers, plain Befores): 4. Craft rose from 4 to 5 and the instant read from 6 to 7, while closeness held.

  Every round, the critic's single most wrong note was a system-wide choice: game icons, then the moving light, then nothing sitting in light, then a default UI loader, then a card whose After was only a louder version of its Before. Fix those before touching any one card.
- **What stopped it:** by round 4 every ask was about the system, not a card. The critic wanted a one-off composition per card, the reference's type range (thin, dot-matrix and serif type) and bespoke material UI instead of components. A shared Before | After frame across 20 cards has a ceiling against a library of one-off pieces. Decide early whether the job is a consistent card system or 20 one-offs, and say which to the critics.
- **Fresh critics re-anchor.** Each round's closeness score comes from a new judge, so track the sub-scores too: they show what a round actually changed.

## A round

1. **Brief a fresh agent.** Never the same one twice, so earlier scores don't anchor it. Give it the brief (what the cards are for, the 1.4 s phone read, the slot), the reference images, the sheets, and nothing about your own preference.
2. **Have it score each version 1-10** on studio craft against the reference, the instant read on a phone, principle clarity, the signature move and the fit as a 20-card system, plus an overall "how close to the reference".
3. **Ask for a list of problems,** each as "what I see → why it hurts → what it could be", biggest first, plus the single most wrong note.
4. **Fix the biggest kind of problem first:** the idea and the structure, then the materials and the light, then collisions and type.
5. **Re-render, re-sheet, and look yourself before the next critic.** Clipped words, labels under objects and white blow-outs show up on the sheet.
6. **Log the round in `DESIGN-LOG.md`:** the scores, the picks and what changed.

## When to stop

At the bar I named. "Like this reference" means a fresh critic scores it at least 8 for closeness, with nothing under 7 on the instant read.

Stop sooner if three rounds in a row don't raise the score. Then tell me what's holding it back and what it would take: usually a better idea for one card, or real photography instead of generated objects.
