---
"@bombfarm/desktop": minor
---

**The Forge screen is sized by its content, not by the window.**

The bag is now exactly as tall as the item panel and the plan panel stacked beside it, and it
scrolls inside that height with its sticky header and its windowing intact. With nothing picked
those two are a short empty state, so the split keeps a 460px floor — fifteen bag rows under the
header, and the whole unpicked screen still inside the default window.

The column holding the piece and the plan no longer scrolls inside itself. A longer odds ladder,
a taller stat table or the run's result block make the column grow, and the bag grows with it,
through the same height transition the run rail already uses — instant under reduced motion.

Opening the run ledger at the foot adds to the page instead of squeezing what is above it:
nothing shortens, and the window scrolls down to the ledger. The screen is free to be taller than
the window now, which it deliberately was not before.
