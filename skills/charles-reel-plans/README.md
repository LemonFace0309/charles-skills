# charles-reel-plans

Plans a reel before you film it. Give it a video idea and a reference (one of your reels, someone else's, or a post to
credit). It tears the reference down, writes the script in your voice, finds the real assets with their licences, writes
the caption with the credit, and picks the music and where it starts. Then it publishes a player you can open on your
phone, where the reel plays as a moving mockup with its music over a blurred stand-in for your footage. The script comes
back as only the lines you say, ready for your notes. All that's left is to read it and film, and the plan file tells the
editing session what goes where.

## Examples

The player for "Evolution of Design", a 20-year list reel: the list fills in as you speak, the newest year in orange, the
stopwatch runs, and each year's real artifacts sit under your chin, overlapping only at their edges.

<p align="center">
<img src="examples/plan-page.jpg" width="50%" alt="The player: a phone-sized mockup of the reel at 2009, with the list, the stopwatch and Facebook's Like row under the chin">
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
