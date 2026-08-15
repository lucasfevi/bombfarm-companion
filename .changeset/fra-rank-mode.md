---
"@bombfarm/domain": minor
"@bombfarm/web": minor
---

The planner's next-point ranking can now rank by what a point does for your farming rotation,
not just raw damage. Farm mode scores each stat by the marginal change it makes to your rotation's
gold or chests per hour, evaluated across your whole enabled roster at that build's best unlocked
phase — the same objective the Farm page's respec advisor already uses. This is now the default
for every account; if you'd already switched to DPS mode, that choice is kept exactly as you left
it.

The old one-shot mode is gone — its math (a hand-tuned bonus for reducing hits-to-kill on one
chosen prop) is retired outright, not deprecated. A save that still had it selected loads on Farm
mode automatically. The Account tab no longer asks you to pick a target prop before it will show
next-point advice; that field still drives the hits-to-kill table below it, it just isn't required
for ranking any more.
