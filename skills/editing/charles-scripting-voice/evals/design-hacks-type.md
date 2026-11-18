# design-hacks-type

videos/design-hacks/type: the AI draft from commit 4ec1af8 (SCRIPT.md, 10 Nov 2026) and the cut take's transcript (edit/work/cut/transcript.json). The cut starts after the hook, which went on screen, and ends on his own CTA.

## AI draft (the input)

10 niche typography hacks that'll make your app look like an actual designer made it.
First off, if your tabs go bold on hover, the whole row jumps. Reserve the bold width and nothing moves.
Your button text isn't actually centred, the font leaves room for descenders. Add text-box trim and it's dead centre.
Default underlines get chopped up by every g and y. Push them down with underline-offset.
The sup tag pushes its whole line apart. Give it a line-height of zero.
Instead of jumping sizes at breakpoints, size your headline with clamp, so it scales with the screen.
Acronyms in all caps shout like your uncle in the group chat. Set them in small caps.
Straight quotes are a typewriter thing. Use curly ones, so your apostrophes stop looking like tick marks.
Don't cut file names off at the end, you lose the extension. Cut them in the middle.
Narrow columns get huge gaps between words. Turn on hyphens and the browser splits long words for you.
And if long titles make your cards different heights, cap them at two lines with line-clamp.
Comment "type" and I'll send you the CSS for all ten.

## What Charles said on camera (the answer)

Reserve bold width on your text to prevent a layout shift on that row. Fonts leave room for descenders, which cause your text to be slightly off center. Use text box trim to fix this. Default underlines get chopped by every Gand Y. Use underline offset to fix this. The sub tag can create uneven spacing across your rows. Use line height zero to fix. Instead of jumping heights at break points, size your headlines with clamp. That way it scales with the screen. If acronyms in all caps come across too loud, use small caps instead. Straight quotes can come across as mechanical. Try using curly quotes instead. Don't truncate file names at the end because you'll lose extension. Truncate them in the middle. Narrow columns can create huge gaps between words. Turn on hyphens to let the browser split it for you. If long titles make your cards different heights, cap it with line clamp. Follow for more.
