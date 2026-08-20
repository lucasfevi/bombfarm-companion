---
"@bombfarm/domain": patch
"@bombfarm/web": patch
---

Show per-phase combat numbers on the Farm page's hero and squad panels

"Your hero" printed one crit-weighted average hit and nothing else. It now breaks that into the
normal hit, the critical hit, and the average between them, and adds field time per deployment.

The Top-N by solo DPS table traded its gear, abilities and power columns — roster facts that say
nothing about how a build performs against the selected phase's mitigation — for the same three
numbers, so every row is directly comparable with the hero panel above it.

`RosterDpsRow` and `HeroPhaseFit` carry `normalHit`, `critHit` and `fieldSecs`; all three come
straight off the advisor pipeline, which now surfaces `fieldSecs` alongside the `uptime` derived
from it. `computeHeroPhaseFit` takes a named-argument object rather than nine positional
parameters.
