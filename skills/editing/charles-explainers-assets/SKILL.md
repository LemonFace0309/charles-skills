---
name: charles-explainers-assets
description: "Builds the teaching visual for a line Charles explains in a reel: the real thing doing what he says, a before/after flip or side by side with a mark on what changed, a definition tab or an agent cursor, timed to his words and readable in the 1-5 s a viewer gets. Use when a reel explains a term, fix, technique, number or mechanism, or when charles-claude-editing asks for an explainer at a size."
compatibility: "Needs Bun, Google Chrome and ffmpeg (run bun install in <skill>/kit once). Written for Charles' reel pipeline: charles-claude-editing calls it with a slot, word times and change words. Works in any folder; inside the claude-editing repository it also reuses the hack-reel list kit, reelkit's tags.js and past videos as gold."
---

# Goal

Every line I explain gets one visual that a muted viewer understands in the time it's up: the real thing, doing the thing, changing on my word.

**Rich across time, simple within a frame.** Something new happens about every second (a pointer moving in, a state flipping on my word, the fix proving itself, the next asset), and each frame has one subject and one change; everything else waits its turn or gets cut. Why: each visual is up for 1-5 s in a card 270-390 pt wide, beside my face, the list and the captions. My notes have failed it both ways: too much at once ("too busy", "the texts go by too fast") and too little over time ("stale", "not engaging"). And my audience learned Hick's law, ease-out and the AI tells from me, so they notice when a visual breaks them.

This skill runs long. After a context summary or a restart, re-read this file and the project's `explain.json` before going on. The reel's layout numbers are in `<skill>/reel-spec.json` (charles-claude-editing owns them), and the notes behind these rules are in `references/history.md`.

# The contract

charles-claude-editing usually calls you after picking the layout. You get:
- **The lines:** what I say, the list term, the change word (the word the fix lands on), and word times once the take is cut. Before it's filmed, estimate 4.7 spoken words a second, counting code and numbers as said aloud (100vh is 4 words, 0.95 is 3) and adding 0.2 s at each full stop or question mark. With no change word given, take the word that names what changes or its cause, and note it.
- **The slot:** its design size, the band the viewer sees, the area text must stay inside, and where captions sit (`references/slots.md` has the ones in use).
- **The format:** list reel, hack reel, Day N levels or talking explainer.

Called on its own, take the lines from the script, estimate the times, pick the slot from `references/slots.md`, and say what you assumed.

You return:
- **One clip per asset** at the slot's design size, rendered at 2× and 60 fps, with no audio. Every line I explain gets at least one asset, and a long line more.
  - A flip is 9.0 s with the change at exactly 4.50 s, the before looping from the start and the after looping to the end, so the editor can slide it until the change lands on my word. The hack-reel editor slows the first second when my line's before runs past 4.3 s, so keep anything whose timing is the lesson out of that second (the push-in and the scene settling are fine).
  - Anything else is the demo's own run from its opening pose, looping where its form loops, with its main move's time in `explain.json`.
- **`explain.json`:** per line, the takeaway and the change word and time; per asset, its form and a one-line reason, its in and out times, every word shown with its times, and the cursor's actions; and click cues on the clearest changes, about four in 45 s at most, never on two lines in a row, inside the six sound effects a minute.
- **`check/phone.png`:** the phone check (below), from `kit/check.mjs`.

Whoever draws the card owns it. In the hack-reel card the list kit draws the card, its tab and the change between assets, from your `explain.json`; check what the editor draws in any other slot. Where clips are only laid end to end, each clip carries its own card, its tab and, in its first 0.12 s, the fade-through from the previous card; a slot rendered as one span (a Day N card) is yours too. Never yours: captions, music, sound, the list, title and timer, and where the slot sits. Never burn my spoken words into a clip.

# Workflow

