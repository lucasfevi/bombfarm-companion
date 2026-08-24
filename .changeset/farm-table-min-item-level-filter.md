---
'@bombfarm/domain': minor
'@bombfarm/web': minor
---

Farm Ranking: filter the board by minimum item level

A new "Min item level" control sits beside the difficulty and gate filters and keeps only the
phases where EVERY item dropped is at or above the chosen level. Drop bands overlap by ten
phases, so a phase inside an overlap is judged on its lower tier — it can still hand back the
smaller item, which is exactly what a floor is meant to rule out.

`@bombfarm/domain/phase-wiki` gains `ITEM_LEVEL_TIERS`, the distinct item levels the drop table
offers, which is what the control lists.
