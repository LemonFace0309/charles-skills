---
name: charles-claude-editing
description: "Edits Charles' raw talking-head footage into a finished Instagram Reel or TikTok: cuts dead space tight without clipping a word, keeps his last clean take, adds 2-3 word captions, overlays, splits, sound effects, music and a hook title when asked. Use when he shares a talking-head .MOV or .mp4 to edit, cut, caption or \"minoify\", or asks to fix any of that in a reel already cut this way."
compatibility: "Needs ffmpeg and ffprobe, Python 3 with numpy (scipy for level_voice.py, Pillow for the check sheets and captions.py), and uv to run faster-whisper for the voice map. On a Mac, avconvert converts iPhone HDR takes and Photos receives the finished reel. Uses the claude-editing repository's tools/reelkit, assets/music and assets/sound-effects when it runs there, and works in any folder without them."
---

# Goal

* The goal of editing is to maximize viewer retention. The viewer should constantly have something new to look at, without ever feeling overwhelmed
* Keep it organic, like I made it myself on my phone. Use the real thing over a recreation of it: the actual post, footage, app or website, not a mock-up, stock image or AI version. If something looks like a template or AI slop, don't use it
* If something isn't covered here, do whatever best serves those two goals

This skill runs long. After a context summary or a restart, re-read this file and the video's own notes (its README, `cuts.json`, the edit's plan) before going on.

`<skill>` is this skill's folder. Its scripts run from the video's edit folder with the take at `../footage/raw.mov`, the layout Charles' repositories use; pass `--raw`, `--cuts` and `--work` when yours differs. The frame's numbers (safe area, caption band, slot sizes, pacing, loudness) are in `<skill>/reel-spec.json`, which the other editing skills read too.


# Decide these first

```
Is it news (layoffs, announcements, someone else's findings)?
├── Yes → also follow News Videos at the bottom. It wins wherever it disagrees with the defaults
└── No, it's education/entertainment → just the defaults

Did I ask you to open on a split screen?
├── Yes → open on one (see Choosing the Layout)
└── No → open on me
```


# Run it

Walk these in order. Each step leaves a file, so a run that stops can pick up from what's on disk.

