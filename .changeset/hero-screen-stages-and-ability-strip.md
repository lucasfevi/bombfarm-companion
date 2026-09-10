---
"@bombfarm/hero": minor
"@bombfarm/desktop": minor
"@bombfarm/ui": patch
"@bombfarm/web": patch
---

Show a hero's abilities beside its identity, and give the desktop hero screen the planner's stages.

**The ability pool now sits under the portrait.** The identity panel's left column holds the
portrait, name and stars with the pool below them — each ability's icon and its level out of 20,
nothing else. Which abilities a hero owns and how far each is levelled is the first thing you check
about a hero, and until now it meant scrolling past the birth roll to reach the abilities panel.
That panel is unchanged and still the place that says what each ability does, what its next level
is worth, and — in the planner — spends the point. A hero with no pool draws no strip.

**The desktop hero screen is four stages instead of one long column.** Hero, Combat, Gear and
Points, where the column used to run identity → phase → combat → abilities → next point → points →
sheet → items → effective stats without a break. Hero, Gear and Points hold what the planner's tabs
of those names hold, panel for panel, so the two apps read the same way; Combat is the fourth
because this screen computes the phase-scoped figures the planner folds into its hero strip. The
phase control stays above the stages, since it decides what three of them are saying. Points also
picks up the planner's own arrangement: the points table and the next-point ranking side by side,
then the stat sheet, then the breakdown.
