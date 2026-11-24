# Slots

The places charles-claude-editing puts an explainer, as they stand in my reels. The editor picks the slot and gives you its numbers; this table is for checking them and for mocks before a take exists. Sizes are design sizes: render at 2× of them. The frame's own numbers (the platform's header, caption and buttons, the text inset, the caption band, the slot sizes the editor asks for) are in `<skill>/reel-spec.json`, which charles-claude-editing owns: read them from there, never from memory. "Used in" names folders in the claude-editing repository.

| Slot | Design size | What the viewer sees | Keep everything that matters inside | Used in |
|---|---|---|---|---|
| Hack-reel card, under my mouth | A 1080×960 panel | The band y 300-890 of the panel, in a card about 756×414 (scale 0.68-0.72) just under the captions, which sit under my mouth | The band. The code block ends by panel y 868, which lands near y 1500 of the reel. The list kit draws its Before/After tag on the band's top-left corner (193×63 panel px on the plan page), so the subject stays out of x < 200, y < 76 of the band, at the end of the slow push too | `videos/design-hacks/design*/` |
| Term card, under my chin | The demo's content box | That box, scaled to fit 800×354 at x 140-940, y 1146-1500, with the tab on its top-left edge. A side by side fills the whole card. No captions: the list is the captions | The card, with its words inside the frame's text inset, left of the platform's buttons and above its bottom (`reel-spec.json`). The UX principles card went out at 960×400, x 60-1020, y 1150-1550, past that line | `videos/eradicating-ai-slop/design-terms/`, `videos/ux-principles/` |
| Playful term card, under my chin | A transparent 1080×480 clip, placed at reel y 1080 | The card, 870×350 at x 80-950, y 1150-1500 of the reel, radius 30, with the tab on its top-left edge. No captions: the list is the captions | Words 40 px inside the card's edges, and nothing resting against its top edge, which the tab covers on a long line (`looks/playful.md`) | `videos/app-psychology/explainers-v2/`, `videos/eradicating-ai-slop/slop-tells-2/`, `videos/eradicating-ai-slop/claude-principles/` |
| Day N card | 920×490 | The whole card, under my chin, with captions under it | x 14-866, y 14-474: the platform's buttons cover the card's right edge and its caption the bottom | `videos/eradicating-ai-slop/day-*/` |
| Card above my face | `slots.card_above_face` | About 900×442, with the editor's rounded corners and shadow | Words `text_inset` px inside every edge, and key content clear of the rounded corners | charles-claude-editing explainers |
| Split panel | `slots.split_top_40` or `slots.split_half` | The whole panel, captions on the seam | Words `text_inset` px inside every edge, and nothing in the 60 px next to the seam, where the captions sit | landscape demos |
| New screen | `slots.screen` | Everything | Inside the platform's top, bottom and buttons, `text_inset` px from the sides, and nothing the viewer needs in the caption band | full-screen demos |

**Ground, in the clean look:** #e6e9ee in the hack-reel card, white in the UX-principles term card, as posted. Match the slot's, or the gold check reads yours as greyer. The playful look brings its own: a colour world per card (`looks/playful.md`).

## Converting sizes

- **Final size of text in a clip:** its size in the design frame × the slot's scale. In the hack-reel card, 34 px panel code × 0.72 = 24.5 px; on a 0.68 card the kit sets 36 px (24.5 px).
- **On a phone:** final px × 0.36 = pt. 26 px is about 9 pt, 40 px about 14 pt.
- **The phone check's width:** the slot's width in the final frame × 0.36. The hack-reel card is about 270 pt wide, a full-width slot 390 pt.
