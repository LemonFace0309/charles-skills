# charles-reel-plans

Plans a reel before you film it. Give it a video idea and a reference (one of your reels, someone else's, or a post to
credit). It tears the reference down, writes the script in your voice, finds the real assets with their licences, writes
the caption with the credit, and picks the music and where it starts. Then it publishes a page you can open on your
phone. The reel plays there as a moving mockup with its music over a blurred stand-in for your footage, with full screen
and toggles for the safe area and Instagram's UI. Beside it are the script as you'll read it, the caption options to copy,
and every asset with its source. All that's left is to read the script and film, and the plan file tells the editing
session what goes where.

## Examples

The page for "Evolution of Design", a 20-year list reel. The list fills in as you speak, with the newest year in orange,
the stopwatch runs, and each year's real artifacts sit under your chin, overlapping only at their edges. The line playing
lights up in the script, and a click on any line or asset jumps the reel there.

<p align="center">
<img src="examples/plan-page.jpg" width="100%" alt="The plan page: the reel at 2009 with the list, the stopwatch and Facebook's Like row under the chin, and the script beside it with that line lit">
</p>

## Needs

Python 3 with Pillow and NumPy, ffmpeg, and Google Chrome. Claude Code's Artifact tool publishes the page; without it,
`build/plan.html` opens from disk. The editing rules come from charles-claude-editing. The script is written with a voice
skill: Charles's own, charles-scripting-voice, stays private, so bring yours or give it a few of your scripts.

## Install

```bash
npx skills add LemonFace0309/charles-skills --skill charles-reel-plans
```

Add `-g` to install it for every project, or copy this folder into `~/.claude/skills/` (Claude Code) or
`~/.agents/skills/` (Codex).

## Use

```text
/charles-reel-plans an evolution of design reel, from this post, structured like my 22 Backgrounds reel
/charles-reel-plans why every app icon is a squircle, about 25 s, with a hook
```
