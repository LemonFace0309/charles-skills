# Mark the change

Contents: Which mark · The timeline · Rules for every mark · Gold

A flip in place shows the before and then the after in the same spot, so nothing on screen compares them. Every flip whose difference is a still property (a colour, a size, a gap, a word, an alignment) marks the part that changes: red on the flaw in the before, then moving with the fix on my word as it turns green. A flip whose flaw is something the viewer watches happen needs no mark. Why: without a mark, anyone looking at the wrong part sees nothing change; the first blind read of the 20 practical design tips cards missed four changes.

## Which mark

Walk the tree from the top and take the first branch that fits.

```
What does my line say changes?
├── What happens when someone uses it (a second charge, a toast that leaves, a page that
│   jumps, a key that does nothing)
│   └── NO MARK: the event is the mark. The pointer or the finger that causes it shows where
│       to look, a ring opens on each click or tap, and after the fix the same action goes right
├── How parts line up (left, right, the baseline, digits lining up)
│   └── A GUIDE along each part's edge where it sits now, a zigzag or a step, that
│       straightens into one line as the parts land on it
├── How much space (padding, a gap, space above or below, line height, half the height)
│   ├── Space inside a filled part (a button's or a toast's padding) → a DIMENSION LINE
│   │   beside the part, outside it, shrinking or growing with the value
│   └── Otherwise → a BAND hatched over exactly that space, growing or shrinking with it
├── Where a part that's already there goes (away, apart, to the side, swapping places)
│   └── THE AGENT grabs it and carries it there on the word, its selection round it. In a swap
│       it carries one part, and the other glides into the place it left
├── How big one part is, or its shape (go bigger, a tighter radius, a bigger hit area)
│   └── THE AGENT selects it and drags its corner handle (or its radius handle), the new size landing on the word.
│       A part you can't see, like a hit area, shows as its selection box
├── What a part says (a button's label, a link's words)
│   ├── In one label (a word or a phrase) → THE AGENT selects it in its colour (a double-click
│   │   for a word, a drag for a phrase); the new words land in the selection, which resizes
│   │   to them and turns green
│   └── The same fix in several labels (every Title Case label on a page) → a box on each
│       wrong letter or word, shrinking onto its replacement
├── A colour across the whole subject (every gray in the app, every brand colour)
│   └── A SWEEP: build the subject twice and wipe the after across the before, left to right,
│       behind a line with a grip (grey while it waits, green once it moves), so for half a
│       second both sit side by side at its edge. The agent carries the grip, unless a card
│       next to it already has the agent
├── A colour, a fill, a stroke or a shadow on some parts (a series in a chart, the text on a
│   banner, icon strokes)
│   └── CORNER BRACKETS 6-8 px outside each part (round the shadow's reach, for a shadow), or
│       a ring round something small and round. A new colour on text or a surface sweeps
│       through it left to right; a shadow or a swatch changes in place. A stroke too thin to
│       see changing gets magnified first (SKILL.md, Magnify, then mark)
├── Which parts stand out (everything bold, two primary buttons side by side)
│   └── CORNER BRACKETS round the parts that lose their emphasis, turning green as they do
└── Something new appears (an empty state's next step, a missing label)
    └── CORNER BRACKETS round the old part, or round the empty place where the new one goes,
        growing round the new part ahead of it
```

- **Why an event gets no mark:** brackets round an event drew in while the pointer was still travelling and turned green a few frames after the fix. They read as tacky, and on some cards they were the only thing that changed on the word.
- **Why the agent moves parts itself:** a part moving under a pointer shows the cause with the effect, the way a designer moves a layer in Figma. A position, a size and a word have something on screen to take hold of. A space, an edge or a colour doesn't, so a mark shows it instead.

## The timeline

With the change at T (`markLife` in the kit):
- **It's on by T − 0.95, in red.** It draws in from T − 1.25, so a before shown for less than 0.95 s opens with it already there. An agent enters in the before on its own timeline (`agent-cursor.md`). Why: the editor can cut in anywhere in the before, and the mark can't wait for a cut it can't know.
- **It moves on the word, never before it,** on the fix's own curve, and turns green as the fix lands, between 45% and 65% of its progress (`markTurn`): the guide straightens as the lines land, the band shrinks with the padding, the brackets grow ahead of the new part. Why: its motion is the transition the eye follows, so it has to be the fix itself. Green that arrives first marks the unfixed design as right, and a slow blend sits in the muddy grey between red and green.
- **It holds green until T + 1.0 and is gone by T + 1.25,** so the after ends clean. An agent lets go when its part lands and fades 0.2 s later.

## Rules for every mark

- **One per flip:** one kind, up to 6 of it (SKILL.md, The frame budget). When the fix changes more than my line names (a swap moves two parts), mark what my line names and let the rest move unmarked. An agent's action is its flip's mark, so it gets no other.
- **It never covers what it marks.** A guide runs beside the edge, a band fills only empty space, brackets sit 6-8 px clear, and nothing tints what it encloses. Why: the viewer has to see the part change, not the mark.
- **It never looks like the UI.** Corner brackets, not a full or dashed box, which reads as a drop zone, an empty state or a border. Never a red ring round a field: it reads as a validation error. Never tint a part's own fill: red ends on a toast read as an error toast, and hatching on a black button reads as its colour. Why: in a blind read, every mark that looked like UI was read as UI.
- **It ends on what changed,** never on what stayed the same.
- **The change has to be visible before it's marked.** Within what's true, push the values to where the change shows at phone size: a gray tint of 3 to 7 levels a channel showed nothing even under a sweep, so use the visible end of the range. Show one subject magnified rather than two small ones. Then measure a pixel of the changing part in the before and after stills. Why: a stacking bug once left the one part that should change pixel-identical, and only a measurement caught it.
- **Red only on the flaw, green only on the fix** (the kit's `MARK`), with lines 2.5-3 px wide in the final frame. On a dark surface use the light pair (`dark: true`), where the dark pair vanishes. A sweep waits in grey and turns green once it moves. An agent's selection keeps the agent's colour; only new words or a new value land green.
- **It lives in the subject's box,** so it rides the zoom and the push-in. The agent and its selection live on the panel.
- **No words, numbers or arrows on it.** The code under the subject already carries the values, and the mark's motion does the pointing.

## Gold

`examples/clean-marks.jpg`: the 20 practical design tips cards (one left out for its stand-in name), a moment before and after each change, with every branch of the tree among them. Their scenes, when the claude-editing repository is present: `videos/practical-design-tips/explainers/scenes/tips.js`.
