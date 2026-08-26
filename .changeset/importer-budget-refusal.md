---
"@bombfarm/domain": patch
---

Refuse to import a hero whose recovered spent-point vector exceeds its budget.

The game grants exactly one stat point per level, and a save states how many are still unspent — so `level - stat_points_available` is not an estimate of a hero's budget, it is the budget. An inversion that lands above it has charged an ability or gear contribution to spent points: the hero did not over-spend, the sheet math did.

Until now the importer flagged that and stored the vector anyway. It now blocks the hero instead, the same call the missing-`stats` case already makes, and for the same reason: an invented allocation is worse than no hero. That is not theoretical — the Respec Advisor budget escape fixed in the previous release was an over-recovered vector reaching a recommendation.

Only over-recovery blocks. Under-recovery is the cap-saturation case, which yields a build the game can actually grant, so it stays a warning.

No hero from a current save is affected: every hero whose sheet today's model inverts cleanly lands exactly on its budget.
