---
name: charles-reel-plans
description: "Plans one of Charles' reels before he films it: tears down the reference, writes the script in his voice, sources real assets with licences, writes the caption and credits, picks the music, writes the edit's plan, and publishes a plan page with a moving mockup. Use when he gives a video idea or reference and wants the script, assets, caption or a mockup before filming, or a plan page updated."
compatibility: "Needs Python 3 with Pillow and NumPy, ffmpeg and ffprobe, Google Chrome or Chromium, and Node 18+ with playwright-core for kit/playtest.mjs. Publishing the page needs the Artifact tool, and tearing down an Instagram reel needs a browser tool that runs JavaScript in the page. Captions are measured in macOS's Helvetica Neue (estimated elsewhere). Uses the claude-editing repository's formats/, templates/video/ and assets/music/ when it runs there; works in any video folder without them."
---

# Goal

Charles gives you an idea, and usually a reference. You give back everything up to the camera: the script he reads, the caption with its credits, the real assets with their sources, the music, `edit/plan.json` for the session that edits his footage later, and a link to the plan page, where the reel plays as a moving mockup over its music, beside the script, the caption options, the assets and the references. He reads the script, films and sends the footage. The one thing you may ask him for is his own angle on the topic, when charles-scripting-voice needs it (step 5).

Why: he judges a reel on his phone before he films it, often away from this computer, so the plan has to be a published link, and the mockup has to play its music to feel like the reel. The edit can only follow his taste if the plan already says, line by line, what's on screen and where.

This skill runs long. Every step ends in a file, so after a context summary or a restart, re-read this file and the video's README.md and `research/` notes, then carry on from what's on disk.

In the claude-editing repository, `videos/evolution-of-design/` is a finished list reel to copy from: its PROCESS.md records the run this skill came from. Where the rules came from, with his own words, is in `references/history.md`.

# What you make

In the video's folder: `videos/<video>/` copied from `templates/video/` when the repository has that template, else the folder he names (or `videos/<video>/`) with these files:

| File | What it holds | Who reads it |
| --- | --- | --- |
| `SCRIPT.md` | What he says and nothing else, in his notes' format (step 5) | Charles, to film |
| `edit/plan.json` | Every line in order with its on-screen text, its asset and where that sits, plus the hook, the music and the caption (`references/plan.md`) | The kit, and the session that edits |
| `assets/<dir>/<group>/` | The real images, with `sources.json` beside them | The kit, the edit and the credits |
| `research/` | `REFERENCE.md` (the teardown), the research notes, `ASSET-BRIEF.md` | You, and the next video in the format |
| `README.md` | The brief, the files, the published link, the caption ready to paste, what's checked | Everyone |
| The published page | The player: the reel over its music, a little short of the window's height, a play bar with full screen at its end, the **Safe area** and **Instagram UI** toggles, and the music under them. Then **Script** (SCRIPT.md as written, each line jumping the reel there), **Caption** (each option with Copy), **Assets** (each asset as the reel shows it, with its source and licence) and **References** (every post, reel and video the plan came from, linked, with what it gave this video) | Charles, on his phone |

`kit/page/` builds exactly that page. Never add panels, labels or menus around the player: clutter there is what made the early pages hard to judge, while the sections and both toggles are what he uses.

# What every plan respects

The rules are charles-claude-editing's, and they win wherever this skill disagrees. The numbers are in `<skill>/reel-spec.json`, an identical copy of that skill's. A plan follows them because the mockup is only worth judging if it shows the reel the edit will make. When charles-claude-editing isn't installed, reel-spec.json and this list are the rules.

`kit/build.py` measures everything marked ✓ on every build, with reel-spec.json's numbers, and prints what fails:

