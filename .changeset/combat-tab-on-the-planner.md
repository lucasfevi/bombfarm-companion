---
"@bombfarm/web": minor
"@bombfarm/desktop": minor
"@bombfarm/farm": minor
"@bombfarm/hero": minor
"@bombfarm/ui": patch
---

A Combat tab on the planner, and one phase picker for it on both apps.

**The planner has the desktop app's fourth stage now.** Hero, Combat, Gear, Points — the same
four the desktop Heroes screen draws, from the same implementations. Combat holds the phase the
figures are for, one hero against that phase (whether it pierces the mitigation, the average hit,
the fuse floor, the cooldown-reduction ceiling, the prop table), and the per-statistic breakdown,
which moves here from the bottom of Points. Picking a phase on it moves every figure the planner
prints — the hero strip, Gear and Points read the same numbers — and leaves the Farm page's own
selection alone.

**The phase picker is the optimizer's.** Type `Hard 1-1`, `Normal 2-1` or `151` and pick the
phase, on the desktop as on the planner, instead of stepping a number box. The button beside it
reads **Back to your current phase** and stands as tall as the picker.
