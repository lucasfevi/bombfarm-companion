---
"@bombfarm/desktop": minor
"@bombfarm/ui": patch
---

Add the Heroes tab.

**A new tab, between Farm and Inventory.** The nav now reads Live · Farm · Heroes · Inventory ·
Forge · Account · Settings. It sits beside the farm board because that is where per-hero numbers
are read today. The screen itself arrives in the next change; for now the tab shows the honest
"nothing read from your account yet" empty state, in both languages.

**The top bar gives up its words a little sooner.** A seventh tab makes the worded strip about
77px wider, so the two widths the bar degrades at moved with it — the actions collapse behind one
button below 1147px of bar, and the tabs fall back to their glyphs below 847px. The smallest
window a player can drag to now lands in the glyph stage rather than just above it: the tabs show
their icons, and the tab you are on still shows its name.
