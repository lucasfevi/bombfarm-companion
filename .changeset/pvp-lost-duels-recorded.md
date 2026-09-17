---
"@bombfarm/desktop": patch
"@bombfarm/contracts": patch
"@bombfarm/game-api": patch
---

PVP tab: lost duels are recorded.

A duel the player lost was refused by the result reader and never reached the history — the
tab listed wins only, while the loss's film was kept with no row to attach to. The reader
required the rune-chest outcome (`won` / `lost`) on every result, and a lost duel issues no chest,
so its result names neither. The chest outcome is now optional on a record (`null` when the
result carries none), and a refused result is logged with the record fields it lacked so the next
one is diagnosable from the log.
