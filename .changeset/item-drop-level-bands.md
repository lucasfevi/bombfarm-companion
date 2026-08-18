---
"@bombfarm/domain": patch
"@bombfarm/web": patch
---

Fixed the item drop level the planner reports for a phase. The 2026-08-15 game update re-cut the
drop bands from nine, topping out at item level 90, to thirty running item level 10 through 300 —
the same ladder that patch gave the item catalog. The committed wiki bundle predated the patch and
kept answering the old table, so the planner under-reported the level on most of the game: phase 51
and phase 60 were both shown as level 20 where the game itself says level 30.

Visible in two places: the Phases tab's "Item drops" row in the phase facts panel, and the item
band column of the farm-ranking table. Ranges such as "30–40" still mean what they meant — the
bands overlap by ten phases, so either tier can roll there — but the numbers on both sides of the
dash are now the ones the game shows. End-game phases move the most: phase 600 reads 300 instead
of 90.

No formula changed and no throughput number moved. The item level is a display field on both
`PhaseIntelGlobal` and `FarmRateRow`; nothing in the gold, XP, drop or solver math reads it.

A new domain test pins all thirty bands against the table's closed form and against two live
in-game readings, so a stale or half-applied refresh of this key fails loudly instead of shipping
a table with a hole in it.