1. **Check the take.** `ffprobe -v error -select_streams v:0 -show_entries stream=color_transfer -of csv=p=0 <take>`. `arib-std-b67` is iPhone HLG HDR: convert it to SDR before anything else (`avconvert -p Preset1920x1080 -s <take> -o ../footage/raw.mov` on a Mac, ffmpeg's `zscale` and `tonemap` elsewhere). Why: cut next to my SDR takes, an HDR take looks washed out or blown out.
2. **Map my voice.** `uv run --with faster-whisper --with numpy python <skill>/scripts/voice_map.py --prompt "<the script>"` writes `work/voice_map.json`: every stretch of sound in the take, each transcribed on its own. Why: a transcript of the whole file merges my repeated takes into one or drops them.
3. **Pick the takes.** Write `cuts.json`: one phrase per line I say, in reel order, each the last clean take (General), as `{"text", "in", "out"}` from the stretches.
4. **Tighten.** `python3 <skill>/scripts/tighten.py --split`, read what it proposes, then run it again with `--write`. It moves every in and out onto my sound, never past anything that could be my word, keeps breaths and clicks next to a line out of the joins (`avoid`), and cuts every pause of 0.35 s or more inside a line. Put a pause back only when I'm holding a beat looking at the lens. Listen to every line it marks LISTEN.
5. **Cut.** `python3 <skill>/scripts/cut_take.py` writes `work/cut.mov` (ProRes, local only), `work/cut_voice.wav` and `work/cut.cuts.json`.
6. **Prove the sound.** `python3 <skill>/scripts/check_cut.py --sheet work/joins_sound.png` must end "every word whole, every join tight". Fix each FAIL the way it says, cut again, check again. Before you show me the cut, run it once more with `--hear` (under `uv run --with faster-whisper --with numpy`) and read what it heard.
7. **Prove the picture.** `python3 <skill>/scripts/check_joins.py`, then look at every row of `work/joins_picture.jpg` (Cuts).
8. **Level my voice.** `uv run --with numpy --with scipy python <skill>/scripts/level_voice.py`: gain only, every line to -16 LUFS while I speak.
9. **Lay out each line** (Choosing the Layout, Image/Video Overlays, Pacing).
10. **Captions and the hook** (Captions, Hook Title).
11. **Music, then sound effects** (Music, Sound Effects).
12. **Mix**: my levelled voice, the music 8-9 dB under it with no sidechain ducking, the effects at or under my voice, then one gain to -14 LUFS integrated through a look-ahead peak limiter.
13. **Export** (Export), then walk the checklist below.

When the repository has `tools/reelkit/` (Charles' claude-editing), its `reelkit.py` renders steps 9-13 (captions, hook, overlays, splits, sound effects, the encode) and `mix_reel.py` makes the mix. Anywhere else, ffmpeg does the rest (`overlay` with `enable='between(t,a,b)'` for each asset, `gblur` for the blurred backdrop, and the mix with `loudnorm` and `alimiter`), then `<skill>/scripts/captions.py` burns the captions and the hook over it and encodes the export.


# Before you show me a cut

* `check_cut.py` ends "every word whole, every join tight", and `--hear` heard every line's first and last word
* Every row of `check_joins.py`'s sheet: nothing kept of me relaxing, glancing at my notes or reaching for the phone
* Every caption checked against what I said: names, numbers, the comment keyword (caps, quotes, yellow), blocked words censored
* Nothing I need to see under the platform's header, the username and caption zone, or the button column, and no caption over my face unless it's blurred
* Something new on screen every 2-3 s, and nothing still for more than 3 s unless I'm reading it out or it's the payoff
* Every sound effect lands on the frame its event happens
* The mix: my voice at -16 LUFS while I speak, the music 8-9 dB under it, -14 LUFS integrated
* The export's size, codec and bitrate (Export)


# General

* Cut any dead space that exists in the video. Stumbles, false starts and the moments after I finish a line all count (see Cuts)
* When I say a line more than once, keep the last take I get through without a stumble or a mixed-up word, and cut the takes before it. I redo a line when I mess it up, so the last clean take is the one I meant
* Safe area (1080x1920): the platform's header covers the top 200 px, the username, caption and audio sit below y 1500, and the like, comment and share buttons run down the right side, right of x 940 from y 840 down. Keep text at least 60 px inside both sides, and left of x 940 below y 840. Don't put key information in those areas, but don't cut off or shift videos and pictures in a weird way because of them: footage and images can still run into them
* No gimmicks: no pop-ins, rounded corners (except for the hook title), black-background splits, emoji tiles, glow rims, lens ripples, card bounces or sparkly shimmers. The change itself is the wow, so nothing gets decorated on top of it
* My framing is usually close, with my face filling the middle of the frame. In that case never zoom or punch in on my face. Only add slow zooms between cuts when my face is smaller than the middle third of the frame. Cover jump cuts with B-roll instead
* Never stretch my footage to fill a frame: run it as filmed, or zoom it evenly by at most 6% and shift it. Why: a warped face looks wrong at once
* Never isolate or denoise my voice. It struggles to do that well, and it makes my voice sound processed. Level it with gain only (level_voice.py)
* Keep B-roll or a visual I've already approved. Don't remake it to fit a later change: keep it, or ask
* If I give you a reference reel, copy its structure, pacing and B-roll, but never its caption style. Captions always follow this file


# Cuts

* Read a take's sound on the file's own timeline. My phone's takes have holes in their audio timestamps, so decoding closes them and the decoded clock runs up to a second behind the picture. Every script here reads through `timeline_audio.py`; planning cuts on the decoded clock once cut the ends off "poli-" and "touch"
* Cut the sound only in the silence between phrases, never inside one, and never set an in or out by eye or from a transcript's word times. Transcribers end words early on a final "s", "t" or "sh". tighten.py sets them from the sound and check_cut.py proves them
* Cut on the picture as well as the sound. The moment I finish a line I start to relax (ex: looking down at my script, dropping a hand, reaching to stop the recording), and even 0.3 s of that makes a cut look sloppy
* End each clip within 2 frames at 30 fps (0.07 s) of my voice stopping, with the whole last word kept, trailing "s" or "t" included
* If I start to relax before then, end on the frame before it starts. If it starts before the word is over, cut the picture there and start the next clip's picture that many frames early, so the rest of the word plays over it (an L-cut, `"lcut"` in cuts.json, up to 4 frames). If it starts any earlier, or during my last word, use an earlier clean take of the line or cover it with B-roll. Never clip a word to hide a movement
* Never a J-cut (holding frames of me after my sound, or starting my picture late): held frames read as me pausing. When my hand swings into the frame at a line's edge, paint it out of those frames instead
* Never keep a frame of me glancing at my notes: end the clip before the glance, or cover it. In a list reel, leave 0.27 s after each item
* Start each clip 1 frame before I speak. If I'm still settling into place there, use an earlier clean take of the line or cover those frames with B-roll
* So a join keeps at most 0.1 s of silence, measured from my sound, with no breaths, clicks or lip smacks: a breath or a pause before my first word shows me getting ready. A beat I hold mid-line while still looking at the lens (ex: before a punchline) is delivery, not dead space, so keep it
* The reel's last clip can run up to 0.15 s after my last word, as long as I haven't started to relax
* These limits are tight enough to clip a word, which is what check_cut.py is for. It reads every band against my own line, because a final "s", "t" or "f" is quiet below 3 kHz and a broadband loudness test calls it silence
* Before you show me a cut, look at the frames on both sides of every join and the reel's last frames (check_joins.py draws them). Redo any join where I visibly start to relax


# Hook Title (the text caption at the top)

* No hook title unless I explicitly ask for one
* When I do: Helvetica Neue Bold near the top of the video, black text on a white background with rounded borders, inside the 60 px side margins and below the platform's header. Make it look like TikTok's native text with a background: each line is wrapped individually, so the background bends where a shorter line meets a longer one (reelkit's `make_hook`, or `captions.py --hook`)
* Two lines max. Three is fine when the hook won't fit in two at full size, or when a CAPS word gets its own line
* Usually keep it up for 3-5 s (my first sentence). It can stay longer as long as there's no overlay or B-roll that should replace it


# Captions

* Helvetica Neue Bold, 66 px, white with a 3 px black outline and a soft shadow. Sentence case, apart from the comment keyword (below)
* Centred at y 1380, inside the caption band (y 1320-1500). If an asset sits there, move the captions above or below it, never over it. While a split screen is up, they go on the seam
* Never over my face unless everything behind them is blurred. When an asset pushes them up, right under my mouth is as high as they go
* 2-3 words each line
* No animations/transitions
* Go over the captions yourself to make sure the ones coming back from a transcription service are accurate to the context of what I'm saying. Sometimes transcription services suffer with names too, so fix those
* Censor any words that TikTok may block the video for, in the captions and the hook (ex: say s*****e instead of suicide)
* Caption the comment keyword (the word I ask viewers to comment) in caps, inside quotes, with the word and its quotes in yellow (#FFD60A) and the usual black outline: Comment “SCREENSHOTS”. It's the one word viewers have to type, so it shouldn't blend in with the words around it. In the hook, write it in caps and quotes in the hook's own black (reelkit's `keywords`, or `captions.py --keyword`)


# Image/Video Overlays

* Use these by default unless I explicitly ask not to
* Make sure every asset is relevant to the video. Don't add assets for the sake of adding assets. Loosely related photos/videos are okay in education/entertainment
* Placement, for overlays that don't take over the whole screen with a blurred background:
   * Where my face sits decides it. If my face is closer to the top, put them below my face and move the captions lower with them. If it's closer to the bottom, put them above my eyes
   * Never cover my eyes or the captions
   * Long screenshots can run off the bottom as long as the highlighted lines stay above y 1500
* Don't blur anything more than it needs, and show assets whole. Don't crop one so part of it gets cut off (ex: the side of a phone screen)
* Never leave black bars around an asset. If it doesn't fill its space (ex: a web page with side margins, a screenshot on a black background), fill the edges with a blur of that same page or asset, or something else related. It's more aesthetic
* You can also place me in front of an image, with an AI cutout of my body in the foreground covering part of it. It adds depth. Only do it when nothing relevant gets covered
* Size images like Instagram stickers rather than full-width slides, so I stay on screen. Tweets, screen recordings and code are the exception, they need to be big enough to read
* If given assets, crop/highlight/adjust them to keep only the relevant parts. Feel free to chop them up to make them more engaging
* If you're finding assets yourself via the web:
   * No stock images. Prioritize images that feel like they were taken by a regular person on their iPhone. Obviously there are exceptions like logos, etc
   * Anchor on pop culture and trends that the viewer would recognize. We want to invoke a familiarity bias
   * Don't create AI generated photographs unless I explicitly ask, because they create an uncanny feeling. Animations and graphics are fine
   * Screenshots of tweets and other social media are great
   * Make sure it's accurate to what I'm talking about (ex: the current Mac mini, not an older model)
* Web pages: dark mode, starting at the visual part, not the intro text. Keep the content inside the 60 px side margins. Light mode pages w/ text running into the screen edge look ugly
* A screen recording of a tutorial is motion design over real captures of the UI: one continuous camera move, typing rebuilt so it reads, a cursor with rings on its clicks, menus opened from what was tapped. A raw low-frame-rate capture looks broken on a phone
* A flashed example clip (a generated video, a demo) opens on its peak, the impact or the leap, never the run-up. Generated clips climax late, so play the slice that holds the peak, at 1x-2x
* A mini gameplay clip (Subway Surfers style) sits small in open background at my face's height, beside the list, never under the captions. Check every frame against my face, and shrink it rather than move it from line to line
* For big claims, show the source (official release, headline) with the words I'm saying highlighted
* Make your own motion graphics and recordings instead of using templates. When I explain a concept, build a visual for it (text, diagrams, graphs, beautiful animations). This is especially potent in educational videos
* When I explain a term, a fix, a technique, a number or a mechanism, ask charles-explainers-assets for the visual at the slot's size, with its text area, my word times and the change words. Place what it returns, and put clicks on its cues. Without that skill, build the visual yourself to the same brief: the real thing changing on my word, readable in the seconds it's up
* When you show a list or sequence as a row of pictures, don't use icons. Use organic-looking images you find online, cropped into squares/rectangles
* Graphs and charts are okay. Screenshots of real ones from other sources are great. If you make one yourself, it has to look professional and clean, and be accurate and detailed, w/ well timed animations. A sloppy one comes across as AI slop
* If I read out a list, put it up as an overlay with blur, each item revealed as I say it (plain caption-style text, not a screenshot). If I read it slowly (more than ~4 s between items), take the overlay down between items and bring it back for the next one, so it stays engaging


# Pacing

* The reel should feel brisk. While I'm talking, something on screen changes or moves every 2-3 s (a new asset, a cut, a move inside an asset, a highlight moving to the next line), and it never goes more than ~4 s without something new. Captions changing don't count
* Brisk isn't frantic. One new thing at a time, landing on the word it belongs to, with at least ~0.5 s between changes, except a run of quick cuts (below). A viewer who can't tell what they're looking at swipes away as fast as a bored one
* Anything back to back (images, tweets, clips) is a hard cut with no gap in between. Even a brief stutter isn't back to back
* How long an asset stays up depends on what the viewer gets from it:

```
What does the viewer get from this asset?
├── Words I'm reading out (a tweet, a quote, code) → as long as I'm reading them, with a highlight moving on the words
├── The payoff they're watching for (a demo, a before/after, the result) → as long as I'm talking about it
├── Proof that something exists or is big (a long list, a page of docs, a pile of examples) → 1-2 s, with a fast scroll or pan
│   across it so it reads as "there's a lot here". The reel never waits for anyone to read or screenshot it: whoever wants
│   it pauses. Put the full thing in the caption or the comment ask
├── Many things of one kind, where how many is the point (ten sites, twenty logos) → a run of quick cuts, 0.3-0.5 s each,
│   in time with my words or the beat
└── Anything else → 1.5-3 s, then a hard cut to the next thing
```

* My face is what keeps people watching, so a layout that takes it away (an overlay with blur, a new screen) has to earn the time:
   * Cut back to me within ~2 s, unless it's words I'm reading out or the payoff itself
   * Never hold text over my face that isn't interesting to read. A long list gets 1-2 s with a scroll, or goes in a regular overlay that leaves my face on screen, zoomed in to the 3-6 lines that matter
   * A regular overlay that leaves my face on screen follows the tree above
* Keep most stills moving. A still that sits dead for 2-3 s is where people swipe, and a move gives the eye somewhere to go:
   * A slow push-in, 5-10% over the asset's time, toward what the line is about
   * A pan across anything wider or taller than its slot (a canvas, a grid, a long page), ending on the part I'm naming
   * From the whole thing to the detail I name (the whole window, then the images pasted into it)
   * A busy asset cut into 2-4 crops instead of one long hold: four pages as four 0.6 s cuts, not a 2x2 grid for 2.4 s
* Leave these still: words I'm reading out, since moving text is harder to read, and anything up for under ~1 s. Each asset gets one move with one destination, eased in and out. A push-in stays under ~15%, or it turns into a gimmick; a move from the whole to a detail can go further, because it lands on something


# Choosing the Layout

* Every asset goes on screen one of five ways. Pick by what the asset is and what the moment is going for:
   * Regular overlay, no blur: images I just want on screen, which is most of them. Sticker-sized, above or below my face (see Image/Video Overlays)
   * Overlay with blur: an image that takes up a lot of space and has to be seen whole, or a list I'm reading out (each item revealed as I say it). Blur everything behind it, me and any title, list or hook on screen, so only it and the captions stay sharp, and centre it. It takes my face off screen, so it follows the limits in Pacing. An overlay without the blur stays off my face
   * Split screen 50/50: another video that's taller (ex: footage from somewhere else, a phone screen recording). It gets half the frame (1080x960) and my face gets the other half, at the top or bottom
   * Split screen 40/60: another video that's landscape (ex: a desktop screen recording, a 16:9 clip). It gets the top 40% at full width (1080x768) and my face gets the bottom 60%, like @opusjake's splits
   * A new screen: B-roll or a new vertical video we generate that should be completely immersive. It takes the whole frame (1080x1920) and cuts away from me
* In a split, fill the video's panel with real footage, never a black panel with a card in it
* Only make the whole video a split screen when I ask
* Add a transition into and out of a split (ex: a push)
* When I ask you to open on a split (ex: me reading a Reddit post, a video demo showing something cool, tech news with a demo), put my first sentence on the seam as hook text, then the 2-3 word captions on the seam while the split is up
* Motion graphics from the charles-arcade-assets skill fit any of these. Pick the layout first, then ask charles-arcade-assets for the asset at that size, with the area its text has to stay inside. You place what it renders
* Teaching visuals from charles-explainers-assets fit the same way: pick the layout and slot first, then ask for the visual at that size
* The slot sizes those skills render to are in reel-spec.json, with the 1280x630 card above my face and the 1280x1550 tall card


# Music

* Pick the mood folder that fits the video (chill, emotional storytelling, funny, motivational, suspenseful, upbeat, wholesome) from the repository's `assets/music/` when it has one. Without it, ask me for a track or a folder: never pick a song from memory, because its licence and mood are unknown
* Exposés and serious news always get suspenseful (conspiracy/suspense-building)
* Move the music around to fit the video better. It doesn't need to begin from the start, so skip quiet intros
* Keep the music 8-9 dB under my voice while I'm talking, with no sidechain ducking. My pauses are too short to duck in and out of, and ducking it harder makes my voice sound isolated


# Sound Effects

* Only on moments that earn one, and only on something you can see happen on that frame: a camera shutter when a screenshot appears, a pointer click on a highlight or tap, a soft whoosh on a big transition. A sound with nothing visible causing it reads as a mistake. Bias towards premium and clean sounds like these. Get them from free online sources or the clean ones in my folder (`assets/sound-effects/` in the repository: ding, discord ping, apple pay, metallic riser)
* Check that each sound's hit lands on its frame. A sound file that opens with silence lands late by that much: trim the silence, or place the file by its hit, not its start
* Meme sounds from my folder (ex: vine boom, Cinema Sins dun) at most once per video, and only on a punchline
* No more than ~6 per minute. Too much and it gets annoying, but adding them in a timely and tasteful way improves the quality of the video
* Keep them at or under my voice level


# Fixing a Word

* When I misspeak one word and there's no clean take, a clone of my voice can say that one word (ElevenLabs, my voice). One word fits in: a long phrase, sped up to fit, sounds generated. For more than a word, keep my take and correct the caption with an asterisk
* When I record a pickup myself (audio only, from a voice memo), splice in the whole phrase, not single words, with my lips hidden under an overlay, and paste it raw: loudness matched only, no stretching, pitch shifting or EQ. Check the read sounds as lively as the take around it first
* A line that's voice-over keeps me on screen: a blurred replay of me, or a B-roll card over my face


# Export

* Small text anywhere on screen (a UI demo, a website, code, a tweet, a screenshot) means a 2160x3840 export. At 1080 wide, ~10 px UI text goes soft once the phone stretches it to fill the screen, and it looked blurry in Photos
* Capture screens at 2x and keep them at 2x the whole way. Never shrink a capture to 1080 wide and let it get scaled back up. Draw captions and the hook at 2x too. My footage is 1080x1920, so it gets scaled up once and that's fine
* Every position in this file is on the 1080x1920 grid. At 2160x3840, double it
* H.264, CRF 16 at 2160x3840 (about 25 Mbps), AAC 256k. Less smears fine text and grain
* A talking head with only captions and the hook can stay 1080x1920
* On a Mac, save every finished reel to my Apple Photos. I post from my phone, so that's where I check it. Replace an old version rather than leaving both. Elsewhere, put the export where I asked and say where it is


# News Videos

* If I ask for a hook title, put the key words in CAPS, in larger text than usual (ex: "Samsung EXPOSED to be SPYING on users", or "Microsoft offers voluntary / TERMINATION / to 60,000 amid AI adoption")
* Mostly screenshots of the posts I send you, big (840 px wide) and held while I talk about them
* Yellow highlight on the words I'm saying, moving as I talk. It has to sit exactly on whole words
* No loosely related photos/videos