- **Safe area** ✓: captions, the hook and a list reel's list stay inside `text_inset`, out of the `platform` header and bottom zone, and clear of its button column. Footage and pictures may run under all three.
- **Captions** ✓: no more words a line than `captions.words_per_line`; never on his face unless everything behind is blurred (an asset at the caption line can push them up to right under his mouth, never onto it); never over an asset; words TikTok blocks censored as s*****e, in captions and the hook. A list reel's list is its captions, so only its sign-off gets word captions.
- **Hook** ✓: only when he asks for one; two lines at most; up for his first sentence, 3-5 s. It raises the stakes and opens a question the reel answers. A label for the topic doesn't, so when nothing does, leave it off or use "<Topic> for dummies".
- **Assets** (✓ for sharpness and size): the real thing, never stock or AI-made unless AI art is the subject; sticker-sized so he stays on screen, except tweets, recordings and code, which have to be big enough to read; always whole, with no black bars, rounded corners, pop-ins or emoji tiles; web pages in dark mode from their visual part; anchored on pop culture the viewer knows.
- **Behind an asset** ✓: an asset over his face takes everything behind it out of focus (`"backdrop": "blur"`, the editing skill's overlay with blur; `spotlight` has it by default), so only the asset and the captions stay sharp. An asset without one stays off his face. Why: a list still sharp over a face that's gone reads as a mistake. `references/plan.md` (Backdrops) keeps the table.
- **Timing** ✓: `pacing` in reel-spec.json: nothing on screen unchanged past `max_without_new_s`, and no still up past `max_still_s` across the lines it stays up for, unless it's a tweet or code he reads or the payoff he's talking about (`long_ok`). A layout that covers his face comes off within `face_covered_max_s` unless he's reading it, and a long list is proof, not reading: 1-2 s with a fast scroll. Most stills move, so give the line a short clip with its push-in, pan or cuts made in, since the page draws a still as it is. Back-to-back assets are hard cuts.
- **Music** ✓: a track from a mood folder of `assets/music/` when the repository has one (chill, emotional storytelling, funny, motivational, suspenseful, upbeat, wholesome; exposés and serious news get suspenseful), else the track he gives you, held `audio.music_under_voice_db` under his voice.
- **Sound effects** ✓: each in its line's `sfx`, within `audio.sfx_per_minute_max` and `audio.meme_sfx_per_reel_max` (a meme sound only on a punchline).
- **Type**: Helvetica Neue only, because native-looking type reads as made on his phone. A list reel's title is Medium 56, its subtitle Regular 40 and its list Bold 30, and its stopwatch (digital-7 mono) is the one other face.
- **Export**: the `export` sizes, by whether anything on screen carries small text. Write which in the README.

# Steps

Walk all eleven in order. Each ends in a file.

## 1. Read the rules, then set up

- Read `<skill>/reel-spec.json`, and charles-claude-editing in full when it's installed. Why: the plan is the edit's first draft, and anything in it that breaks an editing rule is work the editor has to redo.
- When the repository has them, read `AGENTS.md`, `formats/README.md` and the playbook of any format the reference matches, then copy `templates/video/` to `videos/<video>/` (lowercase words and hyphens). Otherwise make the video folder with the files in What you make.

## 2. Tear the reference down

```
What is the reference?
├── One of his own reels → when its source is in the repository (videos/<...>/edit/*.json and its tools/), copy the
│   layout numbers from the code: title size and position, list rows, colours, timer, collage zone. Then confirm on the
│   posted reel. Without the source, time it from the posted reel, as below
├── Someone else's reel → open it in a browser tool that runs JavaScript in the page (Claude in Chrome is the one
│   signed in to his Instagram). Read the caption and counts from the page text, find the <video>, set its currentTime
│   and screenshot the first frame, the last and one per beat. Time every beat. With no browser tool, ask him for the
│   video file or a screen recording
├── A post, thread, carousel or article → it's the idea, not the structure. Collect every card or image in it (on X,
│   the pbs.twimg.com/media images, returned as media ids only, since Claude in Chrome refuses output with URL query
│   strings), who made it and how they credit others. The structure then comes from a format (step 3)
└── No reference, only an idea or a source of facts → skip the teardown. The format is the one he names, or "talk"
    (step 3). Credit a fact source in the caption only when it's one person's work; a Wikipedia article isn't
```

Write `research/REFERENCE.md`: each beat with its time, its words and what's on screen, the layout numbers, and who to credit and how. Why: numbers from code are exact where eyeballed ones drift, and a teardown on disk outlives the session. Copy a reference's structure, pacing and kind of B-roll, never its caption style (charles-claude-editing).

List every reference in `edit/plan.json`'s `references` as you find it, not only the one he gave: the post or reel the idea came from, the reel whose structure it borrows, where that format started, and any other tweet, reel, TikTok, video, article or repo that changed a line or a visual. Each gets its `url`, `title`, `by` (name and handle) and `why` (what it gave this video, in a sentence), plus `stats` (the counts and the day you read them) when you have them. A still of it (`image`) is optional: a screenshot or contact sheet already in `research/`, never someone else's video, and never committed when it's someone else's post. Why: the page's References section is built from this list, so he can open everything the video came from on his phone, and the caption's credits (step 8) come from the same list.

## 3. Pick the format, then each line's layout

```
What structure does the reference have?
├── Items said one after another against a timer ("20 ___ in under N seconds") → "list" (its playbook is
│   formats/list/README.md when the repository has it): a fixed title and subtitle, a two-column list that is the
│   captions, the red stopwatch, 2-4 real images under his chin per item, a sign-off question
├── It matches another row of formats/README.md (when the repository has one) → that format: its playbook's fixed
│   lines and layout, as plan beats
└── Anything else → "talk": captions and one asset per line in one of the layouts below. Add a TikTok-style hook title
    over the first sentence only when he asked for a hook
```

Give each line of a talk reel a `place`. These are charles-claude-editing's layouts; `references/plan.md` has their boxes:

```
What does this line show?
├── Nothing new, and the last asset went up less than pacing.max_without_new_s ago → no visual, captions only
├── A photo, logo, product, meme or small screenshot, wider than tall → "below" (between his chin and the captions,
│   780×270 by default) or "above" (over his head, 780×430), sticker-sized. Use "above" when his face sits low
├── A portrait asset (a phone screen, a tall post) → "spotlight", or a split. "below" would draw a phone 137 px wide
├── Something big that has to be seen whole (a long post, a chart), or a list he reads out → "spotlight"
├── A tall video or a phone recording → "split", seam 936, the asset on top
├── A landscape video or a desktop recording → "split", seam 768 (the 40/60 split)
├── Immersive B-roll that replaces him → "screen"
└── A list reel's item → "under-chin": the item's collage (step 7)
```

Split a sentence into beats at its phrase breaks, so no still stays up past `pacing.max_still_s` and nothing on screen goes `pacing.max_without_new_s` without changing. Each beat's `say` is its phrase, and SCRIPT.md keeps the sentence whole for him to read. Never cut a word to make a beat fit: charles-scripting-voice keeps his small words ("which is", "so") on purpose. Why: his sentences run 15 to 35 words, longer than either limit.

## 4. Research the content

- Find a date and a source for every claim and every item. Search the web for anything after your knowledge cutoff, and write down in `research/` what you searched and what you found.
- Leave out anything political. Why: Instagram stops recommending a reel to non-followers once it reads as political.

## 5. Write the lines and fit them

- Write every spoken line with charles-scripting-voice, which Charles asks for on every line he says. Its fixed format lines win. When a line needs his own angle (what he uses, built or thinks) and you don't have it, ask him in your reply and leave `<his angle>` in that line of SCRIPT.md. Never invent one. Without that skill, write plainly, the way his earlier SCRIPT.md files read, and say so in the README.
- SCRIPT.md is what he reads and nothing else, laid out like his scripts note: the title in bold, `Text hook: <the hook on screen>`, then the lines he says, then the sign-off on its own line. A list reel numbers its lines (`1. Squash and stretch.`), each with a full stop, and starts the last with "And" ("And frequency of use."). A hack or explainer reel opens with its intro line, then gives each item its on-screen label in asterisks (`*Alpha borders*`) with the sentence he says under it. A roundup adds `GitHub:` and `Example:` lines under each label. No years, timings, screen notes, pronunciations or production notes: those go in `edit/plan.json` and the README, which replaces charles-scripting-voice's screen notes in angle brackets. Why: he reads it straight off his phone while filming, and anything that isn't a line he says is in the way.
- Put on-screen text that isn't his spoken words in the plan: a list label in `label`, the hook in `hook`. When a word is said differently from how it's written, `say` holds the spoken form and `label` the written one ("Glossy web two point oh buttons" and "Glossy Web 2.0 buttons").
- A list label is at most 5 words, and the list has to fit: `kit/build.py` measures every label in Helvetica Neue Bold and stops, naming the widest, when the list runs into the side insets or the button column. Shorten that label, or narrow `number_width` (49 px for item numbers, 77 for years) and `col_gap`. At 30 px the two columns' widest labels share about 800 px, so three-word labels rarely fit and most labels are two words.
- A label names the one moment its item is remembered for, when it has one ("iOS 7 kills skeuomorphism", "Google's Material Design"). When it doesn't, it lists the item's two or three most recognisable things, the ones its asset shows ("Cybertruck, Slack's logo", "Angry Birds, Minecraft"). Never a style made up by joining a thing to a trend ("Cybertruck brutalism"), a trend stretched from one example ("Logos lose their serifs", from Google's one logo), or one feature standing for a whole year ("Facebook's Like button"). Why: a made-up label is a claim nobody recognises, and one feature can't stand for a year.
- Pick what people remember as design: a redesign, a launch, a tool, a product's look. Never a show or a meme whose design isn't what it's known for (Stranger Things, for 2016, became Figma's launch). Why: the reel's claim is about design, and a pick known for something else weakens it.
- The list on screen stays short. When a name alone doesn't bring back what happened, the line he says adds it in a few words: on screen "Cybertruck, Slack's logo", said "Cybertruck, the Slack logo roast". `label` holds the short form, `say` and SCRIPT.md what he says. Why: a short label reads at a glance, and his voice carries what it leaves out.
- Let the kit time the lines (`references/plan.md`, Timing). A subtitle like `(20 years in under {under} seconds)` fills in from where the list ends. Why: "under 30" only beats "under 35" if it's true, and a promise the reel breaks reads as clickbait.

## 6. Source the assets

- Write `research/ASSET-BRIEF.md` from `references/sourcing.md`: his rules for found images, the sizes and kinds, where files go, the tools, and one row per group with the pick and anchors in order of preference.
- Split the groups across at most 4 agents, each writing only into its own group folders, and let only one of them capture from the Wayback Machine at a time. Why: more at once got one agent a bot-traffic block page from the Wayback Machine and 429s from Wikimedia.
- Groups about his own work (his apps, his earlier pages) use his own renders and captures, never found copies.
- Look at every pick with the Read tool before keeping it: the right thing, the right year, sharp, no watermark, shown whole.

## 7. Compose and review

- **Nothing covers a subject.** `kit/collages.py` lets images overlap only at their edges, and throws out any layout where something lies over another image's focus box: its inner 80% by default, nearly all of the pick. Give an image its own `"focus"` when its subject sits off-centre, and lay a page whose words run to its edge on top (`"top": true`). Why: a sticker over a face or a title hides the very thing the item is about.
- **Nothing dark sinks into his footage.** An image that's mostly black (a title card, a dark frame around a screenshot) reads as a hole over his warm, blurred room. Crop to its light part, find a cleaner version (a logo on transparent), or pick another image.
- **Words that matter read on a phone.** Anything meant to be read (a repo name, a tweet's key line, a headline) has letters at least 20 px tall on the 1080 grid once it's in the collage, about 7 pt on the phone. A whole screenshot shrunk under his chin never gets there. Cut a card from the real screenshot instead, with only those words, in lines of about 25 characters, on the screenshot's own background, and give it `"focus"` over all of it. Body text that's only texture (a page of a 2009 site) can stay small.
- **List reels:** order each item's images in `edit/collages.json`, the pick first. Use 3 by default, and a 4th only when it's small. Render with `kit/collages.py <video> --sheet` and judge every collage on `build/contact-sheet.jpg`. Give the image that carries the item's words `"top": true` (ChatGPT's launch title, a tweet), shrink one with `"scale"` below 1, and try other layouts with `"seed"`, side by side. A layout depends on its seed and on the side the previous item's pick sits, so after changing one, re-render the set and look at the sheet again. When you cut or reorder items, give each the `"seed"` of its old position first, so the others keep the layouts already reviewed. Logo cards stay at least 90% visible on their own.
- **Talk reels:** crop each asset to what its line is about and keep it whole: no cut-off phone sides, no black bars. Put a transparent diagram or logo on a white card with padding, the way collages.py frames logos, so it reads over his footage. When a line explains a term, a fix or a mechanism, its visual is charles-explainers-assets' job: say so in the beat's `note`, and let a still stand in on the page.
- **Red marks:** one box, strike or arrow per asset, and only where it makes the label readable (2015's serif logo struck through).

## 8. Write the caption and credits

- Put the caption in the README's Delivery section, ready to paste, and in your reply. It never goes in SCRIPT.md.
- When the format has a playbook, its caption shape wins: the Day reels' "More details on design/psychology techniques used:" with one "- principle: why it works + how it's applied here" line per technique and no comment ask, or the accent reels' one-line hook, `Comment “accent” for the skill 🎨` and five hashtags. Otherwise his caption is short, in this order:
  1. A hook line or a question, different from the reel's sign-off question, so the comments get two ways in.
  2. The comment ask, when the reel has a keyword: `Comment “SITES” for all ten links 🔗`.
  3. One `ib:` line naming everyone whose idea, format or work the reel builds on: their Instagram @handles, or their websites where they have no Instagram (`ib: @offbrand.studio @lando jhey.dev`). Search Instagram for an account before falling back to the website. Never a credit sentence ("S/o … for …", "Shoutout … for the format").
  4. Four or five hashtags.

  No em dashes, and no full stop at the end of a line. Write the caption in his voice (charles-scripting-voice's rules).
- Every caption option (`caption` and each of `options`) keeps the `ib:` line. Never write a shorter alternative without it (`caption_alt`). Why: an option without the credit gets posted without it.
- An optional first comment (`comment`) can credit artists whose work is on screen, in the same handle-or-website form.
- Never reuse a caption line or a hashtag set he's already posted: check his posted captions when the repository keeps them (claude-editing's `repost/reels.json`). Without them, skip the check and say so in the README.

## 9. Pick the music

- Pick a mood folder in `assets/music/` when the repository has one (charles-claude-editing, Music), plus one alternative: the reference's own track when it's in the library. Without a library, ask him for a track or use the one he gave.
- Find where it starts, after the first build has written `build/times.json` (or pass `--length`):

  ```bash
  python3 -I <skill>/kit/music_start.py --video <video folder>
  ```

  It prints the track's loudness every 0.5 s and every start after a break (a hit, or a swell in music without drums), picks the earliest one with no breakdown before the reel ends, and prints `at = …` with 40 ms steps around it. Read the table: when the pick sits somewhere the reel shouldn't start (a different section from the reference's, a verse he'd find sleepy), pass `--near <s>` with the spot you want, and it snaps to the hit nearest it. Set `music.at` to the `at` it prints, and act on any WARNING. Why: the page plays exactly this clip under the mockup, the edit starts the track at the same point, and music that starts in a quiet intro or breaks down under him drains the reel.

## 10. Build, check, publish

From the video folder:

```bash
python3 -I <skill>/kit/build.py . --site
```

That writes `build/plan.html` (the page, which opens from disk), `build/music/` (the track cut from its `at`), `build/times.json` (each line's start and length), `build/posters/` (a still of each clip, for its asset card), `<assets_dir>/SOURCES.md` and `build/site/`, the shareable copy. Then:

1. Fix every check the build prints, or write in the README why one stays (a tweet he reads for 5 s is `long_ok`).
2. Look at every collage at full size (`assets/collages/<group>.png`, laid on a mid-grey at 1050 px wide): no subject covered, and every card's words readable. Then export full-size frames of the first line, a middle line, the busiest line and the last, plus one with `&safe=1&ig=1`: `python3 -I <skill>/kit/capture.py "file://$PWD/build/plan.html?solo&t=<s>" build/frame.png --size 1080x1920 --scale 1`. Nothing that matters may sit under Instagram's header, caption or buttons. Why: the browser pane scales its screenshots down, so only full-size frames show small text.
3. Read the page's sections once, as he will. The build prints how many script lines it tied to the plan's lines: every line he says should be tied, so it lights up and jumps the reel, and a line that isn't means SCRIPT.md and a beat's `say` (or a list item's `label`) disagree. Every caption option is there, and every reference, each with its `why` (the build flags one without, and a plan that still has only the old `reference`). Each asset card's title is plain words for what's on screen, because it's the visual's `what` (a list item's card takes its label): "The AI palette, then the same colours at one lightness", never a file, folder or skill name. For the phone layout, use device emulation (playwright-core with a 390×844 viewport) and scroll the page once before a full-page screenshot: `capture.py` can't lay a page out narrower than about 500 px, and the asset stills only load as they scroll into view.
4. Test playback cold, as another computer gets it:

   ```bash
   node <skill>/kit/playtest.mjs <video folder>
   ```

   It serves `build/site` at about 12 Mbps with the CPU slowed 4×, plays it, then serves whole files as a host without byte ranges does, and prints PASS or what failed: a still or clip showing more than 0.15 s after its line starts, a clip running off the reel's clock, music that never plays, files that never come into memory, or a pause, play or script-line jump that starts the reel over. Fix what it prints and run it again. Why: this computer's cache hides a slow load, and pages that played here played badly on his other computers.
5. Publish with the Artifact tool: `file_path` build/site/index.html, `root` build/site, `files` the list in build/site/files.json, and `icon` "video" on the first publish. After any change, publish the same file path again so the link stays: the page alone when only the plan changed, with files.json again when media changed, and `null` for any media path that's gone. The page is private until he shares it from its Share menu, so tell him. Without the Artifact tool, hand over `build/plan.html` and say it only opens on this computer.
6. Open the published link with `#check` on the end in his browser (Claude in Chrome), in a new tab or with a reload, since changing only the hash of an open page doesn't reach the page's frame. Press Play with sound and check that the dot after the clock turns orange (the music is playing) and that the count beside it reads all of the reel's files ("20/20", all in memory). Then pause it, and leave the tab on the plain link. Why: nothing outside the page can see into its frame, so its own dot and count are the only proof the published copy works.

## 11. Hand over

- README: the brief, the files, the link, the music pick, and what's checked and what isn't. Timing is always an estimate until there's a cut.
- When the format has a playbook (`formats/<format>/README.md`), make sure it lists the video as in production. Once it's posted, its row there gets the plays and what it taught.
- In your reply, give the link first, then the script exactly as SCRIPT.md has it, ready for his notes, and the caption. Then say what he films (how many lines, about how long), the judgement calls he might overrule, and what isn't checked.
- After filming, the editing session writes `edit/cuts.json` and rebuilds, and the page switches to the cut's real times.
- Nothing reads the script aloud. The page plays the music alone, and lines take their estimated length until there's a cut. Why: he rejected every AI copy of his voice.
