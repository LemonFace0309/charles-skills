# Objects

How to make the photographed objects the cards stand on: which model, the prompt, the states, placing them, and what to reject.

## The model

Pick it fresh each time, because lineups change every few weeks:

1. Check the date.
2. List what fal has for text-to-image (`https://fal.ai/api/models?keywords=<name>`). On 22 Nov 2026 the newest top models were GPT Image 2.6 (`openai/gpt-image-2.6/flare/text-to-image`, 4 Nov 2026), Seedream 5.5 and Nano Banana 2.1.
3. Use one that renders a transparent background itself (GPT Image 2.6 takes `background: "transparent"`), so no cut-out step blurs the edges.
4. Record the model and the date in `gen/jobs.jsonl`. `kit/fal_gen.py` does that for every job.

The key is `FAL_KEY` in the repository's `.env`. The script reads it without printing it.

## The prompt

A studio product photograph, never an icon:

> Studio product photograph of a real [object, exact: material, finish, wear], [its state], [view: head-on, three-quarter, from above], softbox key light from the upper right, [a rim light if it helps], realistic materials and natural imperfections, isolated object on a transparent background, no text, no logos.

- **Name real materials and real wear:** cast iron with rust freckles, kraft paper and cotton twine, brass with fine scratches, felt with visible stitching, a poured wax seal.
- **Keep the light the same across the set** (softbox from the upper right), so every object belongs to one shoot.
- **Never ask for "a premium game icon", "toy-like" or "candy".** That wording made the first set (a lacquered chest, a candy-glass flame), which the critic called a mobile-game ad.

## States

When the card needs an object in two states (a happy plush and a sad one, a candle and the same candle frozen in ice, a flame and the same flame in ice), make the second with the edit endpoint (`openai/gpt-image-2.6/flare/edit`) from the first image. Start the prompt with "The exact same [object], same shape, colour, material, lighting and framing, but [the change]". Two separate generations drift apart.

- **Words on an object:** GPT Image 2.6 engraves and prints short words cleanly, such as birch blocks engraved Sleep, Focus and Calm, or a desk calendar printed THU 20. Make the variants with the edit endpoint from the first, changing only the word, and they line up exactly. The 20 Psychology Principles calendar's THU and MON images share every edge, so Thursday's page is clipped from one and torn away over the other.
- **Fix a wrong detail with an edit, not a new generation:** the alarm clock read 10:10 under "8:00 AM" (round 3's critic), and one edit set its hands to 8:00.

## Placing them

- **Resize each to 512 px** (`<name>-512.png`). That's plenty for a card drawn at 2x.
- **Measure each object's visible bounds** with `kit/bbox.py` (fractions of the image). Stacking (an arch on two cubes), dropping into a cup or resting on a floor shadow all need the real edges, not the image's.
- **Measure what you place things on or in:** an envelope's opening (the card slides out above it and hides below it), a step's top (where a meeple's feet go), a pin's enamel (where a glint runs). The 20 Psychology Principles cards measured each from the photo's pixels before placing anything.
- **When code fills part of an object** (a Polaroid's window, a calendar's page, a screen), ask for the object straight on and square to the frame, then measure that part's bounds (its dark or white pixels) and fit the content to them exactly. A tilted print put the stat off-register, with the window showing on both sides (round 3).
- **Look at every object on a mid-colour background before you use it.** Reject:
  - garbled text or fake logos;
  - an extra or melted part;
  - a background that came back opaque;
  - a light from another direction;
  - anything that drifted from the set's material look.

## Cost and time

About 15-35 s a generation. Six run at once (`kit/fal_gen.py` uses a thread pool). A full set of 20-35 objects, retries included, took under 10 minutes.
