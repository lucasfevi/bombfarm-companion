---
"@bombfarm/ui": minor
"@bombfarm/game-art": minor
"@bombfarm/web": minor
"@bombfarm/desktop": minor
---

Lead the inventory with what it is worth, and switch layout from the list's own corner.

The market total is now the largest thing on the screen rather than a line of small print — it is
the reason to open the page, so it reads as the headline. How old the prices are moved in beside
the coverage line, where it qualifies the figure instead of competing with it.

Cards or list is two icons in the toolbar's right corner, next to the list they switch, rather
than two words above the panel heading. Each keeps its word as its accessible name and its tooltip.
The pair is one shared component both shells render: written per shell it was duplicated Tailwind,
which the desktop's prose-literal guard is right to object to.

The web planner's price refresh button is gone. It could only re-download the same six-hourly file
— the planner cannot ask Steam anything — so it promised a freshness it had no way to deliver. The
desktop keeps its per-item refresh, which really does re-quote.
