---
"@bombfarm/domain": patch
"@bombfarm/web": patch
---

Team plan: the Point reset table's "Before" column now comes from the plan, not the live roster

A plan outlives the roster it was scored against — the player can respec, re-import or edit
points before opening a hero's panel. The hero panel read those "before" numbers straight out of
the store, so it paired this run's proposed allocation with whatever the hero held at render
time and printed a reset whose deltas never happened, sitting directly above a stat breakdown
computed from the older allocation.

`TeamPlan.pointResets[]` gains `ptsBefore`, the vector the run actually scored, and the panel
reads it. The two tables in a hero's panel now describe the same starting point.
