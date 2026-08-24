---
'@bombfarm/domain': minor
'@bombfarm/web': minor
---

Farm Ranking: filter the board by minimum item level

A new "Min item level" control sits beside the difficulty and gate filters and keeps only the
phases that can drop an item at or above the chosen level. Drop bands overlap by ten phases, so a
phase inside an overlap is kept on its upper tier — the lower tier can still roll there.

`@bombfarm/domain/phase-wiki` gains `ITEM_LEVEL_TIERS`, the distinct item levels the drop table
offers, which is what the control lists.
