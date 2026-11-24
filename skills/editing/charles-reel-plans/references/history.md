# Where the rules came from

Charles' notes behind this skill's rules, in his words where they were written down, so a rule can be traced back when
it's questioned. SKILL.md keeps only each rule and its reason. The first run is recorded in
`videos/evolution-of-design/PROCESS.md` in the claude-editing repository.

Contents: The page · The script · List labels · Captions on screen and the hook · Composing assets · Caption credits ·
Playback · Voice · Research

## The page

- 16 Nov 2026: "The local host is down so I can't even see the video." He judges a plan on his phone, often away from
  this computer, so the page is published as an Artifact rather than served from localhost.
- 16 Nov: "too much fluff around the video player section", but "Still include the other sections... like the assets
  and the script and the video caption options", and "Keep the toggle to see the unsafe area too (that was actually
  useful)". The same day: "put music below the video playback", "make the video playback itself a bit smaller and let me
  full screen", and an Instagram UI toggle beside the safe area.
- 18 Nov: "include a section for references (tweets, ig/tt videos/etc) that helped create the video".
- 23 Nov, on a spotlight over his face with the list still sharp: "it's not obvious that we're trying to do a full blur
  background". Hence the backdrop table: an asset over his face blurs every layer behind it.

## The script

- 16 Nov: "Just make it the actual verbal script ... Don't add extra jargon/text that isn't useful." SCRIPT.md is what he
  reads, in the layout of his "2026-11-10 SCRIPTS" note in Apple Notes: a bold title, `Text hook:`, the lines, the sign-off.

## List labels

- 16 Nov: "I don't think Facebook's like button should epitomize an entire year of design", and "instead of stuff like
  cybertruck brutalism, better encapsulations might be cybertruck, xyz, abc (in case there were multiple things that
  happened except for a single defining moment)".
- 16 Nov: "idk how I feel about stranger things as an epitome of design". 2016 became Figma's launch.
- 16 Nov: "Slack's logo itself doesn't really bring people back to what happened there ... It's a lot of text so maybe
  put it in the script ... The list on screen can be more abbreviated."
- 2008's HOPE poster became "The App Store opens": Instagram stops recommending a reel to non-followers once it reads as
  political.

## Captions on screen and the hook

- 16 Nov: 22 Backgrounds' title at 45 px and subtitle at 36 px read small: "this text hook should probably be a little
  bigger". The list reel title went to 56 and the subtitle to 40.
- 16 Nov: "Both of these are 50% lightness" was "boring" as a hook, and "if u can't just don't have a text hook".
- 12 Nov: "keep captions underneath my mouth and above the demo". 23 Nov: "make sure the captions don't block my face
  when the full blur isn't on".

## Composing assets

- 16 Nov: in the first version, stickers covered Nyan Cat's face, the iOS 6 before and the Stranger Things title: "make
  sure the overlap ... don't cover core subjects". Hence the focus boxes in collages.py.
- 16 Nov, on 2016's Stranger Things title card: "the black contrast is also really bad".
- The first GitHub capture under his chin was unreadable. The repo name, its description and its stars, cut into a
  card, read at a glance.
- Sourcing: with four agents at once, the Wayback Machine served one a bot-traffic block page, and Wikimedia answered
  429 to original-size requests. Hence at most four agents, and one at a time on the Wayback Machine.

## Caption credits

- 16 Nov: "Make sure in the captions of each of these videos we also s/o original authors." Captions then carried a
  "S/o <name> (@handle on X) for the idea" line, and a shorter alternative without it.
- 24 Nov: he swapped those credit sentences for one "ib:" line of Instagram @handles, or websites for makers with no
  Instagram account (Graphite and Simplifying AI became `ib: graphite.io simplifyingai.co`), and the shorter
  alternative caption went with the old credit line.

## Playback

- 18 Nov, on his other computers: "transitions don't work properly or the a-roll/b-roll doesn't load properly", and
  "every time I click pause and then play again, it restarted the video from the start". This computer's cache had hidden
  both. Hence the media loader, the music held in memory, and kit/playtest.mjs.
- 18 Nov: a clip seeked on every frame while it was still arriving restarted its download each time: 913 seeks in 22 s
  and frames 6 s off. Hence syncClip's tolerance and its one seek a second.

## Voice

- 19 Nov: the AI copies of his voice (IndexTTS-2, then his ElevenLabs clone) "sound like shit", so nothing reads the
  script aloud on the page.

## Research

- The countdown in a list reel ("Video tutorial in 10... 9... 8...") came from the animation-styles reel, 19 Nov.