1. **Beat sheet first.** Before building anything, write into `explain.json` for every line: the takeaway in 8 words or fewer, the change word, the subject (the real thing the line is about), and the form of each asset. Why: a line without a written takeaway gets decoration instead of an explanation.
2. **Pick the form** with the tree below, and give long lines their extra assets. For every flip, pick its mark with `references/marks.md`.
3. **Fit the frame budget** below.
4. **Build** with the kit (`references/kit.md`): the form from `references/forms.md`, the cursor from `references/agent-cursor.md`, every word from `references/text.md`. Copy the closest gold scene or `kit/example/`; never start from a blank page.
5. **Time it** to my words (Timing).
6. **Run the phone check.** Fix the largest fault first, re-render, check again.
7. **Hand over** the clips, `explain.json` and the sheet.

# Pick the form

A Day N levels reel skips the tree: every line is a level of the one live demo (`references/forms.md`, Levels). Otherwise take the first branch that fits.

```
What is the line doing?
├── Giving a fix ("Use X", "X looks sloppy, do Y")
│   ├── My line has no problem half (fix-first) → AFTER ONLY: the fix in action, tagged After
│   ├── The flaw shows in a still frame (radius, contrast, alignment, spacing, copy)
│   │   └── FLIP IN PLACE: one crop, the flaw, then the fix on the change word
│   └── The flaw is motion or timing (duration, easing, stagger, jank, spring)
│       ├── The versions differ only in feel (the same duration on another curve, a spring
│       │   against a tween, durations under 2× apart), on a simple element whose moving
│       │   part stays 40 px or bigger at half width, in a slot that doesn't tag its clips
│       │   Before/After (the hack-reel card does)
│       │   └── SIDE BY SIDE: both start on the same frame, labelled only with their values
│       └── Otherwise (600 ms against 200 ms, a pop out of nothing) → FLIP IN PLACE
├── Naming a principle or a law: a rule that one way works better than another
│   ├── The slot tags its clips Before/After and flips the tag (the hack-reel card)
│   │   └── FLIP IN PLACE, the change on the principle's name
│   ├── Its "without" version isn't a mistake anyone makes: it names a way of working,
│   │   not a better result (pose to pose)
│   │   └── DEMO + DEFINITION TAB
│   └── Otherwise → SIDE BY SIDE: the same component without the principle (left, Before)
│       and with it (right, After), running from the same frame, under the definition tab
├── Naming a term the viewer may not know ("Kerning", "OKLCH", "Tabular numbers")
│   └── DEMO + DEFINITION TAB: one move that shows the term, no Before/After; the tab says
│       what it means. A word most of my viewers already know gets the move alone
├── Claiming something about real products or AI output ("AI loves eyebrows")
│   └── THE REAL THING: a screenshot, a recording or the code itself, the claim marked in red.
│       A reveal shows the effect first and the evidence on the word that names the cause
├── Stating a number or a relationship no code on screen carries ("respond within 400ms")
│   └── MEASURE: a redline or a timeline on the subject, with the numbers
├── Explaining a mechanism ("the request reaches the server after")
│   └── CAUSE → EFFECT: the agent cursor or the trigger acts, the result lands, nothing else moves
├── Showing off a tool or effect rather than teaching it
│   └── SHOWCASE: its strongest real examples, 3-8 cuts of 0.5-1.5 s each
└── A joke, opinion, transition or call to action
    └── NONE: hand back "no explainer"; the editor decides what, if anything, replaces the card
```

Why: most of my lines are fixes, and a fix lands on my word, so the change itself is the event (a flip) and the subject stays full size. A principle is taught by its contrast: next to the same card without it, the principle is the only difference, and a 1-2 s list item leaves no time for a flip's before, change and after. A way of working (pose to pose) has no wrong version, so it gets one demo. In the hack-reel card the frame's Before/After tag flips, so a pair under one tag would be mislabelled. A side by side suits a fix only when the difference is in the feel, because nobody can compare two curves from memory. A term has no wrong version, so one move. Real beats a recreation, and a reveal shows the strange effect first because it's the question. A redline on top of code that already carries the numbers is a second label. And a visual on a joke steals the punchline.

