# Why the lesson is built this way

Every rule in SKILL.md comes from the research below. Effect sizes are Cohen's d or Hedges' g, where 0.2 is small, 0.5 medium and 0.8 large. Checked 18 Nov 2026.

## How the page is laid out (Mayer's multimedia principles)

From [Mayer's 2023 summary](https://www.unh.edu/teaching-learning-resource-hub/sites/default/files/media/2023-06/itow-research-based-principles-for-designing-multimedia-instruction-mayer.pdf) of his research, as tests that favoured the principle out of those run, and the median effect:

| Principle | Evidence | What the kit does with it |
| --- | --- | --- |
| Temporal contiguity | 8/8, d 1.31 | Cues change the picture on the word that describes the change |
| Multimedia | 13 tests, d 1.35 | Words with an explanatory picture beat words alone, so most steps have one |
| Modality | 18/19, d 1.00 | Narration carries the explanation while the picture shows it |
| Personalization | 13/15, d 1.00 | Conversational writing with "you" |
| Coherence | 18/19, d 0.86 | No decorative pictures, music or interesting-but-irrelevant facts |
| Spatial contiguity | 9/9, d 0.82 | Labels on the parts, text beside its picture |
| Pre-training | 10/10, d 0.78 | Key terms on the intro screen, before step 1 |
| Voice | 6/7, d 0.74 | A natural voice; modern TTS matched a recorded human on learning ([Craig and Schroeder 2018](https://doi.org/10.1177/0735633118802877)) |
| Generative activity | 37/44, d 0.71 | Questions make the learner produce the answer |
| Signaling | 26/28, d 0.70 | The outline up front, statements as titles, key terms in bold, dot jots under each step |
| Segmenting | 7/7, d 0.67 | One idea per screen, moved through by the learner |
| Redundancy | 8/12, d 0.10 | Weak, and it reverses when the learner sets the pace and the text is short, which is why the page always shows the narrated words |
| Image | 4/7, d 0.19 | No presenter photo or mascot |

## Questions

- Quizzing with feedback: g 0.50 across 222 classroom studies ([Yang et al. 2021](https://scholars.hkbu.edu.hk/en/publications/testing-quizzing-boosts-classroom-learning-a-systematic-and-meta-/)). Hence a check on a few steps and a quiz at the end, each with its explanation right after.
- Questions before the lesson: g 0.54 for what they ask about, little for anything else ([St. Hilaire et al. 2024](https://doi.org/10.3758/s13423-023-02353-8)). The benefit comes from the surprise of being wrong ([Brod 2021](https://doi.org/10.3758/s13423-021-01904-1)). Hence predict-first only on key points where people guess wrong.
- Worked examples: g 0.48 in maths ([Barbieri et al. 2023](https://doi.org/10.1007/s10648-023-09745-1)). Hence real numbers in every step's example.

## Examples, stand-out facts, dot jots and memory aids

- Illustrative examples help people learn abstract concepts ([Rawson et al. 2015](https://doi.org/10.1007/s10648-014-9273-3)). Hence a named, real-life example in every step.
- Curiosity improves memory for the answer, and even for unrelated things seen while curious ([Kang et al. 2009](https://doi.org/10.1111/j.1467-9280.2009.02402.x), [Gruber et al. 2014](https://doi.org/10.1016/j.neuron.2014.08.060)). An item that stands out from what's around it is remembered better, the von Restorff or isolation effect ([Hunt 1995](https://doi.org/10.3758/BF03214414)). Hence 1 to 3 stand-out facts, each set apart in a callout.
- Working memory holds about 4 chunks at once ([Cowan 2001](https://doi.org/10.1017/S0140525X01003922)). Hence 2 to 4 dot jots per step, which also signal the step's structure at a glance.
- First-letter acronyms helped students on the exam questions they covered ([Stalder 2005](https://doi.org/10.1207/s15328023top3204_3)), but memory aids only suit some material, which is why a review of study techniques rated the keyword mnemonic low in usefulness ([Dunlosky et al. 2013](https://doi.org/10.1177/1529100612453266)). Hence a memory aid only for a fixed set of 3 or more things, and at most 2 a lesson.

## Length and speed

- In 6.9 million edX sessions, the median time spent on a video was at most about 6 minutes whatever its length, and videos past 9 minutes were usually left before halfway ([Guo et al. 2014](https://up.csail.mit.edu/other-pubs/las2014-pguo-engagement.pdf)). Hence at most about 900 words of narration.
- Students who watched at 1.5x and 2x scored almost as well as at 1x (about 25 against 26 out of 40), and worse at 2.5x ([Murphy et al. 2022](https://newsroom.ucla.edu/releases/learning-while-speed-watching-class-videos)). Across 24 studies, up to 1.5x costs about 2 points and 2x or more costs more. Hence 1x by default, 0.75x to 2x on offer, and "review" on anything above 1.5x.

## Demos

- Only a fraction of readers interact with interactive articles, so a demo has to work as a picture first; predicting before the reveal and controlling the pace have evidence behind them ([Hohman et al. 2020](https://distill.pub/2020/communicating-with-interactive-articles/)).
- Unguided exploration works worse for beginners than guided instruction ([Kirschner et al. 2006](https://doi.org/10.1207/s15326985ep4102_1)). Hence a starting state that shows the point, at most two controls and cues from the narration.
- Teach one mechanic at a time and give the reader a goal ([Nicky Case](https://blog.ncase.me/explorable-explanations/)). Bartosz Ciechanowski's articles put one demo, usually with one slider, right after the paragraph it illustrates ([mechanical watch](https://ciechanow.ski/mechanical-watch/)).

## Voice

| Option | Quality | Cost for a 900-word lesson | Word timing |
| --- | --- | --- | --- |
| Kokoro-82M on fal.ai (the default) | 1060 on the Artificial Analysis arena | about $0.12 | estimated from each sentence's length |
| The browser's own voice (no key) | not ranked; the classic macOS voices sound robotic | free | from the voice's word events |
| ElevenLabs Flash v2.5 or v4 Turbo | 1075 / 1341 | about $0.24 | exact, from the with-timestamps endpoint |
| OpenAI tts-1, gpt-4o-mini-tts | 1086 / not ranked | about $0.09 | none |

OpenAI's speech models shut down on 6 Jan 2027 ([deprecations](https://developers.openai.com/api/docs/deprecations)), so the kit doesn't use them. ElevenLabs would be the upgrade with exact word timing if a key is ever added. Running Kokoro locally is free, but it needs Python 3.10 to 3.13, torch and a 327 MB download, which is too heavy for a skill that should just work. In Chrome, the "Google …" voices send no word events and stall on long sentences, so the page reads one sentence at a time and prefers a local voice.