# One asset per item, more for long lines

Every list item gets its own asset, with its own tab if it's a term: never shared, never skipped. An asset stays up 3 s at most, or 6 s for a flip, whose change is a new beat halfway and whose code is there to be read. When my line runs longer, cut to another asset at the start of a clause, never mid-word. Never cut for less than 1.2 s: the asset runs up to 1.2 s past its cap instead, because a new asset takes about a second to find. When the change sits late in my line, the extra asset may come first, as long as the flip's change stays on its word.

```
What does the rest of my line do?
├── Keeps describing one detail of the demo → the same demo, cropped in on that detail
├── Names where it's used ("every iOS sheet does this") → a real product doing it
├── Warns about a near-miss ("not tracking, kerning") → the near-miss, flipping to the right one
├── Says how to build it → the code alone, filling the card, its token changing on the word
└── Otherwise → the same idea on a second subject (a card after a button)
```

An item's tab stays up across its assets. A Day N level stays one asset however long it runs: its next beat is the next tag or cursor action in the same demo. Why: one loop playing for 8 s is a stale asset, and each new asset is a new reason to keep watching.

# The frame budget

Hick's law: the more there is to look at, the longer the point takes to find, and the viewer has 1-5 s. Per frame:

| Element | At most |
|---|---|
| Subject: the component, screenshot or diagram. It and its code fill the card, with no empty band wider than 10% of the card's width or height, laid out for the after (before the fix, the room its added code lines take doesn't count). A term card is cropped to its content. A side by side's two panels are one subject: the same component twice. The room a well keeps for its component's own move counts as filled | 1 |
| Glance text, read during playback: a definition tab, a principle tag, a measurement, or a side by side's pair of values | 1 |
| Pause text, for people who pause or screenshot: a code block or a property, 4 lines at most (a side by side's property under each panel is one) | 1 |
| Pointer: the agent cursor with its label, a plain pointer or a fingertip. More only when my line is about more than one agent, or in a side by side whose lesson is the pointing or the input (one per panel, moving together). A keycap that presses is a pointer | 1, or one per agent up to 4 |
| Events at a time. The code changing and the tag flipping on the word are one event, the fix; a side by side's panels running one trigger together are one event. The exception is agents working at once when that's my line's point | 1 |
| Kinds of mark: a flip's change mark or the red marks on a real thing, up to 6 of that kind | 1 |

Before/After labels are chrome, not glance text: the same two words in the same two places on every card, read once and then known by position. Everything else is cut: badges, meters, graphs, onion skins and traces (unless they're the lesson: the key poses in pose to pose, the path in arcs, the spacing in slow in and slow out, the tappable area in a hit area), lenses, speed tags, counters, verdict labels, titles, and devtools overlays. Why: viewers see the screen for a moment, so the component and its code is all there's time for; my first animation-hack clips carried all of these and were "too busy".

# Make it worth watching

Simple within a frame doesn't mean plain. A card is worth watching when its subject is real and in colour, its flaw happens for a reason and costs something, and the change is the best-made moment in the clip, never because of moves laid on top (a camera that punches in, a wipe, a cursor running to the code on every line). Why: one build of design hacks part 2 was "way too boring" (a small grey component that fixed itself) and the next "tacky" (punch-ins, wipes, colour-flipping brackets); the one that shipped kept the colour and the cost and dropped the rest.

- **Real colour.** The subject is a product with its own colour: album art, product photos, a brand panel, a hero image, a dark browser with colourful tabs. The UI keeps its one accent and the content brings the rest. A white or grey component on the grey ground is a wireframe. For cards that look like a studio made them, charles-studio-explainers adds a colour world and an idea per card on this same contract.
- **Fill the band:** the subject spans the band's width (the frame budget's 10% rule), drawn at the size where its copy reads at 20 px or more.
- **The flaw is an event with a cause.** A plain arrow on desktop UI, or a fingertip on touch UI, uses the product, and the flaw follows: a double click prints two receipts, a tap lands beside the x, a refresh flashes white. After the fix the same action runs again and goes right. The kit's `route()` takes the pointer's stops and `ring()` opens a ring on every click and tap.
- **One thing uses it:** one pointer, one device, one object per card. A touch that has to miss is drawn as its contact patch (about 25 pt), small enough not to overlap the target it misses: a fingertip-sized disc over the target's corner read as a tap on a dead button. Why: a laptop, a mouse and a phone on one card was "the busiest card with the smallest change".
- **Show the cost** on screen when the flaw costs the user something: the click that lands on a photo because the page jumped, a second charge, a toast that drops as the pointer reaches Undo. A cost is what makes a viewer care about the fix.
- **The change is the event.** From 0.3 s before the change word to 0.5 s after it, only the fix moves: no pointer travelling (unless it carries the change), the camera still, no mark drawing in.
  - A state blends in place (0.12-0.45 s), or the same element travels to its new place and size. Nothing wipes across the card, and nothing pops in one frame unless the flaw itself is a pop. Two layouts never cross-fade: the old words go before the new ones come.
  - Something in the UI changes within 0.4 s of the word, not only the code, and the payoff is that change: what a viewer would point at happens on the word (the duplicate receipt goes back in, the white page turns dark, the sinking toast stops). A button greying or a thin bar stopping is a label for the fix, not its payoff. If the payoff needs a state that isn't there yet, stage the before so it is when the word lands.
  - Nothing goes back on the word: no page reloading, no field cleared and retyped, no parts pulled back. Reset the scene at least 0.3 s before the word, and let the fix carry on from where the flaw left things. Why: a scene that rewound on the word read as the fix deleting what was typed.
- **The camera holds.** One slow push runs under the whole clip and nothing else moves the frame. Zoom only when the lesson is under 4 px in the final frame, and then once: settled 0.3 s before the change, never reversing, on `E.travel`, with nothing cut by the card's edge or the code block. Why: an ease-in-out zoom reads as a hard zoom cut with soft shoulders.
- **Pointers move like a hand:** a glide, a carried part and a page scrolling run on `E.travel` (the minimum-jerk curve), 0.25-0.45 s across the card, never `E.inOut`, which sits, snaps and sits.
- **The agent comes only where it changes the design itself** (it drags a hit area out, carries a part, retypes a label). When a plain pointer is already using the product, the code changes by itself on the word (`references/agent-cursor.md`). Why: one agent doing both jobs made up to five trips in 3.5 s.
- **Start at rest.** The editor cuts a flip in at the change minus my line's lead-in (`win.b`). The scene is in a clean pose there, from 0.3 s before it, and its first action starts 0.2-0.4 s later. Why: a hard cut onto a toast half-way down reads as a glitch.

Gold: `examples/gold-cards.jpg`, design hacks part 2's ten approved cards. Their scenes, when the claude-editing repository is present: `videos/design-hacks/design-part-2/explainers/scenes/src/`.

# Timing

- **The fix starts on the change word:** the code or the control changes within one frame of the word's first sound, and the component shows it at once (a state) or on its next run within 1.0 s (a motion). When the agent has to move to run the proof, it leaves at T + 0.5 s and the proof starts as it arrives. Why: my voice tells the viewer when to look; early reads as a glitch and late as lag.
- **Text enters 0.2-0.45 s before the word it explains** and stays for the line; in a list, where the term opens the line, it enters on the cut. Why: it needs a head start to be read while I say it.
- **The flaw happens on screen by 0.6 s into the line,** through its natural trigger or one camera push. Never a still before: my voice is naming a problem.
- **The after runs at least 1.0 s at reel speed** and includes a proof beat: the same interaction again, now working. If my line leaves less, ask the editor for a hang of up to 0.5 s, never a clipped word.
- **Short items** (a line under 2 s, and every item of a list whose lines mostly are): the main move starts within 0.15 s of the cut and is done by 0.6 s, then the end pose holds under the slow push-in. A flip changes on its word instead and is done 0.45 s after it (a sweep 0.55 s). No loop, no proof beat, and the agent only when its action is the change itself. Why: a replay mid-item reads as a glitch. A short side by side follows `references/forms.md`.
- **Every main move finishes 0.25 s before the next line starts.**
- **Demos play at real speed and loop about once a second,** holding the start pose 0.25 s and the end pose 0.4 s, so a 200 ms move is seen four or five times. Never slow a demo whose lesson is timing or feel: slowed down, the fast one looks sluggish. The exception is a line about a path's shape (arcs, squash and stretch), which may run at 0.5× with both versions at the same speed.
- **Never stale.** Something is always moving: the demo, the cursor, a transition or, when nothing else is, a linear push-in on the whole subject from the cut (2% a second on an asset up for a second or two, 0.6% on one up for more than 3 s, under 4% in all). Nothing sits frozen for more than 0.6 s, and no more than 1.5 s passes between one new thing ending and the next starting. A loop's repeat, or the same action giving the same result, isn't new; an action is new when its result differs. Why: a frozen picture under my voice reads as dead air.
- **Between assets in one card,** the same object at a new state morphs (shared parts glide and resize); a new subject fades through (the old one goes in a frame, the card reshapes, the new one comes in from 97.5% scale). Never a cross-dissolve: its double exposure is unreadable at phone size.

# Mark the change

Every flip whose difference is a still property (a colour, a size, a gap, a word, an alignment) marks the part that changes, red on the flaw in the before, moving with the fix on my word as it turns green. A flaw the viewer watches happen is its own mark. `references/marks.md` has the tree that picks the mark (a guide, a hatched band, a dimension line, corner brackets, a sweep, or the agent moving the part itself), its timeline and its rules. Why: without a mark, anyone looking at the wrong part sees nothing change.

# Words on screen

Every word on screen adds something I don't say: what a term means, the value that changed, the principle's name, the code to copy. Never my own words back (a "Layered shadows" tag over "layer the shadows"), and never a sentence.

- **Reading time:** aim for 15 characters a second the text is fully on screen, never over 20. A 1.2 s list item has about 1.1 s fully on screen: 16 characters, 22 at most. Why: subtitles cap adults at about 17-20 a second with nothing else to watch, and here they also watch the demo.
- **Every term keeps its tab.** Cut the definition to the shortest true gloss that fits. If nothing true fits, ask the editor for more time on that item; if the cut is fixed, use the shortest true gloss and flag its rate in `explain.json`. Give the editor the full definition for the post caption.
- **Sizes, in the final 1080×1920 frame** after the slot's scale. Text that can't reach its size is dropped, not shrunk.

  | Text | Size | Why |
  |---|---|---|
  | Anything the viewer must read | 26 px or more | About 9 pt on a phone |
  | A definition tab; a feel side by side's two values | 30 px, the tab bold | The clip's glance text, read during playback |
  | Before/After labels, over a side by side's panels or as a state tag a clip draws itself | 24 px | Chrome, read once and then known by position |
  | A number that stands alone | 40 px | It's the subject |
  | Code | 24 px | Its changing token is highlighted; the rest is for people who pause |
  | A component's own copy that's part of the picture | 20 px | Copy that carries the lesson (the value that changes, the error) is must-read: 26 px |
- **Contrast:** 4.5:1 or more against what's directly behind the text, on its worst frame. Text dimmed on purpose as the lesson is exempt; text the viewer must read never is.

`references/text.md` has the definition tab, the code block, tags and the other captions.

# Look

- **The real thing:** a real-looking component from a real kind of product (a checkout, a settings page, a chat), with real copy, at its real CSS size and magnified as a whole; a real screenshot when one exists. Never grey bars or a wireframe. Names in the copy are Charles (charles@example.com), never a stand-in like Maya. Why: real reads faster than abstract, and "use the real thing over a recreation" is my editing rule.
- **The demo runs on the values it teaches:** the real 150 ms ease-out, the real 0.97, exactly the CSS in its code block. My audience copies them, and some check.
- **Performance flaws are reproduced on the render's clock:** hold frames at the rate the flaw really causes (a new frame every 33-83 ms), because a frame-stepped render never drops one.
- **Colour:** one calm neutral ground per reel (the hack reels use #e6e9ee), one accent for the UI, red only for the flaw, green only for the fix, each agent's colour on its cursor and what it selects. The content's own colour (album art, photos, a brand panel) and the code's syntax colours don't count. Why: colour carries meaning on the controls and the marks; the accent rule was never a reason to keep a card grey.
- **None of my own AI tells:** no cream backgrounds, monospace eyebrows or "01/10" labels, pills, badges, gradient backgrounds, glows, emoji or section numbering. I made a reel listing them, and my audience watched it.
- **Same chrome, different subjects:** the card, tab, Before and After labels, code block and cursor look and sit the same all reel; the subjects alternate (type, interface, motion; desktop, phone, close-up) so neighbours never look alike.
- **Magnify, then mark:** when the difference is under 4 px in the final frame, crop tighter or zoom the whole subject first. Never a lens or a callout bubble.
- **Render at 2×** and scale down once: 1080-wide cards' small text looked soft in Photos.

# Phone check

Before handing over, for every clip. Each check names the fault it catches; these are the faults that came back.

1. **Sheet** (`kit/check.mjs`): frames at mid-before, 0.1 s either side of the change and mid-after (with no change: the opening, the middle of the main move, the end pose), the tab or state tag drawn on, shrunk to the slot's width on a phone (its final width × 0.36, about 270 pt for the hack-reel card). The flaw shows before and the fix after, and every word reads. A still flip has its red mark on the part that changes, green on the fix, and no mark looks like UI (`references/marks.md`).
2. **Muted glance:** write in one sentence what changed, reading the line as frames 0.06 s apart (`kit/glance.mjs`). If it doesn't match the takeaway, fix the visual, not the sentence. For a fresh read, give the sheet to a subagent that hasn't seen the script and ask what changed.
3. **The change, frame by frame:** for a flip, every frame from 0.2 s before the change to 0.7 s after it, 1/30 s apart (`render.mjs --stills`). Only the fix moves: nothing pops or wipes, no pointer travels, the camera holds, two layouts never show at once, and nothing goes back. Why: everything that read as tacky lived in these frames, and coarser grids showed none of it.
4. **Budget and pace:** count each frame against the table: one subject, one pointer per agent in my line aimed off the text it changes, nothing from the cut list. Scrub for a flaw that hasn't happened by 0.6 s into the line, any stretch over 0.6 s with nothing moving, over 1.5 s between new things, one loop held through a long line, a side by side whose panels end alike and hold, or a dissolve between assets.
5. **Words:** reading time, sizes and contrast, measured with `kit/words.mjs`; say why anything it lists apart passes, or fix it. No word repeats my line, and code is the full recipe at 24 px or more, never a chip with half of it.
6. **Truth:** the code is complete and is what the demo does, the values are real, and nothing claims what I didn't say.
7. **Safe area:** everything the viewer must see is inside the slot's text area and band (`references/slots.md`).
8. **Gold:** put a frame beside the closest gold sheet in `examples/`. If yours is smaller, emptier, busier or greyer, that's the first fix: a real subject in colour filling the band, a flaw a pointer causes, its cost, and for a principle the same component without it beside it.
